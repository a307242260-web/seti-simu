# SETI-170 Browser 根兼容层清除迁移矩阵

状态：设计冻结（2026-07-25；基线 `dev@7d0336f`）。

本单只删除 SETI-166～169 已硬切后剩余的 Browser 根 authority、字符串 owner registry、
规则 public bypass 与恢复旁路；不修改已经完成的 `randomizer/game/**` 领域规则。测试用于验证
本矩阵，不用于首次发现 owner、state、RNG 或 Decision 契约。

## 1. 有限来源与根契约

机械枚举范围固定为：

- `randomizer/game/rule-composition.js` 的 `executeOwnerInput`、
  `activeOwnerInputWorkingState`、`submitOwnerInput`；
- `randomizer/app/browser-host/legacy-owner-input-registry.js`；
- `randomizer/app.js` 中 `browserOwnerInputRegistry`、`browserOwnerInputs`、13 个显式
  OwnerInput port 和 `executeOwnerInput` 装配；
- `randomizer/app/**` 中所有 `createBrowserInputPort`、`registerTarget(...)` 与显式
  `registry.register(...)`；
- `randomizer/app/game-recovery.js` 的 root transient mutation/refresh host；
- `randomizer/app/browser-host/action-bar.js` 的旧 history undo/recovery；
- `randomizer/app/public-api.js` 与 `window.SetiRandomizer` 最终装配。

根契约如下：

1. Browser 对规则的唯一写端口是完整 Standard Action、完整 Standard Decision、
   Composition lifecycle；Effect Session undo 只接受当前 session identity。
2. Browser 只读面只来自 viewer-safe、深冻结 Projection/窄 DTO；Browser composition 的公开
   返回值不得含 canonical `stateSourcePort`、root、executor、candidate 或 selector。
3. ViewState、storage/download/timer/focus、AI control config 不进入 Composition transaction。
4. stale、late、wrong-owner、removed-choice、wrong-session/revision 都零副作用 fail-closed。
5. 恢复只调用 lifecycle `save/validateRestore/restore` envelope；规则恢复成功后的 UI 清理/
   refresh 只操作 ViewState、DOM 与宿主状态，不取得 working root。

## 2. 字符串 target registry 完整集合

以下 14 个 target、274 个方法是从各文件的 `BROWSER_INPUT_NAMES` / `INPUT_METHODS` 机械导出
的完整集合。每行整体删除 `createBrowserInputPort`、名字数组、app 装配与调用；规则意图已由
SETI-168/169 的正式输入替代，纯展示由 SETI-166 的 BrowserProjection/resident renderer
替代。不得按方法名重建 PresentationInputRegistry、StandardInputRegistry 或兼容 alias。

| owner | 方法数 | 语义分组 | 唯一目标 owner | 删除证据 |
|---|---:|---|---|---|
| `turn_end` | 7 | PASS/回合推进、揭示 continuation | `pass/end_turn` Action + residual Session | target/factory/app caller 为零 |
| `hand_flow` | 25 | 手牌/弃牌/支付/卡角 picker 与 mutation | `play_card/card_corner` Action + Decision renderer/ViewState | 同上 |
| `industry_runtime` | 36 | 公司能力、机会、奖励、历史 | residual domain Session | 同上 |
| `alien_runtime` | 21 | 揭示、痕迹、回合末结算 | residual domain Session | 同上 |
| `effect_executor` | 14 | 扫描/奖励/卡角/外星 effect executor | Production Effect domains | 同上 |
| `action_interaction` | 11 | Pluto、移动、数据 picker/mutation | probe/science Action + Decision/ViewState | 同上 |
| `scan_flow` | 23 | 扫描、补牌、扇区结算、picker | science domain Session | 同上 |
| `effect_choice` | 7 | 旧条件选择 resolver | active Standard Decision | 同上 |
| `card_trigger` | 19 | 任务/奖励/触发 continuation | card/residual Session | 同上 |
| `card_runtime` | 24 | 抽牌、选牌、PASS reserve、card move | card/probe Session + renderer/ViewState | 同上 |
| `alien_ui` | 19 | 痕迹/方舟 picker 与提交 | alien Decision renderer/ViewState | 同上 |
| `alien_species` | 37 | 八物种 dialog/choice/mutation | industry-alien Session + renderer | 同上 |
| `tech_runtime` | 16 | 科技 picker、take/commit/undo restore | science Session + renderer/ViewState | 同上 |
| `income_runtime` | 2 | 收入/回合初奖金 | residual/probe Session | 同上 |

