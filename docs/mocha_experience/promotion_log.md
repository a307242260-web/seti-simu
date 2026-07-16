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

- date: 2026-07-16
- source: SETI-23, SETI-24
- promoted_to: none
- promotion_decision: candidate
- target_agent: 领航
- target_component: none
- target_file: docs/mocha_experience/coding.md
- remote_skill_id: none
- change: 记录共享 dirty worktree 下“工作树验证”和“仅含本次 staged 快照验证”必须区分的候选经验。
- applied_change: 仅新增经验与决策契约，不修改 git-workflow、issue-workflow 或 agent prompt。
- expected_effect: 后续重叠文件提交时更早发现 staged 内容依赖他人未提交修复，且不会为获得独立提交而误卷入他人改动。
- evaluation_window: 后续 3 次共享树重叠文件提交
- success_signal: 提交前能明确报告工作树与 staged 快照各自验证结果，且提交不包含他人改动。
- rollback_condition: 如果后续证明临时 HEAD 快照构造成本显著高于收益，或 git 原生 staged 检查已足以覆盖，则维持 candidate 并合并为更轻量规则。
- risk: 单次案例含一个既有 HEAD TDZ，直接升级可能把偶发基线问题泛化为所有提交的重型流程。
- evidence_before: SETI-23 的 staged diff、临时 HEAD 快照与提交 `9414cc4`；SETI-24 的入口/收口 dirty diff、独立 staged 快照全量 tracked 测试与提交 `ff667a3`。
- owner_or_agent_decision: 记录 candidate，不升级长期组件。
- applied_at: 2026-07-16
- verification: 核对 `git diff --cached --stat`、共享工作树状态、临时 HEAD 快照全量 Node 回归及两次 DOM 脚本顺序烟测结果。
- observed_outcome: 已连续两次实现“只提交本 issue 文件、保留其他 agent/user dirty 改动”，且 staged 快照能独立通过对应全量回归。
- keep_or_revise: 保持 candidate；完成第 3 次相似重叠提交后复审是否升级提交前检查模板。

- date: 2026-07-16
- source: SETI-23, SETI-24, SETI-25
- promoted_to: agent_prompt
- promotion_decision: promote
- target_agent: 领航及遵循仓库根 AGENTS.md 的 coding agent
- target_component: 共享 dirty worktree 提交前验证规则
- target_file: AGENTS.md
- remote_skill_id: none
- change: 将“重叠文件提交必须验证仅含本次 staged 内容的独立快照”从 coding candidate 升级为仓库级 agent prompt 规则。
- applied_change: 在 `AGENTS.md` 的 Agent 工作约定中新增 staged 独立快照验证要求，并明确不得把他人未提交修复当作本次验收证据。
- expected_effect: 后续共享树重叠提交能同时证明工作树集成状态和本次提交快照独立成立，减少误卷他人改动与不可复现提交。
- evaluation_window: 后续 5 次共享 dirty worktree 重叠提交
- success_signal: 提交仅包含当前 issue 改动，且 staged 快照验证结果可复现；不再出现依赖他人未提交文件才通过的提交。
- rollback_condition: 若连续 5 次显示临时 staged 快照构造成本明显高于收益，或仓库切换为隔离 worktree 使规则不再适用，则删除或降级该条 prompt。
- risk: staged 快照构造会增加提交前耗时；若机械使用于完全不重叠的改动会造成不必要成本。
- evidence_before: SETI-23 `9414cc4`、SETI-24 `ff667a3`，以及 SETI-25 的 `app.js` 独立 staged blob、`git diff --cached` 和临时 checkout-index 全量 tracked 回归。
- owner_or_agent_decision: 领航依据既有 candidate 的“三次相似提交”评估窗口自决 promote。
- applied_at: 2026-07-16
- verification: `git diff --cached --check`；临时 checkout-index 快照执行 `node --check randomizer/app.js` 与全部 tracked `randomizer/**/*.test.js`。
- observed_outcome: SETI-25 工作树保留既有 AI/headless 改动，本 issue staged 快照独立通过语法和全量 tracked 回归。
- keep_or_revise: 保留并观察后续 5 次；若只在重叠文件场景触发且持续避免误提交，则维持。
