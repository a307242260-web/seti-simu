# SETI-166 Browser 读取面迁移矩阵

状态：已实现并验收（2026-07-25，基线 `origin/dev@528c69e`）。本矩阵由
`randomizer/app.js`、`randomizer/app/**` 中的 `readModelPort.read`、
`registry.register`、`createBrowserInputPort`、`BROWSER_INPUT_NAMES` 和
BrowserProjection selector 机械枚举得出。测试只验证本矩阵，不用于发现新的读取 owner。

## 根契约

- 唯一规则状态 owner 仍是 Production Composition；本单不改变 SETI-158～163 的
  Action、Decision、Effect、费用、RNG、id、sequence、CAS、journal 或恢复语义。
- Browser 页面只读取 `seti-browser-host-v1` 深冻结 BrowserProjection，或由它选择出的
  严格 DTO。DTO 保留 `projectionId/source/viewer` identity；不得包含 canonical/working/
  committed root、StateStore、executor、未来牌库顺序或对手手牌。
- BrowserProjection 的 render builder 只能接收 visibility policy 产出的 viewer-safe
  presentation source；不得再接 canonical candidate 或完整规则 slice。
- 独立 ViewState 只拥有 overlay、焦点、选择高亮、debug/status 等宿主状态。规则事务内部
  helper 若仍由后续输入迁移使用，只能显式接收事务 `workingRoot`，不得继续注册为 Browser
  query/readout。
- projection/selector/renderer 抛错必须发生在 clone/freeze 隔离之后，且不得改变
  `stateVersion`、committed bytes、RNG、journal 或 Decision version。

## A. 传统 read model root（6/6）

| 旧入口 | 唯一新 DTO owner | 状态/RNG/Decision/事务 | 删除证据 | 行为证据 |
|---|---|---|---|---|
| `readModelPort.read("playerTurn")` | `BrowserProjection -> selectPlayerTurnProjection` | 只读 viewer-safe player/turn；无 RNG/Decision/commit | Browser composition 不安装/返回 `readModelPort` | player lookup/AI control 只收到冻结 DTO |
| `readModelPort.read("actionEffectFlow")` | `BrowserProjection -> selectEffectPresentation` | 仅 actionType/currentIndex/显示 effect；无 executable effect payload | `actionEffectFlow` reader 删除 | effect bar mutation poison + renderer throw 零污染 |
| `readModelPort.read("cardUi")` | `BrowserProjection -> selectCardUiProjection` + ViewState | 仅 viewer 当前选择/显示标志；legal choice 归 Decision | `cardUi` reader 删除 | 对手手牌/牌库顺序不进入 DTO |
| `readModelPort.read("solarBriefing")` | `BrowserProjection -> selectSolarBriefingProjection` | 只读公开 sector mapping | `solarBriefing` reader 删除 | briefing 接冻结 DTO |
| `readModelPort.read("initialSetupStatus")` | canonical BrowserProjection `resident.initialSetup` | offer 仅当前 viewer；提交仍走正式 Action/Decision | reader 与 alias 删除 | 四席位 viewer 隐私 |
| `readModelPort.read("alienBoard")` | `BrowserProjection -> selectAlienBoardProjection` | 只读公开物种盘面 + viewer-safe players | reader 删除 | 八物种 renderer 不接 root |

## B. 字符串 owner registry 读取面（17 owners）

下列 owner 的 mutation/service 方法不在本单重写；其中读取方法必须从 registry 物理删除并
按本表改为 Projection selector、ViewState 或事务内部 helper。

| owner | 读取方法有限集合 | 唯一映射 |
|---|---|---|
| `turn_readout` | final/round/current/next/visited/passed readout queries | `turnFlow`/`finalUi` selector |
| `coordinate` | token/planet/visible-content coordinate queries | `boardCoordinate` selector |
| `probe_query` | active/movable probe、移动点数 | `boardCoordinate` + `controls.actions` |
| `land_target` | 当前公开落点/选择显示 | `decision` + `boardCoordinate` |
| `board_query` | sector/planet/asteroid/rocket read queries | `boardCoordinate` |
| `data_interaction` | pool/blue-slot picker read queries | `render.dataPresentation` + `decision` |
| `solar` | rotation/sector read queries | `render.boardChrome`/`boardCoordinate` |
| `final_score` | final board/player breakdown queries | `finalUi` selector |
| `public_card` | public card/selection/control queries | `render.cardPanels` + `decision` |
| `chong_transport` | `listReady` | `decision.choices`；规则枚举仅留事务内部 |
| `effect_flow` | current/progress/history/status queries | `effectPresentation` |
| `quick_action` | quick action availability | `controls.quickActions` |
| `history` | undo availability/reason | `controls.canUndo/undoDisabledReason` |
| `sector_settlement` | ready settlement/display summary | `render.dataPresentation`；规则 builder 内部化 |
| `recovery` | round/turn/actionCycle/current player read | `recovery` selector |
| `ai` | seat/difficulty/scheduling display | player-turn DTO + 独立 AI ViewState |
| `browser_status` | status/debug note | 独立 Browser service/ViewState，不接 projection root |

