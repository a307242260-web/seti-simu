# Effect Session 阶段 6：浏览器宿主接入

`randomizer/app/effect-session-host.js` 是阶段 2–5 已迁移 Effect Session 代表链的统一浏览器宿主端口。它不拥有游戏规则、pending 或领域 continuation，只做四件事：

1. 将稳定 `actionId` / `decisionId + decisionVersion + choiceId` 输入映射到 Standard Action/Decision。
2. 调用领域 flow 的 `dispatch / resolveDecision / advance / drain / abort`。
3. 活跃流程只把 `observe()` 的 working-state projection 交给 renderer。
4. 仅在 session `completed` 后通过 StateStore `compareAndCommit` 原子替换正式状态，并发布稳定 result。

浏览器动画可以逐次调用 `advance()`；无动画宿主调用 `drain()`。两条路径必须在相同 Action/Decision 序列下得到相同 committed state 和 journal。renderer 或稳定结果通知抛错属于宿主服务失败，不得反向改变 session；Effect 执行失败在屏障前恢复 base state，浏览器 store 不提交。

DOM 事件 adapter 只读取 `data-seti-input` 与稳定 identity：

- `action`：`data-action-id`
- `decision`：`data-decision-id`、`data-decision-version`、`data-choice-id`
- `view`：`data-view-intent`

adapter 不接收 `pendingState`、overlay callback、refresh callback 或领域 continuation。未知 family、过期 identity、未注册 quick interrupt 都结构化 fail-closed。

本阶段覆盖研究科技、扫描、打牌、Quick Action 边界和失败恢复代表链。尚未迁移的公司、外星人、回合末及其旧 UI/AI pending 热路径仍明确留给后续阶段，不能因 host 已装入 `index.html` 就视为完成。
