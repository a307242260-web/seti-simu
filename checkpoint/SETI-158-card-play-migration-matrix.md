# SETI-158 Card Play / Card Effect Migration Matrix

状态：`FROZEN`（46/46 行闭合并完成机械与根契约自审；生产实现若发现遗漏必须退回本阶段）

## 1. 有限集合与共同根契约

集合唯一来源是 `randomizer/game/cards/effects.js` 的
`Object.keys(CARD_REFERENCE_MAP) -> buildPlayEffects({cardId}) -> effect.type`。
2026-07-24 在当前 182 张 base+DLC 牌上机械导出 **46** 个可达类型；不使用
`EFFECT_TYPES`/`REWARD_TYPES` 常量全集冒充可达集合。每次模型变化必须重新导出并要求
`reachableTypes === matrixTypes`，否则 Production Domain Pack 创建失败。

### 1.1 Production owner

- `CardPlayDomain.PLAY`：唯一拥有 `play_card` 的手牌实体重验、费用、手牌→保留区/弃牌堆迁移、
  `playCard` event、Effect Group 和主行动锁。任何子效果失败，整组回到 base state。
- `CardEffectDomain.<row owner>`：每个可达类型唯一注册一个 game-owned executor/decision
  executor；只能调用本表列出的正式 game primitive，不接受 Browser/Simulation handler map。
- 跨域 primitive 仍由其正式 owner 修改状态：`abilities.scan/rocket/planet/tech`、
  `cards/deck`、`data/state`、`aliens/*`。CardEffect executor 只构造带 card source/cost policy
  的规范 Effect/Decision，不把相似 Standard Action 当卡牌效果。
- `ProductionDomainPack` 从 Standard Action domain 移除 `play_card` claim，改由
  `CardPlayDomain` 同时提供 registry definition 与 Effect domain；Browser、Policy、Simulation
  不得覆盖 owner。

### 1.2 Committed state、RNG、ID 与 sequence

| 代码 | 冻结契约 |
|---|---|
| `S-P` | `players.players[*].resources/income/scoreSources`；只写 Session working root。 |
| `S-C` | `players.hand/reservedCards/cardEffectState` 与 `cards.publicCards/discardPile/drawPileCardIds`。 |
| `S-D` | 玩家 `dataState.poolTokens/placedTokens` 与 committed `meta.sequences.dataToken`。 |
| `S-N` | `data` 星云 token/extra mark/settlement；`meta.sequences.nebulaToken/nebulaReplacement` 必须覆盖实体。 |
| `S-R` | `pieces.rockets/playerRocketSequences`、`solarSystem`、`meta.sequences.rocket`。 |
| `S-L` | `planets` 环绕/登陆/卫星 marker；marker 顺序由数组派生，piece 引用通过 high-coupling invariant。 |
| `S-T` | `tech` supply/bonus 与玩家 `techState`，旋转和 bonus followup 同 Session。 |
| `S-A` | `aliens` slot/trace/species panel 与玩家外星人资源。 |
| `S-M` | `match` 的卡牌流程事件账本及 `turn.cardTurnEventBonuses`；不写 Browser pending。 |
| `Q0` | 无随机、无新实体；稳定排序来自正式 primitive。 |
| `Q-C` | 牌库随机只读写 `meta.rngState.cardPlay`；卡实例只取 `meta.sequences.card`。 |
| `Q-D` | 数据 token 只取 `meta.sequences.dataToken`；生产路径不 restore/reset 模块全局。 |
| `Q-N` | 星云 token/替换 id 只取 committed nebula sequences；恢复不回灌模块全局。 |
| `Q-R` | 探测器 id 只取 `meta.sequences.rocket`；选择排序为稳定 rocket id/方向序。 |

`high-coupling-slices` 必须遍历 hand/reserved/public/discard/pass-reserve 中的 card instance，
以及每位玩家 pool/placed data token，验证实体 id 全局唯一且对应 next sequence 严格大于最大
已用值。`purify → serialize → deserialize → restore → replay` 后完整 committed bytes、
`meta.rngState`、`meta.sequences`、journal/replay cursor 必须一致。禁止 host 私有 sequence，
禁止 production 调 `restoreNext*Sequence`。

### 1.3 唯一 Decision input contract

