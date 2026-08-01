import sys, numpy as np
from scipy.spatial import cKDTree
sys.path.insert(0, "C:/Users/admin0/Documents/claude/motospec/scan")
from chassis_geom import fit_cylinder

X = np.load(sys.argv[1])
AXF = np.array([1411.2, 2.40, 294.8]); AXR = np.array([0.0, 0.0, 286.7])
reg = X[(X[:,0] > AXF[0]-340) & (X[:,0] < AXF[0]+300) &
        (X[:,2] > AXF[2]+100) & (X[:,2] < AXF[2]+660) & (np.abs(X[:,1]) < 250)]
_, idx = cKDTree(reg).query(reg, k=18)
nb = reg[idx] - reg[idx].mean(1)[:,None]
N = np.linalg.eigh(np.einsum('nki,nkj->nij', nb, nb)/18)[1][:,:,0]

t, a = np.radians(25.5), np.radians(-1.0)
d0 = np.array([-np.sin(t)*np.cos(a), np.sin(a), np.cos(t)*np.cos(a)])
e1 = np.cross(d0, [0,1.,0]); e1 /= np.linalg.norm(e1)
B = np.c_[e1, np.cross(d0, e1)]
P2 = reg @ B
axes = []
for c2 in [None, None]: pass
for seed2 in [np.array([1228.2, 99.8, 684.0]) @ B, np.array([1217.2, -114.0, 682.6]) @ B]:
    m = np.abs(np.hypot(*(P2 - seed2).T) - 21.0) < 3.0
    q = reg[m]
    f = fit_cylinder(q, label="fork tube")
    dd = f.axis.direction/np.linalg.norm(f.axis.direction)
    if dd[2] < 0: dd = -dd
    print(f"  {f.report()}")
    print(f"      dir {np.round(dd,5)}   from vertical "
          f"{np.degrees(np.arctan2(np.hypot(dd[0],dd[1]), dd[2])):.2f} deg"
          f"   centroid {np.round(q.mean(0),1)}")
    axes.append((f.axis.point, dd))

d = axes[0][1] + axes[1][1]; d /= np.linalg.norm(d)
rake = np.degrees(np.arctan2(np.hypot(d[0], d[1]), d[2]))
pts = [p + ((AXF - p) @ dd)*dd for p, dd in axes]
S = 0.5*(pts[0] + pts[1])
print(f"\nfork centres abreast of the axle: {np.round(pts[0],1)}  {np.round(pts[1],1)}")
print(f"separation {np.linalg.norm(pts[0]-pts[1]):.1f} mm   midpoint Y {S[1]:.2f} mm (should be 0)")
print(f"\nSTEERING AXIS  through {np.round(S,2)}   dir {np.round(d,5)}")
print(f"RAKE {rake:.2f} deg   [R3 published 25.0]")

w = AXF - S; offv = w - (w @ d)*d
offs = np.linalg.norm(offv)
Rf = AXF[2]; tr = np.radians(rake)
print(f"\nfork OFFSET {offs:.2f} mm   (vector {np.round(offv,2)})")
print(f"TRAIL = Rf*tan(rake) - offset/cos(rake) = "
      f"{Rf*np.tan(tr) - offs/np.cos(tr):.1f} mm   [R3 published 95]")
G = S + (-S[2]/d[2])*d
print(f"steering axis hits ground at X {G[0]:.1f}; front contact X {AXF[0]:.1f} "
      f"-> geometric trail {AXF[0]-G[0]:.1f} mm")

print("\n--- swingarm pivot: focused search ---")
r2 = X[(X[:,0] > 480) & (X[:,0] < 700) & (X[:,2] > 320) & (X[:,2] < 470) & (np.abs(X[:,1]) < 220)]
print(f"region {len(r2):,} pts")
for ylo, yhi, tag in [(-220,-90,"left outer"), (-90,90,"centre"), (90,220,"right outer")]:
    s = r2[(r2[:,1] >= ylo) & (r2[:,1] < yhi)]
    if len(s) < 300: print(f"  {tag}: {len(s)} pts"); continue
    _, ix = cKDTree(s).query(s, k=14)
    nbb = s[ix] - s[ix].mean(1)[:,None]
    Ns = np.linalg.eigh(np.einsum('nki,nkj->nij', nbb, nbb)/14)[1][:,:,0]
    BB = np.c_[np.array([1.,0,0]), np.array([0,0,1.])]
    p2, nn2 = s @ BB, Ns @ BB
    nl = np.linalg.norm(nn2, axis=1); ok = nl > 0.7
    u = nn2[ok]/nl[ok][:,None]
    best = None
    for R in np.arange(8, 26.1, 1.0):
        v = np.r_[p2[ok]-R*u, p2[ok]+R*u]
        lo = v.min(0); g = np.floor((v-lo)/1.5).astype(np.int64)
        uq, ct = np.unique(g, axis=0, return_counts=True)
        i = np.argmax(ct)
        if best is None or ct[i] > best[0]: best = (ct[i], R, lo + (uq[i]+0.5)*1.5)
    ct, R, c2 = best
    m = np.abs(np.hypot(*(p2-c2).T) - R) < 2.0
    print(f"  {tag:12s} best r={R:.0f} votes {ct} inliers {int(m.sum())} "
          f"centre (X {c2[0]:.1f}, Z {c2[1]:.1f})")
