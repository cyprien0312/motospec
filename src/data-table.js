// ============================================================
// MotoSPEC Data Table view — editable per-bike profiles
// Mirrors motospec-style-table.csv structure
// ============================================================

import { computeAll, INPUT_META, defaultValues, P } from './formulas.js';
import { REFERENCE_BIKES } from './reference-bikes.js';
import { CATALOGS } from './catalog.js';
// Measurement conventions are string metadata, not part of any numeric
// definition domain — so unlike CHASSIS_PROVIDED (deliberately duplicated
// and guarded by tests/domains.test.js) there is one source for the option
// labels and we import it rather than restating it.
import { chassisEnumLabel, chassisEnumIsUnmodelled } from './chassis-setup.js';

// Walk P[id].deps transitively to all leaf inputs the formula consumes.
// Used to decide whether a RESULTS cell can be computed for a given bike,
// or should be left blank because some required input isn't bound to any
// component / chassis profile / user override.
// A node may declare `skipDepsWhen`: dependencies that drop out of the
// calculation entirely under a stated condition (see swingarm_delta_solve
// — zero shock delta short-circuits before the linkage is touched). The
// condition is only trusted when the keys it reads are themselves bound;
// an unbound key still holds its INPUT_META default, which proves nothing.
function skippedDeps(node, values, ready) {
  const rule = node.skipDepsWhen;
  if (!rule || !values || !ready) return null;
  for (const k of rule.requires) if (!ready.has(k)) return null;
  return rule.test(values) ? new Set(rule.deps) : null;
}

const _leafCache = new Map();
function leafInputsFor(id, values = null, ready = null) {
  // Cache only the unconditional walk; the conditional one is cheap and
  // depends on per-bike values.
  const cacheable = !values || !ready;
  if (cacheable && _leafCache.has(id)) return _leafCache.get(id);
  const out = new Set();
  const seen = new Set();
  const walk = (k) => {
    if (seen.has(k)) return;
    seen.add(k);
    const p = P[k];
    if (!p) { out.add(k); return; }
    if (p.type === 'input' || !Array.isArray(p.deps) || p.deps.length === 0) {
      out.add(k); return;
    }
    const skip = skippedDeps(p, values, ready);
    for (const d of p.deps) if (!skip || !skip.has(d)) walk(d);
  };
  walk(id);
  if (cacheable) _leafCache.set(id, out);
  return out;
}

// Inputs that a saved Chassis profile contributes (matches
// CHASSIS_SPEC_FIELDS in chassis-setup.js). Duplicated here to keep
// data-table.js free of cross-file imports — tests/domains.test.js
// asserts the two lists stay identical.
export const CHASSIS_PROVIDED = new Set([
  'Rake_Static','WB','Swingarm_Length','beta_static',
  'Yoke_Offset','Fork_Position',
  'Fork_Position_ref','Shock_Length_ref','Swingarm_Length_ref','Yoke_Offset_ref',
  'Mass','H_CG','L_CG','front_weight_dist','rear_weight_dist',
  'C_f_aero','C_r_aero','Rf',
  'Front_Sprocket_X','Front_Sprocket_Y','Chain_Pitch',
]);

// Chassis-domain keys that are per-column ADJUSTABLE SETUP numbers, not
// frame measurements: the chassis profile supplies the measured baseline
// (`*_ref` fields) and a starting value; the table then accepts a
// per-column override, exactly like real MotoSPEC lets you dial offset /
// fork position / chain adjuster after picking a frame. The delta chain
// in formulas.js computes attitude/wheelbase changes against the `*_ref`
// baseline, so an override here is real physics — but ONLY when a chassis
// profile is selected: without the profile there is no baseline, and the
// override is ignored (readiness AND compute), same as any chassis key.
export const SETUP_OVERRIDABLE = new Set([
  'Yoke_Offset', 'Fork_Position', 'Swingarm_Length',
]);

// Chassis-domain keys describing the MASS PICTURE (bike + rider + build).
// Unlike SETUP_OVERRIDABLE these have no `*_ref` coupling — no delta chain
// diffs against them — so a typed value is real physics even with no
// chassis profile selected. They render as ordinary editable inputs, the
// override both feeds compute AND creates readiness, and a chassis
// profile (when selected and carrying the optional mass fields) merely
// provides the starting value. Typing front_weight_dist auto-derives
// rear_weight_dist = 1 − front, mirroring the Chassis Setup page.
export const MASS_OVERRIDABLE = new Set([
  'Mass', 'H_CG', 'L_CG', 'front_weight_dist',
]);

// Inputs that a saved Linkage profile contributes (matches
// LINKAGE_COORD_FIELDS in linkage-setup.js; Linkage_Mode is non-numeric
// and never gates readiness). Same duplication contract as above —
// guarded by tests/domains.test.js.
export const LINKAGE_PROVIDED = new Set([
  'Frame_Rocker_Pivot_X','Frame_Rocker_Pivot_Y',
  'Rocker_To_Shock_X','Rocker_To_Shock_Y',
  'Rocker_To_Drag_X','Rocker_To_Drag_Y',
  'Drag_To_Swingarm_X','Drag_To_Swingarm_Y',
  'Frame_Shock_Top_X','Frame_Shock_Top_Y',
]);

// Reverse-index: input-key → which component can supply it. Built fresh
// per render so user-added catalog entries get picked up. Chassis fields
// are seeded from CHASSIS_PROVIDED since `data/chassis.json` ships empty.
function buildProviderMap() {
  const m = {};
  for (const cat of Object.keys(CATALOGS)) {
    if (cat === 'chassis') continue;
    for (const entry of Object.values(CATALOGS[cat] || {})) {
      for (const k of Object.keys(entry?.specs || {})) {
        if (!m[k]) m[k] = cat;
      }
    }
  }
  for (const k of CHASSIS_PROVIDED) m[k] = 'chassis';
  // Seed linkage coords too — data/linkages.json also ships empty, and
  // without this a fresh install mislabels missing coords as "dynamic".
  for (const k of LINKAGE_PROVIDED) if (!m[k]) m[k] = 'linkages';
  m.Front_Sprocket = 'sprocket';
  m.Rear_Sprocket  = 'sprocket';
  return m;
}