## C. `createBrowserInputPort` target facade（15 targets）

每行列出基线中混入 target registry 的完整读取/build 名称。`begin/confirm/execute/apply` 等
规则输入留给后续子项；本单只删除读取入口。标为“事务内部”的方法仍可由正式规则事务以显式
`workingRoot` 调用，但不得由 Browser target 名称分发。

| target | 读取/build 方法（完整有限集合） | 新 owner |
|---|---|---|
| `hand_flow` | `isHandScanSelectionActive`, `getMovePaymentPlayer`, `isMovePaymentLockedForAiAutomation`, `getPendingPlayCardSelection`, `getPendingHandCardPlayAction`, `getPendingCardCornerQuickAction` | `cardUi`/`decision`/ViewState selector |
| `action_interaction` | `getPlutoReservedCards`, `buildPlutoMarkerContext`, `playerHasOwnPlutoLanding`, `buildPlutoMarkerRemovalChoices`, `getPlutoCandidateRockets`, `getPlutoActionCost`, `getAvailablePlutoAction`, `getCurrentPlanetActionPlacement` | presentation 使用 `finalUi`/`boardCoordinate`/`controls`; 规则 builder 内部化 |
| `scan_flow` | `getPublicScanMaxSelectable`, `buildReadySectorFinishEffects`, `buildScanFinalizeFollowupEffects`, `getSectorFinishWinnerTarget`, `buildEndOfFlowFollowupEffects`, `shouldAppendQueuedSectorFinishEffects`, `nebulaHasScannableData`, `buildNebulaScanChoice`, `isAomomoActive`, `getAomomoPlanetLocation`, `getAomomoCurrentX`, `getNebulaCurrentX`, `getSectorScanTargetLabel`, `buildAomomoScanChoiceForX`, `hasAomomoScanAtX`, `buildSectorScanChoicesForX`, `getSectorOpenDataCount`, `getSectorReplacedCount`, `getSectorExtraMarkCount`, `getPublicScanChoicesForCard`, `hasHandScanTargetCard`, `createPublicScanPendingAction` | presentation 使用 `render.cardPanels/dataPresentation/boardCoordinate`; rule choice/effect builder 内部化 |
| `card_runtime` | `getDiscardCornerRewardMultiplier`, `getCardCornerQuickActionForCard`, `shouldQueueCardCornerMoveQuickAction`, `canUseCardCornerQuickAction`, `canStartCardCornerFreeMove`, `hasFutureSpanEligibleHandCard`, `hasPlayableFutureSpanCard`, `getStandardPlayCardActionBlockReason`, `getPlayCardSelectionBlockReason`, `getHandCardPlayActionForCard`, `canBlindDraw`, `getPassReserveSelectionCards`, `getMovableTokensForCardMoveEffect` | `render.cardPanels`/`controls`/`decision`; rule builder 内部化 |
| `card_trigger` | `buildCardTaskContext`, `buildPlayerDataTotals`, `buildProbeLocationIndex`, `getReadyCardTasks`, `buildAlienTraceEvent`, `getActiveCardEventBonuses`, `buildChongPositionArrivalEvents`, `getReadyTaskForReservedCard`, `getReadyChongTaskForReservedCard`, `getReadyAmibaTaskForReservedCard`, `getReadyRunezuTaskForReservedCard`, `createCardTriggerProgressSnapshot`, `createCardTriggerProgressCommands` | reserved-card presentation 已投影；其余规则 builder 内部化 |
| `tech_runtime` | `isTechActionSelectionActive`, `isTechTilePickingActive`, `isTechTileOwnedByOtherPlayer` | `decision` + `render.techTilePresentation` |
| `industry_runtime` | `createCompanyCardSummary`, `isIndustryFutureSpanHandSelectionActive`, `isIndustryHandSelectionActive`, `canBeginIndustryFutureSpanHandSelection`, `getStrategyPassiveSelectableSlotIds`, `buildIndustryPlayCardAppendEffects`, `buildPlayCardEffectFlowQueue` | presentation/decision selector；effect builder 内部化 |
| `alien_runtime` | `getAlienTraceActionPlayer` | `decision.ownerId` + viewer-safe players |
| `alien_ui` | `buildAlienRevealNoticeEntry`, `getAlienTracePickerPlayer`, `canPlaceJiuzheTrace`, `canPlaceYichangdianTrace`, `canPlaceFangzhouTrace`, `canPlaceBanrenmaTrace`, `canPlaceChongTrace`, `canPlaceAmibaTrace`, `canPlaceAomomoTrace`, `canPlaceRunezuTrace`, `canPlaceRunezuFaceSymbol`, `canPlaceStateTrace`, `canPlaceAnyStateExtraTrace`, `getEligibleAlienSlotIdsForTraceEffect`, `getFangzhouUnlockableTraceTypes`, `hasAlienTracePanelPlacementTarget` | `events`/`alienBoard`/`decision`; rule legality内部化 |
| `alien_species` | `PROJECTION_METHODS`：13 个 `getPending*` | canonical `decision`/`alienBoard` selector；不得 target 注册 |
| `effect_choice` | choice label/preview/current selection queries | canonical `decision` + ViewState |
| `effect_executor` | `getPlanetName`, `markerBelongsToPlayer`, `playerHasOwnOrbitMarkerAtPlanet`, `buildPlanetMarkerRemovalChoices`, `formatPlanetRewardGain`, `buildPlutoRewardEffectsForAction`, `buildPlutoChoiceRewardSummary`, `getSectorXsMatchingCondition`, `sectorXHasAvailableScanTarget`, `isAlienFamilyCard`, `countOwnedTechByType`, `getPlayerCompanyBaseIncome` | 显示格式进 DTO；rule/effect builder 内部化 |
| `debug` | `getFailsafePendingOwnerPlayer` | `decision.ownerId`/player-turn DTO；debug ViewState 独立 |
| `income_runtime` | income display/format queries | `render.playerPanels`；规则收入 builder 内部化 |
| `turn_end` | 无读取 target（仅命令）；本单只证明不新增 query alias | 保留后续输入迁移边界 |

