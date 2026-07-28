# 3D 扫描 → MotoSPEC 车架数据：手把手操作指南

一次扫描能一次性拿到 app 里最难获取的东西：**10 个连杆坐标**。没有它们，
Motion Ratio、Progression、后轮刚度、Rake/Trail 的载荷响应全都是空的。

> 目标不是做一个漂亮的 CAD 模型，是拿到 **12 个孔的中心坐标**。
> 想清楚这一点，"扫得不够好"的焦虑就没了 —— 不需要完整、光滑、封闭的模型。

---

## 0. 全流程一眼看完

```
 车架         Creality Scan        CloudCompare          batch_fit.py        motospec_export.py      app
 ┌───┐        ┌──────────┐        ┌──────────┐         ┌──────────┐        ┌──────────┐        ┌──────┐
 │贴点│  ──▶  │分段扫描  │  ──▶  │切出每个孔│  ──▶   │拟合+建系 │  ──▶  │翻成我们  │  ──▶  │部件库│
 │喷粉│       │存 .ply   │        │存单独文件│         │出硬点    │        │的字段    │        │选它  │
 └───┘        └──────────┘        └──────────┘         └──────────┘        └──────────┘        └──────┘
   §2             §3                  §4                   §5                   §6               §7
```

**先跑一遍假数据**（不需要扫描仪、不需要车），确认工具链在你机器上是通的：

```bash
cd scan
.venv/bin/python synth_scan.py --out demo
.venv/bin/python batch_fit.py --init demo/segments -o demo/config.json
.venv/bin/python batch_fit.py --run demo/config.json
```

已经验过的结果：rake 误差 **0.002°**、轴距 **0.00 mm**、各硬点 **< 0.05 mm**。
你跑出来应该一样。跑不出来先解决环境，别急着去扫车。

---

## 1. 准备

### 软件（全免费）

