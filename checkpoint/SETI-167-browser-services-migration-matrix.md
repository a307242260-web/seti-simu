# SETI-167 Browser Services / ViewState 迁移矩阵

状态：已实现并验收（2026-07-25，基线 `origin/dev@457f321`）。

来源全集由以下生产路径机械枚举：

- `randomizer/app/browser-host/browser-services.js` 的全部导出及其调用者；
- `randomizer/app/browser-host/view-state-store.js` 的完整 schema/intent；
- `randomizer/app.js` 中 `browser_status`、`ai`、`debug` owner 装配；
- `randomizer/app/ai/**` 中席位、难度、scheduler、snapshot；
- `randomizer/app/debug-runtime.js`、`events.js`、`index.html` 的完整 debug caller；
- `randomizer/app/**` 中 `localStorage`、Blob/URL、timer、focus、overlay 宿主能力调用。

本单不迁移 SETI-168/169 的人类 Action/Decision DOM handler，也不删除 SETI-170 最终负责的
OwnerInput 根 authority。为避免把活跃兼容层伪装为 Browser service，临时 OwnerInput registry
只能由明确的 legacy input 模块持有；Browser Services 导出面不得包含它。

## 根契约与反例

| 义务 | 可证伪命题 / 最小反例 | 唯一落点 | 证据 |
|---|---|---|---|
| Service 零规则依赖 | 调用 storage/download/timer/focus/status 前后 `stateVersion` 或 committed bytes 改变 | `browser-services.js` 只接浏览器 capability port | unit 对同一 Composition save bytes/version 逐服务比较 |
| lifecycle 不属于 service | `createBrowserServices` 接受 `ruleLifecycle`、StateStore、session/input port | `game-recovery.js` 的显式 checkpoint adapter 组合正式 Composition lifecycle + ViewState | service 构造 poison port；恢复 round-trip 走 lifecycle |
| ViewState 唯一拥有 Browser status/focus/overlay/debug chrome | `browser_status.setNote` 写 `workingRoot.rocketState`，或纯 UI debug 经过 OwnerInput CAS | `view-state-store.js` intent | snapshot schema/restore + root bytes 不变 |
| AI 配置不写 player committed slice | 改难度后 `player.aiDifficulty` 或 committed bytes 改变 | `ai/control-runtime.js` 独立 seat config/snapshot | AI unit 比较配置前后 root bytes |
| 规则型 debug 零 Browser service 入口 | debug 收入/分数/卡牌/solar/外星人揭示/强跳直接取得 working root | 物理删除 DOM caller、command facade 与 debug owner 方法 | 完整旧符号残留为零；Node/Chrome |
| 宿主失败不污染规则 | storage throw、download throw、timer/focus throw 导致规则提交或回滚 | service fail-closed，仅返回结构化失败 | failure unit + committed bytes/version 不变 |

规则状态、RNG、id、sequence、Decision、费用、CAS、journal 均不由本矩阵中的 service
拥有。唯一允许改变 committed state 的恢复路径是 `game-recovery` 对正式 Composition lifecycle
的显式调用；它不是 Browser service，也不通过通用 command registry。

## A. Browser Services 有限来源（10/10）

| 来源 | 旧耦合 | 唯一归属 | 旧入口 / 删除证据 | 行为证据 |
|---|---|---|---|---|
| local persistence read | `game-recovery` 直接取 `window.localStorage` | storage service `read` | `getPersistentGameStorage` 删除 | storage throw 零规则污染 |
| local persistence write | persistence controller 直接 `setItem` | storage service `write` | controller 不持有 Storage 对象 | 写入只接受可克隆 envelope |
| local persistence remove | 多 helper 直接 `removeItem` | storage service `remove` | direct storage helper 删除 | remove throw fail-closed |
| download Blob/URL | `createBrowserDownloadPort` | download service | `*Port.save` alias 删除 | click/remove/revoke 完整生命周期 |
| timeout schedule/cancel | recovery/AI/download/refresh 直接 window timer | timer service | 生产模块无直接 `window.setTimeout/clearTimeout` | scheduler/cancel/error isolation |
| animation frame | app/action/render/debug 直接 window RAF | timer service `requestFrame` | app 不裸绑定 RAF | 回调异常不触碰 rule root |
| focus | action/briefing 直接 DOM focus | focus service | module 不直接 `.focus()` | 缺元素/throw 返回失败 |
| scroll | hand/action/debug 直接 `scrollIntoView` | focus service | module 不直接 scroll DOM capability | 缺元素/throw 返回失败 |
| resize | debug UI 调用 resize | 明确 browser service callback | 不经 OwnerInput | ViewState intent 前后 root bytes 相同 |
| refresh subscription | service 接 StateStore/session subscribe | renderer/composition 装配观察者 | `subscribeRefresh` 从 service 删除 | renderer throw 不回滚 commit（既有 renderer 契约） |

## B. ViewState 有限来源（5/5）

