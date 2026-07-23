# SETI Node 测试逐文件收敛结果

日期：2026-07-23

## 结论

默认回归现在只有 69 个 `unit` 与唯一 1 个 `fullFlow`。`tools/node-test-inventory.js` 是逐文件保留结果的权威清单：每一项都显式写出 `file`、`owner`、`obligation`、`counterexample`，不再按路径正则贴标签。运行 `node tools/run_node_tests.js --list` 可输出全部保留项及其反例。

本轮没有为了减少数字而物理删除仍可能保护产品功能的测试；无法证明为新架构正式 owner 的 32 个旧 app/tooling 测试全部移出默认清单。`events.test.js` 合并收窄，只保留 DOM dataset 到正式输入端口的行为，删除旧 pending getter 与可写 UI 状态聚合断言。

## 保留

逐文件保留项全部登记在 inventory v2，共 69 个 unit：

- architecture：StateStore 5、Standard Action 2、Effect Session 8、Rule Composition 1、Browser Host 11、Simulation Host 7、Policy Host 3。
- rules：actions 8、cards 3、data 2、tech 2、aliens 10、scoring 4。
- policy：Heuristic Policy、Heuristic Evaluator、Selection Evaluator 各 1。
- fullFlow：`randomizer/full-flow/standard-flow.test.js`，恰好 1 个。

其中新增的关键保留项：

- `randomizer/game/ai/heuristic-policy.test.js`
- `randomizer/game/ai/heuristic-evaluator.test.js`
- `randomizer/game/ai/selection-evaluator.test.js`
- `randomizer/app/simulation-host-contract.test.js`
- `randomizer/training/simulation-standard-action-composition.test.js`

## 合并

| 文件 | 结果 | 保留义务 | 删除内容 |
|---|---|---|---|
| `randomizer/app/events.test.js` | 合并收窄后保留 | disabled/未知 DOM dataset 不提交；主行动只分发 Standard intent | `createAppEventState` 对旧 pending getter、可写 UI 状态的聚合断言 |

## 移出默认清单

下列文件仍可由产品/迁移专项单独执行，但不再占用“新架构 unit”名额：

| 文件 | 结果 | 原因 |
|---|---|---|
| `randomizer/app/action-interaction-runtime.test.js` | 移出 | 旧 picker/交互编排，未证明公共 Browser input/projection 契约 |
| `randomizer/app/action-log-export.test.js` | 移出 | Markdown 导出工具格式 |
| `randomizer/app/action-log-runtime.test.js` | 移出 | 日志 DOM/draft 编排，不是规则 owner |
| `randomizer/app/action-runtime.test.js` | 移出 | 混合 adapter、initial income 与旧 effect-flow 编排 |
| `randomizer/app/alien-runtime.test.js` | 移出 | 旧外星人 app 调用顺序 |
| `randomizer/app/alien-trace-reward-flow.test.js` | 移出 | 旧奖励 flow，正式 owner 已由 alien/session unit 承担 |
| `randomizer/app/alien-ui.test.js` | 移出 | 展示辅助与旧 picker 状态 |
| `randomizer/app/aliens/species-runtime.test.js` | 移出 | 大型物种 Browser runtime characterization |
| `randomizer/app/bootstrap.test.js` | 移出 | 装配/启动 helper，不证明正式端口行为 |
| `randomizer/app/card-runtime.test.js` | 移出 | 旧卡牌 pending/DOM 编排 |
| `randomizer/app/card-trigger-runtime.test.js` | 移出 | 旧任务/触发 continuation 编排 |
| `randomizer/app/conditional-action-executor.test.js` | 移出 | 与正式 conditional domain/session 重复 |
| `randomizer/app/constants.test.js` | 移出 | 图片文件名与资料同步 |
| `randomizer/app/debug-runtime.test.js` | 移出 | 开发辅助入口 |
| `randomizer/app/effect-choice-flow.test.js` | 移出 | 第二套 effect choice flow，正式 owner 是 Effect Session |
| `randomizer/app/effect-flow.test.js` | 移出 | 第二套 effect flow，正式 owner 是 Effect Session |
| `randomizer/app/effects/executors.test.js` | 移出 | app executor 调用顺序，与领域 session 重复 |
| `randomizer/app/engine-action-executor.test.js` | 移出 | 迁移期 executor characterization |
| `randomizer/app/final-ui-runtime.test.js` | 移出 | 终局展示 runtime，不是计分 owner |
| `randomizer/app/hand-flow.test.js` | 移出 | 大型手牌 DOM/pending 编排 |
| `randomizer/app/income-runtime.test.js` | 移出 | 旧收入 flow 调用顺序 |
| `randomizer/app/industry-runtime.test.js` | 移出 | 公司 UI/pending 编排，领域行为已有正式 owner |
| `randomizer/app/primary-board-action-executor.test.js` | 移出 | adapter executor 与 Standard Action 生产 composition 重复 |
| `randomizer/app/quick-turn-action-executor.test.js` | 移出 | 快速行动 executor 与 action/session unit 重复 |
| `randomizer/app/refresh.test.js` | 移出 | renderer helper 调用顺序 |
| `randomizer/app/render-runtime.test.js` | 移出 | 传统 DOM renderer characterization；正式边界由 Browser Host/Chrome 证明 |
| `randomizer/app/runtime.test.js` | 移出 | runtime 容器内部形状，不是公共 owner 契约 |
| `randomizer/app/scan-flow.test.js` | 移出 | 旧扫描 UI/pending flow；规则与 session 已分开验证 |
| `randomizer/app/score-source-runtime.test.js` | 移出 | app 分源账本 adapter，未证明正式计分入口 |
| `randomizer/app/start-screen.test.js` | 移出 | 启动界面/初选 UI 编排 |
| `randomizer/app/tech-runtime.test.js` | 移出 | 科技 picker/pending 编排；正式规则与 session 已覆盖 |
| `randomizer/app/turn-flow.test.js` | 移出 | 旧回合壳层调用顺序 |

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
