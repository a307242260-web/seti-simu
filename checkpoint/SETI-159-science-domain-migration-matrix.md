# SETI-159 Science Production Domain Migration Matrix

状态：`FROZEN`（67/67 行闭合；冻结基线 `56a678a`。任何实现期 owner/state/RNG/Decision
遗漏都必须退回本矩阵，禁止靠测试失败继续猜设计）

## 1. 范围、有限集合与机械来源

本次只迁移四个 Standard Action family：`scan / place_data / analyze / research_tech`，
但“迁移完成”递归包含它们生成的全部 effect、bonus、followup 和 Decision；Browser 旧流程能
执行而新 domain 未列出的子语义，视为未闭合。

有限集合来自以下生产常量和可达模型，不用字符串搜索结果冒充：

- 顶层 family：`randomizer/game/actions/standard-action.js::ALL_FAMILIES` 中上述 4 项。
- 主扫描链：`scan-effects.js::EFFECT_TYPES` 的 10 类、`buildScanEffectQueue` 的
  base + purple1/2/3/4 条件展开，以及 `data/nebula-state.js` 的 9 个星云、8 个普通扇区
  奖励表。
- 数据放置：`data/placement.js` 的 computer 1–6、blueBonus 1–4、2 个第一排奖励、
  4 个蓝片奖励和 4 个蓝列得分映射。
- 科技：3 色 × 4 tile = 12 个 tile，4 个 bonus id，blue 1–4 槽位，以及
  `tech-runtime.js::appendResearchTechFollowupEffects` 的完整生成分支。
- 卡牌递归调用：从 182 张 `CARD_REFERENCE_MAP` 逐张调用 `buildPlayEffects` 后递归遍历得到
  13 个 science 相关 effect type、104 个实例：

| 卡牌 effect type | 实例数 | 有限 variant |
|---|---:|---|
| `card_scan_nebula` | 14 | 8 个普通 nebula id；全部 `gainData=true` |
| `card_scan_color_choice` | 10 | yellow/red/blue/black；`gainData=false` 4 项、`true` 6 项 |
| `card_public_scan` | 6 | repeat=1/2/3 |
| `card_any_sector_scan` | 2 | 任意普通扇区，gainData=true |
| `card_scan_action` | 9 | 完整主扫描链，`skipCost=true` |
| `card_draw_then_scan` | 3 | 同一张牌三次；盲抽后可 skip 且弃抽到牌 |
| `card_optional_discard_scan` | 1 | 至多 3 次手牌弃牌扫描 |
| `card_hand_scan` | 1 | 一次手牌扫描 |
| `card_landing_sector_scan` | 1 | 最近一次 landing 所在扇区 |
| `card_conditional_sector_scan` | 2 | 自己信号≥3的单扇区×2；所有有己方信号扇区各×1；均不拿数据 |
| `card_planet_sector_scan` | 12 | earth/mercury/mars/jupiter/saturn/venus，各 2 次 |
| `card_probe_sector_scan` | 12 | current/any owner、1/3 targets、adjacent、gainData=false、回手条件 |
| `card_research_tech` | 31 | 见 §5：颜色过滤、他人已研究、条件、skip rotate/bonus、4 类 after reward |

机械自审契约：实现时新增脚本从上述来源导出 `family=4`、`cardTypes=13`、
`cardInstances=104`、`rows=67`；任一 missing/extra/duplicate 使 Domain Pack 创建或结构门禁失败。

## 2. 共同根契约

### 2.1 唯一 production owner

- `ScienceDomain` 同时拥有四族的 action definition、`createEffectGroup`、Effect/Decision
  executors；`ProductionDomainPack.familyOwners` 四族只能指向 `science`。
- `ScienceDomain` 只编排正式 primitive，不复制规则：
  `scanEffects`、`abilities.scan/data/tech/rocket`、`data.*`、`tech.resolver.*`、
  `industry passives/effects`、`alien trace`、`card pick/income`。
- Card Play 仍拥有卡牌事务和卡牌特有 after reward，但所有 scan/research 核心必须调用
  Science primitive；不得保留第二套星云、tile、blue slot 或 bonus resolver。
- Browser 只渲染 projection 并提交标准 action/Decision；Simulation/Policy 只消费同一
  registry/session，不可注入 host executor、pending resolver 或默认首项。

### 2.2 working/committed state 与确定性代码

