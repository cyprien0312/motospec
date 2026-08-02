#!/usr/bin/env python3
"""
batch_fit.py
============
把 CloudCompare 分割好的一堆 .ply,一次跑完 → 输出车辆坐标系下的硬点表 +
底盘几何数值 + 质量报告。

用法
----
    # 1. 扫描 + CloudCompare 分割,每个特征存一个 ply 到 segments/
    # 2. 生成配置模板(会自动读目录里的文件名)
    python batch_fit.py --init segments/ -o config.json

    # 3. 手动编辑 config.json:填轮胎半径、配对关系、隐藏点偏距
    # 4. 跑
    python batch_fit.py --run config.json

输出
----
    out/hardpoints_scanner.csv   原始扫描坐标系下的硬点
    out/hardpoints_bike.csv      车辆坐标系下的硬点(这个才是你要的)
    out/motospec_inputs.csv      按 Motospec 常见字段整理的输入表
    out/geometry.json            全部结果 + 变换矩阵
    out/quality_report.txt       每个拟合的质量,先看这个

车辆坐标系定义
--------------
    原点  : 后轮触地点(可在 config 里改成 rear_axle / front_contact)
    +X    : 向前(车头方向)
    +Y    : 向右(车手视角)
    +Z    : 向上
    地面  : Z = 0 平面,由前后轮实际滚动半径确定车辆姿态

依赖: numpy, scipy, chassis_geom.py。open3d 只在读 ply 时需要。
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from chassis_geom import (  # noqa: E402
    Axis, Plane, load_cloud, largest_cluster,
    fit_cylinder, fit_sphere, fit_plane,
    symmetry_plane_from_pairs, hidden_point_from_rod,
    HardpointSet,
)

# --------------------------------------------------------------------------
# 特征名 → 用途的约定。文件名里包含这些关键词会被自动识别。
# --------------------------------------------------------------------------
KNOWN_FEATURES = {
    "steering_head":   "转向头轴承孔(上下各扫一段更准)",
    "swingarm_pivot":  "摇臂支点",
    "axle_front":      "前轮轴",
    "axle_rear":       "后轮轴",
    "shock_upper":     "避震上锁点",
    "shock_lower":     "避震下锁点",
    "rocker_pivot":    "摇杆(rocker)支点",
    "rocker_shock":    "摇杆-避震连接点",
    "rocker_link":     "摇杆-拉杆连接点",
    "link_frame":      "拉杆-车架连接点(pro-link: 摇杆在摇臂上)",
    "link_swingarm":   "拉杆-摇臂连接点(linked: 摇杆在车架上)",
    "countershaft":    "输出轴中心(算 anti-squat 必需)",
    "footpeg":         "脚踏支架(只用来定对称面)",
    "engine_mount":    "发动机座(只用来定对称面)",
}

SIDE_SUFFIXES = ("_L", "_R", "_l", "_r", "-L", "-R")


# --------------------------------------------------------------------------
# 配置模板生成
# --------------------------------------------------------------------------

def guess_type(name: str) -> str:
    n = name.lower()
    if "ball" in n or "sphere" in n or n.startswith("sph"):
        return "sphere"
    if "plane" in n or "face" in n or n.startswith("pln"):
        return "plane"
    return "cylinder"


def base_name(name: str) -> str:
    for s in SIDE_SUFFIXES:
        if name.endswith(s):
            return name[: -len(s)]
    return name


def init_config(seg_dir: str, out_path: str) -> None:
    d = Path(seg_dir)
    files = sorted(
        [f for f in d.iterdir()
         if f.suffix.lower() in (".ply", ".pcd", ".xyz", ".asc", ".txt")]
    )
    if not files:
        raise SystemExit(f"{seg_dir} 里没找到点云文件")

    features = {}
    for f in files:
        key = f.stem
        features[key] = {
            "file": f.name,
            "type": guess_type(key),
            "declustter": True,
            "note": KNOWN_FEATURES.get(base_name(key), ""),
        }

    # 自动找左右配对
    pairs, seen = [], set()
    for key in features:
        b = base_name(key)
        if b == key or b in seen:
            continue
        L = next((k for k in features if base_name(k) == b and k.endswith(("_L", "_l", "-L"))), None)
        R = next((k for k in features if base_name(k) == b and k.endswith(("_R", "_r", "-R"))), None)
        if L and R:
            pairs.append([L, R])
            seen.add(b)

    cfg = {
        "_readme": [
            "type: cylinder / sphere / plane",
            "declustter: true 表示先做密度聚类只留最大一簇(甩掉旁边的支架)",
            "hidden_point: 穿杆法用。rod=外露段的特征名, standoff=端面到孔中心的距离(mm,卡尺量)",
            "symmetry_pairs 至少 3 对,且不要共线",
            "tyre 半径必须用实际压载后的滚动半径,不是轮胎标称尺寸",
        ],
        "project": d.parent.name or "chassis",
        "segments_dir": str(d),
        "output_dir": "out",
        "features": features,
        "symmetry_pairs": pairs or [["swingarm_pivot_L", "swingarm_pivot_R"]],
        "tyres": {"front_radius_mm": None, "rear_radius_mm": None},
        "sprockets": {"front_teeth": None, "rear_teeth": None, "chain_pitch_mm": 15.875},
        "datum": "rear_contact_patch",
        "scale_check": {
            "feature_a": None, "feature_b": None, "known_distance_mm": None,
            "_note": "两个特征之间用卡尺量的真实距离,用来验证扫描绝对尺度",
        },
        "quality_limits": {
            "min_arc_deg": 120.0, "max_rms_mm": 0.15,
            "max_pair_angle_deg": 0.1, "max_pair_offset_mm": 0.2,
            "max_symmetry_rms_mm": 0.3,
        },
    }
    Path(out_path).write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"写好模板: {out_path}")
    print(f"  发现 {len(features)} 个特征, 自动配对 {len(pairs)} 组")
    print("  → 现在去填 tyres 半径,检查 symmetry_pairs,然后 --run")


# --------------------------------------------------------------------------
# 拟合阶段
# --------------------------------------------------------------------------

class FitResults:
    def __init__(self):
        self.axes: dict[str, Axis] = {}
        self.points: dict[str, np.ndarray] = {}
        self.planes: dict[str, Plane] = {}
        self.reports: list[str] = []
        self.warnings: list[str] = []


def run_fits(cfg: dict) -> FitResults:
    res = FitResults()
    seg_dir = Path(cfg["segments_dir"])
    lim = cfg.get("quality_limits", {})

    for key, spec in cfg["features"].items():
        path = seg_dir / spec["file"]
        if not path.exists():
            res.warnings.append(f"[缺文件] {key}: {path}")
            continue
        try:
            pts = load_cloud(str(path))
        except Exception as exc:
            res.warnings.append(f"[读取失败] {key}: {exc}")
            continue

        if spec.get("declustter", True) and len(pts) > 100:
            try:
                pts = largest_cluster(pts, eps=spec.get("cluster_eps"))
            except ValueError:
                pass

        kind = spec.get("type", "cylinder")
        try:
            if kind == "cylinder":
                f = fit_cylinder(pts, label=key)
                res.axes[key] = f.axis
                res.points[key] = f.axis.point
                res.reports.append(f.report())
                if f.arc_span_deg < lim.get("min_arc_deg", 120.0):
                    res.warnings.append(
                        f"[覆盖不足] {key}: 只有 {f.arc_span_deg:.0f}° 圆周 "
                        f"→ 补扫,或改用穿杆法"
                    )
                if f.rms > lim.get("max_rms_mm", 0.15):
                    res.warnings.append(
                        f"[噪声偏大] {key}: rms={f.rms:.3f}mm → 可能是配准漂移,"
                        f"检查标记点"
                    )
            elif kind == "sphere":
                f = fit_sphere(pts, label=key)
                res.points[key] = f.center
                res.reports.append(f.report())
            elif kind == "plane":
                f = fit_plane(pts, label=key)
                res.planes[key] = f.plane
                res.reports.append(f.report())
            else:
                res.warnings.append(f"[未知类型] {key}: {kind}")
        except Exception as exc:
            res.warnings.append(f"[拟合失败] {key}: {exc}")

    # 隐藏点:沿棒轴推进
    for key, spec in cfg["features"].items():
        hp = spec.get("hidden_point")
        if not hp:
            continue
        rod = res.axes.get(hp["rod"])
        if rod is None:
            res.warnings.append(f"[隐藏点] {key}: 找不到棒特征 {hp['rod']}")
            continue
        ref = res.points.get(hp.get("reference", hp["rod"]))
        res.points[key] = hidden_point_from_rod(rod, ref, float(hp["standoff"]))
        res.axes.setdefault(key, rod)
        res.reports.append(f"HIDDEN {key}: 沿 {hp['rod']} 轴推 {hp['standoff']}mm")

    # 左右合并
    for L, R in cfg.get("symmetry_pairs", []):
        if L in res.axes and R in res.axes:
            merged = res.axes[L].merge(res.axes[R], label=base_name(L))
            rep = merged.merge_report
            res.axes[base_name(L)] = merged
            res.reports.append(
                f"MERGE {base_name(L)}: 夹角 {rep['angle_deg']:.3f}° "
                f"偏移 {rep['offset_mm']:.3f}mm"
            )
            if rep["angle_deg"] > lim.get("max_pair_angle_deg", 0.1):
                res.warnings.append(
                    f"[左右不共线] {base_name(L)}: 夹角 {rep['angle_deg']:.3f}° "
                    f"→ 配准漂移,或车架真的歪了"
                )
            if rep["offset_mm"] > lim.get("max_pair_offset_mm", 0.2):
                res.warnings.append(
                    f"[左右不共线] {base_name(L)}: 偏移 {rep['offset_mm']:.3f}mm"
                )
    return res


# --------------------------------------------------------------------------
# 建立车辆坐标系
# --------------------------------------------------------------------------

def build_bike_frame(res: FitResults, cfg: dict) -> tuple[np.ndarray, np.ndarray, Plane]:
    """
    返回 (R, t, symmetry_plane):  p_bike = R @ (p_scanner - t)

    步骤:
      1. 对称面法向 → Y 轴(用带 _R 的特征定 +Y 方向)
      2. 后轴→前轴 在对称面内的投影 → 临时 X
      3. Z = X × Y,用转向头位置定 +Z 朝上
      4. 按前后轮实际半径把车"放平":绕 Y 转一个角度,使两轮触地点等高
      5. 原点平移到 datum
    """
    pairs = []
    for L, R in cfg.get("symmetry_pairs", []):
        if L in res.points and R in res.points:
            pairs.append((res.points[L], res.points[R]))
    if len(pairs) < 2:
        raise SystemExit("对称面至少需要 2 对(建议 3 对)左右特征,检查 symmetry_pairs")

    sym = symmetry_plane_from_pairs(pairs)
    lim = cfg.get("quality_limits", {})
    if sym.rms > lim.get("max_symmetry_rms_mm", 0.3):
        res.warnings.append(
            f"[对称面] rms={sym.rms:.3f}mm 偏大 → 某一对左右特征可能配错了"
        )

    # +Y 指向右:用第一对里的 R 侧特征
    y = sym.normal
    L0, R0 = pairs[0]
    if np.dot(R0 - L0, y) < 0:
        y = -y

    def locate(key: str) -> np.ndarray | None:
        """先找直接拟合的点,再退到(可能是左右合并出来的)轴线上的点。"""
        if key in res.points:
            return res.points[key]
        if key in res.axes:
            return res.axes[key].point
        return None

    fa, ra = locate("axle_front"), locate("axle_rear")
    if fa is None or ra is None:
        raise SystemExit(
            "必须有 axle_front 和 axle_rear(可以是 axle_front_L/_R 这样的左右件,"
            "但要在 symmetry_pairs 里配好对)"
        )
    fa, ra = sym.project_point(fa), sym.project_point(ra)

    x = fa - ra
    x = x - np.dot(x, y) * y
    x /= np.linalg.norm(x)
    z = np.cross(x, y)
    z /= np.linalg.norm(z)

    # +Z 朝上:转向头一定在轮轴上方
    sh = locate("steering_head")
    if sh is not None and np.dot(sh - fa, z) < 0:
        z, y = -z, -y

    # 放平:让前后触地点等高
    tyres = cfg.get("tyres", {})
    Rf = tyres.get("front_radius_mm")
    Rr = tyres.get("rear_radius_mm")
    R0m = np.vstack([x, y, z])
    if Rf and Rr:
        L_axle = float(np.linalg.norm(fa - ra))
        # 轴心连线相对地面的倾角。后轮大 → 连线向前下倾 → 需要把 X 轴向上转回来。
        theta = np.arcsin(np.clip((Rr - Rf) / L_axle, -1, 1))
        c, s = np.cos(theta), np.sin(theta)
        Ry = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])   # 绕 bike-Y
        R0m = Ry @ R0m
    else:
        res.warnings.append("[姿态] 没填轮胎半径,车辆姿态未校平,rake/trail 不可用")

    # 原点
    datum = cfg.get("datum", "rear_contact_patch")
    ra_b = R0m @ ra
    fa_b = R0m @ fa
    if datum == "rear_contact_patch" and Rr:
        origin_b = ra_b - np.array([0.0, 0.0, Rr])
    elif datum == "front_contact_patch" and Rf:
        origin_b = fa_b - np.array([0.0, 0.0, Rf])
    elif datum == "front_axle":
        origin_b = fa_b
    else:
        origin_b = ra_b
    t_scanner = np.linalg.inv(R0m) @ origin_b
    return R0m, t_scanner, sym


# --------------------------------------------------------------------------
# 派生几何
# --------------------------------------------------------------------------

def derive_geometry(P: dict[str, np.ndarray], axes_bike: dict[str, Axis],
                    cfg: dict) -> dict:
    """P 为车辆坐标系下的硬点字典。"""
    g: dict = {}
    tyres = cfg.get("tyres", {})
    Rf, Rr = tyres.get("front_radius_mm"), tyres.get("rear_radius_mm")

    fa, ra = P.get("axle_front"), P.get("axle_rear")
    if fa is not None and ra is not None:
        g["wheelbase_mm"] = round(float(fa[0] - ra[0]), 2)
        g["front_axle_height_mm"] = round(float(fa[2]), 2)
        g["rear_axle_height_mm"] = round(float(ra[2]), 2)

    sh_axis = axes_bike.get("steering_head")
    if sh_axis is not None and fa is not None and Rf:
        d = sh_axis.direction
        d = d if d[2] > 0 else -d
        g["rake_deg"] = round(float(np.degrees(np.arccos(np.clip(d[2], -1, 1)))), 3)
        # 转向轴延长线交地面 (z=0)
        t = -sh_axis.point[2] / d[2]
        steer_ground_x = float(sh_axis.point[0] + t * d[0])
        g["trail_mm"] = round(float(fa[0] - steer_ground_x), 2)
        g["offset_mm"] = round(float(sh_axis.distance_to_point(fa)), 2)
        g["steering_head_top_xyz"] = np.round(sh_axis.point, 2).tolist()

    piv = P.get("swingarm_pivot")
    if piv is not None:
        g["swingarm_pivot_xyz"] = np.round(piv, 2).tolist()
        g["swingarm_pivot_height_mm"] = round(float(piv[2]), 2)
        if ra is not None:
            v = ra - piv
            g["swingarm_length_mm"] = round(float(np.linalg.norm(v[[0, 2]])), 2)
            g["swingarm_angle_deg"] = round(
                float(np.degrees(np.arctan2(piv[2] - ra[2], piv[0] - ra[0]))), 3)
        cs = P.get("countershaft")
        if cs is not None:
            g["countershaft_xyz"] = np.round(cs, 2).tolist()
            g["countershaft_to_pivot_mm"] = round(float(np.linalg.norm((cs - piv)[[0, 2]])), 2)

    su, sl = P.get("shock_upper"), P.get("shock_lower")
    if su is not None and sl is not None:
        g["shock_eye_to_eye_mm"] = round(float(np.linalg.norm(su - sl)), 2)
        g["shock_upper_xyz"] = np.round(su, 2).tolist()
        g["shock_lower_xyz"] = np.round(sl, 2).tolist()

    for k in ("rocker_pivot", "rocker_shock", "rocker_link",
              "link_frame", "link_swingarm"):
        if k in P:
            g[f"{k}_xyz"] = np.round(P[k], 2).tolist()

    if Rf:
        g["front_tyre_radius_mm"] = Rf
    if Rr:
        g["rear_tyre_radius_mm"] = Rr
    return g


# --------------------------------------------------------------------------
# 输出
# --------------------------------------------------------------------------

MOTOSPEC_FIELDS = [
    ("Wheelbase",              "wheelbase_mm",              "mm"),
    ("Rake / caster",          "rake_deg",                  "deg"),
    ("Trail",                  "trail_mm",                  "mm"),
    ("Fork offset",            "offset_mm",                 "mm"),
    ("Front tyre radius",      "front_tyre_radius_mm",      "mm"),
    ("Rear tyre radius",       "rear_tyre_radius_mm",       "mm"),
    ("Swingarm length",        "swingarm_length_mm",        "mm"),
    ("Swingarm angle",         "swingarm_angle_deg",        "deg"),
    ("Swingarm pivot height",  "swingarm_pivot_height_mm",  "mm"),
    ("Countershaft to pivot",  "countershaft_to_pivot_mm",  "mm"),
    ("Shock eye-to-eye",       "shock_eye_to_eye_mm",       "mm"),
]


def write_outputs(cfg: dict, res: FitResults, P_scan: dict, P_bike: dict,
                  geo: dict, R: np.ndarray, t: np.ndarray) -> Path:
    out = Path(cfg.get("output_dir", "out"))
    out.mkdir(parents=True, exist_ok=True)

    for name, D in (("hardpoints_scanner.csv", P_scan), ("hardpoints_bike.csv", P_bike)):
        with open(out / name, "w", encoding="utf-8") as f:
            f.write("feature,x_mm,y_mm,z_mm\n")
            for k in sorted(D):
                v = D[k]
                f.write(f"{k},{v[0]:.3f},{v[1]:.3f},{v[2]:.3f}\n")

    with open(out / "motospec_inputs.csv", "w", encoding="utf-8") as f:
        f.write("parameter,value,unit,source\n")
        for label, key, unit in MOTOSPEC_FIELDS:
            val = geo.get(key)
            f.write(f"{label},{'' if val is None else val},{unit},"
                    f"{'scan' if val is not None else 'MISSING'}\n")
        f.write("Front spring rate,,N/mm,measure\n")
        f.write("Rear spring rate,,N/mm,measure\n")
        f.write("Total mass (ready to race),,kg,weigh\n")
        f.write("Rider mass,,kg,weigh\n")
        f.write("CoG height,,mm,measure (tilt test)\n")
        f.write("Front weight bias,,%,corner weights\n")

    with open(out / "geometry.json", "w", encoding="utf-8") as f:
        json.dump({
            "project": cfg.get("project"),
            "geometry": geo,
            "hardpoints_bike_mm": {k: np.round(v, 4).tolist() for k, v in P_bike.items()},
            "transform": {
                "_formula": "p_bike = R @ (p_scanner - t)",
                "R": np.round(R, 8).tolist(),
                "t": np.round(t, 6).tolist(),
            },
            "warnings": res.warnings,
        }, f, indent=2, ensure_ascii=False)

    lines = ["=" * 68, f"拟合质量报告 — {cfg.get('project')}", "=" * 68, ""]
    lines += res.reports
    lines += ["", "-" * 68, f"警告 ({len(res.warnings)}):", "-" * 68]
    lines += res.warnings or ["  无 — 数据看起来干净"]

    sc = cfg.get("scale_check", {})
    if sc.get("feature_a") and sc.get("known_distance_mm"):
        a, b = P_bike.get(sc["feature_a"]), P_bike.get(sc["feature_b"])
        if a is not None and b is not None:
            meas = float(np.linalg.norm(a - b))
            known = float(sc["known_distance_mm"])
            err = (meas - known) / known * 100
            lines += ["", "-" * 68, "绝对尺度验证:", "-" * 68,
                      f"  扫描值 {meas:.3f}mm  卡尺值 {known:.3f}mm  "
                      f"偏差 {meas - known:+.3f}mm ({err:+.3f}%)"]
            if abs(err) > 0.1:
                lines.append("  !! 尺度偏差 >0.1%,所有长度都要按比例修正")
    else:
        lines += ["", "!! 没做绝对尺度验证 — 强烈建议补上,结构光的尺度误差是系统性的"]

    (out / "quality_report.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out


# --------------------------------------------------------------------------

def run(config_path: str) -> None:
    cfg = json.loads(Path(config_path).read_text(encoding="utf-8"))
    res = run_fits(cfg)
    if not res.points:
        raise SystemExit("一个特征都没拟合成功,看 warnings")

    R, t, sym = build_bike_frame(res, cfg)

    # 硬点:轴线与对称面的交点(圆柱) / 直接投影(球、隐藏点)
    P_scan: dict[str, np.ndarray] = {}
    for key, ax in res.axes.items():
        if key.endswith(SIDE_SUFFIXES):
            continue
        try:
            P_scan[key] = ax.intersect_plane(sym)
        except ValueError:
            P_scan[key] = sym.project_point(ax.point)
            res.warnings.append(f"[平行] {key}: 轴线近乎平行于对称面,改用垂直投影")
    for key, p in res.points.items():
        if key.endswith(SIDE_SUFFIXES) or key in P_scan:
            continue
        P_scan[key] = sym.project_point(p)

    P_bike = {k: R @ (v - t) for k, v in P_scan.items()}
    axes_bike = {
        k: Axis(R @ (a.point - t), R @ a.direction, radius=a.radius, label=k)
        for k, a in res.axes.items() if not k.endswith(SIDE_SUFFIXES)
    }

    geo = derive_geometry(P_bike, axes_bike, cfg)
    out = write_outputs(cfg, res, P_scan, P_bike, geo, R, t)

    print("\n".join(res.reports))
    print("\n" + "=" * 60)
    for k, v in geo.items():
        print(f"  {k:<32} {v}")
    print("=" * 60)
    if res.warnings:
        print(f"\n⚠  {len(res.warnings)} 条警告 — 看 {out / 'quality_report.txt'}")
        for w in res.warnings[:6]:
            print("   " + w)
    print(f"\n输出目录: {out.resolve()}")


def main() -> None:
    ap = argparse.ArgumentParser(description="扫描分割件 → 底盘硬点表")
    ap.add_argument("--init", metavar="SEG_DIR", help="从分割目录生成配置模板")
    ap.add_argument("-o", "--out", default="config.json", help="模板输出路径")
    ap.add_argument("--run", metavar="CONFIG", help="按配置跑完整流程")
    a = ap.parse_args()
    if a.init:
        init_config(a.init, a.out)
    elif a.run:
        run(a.run)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
