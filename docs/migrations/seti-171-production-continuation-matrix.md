# SETI-171 Production Continuation 硬切迁移矩阵

## 冻结范围与根契约

本矩阵冻结于首个生产代码 patch 之前。有限集合机械来源如下：

- Standard Action：`randomizer/game/actions/standard-action.js::ALL_FAMILIES`，共 22 项。
- Production Effect domain：`randomizer/game/production-composition.js::effectDomains`，共 5 项。
- Browser 旧 pending：`randomizer/game/effects/browser-pending-decision.js::SUPPORTED_KINDS`，
  共 21 项。
- Browser 旧 continuation：`app.js::standardActionContinuation`、
  `app/conditional-decision-domain.js` 与 `app/conditional-action-executor.js`。
- Simulation 旧 continuation：`production-kernel.js::registry` 与
  `simulationContinuation`。

根契约：Production Composition 是 deterministic drain、跨域 Effect、Decision
owner/version、journal/replay/commit 的唯一 owner。Host 只提供 state/projection adapter、
显式随机源和无规则语义的 service；Host 不能注入 continuation、conditional registry、
Decision effect、quick-trade history 或 working-root rule transaction。

## 22 family 目标轴

| family | phase | 唯一 Production owner | committed state / 确定性 | Decision 与事务边界 | 正式证据 |
|---|---|---|---|---|---|
| `launch` | main | `probe_turn` | player/rocket/turn；rocket sequence 随 root | 发射目标与费用在同 Session，stale/wrong-owner 由公共输入拒绝 | 22-family parity + probe-turn session |
| `orbit` | main | `probe_turn` | rocket/planet/player/turn | 目标、费用、实体迁移一次 CAS | 同上 |
| `land` | main | `probe_turn` | rocket/planet/player/turn | target/payment Decision 由 domain 拥有 | 同上 |
| `scan` | main | `science` | data/card/player/alien；RNG cursor 随 root | target/public/hand/free-move Decision 由 domain 拥有 | 22-family parity + science session |
| `analyze` | main | `science` | player/data/alien | 数据选择与奖励由 domain 串行 | 同上 |
| `research_tech` | main | `science` | player/tech/card；tile identity | tile/bonus/card Decision 由 domain 拥有 | 同上 |
| `play_card` | main | `card_play` | hand/card/player 与 card instance sequence | payment/trigger/choice 写 Effect journal | 22-family parity + card play |
| `pass` | main | `probe_turn` | turn/card/player | reserve Decision 由 domain 拥有 | probe-turn session |
| `move` | main | `probe_turn` | rocket/player/turn | target/payment Decision 由 domain 拥有 | probe-turn session |
| `quick_trade` | quick | `standard_action` 的 game-owned quick-trade source | player/card/match；抽牌 RNG 与 card sequence 来自 action context/root | discard/card selection 保存在 Session working root；整条交易一次 CAS；journal 记录费用、实体和结果 | quick-trade Decision + checkpoint fork |
| `industry` | main | `residual_domains` | player/company/card/rocket | 公司 Decision/followup 由 residual domain 拥有 | residual session |
| `card_corner` | quick | `residual_domains` | hand/card/player | card instance 与 followup 由 residual domain 拥有 | residual session |
| `place_data` | quick | `science` | data/player/alien | placement Decision 由 science domain 拥有 | science session |
| `runezu_face_symbol` | quick | `residual_domains` | alien/card/player | choice/followup 由 residual domain 拥有 | residual session |
| `end_turn` | system | `probe_turn` | turn/player/card/alien | reveal/income/next-owner 在同 domain | probe-turn session |
| `choose_card` | conditional | active Effect domain；initial setup 由 `initial_setup` source | 选择只引用 committed entity identity | 公共 Decision id/version/owner/choice；无 Host registry | root contract + Decision parity |
| `choose_target` | conditional | active Effect domain | 目标 identity 随 Effect payload | 同上 | 同上 |
| `choose_payment` | conditional | active Effect domain；initial income 与 quick trade 为 game source | 费用与实体迁移保留在 Session working root | 同上 | 同上 |
| `choose_reward` | conditional | active Effect domain | 奖励状态随 domain | 同上 | 同上 |
| `choose_branch` | conditional | active Effect domain | branch identity 随 Effect | 同上 | 同上 |
| `choose_final_scoring` | conditional | `residual_domains` | final scoring mark sequence 随 root | 多 owner 串行 Decision | residual session |
| `accept_optional_effect` | conditional | active Effect domain | skip/accept 写同一 journal | 同上 | 同上 |

不存在 Host-owned family。未知 family、当前 active Effect 不接受的 conditional family、
错误 actor/stateVersion/decisionVersion/choice identity 均零副作用 fail-closed。

## 5 Effect domain 与跨域 handoff

| domain | families | deterministic drain / Decision owner | journal / commit / replay |
|---|---|---|---|
| `standard_action` | quick_trade + 7 conditional families | Composition 内建 continuation；只枚举 game source，不调用 Host | Session journal；完整链完成后一次 CAS |
| `card_play` | play_card | card domain 自有 payment/trigger/followup | card entity、费用、RNG 与 replay 都在 Session |
| `science` | scan/place_data/analyze/research_tech | science 自有全部 Decision 与 deterministic effects | science journal + root RNG cursor |
| `probe_turn` | launch/move/orbit/land/pass/end_turn | probe/turn 自有 payment、target、reserve、reveal | probe-turn journal + turn commit |
| `residual_domains` | industry/card_corner/runezu_face_symbol | company/card/alien/final Decision；正式 handoff effect 连接其他 domain | residual journal；`augmentEffectResult` 只生成正式 handoff |