| 代码 | 唯一状态与确定性契约 |
|---|---|
| `S-P` | `players.players[*]` 的 resources/income/mainAction/industry passive；只改 Session working root。 |
| `S-D` | 玩家 `dataState.poolTokens/placedTokens/discardedCount`；新 data token 只取 committed `meta.sequences.dataToken`。 |
| `S-N` | `data.nebulae/sectorExtraMarks/sectorSettlements`；token/replacement/retained-token id 只取 committed `meta.sequences.nebulaToken/nebulaReplacement`。 |
| `S-C` | hand/public/discard/draw pile；抽牌只取 committed card RNG 与 `meta.sequences.card`。 |
| `S-T` | `tech.board` supply/bonus queue 与玩家 `techState`；禁止 `tech.ui` 成为规则状态。 |
| `S-R` | `solarSystem` rotation、`pieces.rockets` 和 committed rocket sequence；移动/旋转结算使用正式 rocket primitive。 |
| `S-A` | alien trace/species state、Runezu sector claim；不读 Browser draft。 |
| `S-M` | `match` Session、event bonus ledger、journal/replay、Decision version；不写 `actionEffectFlow` 或 host pending。 |
| `Q0` | 无 RNG/新实体；所有 choices 按正式稳定 id/slot 顺序。 |
| `Q-C/D/N/R` | 分别表示 card/data/nebula/rocket committed RNG 或 sequence，serialize/restore/replay 后逐字节一致。 |

所有行的 mutation 先发生在同一 working root；无 Decision 的完整组或每次 Decision continuation
结束后由 Effect Session 的 `commitWorkingState` 做唯一 StateStore CAS。不得让 Browser global
与 committed root 双写。

### 2.3 Decision 与拒绝代码

| 代码 | owner / choices |
|---|---|
| `D0` | 确定性 effect；0 项为显式 skipped/fail-closed，1 个等价项可自动 drain。 |
| `D-SCAN` | owner=触发 action/effect 的 actor；星云、扇区、公共牌、手牌、探测器或 Aomomo 目标。 |
| `D-MOVE` | owner=actor；purple4 的 launch/move、rocket、方向、补充支付/skip。 |
| `D-DATA` | owner=actor；computer next slot 或合法 blueBonus slot。 |
| `D-TECH` | owner=actor；tile+blueSlot 为一个完整 choice，选择后重验 bonus/firstTake。 |
| `D-CARD` | owner=奖励 owner；公开牌/手牌/收入牌/精选牌选择。 |
| `D-TRACE` | owner=奖励 owner；外星 slot/species followup 的完整合法 choice。 |

所有非等价选择只经 `RuleComposition.inputPort.submitDecision`，携带
`decisionId + decisionVersion + ownerId + 完整 choice`。统一零副作用拒绝：

- stale identity/version：`EFFECT_DECISION_STALE`
- Session 已推进或结束的 late input：`EFFECT_DECISION_NOT_AWAITING`
- wrong owner：`EFFECT_DECISION_OWNER_MISMATCH`
- 重枚举后 choice 非法：`EFFECT_DECISION_NOT_LEGAL`

四类拒绝均须完整 committed bytes、journal/replay cursor、RNG/sequences 不变。

### 2.4 事务、不逆与证据代码

| 代码 | 契约 |
|---|---|
| `TX` | action 重验、费用、全部 effects/decisions、followup 都在一个 Session；失败在屏障前回滚到 base，成功只提交正式 journal/event。 |
| `IR0` | 无隐藏信息，可回滚当前 Effect frame/整个未提交组。 |
| `IR-C` | 盲抽或公共补牌首次揭示前写 card RNG+journal 和 hidden-card barrier。 |
| `IR-T` | consume tech supply 露出下一 bonus 前写 tech bonus reveal barrier；不得在屏障后伪装全回滚。 |
| `IR-E` | 已创建/迁移外部可见实体或完成 settlement 时，先写实体 sequence/journal，再推进 followup。 |
| `E-COMP` | Browser 与 Simulation 同 fixture 枚举、执行、Decision 后 committed bytes/events/history 一致。 |
| `E-DEC` | human/Policy/Simulation 同一 Decision；并覆盖 stale/late/wrong-owner/illegal 的零提交。 |
| `E-RNG` | fresh A/A、同实例 A/A、同实例 A/B/A、非零 checkpoint fork、save/restore/replay 比较完整 state/RNG/sequences/cursor。 |
| `E-ALL` | 4 family + 13 card types/104 instances 的真实 composition 可达、执行和 owner 集合完全相等。 |

## 3. Scan 完整迁移矩阵（1–30）

每行继承 `TX`；“旧删”中的符号必须物理零引用，renderer/纯 input adapter 可保留但不得 mutation。