| 代码 | 冻结契约 |
|---|---|
| `D0` | 确定性 Effect；零或一个等价结果由 runtime 自动 drain。 |
| `D-CARD` | 公开牌/盲抽/手牌/弃牌选择，owner=`action.actorId`。 |
| `D-SCAN` | 星云/扇区/探测器扫描目标选择，owner=`action.actorId`。 |
| `D-MOVE` | 探测器、方向、剩余移动力或 skip，owner=`action.actorId`。 |
| `D-PLANET` | 环绕/登陆/marker/探测器位置选择，owner=`action.actorId`。 |
| `D-TECH` | tech type/tile/rotate/bonus choice，owner=`action.actorId`。 |
| `D-ALIEN` | alien slot/trace/species followup，owner=`action.actorId`。 |
| `D-PAY` | 支付/重复次数/skip，owner=`action.actorId`。 |

所有 `D-*` 必须由 Effect Session `getLegalChoices()` 生成完整 choice，且只通过
`RuleComposition.inputPort.submitDecision` 提交：

1. Browser human：`decision-ui → ActiveDecisionPort → inputPort.submitDecision`。
2. Browser Policy：`PolicyInputAdapter` 重读 boundary、核验 seat/stateVersion/decisionVersion/
   action identity，再调用同一个 Browser input adapter 的 `submitDecision`。
3. Simulation/teacher/frozen opponent：从同一 composition inspection/legal choices 构造
   Policy boundary，再调用同一 `inputPort.submitDecision`；删除
   `simulation-rule-composition` 的 generic pending/resolver。

提交必须带 `decisionId + decisionVersion + ownerId + 完整 choice`。统一拒绝语义：
过期 identity=`EFFECT_DECISION_STALE`；Session 已推进/结束的 late input=
`EFFECT_DECISION_NOT_AWAITING`（无 Session 时 `RULE_COMPOSITION_SESSION_REQUIRED`）；
错 owner=`EFFECT_DECISION_OWNER_MISMATCH`；重枚举后 choice 不存在=
`EFFECT_DECISION_NOT_LEGAL`。四类拒绝均为零 journal、零 replay、零 CAS。

### 1.4 事务、不可逆与证据代码

| 代码 | 冻结契约 |
|---|---|
| `TX` | `PLAY` 在任何 mutation 前验证 actor/action/card instance/cost/全部 effect owner；随后费用、迁牌、全部 effects/decisions 在一个 Session working root；队列清空后唯一 StateStore CAS。 |
| `IR0` | 可撤销到 Effect frame；失败在不可逆屏障前回滚整组。 |
| `IR-H` | 首次翻开隐藏牌前记录 hidden-card irreversible barrier；屏障后失败不得伪装回滚。 |
| `IR-E` | 已对外形成不可逆实体/随机结果时写 journal+rng+barrier，再继续 followup。 |
| `E-AUTO` | 正式 Production Composition 从完整 `play_card` descriptor 执行到单 CAS；核对完整 committed state、Effect/event/history journal。 |
| `E-DEC` | Browser human、Browser Policy、Simulation 各提交同一 Decision；合法结果 bytes 相同，stale/late/wrong-owner/unknown 均零提交。 |
| `E-RNG` | fresh A/A、同实例 A/A、同实例 A/B/A、非零 checkpoint fork、save/restore/replay 比较实体 id、RNG、全部 sequences、journal/replay。 |
| `E-ALL` | 182 张牌逐张构造合法最小 fixture；每个可达 effect 至少一个真实状态执行，且 `reachable=owner=executed=46`。 |

共同旧路径删除集：

- `O-HAND`：`app/hand-flow.js` 的 `executeStandardPlayCard`、规则性
  `handleHandCardPlay` 事务；`engine-action-executor` 的 legacy play flow。
- `O-DISP`：`app/effects/dispatcher.js::executeCardEffect` 中本表全部 card cases，以及
  `app/effects/{rewards,movement-scan,aliens}.js` 中迁走的规则 executor；允许保留 renderer/
  input intent adapter，不得保留 rule mutation。
- `O-SIM`：`training/simulation-rule-composition.js::applySimulationCardEffect`、
  `play_card_effect` pending、`listHandCornerRewardChoices` 与
  `simulationContinuation.resolveDecision` 卡牌分支。
- `O-PUBLIC`：`app/public-api.js::playHandCard` 及直接 `handleHandCardPlay` facade。

删除证据是上述符号/分支零引用、Production Domain Pack `familyOwners.play_card=card_play`、
Browser/Policy/Simulation 三宿主只持有同一 composition input port；不以 source-string unit
代替行为证据，结构审计独立执行。

## 2. 46 类逐项冻结矩阵

表中“来源”同时列出 DSL/model 与旧生产 executor；“状态/确定性”引用 1.2；“Decision”
引用 1.3；所有行继承 `TX`，并在“事务”补差异；“旧删”引用 1.4。

