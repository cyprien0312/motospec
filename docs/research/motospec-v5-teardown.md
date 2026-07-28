# 商业版 MotoSpec v5.17.1.0 拆解对照 — 我们该抄什么、该躲什么

来源：`~/motospec_v5_unpacked/`（他人从 MSI 解包 + ILSpy 反编译的**只读研究工作区**，
含 159 个 .cs、113 页 CHM 帮助手册、`tools/msfile.py` 文件格式编解码器）。
本文只做**对照与取舍**，不搬运其代码，也不含任何真实车辆数据
（该安装包本身就不含车架数据——车型文件要付费账号从 motospec.ca 单独下载）。

日期：2026-07-28。

---

## 0. 一句话结论

他们赢在**物理模型的深度**和**测量口径的显式化**；我们赢在**开放、免费、跨平台、
社区共享库、公式可视化**。值得抄的绝大多数东西是"几行公式 + 一个枚举字段"，
不需要牺牲我们的无构建、无框架架构。真正大的差距只有三处：**轮胎模型（倾角）、
前叉气簧、连杆构型数量**。

---

## 1. 他们的数据模型有多深（我们的路线图素材）

反编译出的类字段（`clsFrame` 14 / `clsSwingarm` 11 / `clsTire` 33 / `clsFork` 134 /
`clsShock` 5 / `clsLink` 7 / `clsSpring` / `Chassis` 225）：

| 域 | 他们有 | 我们有 | 差距性质 |
|---|---|---|---|
| Frame | HeadAngle, HeadHt, HeadX/Y, UprYokeHt, LwrYokeHt, LinkMntX/Y, ShockMntX/Y, ShockMntAng, **CShaftX/Y** | Rake_Static, WB, 连杆 10 个坐标, `Front_Sprocket_X/Y` | ✅ 基本对齐。`CShaftX/Y` = 曲轴/前链轮坐标，和我们 `Front_Sprocket_X/Y` 是同一个点，且**他们也把它归在 frame 上**——印证我们放进 `CHASSIS_SPEC_FIELDS` 是对的 |
| Swingarm | LinkX/Y, ShockX/Y, **Offset**（轴槽偏移）, **EccL / EccRadius / EccHalf**（偏心轴） | `Swingarm_Length` 一个数 | ❌ 缺**偏心后轴**（Ducati / MV / 部分 BMW）与轴槽偏移 |
| Tire | Rad（中心半径）, **MajorRad / MinorRad**（椭圆断面）, RimW, **Ang0–9 + K0–9**（倾角-径向刚度表）, **P / PNom / PCoeff**（胎压补偿） | `Rf` + `Tire_Rf_Delta` / `Tire_Rr_Delta` | ❌ 最大的单点差距，见 §3.1 |
| Fork | **130 个字段**：三套气簧建模法、kappa、五种卡式筒、左右非对称储气 | rate / preload / topout / `Front_Oil_Level`（标 PENDING，未被消费） | ❌ 见 §3.2 |
| Shock | Stroke, **ResP / ResVol / RodDia**, GAS vs THRU_ROD | Shock_Length / Stroke / rate / preload / topout | ❌ 缺气室伸展力，见 §3.2 |
| Spring | **MULTI_RATE**（三段）/ **FORCE_DISP**（位移-力表 + CSV 导入）；6 个独立槽位含 **bump rubber** | 单一 rate + topout | ⚠️ 中等 |
| Linkage | **13 种构型枚举** + Rocker Orientation UP/DOWN | 2 种（`linked` / `pro-link`） | ⚠️ 见 §3.3 |

---

## 2. 第一梯队：几行公式 / 纯 UI，当天可落地

### 2.1 Spring Center（新 RESULTS 行，一行代码）

> Spring Center = Rear Wheel Rate ÷ (Front Wheel Rate + Rear Wheel Rate)
> 0.50 = 前后等硬；随行程变化（回顶簧、气簧、连杆渐进性都会推动它）。

我们 `Front_Wheel_Rate` / `Rear_Wheel_Rate` 都已有 → **零新输入**。

### 2.2 Acceleration Limits（抬轮 / 抬后轮的纵向加速度极限，两行）

