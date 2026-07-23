# SETI Node 测试全景审计

审计日期：2026-07-23

审计基准：共享工作树 `HEAD aeb27ba` 及当时 `tools/node-test-inventory.js` 工作树快照

范围：默认 Node inventory 的 96 个 unit、唯一 1 个 full-flow，以及架构文档声明的 Chrome 证据

## 结论

当前测试已经满足“只登记 unit 与唯一 full-flow”“默认回归全绿”“不读取生产源码做静态断言”三项形式要求，但还不能判定为“新架构的重要模块都覆盖完整”，也不能判定“现有 96 个 unit 都有必要”。

主要问题不是测试数量不足，而是 inventory 的架构归属由文件路径正则推导。例如任意 `randomizer/app/**` 测试默认归为“网页 UI”，任意 `game/ai/**` 测试默认归为“机器人”。这个标签不能证明测试实际命中了正式 owner 的 proof obligation。

当前应判定为：

- 核心状态、Effect Session、Browser Host 基础边界：证据较强。
- Standard Action：公共协议证据较强，但真实 22 family 的组合注册与逐 family 正式执行证据不完整。
- Simulation Host：有若干关键路径证据，但公共环境契约覆盖不完整。
- 机器人：只有 Policy Port、Machine Player Host 和浏览器装配，策略实现与估值域基本没有默认回归。
- persistence/recovery：Node 行为证据较强；Chrome 仅有一次性 smoke 记录，不属于可重复执行的默认测试。
- 大量旧 app flow/runtime 测试仍在默认清单中，尚未证明它们是新架构正式单元，而不是迁移期实现回归。

因此，SETI-140 完成的是测试清单清理和关键协议补测，不是最终意义上的测试体系收敛。

## 当前全景

| inventory 标签 | 文件数 | 实际判断 |
|---|---:|---|
| 唯一 Action | 17 | 协议与部分规则有覆盖；标签混入 app 交互层，且真实 family 组合证据不足 |
| 唯一 Effect Queue | 4 | app flow/executor 层有行为证据，但与 Effect Session 的职责仍有重叠 |
| 唯一 Session 状态 | 13 | 当前最完整，queue、Decision、journal、undo/barrier、CAS、checkpoint 均有反例 |
| 统一权威状态 | 24 | StateStore 很强；其余多为独立业务对象测试，尚未逐项映射到 committed schema |
| 网页 UI | 39 | Browser Host 正式边界约 9 个；其余大量是旧 app runtime、调试或展示辅助 |
| 机器人 | 3 | 只覆盖协议/host/composition，不覆盖策略质量与主要估值单元 |
| full-flow | 1 | 数量正确，能验证固定 Simulation 流程；不等同于 Browser 完整流程 |

本次执行结果：

```text
SUMMARY unit passed=96 failed=0 total=96
SUMMARY fullFlow passed=1 failed=0 total=1
```

全绿只说明当前断言成立，不解决覆盖归属和测试必要性问题。

## 正式 owner 覆盖矩阵