const PROVIDER_LABELS = {
  chassis:  { zh: 'Chassis 配置',  en: 'Chassis profile' },
  forks:    { zh: 'Fork 规格',     en: 'Fork specs' },
  shocks:   { zh: 'Shock 规格',    en: 'Shock specs' },
  linkages: { zh: 'Linkage 坐标',  en: 'Linkage coords' },
  sprocket: { zh: '链轮齿数',      en: 'Sprocket teeth' },
  dynamic:  { zh: '动态量（未支持）', en: 'Dynamic input (not wired)' },
};

// Group missing leaves by which component can supply them, return an
// object suitable for rendering both a short visible hint and a verbose
// tooltip.
function summarizeMissing(missing, providerMap, lang) {
  const groups = new Map();
  for (const k of missing) {
    const prov = providerMap[k] || 'dynamic';
    if (!groups.has(prov)) groups.set(prov, []);
    groups.get(prov).push(k);
  }
  const ordered = ['chassis','forks','shocks','linkages','sprocket','dynamic']
    .filter(p => groups.has(p));
  const shortLabel = (lang === 'en' ? 'Need: ' : '缺：') +
    ordered.map(p => PROVIDER_LABELS[p][lang]).join(' · ');
  const verbose = ordered.map(p =>
    `${PROVIDER_LABELS[p][lang]}（${groups.get(p).join(', ')}）`
  ).join('\n');
  return { shortLabel, verbose };
}

// Set of inputs that the bike has *actually been given* (by chassis /
// component selection or by the user typing into a cell). Inputs absent
// from this set fall back to defaultValues() for compute safety, but the
// corresponding RESULTS cells render blank — we don't pretend a number is
// real when its inputs are placeholders.
// Inputs whose default value (typically 0 = "no adjustment") is itself a
// meaningful real-world value. They stay "ready" even when the user
// hasn't typed anything, so RESULTS that depend on them don't get
// incorrectly tagged as needing input.
export const ALWAYS_READY = new Set([
  'Shock_Clevis_RHA',
  // Sag defaults to 0 = "no load applied" — physically true, not a placeholder.
  'Sag_Front',
  'Sag_Rear',
  // 0 = same fork as the reference setup — physically true, not a placeholder.
  'Fork_Length_Delta',
  // 0 = same tire as the baseline tire — physically true, not a placeholder.
  'Tire_Rf_Delta',
  'Tire_Rr_Delta',
]);

function bikeReadyKeys(bike) {
  const keys = new Set(ALWAYS_READY);
  // Each chosen component contributes its spec keys.
  for (const compKey of Object.keys(COMPONENT_TO_CATALOG)) {
    const cid = bike?.components?.[compKey];
    if (!cid) continue;
    const catName = COMPONENT_TO_CATALOG[compKey];
    const entry = (CATALOGS[catName] || {})[cid];
    if (!entry?.specs) continue;
    for (const k of Object.keys(entry.specs)) keys.add(k);
  }
  // Sprocket teeth count is stored on `components`, not on a catalog.
  if (bike?.components?.front_sprocket != null) keys.add('Front_Sprocket');
  if (bike?.components?.rear_sprocket  != null) keys.add('Rear_Sprocket');
  // Per-bike user overrides (typed into a cell). Chassis-domain keys are
  // excluded: they can only come from a chassis profile (single source of
  // definition), so a legacy override must neither mark them ready nor
  // feed the compute (see effectiveBikeValues). This includes the
  // SETUP_OVERRIDABLE keys — an override alone never makes them ready;
  // readiness comes from the selected chassis profile providing them.
  // MASS_OVERRIDABLE keys are the exception: no ref coupling, so a typed
  // measurement is real on its own and DOES create readiness.
  for (const k of Object.keys(bike?.overrides || {})) {
    if (!CHASSIS_PROVIDED.has(k) || MASS_OVERRIDABLE.has(k)) keys.add(k);
  }
  // Typing the front weight share derives the rear share (1 − front).
  if (Number.isFinite(bike?.overrides?.front_weight_dist)) keys.add('rear_weight_dist');
  return keys;
}

// The selected chassis profile's spec dict, or null when no chassis is
// bound. Read fresh from the live CATALOGS (never cached).
function chassisSpecsOf(bike) {
  const cid = bike?.components?.chassis;
  if (!cid) return null;
  return (CATALOGS.chassis || {})[cid]?.specs || null;
}

// Rebuild a bike's input dict from the LIVE catalogs on every render:
// defaults → chassis specs → fork/shock/linkage specs → sprocket teeth →
// non-chassis user overrides. `bike.values` is deliberately NOT read —
// it holds a copy taken at selection time, and computing from it lets a
// later catalog edit silently diverge from what the cells claim.
export function effectiveBikeValues(bike) {
  const v = defaultValues();
  for (const compKey of Object.keys(COMPONENT_TO_CATALOG)) {
    const cid = bike?.components?.[compKey];
    if (!cid) continue;
    const entry = (CATALOGS[COMPONENT_TO_CATALOG[compKey]] || {})[cid];
    if (entry?.specs) Object.assign(v, entry.specs);
  }
  if (bike?.components?.front_sprocket != null) v.Front_Sprocket = bike.components.front_sprocket;
  if (bike?.components?.rear_sprocket  != null) v.Rear_Sprocket  = bike.components.rear_sprocket;
  const chassisSpecs = chassisSpecsOf(bike);
  for (const [k, val] of Object.entries(bike?.overrides || {})) {
    if (!CHASSIS_PROVIDED.has(k)) v[k] = val;
    // Setup keys accept a per-column override, but only layered on top of
    // a chassis profile that actually provides the key — the `*_ref`
    // baseline the delta chain diffs against comes from that profile.
    else if (SETUP_OVERRIDABLE.has(k) && chassisSpecs && k in chassisSpecs) v[k] = val;
    // Mass-picture keys have no ref coupling — a typed measurement applies
    // with or without a chassis profile. front share derives rear share.
    else if (MASS_OVERRIDABLE.has(k)) {
      v[k] = val;
      if (k === 'front_weight_dist' && Number.isFinite(val)) {
        v.rear_weight_dist = +(1 - val).toFixed(3);
      }
    }
  }
  return v;
}

