import sys, numpy as np
sys.path.insert(0, "C:/Users/admin0/Documents/claude/motospec/scan")
from chassis_geom import load_cloud
from scipy.spatial import cKDTree

for path in sys.argv[1:]:
    p = np.unique(load_cloud(path), axis=0)
    rng = np.random.default_rng(1)
    tree = cKDTree(p)
    d, _ = tree.query(p[rng.choice(len(p), 20000, replace=False)], k=2)
    sp = np.median(d[:,1])
    R = max(6.0, 5*sp)
    seeds = p[rng.choice(len(p), 5000, replace=False)]
    res, npatch, ndense = [], 0, 0
    for s in seeds:
        idx = tree.query_ball_point(s, R)
        if len(idx) < 20: continue
        ndense += 1
        q = p[idx]; c = q.mean(0)
        w, v = np.linalg.eigh((q-c).T @ (q-c) / len(q))
        if w[1] < 3*w[0]: continue
        npatch += 1
        res.append((q - c) @ v[:, 0])
    name = path.replace("\\","/").split("/")[-1]
    print(f"\n=== {name} ===  {len(p):,} unique pts   median NN spacing {sp:.3f} mm   "
          f"patch radius {R:.1f} mm")
    if not res:
        print(f"  no planar patches ({ndense} dense seeds of 5000)"); continue
    r = np.concatenate(res); a = np.abs(r)
    print(f"  {npatch} planar patches / {ndense} dense seeds, {len(r):,} residuals")
    print(f"  shell thickness: sd {r.std():.3f}  p50|r| {np.median(a):.3f}  "
          f"p90|r| {np.percentile(a,90):.3f}  p99|r| {np.percentile(a,99):.3f} mm")
    lim = max(1.0, 3*r.std())
    h, e = np.histogram(r, bins=np.linspace(-lim, lim, 61))
    mid = 0.5*(e[1:]+e[:-1]); peak = h.max()
    ctr = h[len(h)//2-1:len(h)//2+1].mean()
    verdict = "DIP AT ZERO -> DOUBLE SHELL" if ctr < 0.8*peak else "single peak -> single shell"
    print(f"  density at 0 = {ctr/peak:.3f} x peak   >>> {verdict}")
    for m_, c_ in zip(mid, h):
        if c_ > peak*0.06:
            print(f"   {m_:+7.3f} | {'#'*int(50*c_/peak):<50} {c_}")
