# Harness Promotion Log

candidate、promote、reject 使用以下契约记录。一次性业务结论不进入本文件。

## Decision Contract Template

- date:
- source:
- promoted_to:
- promotion_decision:
- target_agent:
- target_component:
- target_file:
- remote_skill_id:
- change:
- applied_change:
- expected_effect:
- evaluation_window:
- success_signal:
- rollback_condition:
- risk:
- evidence_before:
- owner_or_agent_decision:
- applied_at:
- verification:
- observed_outcome:
- keep_or_revise:

## Entries

- date: 2026-07-16
- source: SETI-7
- promoted_to: issue_workflow
- promotion_decision: candidate
- target_agent: 领航
- target_component: issue 收口状态流转
- target_file: docs/mocha_experience/coding.md
- remote_skill_id: none
- change: 记录“已完成且无 owner 决策的 coding issue 不应把自己作为 reviewer 挂进 in_review”这一条流程候选经验。
- applied_change: 仅新增经验记录，不修改 `issue-workflow` 脚本或规则。
- expected_effect: 后续遇到同类 coding issue 时，优先直接收口为 `done`，减少伪 review 状态和成员追问。
- evaluation_window: 后续同项目 3 次相似 coding issue 收口
- success_signal: 不再出现 reviewer 指向自己、但 issue 仍停在 `in_review` 的收口结果。
- rollback_condition: 如果后续发现该模式在真实双人 review 流程中会误伤正常状态流转，则维持 candidate 不升级。
- risk: 单个案例证据仍偏少，直接升级成 workflow 规则可能过拟合。
- evidence_before: `checkpoint/mocha_issue_timeline/SETI-7.jsonl` 的 `review_pass` 记录；成员评论“这个issue为什么没有自动置为done？”、“置为in-review，你是想谁来review说什么？”
- owner_or_agent_decision: 先记 candidate，不立即改规则。
- applied_at: 2026-07-16
- verification: 人工核对 timeline、metadata 与评论线程一致。
- observed_outcome: 已明确识别这次收口偏差来自 self-review 误用 `in_review`。
- keep_or_revise: 等重复证据；若再出现同类偏差，再升级 issue-workflow。
