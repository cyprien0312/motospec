# 车架扫描 → 硬点坐标 工作流

目标不是做一个漂亮的 CAD 模型,而是拿到 **8~12 个硬点的坐标**。想清楚这一点,
很多"扫得不够好"的焦虑就没了 —— 你不需要完整、光滑、封闭的模型。

---

## 一、软件链(全部免费,够用)

| 环节 | 软件 | 说明 |
|---|---|---|
| 采集 | **Creality Scan** | Otter Lite 自带。关键:必须用 **Marker(标记点)对齐模式** |
| 清理 / 分割 | **CloudCompare** | 免费开源,这是主力工具。手动框选、RANSAC 形状识别、量距离 |
| 备选清理 | MeshLab | 补洞、抽稀,偶尔比 CC 顺手 |
| 拟合 / 计算 | **Python + 本模块** | `chassis_geom.py`,依赖 numpy / scipy(open3d 可选) |

**不需要买 Geomagic Design X / Quicksurface。** 那类软件是为了把扫描件反算成
可编辑 CAD 曲面,你的用途只是取几个坐标,CloudCompare + 脚本完全够。

安装:

```bash
pip install numpy scipy open3d
```

CloudCompare 记得在 Plugin 菜单里启用 **RANSAC Shape Detection (qRANSAC_SD)**。

---

## 二、先解决"扫得糊"

"糊"在结构光扫描里几乎永远是**同一个原因:配准漂移**。同一个表面被扫了好几遍,
但每遍位置差了零点几毫米,叠起来就成了一层"毛"或者双层壳。半径拟合会因此偏大,
轴向会歪。

### 标记点是最大变量

- **数量和间距**:视场内任何时刻要能同时看到 **≥4 个**标记点。车架这种细长件,
  沿主梁每 40~60mm 贴一个。
- **必须随机分布,不能排成直线或规整网格。** 共线的标记点无法解算旋转,
  这是漂移的头号来源。刻意贴得歪七扭八。
- **不要贴在圆弧边缘、倒角、转角上** —— 标记点必须在平坦区域,不然中心识别会跳。
- **往周围环境也贴。** 把车架架在一块板子/桌面上,板子上也贴满标记点。
  这样扫描仪在扫细节时仍然有稳定的全局参考。这一步很多人漏掉,效果最明显。
- **不要贴在你要测的特征上**(轴承孔面、避震座端面),会挖掉数据。

### 表面处理

阳极氧化黑、抛光铝、镀铬件结构光基本扫不到,或者噪声极大。喷一层 **AESUB Blue**
(可挥发显像剂,几小时自己挥发,不用清洗)。便宜替代品是婴儿爽身粉 + 酒精,
但厚度不均,会引入 0.05mm 级误差。

### 其他

- 关掉日光灯和阳光直射,尤其别在有窗的白天扫。
- **分段扫,不要一次扫全车。** 每段扫 20~30 秒就停,单独存。段与段之间靠
  公共标记点在 CloudCompare 里对齐。一次连扫 5 分钟必然漂移。
- 精度档拉到最高(点间距最小),文件大不是问题。
- 保持在软件提示的最佳工作距离,忽近忽远也会引入噪声。

### 自检方法

扫完同一个特征两次(两个独立的 scan),分别拟合圆柱,比较轴线夹角和圆心距离。
如果两次差 >0.1mm / >0.1°,说明配准还不稳,别往下做了。

---

## 三、解决"避震锁点被挡住"

按优先级:

### 1. 拆掉 —— 优先做这个

把避震、连杆、摇臂、发动机全拆了,扫**裸车架**。绝大部分遮挡问题直接消失。
既然是做赛车,车架迟早要拆干净。这比任何技巧都省事。

### 2. 穿杆法(through-rod)

拆不掉的孔:找一根**精磨圆棒**(ground rod / 直线导轨轴,精度 h6 以上),
直径配孔,穿进去,两端各伸出 100~150mm。

