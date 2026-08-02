# 本工具的局限 —— 逐条、指到代码行

> **为什么有这份文档。** 商业版 MotoSPEC 在帮助手册里公开列举了"Wheel Forces 不含
> 什么、Data Equations 不含什么"（见 `research/motospec-v5-teardown.md` §4 第 4 条），
> 那是整份拆解里最值得照抄的一条做法。仓库里已有一份**面向用户**的版本
> （app 内 user-guide 的「本工具不计算什么」一节，`src/user-guide.js` 的 `limits`
> 区块）。这一份是**面向工程**的版本：每条都指向具体文件与代码位置，并且明确标注
> 它属于哪一类边界。

**分类标记**（每条必带其一）：

| 标记 | 含义 |
|---|---|
| **【刻意】** | 有理由地不做。理由写在条目里，通常是"缺数据就留空好过给假数""与商业版口径一致""差值本身就是诊断信号"。改它需要先推翻理由。 |
| **【待做】** | 有明确落地路径（公式已知 / 参考实现已拆解 / 只差一次测量）。条目里写清前置条件。 |
| **【无法】** | 受物理或数据可得性限制，当前路径下做不到。要么换测量方法，要么接受。 |

**读法**：先看 §1 判断"我要的数在不在模型里"，再看 §2 判断"我手里的数够不够硬"。
§3–§5 是三个子系统各自的边界，§6 是全仓库的单位/精度约定。

---

## 1. 物理模型边界

### 1.1 悬挂力学

| # | 条目 | 类 | 位置 | 说明 |
|---|---|---|---|---|
| 1.1.1 | **前叉气簧（油位 / 气隙）不建模** | 【待做】 | `src/formulas.js` `Sag_Front_Predicted`（CALC，只有主簧 + 回顶簧两段）；`Front_Oil_Level` 在 `INPUT_META` 里有、在 `CALC` 里**零消费**（Data Table 上带 PENDING 徽章，`src/data-table.js` `ROW_GROUPS` FRONT SETTINGS 组） | 落地路径已拆解完毕：`research/motospec-v5-teardown.md` §3.2 的 `NOMINAL_OIL_LEVEL` 法——标称油位 + 该油位空气体积 + cc/mm + 内管径 + kappa（摩托前叉取 1.1，不是空气的 1.4）+ 初始绝对压力。行程越深它占比越大：**接近打底处实际轮端刚度明显高于这里给出的纯螺旋弹簧值**。 |
| 1.1.2 | **避震气室伸展力 / 杆排量压升不建模** | 【待做】 | `src/formulas.js` `Sag_Rear_Predicted`（`springF` 只有 `k·(p+s)` 与 topout 项） | 需要 4 个数：`Shock` 类型（GAS / THRU_ROD）、`ResP`、`ResVol`、`RodDia`（teardown §1 表格 + §3.2）。R3 的 K-Tech Razor-RR 实测气体力 ≈120 N 近似常数，贮气瓶压升项仅几 N（`dataacq/README.md`「Wheel Force」节）——所以**在静态标定路线里它被锚点吸收**，不阻塞数采导出。 |
| 1.1.3 | **摩擦 / stiction 不计** | 【刻意】 | `src/formulas.js` `Sag_Front_Predicted` 的 desc 明写"只含螺旋弹簧——气簧与摩擦不建模，实测与预测的差即是它们的贡献" | 商业版同样不计（teardown §4 第 4 条）。**这里的"不做"是有产出的**：预测 sag 与实测 sag 的差就是气簧 + 摩擦的合计贡献，是弹簧诊断的信号。一旦 1.1.1 落地，剩下的差就只剩摩擦，诊断价值反而更高。 |
| 1.1.4 | **Bump rubber（缓冲胶）完全不建模** | 【刻意】 | 口径声明在 `src/formulas.js` `Fork_Stroke` 的 desc（"bump rubber 高度包含在行程内，不另外扣除"）与 `Rear_Stroke_Pct` 的 note | 与真实 MotoSPEC 的 Stroke 定义一致（teardown §3.2 末尾）。后果：**行程末端的真实刚度比这里高**，`Front_Stroke_Pct` / `Rear_Stroke_Pct` 接近 100% 时只是行程占用率，不代表力的比例。 |
| 1.1.5 | **阻尼力不进任何计算** | 【刻意】 | 全仓库没有阻尼输入；`computeAll` 是纯代数 + 数值求根，无时间维度 | 整个工具是**准静态快照**计算器。压缩/回弹点击数不进任何公式。 |
| 1.1.6 | **弹簧只有单一线性 rate + 一段 topout** | 【待做】 | `src/formulas.js` `Sag_Front_Predicted` / `Sag_Rear_Predicted` | 商业版有 MULTI_RATE（三段）与 FORCE_DISP（位移-力表 + CSV 导入），6 个独立槽位（teardown §1 表格，落地顺序里排 P3）。渐进弹簧、双段簧当前只能用等效单 rate 近似。 |
| 1.1.7 | **`Sag_Rear_Predicted` 在打底处返回 NaN 而非外插** | 【刻意】 | `src/formulas.js` `Sag_Rear_Predicted`：全行程内找不到力平衡点 → `return NaN` | 与全仓库的诚实规则一致——NaN 在表里渲染成"—"，比一个超出物理行程的假数好。 |