他们定义：把一端抬离地面所需的前后向加速度。只依赖 `H_CG` / `L_CG` / `Wheelbase_Live`
——我们三个都有。附带一条要照抄的诚实声明：*该计算假定极限超过轮胎摩擦系数，
且气动阻力会降低抬头极限*。

### 2.3 Anti-Squat 的四种表达（UI 切换，不改物理）

他们提供：`Percent`（100% = 中性）/ `Percent Delta`（0 = 中性，正为 anti）/
`AntiSquat Angle + Load Transfer Angle` 两个角并排 / `Angle Delta`。
理由很实在：**数据采集软件的横线默认画在 0**，所以零基准表达更好读。

⚠️ **一个待验证的差异，不要盲改**：手册 `antisquat_in_the_chassis_graph.htm` 说
Load Transfer 线"由重心高度与**轴距**构成"；我们的分母角是
`theta_cg = atan(H_CG / L_CG)`（重心到**后轴**的水平距离）。两种定义在文献里都存在。
**行动**：先把 `theta_cg` 显式暴露成一行（"载荷转移角"），让用户能同时看到两个角；
分母定义的取舍等拿到 MotoSPEC 截图 oracle 对齐后再动
（参见 `research/triumph-765-motospec.md` 的验证方法）。

### 2.4 HIGHLITE：跨列差异高亮

选一列作参考，其余列中**与参考不同**的单元格染黄。我们已有 override 的 amber accent，
但没有跨列 diff。在 5 列表格上这个价值极高，实现只是渲染时比对
`effectiveBikeValues(bike)`。

### 2.5 列间复制设置

右键菜单：从另一列复制 `Front` / `Rear` / `All` 设置（All 含组件选择、链轮、载荷读数）。
我们有 `addBike` / `removeBike`，没有 copy-from-column——而实际调车最高频的动作
就是"复制第 1 列，只改一个数"。

### 2.6 Stroke %（下沉量占行程的百分比）

他们的例子讲得很好：*"前 sag 35 mm 在 130 mm 行程的叉上是 27%，意味着约 3/4 行程
留给刹车压缩、1/4 留给抬头和负地形。"* 而且能"两支不同行程的叉在 95% 压缩下比"。

⚠️ 我们**没有 `Fork_Stroke` 这个输入**（只有 `Shock_Stroke`）。这是一个真实缺口：
`Fork_Stroke` 是规格表可查、也可实测的量，加进来即可解锁前端的 Stroke %。

### 2.7 PageUp / PageDown 逐项步进

他们给了每个参数的**实用步长**，可以直接对齐我们 `INPUT_META` 的 `step`：

```
Yoke Offset 1 · 头管偏移/角度 0.5 · Fork Position 1 · 前簧 0.5 · 前预载 0.5
油位 5 · 前回顶 rate 0.5 / length 5 · Shock Length 0.5 · Swingarm Length 1
RHA 0.5 · 后簧 2.5 · 后预载 0.5 · 后回顶 rate 10 / length 1
枢轴调整 0.5 · Linkarm 0.5 · 链轮 1 · 电位计 1 · 倾角 5
```

对照我们现在的：`Rear_Spring_Rate` step=1（他们 2.5）、`Rear_Topout_Rate` step=1
（他们 10）、`Yoke_Offset` step=0.5（他们 1）——他们的步长是**调车时真实会动的最小
单位**，我们的偏细。

### 2.8 测量口径枚举（最重要的一条，成本却最低）

这是他们做得比我们好、而且直接打在我们软肋上的地方：**同一个数字，量法不同就不可比**。

| 他们的枚举 | 选项 | 我们的现状 |
|---|---|---|
| **Fork Position Reference** | 4 种：Upper Fork Tube→Upper Yoke / Lower Yoke→Upper Fork Tube / Lower Headstock→Front Axle / … | `Fork_Position` 一个裸数字，无口径 |
| **Swingarm Length Reference** | `Swingarm Pivot`（常规）vs `Frame Center`（Panigale V2/V4 偏心枢轴） | `Swingarm_Length` 一个裸数字 |
| **Rear Ride Height Reference** | Vertical Pivot-Axle / Mapped Gauge / Dimensioned Gauge / Subframe Point | 我们的 `Rear_Ride_Height` **就是** Vertical Pivot-Axle，但没标出来 |
| **Steering Axis / Fork Adjustment** | 3 种头管插件表达（上下轴承偏移 / 角度+支点偏移 / 叉轴与转向轴不平行） | 完全没有 rake 插件概念 |

