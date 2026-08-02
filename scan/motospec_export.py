#!/usr/bin/env python3
"""
扫描结果 → MotoSPEC catalog 条目

batch_fit.py 输出的是通用叫法的几何量(Wheelbase / Rake / Trail ...)。这个脚本
把它翻成本项目真正用的字段名,直接产出可以贴进 data/chassis.json 和
data/linkages.json 的条目。

    python motospec_export.py out/geometry.json --name "Triumph 765 (scanned)" \
        --mode linked -o out/motospec_catalog.json

零假数据规矩和 app 里一样:扫描给不出的字段(Fork_Position、质量重心、避震行程
……)**不写进去**,而不是填个默认值。它们会在 app 里以 "Need: …" 出现,那是对的。

自检项(都会打印,不达标会在报告里点名):
  * trail —— 用本项目自己的公式从 rake/Rf/offset 重算,和扫描给的比
  * 避震眼距 —— 和 |shock_upper − shock_lower| 比
  * rocker_shock 与 shock_lower 应该是同一个孔
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

# --------------------------------------------------------------------------
# 硬点 → 连杆坐标(全部相对摇臂枢轴, +X 前, +Y 上)
# --------------------------------------------------------------------------
#
# 注意 Drag_To_Swingarm 在两种模式下是**不同的零件**:
#   linked   —— 拉杆连在摇臂上   → 扫 link_swingarm
#   pro-link —— 拉杆固定在车架上 → 扫 link_frame
# 扫错件会得到一个能收敛但完全错误的连杆。
LINKAGE_MAP = {
    "Frame_Rocker_Pivot": "rocker_pivot",
    "Rocker_To_Shock":    "rocker_shock",
    "Rocker_To_Drag":     "rocker_link",
    "Frame_Shock_Top":    "shock_upper",
}
DRAG_FEATURE = {"linked": "link_swingarm", "pro-link": "link_frame"}

# 扫描能给的 chassis 字段。其余的必须另外量/称,不在这里编。
NOT_FROM_SCAN = [
    ("Fork_Position / Fork_Position_ref", "叉管伸出量,卡尺量(还要在 app 里选口径)"),
    ("Mass / H_CG / L_CG / front_weight_dist", "称重 + 抬轴法,用 app 的重心计算器"),
    ("Shock_Stroke / Fork_Stroke", "行程,查规格表或压到底量"),
    ("C_f_aero / C_r_aero", "气动分配,风洞或经验值"),
]


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def rel_to_pivot(P: dict, key: str, pivot: list[float]) -> tuple[float, float] | None:
    """硬点相对摇臂枢轴的 (前向, 上向) 分量。车辆坐标系是 +X 前 / +Z 上。"""
    p = P.get(key)
    if p is None:
        return None
    return (round(p[0] - pivot[0], 2), round(p[2] - pivot[2], 2))


def our_trail(rake_deg: float, rf: float, offset: float) -> float:
    """本项目 MotoSPEC_Trail 的公式,用来交叉验证扫描结果。"""
    r = math.radians(rake_deg)
    return (rf * math.sin(r) - offset) / math.cos(r)


def build(geo_path: Path, name: str, mode: str, note_extra: str = "",
          fork_position: float = 0.0, chain_pitch: float = 15.875) -> dict:
    doc = load(geo_path)
    g = doc.get("geometry", {})
    P = doc.get("hardpoints_bike_mm", {})
    checks, missing = [], []

    pivot = P.get("swingarm_pivot")
    if pivot is None:
        raise SystemExit("geometry.json 里没有 swingarm_pivot —— 连杆坐标全部以它为原点,必须有")

    # ---------------- chassis ----------------
    rake = g.get("rake_deg")
    rf = g.get("front_tyre_radius_mm")
    offset = g.get("offset_mm")
    wb = g.get("wheelbase_mm")
    beta = g.get("swingarm_angle_deg")
    swl = g.get("swingarm_length_mm")

    specs: dict[str, float] = {}
    def put(k, v, nd=2):
        if v is not None:
            specs[k] = round(float(v), nd)

    put("Rake_Static", rake)
    put("WB", wb, 1)
    # 我们的 beta_static 是“轴心在枢轴下方”的正角度。
    if beta is not None:
        specs["beta_static"] = round(abs(float(beta)), 2)
    put("Swingarm_Length", swl, 1)
    put("Swingarm_Length_ref", swl, 1)
    put("Yoke_Offset", offset, 2)
    put("Yoke_Offset_ref", offset, 2)
    put("Rf", rf, 2)
    put("Shock_Length_ref", g.get("shock_eye_to_eye_mm"), 1)
    # 叉管伸出量只通过 (Fork_Position − Fork_Position_ref) 起作用,而**扫描时车
    # 的状态就是基线**,所以两者相等、差为零。写 0/0 是在陈述这个事实,不是编
    # 造一个测量值(app 里保存 profile 时同样让 live 镜像 ref)。量过的话用
    # --fork-position 传进来,以后调叉就有真实起点。
    specs["Fork_Position"] = specs["Fork_Position_ref"] = float(fork_position)
    # 520/525/530 链条节距都是 15.875 mm —— 是规格常数,不是估值。
    specs["Chain_Pitch"] = chain_pitch

    cs = rel_to_pivot(P, "countershaft", pivot)
    if cs:
        specs["Front_Sprocket_X"], specs["Front_Sprocket_Y"] = cs
    else:
        missing.append("Front_Sprocket_X/Y —— 没扫 countershaft,anti-squat 算不了")

    # ---------------- 自检 ----------------
    if None not in (rake, rf, offset):
        t_ours = our_trail(rake, rf, offset)
        t_scan = g.get("trail_mm")
        if t_scan is not None:
            # batch_fit 的 trail 符号与常规相反,比大小即可。
            d = abs(abs(t_scan) - t_ours)
            checks.append(
                f"trail: 本项目公式 {t_ours:.2f} mm vs 扫描 {abs(t_scan):.2f} mm  差 {d:.2f} mm"
                + ("  ✅" if d < 0.5 else "  ⚠️ 超过 0.5mm,回头查 rake/offset/轮胎半径"))

    su, sl = P.get("shock_upper"), P.get("shock_lower")
    if su and sl:
        eye = math.dist(su, sl)
        ref = g.get("shock_eye_to_eye_mm")
        if ref:
            d = abs(eye - ref)
            checks.append(f"避震眼距: 硬点距离 {eye:.2f} mm vs 报告 {ref:.2f} mm  差 {d:.2f} mm"
                          + ("  ✅" if d < 0.3 else "  ⚠️"))
    rs = P.get("rocker_shock")
    if rs and sl:
        d = math.dist(rs, sl)
        checks.append(f"rocker_shock 与 shock_lower 应是同一孔: 相距 {d:.2f} mm"
                      + ("  ✅" if d < 1.0 else "  ⚠️ 分割时可能框错了"))

    # ---------------- linkage ----------------
    link_specs: dict[str, float] = {"Linkage_Mode": mode}
    if mode == "linkless":
        # 直连:只有避震下端(在摇臂上)和上端(在车架上)两个点。
        pairs = {"Drag_To_Swingarm": "shock_lower", "Frame_Shock_Top": "shock_upper"}
    else:
        pairs = dict(LINKAGE_MAP)
        pairs["Drag_To_Swingarm"] = DRAG_FEATURE[mode]

    for field, feat in pairs.items():
        xy = rel_to_pivot(P, feat, pivot)
        if xy is None:
            missing.append(f"{field}_X/Y —— 没扫到 {feat}")
            continue
        link_specs[f"{field}_X"], link_specs[f"{field}_Y"] = xy

    need = 10 if mode != "linkless" else 4
    link_ok = len([k for k in link_specs if k.endswith(("_X", "_Y"))]) == need

    # linkless 计算**从不读取** rocker 坐标,但 app 的依赖图无条件列全 10 个键,
    # readiness 门禁要求它们被绑定 —— 缺了的话 Motion Ratio / Progression 会
    # 空白(实测踩过)。app 自己保存 linkless profile 时也会把占位 rocker 坐标
    # 一并存上("carried but never read",模式切换无损)。照抄 app 的
    # LINKAGE_PLACEHOLDER_LINKLESS 值;只在真实两点齐全时才补,缺点照常报 missing。
    if mode == "linkless" and link_ok:
        link_specs.update({
            "Frame_Rocker_Pivot_X": -60.0, "Frame_Rocker_Pivot_Y": -140.0,
            "Rocker_To_Shock_X": -185.0,   "Rocker_To_Shock_Y": -100.0,
            "Rocker_To_Drag_X": -170.0,    "Rocker_To_Drag_Y": -165.0,
        })

    return {
        "checks": checks,
        "missing": missing,
        "linkage_complete": link_ok,
        "chassis_entry": {
            "id": name.lower().replace(" ", "-").replace("(", "").replace(")", ""),
            "entry": {
                "name": name,
                "source": f"3D scan → batch_fit.py → motospec_export.py ({geo_path.name})",
                "note": (f"由扫描点云拟合得到。Fork_Position={fork_position} 表示"
                         "**扫描时的叉管位置即基线**(差为零),不是说叉管没伸出。"
                         "质量/重心、行程、气动分配等扫描给不出的量刻意留空,会在数据表里"
                         "显示 Need: —— 那是对的,不要填默认值。"
                         + (" " + note_extra if note_extra else "")),
                "specs": specs,
            },
        },
        "linkage_entry": {
            "id": name.lower().replace(" ", "-").replace("(", "").replace(")", "") + "-linkage",
            "entry": {
                "name": f"{name} — linkage",
                "source": f"3D scan → batch_fit.py → motospec_export.py ({geo_path.name})",
                "note": f"模式 {mode}。坐标相对摇臂枢轴,+X 前 +Y 上,单位 mm。",
                "specs": link_specs,
            },
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("geometry", help="batch_fit 输出的 out/geometry.json")
    ap.add_argument("--name", required=True, help='车型名,例如 "Triumph 765 (scanned)"')
    ap.add_argument("--mode", default="linked", choices=["linked", "pro-link", "linkless"],
                    help="连杆模式,决定 Drag_To_Swingarm 该取哪个扫描件")
    ap.add_argument("--note", default="", help="附加说明,写进条目 note")
    ap.add_argument("--fork-position", type=float, default=0.0,
                    help="扫描时的叉管伸出量实测值(mm)。不传则记 0,表示"
                         "“扫描状态即基线”;差值语义不受影响")
    ap.add_argument("--chain-pitch", type=float, default=15.875,
                    help="链条节距,520/525/530 都是 15.875")
    ap.add_argument("-o", "--out", default="out/motospec_catalog.json")
    args = ap.parse_args()

    res = build(Path(args.geometry), args.name, args.mode, args.note,
                args.fork_position, args.chain_pitch)

    print("=" * 66)
    print("自检")
    print("=" * 66)
    for c in res["checks"]:
        print("  " + c)
    if not res["checks"]:
        print("  (没有可做的自检 —— 几何量不全)")

    print()
    print("=" * 66)
    print("扫描给不出、必须另外获取的量")
    print("=" * 66)
    for f, how in NOT_FROM_SCAN:
        print(f"  {f:42s} {how}")
    for m in res["missing"]:
        print(f"  ⚠️ {m}")

    print()
    print(f"连杆坐标: {'完整 ✅' if res['linkage_complete'] else '不完整 ⚠️ —— 缺的点见上'}")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(
        {"chassis": {res["chassis_entry"]["id"]: res["chassis_entry"]["entry"]},
         "linkages": {res["linkage_entry"]["id"]: res["linkage_entry"]["entry"]}},
        indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n写出 -> {out}")
    print("下一步: 把里面的两段分别并进 data/chassis.json / data/linkages.json,"
          "\n        或在 app 的部件库页面手工新建条目后粘进去。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
