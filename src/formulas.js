// ============================================================
// MotoSPEC formula registry (pure module — no DOM, no i18n)
// ============================================================

export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;

// ============================================================
// 参数图：每个节点定义自身的公式与依赖
// 公式数组中的元素：字符串 = 文本；对象 {ref: 'id'} = 可点击参数
// ============================================================
export const P = {
  // ===== 6 大主通道 =====
  MotoSPEC_Rake: {
    name: 'MotoSPEC_Rake', label: '动态后倾角', unit: 'deg', type: 'channel',
    desc: '车辆运动中实时的转向轴前倾角度。前叉压缩、后减震伸展时车头下沉，Rake 变小。',
    formula: [
      {ref:'Rake_Static'}, ' − ', {ref:'Pitch'}, ' × (180 / π)'
    ],
    deps: ['Rake_Static', 'Pitch'],
    note: 'arctan 算出的 Pitch 是弧度，乘 180/π 转为度数后再相减。'
  },
  MotoSPEC_Trail: {
    name: 'MotoSPEC_Trail', label: '动态拖曳距', unit: 'mm', type: 'channel',
    desc: '前轮接地点到转向轴地面交点的距离。Rake 变小时 Trail 急剧缩短，是前轮"路感"的核心来源。',
    formula: [
      '( ', {ref:'Rf'}, ' × sin(', {ref:'MotoSPEC_Rake'}, ') − ', {ref:'O'}, ' ) / cos(', {ref:'MotoSPEC_Rake'}, ')'
    ],
    deps: ['Rf', 'MotoSPEC_Rake', 'O'],
    note: '使用动态 Rake（已转为弧度）代入。重刹时 Trail 谷底过低 → 前轮反馈模糊。'
  },
  MotoSPEC_SwgarmAngl: {
    name: 'MotoSPEC_SwgarmAngl', label: '动态摇臂角度', unit: 'deg', type: 'channel',
    desc: '后悬挂压缩时摇臂相对水平面的实时夹角。压缩时角度变小（摇臂趋于水平）。',
    formula: [
      {ref:'beta_static'}, ' − ', {ref:'delta_beta'}, ' × (180 / π)'
    ],
    deps: ['beta_static', 'delta_beta'],
    note: '出弯开油时若摇臂趋近水平，机械抓地力骤降，赛车会向外抛。'
  },
  MotoSPEC_AntSquat: {
    name: 'MotoSPEC_AntSquat', label: '抗蹲伏百分比', unit: '%', type: 'channel',
    desc: '加速时几何对车尾下沉的抵消程度。100% = 车尾高度不变；>100% = 车尾升起；<100% = 车尾下沉。',
    formula: [
      '( tan(', {ref:'theta_thrust'}, ') / tan(', {ref:'theta_cg'}, ') ) × 100'
    ],
    deps: ['theta_thrust', 'theta_cg'],
    note: '出弯调校的灵魂指标。120% 把后轮压住；140% 顶死悬挂、易引发 High-side。'
  },
  MotoSPEC_FrontForce: {
    name: 'MotoSPEC_FrontForce', label: '前轮垂直载荷', unit: 'N', type: 'channel',
    desc: '前轮压在地面上的法向力。刹车时增大、加速时减小。决定前胎抓地力极限。',
    formula: [
      {ref:'W_F_Static'}, ' + ', {ref:'delta_W'}, ' + ', {ref:'F_Aero'}, ' × ', {ref:'C_f_aero'}
    ],
    deps: ['W_F_Static', 'delta_W', 'F_Aero', 'C_f_aero'],
    note: '入弯瞬间若 FrontForce 飙升过快 → 前胎过载抱死。'
  },
  MotoSPEC_RearForce: {
    name: 'MotoSPEC_RearForce', label: '后轮垂直载荷', unit: 'N', type: 'channel',
    desc: '后轮压在地面上的法向力。加速时增大、刹车时减小。',
    formula: [
      {ref:'W_R_Static'}, ' − ', {ref:'delta_W'}, ' + ', {ref:'F_Aero'}, ' × ', {ref:'C_r_aero'}
    ],
    deps: ['W_R_Static', 'delta_W', 'F_Aero', 'C_r_aero'],
    note: '出弯点 RearForce 突然陡降 → 后轮即将打滑。'
  },

  // ===== 中间计算量 =====
  Pitch: {
    name: 'Pitch', label: '底盘俯仰角', unit: 'rad', type: 'intermediate',
    desc: '车架相对水平面的俯仰角度。前轮下沉 > 后轮下沉时为正（刹车点头）。',
    formula: [
      'arctan( (', {ref:'Travel_Front'}, ' − ', {ref:'Travel_Rear'}, ') / ', {ref:'WB'}, ' )'
    ],
    deps: ['Travel_Front', 'Travel_Rear', 'WB']
  },
  delta_beta: {
    name: 'Δβ', label: '摇臂角度变化量', unit: 'rad', type: 'intermediate',
    desc: '后轮垂直位移引起的摇臂角度变化量（弧度制）。',
    formula: [
      'arcsin( ', {ref:'Travel_Rear'}, ' / ', {ref:'L_SA'}, ' )'
    ],
    deps: ['Travel_Rear', 'L_SA']
  },
  theta_thrust: {
    name: 'θ_Thrust', label: '驱动力推力角', unit: 'rad', type: 'intermediate',
    desc: '链条拉力与摇臂线合成的瞬时推力方向。tan 值 = 链条角 tan + 摇臂角 tan。',
    formula: [
      'arctan( tan(', {ref:'theta_chain'}, ') + tan(', {ref:'MotoSPEC_SwgarmAngl'}, ') )'
    ],
    deps: ['theta_chain', 'MotoSPEC_SwgarmAngl'],
    note: '注意：标准切线法直接对 tan 求和，再求反正切。'
  },
  theta_cg: {
    name: 'θ_CG', label: '重心角', unit: 'rad', type: 'intermediate',
    desc: '从后轮接地点看向重心的仰角。',
    formula: [
      'arctan( ', {ref:'H_CG'}, ' / ', {ref:'L_CG'}, ' )'
    ],
    deps: ['H_CG', 'L_CG']
  },
  delta_W: {
    name: 'ΔW', label: '纵向载荷转移量', unit: 'N', type: 'intermediate',
    desc: '由于纵向加速度引起的前后轮重量转移量。刹车为正（前移）、加速为负。',
    formula: [
      {ref:'Mass'}, ' × ', {ref:'a_x'}, ' × 9.81 × ( ', {ref:'H_CG'}, ' / ', {ref:'WB'}, ' )'
    ],
    deps: ['Mass', 'a_x', 'H_CG', 'WB'],
    note: '此处 a_x 单位为 g（无量纲）；若用 m/s² 则去掉 ×9.81。'
  },
  F_Aero: {
    name: 'F_Aero', label: '空气动力学下压力', unit: 'N', type: 'intermediate',
    desc: '高速时由车身、定风翼产生的总气动下压力。',
    formula: [
      '½ × ', {ref:'rho'}, ' × ', {ref:'V'}, '² × ', {ref:'Cd'}, ' × ', {ref:'A'}
    ],
    deps: ['rho', 'V', 'Cd', 'A']
  },
  W_F_Static: {
    name: 'W_F_Static', label: '前轮静态受力', unit: 'N', type: 'intermediate',
    desc: '车辆静止时前轮承受的法向力。',
    formula: [
      {ref:'Mass'}, ' × 9.81 × ', {ref:'front_weight_dist'}
    ],
    deps: ['Mass', 'front_weight_dist']
  },
  W_R_Static: {
    name: 'W_R_Static', label: '后轮静态受力', unit: 'N', type: 'intermediate',
    desc: '车辆静止时后轮承受的法向力。',
    formula: [
      {ref:'Mass'}, ' × 9.81 × ', {ref:'rear_weight_dist'}
    ],
    deps: ['Mass', 'rear_weight_dist']
  },

  // ===== 输入参数（叶子节点）=====
  Rake_Static: { name:'Rake_Static', label:'静态后倾角', unit:'deg', type:'input',
    desc:'车辆静止时转向轴相对垂直方向的角度。', source:'车架几何手册或实车测量',
    typical:'23° – 27°（运动车），27° – 32°（旅行车）' },
  Travel_Front: { name:'Travel_Front', label:'前轮垂直行程', unit:'mm', type:'input',
    desc:'前轮当前的下沉量。下沉为正。', source:'前叉电位计实时数据',
    typical:'0 – 120 mm（取决于车型）' },
  Travel_Rear: { name:'Travel_Rear', label:'后轮垂直行程', unit:'mm', type:'input',
    desc:'后轮当前的垂直下沉量。下沉为正。需要乘 Motion Ratio 还原。', source:'后减震电位计 × Motion Ratio',
    typical:'0 – 130 mm' },
  WB: { name:'WB', label:'轴距 (Wheelbase)', unit:'mm', type:'input',
    desc:'前后轮轴中心的水平距离。', source:'车架手册',
    typical:'1340 – 1440 mm（运动车）' },
  Rf: { name:'Rf', label:'前轮滚动半径', unit:'mm', type:'input',
    desc:'前轮在载荷下的实际滚动半径（含轮胎形变修正）。', source:'轮胎规格 + 形变系数',
    typical:'300 – 320 mm（17 寸轮）' },
  O: { name:'O', label:'总偏移量 (Offset)', unit:'mm', type:'input',
    desc:'三星台联板中心到前叉中心的距离 + 轮芯偏移。', source:'三星台规格 + 实测',
    typical:'25 – 35 mm（你前面拍照测得约 32 mm）' },
  beta_static: { name:'β_Static', label:'静态摇臂角度', unit:'deg', type:'input',
    desc:'车辆静止时摇臂轴心到后轮轴心的连线相对水平面的夹角。', source:'车架手册或实测',
    typical:'10° – 18°' },
  L_SA: { name:'L_SA', label:'摇臂有效长度', unit:'mm', type:'input',
    desc:'摇臂轴心到后轮轴心的距离。', source:'车架手册',
    typical:'550 – 600 mm' },
  theta_chain: { name:'θ_Chain', label:'链条拉力角', unit:'deg', type:'input',
    desc:'前小齿轮最高点 → 后大齿轮最高点连线的角度（相对水平面）。', source:'齿轮坐标 + 几何计算',
    typical:'动态变化，通常 10° – 25°' },
  H_CG: { name:'H_CG', label:'重心高度', unit:'mm', type:'input',
    desc:'人车综合重心距地面的垂直高度。', source:'称重台 + 倾斜法实测',
    typical:'600 – 700 mm（含车手）' },
  L_CG: { name:'L_CG', label:'重心到后轴水平距离', unit:'mm', type:'input',
    desc:'人车综合重心到后轮轴的水平距离。', source:'称重 + 几何换算',
    typical:'700 – 800 mm' },
  Mass: { name:'Mass', label:'人车总质量', unit:'kg', type:'input',
    desc:'车辆 + 车手 + 装备的总质量。', source:'称重',
    typical:'250 – 280 kg' },
  a_x: { name:'a_x', label:'纵向加速度', unit:'g', type:'input',
    desc:'车辆纵向加速度。规范：刹车为正、加速为负，便于直接计算前移载荷。', source:'IMU 或 GPS',
    typical:'−0.5 g（加速）至 +1.4 g（重刹）' },
  rho: { name:'ρ', label:'空气密度', unit:'kg/m³', type:'input',
    desc:'当前环境的空气密度（受温度、海拔影响）。', source:'气象数据或 ISA 标准大气',
    typical:'约 1.225 kg/m³（海平面 15°C）' },
  V: { name:'V', label:'实时车速', unit:'m/s', type:'input',
    desc:'车辆相对地面的速度。', source:'GPS 或轮速传感器',
    typical:'0 – 90 m/s（约 0 – 320 km/h）' },
  Cd: { name:'Cd', label:'阻力系数', unit:'—', type:'input',
    desc:'车辆 + 车手综合形态的空气阻力系数（无量纲）。', source:'风洞测试或厂商规格',
    typical:'0.30 – 0.50' },
  A: { name:'A', label:'迎风面积', unit:'m²', type:'input',
    desc:'车辆 + 车手在前进方向上的投影面积。', source:'实测或 CAD',
    typical:'0.4 – 0.6 m²' },
  C_f_aero: { name:'C_f_aero', label:'前轮气动下压力分配比例', unit:'—', type:'input',
    desc:'空气下压力分配到前轮的比例。', source:'风洞或赛事工程经验',
    typical:'0.3 – 0.5' },
  C_r_aero: { name:'C_r_aero', label:'后轮气动下压力分配比例', unit:'—', type:'input',
    desc:'空气下压力分配到后轮的比例。', source:'风洞或赛事工程经验',
    typical:'0.5 – 0.7' },
  front_weight_dist: { name:'front_weight_dist', label:'前轮静态重量分配', unit:'—', type:'input',
    desc:'静止时前轮承担的总重量比例。', source:'称重台',
    typical:'0.50 – 0.55（运动车）' },
  rear_weight_dist: { name:'rear_weight_dist', label:'后轮静态重量分配', unit:'—', type:'input',
    desc:'静止时后轮承担的总重量比例。= 1 − front_weight_dist。', source:'称重台',
    typical:'0.45 – 0.50' },
};