| # | 有限语义 | 唯一 owner / 正式 primitive | state / RNG | Decision | 事务/不逆 | Browser / Simulation 旧入口与删除证据 | 行为证据 |
|---:|---|---|---|---|---|---|---|
| 1 | 顶层 scan legality/main-action lock | Science.ScanAction；`scanEffects.canExecuteScan/getStandardScanCost` | `S-P,S-M;Q0` | `D0` | 先重验 actor/turn/pending | `action-runtime` stage2 scan provider；Simulation unavailable | `E-COMP` enumerate/cost |
| 2 | 标准费用 1 credit+2 energy、异星实验室 yellow=2 energy | Science.ScanCost；`abilities.payScanCost` + industry cost primitive | `S-P;Q0` | `D0` | 费用与 panel 消耗同 Session，失败全回滚 | `scan-flow.executeMainScanAction` cost/history；host panel consumer | 两种费用与资源不足 |
| 3 | yellow panel 一次性翻面/永久 panel 不翻 | Science.ScanCost followup；industry panel primitive | `S-P;Q0` | `D0` | `IR0`，费用成功才消费 | `maybeConsumeAlienLabPanelForMainAction("scan")` | normal/permanent/face-down |
| 4 | 扫描链稳定顺序 | Science.ScanGroup builder；正式顺序 earth → public → purple4 → purple2 → purple3 → finalize | `S-M;Q0` | child 决定 | 顺序与插入 source 入 journal | Browser `actionEffectFlow` / `buildScanEffectQueue` owner | 16 种 purple tech bitmask 队列 |
| 5 | earth sector scan（无 purple1） | Science.SectorScan；solar Earth coordinate + `abilities.scanSector` | `S-N,S-D,S-P;Q-D,Q-N` | `D-SCAN`（该 sector 两星云，Aomomo 同 X 时加入） | `IR0/IR-E` | `beginSectorScan/openScanTargetPicker` | Earth rotation parity |
| 6 | improved sector scan（有 purple1） | 同 #5，语义标签不同、无第二套 executor | 同 #5 | 同 #5 | 同 #5 | `IMPROVED_SECTOR_SCAN` Browser branch | purple1 on/off |
| 7 | public card selection 1..N | Science.PublicScan；public entities + scan code parser | `S-C,S-P;Q0` | `D-CARD` | choice 前不弃牌 | `beginPublicDeckScan/cardSelectionDecision` | 空位、min/max、重复选择 |
| 8 | extra public scan markers | Science.PublicScan legality；`additionalPublicScan` resource | `S-P,S-C;Q0` | `D-CARD` | 只按实际 extra 数扣 marker | `getPublicScanMaxSelectable/confirmPublicScanSelection` | 0/N marker、资源变化 stale |
| 9 | public card scan target | Science.PublicScan → common nebula primitive；card scanActionCode 映射 | `S-C,S-N,S-D;Q-D,Q-N` | `D-SCAN` | 目标确认后才迁牌 | Browser public queue/picker | 每个 code 的 targets |
| 10 | public discard + delayed refill | Science.PublicScan followup；card entity migration + committed draw | `S-C;Q-C` | `D0` | `IR-C`；完整 scan chain 尾部统一 refill，slot 顺序稳定 | `registerDelayedPublicRefill/replenishDelayedPublicRefillSlots` | 多 slot、牌库耗尽、恢复 |
| 11 | purple4 launch branch | Science.ScanPurple4；`abilities.scanAction4 -> rocket.launchProbe` | `S-R,S-P;Q-R` | `D-MOVE` launch/move | launch cost 1 energy，实体先记 sequence | Browser `scanAction4Overlay/launchRocketForScanAction4` | limit/cost/launch |
| 12 | purple4 move branch | Science.ScanPurple4；正式 rocket move/payment | `S-R,S-P,S-C;Q-R` | `D-MOVE` rocket+direction+terrain payment | discard/payment+move 同 continuation | `scan_free_move` pending / supplemental payment | normal/asteroid/card/energy |
| 13 | purple4 launch 的 Sentinel Earth scan | Science.ScanPurple4 child；industry `shouldScanEarthOnLaunch` + common scan | `S-R,S-N,S-D;Q-R,Q-D,Q-N` | `D-SCAN` | launch 与 scan child 同 Session | `maybeApplyIndustryLaunchScan` Browser mutation | passive on/off + settlement |
| 14 | purple2 Mercury sector scan | Science.SectorScan；Mercury coordinate + common scan | `S-N,S-D,S-P;Q-D,Q-N` | `D-SCAN` | 独立 cost=1 publicity；不足显式 skipped/failed 按旧契约 | Browser `MERCURY_SECTOR_SCAN` | rotation/cost |
| 15 | purple3 hand scan 选牌 | Science.HandScan；hand entities + scan code parser | `S-C;Q0` | `D-CARD` | 选择前不弃牌 | `beginHandScan/hand_scan` pending | 空手/多牌/stale |
| 16 | purple3 hand scan 选星云并弃牌 | Science.HandScan → common scan + entity migration | `S-C,S-N,S-D;Q-D,Q-N` | `D-SCAN` | scan 成功后才弃 exact instance | `handleHandScanCardClick/finalizeScanSourceCard` | scan fail 不丢牌 |
| 17 | common nebula normal replacement | Science.NebulaScan；`abilities.scanNebula/data.replaceNextNebulaDataToken` | `S-N;Q-N` | target 来自 parent | `IR-E` replacement order/id 入 journal | `replaceNebulaDataForCurrentPlayer` | 8 nebula + Aomomo |
| 18 | nebula 满后 extra mark | Science.NebulaScan；`data.addSectorExtraMark` | `S-N;Q-N` | parent | `IR-E` mark id/owner committed | 同上 Browser extra branch | 有 token但无 replaceable / 无数据 |
| 19 | gainData true/false/池满 | Science.NebulaScan；`data.gainData({root})` | `S-D,S-P;Q-D` | `D0` | 池满 discardedCount，且不消耗 data sequence | Browser ability result handling | true/false/full |
| 20 | nebula slot score | Science.NebulaScan；`getNebulaSlotScoreReward` | `S-P,S-N;Q0` | `D0` | 与 replacement 同 frame | Browser history score command | 普通 slot2 +2；Aomomo slot1/3 |
| 21 | signalMarked/scanAction event bonus | Science event ledger；Card Play 已迁 `register_event_bonus` primitive | `S-M,S-P,S-D;child Q` | child 决定 | event 与 mutation 同 journal；distinctBy 去重 | Browser `actionEffectFlow.scanActionEvent` / host trigger settlement | 16 card bonus variants |
| 22 | 扇区 ready 判定与稳定顺序 | Science.SectorSettlement；`data.isSectorReady/orderSectorIdsByPlayerWinPriority` | `S-N;Q0` | `D0` | 只结算本组触达且 ready 的 sector，组尾执行 | `buildReadySectorFinishEffects/end-flow insertion` | 同时完成多扇区 |
| 23 | ranking/winner/retained token/reset | Science.SectorSettlement；`data.settleSector` | `S-N;Q-N` | `D0` | `IR-E` settlementNumber/retained token committed | `executeSectorFinishScanEffect` | tie/first/repeat/Aomomo |
| 24 | participant reward | Science.SectorReward；`buildSectorRewardDescriptors` + players | `S-P,S-N;Q0` | `D0` | 普通 +1 publicity；Aomomo +1 fossil | Browser generated gain effect | 每 participant |
| 25 | winner score reward | Science.SectorReward；正式 reward descriptor | `S-P,S-N;Q0` | `D0` | 与 settlement 同 Session | Browser generated gain effect | 8 sector first/repeat 表 |
| 26 | winner pink trace reward | Science.SectorReward → Alien trace domain | `S-A,S-N;Q0` | `D-TRACE`，owner=winner | 不得提前结算后丢 pending；无目标显式 skip | Browser `ALIEN_TRACE` followup；Simulation generic pending | first/repeat 各表项 + stale |
| 27 | Runezu sector symbol claim | Science.SectorSettlement → Runezu primitive | `S-A,S-N;Q0` | `D0`（按 winner/sector 唯一） | settlement 同 frame | Browser direct `claimSectorSymbol` | revealed/unrevealed/already |
| 28 | sectorCompleted event/journal | Science.SectorSettlement | `S-M,S-N;Q0` | `D0` | winner/number/sector 完整记录 | Browser action history aggregate | replay cursor parity |
| 29 | scan finalize / delayed effects | Science.ScanFinalize | `S-M,S-C,S-N;Q-C` | child 决定 | refill→settlement/rewards→scanAction event 顺序冻结 | `SCAN_ACTION_FINALIZE/SCAN_PUBLIC_REFILL/end-flow` | 主 scan 与 card scan_action |
| 30 | scan unknown/empty target | Science default fail-closed | all unchanged | `D-SCAN` 四类统一拒绝 | 零 CAS/journal/RNG | 删除所有 host fallback/default-first | unknown nebula/family/late |