**行动建议**：在 chassis profile 上加三个 enum 字段（`Fork_Position_Ref_Type`、
`Swingarm_Length_Ref_Type`、`Rear_RH_Ref_Type`），**即使每个只实现一种算法**——
把选项写出来 + tooltip 说明 + 存进 Supabase 共享库，就能让社区里别人填的数**可比**。
这是我们"零假数据"哲学的自然延伸：不只拒绝编造数值，也要拒绝**口径不明的数值**。

同理照抄他们的 **Stroke vs Travel 定义页**：
> Stroke 是**部件级**（叉/避震，金属对金属全压缩，含 bump rubber 高度）；
> Travel 是**轮/轴级**（垂直方向）。电位计零点 = 全伸展且 topout 簧压缩。

我们现在 `Sag_Front` 沿叉轴、`Sag_Rear` 在轴处垂直——这是一对**不对称口径**
（他们两端都用部件级 pot，再由几何换算到轮端）。我们的选择对扎带法用户更友好，
但必须像他们一样把这件事**写在界面上**，否则前后 sag 数值直接相减就是错的。

---

## 3. 第二梯队：真实新物理

### 3.1 轮胎模型 —— 解锁我们已有但未消费的 `Lean_Angle`

我们 `Lean_Angle` 在 `INPUT_META` 里有、在 `P` 里有描述，**但没有任何 CALC 消费它**。
他们的模型简单到可以直接照抄：

1. **断面 = 刚性椭圆**：Centre Radius / Vertical Radius / Horizontal Radius 三个数。
   *若拿不到椭圆数据，用圆近似：长短半径都取胎宽的一半（125 mm 宽胎 → 62.5/62.5）。*
2. **径向柔性 = 一根径向弹簧**：`径向压缩(mm) = 径向力(N) / 径向刚度(N/mm)`
3. **刚度随倾角变**：给若干 (倾角, 刚度) 对，**线性插值**；超出最大倾角就用端点值。
4. **胎压补偿**：`修正刚度 = 标定刚度 + (工作压力 − 参考压力) × 压力系数`，三者缺一则不补偿。

他们明确**不建模**：载荷变形（除径向）、速度增长、断面横向位移。

物理结果他们也讲清楚了，可作为我们实现后的自检清单：
倾角 ↑ → 前胎半径比后胎掉得多 → 底盘**前俯约 0.3°** → rake ↓、trail ↓、
摇臂角 ↓ → anti-squat 角 ↓；再叠加径向柔性（后胎通常比前胎软）→ rake 回升、
anti-squat 进一步 ↓。

> 这是把 MotoSPEC 从"静态底盘"推向"过弯几何"的最自然一步，而且**不需要任何
> 我们拿不到的数据**——椭圆断面可以用胎宽近似，径向刚度可以先留空（=禁用）。

### 3.2 前叉气簧 + 避震气室 —— 让两个 PENDING 输入落地

**前叉气簧（`NOMINAL_OIL_LEVEL` 法，最少输入）**：标称油位(mm) + 该油位下的空气体积(cc)
+ 每 mm 油位的体积变化(cc/mm) + 内管直径 + **kappa**（绝热指数，*空气 1.4，
但摩托前叉典型取 1.1*——因为体积减少并非完美转化为压力上升）+ 初始绝对压力
（密封于大气压则填 1.0 bar）。

这直接消费我们标着 PENDING 的 `Front_Oil_Level`，并且**正好补上我们
`Sag_Front_Predicted` 注释里自认的缺口**（"气簧与摩擦不建模，实测与预测的差即是
它们的贡献"）——气簧一旦建模，剩下的差就只剩摩擦（stiction），诊断价值反而更高。

**避震气室**：`ResP`（bar，假定恒定）× 杆截面积 = 伸展力；若给出 `ResVol` > 0，
再算杆体积排入气室导致的压力上升。四个数（`Shock` 类型 / `Stroke` / `ResP` /
`ResVol` / `RodDia`）就是全部。

⚠️ 照抄他们的一条诚实边界：**bump rubber 不计入 Data Equations 的力**，
两条叉腿的气簧参数**必须相同**（只有油位可左右不同）。

### 3.3 连杆构型 —— 我们其实已覆盖 4/13，但没说出来