// ============================================================
// 实时计算引擎
// ============================================================
export const INPUT_META = {
  Rake_Static:       { def: 24,    min: 20,    max: 35,    step: 0.1 },
  Travel_Front:      { def: 30,    min: 0,     max: 150,   step: 1 },
  Travel_Rear:       { def: 25,    min: 0,     max: 150,   step: 1 },
  WB:                { def: 1400,  min: 1300,  max: 1550,  step: 1 },
  Rf:                { def: 310,   min: 290,   max: 330,   step: 1 },
  O:                 { def: 32,    min: 15,    max: 45,    step: 0.5 },
  beta_static:       { def: 14,    min: 5,     max: 25,    step: 0.1 },
  L_SA:              { def: 580,   min: 500,   max: 650,   step: 1 },
  theta_chain:       { def: 15,    min: 0,     max: 30,    step: 0.1 },
  H_CG:              { def: 650,   min: 500,   max: 800,   step: 1 },
  L_CG:              { def: 750,   min: 600,   max: 900,   step: 1 },
  Mass:              { def: 265,   min: 180,   max: 380,   step: 1 },
  a_x:               { def: 0.5,   min: -1,    max: 1.5,   step: 0.01 },
  rho:               { def: 1.225, min: 0.9,   max: 1.4,   step: 0.005 },
  V:                 { def: 30,    min: 0,     max: 100,   step: 0.5 },
  Cd:                { def: 0.4,   min: 0.2,   max: 0.7,   step: 0.01 },
  A:                 { def: 0.5,   min: 0.3,   max: 0.8,   step: 0.01 },
  C_f_aero:          { def: 0.4,   min: 0,     max: 1,     step: 0.01 },
  C_r_aero:          { def: 0.6,   min: 0,     max: 1,     step: 0.01 },
  front_weight_dist: { def: 0.52,  min: 0.30,  max: 0.70,  step: 0.005 },
  rear_weight_dist:  { def: 0.48,  min: 0.30,  max: 0.70,  step: 0.005 },
};

