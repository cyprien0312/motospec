// ============================================================
// MotoSPEC formula registry (pure module — no DOM, no i18n)
// ============================================================

import {
  motionRatio, progression,
  rearVerticalTravel, rearRideHeight,
  swingarmDeltaForShockTravel,
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
    desc: '后悬挂压缩时摇臂相对水平面的实时夹角。通过 4-bar 连杆闭合从避震行程 + clevis RHA 反解 Δβ，再加到静态角上。',
    formula: [
      {ref:'beta_static'}, ' + Δβ(linkage,', {ref:'Shock_Clevis_RHA'}, ',', {ref:'Travel_Rear'}, ')'
    ],
    deps: [
      'beta_static', 'Travel_Rear', 'Shock_Clevis_RHA',
      'Frame_Rocker_Pivot_X', 'Frame_Rocker_Pivot_Y',
      'Rocker_To_Shock_X', 'Rocker_To_Shock_Y',
      'Rocker_To_Drag_X', 'Rocker_To_Drag_Y',
      'Drag_To_Swingarm_X', 'Drag_To_Swingarm_Y',
      'Frame_Shock_Top_X', 'Frame_Shock_Top_Y',
    ],
    note: 'Δβ 由 swingarmDeltaForShockTravel 经 4-bar 闭合解出。Shock_Clevis_RHA > 0 把避震机械加长 → 静态摇臂角度被顶到新位置；Travel_Rear 是相对 RHA 调整后的避震行程。'
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
      'arcsin( ', {ref:'Travel_Rear'}, ' / ', {ref:'Swingarm_Length'}, ' )'
    ],
    deps: ['Travel_Rear', 'Swingarm_Length']
  },
  theta_thrust: {
    name: 'θ_Thrust', label: '驱动力推力角', unit: 'rad', type: 'intermediate',
    desc: '链条拉力与摇臂线合成的瞬时推力方向。tan 值 = 链条角 tan + 摇臂角 tan。',
    formula: [
      'arctan( tan(', {ref:'theta_chain_dynamic'}, ') + tan(', {ref:'MotoSPEC_SwgarmAngl'}, ') )'
    ],
    deps: ['theta_chain_dynamic', 'MotoSPEC_SwgarmAngl'],
    note: '注意：标准切线法直接对 tan 求和，再求反正切。链条角现由 sprocket 几何动态求出 (H2)。'
  },
  theta_chain_dynamic: {
    name: 'θ_Chain_Dyn', label: '动态链条拉力角', unit: 'deg', type: 'intermediate',
    desc: '前小齿轮顶端 → 后大齿轮顶端的上方外切线相对水平面的夹角，正值代表"链条向前侧上扬"（产生抗蹲）。前链轮坐标固定于车架；后链轮中心随摇臂以 Swingarm_Length × MotoSPEC_SwgarmAngl 摆动。',
    formula: [
      'atan2(Cf.y − Cr.y, Cf.x − Cr.x) + arcsin((r_f − r_r) / |Cf − Cr|)',
    ],
    deps: [
      'Front_Sprocket_X', 'Front_Sprocket_Y',
      'Front_Sprocket', 'Rear_Sprocket', 'Chain_Pitch',
      'Swingarm_Length', 'MotoSPEC_SwgarmAngl',
    ],
    note: '链节距 15.875 mm 适用于 520/525/530 链条。后链轮中心: (−L·cos(β), −L·sin(β))，β 为 MotoSPEC_SwgarmAngl 度数。'
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
  Front_Sprocket:       { name:'Front_Sprocket',       label:'前链轮齿数', unit:'T', type:'input',
    desc:'前链轮齿数。', source:'链轮规格', typical:'14 – 17 T' },
  Rear_Sprocket:        { name:'Rear_Sprocket',        label:'后链轮齿数', unit:'T', type:'input',
    desc:'后链轮齿数。', source:'链轮规格', typical:'40 – 48 T' },
  Front_Sprocket_X:     { name:'Front_Sprocket_X',     label:'前链轮中心 X', unit:'mm', type:'input',
    desc:'前链轮中心 X 坐标 (相对摇臂枢轴, +X 前向)。占位默认值，需按车型校准。',
    source:'车架几何', typical:'30 – 80 mm' },
  Front_Sprocket_Y:     { name:'Front_Sprocket_Y',     label:'前链轮中心 Y', unit:'mm', type:'input',
    desc:'前链轮中心 Y 坐标 (相对摇臂枢轴, +Y 上)。占位默认值，需按车型校准。',
    source:'车架几何', typical:'-10 – 30 mm' },
  Chain_Pitch:          { name:'Chain_Pitch',          label:'链节距', unit:'mm', type:'input',
    desc:'摩托车链条节距。520 / 525 / 530 链条均为 15.875 mm (5/8")。',
    source:'链条规格', typical:'15.875 mm' },
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
    desc:'后轮垂直位移对避震行程的瞬时比值，在静态点 δ=0 用 4-bar 连杆闭合数值微分求得。后轮高度 y_w = Swingarm_Length·sin(beta_static + δ)；避震长度 shock(δ) 由 closeFourBar 在每个摇臂角下解 rocker→shock 端点到 Frame_Shock_Top 的距离。',
    formula: [
      '|d ', {ref:'Swingarm_Length'}, '·sin(', {ref:'beta_static'}, '+δ) / dδ|',
      ' ÷ ',
      '|d shock(δ; 4-bar) / dδ|',
      '  |  δ = 0'
    ],
    deps: [
      'Swingarm_Length', 'beta_static',
      'Frame_Rocker_Pivot_X', 'Frame_Rocker_Pivot_Y',
      'Rocker_To_Shock_X',    'Rocker_To_Shock_Y',
      'Rocker_To_Drag_X',     'Rocker_To_Drag_Y',
      'Drag_To_Swingarm_X',   'Drag_To_Swingarm_Y',
      'Frame_Shock_Top_X',    'Frame_Shock_Top_Y',
    ],
    note: '中心差分实现：MR(0) ≈ (y_w(+ε) − y_w(−ε)) / (shock(+ε) − shock(−ε))，ε=0.5°。Pro-Link 模式同一求解器，将 β 取负在摇臂参考系中工作。'
  },
  Progression: {
    name:'Progression', label:'渐进性 (%)', unit:'%', type:'intermediate',
    desc:'后悬挂全行程的运动比变化幅度，相对最小值的百分比。摇臂角从 0° 扫到全行程角，逐点求 Motion_Ratio。',
    formula: [
      '(MR_max − MR_min) / MR_min × 100',
      '  |  δ ∈ [0°, 25°]'
    ],
    deps: [
      'Swingarm_Length', 'beta_static',
      'Frame_Rocker_Pivot_X', 'Frame_Rocker_Pivot_Y',
      'Rocker_To_Shock_X',    'Rocker_To_Shock_Y',
      'Rocker_To_Drag_X',     'Rocker_To_Drag_Y',
      'Drag_To_Swingarm_X',   'Drag_To_Swingarm_Y',
      'Frame_Shock_Top_X',    'Frame_Shock_Top_Y',
    ],
    note: '正值（典型 5–25%）= 渐进式连杆（越压越硬）；接近 0% = 几乎线性；负值 = 退化连杆（越压越软）。'
  },
  Rear_Ride_Height: {
    name:'Rear_Ride_Height', label:'后部车高参考', unit:'mm', type:'intermediate',
    desc:'后轮轴心相对摇臂枢轴的有符号垂直坐标（轮在枢轴下方为负）。Shock_Clevis_RHA 把避震加长 → 摇臂转得更远离水平 → 后轮下沉，该值更负 → 实际车尾抬高。',
    formula: [
      '− ', {ref:'Swingarm_Length'}, ' × sin(', {ref:'beta_static'}, ' + Δβ_now)',
      '  |  Δβ_now = 4-bar 反解(', {ref:'Shock_Clevis_RHA'}, ' + ', {ref:'Travel_Rear'}, ')'
    ],
    deps: [
      'Swingarm_Length', 'beta_static', 'Shock_Clevis_RHA', 'Travel_Rear',
      'Frame_Rocker_Pivot_X', 'Frame_Rocker_Pivot_Y',
      'Rocker_To_Shock_X',    'Rocker_To_Shock_Y',
      'Rocker_To_Drag_X',     'Rocker_To_Drag_Y',
      'Drag_To_Swingarm_X',   'Drag_To_Swingarm_Y',
      'Frame_Shock_Top_X',    'Frame_Shock_Top_Y',
    ],
    note: '静态时 (Travel_Rear=0、RHA=0)，简化为 −Swingarm_Length·sin(beta_static)。RHA 改变 4-bar 静态参考点。'
  },
  Rear_Wheel_Vertical_Travel: {
    name:'Rear_Wheel_Vertical_Travel', label:'后轮垂直行程', unit:'mm', type:'intermediate',
    desc:'当前避震位下的轮位相对 RHA 调整后静态参考点的垂直位移幅度（恒为非负）。约等于 shock 行程 × Motion_Ratio（在 MR 的局部线性段成立）。',
    formula: [
      '| ', {ref:'Swingarm_Length'}, '·sin(', {ref:'beta_static'}, '+Δβ_now)',
      ' − ',
      {ref:'Swingarm_Length'}, '·sin(', {ref:'beta_static'}, '+Δβ_static) |',
      '  |  Δβ_now = 4-bar 反解(', {ref:'Shock_Clevis_RHA'}, '+', {ref:'Travel_Rear'}, '),  Δβ_static = 4-bar 反解(', {ref:'Shock_Clevis_RHA'}, ')'
    ],
    deps: [
      'Swingarm_Length', 'beta_static', 'Shock_Clevis_RHA', 'Travel_Rear',
      'Frame_Rocker_Pivot_X', 'Frame_Rocker_Pivot_Y',
      'Rocker_To_Shock_X',    'Rocker_To_Shock_Y',
      'Rocker_To_Drag_X',     'Rocker_To_Drag_Y',
      'Drag_To_Swingarm_X',   'Drag_To_Swingarm_Y',
      'Frame_Shock_Top_X',    'Frame_Shock_Top_Y',
    ],
    note: 'Travel_Rear=0 时恒为 0。非线性渐进连杆下，wheel 行程 / shock 行程不等于静态 Motion_Ratio。'
  },
  Rear_Wheel_Rate: {
    name:'Rear_Wheel_Rate', label:'后轮综合刚度', unit:'N/mm', type:'channel',
    desc:'静态下沉点的后轮综合刚度。Motion_Ratio = 轮行程 / 避震行程 (≈2-3)。能量恒等式：Rear_Wheel_Rate = Rear_Spring_Rate / Motion_Ratio²。',
    formula: [{ref:'Rear_Spring_Rate'}, ' / ', {ref:'Motion_Ratio'}, '²'],
    deps: ['Rear_Spring_Rate', 'Motion_Ratio']
  },
  Front_Wheel_Rate: {
    name:'Front_Wheel_Rate', label:'前轮综合刚度', unit:'N/mm', type:'channel',
    desc:'前轮综合刚度 (轮端)。MR_front = 1 / cos(Rake_Static) ≈ 1.05–1.10 表示前叉每单位前轮垂直行程的压缩量；Front_Wheel_Rate = Front_Spring_Rate / MR_front²。',
    formula: [{ref:'Front_Spring_Rate'}, ' × cos²(', {ref:'Rake_Static'}, ')'],
    deps: ['Front_Spring_Rate', 'Rake_Static']
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
  Front_Sprocket:       { def: 16,    min: 12,    max: 20,    step: 1 },
  Rear_Sprocket:        { def: 42,    min: 35,    max: 55,    step: 1 },
  Front_Sprocket_X:     { def: 50,    min: -50,   max: 200,   step: 1 },
  Front_Sprocket_Y:     { def: 10,    min: -100,  max: 200,   step: 1 },
  Chain_Pitch:          { def: 15.875, min: 12.7, max: 19.05, step: 0.001 },
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
  delta_beta:    v => Math.asin(Math.max(-1, Math.min(1, v.Travel_Rear / v.Swingarm_Length))),
  MotoSPEC_Rake: v => v.Rake_Static - v.Pitch * R2D,
  MotoSPEC_Trail: v => {
    const r = v.MotoSPEC_Rake * D2R;
    return (v.Rf * Math.sin(r) - v.O) / Math.cos(r);
  },
  MotoSPEC_SwgarmAngl: v => {
    const cfg = {
      Linkage_Mode: v.Linkage_Mode,
      Frame_Rocker_Pivot_X: v.Frame_Rocker_Pivot_X,
      Frame_Rocker_Pivot_Y: v.Frame_Rocker_Pivot_Y,
      Rocker_To_Shock_X:    v.Rocker_To_Shock_X,
      Rocker_To_Shock_Y:    v.Rocker_To_Shock_Y,
      Rocker_To_Drag_X:     v.Rocker_To_Drag_X,
      Rocker_To_Drag_Y:     v.Rocker_To_Drag_Y,
      Drag_To_Swingarm_X:   v.Drag_To_Swingarm_X,
      Drag_To_Swingarm_Y:   v.Drag_To_Swingarm_Y,
      Frame_Shock_Top_X:    v.Frame_Shock_Top_X,
      Frame_Shock_Top_Y:    v.Frame_Shock_Top_Y,
    };
    // swingarmDeltaForShockTravel returns Δβ in DEGREES, signed (negative on
    // compression because swingarm rotates upward, decreasing the angle below
    // horizontal). Add directly to beta_static.
    const dBetaDeg = swingarmDeltaForShockTravel(cfg, v.Travel_Rear, v.Shock_Clevis_RHA || 0);
    return v.beta_static + dBetaDeg;
  },
  theta_chain_dynamic: v => {
    // Sprocket pitch radii (mm): r = pitch / (2·sin(π/N))
    const rF = v.Chain_Pitch / (2 * Math.sin(Math.PI / v.Front_Sprocket));
    const rR = v.Chain_Pitch / (2 * Math.sin(Math.PI / v.Rear_Sprocket));
    // Front sprocket center fixed in frame.
    const Cfx = v.Front_Sprocket_X;
    const Cfy = v.Front_Sprocket_Y;
    // Rear sprocket center: rear axle, on swingarm. Swingarm extends backward
    // (-X) and downward by the dynamic swingarm angle below horizontal.
    const beta = v.MotoSPEC_SwgarmAngl * D2R;
    const Crx = -v.Swingarm_Length * Math.cos(beta);
    const Cry = -v.Swingarm_Length * Math.sin(beta);
    const dx = Cfx - Crx, dy = Cfy - Cry;
    const d = Math.hypot(dx, dy);
    if (!Number.isFinite(d) || d <= Math.abs(rF - rR)) return 0;
    // Angle of vector rear→front, plus upper-external-tangent offset for
    // unequal radii. Convention: positive when chain top tilts up going from
    // rear toward front (rear sprocket lower / smaller).
    const baseAngle = Math.atan2(dy, dx);
    const offset = Math.asin((rF - rR) / d);
    return (baseAngle + offset) * R2D;
  },
  theta_thrust:  v => Math.atan(Math.tan(v.theta_chain_dynamic * D2R) + Math.tan(v.MotoSPEC_SwgarmAngl * D2R)),
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
  Rear_Ride_Height:          v => rearRideHeight(v, v.Travel_Rear, v.Swingarm_Length, v.beta_static, v.Shock_Clevis_RHA || 0),
  Rear_Wheel_Vertical_Travel:v => rearVerticalTravel(v, v.Travel_Rear, v.Swingarm_Length, v.beta_static, v.Shock_Clevis_RHA || 0),
  // Motion_Ratio is wheel/shock (≈2–3). Energy identity:
  //   K_wheel = K_spring · (x_spring / x_wheel)² = K_spring / Motion_Ratio²
  Rear_Wheel_Rate: v => {
    const mr = v.Motion_Ratio;
    if (!Number.isFinite(mr) || mr === 0) return NaN;
    return v.Rear_Spring_Rate / (mr * mr);
  },
  // MR_front: fork compression per unit vertical front-wheel travel
  //   = 1 / cos(Rake_Static); typically 1.05–1.10 for sportbikes.
  // Front_Wheel_Rate = Front_Spring_Rate / MR_front² (energy identity).
  Front_Wheel_Rate: v => {
    const MR_front = 1 / Math.cos(v.Rake_Static * D2R);
    return v.Front_Spring_Rate / (MR_front * MR_front);
  },
};

// Topological order: every entry's deps appear earlier in the list
export const TOPO_ORDER = [
  'O',
  'Trail_Static',
  'Pitch', 'delta_beta', 'MotoSPEC_Rake', 'MotoSPEC_Trail',
  'MotoSPEC_SwgarmAngl', 'theta_chain_dynamic', 'theta_thrust', 'theta_cg', 'MotoSPEC_AntSquat',
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