## 4. Card → Scan 递归矩阵（31–42）

这些行的唯一 Card transaction owner 仍是 Card Play；扫描规则 owner 一律是 §3 Science primitive。
每行都继承卡牌 Session 的 actor、source card instance、单 CAS 和 `E-DEC/E-RNG/E-ALL`。

| # | 卡牌有限语义 | owner / primitive | state / RNG | Decision | 事务/不逆 | Browser/Simulation 旧删 |
|---:|---|---|---|---|---|---|
| 31 | fixed nebula，14 实例/8 id | Card Effect 编排 → Science.NebulaScan | `S-C,S-N,S-D;Q-D,Q-N` | 固定目标 `D0` | `IR0/IR-E` | Card Play 内 direct ability 与 Browser fixed branch 零重复 |
| 32 | color choice，10 实例/4 色/2 gainData | Card Effect → Science list/scan | 同 #31 | `D-SCAN`，每色 2 nebula | 同 #31 | Card Play 独立 `NEBULA_IDS_BY_COLOR` executor 只可作模型输入 |
| 33 | public scan，6 实例 repeat 1/2/3 | Card Effect → Science.PublicScan | `S-C,S-N,S-D;Q-C,Q-D,Q-N` | `D-CARD→D-SCAN` | `IR-C` delayed refill | Browser public pending/Simulation resolver |
| 34 | any sector，2 实例 | Card Effect → Science sector choices | `S-N,S-D;Q-D,Q-N` | `D-SCAN` | `IR0/IR-E` | Card Play generic independent scan resolver |
| 35 | full scan_action，9 实例 skip base cost | Card Effect → Science.ScanGroup #4–29 | 全 §3 | child Decisions | purple2 cost/全部 followup仍保留 | Browser queue owner |
| 36 | draw_then_scan，3 实例 | Card Effect blind draw → Science card-code scan | `S-C,S-N,S-D;Q-C,Q-D,Q-N` | `D-SCAN/skip` | `IR-C`；skip 时弃 exact drawn card | Browser drawn pending |
| 37 | optional_discard_scan，至多3 | Card Effect bounded loop → Science.HandScan | 同 #36 | `D-CARD→D-SCAN→skip` | 每轮重枚举，不能 host 计数 | Browser optional pending |
| 38 | hand_scan，一次 | Card Effect → Science.HandScan | `S-C,S-N,S-D;Q-D,Q-N` | `D-CARD→D-SCAN` | 成功后弃 exact instance | Browser hand pending |
| 39 | landing_sector_scan | Card Effect 读取同组 landing result → Science sector scan | `S-R,S-N,S-D;Q-D,Q-N` | sector 多星云 `D-SCAN` | 禁读 host lastLanding | Browser last landing helper |
| 40 | conditional sector，2 variants | Card Effect 正式 condition → Science sector scan | `S-N,S-D;Q-D,Q-N` | 单/全 matching `D-SCAN` | repeat/allMatching 有界 | Browser condition picker |
| 41 | planet sector，12 实例/6 planet | Card Effect committed planet coordinate → Science sector scan | `S-R,S-N,S-D;Q-D,Q-N` | `D-SCAN` | 每实例一次，旋转后重算 | Browser planet picker |
| 42 | probe sector，12 实例/5 option axes | Card Effect rocket filter → Science scan | `S-R,S-N,S-D,S-C;Q-D,Q-N` | `D-SCAN` 含 probe/sector/nebula | maxTargets/repeat/adjacent/gainData/returnToHand 完整保留 | Browser probe pending |

