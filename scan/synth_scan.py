#!/usr/bin/env python3
"""
合成扫描数据生成器 —— 用于端到端验证整条管线。

造一台**几何完全已知**的车,给每个硬点生成一段圆柱面点云,加噪声,再整体
搬到一个随机的"扫描仪坐标系"里。然后跑 batch_fit.py,看它能不能把真值还原
回来。这是唯一能在没有真车、没有扫描仪的情况下证明工具链是通的办法。

⚠️ 这里所有数值都是**合成的**,不是任何一台真车的实测值。几何取自
data/chassis.json 里 Yamaha R6 2017 profile 的量级,只为让结果落在真实范围内
方便肉眼判断,不要把它当成 R6 的车架数据引用。

用法:
    python synth_scan.py --out demo            # 生成 demo/segments/*.xyz + truth.json
    python synth_scan.py --out demo --noise 0.04
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np

# --------------------------------------------------------------------------
# 真值几何(车辆坐标系: 原点 = 后轮触地点, +X 前, +Y 左, +Z 上)
# --------------------------------------------------------------------------

RAKE_DEG = 24.03      # 转向轴相对垂直
WHEELBASE = 1400.3
BETA_DEG = 13.5       # 摇臂相对水平,轴心在枢轴下方
SWINGARM_L = 580.0
YOKE_OFFSET = 30.0    # 前轴到转向轴的垂距
RF = 304.46           # 前轮受载滚动半径
RR = 320.0            # 后轮受载滚动半径(合成值)
HEADSTOCK_HEIGHT = 700.0  # 头管中心离地高度(合成值,只要明显高于前轴即可)

# 连杆坐标,相对摇臂枢轴 (+X 前, +Z 上) —— 取自 linked 模式的占位几何
LINKAGE_REL = {
    "rocker_pivot":  (-60.0, -140.0),   # Frame_Rocker_Pivot
    "rocker_shock":  (-185.0, -100.0),  # Rocker_To_Shock  (= 避震下锁点)
    "rocker_link":   (-170.0, -165.0),  # Rocker_To_Drag
    "link_swingarm": (-200.0, -40.0),   # Drag_To_Swingarm
    "shock_upper":   (-35.0, 175.0),    # Frame_Shock_Top
}
COUNTERSHAFT_REL = (50.0, 10.0)         # Front_Sprocket_X / _Y


def truth_points() -> dict[str, np.ndarray]:
    b = math.radians(BETA_DEG)
    r = math.radians(RAKE_DEG)

    rear_axle = np.array([0.0, 0.0, RR])
    front_axle = np.array([WHEELBASE, 0.0, RF])
    pivot = rear_axle + SWINGARM_L * np.array([math.cos(b), 0.0, math.sin(b)])

    # 转向轴: 过 (前轴 - offset·前向垂距), 方向 (-sin rake, 0, cos rake)
    perp = np.array([math.cos(r), 0.0, math.sin(r)])   # 垂直于转向轴,指向前
    steer_foot = front_axle - YOKE_OFFSET * perp       # 转向轴上离前轴最近的点
    axis_up = np.array([-math.sin(r), 0.0, math.cos(r)])
    # 头管本体要放在**前轴上方**的真实高度上。batch_fit 用 steering_head 相对
    # 前轴的高低来判断 +Z 朝哪边(“转向头一定在轮轴上方”),放在垂足上会让整个
    # 坐标系上下颠倒 —— 真车扫描时也要扫真正的头管,不是别的什么点。
    s_up = (HEADSTOCK_HEIGHT - steer_foot[2]) / axis_up[2]
    steer_pt = steer_foot + s_up * axis_up

    P = {
        "rear_axle": rear_axle,
        "front_axle": front_axle,
        "swingarm_pivot": pivot,
        "steering_head": steer_pt,
        "countershaft": pivot + np.array([COUNTERSHAFT_REL[0], 0.0, COUNTERSHAFT_REL[1]]),
        "footpeg": np.array([700.0, 0.0, 380.0]),
    }
    for k, (dx, dz) in LINKAGE_REL.items():
        P[k] = pivot + np.array([dx, 0.0, dz])
    P["shock_lower"] = P["rocker_shock"].copy()   # 避震下端就接在摇杆上
    return P


def truth_axes() -> dict[str, np.ndarray]:
    """每个特征的轴向(单位向量)。左右成对的轴沿 Y,单侧的按实际方向。"""
    r = math.radians(RAKE_DEG)
    Y = np.array([0.0, 1.0, 0.0])
    return {
        "rear_axle": Y, "front_axle": Y, "swingarm_pivot": Y, "footpeg": Y,
        "countershaft": Y, "shock_upper": Y, "shock_lower": Y,
        "rocker_pivot": Y, "rocker_shock": Y, "rocker_link": Y, "link_swingarm": Y,
        # 转向头的轴线就是转向轴本身
        "steering_head": np.array([-math.sin(r), 0.0, math.cos(r)]),
    }


# 每个特征生成成什么样: (半径, 轴向长度, 覆盖角度)
SHAPE = {
    "steering_head":  (25.0, 120.0, 360.0),
    "swingarm_pivot": (14.0, 40.0, 300.0),
    "front_axle":     (12.5, 60.0, 340.0),
    "rear_axle":      (14.0, 60.0, 340.0),
    "footpeg":        (10.0, 30.0, 260.0),
    "countershaft":   (17.0, 35.0, 260.0),
    "shock_upper":    (8.0, 26.0, 300.0),
    "shock_lower":    (8.0, 26.0, 300.0),
    "rocker_pivot":   (9.0, 28.0, 300.0),
    "rocker_shock":   (8.0, 26.0, 300.0),
    "rocker_link":    (8.0, 26.0, 300.0),
    "link_swingarm":  (8.0, 26.0, 300.0),
}

# 左右成对的特征,以及各自的 Y 偏移
PAIRED = {"swingarm_pivot": 95.0, "front_axle": 80.0, "rear_axle": 90.0, "footpeg": 180.0}
# batch_fit 认的文件名前缀
FILE_BASE = {"front_axle": "axle_front", "rear_axle": "axle_rear"}


def cylinder_points(center, axis, radius, length, arc_deg, n, rng, noise):
    """在一段圆柱面上采样。center 为轴线上的一点,arc 从 0 起算。"""
    axis = axis / np.linalg.norm(axis)
    tmp = np.array([1.0, 0.0, 0.0])
    if abs(np.dot(tmp, axis)) > 0.9:
        tmp = np.array([0.0, 0.0, 1.0])
    u = np.cross(axis, tmp); u /= np.linalg.norm(u)
    v = np.cross(axis, u)

    th = rng.uniform(0.0, math.radians(arc_deg), n)
    ax = rng.uniform(-length / 2, length / 2, n)
    pts = (center
           + np.outer(ax, axis)
           + radius * (np.outer(np.cos(th), u) + np.outer(np.sin(th), v)))
    return pts + rng.normal(0.0, noise, pts.shape)


def random_rigid(rng):
    """随机刚体变换,模拟扫描仪自己的坐标系。"""
    a = rng.uniform(0, 2 * math.pi, 3)
    Rx = np.array([[1, 0, 0], [0, math.cos(a[0]), -math.sin(a[0])], [0, math.sin(a[0]), math.cos(a[0])]])
    Ry = np.array([[math.cos(a[1]), 0, math.sin(a[1])], [0, 1, 0], [-math.sin(a[1]), 0, math.cos(a[1])]])
    Rz = np.array([[math.cos(a[2]), -math.sin(a[2]), 0], [math.sin(a[2]), math.cos(a[2]), 0], [0, 0, 1]])
    R = Rz @ Ry @ Rx
    t = rng.uniform(-500, 500, 3)
    return R, t


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="demo", help="输出目录")
    ap.add_argument("--noise", type=float, default=0.04, help="每点高斯噪声 sigma (mm)")
    ap.add_argument("--points", type=int, default=4000, help="每个特征的点数")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    rng = np.random.default_rng(args.seed)
    P, A = truth_points(), truth_axes()
    R, t = random_rigid(rng)

    out = Path(args.out)
    seg = out / "segments"
    seg.mkdir(parents=True, exist_ok=True)

    written = []
    for feat, (radius, length, arc) in SHAPE.items():
        base = FILE_BASE.get(feat, feat)
        offsets = ([("_L", +PAIRED[feat]), ("_R", -PAIRED[feat])]
                   if feat in PAIRED else [("", 0.0)])
        for suffix, dy in offsets:
            centre = P[feat] + np.array([0.0, dy, 0.0])
            pts = cylinder_points(centre, A[feat], radius, length, arc,
                                  args.points, rng, args.noise)
            pts = pts @ R.T + t                      # 搬进扫描仪坐标系
            name = f"{base}{suffix}.xyz"
            np.savetxt(seg / name, pts, fmt="%.4f")
            written.append(name)

    truth = {
        "_synthetic": "所有数值均为合成,不是任何真车的实测数据。",
        "noise_sigma_mm": args.noise,
        "geometry": {
            "rake_deg": RAKE_DEG, "wheelbase_mm": WHEELBASE,
            "beta_deg": BETA_DEG, "swingarm_length_mm": SWINGARM_L,
            "offset_mm": YOKE_OFFSET, "front_tyre_radius_mm": RF,
            "rear_tyre_radius_mm": RR,
            "trail_mm": (RF * math.sin(math.radians(RAKE_DEG)) - YOKE_OFFSET)
                        / math.cos(math.radians(RAKE_DEG)),
        },
        "hardpoints_bike_mm": {k: [round(float(x), 4) for x in v] for k, v in P.items()},
        "linkage_rel_to_pivot_mm": {k: list(v) for k, v in LINKAGE_REL.items()},
        "countershaft_rel_to_pivot_mm": list(COUNTERSHAFT_REL),
    }
    (out / "truth.json").write_text(json.dumps(truth, indent=2, ensure_ascii=False),
                                    encoding="utf-8")

    print(f"写出 {len(written)} 个点云 -> {seg}")
    print(f"真值 -> {out/'truth.json'}")
    print(f"\n下一步:\n  python batch_fit.py --init {seg} -o {out}/config.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