完整方法名仍由基线 Git blob 可机械复核；矩阵按 owner 整体迁移，任何一个
`createBrowserInputPort`、`registerTarget` 或 `browserOwnerInputs.<owner>` 残留都判失败，
避免用人工抄写的第二份方法清单掩盖新增项。

## 3. 显式 owner 完整集合

| owner | 旧 command | 当前唯一 owner / 处理 | 事务、Decision、失败语义 | 物理删除 |
|---|---|---|---|---|
| `turn` | set order/randomize/begin round/advance/start game | 生命周期 `newGame`；回合推进属于 probe-turn domain | lifecycle 建新 committed state；无 Browser CAS | `createTurnOwnerInputPort` |
| `coordinate` | sync marker/seed reference rocket | resident renderer；新局实体来自 Production initial state | 只读 Projection；renderer throw 隔离 | `createCoordinateOwnerInputPort` |
| `action_recovery` | recover pending history | 不再恢复旧 pending；Composition lifecycle 恢复 envelope | 未知/旧 pending fail-closed | `createActionOwnerInputPorts` recovery |
| `final_score` | sync/mark tile | `choose_final_scoring` Decision | identity/stale/wrong-owner 由 Session 拒绝 | `createFinalScoreOwnerInputPort` |
| `land_target` | open/cancel | Decision renderer + ViewState | 无 root callback | interaction owner port |
| `data_interaction` | place/open picker | `place_data/analyze` Action + Decision renderer | descriptor/choice identity | interaction owner port |
| `solar` | rotate | Production deterministic effect | RNG/sequence/journal 属 Session | interaction owner port |
| `public_card` | toggle/confirm corner discard | `card_corner` Action/Decision | stateVersion/decisionVersion | `createPublicCardOwnerInputPort` |
| `quick_action` | pending compatibility check | Standard quick Action validation | incompatible pending 由 Composition 拒绝 | ActionBar owner port |
| `history` | undo pending | Effect Session `undo` input | sessionId/revision、barrier fail-closed | ActionBar owner port + Browser undo controller |
| `recovery` | clear transient/refresh root | lifecycle checkpoint + ViewState/DOM refresh | restore 预验证；View 恢复失败回滚 lifecycle bytes | recovery owner port/root host |
| `effect_flow` | execute/skip/cancel/finish/card move | Production Effect Session + Standard Decision | journal/cursor/barrier/CAS 属 Session | effect-flow owner port与旧 mutation |
| `sector_settlement` | resolve completed | science domain deterministic drain | session journal/commit | sector settlement owner port |

## 3.1 监督反例后的 caller 闭合补充

2026-07-25 的监督反例证明：删除 registry 后保留返回空成功、`canceled` 或固定失败的
`turnInputPort` / `coordinateInputPort` / `finalScoreInputPort` / `landTargetInputPort`，
以及统一 `removedBrowserMutation`，仍然是兼容 alias；它们会让旧 DOM/host 调用继续可达，
却没有连接正式 descriptor。矩阵因此退回设计冻结，并补齐如下 caller 映射。以下临时符号及
其调用者必须一起删除，不能仅改名或继续返回 no-op：

| 临时入口 | 完整 caller | 正式 owner / 保留行为 | 删除方式与反例 |
|---|---|---|---|
| `turnInputPort.startNewGame` | `createTurnHostRuntime.startNewGameFromHost` | `lifecycle.newGame` 后只做 Browser AI/ViewState 准备，再提交正式 initial-setup Action | 删除第二次 `startNewGame` port；若 lifecycle 成功后仍需空成功才能继续，即反例成立 |
| `turnInputPort.setPlayerOrder/randomizePlayerOrder/beginNextRound/advanceAfterAction/randomizeAll` | `createTurnHostRuntime` 的五个 legacy host 方法、debug spin、AI 旧 reset/context | Production initial state 与 probe-turn Session | 从 Browser host facade、events 与 AI host context 删除；不得用固定失败占位 |
| `coordinateInputPort.syncPlanetMarkers/seedReferenceRockets` | `createCoordinatePort`、recovery/history/render/action/effect context 与旧 turn setup | resident renderer；Production initial state 创建实体 | 删除写 port；展示刷新显式调用 resident render，规则初始化只由 lifecycle；不得空成功 |
| `finalScoreInputPort.syncPendingMarks/markTile` | `createFinalUiPort`、旧 conditional composition 与 events context | `choose_final_scoring` Decision；最终盘面只读 renderer | production 内部保留显式 working-root primitive；Browser 无 root 调用与旧 tile listener |
| `landTargetInputPort.open/cancel` | `createLandTargetPicker.request/cancel`、旧 action/effect context | active Standard Decision renderer + ViewState | 删除 Browser request/cancel rule port 与旧 overlay input；内部 domain 仅保留显式 working-root primitive |
| `quickActionCompatibilityPort.checkPending` | `createActionGuardRuntime.blockIncompatiblePendingQuickAction` | Standard Action validate/submit | 删除 Browser preflight 与旧 quick pending cancel；按钮只提交投影中的完整 descriptor |
| `openComputerPicker/rotate/placeDataToBlueSlot` 固定失败 | render/effect legacy callback | `place_data/analyze` Action/Decision；Session deterministic effect | 删除无 working-root Browser callback；内部正式 domain primitive仍要求显式 working root |
| `beginCardMoveEffect/releaseFutureSpanAfterPlayWithHistory` 固定失败 | hand/card legacy UI continuation | card/probe Effect Session | 删除 Browser callback；production session 内部显式 working-root primitive不经 facade |
| `cancelActivePendingSubFlows/cancelActiveEffectSubFlows/skipCurrentActionEffect/finishActionEffectFlow/handleActionEffectButtonClick` 固定失败 |旧 effect bar、events 与历史 runtime | active Decision / Effect Session `advance/abort/undo` | 删除旧 DOM listeners、无 root wrapper 与 Browser effect-flow facade；不得以手工按钮解除 |
| `recoverPendingActionFromOpenHistoryForAi` 固定失败 |旧 AI/action recovery context | lifecycle restore 当前 schema | 删除 caller 与函数；AI 只观察 Composition projection，不恢复旧 pending |

