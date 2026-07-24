# SETI-164 最终架构收口矩阵

状态：纠偏后重新冻结（2026-07-24）。本文件把 SETI-158/159/160/163 的领域矩阵合并为最终组合义务；以当前 `HEAD=0b2ff69` 的完整 `randomizer/app/**`、`randomizer/game/**`、`randomizer/training/**` 和 HTML 脚本清单机械复核。旧 run 删除 Browser UI runtime、让 Browser 读取 canonical state、复用 Simulation projection 的方案已明确废弃。测试用于验证本矩阵，不用于首次发现 owner、state、RNG、visibility 或 Decision 契约。

## 根契约与有限集合

- Standard Action 的有限全集只来自 `game/actions/standard-action.js::ALL_FAMILIES`，共 22 项。Production Domain Pack 必须对全集逐项登记唯一 provider、executor 与 Effect domain，Browser/Simulation 不得补 family、executor 或 choices。
- Effect domain 的有限全集只来自 `game/production-composition.js::effectDomains`：`standard_action`、`card_play`、`science`、`probe_turn`、`residual`。重复 owner 构造期失败；未知 family/domain/effect/Decision fail-closed。
- Production Kernel 只共享 Production domains、registry、Effect Session、state commit 与 replay 协议；不得把任一 Host 的 projection 当成公共规则状态。Kernel 构造时必须显式接收 Browser/Simulation 各自的 state adapter、projection adapter 与 host services，重复规则 owner 在构造期失败。
- committed root 只由 Composition StateStore/Effect Session CAS 修改。Browser composition 对外不得暴露 `stateSourcePort`、working root 或 committed root，只可消费经 Browser visibility policy 处理、带 viewer identity、深冻结的 `BrowserProjection`/resident read models，提交 Standard Action/Decision、保存/恢复 envelope、渲染和隔离渲染异常。Simulation projection/state adapter 只服务 Policy、批跑、checkpoint/replay 与报告，不能被 Browser 复用。
- RNG、实体 id、effect sequence、stateVersion、decisionVersion 与 journal cursor 都属于 committed/replay 协议。stale、late、wrong-owner、removed-choice 必须零副作用；非等价选择必须停在正式 Decision。
- 子项验收 commit 为 `fd6f7a2`（composition）、`56a678a`（card）、`084bada`（science）、`02f34c9`（probe/turn）、`16933d6`（residual）。最终审计只复用这些提交后未变化的领域内部证明；对跨域组合、最终残留、Host parity、terminal/recovery 和 Chrome 重新验收。

## Standard Action / Decision 完备矩阵

