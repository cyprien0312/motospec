"""
chassis_geom.py
================
从扫描点云中提取摩托车底盘硬点 (hardpoints) 的几何拟合工具。

设计原则
--------
1. 核心数学只依赖 numpy + scipy,可以直接吃 (N,3) 数组。
   open3d 只用于文件 IO / 可视化 / 法向量估计,是可选依赖。
2. 不拟合"点",拟合"轴线"和"平面",最后用相交求点。
3. 每个拟合都返回 residual 统计,方便你判断这块数据能不能信。

典型流程
--------
    cloud = load_cloud("frame.ply")
    seg   = crop_sphere(cloud, seed=[123, 45, 678], radius=40)
    fl    = fit_cylinder(seg)                      # 左前叉轴承孔
    ...
    sym   = symmetry_plane_from_pairs([(fl.point, fr.point), ...])
    front = fl.merge(fr).intersect_plane(sym)      # 前轮轴中心

作者备注: 单位统一用 mm。
"""

from __future__ import annotations

import dataclasses
import json
from typing import Iterable, Sequence

import numpy as np
from scipy.optimize import least_squares
from scipy.spatial import cKDTree

__all__ = [
    "Axis", "Plane", "CylinderFit", "SphereFit", "PlaneFit",
    "load_cloud", "save_cloud",
    "crop_box", "crop_sphere", "cluster_dbscan", "estimate_normals",
    "fit_cylinder", "fit_sphere", "fit_plane",
    "symmetry_plane_from_pairs", "mirror_points",
    "hidden_point_from_rod", "steering_geometry",
    "HardpointSet",
]


# --------------------------------------------------------------------------
# 基础几何类型
# --------------------------------------------------------------------------

def _unit(v: np.ndarray) -> np.ndarray:
    v = np.asarray(v, dtype=float)
    n = np.linalg.norm(v)
    if n < 1e-12:
        raise ValueError("零向量无法归一化")
    return v / n


@dataclasses.dataclass
class Axis:
    """一条无限长直线: point + t * direction"""
    point: np.ndarray          # 轴线上任意一点
    direction: np.ndarray      # 单位方向向量
    radius: float | None = None
    rms: float | None = None
    n_points: int | None = None
    label: str = ""

    def __post_init__(self):
        self.point = np.asarray(self.point, dtype=float)
        self.direction = _unit(self.direction)

    def angle_to(self, other: "Axis | np.ndarray") -> float:
        """两轴夹角 (度),0~90"""
        d = other.direction if isinstance(other, Axis) else _unit(other)
        c = abs(float(np.dot(self.direction, d)))
        return float(np.degrees(np.arccos(np.clip(c, -1.0, 1.0))))

    def distance_to_point(self, p: np.ndarray) -> float:
        p = np.asarray(p, dtype=float)
        v = p - self.point
        return float(np.linalg.norm(v - np.dot(v, self.direction) * self.direction))

    def project_point(self, p: np.ndarray) -> np.ndarray:
        """把点垂直投影到轴线上"""
        p = np.asarray(p, dtype=float)
        return self.point + np.dot(p - self.point, self.direction) * self.direction

    def point_at(self, t: float) -> np.ndarray:
        return self.point + t * self.direction

    def intersect_plane(self, plane: "Plane") -> np.ndarray:
        """轴线与平面的交点。近平行时抛异常。"""
        denom = float(np.dot(self.direction, plane.normal))
        if abs(denom) < 1e-6:
            raise ValueError(
                f"轴线 '{self.label}' 与平面近乎平行 (cos={denom:.2e}),交点不可靠"
            )
        t = float(np.dot(plane.point - self.point, plane.normal)) / denom
        return self.point_at(t)

    def closest_points(self, other: "Axis") -> tuple[np.ndarray, np.ndarray, float]:
        """两条异面直线的最近点对,以及最短距离。用来自检左右是否共线。"""
        d1, d2 = self.direction, other.direction
        r = self.point - other.point
        a, b, c = np.dot(d1, d1), np.dot(d1, d2), np.dot(d2, d2)
        d, e = np.dot(d1, r), np.dot(d2, r)
        denom = a * c - b * b
        if abs(denom) < 1e-9:                      # 平行
            t1 = 0.0
            t2 = e / c
        else:
            t1 = (b * e - c * d) / denom
            t2 = (a * e - b * d) / denom
        p1, p2 = self.point_at(t1), other.point_at(t2)
        return p1, p2, float(np.linalg.norm(p1 - p2))

    def merge(self, other: "Axis", label: str = "") -> "Axis":
        """
        合并左右两侧同一条轴 (例如左右前叉轴承孔)。
        方向取加权平均,位置取两条轴最近点对的中点。
        会打印共线性自检。
        """
        d2 = other.direction if np.dot(self.direction, other.direction) > 0 else -other.direction
        w1 = self.n_points or 1
        w2 = other.n_points or 1
        direction = _unit(w1 * self.direction + w2 * d2)
        p1, p2, gap = self.closest_points(other)
        merged = Axis(
            point=(p1 + p2) / 2.0,
            direction=direction,
            radius=np.mean([r for r in (self.radius, other.radius) if r is not None])
            if (self.radius or other.radius) else None,
            rms=float(np.hypot(self.rms or 0.0, other.rms or 0.0)),
            n_points=w1 + w2,
            label=label or f"{self.label}+{other.label}",
        )
        merged.merge_report = {          # type: ignore[attr-defined]
            "angle_deg": self.angle_to(other),
            "offset_mm": gap,
        }
        return merged

    def to_dict(self) -> dict:
        return {
            "label": self.label,
            "point": self.point.tolist(),
            "direction": self.direction.tolist(),
            "radius": self.radius,
            "rms": self.rms,
            "n_points": self.n_points,
        }