同时复核删除 registry 后新增的直接 `helpers/runtime` 转发：只有被 Production domain 的
`createActionContext`、Effect Session executor 或显式 working-root primitive调用的项可保留；
凡被 DOM event、Browser service、public facade、无 working-root host wrapper 或旧
pending/history controller 调用的项都按上表物理删除。此区分以调用方向而非函数名判断：

```text
允许：Composition Session -> explicit workingRoot primitive
禁止：DOM / Browser service / public facade -> helper/runtime mutation
```

监督要求的最终结构扫描额外包含
`removedBrowserMutation|turnInputPort|coordinateInputPort|finalScoreInputPort|landTargetInputPort`
并全部为零；空 `{ok:true}` / `{canceled:true}` 不能作为任何迁移项的行为证据。

## 3.2 Chrome 反例后的 lifecycle 新局矩阵

真实 Chrome 在删掉 `turnInputPort.startNewGame` 后给出反例：初始选择可以完成，但
`controls.actions` 为空。原因是旧 `startNewGame -> randomizeAll -> initializeCardGame`
曾在 lifecycle commit 之外补齐新局 state；仅调用 `lifecycle.newGame` 会漏掉棋盘、牌区和
轮序初始化。因此再次退回设计冻结。新局完整有限集合如下，唯一 production owner 是
Composition lifecycle 调用的 Browser state adapter `createWorkingState`；它只组合现有
game primitive，不新增 Browser command/public port，也不修改已完成 game domain 规则。

| 新局语义项 | 正式 primitive / committed state | RNG、id、sequence | Decision / 事务与删除证据 |
|---|---|---|---|
| sequence reset | `sequenceOwners.*.restore*` | lifecycle 开始统一归 1 | 仅 state adapter 内可达；旧 reset controller 删除 |
| session root | `initialGameState.createSessionState` | `seed` 与 lifecycle RNG 写 `meta.rngState.lifecycle` | 一次 `lifecycle.newGame` 安装 store |
| 席位与轮序 | `players` + `turnState` 固定字段 | 默认人类颜色第一，其余按 lifecycle RNG 稳定 shuffle | 无 Browser `setPlayerOrder/randomizePlayerOrder` |
| round/turn counters | `turnState` round/turn/actionCycle/pass/completed/visit 字段 | 无额外随机 | committed candidate 一次提交 |
| 太阳系轮盘 | `solar.normalizeRotationState` | 四次 lifecycle RNG；offset 使用冻结常量 | 无 spin/debug mutation |
| 扇区排列 | `solarState.sectorBySlot` | Fisher-Yates lifecycle RNG | renderer 只读 |
| 星云数据 | `data.clearNebulaData/fillAllNebulaData`，显式传 lifecycle root | token id 由 `meta.sequences.nebulaToken` 分配并进入 committed metadata | 不经 sector-settlement Browser port；同 seed 不依赖模块全局 sequence |
| 终局板 | `finalScoring.randomizeTileVariants` | lifecycle RNG；final mark sequence 由 owner | tile 点击仍只走 Decision |
| 外星池 | `aliens.randomizeAlienAssignments` + lifecycle `alienPoolIds` | 初始只重置 reveal pool/slot，不提前揭示 | reveal Decision/Effect Session 不变 |
| 科技奖励 | `tech.setupBoardBonuses` | lifecycle RNG | renderer 只读 |
| 玩家牌区清空 | `cards`/player 正式 state 字段 | hand/card sequence owner | 与新 root 同一 lifecycle transaction |
| 初始手牌 | `cards.drawCardsToHand` + `createCommittedCardInstance` | lifecycle RNG、card entity sequence 写 metadata | 不经 Browser card runtime |
| 公共牌 | `cards.ensurePublicCardsFilled` | 同一 RNG/entity owner | 不经 render-time 补牌 |
| PASS 预留牌 | `cards.preparePassReservePiles` | 同一 RNG/entity owner | Production turn/session 后续消费 |
| initial setup | 仍由 `choose_card` Standard Action/Decision source 启动和结算 | offer/settlement 使用 seed 派生 RNG；抽牌/补牌统一调用 `createCommittedCardInstance` | stale/wrong-owner 由正式输入拒绝；不得回退模块全局 card id |
| Browser 收尾 | lifecycle 成功后 AI config、ViewState status、storage schedule | 不写 committed root | 不得恢复第二次 turn/root mutation |

