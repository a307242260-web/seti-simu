# Production Composition 迁移 inventory

本清单是 SETI-162 建立共享 `game/production-composition.js` 后的结构审计基线。它描述
`app/**` 与 `training/**` 中仍然拥有规则枚举、执行、Decision 或直接 state-write 的位置；
不是“已迁移”声明，也不按行数判定完成。

## 已建立的唯一装配义务

- Browser 与 Simulation 都必须调用 `SetiProductionComposition.createProductionComposition()`。
- 工厂内部创建一次 Standard Action registry port；`quick_trade` definition 由 pack 创建并拥有，
  executor 在 pack 内直接调用 `game/actions/quick-trades.executeTrade`，Browser 仅注入 legacy
  undo/history 适配，Simulation 仅通过 action context 提供选择端口与随机源。
  其余未迁移 family 只从显式 legacy input source 合成。工厂同时安装覆盖全部
  `SetiStandardAction.ALL_FAMILIES` 的 Standard Action Effect domain。
- `ruleOptions` 不接受 `createActionRegistry` / `effectDomains`；顶层也拒绝
  `createStandardActionRegistry`。host 通过
  `actionRegistry`、`standardActionDomain` 或同 family executor/domain 覆盖生产 owner 时 fail-fast。
- Host 保留的注入面仅用于 state adapter、projection、输入来源、随机源、continuation 与宿主
  services。未迁移的 provider/executor 记录在下表，不能被当作新架构范例。

## Browser 残留删除清单

| 位置 | 当前 ownership | 后续边界 |
|---|---|---|
| `app/action-runtime.js:createBrowserStandardActionAdapter` | 创建 quick_trade 之外的 Browser legacy input source；包含 enumerate/validate provider | 将每个剩余 family 的规则 provider 迁入 game domain pack；app 只保留 intent/input 映射 |
| `app/action-runtime.js:createActionRuntime.executeStandardDescriptor` | 按 family 分派 Primary Board、Engine、Quick Turn、Conditional executor | 删除 family 路由；统一调用 production registry/session |
| `app/primary-board-action-executor.js` | launch/move/orbit/land 规则提交与 working-root 写入 | 迁入相应 game action domain |
| `app/engine-action-executor.js` | scan/analyze/research/play-card family 执行路由 | 按后续领域迁移项拆入 game domain |
| `app/quick-turn-action-executor.js` | industry/card_corner/place_data/runezu/end_turn 执行路由与 history；不存在 quick_trade handler/working-root 分支 | 迁入 game quick/turn domains；Browser 只呈现 continuation |
| `app/conditional-action-executor.js`、`app/conditional-decision-domain.js` | Decision enumerate/validate/execute 与 pending state-write | Decision owner 迁入正式 game domain/session |
| `app/browser-pending-decision.js`、`app/card-selection-decision.js` | Browser 事务内打开/读取 DecisionEffect | 迁完对应 family 后删除 Browser rule owner，仅保留 renderer/input adapter |
| `app/effects/**` | 具体 Effect executor 与 working-root mutation | 逐领域迁入 game effect domains；`app/effects/bootstrap.js` 的注册表随之删除 |
| `app.js` 中 action/turn/card/scan/tech/industry/alien flow | 大量生产 state-write 与 continuation 接线 | 后续 issue 按领域迁移；不得再新增 host-only family executor |

## Simulation 残留删除清单

| 位置 | 当前 ownership | 后续边界 |
|---|---|---|
| `training/simulation-rule-composition.js:createSimulationRuleComposition` | 创建并注册 quick_trade 之外的 legacy Standard Action input source；family 执行直接写 working root | provider/executor 逐 family 迁入 game domain pack；Simulation 只提供 random/state adapter/services |
| 同文件 `registry.execute` wrapper | land/orbit 奖励、main-action 标记、decisionVersion 写入 | 迁入对应 game domain 的 commit/journal |
| 同文件 play_card/move/industry/card_corner/pass/end_turn registrations | Simulation 专有规则 executor 与 journal event 组装 | 删除专有 executor，复用 production definition |
| 同文件 Standard Action continuation | inspect/resolve Decision 并处理 reward/card/industry state-write | Decision owner 迁入 game domains；Simulation 仅提交 choice |
| `game/initial-setup.js` | opening 的公司/初始牌与初始收入唯一 Production owner | 已迁移；Browser/Simulation 只提交正式 `choose_card/choose_payment` Action/Decision |
| `app/simulation-env.js` | `legalActions`/`step` 调用 composition input port | 合法 Host adapter，保留；不得加入规则 fallback |
| `training/simulation-worker.js` | worker operation dispatch | 合法宿主协议，保留；不得创建 registry/domain |

## 本竖切的行为证据

`training/simulation-standard-action-composition.test.js` 使用 `quick_trade` 证明生产 descriptor
identity、executor 结果、Effect Session journal 与 committed state，并覆盖 stale action 零污染。
同一测试对 host 重复 `quick_trade` executor/domain 构造反例并要求初始化期失败。

本清单只声明后续迁移债务；完整卡牌、扫描、移动、公司、外星人、策略、Q/reward 均不属于
SETI-162 的实现范围。