| family | phase | 唯一 provider/executor/domain | committed state / 确定性 | Decision 与事务边界 | Browser/Simulation 删除义务 | 组合证据 |
|---|---|---|---|---|---|---|
| quick_trade | quick | production pack quick trade / `standard_action` | P,C,M；state/decision version | exact trade，单 CAS；弃牌/选牌进入 Decision | Browser quick executor、Simulation trade provider 为零 | 双 Host descriptor/result/journal/commit |
| play_card | main | `card_play` | P,C,A,R,S,N,Tech,M；card/effect sequence、RNG | 支付、实体迁移与 followup 同 session；多选外显 | hand-flow 规则执行、public API play bypass 为零 | 182 张牌与 recursive effect capability |
| scan | main | `science` | P,C,R,S,N,M；RNG/sector sequence | target/reward/data choice 外显 | scan-flow executor、Simulation scan provider 为零 | 全 sector/target parity |
| place_data | quick | `science` | P,N,M；token id/sequence | slot/analysis followup 同 session | Browser data mutation 为零 | 全合法 slot fork |
| analyze | main | `science` | P,N,M | computer/score 单 CAS | Browser analyze executor 为零 | 费用、得分、pool parity |
| research_tech | main | `science` | P,C,Tech,M；tile/bonus sequence | tile/slot/bonus Decision | tech-runtime rule branch 为零 | 颜色/slot/bonus parity |
| launch | main | `probe_turn` | P,R,S,M；rocket id | payment/target 同 session | Browser/Simulation launch executor 为零 | 全费用与 target |
| move | quick | `probe_turn` | P,C,R,S,M | rocket×direction×payment 全枚举 | Browser move legality/executor 为零 | 全实体/方向 fork |
| orbit | main | `probe_turn` | P,R,S,planet,M | target/cost/reward | Browser planet executor 为零 | 全目标/折扣/奖励 |
| land | main | `probe_turn` | P,R,S,planet,M | planet/satellite/cost/reward | Browser planet executor 为零 | 全目标/折扣/奖励 |
| pass | main | `probe_turn` | P,C,T,S,M；turn sequence/RNG | reserve/income handoff 后才 commit | Browser pass rule、Simulation provider 为零 | rotation/income/handoff |
| end_turn | turn_control | `probe_turn` | P,T,S,M | deterministic sequencing；跨域 handoff | turn-flow rule mutation 为零 | round/terminal sequence |
| industry | quick | `residual` | P,C,A,R,S,N,Tech,M | 公司机会/选择；不消耗主行动 | industry-runtime rule mutation 为零 | 11 正式公司 |
| card_corner | quick | `residual` | P,C,M | exact card/corner | Browser corner executor 为零 | legal card/expense |
| runezu_face_symbol | quick | `residual` | P,A,N,Tech,M | symbol/branch/claim-once | species runtime mutation 为零 | all symbol choices |
| choose_card | conditional | opening=`initial_setup`，其余 session Decision | P,C,M；card id/RNG | owner/version/choice 全重验 | Browser choice builder 为零 | opening + domain Decisions |
| choose_target | conditional | active Effect Session Decision | domain state + M | 独立 timestep | conditional builder/executor 为零 | 每 kind 全 legal fork |
| choose_payment | conditional | opening=`initial_setup`，其余 session Decision | P,C,M | exact cost；独立 timestep | Browser payment builder 为零 | opening + move/card cost |
| choose_reward | conditional | active Effect Session Decision | domain state + M | reward exact choice | Browser reward resolver 为零 | all reward variants |
| choose_branch | conditional | active Effect Session Decision | domain state + M | branch exact choice | Browser branch resolver 为零 | all branch kinds |
| choose_final_scoring | conditional | `residual/final_scoring` Decision | P,F,M；mark id | threshold/slot/owner CAS | final UI mutation/provider 为零 | a/b/c/d × slots |
| accept_optional_effect | conditional | active Effect Session Decision | domain state + M | accept/skip 均 journal | Browser optional resolver 为零 | both choices/replay |

缩写：P/C/A/R/S/N/Tech/T/F/M 分别为 player/card/alien/rocket/solar/data/tech/turn/final/match。

## Host 与恢复矩阵

| 关系/边界 | 必须成立 | 最小反例 | 证据 |
|---|---|---|---|
| Browser vs Simulation capability | 同 22 family、5 domain、owner/executor identity；projection/state adapter 与 host services 身份必须不同 | 任一 Host 多/少 family、注入 executor，或两 Host 共用 projection | 自动 capability matrix + adapter identity 断言 |
| same canonical checkpoint / every legal action | Kernel 内部从同一 canonical checkpoint 比较 descriptor identity、费用、目标、执行结果、journal、next Decision、committed state；Browser 侧只能看到 viewer-safe projection | Browser 为做 parity 取得 root，或同 checkpoint 某 action只在一侧可执行 | Kernel counterfactual fork 逐 action + Browser facade 泄漏负向测试 |
| fresh A/A | state、legal、RNG、id、cursor 相等 | 未纳入 seed 的随机源 | reset parity |
| same instance A/A 与 A/B/A | reset 清空模块闭包/cache/pending | B 污染第二次 A | 常驻 env reset matrix |
| non-zero checkpoint fork | 至少一个真实 policy action 后 state/legal/RNG/journal cursor 相等 | 仅 opening checkpoint 通过 | checkpoint/replay test |
| crash/timeout recovery | 只重放确认 action；失败 action 不入 journal | stale worker response 被提交 | worker recovery test |
| terminal full game | 正式建局运行到 `game_end`，每玩家有 finalScore/scoreSources | max-step/recover/score fallback 假终局 | 多 seed terminal contract |
| real Chrome index.html | 隐藏 deck/他人手牌不可见；太阳系/火箭、玩家/资源/手牌、公共牌、科技、扫描/数据、外星人、终局计分均由真实 projection renderer 呈现；人类主行动与多步 Decision 走正式 input adapter；保存恢复；renderer 异常不破坏规则 authority | 极简壳/空 renderer、UI callback 直写、root 泄漏或 renderer throw 中断 commit | 真实 `randomizer/index.html` Chrome 验收 |