## Proof obligations

| 义务 | 最小反例 | 静态/行为证据 |
|---|---|---|
| Browser 无 canonical/readout root | facade 返回 `readModelPort`、`stateSourcePort` 或 `getCanonical*` | Browser composition facade key audit + forbidden-symbol scan |
| viewer 隐私 | projection/DTO 含 deck ids 或 opponent hand entries | 双 viewer fixture + serialized poison scan |
| clone/freeze | selector 返回 source 引用，renderer 改写资源 | mutation poison、深冻结断言 |
| 异常隔离 | selector/query/renderer throw 后 version/bytes 变化 | 订阅计数 + save bytes 前后相等 |
| 完整迁移 | 任一上表读取名称仍位于 target/owner registry | 全量枚举与残留为零 |
| 不改规则语义 | Action/Decision owner、费用、RNG、journal 漂移 | 全量 Node + full-flow；Chrome 仅在矩阵闭合后一次 |

## 验收证据

- A 组传统 Browser read model reader 已全部删除；Browser composition 不再安装或暴露
  `readModelPort`，页面统一从 BrowserProjection 严格 selector 读取。
- B/C 组读取方法已从 owner/target registry 物理删除；事务内部仍需要的 builder 只保留
  显式 `workingRoot` 直连 helper，不再由 Browser 字符串 target 分发。
- render builder 输入来自 visibility policy 的 viewer-safe presentation，且在回调前 clone +
  deep-freeze；viewer identity 由 Browser Host ViewState 持有，构造 Projection 时禁止递归读取。
- 静态残留：生产 Browser 路径中 `getCanonicalBrowserProjection`、`browserReadModels`、
  `turn_readout`、`probe_query`、`board_query`、`chong_transport`、`readModelPort` 为零。
- 行为门禁：opponent hand/deck canary、mutation poison、renderer 异常零污染均通过；
  `node tools/run_node_tests.js` 为 75/75 unit、1/1 full-flow；
  `production-browser-full-parity` 真实 Chrome smoke 为 1/1。
