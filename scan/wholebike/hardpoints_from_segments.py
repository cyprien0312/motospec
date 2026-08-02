#!/usr/bin/env python3
"""
小 segment 出硬点 —— 方向靠物理约束,不靠短圆柱拟合。

    python hardpoints_from_segments.py <big_cloud.ply> <segments_dir> -o geometry.json

为什么存在(2026-08 R3 实测):噪声 ~2mm 的扫描上,一段 25mm 长的轴头小面片,
fit_cylinder 的**轴向**误差可到几十度(实测同一根后轴左右两段方向差 61°,
但轴线**位置**只差 1.8mm)。方向错了,轴线∩对称面的交点就飘,batch_fit 全链崩。

而摩托车上要取的特征几乎全是**横向**圆柱(轮轴/摇臂轴/避震销/输出轴)——
方向是已知的物理事实,根本不用拟合。固定方向后,每个特征只剩一个 2D 圆心,
这个问题短弧也能解(verify_claims 第 3 组:圆心是曲率中心,不是点的平均)。

流程:
  1. 大云上找两个轮辋(360° 圆,标准件)→ 轮心;前后由"前叉在哪端"判定
  2. 横向 = 前后轮面法向 + 左右成对 segment 质心的共同答案(互相校验)
  3. "上" = 两轮触地点连线的垂线(不依赖轮胎半径)
  4. 每个横向销特征:投影到车身纵平面,2D 圆拟合 → (X, Z);左右各自解一遍,
     差值就是不确定度,直接印出来
  5. 转向轴:steering_head 全 3D 拟合(它不横向,但长基线弧全,拟合得动),
     压回对称面内 → rake、offset
  6. 输出 batch_fit 兼容的 geometry.json → 直接喂 motospec_export.py

自检不过会明说,不会硬给数。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from chassis_geom import fit_cylinder, load_cloud  # noqa: E402

RIM_LO, RIM_HI, RIM_BW = 185.0, 245.0, 2.0
_NR = int((RIM_HI - RIM_LO) / RIM_BW)
_NA = 36
FORK_R = 21.0

# 横向销特征(方向=对称面法向,不拟合)。左右成对的合并解也单边各解一遍。
LATERAL_PINS = ["axle_front", "axle_rear", "swingarm_pivot",
                "shock_upper", "shock_lower", "countershaft"]


def rim_score(P2, c):
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


def wheel_centre_2d(P2, c0, rng, span=240.0, step=8.0):
    S = P2 if len(P2) <= 12000 else P2[rng.choice(len(P2), 12000, replace=False)]
    best, bc = -1.0, np.asarray(c0, float)
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


def solve_wheel(u, seed3, lat, rng, span=60.0):
    """轮心 2D 解,轮面法向**固定为横向**(车把回正是 PRESCAN 门禁,不迭代)。"""
    e1 = np.cross(lat, [1.0, 0, 0])
    if np.linalg.norm(e1) < 0.3:
        e1 = np.cross(lat, [0, 1.0, 0])
    e1 /= np.linalg.norm(e1)
    B = np.c_[e1, np.cross(lat, e1)]
    c3 = np.asarray(seed3, float)
    for it, (span, step) in enumerate(((span, 2.0), (6.0, 0.5))):
        d = u - c3
        sel = (np.abs(d @ lat) < 130) & (np.linalg.norm(d @ B, axis=1) < 430)
        sub = u[sel]
        c2, s = wheel_centre_2d((sub - c3) @ B, np.zeros(2), rng, span, step)
        c3 = c3 + B @ c2
    # 环带 PCA 法向只作为体检指标输出,不参与解
    q = u[sel] - c3
    ax = q @ lat
    rad = np.linalg.norm(q - ax[:, None] * lat, axis=1)
    A = q[(rad > RIM_LO) & (rad < RIM_HI) & (np.abs(ax) < 90)]
    ncheck = None
    if len(A) > 400:
        w, v = np.linalg.eigh((A - A.mean(0)).T @ (A - A.mean(0)) / len(A))
        ncheck = float(np.degrees(np.arccos(np.clip(abs(v[:, 0] @ lat), -1, 1))))
    return c3, ncheck, s


def circle2d(q, iters=12, tol=3.0):
    """Kasa 圆拟合 + 截尾迭代。返回 (centre[2], r, rms, n_inl)。"""
    m = np.ones(len(q), bool)
    c, r = q.mean(0), None
    for _ in range(iters):
        A = np.c_[2 * q[m], np.ones(int(m.sum()))]
        sol, *_ = np.linalg.lstsq(A, (q[m] ** 2).sum(1), rcond=None)
        c = sol[:2]
        r = float(np.sqrt(sol[2] + c @ c))
        d = np.abs(np.hypot(*(q - c).T) - r)
        m = d < tol
        if m.sum() < 8:
            break
    d = np.abs(np.hypot(*(q[m] - c).T) - r)
    ang = np.degrees(np.arctan2(*(q[m] - c).T[::-1]))
    arc = np.unique((ang // 5).astype(int)).size * 5
    return c, r, float(np.sqrt((d ** 2).mean())), int(m.sum()), arc


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("big_cloud")
    ap.add_argument("segments_dir")
    ap.add_argument("-o", "--out", default="geometry.json")
    ap.add_argument("--front-tyre", type=float, required=True,
                    help="前轮实际滚动半径 mm(触地点扫不到,必须外部提供)")
    ap.add_argument("--rear-tyre", type=float, required=True)
    args = ap.parse_args()

    rng = np.random.default_rng(7)
    u = load_cloud(args.big_cloud)
    u = np.unique(u, axis=0)
    segd = Path(args.segments_dir)
    segs = {f.stem: load_cloud(str(f)) for f in sorted(segd.glob("*.ply"))}
    print(f"big cloud {len(u):,} pts   segments: {', '.join(segs)}\n")

    # ---- 1. 横向方向 = 左右成对 segment 质心连线的共识 ----------------------
    # 同一根横向轴的左右两段,质心连线就是轴向。三对独立特征若互洽(<1°),
    # 这个方向比任何从大云拟合出来的东西都可信。
    c0 = u.mean(0)
    w, v = np.linalg.eigh((u - c0).T @ (u - c0) / len(u))
    lat0 = v[:, 0]                                  # 最薄方向,只用来定符号
    pair_vecs = []
    for base in ("axle_front", "axle_rear", "swingarm_pivot"):
        L, R = segs.get(f"{base}_L"), segs.get(f"{base}_R")
        if L is None or R is None:
            continue
        vv = L.mean(0) - R.mean(0)
        vv /= np.linalg.norm(vv)
        if vv @ lat0 < 0:
            vv = -vv
        pair_vecs.append((base, vv))
    if len(pair_vecs) < 2:
        print("!! 左右成对特征不足 2 组,横向方向定不了 —— 停")
        return 2
    def ang(a, b):
        return float(np.degrees(np.arccos(np.clip(abs(a @ b), -1, 1))))

    print("lateral candidates (pairwise angles):")
    for i in range(len(pair_vecs)):
        for j in range(i + 1, len(pair_vecs)):
            print(f"  {pair_vecs[i][0]} vs {pair_vecs[j][0]}: "
                  f"{ang(pair_vecs[i][1], pair_vecs[j][1]):.3f} deg")
    use = pair_vecs
    if len(pair_vecs) >= 3:
        # 找互相吻合最好的两对;明显离群的那对(切割不对称)剔除
        best = min(((ang(pair_vecs[i][1], pair_vecs[j][1]), i, j)
                    for i in range(len(pair_vecs)) for j in range(i + 1, len(pair_vecs))))
        if best[0] < 1.0:
            use = [pair_vecs[best[1]], pair_vecs[best[2]]]
            dropped = [b for k, (b, _) in enumerate(pair_vecs) if k not in best[1:]]
            if dropped:
                print(f"  -> consensus from {use[0][0]} + {use[1][0]} "
                      f"(mutual {best[0]:.2f} deg); dropped outlier: {', '.join(dropped)}")
    lat = np.mean([vv for _, vv in use], axis=0)
    lat /= np.linalg.norm(lat)

    # ---- 2. 轮心:轴头 segment 先给预估,轮辋只在附近 ±60mm 精修 -------------
    # 盲搜整个云端会锁到别的环形结构上(实测锁偏 379mm);轴头段的 2D 圆心
    # 有 ±2~4mm 可靠度,正好做种子;轮辋 360° 的稳健性用来精修。
    eb1 = np.cross(lat, [1.0, 0, 0])
    if np.linalg.norm(eb1) < 0.3:
        eb1 = np.cross(lat, [0, 1.0, 0])
    eb1 /= np.linalg.norm(eb1)
    Blat = np.c_[eb1, np.cross(lat, eb1)]           # 平面⊥横向 的 2D 基

    def prelim_axle(base):
        pts = np.vstack([segs[k] for k in (f"{base}_L", f"{base}_R") if k in segs])
        c2, r, rms, n, arc = circle2d((pts - c0) @ Blat)
        # 横向坐标取 L/R 各自中位数的中点 —— 合并取中位数会被左右点数不均带偏
        mids = [float(np.median((segs[k] - c0) @ lat))
                for k in (f"{base}_L", f"{base}_R") if k in segs]
        return c0 + Blat @ c2 + float(np.mean(mids)) * lat

    wheels = []
    for base, tag in (("axle_rear", "A"), ("axle_front", "B")):
        seed = prelim_axle(base)
        c3, ncheck, score = solve_wheel(u, seed, lat, rng, span=60.0)
        drift = float(np.linalg.norm((c3 - seed) - (((c3 - seed) @ lat) * lat)))
        wheels.append(dict(tag=tag, c=c3, score=score, base=base))
        chk = f"annulus-PCA vs lateral {ncheck:.2f} deg" if ncheck else "annulus thin"
        print(f"wheel {tag} ({base}): centre {np.round(c3,1)}   rim score {score:.0f}"
              f"   rim refine moved {drift:.1f} mm   ({chk})")
        if drift > 25:
            print(f"!! 轮辋精修把轮心拖走 {drift:.0f} mm —— 轴头段或轮辋有一个不对")

    # ---- 3. 车辆坐标系:地面 = 两轮已知胎径的公切线 -------------------------
    # 触地点在多数扫描里被遮挡(轮底压在地上/架子上),"最低可见点"偏高且前后
    # 偏差不同,会给地面线引入零点几度的歪斜,直接偏置 rake。胎径本来就是必填
    # 入参 —— 用它做公切线,几何上是精确的。
    A3 = wheels[0]["c"]                              # rear
    Bv = wheels[1]["c"] - A3
    Bv -= (Bv @ lat) * lat
    D = float(np.linalg.norm(Bv))
    f0 = Bv / D
    n0 = np.cross(f0, lat)
    n0 /= np.linalg.norm(n0)
    if n0 @ (u.mean(0) - A3) < 0:
        n0 = -n0                                     # 车身在上方
    # 公切线约束: up·(front−rear) = Rf − Rr
    sa = (args.front_tyre - args.rear_tyre) / D
    up = float(np.cos(np.arcsin(sa))) * n0 + sa * f0
    up /= np.linalg.norm(up)
    fwd = np.cross(lat, up)

    # 信息量:最低可见点 vs 标称胎径(差值=遮挡量,只报告不使用)
    for wname, C, R in (("rear", wheels[0]["c"], args.rear_tyre),
                        ("front", wheels[1]["c"], args.front_tyre)):
        d = u - C
        m = (np.abs(d @ fwd) < 130) & (np.abs(d @ lat) < 110)
        drop = -float(np.percentile((u[m] - C) @ up, 0.4))
        print(f"  {wname}: lowest visible point {drop:.1f} mm below axle "
              f"(tyre radius {R}; 差 {R-drop:.1f} mm = 遮挡量)")

    # ---- 4. 前端判定:哪端能找到 21mm 前叉管对,哪端是前 --------------------
    def fork_votes(C):
        d = u - C
        reg = u[(np.abs(d @ fwd) < 340) & (d @ up > 100) & (d @ up < 660)
                & (np.abs(d @ lat) < 250)]
        if len(reg) < 2000:
            return 0
        _, idx = cKDTree(reg).query(reg, k=18)
        nb = reg[idx] - reg[idx].mean(1)[:, None]
        N = np.linalg.eigh(np.einsum("nki,nkj->nij", nb, nb) / 18)[1][:, :, 0]
        best = 0
        for phi in np.arange(-45.0, 45.01, 1.0):
            t = np.radians(phi)
            dvec = np.cos(t) * up + np.sin(t) * fwd
            b1 = np.cross(dvec, lat); b1 /= np.linalg.norm(b1)
            B = np.c_[b1, np.cross(dvec, b1)]
            P2, n2 = reg @ B, N @ B
            nn = np.linalg.norm(n2, axis=1)
            ok = nn > 0.55
            if ok.sum() < 200:
                continue
            uu = n2[ok] / nn[ok][:, None]
            votes = np.r_[P2[ok] - FORK_R * uu, P2[ok] + FORK_R * uu]
            lo = votes.min(0)
            gg = np.floor((votes - lo) / 1.2).astype(np.int64)
            _, ct = np.unique(gg, axis=0, return_counts=True)
            best = max(best, int(ct.max()))
        return best

    rear, front = wheels[0], wheels[1]              # 由 segment 命名决定,不猜
    vA, vB = fork_votes(rear["c"]), fork_votes(front["c"])
    if (front["c"] - rear["c"]) @ fwd < 0:
        fwd, lat = -fwd, -lat                       # 保持右手系,+X 指向前轮
    print(f"\nfork votes (check): rear-end={vA}  front-end={vB}"
          + ("   OK" if vB > vA else "   !! 前端反了?前叉应在前轮端"))

    origin = rear["c"] - args.rear_tyre * up        # 后轮触地点(由胎径定义)
    B3 = np.c_[fwd, lat, up]                        # scanner -> bike
    def tob(p):
        return (np.asarray(p, float) - origin) @ B3

    AF, AR = tob(front["c"]), tob(rear["c"])
    print(f"rear axle  (bike frame) {np.round(AR,1)}   front axle {np.round(AF,1)}")
    print(f"wheelbase {AF[0]-AR[0]:.1f} mm   loaded radii: rear {AR[2]:.1f} front {AF[2]:.1f}")

    # ---- 5. 横向销特征:2D 圆,左右各解一遍,差值=不确定度 -------------------
    print(f"\n{'feature':16s} {'X':>8} {'Z':>8} {'r':>6} {'rms':>5} {'arc':>4}"
          f"   L/R delta or note")
    hard = {}
    for base in LATERAL_PINS:
        parts = {s: segs[k] for s, k in (("L", f"{base}_L"), ("R", f"{base}_R"),
                                         ("", base)) if k in segs}
        if not parts:
            continue
        allp = np.vstack(list(parts.values()))
        qb = tob(allp)
        c, r, rms, ninl, arc = circle2d(qb[:, [0, 2]])
        sides = {}
        for s, p in parts.items():
            if s == "":
                continue
            cc, rr, _, _, _ = circle2d(tob(p)[:, [0, 2]])
            sides[s] = cc
        note = ""
        if len(sides) == 2:
            dd = np.hypot(*(sides["L"] - sides["R"]))
            note = f"L/R centre delta {dd:.2f} mm" + ("  !! >5mm" if dd > 5 else "")
        ylat = float(np.median(qb[:, 1]))
        hard[base] = dict(X=float(c[0]), Z=float(c[1]), r=r, rms=rms, arc=arc,
                          Y_median=ylat, n=ninl)
        print(f"{base:16s} {c[0]:8.1f} {c[1]:8.1f} {r:6.1f} {rms:5.2f} {arc:4d}   {note}")

    # 交叉验证:轴头 segment 的 2D 圆心 vs 轮辋定的轮心
    for base, ref in (("axle_front", AF), ("axle_rear", AR)):
        if base in hard:
            d = np.hypot(hard[base]["X"] - ref[0], hard[base]["Z"] - ref[2])
            print(f"  check: {base} segment centre vs rim-based wheel centre "
                  f"delta {d:.2f} mm" + ("  !! >5mm" if d > 5 else "  OK"))

    # ---- 6. 转向轴:steering_head 3D 拟合,压回中面 -------------------------
    rake = offset = None
    if "steering_head" in segs:
        f = fit_cylinder(segs["steering_head"], label="steering_head")
        d3 = f.axis.direction / np.linalg.norm(f.axis.direction)
        db = B3.T @ d3                              # to bike frame
        if db[2] < 0:
            db = -db
        oop = np.degrees(np.arcsin(abs(db[1])))
        db[1] = 0.0
        db /= np.linalg.norm(db)
        rake = float(np.degrees(np.arctan2(-db[0] if db[0] < 0 else db[0], db[2])))
        pb = tob(f.axis.point)
        w2 = np.array([AF[0] - pb[0], AF[2] - pb[2]])
        a2 = np.array([db[0], db[2]])
        offset = float(abs(w2[0] * a2[1] - w2[1] * a2[0]))
        print(f"\nsteering head: {f.report()}")
        print(f"  axis out-of-plane {oop:.2f} deg (应≈0,是自检)  ->  RAKE {rake:.2f} deg")
        print(f"  offset (转向轴⊥前轴距离) {offset:.2f} mm")

    # ---- 7. geometry.json(motospec_export 兼容) ---------------------------
    piv = hard.get("swingarm_pivot")
    g = dict(front_tyre_radius_mm=args.front_tyre, rear_tyre_radius_mm=args.rear_tyre,
             wheelbase_mm=round(float(AF[0] - AR[0]), 2), rake_deg=round(rake, 3) if rake else None,
             offset_mm=round(offset, 2) if offset else None)
    P = {"axle_front": [round(float(AF[0]), 2), 0.0, round(float(AF[2]), 2)],
         "axle_rear": [round(float(AR[0]), 2), 0.0, round(float(AR[2]), 2)]}
    for base, h in hard.items():
        if base.startswith("axle_"):
            continue
        P[base] = [round(h["X"], 2), 0.0, round(h["Z"], 2)]
    if piv:
        swl = np.hypot(piv["X"] - AR[0], piv["Z"] - AR[2])
        # 摇臂角:轴心低于枢轴为负(batch_fit 约定;export 取 abs 得 beta_static)
        beta = -np.degrees(np.arctan2(piv["Z"] - AR[2], piv["X"] - AR[0]))
        g["swingarm_length_mm"] = round(float(swl), 2)
        g["swingarm_angle_deg"] = round(float(beta), 3)
        g["swingarm_pivot_height_mm"] = round(piv["Z"], 2)
    if "shock_upper" in hard and "shock_lower" in hard:
        su, sl = hard["shock_upper"], hard["shock_lower"]
        g["shock_eye_to_eye_mm"] = round(float(np.hypot(su["X"] - sl["X"], su["Z"] - sl["Z"])), 2)
    if "countershaft" in hard and piv:
        cs = hard["countershaft"]
        g["countershaft_to_pivot_mm"] = round(float(np.hypot(cs["X"] - piv["X"], cs["Z"] - piv["Z"])), 2)

    doc = dict(_note="hardpoints_from_segments.py — 方向按物理约束固定,位置 2D 拟合",
               geometry=g, hardpoints_bike_mm=P)
    Path(args.out).write_text(json.dumps(doc, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