| 正式 owner | 已有主要证据 | 覆盖判断 | 关键缺口 |
|---|---|---|---|
| StateStore | `state-store.test.js`、`host-source.test.js`、高低耦合 slice、deterministic sequences | 强 | 高低耦合 slice 与具体业务状态测试有部分重复，需按 schema invariant 合并 |
| Rule Composition | `app/rule-composition.test.js`、`state-store-session.test.js`、`training/simulation-rule-composition.test.js` | 中强 | 多数使用 synthetic registry/effect；缺真实全 family composition 的系统反例 |
| Standard Action | `standard-action.test.js`、`actions.test.js`、`quick-trades.test.js`、conditional domain、外星人规则 | 中 | `standard-action.test.js` 为 22 family 注入同一个 synthetic definition，只证明 registry 协议，不证明生产 definition 全部注册且可执行 |
| Effect Session | `session-runtime`、`session-journal`、`state-store-session`、`standard-action-session` 及四类领域 session | 强 | app 的 `effect-flow/effect-choice-flow/effects/executors` 与正式 session owner 的边界仍需收敛 |
| Browser Host | `browser-host/*.test.js`、`game-recovery.test.js` | 中强 | Node stub 证据充分；真实 Chrome smoke 未进入可重复 runner，页面装配回归只能靠人工记录 |
| Simulation Host | `simulation-decision-owner`、checkpoint、replay、worker recovery、no-browser-globals、唯一 full-flow | 中 | 缺对 `reset/observe/legalActions/step/reward/terminal/dispose` 的完整公共契约矩阵；缺非法 action、未知 schema、terminal 后 step 等系统反例 |
| Policy Port | `policy-port.test.js` | 强 | 已覆盖 schema、迟到/重复/cancel/timeout 等零副作用语义 |
| Machine Player Host | `machine-player-host.test.js`、`browser-machine-player.test.js` | 中强 | Host 协议有覆盖；浏览器 composition 测试正在共享工作树变更，尚未形成稳定提交基线 |
| Heuristic Policy / AI 估值 | 无默认 unit | 弱 | `heuristic-policy.js`、`heuristic-evaluator.js`、`selection-evaluator.js` 及资源/卡牌/路线/扫描/科技/终局/外星人估值没有直接行为回归 |
| persistence/recovery | `browser-services.test.js`、`game-recovery.test.js`、`simulation-state-checkpoint.test.js` | 强（Node） | Chrome recovery 不是默认可重复证据；Browser 与 Simulation 的跨宿主 round-trip parity 未固化 |
| 游戏规则领域 | cards/data/tech/aliens/players/rockets/scoring 等测试 | 中强 | 覆盖广，但与 Standard Action/Effect Session 的正式入口映射不完整；部分只测底层 helper |
| 唯一完整流程 | `full-flow/standard-flow.test.js` | 中强 | 固定 Simulation trace 覆盖权威盘面与 journal；没有经过真实 Browser DOM/input/render/save 恢复完整链 |

## 明确缺失的重要证据

### 1. 机器人策略实现

默认 inventory 的“机器人 3 个测试”只证明：

- Policy 请求/响应协议；
- Machine Player Host 的代次、取消、超时、迟到与非法 actionId；
- 浏览器机器席位的窄装配。

它们不证明 Heuristic Policy 会从 legal set 中稳定选出合法结果，也不证明各估值单元面对资源、卡牌、路线、扫描、科技、终局和外星人局面时输出正确。当前 `game/ai` 大量生产模块没有直接行为测试。这是最明显的架构单元缺口。

建议最少补三类 unit：

1. `heuristic-policy`：相同 DecisionContext 确定性、只返回 legal actionId、空集/畸形输入 fail-closed。
2. `heuristic-evaluator`：稳定排序、tie-break、不得修改 observation/legal descriptors。
3. `selection-evaluator`：setup、弃牌、支付、科技、外星人 choice 的代表性反例。

其余细分 valuation 只在存在独立业务公式和真实回归风险时保留，不按“一文件一测试”扩张。

### 2. Simulation Host 公共契约

现有测试分别覆盖 no-browser-globals、Decision owner、checkpoint、replay 和 worker 恢复，但没有一份窄 unit 系统证明 `simulation-env.js` 的公共 API：

- reset 后 observation/legal set 的 schema；
- 非法、stale、越权 action 零提交；
- step 的 reward/terminated/truncated 语义；
- terminal 后继续 step 的拒绝；
- checkpoint/replay 的 schema/version 拒绝；
- dispose 后调用行为。

唯一 full-flow 的 happy path 不能替代这些反例。

### 3. 生产 Standard Action composition

`standard-action.test.js` 对全部 family 注册同一个测试 definition，因此 `coverage()` 全绿并不能发现生产 composition 漏注册、family 绑错 handler、错误 phase 或错误领域 builder。应增加一个使用生产 composition 的参数化 unit，只做：