| # | effect type（可达数；代表牌） | 语义来源 / 唯一 production owner / 正式 primitive | committed state / RNG-id-sequence | Decision owner 与拒绝 | 事务 / 不可逆 / CAS | 旧入口 / 删除证据 | 正式 composition 行为证据 |
|---:|---|---|---|---|---|---|---|
| 1 | `alien_trace` (5; b27) | DSL `alien_trace`; 旧 `openAlienTraceRewardEffect`; `CardEffect.AlienTrace` → `aliens.placeFirstTrace` + species trace reward Effect | `S-A,S-P`; `Q0`，现有 trace/panel slot 使用 committed 结构键，不分配模块级实体序列 | `D-ALIEN`; slot/颜色重枚举，统一 stale/late/wrong-owner | `TX,IR0`; placement+species followup 同 CAS | `O-DISP` alien trace case/UI continuation，`O-SIM` | `E-DEC,E-ALL`：未揭示/已揭示、有/无合法 slot |
| 2 | `card_any_sector_scan` (2; b9) | DSL `any_sector_scan`; 旧 `openCardAnySectorScanEffect`; `CardEffect.AnySectorScan` → scan target enumeration + `abilities.scanNebula` | `S-N,S-D,S-P`; `Q-N,Q-D` | `D-SCAN`; 0..7 sector/nebula 完整重枚举 | `TX,IR0`；信号事件先记，扇区结算只在整组尾部 | `O-DISP` ANY_SECTOR_SCAN + rewards picker，`O-SIM` | `E-DEC,E-RNG,E-ALL` |
| 3 | `card_choose_hand_corner_reward` (1; dlc2) | DSL hand corner; 旧 `executeChooseHandCornerRewardEffect`; `CardEffect.HandCornerReward` → deck corner parser + reward/move child Effect | `S-C,S-P,S-R`; `Q0/Q-R` | `D-CARD`，若角标为移动再 `D-MOVE` | `TX,IR0`; 不弃所选牌，只重复角标语义 | `O-DISP` CHOOSE_HAND... + Simulation 特制 pending/resolver | `E-DEC,E-ALL`，资源/数据/移动非等价角标 |
| 4 | `card_conditional_reward` (3; b52) | DSL controlled condition; 旧 `executeConditionalRewardEffect`; `CardEffect.ConditionalReward` → `cardEffects.taskConditionMet/runtime condition` + child Effects | condition 涉及 `S-P,S-C,S-N,S-R,S-L,S-A`; child 决定 Q | `D0`，child 自己声明 Decision | `TX,IR0`; 条件 false 是显式 skipped event，不静默丢 effect | `O-DISP` CONDITIONAL_REWARD + rewards executor | `E-AUTO,E-ALL` 覆盖 true/false 与每种 condition |
| 5 | `card_conditional_sector_scan` (2; dlc22) | DSL conditional scan; 旧 `executeConditionalSectorScanEffect`; `CardEffect.ConditionalSectorScan` → `getMatchingConditionalSectorXs` + scan primitive | `S-N,S-D,S-P`; `Q-N,Q-D` | 多目标 `D-SCAN`，单目标仍生成可审计唯一 choice/自动规则 | `TX,IR0`; repeat/allMatching 展开有界 child queue | `O-DISP` conditional scan + effect-choice-flow helper | `E-DEC,E-RNG,E-ALL` |
| 6 | `card_count_current_income_resource` (3; b42) | DSL count current income; 旧 `executeCountCurrentIncomeResourceEffect`; `CardEffect.CountCurrentIncome` → players income + `initialCards.getIndustryEffect(baseIncome)` | `S-P`; `Q0` | `D0` | `TX,IR0`; 只按高于公司 base 的差值 | `O-DISP` COUNT_CURRENT... rewards case | `E-AUTO,E-ALL`，base/增量/零差 |
| 7 | `card_count_hand_corner_move` (1; b98) | DSL count hand move corner; 旧 `executeCountHandCornerMoveEffect`; `CardEffect.CountHandMove` → deck corner parser + bounded Move child Effects | `S-C,S-R,S-P`; `Q-R` | `D-MOVE`（每个 movement point），owner actor | `TX,IR0`; 点数作为同一 effect 剩余量，可 skip | `O-DISP` COUNT_HAND_CORNER_MOVE + movement UI pending | `E-DEC,E-ALL`，0/1/N 角标 |
| 8 | `card_count_hand_income_resource` (1; b41) | DSL count hand income; 旧 `executeCountHandIncomeResourceEffect`; `CardEffect.CountHandIncome` → `cards.getIncomeCodeForCard` + `players.gainResources` | `S-C,S-P`; `Q0` | `D0` | `TX,IR0` | `O-DISP` COUNT_HAND_INCOME... | `E-AUTO,E-ALL` |
| 9 | `card_count_owned_tech_reward` (1; dlc30) | DSL owned tech count; 旧 `executeCountOwnedTechRewardEffect`; `CardEffect.CountOwnedTech` → player tech state + resource/data primitive | `S-T,S-P`，data 时 `S-D`; `Q0/Q-D` | `D0` | `TX,IR0` | `O-DISP` COUNT_OWNED_TECH... | `E-AUTO,E-RNG,E-ALL`，resource/data 分支 |
| 10 | `card_count_tech_types_reward` (1; dlc34) | DSL max tech type count; 旧 `executeCountTechTypesRewardEffect`; `CardEffect.CountTechTypes` → tech counts + committed draw primitive | `S-T,S-C`; `Q-C` | `D0` | `TX,IR-H`; 按三色最大拥有数盲抽 | `O-DISP` COUNT_TECH_TYPES... | `E-AUTO,E-RNG,E-ALL` |
| 11 | `card_discard_all_hand` (1; dlc32) | DSL discard all; 旧 `executeDiscardAllHandEffect`; `CardEffect.DiscardAllHand` → deck discard + child rewards | `S-C,S-P` + child state; child Q | `D0`，child 自己决策 | `TX,IR0`; 全部实体迁移后按原序插入奖励 | `O-DISP` DISCARD_ALL_HAND | `E-AUTO,E-ALL`，空手/多手牌与实体守恒 |
| 12 | `card_discard_any_for_income` (1; dlc28) | DSL discard any; 旧 `executeDiscardAnyForIncomeEffect`; `CardEffect.DiscardAnyIncome` → multi-card selection + `players.gainIncome` child rewards | `S-C,S-P,S-D`; `Q-C/Q-D`（收入可能抽牌/数据） | `D-CARD` 多选+confirm，owner actor；选择集合每次重验 | `TX,IR-H` 若收入抽牌，否则 `IR0` | `O-DISP` + effect-choice-flow discard_any_income pending | `E-DEC,E-RNG,E-ALL`，0/N 选择、重复 confirm |
| 13 | `card_discard_card_corner_repeat` (1; dlc20) | DSL discard and repeat corner; 旧 `executeDiscardCardCornerRepeatEffect`; `CardEffect.DiscardCornerRepeat` → discard entity + corner reward child | `S-C,S-P,S-D,S-R`; `Q-D/Q-R` | `D-CARD` 后可能 `D-MOVE` | `TX,IR0`; 外星人牌/非法角标不入 legal set | `O-DISP` + effect-choice-flow repeat pending | `E-DEC,E-RNG,E-ALL` |
| 14 | `card_discard_public_corner_rewards` (1; b23) | DSL public discard corners; 旧 `executeDiscardPublicCornerRewardsEffect`; `CardEffect.DiscardPublicCorners` → public entity migration/refill + corner children | `S-C,S-P,S-D,S-R`; `Q-C,Q-D,Q-R` | 公共牌组合 `D-CARD`（若模型固定全弃则 `D0`），move child `D-MOVE` | `TX,IR-H`（补牌揭示） | `O-DISP` DISCAR... + public selection/refill | `E-DEC,E-RNG,E-ALL`，空位/牌库耗尽 |
| 15 | `card_draw_then_scan` (3; b7) | DSL draw then scan; 旧 `openCardDrawThenScanEffect`; `CardEffect.DrawThenScan` → committed blind draw + card scan code + scan primitive | `S-C,S-N,S-D`; `Q-C,Q-N,Q-D` | `D-SCAN`，drawn card identity 固定在 payload | `TX,IR-H`; 抽牌后设屏障，scan/skip 均按模型决定是否弃 drawn card | `O-DISP` DRAW_THEN_SCAN + scan_target pending | `E-DEC,E-RNG,E-ALL` |
| 16 | `card_earth_sector_content_move` (1; b87) | DSL earth content move; 旧 `executeEarthSectorContentMoveEffect`; `CardEffect.EarthContentMove` → solar visible content + rocket move ability | `S-R,S-P`; `Q-R` | `D-MOVE`，只列 Earth sector 合法内容/方向 | `TX,IR0`; 访问事件和到达奖励同 child effect | `O-DISP` EARTH... + rewards/movement picker | `E-DEC,E-ALL` |
| 17 | `card_hand_scan` (1; b137) | DSL hand scan; 旧 `executeHandScanEffect`; `CardEffect.HandScan` → hand card scan choices + `abilities.scanHandCard` | `S-C,S-N,S-D,S-P`; `Q-N,Q-D` | `D-CARD` 再 `D-SCAN`（或单一复合 choice） | `TX,IR0`; 确认后才弃被扫手牌 | `O-DISP` HAND_SCAN + scan-flow pending | `E-DEC,E-RNG,E-ALL` |
| 18 | `card_income` (1; dlc34) | DSL income; 旧 `openCardIncomeEffect`; `CardEffect.Income` → choose hand card + deck income parser + `players.gainIncome` | `S-C,S-P,S-D`; `Q-C/Q-D` | `D-CARD`，无手牌为显式 skipped | `TX,IR-H` 若收入抽牌 | `O-DISP` card_income discard pending | `E-DEC,E-RNG,E-ALL` |
| 19 | `card_land` (6; b29) | DSL card land; 旧 `executeCardLandEffect`; `CardEffect.Land` → `abilities.planet.listLandRequirementsAt/landProbe` + planet reward Effects | `S-R,S-L,S-P,S-D,S-A`; `Q-R,Q-D` | `D-PLANET`；卫星/重复/奖励条件重枚举 | `TX,IR0`; skip base cost，只应用模型 extra/exception；marker+奖励同 CAS | `O-DISP` CARD_LAND + movement-scan land picker | `E-DEC,E-RNG,E-ALL`，主星/卫星/冥王星/无目标 |
| 20 | `card_landing_sector_scan` (1; dlc6) | DSL landing sector; 旧 `executeLandingSectorScanEffect`; `CardEffect.LandingScan` → last landing context + planet location + scan | `S-L,S-N,S-D,S-P`; `Q-N,Q-D` | 目标由刚完成 landing 唯一确定；星云非等价时 `D-SCAN` | `TX,IR0`; 必须消费同组 landing result，禁止读 host last* | `O-DISP` LANDING_SECTOR_SCAN | `E-DEC,E-RNG,E-ALL` |
| 21 | `card_move` (26; b11) | DSL move; 旧 `beginCardMoveEffect`; `CardEffect.Move` → `abilities.rocket.listMoveRequirements/moveProbe` | `S-R,S-P,S-M`; `Q-R` | `D-MOVE`；rocket/direction/remaining/skip，stale 后重算 asteroid cost | `TX,IR0`; source=card、skip base cost，movementPoints 保持单 effect | `O-DISP` CARD_MOVE/FREE_MOVE + movement UI pending | `E-DEC,E-ALL`，1/N 点、小行星2点、turn modifier |
| 22 | `card_optional_discard_scan` (1; b94) | DSL optional discard scan; 旧 `executeOptionalDiscardScanEffect`; `CardEffect.OptionalDiscardScan` → bounded repeated hand scan/skip | `S-C,S-N,S-D`; `Q-N,Q-D` | `D-CARD/D-SCAN/D-PAY(skip)` | `TX,IR0`; 至多 N 次，每次重新枚举手牌 | `O-DISP` OPTIONAL_DISCARD_SCAN + scan pending | `E-DEC,E-RNG,E-ALL` |
| 23 | `card_orbit` (1; dlc30) | DSL card orbit; 旧 `executeCardOrbitEffect`; `CardEffect.Orbit` → orbit requirements/orbitProbe + planet rewards | `S-R,S-L,S-P,S-D,S-A`; `Q-R,Q-D` | `D-PLANET` | `TX,IR0`; skip base action cost，piece→marker 原子迁移 | `O-DISP` CARD_ORBIT + movement-scan picker | `E-DEC,E-RNG,E-ALL` |
| 24 | `card_pay_credits_for_reward` (1; dlc17) | DSL pay per reward; 旧 `executePayCreditsForRewardEffect`; `CardEffect.PayCredits` → bounded payment Decision + reward child | `S-P` + child; child Q | `D-PAY` 每次 pay/skip；余额变化后重枚举 | `TX,IR0`; 不能预生成超过余额的 host pending | `O-DISP` PAY_CREDITS... + effect-choice-flow | `E-DEC,E-ALL`，0/1/N credits |
| 25 | `card_pick_card_corner_reward` (1; b48) | DSL pick + corner; 旧 `executePickCardCornerRewardEffect`; `CardEffect.PickCorner` → public/blind pick + selected card corner child | `S-C,S-P,S-D,S-R`; `Q-C,Q-D,Q-R` | `D-CARD`，move child `D-MOVE` | `TX,IR-H` 对 blind/refill；被选牌留手不因角标弃置 | `O-DISP` PICK_CARD_CORNER... | `E-DEC,E-RNG,E-ALL` |
| 26 | `card_planet_sector_scan` (12; b61) | DSL planet sector scan; 旧 `executePlanetSectorScanEffect`; `CardEffect.PlanetSectorScan` → committed planet location + scan primitive | `S-R,S-N,S-D,S-P`; `Q-N,Q-D` | planet fixed；当前 sector 多星云时 `D-SCAN` | `TX,IR0`; repeat 展开有界、同组尾部结算 sector | `O-DISP` PLANET_SECTOR_SCAN | `E-DEC,E-RNG,E-ALL`，旋转前后位置 |
| 27 | `card_pluto_reserve` (1; b139) | DSL special reserve; 旧 `executePlutoReserveEffect`; `CardEffect.PlutoReserve` → `ensureCardEffectState` | `S-C`; `Q0` | `D0` | `TX,IR0`; card 必须已在 reserved，初始化 orbit/land flags 不造普通 planet | `O-DISP` PLUTO_RESERVE | `E-AUTO,E-ALL` |
| 28 | `card_probe_location_reward` (1; b89) | DSL probe location reward; 旧 `executeProbeLocationRewardEffect`; `CardEffect.ProbeLocationReward` → rocket location filter + reward child | `S-R,S-P,S-D`; child Q | 多 probe `D-MOVE`（选择 probe，非移动），无目标显式 skip | `TX,IR0` | `O-DISP` PROBE_LOCATION... + effect-choice-flow | `E-DEC,E-ALL` |
| 29 | `card_probe_sector_scan` (12; b22) | DSL probe scan; 旧 `executeProbeSectorScanEffect`; `CardEffect.ProbeSectorScan` → rocket location + adjacent rules + scan | `S-R,S-N,S-D,S-P`; `Q-N,Q-D` | `D-SCAN` 含 probe/sector/nebula；owner option 可含 opponent probe | `TX,IR0`; repeat/maxTargets 有界 | `O-DISP` PROBE_SECTOR_SCAN + movement-scan picker | `E-DEC,E-RNG,E-ALL` |
| 30 | `card_probe_stack_reward` (1; dlc38) | DSL probe stack; 旧 `executeProbeStackRewardEffect`; `CardEffect.ProbeStackReward` → `cardEffects.getProbeStackRewardMatch` + child rewards | `S-R` + child; child Q | `D0` | `TX,IR0`; opponent probe 计数，条件 false 显式记录 | `O-DISP` PROBE_STACK_REWARD | `E-AUTO,E-ALL` |
| 31 | `card_public_scan` (6; b5) | DSL public scan; 旧 `openCardPublicScanEffect`; `CardEffect.PublicScan` → public card scan parser + `abilities.scanPublicCard` | `S-C,S-N,S-D,S-P`; `Q-C,Q-N,Q-D` | `D-CARD` 选 1..N 公共牌，再 `D-SCAN`；min/max 按模型 | `TX,IR-H`（refill 揭牌）；先留空位，flow 尾统一补牌 | `O-DISP` PUBLIC_SCAN + scan-flow/card selection pending | `E-DEC,E-RNG,E-ALL` |
| 32 | `card_register_event_bonus` (16; b11) | DSL event bonus; 旧 `executeRegisterEventBonusEffect`; `CardEffect.RegisterEventBonus` → committed event-bonus record consumed by ability events | `S-M`; `Q0` | `D0`；未来事件 child 自己 Decision | `TX,IR0`; duration=flow/turn 明确，usedKeys committed，distinctBy 去重 | `O-DISP` REGISTER_EVENT_BONUS + actionEffectFlow host bonus | `E-AUTO,E-ALL`，16 variants + duplicate event |
| 33 | `card_remove_orbit_to_probe` (1; dlc19) | DSL remove orbit to probe; 旧 `executeRemoveOrbitToProbeEffect`; `CardEffect.RemoveOrbitProbe` → planet marker removal + rocket creation | `S-L,S-R`; `Q-R` | `D-PLANET` 选择己方 orbit marker | `TX,IR0`; marker→piece 原子、允许忽略普通 rocket limit | `O-DISP` REMOVE_ORBIT_TO_PROBE + effect-choice-flow | `E-DEC,E-RNG,E-ALL` |
| 34 | `card_remove_planet_marker` (2; b13) | DSL remove marker; 旧 `openRemovePlanetMarkerPicker`; `CardEffect.RemovePlanetMarker` → list/remove orbit/land/satellite/pluto marker | `S-L,S-C`; `Q0` | `D-PLANET`; owner/kind 完整重验 | `TX,IR0`; 普通 marker 删除后数组顺序派生重排 | `O-DISP` REMOVE_PLANET_MARKER + movement-scan picker | `E-DEC,E-ALL` |
| 35 | `card_research_tech` (31; b4) | DSL research tech; 旧 `executeCardResearchTechEffect`; `CardEffect.ResearchTech` → `abilities.tech.prepare/select/take/rotate/bonus` | `S-T,S-P,S-C,S-D,S-R`; `Q-C,Q-D,Q-R` | `D-TECH` 多阶段；每阶段 owner actor、identity 递增 | `TX,IR-H` 若 bonus 抽牌；skip base cost，仅模型 extra cost | `O-DISP` RESEARCH_TECH + tech-runtime pending | `E-DEC,E-RNG,E-ALL`，12 variants/无可拿/旋转/bonus |
| 36 | `card_return_played_card_to_hand_if` (3; dlc1) | DSL return if; 旧 `executeReturnPlayedCardToHandIfEffect`; `CardEffect.ReturnPlayed` → runtime condition + exact played instance migration | `S-C,S-L,S-R`; `Q0` | `D0` | `TX,IR0`; 只移动本组 sourceCardInstanceId，不按 cardId 猜 | `O-DISP` RETURN_PLAYED... | `E-AUTO,E-ALL`，true/false/marker condition |
| 37 | `card_return_unfinished_task_to_hand` (1; dlc29) | DSL return unfinished task; 旧 `executeReturnUnfinishedTaskToHandEffect`; `CardEffect.ReturnTask` → reserved task legality + entity migration | `S-C`; `Q0` | 多目标 `D-CARD` | `TX,IR0`; 不允许已完成/自身/外星人非法目标 | `O-DISP` RETURN_UNFINISHED... | `E-DEC,E-ALL` |
| 38 | `card_scan_action` (9; b9) | DSL expand scan action; 旧 `expandCardScanActionEffect`; `CardEffect.ScanAction` → `scanEffects.buildScanEffectQueue` 的 game-owned 等价 builder | `S-N,S-D,S-P,S-C,S-T`; `Q-C,Q-N,Q-D` | scan payment/公共牌/星云为相应 `D-PAY/D-CARD/D-SCAN` | `TX,IR-H` 若补牌；base scan cost skipped，科技追加成本保留；finalize 唯一 | `O-DISP` SCAN_ACTION + scan-flow queue owner | `E-DEC,E-RNG,E-ALL` |
| 39 | `card_scan_color_choice` (10; b3) | DSL colored scan; 旧 `openCardColorScanEffect`; `CardEffect.ColorScan` → `NEBULA_IDS_BY_COLOR` + scan primitive | `S-N,S-D,S-P`; `Q-N,Q-D` | `D-SCAN` 两目标，颜色与 availability 重验 | `TX,IR0`; repeat 独立 Decision step | `O-DISP` SCAN_COLOR_CHOICE | `E-DEC,E-RNG,E-ALL` |
| 40 | `card_scan_nebula` (14; b1) | DSL fixed scan; 旧 `executeCardFixedNebulaScanEffect`; `CardEffect.FixedScan` → `abilities.scanNebula` | `S-N,S-D,S-P`; `Q-N,Q-D` | `D0`（固定目标），无数据时显式 skipped | `TX,IR0`; repeat 有界，sector finalize 在组尾 | `O-DISP` SCAN_NEBULA | `E-AUTO,E-RNG,E-ALL` |
| 41 | `card_tuck_played_card_to_income` (3; b42) | DSL tuck played; 旧 `executeTuckPlayedCardToIncomeEffect`; `CardEffect.TuckPlayedIncome` → exact played instance + income parser/players.gainIncome | `S-C,S-P,S-D`; `Q-C,Q-D` | `D0`，收入 child 自己决策 | `TX,IR-H` 若收入抽牌；从 discard 移除 exact instance | `O-DISP` TUCK_PLAYED... | `E-AUTO,E-RNG,E-ALL` |
| 42 | `draw_cards` (3; b83) | DSL draw; 旧 `executeDrawCardsRewardEffect`; `CardEffect.DrawCards` → committed deck blind draw | `S-C`; `Q-C` | `D0` | `TX,IR-H`; 每张抽牌 rng cursor+1、card sequence+1 | `O-DISP` reward draw executor + Simulation simplified branch | `E-AUTO,E-RNG,E-ALL` |
| 43 | `gain_data` (11; b74) | DSL gain data; 旧 `executeGainDataRewardEffect`; `CardEffect.GainData` → `data.gainData({root})` | `S-D,S-P`; `Q-D` | `D0` | `TX,IR0`; 池满产生 discardedCount/显式 result，不消耗 sequence | `O-DISP` gain data + Simulation simplified branch | `E-AUTO,E-RNG,E-ALL`，实体 id/full bytes/restore/replay |
| 44 | `gain_resources` (35; b74) | DSL gain resources; 旧 `executeGainResourcesRewardEffect`; `CardEffect.GainResources` → `players.gainResources` + score source primitive | `S-P`; `Q0` | `D0` | `TX,IR0`; resource limits/score semantics沿用 primitive | `O-DISP` gain resources + Simulation simplified branch | `E-AUTO,E-ALL`，9 variants/limit |
| 45 | `launch` (18; b21) | DSL launch; 旧 `executeLaunchRewardEffect`; `CardEffect.Launch` → `abilities.rocket.launchProbe` + arrival/industry child Effects | `S-R,S-P,S-N,S-D`; `Q-R,Q-N,Q-D` | 位置/特殊 followup 非等价时 `D-MOVE`/专属 Decision；普通 Earth launch `D0` | `TX,IR0`; card skipCost/cost override，rocket limit 与被动沿用 primitive | `O-DISP` LAUNCH reward + Browser launch helper | `E-DEC,E-RNG,E-ALL`，skip/default/override cost |
| 46 | `pick_card` (5; b13) | DSL pick card; 旧 `openPickCardRewardEffect`; `CardEffect.PickCard` → public/blind deck selection+refill | `S-C`; `Q-C` | `D-CARD` public slots + blind（若允许）；重验实体/slot | `TX,IR-H` 对 blind/refill；公开拿牌本身可撤销直到 refill 揭示 | `O-DISP` PICK_CARD reward/card selection pending | `E-DEC,E-RNG,E-ALL` |

