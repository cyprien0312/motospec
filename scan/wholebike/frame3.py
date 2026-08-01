import sys, numpy as np
X0 = np.load(sys.argv[1])
REAR_C  = np.array([1405.0, 0.06, 283.00])
FRONT_C = np.array([  -3.0, 2.46, 188.41])
lat = np.array([0.0, 1.0, 0.0])                 # keep the working frame's median-plane normal
up  = np.array([0.0, 0.0, 1.0]); fwd = np.array([1.0, 0.0, 0.0])
if fwd @ (FRONT_C - REAR_C) < 0: fwd = -fwd

def contact(C, up, fwd, halfwidth=110.0, span=130.0):
    d = X0 - C
    m = (np.abs(d @ fwd) < span) & (np.abs(d @ lat) < halfwidth)
    return np.percentile((X0[m]-C) @ up, 0.4), int(m.sum())

for it in range(10):
    hr,nr = contact(REAR_C, up, fwd); hf,nf = contact(FRONT_C, up, fwd)
    Pr = REAR_C + hr*up; Pf = FRONT_C + hf*up
    g = Pf - Pr; g -= (g@lat)*lat; g /= np.linalg.norm(g)
    un = np.cross(g, lat); un /= np.linalg.norm(un)
    if un @ up < 0: un = -un
    t = np.degrees(np.arccos(np.clip(un@up,-1,1))); up = un; fwd = np.cross(lat, up)
    if fwd @ (FRONT_C - REAR_C) < 0: fwd = -fwd
    print(f"  it{it}: rear drop {hr:8.2f}({nr}) front drop {hf:8.2f}({nf})  up moved {t:.4f}°")
    if t < 1e-5: break

origin = REAR_C + hr*up
B = np.c_[fwd, lat, up]
X = (X0 - origin) @ B
np.save(sys.argv[2], X)
ar = (REAR_C-origin) @ B; af = (FRONT_C-origin) @ B
print(f"\nREAR  axle  X {ar[0]:8.1f}  Y {ar[1]:7.2f}  Z {ar[2]:8.1f}")
print(f"FRONT axle  X {af[0]:8.1f}  Y {af[1]:7.2f}  Z {af[2]:8.1f}")
print(f"\nWHEELBASE {af[0]-ar[0]:.1f} mm   loaded radii: rear {ar[2]:.1f}  front {af[2]:.1f}")
print(f"pitch {np.degrees(np.arctan2(ar[2]-af[2], af[0]-ar[0])):+.2f}° (positive = nose-down)")
print(f"cloud Z {X[:,2].min():.1f}..{X[:,2].max():.1f}  Y {X[:,1].min():.1f}..{X[:,1].max():.1f}")
np.save(sys.argv[3], np.r_[origin, B.ravel(), ar, af])
