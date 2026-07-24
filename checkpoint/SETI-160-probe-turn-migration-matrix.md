# SETI-160 探测器、行星奖励与回合领域迁移矩阵

冻结基线：`084bada`。集合机械来源：

- 顶层 family：`SetiStandardAction.TOP_LEVEL_FAMILIES` 中 `launch/move/orbit/land/pass/end_turn`。
- 移动方向：`game/abilities/rocket.js:MOVE_DIRECTIONS` 的 `out/cw/ccw/in`，对当前玩家全部 `solar-board` 探测器作笛卡尔积。
- 行星奖励：`game/actions/planet-rewards.js:EFFECT_TYPES` 的 11 个值。
- PASS：`app/turn-end-flow.js:buildPassEffectQueue` 的寰宇超动力、手牌上限、首位旋转、预留精选。
- 回合结束：`app/turn-end-flow.js:endCurrentTurn/finishCurrentTurnAfterAlienReveal` 与 `app/turn-flow.js:advanceTurnAfterPlayerAction`。

`launch/move/orbit/land`、11 类行星奖励的编排与纯回合 sequencing 的 production owner
冻结为 `game/effects/probe-turn-session.js`（domain `probe_turn`）。公司、收入、外星人、
卡牌触发与终局计分的实际语义及其 Decision 属于 SETI-163 对应 game domain；`probe_turn`
只能按 `seti-game-domain-handoff-v1` 生成 `domain/effectType/ownerId/data` handoff，并在
handoff 完成后继续纯回合推进，不得 import `industry` 或逐物种模块，也不得复制 species switch。
Browser/Simulation 只提供同一 Standard Action 输入和
Decision 提交，不拥有规则分支。每次 action/choice 由公共 registry 在同一
`stateVersion/decisionVersion/actorId` 下重枚举；wrong-owner/stale/late 均在 mutation 前拒绝。
一次外部提交只在全部费用、实体迁移、奖励/Decision 建立成功后递增一次 decisionVersion；
异常恢复完整 root 快照。