他们 13 种构型（附代表车型）与我们两种模式的映射：

| 他们的 LinkType | 代表车型 | 我们 |
|---|---|---|
| FRAME-MOUNTED ROCKER | Yamaha R6 05+ / R1 09+ | ✅ `linked` |
| HORIZONTAL BACKLINK | ZX-10R 11-18 / MT-07 / R7 | ✅ `linked` |
| SWINGARM-MOUNTED ROCKER | RSV4 09+ / S1000RR 09-18 | ✅ `pro-link` |
| UNIT PRO-LINK | CBR600RR 07+ / CBR1000RR 08+ | ✅ `pro-link` |
| **DIRECT / LINKLESS** | Yamaha R3 / KTM 890 Duke | ❌ **最简单，应该先做** |
| UNIT PRO-LINK FRAME-MOUNTED | CBR1000RR + Suter 摇臂 17+ | ❌ |
| FULL FLOATER (+ PRO / USD PRO) | Ducati 1098 / RC8R / S1000RR 19+ | ❌ 需要 Rocker Orientation UP/DOWN |
| PANIGALE | 899/959/1199/1299/V2 | ❌ |
| SUTER FULL FLOATER / XR69 / SCISSOR | MV WSBK / XR69 / Tiger | ❌ |

**行动**：(a) 在 Linkage Setup 页把这 4 个真实构型名列出来，说明它们如何映射到我们的
两个模式——用户才知道自己的车能不能算；(b) 加 **Direct / Linkless** 第三种模式
（避震直接连摇臂，MR 由两点距离直接求导，不需要 4-bar 闭合，代码量最小）。

### 3.4 CofG 计算器 —— 纯增量、零风险

我们的 `H_CG` / `L_CG` 现在只有一句"称重台 + 倾斜法实测"。他们给了一整套**可直接
搬进 `docs/measurement-points.md` 的实操规程**：

- 最少两组：**水平**（定水平位置）+ **抬起一端**（定高度）。可存 16 组，
  平均出跨油量 / 跨骑手姿势的"复合重心"。
- 抬起高度 **≥500 mm，600 mm 更好**；抬起角 **≥20°，>24° 明显更稳**。
- **悬挂必须锁死**（前叉用钢管替换一侧弹簧，后避震换硬拉杆——若拉杆比避震轻，
  差的重量要补在尽可能接近的位置）。
- 胎压打到 **60 psi 以上**，减少称重时的胎压缩。
- 抬起端**不能用轮档或刹车约束**。
- 前后都称，用"前+后 是否等于总重"检验支撑装置有没有偷走重量。
- **量级感（最有用的一条）**：读数差 **0.5 kg ≈ 重心高度差 5 mm**；
  骑手从趴伏到直立制动，重心水平位置可移 **25 mm**；满油到空油，垂直位置可移 **25 mm**。

最后一条直接说明：**没实测过重心的 anti-squat 数字只有比较价值，没有绝对价值**——
这正是我们该在 user-guide 里讲的话。

### 3.5 Gearing Table —— 纯几何 + 组合枚举，无未知物理

给定摇臂长度范围与前后齿数范围，枚举所有可行组合，输出链节数 / 最紧链条条件下
（前链轮-枢轴-后链轮三点共线）的摇臂长度 / 最终传动比，可按任意列排序，
一键 Apply 回列。附带两个很实用的过滤器：**ODD LINKS**（是否允许奇数链节）和
**Stretch/Tolerance**（把制造公差与链条伸长补进计算长度，让算出来的和量出来的对得上）。

我们现在只有一个 `Final_Ratio`。而这个功能和我们的 `Swingarm_Length` 天然联动
（换齿数 → 重调链条 → 摇臂长度变 → 轴距/姿态全变），做出来能形成闭环。

---

## 4. 他们的缺点 = 我们的结构性优势（要主动放大，别丢掉）

1. **Windows-only WPF + 付费 + LimeLM 激活 + USB dongle**。核心算法藏在原生 C++ DLL
   里（`MotoSPEC.dll`，导出名混淆），托管层只是壳。我们是 web、免费、手机可开、
   源码即文档。**→ 不要为了追功能引入构建步骤**（`CLAUDE.md` 的既定红线）。
