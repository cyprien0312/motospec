// Logger math-channel export — 用 R3 实测数据(共享库同款)钉行为。
// 关键约定:参考态=全伸展;MR 通道是 RWT 多项式的导数;缺输入返回 missing
// 而不是半截结果;缺 CG 时 anti-squat/CofG 明确列为 skipped。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLoggerChannels } from '../src/logger-export.js';
import { motionRatio, swingarmDeltaForShockTravel, rearVerticalTravel } from '../src/linkage.js';

const R3 = {
  Linkage_Mode: 'linkless',
  Drag_To_Swingarm_X: -219.16, Drag_To_Swingarm_Y: -10.91,
  Frame_Shock_Top_X: -134.85, Frame_Shock_Top_Y: 254.76,
  // linkless 不读 rocker 坐标,但依赖图携带 —— 生成器不应要求它们
  Swingarm_Length: 595.2, beta_static: 10.66,
  Rake_Static: 25.77, WB: 1406.1, Rf: 297.7, Yoke_Offset: 37.4,
  Shock_Stroke: 48,
  Front_Spring_Rate: 8.0, Rear_Spring_Rate: 190,
};

test('R3: 生成核心通道且拟合可信', () => {
  const out = buildLoggerChannels(R3, 'zh', 'R3 test');
  assert.equal(out.missing.length, 0);
  const names = out.channels.map(c => c.name);
  for (const n of ['MS_RearWheelTravel', 'MS_MotionRatio', 'MS_Rake',
                   'MS_GroundTrail', 'MS_SwingarmAngle', 'MS_Wheelbase',
                   'MS_FrontWheelRate', 'MS_RearWheelRate', 'MS_SpringCenter']) {
    assert.ok(names.includes(n), `缺通道 ${n}`);
  }
  // 拟合残差红线:R3 linkless 接近线性,残差应远小于 0.15mm
  assert.ok(out.coeffs.maxResidual < 0.15, `残差 ${out.coeffs.maxResidual}`);
  assert.ok(out.coeffs.usableStroke >= 47.9, '全行程都应有解(linkless 永不锁死)');
});

test('R3: MR 多项式与解算器互证', () => {
  const out = buildLoggerChannels(R3, 'zh');
  const mr = out.coeffs.mr;
  const at = (c, x) => c.reduce((s, ci, i) => s + ci * Math.pow(x, i), 0);
  // 与 linkage.js 的 motionRatio 在静态点对照
  const d0 = swingarmDeltaForShockTravel(R3, 0.01, 0);
  const mrSolver = motionRatio(R3, d0, R3.Swingarm_Length, R3.beta_static);
  assert.ok(Math.abs(at(mr, 0) - mrSolver) < 0.1,
    `poly ${at(mr, 0)} vs solver ${mrSolver}`);
  // 中行程处多项式应逼近解算器采样(同一物理换途径)
  const s = 24;
  const eps = 0.5;
  const num = (rearVerticalTravel(R3, s + eps, R3.Swingarm_Length, R3.beta_static)
             - rearVerticalTravel(R3, s - eps, R3.Swingarm_Length, R3.beta_static)) / (2 * eps);
  assert.ok(Math.abs(at(mr, s) - num) < 0.05, `poly ${at(mr, s)} vs numeric ${num}`);
});

test('缺核心输入 → missing 列表,不产半截结果', () => {
  const v = { ...R3 };
  delete v.Shock_Stroke;
  const out = buildLoggerChannels(v, 'zh');
  assert.ok(out.missing.includes('Shock_Stroke'));
  assert.equal(out.channels.length, 0);
  assert.equal(out.text, '');
});

test('anti-squat/CofG 无条件列入 skipped —— 材料化值里的 CG 默认值证明不了绑定', () => {
  // 即使 v 里带着 H_CG/L_CG(effectiveBikeValues 会填 INPUT_META 默认),
  // v1 也不生成这两类通道:默认值 ≠ 实测,readiness 同款诚实规则。
  const out = buildLoggerChannels({ ...R3, H_CG: 650, L_CG: 750, Mass: 265 }, 'zh');
  assert.ok(out.skipped.some(s => s.includes('Anti-Squat')));
  assert.ok(!out.channels.some(c => /squat|cofg/i.test(c.name)));
});

test('无弹簧刚度 → 轮率通道自然缺席,几何通道照常', () => {
  const v = { ...R3 };
  delete v.Front_Spring_Rate; delete v.Rear_Spring_Rate;
  const out = buildLoggerChannels(v, 'zh');
  const names = out.channels.map(c => c.name);
  assert.ok(!names.includes('MS_FrontWheelRate'));
  assert.ok(!names.includes('MS_SpringCenter'));
  assert.ok(names.includes('MS_GroundTrail'));
});

test('导出文本含电位计约定与 CSV 查表', () => {
  const out = buildLoggerChannels(R3, 'zh', 'R3');
  assert.match(out.text, /\$FP/);
  assert.match(out.text, /\$RP/);
  assert.match(out.text, /shock_pot_mm,rear_wheel_travel_mm,motion_ratio/);
  assert.match(out.text, /全伸展/);
});

test('.ajmc: 合法 JSON、RS3 语法、默认绑定 Front_Sup/Rear_Sup', () => {
  const out = buildLoggerChannels(R3, 'zh', 'R3');
  const arr = JSON.parse(out.ajmc);
  assert.equal(arr.length, out.channels.length);
  for (const e of arr) {
    // 真实样本的 schema 字段一个不少
    for (const k of ['area', 'comment', 'formula', 'frequency', 'function',
                     'generated_channel_name', 'group', 'is_stepped', 'name',
                     'operands', 'unit', 'usage_description', 'version']) {
      assert.ok(k in e, `缺字段 ${k}`);
    }
    assert.equal(e.version, 0);            // 用户自建通道的版本号(样本内证据)
    assert.ok(!/\$FP|\$RP/.test(e.formula), '占位符必须已替换');
  }
  const rwt = arr.find(e => e.generated_channel_name === 'MS_RearWheelTravel');
  assert.match(rwt.formula, /"Rear_Sup"\[mm\]/);
  const rake = arr.find(e => e.generated_channel_name === 'MS_Rake');
  assert.equal(rake.function, 4);          // deg → 4(样本内证据)
  assert.equal(rake.unit, 'deg');
  const trail = arr.find(e => e.generated_channel_name === 'MS_GroundTrail');
  assert.match(trail.formula, /SIN\("MS_Rake"\[deg\]/);   // 大写函数 + 引号引用
  // 自定义电位计名可覆盖默认
  const out2 = buildLoggerChannels(R3, 'zh', 'R3', { front: 'PotF', rear: 'PotR' });
  assert.match(JSON.parse(out2.ajmc)[0].formula, /"PotR"\[mm\]/);
});
