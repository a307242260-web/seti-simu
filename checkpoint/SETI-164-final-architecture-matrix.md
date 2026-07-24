# SETI-164 最终架构收口矩阵

状态：设计冻结（2026-07-24）。本文件把 SETI-158/159/160/163 的领域矩阵合并为最终组合义务；首个生产 patch 前以当前 `HEAD=16933d6` 的完整 `randomizer/app/**`、`randomizer/game/**`、`randomizer/training/**` 和 HTML 脚本清单机械复核。测试用于验证此矩阵，不用于首次发现 owner、state、RNG 或 Decision 契约。

## 根契约与有限集合

- Standard Action 的有限全集只来自 `game/actions/standard-action.js::ALL_FAMILIES`，共 22 项。Production Domain Pack 必须对全集逐项登记唯一 provider、executor 与 Effect domain，Browser/Simulation 不得补 family、executor 或 choices。
- Effect domain 的有限全集只来自 `game/production-composition.js::effectDomains`：`standard_action`、`card_play`、`science`、`probe_turn`、`residual`。重复 owner 构造期失败；未知 family/domain/effect/Decision fail-closed。
- committed root 只由 Composition StateStore/Effect Session CAS 修改。Browser 只可读取正式 projection、提交 Standard Action/Decision、保存/恢复 envelope、渲染和隔离渲染异常；Simulation 只可提供 seed/config、Policy 输入、批跑、checkpoint/replay 与报告。
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
| Browser vs Simulation capability | 同 22 family、5 domain、owner/executor identity | 任一 Host 多/少 family 或注入 executor | 自动 capability matrix |
| same root / every legal action | descriptor identity、费用、目标、执行结果、journal、next Decision、committed state 相等 | 同 checkpoint 某 action 只在一侧可执行 | 同 checkpoint 逐 action fork |
| fresh A/A | state、legal、RNG、id、cursor 相等 | 未纳入 seed 的随机源 | reset parity |
| same instance A/A 与 A/B/A | reset 清空模块闭包/cache/pending | B 污染第二次 A | 常驻 env reset matrix |
| non-zero checkpoint fork | 至少一个真实 policy action 后 state/legal/RNG/journal cursor 相等 | 仅 opening checkpoint 通过 | checkpoint/replay test |
| crash/timeout recovery | 只重放确认 action；失败 action 不入 journal | stale worker response 被提交 | worker recovery test |
| terminal full game | 正式建局运行到 `game_end`，每玩家有 finalScore/scoreSources | max-step/recover/score fallback 假终局 | 多 seed terminal contract |
| real Chrome | 人类输入走同 Standard Action/Decision；保存恢复；renderer 异常不破坏规则 authority | UI callback 直写或 renderer throw 中断 commit | Chrome smoke |

## 旧路径物理删除矩阵

以下是从当前 HTML、`app/dependencies.js`、`app.js` production 装配与源码 mutation 扫描机械导出的有限删除集合；不能以“新 owner 已存在”或“当前未命中”替代物理删除。

1. 删除完整 Browser rule executor/Decision owner：`app/conditional-decision-domain.js`、`app/conditional-action-executor.js`、`app/quick-turn-action-executor.js`、`app/effects/{bootstrap,dispatcher,movement-scan,rewards,aliens}.js`，以及 HTML/dependency/app.js 装配。
2. `app/scan-flow.js`、`tech-runtime.js`、`industry-runtime.js`、`income-runtime.js`、`card-trigger-runtime.js`、`turn-end-flow.js`、`hand-flow.js`、`alien-runtime.js`、`alien-trace-reward-flow.js`、`alien-ui.js`、`aliens/species-runtime.js` 只保留 projection/render/input adapter；任何 committed state mutation、legal/choice builder、effect executor、history/continuation/pending owner 物理删除。
3. `app/action-runtime.js`、`action-interaction-runtime.js`、`effect-flow.js`、`effect-choice-flow.js`、`score-source-runtime.js` 只保留输入/展示/只读投影；旧 action/effect/session rule continuation 物理删除。
4. `app/public-api.js` 只允许 debug/inspect/save/restore 与标准输入端口；不得暴露直接规则 executor。
5. `training/simulation-rule-composition.js` 只负责 host state/config/RNG 与安装 Production Composition；不得枚举/执行 family、构造 Decision、skip unsupported 或 fallback score。
6. 静态禁止生产路径中的 `unavailable/unsupported/generic pending/no_legal_choice` 兼容分支、host family executor map、Browser rule callbacks、Simulation private provider。未知输入必须由 game Composition 返回结构化 fail-closed。

## Proof obligations 与集中验收

1. 自动 architecture audit 从源码与 runtime 双向比较 22 family/5 domain；Host 自定义 owner/executor、未知 family/effect/Decision 的负向 fixture 必须失败。
2. capability parity 从同一 checkpoint 对每 family 的全部实体、方向、目标、费用和 descriptor identity 做集合相等，再逐 action fork 比较 result、journal、next Decision 与 committed state。
3. terminal runner 必须从正式 setup 开始自然到正式 `game_end`；禁止 max-step 强制终局、recover/skip、临时 score 或首项代选。
4. checkpoint/replay 覆盖 fresh A/A、same instance A/A、A/B/A、非零 fork 与 worker recovery。
5. Chrome 覆盖真实人类 Standard Action/Decision、保存恢复、八物种渲染和 renderer throw 隔离；Browser 规则 state 仅来自 Composition projection。
6. 最终执行 `node --check randomizer/app.js`、全部 Node inventory、唯一 full-flow、全部 Browser smoke、fixed-seed machine game、`git diff --check`，并输出旧文件/符号删除清单。