2. **车架数据要另外付费按车型下载**。这是他们的商业模式，也是他们最大的软肋。
   **我们的 Supabase 社区共享库（可读可写、软删除、全量 history 可回滚）正好是它的
   反面** —— 这是我们真正的护城河，应该在 README / user-guide 里明确讲出来。
3. **文件格式只是位移混淆**（奇位 −2 / 偶位 −1），不是加密，目的只是防手改。
   `~/motospec_v5_unpacked/tools/msfile.py` 已能 decode/encode。
   → 理论上可做 `.MSlink` / `.MS1` 导入。**但有两条硬约束**：
   - `tools/FORMAT.md` 自己声明：**该格式只做过反推算法的 round-trip 自验，
     没有任何真实导出文件对照过**。拿到真文件 decode 核对之前，任何导入功能
     都必须标为实验性。
   - **合规边界**：用户导入自己买的文件是合理的；但**解出来的车型数据不应该被
     推到我们的公共 Supabase 共享库**——那是把别人的付费内容再分发。
     这条要写进功能本身的提示文案，不能只写在文档里。
4. **他们对"不算什么"的公开列举方式值得整段照抄**（放进 user-guide 新开一节
   "本工具不计算什么"）。他们的 Wheel Forces **不含**：气动（阻力/升力/下压）、
   过弯离心载荷、路面坡度、anti-squat / 链条力、阻尼力、叉/避震/连杆摩擦（stiction）。
   Data Equations **不含**倾角、断面、胎刚度。
   → 顺带一提：我们的 `F_Aero` + `C_f_aero` / `C_r_aero` **比他们多一层**
   （虽然是粗模型）；他们干脆不做。这不是我们赢了，是提醒我们要像他们一样
   **把模型边界写在脸上**。
5. **三列硬限制 + 强耦合 Excel**（表格 COPY 直接开 Excel 实例，Setup Sheet 写指定
   单元格）。我们 5 列、纯浏览器。Setup Sheet 的**思路**值得抄（导出到剪贴板 / CSV），
   Excel COM 依赖不值得。
6. **没有任何公式可视化或教学**——只有一份 CHM 手册。我们的 `P` 参数图 +
   可点击公式 + drill-down + 双语 user-guide 是他们完全没有的维度。**保持这个差异化。**
7. Standard / PRO 分级把倾角、椭圆胎面、多车架规格锁在 PRO 后面。我们不分级。

---

## 5. 顺带发现的自查项（与 v5 无关，但这次对照时暴露）

- **`Lean_Angle` 是死输入**：`P` 与 `INPUT_META` 里都有，`CALC` 里零消费。
  要么按 §3.1 落地，要么像 `Fork_Length` 一样在描述里注明"存在但未被消费"。
- **`Front_Oil_Level` 标着 PENDING**：§3.2 给了最小落地路径。
- **`src/reference-bikes.js:19` 的 `DYNAMIC_PRESETS` 已经失效**：它键在
  `Travel_Front` / `Travel_Rear` 上，而这两个输入自 sag 载荷工况上线后
  已不在 RESULTS 链路里。要么按他们的 Dynamic Presets 重做成
  **sag 工况预设**（0 sag / 骑手静态 sag / 重刹 95% 行程 / 出弯），要么删掉。
  他们的 Dynamic Presets 还有两个值得抄的点：**按行程百分比指定**
  （不同行程的叉可在同一压缩率下比较）、**按目标轮荷反解行程**。
- **没有 `Fork_Stroke` 输入**（见 §2.6）。

---

## 6. 建议的落地顺序

> **P0 与 P1 全部已落地（2026-07-28）**，见 `CHANGELOG.md` 的 Unreleased 段。
> P1 顺带做了两件计划外的事：Motion Ratio 与 Progression 也加了口径切换
> （否则 §7 的 oracle 数据根本无法比对），以及修掉了 `Rear_Ride_Height`
> 的对地口径 bug（§7.2）。
> 落地时的两个额外决定：(a) `Fork_Stroke` 的两条真实数据（Showa BPF 765
> 的 115 mm）来自 `triumph-765-motospec.md` 的赛事支援规格表，不是估值；
> (b) 步长只改**live 设定键**，`*_ref` 基线保持测量精度——ref 是量出来的，
> 不是拧出来的。§5 里的三个自查项仍未处理。