@dataclasses.dataclass
class Plane:
    point: np.ndarray
    normal: np.ndarray
    rms: float | None = None
    label: str = ""

    def __post_init__(self):
        self.point = np.asarray(self.point, dtype=float)
        self.normal = _unit(self.normal)

    def signed_distance(self, p: np.ndarray) -> np.ndarray:
        p = np.atleast_2d(np.asarray(p, dtype=float))
        return (p - self.point) @ self.normal

    def project_point(self, p: np.ndarray) -> np.ndarray:
        p = np.asarray(p, dtype=float)
        return p - float(np.dot(p - self.point, self.normal)) * self.normal

    def to_dict(self) -> dict:
        return {
            "label": self.label,
            "point": self.point.tolist(),
            "normal": self.normal.tolist(),
            "rms": self.rms,
        }


@dataclasses.dataclass
class CylinderFit:
    axis: Axis
    radius: float
    rms: float
    max_error: float
    n_points: int
    n_inliers: int
    arc_span_deg: float          # 关键: 覆盖的圆周角度,<120° 结果就不能全信

    @property
    def trustworthy(self) -> bool:
        return self.arc_span_deg >= 120.0 and self.rms < 0.25 and self.n_inliers >= 200

    def report(self) -> str:
        flag = "OK " if self.trustworthy else "!! "
        return (
            f"{flag}{self.axis.label or 'cylinder'}: r={self.radius:.3f}mm  "
            f"rms={self.rms:.3f}mm  max={self.max_error:.3f}mm  "
            f"arc={self.arc_span_deg:.0f}deg  inliers={self.n_inliers}/{self.n_points}"
        )


@dataclasses.dataclass
class SphereFit:
    center: np.ndarray
    radius: float
    rms: float
    n_points: int
    label: str = ""

    def report(self) -> str:
        return (f"{self.label or 'sphere'}: r={self.radius:.3f}mm "
                f"rms={self.rms:.4f}mm n={self.n_points}")


@dataclasses.dataclass
class PlaneFit:
    plane: Plane
    rms: float
    n_points: int

    def report(self) -> str:
        return f"{self.plane.label or 'plane'}: rms={self.rms:.3f}mm n={self.n_points}"


