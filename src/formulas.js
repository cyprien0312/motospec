// ============================================================
// MotoSPEC formula registry (pure module — no DOM, no i18n)
// ============================================================

import {
  motionRatio, progression,
  rearVerticalTravel, rearRideHeight,
} from './linkage.js';

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
  O: { name:'O', label:'总偏移量 (Offset)', unit:'mm', type:'channel',
    desc:'转向轴到前轮接地中心的垂直偏移量。等同于三星台偏移（轮芯偏移按 0 处理）。',
    formula: [ {ref:'Yoke_Offset'} ],
    deps: ['Yoke_Offset'],
    note: '三星台偏移改变 → O 改变 → Trail 改变；Rake 不受影响（Rake 由车架转向头管角度决定）。' },
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

  // ===== 新增输入参数 (Phase A: linkage / spring / drivetrain / dynamic) =====
  Yoke_Offset:          { name:'Yoke_Offset',          label:'三星台偏移量', unit:'mm', type:'input',
    desc:'三星台联板偏移量。', source:'三星台规格', typical:'25 – 40 mm' },
  Fork_Position:        { name:'Fork_Position',        label:'前叉伸出量', unit:'mm', type:'input',
    desc:'前叉管伸出三星台的长度。', source:'实测', typical:'0 – 15 mm' },
  Front_Spring_Rate:    { name:'Front_Spring_Rate',    label:'前叉弹簧刚度', unit:'N/mm', type:'input',
    desc:'前叉主弹簧刚度。', source:'弹簧规格', typical:'8.0 – 10.0 N/mm' },
  Front_Spring_Preload: { name:'Front_Spring_Preload', label:'前叉弹簧预压', unit:'mm', type:'input',
    desc:'前叉弹簧预紧量。', source:'调校设定', typical:'5 – 15 mm' },
  Front_Oil_Level:      { name:'Front_Oil_Level',      label:'前叉油位', unit:'mm', type:'input',
    desc:'前叉油位高度（从顶部测量）。', source:'调校设定', typical:'100 – 200 mm' },
  Front_Topout_Rate:    { name:'Front_Topout_Rate',    label:'前叉回顶弹簧刚度', unit:'N/mm', type:'input',
    desc:'前叉回顶弹簧刚度。', source:'弹簧规格', typical:'3.0 – 5.0 N/mm' },
  Front_Topout_Length:  { name:'Front_Topout_Length',  label:'前叉回顶弹簧长度', unit:'mm', type:'input',
    desc:'前叉回顶弹簧有效长度。', source:'弹簧规格', typical:'30 – 50 mm' },
  Swingarm_Length:      { name:'Swingarm_Length',      label:'摇臂长度', unit:'mm', type:'input',
    desc:'摇臂枢轴到后轮中心的距离。', source:'车架手册', typical:'520 – 600 mm' },
  Shock_Clevis_RHA:     { name:'Shock_Clevis_RHA',     label:'后避震Clevis调整', unit:'mm', type:'input',
    desc:'后避震 Clevis 车高调整量。', source:'调校设定', typical:'-5 – 5 mm' },
  Shock_Length:         { name:'Shock_Length',         label:'后避震长度', unit:'mm', type:'input',
    desc:'后避震眼对眼总长。', source:'避震规格', typical:'290 – 320 mm' },
  Rear_Spring_Rate:     { name:'Rear_Spring_Rate',     label:'后避震弹簧刚度', unit:'N/mm', type:'input',
    desc:'后避震主弹簧刚度。', source:'弹簧规格', typical:'90 – 180 N/mm' },
  Rear_Spring_Preload:  { name:'Rear_Spring_Preload',  label:'后避震弹簧预压', unit:'mm', type:'input',
    desc:'后避震弹簧预紧量。', source:'调校设定', typical:'5 – 20 mm' },
  Rear_Topout_Rate:     { name:'Rear_Topout_Rate',     label:'后避震回顶刚度', unit:'N/mm', type:'input',
    desc:'后避震回顶弹簧刚度。', source:'弹簧规格', typical:'0 – 200 N/mm' },
  Rear_Topout_Length:   { name:'Rear_Topout_Length',   label:'后避震回顶长度', unit:'mm', type:'input',
    desc:'后避震回顶弹簧有效长度。', source:'弹簧规格', typical:'0 – 15 mm' },
  Linkarm_Length:       { name:'Linkarm_Length',       label:'连杆臂长度', unit:'mm', type:'input',
    desc:'后悬挂连杆臂长度。', source:'车架手册', typical:'80 – 140 mm' },
  Front_Sprocket:       { name:'Front_Sprocket',       label:'前链轮齿数', unit:'T', type:'input',
    desc:'前链轮齿数。', source:'链轮规格', typical:'14 – 17 T' },
  Rear_Sprocket:        { name:'Rear_Sprocket',        label:'后链轮齿数', unit:'T', type:'input',
    desc:'后链轮齿数。', source:'链轮规格', typical:'40 – 48 T' },
  Frame_Rocker_Pivot_X: { name:'Frame_Rocker_Pivot_X', label:'摇臂枢轴X', unit:'mm', type:'input',
    desc:'摇臂枢轴 X 坐标 (相对车架原点)。', source:'车架几何', typical:'-100 – 0 mm' },
  Frame_Rocker_Pivot_Y: { name:'Frame_Rocker_Pivot_Y', label:'摇臂枢轴Y', unit:'mm', type:'input',
    desc:'摇臂枢轴 Y 坐标 (相对车架原点)。', source:'车架几何', typical:'50 – 150 mm' },
  Rocker_To_Shock_X:    { name:'Rocker_To_Shock_X',    label:'摇臂→避震X', unit:'mm', type:'input',
    desc:'摇臂到避震连接点 X 坐标。', source:'车架几何', typical:'-100 – 0 mm' },
  Rocker_To_Shock_Y:    { name:'Rocker_To_Shock_Y',    label:'摇臂→避震Y', unit:'mm', type:'input',
    desc:'摇臂到避震连接点 Y 坐标。', source:'车架几何', typical:'50 – 150 mm' },
  Rocker_To_Drag_X:     { name:'Rocker_To_Drag_X',     label:'摇臂→拉杆X', unit:'mm', type:'input',
    desc:'摇臂到拉杆连接点 X 坐标。', source:'车架几何', typical:'-80 – 0 mm' },
  Rocker_To_Drag_Y:     { name:'Rocker_To_Drag_Y',     label:'摇臂→拉杆Y', unit:'mm', type:'input',
    desc:'摇臂到拉杆连接点 Y 坐标。', source:'车架几何', typical:'30 – 100 mm' },
  Drag_To_Swingarm_X:   { name:'Drag_To_Swingarm_X',   label:'拉杆→摇臂X', unit:'mm', type:'input',
    desc:'拉杆到摇臂连接点 X 坐标。', source:'车架几何', typical:'0 – 80 mm' },
  Drag_To_Swingarm_Y:   { name:'Drag_To_Swingarm_Y',   label:'拉杆→摇臂Y', unit:'mm', type:'input',
    desc:'拉杆到摇臂连接点 Y 坐标。', source:'车架几何', typical:'-30 – 30 mm' },
  Frame_Shock_Top_X:    { name:'Frame_Shock_Top_X',    label:'车架→避震顶X', unit:'mm', type:'input',
    desc:'车架避震顶部连接点 X 坐标。', source:'车架几何', typical:'-250 – -100 mm' },
  Frame_Shock_Top_Y:    { name:'Frame_Shock_Top_Y',    label:'车架→避震顶Y', unit:'mm', type:'input',
    desc:'车架避震顶部连接点 Y 坐标。', source:'车架几何', typical:'200 – 400 mm' },
  Lean_Angle:           { name:'Lean_Angle',           label:'倾角', unit:'deg', type:'input',
    desc:'车辆相对垂直方向的倾角 (过弯)。', source:'IMU', typical:'0 – 60°' },

  // ===== 新增计算量 (Phase A) =====
  Final_Ratio: {
    name:'Final_Ratio', label:'最终传动比', unit:'—', type:'intermediate',
    desc:'后链轮 / 前链轮 齿数比。',
    formula: [{ref:'Rear_Sprocket'}, ' / ', {ref:'Front_Sprocket'}],
    deps: ['Front_Sprocket', 'Rear_Sprocket']
  },
  Motion_Ratio: {
    name:'Motion_Ratio', label:'运动比 (轮/避震)', unit:'—', type:'intermediate',
    desc:'后轮垂直位移 / 后避震行程。需要连杆几何 (Phase C)。',
    formula: ['(Phase C 连杆求解)'],
    deps: []
  },
  Progression: {
    name:'Progression', label:'渐进性 (%)', unit:'%', type:'intermediate',
    desc:'后悬挂全行程渐进性百分比。需要连杆几何 (Phase C)。',
    formula: ['(Phase C 连杆求解)'],
    deps: []
  },
  Rear_Ride_Height: {
    name:'Rear_Ride_Height', label:'后部车高参考', unit:'mm', type:'intermediate',
    desc:'后部车高参考值。需要连杆几何 (Phase C)。',
    formula: ['(Phase C 连杆求解)'],
    deps: []
  },
  Rear_Wheel_Vertical_Travel: {
    name:'Rear_Wheel_Vertical_Travel', label:'后轮垂直行程', unit:'mm', type:'intermediate',
    desc:'后轮的垂直位移。需要连杆几何 (Phase C)。',
    formula: ['(Phase C 连杆求解)'],
    deps: []
  },
  Rear_Wheel_Rate: {
    name:'Rear_Wheel_Rate', label:'后轮综合刚度', unit:'N/mm', type:'channel',
    desc:'后轮综合弹簧刚度 (轮端)。需要连杆几何 (Phase C)。',
    formula: ['(Phase C 连杆求解)'],
    deps: []
  },
  Front_Wheel_Rate: {
    name:'Front_Wheel_Rate', label:'前轮综合刚度', unit:'N/mm', type:'channel',
    desc:'前轮综合弹簧刚度 (轮端)。需要连杆几何 (Phase C)。',
    formula: ['(Phase C 连杆求解)'],
    deps: []
  },
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

  // ===== Phase A new inputs =====
  Yoke_Offset:          { def: 32,    min: 20,    max: 45,    step: 0.5 },
  Fork_Position:        { def: 5,     min: 0,     max: 20,    step: 0.5 },
  Front_Spring_Rate:    { def: 9.0,   min: 6.0,   max: 14.0,  step: 0.1 },
  Front_Spring_Preload: { def: 10.0,  min: 0,     max: 25,    step: 0.5 },
  Front_Oil_Level:      { def: 170,   min: 80,    max: 220,   step: 1 },
  Front_Topout_Rate:    { def: 4.0,   min: 0,     max: 10,    step: 0.1 },
  Front_Topout_Length:  { def: 40,    min: 0,     max: 80,    step: 1 },
  Swingarm_Length:      { def: 580,   min: 480,   max: 650,   step: 0.1 },
  Shock_Clevis_RHA:     { def: 0,     min: -10,   max: 10,    step: 0.5 },
  Shock_Length:         { def: 310,   min: 280,   max: 340,   step: 0.1 },
  Rear_Spring_Rate:     { def: 110,   min: 70,    max: 220,   step: 1 },
  Rear_Spring_Preload:  { def: 14,    min: 0,     max: 30,    step: 0.5 },
  Rear_Topout_Rate:     { def: 188,   min: 0,     max: 300,   step: 1 },
  Rear_Topout_Length:   { def: 8,     min: 0,     max: 30,    step: 0.5 },
  Linkarm_Length:       { def: 92,    min: 0,     max: 180,   step: 0.1 },
  Front_Sprocket:       { def: 16,    min: 12,    max: 20,    step: 1 },
  Rear_Sprocket:        { def: 42,    min: 35,    max: 55,    step: 1 },
  // Defaults below match the Pro-Link placeholder (default linkage mode).
  Frame_Rocker_Pivot_X: { def: -200, min: -400,  max: 400,   step: 1 },
  Frame_Rocker_Pivot_Y: { def: -50,  min: -500,  max: 500,   step: 1 },
  Rocker_To_Shock_X:    { def: -130, min: -400,  max: 400,   step: 1 },
  Rocker_To_Shock_Y:    { def: -60,  min: -500,  max: 500,   step: 1 },
  Rocker_To_Drag_X:     { def: -190, min: -400,  max: 400,   step: 1 },
  Rocker_To_Drag_Y:     { def: -90,  min: -500,  max: 500,   step: 1 },
  Drag_To_Swingarm_X:   { def: -20,  min: -400,  max: 400,   step: 1 },
  Drag_To_Swingarm_Y:   { def: -20,  min: -500,  max: 500,   step: 1 },
  Frame_Shock_Top_X:    { def: -120, min: -400,  max: 400,   step: 1 },
  Frame_Shock_Top_Y:    { def: 50,   min: -500,  max: 500,   step: 1 },
  Lean_Angle:           { def: 0,     min: 0,     max: 65,    step: 0.5 },
};