- 扫外露段(完整圆柱,360° 可见),用 `fit_cylinder` 拟合
- 拟合出的**轴线就是孔的轴线** —— 精度比直接扫短孔高一个数量级
- 孔中心位置:用卡尺量"外露端面 → 孔中心"的距离,用 `hidden_point_from_rod()`
  沿轴推进去

> 这条对**前后轮轴**同样适用,而且是必须的:一个 20mm 长的轴承孔拟合出来的
> 轴向可能差 0.5°,插根长棒能压到 0.02° 级别。

### 3. 球头适配器法(最准)

螺栓拧进隐藏孔,外端焊/粘一颗**已知直径的精密钢球**(轴承钢球,便宜且圆度极高)。

- 球面拟合精度可以到 0.02mm,而且**不受覆盖角影响** —— 只看到球的 1/3 也能准确定心
- `fit_sphere()` 拿球心,再用 `hidden_point_from_ball_adapter()` 沿螺栓轴推
  已知偏距

这是三坐标测量机上"隐藏点"的标准做法,几十块钱就能自制。

### 4. 混合法:扫 + 卡尺

底盘几何要的是**相对距离**,不是绝对形状。扫描拿到的坐标系里,可见特征之间的
距离用扫描;隐藏特征到某个可见基准的距离用卡尺 / 深度尺量,再在脚本里加进去。
一把好卡尺在 300mm 跨距上能到 ±0.05mm,比一块残缺点云可靠得多。

---

## 四、分割:从整片点云抠出一个特征

### CloudCompare 手动(推荐,一次性任务最快)

1. 拖入 `.ply`
2. 选中点云 → 工具栏 **Segment(剪刀图标)**
3. 画多边形框住目标特征 → 回车确认 → `Segment In`
4. 得到 `.segmented` 子云 → **File > Save** 存成单独的 `.ply`
5. 每个特征存一个文件:`axle_front_L.ply` / `shock_upper.ply` / ...

> 小技巧:先用 **Edit > Colors > Height Ramp** 上色,或按法向量着色,
> 特征边界会清楚很多。

### CloudCompare 半自动

`Plugins > RANSAC Shape Detection` 可以直接在一片点云里找出所有圆柱/平面,
并列出半径和轴向。适合快速摸底,但对噪声敏感,最终数值还是回到脚本里做。

### Python 里做

```python
from chassis_geom import load_cloud, crop_sphere, largest_cluster, fit_cylinder

cloud = load_cloud("frame.ply")
seg   = crop_sphere(cloud, seed=[123.4, 45.6, 678.9], radius=40)  # 种子点从 CC 里点取
seg   = largest_cluster(seg, eps=1.5)      # 甩掉旁边的支架
fit   = fit_cylinder(seg, label="swingarm_pivot_L")
print(fit.report())
```

种子点怎么来:CloudCompare 里用 **Point picking** 工具点一下目标,
状态栏会显示 XYZ,抄下来。

---

## 五、完整脚本骨架

```python
import numpy as np
from chassis_geom import *

hp = HardpointSet("Triumph 765 frame")

# --- 1. 逐个拟合圆柱 ---
fits = {}
for name in ["steering_head", "swingarm_pivot_L", "swingarm_pivot_R",
             "shock_upper", "shock_lower", "axle_front", "axle_rear"]:
    pts = load_cloud(f"segments/{name}.ply")
    f = fit_cylinder(pts, label=name)
    print(f.report())          # 先看质量!arc<120° 或 rms>0.25 就回去重扫
    fits[name] = f

# --- 2. 对称面 ---
sym = symmetry_plane_from_pairs([
    (fits["swingarm_pivot_L"].axis.point, fits["swingarm_pivot_R"].axis.point),
    (footpeg_L_center, footpeg_R_center),
    (engine_mount_L, engine_mount_R),
])
print("对称面残差 rms:", sym.rms)     # >0.3mm 说明有一对配错了
hp.add_plane("symmetry", sym)

# --- 3. 轴线 ∩ 对称面 = 硬点 ---
pivot = fits["swingarm_pivot_L"].axis.merge(fits["swingarm_pivot_R"].axis, "pivot")
print("左右共线自检:", pivot.merge_report)   # angle 应 <0.1°, offset 应 <0.2mm
hp.add_point("swingarm_pivot", pivot.intersect_plane(sym))
hp.add_point("steering_head",  fits["steering_head"].axis.intersect_plane(sym))

# --- 4. 输出几何 ---
geo = steering_geometry(
    steering_axis     = fits["steering_head"].axis,
    front_axle        = hp.points["axle_front"],
    rear_axle         = hp.points["axle_rear"],
    front_tyre_radius = 305.0,      # 实测滚动半径,不是标称值
    rear_tyre_radius  = 312.0,
    up=[0,0,1], forward=[0,1,0],
)
print(geo)

hp.save_json("765_hardpoints.json")
hp.save_csv("765_hardpoints.csv")
```