## 5. Place Data / Analyze / Research Tech 矩阵（43–63）

| # | 有限语义 | 唯一 owner / 正式 primitive | state / RNG | Decision | 事务/不逆 | Browser / Simulation 旧入口与删除证据 | 行为证据 |
|---:|---|---|---|---|---|---|---|
| 43 | place_data legality | Science.PlaceData；`abilities.data.listPlacementChoices` | `S-D,S-T;Q0` | `D0` | quick action，不消耗 main | `action-runtime` provider、quick-turn executor、Simulation unavailable | `E-COMP` |
| 44 | computer next slot 1–6 | Science.PlaceData；`data.placeDataToComputer` | `S-D;Q0` | `D-DATA`（与 blue choices 并列时） | 移动 leftmost pool token，失败回滚 | Browser picker/direct confirm | 每 slot |
| 45 | blueBonus slot 1–4 legality | Science.PlaceData；required computer 1/3/5/6 + active blue tile | `S-D,S-T;Q0` | `D-DATA` | stale tile/occupied/required slot 拒绝 | Browser `placeDataToBlueSlot` | 4 slots + invalid |
| 46 | computer slot2 publicity | Science.DataBonus；players gain | `S-P,S-D;Q0` | `D0` | placement 同 Session | Browser `applyPlaceDataSlotBonus` | +1 publicity |
| 47 | computer slot4 income | Science.DataBonus → Income domain | `S-P,S-C,S-D;Q-C,Q-D` | `D-CARD` 选手牌 | 收入可能抽牌/数据，必要时 `IR-C` | `place_data_income` host pending | 无手牌/各种 income |
| 48 | blue column computer 1/3/5/6 +2 score | Science.DataBonus；score source primitive | `S-P,S-D,S-T;Q0` | `D0` | 与 placement 同 frame | Browser direct score/source | 4 mappings |
| 49 | blue1 bottom +1 credit | Science.DataBonus | `S-P,S-D;Q0` | `D0` | 同 frame | Browser bonus switch | exact result |
| 50 | blue2 bottom +1 energy | Science.DataBonus | 同 #49 | `D0` | 同 frame | 同上 | exact result |
| 51 | blue3 bottom pick card | Science.DataBonus → Card Pick domain | `S-C,S-D;Q-C` | `D-CARD` | refill/blind 时 `IR-C` | `place_data_choose_card` pending | public/blind/stale |
| 52 | blue4 bottom +2 publicity | Science.DataBonus | `S-P,S-D;Q0` | `D0` | 同 frame | Browser bonus switch | exact result |
| 53 | auto-place-before-gain-data | 数据获得 source owner → Science.PlaceData optional continuation | `S-D,S-P;Q-D` | `D-DATA` + skip | 满池时先放或显式弃本次 gain；两步同 parent Session | `auto_data_place_before_gain` pending | place/skip/stale |
| 54 | place_data event/history/undo | Science.PlaceData journal | `S-M,S-D` | child 决定 | bonus 完结才完成 quick action；屏障前可撤 | Browser quickActionHistory | replay parity |
| 55 | analyze legality：computer slot6 | Science.Analyze；`data.canAnalyzeData` | `S-D,S-P;Q0` | `D0` | main-action lock | Browser provider、Simulation unavailable | ready/not ready |
| 56 | analyze cost：1 energy / Deep Space free | Science.Analyze；`abilities.analyzeData` + industry passive | `S-P,S-D;Q0` | `D0` | 扣费并清空全部 placed tokens 同 frame | Browser options wrapper | normal/free/insufficient |
| 57 | analyze 蓝色痕迹奖励 | Science.Analyze child → Alien Trace domain | `S-A,S-P;Q0` | `D-TRACE` owner=actor | analyze 与 trace 同 Session；无目标显式 skip | `startAnalyzeDataRewardFlow` Browser flow | revealed/unrevealed/stale |
| 58 | analyze completion/event/history | Science.Analyze | `S-M,S-D,S-P,S-A` | child | trace 完成后才 consume main、单 CAS | Browser atomic history | `E-COMP/E-DEC` |
| 59 | research legality/cost/filter | Science.Research；`actions.researchTech.getResearchOptions` + industry/pirates/condition | `S-P,S-T;Q0` | `D-TECH` | main cost 6/Fenwick5/AlienLab4；card skipCost；yellow/pink panel规则同 Session | Browser stage2/reference provider、tech UI legality、Simulation host source | filters parity |
| 60 | 12 tiles × blue slot 1–4 | Science.Research choice builder；`tech.resolver.listTakeableTiles/getAvailableBlueSlots` | `S-T;Q0` | `D-TECH` 完整 tile+slot choice | bonusId/firstTake 进入 identity payload，resolve 前重验 | Browser tile/blue overlay | 12 tile、槽满/stale |
| 61 | select/cost/take/supply reveal | Science.Research；`selectTechTile/takeSelectedTechTile` | `S-P,S-T;Q0` | `D-TECH` | consume supply 前可回滚；露出 next bonus 时 `IR-T` | `engine-action-executor`、tech-runtime select/take | cost/supply/firstTake |
| 62 | rotation + rocket settlement | Science.Research followup；`rotateForResearch` + rocket settlement | `S-R,S-T;Q-R` | `D0` | take 后按 options 执行；失败遵守 `IR-T` | tech-runtime generated rotate | rotation/rocket events |
| 63 | research bonus/followup 完整集合 | 见下表 #64，统一由 Science child Effects | 依 child | 依 child | 同一 Session | Browser `appendResearchTechFollowupEffects` | 全分支 |

