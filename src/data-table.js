// ============================================================
// MotoSPEC Data Table view
// Mirrors motospec-style-table.csv structure
// ============================================================

import { computeAll } from './formulas.js';
import { REFERENCE_BIKES } from './reference-bikes.js';

// Map CSV "RESULTS" row → key name used in REFERENCE_BIKES expected blocks
// AND the corresponding computed id in P (or null if not yet computed).
export const ROW_GROUPS = [
  { header: 'FRONT SETTINGS', header_zh: '前部设置', rows: [
    { spec: 'Clamp/Yoke Name',                                      spec_zh: '三星台名称',           ref: 'fork_name' },
    { spec: 'Yoke Offset (mm)',                                     spec_zh: '三星台偏移 (mm)',      input: 'Yoke_Offset' },
    { spec: 'Steering Axis Angle (degrees)',                        spec_zh: '转向轴角 (度)',        literal: '0.00 deg' },
    { spec: 'Steering Axis Offset (mm)',                            spec_zh: '转向轴偏移 (mm)',      literal: '0.0 mm' },
    { spec: 'Fork Position (mm)',                                   spec_zh: '前叉伸出量 (mm)',      input: 'Fork_Position' },
    { spec: 'Fork Name',                                            spec_zh: '前叉名称',             ref: 'fork_name' },
    { spec: 'Spring Rate (N/mm)',                                   spec_zh: '弹簧刚度 (N/mm)',      input: 'Front_Spring_Rate' },
    { spec: 'Spring Preload (mm)',                                  spec_zh: '弹簧预压 (mm)',        input: 'Front_Spring_Preload' },
    { spec: 'Oil Level (mm)',                                       spec_zh: '油位 (mm)',            input: 'Front_Oil_Level' },
    { spec: 'Topout Spring Rate (N/mm)',                            spec_zh: '回顶刚度 (N/mm)',      input: 'Front_Topout_Rate' },
    { spec: 'Topout Spring Effective Length (mm)',                  spec_zh: '回顶有效长度 (mm)',    input: 'Front_Topout_Length' },
  ]},
  { header: 'REAR SETTINGS', header_zh: '后部设置', rows: [
    { spec: 'Swingarm Name',                                        spec_zh: '摇臂名称',             ref: 'swingarm_name' },
    { spec: 'Swingarm Length (mm)',                                 spec_zh: '摇臂长度 (mm)',        input: 'Swingarm_Length' },
    { spec: 'Shock Clevis Ride Height Adjustment (mm)',             spec_zh: '避震Clevis车高 (mm)',  input: 'Shock_Clevis_RHA' },
    { spec: 'Shock Name',                                           spec_zh: '避震名称',             ref: 'shock_name' },
    { spec: 'Shock Length (mm)',                                    spec_zh: '避震长度 (mm)',        input: 'Shock_Length' },
    { spec: 'Spring Rate (N/mm)',                                   spec_zh: '弹簧刚度 (N/mm)',      input: 'Rear_Spring_Rate' },
    { spec: 'Spring Preload (mm)',                                  spec_zh: '弹簧预压 (mm)',        input: 'Rear_Spring_Preload' },
    { spec: 'Topout Spring Rate (N/mm)',                            spec_zh: '回顶刚度 (N/mm)',      input: 'Rear_Topout_Rate' },
    { spec: 'Topout Spring Effective Length (mm)',                  spec_zh: '回顶有效长度 (mm)',    input: 'Rear_Topout_Length' },
    { spec: 'Link Name',                                            spec_zh: '连杆名称',             ref: 'link_name' },
    { spec: 'Linkarm Length (mm)',                                  spec_zh: '连杆臂长度 (mm)',      input: 'Linkarm_Length' },
  ]},
  { header: 'TIRES', header_zh: '轮胎', rows: [
    { spec: 'Front Tire Name',                                      spec_zh: '前胎',                ref: 'front_tire' },
    { spec: 'Rear Tire Name',                                       spec_zh: '后胎',                ref: 'rear_tire' },
  ]},
  { header: 'SPROCKETS', header_zh: '链轮', rows: [
    { spec: 'Front Sprocket',                                       spec_zh: '前链轮',              input: 'Front_Sprocket' },
    { spec: 'Rear Sprocket',                                        spec_zh: '后链轮',              input: 'Rear_Sprocket' },
    { spec: 'Final Ratio',                                          spec_zh: '最终传动比',          computed: 'Final_Ratio' },
  ]},
  { header: 'DYNAMIC READINGS', header_zh: '动态读数', rows: [
    { spec: 'Front Potentiometer (mm)',                             spec_zh: '前电位计 (mm)',       input: 'Travel_Front' },
    { spec: 'Rear Potentiometer (mm)',                              spec_zh: '后电位计 (mm)',       input: 'Travel_Rear' },
    { spec: 'Lean Angle (degrees)',                                 spec_zh: '倾角 (度)',           input: 'Lean_Angle' },
  ]},
  { header: 'RESULTS', header_zh: '结果', rows: [
    { spec: 'Rake (degrees)',                                       spec_zh: '后倾角 (度)',         computed: 'MotoSPEC_Rake',          csvKey: 'Rake' },
    { spec: 'Ground Trail (mm)',                                    spec_zh: '拖曳距 (mm)',         computed: 'MotoSPEC_Trail',         csvKey: 'Ground_Trail' },
    { spec: 'Rear Wheel Vertical Travel (mm)',                      spec_zh: '后轮垂直行程 (mm)',   computed: 'Rear_Wheel_Vertical_Travel', csvKey: 'Rear_Wheel_Vertical_Travel' },
    { spec: 'Rear Ride Height Reference (mm)',                      spec_zh: '后部车高参考 (mm)',   computed: 'Rear_Ride_Height',       csvKey: 'Rear_Ride_Height' },
    { spec: 'Swingarm Angle (degrees)',                             spec_zh: '摇臂角 (度)',         computed: 'MotoSPEC_SwgarmAngl',    csvKey: 'Swingarm_Angle' },
    { spec: 'AntiSquat (%)',                                        spec_zh: '抗蹲伏 (%)',          computed: 'MotoSPEC_AntSquat',      csvKey: 'AntiSquat_Pct' },
    { spec: 'Progression (% Full Shock Travel)',                    spec_zh: '渐进性 (%)',          computed: 'Progression',            csvKey: 'Progression_Pct' },
    { spec: 'Motion Ratio (Wheel/Shock)',                           spec_zh: '运动比 (轮/避震)',    computed: 'Motion_Ratio',           csvKey: 'Motion_Ratio' },
    { spec: 'Wheelbase (mm)',                                       spec_zh: '轴距 (mm)',           computed: 'WB',                     csvKey: 'Wheelbase' },
    { spec: 'Front Wheel Rate (N/mm)',                              spec_zh: '前轮综合刚度 (N/mm)', computed: 'Front_Wheel_Rate',       csvKey: 'Front_Wheel_Rate' },
    { spec: 'Rear Wheel Rate (N/mm)',                               spec_zh: '后轮综合刚度 (N/mm)', computed: 'Rear_Wheel_Rate',        csvKey: 'Rear_Wheel_Rate' },
    { spec: 'Front Wheel Force (N)',                                spec_zh: '前轮垂直载荷 (N)',    computed: 'MotoSPEC_FrontForce',    csvKey: 'Front_Wheel_Force' },
    { spec: 'Rear Wheel Force (N)',                                 spec_zh: '后轮垂直载荷 (N)',    computed: 'MotoSPEC_RearForce',     csvKey: 'Rear_Wheel_Force' },
    { spec: 'CofG % Front',                                         spec_zh: '重心前侧占比 (%)',    computed: null,                     csvKey: 'CofG_Front_Pct',
      currentFrom: v => v.front_weight_dist * 100 },
    { spec: 'CofG % Rear',                                          spec_zh: '重心后侧占比 (%)',    computed: null,                     csvKey: 'CofG_Rear_Pct',
      currentFrom: v => v.rear_weight_dist * 100 },
  ]},
];

