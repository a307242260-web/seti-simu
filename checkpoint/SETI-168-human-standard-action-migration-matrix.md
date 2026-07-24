# SETI-168 Browser 人类 Standard Action 输入迁移矩阵

状态：已实现并验收（2026-07-25；设计冻结基线 `dev@f1f9378`，矩阵提交 `3bf1444`）。

## 范围与有限来源

本单只迁移人类顶层 Standard Action 输入，不迁移 SETI-169 的 active Decision picker，也不提前
删除 SETI-170 负责的 Composition OwnerInput / recovery 根兼容层。15 个 family 的有限集合直接
来自 `randomizer/game/production-kernel.js::SIMULATION_FAMILY_CONTRACTS` 中非 conditional 的
Browser 人类行动：

`launch`、`orbit`、`land`、`scan`、`analyze`、`research_tech`、`play_card`、`pass`、
`move`、`quick_trade`、`industry`、`card_corner`、`place_data`、
`runezu_face_symbol`、`end_turn`。

来源调用面由以下有限目录逐文件枚举：

- `randomizer/app/events.js` 的主行动栏、回合控制、快捷交易、手牌、科技、数据、移动箭头、
  公司和符文族 DOM listener；
- `randomizer/app/browser-host/action-bar.js` 的 Desktop Action Bar controller；
- `randomizer/app/browser-host/input-adapter.js` 的 Browser rule-input resolver；
- `randomizer/app/action-interaction-runtime.js` 的探测器、分析和放置数据 UI flow；
- `randomizer/app/hand-flow.js` 的打牌 / 卡角 UI flow；
- `randomizer/app/tech-runtime.js`、`industry-runtime.js`、
  `aliens/species-runtime.js` 的对应人类入口；
- `randomizer/app.js` 中上述 port 的唯一装配与 `public-api.js` 的标准 input facade。

`randomizer/game/**` 已由 SETI-158～160/163 建立完整 Production provider / executor，本单不得
修改它们来迁就 Browser。

## 根契约与反例

| 义务 | 可证伪命题 / 最小反例 | 唯一 production 落点 | 证据 |
|---|---|---|---|
| 当前 legal set 完整 descriptor | DOM 保存旧 `actionId` 后 stateVersion 改变；Browser 不得把旧 descriptor 交给 Composition | Browser Human Action adapter 每次提交前重读 legal set，按 `actionId` 找到当前 descriptor，并逐字段确认传入副本相等 | stale / removed / modified descriptor unit，底层 dispatch 计数为 0 |
| wrong actor 零提交 | viewer 切席位或 Decision owner 改变后点击旧 DOM；不得提交旧 actor descriptor | 同一 adapter 校验 `actorId/stateVersion/decisionVersion` 与当前 legal descriptor identity | wrong-actor unit + dispatch spy |
| 唯一 Browser action input | 任一 DOM handler 直接调用 `submitAction`、`submitQuickAction`、runtime executor 或字符串 target registry | `createHumanActionInputAdapter` 唯一调用 `residentInputAdapter.dispatchAction` | production caller 结构审计；15 family 行为测试 |
| 无模糊 resolver | family/label/target 部分 selector 匹配多个 action，或空 selector 偷选第一项 | DOM/render flow 保存完整 descriptor；提交只接受完整 descriptor，不接受 family、label、selector | `standard_intent`、`standard_resolve`、`activateFamily`、`matchesSelector` Browser 生产残留为 0 |
| 无 Browser 规则 mutation | 点击前 Browser 预扣资源、移动实体、写 pending/effect，Composition 拒绝后状态仍改变 | adapter 只 clone/validate/dispatch；费用、实体、pending、journal、CAS 全由 Production domain | reject path committed bytes/version 相等；正式 composition 行为测试 |
| public API 无旁路 | public API 通过 family/selector 或 runtime helper 执行规则 | public API 只接受完整 Action descriptor并进入同一 Human adapter | API allowlist 与 stale descriptor test |

Standard Action 的 committed state、费用、RNG、实体 id、sequence、Decision、Effect journal、
不可逆屏障和 CAS 全部归 SETI-158～160/163 已完成的 Production Composition/domain。Browser
只持有 viewer-safe projection 中的冻结 descriptor 副本；不会构造或补字段。

## 15 family 完整迁移矩阵

