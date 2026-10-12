# C 阶段定位：蓝席 techBonusScore=0 的归因（冻结世界当前 113.5 局）

数据源：`seti-saves/seti-save-research-budget-clone-01-20260913-c0189da2-full-v272.json`（终局）。

## 逐席科技所有权与得分

| 席位 | 终局分 | ownedTiles | 数量 | techBonusScore | blueTechScore |
|---|---|---|---|---|---|
| blue | 87 | blue1, orange2, purple2, purple4 | 4 | **0** | 2 |
| green | 135 | blue2, orange2, orange3, purple4 | 4 | **10** | 0 |
| brown | 117 | blue1, blue3, blue4, orange1, orange2, orange3, purple2, purple4 | 8 | **16** | 2 |
| white | 115 | orange2, orange3, orange4, purple2, purple4 | 5 | **9** | 0 |

## 事实

1. **不是"科技少"**：蓝与绿都是 4 块，蓝的 techBonus 却是 0，绿 10。
2. **首拿奖励被别人拿走**：`tech.stacks.blue1.firstTakeClaimedBy = player-brown`——蓝席拿了 blue1，
   但该栈的首拿 +2 早在布朗手里（`science-session.js:435` / `bonuses.js:85` 的 `FIRST_TAKE_TYPE_SCORE`）。
3. **栈的 bonusId 分布**：blue1=bonus_1c、purple2=bonus_1p、purple4=null、orange2=null；
   这几类给的是资源/即时收益，而**分数型 bonus 条件**（`bonuses.js:45` 的 catalog 条件）蓝席没有凑成。
   反观棕席 8 块里有 blue3/blue4/orange1/orange3 等能触发条件的组合，且 `disabledTiles` 显示
   棕席有 3 块被禁用（说明它确实在跑条件型 bonus）。

## 结论（EFFECT-01 的具体形态）

蓝席的 0 分不是"没买科技"，而是**选块时没有按"能否产出分数"排序**：
既没优先抢"首拿未被人拿走"的栈（+2/次，白拿），也没把"条件型 bonus 可达成性"纳入选块估值。
绿席同样 4 块却拿到 10 分，说明这是**可选块集合内的排序错误**，不是资源不足。

## 下一步（下轮直接做）

1. 在科技选块处（`science-session.js` 附近的选择/估值路径）核对当前是否读取
   `firstTakeClaimedBy` 与 bonus 条件可达成性；若未读，加入"首拿可得 + 条件型 bonus 期望"两项估值。
2. 单决策验证：找蓝席实际选块的步骤冷决策对照（期望：改选首拿未被领取的栈）。
3. 完整局验收：蓝席 techBonus 应从 0 抬升，均分目标 ≥120；逐席分账、首差归因、留反例。