最小反例与证据：

- 同 seed 两次 `lifecycle.newGame` 后，轮序、轮盘、扇区、初始手牌/公共牌 identity 必须一致。
- 完成 initial setup 后，当前人类至少存在一个合法 main Action，Chrome descriptor 链可提交
  quick Action、main Action、后续 Decision、end_turn 和 save/restore。
- lifecycle initializer 或任一 primitive 抛错时，`newGame` 返回失败，旧 committed bytes 与
  Browser ViewState 不得被兼容 port 补写。

## 4. Public facade 与 Browser Composition allowlist

`window.SetiRandomizer` 顶层键唯一允许：

`schemaVersion / inspect / capture / restore / input`

`input` 唯一允许：

`dispatchAction / submitDecision`

`inspect()` 只返回 viewer-safe projection 与 input 提交审计，不返回 root、executor、
candidate、selector、registry 或 lifecycle 对象。`capture/restore` 只转发 Browser checkpoint
adapter 的 lifecycle envelope。Browser composition 的 app-facing facade 只允许：

- `inspect/projection/subscribe/dispose`
- `inputPort` 中 Standard Action、Decision、drain/undo 所需固定方法
- `lifecycle`
- `counterfactualPort`（仅内部机器席位评估）
- Production capability identity 与 `projectionSource`

canonical `stateSourcePort` 不得出现在 Browser facade。

## 5. Proof obligations

| 义务 | 最小反例 | 唯一实现落点 | 证据 |
|---|---|---|---|
| OwnerInput 根 authority 为零 | Browser command 任意写 committed root | RuleComposition 删除 owner executor/state/input | 构造/行为 unit + 生产调用图 |
| 字符串 registry 为零 | 新增 target/method 后自动获得 root | 删除 registry 文件、HTML/dependency/app 接线 | `registerTarget/createBrowserInputPort` 生产命中为零 |
| undo 归 Session | 旧 history closure 回滚 committed root或越过 barrier | Composition 固定 `undo` port + session identity | stale/wrong-session/barrier unit |
| recovery 只走 lifecycle | root transient callback 修改 committed slice | checkpoint adapter + ViewState/DOM host callback | restore spy、旧/损坏 schema、rollback unit + Chrome |
| Browser facade 无 canonical source | caller 读取 `stateSourcePort` 或 executor | Browser composition 显式 allowlist | facade key unit |
| public facade 无规则 bypass | helper/family/selector 直接执行 | public-api allowlist | public API unit +真实 DOM smoke |
| renderer/service 隔离 | renderer/storage throw 改规则 version/bytes | projection/render/service ports | poison unit + Chrome |
| stale/owner fail-closed | 旧 Action/Decision/undo identity 被接受 | Human adapter/Composition Session | state/journal/cursor 不变断言 |

## 6. 集中验收

1. 定向：RuleComposition、Browser composition facade、public API、recovery、Action Bar、
   Human Action/Decision、renderer/service poison tests。
2. 结构：上述 27 owner、registry、OwnerInput metadata、root recovery/undo/effect-flow/
   sector-settlement mutation 的生产调用图为零。
3. `node --check randomizer/app.js` 与 `node tools/run_node_tests.js` 一次。
4. `node tools/run_browser_smokes.js --match production-browser-full-parity` 一次，覆盖真实 DOM
   Action/Decision、保存恢复、完整 renderer 与异常隔离。
5. `git diff --check`；仅提交本矩阵和本单相关生产/测试/文档，推送 `dev`。
