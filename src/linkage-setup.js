// ============================================================
// MotoSPEC Linkage Setup page
// Lets the user enter the 5 linkage point coordinates measured
// from the swingarm pivot, and visualises the topology on a
// simplified side-view diagram.
// ============================================================

import { computeAll, INPUT_META } from './formulas.js';
import { motionRatio, shockLength, rearWheelHeight, swingarmDeltaForShockTravel } from './linkage.js';
import { CATALOGS } from './catalog.js';

// ----- Length-mode helpers --------------------------------------------------
// In length mode the user types four rod/arm lengths (rocker arm A, rocker
// arm B, rocker chord, drag link) plus three fixed-point XY coordinates
// (rocker pivot, drag anchor, frame shock top). The two "rocker triangle"
// points (rocker_to_shock, rocker_to_drag) are derived from these via
// two-circle intersections, branch picked to stay nearest the previous
// solution.

export function circleCircleIntersect(c1, r1, c2, r2) {
  const dx = c2.x - c1.x, dy = c2.y - c1.y;
  const d = Math.hypot(dx, dy);
  if (d === 0) return null;
  if (d > r1 + r2 + 1e-6) return null;          // too far apart
  if (d < Math.abs(r1 - r2) - 1e-6) return null; // one inside the other
  const a = (r1*r1 - r2*r2 + d*d) / (2*d);
  const h = Math.sqrt(Math.max(0, r1*r1 - a*a));
  const px = c1.x + a * dx / d, py = c1.y + a * dy / d;
  return [
    { x: px + h * (dy / d), y: py - h * (dx / d) },
    { x: px - h * (dy / d), y: py + h * (dx / d) },
  ];
}

