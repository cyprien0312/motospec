"""Axle centre = the point that makes the wheel's radial histogram sharpest."""
import sys, numpy as np
rng = np.random.default_rng(2)

def sharpness(P2, c, rmax=400.0, bw=2.0):
    d = P2 - c
    r = np.hypot(d[:,0], d[:,1])
    r = r[r < rmax]
    h = np.bincount((r/bw).astype(np.int32), minlength=int(rmax/bw)).astype(float)
    h /= h.sum()
    return float((h**2).sum())          # concentration: high when peaks align

def locate(P2, c0, coarse=100, cstep=4.0, fine=6, fstep=0.5, nsub=14000):
    S = P2[rng.choice(len(P2), min(nsub, len(P2)), replace=False)]
    best, bc = -1, c0
    g = np.arange(-coarse, coarse+1e-9, cstep)
    for dx in g:
        for dz in g:
            c = c0 + np.array([dx, dz])
            s = sharpness(S, c)
            if s > best: best, bc = s, c
    g = np.arange(-fine, fine+1e-9, fstep)
    best2, bc2 = -1, bc
    for dx in g:
        for dz in g:
            c = bc + np.array([dx, dz])
            s = sharpness(P2, c)
            if s > best2: best2, bc2 = s, c
    return bc2, best2

X = np.load(sys.argv[1])
out = {}
for name, cx, cz in [("wheel_A(X~0)", 0.0, 250.0), ("wheel_B(X~1398)", 1398.0, 290.0)]:
    d = X - np.array([cx, 0.0, cz])
    m = (np.hypot(d[:,0], d[:,2]) < 420) & (np.abs(X[:,1]) < 110)
    P = X[m]; P2 = P[:, [0,2]]
    c, s = locate(P2, np.array([cx, cz]))
    print(f"=== {name} ===  {len(P2):,} pts")
    print(f"  axle centre  X {c[0]:8.2f}   Z {c[1]:8.2f}    sharpness {s:.5f}")
    r = np.hypot(*(P2 - c).T)
    ang = np.degrees(np.arctan2(P2[:,1]-c[1], P2[:,0]-c[0]))
    h, e = np.histogram(r, bins=np.arange(0, 401, 2))
    top = np.argsort(-h)[:14]
    print("  strongest concentric radii (radius / pts / arc):")
    for i in sorted(top):
        band = (r >= e[i]) & (r < e[i]+2)
        arc = np.unique((ang[band]//5).astype(int)).size * 5
        print(f"      r {e[i]:6.1f}   n {h[i]:5d}   arc {arc:3d}°")
    out[name] = c
print(f"\nwheel centre distance  {np.linalg.norm(out['wheel_A(X~0)']-out['wheel_B(X~1398)']):.1f} mm")
print("Yamaha R3 published wheelbase: 1380 mm;  17\" rim bead-seat radius = 215.9 mm")
