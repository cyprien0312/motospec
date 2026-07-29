#!/usr/bin/env python3
"""
看看这个文件到底是什么 —— 能不能直接喂给 batch_fit。

扫描软件里"保存"和"导出"是两回事:
  * 保存 → 软件自己的**工程文件**(专有格式,只有它自己能开)
  * 导出 → 通用格式(.ply / .asc / .xyz / .obj / .stl)

另外标准 .ply 也可以是 binary 编码,用文本编辑器打开一样是乱码 —— 但它完全能用。
这个脚本分得清这两种情况,并告诉你是点云还是网格。

    python inspect_scan_file.py 某个文件.ply
    python inspect_scan_file.py segments/*.ply
"""

from __future__ import annotations

import sys
from pathlib import Path

TEXT_EXT = {".xyz", ".asc", ".txt", ".csv", ".pts"}
MESH_EXT = {".obj", ".stl", ".off"}


def sniff(path: Path) -> tuple[str, str]:
    """返回 (结论, 建议)。"""
    if not path.exists():
        return "❌ 文件不存在", ""

    ext = path.suffix.lower()
    head = path.open("rb").read(4096)

    # --- PLY: 头部永远是 ASCII,即使数据段是 binary ---
    if head[:3].lower() == b"ply":
        txt = head.decode("ascii", errors="replace")
        fmt, n_vert, n_face = "未知", 0, 0
        for line in txt.splitlines():
            low = line.lower().strip()
            if low.startswith("format"):
                parts = low.split()
                fmt = parts[1] if len(parts) > 1 else "?"
            elif low.startswith("element vertex"):
                n_vert = int(low.split()[-1])
            elif low.startswith("element face"):
                n_face = int(low.split()[-1])
            elif low == "end_header":
                break
        enc = "ASCII 文本" if "ascii" in fmt else "binary(二进制,打开是乱码属正常)"
        if n_face > 0:
            return (f"⚠️ PLY **网格** — {n_vert} 顶点 / {n_face} 面片,{enc}",
                    "网格是重建出来的,顶点不是原始测量点,而且 rms 会虚低、\n"
                    "质量红线因此失效。回扫描软件重新导出**点云**。")
        return (f"✅ PLY **点云** — {n_vert} 个点,{enc}", "可以直接用。")

    # --- 纯文本点云 ---
    if ext in TEXT_EXT:
        try:
            raw = path.open("r", errors="replace").read(8192)
            lines = [l for l in raw.splitlines()
                     if l.strip() and not l.lstrip().startswith(("#", "//"))]
            cols = len(lines[0].replace(",", " ").split()) if lines else 0
            total = sum(1 for _ in path.open("r", errors="replace"))
            if cols >= 3:
                return (f"✅ 文本点云 — 约 {total} 行 / 每行 {cols} 列(取前 3 列作 XYZ)",
                        "可以直接用,而且这种格式**存不了面片**,最保险。")
            return (f"⚠️ 文本文件但只有 {cols} 列", "不像点云,检查导出设置。")
        except Exception as e:  # noqa: BLE001
            return f"⚠️ 文本文件读不动: {e}", ""

    if ext in MESH_EXT:
        return (f"⚠️ {ext} 是**网格**格式",
                "同上: 回去导出点云(.ply 点云 或 .asc/.xyz)。")

    # --- 认不出来 = 多半是工程文件 ---
    printable = sum(1 for b in head[:512] if 32 <= b < 127 or b in (9, 10, 13))
    ratio = printable / min(512, len(head)) if head else 0
    return (f"❌ 认不出来（{ext or '无扩展名'}，前 512 字节可读字符占 {ratio:.0%}）",
            "这多半是扫描软件的**工程文件**,不是导出文件。\n"
            "回软件里找 Export / 导出（不是 Save / 保存），格式选:\n"
            "  1. 点云 .ply          ← 首选\n"
            "  2. .asc / .xyz / .txt ← 更保险,这格式存不了面片\n"
            "导出对话框里若有 点云(Point Cloud) / 网格(Mesh) 选项,选**点云**。")


def main() -> int:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 1
    for a in args:
        p = Path(a)
        verdict, advice = sniff(p)
        print(f"\n{p}")
        print(f"  {verdict}")
        for line in advice.splitlines():
            if line.strip():
                print(f"  {line}")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
