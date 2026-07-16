// ============================================================
// MotoSPEC Chassis Setup page
// Frame geometry, mass + CG, aero share, tire — entered or loaded
// from the chassis catalog. Companion to Linkage Setup.
// All distances in mm, angles in degrees unless noted.
// ============================================================

import { computeAll, INPUT_META } from './formulas.js';
import { CATALOGS } from './catalog.js';

const D2R = Math.PI / 180;

// Field groups shown on the page.
export const CHASSIS_GROUPS = [
  {
    key: 'geometry',
    label_zh: '车架几何',
    label_en: 'Frame Geometry',
    fields: ['Rake_Static', 'WB', 'Swingarm_Length', 'beta_static'],
  },
  {
    key: 'setup',
    label_zh: '车架设定',
    label_en: 'Chassis Setup',
    fields: ['Yoke_Offset', 'Fork_Position'],
  },
  {
    key: 'reference',
    label_zh: '参考设定（测量 Rake 时的状态）',
    label_en: 'Reference Setup (as measured for Rake)',
    fields: ['Fork_Position_ref', 'Fork_Length_ref', 'Shock_Length_ref'],
  },
  {
    key: 'mass_cg',
    label_zh: '质量与重心',
    label_en: 'Mass & CG',
    fields: ['Mass', 'H_CG', 'L_CG', 'front_weight_dist'],
  },
  {
    key: 'aero',
    label_zh: '气动分配',
    label_en: 'Aero Share',
    fields: ['C_f_aero'],
  },
  {
    key: 'tire',
    label_zh: '轮胎',
    label_en: 'Tire',
    fields: ['Rf'],
  },
  {
    key: 'chain',
    label_zh: '链条几何',
    label_en: 'Chain Geometry',
    fields: ['Front_Sprocket_X', 'Front_Sprocket_Y', 'Chain_Pitch'],
  },
];

// All chassis fields a profile carries. Linked-pair siblings (rear_weight_dist,
// C_r_aero) are derived from their primaries on save.
export const CHASSIS_SPEC_FIELDS = [
  'Rake_Static', 'WB', 'Swingarm_Length', 'beta_static',
  'Yoke_Offset', 'Fork_Position',
  'Fork_Position_ref', 'Fork_Length_ref', 'Shock_Length_ref',
  'Mass', 'H_CG', 'L_CG', 'front_weight_dist', 'rear_weight_dist',
  'C_f_aero', 'C_r_aero',
  'Rf',
  'Front_Sprocket_X', 'Front_Sprocket_Y', 'Chain_Pitch',
];

const FIELD_LABELS = {
  Rake_Static:        { en: 'Rake (deg)',                      zh: '后倾角 (度)' },
  WB:                 { en: 'Wheelbase (mm)',                  zh: '轴距 (mm)' },
  Swingarm_Length:    { en: 'Swingarm Length (mm)',            zh: '摇臂长度 (mm)' },
  beta_static:        { en: 'Static Swingarm Angle (deg)',     zh: '静态摇臂角 (度)' },
  Yoke_Offset:        { en: 'Yoke Offset (mm)',                zh: '三星台偏移 (mm)' },
  Fork_Position:      { en: 'Fork Position (mm)',              zh: '前叉伸出量 (mm)' },
  Fork_Position_ref:  { en: 'Ref Fork Position (mm)',          zh: '参考前叉伸出量 (mm)' },
  Fork_Length_ref:    { en: 'Ref Fork Length (mm)',            zh: '参考前叉总长 (mm)' },
  Shock_Length_ref:   { en: 'Ref Shock Length (mm)',           zh: '参考后避震长度 (mm)' },
  Mass:               { en: 'Mass — bike + rider (kg)',        zh: '总质量 (kg)' },
  H_CG:               { en: 'CG Height (mm)',                  zh: '重心高度 (mm)' },
  L_CG:               { en: 'CG → Rear Axle Horizontal (mm)',  zh: '重心到后轴水平距离 (mm)' },
  front_weight_dist:  { en: 'Front Weight Share (0–1)',        zh: '前轮静态重量分配 (0–1)' },
  C_f_aero:           { en: 'Front Aero Share (0–1)',          zh: '前轮气动下压力分配 (0–1)' },
  Rf:                 { en: 'Front Rolling Radius (mm)',       zh: '前轮滚动半径 (mm)' },
  Front_Sprocket_X:   { en: 'Front Sprocket X — fwd of swingarm pivot (mm)',    zh: '前链轮 X — 前于摇臂枢轴 (mm)' },
  Front_Sprocket_Y:   { en: 'Front Sprocket Y — above swingarm pivot (mm)',     zh: '前链轮 Y — 高于摇臂枢轴 (mm)' },
  Chain_Pitch:        { en: 'Chain Pitch (mm)',                                 zh: '链条节距 (mm)' },
};