| family | 真实 DOM caller / 旧 facade | 正式 descriptor 来源与 identity | 唯一 Production owner / 事务语义 | 删除符号与结构门禁 | 行为证据 |
|---|---|---|---|---|---|
| `launch` | `#action-launch-button` → `routeMainActionButtonClick` → `activateFamily` / `launchRocketForCurrentPlayer` | Action Bar projection `controls.actions` 中完整 `launch` descriptor；DOM 绑定其 `actionId` | probe-turn domain；费用、火箭 id/sequence、发射与 journal 同一提交 | 该 DOM 不再调用 family helper；无 `standard_intent` | 真实 click 提交逐字段相同 descriptor |
| `orbit` | `#action-orbit-button` → `orbitForCurrentPlayer`；land-target picker confirm | 当前 legal `orbit` descriptor；picker choice 保存完整 descriptor（rocketId+planetId 仅展示） | probe-turn domain；费用、火箭迁移、marker sequence、奖励 Decision/CAS | picker 不调用 `submitAction`；不按 rocket/planet selector 重解 | 多目标各 actionId、stale picker 零提交 |
| `land` | `#action-land-button` → `landForCurrentPlayer`；land-target picker confirm | 当前 legal `land` descriptor；完整 target 含 rocket/planet/type/satellite | probe-turn domain；费用、火箭迁移、marker/奖励/不可逆边界 | 同 `orbit`；删除 Browser target resolver | planet/satellite 两类 descriptor 与 stale |
| `scan` | `#action-scan-button` → `activateFamily` / `action-runtime::beginScanAction` | Action Bar projection 当前完整 `scan` descriptor | science domain；扫描费用、目标 Decision、数据与 Effect journal | 删除 `beginScanAction` 的 `standard_intent` 路径 | DOM click 只 dispatch 当前 descriptor |
| `analyze` | `#action-analyze-button` → `activateFamily` / `analyzeDataForCurrentPlayer` | Action Bar projection 当前完整 `analyze` descriptor | science domain；数据轨/费用/奖励 Effect 原子提交 | 删除 `{kind:"computer"}` selector facade | 成功与 removed descriptor |
| `research_tech` | `#action-research-tech-button`、`.tech-tile`、蓝槽确认 → `researchTechForCurrentPlayer` / `selectResearchTechTileForCurrentFlow` | Action Bar / tech presentation 保存当前完整 descriptor；identity 由 actionId，不由 tile label | science domain；费用、tile 实体、blue slot Decision、Effect journal | 删除 `dispatchStandardIntent("research_tech", selector)`；DOM 不直调 executor | 主按钮、tile/blue-slot 代表路径；stale tile |
| `play_card` | `#action-play-card-button`、手牌按钮、`#play-card-action-button` → hand-flow confirm | 手牌 presentation 保存当前 `play_card` descriptor；确认提交完整 descriptor（含 cardInstanceId/cost/handIndex） | card play domain；费用、卡牌实体迁移、sequence、Effect Session、不可逆边界 | 删除 cardId selector resolve 和 Browser 预放牌/预扣资源 | 两张同 label 不串牌；费用漂移 stale 零提交 |
| `pass` | `#action-pass-button` → `activateFamily("pass")` / `turn-end-flow::passForCurrentPlayer` | Action Bar projection 当前唯一完整 `pass` descriptor | probe-turn domain；PASS、reserve continuation、journal | 删除 family dispatch 与 turn-end StandardIntent facade | DOM click + stale/wrong actor |
| `move` | `[data-move-x/y]` → `moveRocket` | 移动箭头 presentation 保存当前完整 `move` descriptor；方向/rocket 只用于渲染 | probe-turn domain；移动、支付 continuation、费用、火箭坐标、journal | 删除按 delta/rocket `.find` 后直接 `submitQuickAction` | 同火箭四方向、切火箭 stale |
| `quick_trade` | `[data-quick-trade]` → `activateFamily(...tradeId)` / `createQuickTradeFlow` | quick panel render 绑定当前完整 descriptor/actionId | quick-trade Production provider；资源、弃牌/抽牌 continuation、history | 删除 trade selector与 `createQuickTradeFlow` family executor | 每 trade descriptor；资源变化后旧按钮零提交 |
| `industry` | company action marker → `handleCompanyActionMarkerClick` / `startIndustryAbilityFlow` | 公司 presentation 保存当前完整 `industry` descriptor（companyId+abilityId） | residual company domain；mark、Effect queue、journal/CAS | 删除 `dispatchIndustry(selector)` 和 companyId 模糊 resolver | 多公司/失效 mark/wrong actor |
| `card_corner` | 手牌角标按钮、确认按钮 → `handleHandCardCornerQuickAction` / `confirmCardCornerQuickAction` | hand presentation / pending UI 保存当前完整 descriptor（cardInstanceId+corner） | residual card-corner domain；弃牌、收益、Effect、不可逆边界 | 删除 Browser `executeStandardCardCornerAction` executor与 card selector | 同 label 不串实体；stale hand |
| `place_data` | `.data-token-pool` → `runPlaceDataToComputer` | player-board presentation 绑定当前完整 `place_data` descriptor | residual data domain；数据 token、computer slot/Decision、journal | 删除 `{kind:"place-data"}` StandardIntent facade与 Browser open-as-execute | DOM click descriptor + 满槽失效 |
| `runezu_face_symbol` | `[data-runezu-face-symbol-slot]` → `openRunezuFaceSymbolPlacement` | alien presentation 保存当前完整 descriptor（slot/position/symbol identity） | residual alien domain；符号实体、奖励 Decision、journal | 删除字符串 species target / Browser executor | 两槽、符号变化 stale、wrong actor |
| `end_turn` | `#action-confirm-button` → `activateFamily("end_turn")` / `turn-end-flow::endCurrentTurn` | Action Bar projection 当前完整 `end_turn` descriptor | probe-turn domain；turn/round owner、收入/reveal/terminal Decision、journal | 删除 family dispatch 与 turn-end StandardIntent facade | DOM click、pending 时 removed、late click 零提交 |

