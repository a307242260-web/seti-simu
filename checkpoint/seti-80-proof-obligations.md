# SETI-80 Proof Obligations：Policy 与玩家共享 Action/Decision Session

## 边界

本阶段只迁移输入 owner、Policy submission 与确定性 drain 的 composition；不改变
Heuristic/Learned Policy 的估值或选择策略。玩家仍通过 `BrowserInputAdapter` 提交，Policy
driver 只读取无 DOM 的 boundary/observation，并把 Policy 选中的原 Standard Action 或
Decision choice 提交回同一 adapter。规则推进、唯一项 drain、effect 顺序、commit、events
与 replay 继续由共享 Effect Session 拥有。

## 可证伪矩阵

| ID | 验收条款 | 可证伪命题 | 最小反例 | 唯一责任点 | 证据与失败语义 |
|---|---|---|---|---|---|
| P-01 | 玩家与 Policy 同协议 | 同一 session/checkpoint 上，玩家选择 actionId=A 与 PolicyDecision 选择 A，提交给同一 input port，最终 state/effect/events/log/replay 完全一致 | Policy 调用 AI executor 或 UI callback 后再补写状态 | `browser-host/policy-input-adapter.js` | 固定 Action/Decision trace parity；Policy 输出只映射为原 descriptor |
| P-02 | 无 DOM/renderer/picker resolver | Policy module import、boundary 枚举、一次 action 与一次 decision 在 poison `document/window/overlay/renderer/picker/resolver` 下调用数为 0 | 为取得 choice，driver 查询 overlay 按钮或调用旧 resolver | Policy adapter + Effect Session host | poison getter/runtime spy；触发即抛错 |
| P-03 | 未知 Decision fail-closed | boundary kind、decision identity、schema/family/owner/version 或 legal set 不受支持时不提交、不 drain、不改变状态 | 未知 kind 被当顶层 action 或默认选第一项 | `normalizeBoundary` / fresh-boundary validation | 逐项未知/篡改注入；返回 `POLICY_INPUT_*` 结构化错误 |
| P-04 | stale/越权无副作用 | Policy 响应后若当前 boundary identity/version/owner/legal set 已变化，提交次数为 0 | 旧异步结果提交到下一位玩家或下一 Decision | submission 前 fresh boundary revalidation | stale/owner/action membership 负向测试 |
| P-05 | drain 单一所有者 | driver 每次只产生一个外部 Action/Decision submission；确定性 effect 与唯一选择只由 session host drain | driver 循环调用 continuation/skip/recover | driver API 与 session journal | submission spy=1；environment events 不伪装为 Policy replay |
| P-06 | headless 不造伪 DOM | headless 完整局继续只使用 Standard Action/Decision host；Policy adapter 在 Node 中不创建浏览器 global | import 时写 `globalThis.document={}` | 静态依赖 + 完整局现有门禁 | no-browser-global poison、完整局/固定 seed 回归 |
| P-07 | 浏览器展示不改规则 | Chrome smoke 中 Policy 驱动 action→decision 后，renderer 只消费 projection；AI 展示不参与选择与执行 | renderer label 决定 choiceId | Browser Host smoke | 真 Chrome 固定 trace；渲染/overlay/picker spy=0 |

## 实现前反例

1. Policy 选择合法 action 后，Session 在异步返回前进入下一 decisionVersion；若 driver 不重新读取
   boundary，会把旧选择提交给新 owner。
2. Decision family 未注册但有两个带按钮文案的 choice；若 driver 按第一个按钮或旧 resolver
   fallback，状态会继续推进而不是 unsupported。
3. 玩家和 Policy 虽选择同一 actionId，但 Policy 直接调用旧 `runAi*Decision`，会导致 effect/event
   顺序或 replay cursor 与 BrowserInputAdapter 路径不同。

## 完成证据

- 定向：Policy input adapter contract、同 session 玩家/Policy trace parity、unknown/stale/poison。
- 集成：Browser Host Chrome AI 固定 trace。
- 回归：`node --check randomizer/app.js`、`node tools/run_node_tests.js`。
- 完整局：固定 seed headless episode；不得安装或创建伪 DOM。
