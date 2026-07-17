# docs/ 索引 / Documentation Index

仓库全部文档的编目。按用途分四组：**测量**（拿着去车库的）、**研究**
（逆向与数据来源记录）、**架构**（参数图谱）、**过程档案**（历史计划）。

## 测量 / Measurement（实操文档）

| 文件 | 内容 |
|---|---|
| [`measurement-guide-765-zh.md`](measurement-guide-765-zh.md) | **主入口**：改装 765 的完整中文测量指南——五张截图遗产盘点、参考状态要求、Session A–D 步骤与空白记录表、数据→app 字段映射、常见错误 |
| [`measurement-points.md`](measurement-points.md) | 测量点定义表：车架级坐标点（RA/FA/SP/CS/SA-U/SA-L/GND，原点=后轴）、称重项与 CG 公式、连杆布置点 ③⑥⑦ 七段距离三角定位协议（含 A↔B 耦合条款） |
| [`measurement-points.svg`](measurement-points.svg) | 车架级测量点标注侧视图 |
| [`scan-points-zh.svg`](scan-points-zh.svg) | **3D 扫描替代路线**取点图（车头朝左侧视投影，连杆放大图）——一次扫描替代 Session A+B+C 全部几何测量，称重除外 |

## 研究 / Research（`research/`）

| 文件 | 内容 |
|---|---|
| [`research/triumph-765-motospec.md`](research/triumph-765-motospec.md) | **核心 oracle**：真实 MotoSPEC PRO 截图数据（Street Triple RS 765）——LINK DIMENSIONS、三列 offset 对照、公式验证、坐标拟合（等价类）、**等价类极限结论**（摇臂/狗骨更换不可算，直到测得 ③⑥⑦）、赛事支援规格表 |
| [`research/r7-gsx8r-rs660-motospec.md`](research/r7-gsx8r-rs660-motospec.md) | 第二批 MotoSPEC 截图提取（R7 / GSX-8R / RS 660） |
| [`research/linkage-coords.md`](research/linkage-coords.md) | 连杆坐标溯源记录：公开渠道找不到任何车型的真实连杆坐标（结论：必须实测）；默认占位坐标的校准推导 |
| [`research/chassis-coords.md`](research/chassis-coords.md) | 参考车车架规格的来源追踪 |

## 架构 / Architecture

| 文件 | 内容 |
|---|---|
| [`static-channel-mindmap.md`](static-channel-mindmap.md) | 静态参数金字塔：全部输入→中间量→RESULTS 通道的依赖图谱 |
| [`img/`](img/) | 六个页面的界面截图（dashboard / chassis / linkage / data table / catalog / guide） |

## 过程档案 / Process Archive（`superpowers/`）

历史实现计划与设计规格，按日期命名（`plans/` 5 份、`specs/` 1 份）。
只读参考，不再更新——当前行为以代码与测试为准。

---

**阅读顺序建议**（新读者）：`measurement-guide-765-zh.md` →
`research/triumph-765-motospec.md`（理解等价类为什么要测 ③⑥⑦）→
`measurement-points.md`（动手前的点位细节）。
