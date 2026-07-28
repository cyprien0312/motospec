// ============================================================
// Centre-of-gravity calculator (two-condition scale method)
// ============================================================
//
// Ported from real MotoSPEC's CofG Calculator (see
// docs/research/motospec-v5-teardown.md §3.4). Pure math + a render
// function; the solver has no DOM and is unit-tested directly.
//
// Method
// ------
// LEVEL rows fix the CG's horizontal position:
//     L_CG (CG → rear axle, horizontal) = wheelbase × front share
//
// RAISED rows fix its height. With the rear axle lifted by H over a
// wheelbase L, the axle line tilts by θ = asin(H / L) and load moves onto
// the front. Taking moments about the rear contact patch:
//     (W_f' − W_f) · L · cosθ = W · h · sinθ
//     h = (W_f' − W_f) · L / (W · tanθ)
// where h is the CG height ABOVE THE AXLE LINE. Raising the front is the
// mirror case, measured on the rear scale. Adding the axle height gives
// the height above ground, which is what H_CG means everywhere else.
//
// Assumption stated out loud: the two axles are treated as being at the
// same height. A front/rear loaded-radius difference of 25 mm tilts the
// real axle line by ~1° on a 1400 mm wheelbase; that is inside this
// method's own repeatability, but it is an approximation, not an
// identity — hence the note in the UI rather than silent precision.
//
// Scale readings are whatever unit the user's scales show (kg assumed for
// the Mass output); every other result is a ratio, so the unit cancels.

const R2D = 180 / Math.PI;

export const CG_ENDS = ['level', 'rear', 'front'];

// MotoSPEC allows 16 measurement pairs; 8 covers the full composite grid
// it documents (level/raised × empty/full fuel × tuck/upright).
export const MAX_CG_ROWS = 8;

export function blankCgRow(end = 'level') {
  return { end, height: end === 'level' ? 0 : null, front: null, rear: null, note: '' };
}

export function defaultCgRows() {
  return [blankCgRow('level'), blankCgRow('rear')];
}

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const usable = (r) => num(r?.front) != null && num(r?.rear) != null
  && (num(r.front) + num(r.rear)) > 0;

/**
 * Solve the CG from a set of scale measurements.
 *
 * @param rows  [{ end: 'level'|'front'|'rear', height, front, rear }]
 * @param opts  { wheelbase, axleHeight }  mm
 * @returns { L_CG, H_CG, Mass, frontShare, heightAboveAxle, perRow, warnings, ... }
 *          Any value that cannot be honestly derived comes back null —
 *          never a partially-informed guess.
 */
export function solveCG(rows, opts = {}) {
  const wheelbase = num(opts.wheelbase);
  const axleHeight = num(opts.axleHeight);
  const warnings = [];
  const out = {
    L_CG: null, H_CG: null, Mass: null, frontShare: null,
    heightAboveAxle: null, spread: null,
    nLevel: 0, nRaised: 0, perRow: [], warnings,
  };

  const list = Array.isArray(rows) ? rows : [];
  const level = list.filter(r => r?.end === 'level' && usable(r));
  const raised = list
    .map((r, index) => ({ r, index }))
    .filter(({ r }) => r?.end !== 'level' && usable(r) && num(r?.height) > 0);
  out.nLevel = level.length;
  out.nRaised = raised.length;

  if (!wheelbase || wheelbase <= 0) { warnings.push('no_wheelbase'); return out; }
  if (level.length === 0) { warnings.push('need_level'); return out; }

  // ---- Horizontal: averaged level condition ----------------------------
  const fLevel = level.reduce((s, r) => s + r.front, 0) / level.length;
  const rLevel = level.reduce((s, r) => s + r.rear, 0) / level.length;
  const wLevel = fLevel + rLevel;
  out.Mass = wLevel;
  out.frontShare = fLevel / wLevel;
  out.L_CG = out.frontShare * wheelbase;

  // ---- Vertical: one estimate per raised row ---------------------------
  if (raised.length === 0) { warnings.push('need_raised'); return out; }

  const heights = [];
  for (const { r, index } of raised) {
    const H = num(r.height);
    const W = r.front + r.rear;
    const row = { index, end: r.end, height: H, total: W, angleDeg: null, h: null, reason: null };
    if (H >= wheelbase) { row.reason = 'height_exceeds_wheelbase'; out.perRow.push(row); continue; }
    const theta = Math.asin(H / wheelbase);
    row.angleDeg = theta * R2D;
    const t = Math.tan(theta);
    if (!(t > 1e-9)) { row.reason = 'no_tilt'; out.perRow.push(row); continue; }
    // Raising an end moves load onto the OTHER end; measure it there.
    const dW = r.end === 'rear' ? (r.front - fLevel) : (r.rear - rLevel);
    if (!(dW > 0)) {
      // A raised end that gains no load on the opposite scale means the
      // readings, the raised-end selection or the supports are wrong.
      row.reason = 'no_transfer';
      out.perRow.push(row);
      continue;
    }
    row.h = dW * wheelbase / (W * t);
    heights.push(row.h);
    out.perRow.push(row);
  }

  if (heights.length === 0) { warnings.push('no_usable_raised'); return out; }

  const mean = heights.reduce((a, b) => a + b, 0) / heights.length;
  out.heightAboveAxle = mean;
  out.spread = heights.length > 1 ? Math.max(...heights) - Math.min(...heights) : 0;

  if (axleHeight == null) {
    // Height above the axle line is real and worth showing; H_CG (above
    // ground) genuinely is not known without the axle height.
    warnings.push('need_axle_height');
  } else {
    out.H_CG = mean + axleHeight;
  }

  // ---- Advisories from the manual's own best practices -----------------
  const angles = out.perRow.map(r => r.angleDeg).filter(a => a != null);
  if (angles.length && Math.max(...angles) < 20) warnings.push('angle_low');
  const totals = [...level, ...raised.map(({ r }) => r)].map(r => r.front + r.rear);
  const spreadPct = (Math.max(...totals) - Math.min(...totals)) / wLevel * 100;
  if (spreadPct > 1) warnings.push('weight_missing');
  if (out.spread != null && out.spread > 25) warnings.push('scatter_high');
  return out;
}

