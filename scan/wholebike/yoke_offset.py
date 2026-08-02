#!/usr/bin/env python3
"""
从扫描直接量三角台 offset —— 不经过前轴。

    python yoke_offset.py <big_cloud.ply> <steering_head_segment.ply> [--tube-r 21.2]

原理:三角台 offset = 转向管轴线 → 左右叉管连线中轴 的垂距。
  * 叉管是扫描里最长的圆柱(轴向跨度可达 800mm),圆心定得极稳
  * 对转向角**免疫**:叉管绕转向轴转动不改变这个垂距
  * 完全绕开前轴位置(±5mm 那个弱点)

对比"转向轴→前轴垂距"的旧法:旧法量的是**总 offset**(含轴对叉管中线的偏置,
且背着前轴位置误差 ±5 和方向误差×力臂 ±5);本法量的是**三角台 offset**,
±1.5mm。轴心在叉管轴线上时两者相等(R3 实测轴偏 4.4mm≈0)。

R3 实测:两管到转向轴 108.4 / 108.1(对称 0.3mm),offset = 37.4。
车主手量 ≈35 一致;经前轴的旧法 31.7 作废;由官方 spec 闭环反推的 40 只是名义值。

trail 恒等式用的是**总 offset** —— 轴不在叉管中线上的车型(少数)要另加轴偏置。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from chassis_geom import fit_cylinder, load_cloud  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("big_cloud")
    ap.add_argument("steering_head")
    ap.add_argument("--tube-r", type=float, default=21.2, help="叉管半径 mm")
    args = ap.parse_args()

    big = load_cloud(args.big_cloud)
    head = load_cloud(args.steering_head)
    f = fit_cylinder(head, label="steering_head")
    d = f.axis.direction / np.linalg.norm(f.axis.direction)
    p0 = f.axis.point
    print(f"steering axis: {f.report()}")

    e1 = np.cross(d, [0, 0, 1.0])
    if np.linalg.norm(e1) < 0.3:
        e1 = np.cross(d, [0, 1.0, 0])
    e1 /= np.linalg.norm(e1)
    B = np.c_[e1, np.cross(d, e1)]

    rel = big - p0
    t = rel @ d
    P2 = rel @ B
    r2 = np.hypot(*P2.T)
    sel = (r2 > 35) & (r2 < 250) & (np.abs(t) < 800)
    reg3, reg2 = big[sel], P2[sel]
    print(f"candidate region: {len(reg2):,} pts")

    _, idx = cKDTree(reg3).query(reg3, k=16)
    nb = reg3[idx] - reg3[idx].mean(1)[:, None]
    N = np.linalg.eigh(np.einsum("nki,nkj->nij", nb, nb) / 16)[1][:, :, 0]
    n2 = N @ B
    nn = np.linalg.norm(n2, axis=1)
    ok = nn > 0.6
    u2 = n2[ok] / nn[ok][:, None]
    R = args.tube_r
    votes = np.r_[reg2[ok] - R * u2, reg2[ok] + R * u2]
    lo = votes.min(0)
    g = np.floor((votes - lo) / 1.2).astype(np.int64)
    uq, ct = np.unique(g, axis=0, return_counts=True)

    picked = []
    for i in np.argsort(-ct)[:80]:
        c = lo + (uq[i] + 0.5) * 1.2
        if any(np.hypot(*(c - q)) < 45 for q in picked):
            continue
        m = np.abs(np.hypot(*(reg2 - c).T) - R) < 2.5
        if m.sum() < 250:
            continue
        span = reg3[m] @ d
        picked.append(c)
        print(f"  tube: centre ({c[0]:7.1f},{c[1]:7.1f})  dist to axis {np.hypot(*c):6.1f}"
              f"  inliers {int(m.sum()):5d}  axial span {span.max()-span.min():5.0f} mm")
        if len(picked) >= 4:
            break

    best = None
    for i in range(len(picked)):
        for j in range(i + 1, len(picked)):
            sep = np.hypot(*(picked[i] - picked[j]))
            if 150 < sep < 280:
                mid = 0.5 * (picked[i] + picked[j])
                if best is None or np.hypot(*mid) < np.hypot(*best[0]):
                    best = (mid, sep, picked[i], picked[j])
    if best is None:
        print("!! 没找到成对叉管 —— 检查 --tube-r 或前叉区域遮挡")
        return 2
    mid, sep, c1, c2 = best
    asym = abs(np.hypot(*c1) - np.hypot(*c2))
    print(f"\nfork pair: separation {sep:.1f} mm   "
          f"per-tube dist to axis {np.hypot(*c1):.1f}/{np.hypot(*c2):.1f} (asym {asym:.1f})")
    print(f"YOKE OFFSET = {np.hypot(*mid):.2f} mm"
          + ("" if asym < 2 else "   !! 左右不对称 >2mm,谨慎"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
