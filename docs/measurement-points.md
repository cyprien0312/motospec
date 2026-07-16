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