# --------------------------------------------------------------------------
# IO / 分割 (open3d 为可选依赖)
# --------------------------------------------------------------------------

def _require_o3d():
    try:
        import open3d as o3d  # noqa: F401
        return o3d
    except ImportError as exc:                       # pragma: no cover
        raise ImportError(
            "这一步需要 open3d。安装: pip install open3d\n"
            "（核心拟合函数不需要 open3d,可以直接传 (N,3) numpy 数组）"
        ) from exc


def load_cloud(path: str) -> np.ndarray:
    """
    读 .ply/.pcd/.obj/.stl 等,返回 (N,3) 数组。
    .xyz/.asc/.txt/.csv 这类纯文本走 numpy,不需要 open3d
    （CloudCompare 的 ASCII 导出就是这个格式,只取前三列）。
    """
    if path.lower().endswith((".xyz", ".asc", ".txt", ".csv", ".pts")):
        delim = "," if path.lower().endswith(".csv") else None
        arr = np.loadtxt(path, delimiter=delim, comments=("#", "/", "x", "X"),
                         ndmin=2)
        if arr.shape[1] < 3:
            raise ValueError(f"{path} 少于 3 列,不像点云")
        return np.ascontiguousarray(arr[:, :3], dtype=float)

    o3d = _require_o3d()
    if path.lower().endswith((".stl", ".obj", ".off")):
        mesh = o3d.io.read_triangle_mesh(path)
        return np.asarray(mesh.vertices, dtype=float)
    pcd = o3d.io.read_point_cloud(path)
    pts = np.asarray(pcd.points, dtype=float)
    if pts.size == 0:
        raise ValueError(f"{path} 读出来是空的,检查文件格式")
    return pts


def save_cloud(points: np.ndarray, path: str) -> None:
    o3d = _require_o3d()
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(np.asarray(points, dtype=float))
    o3d.io.write_point_cloud(path, pcd)


def crop_box(points: np.ndarray, lo: Sequence[float], hi: Sequence[float]) -> np.ndarray:
    """轴对齐包围盒裁剪。"""
    p = np.asarray(points, dtype=float)
    lo, hi = np.asarray(lo, dtype=float), np.asarray(hi, dtype=float)
    m = np.all((p >= lo) & (p <= hi), axis=1)
    return p[m]


def crop_sphere(points: np.ndarray, seed: Sequence[float], radius: float) -> np.ndarray:
    """以手点的种子点为中心球形取点 —— 抠单个特征最顺手的方式。"""
    p = np.asarray(points, dtype=float)
    tree = cKDTree(p)
    idx = tree.query_ball_point(np.asarray(seed, dtype=float), radius)
    if not idx:
        raise ValueError(f"半径 {radius}mm 内没有点,检查 seed 坐标和单位")
    return p[np.asarray(idx)]


def auto_eps(points: np.ndarray, k: int = 6, factor: float = 3.0) -> float:
    """
    按点云自身密度估计聚类半径:取第 k 近邻距离的中位数 × factor。
    扫描分辨率差别很大,写死 eps 几乎一定错 —— 所以默认都用这个。
    """
    p = np.asarray(points, dtype=float)
    k = min(k, len(p) - 1)
    if k < 1:
        return 1.0
    d, _ = cKDTree(p).query(p, k=k + 1)
    return float(np.median(d[:, -1]) * factor)


def cluster_dbscan(points: np.ndarray, eps: float | None = None,
                   min_points: int | None = None) -> np.ndarray:
    """
    密度聚类,把粗切出来的一坨拆成几个连通块 (轴承孔 vs 旁边的支架)。
    eps=None 时按点云密度自动取 (见 auto_eps),min_points=None 时按 eps 内的
    期望邻居数自动取。返回每点的 label,-1 为噪声。纯 scipy,不需要 sklearn。
    """
    p = np.asarray(points, dtype=float)
    if eps is None:
        eps = auto_eps(p)
    tree = cKDTree(p)
    neighbours = tree.query_ball_tree(tree, eps)
    if min_points is None:
        counts = np.array([len(n) for n in neighbours])
        # 取中位邻居数的 1/4 作门槛,至少 4 —— 对密度自适应
        min_points = max(4, int(np.median(counts) * 0.25))
    labels = np.full(len(p), -1, dtype=int)
    core = np.array([len(n) >= min_points for n in neighbours])
    cid = 0
    for i in range(len(p)):
        if labels[i] != -1 or not core[i]:
            continue
        stack, labels[i] = [i], cid
        while stack:
            j = stack.pop()
            if not core[j]:
                continue
            for k in neighbours[j]:
                if labels[k] == -1:
                    labels[k] = cid
                    stack.append(k)
        cid += 1
    return labels