// ----- Rendering ------------------------------------------------------------

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const fmt = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : '—');

const UI = {
  zh: {
    title: '重心计算器（称重法）',
    desc: '至少两组读数：一组水平、一组抬起一端。可以多测几组求平均——不同油量、不同骑手姿势的"复合重心"就是这么来的。称重单位用 kg。',
    end: '状态', height: '抬起高度 (mm)', front: '前轮称重', rear: '后轮称重',
    end_level: '水平', end_rear: '抬起车尾', end_front: '抬起车头',
    add: '+ 增加一组', remove: '删除',
    res_mass: '总质量', res_share: '前轮占比', res_lcg: 'L_CG（重心→后轴）',
    res_habove: '重心高于轴线', res_hcg: 'H_CG（重心离地）', res_spread: '各组高度差',
    apply: '写入底盘配置',
    applied: '已写入 Mass / H_CG / L_CG / 前轮重量分配',
    axle_note: '轴心高度取前轮滚动半径 Rf；本方法把前后轴视为等高，前后胎半径差会带来约 1° 的轴线倾斜误差。',
    w: {
      no_wheelbase: '需要先填写轴距 WB。',
      need_level: '至少需要一组"水平"读数——它定的是重心的水平位置。',
      need_raised: '还需要一组抬起一端的读数才能求重心高度。',
      no_usable_raised: '抬起的那几组都算不出高度，见下表的原因列。',
      need_axle_height: '缺前轮滚动半径 Rf，只能给出"高于轴线"的高度，给不出离地高度。',
      angle_low: '抬起角小于 20°（1400 mm 轴距约需 500 mm）。角度越大结果越稳，24° 以上明显更好。',
      weight_missing: '各组总重相差超过 1%——多半是支撑车辆的人或架子分走了一部分重量。',
      scatter_high: '各组算出的重心高度相差超过 25 mm。0.5 kg 的读数差约等于 5 mm 高度差，值得复测。',
    },
    reason: {
      height_exceeds_wheelbase: '抬起高度超过轴距',
      no_tilt: '没有倾斜',
      no_transfer: '对侧称重没有增加——检查抬起的是哪一端、或支撑是否分走了重量',
    },
  },
  en: {
    title: 'Centre of Gravity Calculator (scale method)',
    desc: 'At least two readings: one level, one with an end raised. Take several and average — that is exactly how a composite CG across fuel loads and rider positions is built. Weigh in kg.',
    end: 'Condition', height: 'Raised height (mm)', front: 'Front scale', rear: 'Rear scale',
    end_level: 'Level', end_rear: 'Rear raised', end_front: 'Front raised',
    add: '+ Add reading', remove: 'Remove',
    res_mass: 'Total mass', res_share: 'Front share', res_lcg: 'L_CG (CG → rear axle)',
    res_habove: 'CG above axle line', res_hcg: 'H_CG (CG above ground)', res_spread: 'Spread between rows',
    apply: 'Apply to chassis',
    applied: 'Wrote Mass / H_CG / L_CG / front weight share',
    axle_note: 'Axle height is taken as the front rolling radius Rf. The method treats both axles as level; a front/rear radius difference tilts the real axle line by about 1°.',
    w: {
      no_wheelbase: 'Enter the wheelbase (WB) first.',
      need_level: 'At least one LEVEL reading is required — it fixes the horizontal position.',
      need_raised: 'A reading with one end raised is still needed for the CG height.',
      no_usable_raised: 'None of the raised rows produced a height — see the reason column.',
      need_axle_height: 'Without the front rolling radius Rf only the height above the axle line can be given, not the height above ground.',
      angle_low: 'Raised angle is under 20° (about 500 mm on a 1400 mm wheelbase). Higher is steadier; over 24° is noticeably better.',
      weight_missing: 'Row totals differ by more than 1% — usually a person or stand taking part of the weight.',
      scatter_high: 'Row-to-row CG height differs by more than 25 mm. Half a kilo of scale error is about 5 mm of height — worth repeating.',
    },
    reason: {
      height_exceeds_wheelbase: 'raised height exceeds the wheelbase',
      no_tilt: 'no tilt',
      no_transfer: 'opposite scale gained no load — check which end is raised, or whether a support is taking weight',
    },
  },
};