### 1.2 几何与姿态

| # | 条目 | 类 | 位置 | 说明 |
|---|---|---|---|---|
| 1.2.1 | **重心不随悬挂压缩移动** | 【待做】 | `src/formulas.js` `Wheelie_Limit` / `Braking_Limit` 的 CALC 注释与 P 节点 note：*"我们存的是对地坐标，不是车架坐标"* | 直接后果：`Anti_Squat`、`Wheelie_Limit`、`Braking_Limit` **只在接近你测量重心时的姿态下最准**。落地前置条件是把 CG 改存**车架坐标**，同时改写 `docs/measurement-points.md` 的称重规程（现在的规程测的就是对地量）。不是一行代码。 |
| 1.2.2 | **倾角（Lean_Angle）没有任何公式消费** | 【待做】 | `src/formulas.js`：`P.Lean_Angle` 有、`INPUT_META.Lean_Angle` 有、**任何 `CALC` 与 `linkage.js` 都不读它**（程序化确认：全仓库真正的死输入只有 `Lean_Angle`、`Front_Oil_Level`、`Fork_Length` 三个）；已在 `src/user-guide.js` 里声明 | 几何**全部按车辆直立计算**。落地路径完整写在 teardown §3.1：椭圆断面（拿不到就用胎宽一半近似）+ 径向弹簧 + (倾角, 刚度) 线性插值 + 胎压补偿。teardown 还给了实现后的自检清单（倾角 ↑ → 前胎半径掉得比后胎多 → 前俯约 0.3° → rake ↓ trail ↓ 摇臂角 ↓ anti-squat 角 ↓）。 |
| 1.2.3 | **轮胎断面 / 受载变形 / 胎压不建模** | 【待做】 | 轮胎在模型里只有一个数：`Rf`（基线胎受载滚动半径）+ `Tire_Rf_Delta` / `Tire_Rr_Delta` 两个实测差量 | 商业版 `clsTire` 有 33 个字段（MajorRad/MinorRad、Ang0–9 + K0–9 倾角-刚度表、P/PNom/PCoeff 胎压补偿）——teardown §1 把它列为**最大的单点差距**。与 1.2.2 是同一件事的两半。 |
| 1.2.4 | **路面坡度一律按水平** | 【刻意】 | 全仓库没有坡度输入 | 与商业版一致。 |
| 1.2.5 | **头管插件（rake 可调件）未实现** | 【刻意】 | `Rake_Static` 就是最终值，没有"头管角 + 插件修正"两级结构 | 用插件的车直接把**改后的** rake 填进 `Rake_Static` 即可——基线锚定模型下这是正确用法，不是绕过（见 §6 的基线锚定原则）。 |
| 1.2.6 | **偏心后轴 / 偏心枢轴未实现** | 【待做】 | `Swingarm_Length` 只有一个数；商业版 `clsSwingarm` 有 `Offset` / `EccL` / `EccRadius` / `EccHalf` | 影响 Ducati、部分 MV / BMW。teardown 落地顺序排 P3，前置条件是拿到真实偏心参数。 |
| 1.2.7 | **`Load_Transfer_Angle` 的分母定义未定案** | 【无法】（暂时） | `src/formulas.js` `Load_Transfer_Angle` 的 note；`theta_cg = atan(H_CG / L_CG)` | 商业版手册把这条线描述为由**重心高度与轴距**构成，我们用的是**重心到后轴的水平距离** `L_CG`。两种定义文献里都有。**无法验证的原因是数据缺口**：`tests/fixtures/motospec-oracle.json` 的 4 台车 12 列截图**没有一张显示 CofG**，所以 oracle 对不了这一项。拿到带重心的截图之前，这条只能显式列出来而不能改。 |
| 1.2.8 | **测量口径枚举只实现了每项一种算法** | 【刻意】 | `src/chassis-setup.js` `CHASSIS_ENUM_FIELDS`，每项带 `implemented:` 字段；口径不符时 `chassisEnumIsUnmodelled()` 打"not modelled"徽章 | 记录口径 ≠ 支持口径。三个枚举（`Fork_Position_Ref_Type` / `Swingarm_Length_Ref_Type` / `Rear_RH_Ref_Type`）**不进任何公式**——它们的作用是让共享库里别人的数字可比。默认 `''`（未记录）是刻意的：给别人的数字盖一个他没声明的口径章，和编数字是同一类错误。 |

### 1.3 连杆运动学