const UI = {
  zh: {
    title: '🏗 底盘设置',
    kicker: '车架几何 · 质量重心 · 气动分配 · 轮胎',
    desc: '直接输入或从底盘库选择已保存的设定。链接对（前/后重量、前/后气动）会自动同步。',
    save_profile: '💾 保存为底盘配置',
    load_profile: '📂 从底盘库加载',
    library_placeholder: '— 选择底盘配置 —',
    save_prompt: '为该底盘配置命名（例如 "Yamaha R7 (2022)"）',
    readout_trail: '静态拖曳距',
    readout_front_load: '前轮静态载荷',
    readout_rear_load: '后轮静态载荷',
    readout_aero_sum: '气动分配总和',
  },
  en: {
    title: '🏗 Chassis Setup',
    kicker: 'Frame · Mass & CG · Aero · Tire',
    desc: 'Type values directly or load a saved chassis profile from the library. Linked pairs (front/rear weight, front/rear aero) auto-sync.',
    save_profile: '💾 Save as Chassis Profile',
    load_profile: '📂 Load from Chassis Library',
    library_placeholder: '— pick a chassis profile —',
    save_prompt: 'Name this chassis profile (e.g. "Yamaha R7 (2022)")',
    readout_trail: 'Static Trail',
    readout_front_load: 'Static Front Load',
    readout_rear_load: 'Static Rear Load',
    readout_aero_sum: 'Σ Aero Share',
  },
};

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function fmt(n, dec = 2) {
  if (!Number.isFinite(n)) return '—';
  const av = Math.abs(n);
  const d = av >= 1000 ? 0 : av >= 100 ? 1 : dec;
  return n.toFixed(d);
}

