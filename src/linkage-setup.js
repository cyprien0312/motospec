// ============================================================
// MotoSPEC Linkage Setup page
// Lets the user enter the 5 linkage point coordinates measured
// from the swingarm pivot, and visualises the topology on a
// simplified side-view diagram.
// ============================================================

import { computeAll, INPUT_META } from './formulas.js';

// 5 linkage points the user measures on a real bike. Origin is the
// swingarm pivot bolt; +X forward (toward the front wheel), +Y up.
//
// Two of the five points have a different physical meaning in Pro-Link
// mode (rocker rides on the swingarm instead of the frame). The mode-
// dependent labels are stored in `*_pro` keys and selected at render time.
export const LINKAGE_POINTS = [
  {
    key: 'frame_rocker_pivot',
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
    label_zh: '摇臂上避震连接点',
    label_en: 'Rocker-to-Shock',
    xKey: 'Rocker_To_Shock_X', yKey: 'Rocker_To_Shock_Y',
    desc_zh: '从摇臂枢轴量到摇臂上连接避震下端的转点',
    desc_en: 'From swingarm pivot to the point on the rocker where the shock body attaches',
  },
  {
    key: 'rocker_to_drag',
    label_zh: '摇臂上拉杆连接点',
    label_en: 'Rocker-to-Drag',
    xKey: 'Rocker_To_Drag_X', yKey: 'Rocker_To_Drag_Y',
    desc_zh: '从摇臂枢轴量到摇臂上连接拉杆（drag link）的转点',
    desc_en: 'From swingarm pivot to the point on the rocker where the drag link attaches',
  },
  {
    key: 'drag_to_swingarm',
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
export const LINKAGE_PLACEHOLDER_LINKED = {
  Frame_Rocker_Pivot_X: 30,  Frame_Rocker_Pivot_Y: 120,
  Rocker_To_Shock_X:    10,  Rocker_To_Shock_Y:    145,
  Rocker_To_Drag_X:     55,  Rocker_To_Drag_Y:     95,
  Drag_To_Swingarm_X:   95,  Drag_To_Swingarm_Y:  -15,
  Frame_Shock_Top_X:   200,  Frame_Shock_Top_Y:   480,
};

// Pro-Link variant (Honda): the rocker bell-crank hangs BELOW the swingarm,
// so all three rocker points and the frame tie-rod anchor have negative Y.
//   - Rocker pivot is bolted to the underside of the swingarm.
//   - Shock-attach tip of the rocker reaches up toward the swingarm body.
//   - Drag tip of the rocker reaches forward-and-down toward a low frame anchor.
//   - Frame shock-top is the same upper-frame mount, high and forward.
export const LINKAGE_PLACEHOLDER_PROLINK = {
  Frame_Rocker_Pivot_X: -60, Frame_Rocker_Pivot_Y:  -50,
  Rocker_To_Shock_X:    -40, Rocker_To_Shock_Y:     -10,
  Rocker_To_Drag_X:     -95, Rocker_To_Drag_Y:     -100,
  Drag_To_Swingarm_X:    50, Drag_To_Swingarm_Y:   -120,
  Frame_Shock_Top_X:    200, Frame_Shock_Top_Y:     400,
};

// Backward-compat alias: code that imports LINKAGE_PLACEHOLDER still gets
// the linked-mode default.
export const LINKAGE_PLACEHOLDER = LINKAGE_PLACEHOLDER_LINKED;

export function placeholderForMode(mode) {
  return mode === 'pro-link' ? LINKAGE_PLACEHOLDER_PROLINK : LINKAGE_PLACEHOLDER_LINKED;
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
    desc: '所有坐标以摇臂枢轴螺栓中心为原点，+X 朝前（向前轮）、+Y 朝上，单位 mm。图示按右侧视图绘制——车头朝左、+X 在屏幕上向左。占位坐标只为让公式有数值；实测后图示与运动比才有意义。',
    readouts: '实时读数（Live Readouts）',
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
    mode_linked: '联动式（R7 / RS660）',
    mode_pro:    'Pro-Link（本田）',
    mode_desc_linked: '摇臂三角块固定在车架上，平叉通过一根活动拉杆去拨动它。',
    mode_desc_pro:    '摇臂骑在平叉上、随平叉一起运动；车架底部伸出一根固定拉杆，平叉抬起时把它绊住、迫使其旋转。',
  },
  en: {
    nav: '🔧 Linkage Setup',
    nav_sub: 'Rear suspension geometry',
    title: 'Linkage Setup',
    kicker: 'Enter measured linkage coords → real Motion Ratio, Progression, ride height',
    desc: 'All coordinates use the swingarm pivot bolt as origin, +X forward (toward the front wheel), +Y up, units mm. The diagram is a right-side view — bike faces left, so +X-forward points left on screen. Placeholder coords just keep the formulas numerical; the diagram and motion ratio only become meaningful once you enter real measurements.',
    readouts: 'Live Readouts',
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
    mode_linked: 'Linked (R7 / RS660)',
    mode_pro:    'Pro-Link (Honda)',
    mode_desc_linked: 'Rocker triangle is fixed to the frame; the swingarm drives it through a moving drag/pull link.',
    mode_desc_pro:    'Rocker rides on the swingarm and moves with it; a frame-anchored tie rod "trips" the rocker as the swingarm rises, forcing it to rotate.',
    y_label: 'Y (up/down)',
  },
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
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
  const W = 720, H = 440;

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

  // Small "frame ground" hatch around a frame-fixed pivot — visual cue that
  // this bolt does NOT move with the swingarm.
  const groundHatch = (p, r = 14) => `
    <circle cx="${p.x}" cy="${p.y}" r="${r}" fill="url(#lk-frame-hatch)" opacity="0.45"/>
    <circle cx="${p.x}" cy="${p.y}" r="${r}" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3,2"/>
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

  // Frame-anchor hatches (drawn under the dots) for points fixed to the frame.
  const frameAnchors = `
    ${groundHatch(frameAnchor)}
    ${groundHatch(P.fShock)}
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

export function renderLinkageSetup(state) {
  const lang = (state && state.lang) || 'zh';
  const str = UI[lang] || UI.zh;
  const values = (state && state.values) || {};
  const out = computeAll({ ...values });

  const readouts = [
    { id: 'Motion_Ratio',                label_zh: '运动比',           label_en: 'Motion Ratio',         unit: '' },
    { id: 'Progression',                 label_zh: '渐进性',           label_en: 'Progression',          unit: '%' },
    { id: 'Rear_Wheel_Vertical_Travel',  label_zh: '后轮垂直行程',     label_en: 'Rear Vertical Travel', unit: 'mm' },
    { id: 'Rear_Ride_Height',            label_zh: '后部车高参考',     label_en: 'Rear Ride Height',     unit: 'mm' },
  ];

  const readoutHTML = readouts.map(r => `
    <div class="linkage-readout">
      <div class="linkage-readout-label">${escapeHtml(lang === 'en' ? r.label_en : r.label_zh)}</div>
      <div class="linkage-readout-val"><span data-live="${r.id}">${escapeHtml(fmtReadout(out, r.id, r.unit))}</span></div>
    </div>
  `).join('');

  const mode = values.Linkage_Mode === 'pro-link' ? 'pro-link' : 'linked';
  const pointsHTML = LINKAGE_POINTS.map(p => renderInputPair(p, values, lang, str, mode)).join('');

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

  return `
    <div class="linkage-page">
      <div class="header">
        <h1>${escapeHtml(str.title)}</h1>
        <span class="label-zh">${escapeHtml(str.kicker)}</span>
      </div>
      <div class="desc">${escapeHtml(str.desc)}</div>

      ${modeToggle}

      <div class="section-title">${escapeHtml(str.readouts)}</div>
      <div class="linkage-readout-strip">${readoutHTML}</div>

      <div class="section-title">${escapeHtml(str.diagram_title)}</div>
      ${renderTopologySVG(values, mode)}

      <div class="section-title">${escapeHtml(str.points_title)}</div>
      <div class="linkage-points-grid">${pointsHTML}</div>

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

      <div style="margin-top:18px">
        <button class="preset-btn reset" onclick="resetLinkagePlaceholder()">${escapeHtml(str.reset)}</button>
      </div>
    </div>
  `;
}