## 3. 批量实现分组（矩阵冻结后才可执行）

1. **根 owner 批次**：`meta.sequences.card/dataToken/nebulaToken/nebulaReplacement/rocket`
   与 high-coupling invariant；统一 Browser/Policy/Simulation Decision submission。
2. **确定性 card-local 批次**：#4、#6、#8、#11、#27、#30、#32、#36、#44。
3. **card entity/RNG 批次**：#10、#12–15、#17–18、#22、#25、#31、#37、#41–43、#46。
4. **scan 批次**：#2、#5、#19–20 的 scan followup、#26、#29、#38–40。
5. **rocket/planet 批次**：#7、#16、#19、#21、#23、#28、#33–34、#45。
6. **tech/alien 批次**：#1、#9、#35。
7. **集中切换/删除**：Production Domain Pack 一次 claim 全集；删除 `O-HAND/O-DISP/O-SIM/O-PUBLIC`；
   之后才运行 `E-AUTO/E-DEC/E-RNG/E-ALL`、全量 Node、唯一 full-flow、真实 Chrome smoke。

任何批次发现 owner/state/RNG/Decision 未被本矩阵覆盖，立即退回设计冻结，禁止以新增单个
handler 或修改测试期望继续推进。

## 4. 自审清单

- [x] 机械导出集合与 46 行一一相等，无常量全集/少枚举。
- [x] 每行都有唯一 executor owner 与真实 primitive，无 host handler 注入。
- [x] 每行列出 committed slices 与 RNG/id/sequence；所有实体 sequence 均 root-owned。
- [x] 每个非等价选择都有 Decision owner 和四类拒绝语义。
- [x] 每行都继承单 Session/单 CAS，并标记 hidden-info barrier。
- [x] 每行列出旧 Browser/Simulation 路径和可执行的删除证据。
- [x] 每行有正式 Production Composition 行为证据，不以静态 label 代替。
- [x] Browser human、Browser Policy、Simulation 三者只走同一 submitDecision port。
- [x] 批量实现顺序不会先把不完整 domain 接入 production registry。

自审机械结果：

```json
{
  "reachableCount": 46,
  "rowCount": 46,
  "numberingOk": true,
  "missing": [],
  "extra": [],
  "duplicates": []
}
```

根契约反例复核：

- `gain_data` 若走模块全局 `dataTokenSequence`，Browser/Simulation 完整 committed bytes 不同；
  已由 `Q-D/E-RNG` 阻断，不能以省略 token id 的 semantic summary 验收。
- Browser human/Policy/Simulation 任一路省略 `ownerId` 或直接调用领域 resolver，均违反 1.3；
  root batch 必须先使三路 submission shape 完全一致。
- 任何未覆盖类型在 Production Domain Pack claim `play_card` 前都是设计错误；registry 只在
  46 个 executor/decision executor 全部注册且 `reachable=owner` 后一次切换。
