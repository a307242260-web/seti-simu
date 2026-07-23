# SETI Node 测试逐文件收敛结果

日期：2026-07-23

## 结论

默认回归现在只有 69 个 `unit` 与唯一 1 个 `fullFlow`。`tools/node-test-inventory.js` 是逐文件保留结果的权威清单：每一项都显式写出 `file`、`owner`、`obligation`、`counterexample`，不再按路径正则贴标签。运行 `node tools/run_node_tests.js --list` 可输出全部保留项及其反例。

无法证明为新架构正式 owner 的 32 个旧 app/tooling 测试已物理删除。仓库递归发现的 `.test.js` 必须与 inventory 的 70 项完全一致，任何未登记测试都会使 runner 失败。`events.test.js` 合并收窄，只保留 DOM dataset 到正式输入端口的行为，删除旧 pending getter 与可写 UI 状态聚合断言。

## 保留

逐文件保留项全部登记在 inventory v2，共 69 个 unit：

- architecture：StateStore 5、Standard Action 2、Effect Session 8、Rule Composition 1、Browser Host 11、Simulation Host 7、Policy Host 3。
- rules：actions 8、cards 3、data 2、tech 2、aliens 10、scoring 4。
- policy：Heuristic Policy、Heuristic Evaluator、Selection Evaluator 各 1。
- fullFlow：`randomizer/full-flow/standard-flow.test.js`，恰好 1 个。

其中新增的关键保留项：

- `randomizer/game/ai/heuristic-policy.test.js`
- `randomizer/game/ai/heuristic-evaluator.test.js`
- `randomizer/app/simulation-counterfactual-outcome.test.js`
- `randomizer/app/simulation-host-contract.test.js`
- `randomizer/training/simulation-standard-action-composition.test.js`

## 合并

| 文件 | 结果 | 保留义务 | 删除内容 |
|---|---|---|---|
| `randomizer/app/events.test.js` | 合并收窄后保留 | disabled/未知 DOM dataset 不提交；主行动只分发 Standard intent | `createAppEventState` 对旧 pending getter、可写 UI 状态的聚合断言 |

## 已删除

下列 32 个文件已从仓库物理删除。表中同时列明原有反例由哪个正式 owner unit 接管；标为“不接管”的内容本身不属于新架构契约，不再保留测试：

