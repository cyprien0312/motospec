import sys, numpy as np
from scipy.spatial import cKDTree
sys.path.insert(0, "C:/Users/admin0/Documents/claude/motospec/scan")
from chassis_geom import fit_cylinder

X = np.load(sys.argv[1])
AX = np.array([1411.2, 2.40, 294.8])
reg = X[(X[:,0] > AX[0]-340) & (X[:,0] < AX[0]+300) &
        (X[:,2] > AX[2]+100) & (X[:,2] < AX[2]+660) & (np.abs(X[:,1]) < 250)]
tree = cKDTree(reg); _, idx = tree.query(reg, k=18)
nb = reg[idx] - reg[idx].mean(1)[:,None]
N = np.linalg.eigh(np.einsum('nki,nkj->nij', nb, nb)/18)[1][:,:,0]
R = 20.5

def dirn(rake, az):
    t, a = np.radians(rake), np.radians(az)
    return np.array([-np.sin(t)*np.cos(a), np.sin(a), np.cos(t)*np.cos(a)])

def score(rake, az, bin=1.2):
    d = dirn(rake, az)
    e1 = np.cross(d, [0,1.,0]); e1 /= np.linalg.norm(e1)
    B = np.c_[e1, np.cross(d, e1)]
    P2, n2 = reg @ B, N @ B
    nn = np.linalg.norm(n2, axis=1); ok = nn > 0.55
    u = n2[ok]/nn[ok][:,None]
    v = np.r_[P2[ok]-R*u, P2[ok]+R*u]
    lo = v.min(0); g = np.floor((v-lo)/bin).astype(np.int64)
    uq, ct = np.unique(g, axis=0, return_counts=True)
    return ct, uq, lo, B, P2, bin

best = max(((score(r,a)[0].max(), r, a) for r in np.arange(22.0, 31.01, 0.25)
                                        for a in np.arange(-3.0, 3.01, 1.0)))
print(f"best: rake {best[1]:.2f} deg   az {best[2]:+.2f} deg   votes {best[0]}")
rake, az = best[1], best[2]
d = dirn(rake, az)
ct, uq, lo, B, P2, bin = score(rake, az)
print("\nfork-tube candidates (r = 20.5 mm cylinders parallel to the steering axis):")
picked = []
for i in np.argsort(-ct)[:40]:
    c2 = lo + (uq[i]+0.5)*bin
    if any(np.hypot(*(c2-p)) < 60 for p in picked): continue
    m = np.abs(np.hypot(*(P2-c2).T) - R) < 2.2
    if m.sum() < 200: continue
    q = reg[m]; ax = q @ d
    picked.append(c2)
    print(f"  votes {ct[i]:4d}  inliers {int(m.sum()):5d}  axial length {ax.max()-ax.min():6.1f} mm"
          f"  centroid ({q.mean(0)[0]:7.1f},{q.mean(0)[1]:7.1f},{q.mean(0)[2]:7.1f})")
    if len(picked) >= 6: break

print("\n--- refit each candidate with chassis_geom.fit_cylinder ---")
for c2 in picked[:4]:
    m = np.abs(np.hypot(*(P2-c2).T) - R) < 3.0
    q = reg[m]
    if len(q) < 250: continue
    f = fit_cylinder(q, label="fork?")
    dd = f.axis.direction/np.linalg.norm(f.axis.direction)
    if dd[2] < 0: dd = -dd
    print(f"  {f.report()}")
    print(f"     angle from vertical {np.degrees(np.arctan2(np.hypot(dd[0],dd[1]), dd[2])):.2f} deg"
          f"   out-of-plane {np.degrees(np.arcsin(abs(dd[1]))):.2f} deg"
          f"   centroid {np.round(q.mean(0),1)}")
