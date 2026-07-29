#!/usr/bin/env python3
"""
复现 README 里的每一个数字。

README 给了一堆具体数值（"混入旁边零件 15% → 轴向错 6.57°"、"整体摆正后差
0.0000"、"三点定圆" ...）。数字写在文档里而没有能跑的东西支撑，过一阵就没人知道
还准不准了。这个脚本把它们全部重跑一遍。

    .venv/bin/python verify_claims.py            # 全部
    .venv/bin/python verify_claims.py --only 3   # 只跑第 3 组

全部用合成数据，不需要扫描仪、不需要 demo/ 目录。
"""

from __future__ import annotations

import argparse
import math
import sys

import numpy as np

sys.path.insert(0, ".")
from chassis_geom import fit_cylinder, largest_cluster, estimate_normals  # noqa: E402

R_TRUE = 14.0
AXIS = np.array([0.0, 1.0, 0.0])


def cyl(rng, n=4000, arc=300.0, half=20.0, noise=0.04):
    th = rng.uniform(0.0, math.radians(arc), n)
    ax = rng.uniform(-half, half, n)
    p = np.c_[R_TRUE * np.cos(th), ax, R_TRUE * np.sin(th)]
    return p + rng.normal(0.0, noise, p.shape)


def axis_err(fit) -> float:
    return math.degrees(math.acos(min(1.0, abs(float(np.dot(fit.axis.direction, AXIS))))))


def hdr(n, title):
    print(f"\n{'=' * 72}\n【{n}】{title}\n{'=' * 72}")


# --------------------------------------------------------------------------
def exp1_whole_cloud_transform():
    hdr(1, "切之前整体变换点云 —— 应当完全无害（README §4)")
    rng = np.random.default_rng(11)
    pts = cyl(rng)
    a = np.radians([31.0, -17.0, 48.0])
    Rx = np.array([[1, 0, 0], [0, math.cos(a[0]), -math.sin(a[0])], [0, math.sin(a[0]), math.cos(a[0])]])
    Ry = np.array([[math.cos(a[1]), 0, math.sin(a[1])], [0, 1, 0], [-math.sin(a[1]), 0, math.cos(a[1])]])
    Rz = np.array([[math.cos(a[2]), -math.sin(a[2]), 0], [math.sin(a[2]), math.cos(a[2]), 0], [0, 0, 1]])
    Rm = Rz @ Ry @ Rx
    moved = pts @ Rm.T + np.array([1234.5, -678.9, 2500.0])

    f0, f1 = fit_cylinder(pts), fit_cylinder(moved)
    # 变换后的轴向要转回原坐标系再比
    back = Rm.T @ f1.axis.direction
    ang = math.degrees(math.acos(min(1.0, abs(float(np.dot(back, f0.axis.direction))))))
    print(f"  半径      {f0.radius:.6f}  →  {f1.radius:.6f}   差 {abs(f0.radius-f1.radius):.6f} mm")
    print(f"  轴向夹角（旋回原系后）                        {ang:.6f}°")
    print("  → 整个点云一起转,拟合出的几何完全不变。危险的是切完再单独动某一个。")


def exp2_purity():
    hdr(2, "杂点的两种类型 —— 分离的能自动甩掉,连续的不行（README §4)")
    rng = np.random.default_rng(3)
    base = cyl(rng)

    def neighbour(n, dist):
        return rng.normal(0, 6, (n, 3)) + np.array([dist, 0.0, 25.0])

    def chamfer_face(n, half=20.0):
        m = n // 2
        t = rng.uniform(0, 1, m); th = rng.uniform(0, math.radians(300), m)
        cham = np.c_[(R_TRUE + 2 * t) * np.cos(th), half + 2 * t, (R_TRUE + 2 * t) * np.sin(th)]
        t2 = rng.uniform(0, 1, n - m); th2 = rng.uniform(0, math.radians(300), n - m)
        rr = (R_TRUE + 2) + 28 * t2
        face = np.c_[rr * np.cos(th2), np.full(n - m, half + 2.0), rr * np.sin(th2)]
        return np.vstack([cham, face]) + rng.normal(0, 0.04, (n, 3))

    print("  A. 分离的杂物（旁边的支架/别的零件）")
    print(f"     {'情况':<34}{'轴向误差°':>11}{'半径误差mm':>12}")
    n = int(len(base) * 0.15)
    for dist in (70, 40):
        pts = np.vstack([base, neighbour(n, dist)])
        for declut, tag in ((False, "不去杂"), (True, "declustter(默认开)")):
            p = largest_cluster(pts) if declut else pts
            f = fit_cylinder(p)
            print(f"     混入15% 距{dist}mm {tag:<18}{axis_err(f):>11.3f}{abs(f.radius-R_TRUE):>12.3f}")

    print("\n  B. 与孔连成一片的表面（孔口倒角 + 端面）—— 聚类分不开")
    print(f"     {'杂点占比':<34}{'轴向误差°':>11}{'半径误差mm':>12}{'rms':>8}")
    for pct in (10, 20, 35, 50):
        pts = np.vstack([base, chamfer_face(int(len(base) * pct / 100))])
        f = fit_cylinder(largest_cluster(pts))
        flag = "  ← 超 0.1° 红线" if axis_err(f) > 0.1 else ""
        print(f"     {str(pct)+'%':<34}{axis_err(f):>11.3f}{abs(f.radius-R_TRUE):>12.3f}{f.rms:>8.3f}{flag}")
    print("  → 框大了带进旁边分离的东西不用怕;带进孔口倒角/端面才是真问题。")