| # | 条目 | 类 | 位置 | 说明 |
|---|---|---|---|---|
| 1.3.1 | **13 种连杆构型只覆盖 5 种** | 【待做】 | `src/linkage.js` 的三种 `Linkage_Mode`；映射表在 `research/motospec-v5-teardown.md` §3.3 | 已覆盖：Frame-mounted Rocker、Horizontal Backlink（→ `linked`）、Swingarm-mounted Rocker、Unit Pro-Link（→ `pro-link`）、Direct/Linkless（→ `linkless`）。**算不了**：Unit Pro-Link Frame-mounted、Full Floater 家族（需要 Rocker Orientation UP/DOWN）、Panigale、Suter Full Floater、XR69、Scissor。选错模式不会报错——它会给出一个收敛的、错的数。 |
| 1.3.2 | **linkless 的 progression 接近零** | 【刻意】 | `src/linkage.js` `shockLowerEnd` 的 linkless 分支（只绕枢轴旋转，不解闭环）；`tests/linkless.test.js` 钉死 | 这是**诚实答案**而不是缺陷：无连杆后端的 MR 变化只来自避震夹角变化。R3 端到端验收得 3.63%（`scan/wholebike/README.md` 验收表）。别拿它和有连杆车的 15–25% 比。 |
| 1.3.3 | **连杆是纯 2D 刚体模型** | 【刻意】 | `src/linkage.js` 文件头：*"origin = swingarm pivot, +X forward, +Y up, mm"*——10 个坐标全部只有 X/Y | 不建模：连杆件的侧向偏置与 Z 向、轴承间隙、连杆/摇臂柔度、避震眼球头的角位移。对几何量（MR / progression / 摇臂角）影响很小；对**力**的影响不小，而力本来也不算（1.1）。 |
| 1.3.4 | **闭环不收敛 / 目标长度不可达 → NaN，绝不回退** | 【刻意】 | `src/linkage.js`：`rockerShockEnd` 在 \|residual\| ≥ 1e-6 时毒化成 NaN；`swingarmDeltaForShockTravel` 先扫 ±45° 找有限的变号区间，找不到直接 NaN | 机构真的会在 ±45° 内锁死。旧行为（返回端点）会把一个 ±45° 的摇臂转角当成解呈现。**永远不要重新引入端点/未收敛回退**。 |
| 1.3.5 | **`swingarm_delta_solve` 只覆盖静态阶段** | 【待做】 | `src/formulas.js` `swingarm_delta_solve` 的 note：*"Travel_Rear 视为 0（静态阶段）……Dynamic 阶段回归时拆出独立的 swingarm_delta_dynamic 即可"* | 当前 RESULTS 的"动态"完全由 sag 载荷工况驱动；电位计式的实时行程输入（`Travel_Front` / `Travel_Rear`）**已不在 RESULTS 链路上**（见 1.5.2）。 |
| 1.3.6 | **MR / progression 是数值微分，带固定采样参数** | 【刻意】 | `src/linkage.js`：`motionRatio` 中心差分 ε = 0.5°；`progression` 沿 bump 方向 9 点采样取 max/min | 参数是标定过的（Triumph 765：bump 方向扫描 25.7% vs oracle 25.6%），但**极强渐进的连杆上 9 点可能漏掉局部极值**。改采样数会改数字，改之前先看 `tests/motospec-oracle.test.js` 的误差包络。 |

### 1.4 气动与轮荷

| # | 条目 | 类 | 位置 | 说明 |
|---|---|---|---|---|
| 1.4.1 | **气动只有一个粗模型** | 【刻意】 | `src/formulas.js` `F_Aero = ½ρV²·Cd·A`，按固定比例 `C_f_aero` / `C_r_aero` 分到前后轮 | 单一 Cd·A、固定前后分配；**没有**升力与俯仰随姿态的变化、没有翼片随倾角失效、没有阻力对抬头极限的修正（`Wheelie_Limit` 的 note 自己声明了这一点）。真实 MotoSPEC 干脆不做气动——我们多做一层不等于赢了，**只是更有义务把边界写在脸上**（teardown §4 第 4 条）。别当风洞数据用。 |
| 1.4.2 | **气动 / 轮荷通道当前没有任何 RESULTS 行消费** | 【待做】 | 程序化确认：`ROW_GROUPS` 的 RESULTS 组共 14 行，`MotoSPEC_FrontForce` / `MotoSPEC_RearForce` / `F_Aero` / `delta_W` / `W_*_Static` **都不在其中** | 它们只在 Dashboard 的公式图谱里可见（可点击 drill-down），`W_*_Static` 另外作为 `Sag_*_Predicted` 的中间量参与计算。也就是说：**气动模型今天对 Data Table 的输出没有任何影响**。要么给它一组 RESULTS 行，要么把它的地位在 UI 里讲清楚。 |
| 1.4.3 | **链条拉力不进轮荷** | 【刻意】 | 链条只进 `theta_chain_dynamic` → `theta_thrust` → `Anti_Squat` | 抗蹲**角**算了，链条**力**不算。与商业版一致（其 Wheel Forces 明确不含 anti-squat / 链条力）。 |
| 1.4.4 | **过弯离心载荷不计** | 【刻意】 | 无侧向动力学 | 与 1.2.2 同源：全部按直立、纵向平面内计算。 |

### 1.5 已知的陈旧点（模型内部的不一致）

