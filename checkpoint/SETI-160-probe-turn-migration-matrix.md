# SETI-160 探测器、行星奖励与回合领域迁移矩阵

冻结基线：`084bada`。集合机械来源：

- 顶层 family：`SetiStandardAction.TOP_LEVEL_FAMILIES` 中 `launch/move/orbit/land/pass/end_turn`。
- 移动方向：`game/abilities/rocket.js:MOVE_DIRECTIONS` 的 `out/cw/ccw/in`，对当前玩家全部 `solar-board` 探测器作笛卡尔积。
- 行星奖励：`game/actions/planet-rewards.js:EFFECT_TYPES` 的 11 个值。
- PASS：`app/turn-end-flow.js:buildPassEffectQueue` 的寰宇超动力、手牌上限、首位旋转、预留精选。
- 回合结束：`app/turn-end-flow.js:endCurrentTurn/finishCurrentTurnAfterAlienReveal` 与 `app/turn-flow.js:advanceTurnAfterPlayerAction`。

唯一 production owner 冻结为 `game/effects/probe-turn-session.js`（domain `probe_turn`）。
它只复用 `game/actions/{launch,orbit,land}`、`game/abilities/rocket`、`game/actions/planet-rewards`,
并直接提交 Composition working root。Browser/Simulation 只提供同一 Standard Action 输入和
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
| 14 | reward income | player income state | 确定性、同 session | Browser-only effect；Simulation unsupported | income delta parity |
| 15 | reward scan_planet_sector | science domain 正式 scan primitive | 若多目标则 `choose_target`；不得 host 代选 | Browser scan-flow；Simulation unsupported | domain handoff + replay |
| 16 | reward choose_nebula_scan | science `choose_target` | owner=行动玩家；完整合法 nebula | Browser picker；Simulation unsupported | Decision parity |
| 17 | reward choose_colored_nebula_scan | science `choose_target` | 同上，颜色约束进入 descriptor | Browser picker；Simulation unsupported | Decision parity |
| 18 | reward alien_trace | science/alien 正式 trace Decision | owner=行动玩家；slot/position stale 重验 | Browser alien picker；Simulation 私有 trace | Decision parity |
| 19 | reward aomomo_card | card domain committed draw/pick | RNG/sequence 同 committed root；必要时 `choose_card` | Browser-only effect；Simulation unsupported | card/entity/replay parity |
| 20 | PASS 寰宇超动力 | industry passive；弱开局 gain credit，否则 free launch | free launch 若多落点仍由正式 launch；必做、不可跳过 | Browser pass effect；Simulation 无此语义 | 两难度分支 parity |
| 21 | PASS 手牌上限 | cards discard Decision | 超 4 张时 `choose_card`，owner=PASS 玩家，精确弃 N | Browser discard picker；Simulation 缺失 | hand/discard/Decision parity |
| 22 | PASS 首位旋转 | solar rotation + `rocket.settleRocketsAfterSolarRotation` | 仅非最终轮且首位 PASS；确定性；奖励 followup 不丢 | Browser effect；Simulation 内联旋转 | solar/pieces/events parity |
| 23 | PASS 预留精选 | cards reserve pile | round 1/2/3；`choose_card` owner=PASS 玩家；空堆确定性跳过 | Browser reserve picker；Simulation pass_reserve | choice/entity parity |
| 24 | PASS commit | turn.passedPlayerIds + pass event | 必做链完成后才允许 end_turn；重复/late PASS 拒绝 | Browser passForCurrentPlayer；Simulation pass provider | pending boundary parity |
| 25 | end_turn income | players income + committed card draws | 仅 PASS；RNG/card sequence committed；最终轮跳过 | Browser applyPassTurnEndIncome；Simulation provider | resources/cards/RNG parity |
| 26 | end_turn alien reveal | alien reveal/session | RNG=`probeTurn`；非等价 opportunity/trace 外显 Decision | Browser reveal queue；Simulation 缺失 | reveal/decision/recovery parity |
| 27 | end_turn industry cleanup/round start | industry formal primitives | 确定性；在 owner 切换前后固定顺序 | Browser-only cleanup/bonus | state/event ordering parity |
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
