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