def largest_cluster(points: np.ndarray, eps: float | None = None,
                    min_points: int | None = None,
                    min_keep_fraction: float = 0.35) -> np.ndarray:
    """
    只保留最大的连通簇。如果最大簇还不到总点数的 min_keep_fraction,
    说明聚类参数不对(或这块本来就是连通的),原样返回,不做破坏性丢弃。
    """
    p = np.asarray(points, dtype=float)
    labels = cluster_dbscan(p, eps, min_points)
    valid = labels[labels >= 0]
    if valid.size == 0:
        return p
    best = np.bincount(valid).argmax()
    keep = p[labels == best]
    if len(keep) < min_keep_fraction * len(p):
        return p
    return keep


def estimate_normals(points: np.ndarray, k: int = 40) -> np.ndarray:
    """
    kNN + PCA 估计法向量。方向未定向(±),但圆柱轴线拟合不在乎符号。
    """
    p = np.asarray(points, dtype=float)
    tree = cKDTree(p)
    _, idx = tree.query(p, k=min(k, len(p)))
    nbrs = p[idx]                                   # (N,k,3)
    nbrs = nbrs - nbrs.mean(axis=1, keepdims=True)
    cov = np.einsum("nki,nkj->nij", nbrs, nbrs) / nbrs.shape[1]
    _, vecs = np.linalg.eigh(cov)
    return vecs[:, :, 0]                            # 最小特征值对应方向


# --------------------------------------------------------------------------
# 拟合
# --------------------------------------------------------------------------

def _cylinder_residuals(params: np.ndarray, pts: np.ndarray,
                        e1: np.ndarray, e2: np.ndarray,
                        base: np.ndarray) -> np.ndarray:
    """
    5 自由度参数化:方向用两个小角度偏置 (a,b),位置用平面内 (u,v),半径 r。
    这样避免了轴向的规范冗余,收敛稳定。
    """
    a, b, u, v, r = params
    axis = _unit(np.cross(e1, e2) + a * e1 + b * e2)
    pt = base + u * e1 + v * e2
    d = pts - pt
    perp = d - np.outer(d @ axis, axis)
    return np.linalg.norm(perp, axis=1) - r