- 生产 registry 的 22 family 均有唯一 definition；
- 每个 family 至少构造一个合法状态或明确的“不合法原因”；
- stale/unknown/越权均在 handler 前拒绝；
- 不复制各领域规则细节。

这不是导出枚举或源码门禁，而是运行生产 registry 的行为测试。

### 4. 可重复的 Browser 证据

仓库有 `*.browser-smoke.js`，但默认 runner 只执行 Node unit 与 full-flow。SETI-140 评论里的 5 项 Chrome 结果是一次性验收记录，不会在后续改动中自动失败。

若仍坚持默认 Node 只保留两类测试，应另设明确的 Chrome smoke 命令和固定清单，不把它伪装成 Node unit。至少覆盖页面启动、人类 Action/Decision、Policy 输入、projection 隐私和 save/recovery。

## 现有测试必要性审计

### A. 应保留：直接证明正式 owner

这些测试有清楚的公共输入、失败语义和唯一 owner，属于新体系的主体：

- Action/Composition：`game/actions/standard-action.test.js`、`app/rule-composition.test.js`、`app/conditional-decision-domain.test.js`。
- Effect Session：`game/effects/session-runtime.test.js`、`session-journal.test.js`、`state-store-session.test.js`、`standard-action-session.test.js`、`quick-action-session.test.js`、`research-tech-session.test.js`、`scan-card-session.test.js`、`industry-alien-session.test.js`。
- StateStore：`game/state/state-store.test.js`、`host-source.test.js`、`deterministic-sequences.test.js`。
- Browser Host：`app/browser-host/browser-host.test.js`、`browser-services.test.js`、`action-bar.test.js`、`decision-ui.test.js`、`card-decision-ui.test.js`、`industry-alien-decision-ui.test.js`、`policy-input-adapter.test.js`、`resident-renderer.test.js`、`player-stats-ui.test.js`。
- Simulation：五个 `app/simulation-*.test.js`、`training/simulation-rule-composition.test.js`。
- Robot：`game/ai/policy-port.test.js`、`machine-player-host.test.js`、稳定后保留 `app/ai/browser-machine-player.test.js`。
- Recovery：`app/game-recovery.test.js`。
- 完整流程：`full-flow/standard-flow.test.js`，保持唯一。

### B. 应保留，但需要按正式入口重新分组或去重

这些测试覆盖真实游戏规则，不能因为不属于六个基础设施 owner 就删除；但应说明它们验证的是“规则领域单元”，并证明其结果可由 Standard Action/Effect Session 正式入口到达：

- `game/actions/actions.test.js`、`quick-trades.test.js`。
- `game/aliens/*.test.js`。
- `game/cards/*.test.js`。
- `game/data/*.test.js`。
- `game/tech/*.test.js`。
- `game/players.test.js`、`rockets*.test.js`、`planet-stats.test.js`。
- `game/final-scoring.test.js`、`end-game-scoring.test.js`。
- `game/history/*.test.js`。
- `solar-system/core.test.js`。
- `game/state/high-coupling-slices.test.js`、`low-coupling-slices.test.js`。

重点不是删除这些规则测试，而是去掉“所有 game/state 路径都等于统一权威状态”这种自动归类，并合并重复夹具与重复公式断言。

### C. 需要逐个证明必要性：旧 app flow/runtime

下列测试虽然是行为测试，但目前主要证明旧 app 编排函数或 adapter 的调用顺序。它们只有在对应模块已被确认是新架构正式 Browser adapter 时才应留在默认 inventory：

- `action-interaction-runtime`、`action-runtime`、`score-source-runtime`。
- `alien-runtime`、`alien-trace-reward-flow`、`alien-ui`、`aliens/species-runtime`。
- `card-runtime`、`card-trigger-runtime`、`hand-flow`。
- `effect-choice-flow`、`effect-flow`、`effects/executors`。
- `primary-board-action-executor`、`engine-action-executor`、`quick-turn-action-executor`、`conditional-action-executor`。
- `income-runtime`、`industry-runtime`、`scan-flow`、`tech-runtime`、`turn-flow`。
- `render-runtime`、`runtime`、`bootstrap`、`start-screen`。
- `action-log-runtime`、`final-ui-runtime`。