// Slugify a free-form profile name into a stable id.
export function slugifyChassisName(name) {
  const base = String(name || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `chassis-${Date.now()}`;
}

// Build a chassis catalog entry from current values. `rear_weight_dist` and
// `C_r_aero` are derived from their primaries at save time. Any field that
// is missing or non-finite in `values` is backfilled from INPUT_META.def
// so the saved profile is always complete (downstream code reads keys off
// `entry.specs` to decide which inputs are "bound").
export function buildChassisPresetEntry(name, values) {
  const specs = {};
  for (const f of CHASSIS_SPEC_FIELDS) {
    const v = values?.[f];
    if (v != null && Number.isFinite(v)) {
      specs[f] = v;
    } else if (INPUT_META[f] && Number.isFinite(INPUT_META[f].def)) {
      specs[f] = INPUT_META[f].def;
    }
  }
  // Recompute linked pairs from primaries to guarantee the profile is consistent.
  if (specs.front_weight_dist != null) specs.rear_weight_dist = +(1 - specs.front_weight_dist).toFixed(3);
  if (specs.C_f_aero != null)          specs.C_r_aero         = +(1 - specs.C_f_aero).toFixed(3);
  return { name: String(name || '').trim() || 'Chassis Profile', specs };
}

// ----- Diagram --------------------------------------------------------------
// Side-view of a generic sport-bike, scaled by WB + Rf. Bike faces LEFT
// (front wheel on the left of the screen). Coordinates are in millimetres
// in the bike frame; SVG is auto-fit around the bounding box at render time.

function chassisGeometry(values) {
  const v = values || {};
  const WB    = Math.max(800,  +v.WB              || 1400);
  const Rf    = Math.max(150,  +v.Rf              || 310);
  const LSA   = Math.max(300,  +v.Swingarm_Length || 580);
  const beta  = (+v.beta_static  || 14) * D2R;
  const rake  = (+v.Rake_Static  || 24) * D2R;
  const yoke  = +v.Yoke_Offset   || 32;
  const fp    = +v.Fork_Position || 5;
  const HCG   = Math.max(300,  +v.H_CG || 650);
  const LCG   = Math.max(300,  +v.L_CG || 750);
  const fwd   = Math.min(1, Math.max(0, +v.front_weight_dist || 0.5));
  const Rr    = Rf; // rear rolling radius unknown — assume same as front for the diagram

  // Bike frame: rear contact patch at origin, +X forward (toward front wheel),
  // +Y up. Both axles are at height = rolling radius.
  const rearContact  = { x: 0,  y: 0 };
  const rearAxle     = { x: 0,  y: Rr };
  const frontContact = { x: WB, y: 0 };
  const frontAxle    = { x: WB, y: Rf };

  // Swingarm pivot: ahead of the rear axle by L*cosβ, above by L*sinβ.
  const swingPivot = {
    x: rearAxle.x + LSA * Math.cos(beta),
    y: rearAxle.y + LSA * Math.sin(beta),
  };

  // Steering head: pick a sport-bike-typical height; place it so a line at
  // angle `rake` from vertical, offset by `yoke` perpendicular to the
  // steering axis, hits the front axle.
  const steerHeadHeight = 0.55 * WB; // ~770 mm at WB=1400 — sport-bike norm
  // Steering axis direction (from head down to road), as a unit vector.
  const sax = Math.sin(rake), say = -Math.cos(rake);
  // Vertical drop from head to axle plane:
  const dy = steerHeadHeight - frontAxle.y;
  // Distance along steering axis from head to the foot at axle height,
  // accounting for yoke offset (the axle sits forward of the steering axis by `yoke`).
  // axisFoot = steerHead + t * (sax, say), with axisFoot.y = frontAxle.y → t = dy / -say.
  const t = dy / -say;
  // axisFoot.x at axle height:
  const axisFootX = frontAxle.x - yoke * Math.cos(rake); // axle offset forward of axis foot by `yoke` perpendicular
  const steerHead = { x: axisFootX - t * sax, y: steerHeadHeight };

  // CG dot:
  const cg = { x: rearAxle.x + LCG, y: HCG };

  // Chain geometry: front sprocket sits in the frame at (swingPivot + Fsx, +Fsy);
  // rear sprocket follows the rear axle. Pitch radii from tooth count + chain
  // pitch. r = pitch / (2 sin(π / N)) — standard sprocket pitch-circle formula.
  const fsx        = +v.Front_Sprocket_X || 50;
  const fsy        = +v.Front_Sprocket_Y || 10;
  const chainPitch = +v.Chain_Pitch      || 15.875;
  const teethF     = Math.max(8,  +v.Front_Sprocket || 16);
  const teethR     = Math.max(20, +v.Rear_Sprocket  || 42);
  const sprocketRadius = (N) => chainPitch / (2 * Math.sin(Math.PI / N));
  const rSprF = sprocketRadius(teethF);
  const rSprR = sprocketRadius(teethR);
  const frontSprocket = { x: swingPivot.x + fsx, y: swingPivot.y + fsy };
  const rearSprocket  = { x: rearAxle.x,         y: rearAxle.y };
  // Upper external tangent of the two sprockets — this is the loaded chain run,
  // the line whose angle drives theta_chain / AntiSquat.
  const chainDx = rearSprocket.x - frontSprocket.x;
  const chainDy = rearSprocket.y - frontSprocket.y;
  const chainD  = Math.hypot(chainDx, chainDy);
  let chainTop1 = frontSprocket, chainTop2 = rearSprocket;
  let chainBot1 = frontSprocket, chainBot2 = rearSprocket;
  if (chainD > Math.max(rSprF, rSprR)) {
    const phi   = Math.asin(Math.max(-1, Math.min(1, (rSprR - rSprF) / chainD)));
    const theta = Math.atan2(chainDy, chainDx);
    // Upper tangent: rotate the line-of-centers direction by +π/2 then by -phi.
    const aTop = theta + Math.PI / 2 - phi;
    const aBot = theta - Math.PI / 2 + phi;
    chainTop1 = { x: frontSprocket.x + rSprF * Math.cos(aTop), y: frontSprocket.y + rSprF * Math.sin(aTop) };
    chainTop2 = { x: rearSprocket.x  + rSprR * Math.cos(aTop), y: rearSprocket.y  + rSprR * Math.sin(aTop) };
    chainBot1 = { x: frontSprocket.x + rSprF * Math.cos(aBot), y: frontSprocket.y + rSprF * Math.sin(aBot) };
    chainBot2 = { x: rearSprocket.x  + rSprR * Math.cos(aBot), y: rearSprocket.y  + rSprR * Math.sin(aBot) };
  }

  // Fork sliders: line parallel to the steering axis that PASSES THROUGH the
  // front axle (so the fork visibly aligns with the wheel hub regardless of
  // rake / yoke). Steering-axis direction (head → ground) = (sin(rake), -cos(rake)).
  // forkTop sits at sh.y so the fork crown is level with the steerHead;
  // forkBottom extends 40 mm below the axle along the axis direction.
  const forkTop    = { x: frontAxle.x - (steerHeadHeight - frontAxle.y) * Math.tan(rake), y: steerHeadHeight };
  const forkBottom = { x: frontAxle.x, y: frontAxle.y };
  // `Fork_Position` raises the lower triple clamp on the tubes — show as a
  // small tick along the upper fork tube.
  const fpRel = Math.min(1, Math.max(0, fp / 30));
  const fpTick = {
    x: forkTop.x + (forkBottom.x - forkTop.x) * (0.18 + 0.12 * fpRel),
    y: forkTop.y + (forkBottom.y - forkTop.y) * (0.18 + 0.12 * fpRel),
  };

  return {
    WB, Rf, Rr, LSA, beta, rake, yoke, fp, HCG, LCG, fwd,
    rearContact, rearAxle, frontContact, frontAxle,
    swingPivot, steerHead, cg,
    forkTop, forkBottom, fpTick,
    frontSprocket, rearSprocket, rSprF, rSprR, teethF, teethR, chainPitch,
    chainTop1, chainTop2, chainBot1, chainBot2,
  };
}

function renderChassisDiagram(values, lang) {
  const g = chassisGeometry(values);
  const W = 1200, H = 620; // viewport in pixels (wider aspect so the bike fills more horizontally)
  // Compute mm bounding box. Include the wheel circumferences (axles ± rolling
  // radius) so neither wheel gets clipped, plus headroom for the WB / L_CG
  // dimension lines below ground and the rake arc above the steering head.
  const xs = [
    g.rearAxle.x - g.Rr, g.frontAxle.x + g.Rf,   // wheel extents
    g.rearContact.x, g.frontContact.x,
    g.swingPivot.x, g.steerHead.x, g.cg.x,
  ];
  const ys = [
    -120,                                          // dimension lines below ground
    g.rearAxle.y - g.Rr, g.frontAxle.y - g.Rf,   // wheel bottom = ground (already 0)
    g.rearAxle.y + g.Rr, g.frontAxle.y + g.Rf,   // wheel top
    g.swingPivot.y, g.steerHead.y + 100, g.cg.y, // +100 for rake arc above head
  ];
  const padX = 60, padY = 30;                     // mm padding so labels never touch the edge (~5% of bike width)
  const minX = Math.min(...xs) - padX, maxX = Math.max(...xs) + padX;
  const minY = Math.min(...ys) - padY, maxY = Math.max(...ys) + padY;
  const mmW = maxX - minX, mmH = maxY - minY;
  const scale = Math.min((W - 20) / mmW, (H - 20) / mmH);
  // Centre the content inside the SVG: free space = canvas − content,
  // split equally between the two sides on each axis. Bike faces LEFT
  // (so +X-mm maps to −X-screen) and SVG +Y is down (so +Y-mm maps to −Y-screen).
  const hMargin = (W - mmW * scale) / 2;
  const vMargin = (H - mmH * scale) / 2;
  const px = (x) => W - hMargin - (x - minX) * scale;
  const py = (y) => H - vMargin - (y - minY) * scale;
  const ln = (a, b, stroke = '#cbd5e1', sw = 2, dash = '') =>
    `<line x1="${px(a.x).toFixed(1)}" y1="${py(a.y).toFixed(1)}" x2="${px(b.x).toFixed(1)}" y2="${py(b.y).toFixed(1)}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="round"/>`;
  const dot = (p, r = 4, fill = '#fbbf24') =>
    `<circle cx="${px(p.x).toFixed(1)}" cy="${py(p.y).toFixed(1)}" r="${r}" fill="${fill}" stroke="#0c1116" stroke-width="1.2"/>`;
  // Halo stroke around every text label so a passing geometry line can never
  // visually cross the glyphs. paint-order: stroke draws the dark halo first,
  // then the fill on top — net effect is a 3-px-wide background outline that
  // matches the canvas bg.
  const TXT_HALO = 'paint-order:stroke;stroke:#0c1116;stroke-width:3px;stroke-linejoin:round';
  const txt = (p, s, fill = '#cbd5e1', size = 11, anchor = 'middle', dxPx = 0, dyPx = 0) =>
    `<text x="${(px(p.x) + dxPx).toFixed(1)}" y="${(py(p.y) + dyPx).toFixed(1)}" fill="${fill}" font-size="${size}" text-anchor="${anchor}" font-weight="600" style="${TXT_HALO}">${escapeHtml(s)}</text>`;

  // Wheel: simple tire ring + small hub dot. No spokes, no second rim line.
  const wheel = (center, R) => {
    const cxp = px(center.x), cyp = py(center.y);
    const Rpx = R * scale;
    return `
      <circle cx="${cxp.toFixed(1)}" cy="${cyp.toFixed(1)}" r="${Rpx.toFixed(1)}" fill="none" stroke="#cbd5e1" stroke-width="2.5"/>
      <circle cx="${cxp.toFixed(1)}" cy="${cyp.toFixed(1)}" r="3" fill="#cbd5e1"/>
    `;
  };

  // Annotations: WB arrow, Rake arc, swingarm angle arc, H_CG, L_CG, Yoke offset, weight bar.
  const groundY = py(0);
  const annot = [];

  // Ground line
  annot.push(`<line x1="${px(minX + 100)}" y1="${groundY}" x2="${px(maxX - 100)}" y2="${groundY}" stroke="#5a6878" stroke-width="1" stroke-dasharray="3 4"/>`);

  // WB dimension
  const wbY = py(-80);
  annot.push(`<line x1="${px(g.rearContact.x)}" y1="${wbY}" x2="${px(g.frontContact.x)}" y2="${wbY}" stroke="#4ea1ff" stroke-width="1.5"/>`);
  annot.push(`<line x1="${px(g.rearContact.x)}" y1="${groundY}" x2="${px(g.rearContact.x)}" y2="${wbY}" stroke="#4ea1ff" stroke-width="1" stroke-dasharray="2 3"/>`);
  annot.push(`<line x1="${px(g.frontContact.x)}" y1="${groundY}" x2="${px(g.frontContact.x)}" y2="${wbY}" stroke="#4ea1ff" stroke-width="1" stroke-dasharray="2 3"/>`);
  annot.push(txt({ x: (g.rearContact.x + g.frontContact.x) / 2, y: -80 }, `WB ${fmt(g.WB, 0)} mm`, '#4ea1ff', 18, 'middle', 0, -6));

  // Rake arc + label (at steering head)
  const rakeArcR = 60;
  const sh = g.steerHead;
  const rakeArc = `
    <line x1="${px(sh.x)}" y1="${py(sh.y)}" x2="${px(sh.x)}" y2="${py(sh.y) + 80}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2 3"/>
    <line x1="${px(sh.x)}" y1="${py(sh.y)}" x2="${(px(sh.x) - rakeArcR * Math.sin(g.rake)).toFixed(1)}" y2="${(py(sh.y) + rakeArcR * Math.cos(g.rake)).toFixed(1)}" stroke="#f472b6" stroke-width="2"/>
    <path d="M ${px(sh.x)},${py(sh.y) + rakeArcR} A ${rakeArcR},${rakeArcR} 0 0 0 ${(px(sh.x) - rakeArcR * Math.sin(g.rake)).toFixed(1)},${(py(sh.y) + rakeArcR * Math.cos(g.rake)).toFixed(1)}" fill="none" stroke="#f472b6" stroke-width="1.5"/>
  `;
  annot.push(rakeArc);
  annot.push(txt({ x: sh.x, y: sh.y }, `${fmt(g.rake / D2R, 1)}°`, '#f472b6', 18, 'start', -16, 56));

  // Swingarm angle β — vertex at the REAR AXLE (where there's open space and
  // the wheel center is a natural reference). Mirrors the caster-angle indicator
  // at the front for visual consistency.
  const sa = g.rearAxle, sp = g.swingPivot;
  const spx = px(sp.x), spy = py(sp.y);
  const saxs = px(sa.x), says = py(sa.y);
  // Direction from axle toward the pivot (forward-and-up in world; up-left on screen).
  const a2pDx = spx - saxs, a2pDy = spy - says;
  const a2pLen = Math.hypot(a2pDx, a2pDy) || 1;
  const a2pUx = a2pDx / a2pLen, a2pUy = a2pDy / a2pLen;
  const betaArcR = 36;
  // Horizontal reference: from the axle FORWARD (on screen: leftward, since
  // +X-mm maps to −X-screen). Dashed in β colour so it reads as a measurement
  // aid and not a structural member.
  annot.push(`<line x1="${saxs.toFixed(1)}" y1="${says.toFixed(1)}" x2="${(saxs - betaArcR - 28).toFixed(1)}" y2="${says.toFixed(1)}" stroke="#a78bfa" stroke-width="1" stroke-dasharray="2 3" opacity="0.6"/>`);
  // Arc: from horizontal-forward end (saxs - R, says) sweeping COUNTER-clockwise
  // (sweep flag 0; SVG +Y is down → CCW visual = upward) up to the swingarm
  // direction. End point = axle + R · (axle→pivot unit).
  const arcEndX = saxs + betaArcR * a2pUx;
  const arcEndY = says + betaArcR * a2pUy;
  annot.push(`<path d="M ${(saxs - betaArcR).toFixed(1)},${says.toFixed(1)} A ${betaArcR},${betaArcR} 0 0 0 ${arcEndX.toFixed(1)},${arcEndY.toFixed(1)}" fill="none" stroke="#a78bfa" stroke-width="1.5"/>`);
  // β label inside the wedge: bisect the two ray directions (horizontal-fwd
  // = (-1, 0) and axle→pivot = (a2pUx, a2pUy)) and project outward by labelR.
  let bisectX = -1 + a2pUx, bisectY = 0 + a2pUy;
  const bLen = Math.hypot(bisectX, bisectY) || 1;
  bisectX /= bLen; bisectY /= bLen;
  const labelR = betaArcR + 18;
  const betaLabelX = saxs + labelR * bisectX;
  const betaLabelY = says + labelR * bisectY + 4;
  annot.push(`<text x="${betaLabelX.toFixed(1)}" y="${betaLabelY.toFixed(1)}" fill="#a78bfa" font-size="18" text-anchor="end" font-weight="600" style="${TXT_HALO}">β ${escapeHtml(fmt(g.beta / D2R, 1))}°</text>`);

  // Swingarm-length callout — placed BELOW the swingarm (opposite side from
  // the chain, which runs above), rotated parallel to the member.
  const swMidXscr = (saxs + spx) / 2;
  const swMidYscr = (says + spy) / 2;
  // Swingarm direction in screen coords: from rear axle to pivot.
  const swDx = spx - saxs, swDy = spy - says;
  const swLen = Math.hypot(swDx, swDy) || 1;
  const swUx = swDx / swLen, swUy = swDy / swLen;
  // Perp unit: 90° rotation of (swUx, swUy). Choose the one whose Y points
  // DOWN on screen (positive Y), so the label sits below the swingarm.
  let perpX = -swUy, perpY = swUx;
  if (perpY < 0) { perpX = -perpX; perpY = -perpY; }
  const lOffsetPx = 18;
  const lLabelX = swMidXscr + perpX * lOffsetPx;
  const lLabelY = swMidYscr + perpY * lOffsetPx;
  let armAngDeg = Math.atan2(swUy, swUx) * 180 / Math.PI;
  if (armAngDeg > 90 || armAngDeg < -90) armAngDeg += 180;
  annot.push(`<text x="${lLabelX.toFixed(1)}" y="${lLabelY.toFixed(1)}" fill="#a78bfa" font-size="18" text-anchor="middle" font-weight="600" transform="rotate(${armAngDeg.toFixed(1)}, ${lLabelX.toFixed(1)}, ${lLabelY.toFixed(1)})" style="${TXT_HALO}">L ${escapeHtml(fmt(g.LSA, 0))} mm</text>`);

  // H_CG vertical
  annot.push(`<line x1="${px(g.cg.x)}" y1="${groundY}" x2="${px(g.cg.x)}" y2="${py(g.cg.y)}" stroke="#22d3ee" stroke-width="1.5" stroke-dasharray="3 3"/>`);
  annot.push(txt({ x: g.cg.x, y: g.cg.y / 2 }, `H_CG ${fmt(g.HCG, 0)}`, '#22d3ee', 18, 'start', 6, 4));

  // L_CG horizontal (rear axle ground level → CG vertical line)
  annot.push(`<line x1="${px(g.rearContact.x)}" y1="${py(-30)}" x2="${px(g.cg.x)}" y2="${py(-30)}" stroke="#22d3ee" stroke-width="1.5"/>`);
  annot.push(txt({ x: (g.rearContact.x + g.cg.x) / 2, y: -30 }, `L_CG ${fmt(g.LCG, 0)}`, '#22d3ee', 18, 'middle', 0, -4));

  // Yoke offset indicator — drawn at the FORK CROWN (steering head), not the
  // axle. Yoke offset is the perpendicular distance from the steering axis
  // to the fork tube centerline. Tick = perpendicular vector of length yoke
  // applied at the head: end = sh + yoke * (cosRake, sinRake) [perp unit of
  // the steering axis, pointing forward-and-slightly-up in world]. Recomputed
  // from rake & yoke so the indicator self-adjusts when caster or yoke change.
  // End point lands on the rendered fork crown so the indicator visually
  // terminates ON the fork tube the user can see in the diagram.
  const yokeEnd = { x: g.forkTop.x, y: g.forkTop.y };
  const sh_sx = px(sh.x), sh_sy = py(sh.y);
  const ye_sx = px(yokeEnd.x), ye_sy = py(yokeEnd.y);
  // Tick line + small end caps so it reads as a dimension marker.
  annot.push(`<line x1="${sh_sx.toFixed(1)}" y1="${sh_sy.toFixed(1)}" x2="${ye_sx.toFixed(1)}" y2="${ye_sy.toFixed(1)}" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"/>`);
  // End cap dots
  annot.push(`<circle cx="${sh_sx.toFixed(1)}" cy="${sh_sy.toFixed(1)}" r="2.5" fill="#fbbf24"/>`);
  annot.push(`<circle cx="${ye_sx.toFixed(1)}" cy="${ye_sy.toFixed(1)}" r="2.5" fill="#fbbf24"/>`);
  // Label adjacent to the tick midpoint, offset perpendicular to it (in
  // screen coords, on the upper side: negative-Y direction).
  const ymidX = (sh_sx + ye_sx) / 2, ymidY = (sh_sy + ye_sy) / 2;
  let ydx = ye_sx - sh_sx, ydy = ye_sy - sh_sy;
  const ylen = Math.hypot(ydx, ydy) || 1;
  // Perp 90° CCW = (-dy, dx) normalized. Pick the side where Y < 0 (above).
  let ynx = -ydy / ylen, yny = ydx / ylen;
  if (yny > 0) { ynx = -ynx; yny = -yny; }
  const yoff = 12;
  const yokeLabelX = ymidX + ynx * yoff;
  const yokeLabelY = ymidY + yny * yoff + 4; // +4 baseline correction for font
  annot.push(`<text x="${yokeLabelX.toFixed(1)}" y="${yokeLabelY.toFixed(1)}" fill="#fbbf24" font-size="18" text-anchor="middle" font-weight="600" style="${TXT_HALO}">Yoke ${escapeHtml(fmt(g.yoke, 0))}</text>`);

  // Fork position tick on the fork tube
  annot.push(`<circle cx="${px(g.fpTick.x).toFixed(1)}" cy="${py(g.fpTick.y).toFixed(1)}" r="3.5" fill="#fbbf24" stroke="#0c1116" stroke-width="1"/>`);

  // Weight distribution — compact pill in the top-right corner. A thin
  // proportional split rect inside a rounded panel + a single F/R numeric line.
  const wbW = 130, wbH = 30;
  const wpX = W - wbW - 14, wpY = 14;
  const wbSplitX = wpX + 8 + (wbW - 16) * g.fwd;
  annot.push(`
    <rect x="${wpX}" y="${wpY}" width="${wbW}" height="${wbH}" rx="6" ry="6" fill="rgba(15,20,27,0.85)" stroke="#3a4555" stroke-width="1"/>
    <rect x="${wpX + 8}" y="${wpY + wbH - 9}" width="${wbW - 16}" height="3" fill="#1f2630"/>
    <rect x="${wpX + 8}" y="${wpY + wbH - 9}" width="${(wbSplitX - (wpX + 8)).toFixed(1)}" height="3" fill="#4ea1ff" opacity="0.85"/>
    <text x="${wpX + 8}" y="${wpY + 16}" fill="#cbd5e1" font-size="12" font-weight="700" style="${TXT_HALO}">F ${fmt(g.fwd * 100, 0)}% · R ${fmt((1 - g.fwd) * 100, 0)}%</text>
  `);

  return `
    <svg class="chassis-diagram" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img"
         aria-label="${lang === 'en' ? 'Sport-bike side-view with annotated chassis fields' : '运动车侧视图与车架标注'}">
      <rect x="0" y="0" width="${W}" height="${H}" fill="var(--formula-bg, #0f141b)"/>
      ${annot.join('\n')}
      <!-- swingarm -->
      ${ln(g.swingPivot, g.rearAxle, '#cbd5e1', 4)}
      <!-- forks -->
      ${ln(g.forkTop, g.forkBottom, '#cbd5e1', 4)}
      <!-- frame skeleton: steering head → swingarm pivot -->
      ${ln(g.steerHead, g.swingPivot, '#cbd5e1', 1.6, '4 4')}
      <!-- wheels -->
      ${wheel(g.frontAxle, g.Rf)}
      ${wheel(g.rearAxle,  g.Rr)}
      <!-- chain: sprockets + upper (loaded) + lower run -->
      <circle cx="${px(g.frontSprocket.x).toFixed(1)}" cy="${py(g.frontSprocket.y).toFixed(1)}" r="${(g.rSprF * scale).toFixed(1)}" fill="rgba(132,204,22,0.10)" stroke="#84cc16" stroke-width="1.5"/>
      <circle cx="${px(g.rearSprocket.x).toFixed(1)}"  cy="${py(g.rearSprocket.y).toFixed(1)}"  r="${(g.rSprR * scale).toFixed(1)}" fill="rgba(132,204,22,0.10)" stroke="#84cc16" stroke-width="1.5"/>
      ${ln(g.chainTop1, g.chainTop2, '#84cc16', 2)}
      ${ln(g.chainBot1, g.chainBot2, '#84cc16', 1.6, '4 3')}
      ${dot(g.frontSprocket, 2.5, '#84cc16')}
      <!-- key dots: swingarm pivot, CG, steering head -->
      ${dot(g.swingPivot, 4, '#a78bfa')}
      ${dot(g.cg, 5, '#22d3ee')}
      ${dot(g.steerHead, 4, '#f472b6')}
      ${txt(g.cg, 'CG', '#22d3ee', 18, 'start', 8, -4)}
    </svg>
  `;
}

// ----- Page renderer --------------------------------------------------------

function fieldHeaderCell(field, lang) {
  const labels = FIELD_LABELS[field] || { en: field, zh: field };
  const label = lang === 'en' ? labels.en : labels.zh;
  return `<th class="chassis-th">${escapeHtml(label)}</th>`;
}

function fieldInputCell(field, values) {
  const m = INPUT_META[field] || {};
  const v = values[field];
  const step = m.step != null ? m.step : 'any';
  const minA = m.min != null ? ` min="${m.min}"` : '';
  const maxA = m.max != null ? ` max="${m.max}"` : '';
  const val = (v == null || !Number.isFinite(v)) ? '' : v;
  return `<td class="chassis-td">` +
    `<input type="number" class="chassis-input" value="${val}" step="${step}"${minA}${maxA}` +
    ` oninput="setChassisInput('${field}', this.value)"/></td>`;
}

function groupTable(g, values, lang) {
  const headers = g.fields.map(f => fieldHeaderCell(f, lang)).join('');
  const inputs  = g.fields.map(f => fieldInputCell(f, values)).join('');
  return `
    <div class="chassis-table-wrap">
      <table class="chassis-table">
        <thead><tr>${headers}</tr></thead>
        <tbody><tr>${inputs}</tr></tbody>
      </table>
    </div>
  `;
}

function readoutStrip(out, values, str) {
  const aeroSum = ((+values.C_f_aero || 0) + (+values.C_r_aero || 0)).toFixed(2);
  const cells = [
    { label: str.readout_trail,      val: fmt(out.Trail_Static),     unit: 'mm' },
    { label: str.readout_front_load, val: fmt(out.W_F_Static),       unit: 'N'  },
    { label: str.readout_rear_load,  val: fmt(out.W_R_Static),       unit: 'N'  },
    { label: str.readout_aero_sum,   val: aeroSum,                   unit: ''   },
  ];
  return cells.map(c => `
    <div class="linkage-readout">
      <div class="linkage-readout-label">${escapeHtml(c.label)}</div>
      <div class="linkage-readout-val">${escapeHtml(c.val)}${c.unit ? ' ' + c.unit : ''}</div>
    </div>
  `).join('');
}

function libraryDropdown(currentId, str) {
  const entries = Object.entries(CATALOGS.chassis || {});
  const opts = [`<option value="">${escapeHtml(str.library_placeholder)}</option>`]
    .concat(entries.map(([id, e]) =>
      `<option value="${escapeHtml(id)}"${id === currentId ? ' selected' : ''}>${escapeHtml(e.name || id)}</option>`));
  return `
    <select class="chassis-library" onchange="loadChassisFromLibrary(this.value); this.value=''">
      ${opts.join('')}
    </select>
  `;
}

export function renderChassisSetup({ values, lang } = {}) {
  const v = values || {};
  const out = computeAll({ ...v });
  const L = lang === 'en' ? 'en' : 'zh';
  const str = UI[L];

  const groupsHtml = CHASSIS_GROUPS.map(g => `
    <section class="chassis-group">
      <h2 class="chassis-group-title">${escapeHtml(L === 'en' ? g.label_en : g.label_zh)}</h2>
      ${groupTable(g, v, L)}
    </section>
  `).join('');

  return `
    <div class="chassis-page">
      <div class="header">
        <h1>${escapeHtml(str.title)}</h1>
        <span class="label-zh">${escapeHtml(str.kicker)}</span>
        <p class="chassis-desc">${escapeHtml(str.desc)}</p>
      </div>

      <div class="linkage-readout-strip chassis-readout-strip">
        ${readoutStrip(out, v, str)}
      </div>

      <div class="chassis-diagram-wrap">
        ${renderChassisDiagram(v, L)}
      </div>

      <div class="chassis-actions">
        ${libraryDropdown(v.__chassis_profile_id || '', str)}
        <button class="chassis-btn" onclick="saveChassisAsPreset()">${escapeHtml(str.save_profile)}</button>
      </div>

      ${groupsHtml}
    </div>
  `;
}