def fit_cylinder(points: np.ndarray, normals: np.ndarray | None = None,
                 label: str = "", robust_iters: int = 3,
                 inlier_sigma: float = 2.5) -> CylinderFit:
    """
    拟合圆柱,返回轴线 + 半径 + 质量指标。

    步骤: 法向量 PCA 求初始轴向 -> 投影到 2D 做 Kasa 线性圆拟合 ->
          非线性 5-DoF 精修 -> 按残差 trimming 迭代重拟合。

    points  : (N,3),已经粗分割过的圆柱表面点
    normals : 可选,不给就自己算
    """
    pts = np.asarray(points, dtype=float)
    if len(pts) < 30:
        raise ValueError(f"只有 {len(pts)} 个点,太少了,至少要几百个")

    if normals is None:
        normals = estimate_normals(pts)
    N = np.asarray(normals, dtype=float)
    N = N / np.linalg.norm(N, axis=1, keepdims=True)

    # 1) 理想圆柱面法向量都垂直于轴线 -> 法向量集合的最小奇异方向即轴向
    _, _, Vt = np.linalg.svd(N - N.mean(axis=0), full_matrices=False)
    axis0 = _unit(Vt[-1])

    active = np.ones(len(pts), dtype=bool)
    result = None

    for _ in range(max(1, robust_iters)):
        P = pts[active]
        # 2) 建立垂直于轴的正交基,投影成 2D
        tmp = np.array([1.0, 0.0, 0.0])
        if abs(np.dot(tmp, axis0)) > 0.9:
            tmp = np.array([0.0, 1.0, 0.0])
        e1 = _unit(np.cross(axis0, tmp))
        e2 = _unit(np.cross(axis0, e1))
        base = P.mean(axis=0)
        uv = np.c_[(P - base) @ e1, (P - base) @ e2]

        # 3) Kasa 线性圆拟合作为初值
        A = np.c_[2 * uv, np.ones(len(uv))]
        rhs = (uv ** 2).sum(axis=1)
        sol, *_ = np.linalg.lstsq(A, rhs, rcond=None)
        cu, cv, cc = sol
        r0 = float(np.sqrt(max(cc + cu ** 2 + cv ** 2, 1e-9)))

        # 4) 非线性精修
        opt = least_squares(
            _cylinder_residuals, x0=[0.0, 0.0, cu, cv, r0],
            args=(P, e1, e2, base), method="lm", max_nfev=2000,
        )
        a, b, u, v, r = opt.x
        axis_dir = _unit(np.cross(e1, e2) + a * e1 + b * e2)
        axis_pt = base + u * e1 + v * e2

        # 5) 全量残差 -> trimming
        d = pts - axis_pt
        perp = d - np.outer(d @ axis_dir, axis_dir)
        resid = np.linalg.norm(perp, axis=1) - r
        sigma = 1.4826 * np.median(np.abs(resid - np.median(resid)))
        active = np.abs(resid) <= max(inlier_sigma * sigma, 0.05)
        axis0 = axis_dir
        result = (axis_dir, axis_pt, r, resid)

    axis_dir, axis_pt, r, resid = result           # type: ignore[misc]

    # 圆周覆盖角 —— 判断这块数据够不够
    tmp = np.array([1.0, 0.0, 0.0])
    if abs(np.dot(tmp, axis_dir)) > 0.9:
        tmp = np.array([0.0, 1.0, 0.0])
    e1 = _unit(np.cross(axis_dir, tmp))
    e2 = _unit(np.cross(axis_dir, e1))
    d = pts[active] - axis_pt
    ang = np.sort(np.arctan2(d @ e2, d @ e1))
    gaps = np.diff(np.r_[ang, ang[0] + 2 * np.pi])
    arc_span = float(np.degrees(2 * np.pi - gaps.max()))

    return CylinderFit(
        axis=Axis(axis_pt, axis_dir, radius=float(r),
                  rms=float(np.sqrt(np.mean(resid[active] ** 2))),
                  n_points=int(active.sum()), label=label),
        radius=float(r),
        rms=float(np.sqrt(np.mean(resid[active] ** 2))),
        max_error=float(np.abs(resid[active]).max()),
        n_points=len(pts),
        n_inliers=int(active.sum()),
        arc_span_deg=arc_span,
    )


def fit_sphere(points: np.ndarray, label: str = "") -> SphereFit:
    """
    球拟合。用于扫描标靶球 / 螺栓上的球头适配器 —— 隐藏点的关键工具。
    线性解 (Kasa) 后接非线性精修。
    """
    p = np.asarray(points, dtype=float)
    if len(p) < 10:
        raise ValueError("点太少")
    A = np.c_[2 * p, np.ones(len(p))]
    rhs = (p ** 2).sum(axis=1)
    sol, *_ = np.linalg.lstsq(A, rhs, rcond=None)
    c0 = sol[:3]
    r0 = float(np.sqrt(max(sol[3] + c0 @ c0, 1e-9)))

    def res(x):
        return np.linalg.norm(p - x[:3], axis=1) - x[3]

    opt = least_squares(res, x0=np.r_[c0, r0], method="lm", max_nfev=2000)
    return SphereFit(center=opt.x[:3], radius=float(opt.x[3]),
                     rms=float(np.sqrt(np.mean(res(opt.x) ** 2))),
                     n_points=len(p), label=label)