| 来源 | 唯一状态 | intent / 恢复语义 | 删除证据 |
|---|---|---|---|
| browser status note | `status.note` | `status.set/status.clear`；随 ViewState envelope 恢复 | `browser_status` OwnerInput 与 root writer 删除 |
| overlay | `overlay` | 既有 `overlay.set/minimize/clear` | 不新增 overlay service/registry |
| focus | `focus` | 既有 `focus.set/clear`，DOM effect 由 focus service 执行 | 不写 committed root |
| debug panel/menu | `debug.panelOpen/playerMenuOpen` | `debug.panel/debug.playerMenu` | 纯 UI debug 不经 OwnerInput |
| visual calibration | `debug.sectorCalibration` | `debug.sectorCalibration` | 不写 `rocketState.statusNote` 或规则 data/solar |

## C. AI 席位/难度有限来源（6/6）

| 来源 | 唯一 owner | committed state | snapshot / generation |
|---|---|---|---|
| start screen difficulty | start-screen ViewState，作为正式 new-game lifecycle config | lifecycle 可据 config 建局；Browser 不事后直写 player | start-screen snapshot |
| configured machine seat ids | `aiAutoBattleState.playerIds` | 不写 player slice | AI control snapshot |
| default difficulty | `aiAutoBattleState.aiDifficulty` | 不写 player slice | AI control snapshot |
| per-seat difficulty | `aiAutoBattleState.seatDifficulties` | 不写 player slice | AI control snapshot v2 |
| Policy construction | `controller.getSeatDifficulty(seatId)` | 只读独立控制状态 | lifecycle/config 变化 invalidates driver |
| recovery | `restoreAiControlSnapshot` | 仅恢复独立控制状态 | invalid ids fail/default，不改 rules |

删除项：`createAiDifficultyCommandHandler`、`createAiOwnerInputPort`、`ai.setPlayerDifficulty`、
`setPlayerAiDifficulty` Composition command，以及以 player committed 字段作为 Browser Policy
配置来源的读取。

## D. Debug 完整来源分类（30/30）

### 保留为纯 UI / ViewState（6）

| 旧方法 | 新归属 |
|---|---|
| `setDebugOpen` | ViewState `debug.panel` + DOM render |
| `setDebugPlayerMenuOpen` | ViewState `debug.playerMenu` + DOM render |
| `renderDebugPlayerSwitch` | viewer-safe player projection renderer |
| `toggleSectorWinDebug` | ViewState visual calibration |
| `logAomomoDebugCoordinates` | 只读 projection/DOM diagnostic |
| `focusDebugCalibration`（及物种 alias） | focus service |

### 物理删除的规则 mutation（24）

`runDebugQuickSectorScan`、`openDebugQuickSectorScanPicker`、
`handleDebugQuickSectorScanChoice`、`selectDefaultRocketForCurrentPlayer`、
`switchCurrentPlayerColor`、`handleAiTakeoverFailsafe`、`handleForceSkipTurnFailsafe`、
`addDebugIncome`、`addDebugData`、`addDebugScore`、`addDebugCardByInput`、
`promptDebugGainCard`、`revealJiuzheForDebug`、`revealYichangdianForDebug`、
`revealFangzhouForDebug`、`revealBanrenmaForDebug`、`revealChongForDebug`、
`revealAmibaForDebug`、`revealAomomoForDebug`、`revealRunezuForDebug`、
`fillNebulaDataBoard`、`fillDebugNebulaData`、`setDebugAlienTraceModeActive`、
`toggleDebugAlienTraceMode` / `enableDebugAlienTraceModeForReveal`（同一 debug-direct 模式族）。

对应删除 DOM：玩家切换、+20 分、旋转、收入、获取卡牌、外星痕迹、八物种揭示与作弊。
`sector-win` 只保留视觉校准，不再写规则 status/data/solar。

## E. 延后边界（明确不由本单实现）

- SETI-168：main/quick/turn-control DOM 到完整 Standard Action descriptor。
- SETI-169：picker/confirm/cancel 到 active Decision identity。
- SETI-170：`RuleComposition.submitOwnerInput/executeOwnerInput`、全部
  `createBrowserInputPort`/字符串 target registry、undo/recovery 等最终兼容层。

本单只把上述 legacy registry 从 `browser-services.js` 的 service API 中移出并明确标记为
临时 OwnerInput 兼容实现；不得增加 alias、第二套 registry 或新 command bus。

## 验收证据

- `browser-services.js` 的 production API 只剩 storage/download/timer/focus；对
  `ruleLifecycle/stateStore/sessionPort/inputPort/debugCommand/registerTarget` 的残留为零。
- `game-recovery.js::createBrowserCheckpointAdapter` 是唯一 lifecycle + ViewState checkpoint
  组合点；storage service 只处理 opaque cloneable payload。
- `browser_status`、`debug_income`、AI difficulty OwnerInput 与所有规则型 debug/failsafe/
  cheat DOM caller 已物理删除；纯 UI debug 只 dispatch ViewState。
- AI seat difficulty snapshot 升级为 v2，Policy 从独立 `seatDifficulties` 读取；配置测试确认
  player committed object bytes 不变。
- storage/download/timer/focus/status/debug ViewState 的 failure/normal path unit 均比较
  `stateVersion + committed serialized bytes`，前后相等。
- `node --check randomizer/app.js` 通过；`node tools/run_node_tests.js` 为
  `75/75 unit + 1/1 full-flow`。
- Chrome：`save-recovery 1/1`（真实 reload、Composition lifecycle 与 ViewState 恢复）；
  `production-start-button 1/1`（传统脚本顺序与真实页面装配）。
