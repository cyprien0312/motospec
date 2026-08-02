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

## Wheel Force 通道还缺什么(按端)

生成器刻意不出 Wheel Force,直到这些量存在(缺一个都只能给假数):

**前**:
- [ ] 预载 mm(现在只有"6 圈",缺调整器螺距 mm/圈)
- [ ] topout 弹簧刚度 + 长度
- [ ] 气簧参数:内管径已知(37),缺标称油位下的空气体积 + kappa
      (K-Tech 内芯文档/实测;商业版取 kappa≈1.1)

**后(K-Tech Razor-RR)**:
- [ ] topout 刚度 + 长度
- [ ] 杆径(rod diameter)
- [ ] 气瓶压力 ResP(bar)——查 Razor-RR 出厂单据或气压表实测

这些都到位后:F_front = [k×(pot+preload) + 气簧 + topout] × 2 腿换算;
F_rear = [k×(pot+preload) + ResP×杆面积] ÷ MR。摩擦与 bump rubber 不计
(商业版同样不计,诚实边界)。

## 同步策略

代码/文档正常 push(多机同步);`samples/` 本地拷贝。**注意 23:00 的
auto-archive cron 会 `git add -A`** —— 任何不想公开的东西必须先进
.gitignore 再落盘到仓库树内,顺序不能反。