| 文件 | 结果 | 反例接管 |
|---|---|---|
| `randomizer/app/action-interaction-runtime.test.js` | 已删除 | 旧 picker 调用顺序不接管；disabled/未知输入不提交由 `browser-host/action-bar.test.js`、`decision-ui.test.js` 接管 |
| `randomizer/app/action-log-export.test.js` | 已删除 | 不接管 Markdown 格式；它不是架构协议 |
| `randomizer/app/action-log-runtime.test.js` | 已删除 | 日志 commit/undo/barrier 反例由 `game/history/action-history.test.js`、`commands.test.js` 接管；DOM draft 不接管 |
| `randomizer/app/action-runtime.test.js` | 已删除 | stale/unknown/越权及生产 handler 路由由 `standard-action.test.js`、`simulation-standard-action-composition.test.js` 接管 |
| `randomizer/app/alien-runtime.test.js` | 已删除 | 外星 Decision owner、stale 与 mutation 顺序由 `industry-alien-session.test.js` 和 `game/aliens/*.test.js` 接管 |
| `randomizer/app/alien-trace-reward-flow.test.js` | 已删除 | 痕迹合法性、奖励和 followup 由 `trace-placement-legality.test.js`、`industry-alien-session.test.js` 接管 |
| `randomizer/app/alien-ui.test.js` | 已删除 | owner 隐私、未知 choice 与 presentation 映射由 `industry-alien-decision-ui.test.js` 接管 |
| `randomizer/app/aliens/species-runtime.test.js` | 已删除 | 物种规则反例由 `game/aliens/*.test.js`，跨物种 session 顺序由 `industry-alien-session.test.js` 接管 |
| `randomizer/app/bootstrap.test.js` | 已删除 | 页面启动、端口装配和 authority 泄漏由 `browser-host.browser-smoke.html` 接管 |
| `randomizer/app/card-runtime.test.js` | 已删除 | 卡牌实体、支付/奖励 Decision 与隐藏牌反例由 `cards/*.test.js`、`scan-card-session.test.js`、`card-decision-ui.test.js` 接管 |
| `randomizer/app/card-trigger-runtime.test.js` | 已删除 | 任务重复领奖、触发顺序与 stale choice 由 `task-state.test.js`、`scan-card-session.test.js` 接管 |
| `randomizer/app/conditional-action-executor.test.js` | 已删除 | 条件 action owner/version/stale 与 handler 路由由 `conditional-decision-domain.test.js`、`standard-action-session.test.js` 接管 |
| `randomizer/app/constants.test.js` | 已删除 | 不接管图片文件名/资料同步；它不是架构协议 |
| `randomizer/app/debug-runtime.test.js` | 已删除 | 不接管开发辅助入口；正式 public authority 不泄漏由 Browser Host unit 接管 |
| `randomizer/app/effect-choice-flow.test.js` | 已删除 | 多选不得代选、stale Decision 零 mutation 由 `session-runtime.test.js`、`standard-action-session.test.js` 接管 |
| `randomizer/app/effect-flow.test.js` | 已删除 | queue、abort、journal、undo/barrier 由 `session-runtime.test.js`、`session-journal.test.js` 接管 |
| `randomizer/app/effects/executors.test.js` | 已删除 | 领域 effect 失败原子性由四类领域 session unit 与 `state-store-session.test.js` 接管 |
| `randomizer/app/engine-action-executor.test.js` | 已删除 | production handler 的合法枚举/执行及失败零提交由 Standard Action production composition unit 接管 |
| `randomizer/app/final-ui-runtime.test.js` | 已删除 | 终局分数、重复分源与非法标记由 `final-scoring.test.js`、`end-game-scoring.test.js` 接管；展示顺序不接管 |
| `randomizer/app/hand-flow.test.js` | 已删除 | 手牌实体不复活、隐藏牌不泄漏及 Decision stale 由 `deck.test.js`、`card-decision-ui.test.js`、`scan-card-session.test.js` 接管 |
| `randomizer/app/income-runtime.test.js` | 已删除 | 资源/收入失败不部分写入由 `players.test.js`、`deck.test.js` 接管；旧 flow 调用顺序不接管 |
| `randomizer/app/industry-runtime.test.js` | 已删除 | 公司 owner、choice、followup 与 rollback 由 `industry-alien-session.test.js`、对应 Browser Decision UI unit 接管 |
| `randomizer/app/primary-board-action-executor.test.js` | 已删除 | 发射/移动/环绕/登陆合法性与生产执行由 `actions.test.js`、`rockets*.test.js`、生产 composition unit 接管 |
| `randomizer/app/quick-turn-action-executor.test.js` | 已删除 | 快速行动成本、stale 与 session 原子性由 `quick-trades.test.js`、`quick-action-session.test.js` 接管 |
| `randomizer/app/refresh.test.js` | 已删除 | 不接管 renderer helper 调用顺序；单向 projection/render 由 Browser Host unit 接管 |
| `randomizer/app/render-runtime.test.js` | 已删除 | projection 隐私、冻结 selector、renderer 异常不回滚规则由 Browser Host unit 与 Chrome smoke 接管 |
| `randomizer/app/runtime.test.js` | 已删除 | 不接管内部容器形状；ViewState 隔离和 Session owner 由 Browser Host/Effect Session unit 接管 |
| `randomizer/app/scan-flow.test.js` | 已删除 | 扫描规则、Decision 多选、失败原子性由 `scan-card-session.test.js` 与 data/solar 规则 unit 接管 |
| `randomizer/app/score-source-runtime.test.js` | 已删除 | 重复分源、错误 owner 与 undo 边界由 scoring/history unit 接管 |
| `randomizer/app/start-screen.test.js` | 已删除 | 不接管开始界面调用顺序；页面启动和正式 composition 装配由 Chrome smoke 接管 |
| `randomizer/app/tech-runtime.test.js` | 已删除 | 科技目标/蓝槽/stale/成本及 session owner 由 `tech/*.test.js`、`research-tech-session.test.js`、生产 composition unit 接管 |
| `randomizer/app/turn-flow.test.js` | 已删除 | PASS owner、轮转、terminal 与无合法 action 卡死由生产 composition unit、Simulation Host unit 和唯一 full-flow 接管 |

## 生产反例证据

- Heuristic Policy：相同上下文确定性、只返回 legal actionId；空集、畸形配置、未知与 disabled action 均 fail-closed。
- evaluator：稳定 tie-break，不修改 observation/legal descriptor；selection evaluator 覆盖 setup、弃牌/支付、科技、蓝槽、移动和外星选择。
- Simulation Host：未知 action、schema mismatch、错 actor、stale、篡改 descriptor 均零提交；terminal 后 step 与 dispose 后所有公共调用拒绝；checkpoint/replay schema 保持。
- Standard Action：生产 Simulation composition 对 22 family 唯一注册；已接入 family 走真实 opening Decision 与 `research_tech` 执行，未接入 family 逐项显式 fail-closed 原因；stale Decision 在 handler 前拒绝。该回归同时发现并补齐研究科技缺失太阳系旋转 context、全员 PASS 后未走正式 TurnFlow 轮转、无预留牌轮次卡死三项生产缺口。
- Chrome：固定 5 项清单可重复执行页面/projection/人类输入、Policy 输入、save/recovery 与领域 Decision。

## 验证命令

```sh
node --check randomizer/app.js
node tools/run_node_tests.js
node tools/run_browser_smokes.js
```
