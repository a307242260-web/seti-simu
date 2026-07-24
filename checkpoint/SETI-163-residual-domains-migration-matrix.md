# SETI-163 公司、外星人、收入、卡牌触发与终局领域迁移矩阵

状态：设计冻结（2026-07-24）。本矩阵是首个生产 patch 前的有限全集；测试只验证本矩阵，不用于发现 owner、状态、RNG 或 Decision 契约。

## 根契约与有限集合

- 入口只接受 `seti-game-domain-handoff-v1`，domain 为 `company | alien | income | card_trigger | final_scoring`；Production Composition 安装唯一 residual domain，Browser 只投递 Standard Action/Decision，Simulation 使用同一 pack。
- committed root 的唯一字段为 `playerState/cardState/alienGameState/finalScoringState/turnState/rocketState/solarState/planetStatsState/nebulaDataState/techGameState/match`。不得读取 DOM、Browser draft、模块闭包 session 或 app runtime callback。
- 所有实体 id、RNG draw、effect sequence、Decision revision 写入 Effect Session journal；隐藏牌/外星人揭示后设置 irreversible barrier。Decision 对 owner、stateVersion、decisionVersion、choiceId 全部重验；stale/late/wrong-owner 无副作用拒绝。
- 机会、followup、触发和跨域 handoff 共用 Composition Effect Session 的 direct/trigger/deferred 三优先级队列；不得再建 species opportunity queue、generic pending 或 host continuation。
- 有限集合机械来源：`industry/catalog.js` 的 14 个 active/passive 语义族（兼容标签映射到同一族）；`aliens/catalog.js` 的 8 个物种；`income-runtime.js` 的 7 种收入 actionType 归并为 4 个事务族；`card-trigger-runtime.js` 的事件/任务/奖励/followup 归并为 4 个 owner 族；`final_detail.md` 的 a/b/c/d 八变体与 `end-game-scoring.js` 的正式公式归并为 4 个终局族。

缩写：`P/C/A/F/T/R/S/N/Tech/M` 分别为 player/card/alien/final/turn/rocket/solar/data/tech/match；`Q` 为 session queue+journal；`D0` 无选择，`D*` 为外显 Decision；`IR` 为不可逆屏障。

## 全量 migration matrix