这组是当前 96 个 unit 中最大的收敛风险。若某测试仍依赖第二套 pending、continuation、直接状态 mutation 或 renderer 推进规则，应删除或改写为 Browser input/projection、Standard Action 或 Effect Session 的正式端口测试；不能仅因它位于 `app/**` 就标为“网页 UI”后保留。

### D. 不应作为新架构默认回归

以下测试即使行为正确，也不承担新架构关键契约：

- `app/constants.test.js`：锁定图片文件名列表，属于资料/内容同步，不是架构 unit。
- `app/action-log-export.test.js`：验证 Markdown 导出格式，属于工具功能测试。
- `app/debug-runtime.test.js`：验证开发辅助入口。
- `app/refresh.test.js`：只锁定多个 renderer helper 的调用顺序，且与 Browser Host 单向 projection/render 边界重复。

`app/events.test.js` 目前一部分验证 DOM dataset 路由到 Standard intent，具有保留价值；另一部分暴露旧 pending getter 和可写 UI 状态，应拆分，旧状态聚合段不应继续留在新架构默认 unit。

如果产品仍希望保护导出、debug、资料列表等功能，可以放入非默认的 feature/tooling 清单；按 SETI-140 的严格口径，它们不应占据“新架构 unit”名额。

## 文档与 inventory 的一致性问题

- `tools/node-test-inventory.js::modulesFor()` 使用路径正则自动分类，无法表达一个测试的真实 owner、proof obligation 和反例。
- `docs/project-architecture.md` 仍称 `app/dependencies.test.js` 保留薄壳反例，但该文件已从 inventory 和仓库删除，文档已过期。
- `docs/node-test-architecture-matrix.md` 把大量未逐项复核的测试列为“原样保留”，这只是 SETI-140 的方案声明，不是必要性审计结果。
- 当前共享工作树对 `browser-machine-player.test.js` 与 inventory 存在 staged 删除、工作树重建的并发状态；在该变更提交前，机器人测试数量不是稳定基线。

## 建议的最终测试结构

默认 Node 清单仍保持两类，但 unit 内不要再用文件路径猜 owner：

```text
unit
├── architecture
│   ├── state-store
│   ├── standard-action
│   ├── effect-session
│   ├── rule-composition
│   ├── browser-host
│   ├── simulation-host
│   └── policy-host
├── rules
│   ├── actions
│   ├── cards
│   ├── data
│   ├── tech
│   ├── aliens
│   └── scoring
└── policy
    ├── heuristic-policy
    ├── heuristic-evaluator
    └── selection-evaluator

fullFlow
└── standard-flow-v1
```

每个 inventory 条目应显式登记：

- `file`
- `owner`
- `obligation`
- `counterexample`

runner 只需要校验登记完整、文件唯一和 full-flow 恰好一个，不应根据路径推断 owner。

## 下一轮收敛顺序

1. 先补机器人策略、Simulation 公共契约和生产 Standard Action composition 三个明确缺口。
2. 把 inventory 改为显式 owner/obligation，而不是路径正则。
3. 对 C 组旧 app 测试逐个做“正式端口可达性”审查；无法证明的新架构测试移出默认清单或删除。
4. 将 D 组四个测试移出默认新架构回归，并拆分 `events.test.js`。
5. 建立独立、可重复的 Chrome smoke 清单；仍保持 Node full-flow 唯一。
6. 修正文档中过期的 `dependencies.test.js` 描述，再跑 Node、唯一 full-flow 与 Chrome。

完成上述步骤后，才可以对外宣称“重要新架构单元已覆盖，默认测试均有必要”。
