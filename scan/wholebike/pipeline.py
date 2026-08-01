#!/usr/bin/env python3
"""
整车（未拆解）扫描 -> 前端几何。一个文件跑到底,每一步都带质量指标。

    python pipeline.py bike.ply
    python pipeline.py a.ply b.ply        # 两个文件跑同一套,直接对比

拿得到: 前后轮心、轴距、rake、前叉管半径/间距、轮辋半径、胎侧高度。
拿不到: 转向管、避震上下点、摇臂轴 —— 整车带壳时全被遮挡,要拆了扫。

设计上刻意不依赖"轮胎标称半径"和"地面平面":
  * 车辆坐标系的"上"由两个轮胎最低点(触地点)定义
  * 前后轮的区分由"哪一端能找到两根平行的 21mm 圆柱(前叉)"决定
  * 转向轴必然落在车身中面内 —— 这是独立于拟合的几何约束,用来自检
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from chassis_geom import fit_cylinder, load_cloud  # noqa: E402

FORK_R = 21.0          # 前叉外管半径 (R3/765 都在 20~23mm)
FORK_R_TOL = 3.0


# ---------------------------------------------------------------- 载入 / 清理

def main_component(p: np.ndarray, vox: float = 15.0) -> np.ndarray:
    key = np.floor(p / vox).astype(np.int64)
    uk, inv = np.unique(key, axis=0, return_inverse=True)
    parent = np.arange(len(uk))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for a, b in cKDTree(uk.astype(float)).query_pairs(r=1.9, output_type="ndarray"):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb
    lab = np.array([find(i) for i in range(len(uk))])[inv]
    ids, cnt = np.unique(lab, return_counts=True)
    keep = ids[np.argmax(cnt)]
    return p[lab == keep], float(cnt.max() / len(p))


def prep(path: str):
    raw = load_cloud(path)
    p = np.unique(raw, axis=0)
    dup = 1.0 - len(p) / len(raw)
    p, frac = main_component(p)
    c = p.mean(0)
    q = p - c
    w, v = np.linalg.eigh(q.T @ q / len(q))
    R = np.c_[v[:, 2], v[:, 1], v[:, 0]]        # cols: in-plane 1, in-plane 2, lateral
    return p, c, R, q @ R, dict(n_raw=len(raw), n_unique=len(p) if dup == 0 else None,
                                dup_frac=dup, main_frac=frac)


# ------------------------------------------------------------------ 轮心定位

RIM_LO, RIM_HI, RIM_BW = 185.0, 245.0, 2.0     # 17"/16"/18" 轮辋都落在这个带里
_NR = int((RIM_HI - RIM_LO) / RIM_BW)
_NA = 36


def rim_score(P2, c):
    """
    轮心的判据不是"点最多",而是**这个圆心下轮辋是不是一个高覆盖的圆**。
    每台摩托车都有轮辋,半径必然落在 RIM_LO..RIM_HI —— 这是一个物理约束,
    比"径向直方图最尖"稳得多(后者会被地面、挡泥板、外壳带偏)。
    返回 max_r( 该半径带的点数 x 圆周覆盖率 )。
    """
    d = P2 - c
    r = np.hypot(d[:, 0], d[:, 1])
    m = (r >= RIM_LO) & (r < RIM_HI)
    if m.sum() < 150:
        return 0.0
    rb = ((r[m] - RIM_LO) / RIM_BW).astype(np.int32)
    ab = (((np.degrees(np.arctan2(d[m, 1], d[m, 0])) + 180.0) / (360.0 / _NA))
          .astype(np.int32) % _NA)
    H = np.zeros((_NR, _NA))
    np.add.at(H, (rb, ab), 1.0)
    occ = (H > 0).sum(1) / _NA
    return float((H.sum(1) * occ).max())


def wheel_centre(P2, c0, rng, span=240.0, step=8.0):
    """粗 -> 中 -> 细,目标函数是 rim_score。"""
    S = P2 if len(P2) <= 12000 else P2[rng.choice(len(P2), 12000, replace=False)]
    c0 = np.asarray(c0, float)
    best, bc = -1.0, c0
    for dx in np.arange(-span, span + 1e-9, step):
        for dz in np.arange(-span, span + 1e-9, step):
            c = c0 + np.array([dx, dz])
            s = rim_score(S, c)
            if s > best:
                best, bc = s, c
    for sp, st, P in ((step, 1.5, P2), (2.0, 0.25, P2)):
        for dx in np.arange(-sp, sp + 1e-9, st):
            for dz in np.arange(-sp, sp + 1e-9, st):
                c = bc + np.array([dx, dz])
                s = rim_score(P, c)
                if s > best:
                    best, bc = s, c
    return bc, best


def concentric_radii(P2, c, top=6, min_arc=300):
    r = np.hypot(*(P2 - c).T)
    ang = np.degrees(np.arctan2(*(P2 - c).T[::-1]))
    h, e = np.histogram(r, bins=np.arange(0, 401, 2))
    out = []
    for i in np.argsort(-h):
        band = (r >= e[i]) & (r < e[i] + 2)
        arc = np.unique((ang[band] // 5).astype(int)).size * 5
        if arc >= min_arc and h[i] > 300:
            out.append((float(e[i]), int(h[i]), int(arc)))
        if len(out) >= top:
            break
    return out


# ------------------------------------------------------------------- 前叉搜索

def normals(pts, k=18):
    _, idx = cKDTree(pts).query(pts, k=k)
    nb = pts[idx] - pts[idx].mean(1)[:, None]
    return np.linalg.eigh(np.einsum("nki,nkj->nij", nb, nb) / k)[1][:, :, 0]


def find_forks(pts, N, lat, up, seed, r=FORK_R):
    """
    转向轴一定落在车身中面内 -> 方向只有一个自由度(中面内的转角 phi)。
    对每个 phi 用法向量投票找半径 r 的圆柱轴,取票数最高的 phi。
    """
    e_a = np.cross(lat, up); e_a /= np.linalg.norm(e_a)      # 中面内,水平
    best = None
    for phi in np.arange(-45.0, 45.01, 0.5):
        t = np.radians(phi)
        d = np.cos(t) * up + np.sin(t) * e_a
        b1 = np.cross(d, lat); b1 /= np.linalg.norm(b1)
        B = np.c_[b1, np.cross(d, b1)]
        P2, n2 = pts @ B, N @ B
        nn = np.linalg.norm(n2, axis=1)
        ok = nn > 0.55
        if ok.sum() < 200:
            continue
        u = n2[ok] / nn[ok][:, None]
        v = np.r_[P2[ok] - r * u, P2[ok] + r * u]
        lo = v.min(0)
        g = np.floor((v - lo) / 1.2).astype(np.int64)
        uq, ct = np.unique(g, axis=0, return_counts=True)
        if best is None or ct.max() > best[0]:
            best = (int(ct.max()), phi, d, B, P2, lo, uq, ct)
    if best is None:
        return None
    votes, phi, d, B, P2, lo, uq, ct = best
    picked, tubes = [], []
    for i in np.argsort(-ct)[:60]:
        c2 = lo + (uq[i] + 0.5) * 1.2
        if any(np.hypot(*(c2 - q)) < 70 for q in picked):
            continue
        m = np.abs(np.hypot(*(P2 - c2).T) - r) < FORK_R_TOL
        if m.sum() < 400:
            continue
        picked.append(c2)
        try:
            f = fit_cylinder(pts[m], label="fork tube")
        except Exception:
            continue
        dd = f.axis.direction / np.linalg.norm(f.axis.direction)
        if dd @ up < 0:
            dd = -dd
        tubes.append(dict(fit=f, dir=dd, pts=pts[m]))
        if len(tubes) >= 2:
            break
    return dict(votes=votes, phi=phi, tubes=tubes)


# ------------------------------------------------------------------------ 主

def run(path: str) -> dict:
    rng = np.random.default_rng(7)
    p, cen, R, u, meta = prep(path)
    name = Path(path).name
    print(f"\n{'=' * 74}\n{name}\n{'=' * 74}")
    print(f"  raw {meta['n_raw']:,} pts   duplicates {100*meta['dup_frac']:.1f}%   "
          f"largest connected component {100*meta['main_frac']:.1f}%   kept {len(p):,}")
    if meta["main_frac"] < 0.95:
        print(f"  !! {100*(1-meta['main_frac']):.1f}% of the cloud is NOT connected to the "
              f"main body -> check for a mis-registered chunk")
    d, _ = cKDTree(p).query(p[rng.choice(len(p), 20000, replace=False)], k=2)
    print(f"  median point spacing {np.median(d[:, 1]):.2f} mm")

    lat = np.array([0.0, 0.0, 1.0])                          # view-frame lateral axis
    a1 = u[:, 0]
    seeds = [(np.percentile(a1, 1) + 320, "end A"), (np.percentile(a1, 99) - 320, "end B")]

    wheels = []
    for x0, tag in seeds:
        m = (np.abs(u[:, 0] - x0) < 520) & (np.abs(u[:, 2]) < 120)
        sub = u[m]
        c2, s = wheel_centre(sub[:, [0, 1]], np.array([x0, np.median(sub[:, 1])]), rng)
        rad = concentric_radii(sub[:, [0, 1]], c2)
        wheels.append(dict(tag=tag, c=c2, sharp=s, radii=rad, sel=m))
        rim = [x for x in rad if RIM_LO <= x[0] <= RIM_HI]
        print(f"  {tag}: centre ({c2[0]:9.1f},{c2[1]:8.1f})  rim score {s:.0f}"
              f"   {'RIM FOUND' if rim else '!! NO RIM -> centre unreliable'}")
        for rr, n_, arc in rad[:4]:
            print(f"        concentric r={rr:6.1f}  n={n_:5d}  arc={arc:3d} deg")

    # ---- up from the two tyre contact patches (no tyre-radius assumption) ----
    C = [np.array([w["c"][0], w["c"][1], 0.0]) for w in wheels]
    up = np.array([0.0, 1.0, 0.0])
    fwd = np.array([1.0, 0.0, 0.0])
    for _ in range(12):
        drops = []
        for c in C:
            m = (np.abs((u - c) @ fwd) < 130) & (np.abs((u - c) @ lat) < 110)
            drops.append(np.percentile((u[m] - c) @ up, 0.4))
        P = [c + h * up for c, h in zip(C, drops)]
        g = P[1] - P[0]
        g -= (g @ lat) * lat
        g /= np.linalg.norm(g)
        un = np.cross(g, lat)
        un /= np.linalg.norm(un)
        if un @ up < 0:
            un = -un
        moved = np.degrees(np.arccos(np.clip(un @ up, -1, 1)))
        up, fwd = un, np.cross(lat, un)
        if moved < 1e-5:
            break
    print(f"  ground solved from contact patches (converged, |up| moved {moved:.5f} deg)")

    # ---- forks at each end: whichever end has two 21 mm parallel tubes is the FRONT ----
    best_end, best_res = None, None
    for w in wheels:
        c3 = np.array([w["c"][0], w["c"][1], 0.0])
        d3 = u - c3
        reg = u[(np.abs(d3 @ fwd) < 340) & (d3 @ up > 100) & (d3 @ up < 660)
                & (np.abs(d3 @ lat) < 250)]
        if len(reg) < 2000:
            continue
        res = find_forks(reg, normals(reg), lat, up, c3)
        got = len(res["tubes"]) if res else 0
        print(f"  {w['tag']}: fork search -> {got} tube(s), votes {res['votes'] if res else 0}")
        if res and got == 2 and (best_res is None or res["votes"] > best_res["votes"]):
            best_end, best_res = w, res

    out = dict(file=name, n_points=int(len(p)),
               duplicate_frac=round(meta["dup_frac"], 4),
               main_component_frac=round(meta["main_frac"], 4),
               median_spacing_mm=round(float(np.median(d[:, 1])), 3),
               wheel_centre_distance_mm=round(float(np.hypot(*(wheels[0]["c"] - wheels[1]["c"]))), 1),
               concentric_radii={w["tag"]: w["radii"] for w in wheels})

    if best_res is None:
        print("  !! no fork tube pair found -> front end not identified")
        return out

    t0, t1 = best_res["tubes"]
    dmean = t0["dir"] + t1["dir"]
    dmean /= np.linalg.norm(dmean)
    rake = np.degrees(np.arccos(np.clip(abs(dmean @ up), -1, 1)))
    axle = np.array([best_end["c"][0], best_end["c"][1], 0.0])
    mids = []
    for t in (t0, t1):
        dd = t["dir"]
        pt = t["fit"].axis.point
        mids.append(pt + ((axle - pt) @ dd) * dd)
    sep = float(np.linalg.norm(mids[0] - mids[1]))
    mid_lat = float(abs((0.5 * (mids[0] + mids[1]) - axle) @ lat))
    other = wheels[0] if best_end is wheels[1] else wheels[1]
    wb = float(abs((np.array([other["c"][0], other["c"][1], 0.0]) - axle) @ fwd))

    print(f"\n  FRONT end = {best_end['tag']}")
    for t in (t0, t1):
        f = t["fit"]
        print(f"    {f.report()}")
        print(f"       {np.degrees(np.arccos(abs(t['dir'] @ up))):.2f} deg from vertical")
    print(f"\n  RAKE                     {rake:.2f} deg")
    print(f"  fork tube separation     {sep:.1f} mm")
    print(f"  fork midpoint off-centre {mid_lat:.2f} mm   "
          f"<- geometric self-check, should be ~0")
    print(f"  wheelbase (horizontal)   {wb:.1f} mm")

    # ------------------------------------------------------------------ 门禁
    # 一个看起来像样的错数比没有数更糟。任何一条不过,结果就标成 UNRELIABLE。
    gates = []
    front_rim = [x for x in best_end["radii"] if RIM_LO <= x[0] <= RIM_HI]
    gates.append(("front wheel rim found (bars must be STRAIGHT — a steered "
                  "front wheel projects to an ellipse and has no rim circle)",
                  bool(front_rim)))
    gates.append(("fork midpoint on the median plane  (< 3 mm)", mid_lat < 3.0))
    gates.append((f"two fork tubes agree on direction  (< 0.20 deg)",
                  abs(np.degrees(np.arccos(abs(t0["dir"] @ t1["dir"])))) < 0.20))
    gates.append(("fork radii agree  (< 0.5 mm)",
                  abs(t0["fit"].radius - t1["fit"].radius) < 0.5))
    gates.append(("both fork arcs >= 120 deg",
                  min(t0["fit"].arc_span_deg, t1["fit"].arc_span_deg) >= 120))
    gates.append(("main connected component >= 95%", meta["main_frac"] >= 0.95))
    ok = all(g[1] for g in gates)
    print(f"\n  {'-' * 68}\n  QUALITY GATES")
    for text, passed in gates:
        print(f"    [{'PASS' if passed else 'FAIL'}] {text}")
    print(f"  {'-' * 68}")
    print(f"  >>> {'RESULTS USABLE' if ok else 'RESULTS UNRELIABLE — do not use the numbers above'}")
    out["gates"] = {t: bool(v) for t, v in gates}
    out["usable"] = bool(ok)

    out.update(rake_deg=round(float(rake), 2),
               fork_radius_mm=[round(float(t["fit"].radius), 2) for t in (t0, t1)],
               fork_arc_deg=[int(t["fit"].arc_span_deg) for t in (t0, t1)],
               fork_rms_mm=[round(float(t["fit"].rms), 2) for t in (t0, t1)],
               fork_separation_mm=round(sep, 1),
               fork_midpoint_off_median_plane_mm=round(mid_lat, 2),
               wheelbase_mm=round(wb, 1),
               front_end=best_end["tag"])
    return out


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        raise SystemExit(1)
    results = [run(a) for a in sys.argv[1:]]
    if len(results) > 1:
        print(f"\n{'=' * 74}\nCROSS-CHECK  (same feature fitted from two scans)\n{'=' * 74}")
        keys = ["median_spacing_mm", "main_component_frac", "rake_deg", "fork_separation_mm",
                "fork_midpoint_off_median_plane_mm", "wheelbase_mm"]
        w = max(len(k) for k in keys)
        print(f"{'':{w}}  " + "  ".join(f"{r['file']:>16}" for r in results) + "     delta")
        for k in keys:
            vals = [r.get(k) for r in results]
            cells = "  ".join(f"{('-' if v is None else f'{v:.2f}'):>16}" for v in vals)
            dv = ("" if any(v is None for v in vals)
                  else f"{abs(vals[0]-vals[1]):.2f}")
            print(f"{k:{w}}  {cells}     {dv}")
    Path("pipeline_out.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print("\nwrote pipeline_out.json")