跨域 Effect 只通过 domain 返回的 `spawnedEffects`/正式 handoff 进入 Session。Composition
不得调用 Browser effect dispatcher、Simulation private executor 或 callback continuation。

## 21 Browser 旧 pending 的目标归属

| 旧 pending kind | 唯一目标 owner |
|---|---|
| move_payment, pass_reserve, probe_sector_scan, probe_location_reward, land_target, turn_end_reveal | `probe_turn` |
| scan_target, scan_free_move, public_scan, hand_scan, data_placement | `science` |
| card_move, card_corner_free_move, card_trigger_free_move, card_trigger, card_task_completion | `card_play` / `residual_domains` 的正式 card Decision |
| industry_ability, industry_free_move, strategy_slot | `residual_domains` company Decision |
| alien_trace | `science` 或 `residual_domains` 中产生该 trace 的正式 Effect |
| discard | `initial_setup` 或 game-owned quick-trade source |

`card-selection-decision.js` 中的 public/hand/trade selection 不再向 Production
Composition 上送 DecisionEffect；正式 source/domain 直接构造 choices。Browser helper 最多
读取 viewer-safe active Decision，不能 open/take/defer 或参与 rule transaction。

## 状态、RNG、identity 与恢复

| 义务 | 唯一归属 | 反例与失败语义 |
|---|---|---|
| committed root | StateStore + state adapter | Host callback 修改另一份 root：构造期拒绝规则注入口 |
| working root | Effect Session | 缺失 composition working root：`*_WORKING_ROOT_MISSING` |
| RNG | root metadata + 显式 action context random | Host 私有 RNG 或恢复 cursor 漂移：checkpoint parity 失败 |
| entity id / sequence | committed root metadata 与正式模块 sequence adapter | same-instance A/B/A 漂移：隔离门禁失败 |
| Action identity | Standard Action registry | stale state/decision、wrong actor、unknown family：公共输入零副作用拒绝 |
| Decision identity | Effect Session | stale/late/wrong-owner/removed-choice：公共 Decision 输入零副作用拒绝 |
| CAS | Effect Session → StateStore | 一个 action/Decision 链多次提交：stateVersion/journal 门禁失败 |
| replay/recovery | Session journal + lifecycle envelope | 未确认 choice 入 journal、恢复后 choices/cursor 漂移：replay 门禁失败 |

## 来源轴与删除证据

| 旧来源 | 当前语义 | 本项目标 | 删除证据 |
|---|---|---|---|
| `production-composition.js::productionRules.conditionalActions` | Host conditional registry | 由 game source/domain 枚举 | 构造参数出现即 fail-fast；生产读取为零 |
| `production-composition.js::standardActionDomainOptions.continuation` | Host continuation | Composition 内建 continuation | Host 参数出现即 fail-fast；生产读取为零 |
| `production-composition.js::hostServices.quickTradeHistory` | Browser history callback | Session journal/原子 working root | 字段出现即 fail-fast；调用为零 |
| `standard-action-session.js::takeOpenedDecisionEffect/takeDeferredDecisionEffects` | Browser side-channel Decision | domain/source 直接 spawn | 参数和调用为零 |
| `app.js::standardActionContinuation` | Browser continuation | 删除 Production 接线 | 符号与 `standardActionDomainOptions` 接线为零 |
| `app.js::runWithWorkingState` 的 Browser Decision owner 嵌套 | Browser rule transaction | 普通 Composition working-state scope | `runRuleTransaction` 不进入 Production 装配 |
| `app.js::hostServices.quickTradeHistory` | Browser quick-trade undo callback | Session journal | Production 装配字段为零 |
| `production-kernel.js::registry` | Simulation conditional executor | game sources/domain | private register/enumerate/execute 为零 |
| `production-kernel.js::simulationContinuation` | Simulation continuation | Composition 内建 continuation | 符号与注入为零 |
| `browser-rule-composition.js` continuation/service pass-through | Browser rule port | 只传 adapter/random/纯 service | continuation/规则 service 参数为零 |

保留的 Browser presentation helper 不能成为 Production source；若仍有旧 UI 调用
`open/defer`，它只能位于未接 Production Composition 的不可达兼容路径，后续来源删除项可物理
删除该 UI 代码。本项的硬门禁是任何上述字段传入 Composition/Kernel 都在构造期失败。

## Proof obligations 与集中验证

1. **根契约反例**：分别注入 continuation、conditionalActions、quickTradeHistory、
   take/deferred Decision callback、重复 family/domain；构造期必须失败且不创建 StateStore。
2. **22-family 完备性**：同 canonical checkpoint 对每个 family 枚举实体/方向/目标/费用完整
   descriptor；逐 action fork 比较 result、Effect journal、下一 Decision 与 committed state。
3. **Decision**：每个可达多选比较 id/version/owner/choice；stale、late、wrong-owner、
   removed-choice、unknown pending/family 零副作用失败。
4. **quick trade**：直接完成、弃牌后完成、弃牌后精选三条链比较费用、card entity、
   pending Decision、journal、CAS 与 replay。
5. **确定性与恢复**：fresh A/A、same-instance A/A、A/B/A、非零 checkpoint fork、
   worker crash/timeout recovery 比较 observation/legalActions/journal/RNG/sequence。
6. **完整流程**：固定 seed 从 setup 到 game_end 的正式机器局；全量 Node 与真实 Chrome
   smoke。测试只验证本矩阵，不用于发现新的 owner/state/RNG/Decision 设计。

若集中验证首次暴露未知 owner、state、RNG 或 Decision 语义，停止 patch，先回到本矩阵补齐
全部同类项，再继续批量实现。