// Rows tagged with `component: 'fork' | 'shock' | …` render as a
// <select> sourced from the matching catalog. Rows tagged with `input:`
// remain editable number inputs. The RESULTS group is rendered as
// computed read-only cells.
export const ROW_GROUPS = [
  // Chassis geometry is defined in Chassis Setup, full stop — the table
  // shows only the profile selector, like the real MotoSPEC's dropdown
  // references to named definitions. The weight/aero echo rows are gone.
  { header: 'FRAME GEOMETRY', header_zh: '车架几何', rows: [
    { spec: 'Chassis',                                              spec_zh: '底盘',                 component: 'chassis' },
  ]},
  { header: 'FRONT SETTINGS', header_zh: '前部设置', rows: [
    { spec: 'Yoke Offset (mm)',                                     spec_zh: '三星台偏移量 (mm)',    input: 'Yoke_Offset' },
    { spec: 'Fork Position (mm)',                                   spec_zh: '前叉伸出量 (mm)',      input: 'Fork_Position' },
    { spec: 'Fork Position Reference',                              spec_zh: '前叉伸出量口径',       enum: 'Fork_Position_Ref_Type' },
    { spec: 'Fork Length Δ vs Reference (mm)',                      spec_zh: '前叉长度差 vs 参考 (mm)', input: 'Fork_Length_Delta',
      hint: { en: 'Measured length difference vs the reference fork (butt them together). 0 = same fork. Positive = longer = front up.', zh: '与参考前叉并排实测的长度差。0 = 同一支叉。正 = 更长 = 车头抬高。' } },
    { spec: 'Front Tire Radius Δ vs Baseline (mm)',                 spec_zh: '前胎半径差 vs 基线胎 (mm)', input: 'Tire_Rf_Delta',
      hint: { en: 'Loaded rolling-radius difference vs the tire fitted at the baseline measurement. 0 = same tire. Positive = taller = front up, rake opens, and the trail formula uses Rf + Δ.', zh: '相对基线测量时那条前胎的受载滚动半径差。0 = 同款胎。正 = 更高 = 车头抬高、Rake 增大，Trail 公式用 Rf + Δ。' } },
    { spec: 'Fork',                                                 spec_zh: '前叉',                 component: 'fork' },
    { spec: 'Fork Stroke (mm)',                                     spec_zh: '前叉行程 (mm)',        input: 'Fork_Stroke',
      hint: { en: 'Full compression, metal-to-metal, along the fork axis — bump rubber height is included, not subtracted.', zh: '沿叉轴的金属对金属全压缩行程——bump rubber 高度包含在内，不扣除。' } },
    { spec: 'Spring Rate (N/mm)',                                   spec_zh: '前叉弹簧刚度 (N/mm)',  input: 'Front_Spring_Rate' },
    { spec: 'Spring Preload (mm)',                                  spec_zh: '前叉弹簧预压 (mm)',    input: 'Front_Spring_Preload' },
    { spec: 'Oil Level (mm)',                                       spec_zh: '前叉油位 (mm)',        input: 'Front_Oil_Level', status: 'pending' },
    { spec: 'Topout Spring Rate (N/mm)',                            spec_zh: '前叉回顶弹簧刚度 (N/mm)', input: 'Front_Topout_Rate' },
    { spec: 'Topout Spring Effective Length (mm)',                  spec_zh: '前叉回顶弹簧长度 (mm)', input: 'Front_Topout_Length' },
  ]},
  { header: 'REAR SETTINGS', header_zh: '后部设置', rows: [
    { spec: 'Swingarm Length (mm)',                                 spec_zh: '摇臂长度 (mm)',        input: 'Swingarm_Length' },
    { spec: 'Swingarm Length Reference',                            spec_zh: '摇臂长度口径',         enum: 'Swingarm_Length_Ref_Type' },
    { spec: 'Rear Tire Radius Δ vs Baseline (mm)',                  spec_zh: '后胎半径差 vs 基线胎 (mm)', input: 'Tire_Rr_Delta',
      hint: { en: 'Loaded rolling-radius difference vs the baseline rear tire. 0 = same tire. Positive = taller = rear up, rake closes.', zh: '相对基线后胎的受载滚动半径差。0 = 同款胎。正 = 更高 = 车尾抬高、Rake 减小。' } },
    { spec: 'Shock Clevis Ride Height Adjustment (mm)',             spec_zh: '后避震Clevis调整 (mm)', input: 'Shock_Clevis_RHA' },
    { spec: 'Shock',                                                spec_zh: '避震',                 component: 'shock' },
    { spec: 'Shock Length (mm)',                                    spec_zh: '后避震长度 (mm)',      input: 'Shock_Length' },
    { spec: 'Shock Stroke (mm)',                                    spec_zh: '后避震行程 (mm)',      input: 'Shock_Stroke' },
    { spec: 'Spring Rate (N/mm)',                                   spec_zh: '后避震弹簧刚度 (N/mm)', input: 'Rear_Spring_Rate' },
    { spec: 'Spring Preload (mm)',                                  spec_zh: '后避震弹簧预压 (mm)',  input: 'Rear_Spring_Preload' },
    { spec: 'Topout Spring Rate (N/mm)',                            spec_zh: '后避震回顶刚度 (N/mm)', input: 'Rear_Topout_Rate' },
    { spec: 'Topout Spring Effective Length (mm)',                  spec_zh: '后避震回顶长度 (mm)',  input: 'Rear_Topout_Length' },
    { spec: 'Linkage',                                              spec_zh: '连杆',                 component: 'linkage' },
    { spec: 'Rear Ride Height Reference',                           spec_zh: '后车高参考口径',       enum: 'Rear_RH_Ref_Type' },
  ]},
  // Mass picture — per-column measurements (bike + rider + build), typed
  // directly or seeded from a chassis profile that carries the optional
  // mass fields. No ref coupling → editable with or without a profile.
  { header: 'MASS & CG', header_zh: '质量与重心', rows: [
    { spec: 'Mass — bike + rider (kg)',                             spec_zh: '总质量 — 车 + 骑手 (kg)', input: 'Mass',
      hint: { en: 'Wheel weights with rider aboard, race trim (front + rear scale).', zh: '骑手在车上、比赛状态下的前后轮称重之和。' } },
    { spec: 'CG Height (mm)',                                       spec_zh: '重心高度 (mm)',        input: 'H_CG',
      hint: { en: 'Raised-axle weighing method — see docs/measurement-points.md.', zh: '抬轴称重法求得——见 docs/measurement-points.md。' } },
    { spec: 'CG → Rear Axle Horizontal (mm)',                       spec_zh: '重心到后轴水平距离 (mm)', input: 'L_CG',
      hint: { en: 'front share × wheelbase, from level wheel weights.', zh: '= 前轮重量占比 × 轴距（水平称重求得）。' } },
    { spec: 'Front Weight Share (0–1)',                             spec_zh: '前轮重量分配 (0–1)',   input: 'front_weight_dist',
      hint: { en: 'Rear share auto-derives as 1 − front.', zh: '后轮占比自动 = 1 − 前轮占比。' } },
  ]},
  // Mirrors real MotoSPEC's DYNAMIC READINGS group — its potentiometer
  // inputs at 0 play exactly the role our sag inputs play at 0.
  { header: 'LOAD CASE', header_zh: '载荷状态', rows: [
    { spec: 'Front Sag (mm)',                                       spec_zh: '前部下沉量 (mm)',      input: 'Sag_Front',
      hint: { en: 'Measured along the fork axis (zip-tie). 0 = unloaded reference. Typical 25–35 mm.', zh: '沿前叉轴线测量（扎带法）。0 = 未加载参考态。典型 25–35 mm。' } },
    { spec: 'Rear Sag (mm)',                                        spec_zh: '后部下沉量 (mm)',      input: 'Sag_Rear',
      hint: { en: 'Measured vertically at the rear axle. 0 = unloaded reference. Typical 25–35 mm.', zh: '在后轮轴处垂直测量。0 = 未加载参考态。典型 25–35 mm。' } },
    // Component-level stroke percentages: unlike the raw sag millimetres
    // (front along the fork axis, rear vertical at the wheel), these two
    // ARE directly comparable — and they compare across bikes with
    // different stroke lengths, which is the whole point.
    { spec: 'Front Stroke Used (%)',                                spec_zh: '前行程占用率 (%)',     computed: 'Front_Stroke_Pct',
      hint: { en: 'Front sag as a share of full fork stroke. The rest is the margin left for braking and bumps.', zh: '前 sag 占前叉总行程的比例。剩下的就是留给刹车和坑洼的余量。' } },
    { spec: 'Rear Stroke Used (%)',                                 spec_zh: '后行程占用率 (%)',     computed: 'Rear_Stroke_Pct',
      hint: { en: 'Shock compression as a share of full shock stroke, solved through the 4-bar (not wheel travel ÷ motion ratio).', zh: '避震压缩量占总行程的比例，由 4-bar 闭合解出（不是 轮行程 ÷ 运动比）。' } },
    { spec: 'Predicted Front Sag (mm)',                             spec_zh: '预测前部下沉量 (mm)',  computed: 'Sag_Front_Predicted' },
    { spec: 'Predicted Rear Sag (mm)',                              spec_zh: '预测后部下沉量 (mm)',  computed: 'Sag_Rear_Predicted' },
  ]},
  { header: 'SPROCKETS', header_zh: '链轮', rows: [
    { spec: 'Front Sprocket',                                       spec_zh: '前链轮齿数',          input: 'Front_Sprocket' },
    { spec: 'Rear Sprocket',                                        spec_zh: '后链轮齿数',          input: 'Rear_Sprocket' },
    { spec: 'Final Ratio',                                          spec_zh: '最终传动比',          computed: 'Final_Ratio' },
  ]},
  // Single live RESULTS block, zero echo rows — every value is computed at
  // the current load state (sag inputs at 0 give the static values), like
  // the real MotoSPEC. The CofG echo rows (verbatim weight-dist copies) are
  // gone until a mass model computes them; static weight split is visible
  // on the Chassis page.
  { header: 'RESULTS', header_zh: '结果', rows: [
    { spec: 'Rake (degrees)',                                       spec_zh: '后倾角 (度)',         computed: 'MotoSPEC_Rake' },
    { spec: 'Normal Trail (mm)',                                    spec_zh: '法向拖曳距 (mm)',     computed: 'Normal_Trail' },
    { spec: 'Ground Trail (mm)',                                    spec_zh: '拖曳距 (mm)',         computed: 'MotoSPEC_Trail' },
    { spec: 'Rear Ride Height Reference (mm)',                      spec_zh: '后部车高参考 (mm)',   computed: 'Rear_Ride_Height' },
    { spec: 'Swingarm Angle (degrees)',                             spec_zh: '摇臂角度 (度)',       computed: 'Swingarm_Angle' },
    // Three rows carry a display-mode selector, exactly like real
    // MotoSPEC. The mode changes what the number MEANS, not the physics —
    // and comparing two setups across different modes is the single most
    // common way to "find" a discrepancy that isn't there.
    { spec: 'Anti-Squat',                                           spec_zh: '抗蹲',                computed: 'Anti_Squat',
      mode: 'antisquat',
      hint: { en: 'The mode changes what the number means — align it before comparing with anyone else\'s figure.', zh: '口径改变数字的含义——与别人的数字对比前先对齐。' } },
    { spec: 'Progression',                                          spec_zh: '渐进性',              computed: 'Progression',
      mode: 'progression',
      hint: { en: 'Same algorithm, different sweep end point. Full Shock Travel needs a known shock stroke; 100 mm Wheel Travel does not.', zh: '同一算法，不同扫描端点。Full Shock Travel 需要已知避震行程，100mm 轮行程不需要。' } },
    { spec: 'Motion Ratio',                                         spec_zh: '运动比',              computed: 'Motion_Ratio',
      mode: 'motion_ratio',
      hint: { en: 'Wheel/Shock ≈ 2–3; Shock/Wheel is its reciprocal ≈ 0.4–0.5. Same geometry, two readings.', zh: 'Wheel/Shock ≈ 2–3；Shock/Wheel 是其倒数 ≈ 0.4–0.5。同一几何量，两种读法。' } },
    { spec: 'Wheelbase (mm)',                                       spec_zh: '轴距 (mm)',           computed: 'Wheelbase_Live' },
    { spec: 'Front Wheel Rate (N/mm)',                              spec_zh: '前轮综合刚度 (N/mm)', computed: 'Front_Wheel_Rate' },
    { spec: 'Rear Wheel Rate (N/mm)',                               spec_zh: '后轮综合刚度 (N/mm)', computed: 'Rear_Wheel_Rate' },
    { spec: 'Spring Center',                                        spec_zh: '弹簧中心',            computed: 'Spring_Center',
      hint: { en: 'Rear rate ÷ (front + rear). 0.50 = both ends equally stiff; > 0.50 = rear stiffer.', zh: '后刚度 ÷ (前 + 后)。0.50 = 前后等硬；> 0.50 = 后端更硬。' } },
    { spec: 'Wheelie Accel Limit (g)',                              spec_zh: '抬头加速度极限 (g)',  computed: 'Wheelie_Limit',
      hint: { en: 'Forward acceleration that unloads the front wheel. Computed at the attitude where the CG was measured; aero drag lowers it further.', zh: '前轮卸载归零所需的向前加速度。按测量重心时的姿态计算；气动阻力会进一步压低它。' } },
    { spec: 'Braking Accel Limit (g)',                              spec_zh: '制动加速度极限 (g)',  computed: 'Braking_Limit',
      hint: { en: 'Deceleration that unloads the rear wheel. Read it with the bike in a representative braking attitude.', zh: '后轮卸载归零所需的减速度。应在有代表性的刹车姿态下读这个数。' } },
  ]},
];

