// Setup sensitivity map — "多少 rake/trail 好使"的专业替代品。
//
// 绝对目标值不存在(95mm trail 在 R3 和在超级摩托上是两种东西),车队工程师
// 真正维护的是**这台车的灵敏度地图**:每个调整旋钮拧一格(INPUT_META.step,
// 即真实世界的一次调整),每个 RESULTS 指标各变多少。本模块对当前车列的
// 材料化值做中心差分,杠杆步长就用 step —— 输出的每个数都是"你在围场里
// 拧一下会发生的事",不是抽象导数。
//
// 诚实规则(与全仓库一致):
//  * 任一侧算出 NaN(readiness 缺输入 / 连杆无解)→ 该格 null,渲染为 "—",
//    绝不外插。
//  * 灵敏度依赖当前工况(尤其 sag 状态)——表头必须标明"在当前设置附近"。
//  * Sag_Front/Sag_Rear 不是调整旋钮,是载荷工况,单列一组:它们回答的是
//    "过弯载荷变化时几何漂多少",与"我能拧什么"分开呈现。

import { computeAll, INPUT_META } from './formulas.js';
import { leafInputsFor } from './data-table.js';

// 调整旋钮:真实世界里存在对应扳手动作的输入。
export const SENS_LEVERS = [
  { key: 'Fork_Position',    zh: '前叉伸出 (穿三角台)', en: 'Fork position' },
  { key: 'Yoke_Offset',      zh: '三角台 offset',       en: 'Yoke offset' },
  { key: 'Swingarm_Length',  zh: '链条调节 (摇臂长)',   en: 'Chain adjuster' },
  { key: 'Shock_Length',     zh: '后避震长度',          en: 'Shock length' },
  { key: 'Tire_Rf_Delta',    zh: '前胎半径 Δ',          en: 'Front tyre Δ' },
  { key: 'Tire_Rr_Delta',    zh: '后胎半径 Δ',          en: 'Rear tyre Δ' },
  { key: 'Front_Spring_Rate', zh: '前弹簧',             en: 'Front spring' },
  { key: 'Rear_Spring_Rate', zh: '后弹簧',              en: 'Rear spring' },
];

// 载荷工况(不是旋钮)
export const SENS_LOADCASE = [
  { key: 'Sag_Front', zh: '前下沉 +1mm', en: 'Front sag +1mm' },
  { key: 'Sag_Rear',  zh: '后下沉 +1mm', en: 'Rear sag +1mm' },
];

export const SENS_OUTPUTS = [
  { id: 'MotoSPEC_Rake',  unit: '°',    dp: 3, zh: 'Rake',       en: 'Rake' },
  { id: 'MotoSPEC_Trail', unit: 'mm',   dp: 2, zh: 'Trail(地面)', en: 'Ground trail' },
  { id: 'Wheelbase_Live', unit: 'mm',   dp: 2, zh: '轴距',        en: 'Wheelbase' },
  { id: 'Swingarm_Angle', unit: '°',    dp: 3, zh: '摇臂角',      en: 'Swingarm angle' },
  { id: 'Motion_Ratio',   unit: '',     dp: 4, zh: '运动比',      en: 'Motion ratio' },
  { id: 'Anti_Squat',     unit: '%',    dp: 1, zh: 'Anti-Squat',  en: 'Anti-squat' },
  { id: 'Rear_Wheel_Rate', unit: 'N/mm', dp: 3, zh: '后轮率',     en: 'Rear wheel rate' },
  { id: 'Spring_Center',  unit: '',     dp: 4, zh: 'Spring Center', en: 'Spring center' },
];

const fin = (x) => Number.isFinite(x) ? x : null;

// 一个杠杆的中心差分:返回 { out_id: Δ per +1 step | null }
function diffLever(values, key, step) {
  const up = computeAll({ ...values, [key]: (+values[key] || 0) + step });
  const dn = computeAll({ ...values, [key]: (+values[key] || 0) - step });
  const eff = {};
  for (const o of SENS_OUTPUTS) {
    const a = fin(up[o.id]), b = fin(dn[o.id]);
    eff[o.id] = (a === null || b === null) ? null : (a - b) / 2;
  }
  return eff;
}