def fit_plane(points: np.ndarray, label: str = "") -> PlaneFit:
    """最小二乘平面 (PCA)。"""
    p = np.asarray(points, dtype=float)
    c = p.mean(axis=0)
    _, _, Vt = np.linalg.svd(p - c, full_matrices=False)
    n = _unit(Vt[-1])
    rms = float(np.sqrt(np.mean(((p - c) @ n) ** 2)))
    return PlaneFit(plane=Plane(c, n, rms=rms, label=label), rms=rms, n_points=len(p))


# --------------------------------------------------------------------------
# 对称面
# --------------------------------------------------------------------------

def symmetry_plane_from_pairs(pairs: Iterable[tuple[np.ndarray, np.ndarray]],
                              label: str = "symmetry") -> Plane:
    """
    从左右成对特征求车辆对称面。

    pairs: [(左点, 右点), ...] —— 至少 3 对,且不能共线。
           例如: (左前叉轴承孔中心, 右前叉轴承孔中心)、
                 (左摇臂支点, 右摇臂支点)、
                 (左脚踏支架孔, 右脚踏支架孔)

    法向量 = 各对连线方向的主方向;过点 = 各对中点的质心。
    并把中点到平面的残差作为质量指标 —— 残差大说明某一对配错了。
    """
    pairs = [(np.asarray(a, float), np.asarray(b, float)) for a, b in pairs]
    if len(pairs) < 2:
        raise ValueError("至少需要 2 对特征,3 对以上才稳")

    diffs = np.array([b - a for a, b in pairs])
    diffs = diffs / np.linalg.norm(diffs, axis=1, keepdims=True)
    diffs = np.array([d if np.dot(d, diffs[0]) > 0 else -d for d in diffs])
    normal = _unit(diffs.mean(axis=0))

    mids = np.array([(a + b) / 2 for a, b in pairs])
    centroid = mids.mean(axis=0)
    rms = float(np.sqrt(np.mean(((mids - centroid) @ normal) ** 2)))
    return Plane(centroid, normal, rms=rms, label=label)


def mirror_points(points: np.ndarray, plane: Plane) -> np.ndarray:
    """关于平面镜像 —— 拿来跟原云做 ICP,可以验证对称面。"""
    p = np.asarray(points, dtype=float)
    return p - 2.0 * np.outer((p - plane.point) @ plane.normal, plane.normal)


# --------------------------------------------------------------------------
# 隐藏点 (被车架挡住的避震锁点)
# --------------------------------------------------------------------------

def hidden_point_from_rod(rod: Axis, reference: np.ndarray,
                          standoff: float) -> np.ndarray:
    """
    穿杆法求隐藏孔中心。

    做法: 往看不见的孔里插一根精磨圆棒,棒的外露段能扫到。
          拟合外露段得到 rod (轴线) —— 这条轴线就是孔的轴线。
          再用卡尺量出"外露端面 -> 孔中心"的距离 standoff,沿轴推进去。

    rod       : fit_cylinder 出来的外露段轴线
    reference : 外露端面上任意一点 (扫描端面拟合平面取中心,或用棒末端球头)
    standoff  : 沿轴线推进的距离 (mm),朝车内为正 —— 符号自己按扫描结果核对
    """
    base = rod.project_point(reference)
    # 方向取指向 reference 相反侧,由调用方用 standoff 正负控制
    return base + standoff * rod.direction


def hidden_point_from_ball_adapter(ball: SphereFit, rod: Axis,
                                   ball_to_hole_center: float) -> np.ndarray:
    """
    球头适配器法: 螺栓拧进隐藏孔,外端是已知半径的精密球。
    扫球心 (球拟合精度可以到 0.02mm),沿螺栓轴线推已知距离即得孔中心。
    比穿杆法更准,因为球心不受扫描覆盖角影响。
    """
    return np.asarray(ball.center, float) + ball_to_hole_center * rod.direction


