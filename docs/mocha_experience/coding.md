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

- date: 2026-07-16
- source_issue: SETI-7
- observation: 对已经实现完成、验证完成且没有待 owner 拍板事项的 coding issue，如果 `reviewer` 仍指向自己，就不应走 `review_pass -> in_review`；这会制造伪 review 状态，增加额外追问成本。
- evidence: `checkpoint/mocha_issue_timeline/SETI-7.jsonl` 中 `review_pass` 把 issue 从 `in_progress` 置为 `in_review`，同时 `reviewer` 仍为 `13e5c469-264f-4a3c-837d-2cbc26bbba19`；随后成员在评论中追问“这个issue为什么没有自动置为done？”与“置为in-review，你是想谁来review说什么？”
- promote_to: issue_workflow
- promotion_status: candidate
- decision: 先作为流程候选经验记录；后续若再次出现“self-review 导致伪 in_review”的收口偏差，再考虑把 `done` 前置检查或 `review_pass` 约束升级到 issue-workflow。

- date: 2026-07-16
- source_issue: SETI-23, SETI-24
- observation: 在共享 dirty worktree 中重构与他人改动重叠的文件时，验证工作树通过并不能证明本次 staged 快照独立成立；提交前应同时检查 staged diff，并在需要时从 HEAD 构造仅含本次改动的快照验证，避免卷入他人改动或把其修复误算为本次交付。
- evidence: SETI-23 提交 `9414cc4` 通过临时 HEAD 快照隔离 effect 重构并识别工作树与 staged 验证差异；SETI-24 提交 `ff667a3` 再次从 HEAD 构造独立 staged 快照，完整保留共享树 7 个既有 dirty 文件，并让 14 个本 issue 文件的全量 tracked 测试独立通过。
- promote_to: none
- promotion_status: candidate
- decision: 已获得第二次同类成功证据，继续保留为 candidate；完成 3 次相似重叠提交的评估窗口后，再决定是否固化为提交前检查模板。