// Each calc takes a `v` object containing already-computed values for its dependencies
export const CALC = {
  O:             v => v.Yoke_Offset,
  Trail_Static: v => {
    const r = v.Rake_Static * D2R;
    return (v.Rf * Math.sin(r) - v.O) / Math.cos(r);
  },
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

  // Phase A: real CALC for Final_Ratio; rest are stubs returning NaN until Phase C
  Final_Ratio:               v => v.Rear_Sprocket / v.Front_Sprocket,
  Motion_Ratio:              v => motionRatio(v, 0, v.Swingarm_Length, v.beta_static),
  Progression:               v => progression(v, v.Swingarm_Length, v.beta_static),
  Rear_Ride_Height:          v => rearRideHeight(v, v.Travel_Rear, v.Swingarm_Length, v.beta_static),
  Rear_Wheel_Vertical_Travel:v => rearVerticalTravel(v, v.Travel_Rear, v.Swingarm_Length, v.beta_static),
  Rear_Wheel_Rate:           v => NaN,
  Front_Wheel_Rate:          v => NaN,
};

// Topological order: every entry's deps appear earlier in the list
export const TOPO_ORDER = [
  'O',
  'Trail_Static',
  'Pitch', 'delta_beta', 'MotoSPEC_Rake', 'MotoSPEC_Trail',
  'MotoSPEC_SwgarmAngl', 'theta_thrust', 'theta_cg', 'MotoSPEC_AntSquat',
  'delta_W', 'F_Aero', 'W_F_Static', 'W_R_Static',
  'MotoSPEC_FrontForce', 'MotoSPEC_RearForce',
  // Phase A additions
  'Final_Ratio',
  'Motion_Ratio', 'Progression', 'Rear_Ride_Height',
  'Rear_Wheel_Vertical_Travel', 'Rear_Wheel_Rate', 'Front_Wheel_Rate',
];

export function defaultValues() {
  const v = {};
  for (const id in INPUT_META) v[id] = INPUT_META[id].def;
  // Linkage_Mode is non-numeric so it doesn't live in INPUT_META; default
  // to Pro-Link, which matches the linkage-coord defaults above.
  v.Linkage_Mode = 'pro-link';
  return v;
}

export function computeAll(inputValues) {
  const out = { ...inputValues };
  for (const id of TOPO_ORDER) {
    if (P[id] && P[id].type !== 'input') out[id] = CALC[id](out);
  }
  return out;
}
