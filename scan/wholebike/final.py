import sys, json, numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import MultipleLocator

X = np.load(sys.argv[1])
AXF = np.array([1411.2, 2.40, 294.8]); AXR = np.array([0.0, 0.0, 286.7])
SD  = np.array([-0.43003, -0.01643, 0.90266])          # steering-axis direction
SP_ = np.array([1407.97, 0.11, 292.97])                # point on the fork-pair centreline
PIV = np.array([585.4, 0.0, 397.3])                    # swingarm pivot candidate

core = X[np.abs(X[:,1]) < 60]
fig, ax = plt.subplots(figsize=(22, 13), facecolor="white")
ax.hexbin(core[:,0], core[:,2], gridsize=740, bins="log", cmap="bone_r", linewidths=0)
ax.axhline(0, color="#0a7", lw=2, zorder=4)
for c, r, lbl, col in [(AXR, 286.7, "rear axle", "#c0392b"), (AXF, 294.8, "front axle", "#c0392b")]:
    ax.add_patch(plt.Circle((c[0], c[2]), r, fill=False, ec="#3498db", lw=1.2, ls="--", zorder=5))
    ax.plot(c[0], c[2], "o", color=col, ms=9, zorder=6)
    ax.annotate(f"{lbl}\n({c[0]:.0f}, {c[2]:.0f})", (c[0], c[2]), xytext=(10, 14),
                textcoords="offset points", fontsize=11, color=col, weight="bold", zorder=6)
t = np.linspace(-330, 620, 2)
L = SP_[None,:] + t[:,None]*SD[None,:]
ax.plot(L[:,0], L[:,2], "-", color="#8e44ad", lw=2.4, zorder=6)
ax.annotate(f"fork-tube axis  {np.degrees(np.arctan2(np.hypot(SD[0],SD[1]),SD[2])):.2f}° from vertical\n"
            f"(= steering-axis direction)", (L[1,0], L[1,2]), xytext=(-260, 18),
            textcoords="offset points", fontsize=12, color="#8e44ad", weight="bold", zorder=6)
ax.plot(PIV[0], PIV[2], "s", color="#e67e22", ms=10, zorder=6)
ax.annotate(f"swingarm pivot?\n({PIV[0]:.0f}, {PIV[2]:.0f})  LOW CONFIDENCE", (PIV[0], PIV[2]),
            xytext=(12, -46), textcoords="offset points", fontsize=11, color="#e67e22",
            weight="bold", zorder=6)
ax.plot([AXR[0], PIV[0]], [AXR[2], PIV[2]], ":", color="#e67e22", lw=1.8, zorder=5)
ax.set_aspect("equal"); ax.set_xlim(-400, 1800); ax.set_ylim(-80, 1080)
ax.xaxis.set_major_locator(MultipleLocator(100)); ax.xaxis.set_minor_locator(MultipleLocator(25))
ax.yaxis.set_major_locator(MultipleLocator(100)); ax.yaxis.set_minor_locator(MultipleLocator(25))
ax.grid(which="major", alpha=.35); ax.grid(which="minor", alpha=.12, lw=.4)
ax.set_xlabel("X forward (mm) — origin at rear tyre contact"); ax.set_ylabel("Z up (mm)")
ax.set_title("Yamaha R3 — geo-R.ply, vehicle frame, |Y|<60 slice", fontsize=15)
fig.tight_layout(); fig.savefig(sys.argv[2], dpi=100)

res = {
  "source": "C:/Users/admin0/Documents/geo-R.ply",
  "frame": "origin = rear tyre contact patch; +X forward, +Y left, +Z up; mm",
  "confident": {
    "rear_axle":  [round(float(AXR[0]),1), round(float(AXR[1]),2), round(float(AXR[2]),1)],
    "front_axle": [round(float(AXF[0]),1), round(float(AXF[1]),2), round(float(AXF[2]),1)],
    "wheelbase_mm": 1411.2, "published_wheelbase_mm": 1380,
    "rake_deg": 25.49, "published_rake_deg": 25.0,
    "fork_tube_radius_mm": [21.16, 21.23], "fork_tube_separation_mm": 211.0,
    "fork_pair_midpoint_Y_mm": 0.11,
    "rear_rim_radius_mm": 216, "rear_tread_radius_mm": 314,
    "rear_sidewall_mm": 98, "rear_tyre_implied": "140/70-17 (140*0.70 = 98)",
    "front_loaded_radius_mm": 294.8, "rear_loaded_radius_mm": 286.7
  },
  "low_confidence": {"swingarm_pivot": [585.4, 0.0, 397.3],
                     "note": "single weak cylinder vote, 302 inliers, not verified"},
  "not_obtainable_from_this_scan": [
    "yoke/triple-clamp offset -> therefore trail cannot be derived",
    "steering head bore (hidden under fairing + instruments)",
    "shock mounts, frame and swingarm ends (hidden behind bodywork/engine)",
    "swingarm pivot bore (only a weak external candidate)"
  ]
}
open(sys.argv[3], "w", encoding="utf-8").write(json.dumps(res, indent=2, ensure_ascii=False))
print("wrote", sys.argv[2]); print("wrote", sys.argv[3])
