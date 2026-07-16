# Coding Experience

记录 coding loop 中可复用的实现、调试、测试和提交经验。

## Entry Template

- date:
- source_issue:
- observation:
- evidence:
- promote_to:
- promotion_status:
- decision:

## Entries

- date: 2026-07-17
- source_issue: SETI-26
- observation: 从大型闭包迁出 runtime 时，`node --check` 只能证明语法成立，不能证明显式 context 覆盖了普通函数体和嵌套回调里的全部自由变量；至少要执行 select/confirm/cancel/rollback 等代表性路径，才能发现缺失注入。
- evidence: SETI-26 首轮模块语法检查通过，但定向执行科技选择路径时暴露 `renderRunezuBoardSymbols` 未注入；随后按函数体补齐 `renderWheels`、`beginCardSelection`、跨 runtime 延迟回调等依赖，工作树与 staged 独立快照全量回归才通过。提交 `8963b38`。
- promote_to: none
- promotion_status: candidate
- decision: 作为 runtime 拆分验证候选经验保留；当前只有一次迁移证据，不修改 agent prompt 或 loop template，等待后续同类拆分复现后再评估升级。

- date: 2026-07-16
- source_issue: SETI-7
- observation: 对已经实现完成、验证完成且没有待 owner 拍板事项的 coding issue，如果 `reviewer` 仍指向自己，就不应走 `review_pass -> in_review`；这会制造伪 review 状态，增加额外追问成本。
- evidence: `checkpoint/mocha_issue_timeline/SETI-7.jsonl` 中 `review_pass` 把 issue 从 `in_progress` 置为 `in_review`，同时 `reviewer` 仍为 `13e5c469-264f-4a3c-837d-2cbc26bbba19`；随后成员在评论中追问“这个issue为什么没有自动置为done？”与“置为in-review，你是想谁来review说什么？”
- promote_to: issue_workflow
- promotion_status: candidate
- decision: 先作为流程候选经验记录；后续若再次出现“self-review 导致伪 in_review”的收口偏差，再考虑把 `done` 前置检查或 `review_pass` 约束升级到 issue-workflow。

- date: 2026-07-16
- source_issue: SETI-23, SETI-24, SETI-25
- observation: 在共享 dirty worktree 中重构与他人改动重叠的文件时，验证工作树通过并不能证明本次 staged 快照独立成立；提交前应同时检查 staged diff，并在需要时从 HEAD 构造仅含本次改动的快照验证，避免卷入他人改动或把其修复误算为本次交付。
- evidence: SETI-23 提交 `9414cc4` 通过临时 HEAD 快照隔离 effect 重构并识别工作树与 staged 验证差异；SETI-24 提交 `ff667a3` 再次从 HEAD 构造独立 staged 快照；SETI-25 在 `app.js` 与其他 agent 改动重叠时，以 HEAD 构造仅含本 issue 的 staged blob，并在临时 checkout-index 快照运行全量 tracked 测试。
- promote_to: agent_prompt
- promotion_status: promote
- decision: 三次连续重叠提交均证明 staged 独立验证能避免卷入他人改动或误用工作树修复，已达到预设评估窗口；将规则写入仓库根 `AGENTS.md`。
