import sys, numpy as np
X = np.load(sys.argv[1])
rng = np.random.default_rng(11)

def circum(a, b, c):
    (ax,ay),(bx,by),(cx,cy) = a,b,c
    d = 2*(ax*(by-cy)+bx*(cy-ay)+cx*(ay-by))
    if abs(d) < 1e-9: return None
    ux = ((ax*ax+ay*ay)*(by-cy)+(bx*bx+by*by)*(cy-ay)+(cx*cx+cy*cy)*(ay-by))/d
    uy = ((ax*ax+ay*ay)*(cx-bx)+(bx*bx+by*by)*(ax-cx)+(cx*cx+cy*cy)*(bx-ax))/d
    return np.array([ux,uy]), np.hypot(ax-ux, ay-uy)

def refine(pts, c, rad, tol):
    for _ in range(15):
        d = np.abs(np.hypot(*(pts-c).T) - rad); m = d < tol
        if m.sum() < 50: break
        q = pts[m]; A = np.c_[2*q, np.ones(len(q))]
        s,*_ = np.linalg.lstsq(A, (q**2).sum(1), rcond=None)
        c = s[:2]; rad = np.sqrt(s[2] + c@c)
    d = np.abs(np.hypot(*(pts-c).T) - rad); m = d < tol
    a = np.degrees(np.arctan2(*(pts[m]-c).T[::-1]))
    arc = np.unique((a//5).astype(int)).size * 5
    return c, rad, int(m.sum()), float(np.sqrt((d[m]**2).mean())), arc

def top_circles(pts, k=6, tol=2.0, iters=60000, rlo=90, rhi=380):
    found, used = [], np.zeros(len(pts), bool)
    for _ in range(k):
        best = (0, None, None)
        for _ in range(iters):
            i,j,l = rng.integers(0, len(pts), 3)
            r = circum(pts[i], pts[j], pts[l])
            if r is None: continue
            c, rad = r
            if not (rlo <= rad <= rhi): continue
            d = np.abs(np.hypot(*(pts-c).T) - rad)
            cnt = int(((d < tol) & ~used).sum())
            if cnt > best[0]: best = (cnt, c, rad)
        if best[1] is None or best[0] < 200: break
        c, rad, n, rms, arc = refine(pts, best[1], best[2], tol)
        d = np.abs(np.hypot(*(pts-c).T) - rad)
        used |= d < tol*1.8
        found.append((c, rad, n, rms, arc))
    return found

for name, cx, cz in [("FRONT", 1398.4, 297.7), ("REAR", 0.0, 316.7)]:
    d = X - np.array([cx, 0.0, cz])
    m = (np.abs(d[:,1]) < 90) & (np.hypot(d[:,0], d[:,2]) < 400)
    pts = X[m][:, [0,2]]
    if len(pts) > 45000: pts = pts[rng.choice(len(pts), 45000, replace=False)]
    print(f"=== {name} wheel region — {len(pts):,} pts, strongest concentric circles ===")
    print(f"{'radius':>8} {'centre X':>10} {'centre Z':>10} {'pts':>7} {'rms':>6} {'arc':>6}")
    for c, rad, n, rms, arc in top_circles(pts):
        print(f"{rad:8.2f} {c[0]:10.2f} {c[1]:10.2f} {n:7d} {rms:6.2f} {arc:5d}°")
    print()