// Each calc takes a `v` object containing already-computed values for its dependencies
export const CALC = {
  Pitch:         v => Math.atan((v.Travel_Front - v.Travel_Rear) / v.WB),
  delta_beta:    v => Math.asin(Math.max(-1, Math.min(1, v.Travel_Rear / v.L_SA))),
  MotoSPEC_Rake: v => v.Rake_Static - v.Pitch * R2D,
  MotoSPEC_Trail: v => {
    const r = v.MotoSPEC_Rake * D2R;
    return (v.Rf * Math.sin(r) - v.O) / Math.cos(r);
  },
  MotoSPEC_SwgarmAngl: v => v.beta_static - v.delta_beta * R2D,
  theta_thrust:  v => Math.atan(Math.tan(v.theta_chain * D2R) + Math.tan(v.MotoSPEC_SwgarmAngl * D2R)),
  theta_cg:      v => Math.atan(v.H_CG / v.L_CG),
  MotoSPEC_AntSquat: v => Math.tan(v.theta_thrust) / Math.tan(v.theta_cg) * 100,
  delta_W:       v => v.Mass * v.a_x * 9.81 * (v.H_CG / v.WB),
  F_Aero:        v => 0.5 * v.rho * v.V ** 2 * v.Cd * v.A,
  W_F_Static:    v => v.Mass * 9.81 * v.front_weight_dist,
  W_R_Static:    v => v.Mass * 9.81 * v.rear_weight_dist,
  MotoSPEC_FrontForce: v => v.W_F_Static + v.delta_W + v.F_Aero * v.C_f_aero,
  MotoSPEC_RearForce:  v => v.W_R_Static - v.delta_W + v.F_Aero * v.C_r_aero,
};

// Topological order: every entry's deps appear earlier in the list
export const TOPO_ORDER = [
  'Pitch', 'delta_beta', 'MotoSPEC_Rake', 'MotoSPEC_Trail',
  'MotoSPEC_SwgarmAngl', 'theta_thrust', 'theta_cg', 'MotoSPEC_AntSquat',
  'delta_W', 'F_Aero', 'W_F_Static', 'W_R_Static',
  'MotoSPEC_FrontForce', 'MotoSPEC_RearForce',
];

export function defaultValues() {
  const v = {};
  for (const id in INPUT_META) v[id] = INPUT_META[id].def;
  return v;
}

export function computeAll(inputValues) {
  const out = { ...inputValues };
  for (const id of TOPO_ORDER) {
    if (P[id] && P[id].type !== 'input') out[id] = CALC[id](out);
  }
  return out;
}
