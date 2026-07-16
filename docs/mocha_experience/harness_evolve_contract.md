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