## 批量实现顺序

1. Browser Host 根 adapter：只接受完整 descriptor；重读当前 legal set，schema/actionId/actor/
   stateVersion/decisionVersion/完整 bytes 任一不一致即 fail-closed；唯一调用
   `residentInputAdapter.dispatchAction`。
2. Action Bar / DOM presentation：固定按钮、quick panel、移动箭头、手牌、科技、公司、数据与符文
   交互均绑定当前 descriptor/actionId；多目标 picker 保存完整 descriptor。
3. 删除来源：`standard_intent` / `standard_resolve` / `createStandardIntentPort`、
   Desktop `activateFamily/matchesSelector`、quick-trade family executor、15 family 的字符串 target
   dispatch 与 Browser 预扣/续跑路径；public API 只接同一 adapter。
4. 集中验证：结构残留归零 → adapter/15 family 定向行为 → `node --check randomizer/app.js`
   → `node tools/run_node_tests.js` → 真实 Chrome 主行动、快速行动、回合控制各一次。

## 完成门禁

- 15/15 行的 DOM caller 最终提交对象均来自提交瞬间 current legal set，且完整 descriptor bytes
  与该集合成员一致。
- stale、wrong actor、removed action、descriptor 任意字段篡改均在 Browser boundary 拒绝，底层
  dispatch 次数为 0。
- Browser 生产代码中用于这 15 family 的 family/label/partial-target resolver、字符串 target
  registry、helper executor、预扣资源或 continuation effect 为 0。
- `window.SetiRandomizer.input.dispatchAction` 复用唯一 Human adapter，不提供 family/selector API。
- 不修改 `randomizer/game/**` provider/executor；Production Composition 的 committed state、
  Effect journal、Decision 与恢复行为保持既有契约。

## 验收证据

- `createHumanActionInputAdapter` 是人类 Action 唯一 Browser boundary：提交前重读 current legal
  set，对 schema/actionId/actor/stateVersion/decisionVersion/target/payload/decision/summary
  完整重验；removed、wrong actor、stale、篡改均不调用底层 dispatch。
- BrowserProjection 与 Action Bar 保留完整 Standard Action 的 `decision` 字段，不再把残缺 DTO
  伪装为可提交 descriptor；固定按钮、quick trade 和符文族 picker 绑定当前 actionId，多目标
  orbit/land picker 保存完整 descriptor。
- 15 family 的 unit 逐项通过同一 adapter；tampered/stale/wrong actor/removed dispatch spy 为 0。
- 结构审计：Browser 生产代码中的 `standard_intent`、`standard_resolve`、
  `createStandardIntentPort`、`createRuleInputDispatcher`、`activateFamily`、
  `matchesSelector`、`createQuickTradeFlow` 残留均为 0。
- `node --check randomizer/app.js` 通过；`node tools/run_node_tests.js` 为
  `75/75 unit + 1/1 full-flow`。
- 真实 Chrome `production-browser-full-parity 1/1`：真实 index.html 依次通过 DOM
  `quick_trade → launch → end_turn`，三次输入的 `lastResult.kind` 均为 `action`，同时继续覆盖
  viewer 隐私、完整 renderer、初始多步 Decision、保存恢复和 renderer 异常隔离。
