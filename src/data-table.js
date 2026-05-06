// ============================================================
// MotoSPEC Data Table view — editable per-bike profiles
// Mirrors motospec-style-table.csv structure
// ============================================================

import { computeAll, INPUT_META, defaultValues } from './formulas.js';
import { REFERENCE_BIKES } from './reference-bikes.js';

// Map CSV "RESULTS" row → key name used in REFERENCE_BIKES expected blocks
// AND the corresponding computed id in P (or null if not yet computed).
export const ROW_GROUPS = [
  { header: 'FRONT SETTINGS', header_zh: '前部设置', rows: [
    { spec: 'Clamp/Yoke Name',                                      spec_zh: '三星台名称',           profile: 'clamp_yoke_name' },
    { spec: 'Yoke Offset (mm)',                                     spec_zh: '三星台偏移 (mm)',      input: 'Yoke_Offset' },
    { spec: 'Steering Axis Angle (degrees)',                        spec_zh: '转向轴角 (度)',        literal: '0.00 deg' },
    { spec: 'Steering Axis Offset (mm)',                            spec_zh: '转向轴偏移 (mm)',      literal: '0.0 mm' },
    { spec: 'Fork Position (mm)',                                   spec_zh: '前叉伸出量 (mm)',      input: 'Fork_Position' },
    { spec: 'Fork Name',                                            spec_zh: '前叉名称',             profile: 'fork_name' },
    { spec: 'Spring Rate (N/mm)',                                   spec_zh: '弹簧刚度 (N/mm)',      input: 'Front_Spring_Rate' },
    { spec: 'Spring Preload (mm)',                                  spec_zh: '弹簧预压 (mm)',        input: 'Front_Spring_Preload' },
    { spec: 'Oil Level (mm)',                                       spec_zh: '油位 (mm)',            input: 'Front_Oil_Level' },
    { spec: 'Topout Spring Rate (N/mm)',                            spec_zh: '回顶刚度 (N/mm)',      input: 'Front_Topout_Rate' },
    { spec: 'Topout Spring Effective Length (mm)',                  spec_zh: '回顶有效长度 (mm)',    input: 'Front_Topout_Length' },
  ]},
  { header: 'REAR SETTINGS', header_zh: '后部设置', rows: [
    { spec: 'Swingarm Name',                                        spec_zh: '摇臂名称',             profile: 'swingarm_name' },
    { spec: 'Swingarm Length (mm)',                                 spec_zh: '摇臂长度 (mm)',        input: 'Swingarm_Length' },
    { spec: 'Shock Clevis Ride Height Adjustment (mm)',             spec_zh: '避震Clevis车高 (mm)',  input: 'Shock_Clevis_RHA' },
    { spec: 'Shock Name',                                           spec_zh: '避震名称',             profile: 'shock_name' },
    { spec: 'Shock Length (mm)',                                    spec_zh: '避震长度 (mm)',        input: 'Shock_Length' },
    { spec: 'Spring Rate (N/mm)',                                   spec_zh: '弹簧刚度 (N/mm)',      input: 'Rear_Spring_Rate' },
    { spec: 'Spring Preload (mm)',                                  spec_zh: '弹簧预压 (mm)',        input: 'Rear_Spring_Preload' },
    { spec: 'Topout Spring Rate (N/mm)',                            spec_zh: '回顶刚度 (N/mm)',      input: 'Rear_Topout_Rate' },
    { spec: 'Topout Spring Effective Length (mm)',                  spec_zh: '回顶有效长度 (mm)',    input: 'Rear_Topout_Length' },
    { spec: 'Link Name',                                            spec_zh: '连杆名称',             profile: 'link_name' },
    { spec: 'Linkarm Length (mm)',                                  spec_zh: '连杆臂长度 (mm)',      input: 'Linkarm_Length' },
  ]},
  { header: 'TIRES', header_zh: '轮胎', rows: [
    { spec: 'Front Tire Name',                                      spec_zh: '前胎',                profile: 'front_tire' },
    { spec: 'Rear Tire Name',                                       spec_zh: '后胎',                profile: 'rear_tire' },
  ]},
  { header: 'SPROCKETS', header_zh: '链轮', rows: [
    { spec: 'Front Sprocket',                                       spec_zh: '前链轮',              input: 'Front_Sprocket' },
    { spec: 'Rear Sprocket',                                        spec_zh: '后链轮',              input: 'Rear_Sprocket' },
    { spec: 'Final Ratio',                                          spec_zh: '最终传动比',          computed: 'Final_Ratio' },
  ]},
  { header: 'DYNAMIC READINGS', header_zh: '动态读数', rows: [
    { spec: 'Preset',                                               spec_zh: '动态预设',            preset: true },
    { spec: 'Front Potentiometer (mm)',                             spec_zh: '前电位计 (mm)',       input: 'Travel_Front' },
    { spec: 'Rear Potentiometer (mm)',                              spec_zh: '后电位计 (mm)',       input: 'Travel_Rear' },
    { spec: 'Lean Angle (degrees)',                                 spec_zh: '倾角 (度)',           input: 'Lean_Angle' },
  ]},
  { header: 'RESULTS', header_zh: '结果', rows: [
    { spec: 'Rake (degrees)',                                       spec_zh: '后倾角 (度)',         computed: 'MotoSPEC_Rake' },
    { spec: 'Ground Trail (mm)',                                    spec_zh: '拖曳距 (mm)',         computed: 'MotoSPEC_Trail' },
    { spec: 'Rear Wheel Vertical Travel (mm)',                      spec_zh: '后轮垂直行程 (mm)',   computed: 'Rear_Wheel_Vertical_Travel', status: 'coords' },
    { spec: 'Rear Ride Height Reference (mm)',                      spec_zh: '后部车高参考 (mm)',   computed: 'Rear_Ride_Height',           status: 'coords' },
    { spec: 'Swingarm Angle (degrees)',                             spec_zh: '摇臂角 (度)',         computed: 'MotoSPEC_SwgarmAngl' },
    { spec: 'AntiSquat (%)',                                        spec_zh: '抗蹲伏 (%)',          computed: 'MotoSPEC_AntSquat' },
    { spec: 'Progression (% Full Shock Travel)',                    spec_zh: '渐进性 (%)',          computed: 'Progression',                status: 'coords' },
    { spec: 'Motion Ratio (Wheel/Shock)',                           spec_zh: '运动比 (轮/避震)',    computed: 'Motion_Ratio',               status: 'coords' },
    { spec: 'Wheelbase (mm)',                                       spec_zh: '轴距 (mm)',           computed: 'WB',                         status: 'static' },
    { spec: 'Front Wheel Rate (N/mm)',                              spec_zh: '前轮综合刚度 (N/mm)', computed: 'Front_Wheel_Rate',           status: 'pending' },
    { spec: 'Rear Wheel Rate (N/mm)',                               spec_zh: '后轮综合刚度 (N/mm)', computed: 'Rear_Wheel_Rate',            status: 'pending' },
    { spec: 'Front Wheel Force (N)',                                spec_zh: '前轮垂直载荷 (N)',    computed: 'MotoSPEC_FrontForce' },
    { spec: 'Rear Wheel Force (N)',                                 spec_zh: '后轮垂直载荷 (N)',    computed: 'MotoSPEC_RearForce' },
    { spec: 'CofG % Front',                                         spec_zh: '重心前侧占比 (%)',    derivedFrom: v => v.front_weight_dist * 100 },
    { spec: 'CofG % Rear',                                          spec_zh: '重心后侧占比 (%)',    derivedFrom: v => v.rear_weight_dist * 100 },
  ]},
];