export function renderCgCalculator({ rows, values, lang } = {}) {
  const L = lang === 'en' ? 'en' : 'zh';
  const str = UI[L];
  const list = Array.isArray(rows) && rows.length ? rows : defaultCgRows();
  const res = solveCG(list, { wheelbase: values?.WB, axleHeight: values?.Rf });

  const cell = (i, field, value, attrs = '') =>
    `<input type="number" class="chassis-input cg-input" value="${value == null ? '' : value}" ${attrs}
            oninput="setCgRow(${i}, '${field}', this.value)">`;

  const body = list.map((r, i) => {
    const endOpts = CG_ENDS.map(e =>
      `<option value="${e}"${r.end === e ? ' selected' : ''}>${escapeHtml(str[`end_${e}`])}</option>`).join('');
    return `<tr>
      <td class="chassis-td"><select class="chassis-input cg-input" onchange="setCgRow(${i}, 'end', this.value)">${endOpts}</select></td>
      <td class="chassis-td">${r.end === 'level' ? '<span class="cg-dash">—</span>' : cell(i, 'height', r.height, 'min="0" max="1200" step="10"')}</td>
      <td class="chassis-td">${cell(i, 'front', r.front, 'min="0" step="0.1"')}</td>
      <td class="chassis-td">${cell(i, 'rear', r.rear, 'min="0" step="0.1"')}</td>
      <td class="chassis-td cg-derived">${cgRowDetail(i, r, res, str)}</td>
      <td class="chassis-td">${list.length > 1 ? `<button class="chassis-btn cg-btn-sm" onclick="removeCgRow(${i})" title="${escapeHtml(str.remove)}">×</button>` : ''}</td>
    </tr>`;
  }).join('');

  const readouts = [
    { label: str.res_mass,   val: fmt(res.Mass, 1),            unit: 'kg' },
    { label: str.res_share,  val: res.frontShare == null ? '—' : fmt(res.frontShare * 100, 1), unit: '%' },
    { label: str.res_lcg,    val: fmt(res.L_CG, 0),            unit: 'mm' },
    { label: str.res_habove, val: fmt(res.heightAboveAxle, 0), unit: 'mm' },
    { label: str.res_hcg,    val: fmt(res.H_CG, 0),            unit: 'mm' },
    { label: str.res_spread, val: res.spread == null ? '—' : fmt(res.spread, 0), unit: 'mm' },
  ].map(c => `
    <div class="linkage-readout">
      <div class="linkage-readout-label">${escapeHtml(c.label)}</div>
      <div class="linkage-readout-val">${escapeHtml(c.val)}${c.unit ? ' ' + c.unit : ''}</div>
    </div>`).join('');

  const warns = res.warnings.map(w =>
    `<li>${escapeHtml(str.w[w] || w)}</li>`).join('');

  const canApply = res.L_CG != null && res.H_CG != null;

  return `
    <section class="chassis-group cg-group">
      <h2 class="chassis-group-title">${escapeHtml(str.title)}</h2>
      <p class="chassis-desc">${escapeHtml(str.desc)}</p>
      <div class="chassis-table-wrap">
        <table class="chassis-table cg-table">
          <thead><tr>
            <th class="chassis-th">${escapeHtml(str.end)}</th>
            <th class="chassis-th">${escapeHtml(str.height)}</th>
            <th class="chassis-th">${escapeHtml(str.front)}</th>
            <th class="chassis-th">${escapeHtml(str.rear)}</th>
            <th class="chassis-th"></th>
            <th class="chassis-th"></th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <div class="chassis-actions">
        ${list.length < MAX_CG_ROWS ? `<button class="chassis-btn" onclick="addCgRow()">${escapeHtml(str.add)}</button>` : ''}
        <button class="chassis-btn" onclick="applyCgResult()"${canApply ? '' : ' disabled'}>${escapeHtml(str.apply)}</button>
      </div>
      <div class="linkage-readout-strip cg-readout-strip">${readouts}</div>
      <p class="chassis-desc cg-note">${escapeHtml(str.axle_note)}</p>
      <ul class="cg-warnings">${warns}</ul>
    </section>
  `;
}

// Per-row derived text: the tilt angle and the height that row implies, or
// why it produced nothing.
function cgRowDetail(index, row, res, str) {
  if (row.end === 'level') return '';
  const match = res.perRow.find(p => p.index === index);
  if (!match) return '';
  if (match.reason) return `<span class="cg-reason">${escapeHtml(str.reason[match.reason] || match.reason)}</span>`;
  return `<span class="cg-ok">${fmt(match.angleDeg, 1)}° → ${fmt(match.h, 0)} mm</span>`;
}