// ============================================================
// RESULTS display modes
// ============================================================
//
// Real MotoSPEC puts a dropdown on these RESULTS rows because the same
// geometry has several conventional readings, and its own manual warns
// that a bike "changes number" when you switch mode — it isn't a
// miscalculation. Each option just names a different already-computed
// channel; nothing here touches the physics. `pair` renders two values
// in one cell ("angle | load transfer angle"), matching MotoSPEC.
export const RESULT_MODES = {
  antisquat: {
    def: 'percent',
    options: [
      { value: 'percent',      computed: 'Anti_Squat',            en: 'Percent (100 = neutral)',    zh: '百分比（100 = 中性）',   unit: '%' },
      { value: 'percent_delta',computed: 'Anti_Squat_Delta',      en: 'Percent Δ (0 = neutral)',    zh: '百分比偏差（0 = 中性）', unit: '%' },
      { value: 'angle',        pair: ['AntiSquat_Angle', 'Load_Transfer_Angle'],
                                                                  en: 'Angle | Load Transfer Angle', zh: '抗蹲角 | 载荷转移角',   unit: '°' },
      { value: 'angle_delta',  computed: 'AntiSquat_Angle_Delta', en: 'Angle Δ (0 = neutral)',      zh: '角度差（0 = 中性）',     unit: '°' },
    ],
  },
  progression: {
    def: 'full_shock',
    options: [
      { value: 'full_shock', computed: 'Progression',          en: '% Full Shock Travel',  zh: '% 全避震行程',   unit: '%' },
      { value: 'wheel_100',  computed: 'Progression_Wheel100', en: '% 100 mm Wheel Travel',zh: '% 100mm 轮行程', unit: '%' },
    ],
  },
  motion_ratio: {
    def: 'wheel_shock',
    options: [
      { value: 'wheel_shock', computed: 'Motion_Ratio',             en: 'Wheel / Shock', zh: '轮 / 避震', unit: '' },
      { value: 'shock_wheel', computed: 'Motion_Ratio_Shock_Wheel', en: 'Shock / Wheel', zh: '避震 / 轮', unit: '' },
    ],
  },
};

