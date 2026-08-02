# dataacq/ — 数采集成(MoTeC i2 / AiM RS3)

app 的「⤓ 数采」按钮(Data Table 每列)把本车几何烘焙成 logger 数学通道。
生成器在 `src/logger-export.js`。本目录放格式知识和样本。

## samples/ —— 本地样本,永不入库

`samples/` 已 gitignore(**repo 是 public 的**,里面是含 GPS 轨迹的真实赛道
数据)。多台机器之间**手工拷贝**同步,别试图开洞。当前本地样本:

- 一个真实 `.ajmc`(RS3 数学通道导出,含 AiM 官方示例通道 + 用户自建通道)
- 一个真实 `.xrk`(整场比赛的 log,用于核对通道名与验证导入)

## `.ajmc` 格式(从真实样本逆向,2026-08-02)

**JSON 数组**,不是 XML。每个通道一个对象:

```json
{
  "area": "分组区域",  "comment": "说明",
  "formula": "SQRT(\"GPS LonAcc\"[g] * \"GPS LonAcc\"[g])",
  "frequency": 50.0,   "function": 4,
  "generated_channel_name": "显示名", "group": "组名", "name": "区域-组名",
  "is_stepped": 0, "operands": [], "unit": "deg",
  "usage_description": "", "version": 0
}
```

语法要点(全部来自样本内证据):

- 通道引用带引号可含单位标签:`"GPS Speed"[m/s]`;无单位通道裸引号引用
- 函数大写:`SQRT ATAN DERIV INTEG FIR ABS`;`^` 为幂;比较用 `GT LT EQ AND`
- 用户常量 `$NAME$`;`*180/3.14159` 手工转角度
- 用户自建通道 `version: 0`,AiM 官方示例 `version: 1`
- **`function` 数字码含义未完全逆向**:观察到 deg→4、#→11、m→8、s→18、
  %→1、g→3。mm / N/mm 的码**样本里没出现** —— 我们的导出对非角度通道
  统一用 11(#) 并标注实验性;若导入后单位显示异常,在 RS3 里手改该
  通道的 measure 即可,公式不受影响

## 这台 R3 的 logger 通道(从 xrk 头部提取)

悬挂电位计**已在录**:

| 通道名 | 是什么 |
|---|---|
| **`Front_Sup`** (Ch02) | 前悬挂电位计 —— 导出器的 $FP 默认绑定它 |
| **`Rear_Sup`** (Ch01) | 后悬挂电位计 —— $RP 默认绑定它 |
| `Brake_Press` (Ch04) | 刹车压力 |
| OBDII_RPM/SPD/TPS/PPS/ECT/IAT/MAP/MAF | ECU 通道 |
| InlineAcc/LateralAcc/VerticalAcc/RollRate/PitchRate/YawRate | IMU |
| GPS Speed/LonAcc/LatAcc + Lean angle(BIKE_ANGLE) | GPS/姿态 |

⚠ 导入我们的通道前**必须核对电位计标定方向**:导出器假定
**0 = 全伸展(topped out),压缩为正,单位 mm**。不符就先在 RS3 里做
线性换算通道,再让 MS_ 通道引用换算后的。

## Wheel Force —— 三条路线,各缺什么(2026-08-02 车主问出来的关键分层)

**1. 静态轮荷**:`F = Mass·g·配重` —— 只要称重,悬挂内部参数一个不要。

**2. 动态·标定路线(推荐先做)**:以静态平衡为锚,
`F(t) = F_static + k_wheel×(pot − pot_static)`。
**预载/气瓶压力/杆径全是常数偏移,被锚点吸收** —— 物理依据:静止时悬挂
给轮子的力必然等于静态轮荷,一个等式标定掉全部未知常数。Razor-RR 的
气体力 ≈120N 常数,贮气瓶压升项仅几 N(杆排量/瓶容比),可忽略。
需要:**称重(Mass+配重) + 带骑手的静态 pot 读数(量 sag 顺手记)**。

边界(诚实声明):topout 区和前叉气簧的行程非线性未建模 ——
- 前轮离地判断恰好用到 topout 区:标定路线的替代读法是**前力变负 =
  已过 topout = 离地**,判断成立,数值不物理
- 深压缩下前力被线性式低估一成上下(油位 160 的气簧渐进)

**3. 动态·绝对路线(精修)**:补上 K-Tech 单据参数后覆盖上述两个盲区:
- 前:预载 mm(6 圈×螺距)、topout 刚度+长度、气簧体积+kappa(商业版取 1.1)
- 后:topout 刚度+长度、杆径、气瓶压力 ResP

摩擦与 bump rubber 两条路线都不计(商业版同样不计)。
**行动顺序:先称重** —— 同时解锁静态轮荷、标定式 Wheel Force、
Anti-Squat、Wheelie/Braking Limit 四样;单据参数属于精修不属于阻塞。

## 同步策略

代码/文档正常 push(多机同步);`samples/` 本地拷贝。**注意 23:00 的
auto-archive cron 会 `git add -A`** —— 任何不想公开的东西必须先进
.gitignore 再落盘到仓库树内,顺序不能反。
