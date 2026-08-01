"""Load -> dedupe -> keep main component -> median-plane (PCA) frame. Shared by later steps."""
import numpy as np, sys
sys.path.insert(0, "C:/Users/admin0/Documents/claude/motospec/scan")
from chassis_geom import load_cloud
from scipy.spatial import cKDTree

def main_component(p, vox=15.0):
    key = np.floor(p / vox).astype(np.int64)
    uk, inv = np.unique(key, axis=0, return_inverse=True)
    pr = np.arange(len(uk))
    def find(a):
        while pr[a] != a: pr[a] = pr[pr[a]]; a = pr[a]
        return a
    for a, b in cKDTree(uk.astype(float)).query_pairs(r=1.9, output_type='ndarray'):
        ra, rb = find(a), find(b)
        if ra != rb: pr[ra] = rb
    lab = np.array([find(i) for i in range(len(uk))])[inv]
    ids, cnt = np.unique(lab, return_counts=True)
    return p[lab == ids[np.argmax(cnt)]]

def prep(path):
    p = np.unique(load_cloud(path), axis=0)
    p = main_component(p)
    c = p.mean(0); q = p - c
    w, v = np.linalg.eigh(q.T @ q / len(q))
    e1, e2, n = v[:, 2], v[:, 1], v[:, 0]
    R = np.c_[e1, e2, n]                 # scanner -> view frame
    return p, c, R, (q @ R)              # points, centroid, rotation, view coords
