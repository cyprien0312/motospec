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
//   datatable · catalogs · concepts · limits · faq

export const GUIDE_ANCHORS = [
  'getting-started', 'dashboard', 'chassis', 'linkage',
  'datatable', 'catalogs', 'concepts', 'limits', 'faq',
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
      'limits':          '本工具不计算什么',
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
          <p><strong>测量口径</strong>（页面最后一组）：一个设定数值，只有在<strong>量法相同</strong>时才和另一个数值可比。这里记录前叉伸出量、摇臂长度、后车高参考各自是怎么量的——只记录量法，不参与任何计算。默认是「未记录」：给别人的数字扣上一个他们从没声明过的口径，和编造数值是同一类错误。目前每个量只实现了一种算法；选了别的仍会如实记录并标「未建模」，提醒读的人几何链假设的是哪一种。共享库里的配置尤其需要这个——读的人不是量的人。</p>
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
          <p>多车横向对比工具。列数可变（0–5），通过表头的「+ 新增车型」/「×」按钮增删。表格在自己的视口内滚动：车名表头和参数列始终可见；<strong>点击任意分组标题可折叠/展开该组</strong>（折叠状态会记住），把长表收成一屏。</p>
          <h4>行类型</h4>
          <ul>
            <li><strong>下拉行</strong>（Chassis、Fork、Shock、Linkage）：从对应 catalog 选择条目，对应 specs 自动并入该列的 values</li>
            <li><strong>输入行</strong>：直接键入数值；空白时显示工具提示告诉你「该字段通常来自 X 配置 / 也可手填」</li>
            <li><strong>设定覆盖行</strong>（Yoke Offset / Fork Position / Swingarm Length）：选定 chassis 配置后变为可编辑，键入即在该列覆盖配置值（琥珀色边框提示分歧，清空恢复配置值）；未选配置时不可编辑——差量链需要配置里的基线</li>
            <li><strong>测量口径行</strong>（前叉伸出量口径 / 摇臂长度口径 / 后车高参考口径）：只读，回显所选 chassis 配置记录的量法。显示「—」= 该配置没记录口径，那这个数与别的列<strong>可能不可比</strong>；标「（未建模）」= 口径已记录，但几何链仍按已实现的那一种计算</li>
            <li><strong>RESULTS 行</strong>：只读，根据公式从 values 计算</li>
          </ul>
          <h4>差异高亮（HIGHLITE）与列间复制</h4>
          <p>表格上方的 <strong>差异高亮</strong> 下拉选一列作参考，其余列中<strong>与它不同的设置</strong>会被染黄——只标设置，不标 RESULTS（结果是后果，设置才是你改的东西）。每个车名下方的「⧉ 从…复制」可把另一列的<strong>前部 / 后部 / 全部设置</strong>搬过来；「全部」连 chassis 配置、载荷状态和链轮一起带走。复制会<strong>清掉源列没设过的项</strong>——否则残留的旧值会伪装成刚复制过来的。</p>
          <h4>载荷状态（LOAD CASE）/ Sag</h4>
          <p>在 LOAD CASE 组输入实测的前后 sag（前沿前叉轴线量——扎带法；后在后轮轴处垂直量），整个 RESULTS 块就变成<strong>该悬挂位置下的实时值</strong>：Rake / Trail / 摇臂角 / 抗蹲 / 运动比 / 轴距全部随之变化——和真实 MotoSPEC 的单一 RESULTS 块一致。默认 0 = 未加载参考态（一个真实的物理状态，不是占位符）；sag 全为 0 时每个结果都精确等于静态值。填好弹簧数据（刚度/预载/回顶）和称重数据后，「预测下沉量」行会给出纯弹簧模型的理论 sag——与实测值的差就是气簧/摩擦/刚度偏差的诊断信号。</p>
          <p>参考态约定：Chassis 配置里的 Rake / 摇臂角 / 轴距描述的是你测量它们时的姿态，sag 是<strong>相对那个姿态的额外压缩</strong>。Fork Position、Shock Length 相对各自基线值（Chassis 配置的基线设定组）的差量，以及直接输入的前叉长度差（FRONT SETTINGS →「前叉长度差」，两叉并排实测）和前后胎半径差（「胎半径差 vs 基线胎」，0 = 同款胎）也进入同一条姿态链——管上提 / 换短叉 = 车头下降，换长避震 / 换高后胎 = 车尾抬高，都会实时反映到 Rake 上；前胎半径差还同时进入 Trail 公式的有效半径（Rf + Δ）。</p>
          <p><strong>行程占用率</strong>（LOAD CASE 里的两行）把 sag 换算成占总行程的百分比：前 = 前 sag ÷ 前叉行程；后 = 避震压缩量（由 4-bar 解出，不是 轮行程 ÷ 运动比）÷ 避震行程。两者都是<strong>部件级</strong>口径，所以前后可以直接比——而前后 sag 的毫米数不能（一个沿叉轴、一个在轮端垂直）。也因此，两支行程不同的叉可以在同一压缩率下比较。</p>
          <h4>RESULTS 里的三个整车指标</h4>
          <ul>
            <li><strong>弹簧中心</strong>：后轮刚度 ÷（前 + 后）。0.50 = 前后等硬；> 0.50 = 后端更硬。因为回顶簧、连杆渐进性的存在它并非常数，给出的是当前压缩组合下的瞬时值</li>
            <li><strong>抬头 / 制动加速度极限</strong>：把一端完全卸载所需的纵向加速度（g）。只依赖重心与轴距——所以<strong>没实测过重心，这两个数就只有比较价值、没有绝对价值</strong>。按测量重心时的姿态计算（重心随悬挂压缩的移动未建模），假定该极限低于轮胎摩擦极限，气动阻力会进一步压低抬头极限</li>
          </ul>
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
          <p>4 个分类：chassis、forks、shocks、linkages。这是一个<strong>共享库</strong>——所有人看到同一份数据，你新增或修改的条目所有人都能看到。有效条目 = 共享库（Supabase）⊕ 本浏览器的本地未同步编辑。</p>
          <ul>
            <li>新增 / 修改条目会写入共享库；删除是<strong>软删除</strong>（标记 deleted，可从历史恢复），不会硬删数据</li>
            <li>「本地 → 共享」把本浏览器的旧本地条目发布到共享库；「导入 JSON」把文件里的条目发布到共享库</li>
            <li>「导出 JSON」备份当前完整库；「清除本地编辑」只清本浏览器未同步的改动，不影响共享库</li>
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
      'limits': {
        h: '本工具不计算什么',
        body: `
          <p>把模型边界写在脸上，比让人自己撞上去强。以下这些<strong>确实会影响真车</strong>，但本工具<strong>不计算</strong>——看到的数字里没有它们的贡献。</p>
          <h4>轮荷 / 刚度里不含</h4>
          <ul>
            <li><strong>过弯离心载荷</strong>与<strong>倾角</strong>：几何全部按车辆直立计算。<code>Lean_Angle</code> 这个输入目前存在但<strong>没有任何公式消费它</strong>（轮胎断面 + 径向刚度模型未实现）。</li>
            <li><strong>路面坡度</strong>：一律按水平地面。</li>
            <li><strong>阻尼力</strong>：全部结果都是准静态的。压缩/回弹点击数不进任何计算。</li>
            <li><strong>前叉 / 避震 / 连杆的摩擦（stiction）</strong>：这正是「预测下沉量」与实测差异的主要来源之一。</li>
            <li><strong>前叉气簧</strong>（油位 / 气隙）：<code>Front_Oil_Level</code> 带 PENDING 徽章就是这个意思。行程越深它占比越大——在接近打底处，实际轮端刚度会明显高于这里给出的纯螺旋弹簧值。</li>
            <li><strong>避震气室</strong>作用在杆截面上的伸展力，以及杆体积排入气室导致的压力上升。</li>
            <li><strong>Bump rubber（缓冲胶）</strong>：完全未建模。行程末端的实际刚度比这里高。</li>
            <li><strong>链条拉力对悬挂的作用</strong>：抗蹲角算了，但链条力不进轮荷。</li>
          </ul>
          <h4>气动</h4>
          <p>轮荷里<strong>含</strong>一个粗略的气动下压力项（<code>F_Aero</code> + 前/后分配比例）——这一点比真实 MotoSPEC 多，它干脆不做。但那是个简化模型：只有一个 Cd·A 与固定的前后分配，没有升力/俯仰随姿态的变化，也没有翼片随倾角失效。<strong>别把它当风洞数据用。</strong></p>
          <h4>几何</h4>
          <ul>
            <li><strong>轮胎断面与受载变形</strong>：轮胎按一个固定半径处理，换胎走 <code>Tire_R*_Delta</code> 差量。断面椭圆、径向刚度、胎压补偿都没有。</li>
            <li><strong>重心随悬挂压缩的移动</strong>：重心存的是对地坐标，不是车架坐标，所以它固定在你测量时的姿态。抗蹲和抬头/制动极限都因此只在<strong>接近测量姿态</strong>时最准。</li>
            <li><strong>偏心后轴 / 偏心枢轴</strong>（Ducati、部分 MV / BMW）：未实现。</li>
            <li><strong>头管插件（rake 可调件）</strong>：未实现，<code>Rake_Static</code> 就是最终值。</li>
            <li><strong>13 种连杆构型里我们只覆盖 5 种</strong>：Frame-mounted 与 Horizontal Backlink（= linked）、Swingarm-mounted 与 Unit Pro-Link（= pro-link）、Direct / Linkless（= linkless）。Full Floater 家族、Panigale、XR69、Scissor、Unit Pro-Link Frame-mounted 都不能算。</li>
          </ul>
          <h4>还有一件事</h4>
          <p>算不出来的东西，这里<strong>留空</strong>（「—」或「Need: …」），不给一个看起来合理的数。看到空格不是 bug，是工具在说"我不知道"。</p>
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
      'limits':          'What This Tool Does Not Compute',
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
          <p><strong>Measurement conventions</strong> (last group on the page): a setup number is only comparable to another setup number if both were <strong>taken the same way</strong>. This group records how fork position, swingarm length and the rear ride-height reference were measured — convention only; no formula reads it. The default is "not recorded", deliberately: stamping a convention on someone's number that they never stated is the same class of error as inventing the number. Only one algorithm per quantity is implemented today; picking a different convention still records the fact and flags it "not modelled" so the reader knows what the geometry chain assumes. Profiles in the shared library need this most — the person reading it is not the person who measured it.</p>
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
          <p>Side-by-side bike comparison. Columns are variable (0–5), added/removed via the "+ Add Bike" / "×" buttons. The table scrolls inside its own viewport — bike names and the parameter column stay visible — and <strong>clicking any group header collapses/expands that group</strong> (remembered across sessions), folding the long table down to one screen.</p>
          <h4>Row types</h4>
          <ul>
            <li><strong>Dropdown rows</strong> (Chassis, Fork, Shock, Linkage): pick a catalog entry; its specs merge into that column's values automatically</li>
            <li><strong>Input rows</strong>: type a number directly; empty cells show a tooltip pointing to the usual provider</li>
            <li><strong>Setup override rows</strong> (Yoke Offset / Fork Position / Swingarm Length): editable once a chassis profile is selected — typing overrides the profile for that column only (amber border = diverging; clear to restore). Not editable without a profile: the delta chain needs the profile's baseline</li>
            <li><strong>Measurement-convention rows</strong> (Fork Position / Swingarm Length / Rear Ride Height Reference): read-only echoes of how the selected chassis profile says its numbers were taken. A dash means the profile records no convention — that number <strong>may not be comparable</strong> to another column. "(not modelled)" means the convention is recorded but the geometry chain still computes as if measured the implemented way</li>
            <li><strong>RESULTS rows</strong>: read-only, computed from values</li>
          </ul>
          <h4>HIGHLITE and copying between columns</h4>
          <p>The <strong>HIGHLITE</strong> selector above the table picks a reference column; <strong>settings that differ from it</strong> are highlighted in the other columns — settings only, never RESULTS (the results are the consequence, the settings are what you changed). Under each bike name, "⧉ copy from…" pulls <strong>Front / Rear / All settings</strong> from another column; "All" also brings the chassis profile, load case and sprockets. Copying <strong>clears anything the source never set</strong> — otherwise stale values would masquerade as the ones you just copied in.</p>
          <h4>Load case / Sag</h4>
          <p>Type your measured sag into the LOAD CASE group (front along the fork axis — zip-tie method; rear vertically at the axle) and the whole RESULTS block becomes <strong>live at that suspension position</strong>: rake, trail, swingarm angle, anti-squat, motion ratio and wheelbase all respond — one RESULTS block, exactly like the real MotoSPEC. The default 0 means "no load applied" (a physically true state, not a placeholder); at zero sag every result equals its static value exactly. With spring data (rate/preload/topout) and wheel weights entered, the Predicted Sag rows give the coil-spring-model sag — the gap to your measured value is a diagnostic for air-spring/friction/rate deviations.</p>
          <p>Reference-state contract: the chassis profile's rake / swingarm angle / wheelbase describe the bike at whatever attitude you measured them; sag is <strong>additional compression relative to that same attitude</strong>. Fork position and shock length deltas against their baseline values (the chassis profile's Baseline Setup group), plus the typed fork-length difference (FRONT SETTINGS → "Fork Length Δ") and the tire radius deltas ("Tire Radius Δ vs Baseline", 0 = same tire), feed the same attitude chain — tubes up / a shorter fork drops the front, a longer shock or a taller rear tire lifts the rear, and rake tracks all of it live; the front tire delta also enters the trail formula's effective radius (Rf + Δ).</p>
          <p><strong>Stroke Used %</strong> (two LOAD CASE rows) expresses sag as a share of full travel: front = front sag ÷ fork stroke; rear = shock compression (solved through the 4-bar, not wheel travel ÷ motion ratio) ÷ shock stroke. Both are <strong>component-level</strong>, so front and rear ARE directly comparable — the raw sag millimetres are not (one is along the fork axis, the other vertical at the wheel). It also lets two forks with different strokes be compared at the same compression percentage.</p>
          <h4>Three whole-bike numbers in RESULTS</h4>
          <ul>
            <li><strong>Spring Center</strong>: rear rate ÷ (front + rear). 0.50 = both ends equally stiff; > 0.50 = rear stiffer. Topout springs and linkage progression keep it from being constant — this is the instantaneous value at the current compression</li>
            <li><strong>Wheelie / Braking Accel Limit</strong>: the longitudinal acceleration (g) that fully unloads one end. They depend only on the CG and the wheelbase — so <strong>without a measured CG these have comparative value only, not absolute value</strong>. Computed at the attitude where the CG was measured (CG movement with suspension compression is not modelled), assuming the limit is below the tire friction limit; aero drag lowers the wheelie limit further</li>
          </ul>
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
          <p>Four catalogs: chassis, forks, shocks, linkages. This is a <strong>shared library</strong> — everyone sees the same data, and anything you add or edit is visible to everyone. Effective entries = the shared library (Supabase) ⊕ this browser's local unsynced edits.</p>
          <ul>
            <li>Adding or editing an entry writes to the shared library; removing is a <strong>soft-delete</strong> (flags <code>deleted</code>, reversible from history) — nothing is hard-deleted</li>
            <li>"Publish local → shared" pushes this browser's old local entries up; "Import JSON" publishes a file's entries to the shared library</li>
            <li>"Export JSON" backs up the full current library; "Clear local edits" only drops this browser's unsynced changes and leaves the shared library untouched</li>
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
      'limits': {
        h: 'What This Tool Does Not Compute',
        body: `
          <p>Model boundaries stated up front beat model boundaries discovered the hard way. All of the following <strong>do</strong> affect a real bike and are <strong>not</strong> in any number this tool shows.</p>
          <h4>Not in the wheel forces or rates</h4>
          <ul>
            <li><strong>Cornering loads and lean angle</strong>: all geometry is computed upright. The <code>Lean_Angle</code> input exists but <strong>no formula consumes it</strong> (the tire profile + radial stiffness model is not implemented).</li>
            <li><strong>Road gradient</strong>: everything assumes level ground.</li>
            <li><strong>Damping</strong>: every result is quasi-static. Compression/rebound clicks feed nothing.</li>
            <li><strong>Fork / shock / linkage friction (stiction)</strong>: one of the main reasons predicted sag and measured sag differ.</li>
            <li><strong>Fork air spring</strong> (oil level / air gap) — that is what the PENDING badge on <code>Front_Oil_Level</code> means. Its share grows deep in the stroke, so near bottoming the real wheel rate is well above the coil-only figure here.</li>
            <li><strong>Shock reservoir</strong> extension force on the shaft area, and the pressure rise as shaft volume displaces into the reservoir.</li>
            <li><strong>Bump rubbers</strong>: not modelled at all. End-of-stroke stiffness is higher than shown.</li>
            <li><strong>Chain force on the suspension</strong>: the anti-squat angle is computed, but chain tension does not enter the wheel loads.</li>
          </ul>
          <h4>Aerodynamics</h4>
          <p>The wheel loads <strong>do</strong> include a coarse aero downforce term (<code>F_Aero</code> plus a front/rear share) — more than the real MotoSPEC, which omits it entirely. But it is a simplification: one Cd·A, a fixed front/rear split, no attitude-dependent lift or pitch, no wings losing effect with lean. <strong>Do not read it as wind-tunnel data.</strong></p>
          <h4>Geometry</h4>
          <ul>
            <li><strong>Tire profile and load deflection</strong>: a tire is one fixed radius here; swaps go through <code>Tire_R*_Delta</code>. No elliptical profile, no radial stiffness, no pressure compensation.</li>
            <li><strong>CG movement with suspension compression</strong>: the CG is stored in ground coordinates, not frame coordinates, so it stays where you measured it. Anti-squat and the acceleration limits are therefore most accurate <strong>near the attitude you measured</strong>.</li>
            <li><strong>Eccentric rear axle / eccentric pivot</strong> (Ducati, some MV and BMW): not implemented.</li>
            <li><strong>Headstock inserts (rake adjusters)</strong>: not implemented — <code>Rake_Static</code> is the final value.</li>
            <li><strong>Five of the thirteen linkage types</strong> are covered: frame-mounted and horizontal backlink (= linked), swingarm-mounted and Unit Pro-Link (= pro-link), Direct / Linkless (= linkless). The Full Floater family, Panigale, XR69, Scissor and Unit Pro-Link frame-mounted cannot be computed.</li>
          </ul>
          <h4>And one more thing</h4>
          <p>Anything that cannot be computed is left <strong>blank</strong> ("—" or "Need: …") rather than filled with a plausible-looking number. An empty cell is not a bug; it is the tool saying it does not know.</p>
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
