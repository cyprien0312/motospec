// ============================================================
// MotoSPEC Linkage Setup page
// Lets the user enter the 5 linkage point coordinates measured
// from the swingarm pivot, and visualises the topology on a
// simplified side-view diagram.
// ============================================================

import { computeAll, INPUT_META } from './formulas.js';

// 5 linkage points the user measures on a real bike. Origin is the
// swingarm pivot bolt; +X forward (toward the front wheel), +Y up.
export const LINKAGE_POINTS = [
  {
    key: 'frame_rocker_pivot',
    label_zh: '摇臂枢轴在车架上的位置',
    label_en: 'Frame Rocker Pivot',
    xKey: 'Frame_Rocker_Pivot_X', yKey: 'Frame_Rocker_Pivot_Y',
    desc_zh: '从摇臂枢轴量到车架上摇臂转点的距离（前为正、上为正）',
    desc_en: "From swingarm pivot bolt to the rocker arm's frame-side pivot bolt (X forward, Y up)",
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
    xKey: 'Drag_To_Swingarm_X', yKey: 'Drag_To_Swingarm_Y',
    desc_zh: '从摇臂枢轴量到拉杆与摇臂相连的螺栓中心（点位于摇臂上）',
    desc_en: 'From swingarm pivot to the bolt where the drag link meets the swingarm (this point lives on the swingarm)',
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

export const LINKAGE_PLACEHOLDER = {
  Frame_Rocker_Pivot_X: -50, Frame_Rocker_Pivot_Y: 80,
  Rocker_To_Shock_X: -65,    Rocker_To_Shock_Y: 100,
  Rocker_To_Drag_X: -45,     Rocker_To_Drag_Y: 60,
  Drag_To_Swingarm_X: 40,    Drag_To_Swingarm_Y: -10,
  Frame_Shock_Top_X: -200,   Frame_Shock_Top_Y: 300,
};

const UI = {
  zh: {
    nav: '🔧 连杆几何',
    nav_sub: '后悬挂点位测量',
    title: '连杆几何 / Linkage Setup',
    kicker: '输入实测连杆坐标 → 真实的运动比、渐进性与车高',
    desc: '所有坐标以摇臂枢轴螺栓中心为原点，+X 朝前（向前轮）、+Y 朝上，单位 mm。占位坐标只是为了让公式有数值，实测后图示与运动比才有意义。',
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
  },
  en: {
    nav: '🔧 Linkage Setup',
    nav_sub: 'Rear suspension geometry',
    title: 'Linkage Setup',
    kicker: 'Enter measured linkage coords → real Motion Ratio, Progression, ride height',
    desc: 'All coordinates use the swingarm pivot bolt as origin, +X forward (toward the front wheel), +Y up, units mm. The placeholder coords just keep the formulas numerical — the diagram and motion ratio only become meaningful once you enter real measurements.',
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
// the swingarm pivot (+X forward, +Y up). We project that into a 600×400
// SVG with the swingarm pivot at (svgX0, svgY0). SVG +Y is down so we
// invert Y when plotting.
function renderTopologySVG(values) {
  const W = 600, H = 400;
  const svgX0 = 380; // swingarm pivot on screen — shifted right so most points (negative X) fit on the left
  const svgY0 = 270; // and up a bit so positive-Y points (rocker, shock top) fit above
  const scale = 0.8; // 1 mm = 0.8 px → 250 mm range maps to 200 px

  const swingarmLength = values.Swingarm_Length || 580;
  // Rear axle in mm: along the swingarm at static angle, +X forward means rear is BEHIND pivot, so rear axle X is negative (in fact rear axle is opposite to "forward"). To keep the diagram intuitive we draw the swingarm extending backward (negative X-on-bike) — but our convention says +X is forward. So rear axle is at (−swingarmLength·cosβ, −swingarmLength·sinβ).
  const beta = (values.beta_static || 14) * Math.PI / 180;
  const rearAxleMM = { x: -swingarmLength * Math.cos(beta), y: -swingarmLength * Math.sin(beta) };

  // Helpers that convert a mm point to SVG coords.
  const mm2svg = (mx, my) => ({
    x: svgX0 + mx * scale,
    y: svgY0 - my * scale, // invert
  });

  const pivot   = mm2svg(0, 0);
  const rearAxle = mm2svg(rearAxleMM.x, rearAxleMM.y);
  const fRocker  = mm2svg(values.Frame_Rocker_Pivot_X, values.Frame_Rocker_Pivot_Y);
  const rShock   = mm2svg(values.Rocker_To_Shock_X,    values.Rocker_To_Shock_Y);
  const rDrag    = mm2svg(values.Rocker_To_Drag_X,     values.Rocker_To_Drag_Y);
  const dSwg     = mm2svg(values.Drag_To_Swingarm_X,   values.Drag_To_Swingarm_Y);
  const fShock   = mm2svg(values.Frame_Shock_Top_X,    values.Frame_Shock_Top_Y);

  // Backdrop: ground line + frame outline (very crude, evocative)
  const groundY = svgY0 + 70; // ~90mm below pivot
  const backdrop = `
    <line x1="20" y1="${groundY}" x2="${W-20}" y2="${groundY}" stroke="#3a4555" stroke-width="2"/>
    <text x="30" y="${groundY+18}" fill="#5a6878" font-size="11">ground</text>
    <!-- crude frame triangle behind upper-shock mount -->
    <path d="M ${fShock.x-30} ${fShock.y-10} L ${fShock.x+50} ${fShock.y+30} L ${pivot.x+30} ${pivot.y-30} Z"
          fill="rgba(90,104,120,0.08)" stroke="#3a4555" stroke-width="1" stroke-dasharray="4,3"/>
  `;

  // Linkage lines
  const stroke = '#4ea1ff', stroke2 = '#ff8c5a', stroke3 = '#c084fc', stroke4 = '#4ade80';
  const lines = `
    <!-- swingarm -->
    <line x1="${pivot.x}" y1="${pivot.y}" x2="${rearAxle.x}" y2="${rearAxle.y}" stroke="#5a6878" stroke-width="6" stroke-linecap="round"/>
    <!-- swingarm pivot → drag-to-swingarm point (also on swingarm) -->
    <line x1="${pivot.x}" y1="${pivot.y}" x2="${dSwg.x}" y2="${dSwg.y}" stroke="${stroke4}" stroke-width="2" stroke-dasharray="4,3"/>
    <!-- drag link: drag-to-swingarm → rocker-to-drag -->
    <line x1="${dSwg.x}" y1="${dSwg.y}" x2="${rDrag.x}" y2="${rDrag.y}" stroke="${stroke3}" stroke-width="3"/>
    <!-- rocker arm side 1: rocker-to-drag → frame-rocker-pivot -->
    <line x1="${rDrag.x}" y1="${rDrag.y}" x2="${fRocker.x}" y2="${fRocker.y}" stroke="${stroke}" stroke-width="3"/>
    <!-- rocker arm side 2: frame-rocker-pivot → rocker-to-shock -->
    <line x1="${fRocker.x}" y1="${fRocker.y}" x2="${rShock.x}" y2="${rShock.y}" stroke="${stroke}" stroke-width="3"/>
    <!-- shock body: rocker-to-shock → frame-shock-top -->
    <line x1="${rShock.x}" y1="${rShock.y}" x2="${fShock.x}" y2="${fShock.y}" stroke="${stroke2}" stroke-width="4" stroke-linecap="round"/>
  `;

  const point = (p, label, color, dx = 8, dy = -6) => `
    <circle cx="${p.x}" cy="${p.y}" r="5" fill="${color}" stroke="#0c1116" stroke-width="1.5"/>
    <text x="${p.x + dx}" y="${p.y + dy}" fill="${color}" font-size="11" font-weight="600">${escapeHtml(label)}</text>
  `;

  const points = `
    ${point(pivot,     'swingarm pivot', '#e6edf3', -110, -8)}
    ${point(rearAxle,  'rear axle',      '#5a6878', -80, 18)}
    ${point(fRocker,   'frame rocker',   stroke,    8, -8)}
    ${point(rShock,    'rocker→shock',   stroke,    8, 14)}
    ${point(rDrag,     'rocker→drag',    stroke3,  -110, -8)}
    ${point(dSwg,      'drag→swingarm',  stroke4,   8, 16)}
    ${point(fShock,    'frame shock top',stroke2,  -130, 4)}
  `;

  return `
    <svg class="linkage-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Linkage topology side view">
      ${backdrop}
      ${lines}
      ${points}
    </svg>
  `;
}

function renderInputPair(p, values, lang, str) {
  const label = lang === 'en' ? p.label_en : p.label_zh;
  const desc  = lang === 'en' ? p.desc_en  : p.desc_zh;
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

  const pointsHTML = LINKAGE_POINTS.map(p => renderInputPair(p, values, lang, str)).join('');

  return `
    <div class="linkage-page">
      <div class="header">
        <h1>${escapeHtml(str.title)}</h1>
        <span class="label-zh">${escapeHtml(str.kicker)}</span>
      </div>
      <div class="desc">${escapeHtml(str.desc)}</div>

      <div class="section-title">${escapeHtml(str.readouts)}</div>
      <div class="linkage-readout-strip">${readoutHTML}</div>

      <div class="section-title">${escapeHtml(str.diagram_title)}</div>
      ${renderTopologySVG(values)}

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