// values = effectiveBikeValues(bike) 的材料化结果;ready = bikeReadyKeys(bike)。
// readiness 门禁与 Data Table 同源:材料化值里的默认值(如未实测的 H_CG)
// 证明不了绑定 —— 不传 ready 时不做门禁(仅测试用),app 端必须传。
// 返回 { baseline, levers: [{key,label,step,effects}], loadcase: [...] }
export function computeSensitivity(values, lang = 'zh', ready = null) {
  const gated = (id) => {
    if (!ready) return false;
    for (const leaf of leafInputsFor(id, values, ready)) if (!ready.has(leaf)) return true;
    return false;
  };
  const gate = new Set(SENS_OUTPUTS.filter(o => ready && gated(o.id)).map(o => o.id));
  const base = computeAll(values);
  const baseline = {};
  for (const o of SENS_OUTPUTS) baseline[o.id] = gate.has(o.id) ? null : fin(base[o.id]);

  const row = (spec) => {
    const meta = INPUT_META[spec.key] || {};
    const step = Number.isFinite(meta.step) ? meta.step : 1;
    const effects = diffLever(values, spec.key, step);
    for (const id of gate) effects[id] = null;   // 门禁:未绑定输入的输出不出数
    return { key: spec.key, label: spec[lang] || spec.zh, step, effects };
  };
  return {
    baseline,
    levers: SENS_LEVERS.map(row),
    loadcase: SENS_LOADCASE.map(row),
  };
}

// 渲染成独立 HTML 页(window.open 用)。无外部依赖,可打印带去围场。
export function renderSensitivityHtml(sens, bikeName, lang = 'zh') {
  const t = lang === 'en'
    ? { title: 'Setup sensitivity map', per: 'per one click of', base: 'current value',
        lever: 'Adjustment (one real-world click)', load: 'Load case (not an adjustment)',
        note1: 'Central differences of THIS bike\'s parameter graph, evaluated at the current setup — sensitivities shift with load state.',
        note2: '"—" = not computable with current inputs (honesty rule: no extrapolation). There are no universal target values; use this map with a baseline you liked and structured rider feedback.' }
    : { title: '调校灵敏度地图', per: '每拧一格', base: '当前值',
        lever: '调整旋钮(一格 = 真实的一次扳手动作)', load: '载荷工况(不是旋钮)',
        note1: '由本车参数图在当前设置附近做中心差分得出 —— 灵敏度随载荷状态漂移。',
        note2: '"—" = 当前输入算不出(诚实规则:不外插)。不存在普适目标值;这张表的用法是配合你喜欢的基准设置与结构化车手反馈。' };
  const fmt = (v, dp) => v === null ? '—'
    : (v >= 0 ? '+' : '') + v.toFixed(dp).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  const head = SENS_OUTPUTS.map(o =>
    `<th>${lang === 'en' ? o.en : o.zh}${o.unit ? `<span class="u">${o.unit}</span>` : ''}</th>`).join('');
  const baseRow = SENS_OUTPUTS.map(o =>
    `<td class="base">${sens.baseline[o.id] === null ? '—' : sens.baseline[o.id].toFixed(o.dp)}</td>`).join('');
  const rows = (list) => list.map(r =>
    `<tr><th class="lever">${r.label}<span class="u">${t.per} ${r.step}</span></th>` +
    SENS_OUTPUTS.map(o => {
      const v = r.effects[o.id];
      const cls = v === null ? 'na' : Math.abs(v) < 1e-9 ? 'zero' : v > 0 ? 'pos' : 'neg';
      return `<td class="${cls}">${fmt(v, o.dp)}</td>`;
    }).join('') + '</tr>').join('');
  return `<!-- rendered by MotoSPEC Formula Explorer -->
<meta charset="utf-8"><title>${t.title} — ${bikeName}</title>
<style>
 body{font:14px/1.5 system-ui,sans-serif;margin:24px;color:#1a2230}
 h1{font-size:18px;margin:0 0 2px} .sub{color:#667;margin:0 0 14px;font-size:12.5px}
 table{border-collapse:collapse;margin:10px 0 18px}
 th,td{border:1px solid #d5dae3;padding:5px 10px;text-align:right;font-variant-numeric:tabular-nums}
 th{background:#f2f4f8;text-align:right} th.lever{text-align:left;font-weight:600}
 .u{display:block;font-size:10.5px;color:#889;font-weight:400}
 td.base{background:#fbfcfe;color:#556}
 td.pos{color:#0a6b3d} td.neg{color:#a13a1e} td.zero,td.na{color:#aab}
 .cap{font-weight:700;margin:16px 0 4px} .note{font-size:12px;color:#667;max-width:70em}
 @media print { body{margin:8mm} }
</style>
<h1>${t.title} — ${bikeName}</h1>
<p class="sub">${new Date().toISOString().slice(0, 10)} · MotoSPEC Formula Explorer</p>
<table><tr><th class="lever">${t.base}</th>${head}</tr><tr><th class="lever">—</th>${baseRow}</tr></table>
<div class="cap">${t.lever}</div>
<table><tr><th class="lever"></th>${head}</tr>${rows(sens.levers)}</table>
<div class="cap">${t.load}</div>
<table><tr><th class="lever"></th>${head}</tr>${rows(sens.loadcase)}</table>
<p class="note">${t.note1}<br>${t.note2}</p>`;
}