## 6. Research bonus/followup 与卡牌 research 矩阵（64–67）

### 6.1 #64 科技正式 followup 有限表

| # | 有限语义 | 唯一 owner / 正式 primitive | state / RNG | Decision | 事务/不逆 | Browser / Simulation 旧入口与删除证据 | 行为证据 |
|---:|---|---|---|---|---|---|---|
| 64 | 4 bonus + firstTake + orange1/purple1 + Turing + Helios三色 + event，共12分支 | Science.TechBonus/TechTile/TechIndustry；只调用下表正式 primitive | `S-P,S-C,S-D,S-T,S-R,S-M;Q-C,Q-D,Q-R` | `D0/D-CARD/#53` | `IR-T` 后按 child 自己的 `IR-C/IR-E` 推进 | `appendResearchTechFollowupEffects/onTechTileTaken/industry_helios_passive_reward` 规则 mutation 零引用 | 12/12 分支 composition trace |

| 分支 | 唯一 owner / primitive | state / RNG | Decision | 边界 |
|---|---|---|---|---|
| `bonus_3f` | Science.TechBonus → players +3 score | `S-P;Q0` | `D0` | `IR-T` 后 child |
| `bonus_1p` | Science.TechBonus → +1 energy | `S-P;Q0` | `D0` | 同上 |
| `bonus_1m` | Science.TechBonus → +1 publicity | `S-P;Q0` | `D0` | 同上 |
| `bonus_1c` | Science.TechBonus → Card Pick | `S-C;Q-C` | `D-CARD` | 选牌/refill 时 `IR-C` |
| first take | Science.TechBonus → +2 score | `S-P,S-T;Q0` | `D0` | 与 bonus 同 child |
| `orange1` | Science.TechTile → free launch | `S-R,S-P;Q-R` | 正式 launch Decision（若有） | rocket entity committed |
| `purple1` | Science.TechTile → gain data ×2 | `S-D,S-P;Q-D` | 满池时可进入 #53 | 两次独立 data result |
| Turing blue | Science.TechIndustry → +1 publicity | `S-P,S-T;Q0` | `D0` | take event 后 |
| Helios orange | Science.TechIndustry → +1 energy并占 orange marker | `S-P,S-T;Q0` | `D0` | 每槽一次 |
| Helios purple | Science.TechIndustry → +1 additionalPublicScan并占 purple marker | `S-P,S-T;Q0` | `D0` | 每槽一次 |
| Helios blue | Science.TechIndustry → gain data并占 blue marker | `S-P,S-D,S-T;Q-D` | 满池时 #53 | 每槽一次 |
| `researchTech` event | Science journal/event ledger | `S-M,S-T;Q0` | child triggers | tile/type/firstTake/actor 完整 |