// Status badge text per language. Hover tooltip explains what's missing.
const STATUS_BADGE = {
  pending: { en: 'PENDING',  zh: '待实现',     title_en: 'Formula not yet implemented (Phase D research)', title_zh: '公式尚未实现（待 Phase D 研究）' },
  coords:  { en: 'NEEDS COORDS', zh: '需真实坐标', title_en: 'Needs real linkage coordinates — uses placeholder values until measured',  title_zh: '需要真实连杆坐标 — 在用户测量前使用占位值' },
  static:  { en: 'STATIC',   zh: '静态值',     title_en: 'Currently uses static input value; dynamic computation deferred to Phase E', title_zh: '当前使用静态输入值；动态计算推迟到 Phase E' },
};

const DASH = '—';

// Profile fields that get datalist-backed inputs
export const PROFILE_FIELDS = [
  'clamp_yoke_name', 'fork_name', 'swingarm_name', 'shock_name',
  'link_name', 'front_tire', 'rear_tire',
];

export const PRESET_VALUES = {
  sag:        { Travel_Front: 30,  Travel_Rear: 10, Lean_Angle: 0  },
  braking:    { Travel_Front: 120, Travel_Rear: 2,  Lean_Angle: 0  },
  mid_corner: { Travel_Front: 80,  Travel_Rear: 20, Lean_Angle: 55 },
};

const PRESET_LABELS = {
  en: { sag: 'Sag', braking: 'Braking', mid_corner: 'Mid-Corner', custom: 'Custom' },
  zh: { sag: '静态下沉', braking: '刹车', mid_corner: '弯中', custom: '自定义' },
};