// Resolve a row's active mode option from state (falling back to the
// declared default), so callers never have to repeat the lookup.
export function resolveMode(modeKey, dtModes) {
  const def = RESULT_MODES[modeKey];
  if (!def) return null;
  const want = dtModes && dtModes[modeKey];
  return def.options.find(o => o.value === want) || def.options.find(o => o.value === def.def);
}

// Which row groups each copy scope covers. Derived from ROW_GROUPS
// headers so a new settings row is copied automatically — mirrors real
// MotoSPEC's right-click "copy Front / Rear / All settings".
export const COPY_SCOPES = {
  front: ['FRONT SETTINGS'],
  rear:  ['REAR SETTINGS'],
  all:   ['FRAME GEOMETRY', 'FRONT SETTINGS', 'REAR SETTINGS', 'MASS & CG', 'LOAD CASE', 'SPROCKETS'],
};

// Copy one column's settings onto another, in place. Only what the user
// actually SET travels: component selections and typed overrides. A key
// the source never set is cleared on the destination rather than being
// filled from a default — otherwise "copy" would invent bindings the
// source column never had. Computed rows and the measurement-convention
// enums are skipped (the latter follow the chassis profile, which the
// `all` scope copies via the chassis component row).
export function applyCopyScope(destBike, srcBike, scope) {
  const headers = COPY_SCOPES[scope];
  if (!destBike || !srcBike || !headers) return destBike;
  destBike.overrides  = destBike.overrides  || {};
  destBike.components = destBike.components || {};
  for (const g of ROW_GROUPS) {
    if (!headers.includes(g.header)) continue;
    for (const row of g.rows) {
      if (row.component) {
        const id = srcBike.components?.[row.component];
        if (id) destBike.components[row.component] = id;
        else delete destBike.components[row.component];
      } else if (row.input) {
        const v = srcBike.overrides?.[row.input];
        if (Number.isFinite(v)) {
          destBike.overrides[row.input] = v;
          if (destBike.values) destBike.values[row.input] = v;
        } else {
          delete destBike.overrides[row.input];
        }
      }
    }
  }
  // Sprocket teeth may live on `components` instead of `overrides`.
  if (headers.includes('SPROCKETS')) {
    for (const k of ['front_sprocket', 'rear_sprocket']) {
      if (srcBike.components?.[k] != null) destBike.components[k] = srcBike.components[k];
      else delete destBike.components[k];
    }
  }
  return destBike;
}

// The STATIC badge is retired: with the sag load case live and the echo
// rows removed, no RESULTS row echoes a static input anymore.
const STATUS_BADGE = {
  pending: { en: 'PENDING', zh: '待实现', title_en: 'Input is not yet consumed by any RESULTS formula', title_zh: '该输入尚未被任何 RESULTS 公式消费' },
};

const DASH = '—';

// component bike-key → catalog name
export const COMPONENT_TO_CATALOG = {
  chassis: 'chassis',
  fork: 'forks',
  shock: 'shocks',
  linkage: 'linkages',
};

// All component keys appearing on bike rows (for tests / introspection).
export const COMPONENT_FIELDS = Object.keys(COMPONENT_TO_CATALOG);

