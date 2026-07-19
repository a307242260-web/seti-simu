# SETI-75 Decision UI proof obligations

| 验收条款 | 可证伪命题 | 最小反例 | 唯一责任点 | 验证证据 | 失败语义 |
|---|---|---|---|---|---|
| UI 不枚举科技合法项 | renderer 输出的每个 tile/slot/cancel 都逐项来自同一 `DecisionProjection.choices` | UI 根据科技 catalog 补出一个 session 未给出的蓝槽 | `decision-ui.js` registry + tech renderer | 输入 choice 集合与渲染 choice 集合等价；poison catalog/legacy resolver 调用为 0 | 未知 renderer 使用 generic choice；缺失 choice 不可提交 |
| UI 不直接拿科技、发奖励或续跑 | focus 只写 ViewState；confirm/cancel 只发一个带原 decision identity 的标准 Decision intent | 点击蓝槽直接调用 place/reward/continuation | `createDecisionUiController()` | mutation/place/reward/continuation spies 恒为 0；固定 trace 只由 Effect Session 产生 | 无显式标准 choice 时 confirm/cancel fail-closed |
| 取消/跳过是标准 choice | shell 只有在 choices 中存在明确 cancel/skip presentation 时才显示并提交取消 | `optional=true` 或关闭 overlay 直接跳过 | generic shell controls | required/optional decision 的 cancel 对照测试 | `DECISION_UI_CANCEL_UNAVAILABLE` |
| quick interrupt 后旧 decision stale | quick 更新 decisionVersion 后，旧 DOM identity 提交不改变 working/committed state | interrupt 后点击旧蓝槽仍落子 | BrowserInputAdapter + Effect Session validator | 旧 version 负向测试及状态 parity | 原 stale code 透传，只刷新 projection、不重写/重试 |
| DOM/ViewState 可销毁重建 | 相同 projection 在空 ViewState 和全新 DOM 中重建出相同合法 choice 集；规则端口调用为 0 | overlay/focus flag 决定奖励是否继续 | pure render model + DOM renderer | rebuild metamorphic test，提交/continuation spies 为 0 | 无 projection 时隐藏；无 DOM ownerDocument 时 fail-fast |
| rotate -> tile -> blue slot -> reward | 科技 renderer 只在投影 choices 内聚合 tile/slot；focus tile 与 slot 是草稿，confirm 后 session 才 place/reward | renderer 自造 tile×slot 笛卡尔积或选首项 | tech presentation renderer + Effect Session | 固定 trace、每项 identity、真实 Chrome smoke | 不完整/歧义草稿禁用 confirm |

状态矩阵：`awaiting_input` 由 owner 看见 choices；非 owner choices 为空；quick 后旧 version stale；completed/aborted 无 decision shell。输入 owner：focus 为 ViewState，confirm/cancel 为 Effect Session，rotate/place/reward 为规则 runtime。禁区：`pendingState`、科技 catalog 合法性、`completeCurrentActionEffect`、奖励队列、DOM callback 续跑。