上述 12 个分支全部属于 #64；Browser
`appendResearchTechFollowupEffects/onTechTileTaken/industry_helios_passive_reward` 的规则 mutation
必须物理删除或变成只读 renderer。

### 6.2 #65–67 卡牌 research 有限表

| # | 卡牌有限语义 | owner / primitive | state/RNG/Decision | 事务与旧删 |
|---:|---|---|---|---|
| 65 | 31 个 `card_research_tech` 共用基础链 | Card Play transaction → Science.Research #59–64 | `S-P,S-T,S-C,S-D,S-R; Q-C,Q-D,Q-R; D-TECH/D-CARD` | card 默认 `skipCost=true`；Card Play 内独立 tile/bonus resolver 零重复 |
| 66 | 颜色/共享/条件 variants | blue(9)、orange(8)、purple(8)、orange-or-purple(1)、any(3)、他人已研究+skipRotate+skipBonus(2，其中1项 publicity==0) | 同 #65；choices 每次重枚举 | `researchedByOthersOnly/requireCondition/skipRotate/skipBonus` 均由 Science options 明确承接 |
| 67 | 4 类 card afterResearchReward | `techTypeCountScore(scorePer=2)`、`resourceValueScore(publicity)`、`publicityIfNotFirstTake(+2)`、`repeatBonus` | `S-P,S-C;Q-C; D0/D-CARD` | after reward 仍归 Card Effect 编排，但 bonus primitive 只调 Science；repeat 不重复 firstTake，skipBonus 时不得触发 |

## 7. Browser / Simulation 旧入口物理删除集

完成不是“新 domain 已接线”，而是以下规则入口归零：

- `randomizer/app/engine-action-executor.js` 文件及
  `engineActionExecutorModule/ENGINE_ACTION_FAMILIES/ENGINE_ACTION_EXECUTOR_REQUIRED` 装配引用。
- `randomizer/app/action-runtime.js` 中 scan/analyze/placeData stage2 provider 和四族规则 dispatch；
  Browser 仅保留标准 action intent 与 Decision submit。
- `randomizer/app/quick-turn-action-executor.js` 的 `place_data` claim/handler。
- `randomizer/app/scan-flow.js` 中 §3 的规则 mutation、host pending、queue/settlement/refill owner；
  可保留只读 projection renderer 和 input adapter，且 production composition 不注入规则 callback。
- `randomizer/app/action-interaction-runtime.js` 的 place bonus/analyze reward 规则 owner。
- `randomizer/app/tech-runtime.js` 的 select/take/rotate/bonus/followup/行业被动规则 owner。
- `randomizer/training/simulation-rule-composition.js` 的四族 unavailable、专用 handler/pending/resolver；
  Simulation 只装同一 Production Domain Pack。
