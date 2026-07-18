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
- observation: 面向 owner 的架构探索应一次只呈现一个业务边界，并优先使用清晰的架构图/流程图与可直接打开的 HTML 链接；技术分层、装饰性视觉或仅交付本地 Markdown 会让 owner 无法判断实际业务组成。
- evidence: SETI-45 评论 `e427888a-66c2-4452-8b23-d2d1cf1e96cc` 要求逐边界讨论和 HTML 直达链接；`1eacdd35-9691-4dd0-bbae-8b493b816903` 明确纠偏“只需要清晰的架构设计图 / 流程图”；`9b3f9052-e920-4014-98a4-b5a8c883aca4` 暴露会话内临时服务退出导致链接失效；本轮 `reports/seti-game-flow-architecture.html` 按单一流程边界交付并由用户会话托管服务返回 HTTP 200。
- promote_to: none
- promotion_status: candidate
- decision: 先作为 SETI 架构讨论的展示方式候选保留，不升级 agent prompt 或 loop template；再观察 2 次同类架构边界讨论是否仍稳定要求同一交付形态。

- date: 2026-07-19
- source_issue: SETI-42（复盘 SETI-40，并以 SETI-36 做反例检查）
- observation: 跨模块状态机/迁移的全称、否定和决策所有权条款若未在实现前转换为可证伪 proof obligations，静态 coverage label、happy path 和最终吞吐会制造伪完成；按状态 × action family × decision owner × fallback 禁区展开，能正向推出 legal→executable、conditional 独立 step/replay、禁旧 resolver 与未迁移 fail-closed。
- evidence: SETI-40 原始契约、评论与 `checkpoint/seti-39-precondition-audit.md`；`checkpoint/mocha_issue_timeline/SETI-40.jsonl`；SETI-36 的 `REQUIRED_CONTEXT_KEYS` fail-fast 在提交前发现两处漏接线；模板见 `docs/implementation-proof-obligations.md`。
- promote_to: loop_template
- promotion_status: promote
- decision: 新增项目级 proof obligation 模板并在根 `AGENTS.md` 增加触发入口；不新增 watcher 或通用代码 runner，后者等待第二个独立状态机复现后再评估。
