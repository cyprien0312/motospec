// Logger math-channel export — 把本车几何烘焙成数采系统的数学通道。
//
// 商业版 MotoSPEC 的 Data Acquisition 功能(motospec.ca/data-aq.html)为
// MoTeC i2 / AiM RS2/RS3 生成 14 个 chassis math channel。本模块生成其中
// 几何与刚度可诚实推导的部分:输入只有前后两个悬挂电位计,常数全部来自
// 当前车列的 chassis + linkage + 组件数据。
//
// 设计边界(与仓库其它部分同一条诚实规则):
//  * 连杆非线性(shock pot → 后轮行程)用 linkage.js 的 4-bar 解算器采样,
//    拟合多项式;拟合残差写进导出文件头 —— 残差大就说明连杆强渐进,
//    自己决定要不要升阶。
//  * 不生成 Anti-Squat / CofG 通道,除非 Mass/H_CG/L_CG 真的被绑定
//    (缺 CG 的 anti-squat 只有比较价值,见 teardown §3.4)。
//  * 不生成 Wheel Force 通道:需要预载/topout/气簧模型,商业版也明确
//    "bump rubber 不计入"(teardown §3.2)。缺的就是缺,不给假数。
//  * 只输出**粘贴用表达式文本 + CSV 查表**,不生成 .ajmc/.xml 专有格式 ——
//    没拿到真实样本文件对照前,生成的二进制格式都是猜(同 .MS1 导入的
//    实验性纪律,teardown §4.3)。
//
// 电位计约定(写死在文件头,导入的人必须核对):
//  * $FP = 前叉压缩量 mm,0 = 全伸展(topped out),沿叉管轴向
//  * $RP = 后避震压缩量 mm,0 = 全伸展
//  参考态 = 本 app 的 profile 基线(全伸展),与扫描态一致。

import { rearVerticalTravel, motionRatio, swingarmDeltaForShockTravel } from './linkage.js';

const D2R = Math.PI / 180;

// 最小二乘多项式拟合(低阶、小样本,正规方程足够)
function polyfit(xs, ys, deg) {
  const n = deg + 1;
  const A = Array.from({ length: n }, () => new Float64Array(n));
  const b = new Float64Array(n);
  for (let k = 0; k < xs.length; k++) {
    const pw = new Float64Array(2 * n - 1);
    let p = 1;
    for (let j = 0; j < 2 * n - 1; j++) { pw[j] = p; p *= xs[k]; }
    for (let i = 0; i < n; i++) {
      b[i] += pw[i] * ys[k];
      for (let j = 0; j < n; j++) A[i][j] += pw[i + j];
    }
  }
  // 高斯消元
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) return null;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

const polyval = (c, x) => c.reduce((s, ci, i) => s + ci * Math.pow(x, i), 0);
const polyderiv = (c) => c.slice(1).map((ci, i) => ci * (i + 1));

// 数字格式:多项式系数要足够有效位,常数 2 位小数即可
const coefStr = (c) => c.toPrecision(8).replace(/\.?0+e/, 'e').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
const num = (x, d = 4) => +(+x).toFixed(d);

function polyExpr(coeffs, varName) {
  return coeffs.map((c, i) => {
    const cs = coefStr(c);
    if (i === 0) return cs;
    const sign = c >= 0 ? ' + ' : ' - ';
    const mag = coefStr(Math.abs(c));
    return `${sign}${mag}*${varName}${i > 1 ? `^${i}` : ''}`;
  }).join('').replace(/^ \+ /, '');
}

// 需要的最小输入(键名 → 提示)。连杆坐标由 LINKAGE 组统查。
const CORE_KEYS = ['Swingarm_Length', 'beta_static', 'Rake_Static', 'WB', 'Rf',
                   'Yoke_Offset', 'Shock_Stroke'];
const LINKAGE_KEYS = ['Drag_To_Swingarm_X', 'Drag_To_Swingarm_Y',
                      'Frame_Shock_Top_X', 'Frame_Shock_Top_Y'];

