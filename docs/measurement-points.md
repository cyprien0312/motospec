# Frame Measurement Points / 车架测量坐标点表

给 `src/core/scan.ts`(计划中)用的实测坐标点,用来替换 `BikeProfile` 里的估算字段
(swingarm 长度/枢轴高度、countershaft 位置、rake/offset、CG 等)。

## Coordinate frame / 坐标系约定

- **侧视图 2D**(所有点投影到车辆中心纵平面,忽略 y)
- **Origin (原点):后轮轴心 RA = (0, 0)**
- **+X = 车头方向(向前),+Z = 向上**,单位全部 **mm**
- 测量状态:整车直立(垂直地面)、**出厂参考姿态**(自重下沉、无骑手)、标准胎压、
  链条调节器在基准位置

## Points to measure / 需要测量的坐标点

| # | Code | English label | 测什么 | 对应 `BikeProfile` 字段 |
|---|------|---------------|--------|--------------------------|
| 1 | **RA** | Rear axle center | 原点 (0, 0),同时量 RA 离地高 = 后胎受载半径 R_rear | 后胎半径校验 |
| 2 | **FA** | Front axle center | (x_FA, z_FA) | `wheelbaseMm` = x_FA;FA 离地高 = 前胎受载半径 R_front |
| 3 | **SP** | Swingarm pivot center | (x_SP, z_SP) | `swingarmLengthMm` = √(x_SP² + z_SP²);`swingarmPivotHeightMm` = z_SP + R_rear |
| 4 | **CS** | Countershaft (front sprocket) center | (x_CS, z_CS) | `countershaftVsPivot` = { dx: x_CS − x_SP, dz: z_CS − z_SP } |
| 5 | **SA-U** | Steering axis, upper point (upper steering-head bearing center) | (x_U, z_U) | 与 SA-L 联立 ↓ |
| 6 | **SA-L** | Steering axis, lower point (lower steering-head bearing center) | (x_L, z_L) | `rakeDeg` = atan((x_U − x_L)/(z_U − z_L));`forkOffsetMm` = FA 到直线 SA-U→SA-L 的垂直距离 |
| 7 | **GND-R** | Rear tire contact patch | RA 正下方地面点(校验 R_rear) | 地面基准线 |
| 8 | **GND-F** | Front tire contact patch | FA 正下方地面点(校验 R_front) | 地面基准线 |

注意:

- **SA-U / SA-L 必须是转向轴上的两点**(上下轴承中心),不是叉管表面——量叉管外壁
  要修正到管中心。两点间距越大,rake 精度越高。
- 后链轮与 RA 同轴,不需要单独测;链轮半径由齿数算(`sprocketRadiusMm`)。
- x 坐标可用铅垂线把各点投影到地面后沿地面卷尺量;z 用高度尺/激光水平仪。

## Linkage placement points ③⑥⑦ / 连杆布置点——七段距离三角定位法

解锁"换摇臂/换狗骨可计算"的三个布置点(见
`docs/research/triumph-765-motospec.md` 等价类结论)。编号与 Linkage Setup
页 SVG 一致(pro-link):① 摇臂枢轴、② 后轴心、③ 摇臂枢轴(在后摇臂上)、
⑥ 拉杆车架锚点、⑦ 车架避震上端。

**坐标系注意:本节原点在 ①(摇臂枢轴),不是上表的后轴 RA。**

### 设计原则:全程不用铅垂线、不用水平尺

所有量都是**点到点直线距离**(孔心到孔心),对整车姿态、轮胎尺寸、
rake、改装状态完全免疫。改装车(换过 linkage / shock / 狗骨 / 链调 /
轮胎)照样适用——唯一进入的整车信息是一个角度 β_ref,在下面 Session B
里单独测。

### Session A — 七段距离(后轮离地,避震完全伸展)

