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
  // ===== 主通道 =====
  Trail_Static: {
    name: 'Trail_Static', label: '静态拖曳距', unit: 'mm', type: 'channel',
    desc: '前轮接地点到转向轴地面交点的水平距离。静态测量基础值，决定直行稳定性与转向反馈。',
    formula: [
      '( ', {ref:'Rf'}, ' × sin(', {ref:'Rake_Static'}, ') − ', {ref:'O'}, ' ) / cos(', {ref:'Rake_Static'}, ')'
    ],
    deps: ['Rf', 'Rake_Static', 'O'],
    note: 'Rake 转弧度后代入。增大 Rake 或减小 Offset 都会增大 Trail，提高直行稳定性但降低转向轻巧度。'
  },

  // ===== 中间计算量 =====
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
  H_CG: { name:'H_CG', label:'重心高度', unit:'mm', type:'input',
    desc:'人车综合重心距地面的垂直高度。', source:'称重台 + 倾斜法实测',
    typical:'600 – 700 mm（含车手）' },
  L_CG: { name:'L_CG', label:'重心到后轴水平距离', unit:'mm', type:'input',
    desc:'人车综合重心到后轮轴的水平距离。', source:'称重 + 几何换算',
    typical:'700 – 800 mm' },
  Mass: { name:'Mass', label:'人车总质量', unit:'kg', type:'input',
    desc:'车辆 + 车手 + 装备的总质量。', source:'称重',
    typical:'250 – 280 kg' },
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
  WB:                { def: 1400,  min: 1300,  max: 1550,  step: 1 },
  Rf:                { def: 310,   min: 290,   max: 330,   step: 1 },
  O:                 { def: 32,    min: 15,    max: 45,    step: 0.5 },
  beta_static:       { def: 14,    min: 5,     max: 25,    step: 0.1 },
  L_SA:              { def: 580,   min: 500,   max: 650,   step: 1 },
  H_CG:              { def: 650,   min: 500,   max: 800,   step: 1 },
  L_CG:              { def: 750,   min: 600,   max: 900,   step: 1 },
  Mass:              { def: 265,   min: 180,   max: 380,   step: 1 },
  front_weight_dist: { def: 0.52,  min: 0.30,  max: 0.70,  step: 0.005 },
  rear_weight_dist:  { def: 0.48,  min: 0.30,  max: 0.70,  step: 0.005 },
};

// Each calc takes a `v` object containing already-computed values for its dependencies
export const CALC = {
  Trail_Static: v => {
    const r = v.Rake_Static * D2R;
    return (v.Rf * Math.sin(r) - v.O) / Math.cos(r);
  },
  W_F_Static:    v => v.Mass * 9.81 * v.front_weight_dist,
  W_R_Static:    v => v.Mass * 9.81 * v.rear_weight_dist,
};

// Topological order: every entry's deps appear earlier in the list
export const TOPO_ORDER = ['Trail_Static', 'W_F_Static', 'W_R_Static'];

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