| # | 条目 | 类 | 位置 | 说明 |
|---|---|---|---|---|
| 1.5.1 | **`Fork_Length` 存在但刻意不被消费** | 【刻意】 | `src/formulas.js` `Fork_Length` 的 desc 自己声明；换叉走 `Fork_Length_Delta`（并排实测差值） | 理由完整写在 `scan/METHODOLOGY.md` §6：**差值直接测比两个绝对值相减少一半误差**，而且没人能量全"从零件搭出前端几何"所需的头管/叠高全套。结论是"不被消费的量就不入库"——`Fork_Length` 是这条规则的反例遗留物。 |
| 1.5.2 | **`Travel_Front` / `Travel_Rear` 及其下游已脱离 RESULTS 链路** | 【待做】 | `src/formulas.js` 的 `Pitch` / `delta_beta` / `Rear_Wheel_Vertical_Travel` 仍在 `TOPO_ORDER` 里算，但没有任何 RESULTS 行读它们；sag 载荷工况上线后姿态链走的是 `Pitch_Sag` | teardown §5 已把它列为自查项，**至今未处理**。 |
| 1.5.3 | **`src/reference-bikes.js` 的 `DYNAMIC_PRESETS` 已失效** | 【待做】 | `src/reference-bikes.js`：`DYNAMIC_PRESETS` 键在 `Travel_Front` / `Travel_Rear` 上（即 1.5.2 那两个已下线的输入），仍通过 `dynamic_presets` 导出 | 两条路：按 teardown §5 重做成 **sag 工况预设**（0 sag / 骑手静态 sag / 重刹 95% 行程 / 出弯），或者删掉。留着是死代码。 |
| 1.5.4 | **`Front_Sprocket_X` / `Front_Sprocket_Y` 默认值是占位** | 【无法】（无通用值） | `src/formulas.js`：desc 明写"占位默认值，需按车型校准"，`INPUT_META` 默认 (50, 10) | 它们直接进 `theta_chain_dynamic` → `Anti_Squat`。**未按车型校准的 anti-squat 只有比较价值**。它们属于 `CHASSIS_PROVIDED`，所以没有 chassis profile 时对应 RESULTS 会诚实留空。 |

---

## 2. 数据来源的不确定度

> 一个看起来像样的错数比没有数更糟（`scan/METHODOLOGY.md` §5）。这一节回答的是
> "我现在库里的数，硬到什么程度"。

### 2.1 R3 扫描数据的不确定度（唯一一台走完全流程的车）

来源：`scan/wholebike/README.md`（整车未拆解实测 + segment 路线 + 端到端验收）。

| 量 | 值 | 不确定度 / 交叉验证 | 类 |
|---|---|---|---|
| 位置类硬点（连杆坐标、销中心） | — | **±1~2 mm**，来自左右独立解的差（实测 1.2~2.4 mm），直接打印在输出里 | 【无法】再小：受 ~2 mm 表面噪声限制 |
| **前轴位置** | — | **±5 mm**——左右切在了轴的不同台阶上，是全套里最差的一项 | 【待做】：分割时对齐左右切面即可改善 |
| rake | 25.77°（segment 路线）/ 25.49°（整车路线） | 官方标称 25.0°；**扫描时避震全伸展会偏大，方向一致**；整车路线两根叉管独立拟合互差 0.02° | 【无法】完全对齐标称：标称值本身是另一个工况 |
| 轴距 | 1406.1 mm | 前一天另一次扫描 1411.2；车主卡尺实测 ≈1405 | 轴距**本来就随链条调节 + 避震状态变**，不是扫描误差 |
| 避震眼距 | 拟合 278.73 mm | **卡尺实测 280 mm**，差 1.27 mm 落在声称不确定度内 | **实测优先于拟合**：入库条目 `Shock_Length_ref` 取 280.0，扫描值留在 note 里 |
| **yoke offset** | 37.4 **±1.5** mm | 见 2.2 | |
| 轮胎滚动半径 | — | **触地点扫不到**，"轴心到最低可见点"系统性偏小（R3 后轮偏小 27 mm） | 【无法】：要真实滚动半径就直接量，别指望扫描（见 4.3） |

### 2.2 为什么 yoke offset 是弱项（单独拎出来讲）

`scan/wholebike/README.md` 的 `yoke_offset.py` 一节记录了完整的失败与修正：

- **坏路径**（经前轴）：转向轴 ⊥ 前轴的垂距，继承了**两个最弱的量**——方向误差 × 600 mm 力臂（±3~5 mm）叠加前轴位置（±5 mm）→ 合计 **±7 mm**。R3 上给出 31.7 的坏数。
- **正确路径**（经叉管对，`scan/wholebike/yoke_offset.py`）：offset = 转向管轴线 → 左右叉管连线中轴的垂距。叉管是全扫描**最长的圆柱**（轴向跨度 800 mm+，圆心极稳），且**对转向角免疫**（绕转向轴转不改变垂距），完全绕开前轴。R3 实测两管到轴 108.4 / 108.1（对称 0.3 mm）→ **37.4 ±1.5**，与车主手量 ≈35 一致。
- 由官方 spec 闭环反推的 **40 是名义值**，不是实测——`scan/wholebike/README.md` §二用 `trail = Rf·tan(rake) − offset/cos(rake)` 反推得到，用于交叉检验，**不应该当实测入库**。
- **污染范围是有界的**：`dTrail ≈ −1.11 × dOffset`，只污染 trail 一条链，**不碰 MR / anti-squat / 轮率**。所以 offset 弱不影响悬挂侧的结论。