| # | 语义项 | 正式 primitive / committed state | Decision、确定性与事务边界 | 旧入口与删除证据 | 正式行为证据 |
|---|---|---|---|---|---|
| 1 | launch | `actions.launch`; players/resources, pieces/rocket sequence | 无非等价选择；实体 id 来自 committed sequence；费用+实体一次 CAS | `app/primary-board-action-executor`; Simulation launch provider | 双 host 同 descriptor/state/events |
| 2 | move × 全部自己的探测器 × out | `rocket.listMoveRequirements` + `moveProbe`; players/resources, pieces | 支付为 `choose_payment`；目标/费用重验；不得只取最后一枚 | Browser move provider/caller；Simulation move provider | 多探测器逐实体枚举与执行 parity |
| 3 | move × 全部自己的探测器 × cw | 同上 | 同上；稳定排序为 rocket id 后方向表顺序 | 同上 | 同上 |
| 4 | move × 全部自己的探测器 × ccw | 同上 | 同上 | 同上 | 同上 |
| 5 | move × 全部自己的探测器 × in | 同上 | 同上 | 同上 | 同上 |
| 6 | orbit | `actions.orbit`; resources, pieces, planets/aliens | rocket/planet 是 descriptor 目标；费用与 marker capacity 重验；移除+标记一次 CAS | Primary Board executor；Simulation wrapper reward | 逐 rocket/planet/cost/marker parity |
| 7 | land planet | `actions.land`; resources, pieces, planets/aliens | 费用=`3 - 任意轨道标记 - orange3`；目标重验；移除+标记一次 CAS | Primary Board executor；Simulation land provider | 有/无轨道及科技折扣 parity |
| 8 | land satellite | `actions.land`; orange4、satellite occupancy | satelliteId 外显；费用同 planet；target stale 拒绝 | Browser land picker 规则；Simulation provider | 全合法 satellite parity |
| 9 | reward gain_resources | `planetRewards` descriptor + `players.gainResources` | 确定性；与 orbit/land 同 session | Browser effect executor；Simulation 私有实现 | 完整资源 delta/event |
| 10 | reward gain_data | `data.gainData` | 每枚 token 顺序稳定；容量溢出事件明确 | 同上 | data pool/available delta |
| 11 | reward launch | 复用 launch ability，`skipCost` | 如存在实体槽不足则原子失败；id committed | Browser-only effect；Simulation unsupported | 双 host reward launch |
| 12 | reward draw_cards | `cards.blindDraw` | RNG=`meta.rngState.probeTurn`；card id/sequence committed | Browser-only effect；Simulation unsupported | RNG/cursor/card parity |
| 13 | reward pick_card | `choose_card` Decision | owner=行动玩家；slot 重验；一次独立 journal step | Browser picker；Simulation unsupported | choice/stale/wrong-owner |
| 14 | reward income | SETI-163 income domain；`probe_turn` 发 `planet_reward_income` handoff | income owner 生成其 Decision/RNG/id；同 session 等待完成 | Browser-only effect；Simulation unsupported | handoff + income domain parity |
| 15 | reward scan_planet_sector | science domain 正式 scan primitive | 若多目标则 `choose_target`；不得 host 代选 | Browser scan-flow；Simulation unsupported | domain handoff + replay |
| 16 | reward choose_nebula_scan | science `choose_target` | owner=行动玩家；完整合法 nebula | Browser picker；Simulation unsupported | Decision parity |
| 17 | reward choose_colored_nebula_scan | science `choose_target` | 同上，颜色约束进入 descriptor | Browser picker；Simulation unsupported | Decision parity |
| 18 | reward alien_trace | science/alien 正式 trace Decision | owner=行动玩家；slot/position stale 重验 | Browser alien picker；Simulation 私有 trace | Decision parity |
| 19 | reward aomomo_card | card domain committed draw/pick | RNG/sequence 同 committed root；必要时 `choose_card` | Browser-only effect；Simulation unsupported | card/entity/replay parity |
| 20 | PASS 公司分支（含寰宇超动力） | SETI-163 company domain；`probe_turn` 只发 `company_pass` handoff | company domain 判断 Huanyu/弱开局并拥有其 followup/Decision；handoff 完成前 PASS 链不得越过 | Browser pass effect；Simulation 无此语义 | handoff schema/order；公司语义由 SETI-163 验证 |
| 21 | PASS 手牌上限 | cards discard Decision | 超 4 张时 `choose_card`，owner=PASS 玩家，精确弃 N | Browser discard picker；Simulation 缺失 | hand/discard/Decision parity |
| 22 | PASS 首位旋转 | solar rotation + `rocket.settleRocketsAfterSolarRotation` | 仅非最终轮且首位 PASS；确定性；奖励 followup 不丢 | Browser effect；Simulation 内联旋转 | solar/pieces/events parity |
| 23 | PASS 预留精选 | cards reserve pile | round 1/2/3；`choose_card` owner=PASS 玩家；空堆确定性跳过 | Browser reserve picker；Simulation pass_reserve | choice/entity parity |
| 24 | PASS commit | turn.passedPlayerIds + pass event | 必做链完成后才允许 end_turn；重复/late PASS 拒绝 | Browser passForCurrentPlayer；Simulation pass provider | pending boundary parity |
| 25 | end_turn income | SETI-163 income domain；`probe_turn` 只发 `pass_income` handoff | 仅 PASS 且非最终轮生成；资源、抽牌 RNG/id、Fundamentalism 与收入 Decision 全由 income/company owner 执行 | Browser applyPassTurnEndIncome；Simulation provider | handoff schema/order；收入语义由 SETI-163 验证 |
| 26 | end_turn alien reveal | SETI-163 alien domain；`probe_turn` 只发 `turn_end_reveal` handoff | reveal RNG、八物种 initialize、opportunity/trace Decision 全由 alien owner 执行；probe 无 species switch | Browser reveal queue；Simulation 缺失 | handoff schema/order；揭示与 Decision 由 SETI-163 验证 |
| 27 | end_turn company/card cleanup 与 round start | SETI-163 company/card-trigger domain；`probe_turn` 在纯 advance 前后发 handoff | `turn_end` 在 owner 切换前；跨轮后发 `round_transition/round_start`；公司、卡牌、Fundamentalism 实际语义不得进入 turn-flow | Browser-only cleanup/bonus | handoff/advance 顺序；领域语义由 SETI-163 验证 |
| 28 | end_turn owner/round/game advance | `advanceTurnAfterPlayerAction` | active/passed/start/current/round/turn/gameEnded 一次 commit | Browser turn-flow；Simulation provider | 完整 turn state parity |
| 29 | solar rotation 通用结算 | solar + rocket rotation settlement | rotation/wheelSteps/pieces 同 committed root；无 host callback | `app/turn-flow:rotateSolarOrbit` 与 Simulation helper | 独立 rotation checkpoint parity |

## 反例与删除门禁

1. 两枚同色探测器分别位于不同格：两者各四方向都必须按正式 legality 出现在枚举中；任何
   `reverse().find()`、按颜色或 selected/last rocket 缩水均失败。
2. 同一登陆状态分别切换 orange3 与既有轨道标记：费用必须为 3/2/2/1，枚举 payload 与执行扣费一致。
3. 对 11 个 reward type 逐项执行；任何 `SIMULATION_PLANET_REWARD_UNSUPPORTED` 或 host fallback 调用失败。
4. 提交 stale/wrong-owner move payment、reward choice、PASS choice：root、RNG、sequence、journal 均不变。
5. Browser 与 Simulation 从同 checkpoint 提交同 descriptor/choices，比较完整 committed root、
   Decision、events/journal、RNG/sequence 与恢复后的再次枚举。
