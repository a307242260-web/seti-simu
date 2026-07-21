# Harness Evolve Contract

## 证据

经验必须能追溯到 issue 评论、timeline、metadata、checkpoint、报告、测试结果或代码 diff。主观印象不能直接升级为规则。

## 状态

- `candidate`：有依据，但证据不足或尚未重复出现。
- `promote`：证据足够，目标组件明确，可以应用。
- `reject`：有记录价值，但不应升级。

## 可升级目标

- `loop_template`
- `watcher_lint`
- `issue_workflow`
- `agent_prompt`
- `project_memory`

## 决策要求

任何 candidate、promote 或 reject 都必须在 `promotion_log.md` 记录来源、目标、改动、预期效果、验证窗口、成功信号、回滚条件和最终判断。watcher 只能提醒或标记问题，不能替 owner 或 agent 做业务决策。

`deferred_review` 不是 candidate/promote/reject 决策，只是关单时记录的待去重信号；它可以先落到 `checkpoint/mocha_harness_closeout_events/<date>.jsonl`，不要为它同步改经验文档。定期 review 将其与既有条目去重后，一旦正式决定 candidate/promote/reject，再按上述契约写入 `promotion_log.md`。

## 关单验收分层

- 优先复用子 issue 的 `decision`、`verification_result`、`evidence_checkpoint` 和对应 commit。
- 若子 issue 验收后相关生产文件未变，父 issue 不重跑同一全量测试或 Chrome 验收，只跑跨子项组合风险检查。
- 只在证据缺失/矛盾、相关生产文件在验收 commit 后变化、组合检查失败，或 owner 明确要求时升级为完整复验。
- 默认 fast closeout 只按 issue id、owner/member 信号和目标组件做 `rg` 命中检索；不整份读取 category 文件或 `promotion_log.md`。