### 2.3 没测量的量 → 哪些 RESULTS 会显示 "Need: …"

`bikeReadyKeys(bike)` 是"哪些输入真的被绑定"的唯一真相源（`src/data-table.js`）；
材料化后的值带着 `INPUT_META` 默认值，而**默认值证明不了任何事**。

| 缺什么 | 直接变 Need 的 RESULTS |
|---|---|
| `Mass` / `H_CG` / `L_CG` / `front_weight_dist`（**未称重**） | `Anti_Squat`（经 `theta_cg`）、`Wheelie_Limit`、`Braking_Limit`；以及 LOAD CASE 组的 `Sag_Front_Predicted` / `Sag_Rear_Predicted`（经 `W_*_Static`） |
| `Front_Sprocket` / `Rear_Sprocket`（链轮齿数） | `Anti_Squat`（经 `theta_chain_dynamic`） |
| 10 个连杆坐标 | `Motion_Ratio`、`Progression`、`Rear_Wheel_Rate`、`Spring_Center`；**但不包括** rake/trail/wheelbase——避震差量为 0 时 `swingarm_delta_solve` 会在读任何坐标前短路返回 0（`skipDepsWhen`，`tests/conditional-readiness.test.js` 钉死） |
| chassis profile 未选 | 全部 chassis 域输入渲染成只读空格 + "Need: Chassis profile" |

R3 端到端验收的原话：**"剩余 Need 全部指向刻意留空的量（质量/CG、链轮齿数）"**
（`scan/wholebike/README.md` 验收节）。称重是解锁面最大的一次测量——同时解锁静态
轮荷、标定式 Wheel Force、Anti-Squat、Wheelie/Braking Limit 四样
（`dataacq/README.md`「行动顺序：先称重」）。

### 2.4 占位坐标不是任何一台真车

`src/formulas.js` `INPUT_META` 里 10 个连杆坐标的默认值注释写得很清楚：
*"Calibrated engineering estimate: MR ≈ 2.4 at static, shock ≈ 310 mm, monotonic over ±25°"*，
对应 `src/linkage-setup.js` 的 `LINKAGE_PLACEHOLDER_PROLINK`。它们是**为了让页面
一打开就有个能收敛的形状**，不是任何车型的数据。`docs/research/linkage-coords.md`
的结论：**公开渠道找不到任何车型的真实连杆坐标，必须实测**——扫描是唯一的路。

---

## 3. 数采导出的边界（`src/logger-export.js`）

