"""Solve a steered wheel: alternate {plane normal from annulus PCA} <-> {centre by radial sharpness}."""
import sys, numpy as np
rng = np.random.default_rng(4)

def sharp(R2, c, rmax=400.0, bw=2.0):
    r = np.hypot(*(R2 - c).T); r = r[r < rmax]
    h = np.bincount((r/bw).astype(np.int32), minlength=int(rmax/bw)).astype(float)
    h /= max(h.sum(), 1)
    return float((h**2).sum())

def centre2d(R2, c0, span, step, nsub=16000):
    S = R2 if len(R2) <= nsub else R2[rng.choice(len(R2), nsub, replace=False)]
    g = np.arange(-span, span+1e-9, step)
    best, bc = -1, c0
    for dx in g:
        for dz in g:
            c = c0 + np.array([dx, dz])
            s = sharp(S, c)
            if s > best: best, bc = s, c
    return bc, best

def basis(n):
    n = n/np.linalg.norm(n)
    a = np.array([1.0,0,0]) if abs(n[0]) < .9 else np.array([0,0,1.0])
    e1 = np.cross(n, a); e1 /= np.linalg.norm(e1)
    return np.c_[e1, np.cross(n, e1)], n

X = np.load(sys.argv[1])

def solve(name, c30, rlo, rhi, iters=6):
    d = X - c30
    sel = X[(np.linalg.norm(d[:,[0,2]], axis=1) < 430) & (np.abs(X[:,1]) < 130)]
    n = np.array([0.0, 1.0, 0.0]); c3 = c30.copy()
    for it in range(iters):
        B, n = basis(n)
        R2 = (sel - c3) @ B
        span, step = (60, 3.0) if it == 0 else (6, 0.5)
        c2, s = centre2d(R2, np.array([0.0, 0.0]), span, step)
        c3 = c3 + B @ c2
        # re-estimate the wheel plane from a mid-radius annulus (rim + spokes + disc)
        q = sel - c3
        ax = q @ n; rad = np.linalg.norm(q - ax[:,None]*n, axis=1)
        A = q[(rad > rlo) & (rad < rhi) & (np.abs(ax) < 90)]
        if len(A) > 500:
            w, v = np.linalg.eigh((A - A.mean(0)).T @ (A - A.mean(0))/len(A))
            nn = v[:,0]
            if nn @ n < 0: nn = -nn
            n = nn
        print(f"   it{it}  centre ({c3[0]:8.2f},{c3[1]:7.2f},{c3[2]:8.2f})  "
              f"axle dir {np.round(n,4)}  sharp {s:.5f}  annulus {len(A)}")
    return c3, n, sel

for name, c30, rlo, rhi in [("FRONT (steered)", np.array([1.0, 0.0, 197.0]), 80, 200),
                            ("REAR",            np.array([1405.5, 0.0, 283.0]), 80, 200)]:
    print(f"=== {name} ===")
    c3, n, sel = solve(name, c30, rlo, rhi)
    B, n = basis(n)
    R2 = (sel - c3) @ B
    r = np.hypot(*R2.T); ang = np.degrees(np.arctan2(*R2.T[::-1]))
    h, e = np.histogram(r, bins=np.arange(0, 401, 2))
    print("   radii with >=300° coverage:")
    for i in np.argsort(-h)[:40]:
        band = (r >= e[i]) & (r < e[i]+2)
        arc = np.unique((ang[band]//5).astype(int)).size*5
        if arc >= 300 and h[i] > 350:
            print(f"      r {e[i]:6.1f}  n {h[i]:5d}  arc {arc:3d}°")
    print(f"   steer/camber of this wheel vs the bike's Y axis: "
          f"{np.degrees(np.arccos(min(1,abs(n[1])))):.2f}°\n")