## 旧路径物理删除矩阵

以下是从当前 HTML、`app/dependencies.js`、`app.js` production 装配与源码 mutation 扫描机械导出的有限删除集合；不能以“新 owner 已存在”或“当前未命中”替代物理删除。

1. `app/browser-rule-composition.js` 只安装 Browser 专属 state/projection adapter 与 host services，并从 game Production Kernel 取得 Composition；公开返回值不得含 `stateSourcePort`。`app.js` 只持有 `projectionSource` 与窄 read-model/input/lifecycle ports。
2. `app/conditional-decision-domain.js`、`conditional-action-executor.js`、`effects/**`、`scan-flow.js`、`tech-runtime.js`、`industry-runtime.js`、`income-runtime.js`、`card-trigger-runtime.js`、`turn-end-flow.js`、`hand-flow.js`、`alien-runtime.js`、`alien-trace-reward-flow.js`、`alien-ui.js`、`aliens/species-runtime.js` 不得整文件删除：保留真实 projection renderer、DOM picker、Standard Action/Decision input adapter；逐函数删除 committed state mutation、legal/choice builder、effect executor、history/continuation/pending owner。
3. `app/action-runtime.js`、`action-interaction-runtime.js`、`effect-flow.js`、`effect-choice-flow.js`、`score-source-runtime.js` 同样保留输入/展示/只读投影；旧 action/effect/session rule continuation 物理删除。删除证据按禁用符号/可达 owner，而不是“文件不存在”。
4. `app/render-runtime.js`、`browser-host/resident-renderer.js`、`final-ui-runtime.js`、`start-screen.js` 与真实 DOM 结构是功能 parity 的正式资产；不得以通用 choice renderer、空 renderer 或只显示回合/按钮的壳替代。
5. `app/public-api.js` 只允许 viewer-safe inspect/save/restore 与标准输入端口；不得暴露 `stateSourcePort`、working/committed root 或直接规则 executor。
6. `training/simulation-rule-composition.js` 只安装 Simulation 专属 state/projection adapter 与 host services；不得枚举/执行 family、构造 Decision、skip unsupported 或 fallback score。
7. 静态禁止生产路径中的 `unavailable/unsupported/generic pending/no_legal_choice` 兼容分支、host family executor map、Browser rule callbacks、Simulation private provider。未知输入必须由 game Composition 返回结构化 fail-closed。

### Browser public API 全导出审计（冻结）

`HEAD=d73adb7` 的 `public-api.js` 返回对象已逐项审计，收口后的顶层键只允许
`schemaVersion / inspect / capture / restore / input`；`input` 只允许
`dispatchAction / submitDecision`，且二者只接收完整 Standard descriptor/submission。