| # | 条目 | 类 | 位置 | 说明 |
|---|---|---|---|---|
| 3.1 | **多项式拟合有效域是 0..usable，不是 0..Shock_Stroke** | 【刻意】 | `buildLoggerChannels`：41 点采样 `rearVerticalTravel`，一旦出现非有限值就把 `usable` 截到上一点并发 warning | 连杆在行程内锁死时通道**只在 0..usable mm 内有效**，超出就是外插。有效域写进导出文件头。 |
| 3.2 | **拟合阶数 3（残差 >0.15 mm 时试 4 阶）** | 【刻意】 | 同上：`polyfit(xs, ys, 3)`，最大残差 >0.15 时比较 4 阶并取优 | **最大残差印在导出文件头**——残差大就说明连杆强渐进，用的人自己决定要不要升阶。 |
| 3.3 | **MR 通道是拟合多项式的导数，不是解算器直出** | 【刻意】 | `mrCoeffs = polyderiv(coeffs)`；与 `motionRatio()` 交叉验证，差 >0.15 发 warning | 两条不同途径算同一个物理量，差大就报警。这是自检，不是保证。 |
| 3.4 | **不生成 Anti-Squat / CofG 通道** | 【刻意】 | `skipped[0]`，代码注释：*"这里拿到的 v 是材料化后的值，H_CG 等即使未绑定也带着 INPUT_META 默认值——默认值证明不了任何事"* | v1 **无条件**不生成，而不是试图从值上区分"实测"与"默认"。缺实测 CG 的 anti-squat 只有比较价值（teardown §3.4）。 |
| 3.5 | **不生成 Wheel Force 通道** | 【待做】 | `skipped[1]` | `dataacq/README.md` 已把它拆成三条路线：**静态轮荷**（只要称重）→ **动态·标定路线**（`F = F_static + k_wheel×(pot − pot_static)`，预载/气瓶压力/杆径全被静态锚点吸收，只需称重 + 带骑手静态 pot 读数）→ **动态·绝对路线**（补 K-Tech 单据参数）。标定路线**边界诚实声明**：topout 区与前叉气簧的行程非线性未建模——前轮离地判断恰好用到 topout 区（"前力变负 = 已过 topout = 离地"判断成立、**数值不物理**），深压缩下前力被线性式低估一成上下。 |
| 3.6 | **`.ajmc` 的 `function` 码只部分逆向** | 【待做】 | `buildAjmc` 的 `fnCode()`；码表在 `dataacq/README.md` | 已确认量纲码：1=Percent、3=Acceleration(g)、4=Angle(deg)、8=Distance(m/mm)、11=Number(#)、16=Speed(m/s)、18=Time(s)。**高位似有标志位**（Linear Acc 4355 = 3 + 0x1100）含义未逆向，置 0 即可。**N/mm 没有对应量纲 → 诚实留在 Number**。补全办法很便宜：在 RS3 里手建一个目标量纲的通道、导出 .ajmc 读数字。 |
| 3.7 | **MoTeC i2 XML 不生成** | 【刻意】 | `src/logger-export.js` 文件头：*"i2 XML 仍不生成（还没有真实样本可对照）"* | 同一条 `.MS1` 实验性格式纪律（teardown §4 第 3 条）：**没有真实导出文件对照过的格式，不做导入/导出功能**。i2 用户走文本粘贴路径。 |
| 3.8 | **电位计约定是硬假设，导入前必须核对** | 【无法】自动检测 | 文件头写死：`$FP` / `$RP` = 压缩量 mm，**0 = 全伸展（topped out）**，前者沿叉管轴向 | 传感器标定方向 app 无从得知。不符就先在 RS3 里做线性换算通道，再让 MS 通道引用换算后的（`dataacq/README.md` ⚠ 段）。 |
| 3.9 | **通道名不能带下划线** | 【无法】改变 | `disp()` 把内部 `MS_X` 统一转成空格显示名 "MS X" | 2026-08-02 真机导入教训：带下划线的通道名 RS3 识别不稳。另注意 **xrk 内部名 ≠ RS3 显示名**（xrk 头部 `Front_Sup`，RS3 公式引用 `"Front Sup"`）。 |
| 3.10 | **前叉行程→垂直分量只用基线 rake** | 【刻意】 | `MS_FrontWheelTravelV = $FP × cos(rake0)`，`rake0` 是导出时的 `Rake_Static` 常数 | 行程中 rake 会变，严格说该用瞬时 rake（会形成循环引用）。压缩 100 mm 量级下的二阶误差，**换胎 / 换叉 / 改 offset 后必须重新导出**——所有常数都是导出时刻的 profile 基线烘焙进去的。 |

---

## 4. 灵敏度地图的边界（`src/sensitivity.js`）

| # | 条目 | 类 | 位置 | 说明 |
|---|---|---|---|---|
| 4.1 | **只有一阶偏导，且只在当前设置附近成立** | 【刻意】 | `diffLever()`：对每个杠杆做中心差分，步长 = 该键的 `INPUT_META.step` | 输出的每个数是"你在围场里拧一下会发生的事"，**不是全域有效的系数**。表头强制标注"在当前设置附近"（`renderSensitivityHtml` 的 `note1`）。 |
| 4.2 | **灵敏度随载荷漂移** | 【刻意】 | 文件头注释；`Sag_Front` / `Sag_Rear` 被单列成 `SENS_LOADCASE`（"载荷工况，不是旋钮"） | 同一台车在 0 sag 与骑手 sag 下的灵敏度不同（连杆的 MR 曲线是非线性的）。看这张表前先把载荷工况设成你关心的那个。 |
| 4.3 | **不含交叉项** | 【无法】用当前表达式 | 每次只动一个键 | 两个旋钮一起拧的效果**不等于**两行相加，尤其在连杆强渐进区。这张表是偏导矩阵的对角读法，不是全微分。 |
| 4.4 | **步长是"一格"，非线性强的地方一格 ≠ 微分** | 【刻意】 | 步长取自 `INPUT_META.step`（真实 MotoSPEC PageUp/PageDown 表的调整增量，如 Yoke_Offset 1、Rear_Spring_Rate 2.5、Rear_Topout_Rate 10、油位 5） | 这是刻意的取舍：**要的就是"一次扳手动作"的量级感**，不是数学上的极限。步长大 → 中心差分含高阶项。 |
| 4.5 | **门禁必须由 app 侧传入，否则不门禁** | 【刻意】 | `computeSensitivity(values, lang, ready)`：`ready` 为 null 时不做门禁（**仅测试用**），app 端必须传 `bikeReadyKeys(bike)` | 材料化值带默认值，默认值证明不了绑定。任一侧算出 NaN → 该格 `null` → 渲染 "—"，**绝不外插**。 |
| 4.6 | **杠杆与输出都是固定短表** | 【待做】 | `SENS_LEVERS` 8 项 + `SENS_LOADCASE` 2 项 → `SENS_OUTPUTS` 8 项 | 不是全部输入 × 全部 RESULTS。加杠杆很便宜（往数组里加一条），但要确认它在真实世界里对应一个扳手动作——`Fork_Length_Delta`（换叉）这类"不是拧一格"的量刻意不在表里。 |

---

## 5. 扫描管线的边界（`scan/METHODOLOGY.md` + `scan/wholebike/README.md`）

| # | 条目 | 类 | 位置 | 说明 |
|---|---|---|---|---|
| 5.1 | **遮挡是真正的天花板** | 【无法】（除非拆车） | `scan/METHODOLOGY.md` §4 | 整车带整流罩时：轮心 / 轴距 / rake **拿得到**（rake 25.49° vs 官方 25.0°，因为叉管平行于转向轴、与转向角无关）；**转向管孔、避震上下点、摇臂轴孔全部拿不到**。765 有连杆（5 个点，不是 R3 的 2 个），**遮挡只会更严重**。`SCAN_WORKFLOW.md` §3 第一句"拆掉——优先做这个"是**实测支持的结论，不是建议**。 |
| 5.2 | **短圆柱不能定方向** | 【无法】（噪声决定） | `scan/wholebike/hardpoints_from_segments.py` | ~2 mm 表面噪声下，25 mm 长的轴头 `fit_cylinder` **轴向**误差可达几十度（实测同一根后轴左右两段方向差 **61°**，而轴线**位置**只差 1.8 mm）。所以该工具的原则是：**方向永远不从短圆柱拟合，从物理约束来**（横向销 ⊥ 中面；横向轴 = 左右质心对的共识、剔除离群那对；地面 = 已知胎径的公切线）。每个横向销只拟合 2D 圆心，左右各解一遍，**差值就是打印出来的不确定度**。 |
| 5.3 | **触地点扫不到** | 【无法】（除非架空） | `scan/METHODOLOGY.md` §2 末尾 | 轮胎压在地上 → "轴心到最低可见点" 比真实半径**偏小**，且前后偏差不同 → **地面线倾斜约 1.1°**，直接偏置 rake。要精确 rake 就把车架起来让轮胎离地；要真实滚动半径就直接量。 |
| 5.4 | **四种建坐标系的方法明确不能用** | 【无法】 | `scan/METHODOLOGY.md` §2 | ❌ PCA 主轴（只反映点分布）；❌ 整体镜像配准求对称面（实测 rms 6.07 mm——真车本来就不对称：排气、边撑、链条、转过的前轮）；❌ 纯距离判据 RANSAC 找地面（扁平物体上**完全失效**，"最大的平面"全是横切车身的薄板，rms 恰等于容差/√3；必须换法向量判据）；❌ 靠标称轮径校平。 |
| 5.5 | **环带不是圆柱面** | 【无法】 | `scan/METHODOLOGY.md` §3.1 | 按半径分带取点再喂 `fit_cylinder`，rms **必然** ≈ 带宽/√12（实测 6~8 mm，红线 0.25 mm）。这不是拟合坏，是输入根本不是圆柱面。同理取点必须按"到轴线的径向距离"，不能按到种子点的球形距离（实测会拟合出 132 mm 半径的"前叉管"）。 |
| 5.6 | **`pipeline.py` 在 2D 投影里找圆 → 前轮一转就崩** | 【刻意】（已知能力差距） | `scan/wholebike/README.md` §5 | 转过的前轮把同心圆投影成椭圆，轮辋圆消失，轴心定不了。手工分割 + `fit_cylinder` 走 3D，**完全不受转向角影响**。`wholebike/` 解决的是"扫完到分割之间的空窗"（2 分钟内知道这次扫描是不是废了），**不是 `batch_fit.py` 的替代品**。 |
| 5.7 | **分段必须活在父点云的坐标系里** | 【无法】自动修复 | `scan/check_segments.py`（在切割与 `batch_fit` 之间跑） | 一整批曾被 per-piece transform **静默作废**——`batch_fit` 的 L/R 合并检查读出 39–64°。切完就跑这个脚本。 |
| 5.8 | **裸车架没有免费的绝对尺度参照** | 【待做】 | `scan/METHODOLOGY.md` §7 表格 | R3 靠 17″ 轮辋（胎圈座直径 431.8 mm 的标准件）侥幸拿到了绝对尺度验证。**裸车架上没有这种东西——必须自带标定杆。** |
| 5.9 | **门禁不过 → 整个结果标 UNRELIABLE** | 【刻意】 | `scan/wholebike/pipeline.py` 末尾 6 条硬门禁 | 任何一条失败就把整个结果标成 `RESULTS UNRELIABLE`，而不是打印一堆漂亮数字。**与 `src/linkage.js` 里不收敛就毒化成 NaN 是同一条原则。** |

---

## 6. 单位与精度约定

### 6.1 单位

- 全部 **mm / 度**，除非公式内部显式经 `D2R` / `R2D` 转换（`src/formulas.js` 顶部导出）。
- 中间量里有**弧度**节点（`Pitch`、`delta_beta`、`delta_beta_sag`、`Pitch_Sag`、`theta_*`）——它们的 `unit` 字段写着 `rad`，消费方负责乘 `R2D`。看公式时先看 unit。
- 扫描侧坐标系与 app 侧**不同**：扫描输出以后轮触地点为原点（+X 前、+Y 左、+Z 上，`scan/wholebike/README.md` §2），`src/linkage.js` 的连杆坐标以**摇臂枢轴**为原点（+X 前、+Y 上，2D）。转换由 `scan/motospec_export.py` 负责。

### 6.2 一个数是"实测 / 拟合 / 标称 / 占位"哪一种

这是全仓库最重要的一条元数据约定，因为四者的可信度差一个量级：

| 类别 | 含义 | 例子 |
|---|---|---|
| **实测** | 卡尺 / 称重 / 直尺量出来的 | R3 `Shock_Length_ref = 280.0`（拆下避震卡尺量，**覆盖了 278.73 的拟合值**）；765 的 `Fork_Stroke = 115`（Showa BPF，来自赛事支援规格表） |
| **拟合** | 点云拟合 / 数值反解出来的，**必带不确定度** | R3 rake 25.77°、yoke offset 37.4 ±1.5、10 个连杆坐标（±1~2 mm，前轴 ±5 mm） |
| **标称** | 厂商公布值。**只用于交叉检验，不当实测入库** | R3 官方 rake 25.0°、轴距 1380（实车 ≈1405，差异来自链条调节 + 避震状态，不是扫描误差）；由 spec 闭环反推的 offset 40 |
| **占位** | 为了让页面能收敛而放的工程估计 | `INPUT_META` 的 10 个 Pro-Link 连杆坐标（MR ≈ 2.4）；`Front_Sprocket_X/Y` = (50, 10) |

**规则：实测 > 拟合 > 标称。** 有实测就用实测，拟合值留在条目的 note 里作验证记录
（R3 的 `Shock_Length_ref` 就是这么处理的）。**占位值永远不该出现在共享库条目里。**

### 6.3 基线锚定 —— 为什么很多"重要的量"从来不要求测

`scan/METHODOLOGY.md` §6 是这条原则的完整论证。几何链**锚定在实测基线上，绝对值
只在"相对基线的差"里起作用**：

- `WB` 是一次性参考测量 —— 调链条走 `Swingarm_Length`，**不改 WB**
- `Rf` 是基线轮胎的半径 —— 换胎走 `Tire_Rf_Delta`（两胎受载轴心离地高的实测差）
- 换叉走 `Fork_Length_Delta`（两根叉并排直接量的差值）—— **从不经过任何绝对长度**

**差值直接测比两个绝对值相减少一半误差**，这正是 app 把它们设计成 typed measured
difference 并列入 `ALWAYS_READY`（0 = 同一支叉 / 同款胎，是物理真实而非占位）的原因。
推论：**不被消费的量就不入库**。

### 6.4 数值求解的精度约定

| 环节 | 参数 | 位置 |
|---|---|---|
| 4-bar 闭合 Newton-Raphson | 最多 50 次迭代，\|residual\| < 1e-9 收敛；**≥ 1e-6 判定失败 → NaN** | `src/linkage.js` `closeFourBar` / `rockerShockEnd` |
| 避震行程 → Δβ 反解 | 先在 ±45° 内扫 90 段找有限的变号区间，再二分 60 次（\|f\| < 1e-6 提前退出）；无区间 → NaN | `src/linkage.js` `swingarmDeltaForShockTravel` |
| Motion Ratio | 中心差分 ε = 0.5° | `src/linkage.js` `motionRatio` |
| Progression | bump 方向 9 点采样 | `src/linkage.js` `progression` |
| `Sag_Rear_Predicted` | 12 段粗扫找区间 + 60 次二分，\|resid\| < 1e-3 | `src/formulas.js` |
| 数采多项式 | 41 点采样，3 阶（残差 >0.15 mm 试 4 阶） | `src/logger-export.js` |

### 6.5 与真实 MotoSPEC 的对表精度（分档，不是单一公差）

`tests/motospec-oracle.test.js` + `tests/fixtures/motospec-oracle.json`（4 台车 × 3 列
厂商帮助手册截图）**刻意分三档**，因为诚实答案本来就不均匀：

- `static`（顶到底）与 `working`（≤40 mm 前叉行程）：**紧公差断言**
- `deep`（>40 mm）：断言误差落在**记录下来的包络**内——它钉的是**已知的偏离**，
  所以**回归和改进都会让它失败**。模型变好时要把包络收紧，不是放宽。

口径对齐是这里的全部工作：MotoSPEC 的前电位计 = 我们的 `Sag_Front`，但我们的
`Sag_Rear` 是轮端垂直行程，所以取的是他们的 `rear_wheel_travel` **输出**，不是后电位计。

`tests/validation.test.js` 是另一条线：对着 `tests/fixtures/reference-bikes.json`
（R6 / CBR1000RR / Panigale V4 的公开 spec 表）按车给 `tolerance_mm`（默认 1 mm）。

---

## 7. 相关文档

- **面向用户的同类内容**：app 内 user-guide 的「本工具不计算什么」（`src/user-guide.js` 的 `limits` 区块，双语）
- 商业版自己列举的边界与我们的差距清单：[`research/motospec-v5-teardown.md`](research/motospec-v5-teardown.md)（§1 数据模型差距表、§3 真实新物理、§4 第 4 条、§5 自查项）
- 扫描侧方法论与踩过的坑：[`../scan/METHODOLOGY.md`](../scan/METHODOLOGY.md)、[`../scan/wholebike/README.md`](../scan/wholebike/README.md)
- 数采格式知识与 Wheel Force 三条路线：[`../dataacq/README.md`](../dataacq/README.md)
- 为什么连杆坐标必须实测：[`research/linkage-coords.md`](research/linkage-coords.md)

---

*维护约定：改动 `src/formulas.js` / `src/linkage.js` / `src/logger-export.js` /
`src/sensitivity.js` 的物理或门禁行为时，回来核对本文对应条目。落地一条【待做】
就把它删掉（而不是改成"已完成"）——这份文档只列**当前仍然成立**的局限。*