export function fmtNum(n) {
  if (n == null || !Number.isFinite(n)) return DASH;
  if (Number.isInteger(n)) return String(n);
  return (Math.round(n * 100) / 100).toString();
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

export function catalogEntriesFor(componentKey) {
  const catalogName = COMPONENT_TO_CATALOG[componentKey];
  const catalog = CATALOGS[catalogName] || {};
  return Object.entries(catalog);
}

export const MAX_BIKES = 5;

export function defaultBikes() {
  return REFERENCE_BIKES.map((b, i) => {
    const baseValues = defaultValues();
    const values = { ...baseValues, ...(b.inputs || {}) };
    return {
      id: `col-${i}`,
      name: b.name,
      values,
      components: { ...(b.components || {}) },
      overrides: {},
    };
  });
}

// Build a fresh blank bike with default values for new columns.
export function blankBike(idx) {
  return {
    id: `col-${idx}-${Date.now()}`,
    name: `Bike ${String.fromCharCode(65 + idx)}`,
    values: defaultValues(),
    components: {},
    overrides: {},
  };
}

// `diff` marks a cell that differs from the HIGHLITE reference column.
const tdClass = (base, diff) => `${base}${diff ? (base ? ' ' : '') + 'dt-diff' : ''}`;
const tdOpen = (base, diff) => {
  const c = tdClass(base, diff);
  return c ? `<td class="${c}">` : '<td>';
};

function inputCell(bikeIdx, key, value, title, missing = false, overridden = false, diff = false) {
  const m = INPUT_META[key] || {};
  const step = m.step != null ? m.step : 'any';
  const minAttr = m.min != null ? ` min="${m.min}"` : '';
  const maxAttr = m.max != null ? ` max="${m.max}"` : '';
  const v = value == null || !Number.isFinite(value) ? '' : value;
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  const cls = 'dt-input'
    + (missing ? ' dt-input-missing' : '')
    + (overridden ? ' dt-input-override' : '');
  return `${tdOpen('', diff)}<input type="number" class="${cls}" value="${v}" step="${step}"${minAttr}${maxAttr}${titleAttr} oninput="setBikeInput(${bikeIdx}, '${key}', this.value)"></td>`;
}

function componentCell(bikeIdx, componentKey, currentId, lang, diff = false) {
  const entries = catalogEntriesFor(componentKey);
  const placeholderLabel = lang === 'en' ? '— pick —' : '— 选择 —';
  const placeholderSel = currentId ? '' : ' selected';
  const placeholderOpt = `<option value=""${placeholderSel}>${escapeHtml(placeholderLabel)}</option>`;
  const optionsHtml = entries.map(([id, entry]) => {
    const sel = id === currentId ? ' selected' : '';
    const label = entry.name || id;
    return `<option value="${escapeHtml(id)}"${sel}>${escapeHtml(label)}</option>`;
  }).join('');
  return `${tdOpen('', diff)}<select class="dt-input" onchange="setBikeComponent(${bikeIdx}, '${componentKey}', this.value)">${placeholderOpt}${optionsHtml}</select></td>`;
}

function readonlyCell(value, diff = false, title = '') {
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  return `<td class="${tdClass('dt-readonly', diff)}"${titleAttr}><span>${escapeHtml(value)}</span></td>`;
}

function literalCell(text, diff = false) {
  return `${tdOpen('dt-readonly', diff)}<span>${escapeHtml(text)}</span></td>`;
}

export function renderDataTable(state) {
  const lang = state?.lang || 'zh';
  const bikes = (state && Array.isArray(state.bikes) && state.bikes.length >= 0 && state.bikes.length <= MAX_BIKES)
    ? state.bikes
    : defaultBikes();

  // Materialize each bike from the live catalogs (not the stale copy in
  // bike.values) so the table always computes with what the chassis /
  // linkage / part definitions say right now.
  const effVals = bikes.map(effectiveBikeValues);
  const outs = effVals.map(v => computeAll({ ...v }));
  // Per-bike set of inputs that are actually bound (env / catalog /
  // override). RESULTS cells whose leaf inputs aren't all bound render
  // blank — we don't show numbers built from placeholder defaults.
  const readyByBike = bikes.map(bikeReadyKeys);
  const providerMap = buildProviderMap();
  // For a given row + per-bike ready-set, return either { ready: true }
  // or { ready: false, missing: [...leafKeys] } so the caller can render
  // a "what's missing" hint on the blank cell.
  // Active display mode per mode-carrying row (see RESULT_MODES).
  const dtModes = (state && state.dtModes && typeof state.dtModes === 'object') ? state.dtModes : {};
  // A mode row computes whichever channel its active option names — the
  // readiness walk has to follow the SAME channel, or a row could show a
  // number in one mode and "Need: …" in another for no real reason.
  const channelsFor = (row) => {
    if (row.mode) {
      const opt = resolveMode(row.mode, dtModes);
      return opt ? (opt.pair || [opt.computed]) : [];
    }
    return row.computed ? [row.computed] : [];
  };
  const cellStatus = (row, ready, values) => {
    let leaves;
    if (row.mode || row.computed) {
      leaves = new Set();
      for (const ch of channelsFor(row)) for (const k of leafInputsFor(ch, values, ready)) leaves.add(k);
    }
    else if (row.derivedFrom) leaves = new Set(row.requires || []);
    else return { ready: true };
    const missing = [];
    for (const k of leaves) if (!ready.has(k)) missing.push(k);
    return missing.length === 0 ? { ready: true } : { ready: false, missing };
  };
  const blankCellHTML = (missing, diff = false) => {
    const { shortLabel, verbose } = summarizeMissing(missing, providerMap, lang);
    return `<td class="${tdClass('dt-readonly dt-missing', diff)}" title="${escapeHtml(verbose)}"><span>${escapeHtml(shortLabel)}</span></td>`;
  };

  // ---- HIGHLITE: mark settings that differ from a reference column -------
  // Real MotoSPEC highlights only SETTINGS (and component selections), not
  // results — the results are the consequence, the settings are what you
  // changed. Same choice here.
  const hl = (state && Number.isInteger(state.dtHighlite)
    && state.dtHighlite >= 0 && state.dtHighlite < bikes.length)
    ? state.dtHighlite : null;
  const chassisEnumOf = (bike, key) => chassisSpecsOf(bike)?.[key] || '';
  const readyVal = (i, key) => (readyByBike[i].has(key) ? effVals[i][key] : null);
  const isDiff = (row, i) => {
    if (hl == null || i === hl) return false;
    if (row.component) return (bikes[i].components?.[row.component] || '') !== (bikes[hl].components?.[row.component] || '');
    if (row.enum)      return chassisEnumOf(bikes[i], row.enum) !== chassisEnumOf(bikes[hl], row.enum);
    if (row.mode)      return false; // a display mode is global, never per-column
    if (row.input)     return readyVal(i, row.input) !== readyVal(hl, row.input);
    return false;
  };

  // ---- Measurement-convention echo (read-only, from the chassis profile) --
  const enumCell = (bike, key, diff) => {
    const specs = chassisSpecsOf(bike);
    if (!specs) return blankCellHTML([key], diff);
    const raw = specs[key];
    if (!raw) {
      return readonlyCell(DASH, diff, lang === 'en'
        ? 'Measurement convention not recorded on this chassis profile — the number may not be comparable to another column.'
        : '该底盘配置没有记录测量口径——这个数与别的列可能不可比。');
    }
    const label = chassisEnumLabel(key, raw, lang) || raw;
    const unmodelled = chassisEnumIsUnmodelled(key, raw);
    const text = unmodelled ? `${label} ${lang === 'en' ? '(not modelled)' : '（未建模）'}` : label;
    const title = unmodelled
      ? (lang === 'en'
          ? 'Recorded convention. The geometry chain still computes as if measured the implemented way.'
          : '已记录该口径。几何链仍按已实现的那种口径计算。')
      : (lang === 'en' ? 'From the chassis profile.' : '来自 Chassis 配置。');
    return readonlyCell(text, diff, title);
  };
  const inputMissingTitle = (key) => {
    const prov = providerMap[key];
    if (!prov || prov === 'dynamic') {
      return lang === 'en' ? 'Type a value, or leave blank' : '直接输入数值，或留空';
    }
    const label = PROVIDER_LABELS[prov][lang];
    return lang === 'en'
      ? `Type a value, or load it from a ${label}`
      : `直接输入数值，或从 ${label} 加载`;
  };

  const removeTitle = lang === 'en' ? 'Remove this column' : '删除该列';
  const addLabel    = lang === 'en' ? '+ Add Bike' : '+ 新增车型';
  const emptyHint   = lang === 'en'
    ? 'No bikes yet — click "+ Add Bike" above to start a comparison column.'
    : '当前没有车型——点击上方"+ 新增车型"添加对比列。';

  const COPY_LABELS = {
    front: { en: 'Front settings', zh: '前部设置' },
    rear:  { en: 'Rear settings',  zh: '后部设置' },
    all:   { en: 'All settings',   zh: '全部设置' },
  };
  const copyPlaceholder = lang === 'en' ? '⧉ copy from…' : '⧉ 从…复制';
  const copySelect = (i) => {
    if (bikes.length < 2) return '';
    const groups = bikes.map((src, j) => {
      if (j === i) return '';
      const opts = Object.keys(COPY_SCOPES)
        .map(sc => `<option value="${j}:${sc}">${escapeHtml(COPY_LABELS[sc][lang])}</option>`)
        .join('');
      return `<optgroup label="${escapeHtml(src.name || `#${j + 1}`)}">${opts}</optgroup>`;
    }).join('');
    return `<select class="dt-copy" onchange="copyBikeFrom(${i}, this.value); this.selectedIndex = 0;">` +
      `<option value="">${escapeHtml(copyPlaceholder)}</option>${groups}</select>`;
  };

  const loggerTitle = lang === 'en'
    ? 'Export MoTeC i2 / AiM RS3 math channels for this bike (needs chassis + linkage + shock stroke)'
    : '导出本车的 MoTeC i2 / AiM RS3 数学通道(需要车架 profile + 连杆 + 避震行程)';
  const bikeHeaders = bikes.map((b, i) =>
    `<th class="dt-bike-head${hl === i ? ' dt-bike-head-ref' : ''}">
      <button class="dt-col-remove" title="${escapeHtml(removeTitle)}" onclick="removeBike(${i})">×</button>
      <input type="text" class="dt-input dt-bike-name" value="${escapeHtml(b.name)}" onchange="setBikeName(${i}, this.value)">
      ${copySelect(i)}
      <button class="dt-logger" title="${escapeHtml(loggerTitle)}" onclick="exportLoggerChannels(${i})">⤓ ${lang === 'en' ? 'logger' : '数采'}</button>
    </th>`
  ).join('');
  const addHeader = bikes.length < MAX_BIKES
    ? `<th class="dt-bike-add"><button class="dt-col-add" onclick="addBike()">${escapeHtml(addLabel)}</button></th>`
    : '';
  const specHeader = lang === 'en' ? 'Parameter' : '参数';
  // Group rows span Parameter + all bike columns (the optional "+ Add" header
  // sits in its own column on the header row only).
  const groupColspan = 1 + bikes.length;

  if (bikes.length === 0) {
    return `
      <div class="dt-wrap">
        <div class="dt-empty"><button class="dt-col-add" onclick="addBike()">${escapeHtml(addLabel)}</button></div>
        <p class="dt-empty-hint">${escapeHtml(emptyHint)}</p>
      </div>
    `;
  }

  // Collapsible groups: clicking a group header folds its rows away
  // (state.dtCollapsed, persisted). The header row stays, showing a caret
  // and the hidden-row count, so a long table folds down to one screen.
  const dtCollapsed = (state && state.dtCollapsed && typeof state.dtCollapsed === 'object')
    ? state.dtCollapsed : {};

  let body = '';
  for (const group of ROW_GROUPS) {
    const groupLabel = lang === 'en'
      ? group.header
      : `${group.header} (${group.header_zh})`;
    const isCollapsed = !!dtCollapsed[group.header];
    const caret = `<span class="dt-caret">${isCollapsed ? '▸' : '▾'}</span>`;
    const count = isCollapsed ? ` <span class="dt-group-count">(${group.rows.length})</span>` : '';
    body += `<tr class="dt-group" onclick="toggleDtGroup('${escapeHtml(group.header)}')"><th colspan="${groupColspan}">${caret}${escapeHtml(groupLabel)}${count}</th></tr>`;
    if (isCollapsed) continue;
    for (const row of group.rows) {
      const baseLabel = lang === 'en' ? row.spec : (row.spec_zh || row.spec);
      const badge = row.status && STATUS_BADGE[row.status]
        ? `<span class="dt-status dt-status-${row.status}" title="${escapeHtml(STATUS_BADGE[row.status][`title_${lang}`])}">${escapeHtml(STATUS_BADGE[row.status][lang])}</span>`
        : '';
      // A mode row carries its own selector in the parameter column, and
      // the active option's unit in the label — so the cell values are
      // never left unlabelled after a mode switch.
      let modeUI = '';
      let unitSuffix = '';
      if (row.mode) {
        const active = resolveMode(row.mode, dtModes);
        unitSuffix = active?.unit ? ` (${active.unit})` : '';
        const opts = RESULT_MODES[row.mode].options.map(o =>
          `<option value="${escapeHtml(o.value)}"${o.value === active?.value ? ' selected' : ''}>${escapeHtml(lang === 'en' ? o.en : o.zh)}</option>`
        ).join('');
        modeUI = `<select class="dt-mode" onchange="setResultMode('${row.mode}', this.value)">${opts}</select>`;
      }
      const label = `${escapeHtml(baseLabel)}${unitSuffix}${badge ? ' ' + badge : ''}${modeUI}`;
      let cells = '';
      for (let i = 0; i < bikes.length; i++) {
        const b = bikes[i];
        const out = outs[i];
        const diff = isDiff(row, i);
        if (row.literal != null) {
          cells += literalCell(row.literal, diff);
        } else if (row.enum) {
          cells += enumCell(b, row.enum, diff);
        } else if (row.component) {
          cells += componentCell(i, row.component, b.components?.[row.component], lang, diff);
        } else if (row.input) {
          const has = readyByBike[i].has(row.input);
          if (CHASSIS_PROVIDED.has(row.input)) {
            if (MASS_OVERRIDABLE.has(row.input)) {
              // Mass-picture measurement: always editable (no ref
              // coupling). A chassis profile carrying the optional mass
              // fields seeds the value; a typed override diverging from
              // that seed gets the amber accent, same as setup keys.
              const baseline = chassisSpecsOf(b)?.[row.input];
              const cur = has ? effVals[i][row.input] : null;
              const overridden = Number.isFinite(baseline) && Number.isFinite(cur) && cur !== baseline;
              const title = overridden
                ? (lang === 'en'
                    ? `Overriding chassis profile value ${fmtNum(baseline)} — clear the cell to restore`
                    : `已覆盖 Chassis 配置值 ${fmtNum(baseline)}——清空单元格即可恢复`)
                : (has ? (row.hint?.[lang] || null) : (row.hint?.[lang] || inputMissingTitle(row.input)));
              cells += inputCell(i, row.input, cur, title, !has, overridden, diff);
            } else if (SETUP_OVERRIDABLE.has(row.input) && has) {
              // Adjustable setup number layered on the selected chassis
              // profile (like real MotoSPEC: pick a frame, then dial
              // offset / fork position / chain adjuster). The profile's
              // `*_ref` fields stay untouched, so the delta chain diffs
              // the override against a real measured baseline.
              const baseline = chassisSpecsOf(b)?.[row.input];
              const cur = effVals[i][row.input];
              const overridden = Number.isFinite(baseline) && cur !== baseline;
              const title = overridden
                ? (lang === 'en'
                    ? `Overriding chassis profile value ${fmtNum(baseline)} — clear the cell to restore`
                    : `已覆盖 Chassis 配置值 ${fmtNum(baseline)}——清空单元格即可恢复`)
                : (lang === 'en'
                    ? 'From the chassis profile — type to adjust this column only'
                    : '来自 Chassis 配置——输入即可仅调整本列');
              cells += inputCell(i, row.input, cur, title, false, overridden, diff);
            } else {
              // All other chassis-domain fields are defined ONLY on the
              // Chassis Setup page. The table echoes the selected profile
              // read-only — an editable cell here would let a column
              // silently diverge from the chassis it claims to use.
              cells += has
                ? readonlyCell(fmtNum(effVals[i][row.input]), diff)
                : blankCellHTML([row.input], diff);
            }
          } else {
            // Show the value only when it's been actually set; otherwise
            // leave the cell blank and let the user fill it in. A tooltip
            // hints at where the value would normally come from — or, for
            // ready rows carrying a `hint`, at how to measure it.
            const v = has ? effVals[i][row.input] : null;
            const title = has ? (row.hint?.[lang] || null) : inputMissingTitle(row.input);
            cells += inputCell(i, row.input, v, title, !has, false, diff);
          }
        } else if (row.derivedFrom) {
          const st = cellStatus(row, readyByBike[i], effVals[i]);
          cells += st.ready
            ? readonlyCell(fmtNum(row.derivedFrom(out)), false, row.hint?.[lang] || '')
            : blankCellHTML(st.missing);
        } else if (row.mode || row.computed) {
          const st = cellStatus(row, readyByBike[i], effVals[i]);
          const text = channelsFor(row).map(ch => fmtNum(out[ch])).join(' | ');
          cells += st.ready
            ? readonlyCell(text, false, row.hint?.[lang] || '')
            : blankCellHTML(st.missing);
        } else {
          cells += readonlyCell(DASH);
        }
      }
      body += `<tr><th class="dt-spec">${label}</th>${cells}</tr>`;
    }
  }

  const hlLabel = lang === 'en' ? 'HIGHLITE' : '差异高亮';
  const hlOff   = lang === 'en' ? 'off' : '关闭';
  const hlHint  = lang === 'en'
    ? 'Pick a reference column — settings that differ from it are highlighted in the other columns.'
    : '选一列作参考——其余列中与它不同的设置会被高亮。';
  const hlOptions = [`<option value=""${hl == null ? ' selected' : ''}>${escapeHtml(hlOff)}</option>`]
    .concat(bikes.map((b, i) =>
      `<option value="${i}"${hl === i ? ' selected' : ''}>${escapeHtml(b.name || `#${i + 1}`)}</option>`))
    .join('');
  const toolbar = `
    <div class="dt-toolbar">
      <label class="dt-tool-label" title="${escapeHtml(hlHint)}">${escapeHtml(hlLabel)}</label>
      <select class="dt-tool-select" onchange="setDtHighlite(this.value)">${hlOptions}</select>
      <span class="dt-tool-hint">${escapeHtml(hlHint)}</span>
    </div>
  `;

  return `
    <div class="dt-page">
      ${toolbar}
      <div class="dt-wrap">
      <table class="dt dt-compact">
        <thead>
          <tr>
            <th class="dt-spec">${escapeHtml(specHeader)}</th>
            ${bikeHeaders}
            ${addHeader}
          </tr>
        </thead>
        <tbody>
          ${body}
        </tbody>
      </table>
      </div>
    </div>
  `;
}