| # | 语义来源与可达项 | 唯一 production owner / 正式 primitive | committed state、RNG/id/sequence | Decision、事务与恢复边界 | 旧入口及物理删除证据 | 行为证据 |
|---|---|---|---|---|---|---|
| 1 | 层云 `stratus_public_corners` | company / `industry.buildStratusPublicCornerEffectNodes` | P,C,N,Q；稳定 card instance/effect id | D* 移动；同角标合并，逐节点撤销 | `app/industry-runtime` stratus 分支零引用 | 三公共牌同/异角标、移动/资源 |
| 2 | 图灵 `turing_borrow_tech` | company / industry state+passive | P,Tech,T,Q | D* 橙/紫供应科技；同回合 CAS，回合末清除 | Browser borrow picker/Simulation 两公司旁路删除 | orange/purple、stale tile、跨回合失效 |
| 3 | 哨兵 arm+打牌角标 | company / `industry.buildSentinelPlayCornerEffectNodes` | P,C,T,Q | D* 移动；武装与打牌顺序均同一 action session | app 注入/角标 executor 删除 | 先武装/后武装、外星牌排除 |
| 4 | 寰宇动力（含兼容超动力）2 移动 | company / probe move primitive | P,R,S,T,Q | D* 每节点 rocket/direction/payment；同 rocket 禁二次；可跳过 | app free-move fields/handlers 删除 | 两枚火箭、地形支付、逐节点撤销 |
| 5 | 赫利昂移除科技+收入 | company→income / `industry` + income primitive | P,C,Tech,Q | D* 非蓝科技、再选收入牌；收入抽牌 IR | app Helios picker/income callback 删除 | 各科技色、无手牌、blind draw |
| 6 | 任务中继站精选收入 | company→income / public-card + income | P,C,Q | D* 公共牌；2 宣传 CAS，补牌/盲抽 IR | app publicity picker 删除 | 资源/数据/手牌收入、宣传不足 |
| 7 | 芬威克精选角标 | company / card corner primitive | P,C,N,R,Q | D* 公共牌及可取消移动；精选补牌 IR | app Fenwick picker/free-move 删除 | 四资源角标、移动取消 |
| 8 | 深空交换 | company / exact card instances | P,C,Q | D* 手牌→公共牌；两步同 session，确认前可撤销 | app deepspace Browser draft 删除 | 1×3 组合、stale instance |
| 9 | 宇宙战略（含大战略兼容）精选/奖励槽 | company / strategy-passive | P,C,N,Q | D* 公共牌/黑槽；确认放 token，精选 IR | app strategy picker/round bonus 删除 | 三色槽、黑色多槽、满槽、1x 清槽 |
| 10 | 未来跨度扣牌/目标/精选 | company / industry state + card play domain | P,C,T,Q | D* 手牌/公共牌；扣牌可撤销，精选 IR；免费打牌回收 token | app future-span hand/public draft 删除 | 费用1–4目标、达标/反超/回收 |
| 11 | 原教旨兑换 | company / industry nodes | P,C,N,Q | D* 三节点兑换/跳过；弃牌 exact；精选 IR | app exchange effect executor 删除 | 双向六种兑换、三节点撤销 |
| 12 | 原教旨轮开始收入/禁打牌/双角标/任务 | company+income+card | P,C,N,T,Q | D* 收入牌/移动；轮2–4 once；任务完成同收入事务 | app income/card corner 分支删除 | 轮1–4、1/2型任务、角标倍增 |
| 13 | 星际海盗掠夺标记/发射 | company / industry+probe launch | P,R,S,Tech,Q | D* tech marker→planet marker→己方标记；费用+迁移+发射同 CAS | app pirates picker/executor 删除 | orbit/land、卫星排除、stale planet |
| 14 | 异星实验室三板块 | company / industry panels + 正式 action primitive | P,A,Q | D* 主行动/trace；翻背与 trace 翻正同事务 | app panel click/restore 删除 | 蓝黄粉各 action 与 trace |
| 15 | 九折 reveal/card/threat | alien/`aliens.jiuzhe` | P,C,A,Q；牌序 RNG journal | D* card gain/play/skip；隐藏牌 IR | species runtime jiuzhe switch/queue 删除 | reveal、两类牌、威胁与终局惩罚 |
| 16 | 异常点 trace/card | alien/`aliens.yichangdian` | P,C,A,Q；blind/display RNG | D* trace position/card source | species yichangdian 分支删除 | 首痕迹/额外痕迹、display/blind |
| 17 | 半人马机会/卡牌 | alien/`aliens.banrenma` | P,C,A,Q | D* reward/card；费用与能量牌规则同 CAS | species banrenma queue 删除 | 各机会奖励、卡获取/打出 |
| 18 | 方舟 panel/card1/card2 | alien/`aliens.fangzhou` + card1 queue | P,C,A,Q；unlock/draw journal | D* place panel/unlock/card use；揭示 IR | species fangzhou followup queue 删除 | 三色 panel、card1 队列、card2 分支 |
| 19 | 虫 fossil/transport/task | alien+card_trigger/`aliens.chong` | P,C,A,R,S,Q | D* fossil/task/destination；transport cleanup 同事务 | species/card-trigger chong 分支删除 | fossil reward、抵达事件、任务完成 |
| 20 | 阿米巴 symbol/task | alien+card_trigger/`aliens.amiba` | P,C,A,Q | D* symbol/branch/task；重复/位置 stale | species/card-trigger amiba draft 删除 | symbol 两分支、任务、终局规则 |
| 21 | 奥陌陌 orbit/land/card | alien/`aliens.aomomo` | P,C,A,R,S,Q；card RNG | D* marker/card source；marker capacity CAS | species aomomo picker 删除 | orbit/land marker、display/blind |
| 22 | 符文族 panel/face symbol/task | alien+card_trigger/`aliens.runezu` | P,C,A,N,Tech,Q | D* symbol/branch/task；claim once CAS | species/card-trigger runezu drafts 删除 | sector/tech claim、face/panel、终局符号 |
| 23 | 通用揭示与首痕迹 | alien / `aliens.randomize/getAlienSlot/placeFirstTrace` | A,P,C,Q；assigned/reveal/card RNG | D* species opportunity/trace；揭示 IR | `app/alien-runtime`, turn-end reveal callback 删除 | 8 物种逐一 reveal 初始化 |
| 24 | 通用额外痕迹与奖励 | alien / species `canAdd/addExtraTrace` | A,P,Q | D* slot/position；species after-reward followup 同 CAS | alien trace picker/reward flow 删除 | 8 物种×三色合法位置 |
| 25 | 卡牌收入（income/card/planet/place-data/Helios） | income / players+cards+data | P,C,N,Q；draw id/RNG | D* exact hand card；gain+discard+draw 同事务，draw IR | app income discard/picker 删除 | 7 actionType、无牌、各 income code |
| 26 | PASS 收入 | income / player income ledger | P,C,N,T,Q；多次 draw journal | D0；资源+N张牌原子，任一 draw 失败 fail-closed | turn-end `applyPassTurnEndIncome` 删除 | 0/N handSize、最终轮不生成 |
| 27 | 公司 round_start 收入 | company→income | P,C,N,T,Q | D0/D* Fundamentalism；每 player/round once | app round-start bonus branches 删除 | active players、兼容标签不新增补强 |
| 28 | type1 事件触发 | card_trigger / card task-state+effects | P,C,A,R,S,N,Q | D* 多 match 选 reward；event key 去重 | app trigger picker/matcher 删除 | 每 event type、0/1/N match |
| 29 | 任务结算（普通/虫/阿米巴/符文） | card_trigger / task-state+species primitives | P,C,A,Q | D* confirm/skip/reward；consume+discard+count 同 CAS | app task completion picker 删除 | 四任务族、blocked/busy、重复 confirm |
| 30 | card event bonus/followup | card_trigger / formal card effect nodes | P,C,A,R,S,N,Q | D* move/trace/reward；direct>trigger>deferred | app bonus/continuation callback 删除 | publicity move、alien trace、transport |
| 31 | turn_end/round_transition cleanup | card_trigger+company | P,C,T,Q | D0；owner 切换前 cleanup，跨轮后 reset | app turn-end cleanup branches 删除 | 普通换人/跨轮/最终轮顺序 |
| 32 | 门槛标记 `choose_final_scoring` | final_scoring / `finalScoring.syncPendingMarks/markTile` | P,F,Q；mark id 由 committed sequence | D* a/b/c/d；threshold/slot/owner stale 重验 | final UI mark mutation/Simulation provider 删除 | 25/50/70、多 pending、slot1/2/3 |
| 33 | 正式终局 a/b/c/d 八变体 | final_scoring / `endGameScoring.computePlayerTileScore` | P,C,A,F,R,S,N,Tech,Q | D0；只读最终 committed snapshot | Browser fallback breakdown 删除 | 每变体边界值与多人排名 |
| 34 | 正式总分与 scoreSources | final_scoring / `computePlayerFinalScore` | P,C,A,F,Q | D0；每玩家写 `finalScore` 和完整来源账本一次 | UI 临时 summary/fallback score 删除 | 全玩家 base/tile/card/九折/符文及惩罚求和 |

## 反例与集中验收

1. 注入未知 domain/effectType/species/decision kind：必须返回包含 domain/effectType/ownerId 的 fail-closed，旧 resolver/app callback 调用恒为 0。
2. 同一 pending 分别提交 wrong owner、旧 stateVersion、旧 decisionVersion、已移除 choiceId：committed root、RNG cursor、sequence、journal 均不变。
3. 对每个 D* 行从同一 checkpoint fork 执行全部 legal choices；每项可执行或返回声明的业务拒绝，不得 generic pending/首项代选。
4. fresh A/A、same instance A/A、A/B/A 与非零 checkpoint fork 比较 committed state、legal choices、RNG、id、journal cursor。
5. 静态零引用：`app/industry-runtime.js`、`app/aliens/**`、`app/income-runtime.js`、`app/card-trigger-runtime.js`、`app/turn-end-flow.js` 中上述规则入口物理删除；training 不含 company/alien/income/final 私有 provider；science-session 不直接执行 alien/income。
6. 集中验证：residual domain 代表测试（14 公司+8 物种+收入/触发/终局）、Production Composition 根契约、checkpoint/replay、唯一 full-flow、全部 Node、真实 Browser smoke、`node --check randomizer/app.js`、`git diff --check`。
