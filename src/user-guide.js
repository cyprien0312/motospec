// ============================================================
// MotoSPEC User Guide — bilingual long-form help
// ============================================================
//
// Rendered as a sixth top-level page (`__guide`) in index.html.
// `renderUserGuide({ lang, anchor })` returns a self-contained HTML
// fragment with `<section id="guide-…">` blocks; the host scrolls the
// requested anchor into view after injecting.
//
// Section anchors (kept in sync with PAGE_TO_ANCHOR in index.html):
//   getting-started · dashboard · chassis · linkage ·
//   datatable · catalogs · concepts · faq

export const GUIDE_ANCHORS = [
  'getting-started', 'dashboard', 'chassis', 'linkage',
  'datatable', 'catalogs', 'concepts', 'faq',
];

const STR = {
  zh: {
    title: '使用指南',
    intro: 'MotoSPEC 是一个静态摩托车底盘几何 / 4-bar 连杆运动学计算器。本指南分章节介绍每个页面的功能、术语和当前实现范围。',
    toc: '目录',
    toc_items: {
      'getting-started': '快速开始',
      'dashboard':       '仪表盘',
      'chassis':         '底盘设置（Chassis Setup）',
      'linkage':         '连杆设置（Linkage Setup）',
      'datatable':       '数据表（Data Table）',
      'catalogs':        '部件库（Component Library）',
      'concepts':        '概念与约定',
      'faq':             '已知限制 / FAQ',
    },
    sections: {
      'getting-started': {
        h: '快速开始',
        body: `
          <p>典型工作流：</p>
          <ol>
            <li><strong>Chassis Setup</strong> 页面填入车架几何、质量、气动分配、轮胎数据，点击「保存为底盘配置」。</li>
            <li><strong>Linkage Setup</strong> 页面选择连杆模式（linked / pro-link），输入 4-bar 坐标或长度，点击「保存为预设」。</li>
            <li><strong>Data Table</strong> 页面新增车型列，从下拉中选刚保存的 chassis 配置 + 各部件（前叉、避震、摇臂、连杆、三星台），结果即刻计算。</li>
            <li>RESULTS 中显示「Need: …」的格子表示该结果依赖的输入还未绑定 — 提示会指出缺哪个组件或哪个底盘字段。</li>
          </ol>
          <p>所有数据保存在浏览器 localStorage 中。导出可以通过部件库的「导出 JSON」按钮。</p>
        `,
      },
      'dashboard': {
        h: '仪表盘（Dashboard）',
        body: `
          <p>仪表盘展示参数图谱：每个参数节点有 type 标签 ——</p>
          <ul>
            <li><span class="badge channel">channel</span>对外暴露的最终输出量</li>
            <li><span class="badge intermediate">intermediate</span>中间量，被其他公式消费</li>
            <li><span class="badge input">input</span>叶子输入，没有公式</li>
          </ul>
          <p>点击参数名进入详情页，查看其公式、依赖图、当前值。从详情页可点击其他参数 chip 继续向下钻取。</p>
        `,
      },
      'chassis': {
        h: '底盘设置（Chassis Setup）',
        body: `
          <p>填入：</p>
          <ul>
            <li>车架几何：Rake_Static、WB（轴距）、beta_static</li>
            <li>基线设定：Yoke_Offset、Fork_Position、Swingarm_Length、Shock_Length —— 全部指<strong>测量 Rake/WB 那天车上装的值</strong>，也是数据表新列的起点</li>
            <li>质量与重心：Mass、H_CG、L_CG、前 / 后轮静态重量分配</li>
            <li>气动：前 / 后轮下压力分配（自动镜像，和为 1）</li>
            <li>轮胎与传动：Rf（前轮半径）、Front_Sprocket_X / Y、Chain_Pitch</li>
          </ul>
          <p>右上侧视图随 WB 和 Rf 自动等比缩放。点击「保存为底盘配置」会把 <code>CHASSIS_SPEC_FIELDS</code> 列出的全部字段一起存入 chassis catalog（缺失字段会回填默认值）。已保存的配置可从下拉中重新加载。</p>
          <p><strong>每个设定量只有一个输入框</strong>：填的是测量基线时的值（内部同时写入 live 与 <code>*_ref</code> 两个键，保证加载后所有差量为零）。「车现在装的是 27.5 offset」这类当前状态不存在配置里——去数据表对应列直接改（琥珀色 = 与配置分歧，清空恢复）。Yoke_Offset / Fork_Position 属于底盘配置而非前叉规格 — 同一支前叉可在不同车上有不同的伸出量。</p>
        `,
      },
      'linkage': {
        h: '连杆设置（Linkage Setup）',
        body: `
          <p>两种 4-bar 模式共用同一求解器：</p>
          <ul>
            <li><strong>linked</strong>：rocker 装在车架上（R7 / RS660 / Unitrack 等）</li>
            <li><strong>pro-link</strong>：rocker 跟随摇臂转动（Honda 系）— 内部把 β 取反、把 shock-top 转入摇臂坐标系即可，无需独立求解器</li>
          </ul>
          <p>两种输入风格：</p>
          <ul>
            <li><strong>Cartesian XY</strong>：直接给 4 个铰点坐标</li>
            <li><strong>Lengths-only</strong>：保留 3 个固定锚点（rocker pivot、drag anchor、frame shock top）+ 4 段量得长度，由两圆相交链解</li>
          </ul>
          <p>切换模式时，<strong>只有当输入还是默认 placeholder 时</strong>才会自动替换为对应模式的占位值；用户填过的数值不会被覆盖。点击「保存为预设」存入 linkage catalog，之后在 Data Table 里可作为部件选择。</p>
        `,
      },
      'datatable': {
        h: '数据表（Data Table）',
        body: `
          <p>多车横向对比工具。列数可变（0–5），通过表头的「+ 新增车型」/「×」按钮增删。</p>
          <h4>行类型</h4>
          <ul>
            <li><strong>下拉行</strong>（Chassis、Fork、Shock、Linkage）：从对应 catalog 选择条目，对应 specs 自动并入该列的 values</li>
            <li><strong>输入行</strong>：直接键入数值；空白时显示工具提示告诉你「该字段通常来自 X 配置 / 也可手填」</li>
            <li><strong>设定覆盖行</strong>（Yoke Offset / Fork Position / Swingarm Length）：选定 chassis 配置后变为可编辑，键入即在该列覆盖配置值（琥珀色边框提示分歧，清空恢复配置值）；未选配置时不可编辑——差量链需要配置里的基线</li>
            <li><strong>RESULTS 行</strong>：只读，根据公式从 values 计算</li>
          </ul>
          <h4>载荷状态（LOAD CASE）/ Sag</h4>
          <p>在 LOAD CASE 组输入实测的前后 sag（前沿前叉轴线量——扎带法；后在后轮轴处垂直量），整个 RESULTS 块就变成<strong>该悬挂位置下的实时值</strong>：Rake / Trail / 摇臂角 / 抗蹲 / 运动比 / 轴距全部随之变化——和真实 MotoSPEC 的单一 RESULTS 块一致。默认 0 = 未加载参考态（一个真实的物理状态，不是占位符）；sag 全为 0 时每个结果都精确等于静态值。填好弹簧数据（刚度/预载/回顶）和称重数据后，「预测下沉量」行会给出纯弹簧模型的理论 sag——与实测值的差就是气簧/摩擦/刚度偏差的诊断信号。</p>
          <p>参考态约定：Chassis 配置里的 Rake / 摇臂角 / 轴距描述的是你测量它们时的姿态，sag 是<strong>相对那个姿态的额外压缩</strong>。Fork Position、Shock Length 相对各自基线值（Chassis 配置的基线设定组）的差量，以及直接输入的前叉长度差（FRONT SETTINGS →「前叉长度差」，两叉并排实测）和前后胎半径差（「胎半径差 vs 基线胎」，0 = 同款胎）也进入同一条姿态链——管上提 / 换短叉 = 车头下降，换长避震 / 换高后胎 = 车尾抬高，都会实时反映到 Rake 上；前胎半径差还同时进入 Trail 公式的有效半径（Rf + Δ）。</p>
          <h4>「Need: …」提示</h4>
          <p>RESULTS 单元格只有当其依赖的所有叶子输入都被「真实绑定」（来自 chassis 配置 / 选中的部件 / 用户手填）时才显示数值；否则留空，并提示缺什么。例如选了 chassis 没选 fork，「Front Wheel Rate」会显示「Need: Fork specs」。Sag 输入默认即真实（0 = 未加载），从不出现在缺失提示里。</p>
          <h4>状态徽章</h4>
          <ul>
            <li><span class="dt-status dt-status-pending">PENDING</span>该输入暂未被任何 RESULTS 公式消费 — 填了也不会影响下面的结果</li>
          </ul>
        `,
      },
      'catalogs': {
        h: '部件库（Component Library）',
        body: `
          <p>4 个分类：chassis、forks、shocks、linkages。每个分类的有效条目 = 基线 JSON ⊕ 用户覆盖层（localStorage）。</p>
          <ul>
            <li>用户覆盖可以：新增条目、覆盖 / 扩展已有条目（specs 字段深度合并）、用墓碑对象（<code>{ __deleted: true }</code>）逻辑删除基线条目</li>
            <li>「导出 JSON」只导出覆盖层；「导入 JSON」会替换整个覆盖层</li>
            <li>「重置」清空覆盖层、回到出厂基线</li>
          </ul>
          <p>注意：<code>data/chassis.json</code> 出厂为空 — chassis 条目完全由 Chassis Setup 页面的「保存为底盘配置」生成。同理 linkage 预设由 Linkage Setup 页面保存。</p>
        `,
      },
      'concepts': {
        h: '概念与约定',
        body: `
          <ul>
            <li><strong>当前仅 static 路径</strong> — 动态读数（压缩瞬时几何、动态轮胎力）正在重建，DYNAMIC READINGS / DYNAMIC LOAD 表格组已临时移除</li>
            <li><strong>单位</strong>：长度 mm，角度度（°），力 N，刚度 N/mm，质量 kg</li>
            <li><strong>4-bar 坐标系</strong>：原点在摇臂枢轴，+X 向前，+Y 向上</li>
            <li><strong>Linkage 占位值</strong>：默认坐标只是为了让初次访问也能渲染图形；真要拿数值用必须输入实测值</li>
          </ul>
          <h4>"_static" 字段的真实含义</h4>
          <p>页面里很多字段带 <code>_static</code> 后缀（<code>Rake_Static</code>、<code>beta_static</code>、<code>Trail_Static</code> …）。<strong>由于目前没有动态弹簧压缩模拟，模型不假设任何特定参考状态</strong>——这些字段的真实含义是"你在哪个工况下量的，就代入哪个工况"。</p>
          <ul>
            <li>想分析<strong>避震完全伸长</strong>的几何 → 按完全伸长状态测量并录入</li>
            <li>想分析<strong>骑手 sag</strong> → 坐车上量好后录入</li>
            <li>想分析<strong>制动俯冲极限</strong> → 按俯冲到底的姿态录入</li>
          </ul>
          <p>4-bar 反解出的 Δβ 基于你输入的避震行程独立计算并叠加到 <code>beta_static</code> 上 — 你给的 <code>beta_static</code> 是哪个状态的，叠加结果就还是那个状态系下的。换句话说，整个工具本质上是个"静态快照"计算器，"_static" 命名是历史遗留，并不暗示一定是 sag 或一定是空载。</p>
        `,
      },
      'faq': {
        h: '已知限制 / FAQ',
        body: `
          <ul>
            <li><strong>RESULTS 显示「Need: …」？</strong> 该结果有公式但缺输入。提示会指明缺哪一组（Chassis 配置 / Fork 规格 / Linkage 坐标 …）— 在对应下拉中选条目即可。</li>
            <li><strong>填了输入但 RESULTS 没动？</strong> 检查该输入是否带 <span class="dt-status dt-status-pending">PENDING</span> 徽章 — 表示还没被任何公式消费。</li>
            <li><strong>切换语言数值会丢吗？</strong> 不会，<code>state.values</code> 不依赖语言。</li>
            <li><strong>导出哪些数据？</strong> 部件库的「导出 JSON」只导出用户覆盖层（不含 state.values 和车型列）。</li>
            <li><strong>测试参考？</strong> <code>tests/fixtures/reference-bikes.json</code> 钉死了 R6 / CBR1000RR / Panigale V4 三台车的官方 spec sheet 数值，用来卡公式回归。</li>
          </ul>
        `,
      },
    },
  },
  en: {
    title: 'User Guide',
    intro: 'MotoSPEC is a static motorcycle chassis-geometry / 4-bar linkage kinematics calculator. This guide walks through each page, terminology, and current implementation scope.',
    toc: 'Contents',
    toc_items: {
      'getting-started': 'Getting Started',
      'dashboard':       'Dashboard',
      'chassis':         'Chassis Setup',
      'linkage':         'Linkage Setup',
      'datatable':       'Data Table',
      'catalogs':        'Component Library',
      'concepts':        'Concepts & Conventions',
      'faq':             'Known Limits / FAQ',
    },
    sections: {
      'getting-started': {
        h: 'Getting Started',
        body: `
          <p>Typical workflow:</p>
          <ol>
            <li>On <strong>Chassis Setup</strong>, fill in frame geometry, mass, aero share, and tire data, then click "Save chassis profile".</li>
            <li>On <strong>Linkage Setup</strong>, pick a mode (linked / pro-link), enter the 4-bar coordinates or measured lengths, and click "Save as preset".</li>
            <li>On <strong>Data Table</strong>, add a bike column, pick the chassis profile + components (fork, shock, linkage) — RESULTS compute live.</li>
            <li>A "Need: …" cell in RESULTS means the formula has unbound inputs; the hint names which group is missing.</li>
          </ol>
          <p>Everything persists in browser localStorage. Use the catalog "Export JSON" button to back up your overlay.</p>
        `,
      },
      'dashboard': {
        h: 'Dashboard',
        body: `
          <p>The dashboard shows the parameter graph. Every node carries a type badge:</p>
          <ul>
            <li><span class="badge channel">channel</span>final output exposed externally</li>
            <li><span class="badge intermediate">intermediate</span>computed value consumed by other formulas</li>
            <li><span class="badge input">input</span>leaf input — no formula</li>
          </ul>
          <p>Click any parameter to open its detail page (formula, dependency graph, current value). From there, click parameter chips to drill further.</p>
        `,
      },
      'chassis': {
        h: 'Chassis Setup',
        body: `
          <p>Fields cover:</p>
          <ul>
            <li>Frame geometry: Rake_Static, WB, beta_static</li>
            <li>Baseline setup: Yoke_Offset, Fork_Position, Swingarm_Length, Shock_Length — all meaning <strong>what was fitted the day Rake/WB were measured</strong>; also the starting values for new table columns</li>
            <li>Mass &amp; CG: Mass, H_CG, L_CG, front / rear static weight distribution</li>
            <li>Aero: front / rear downforce share (auto-mirrored, sums to 1)</li>
            <li>Tire &amp; drivetrain: Rf, Front_Sprocket_X / Y, Chain_Pitch</li>
          </ul>
          <p>The side-view diagram auto-fits to your WB and Rf. "Save chassis profile" stores every field in <code>CHASSIS_SPEC_FIELDS</code> (missing fields are backfilled with defaults). Saved profiles can be reloaded from the dropdown.</p>
          <p><strong>One input per setup quantity</strong>: what you type is the measurement-baseline value (both the live key and its <code>*_ref</code> are written together, so a loaded profile always starts at zero delta). "The bike currently runs 27.5 offset" does not live in the profile — dial it per-column in the Data Table (amber = diverging from the profile; clear to restore). Yoke_Offset / Fork_Position belong to the chassis profile, not the fork spec — the same fork can have different stick-out across bikes.</p>
        `,
      },
      'linkage': {
        h: 'Linkage Setup',
        body: `
          <p>Two 4-bar modes share one solver:</p>
          <ul>
            <li><strong>linked</strong>: rocker mounted on the frame (R7 / RS660 / Unitrack-style)</li>
            <li><strong>pro-link</strong>: rocker rides the swingarm (Honda family) — implemented by negating β and transforming shock-top into the swingarm frame, no separate solver</li>
          </ul>
          <p>Two input styles:</p>
          <ul>
            <li><strong>Cartesian XY</strong>: enter the 4 joint coordinates directly</li>
            <li><strong>Lengths-only</strong>: keep 3 fixed anchors (rocker pivot, drag anchor, frame shock top) + 4 measured lengths; geometry is solved by chained two-circle intersections</li>
          </ul>
          <p>Switching modes auto-swaps placeholder values <strong>only if you haven't customized them</strong> — your edits are preserved. "Save as preset" stores into the linkage catalog so it shows up in the Data Table linkage dropdown.</p>
        `,
      },
      'datatable': {
        h: 'Data Table',
        body: `
          <p>Side-by-side bike comparison. Columns are variable (0–5), added/removed via the "+ Add Bike" / "×" buttons.</p>
          <h4>Row types</h4>
          <ul>
            <li><strong>Dropdown rows</strong> (Chassis, Fork, Shock, Linkage): pick a catalog entry; its specs merge into that column's values automatically</li>
            <li><strong>Input rows</strong>: type a number directly; empty cells show a tooltip pointing to the usual provider</li>
            <li><strong>Setup override rows</strong> (Yoke Offset / Fork Position / Swingarm Length): editable once a chassis profile is selected — typing overrides the profile for that column only (amber border = diverging; clear to restore). Not editable without a profile: the delta chain needs the profile's baseline</li>
            <li><strong>RESULTS rows</strong>: read-only, computed from values</li>
          </ul>
          <h4>Load case / Sag</h4>
          <p>Type your measured sag into the LOAD CASE group (front along the fork axis — zip-tie method; rear vertically at the axle) and the whole RESULTS block becomes <strong>live at that suspension position</strong>: rake, trail, swingarm angle, anti-squat, motion ratio and wheelbase all respond — one RESULTS block, exactly like the real MotoSPEC. The default 0 means "no load applied" (a physically true state, not a placeholder); at zero sag every result equals its static value exactly. With spring data (rate/preload/topout) and wheel weights entered, the Predicted Sag rows give the coil-spring-model sag — the gap to your measured value is a diagnostic for air-spring/friction/rate deviations.</p>
          <p>Reference-state contract: the chassis profile's rake / swingarm angle / wheelbase describe the bike at whatever attitude you measured them; sag is <strong>additional compression relative to that same attitude</strong>. Fork position and shock length deltas against their baseline values (the chassis profile's Baseline Setup group), plus the typed fork-length difference (FRONT SETTINGS → "Fork Length Δ") and the tire radius deltas ("Tire Radius Δ vs Baseline", 0 = same tire), feed the same attitude chain — tubes up / a shorter fork drops the front, a longer shock or a taller rear tire lifts the rear, and rake tracks all of it live; the front tire delta also enters the trail formula's effective radius (Rf + Δ).</p>
          <h4>"Need: …" hints</h4>
          <p>A RESULTS cell only renders a number when every leaf input it depends on is genuinely bound (chassis profile / selected component / typed override). Otherwise it stays blank with a hint naming the missing provider — e.g. "Need: Fork specs" if you've picked a chassis but no fork. Sag inputs are real by default (0 = unloaded) and never appear in a missing hint.</p>
          <h4>Status badges</h4>
          <ul>
            <li><span class="dt-status dt-status-pending">PENDING</span>input is not yet consumed by any RESULTS formula — typing here doesn't change anything below</li>
          </ul>
        `,
      },
      'catalogs': {
        h: 'Component Library',
        body: `
          <p>Four catalogs: chassis, forks, shocks, linkages. Effective entries = baseline JSON ⊕ user overlay (localStorage).</p>
          <ul>
            <li>The user overlay can: add new entries, override or extend baseline ones (deep-merge on <code>specs</code>), or tombstone a baseline entry (<code>{ __deleted: true }</code>)</li>
            <li>"Export JSON" exports just the overlay; "Import JSON" replaces the entire overlay</li>
            <li>"Reset" wipes the overlay and falls back to the shipped baselines</li>
          </ul>
          <p>Note: <code>data/chassis.json</code> ships empty — chassis entries are populated entirely by "Save chassis profile" on the Chassis Setup page. Linkage presets work the same way (saved from Linkage Setup).</p>
        `,
      },
      'concepts': {
        h: 'Concepts &amp; Conventions',
        body: `
          <ul>
            <li><strong>Static-only at the moment</strong> — the dynamic readings (compressed-state geometry, dynamic tire forces) are being rebuilt; the DYNAMIC READINGS / DYNAMIC LOAD groups are temporarily removed from the table</li>
            <li><strong>Units</strong>: lengths in mm, angles in degrees, forces in N, rates in N/mm, mass in kg</li>
            <li><strong>4-bar reference frame</strong>: origin at the swingarm pivot, +X forward, +Y up</li>
            <li><strong>Linkage placeholders</strong>: default coordinates exist so first-visit pages render — they're not realistic. Always enter measured values before trusting numbers.</li>
          </ul>
          <h4>What "_static" fields actually mean</h4>
          <p>Many fields carry a <code>_static</code> suffix (<code>Rake_Static</code>, <code>beta_static</code>, <code>Trail_Static</code>, …). <strong>Because there is no dynamic spring-compression simulation yet, the model assumes no specific reference state</strong> — the real contract is "enter the geometry of whichever configuration you want to analyze."</p>
          <ul>
            <li>Want the <strong>fully-extended</strong> geometry? Measure with the suspension topped out and enter those values.</li>
            <li>Want <strong>rider sag</strong>? Sit on the bike, measure at sag, enter those.</li>
            <li>Want the <strong>brake-dive limit</strong>? Enter the dove-in geometry.</li>
          </ul>
          <p>The 4-bar Δβ from shock travel is computed independently and added to <code>beta_static</code> — so whatever state you fed into <code>beta_static</code>, the stacked result is still in that frame. The whole tool is essentially a "static snapshot" calculator; the <code>_static</code> naming is historical and does <em>not</em> imply sag or unloaded.</p>
        `,
      },
      'faq': {
        h: 'Known Limits / FAQ',
        body: `
          <ul>
            <li><strong>RESULTS shows "Need: …"?</strong> The formula exists but inputs are unbound. The hint names the missing provider (Chassis profile / Fork specs / Linkage coords …) — pick an entry in that dropdown.</li>
            <li><strong>Typed an input but RESULTS didn't move?</strong> Check whether the input row carries a <span class="dt-status dt-status-pending">PENDING</span> badge — that means no formula consumes it yet.</li>
            <li><strong>Does language toggle lose values?</strong> No. <code>state.values</code> is language-independent.</li>
            <li><strong>What does "Export JSON" cover?</strong> Just the catalog user overlay — not <code>state.values</code> and not the data-table bike columns.</li>
            <li><strong>Where are the regression tests?</strong> <code>tests/fixtures/reference-bikes.json</code> pins published spec-sheet numbers for R6 / CBR1000RR / Panigale V4 to catch formula regressions.</li>
          </ul>
        `,
      },
    },
  },
};

export function renderUserGuide({ lang = 'zh', anchor = null } = {}) {
  const s = STR[lang] || STR.zh;
  const tocItems = GUIDE_ANCHORS.map(a =>
    `<li><a href="#guide-${a}">${escapeHtml(s.toc_items[a])}</a></li>`
  ).join('');
  const sections = GUIDE_ANCHORS.map(a => {
    const sec = s.sections[a];
    const focused = anchor === a ? ' focused' : '';
    return `<section id="guide-${a}" class="guide-section${focused}">
      <h2>${sec.h}</h2>
      ${sec.body}
    </section>`;
  }).join('');
  return `
    <article class="guide-page">
      <header class="guide-header">
        <h1>${escapeHtml(s.title)}</h1>
        <p class="guide-intro">${escapeHtml(s.intro)}</p>
      </header>
      <nav class="guide-toc">
        <h3>${escapeHtml(s.toc)}</h3>
        <ol>${tocItems}</ol>
      </nav>
      ${sections}
    </article>
  `;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}