> 上面是手写脚本的样子。日常用 **`batch_fit.py`** 更省事,见下节。

---

## 五 b、批量跑(推荐)

```bash
# 1. CloudCompare 分割好,每个特征存一个文件到 segments/
#    命名用约定的关键词 + _L/_R:
#      steering_head.ply  swingarm_pivot_L.ply  swingarm_pivot_R.ply
#      axle_front_L.ply   axle_rear_R.ply       shock_upper.ply ...

# 2. 生成配置模板(自动识别类型、自动配对左右)
python batch_fit.py --init segments/ -o config.json

# 3. 编辑 config.json:填轮胎滚动半径、检查 symmetry_pairs、
#    填 scale_check(卡尺量的一段已知距离)

# 4. 跑
python batch_fit.py --run config.json
```

输出到 `out/`:

| 文件 | 内容 |
|---|---|
| `quality_report.txt` | **先看这个** — 每个拟合的 rms/覆盖角、左右共线自检、尺度验证 |
| `hardpoints_bike.csv` | 车辆坐标系下的硬点(原点=后轮触地,+X 前,+Z 上) |
| `motospec_inputs.csv` | 按参数名整理的输入表,缺的项标 MISSING |
| `geometry.json` | 全部结果 + 扫描坐标系→车辆坐标系的变换矩阵 |
| `hardpoints_scanner.csv` | 原始扫描坐标,便于回 CloudCompare 核对 |

脚本会自动:密度自适应聚类去杂点 → 圆柱/球拟合 → 左右轴合并并自检共线 →
求对称面 → 轴线∩对称面得硬点 → 用前后轮实际半径把车姿态校平 → 平移到基准点。

**合成数据验证结果**(已知真值,加 0.04mm 高斯噪声,随机扫描仪姿态):
rake 误差 0.001°,trail 0.03mm,轴距 0.00mm,各硬点位置误差 < 0.015mm。

---

## 六、质量红线

每次拟合都看这几个数,不达标就回去重扫,不要硬算:

| 指标 | 门槛 | 不达标的含义 |
|---|---|---|
| `arc_span_deg` | ≥ 120° | 圆周覆盖不够,圆心和半径都不可信 → 换角度补扫或用穿杆 |
| `rms` | < 0.15mm | 点云噪声或配准漂移 → 喷显像剂 / 加标记点 |
| `n_inliers` | > 500 | 点太少 → 提高扫描分辨率 |
| `merge_report["angle_deg"]` | < 0.1° | 左右轴应共线,不共线说明配准漂了 |
| `merge_report["offset_mm"]` | < 0.2mm | 同上 |
| `symmetry_plane.rms` | < 0.3mm | 某一对左右特征配错,或车架本身歪(撞过?) |

**绝对尺度必须独立验证**:量一根已知长度的标定杆(或用卡尺量车架上某两点),
跟脚本算出来的比。结构光扫描的尺度误差是系统性的,不验证的话轴距可能整体差 0.3%。