| 优先级 | 项 | 成本 | 依赖 |
|---|---|---|---|
| ✅ P0 | 测量口径 enum + tooltip（§2.8） | 极低 | 已完成 2026-07-28 |
| ✅ P0 | Spring Center / Acceleration Limits 两行（§2.1–2.2） | 极低 | 已完成 2026-07-28 |
| ✅ P0 | HIGHLITE 跨列 diff（§2.4）、列间复制（§2.5） | 低 | 已完成 2026-07-28 |
| ✅ P0 | 步长对齐（§2.7）、`Fork_Stroke` + Stroke %（§2.6） | 低 | 已完成 2026-07-28 |
| ✅ P1 | user-guide 新增"本工具不计算什么"（§4.4） | 低 | 已完成 2026-07-28 |
| ✅ P1 | CofG 计算器页 + 测量规程写入 docs（§3.4） | 中 | 已完成 2026-07-28 |
| ✅ P1 | Anti-Squat 四种表达 + 显式载荷转移角（§2.3） | 低 | 已完成；分母定义**仍待验证**（§7 的 oracle 截图无重心，验证不了） |
| ✅ P1 | Direct / Linkless 第三种连杆模式（§3.3） | 中 | 已完成 2026-07-28 |
| P2 | 前叉气簧 + 避震气室（§3.2） | 中 | 需 kappa / 内管径 / 气室参数字段 |
| P2 | Gearing Table（§3.5） | 中 | 无 |
| P2 | 轮胎椭圆断面 + 径向刚度 + 倾角（§3.1） | 高 | 解锁 `Lean_Angle` |
| P3 | MULTI_RATE / FORCE_DISP 弹簧 + CSV 导入 | 中 | 无 |
| P3 | 偏心后轴 / 偏心枢轴、Full Floater 家族 | 高 | 需真实坐标 |
| P3 | Setup sheet 导出（CSV / 剪贴板） | 低 | 无 |
| — | `.MS1` / `.MSlink` 导入 | 中 | ⚠️ 格式未经真实文件验证；不得回传共享库 |

---

## 7. 厂商截图数据集（2026-07-28 加入）

来源：`~/motospec_v5_unpacked/motospec_chassis_data/`。**不是**付费下载的车型
chassis 文件，而是厂商**自己做帮助手册时截图泄露的面板数值**——CHM 手册随免费
安装包一起分发。43 个历史版本安装包 → 16,309 张 PNG → 去重 782 → OCR 筛出
含车型与数值的 48 张 → 人工逐张读数。

⚠️ 全部数值**人工读自截图**，源精度 1–2 位小数，天然含约 ±0.05 的取整。
对不上时**先回原图核对**再怀疑算法。

### 7.1 已落地：验证 oracle（`tests/fixtures/motospec-oracle.json`）

4 台车 × 3 列真实 MotoSPEC 输出（R6 2017 FIM、ZX-10R 2016、ZX-10R 2021、
S1000RR M 2019）。

fixture 随仓库公开发布，并在文件内署名（Moto Race Services / motospec.ca）。
理由：源截图本来就随**免费**安装包分发、网上也找得到；而且这些量全部是真车的
物理属性，任何人有车 + 卷尺都能自己测出来。本项目做开源就是为了让底盘调校信息
更容易获取，不是更难。这是我们第一次能**拿另一个求解器在同一台车的三个悬挂位置上
逐项对表**——比对着规格表核静态值有力得多。

口径对齐（缺一不可，否则数字必然对不上）：

| 他们的量 | 我们的量 |
|---|---|
| 第 1 列 topped out 的输出 | 就是我们的静态输入（rake → `Rake_Static`，wheelbase → `WB`，摇臂角 → `beta_static`） |
| 前电位计读数 | `Sag_Front`（都是沿叉轴的部件级压缩，同口径） |
| **rear_wheel_travel（他们的输出）** | `Sag_Rear`（我们的后 sag 是轮端垂直量，**不是**后电位计读数） |
| `Rf` | 由第 1 列的 trail 恒等式反推 |

**结果（这是目前对本工具精度最诚实的一句话）：**