export function buildLoggerChannels(v, lang = 'zh', bikeName = '') {
  const missing = [];
  for (const k of CORE_KEYS) if (!Number.isFinite(+v[k])) missing.push(k);
  for (const k of LINKAGE_KEYS) if (!Number.isFinite(+v[k])) missing.push(k);
  if (missing.length) return { missing, channels: [], warnings: [], text: '' };

  const L = +v.Swingarm_Length, beta0 = +v.beta_static, rake0 = +v.Rake_Static;
  const WB = +v.WB, Rf = +v.Rf, offset = +v.Yoke_Offset, stroke = +v.Shock_Stroke;
  const kF = Number.isFinite(+v.Front_Spring_Rate) ? +v.Front_Spring_Rate : null;
  const kR = Number.isFinite(+v.Rear_Spring_Rate) ? +v.Rear_Spring_Rate : null;

  // ---- 采样连杆:shock 压缩 s → 后轮垂直行程 ----------------------------
  const xs = [], ys = [];
  const N = 41;
  let usable = stroke;
  for (let i = 0; i < N; i++) {
    const s = stroke * i / (N - 1);
    const y = rearVerticalTravel(v, s, L, beta0);
    if (!Number.isFinite(y)) { usable = stroke * (i - 1) / (N - 1); break; }
    xs.push(s); ys.push(y);
  }
  const warnings = [];
  if (xs.length < 10) {
    return { missing: [], channels: [], warnings: ['连杆在行程内锁死,无法采样(检查坐标)'], text: '' };
  }
  if (usable < stroke) warnings.push(`连杆在 shock ${num(usable, 1)}mm 后无解 —— 通道仅在 0..${num(usable, 1)}mm 内有效`);

  let deg = 3, coeffs = polyfit(xs, ys, deg);
  let maxRes = Math.max(...xs.map((x, i) => Math.abs(polyval(coeffs, x) - ys[i])));
  if (maxRes > 0.15) {
    const c4 = polyfit(xs, ys, 4);
    if (c4) {
      const r4 = Math.max(...xs.map((x, i) => Math.abs(polyval(c4, x) - ys[i])));
      if (r4 < maxRes) { deg = 4; coeffs = c4; maxRes = r4; }
    }
  }
  const mrCoeffs = polyderiv(coeffs);
  const mrStatic = polyval(mrCoeffs, 0);
  // 与解算器直接算的 MR 交叉验证(同一物理换个途径,差大说明拟合有问题)
  const dStatic = swingarmDeltaForShockTravel(v, 0.01, 0);
  const mrSolver = motionRatio(v, Number.isFinite(dStatic) ? dStatic : 0, L, beta0);
  if (Number.isFinite(mrSolver) && Math.abs(mrSolver - mrStatic) > 0.15) {
    warnings.push(`MR 自检: 多项式 ${num(mrStatic, 3)} vs 解算器 ${num(mrSolver, 3)} 差 >0.15 —— 谨慎使用`);
  }

  const sinB0 = Math.sin(beta0 * D2R), cosB0 = Math.cos(beta0 * D2R);
  const cosR0 = Math.cos(rake0 * D2R), sinR0 = Math.sin(rake0 * D2R);

  // ---- 通道表(表达式为通用数学语法,i2/RS3 的函数名一致: sin cos asin atan)
  // 角度全部经 0.0174533 显式转弧度,避免方言的 deg/rad 内建差异。
  const ch = [];
  ch.push({ name: 'MS_RearWheelTravel', unit: 'mm',
    expr: polyExpr(coeffs, '$RP'),
    note: `4-bar 采样拟合 ${deg} 阶,最大残差 ${num(maxRes, 3)}mm,有效域 0..${num(usable, 1)}mm` });
  ch.push({ name: 'MS_MotionRatio', unit: 'wheel/shock',
    expr: polyExpr(mrCoeffs, '$RP'),
    note: `MS_RearWheelTravel 的导数;静态 ${num(mrStatic, 3)}` });
  ch.push({ name: 'MS_ShockPerWheel', unit: 'shock/wheel',
    expr: '1 / MS_MotionRatio', note: '同一物理的另一种读法(RESULT_MODES)' });
  ch.push({ name: 'MS_FrontWheelTravelV', unit: 'mm',
    expr: `$FP * ${num(cosR0)}`, note: '叉行程的垂直分量(cos rake0)' });
  ch.push({ name: 'MS_Pitch', unit: 'deg',
    expr: `atan((MS_RearWheelTravel - MS_FrontWheelTravelV) / ${num(WB, 1)}) * 57.29578`,
    note: '正 = 后压得更多 = 抬头方向(rake 增大)' });
  ch.push({ name: 'MS_Rake', unit: 'deg',
    expr: `${num(rake0, 2)} + MS_Pitch`, note: `基线 ${num(rake0, 2)}(全伸展参考态)` });
  ch.push({ name: 'MS_GroundTrail', unit: 'mm',
    expr: `(${num(Rf, 1)} * sin(MS_Rake * 0.0174533) - ${num(offset, 1)}) / cos(MS_Rake * 0.0174533)`,
    note: `offset ${num(offset, 1)} 来自本车 profile` });
  ch.push({ name: 'MS_SwingarmAngle', unit: 'deg',
    expr: `asin(${num(sinB0)} - MS_RearWheelTravel / ${num(L, 1)}) * 57.29578 + MS_Pitch`,
    note: '地面参考(含俯仰),与 app RESULTS 同口径' });
  ch.push({ name: 'MS_Wheelbase', unit: 'mm',
    expr: `${num(WB, 1)} + ${num(L, 1)} * (cos(asin(${num(sinB0)} - MS_RearWheelTravel / ${num(L, 1)})) - ${num(cosB0)}) - $FP * ${num(sinR0)}`,
    note: '摇臂水平投影变化 + 叉行程水平分量' });
  if (kF !== null) {
    ch.push({ name: 'MS_FrontWheelRate', unit: 'N/mm',
      expr: `${num(2 * kF, 2)} / (cos(MS_Rake * 0.0174533)^2)`,
      note: `2 × ${num(kF, 2)} N/mm(两根弹簧)` });
  }
  if (kR !== null) {
    ch.push({ name: 'MS_RearWheelRate', unit: 'N/mm',
      expr: `${num(kR, 1)} / (MS_MotionRatio^2)`, note: `弹簧 ${num(kR, 1)} N/mm` });
  }
  if (kF !== null && kR !== null) {
    ch.push({ name: 'MS_SpringCenter', unit: '-',
      expr: 'MS_RearWheelRate / (MS_RearWheelRate + MS_FrontWheelRate)', note: '' });
  }

  // 注意:这里拿到的 v 是材料化后的值,H_CG 等即使未绑定也带着 INPUT_META
  // 默认值 —— 默认值证明不了任何事(readiness 同款规则),所以 v1 无条件不生成
  // 这两类通道,而不是试图从值上区分"实测"与"默认"。
  const skipped = [
    'Anti-Squat / CofG 通道:需要实测 Mass/H_CG/L_CG(缺实测 CG 的 anti-squat 只有比较价值,teardown §3.4)',
    'Wheel Force 通道:需要预载/topout/气簧模型(商业版同样不含 bump rubber 力)',
  ];

  // ---- CSV 查表(给偏好 table 而非 equation 的系统) ----------------------
  const csv = ['shock_pot_mm,rear_wheel_travel_mm,motion_ratio']
    .concat(xs.map((x, i) => `${num(x, 1)},${num(ys[i], 2)},${num(polyval(mrCoeffs, x), 4)}`))
    .join('\n');

  // ---- 汇总文本 ----------------------------------------------------------
  const today = new Date().toISOString().slice(0, 10);
  const head = [
    `# MotoSPEC Formula Explorer — 数采数学通道导出`,
    `# 车型: ${bikeName || '(未命名)'}    日期: ${today}`,
    `# `,
    `# 电位计约定(导入前必须核对,不符就先做传感器标定换算):`,
    `#   $FP = 前叉压缩量 mm, 0 = 全伸展(topped out), 沿叉管轴向`,
    `#   $RP = 后避震压缩量 mm, 0 = 全伸展`,
    `#   把 $FP / $RP 全文替换成你 logger 里的实际通道名。`,
    `# `,
    `# 参考态 = profile 基线(全伸展) —— 与本 app RESULTS 的静态参考一致。`,
    `# 连杆拟合: ${deg} 阶多项式, 最大残差 ${num(maxRes, 3)}mm, 有效 0..${num(usable, 1)}mm`,
    warnings.length ? warnings.map(w => `# ⚠ ${w}`).join('\n') : null,
    `# 未生成(缺输入,不给假数):`,
    skipped.map(s => `#   - ${s}`).join('\n'),
    ``,
    `# ============ 通道定义(逐条建立,先建靠前的,后面的会引用它们) ============`,
    ``,
  ].filter(x => x !== null).join('\n');

  const body = ch.map(c =>
    `${c.name} [${c.unit}]\n  = ${c.expr}${c.note ? `\n  # ${c.note}` : ''}`).join('\n\n');

  const tail = [
    ``, ``,
    `# ============ 导入方法(商业版同款路径) ============`,
    `# MoTeC i2 Pro : Tools > Maths > 逐条新建 Expression,粘贴上面的公式`,
    `# AiM RS3      : Math Channels 设置 > Add Channel,逐条粘贴;`,
    `#                再到 session 的齿轮菜单里启用这组通道`,
    `# 函数名 sin/cos/asin/atan 两家一致;角度已显式经 0.0174533 转弧度,`,
    `# ^ 为幂(i2 也接受;RS3 若不识别请改写为连乘)。`,
    ``,
    `# ============ CSV 查表(shock pot → 后轮行程 / MR) ============`,
    csv,
  ].join('\n');

  return { missing: [], channels: ch, warnings, skipped,
           coeffs: { rwt: coeffs, mr: mrCoeffs, maxResidual: maxRes, usableStroke: usable },
           text: head + body + tail };
}