| 旧导出组 | 审计结论 | 删除/保留证据 |
|---|---|---|
| `getBrowserProjection/getState/getAiDebugState/getPlayerState/getTurnState/getCardState/getSolarSnapshot/getRocketCoordinates/getPlanetStatsState/getTechSnapshot/getAlienState/getFinalScoringState/getCurrentPlayer` | 分散 inspect 会扩大、漂移 viewer schema | 删除，统一为深冻结 `inspect().projection` |
| `browserServices`、action log/recovery/download API | 整体 services facade 含 debug/download 等超额能力 | 删除对象透传，只保留 `capture/restore` |
| `startNewGame/startInitialSelection/selectInitialSelectionCard/confirmInitialSelection` 与 initial offer/state | setup 规则入口只能由真实 DOM 经正式 `choose_card/choose_payment` Action/Decision facade 提交 | public helper、`createSetupOwnerInputPort`、`action-runtime` setup mutation 与 Browser conditional 委托全部删除；Chrome 断言 input submission，不允许 `setup.*` OwnerInput |
| `runAction/runQuickTrade/endCurrentTurn/passTurn/dispatchRuntimeAction/undoPendingAction` | 顶层规则 executor/逃生 dispatcher | 全部删除；只允许完整 Standard Action descriptor 进入 `input.dispatchAction` |
| launch/orbit/land/move/scan/analyze/research/data/card/income/alien/final-score 及 picker/cancel/confirm 导出 | 领域规则 executor 或规则流程控制 | 全部删除；DOM/Decision renderer 内部提交正式端口 |
| randomize/rotate/debug add/reveal/switch/toggle 等 mutation | debug 规则写入口 | 全部删除；debug 只能走 Browser services 内部受控 command port，不进入 public facade |
| 坐标、layout override、DOM sync/render、legal option getter | viewer 工具但不是稳定窄 read model，部分还构造 legal set/触发 renderer | 全部删除；展示只读 BrowserProjection 与 resident renderer |
| `input.dispatchAction/submitDecision` | 标准输入 facade | 保留；clone 入参/返回值，不接受 family helper、setup 或 owner input |

## Proof obligations 与集中验收

1. 自动 architecture audit 从 runtime 双向比较 22 family/5 domain；Host 自定义 owner/executor、未知 family/effect/Decision、Browser 暴露 canonical source、两 Host 共用 projection adapter 的负向 fixture 必须失败。
2. capability parity 从同一 checkpoint 对每 family 的全部实体、方向、目标、费用和 descriptor identity 做集合相等，再逐 action fork 比较 result、journal、next Decision 与 committed state。
3. terminal runner 必须从正式 setup 开始自然到正式 `game_end`；禁止 max-step 强制终局、recover/skip、临时 score 或首项代选。
4. checkpoint/replay 覆盖 fresh A/A、same instance A/A、A/B/A、非零 fork 与 worker recovery。
5. Chrome 必须加载真实 `randomizer/index.html`，验证隐藏 deck/他人手牌不泄漏，太阳系/火箭、玩家资源/手牌、公共牌、科技、扫描/数据、八物种、终局计分真实渲染，人类主行动与多步 Decision，保存恢复，以及 renderer throw 前后 committed version/state 不变；Browser 只读深冻结 BrowserProjection/resident read models。
6. 最终执行 `node --check randomizer/app.js`、全部 Node inventory、唯一 full-flow、全部 Browser smoke、fixed-seed machine game、`git diff --check`，并输出旧文件/符号删除清单。

## 2026-07-24 OwnerInput 复审

- `initial_setup` 的 Browser 旁路已归零：`createSetupOwnerInputPort`、`action-runtime` setup mutation、
  `browserInitialSetupSource` 的 conditional executor 委托以及 `setup.*` smoke audit 均无生产命中。
- 当前生产装配仍有 15 个 `createBrowserInputPort` facade，以及 17 个显式
  `registry.register(...)` OwnerInput owner。它们混合了只读 query、Browser ViewState/service
  command 和仍会修改 working root 的规则 command；不能把“OwnerInput registry 已统一”当作
  app-only 边界完成证据。
- 对高风险模块的机械 mutation 候选扫描
  (`action-runtime/action-interaction/scan/turn/effect/card/alien/debug/final/render`) 仍有 222 处。
  该数字只用于定位，不等同于 222 个独立规则；后续必须按上方 22-family/5-domain 冻结矩阵逐项
  判定 production owner，删除规则 mutation，并把合法 read/query/view/service 留在窄 adapter。
- 因此本轮只闭合 `initial_setup` 纠偏及其 Browser/Simulation/Policy/DOM 组合证据；
  SETI-164 的全量旧路径删除义务仍以本节残余为阻断项，不得据此宣称整项完成。