const DASH = '—';

function fmtNum(n) {
  if (n == null || !Number.isFinite(n)) return DASH;
  if (Number.isInteger(n)) return String(n);
  return (Math.round(n * 100) / 100).toString();
}

function findPopulatedPreset(bike) {
  for (const k of Object.keys(bike.expected || {})) {
    if (bike.expected[k] != null) return k;
  }
  return null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

function renderRow(row, lang, bikeCells, currentCell) {
  const label = lang === 'en' ? row.spec : (row.spec_zh || row.spec);
  const cells = bikeCells.map(v => `<td>${escapeHtml(v)}</td>`).join('');
  return `<tr><th class="dt-spec">${escapeHtml(label)}</th>${cells}<td class="dt-current">${escapeHtml(currentCell)}</td></tr>`;
}

function bikeCellFor(row, bike, presetKey) {
  if (row.literal != null) return row.literal;
  if (row.ref != null) return bike[row.ref] != null && bike[row.ref] !== '' ? bike[row.ref] : DASH;
  if (row.input != null) {
    const v = bike.inputs?.[row.input];
    if (v == null) {
      // fall back to dynamic preset for travel/lean inputs
      const fromPreset = bike.dynamic_presets?.[presetKey]?.[row.input];
      if (fromPreset != null) return fmtNum(fromPreset);
      return DASH;
    }
    return fmtNum(v);
  }
  if (row.computed != null && row.csvKey != null) {
    const exp = bike.expected?.[presetKey];
    const v = exp ? exp[row.csvKey] : null;
    return v == null ? DASH : fmtNum(v);
  }
  if (row.csvKey != null && row.computed === null) {
    // CofG rows: pulled from CSV expected.csvKey
    const exp = bike.expected?.[presetKey];
    const v = exp ? exp[row.csvKey] : null;
    return v == null ? DASH : fmtNum(v);
  }
  return DASH;
}

function currentCellFor(row, state, out) {
  if (row.literal != null) return row.literal;
  if (row.ref != null) return DASH;
  if (row.input != null) {
    const v = state.values?.[row.input];
    return v == null ? DASH : fmtNum(v);
  }
  if (row.currentFrom) {
    return fmtNum(row.currentFrom(out));
  }
  if (row.computed != null) {
    return fmtNum(out[row.computed]);
  }
  return DASH;
}

export function renderDataTable(state) {
  const lang = state?.lang || 'zh';
  const values = state?.values || {};
  const out = computeAll({ ...values });

  // Pre-compute each bike's preset key
  const bikePresets = REFERENCE_BIKES.map(b => ({ bike: b, presetKey: findPopulatedPreset(b) }));

  // Header
  const bikeHeaders = REFERENCE_BIKES.map(b => {
    const pk = bikePresets.find(x => x.bike === b).presetKey;
    const presetLabel = pk ? ` <span class="dt-preset">[${pk}]</span>` : '';
    return `<th>${escapeHtml(b.name)}${presetLabel}</th>`;
  }).join('');
  const currentHeader = lang === 'en' ? 'Current' : '当前';
  const specHeader = lang === 'en' ? 'Parameter' : '参数';

  let body = '';
  for (const group of ROW_GROUPS) {
    const groupLabel = lang === 'en'
      ? group.header
      : `${group.header} (${group.header_zh})`;
    body += `<tr class="dt-group"><th colspan="5">${escapeHtml(groupLabel)}</th></tr>`;
    for (const row of group.rows) {
      const bikeCells = bikePresets.map(({ bike, presetKey }) => bikeCellFor(row, bike, presetKey));
      const cur = currentCellFor(row, state, out);
      body += renderRow(row, lang, bikeCells, cur);
    }
  }

  return `
    <div class="dt-wrap">
      <table class="dt">
        <thead>
          <tr>
            <th class="dt-spec">${escapeHtml(specHeader)}</th>
            ${bikeHeaders}
            <th class="dt-current">${escapeHtml(currentHeader)}</th>
          </tr>
        </thead>
        <tbody>
          ${body}
        </tbody>
      </table>
    </div>
  `;
}
