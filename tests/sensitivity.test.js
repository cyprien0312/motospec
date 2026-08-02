// 灵敏度地图 —— 用解析已知的导数钉数值微分,防止链路悄悄断掉。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSensitivity, SENS_OUTPUTS } from '../src/sensitivity.js';
import { defaultValues } from '../src/formulas.js';

// R3 共享库同款材料化值(linkless + 实测几何)
const R3 = {
  ...defaultValues(),
  Linkage_Mode: 'linkless',
  Drag_To_Swingarm_X: -219.16, Drag_To_Swingarm_Y: -10.91,
  Frame_Shock_Top_X: -134.85, Frame_Shock_Top_Y: 254.76,
  Swingarm_Length: 595.2, Swingarm_Length_ref: 595.2,
  beta_static: 10.66, Rake_Static: 25.77, WB: 1406.1, Rf: 297.7,
  Yoke_Offset: 37.4, Yoke_Offset_ref: 37.4,
  Fork_Position: 9, Fork_Position_ref: 9,
  Shock_Length: 280, Shock_Length_ref: 280, Shock_Stroke: 48,
  Front_Spring_Rate: 8.0, Rear_Spring_Rate: 190,
};

test('dTrail/dYokeOffset = −1/cos(rake) —— 解析钉', () => {
  const s = computeSensitivity(R3, 'zh');
  const off = s.levers.find(r => r.key === 'Yoke_Offset');
  // step=1mm → Δtrail 应为 −1/cos(25.77°) ≈ −1.110
  const expected = -1 / Math.cos(25.77 * Math.PI / 180);
  assert.ok(Math.abs(off.effects.MotoSPEC_Trail - expected) < 0.02,
    `${off.effects.MotoSPEC_Trail} vs ${expected}`);
  // offset 不应影响运动比与轮率
  assert.ok(Math.abs(off.effects.Motion_Ratio) < 1e-9);
  assert.ok(Math.abs(off.effects.Rear_Wheel_Rate) < 1e-9);
});

test('dRake/dForkPosition ≈ −deg(atan(cos(rake)/WB)) —— 沿叉轴 1mm 的垂直分量', () => {
  const s = computeSensitivity(R3, 'zh');
  const fp = s.levers.find(r => r.key === 'Fork_Position');
  const expected = -Math.atan(Math.cos(25.77 * Math.PI / 180) / 1406.1) * 180 / Math.PI;
  assert.ok(Math.abs(fp.effects.MotoSPEC_Rake - expected) < 0.003,
    `${fp.effects.MotoSPEC_Rake} vs ${expected}`);
});

test('readiness 门禁:传 ready 集时,未绑定 CG 的 Anti_Squat 必须是 null', () => {
  // ready = R3 实际绑定的键(几何+连杆+弹簧),CG 类刻意不在其中 ——
  // 材料化值里的 H_CG 默认 650 证明不了绑定,门禁必须拦下 Anti_Squat。
  const ready = new Set(Object.keys(R3));
  ['Mass', 'H_CG', 'L_CG', 'front_weight_dist', 'rear_weight_dist'].forEach(k => ready.delete(k));
  const s = computeSensitivity(R3, 'zh', ready);
  assert.equal(s.baseline.Anti_Squat, null);
  for (const r of [...s.levers, ...s.loadcase]) {
    assert.equal(r.effects.Anti_Squat, null, `${r.key} 的 Anti_Squat 应被门禁拦下`);
  }
  // 而不依赖 CG 的输出照常
  assert.ok(s.baseline.MotoSPEC_Trail !== null);
});

test('后弹簧只动刚度侧,不动几何', () => {
  const s = computeSensitivity(R3, 'zh');
  const k = s.levers.find(r => r.key === 'Rear_Spring_Rate');
  assert.ok(Math.abs(k.effects.MotoSPEC_Rake) < 1e-9);
  assert.ok(Math.abs(k.effects.MotoSPEC_Trail) < 1e-9);
  assert.ok(k.effects.Rear_Wheel_Rate > 0);
  assert.ok(k.effects.Spring_Center > 0);
});

test('算不出的格子是 null(诚实),不是假数', () => {
  // 抽掉连杆坐标 → 依赖 4-bar 的输出应为 null,纯前端几何仍可算
  const broken = { ...R3 };
  delete broken.Drag_To_Swingarm_X;
  const s = computeSensitivity(broken, 'zh');
  const sl = s.levers.find(r => r.key === 'Shock_Length');
  assert.equal(sl.effects.Motion_Ratio, null);
  const off = s.levers.find(r => r.key === 'Yoke_Offset');
  assert.ok(off.effects.MotoSPEC_Trail !== null, '前端几何不依赖连杆,应可算');
});

test('输出集完整且基线有限(R3 全量输入下)', () => {
  const s = computeSensitivity(R3, 'zh');
  for (const o of SENS_OUTPUTS) {
    if (o.id === 'Anti_Squat') continue;   // 需要 CG/链轮,R3 值未测,允许缺
    assert.ok(s.baseline[o.id] !== null, `baseline ${o.id} 应有限`);
  }
});