def exp3_asymmetry():
    hdr(3, "框歪了 / 左右不对称 —— 质心会跑,圆心不会（README §4)")
    rng = np.random.default_rng(9)
    print(f"  {'切到的圆弧':<30}{'点云质心XZ':>22}{'拟合圆心误差mm':>16}")
    cases = [("整圈 360°", 0, 360), ("0°–240°", 0, 240),
             ("120°–360° (同长度,位置不同)", 120, 360),
             ("左边少切20° (0°–220°)", 0, 220), ("右边少切20° (20°–240°)", 20, 240),
             ("只切 90°", 0, 90)]
    for label, a0, a1 in cases:
        th = rng.uniform(math.radians(a0), math.radians(a1), 3000)
        ax = rng.uniform(-20, 20, 3000)
        p = np.c_[R_TRUE*np.cos(th), ax, R_TRUE*np.sin(th)] + rng.normal(0, 0.04, (3000, 3))
        centroid = p[:, [0, 2]].mean(axis=0)
        f = fit_cylinder(p)
        err = math.hypot(f.axis.point[0], f.axis.point[2])
        print(f"  {label:<30}{str(np.round(centroid,2)):>22}{err:>16.3f}")
    print("  → 质心到处跑,圆心纹丝不动。拟合求的是曲率中心,不是点的平均位置。")


def exp4_how_it_works():
    hdr(4, "拟合凭什么能定位 —— 三点定圆 + 法向量定轴（README 附录)")
    print("  A. 三点定圆:圆方程展开后对 (cu,cv,c) 是线性的,三个点就唯一确定一个圆")
    for label, degs in [("均匀 0/120/240", [0, 120, 240]),
                        ("挤在一侧 0/20/40", [0, 20, 40]),
                        ("极端偏心 200/205/210", [200, 205, 210])]:
        P = np.array([[R_TRUE*math.cos(math.radians(d)), R_TRUE*math.sin(math.radians(d))] for d in degs])
        A = np.c_[2*P, np.ones(3)]
        cu, cv, c = np.linalg.solve(A, (P**2).sum(1))
        print(f"     {label:<24} 圆心=({cu:+.6f},{cv:+.6f})  半径={math.sqrt(c+cu**2+cv**2):.6f}")

    print("\n  B. 轴向:圆柱面每点的法向量都垂直于轴,SVD 的最小奇异方向就是轴向")
    rng = np.random.default_rng(2)
    for label, arc in [("0°–300°", 300), ("0°–150°（只有一半）", 150)]:
        N = estimate_normals(cyl(rng, 3000, arc=arc))
        _, _, Vt = np.linalg.svd(N - N.mean(0), full_matrices=False)
        ax = Vt[-1] / np.linalg.norm(Vt[-1])
        print(f"     {label:<24} 轴向误差 {math.degrees(math.acos(min(1,abs(float(np.dot(ax,AXIS)))))):.4f}°")

    print("\n  C. 切割边缘的点法向量会偏（kNN 邻域被截断）—— 但占比小")
    pts = cyl(np.random.default_rng(2), 3000, arc=300)
    N = estimate_normals(pts)
    th = np.degrees(np.arctan2(pts[:, 2], pts[:, 0])) % 360
    truth = np.c_[np.cos(np.radians(th)), np.zeros(len(th)), np.sin(np.radians(th))]
    ang = np.degrees(np.arccos(np.clip(np.abs((N*truth).sum(1)), 0, 1)))
    edge = (th < 5) | (th > 295)
    print(f"     边缘5°内  平均误差 {ang[edge].mean():.3f}°   占比 {edge.mean()*100:.1f}%")
    print(f"     内部      平均误差 {ang[~edge].mean():.3f}°")
    print("  → 弧越长,边缘点占比被稀释得越厉害,这是 arc>=120° 的另一个理由。")


EXPERIMENTS = [exp1_whole_cloud_transform, exp2_purity, exp3_asymmetry, exp4_how_it_works]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", type=int, choices=range(1, len(EXPERIMENTS) + 1),
                    help="只跑其中一组")
    args = ap.parse_args()
    for i, fn in enumerate(EXPERIMENTS, 1):
        if args.only and args.only != i:
            continue
        fn()
    print("\n（全部为合成数据。真实点云有配准漂移和表面缺陷，"
          "所以 README 的质量红线仍按保守值执行。）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