export function pickNearestBranch(solutions, prev) {
  if (!solutions || solutions.length === 0) return null;
  let best = solutions[0], bestD = Infinity;
  for (const s of solutions) {
    const d = (s.x - prev.x) ** 2 + (s.y - prev.y) ** 2;
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

// Recompute the two derived rocker-triangle points from current fixed points
// and four lengths. Returns the new (X, Y) for rocker_to_drag and
// rocker_to_shock, or null for any point that couldn't be triangulated
// (geometry is impossible for the given lengths — caller should leave the
// previous values untouched in that case).
export function rebuildLinkageGeometry(values, lengths) {
  const fp = { x: values.Frame_Rocker_Pivot_X, y: values.Frame_Rocker_Pivot_Y };
  const da = { x: values.Drag_To_Swingarm_X,   y: values.Drag_To_Swingarm_Y };
  const prevRD = { x: values.Rocker_To_Drag_X,  y: values.Rocker_To_Drag_Y };
  const prevRS = { x: values.Rocker_To_Shock_X, y: values.Rocker_To_Shock_Y };

  const rd = pickNearestBranch(circleCircleIntersect(fp, lengths.armB, da, lengths.dragLink), prevRD);
  if (!rd) return { rd: null, rs: null };
  const rs = pickNearestBranch(circleCircleIntersect(fp, lengths.armA, rd, lengths.chord), prevRS);
  return { rd, rs };
}

// Read the four current lengths off the values object.
export function currentLengths(values) {
  const fp = { x: values.Frame_Rocker_Pivot_X, y: values.Frame_Rocker_Pivot_Y };
  const da = { x: values.Drag_To_Swingarm_X,   y: values.Drag_To_Swingarm_Y };
  const rd = { x: values.Rocker_To_Drag_X,  y: values.Rocker_To_Drag_Y };
  const rs = { x: values.Rocker_To_Shock_X, y: values.Rocker_To_Shock_Y };
  return {
    armA:     Math.hypot(rs.x - fp.x, rs.y - fp.y),
    armB:     Math.hypot(rd.x - fp.x, rd.y - fp.y),
    chord:    Math.hypot(rs.x - rd.x, rs.y - rd.y),
    dragLink: Math.hypot(rd.x - da.x, rd.y - da.y),
  };
}

// Definitions for the 4 length inputs shown in length mode.
export const LINKAGE_LENGTHS = [
  { key: 'armA',     label_en: 'Rocker Arm → Shock',  label_zh: '摇臂 → 避震 臂长',
    desc_en: 'Distance from rocker pivot to the shock-attach bolt on the rocker.',
    desc_zh: '从摇臂转点到摇臂上避震连接螺栓中心。' },
  { key: 'armB',     label_en: 'Rocker Arm → Drag',   label_zh: '摇臂 → 拉杆 臂长',
    desc_en: 'Distance from rocker pivot to the drag-link bolt on the rocker.',
    desc_zh: '从摇臂转点到摇臂上拉杆连接螺栓中心。' },
  { key: 'chord',    label_en: 'Rocker Chord (shock ↔ drag)', label_zh: '摇臂弦长（避震 ↔ 拉杆）',
    desc_en: 'Straight-line distance between the shock-bolt and drag-bolt on the rocker. Together with the two arm lengths this fixes the rocker triangle.',
    desc_zh: '摇臂上避震螺栓与拉杆螺栓之间的直线距离。配合两段臂长，确定摇臂三角形。' },
  { key: 'dragLink', label_en: 'Drag/Pull Link Length', label_zh: '拉杆长度',
    desc_en: 'Length of the drag/pull link rod, end-to-end (bolt centres).',
    desc_zh: '拉杆（活动连杆）从一端到另一端的长度，按螺栓中心量。' },
];

// Which of LINKAGE_POINTS are entered as fixed XY in length mode.
const FIXED_POINT_KEYS = ['frame_rocker_pivot', 'drag_to_swingarm', 'frame_shock_top'];

// 5 linkage points the user measures on a real bike. Origin is the
// swingarm pivot bolt; +X forward (toward the front wheel), +Y up.
//
// Two of the five points have a different physical meaning in Pro-Link
// mode (rocker rides on the swingarm instead of the frame). The mode-
// dependent labels are stored in `*_pro` keys and selected at render time.
//
// The `anchor` field controls how polar (length + angle) inputs are
// interpreted: 'swingarm' means the L/θ pair is from the swingarm pivot;
// 'rocker' means the pair is from the rocker pivot (so e.g. "rocker arm
// to shock" reads as a true arm length on the rocker triangle).
export const LINKAGE_POINTS = [
  {
    key: 'frame_rocker_pivot',
    anchor: 'swingarm',
    label_zh: '摇臂枢轴在车架上的位置',
    label_en: 'Frame Rocker Pivot',
    label_pro_zh: '摇臂枢轴（在平叉上）',
    label_pro_en: 'Rocker Pivot (on swingarm)',
    xKey: 'Frame_Rocker_Pivot_X', yKey: 'Frame_Rocker_Pivot_Y',
    desc_zh: '从摇臂枢轴量到车架上摇臂转点的距离（前为正、上为正）',
    desc_en: "From swingarm pivot bolt to the rocker arm's frame-side pivot bolt (X forward, Y up)",
    desc_pro_zh: '从摇臂枢轴量到摇臂转点的位置；该点固定在平叉上、随平叉一起运动。',
    desc_pro_en: "From swingarm pivot to the rocker pivot bolt — this bolt sits on the SWINGARM and moves with it.",
  },
  {
    key: 'rocker_to_shock',
    anchor: 'rocker',
    label_zh: '摇臂上避震连接点',
    label_en: 'Rocker-to-Shock',
    xKey: 'Rocker_To_Shock_X', yKey: 'Rocker_To_Shock_Y',
    desc_zh: '从摇臂枢轴量到摇臂上连接避震下端的转点',
    desc_en: 'From swingarm pivot to the point on the rocker where the shock body attaches',
  },
  {
    key: 'rocker_to_drag',
    anchor: 'rocker',
    label_zh: '摇臂上拉杆连接点',
    label_en: 'Rocker-to-Drag',
    xKey: 'Rocker_To_Drag_X', yKey: 'Rocker_To_Drag_Y',
    desc_zh: '从摇臂枢轴量到摇臂上连接拉杆（drag link）的转点',
    desc_en: 'From swingarm pivot to the point on the rocker where the drag link attaches',
  },
  {
    key: 'drag_to_swingarm',
    anchor: 'swingarm',
    label_zh: '拉杆与摇臂连接点',
    label_en: 'Drag-to-Swingarm',
    label_pro_zh: '拉杆与车架固定端',
    label_pro_en: 'Drag-to-Frame Anchor',
    xKey: 'Drag_To_Swingarm_X', yKey: 'Drag_To_Swingarm_Y',
    desc_zh: '从摇臂枢轴量到拉杆与摇臂相连的螺栓中心（点位于摇臂上）',
    desc_en: 'From swingarm pivot to the bolt where the drag link meets the swingarm (this point lives on the swingarm)',
    desc_pro_zh: '从摇臂枢轴量到拉杆固定在车架上的那一端（绊马索的"固定钩"，不随平叉运动）。',
    desc_pro_en: 'From swingarm pivot to the FRAME-fixed end of the tie rod (the "trip-wire" anchor that does NOT move with the swingarm).',
  },
  {
    key: 'frame_shock_top',
    anchor: 'swingarm',
    label_zh: '车架上避震顶部固定点',
    label_en: 'Frame Shock Top',
    xKey: 'Frame_Shock_Top_X', yKey: 'Frame_Shock_Top_Y',
    desc_zh: '从摇臂枢轴量到车架上避震顶端的固定螺栓中心',
    desc_en: 'From swingarm pivot to the upper shock mount bolt on the frame',
  },
];

// Placeholder coords roughly representing a sport-bike linkage viewed
// from the right side, swingarm pivot as origin, +X forward (toward
// front wheel), +Y up.
//
// Linked variant (R7 / GSX-8R / RS660 class):
//   - Rocker pivot sits ABOVE and slightly forward of the swingarm pivot.
//   - Shock body leans forward, top mount high on the frame.
//   - Drag/pull link runs forward-and-down from the rocker to the swingarm.
// Both placeholders below are ENGINEERING ESTIMATES, not measured bikes —
// but they are calibrated against real published anchors so the defaults
// behave like production linkages:
//   - link scales follow the four-bar dimensions in Segľa et al., "Optimi-
//     zation of a Motorcycle Rear Suspension Mechanism with Four-bar
//     Linkage", Acta Mechanica Slovaca 19(1), 2015 (rocker arms ~90-130 mm,
//     tie rod ~100-160 mm, frame rocker pivot ≈115 mm below / 25 mm behind
//     the swingarm pivot);
//   - motion ratio targets the published stroke ratios collected by
//     ProMechA (GSXR1000 ≈130/74≈1.76, CBR954 ≈130/54≈2.4, R1 ≈2.0):
//     MR ≈ 2.2-2.45 across ±25° with a mild curve;
//   - static shock length ≈310 mm to agree with the Shock_Length default;
//   - shockLength(δ) is strictly monotonic over ±25° (no lock/fold-back),
//     so the RHA solve and progression sweep stay in a valid range.
// Numbers were selected by constrained search through src/linkage.js
// itself — see docs/research/linkage-coords.md for the derivation.
export const LINKAGE_PLACEHOLDER_LINKED = {
  Frame_Rocker_Pivot_X:  -60, Frame_Rocker_Pivot_Y: -140,
  Rocker_To_Shock_X:    -185, Rocker_To_Shock_Y:    -100,
  Rocker_To_Drag_X:     -170, Rocker_To_Drag_Y:     -165,
  Drag_To_Swingarm_X:   -200, Drag_To_Swingarm_Y:    -40,
  Frame_Shock_Top_X:     -35, Frame_Shock_Top_Y:     175,
};

// Pro-Link variant (Honda): the rocker bell-crank hangs BELOW the swingarm,
// so all three rocker points and the frame tie-rod anchor have negative Y.
//   - Rocker pivot is bolted to the underside of the swingarm.
//   - Shock-attach tip of the rocker reaches up toward the swingarm body.
//   - Drag tip of the rocker reaches forward-and-down toward a low frame anchor.
//   - Frame shock-top is the same upper-frame mount, high and forward.
export const LINKAGE_PLACEHOLDER_PROLINK = {
  Frame_Rocker_Pivot_X: -230, Frame_Rocker_Pivot_Y:  -40,
  Rocker_To_Shock_X:    -205, Rocker_To_Shock_Y:     -90,
  Rocker_To_Drag_X:     -260, Rocker_To_Drag_Y:      -90,
  Drag_To_Swingarm_X:    -60, Drag_To_Swingarm_Y:    -70,
  Frame_Shock_Top_X:    -160, Frame_Shock_Top_Y:     215,
};

// Backward-compat alias: code that imports LINKAGE_PLACEHOLDER still gets
// the linked-mode default.
export const LINKAGE_PLACEHOLDER = LINKAGE_PLACEHOLDER_LINKED;

export function placeholderForMode(mode) {
  return mode === 'pro-link' ? LINKAGE_PLACEHOLDER_PROLINK : LINKAGE_PLACEHOLDER_LINKED;
}

// 12 spec fields that fully describe a linkage entry in CATALOGS.linkages.
export const LINKAGE_SPEC_FIELDS = [
  'Linkage_Mode',
  'Frame_Rocker_Pivot_X', 'Frame_Rocker_Pivot_Y',
  'Rocker_To_Shock_X', 'Rocker_To_Shock_Y',
  'Rocker_To_Drag_X', 'Rocker_To_Drag_Y',
  'Drag_To_Swingarm_X', 'Drag_To_Swingarm_Y',
  'Frame_Shock_Top_X', 'Frame_Shock_Top_Y',
];

// The 10 coordinate fields (mode-dependent geometry only — excludes
// Linkage_Mode itself). Used to snapshot/restore each mode's coords
// independently when switching mode in the Linkage Setup page.
export const LINKAGE_COORD_FIELDS = LINKAGE_SPEC_FIELDS.filter(k => k !== 'Linkage_Mode');

// Slug a user-entered name to a catalog id; if the slug collides with an
// existing id in `existingIds` (Set or array of strings), a timestamp suffix
// is appended.
export function slugifyLinkageName(name, existingIds = []) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'linkage';
  const set = existingIds instanceof Set ? existingIds : new Set(existingIds);
  if (!set.has(base)) return base;
  return `${base}-${Date.now()}`;
}

// Build a catalog entry payload from the current state values.
export function buildLinkagePresetEntry(name, values) {
  const specs = {};
  for (const k of LINKAGE_SPEC_FIELDS) specs[k] = values[k];
  if (specs.Linkage_Mode !== 'pro-link' && specs.Linkage_Mode !== 'linked') {
    specs.Linkage_Mode = 'pro-link';
  }
  return {
    name: String(name),
    manufacturer: 'User',
    source: 'Saved from Linkage Setup',
    specs,
  };
}

// True iff the values match the placeholder coords for the given mode
// exactly (no user customisation). Used by setLinkageMode to decide
// whether it's safe to swap to the other mode's placeholder.
export function matchesPlaceholder(values, mode) {
  const p = placeholderForMode(mode);
  for (const k of Object.keys(p)) if (values[k] !== p[k]) return false;
  return true;
}

const UI = {
  zh: {
    nav: '🔧 连杆几何',
    nav_sub: '后悬挂点位测量',
    title: '连杆几何 / Linkage Setup',
    kicker: '输入实测连杆坐标 → 真实的运动比、渐进性与车高',
    save_preset: '💾 保存为预设',
    load_library: '📚 从组件库加载…',
    load_library_default: '— 选择库中已有连杆 —',
    desc: '所有坐标以摇臂枢轴螺栓中心为原点，+X 朝前（向前轮）、+Y 朝上，单位 mm。图示按右侧视图绘制——车头朝左、+X 在屏幕上向左。占位坐标只为让公式有数值；实测后图示与运动比才有意义。',
    readouts: '实时读数（Live Readouts）',
    chart_title: '运动比曲线',
    points_title: '5 个连杆测量点',
    diagram_title: '连杆拓扑图（侧视）',
    guide_title: '测量指南',
    guide_1: '将车放在工作架上，使后悬挂处于完全伸展状态。',
    guide_2: '在摇臂枢轴螺栓中心建立基准；+X 朝前、+Y 朝上、单位 mm。',
    guide_3: '5 个点都在车体对称面内 — 测左右哪侧都行，挑顺手的那侧。',
    guide_4: '尽量精确：1 mm 的误差会让运动比偏移几个百分点。',
    reset: '↺ 恢复占位坐标',
    units: 'mm',
    x_label: 'X (前/后)',
    y_label: 'Y (上/下)',
    mode_title: '连杆型式',
    mode_linked: 'Linked',
    mode_pro:    'Pro-Link',
    mode_desc_linked: '摇臂三角块固定在车架上，平叉通过一根活动拉杆去拨动它。',
    mode_desc_pro:    '摇臂骑在平叉上、随平叉一起运动；车架底部伸出一根固定拉杆，平叉抬起时把它绊住、迫使其旋转。',
    style_title:     '输入方式',
    style_xy:        'X / Y 坐标',
    style_polar:     '只填长度',
    style_desc_xy:    '5 个点都填 (X, Y) 偏移，单位 mm，原点为摇臂枢轴。适合从 CAD 或图纸上读数。',
    style_desc_polar: '把 3 个固定点（摇臂转点、拉杆锚点、避震顶）的 XY 锁住，再填 4 个杆/臂长——剩下的摇臂三角点会自动算出来。实车测量最方便，不用量角器。',
    length_label:    '长度',
    fixed_title:     '固定点（3 个锚点）',
    fixed_desc:      '这 3 个点的 XY 直接从摇臂枢轴量。其它的连杆点会用下方的 4 个长度反推得到。',
    lengths_title:   '长度（4 项测量）',
    lengths_desc:    '卡尺或直尺量螺栓中心的距离即可。摇臂三角形的两个点（摇臂→避震、摇臂→拉杆）会自动重算。',
  },
  en: {
    nav: '🔧 Linkage Setup',
    nav_sub: 'Rear suspension geometry',
    title: 'Linkage Setup',
    kicker: 'Enter measured linkage coords → real Motion Ratio, Progression, ride height',
    save_preset: '💾 Save as preset',
    load_library: '📚 Load from Library…',
    load_library_default: '— Pick a linkage from the library —',
    desc: 'All coordinates use the swingarm pivot bolt as origin, +X forward (toward the front wheel), +Y up, units mm. The diagram is a right-side view — bike faces left, so +X-forward points left on screen. Placeholder coords just keep the formulas numerical; the diagram and motion ratio only become meaningful once you enter real measurements.',
    readouts: 'Live Readouts',
    chart_title: 'Motion Ratio Curve',
    points_title: '5 Linkage Measurement Points',
    diagram_title: 'Linkage Topology (Side View)',
    guide_title: 'Measurement Guide',
    guide_1: 'Place the bike on a stand with the rear suspension at full extension.',
    guide_2: 'Pick a fixed reference at the swingarm pivot bolt centre; measure +X forward, +Y up to each point.',
    guide_3: 'All five points lie in the bike\'s symmetry plane — measure either side, whichever is easier.',
    guide_4: 'Be precise: a 1 mm error can shift Motion Ratio by a few percent.',
    reset: '↺ Reset to placeholder',
    units: 'mm',
    x_label: 'X (fwd/back)',
    mode_title: 'Linkage Type',
    mode_linked: 'Linked',
    mode_pro:    'Pro-Link',
    mode_desc_linked: 'Rocker triangle is fixed to the frame; the swingarm drives it through a moving drag/pull link.',
    mode_desc_pro:    'Rocker rides on the swingarm and moves with it; a frame-anchored tie rod "trips" the rocker as the swingarm rises, forcing it to rotate.',
    style_title:     'Input Style',
    style_xy:        'X / Y coordinates',
    style_polar:     'Lengths only',
    style_desc_xy:    'Type each of the 5 points as a pair of (X, Y) offsets in mm from the swingarm pivot. Easier when you have a CAD/2D drawing.',
    style_desc_polar: 'Pin 3 points as XY (rocker pivot, drag anchor, frame shock top) and type 4 rod/arm lengths — the rocker-triangle points are computed for you. Easiest when measuring a real bike with calipers; no protractor needed.',
    length_label:    'Length',
    fixed_title:     'Fixed Points (3 anchors)',
    fixed_desc:      'These XY positions are measured directly from the swingarm pivot. The rest of the linkage is solved from the four lengths below.',
    lengths_title:   'Lengths (4 measurements)',
    lengths_desc:    'Caliper or ruler measurements between bolt centres. The two rocker-triangle points (Rocker→Shock, Rocker→Drag) are recomputed automatically.',
    y_label: 'Y (up/down)',
  },
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// Sweep swingarm delta from 0° (full extension) to a representative full-bump
// angle and compute motion ratio at each step. Returns {samples:[{deg,mr}…],
// min, max} so the renderer can pick axis bounds.
function sampleMotionRatio(values, fullBumpDeg = 25, samples = 25) {
  const cfg = { ...values };
  const swingarmLength = values.Swingarm_Length || 580;
  const beta_static = values.beta_static || 14;
  const kSpring = values.Rear_Spring_Rate || 110;
  // Cap the sweep at the shock's REAL stroke when known — sweeping past
  // bottom-out plots travel the mechanism can't reach.
  let sweep = fullBumpDeg;
  if (Number.isFinite(values.Shock_Stroke)) {
    const dShock = values.Shock_Length - values.Shock_Length_ref;
    const rhaTotal = (values.Shock_Clevis_RHA || 0) + (Number.isFinite(dShock) ? dShock : 0);
    const dFull = swingarmDeltaForShockTravel(cfg, values.Shock_Stroke, rhaTotal);
    if (Number.isFinite(dFull)) sweep = Math.min(fullBumpDeg, Math.abs(dFull));
  }
  const yStatic = rearWheelHeight(cfg, 0, swingarmLength, beta_static);
  const out = [];
  let mrLo = Infinity, mrHi = -Infinity;
  let wrLo = Infinity, wrHi = -Infinity;
  for (let i = 0; i < samples; i++) {
    // Bump direction: compression = axle up = β decreasing (negative delta).
    const deg = -(i / (samples - 1)) * sweep;
    const mr = motionRatio(cfg, deg, swingarmLength, beta_static);
    const yNow = rearWheelHeight(cfg, deg, swingarmLength, beta_static);
    const travel = Math.abs(yNow - yStatic);
    if (Number.isFinite(mr) && Number.isFinite(travel) && mr > 0) {
      const wr = kSpring / (mr * mr);
      out.push({ deg, mr, travel, wr });
      if (mr < mrLo) mrLo = mr;
      if (mr > mrHi) mrHi = mr;
      if (wr < wrLo) wrLo = wr;
      if (wr > wrHi) wrHi = wr;
    }
  }
  return { samples: out, mrMin: mrLo, mrMax: mrHi, wrMin: wrLo, wrMax: wrHi, kSpring };
}

function renderMotionRatioChart(values, lang) {
  // Larger viewBox so when the SVG scales to fill the page width the internal
  // 10–11px text and 2.2px strokes still look proportionally fine. Aspect is
  // preserved by viewBox; height grows in proportion via width:100%/height:auto.
  const W = 1500, H = 650;
  const padL = 80, padR = 90, padT = 48, padB = 64;
  const data = sampleMotionRatio(values);
  const empty = `<div class="linkage-chart-empty">${lang === 'en' ? 'No motion-ratio data — check coords.' : '无运动比数据 — 请检查坐标。'}</div>`;
  if (data.samples.length < 2 || !Number.isFinite(data.mrMin) || !Number.isFinite(data.mrMax)) return empty;
  const xMin = 0, xMax = data.samples[data.samples.length - 1].travel;
  if (!(xMax > 0)) return empty;

  // Anchor both axes on their static value with the SAME fractional span so
  // MR and wheel-rate curves stay visually comparable. Enforce a *minimum*
  // half-span so a barely-progressive linkage looks barely-progressive (no
  // false dramatic curvature from auto-zoom into a 0.5%-tall data range).
  const mrStatic = data.samples[0].mr;
  const wrStatic = data.samples[0].wr;
  const MIN_HALF_SPAN = 0.20; // ±20% of static — honest visual baseline
  const mrFracDown = Math.max(0, (mrStatic - data.mrMin) / mrStatic);
  const mrFracUp   = Math.max(0, (data.mrMax - mrStatic) / mrStatic);
  const wrFracDown = Math.max(0, (wrStatic - data.wrMin) / wrStatic);
  const wrFracUp   = Math.max(0, (data.wrMax - wrStatic) / wrStatic);
  const fracDown = Math.max(mrFracDown, wrFracDown, MIN_HALF_SPAN);
  const fracUp   = Math.max(mrFracUp,   wrFracUp,   MIN_HALF_SPAN);
  const mrYMin = mrStatic * (1 - fracDown), mrYMax = mrStatic * (1 + fracUp);
  const wrYMin = wrStatic * (1 - fracDown), wrYMax = wrStatic * (1 + fracUp);

  const sx  = (travel) => padL + (travel - xMin) / (xMax - xMin) * (W - padL - padR);
  // Both curves share one screen-space mapping (the fractional position).
  const sy = (frac)   => padT + (1 - frac) * (H - padT - padB);
  const fracOf = (v, lo, hi) => (v - lo) / (hi - lo);
  const syMR = (mr) => sy(fracOf(mr, mrYMin, mrYMax));
  const syWR = (wr) => sy(fracOf(wr, wrYMin, wrYMax));

  // Grid + axis labels. Y at fixed 0.1 MR steps (1.1, 1.2, …) and X at fixed
  // 10 mm steps (0, 10, 20, …) so spacing is independent of data extent.
  const Y_STEP_MR = 0.1;
  const X_STEP_MM = 10;
  let grid = '';
  const mrTickStart = Math.ceil(mrYMin / Y_STEP_MR) * Y_STEP_MR;
  for (let mrV = mrTickStart; mrV <= mrYMax + 1e-9; mrV += Y_STEP_MR) {
    const frac = (mrV - mrYMin) / (mrYMax - mrYMin);
    const y = sy(frac);
    const wrV = wrYMin + frac * (wrYMax - wrYMin);
    grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#2a3340" stroke-width="1"/>`;
    grid += `<text x="${padL - 6}" y="${y + 4}" fill="#5a6878" font-size="16" text-anchor="end">${mrV.toFixed(1)}</text>`;
    grid += `<text x="${W - padR + 6}" y="${y + 4}" fill="#5a6878" font-size="16" text-anchor="start">${wrV.toFixed(1)}</text>`;
  }
  const xTickStart = Math.ceil(xMin / X_STEP_MM) * X_STEP_MM;
  for (let v = xTickStart; v <= xMax + 1e-9; v += X_STEP_MM) {
    const x = sx(v);
    grid += `<line x1="${x}" y1="${H - padB}" x2="${x}" y2="${H - padB + 3}" stroke="#5a6878" stroke-width="1"/>`;
    grid += `<text x="${x}" y="${H - padB + 20}" fill="#5a6878" font-size="16" text-anchor="middle">${v.toFixed(0)}</text>`;
  }

  // Axis titles
  const xTitle  = lang === 'en' ? 'Rear Wheel Vertical Travel (mm)' : '后轮垂直行程 (mm)';
  const yTitleL = lang === 'en' ? 'Motion Ratio (wheel/shock)' : '运动比 (轮/避震)';
  const yTitleR = lang === 'en' ? 'Wheel Rate (N/mm)' : '后轮综合刚度 (N/mm)';
  const axisTitles = `
    <text x="${(W - padR + padL) / 2}" y="${H - 4}" fill="#94a3b8" font-size="16" text-anchor="middle" font-weight="600">${escapeHtml(xTitle)}</text>
    <text x="14" y="${(H + padT - padB) / 2}" fill="#4ea1ff" font-size="16" text-anchor="middle" font-weight="600"
          transform="rotate(-90, 14, ${(H + padT - padB) / 2})">${escapeHtml(yTitleL)}</text>
    <text x="${W - 14}" y="${(H + padT - padB) / 2}" fill="#f472b6" font-size="16" text-anchor="middle" font-weight="600"
          transform="rotate(90, ${W - 14}, ${(H + padT - padB) / 2})">${escapeHtml(yTitleR)}</text>
  `;

  // MR line + soft fill
  const mrPts = data.samples.map(p => `${sx(p.travel).toFixed(1)},${syMR(p.mr).toFixed(1)}`).join(' ');
  const mrArea = `M ${sx(data.samples[0].travel)},${H - padB} L ${data.samples.map(p => `${sx(p.travel).toFixed(1)},${syMR(p.mr).toFixed(1)}`).join(' L ')} L ${sx(data.samples[data.samples.length-1].travel)},${H - padB} Z`;
  // Wheel-rate line (no fill, dashed for clarity)
  const wrPts = data.samples.map(p => `${sx(p.travel).toFixed(1)},${syWR(p.wr).toFixed(1)}`).join(' ');

  // Marker starts at travel = 0 (static); drag updates it.
  const x0 = sx(data.samples[0].travel);
  const y0mr = syMR(mrStatic), y0wr = syWR(wrStatic);

  // Progression annotation
  const prog = (data.mrMax - data.mrMin) / (data.mrMin || 1) * 100;
  const progText = lang === 'en'
    ? `Progression: ${prog.toFixed(1)}%   |   K = ${data.kSpring} N/mm`
    : `渐进性：${prog.toFixed(1)}%   |   K = ${data.kSpring} N/mm`;
  const readoutText = lang === 'en'
    ? `Travel: ${(0).toFixed(0)} mm   |   MR: ${mrStatic.toFixed(2)}   |   Wheel Rate: ${wrStatic.toFixed(1)} N/mm`
    : `行程: ${(0).toFixed(0)} mm   |   MR: ${mrStatic.toFixed(2)}   |   轮刚度: ${wrStatic.toFixed(1)} N/mm`;
  // Compact sample blob for the drag handler — { t: travels, m: MRs, w: WRs }.
  const blob = JSON.stringify({
    t: data.samples.map(p => +p.travel.toFixed(3)),
    m: data.samples.map(p => +p.mr.toFixed(5)),
    w: data.samples.map(p => +p.wr.toFixed(3)),
  });

  // Legend
  const legend = `
    <g font-size="16" font-weight="600">
      <line x1="${padL + 6}" y1="${padT + 8}" x2="${padL + 32}" y2="${padT + 8}" stroke="#4ea1ff" stroke-width="2.6"/>
      <text x="${padL + 38}" y="${padT + 13}" fill="#4ea1ff">MR</text>
      <line x1="${padL + 80}" y1="${padT + 8}" x2="${padL + 106}" y2="${padT + 8}" stroke="#f472b6" stroke-width="2.6" stroke-dasharray="5 3"/>
      <text x="${padL + 112}" y="${padT + 13}" fill="#f472b6">${lang === 'en' ? 'Wheel Rate' : '轮刚度'}</text>
    </g>
  `;

  return `
    <svg id="linkage-chart-svg" class="linkage-chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
         role="img" aria-label="Motion ratio + wheel rate vs rear wheel travel"
         data-pad-l="${padL}" data-pad-r="${padR}" data-pad-t="${padT}" data-pad-b="${padB}"
         data-w="${W}" data-h="${H}" data-x-max="${xMax.toFixed(3)}"
         data-mr-y-min="${mrYMin.toFixed(5)}" data-mr-y-max="${mrYMax.toFixed(5)}"
         data-wr-y-min="${wrYMin.toFixed(3)}" data-wr-y-max="${wrYMax.toFixed(3)}"
         data-samples='${blob}'
         style="touch-action: none;">
      <rect x="0" y="0" width="${W}" height="${H}" fill="var(--formula-bg, #0f141b)"/>
      ${grid}
      <path d="${mrArea}" fill="rgba(78,161,255,0.14)" stroke="none"/>
      <polyline points="${mrPts}" fill="none" stroke="#4ea1ff" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
      <polyline points="${wrPts}" fill="none" stroke="#f472b6" stroke-width="2.2" stroke-dasharray="5 3" stroke-linejoin="round" stroke-linecap="round"/>
      <line id="linkage-readout-vline" x1="${x0.toFixed(1)}" y1="${padT}" x2="${x0.toFixed(1)}" y2="${H - padB}" stroke="#fbbf24" stroke-width="1" stroke-dasharray="3 3" opacity="0.55"/>
      <circle id="linkage-readout-dot-mr" cx="${x0.toFixed(1)}" cy="${y0mr.toFixed(1)}" r="6" fill="#fbbf24" stroke="#0c1116" stroke-width="1.8" style="cursor: ew-resize;"/>
      <circle id="linkage-readout-dot-wr" cx="${x0.toFixed(1)}" cy="${y0wr.toFixed(1)}" r="5" fill="#fbbf24" stroke="#0c1116" stroke-width="1.8" style="cursor: ew-resize;"/>
      ${axisTitles}
      ${legend}
      <text id="linkage-readout-text" x="${padL + 4}" y="${H - padB - 6}" fill="#fbbf24" font-size="16" font-weight="700">${escapeHtml(readoutText)}</text>
      <text x="${W - padR - 4}" y="${padT - 12}" fill="#cbd5e1" font-size="16" text-anchor="end" font-weight="600">${escapeHtml(progText)}</text>
      <rect x="${padL}" y="${padT}" width="${(W - padL - padR).toFixed(0)}" height="${(H - padT - padB).toFixed(0)}"
            fill="transparent" style="cursor: ew-resize;"
            onpointerdown="linkageReadoutDown(event)"
            onpointermove="linkageReadoutMove(event)"
            onpointerup="linkageReadoutUp(event)"
            onpointercancel="linkageReadoutUp(event)"/>
    </svg>
  `;
}

function fmtReadout(out, key, unit) {
  const v = out[key];
  if (!isFinite(v)) return '—';
  const av = Math.abs(v);
  const dec = av >= 1000 ? 0 : av >= 100 ? 1 : av >= 10 ? 2 : 3;
  const u = unit ? ` ${unit}` : '';
  return `${v.toFixed(dec)}${u}`;
}

// Build the topology SVG. The user's coords are in millimetres relative to
// the swingarm pivot (+X forward = toward front wheel, +Y up). The diagram
// is drawn with the bike facing LEFT (front wheel on the left), so on
// screen +X-forward maps to −x-pixels. SVG +Y is down so we invert Y.
// We auto-fit the bounding box of all key points so the user's coords
// always render at a sensible scale.
function renderTopologySVG(values, mode = 'linked') {
  const proLink = mode === 'pro-link';
  const W = 1000, H = 467;

  const swingarmLength = values.Swingarm_Length || 580;
  const beta = (values.beta_static || 14) * Math.PI / 180;
  // Rear axle is opposite the front wheel along the swingarm: in our
  // +X-forward convention rear is at −swingarmLength·cosβ.
  const rearAxleMM = { x: -swingarmLength * Math.cos(beta), y: -swingarmLength * Math.sin(beta) };

  const ptsMM = {
    pivot:    { x: 0, y: 0 },
    rearAxle: rearAxleMM,
    fRocker:  { x: values.Frame_Rocker_Pivot_X, y: values.Frame_Rocker_Pivot_Y },
    rShock:   { x: values.Rocker_To_Shock_X,    y: values.Rocker_To_Shock_Y },
    rDrag:    { x: values.Rocker_To_Drag_X,     y: values.Rocker_To_Drag_Y },
    dSwg:     { x: values.Drag_To_Swingarm_X,   y: values.Drag_To_Swingarm_Y },
    fShock:   { x: values.Frame_Shock_Top_X,    y: values.Frame_Shock_Top_Y },
  };

  // Auto-fit bounding box (with padding) → pick uniform scale and centre.
  const xs = Object.values(ptsMM).map(p => p.x);
  const ys = Object.values(ptsMM).map(p => p.y);
  const padMM = 80;
  const minX = Math.min(...xs) - padMM, maxX = Math.max(...xs) + padMM;
  const minY = Math.min(...ys) - padMM * 1.2, maxY = Math.max(...ys) + padMM;
  const margin = 40;
  const sx = (W - margin * 2) / (maxX - minX);
  const sy = (H - margin * 2) / (maxY - minY);
  const scale = Math.min(sx, sy);
  const rangeX = (maxX - minX) * scale;
  const rangeY = (maxY - minY) * scale;
  const offX = margin + (W - margin * 2 - rangeX) / 2;
  const offY = margin + (H - margin * 2 - rangeY) / 2;

  // Bike faces LEFT on the diagram → +X-forward (mm) maps to LEFT in pixels.
  const mm2svg = (m) => ({
    x: offX + (maxX - m.x) * scale,
    y: offY + (maxY - m.y) * scale,
  });

  const P = Object.fromEntries(Object.entries(ptsMM).map(([k, v]) => [k, mm2svg(v)]));

  // Ground line: world Y = ymin level → in SVG that's the bottom band.
  const groundY = mm2svg({ x: 0, y: minY + padMM * 0.5 }).y;

  // Coordinate axes anchored at swingarm pivot (origin).
  const axisLenPx = 60;
  const axesGroup = `
    <g class="lk-axes" stroke="#5a6878" fill="#5a6878" font-size="11">
      <line x1="${P.pivot.x}" y1="${P.pivot.y}" x2="${P.pivot.x - axisLenPx}" y2="${P.pivot.y}" marker-end="url(#lk-arrow)"/>
      <line x1="${P.pivot.x}" y1="${P.pivot.y}" x2="${P.pivot.x}" y2="${P.pivot.y - axisLenPx}" marker-end="url(#lk-arrow)"/>
      <text x="${P.pivot.x - axisLenPx - 4}" y="${P.pivot.y + 4}" text-anchor="end">+X (fwd)</text>
      <text x="${P.pivot.x + 6}"            y="${P.pivot.y - axisLenPx + 2}">+Y (up)</text>
    </g>
  `;

  const backdrop = `
    <defs>
      <marker id="lk-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#5a6878"/>
      </marker>
      <pattern id="lk-frame-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" stroke-width="1.4"/>
      </pattern>
      <pattern id="lk-swg-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="#4ade80" stroke-width="1.4"/>
      </pattern>
    </defs>
    <line x1="20" y1="${groundY}" x2="${W-20}" y2="${groundY}" stroke="#3a4555" stroke-width="1.5" stroke-dasharray="6,4"/>
    <text x="${W-30}" y="${groundY-6}" fill="#5a6878" font-size="11" text-anchor="end">ground (reference)</text>
  `;

  const cSwg = '#5a6878', cSwgLink = '#4ade80', cDrag = '#c084fc', cRock = '#4ea1ff', cShock = '#ff8c5a';
  // Mode-aware colors for the two points whose host body changes.
  // Linked: rocker pivot is FRAME-fixed (cRock), drag-to-swingarm is on the SWINGARM (cSwgLink).
  // Pro-link: rocker pivot is on the SWINGARM (cSwgLink), drag-to-frame is FRAME-fixed (cRock).
  const cRockerPivot = proLink ? cSwgLink : cRock;
  const cDragGround  = proLink ? cRock    : cSwgLink;

  // The "swingarm-extension" dashed line connects the swingarm pivot to whichever
  // linkage point lives on the swingarm body. In pro-link mode that's the rocker
  // pivot; in linked mode that's the drag-to-swingarm point.
  const swingarmExtensionTo = proLink ? P.fRocker : P.dSwg;

  // The frame-anchored point (drawn with ground hatch around the bolt).
  const frameAnchor = proLink ? P.dSwg : P.fRocker;
  // The swingarm-anchored linkage attachment (mirror of frameAnchor): in
  // linked mode it's the drag-to-swingarm bolt; in pro-link mode it's the
  // rocker pivot bolt that lives on the swingarm body.
  const swingarmAnchor = proLink ? P.fRocker : P.dSwg;

  // Small "frame ground" hatch around a frame-fixed pivot — visual cue that
  // this bolt does NOT move with the swingarm.
  const groundHatch = (p, r = 14) => `
    <circle cx="${p.x}" cy="${p.y}" r="${r}" fill="url(#lk-frame-hatch)" opacity="0.45"/>
    <circle cx="${p.x}" cy="${p.y}" r="${r}" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3,2"/>
  `;
  // Same idea but tinted swingarm-green: marks a fixed bolt on the swingarm
  // body (its XY relative to the swingarm pivot is user-input and constant,
  // even though the world position rotates with the swingarm).
  const swingarmHatch = (p, r = 14) => `
    <circle cx="${p.x}" cy="${p.y}" r="${r}" fill="url(#lk-swg-hatch)" opacity="0.45"/>
    <circle cx="${p.x}" cy="${p.y}" r="${r}" fill="none" stroke="#4ade80" stroke-width="1" stroke-dasharray="3,2"/>
  `;

  const lines = `
    <!-- swingarm: pivot → rear axle -->
    <line x1="${P.pivot.x}" y1="${P.pivot.y}" x2="${P.rearAxle.x}" y2="${P.rearAxle.y}" stroke="${cSwg}" stroke-width="7" stroke-linecap="round"/>
    <!-- swingarm extension: pivot → whichever linkage point sits on the swingarm body -->
    <line x1="${P.pivot.x}" y1="${P.pivot.y}" x2="${swingarmExtensionTo.x}" y2="${swingarmExtensionTo.y}"
          stroke="${cSwgLink}" stroke-width="2" stroke-dasharray="4,3"/>
    <!-- drag/pull link -->
    <line x1="${P.dSwg.x}" y1="${P.dSwg.y}" x2="${P.rDrag.x}" y2="${P.rDrag.y}" stroke="${cDrag}" stroke-width="3.5"/>
    <!-- rocker triangle (3 sides): drag → pivot → shock → drag -->
    <polygon points="${P.rDrag.x},${P.rDrag.y} ${P.fRocker.x},${P.fRocker.y} ${P.rShock.x},${P.rShock.y}"
             fill="rgba(78,161,255,0.12)" stroke="${cRock}" stroke-width="2.5" stroke-linejoin="round"/>
    <!-- shock body -->
    <line x1="${P.rShock.x}" y1="${P.rShock.y}" x2="${P.fShock.x}" y2="${P.fShock.y}" stroke="${cShock}" stroke-width="5" stroke-linecap="round"/>
    <!-- shock spring coil hint -->
    <line x1="${P.rShock.x}" y1="${P.rShock.y}" x2="${P.fShock.x}" y2="${P.fShock.y}" stroke="#fff5" stroke-width="1" stroke-dasharray="2,4"/>
  `;

  // Anchor hatches (drawn under the dots) — gray for frame-fixed, green
  // for swingarm-fixed. Both kinds are user-input anchor points.
  const frameAnchors = `
    ${groundHatch(frameAnchor)}
    ${groundHatch(P.fShock)}
    ${swingarmHatch(swingarmAnchor)}
  `;

  const dot = (p, color, r = 5) =>
    `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${color}" stroke="#0c1116" stroke-width="1.5"/>`;

  // Tiny numeric tag next to each dot — keyed to the legend in the top-right.
  const tag = (p, n, color, dx = 7, dy = -7) =>
    `<text x="${p.x + dx}" y="${p.y + dy}" fill="${color}" font-size="11" font-weight="700" style="paint-order:stroke;stroke:#0c1116;stroke-width:3px;">${n}</text>`;

  const points = `
    ${dot(P.pivot, '#e6edf3', 6)}      ${tag(P.pivot,    '①', '#e6edf3')}
    ${dot(P.rearAxle, cSwg, 6)}        ${tag(P.rearAxle, '②', cSwg)}
    ${dot(P.fRocker, cRockerPivot)}    ${tag(P.fRocker,  '③', cRockerPivot)}
    ${dot(P.rShock, cRock)}            ${tag(P.rShock,   '④', cRock)}
    ${dot(P.rDrag, cRock)}             ${tag(P.rDrag,    '⑤', cRock)}
    ${dot(P.dSwg, cDragGround)}        ${tag(P.dSwg,     '⑥', cDragGround)}
    ${dot(P.fShock, cShock)}           ${tag(P.fShock,   '⑦', cShock)}
  `;

  // Legend in the top-right corner — color swatches keyed to the numbered tags.
  const legendItems = [
    { n: '①', color: '#e6edf3', text: 'swingarm pivot (origin)' },
    { n: '②', color: cSwg,      text: 'rear axle' },
    { n: '③', color: cRockerPivot, text: proLink ? 'rocker pivot (on swingarm)' : 'frame rocker pivot' },
    { n: '④', color: cRock,     text: 'rocker → shock' },
    { n: '⑤', color: cRock,     text: 'rocker → drag' },
    { n: '⑥', color: cDragGround, text: proLink ? 'drag → frame anchor' : 'drag → swingarm' },
    { n: '⑦', color: cShock,    text: 'frame shock top' },
  ];
  const legW = 200, legH = legendItems.length * 18 + 16;
  const legX = W - legW - 12, legY = 12;
  const legend = `
    <g class="lk-legend">
      <rect x="${legX}" y="${legY}" width="${legW}" height="${legH}" rx="6" ry="6"
            fill="rgba(12,17,22,0.78)" stroke="#3a4555" stroke-width="1"/>
      ${legendItems.map((it, i) => {
        const cy = legY + 18 + i * 18;
        return `
          <circle cx="${legX + 14}" cy="${cy - 4}" r="4.5" fill="${it.color}" stroke="#0c1116" stroke-width="1"/>
          <text x="${legX + 26}" y="${cy}" fill="${it.color}" font-size="11" font-weight="700">${it.n}</text>
          <text x="${legX + 44}" y="${cy}" fill="#cbd5e1" font-size="11">${escapeHtml(it.text)}</text>
        `;
      }).join('')}
    </g>
  `;

  // Mode-name caption inside the SVG so the diagram is self-describing.
  const modeCaption = `
    <text x="20" y="${H - 14}" fill="#94a3b8" font-size="12" font-weight="700">
      ${escapeHtml(proLink ? 'Mode: Pro-Link (rocker on swingarm)' : 'Mode: Linked (rocker on frame)')}
    </text>
    <text x="20" y="${H - 30}" fill="#5a6878" font-size="10">
      ${escapeHtml('hatched points = frame-fixed; green dashed line = swingarm body')}
    </text>
  `;

  return `
    <svg class="linkage-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Linkage topology side view">
      ${backdrop}
      ${frameAnchors}
      ${lines}
      ${axesGroup}
      ${points}
      ${modeCaption}
      ${legend}
    </svg>
  `;
}

function renderInputPair(p, values, lang, str, mode) {
  const pro = mode === 'pro-link';
  const label = pro
    ? (lang === 'en' ? (p.label_pro_en || p.label_en) : (p.label_pro_zh || p.label_zh))
    : (lang === 'en' ? p.label_en : p.label_zh);
  const desc  = pro
    ? (lang === 'en' ? (p.desc_pro_en  || p.desc_en)  : (p.desc_pro_zh  || p.desc_zh))
    : (lang === 'en' ? p.desc_en  : p.desc_zh);

  const xMeta = INPUT_META[p.xKey] || { min: -400, max: 400, step: 1 };
  const yMeta = INPUT_META[p.yKey] || { min: -400, max: 400, step: 1 };
  const xVal = values[p.xKey];
  const yVal = values[p.yKey];
  return `
    <div class="linkage-point">
      <div class="linkage-point-label">${escapeHtml(label)}</div>
      <div class="linkage-point-desc">${escapeHtml(desc)}</div>
      <div class="linkage-xy-row">
        <label>
          <span>${escapeHtml(str.x_label)}</span>
          <input type="number" data-input="${p.xKey}"
                 min="${xMeta.min}" max="${xMeta.max}" step="${xMeta.step}"
                 value="${xVal}"
                 oninput="setInputValue('${p.xKey}', this.value)"/>
          <span class="linkage-unit">${escapeHtml(str.units)}</span>
        </label>
        <label>
          <span>${escapeHtml(str.y_label)}</span>
          <input type="number" data-input="${p.yKey}"
                 min="${yMeta.min}" max="${yMeta.max}" step="${yMeta.step}"
                 value="${yVal}"
                 oninput="setInputValue('${p.yKey}', this.value)"/>
          <span class="linkage-unit">${escapeHtml(str.units)}</span>
        </label>
      </div>
    </div>
  `;
}

function renderLengthCard(def, lengths, lang, str) {
  const labelTxt = lang === 'en' ? def.label_en : def.label_zh;
  const descTxt  = lang === 'en' ? def.desc_en  : def.desc_zh;
  const v = lengths[def.key];
  return `
    <div class="linkage-point">
      <div class="linkage-point-label">${escapeHtml(labelTxt)}</div>
      <div class="linkage-point-desc">${escapeHtml(descTxt)}</div>
      <div class="linkage-length-row">
        <label>
          <span>${escapeHtml(str.length_label)}</span>
          <input type="number" data-length="${def.key}"
                 min="0" max="800" step="0.5"
                 value="${Number.isFinite(v) ? v.toFixed(2) : ''}"
                 oninput="setLinkageLength('${def.key}', this.value)"/>
          <span class="linkage-unit">${escapeHtml(str.units)}</span>
        </label>
      </div>
    </div>
  `;
}

export function renderLinkageSetup(state) {
  const lang = (state && state.lang) || 'zh';
  const str = UI[lang] || UI.zh;
  const values = (state && state.values) || {};
  const out = computeAll({ ...values });

  // Inline geometric helper: 4↔7 distance at β=0 (RHA=0). This is the
  // baseline the shock body should physically match at static — surface it
  // so the user can sanity-check their measured eye-to-eye against the
  // coords they entered.
  out.Static_Shock_Length = shockLength({ ...values }, 0);

  const readouts = [
    { id: 'Motion_Ratio',                label_zh: '运动比',           label_en: 'Motion Ratio',         unit: '' },
    { id: 'Progression',                 label_zh: '渐进性',           label_en: 'Progression',          unit: '%' },
    { id: 'Rear_Ride_Height',            label_zh: '后部车高参考',     label_en: 'Rear Ride Height',     unit: 'mm' },
    { id: 'Static_Shock_Length',         label_zh: '静态避震长度 (4↔7)', label_en: 'Static Shock Length (4↔7)', unit: 'mm' },
  ];

  const readoutHTML = readouts.map(r => `
    <div class="linkage-readout">
      <div class="linkage-readout-label">${escapeHtml(lang === 'en' ? r.label_en : r.label_zh)}</div>
      <div class="linkage-readout-val"><span data-live="${r.id}">${escapeHtml(fmtReadout(out, r.id, r.unit))}</span></div>
    </div>
  `).join('');

  const mode  = values.Linkage_Mode === 'pro-link' ? 'pro-link' : 'linked';
  const style = (values.Linkage_Input_Style === 'polar' || values.Linkage_Input_Style === 'length')
    ? 'length' : 'cartesian';

  let inputsSection = '';
  if (style === 'length') {
    const fixedPoints = LINKAGE_POINTS.filter(p => FIXED_POINT_KEYS.includes(p.key));
    const fixedHTML = fixedPoints.map(p => renderInputPair(p, values, lang, str, mode)).join('');
    const lengths = currentLengths(values);
    const lengthsHTML = LINKAGE_LENGTHS.map(d => renderLengthCard(d, lengths, lang, str)).join('');
    inputsSection = `
      <div class="section-title">${escapeHtml(str.fixed_title)}</div>
      <div class="linkage-points-desc">${escapeHtml(str.fixed_desc)}</div>
      <div class="linkage-points-grid">${fixedHTML}</div>

      <div class="section-title">${escapeHtml(str.lengths_title)}</div>
      <div class="linkage-points-desc">${escapeHtml(str.lengths_desc)}</div>
      <div class="linkage-points-grid">${lengthsHTML}</div>
    `;
  } else {
    const pointsHTML = LINKAGE_POINTS.map(p => renderInputPair(p, values, lang, str, mode)).join('');
    inputsSection = `
      <div class="section-title">${escapeHtml(str.points_title)}</div>
      <div class="linkage-points-grid">${pointsHTML}</div>
    `;
  }

  const modeToggle = `
    <div class="linkage-mode-card">
      <div class="linkage-mode-title">${escapeHtml(str.mode_title)}</div>
      <div class="linkage-mode-row">
        <button class="linkage-mode-btn ${mode === 'linked'   ? 'active' : ''}"
                onclick="setLinkageMode('linked')">${escapeHtml(str.mode_linked)}</button>
        <button class="linkage-mode-btn ${mode === 'pro-link' ? 'active' : ''}"
                onclick="setLinkageMode('pro-link')">${escapeHtml(str.mode_pro)}</button>
      </div>
      <div class="linkage-mode-desc">${escapeHtml(mode === 'pro-link' ? str.mode_desc_pro : str.mode_desc_linked)}</div>
    </div>
  `;

  const styleToggle = `
    <div class="linkage-mode-card">
      <div class="linkage-mode-title">${escapeHtml(str.style_title)}</div>
      <div class="linkage-mode-row">
        <button class="linkage-mode-btn ${style === 'cartesian' ? 'active' : ''}"
                onclick="setLinkageInputStyle('cartesian')">${escapeHtml(str.style_xy)}</button>
        <button class="linkage-mode-btn ${style === 'length'     ? 'active' : ''}"
                onclick="setLinkageInputStyle('length')">${escapeHtml(str.style_polar)}</button>
      </div>
      <div class="linkage-mode-desc">${escapeHtml(style === 'length' ? str.style_desc_polar : str.style_desc_xy)}</div>
    </div>
  `;

  return `
    <div class="linkage-page">
      <div class="header">
        <h1>${escapeHtml(str.title)}</h1>
        <span class="label-zh">${escapeHtml(str.kicker)}</span>
      </div>
      <div class="desc">${escapeHtml(str.desc)}</div>

      ${modeToggle}
      ${styleToggle}

      <div class="section-title">${escapeHtml(str.readouts)}</div>
      <div class="linkage-readout-strip">${readoutHTML}</div>
      <div class="linkage-chart-wrap">${renderMotionRatioChart(values, lang)}</div>

      <div class="section-title">${escapeHtml(str.diagram_title)}</div>
      ${renderTopologySVG(values, mode)}

      ${inputsSection}

      <div class="section-title">${escapeHtml(str.guide_title)}</div>
      <details class="linkage-guide" open>
        <summary>${escapeHtml(str.guide_title)}</summary>
        <ul>
          <li>${escapeHtml(str.guide_1)}</li>
          <li>${escapeHtml(str.guide_2)}</li>
          <li>${escapeHtml(str.guide_3)}</li>
          <li>${escapeHtml(str.guide_4)}</li>
        </ul>
      </details>

      <div style="margin-top:18px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <button class="preset-btn reset" onclick="resetLinkagePlaceholder()">${escapeHtml(str.reset)}</button>
        <button class="preset-btn" onclick="saveLinkageAsPreset()">${escapeHtml(str.save_preset)}</button>
        <label style="display:flex; gap:6px; align-items:center;">
          <span>${escapeHtml(str.load_library)}</span>
          <select class="dt-input" onchange="loadLinkageFromLibrary(this.value); this.value='';">
            <option value="">${escapeHtml(str.load_library_default)}</option>
            ${Object.entries(CATALOGS.linkages || {}).map(([id, e]) =>
              `<option value="${escapeHtml(id)}">${escapeHtml(e.name || id)}</option>`
            ).join('')}
          </select>
        </label>
      </div>
    </div>
  `;
}