前置条件:
- 后驻车架从摇臂起落座顶起,后轮悬空 → 避震 top-out,整个机构变成
  **一个刚体**,量的过程中不会动;
- **整个 Session 不碰链条调节器**(② 的位置由当前调节器位置决定);
- 全部量**孔心到孔心**(螺栓/轴承中心),不是边缘到边缘,目标精度 ±0.5 mm。

| # | 距离 | 定什么 |
|---|------|--------|
| L1 | ① → ② | 当前 `Swingarm_Length`(含链调位置) |
| L2 | ① → ③ | ③ 定位圆 1 |
| L3 | ② → ③ | ③ 定位圆 2 |
| L4 | ① → ⑥ | ⑥ 定位圆 1 |
| L5 | ② → ⑥ | ⑥ 定位圆 2 |
| L6 | ① → ⑦ | ⑦ 定位圆 1 |
| L7 | ② → ⑦ | ⑦ 定位圆 2 |
| L8(选测) | ⑥ → ⑦ | 交叉校验(两点都在车架上,任何状态可量) |

每个点由两个圆相交定位(与 app lengths-only 模式同一套
`circleCircleIntersect` 数学)。两圆有上下两个交点,用**肉眼记录在
①–②线的哪一侧**即可消歧,不用量:③ 在线下方、⑥ 在枢轴下后方、
⑦ 在前上方。

精度提示:
- ⑥ 离 ①–② 线较近,两圆交角浅、误差放大——L4/L5 尽量量准,并用 L8
  做校验;⑦ 离线远,条件好。
- 长距离(L6/L7 约 300–400 mm)用钢直尺或数显卡尺接杆,卷尺会有
  挠度误差。

同批顺手量(换装件的杆长,都是刚体距离,任何状态可量):
- 摇臂三角形三边:③→④、③→⑤、④→⑤(眼心到眼心);
- 狗骨长:⑤→⑥ 眼心距;
- 避震:完全伸展眼心距(eye-to-eye)+ 行程(stroke)+ 弹簧 rate。

### Session B — 一个角度,把车架点转回参考坐标系

Session A 得到的 ⑥⑦ 坐标是相对 ①–② 线(摇臂系、top-out 状态)的。
要转到模型的车架参考轴(+X 向前、+Y 向上),需要参考姿态下的摇臂角
β_ref——也就是 chassis profile 里的 β_static,整车基线测量时顺带完成:

- 整车直立在水平地面、后悬挂完全伸展(助手提起车尾到刚好 top-out、
  后轮仍触地),量 **① 和 ② 的轴心离地高** h①、h②;
- `β_ref = asin((h① − h②) / L1)`。

③ 本身相对 ①–② 线定义,是摇臂的刚体属性,**不需要**这一步。

### 反算

把 L1–L8 + 消歧侧别交给两圆相交反算得 ③⑥⑦ 坐标(app 的
`circleCircleIntersect` + `pickNearestBranch` 即可复用);对照已有
拟合值(如 765 的 MotoSPEC fit)可直接看出拟合猜对/猜偏了哪些点。

## Weighing (not coordinates) / 称重项(非坐标,但同批测)

| Code | English label | 测什么 | 对应字段 |
|------|---------------|--------|----------|
| W-F / W-R | Front / rear wheel load, level | 水平地面上前后轮各自重量 | `massKg` = W_F + W_R;`weightFrontPct` = W_F / (W_F+W_R) × 100 |
| W-F′ | Front wheel load, rear raised | 后轮垫高 H(建议 ≥150 mm),再读前轮重量 | `cgHeightMm`(见下式) |

CG 高度(两轴心近似等高时):

```
tanθ = H / √(wb² − H²)
h_cg(轴线以上) = (W_F′ − W_F) × wb / (W_total × tanθ)
cgHeightMm ≈ h_cg + 轮轴离地高
```

抬得越高、秤精度越高,结果越可靠;悬挂最好绑死(捆扎带压死行程)再做抬高称重。