| 用途 | 软件 | 备注 |
|---|---|---|
| 采集 | **Creality Scan** | Otter Lite 自带。**必须用 Marker（标记点）对齐模式** |
| 切割 | **CloudCompare** | 主力工具，[cloudcompare.org](https://cloudcompare.org) |
| 计算 | 本目录的脚本 | venv 已经建好，见下 |

**不需要买 Geomagic Design X / Quicksurface。** 那类软件是把扫描件反算成可编辑
CAD 曲面用的，我们只取几个坐标，用不上。

Python 环境已经准备好了：

```bash
cd scan
.venv/bin/python -c "import numpy, scipy; print('OK')"
```

（如果 venv 坏了：`python3 -m venv .venv` 然后
`~/.local/bin/pip --python .venv/bin/python install numpy scipy`）

### 耗材

- **标记点贴纸**（reflective marker，直径 3–6 mm）—— 几十块一大版，多买
- **AESUB Blue 显像剂** —— 可挥发，几小时自己没，不用擦。替代品婴儿爽身粉+酒精，
  但厚度不均会引入 0.05 mm 级误差
- **一把好卡尺**（≥150 mm）—— §5 的尺度校验必须用
- 一块大板子/桌面，用来架车（板子上也要贴标记点）

---

## 2. 车怎么准备

### 2.1 能拆就拆 —— 这一条比任何技巧都管用

把避震、连杆、摇臂、发动机拆掉，扫**裸车架**。绝大部分"孔被挡住"的问题直接消失。

拆不掉的孔看 §2.4。

### 2.2 贴标记点（决定成败的一步）

- **视场里任何时刻要能同时看到 ≥4 个点**。车架细长，沿主梁每 **40–60 mm** 贴一个。
- **必须贴得歪七扭八，不能排成直线或规整网格。** 共线的标记点无法解算旋转，
  这是配准漂移的头号原因。
- **不要贴在圆弧边缘、倒角、转角上** —— 要贴在平坦区域，不然中心识别会跳。
- **周围环境也要贴。** 车架架在板子上，板子贴满标记点。扫细节时扫描仪仍有稳定的
  全局参考。**这一步最多人漏，效果最明显。**
- **不要贴在要测的特征上**（轴承孔面、避震座端面），会把数据挖掉。

### 2.3 喷显像剂

阳极氧化黑、抛光铝、镀铬件结构光基本扫不到。喷一层 AESUB Blue，薄而均匀。

### 2.4 挡住的孔怎么办

按优先级：

1. **拆掉** —— 见 §2.1
2. **穿杆法**：找一根精磨圆棒（h6 以上），直径配孔，穿进去两端各伸出 100–150 mm。
   扫外露段（完整圆柱、360° 可见），拟合出的**轴线就是孔的轴线**，精度比直接扫
   短孔高一个数量级。孔中心位置用卡尺量"外露端面→孔中心"的距离补上。
   > **前后轮轴强烈建议用这个方法。** 一个 20 mm 长的轴承孔拟合出的轴向可能差
   > 0.5°，插根长棒能压到 0.02° 级别。
3. **球头适配器**：螺栓拧进隐藏孔，外端粘一颗已知直径的精密钢球。球面拟合精度
   0.02 mm 且**不受覆盖角影响**，只看到 1/3 也能准确定心。
4. **扫 + 卡尺混合**：可见特征之间用扫描，隐藏特征到某个可见基准的距离用卡尺，
   再在脚本里加进去。

---

## 3. 扫描

Creality Scan 里：

- **对齐模式选 Marker（标记点）**，不要用特征对齐或纹理对齐
- **精度档拉到最高**（点间距最小），文件大不是问题
- **分段扫，每段 20–30 秒就停，单独存。** 一次连扫 5 分钟必然漂移。
  段与段之间靠公共标记点在 CloudCompare 里对齐
- 关掉日光灯、避开阳光直射，别在有窗的白天扫
- 保持在软件提示的最佳工作距离，忽近忽远会引入噪声
- 导出 **.ply**

### 扫完先自检

同一个特征**独立扫两次**，分别拟合圆柱，比轴线夹角和圆心距离。
差 >0.1 mm 或 >0.1° 说明配准还不稳 —— **回去重扫，别往下做**。

---

## 4. 在 CloudCompare 里切出每个孔

对每个要的特征重复：

1. 拖 `.ply` 进 CloudCompare
2. 左侧选中点云
3. 工具栏 **剪刀图标（Segment）**
4. 鼠标画多边形框住目标特征 → **回车**确认 → 点 **Segment In**（只留框内）
5. 得到一个 `.segmented` 子云 → **File ▸ Save** → 存成单独的 `.ply` 或 `.xyz`
6. 按下面的表命名，全部放进同一个 `segments/` 目录

> 小技巧：先 **Edit ▸ Colors ▸ Height Ramp** 上色，特征边界会清楚很多。
>
> `.xyz` / `.asc` 纯文本也能读，而且**不需要装 open3d**。存不了 ply 就存 xyz。

### 要扫哪些件 —— 照这张表来

文件名必须用这些关键词，脚本靠名字认类型和左右。

| 文件名 | 是什么 | 喂给 app 的 | 不扫的后果 |
|---|---|---|---|
| `steering_head.ply` | 转向头轴承孔（上下各扫一段更准） | `Rake_Static`、`Yoke_Offset` | ❌ 全线崩，而且**脚本靠它判断哪边朝上** |
| `axle_front_L/_R.ply` | 前轮轴 | `WB`、`Rf` 基准 | ❌ 建不了坐标系 |
| `axle_rear_L/_R.ply` | 后轮轴 | `WB`、`Swingarm_Length` | ❌ 建不了坐标系 |
| `swingarm_pivot_L/_R.ply` | 摇臂支点 | `beta_static`、**连杆坐标的原点** | ❌ 连杆全废 |
| `footpeg_L/_R.ply` | 脚踏支架 | 只用来定对称面 | ⚠️ 对称面只剩 2 对，精度下降 |
| `rocker_pivot.ply` | 摇杆支点 | `Frame_Rocker_Pivot_X/Y` | ❌ Motion Ratio / Progression 空 |
| `rocker_shock.ply` | 摇杆↔避震 连接点 | `Rocker_To_Shock_X/Y` | ❌ 同上 |
| `rocker_link.ply` | 摇杆↔拉杆 连接点 | `Rocker_To_Drag_X/Y` | ❌ 同上 |
| `link_swingarm.ply` **或** `link_frame.ply` | 拉杆的另一端，**看模式**（见下） | `Drag_To_Swingarm_X/Y` | ❌ 同上 |
| `shock_upper.ply` | 避震上锁点（车架侧） | `Frame_Shock_Top_X/Y` | ❌ 同上 |
| `shock_lower.ply` | 避震下锁点 | 自检用（应与 rocker_shock 重合） | ⚠️ 少一项自检 |
| `countershaft.ply` | 输出轴（前链轮）中心 | `Front_Sprocket_X/Y` | ⚠️ Anti-Squat 空 |

**⚠️ 拉杆那一端扫哪个，取决于你的连杆型式 —— 扫错会得到一个能收敛但完全错误的连杆：**

| 你的车 | 拉杆另一端在 | 存成 | app 里的模式 |
|---|---|---|---|
| 摇杆装在**车架**上（R6、R1、ZX-10R、MT-07…） | 摇臂上 | `link_swingarm.ply` | `linked` |
| 摇杆装在**摇臂**上（Honda Pro-Link、RSV4、老 S1000RR） | 车架上 | `link_frame.ply` | `pro-link` |
| 避震直连、没有摇杆（R3、KTM 890/990 Duke） | 不存在 | 只要 `shock_upper` + `shock_lower` | `linkless` |

分不清就看：**摇杆的转轴螺栓拧在车架上还是摇臂上。**

---

## 5. 跑脚本

```bash
cd scan

# 1) 扫目录、自动识别类型、自动配对左右，生成配置模板
.venv/bin/python batch_fit.py --init segments/ -o config.json

# 2) 编辑 config.json —— 三处必填，见下

# 3) 跑
.venv/bin/python batch_fit.py --run config.json
```

### config.json 里必须自己填的三处

**① 轮胎半径**（`tyres`）

```json
"tyres": { "front_radius_mm": 304.5, "rear_radius_mm": 320.0 }
```

必须是**实际压载后的滚动半径**：骑上去，量轴心到地面。**不是** 120/70-17 换算的
标称值。差 5 mm，rake 就差 0.2°。

脚本用前后半径差把车的姿态"放平"。这一步很多人漏掉 —— 前后轮半径差 7 mm 在
1375 mm 轴距上就是 **0.29° 的 rake 误差**。

**② 尺度校验**（`scale_check`）—— 别跳过

```json
"scale_check": { "feature_a": "axle_front", "feature_b": "axle_rear",
                 "known_distance_mm": 1375.0 }
```

用卡尺/卷尺实测车架上两个特征之间的真实距离，填进来。结构光扫描的尺度误差是
**系统性**的，不验证的话轴距可能整体偏 0.3%，后面所有 trail 计算全跟着错。

**③ 对称面配对**（`symmetry_pairs`）

至少 3 对左右特征，**且不要共线**。`--init` 会自动配好，检查一下有没有配错。

### 输出（`out/` 目录）

| 文件 | 内容 |
|---|---|
| `quality_report.txt` | **先看这个** |
| `hardpoints_bike.csv` | 车辆坐标系硬点（原点=后轮触地，+X 前，+Z 上） |
| `motospec_inputs.csv` | 参数表，缺的标 MISSING |
| `geometry.json` | 全部结果 + 扫描→车辆坐标的变换矩阵 |
| `hardpoints_scanner.csv` | 原始扫描坐标，便于回 CloudCompare 核对 |

### 质量红线 —— 不达标就回去重扫，别硬算

| 指标 | 门槛 | 不达标的含义 |
|---|---|---|
| `arc_span_deg` | ≥ 120° | 圆周覆盖不够，圆心和半径都不可信 → 换角度补扫或用穿杆 |
| `rms` | < 0.15 mm | 点云噪声或配准漂移 → 喷显像剂 / 加标记点 |
| `n_inliers` | > 500 | 点太少 → 提高扫描分辨率 |
| 左右轴夹角 | < 0.1° | 左右应共线，不共线说明配准漂了 |
| 左右轴偏距 | < 0.2 mm | 同上 |
| 对称面 rms | < 0.3 mm | 某一对左右特征配错，或车架本身歪（撞过？） |

---

## 6. 转成 app 的字段

```bash
.venv/bin/python motospec_export.py out/geometry.json \
    --name "Triumph 765 (scanned)" \
    --mode linked \
    --fork-position 5 \
    -o out/motospec_catalog.json
```

`--mode` 用 §4 那张表选。`--fork-position` 填扫描当天叉管的伸出量实测值；
不填记 0，表示"**扫描时的状态就是基线**"——差值语义不受影响，以后调叉照样算得对。

它会打印三项自检：

```
trail: 本项目公式 102.92 mm vs 扫描 102.93 mm  差 0.01 mm  ✅
避震眼距: 硬点距离 313.25 mm vs 报告 313.25 mm  差 0.00 mm  ✅
rocker_shock 与 shock_lower 应是同一孔: 相距 0.00 mm  ✅
```

第一项最重要：它用**我们 app 自己的 trail 公式**从 rake/Rf/offset 重算一遍，和扫描
结果对。差 >0.5 mm 就说明 rake、offset 或轮胎半径里有一个不对。

### 扫描给不出、必须另外获取的

| 字段 | 怎么拿 |
|---|---|
| `Mass` / `H_CG` / `L_CG` / 前轮重量分配 | **称重 + 抬轴法** → 用 app 的重心计算器（Chassis Setup 页最下方） |
| `Fork_Stroke` / `Shock_Stroke` | 查规格表，或压到底量 |
| `C_f_aero` / `C_r_aero` | 气动分配，风洞或经验值 |
| 弹簧刚度 / 预载 / 油位 | 拆开量，或看避震铭牌 |

这些留空是**对的** —— 数据表里会显示 `Need: …`，不要拿默认值填进去。

---

## 7. 导进 app

`out/motospec_catalog.json` 里有两段，`chassis` 和 `linkages`。任选一种：

- **手工**：打开 app 的**部件库**页面，在 chassis / linkages 里新建条目，把
  `specs` 里的值抄进去
- **直接合并**：把两段分别并进仓库的 `data/chassis.json` 和 `data/linkages.json`

然后在**数据表**里新建一列，chassis 选你的新条目、linkage 选对应的，
Rake / Trail / 轴距 / 摇臂角 / Motion Ratio / Progression 立刻就出来了。

---

## 8. 出问题查这里

| 症状 | 多半是 |
|---|---|
| 整个坐标系上下颠倒，rake 差一大截 | `steering_head` 扫的位置**不在前轴上方** —— 脚本靠它判断哪边朝上，必须扫真正的头管 |
| `arc_span_deg` 过不了 | 圆周覆盖不够 → 换角度补扫，或改用穿杆法 |
| `rms` 大 / 表面一层"毛" | 配准漂移 → 标记点太少/共线/贴在了曲面上；或没喷显像剂 |
| 左右轴不共线 | 配准漂了，或左右框错了件 |
| 对称面 rms 大 | 某一对左右特征配错；或车架真的歪了（撞过） |
| trail 自检差很多 | rake、offset、轮胎半径三者之一错了。先怀疑轮胎半径填了标称值 |
| Motion Ratio 还是空 | 连杆 4 个点没凑齐，或 `--mode` 选错导致拉杆那端取错件 |
| 轴距整体偏几个毫米 | 没做 `scale_check`，扫描尺度有系统偏差 |

---

## 附：这个目录里有什么

| 文件 | 来源 | 说明 |
|---|---|---|
| `chassis_geom.py` | 外部提供 | 拟合内核：圆柱/球/平面拟合、聚类去杂、对称面、转向几何 |
| `batch_fit.py` | 外部提供 | 批量驱动：扫目录 → 拟合 → 建车辆坐标系 → 出硬点 |
| `config.example.json` | 外部提供 | 配置样例 |
| `SCAN_WORKFLOW.md` | 外部提供 | 原始工作流笔记（原理与注意事项，比本文更细的背景） |
| `synth_scan.py` | 本项目 | **合成数据生成器**，用已知真值验证整条管线 |
| `motospec_export.py` | 本项目 | **对接层**：硬点 → 本项目的字段名 + 自检 |
| `.venv/` | — | Python 环境（不入库） |
| `demo/`、`out/` | — | 生成物（不入库） |

外部脚本的数值路径没有改动过，只在 `synth_scan.py` 里独立验证了它。
