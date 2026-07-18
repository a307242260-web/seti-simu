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
- source_issue: SETI-42（复盘 SETI-40，并以 SETI-36 做反例检查）
- observation: 跨模块状态机/迁移的全称、否定和决策所有权条款若未在实现前转换为可证伪 proof obligations，静态 coverage label、happy path 和最终吞吐会制造伪完成；按状态 × action family × decision owner × fallback 禁区展开，能正向推出 legal→executable、conditional 独立 step/replay、禁旧 resolver 与未迁移 fail-closed。
- evidence: SETI-40 原始契约、评论与 `checkpoint/seti-39-precondition-audit.md`；`checkpoint/mocha_issue_timeline/SETI-40.jsonl`；SETI-36 的 `REQUIRED_CONTEXT_KEYS` fail-fast 在提交前发现两处漏接线；模板见 `docs/implementation-proof-obligations.md`。
- promote_to: loop_template
- promotion_status: promote
- decision: 新增项目级 proof obligation 模板并在根 `AGENTS.md` 增加触发入口；不新增 watcher 或通用代码 runner，后者等待第二个独立状态机复现后再评估。