6. 完成后以下生产符号零引用：`SetiPrimaryBoardActionExecutor`,
   Simulation 的 `family: "move"/"pass"/"end_turn"` 注册、`applyPlanetRewardEffects`,
   `SIMULATION_PLANET_REWARD_UNSUPPORTED`，以及 app/action-runtime 对六族的 family 路由。

## 实施后人工逐项审计

| 矩阵项 | 审计结论 | production evidence |
|---|---|---|
| 1 | 完成 | `probe_turn` 的 launch definition/executor 复用正式 launch action，成功后才标记主行动完成 |
| 2–5 | 完成 | 对全部己方 `solar-board` 探测器按稳定 id × `MOVE_DIRECTIONS` 顺序枚举；支付 Decision 穷举移动牌子集与能量差额 |
| 6 | 完成 | orbit descriptor 外显 rocket/planet，执行期由正式 action 重验费用、位置和 marker capacity |
| 7–8 | 完成 | land descriptor 外显 rocket/planet/satellite 与正式 `energyCost`；正式 action 统一重验轨道、orange3 和 orange4 |
| 9–19 | 完成 | 11 个 `EFFECT_TYPES` 均在 `probe_turn_reward` exhaustive dispatch；资源/数据/发射/抽牌在本 owner 结算，science 与 alien 语义分别转交正式 Decision/effect handoff |
| 20 | 完成（边界） | PASS 首 effect 固定为版本化 `company_pass` handoff；`probe_turn` 不判断 Huanyu、不执行弱开局或免费发射 |
| 21 | 完成 | 手牌超过 4 张时枚举精确弃 N 张组合，resolve 后同步手牌、弃牌堆与 handSize |
| 22、29 | 完成 | 首位非终轮 PASS 调用 `game/turn-flow.rotateSolarSystem`；rotation/wheelSteps/rocket settlement 同 root 提交 |
| 23 | 完成 | 第 1–3 轮从 committed reserve pile 枚举 `choose_card`，resolve 时重验实体 |
| 24 | 完成 | `PASS_COMMIT` 位于全部必做 effect 之后，才写 passedPlayerIds/mainActionCompleted/passCompletionPending |
| 25 | 完成（边界） | 非最终轮 PASS 的 end_turn 在 advance 前发 `income/pass_income` handoff；本 domain 不读 income、不抽牌 |
| 26 | 完成（边界） | end_turn 在 advance 前发 `alien/turn_end_reveal` handoff；本 domain 无 alien import、无八物种 switch、无 opportunity Decision |
| 27 | 完成（边界） | advance 前发 company/card `turn_end`，跨轮后发 card `round_transition` 与 company `round_start`；`game/turn-flow` 只改 turn/player 与太阳系状态 |
| 28 | 完成 | `game/turn-flow.advanceTurnAfterPlayerAction` 唯一修改 completed/passed/active/start/current/round/turn/gameEnded |

静态删除审计：`SetiPrimaryBoardActionExecutor` 文件、依赖和调用已删除；Simulation
move/pass/end_turn provider、move/pass continuation 分支、`applyPlanetRewardEffects` 与
`SIMULATION_PLANET_REWARD_UNSUPPORTED` 已删除；Browser 顶层移动箭头直接提交 production
descriptor，Quick/Turn executor 不再声明 pass/end_turn。

## full-flow v4 新语义流程

固定 seed `seti-116-standard-flow-v2` 完成九个 setup `choose_payment` 后：

1. 白方有 4 credits、3 energy，手牌含两张移动牌 `dlc_41.png` 与 `b_113.webp`；
   太阳系地球与发射坐标均为 `[3,1]`。
2. `launch` 创建 R5 于 `[3,1]`，只消耗 2 credits。
3. `move(R5,cw)` 从 `[3,1]` 到 `[4,1]`，起点不是小行星，正式
   `getRequiredMovePointsFromCoordinate` 返回 1；选择纯 energy 支付，energy 3→2。
4. `move(R5,ccw)` 回到 `[3,1]`，同样支付 1 energy，energy 2→1。
5. `move(R5,out)` 到 `[3,2]` 小行星；移动费用由起点 `[3,1]` 决定，支付 1 energy，
   energy 1→0。
6. `move(R5,in)` 离开 `[3,2]` 小行星；未拥有 orange2，正式 primitive 返回
   2 移动力。一次选择 `dlc_41.png` 与 `b_113.webp` 两个 committed card instance
   支付，R5 回到 `[3,1]`，hand 4→2，两张牌进入 discard。

recorder 只按上述 `family + rocketId + direction + payment mode/cardId` 解析每一步，
每个语义 selector 必须唯一；maskIndex 仅作为 recorder 输出，不参与选择。最终不存在
pending Decision 或 active Effect Session。