# --------------------------------------------------------------------------
# 输出底盘几何
# --------------------------------------------------------------------------

def steering_geometry(steering_axis: Axis, front_axle: np.ndarray,
                      rear_axle: np.ndarray, front_tyre_radius: float,
                      rear_tyre_radius: float,
                      up: np.ndarray | None = None,
                      forward: np.ndarray | None = None) -> dict:
    """
    由转向轴线 + 前后轴心 + 轮胎半径算 rake / trail / wheelbase。

    坐标系: 需要给定 up (向上) 和 forward (向前) 单位向量。
            不给的话按 up=+Z、forward 由后轴指向前轴的水平分量推导。

    注意: 这是静态几何,轮胎半径要用实际压载后的滚动半径,不是标称值。
    """
    up = _unit(up) if up is not None else np.array([0.0, 0.0, 1.0])
    front_axle = np.asarray(front_axle, float)
    rear_axle = np.asarray(rear_axle, float)

    if forward is None:
        v = front_axle - rear_axle
        forward = _unit(v - np.dot(v, up) * up)
    else:
        forward = _unit(forward)

    # 地面: 前轮触地点所在的水平面
    ground_z = np.dot(front_axle, up) - front_tyre_radius

    sd = steering_axis.direction
    sd = sd if np.dot(sd, up) > 0 else -sd
    rake = float(np.degrees(np.arccos(np.clip(np.dot(sd, up), -1, 1))))

    # 转向轴延长线与地面的交点
    t = (ground_z - np.dot(steering_axis.point, up)) / np.dot(sd, up)
    steer_ground = steering_axis.point + t * sd
    axle_ground = front_axle - front_tyre_radius * up
    trail = float(np.dot(axle_ground - steer_ground, forward))

    # 前叉偏置 (offset): 前轴心到转向轴的垂距
    offset = steering_axis.distance_to_point(front_axle)

    wb_vec = front_axle - rear_axle
    wheelbase = float(np.linalg.norm(wb_vec - np.dot(wb_vec, up) * up))

    return {
        "rake_deg": rake,
        "trail_mm": trail,
        "offset_mm": float(offset),
        "wheelbase_mm": wheelbase,
        "front_axle_height_mm": float(np.dot(front_axle, up) - ground_z),
        "rear_axle_height_mm": float(np.dot(rear_axle, up) - ground_z),
        "rear_ride_height_note": (
            "后轴心高度与后轮半径的差就是后轮触地点相对地面的误差,"
            "前后轮半径不同就会有摇臂角变化,别忽略"
        ),
    }


# --------------------------------------------------------------------------
# 结果容器
# --------------------------------------------------------------------------

class HardpointSet:
    """收集所有硬点,统一导出 JSON / CSV,方便喂进 Motospec。"""

    def __init__(self, name: str = "chassis"):
        self.name = name
        self.points: dict[str, np.ndarray] = {}
        self.axes: dict[str, Axis] = {}
        self.planes: dict[str, Plane] = {}
        self.notes: list[str] = []

    def add_point(self, key: str, p: np.ndarray, note: str = ""):
        self.points[key] = np.asarray(p, float)
        if note:
            self.notes.append(f"{key}: {note}")
        return self

    def add_axis(self, key: str, a: Axis):
        self.axes[key] = a
        return self

    def add_plane(self, key: str, pl: Plane):
        self.planes[key] = pl
        return self

    def distance(self, a: str, b: str) -> float:
        return float(np.linalg.norm(self.points[a] - self.points[b]))

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "points": {k: v.tolist() for k, v in self.points.items()},
            "axes": {k: v.to_dict() for k, v in self.axes.items()},
            "planes": {k: v.to_dict() for k, v in self.planes.items()},
            "notes": self.notes,
        }

    def save_json(self, path: str) -> None:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)

    def save_csv(self, path: str) -> None:
        with open(path, "w", encoding="utf-8") as f:
            f.write("key,x,y,z\n")
            for k, v in self.points.items():
                f.write(f"{k},{v[0]:.4f},{v[1]:.4f},{v[2]:.4f}\n")
