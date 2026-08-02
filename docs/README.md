# docs/ 索引 / Documentation Index

仓库全部文档的编目。按用途分五组：**边界**（这工具不算什么）、**测量**（拿着去车库的）、
**研究**（逆向与数据来源记录）、**架构**（参数图谱）、**过程档案**（历史计划）。

## 边界 / Limitations（先读这个）

| 文件 | 内容 |
|---|---|
| [`LIMITATIONS.md`](LIMITATIONS.md) | **局限性审计**：物理模型不建模什么（气簧/摩擦/bump rubber/倾角/轮胎断面/CG 不随压缩移动/13 种连杆只覆盖 5 种…）、数据来源的不确定度（R3 扫描各量的 ±、yoke offset 为什么弱、没称重导致哪些 RESULTS 是 Need）、数采导出/灵敏度地图/扫描管线三个子系统各自的边界、单位与「实测/拟合/标称/占位」精度约定。每条指向具体文件与代码位置，分类标注**刻意 / 待做 / 无法** |

> 面向用户的同类内容在 app 内 user-guide 的「本工具不计算什么」一节
> （`src/user-guide.js` 的 `limits` 区块，双语）。`LIMITATIONS.md` 是面向工程的版本。

## 测量 / Measurement（实操文档）

| 文件 | 内容 |
|---|---|
| [`measurement-guide-765-zh.md`](measurement-guide-765-zh.md) | **主入口**：改装 765 的完整中文测量指南——五张截图遗产盘点、参考状态要求、Session A–D 步骤与空白记录表、数据→app 字段映射、常见错误 |
| [`measurement-points.md`](measurement-points.md) | 测量点定义表：车架级坐标点（RA/FA/SP/CS/SA-U/SA-L/GND，原点=后轴）、**称重规程**（两工况称重法、抬起角/锁悬挂/胎压要求、0.5 kg ≈ 5 mm 的量级感）与 CG 公式、连杆布置点 ③⑥⑦ 七段距离三角定位协议（含 A↔B 耦合条款） |
| [`measurement-points.svg`](measurement-points.svg) | 车架级测量点标注侧视图 |
| [`scan-points-zh.svg`](scan-points-zh.svg) | **3D 扫描替代路线**取点图（车头朝左侧视投影，连杆放大图）——一次扫描替代 Session A+B+C 全部几何测量，称重除外 |
| [`../scan/README.md`](../scan/README.md) | **3D 扫描操作指南**（手把手）：软件与耗材、贴标记点、CloudCompare 切割、要扫哪 12 个件及各自对应 app 的哪个字段、跑脚本、质量红线、导进 app、问题排查表 |
| [`../scan/PRESCAN.md`](../scan/PRESCAN.md) | **开扫前贴墙上的检查单**：车怎么准备（拆干净/车把回正/绑结实）、标记点、导出必须是点云、扫完立刻跑门禁验收、扫描给不出必须卡尺量的几项 |
| [`../scan/METHODOLOGY.md`](../scan/METHODOLOGY.md) | **方法论**：为什么每个数都要有"不是拟合目标"的独立检验、坐标系怎么建（哪四种方法不能用）、拟合三条硬规矩、遮挡是天花板、输出必须带门禁、换到 765 的差异 |
| [`../scan/wholebike/README.md`](../scan/wholebike/README.md) | **整车未拆解扫描实测**（Yamaha R3）：能拿到什么（rake 25.49° vs 官方 25.0°）、拿不到什么（转向管/避震/摇臂轴）、几何模式 vs 标志点模式对比、踩过的坑 |

## 研究 / Research（`research/`）

| 文件 | 内容 |
|---|---|
| [`research/triumph-765-motospec.md`](research/triumph-765-motospec.md) | **核心 oracle**：真实 MotoSPEC PRO 截图数据（Street Triple RS 765）——LINK DIMENSIONS、三列 offset 对照、公式验证、坐标拟合（等价类）、**等价类极限结论**（摇臂/狗骨更换不可算，直到测得 ③⑥⑦）、赛事支援规格表 |
| [`research/r7-gsx8r-rs660-motospec.md`](research/r7-gsx8r-rs660-motospec.md) | 第二批 MotoSPEC 截图提取（R7 / GSX-8R / RS 660） |
| [`research/motospec-v5-teardown.md`](research/motospec-v5-teardown.md) | **商业版 MotoSpec v5.17.1.0 拆解对照**：反编译数据模型 vs 我们的字段差距、值得抄的功能（测量口径枚举、Spring Center、HIGHLITE、CofG 计算器、轮胎倾角模型、气簧、Gearing Table）、他们的结构性缺点与我们的护城河、分优先级落地顺序 |
| [`research/linkage-coords.md`](research/linkage-coords.md) | 连杆坐标溯源记录：公开渠道找不到任何车型的真实连杆坐标（结论：必须实测）；默认占位坐标的校准推导 |
| [`research/chassis-coords.md`](research/chassis-coords.md) | 参考车车架规格的来源追踪 |
| [`../dataacq/README.md`](../dataacq/README.md) | **数采格式知识**（MoTeC i2 / AiM RS3）：`.ajmc` 格式从真实样本逆向的 schema 与语法要点、`function` 量纲码表、通道名不能带下划线等真机教训、这台 R3 的 logger 通道清单与电位计标定约定、**Wheel Force 三条路线**（静态 / 标定动态 / 绝对动态）各缺什么。生成器是 `src/logger-export.js`；`samples/` 永久 gitignore（public repo，含 GPS 轨迹） |

## 架构 / Architecture

| 文件 | 内容 |
|---|---|
| [`static-channel-mindmap.md`](static-channel-mindmap.md) | 静态参数金字塔：全部输入→中间量→RESULTS 通道的依赖图谱 |
| [`img/`](img/) | 六个页面的界面截图（dashboard / chassis / linkage / data table / catalog / guide） |

## 过程档案 / Process Archive（`superpowers/`）

历史实现计划与设计规格，按日期命名（`plans/` 5 份、`specs/` 1 份）。
只读参考，不再更新——当前行为以代码与测试为准。

---

## 测试用 oracle / Test fixtures

| 文件 | 内容 |
|---|---|
| `../tests/fixtures/motospec-oracle.json` | **真实 MotoSPEC v5 输出**（4 台车 × 3 列，来自厂商帮助手册截图）——几何链的对表基准。含完整出处与署名、口径对齐说明、按行程深度分档的误差包络 |
| `../tests/fixtures/reference-bikes.json` | 公开规格表数值（R6 / CBR1000RR / Panigale V4）的 Trail / Wheel Rate 校验 |

---

**阅读顺序建议**（新读者）：`LIMITATIONS.md`（先知道这工具算什么、不算什么）→
`measurement-guide-765-zh.md` → `research/triumph-765-motospec.md`
（理解等价类为什么要测 ③⑥⑦）→ `measurement-points.md`（动手前的点位细节）。

**数采链路**：Data Table 的 `⤓ 数采` 按钮（`src/logger-export.js`）导出数学通道 →
在 AiM RS3 里建通道 → 跑出来的 log 由姊妹项目 `../aim-analyzer`（私有，圈速分析，
基于 `../xrk-js` 解析 AiM `.xrk`）消费。通道名与电位计约定是**对外接口**，
改之前先看 `dataacq/README.md`。