function fmtNum(n) {
  if (n == null || !Number.isFinite(n)) return DASH;
  if (Number.isInteger(n)) return String(n);
  return (Math.round(n * 100) / 100).toString();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

// Build initial state.bikes from REFERENCE_BIKES
export function defaultBikes() {
  const presetByIndex = ['sag', 'braking', 'mid_corner'];
  return REFERENCE_BIKES.map((b, i) => {
    const baseValues = defaultValues();
    const values = { ...baseValues, ...(b.inputs || {}) };
    const presetName = presetByIndex[i] || 'sag';
    Object.assign(values, PRESET_VALUES[presetName]);
    const profile = {
      clamp_yoke_name: b.fork_name || '',
      fork_name: b.fork_name || '',
      swingarm_name: b.swingarm_name || '',
      shock_name: b.shock_name || '',
      link_name: b.link_name || '',
      front_tire: b.front_tire || '',
      rear_tire: b.rear_tire || '',
    };
    return {
      id: `col-${i}`,
      name: b.name,
      values,
      profile,
      preset: presetName,
    };
  });
}

// Union of profile-field values across REFERENCE_BIKES, for datalist suggestions
export function profileOptions(field) {
  const opts = new Set();
  for (const b of REFERENCE_BIKES) {
    const v = b[field];
    if (v != null && v !== '') opts.add(v);
  }
  return [...opts];
}

function inputCell(bikeIdx, key, value) {
  const m = INPUT_META[key] || {};
  const step = m.step != null ? m.step : 'any';
  const minAttr = m.min != null ? ` min="${m.min}"` : '';
  const maxAttr = m.max != null ? ` max="${m.max}"` : '';
  const v = value == null || !Number.isFinite(value) ? '' : value;
  return `<td><input type="number" class="dt-input" value="${v}" step="${step}"${minAttr}${maxAttr} oninput="setBikeInput(${bikeIdx}, '${key}', this.value)"></td>`;
}

function profileCell(bikeIdx, field, value) {
  const listId = `dt-options-${field}`;
  return `<td><input type="text" class="dt-input" list="${listId}" value="${escapeHtml(value || '')}" onchange="setBikeProfile(${bikeIdx}, '${field}', this.value)"></td>`;
}

function presetCell(bikeIdx, current, lang) {
  const labels = PRESET_LABELS[lang] || PRESET_LABELS.en;
  const opts = ['sag', 'braking', 'mid_corner', 'custom'];
  const optionsHtml = opts.map(p => {
    const sel = p === current ? ' selected' : '';
    return `<option value="${p}"${sel}>${escapeHtml(labels[p])}</option>`;
  }).join('');
  return `<td><select class="dt-input" onchange="applyBikePreset(${bikeIdx}, this.value)">${optionsHtml}</select></td>`;
}

function readonlyCell(value) {
  return `<td class="dt-readonly"><span>${escapeHtml(value)}</span></td>`;
}

function literalCell(text) {
  return `<td class="dt-readonly"><span>${escapeHtml(text)}</span></td>`;
}

export function renderDataTable(state) {
  const lang = state?.lang || 'zh';
  const bikes = (state && Array.isArray(state.bikes) && state.bikes.length === 3)
    ? state.bikes
    : defaultBikes();

  // Pre-compute outputs per bike
  const outs = bikes.map(b => computeAll({ ...b.values }));

  // Build datalists once
  const datalists = PROFILE_FIELDS.map(f => {
    const opts = profileOptions(f).map(v => `<option value="${escapeHtml(v)}"></option>`).join('');
    return `<datalist id="dt-options-${f}">${opts}</datalist>`;
  }).join('');

  // Header row: editable bike-name inputs
  const bikeHeaders = bikes.map((b, i) =>
    `<th><input type="text" class="dt-input dt-bike-name" value="${escapeHtml(b.name)}" onchange="setBikeName(${i}, this.value)"></th>`
  ).join('');
  const specHeader = lang === 'en' ? 'Parameter' : '参数';

  let body = '';
  for (const group of ROW_GROUPS) {
    const groupLabel = lang === 'en'
      ? group.header
      : `${group.header} (${group.header_zh})`;
    body += `<tr class="dt-group"><th colspan="4">${escapeHtml(groupLabel)}</th></tr>`;
    for (const row of group.rows) {
      const baseLabel = lang === 'en' ? row.spec : (row.spec_zh || row.spec);
      const badge = row.status && STATUS_BADGE[row.status]
        ? `<span class="dt-status dt-status-${row.status}" title="${escapeHtml(STATUS_BADGE[row.status][`title_${lang}`])}">${escapeHtml(STATUS_BADGE[row.status][lang])}</span>`
        : '';
      const label = `${escapeHtml(baseLabel)}${badge ? ' ' + badge : ''}`;
      let cells = '';
      for (let i = 0; i < bikes.length; i++) {
        const b = bikes[i];
        const out = outs[i];
        if (row.literal != null) {
          cells += literalCell(row.literal);
        } else if (row.preset) {
          cells += presetCell(i, b.preset || 'custom', lang);
        } else if (row.profile) {
          cells += profileCell(i, row.profile, b.profile?.[row.profile]);
        } else if (row.input) {
          cells += inputCell(i, row.input, b.values?.[row.input]);
        } else if (row.derivedFrom) {
          cells += readonlyCell(fmtNum(row.derivedFrom(out)));
        } else if (row.computed) {
          cells += readonlyCell(fmtNum(out[row.computed]));
        } else {
          cells += readonlyCell(DASH);
        }
      }
      body += `<tr><th class="dt-spec">${label}</th>${cells}</tr>`;
    }
  }

  return `
    <div class="dt-wrap">
      ${datalists}
      <table class="dt">
        <thead>
          <tr>
            <th class="dt-spec">${escapeHtml(specHeader)}</th>
            ${bikeHeaders}
          </tr>
        </thead>
        <tbody>
          ${body}
        </tbody>
      </table>
    </div>
  `;
}
