# Exploratory Research Experience

记录假设、反例检查、阶段结论和下一问题的可复用经验。

## Entry Template

- date:
- source_issue:
- observation:
- evidence:
- promote_to:
- promotion_status:
- decision:

## Entries

- date: 2026-07-21
- source_issue: SETI-105（owner 在聊天中直接提供 SETI Fan Hub 中文站点）
- observation: 项目需要把 `https://seti.ender-wiggin.com/zh-CN` 作为可复用的卡牌资料入口，覆盖普通卡牌、公司（组织）牌和起始卡；第三方站点适合检索和录入，但规则歧义与版本差异仍需交叉核对。
- evidence: owner 明确说明该站包含 SETI 卡牌、公司和起始卡内容；站点中文首页实际提供卡牌搜索，并含“起始卡”“组织”导航及来源、图标、收入、扇区、类型、文本和费用筛选。
- promote_to: project_memory
- promotion_status: promote
- decision: 新增 `docs/card-data-sources.md` 并接入根 `AGENTS.md` 资料导航，让后续卡牌录入与核对任务可直接发现该入口；保留第三方资料源免责声明，不将其视为规则争议的唯一权威。

- date: 2026-07-19
- source_issue: SETI-45
- observation: 面向 owner 讨论项目质量体系时，应先给出与项目规模匹配的最小默认口径，再说明少量例外；把所有风险维度展开成常驻多层门禁，会让简单的“主要靠单元测试”决策变得过度繁琐。
- evidence: SETI-45 质量门禁报告提出七层验证与 Browser/Headless parity 硬门禁后，owner 评论 `3656d52e-efb1-442c-971e-ff18d91c13c7` 明确要求“主要靠单元测试就行”，并否定当前方案过于繁琐。
- promote_to: none
- promotion_status: candidate
- decision: 后续质量体系讨论默认先写“单元测试为主”；只有改动直接涉及浏览器装配或训练链路时，才补对应的最小专项检查。当前仅一次明确反馈，不修改 agent prompt、loop template、watcher 或 issue-workflow，观察后续 2 次架构验收讨论。

- date: 2026-07-19
- source_issue: SETI-45
- observation: 面向 owner 的架构探索应一次只讨论一个业务边界，并继续交付可直接打开的 HTML；但载体应是朴素技术文档和清晰架构图，不能复用 huashu-design 的大标题、彩色卡片墙和长篇阶段总结。
- evidence: SETI-45 评论 `94c2d631-78a1-4ca6-9d05-3dda8ef2c657` 否定旧 HTML 样式；后续评论 `2f0c05ee-6307-4703-a501-f23ca67d3d4e` 明确修正为“仍需要 HTML，但不要 huashu-design 模板”；`reports/seti-ai-policy-architecture.html` 已按技术文档式布局重绘并完成桌面/窄屏检查。
- promote_to: none
- promotion_status: candidate
- decision: 保留“单边界 + HTML 直达”交付候选，但明确拒绝 huashu-design 模板；后续使用常规字号、中性配色、直线架构图和短结论，并继续观察 2 次同类讨论。

- date: 2026-07-19
- source_issue: SETI-42（复盘 SETI-40，并以 SETI-36 做反例检查）
- observation: 跨模块状态机/迁移的全称、否定和决策所有权条款若未在实现前转换为可证伪 proof obligations，静态 coverage label、happy path 和最终吞吐会制造伪完成；按状态 × action family × decision owner × fallback 禁区展开，能正向推出 legal→executable、conditional 独立 step/replay、禁旧 resolver 与未迁移 fail-closed。
- evidence: SETI-40 原始契约、评论与 `checkpoint/seti-39-precondition-audit.md`；`checkpoint/mocha_issue_timeline/SETI-40.jsonl`；SETI-36 的 `REQUIRED_CONTEXT_KEYS` fail-fast 在提交前发现两处漏接线；模板见 `docs/implementation-proof-obligations.md`。
- promote_to: loop_template
- promotion_status: promote
- decision: 新增项目级 proof obligation 模板并在根 `AGENTS.md` 增加触发入口；不新增 watcher 或通用代码 runner，后者等待第二个独立状态机复现后再评估。

- date: 2026-07-19
- source_issue: SETI-45
- observation: 架构探索提出的新名词若与已确认总控存在范围重叠，材料必须先回答“这是新系统还是现有系统内的子职责”，再用同一条具体执行链和“已覆盖 / 未覆盖 / 归属”矩阵说明差异；仅画一套独立目标架构会把补契约误读成另起 runtime。
- evidence: SETI-45 首版 Lifecycle 报告把其画成与 Effect Session 并列的共享状态机，owner 评论 `3d584b90-69aa-45cc-a048-2036d2bf9380` 明确反馈看不懂与既有流程衔接的区别及缺口；修订报告以 `end_turn` 单链路、职责对照和 8 项缺口矩阵纠正。
- promote_to: none
- promotion_status: candidate
- decision: 作为既有“单边界 + 技术文档式 HTML”候选的边界澄清补充；后续 2 次重叠架构讨论观察是否首次交付即可区分复用、补齐与新建，不修改 agent prompt、loop template、watcher 或 issue-workflow。
