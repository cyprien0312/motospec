#!/usr/bin/env python3
"""
切完 segment,跑 batch_fit **之前**,先跑这个。

验证每个 segment 的点真的存在于母云里(同一坐标系)。README §4 的硬性要求
"所有 segment 必须共享同一个坐标系"就是查这个 —— 切完之后单独动过任何一个件
(平移/旋转/对齐),这里立刻现形;不查的话 batch_fit 会给出一堆能算但全错的数。

    python check_segments.py model.ply segments/

判据:从 model.ply 里切出来的点,到 model.ply 最近点的距离应当是 0(浮点存储
误差以内)。p95 > 1mm 就说明这个件不是从这份母云的当前状态切出来的。

真实案例(2026-08,R3):10 个 segment 每个都被分别动过(旋转 9°~93°、平移
97~997mm 不等),batch_fit 的左右轴合并自检报出 39°~64° 夹角。这种数据没有
任何抢救价值 —— 小面片 ICP 吸附回去只会滑到附近像的表面上,位置不可信。
唯一的办法是回 CloudCompare 一个会话里重切。
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
from chassis_geom import load_cloud  # noqa: E402


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 1
    parent_path, seg_dir = Path(sys.argv[1]), Path(sys.argv[2])
    parent = load_cloud(str(parent_path))
    tree = cKDTree(parent)
    print(f"母云 {parent_path.name}: {len(parent):,} 点\n")
    print(f"{'segment':24s} {'点数':>7} {'p50 mm':>9} {'p95 mm':>9}   判定")
    bad = []
    files = sorted(seg_dir.glob("*.ply"))
    if not files:
        print(f"!! {seg_dir} 里没有 .ply")
        return 1
    for f in files:
        p = load_cloud(str(f))
        dist, _ = tree.query(p, k=1)
        p50, p95 = float(np.percentile(dist, 50)), float(np.percentile(dist, 95))
        ok = p95 < 1.0
        if not ok:
            bad.append(f.name)
        print(f"{f.name:24s} {len(p):>7,} {p50:>9.3f} {p95:>9.3f}   "
              f"{'OK' if ok else '!! 不在母云坐标系里'}")
    print()
    if bad:
        print(f">>> {len(bad)}/{len(files)} 个 segment 坐标系不对: {', '.join(bad)}")
        print(">>> 不要跑 batch_fit。回 CloudCompare 重切:一个会话、切完立存、"
              "任何东西都不要移动/旋转/对齐。")
        return 2
    print(f">>> 全部 {len(files)} 个 segment 与母云同坐标系 —— 可以跑 batch_fit。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
