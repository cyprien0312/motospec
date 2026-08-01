import sys, numpy as np
sys.path.insert(0, ".")
from chassis_geom import load_cloud
from scipy.spatial import cKDTree

p = load_cloud(sys.argv[1])
print(f"points {len(p):,}\n")

# --- 1. exact / near duplicates ---
rng = np.random.default_rng(0)
s = p[rng.choice(len(p), 60000, replace=False)]
d, _ = cKDTree(p).query(s, k=2)
nn = d[:, 1]
for t in (1e-9, 1e-4, 0.01, 0.05, 0.1, 0.3):
    print(f"  NN < {t:<8g}  {100*np.mean(nn < t):5.1f}%")
uniq = len(np.unique(p, axis=0))
print(f"  unique XYZ rows: {uniq:,} / {len(p):,}  ({100*uniq/len(p):.1f}%)\n")

# --- 2. coarse connected components via voxel flood fill ---
VOX = 15.0
key = np.floor(p / VOX).astype(np.int64)
uk, inv = np.unique(key, axis=0, return_inverse=True)
kd = cKDTree(uk.astype(float))
pairs = kd.query_pairs(r=1.9, output_type='ndarray')   # 26-neighbourhood

parent = np.arange(len(uk))
def find(a):
    while parent[a] != a:
        parent[a] = parent[parent[a]]; a = parent[a]
    return a
for a, b in pairs:
    ra, rb = find(a), find(b)
    if ra != rb: parent[ra] = rb
roots = np.array([find(i) for i in range(len(uk))])

lab = roots[inv]
ids, counts = np.unique(lab, return_counts=True)
order = np.argsort(-counts)
print(f"connected components (15mm voxel grid): {len(ids)}")
print(f"{'#':>3} {'points':>10} {'%':>6}   bbox ext (mm)          centroid")
for r, i in enumerate(order[:12]):
    m = lab == ids[i]
    q = p[m]; ext = q.max(0) - q.min(0)
    print(f"{r:>3} {counts[i]:>10,} {100*counts[i]/len(p):5.1f}%   "
          f"{ext[0]:6.0f} {ext[1]:6.0f} {ext[2]:6.0f}   "
          f"{q.mean(0)[0]:7.0f} {q.mean(0)[1]:7.0f} {q.mean(0)[2]:7.0f}")
tail = counts[order[12:]].sum() if len(order) > 12 else 0
if tail: print(f"    ... {len(order)-12} more, {tail:,} pts ({100*tail/len(p):.1f}%)")