- Card Play 中 §4/#65–67 的独立 scan/research resolver；只保留 card source/options/after reward 编排。
- `randomizer/index.html`、`app/dependencies.js`、`app.js` 只做新 module 装配，且旧 executor script
  与 context port 物理删除。

结构门禁同时断言 `familyOwners/actionOwners/actionExecutorOwners` 四族唯一为 Science，
Browser human/Policy/Simulation 都只持有同一 action/Decision input port；禁止用正常路径
“未观察到旧调用”替代零引用/throw-on-call 证据。

## 8. 取消 run 探索改动审计与处置

当前 dirty worktree 的探索 patch 全部发生在本矩阵冻结前，不可作为实现底稿；逐项结论：

| 文件 | 审计结论 | 冻结后处置 |
|---|---|---|
| `game/effects/science-session.js` | 不合格：scan 只有 cost+单次 target；提前 `settleCompletedSectors` 且只发资源、遗失 trace Decision/Runezu/delayed refill/科技链；place bonus、analyze trace、research followup/industry 均缺；actor context 仍依赖 host callbacks。 | 整体删除，按本矩阵重新批量实现，不摘抄局部 handler。 |
| `game/cards/play-domain.js` | 不合格：只迁 fixed/color/drawn scan 与 research；13 个 card type 未闭合；依赖上述不完整 primitive。 | 恢复基线后按 §4/#65–67 一次性改。 |
| `game/production-composition.js` | owner 切换时机错误：未闭合便 claim 四族。 | 恢复基线；Science domain 全部 executor/Decision 注册并自检后一次切换。 |
| `app/action-runtime.js` | 先删 provider/executor，未证明新 domain 行为完备。 | 恢复基线；集中切换批次再删规则入口。 |
| `app.js`、`app/dependencies.js`、`index.html` | 仅装配删除，但指向不完整 domain。 | 恢复基线；最后装配批次重做。 |
| `app/engine-action-executor.js` | 删除目标正确、时机错误。 | 先恢复；四族集中验证后物理删除。 |
| `app/quick-turn-action-executor.js` | place_data 删除目标正确、时机错误。 | 先恢复；Science owner 切换时删除。 |
| `training/simulation-rule-composition.js` | 仅去掉 unavailable，未提供完整可执行链。 | 恢复基线；正式 composition 证据通过后删除 unavailable。 |

处置规则：不 stash、不保留 pre-freeze hunk；checkpoint 首次交付后把上述生产文件精确恢复到
`56a678a`，再按相同 owner/事务语义实施。

## 9. 批量实现顺序与集中证据

1. **清理批次**：按 §8 恢复所有 pre-freeze 生产改动，只保留本 checkpoint。
2. **Science 根批次**：完整 action definitions、Session owner、working-root context、
   Decision schema、committed RNG/sequences、四族 67 行 executor/followup。
3. **Card 复用批次**：13 type/104 instances 改调 Science primitive，保留 card transaction/
   after reward。
4. **Composition 硬切批次**：Production Domain Pack 一次 claim 四族；Browser/Simulation 同时
   切换；删除 §7 旧入口。
5. **集中验证**（实现完整语义批次后才运行）：
   - 矩阵机械集合与 owner/旧符号结构门禁。
   - Science unit：67 行 auto/Decision/negative contract。
   - Browser/Simulation 同 fixture `E-COMP/E-DEC/E-RNG`。
   - full chain：完整 scan（含 purple1–4、public refill、settlement/trace）→ place_data
     computer/blue bonus → analyze/blue trace；research 12 tiles/4 bonus/全部 followup；
     13 card type/104 实例。
   - 全 legal-action fork、save/restore/replay、唯一 full-flow、全量 Node、真实 Chrome smoke。
   - 最后才跑 fixed-board；它是压力/可达性证据，不负责发现 owner/state/RNG/Decision 设计。

## 10. 冻结自审

- [x] 四族及其递归 effect/bonus/followup 全部列出，共 67 行。
- [x] 卡牌集合从 182 张模型机械导出，13 type/104 instances，variant 明确。
- [x] 每行都有唯一 owner、正式 primitive、working/committed state、RNG/id/sequence。
- [x] 所有非等价选择都有 Decision owner 与 stale/late/wrong-owner/illegal 零副作用语义。
- [x] 每行都有 TX/不可逆边界与正式 composition 行为证据。
- [x] Browser/Simulation 旧入口与物理删除证据完整。
- [x] 取消 run 的每个 dirty 生产文件已审计，且无任何 hunk 被认可为实施底稿。
- [x] fixed-board 被明确放在最终集中验证，不参与首次设计发现。

冻结结论：矩阵已闭合；下一步只能先执行 §8 精确清理，再按 §9 的 owner/事务批次实施。
