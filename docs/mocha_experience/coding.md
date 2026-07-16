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