| 档位 | 前叉行程 | rake | trail | 后车高 | 轴距 |
|---|---|---|---|---|---|
| static | 0（topped out） | ≤ 0.00° | ≤ 0.002 mm | ≤ 0.08 mm | ≤ 0.00 mm |
| working | ≤ 40 mm | ≤ 0.011° | ≤ 0.10 mm | ≤ 0.43 mm | ≤ 0.10 mm |
| deep | > 40 mm | **≤ 1.50°** | **≤ 20 mm** | ≤ 14.4 mm | ≤ 2.1 mm |

deep 档的偏差**不是当作通过**处理的：测试把已知误差**钉在记录的包络里**，
再劣化就会红。原因明确：我们的俯仰模型是平板小角近似（前轴垂直上升
= 叉行程 × cos(rake_static)，接地点不移动），80–120 mm 行程下这两条假设都破了，
而 MotoSPEC 解的是完整车架几何。

**Rf 反推的独立佐证**：四台车由 trail 恒等式反推的 `Rf` 分别是 304.46 / 302.01 /
304.40 / 304.33，全部落在厂商轮胎库对应条目的中心半径**下方 0.49–0.67 mm**。
两份互不相干的截图、同一个方向的偏差量级——正好是受载半径小于自由半径的签名。

### 7.2 这批数据当场揪出的一个真 bug

`Rear_Ride_Height` 用的是**未含底盘俯仰**的摇臂角。而 MotoSPEC 的
Vertical Pivot-Axle 定义是"从穿过枢轴的**水平**线量到后轴"——水平即对地，
必须用对地摇臂角。验证：`−L·sin(他们输出的对地摇臂角)` 在 R6 三列上分别得
−135.40 / −111.36 / −86.73，对应他们的 −135.4 / −111.4 / −86.8。

修正前后（同一批数据）：

| | 修正前 | 修正后 |
|---|---|---|
| R6 col2 | −2.70 mm | −0.43 mm |
| R6 col3（120 mm 行程） | **−44.32 mm** | −1.62 mm |

顺带推翻了 `tests/tire-delta.test.js` 里一条旧断言（"换后胎不改后车高"）——
在对地口径下，换高后胎让车身低头，枢轴水平线到后轴的垂直距离**确实**会变。
旧断言编码的是当时未经验证的定义。

### 7.3 没有进共享库，以及为什么

| 数据 | 判断 |
|---|---|
| 4 台车 × 3 列输出 | ✅ 已作为**仓库内测试 oracle**，带完整出处 |
| ZX-10R 7 组连杆尺寸 | ⚠️ 字段能 1:1 对上我们的 lengths-only 模式（见下），但**缺 3 个固定 XY 锚点**，配不成完整 linkage profile |
| 3 支前叉全参数 | ⚠️ 只有 `L`→`Fork_Length`、`Travel`→`Fork_Stroke` 能对上；弹簧刚度在 MotoSPEC 里是 setup 列的值、不属于前叉规格 |
| 11 条轮胎 + 径向刚度曲线 | ⚠️ 我们**还没有轮胎 catalog**；这批数据正是 §3.1 轮胎模型落地时的现成素材 |

**不推共享库的理由**（两条，都不是法律洁癖）：

1. 这是**别家厂商公开发布的数值**。放在我们仓库里当测试 oracle、注明出处，
   是正当的互操作性验证；把它灌进一个面向所有人的社区可编辑库、还不带出处，
   性质不同。
2. **它们本来就不完整**。半套 linkage / 半套前叉进了库，只会让别人的列出现
   一堆 "Need: …"，或者更糟——让人以为那是完整可用的定义。

### 7.4 ZX-10R 连杆字段映射（留给以后）

`.MSlink` 的四个长度和我们 lengths-only 模式**恰好一一对应**：

| MotoSPEC | 我们 | 含义 |
|---|---|---|
| `AnchorShock` | `armA` | rocker 转点 → 避震 |
| `AnchorLinkarm` | `armB` | rocker 转点 → 拉杆 |
| `ShockLinkarm` | `chord` | 避震 ↔ 拉杆（摇臂弦长）|
| `NomLinkarmL` | `dragLink` | 拉杆长度 |

缺的是 3 个固定 XY 锚点（rocker pivot、drag anchor、frame shock top）。
换句话说：**只要量到这 3 个点，那 7 组 ZX-10R 摇臂就能直接建成 7 条 linkage
profile**。这也再次印证 `research/linkage-coords.md` 的结论——固定锚点必须实测。
