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

## 追加（Round 13）：真正的形态是"研究科技的次数/优先级"，不是单块权重

重放步表里各席 `research_tech` 次数：

| 席位 | 次数 | 步号 |
|---|---|---|
| blue | **2** | 107, 361 |
| green | 4 | 128, 183, 357, 485 |
| white | 3 | 81, 278, 440 |
| brown | **5** | 90, 137, 236, 474, 571 |

蓝席终局 4 块里只有 2 块来自 `research_tech`，另 2 块来自公司借用（`industryBorrowedTechTileId`）。

并且 `expected-score-evaluator.js` 的科技选块注释明确写着：
**"即时收益（背面 bonus/首发分/扣宣传）不预估——反事实搜索真实结算进叶价值。"**
所以"选块权重漏了首拿分"这个假设不成立——即时分是设计上交由搜索叶值结算的。

因此 C 这条缺口的形态是：**蓝席研究科技的次数（2）远低于棕（5）/绿（4），且科技分来自次数×条件 bonus**。
下一步不是改单块权重，而是查：蓝席在哪些步本可研究科技却选了别的（宣传是否短缺、其他动作是否被高估），
以及蓝席两次研究是否都落在"首拿已被领走/条件不成立"的时机上。

## 追加（Round 18）：蓝席的公司能力是"借科技"，全场只用了 1 次

各席初始公司与公司能力使用次数（重放统计）：

| 席位 | 公司 | 能力 | 使用次数 | 使用步 |
|---|---|---|---|---|
| blue | **图灵系统** | `turing_borrow_tech`（借科技） | **1** | 525（R4） |
| green | 寰宇动力 | `huanyu_free_moves` | 4 | 36/214/378/511 |
| white | 深空探测 | `deepspace_swap_cards` | 3 | 239/421/481 |
| brown | 赫利昂联合体 | `helios_remove_tech_income` | 3 | 265/324/457 |

这解释了蓝席科技构成的"2 研究 + 2 借用"：它唯一一次借用在第 4 轮（步 525），**前三轮完全没用**。

动作族分布对照（合计）：

| 族 | blue | green | white | brown |
|---|---|---|---|---|
| quick_trade | **1** | 7 | 3 | 1 |
| industry | **1** | 4 | 3 | 3 |
| research_tech | 2 | 4 | 3 | 5 |
| card_corner | 2 | 5 | 1 | 2 |
| **总动作数** | 132 | 165 | 165 | 116 |

即：蓝席的结构性动作（choose_target 37 / place_data 13 / move 7）与别人持平甚至更多，
但**"引擎类"动作（quick_trade / industry / research / card_corner）全面偏低**。
最低分（87）与"引擎不用"高度一致。

## 下一步（具体到能力语义）

1. 查 `turing_borrow_tech` 的规则与触发条件（是否每轮一次、是否有宣传/资源成本、
   是否依赖"活跃科技"状态——仓库里恰有 `turing-active-tech.test.js` / `turing-immediate-expiry.test.js`）；
2. 判定为什么只用了 1 次：能力不满足条件（状态/资源）、候选枚举没摆上桌、还是被其他动作压过；
3. 改一处 → 冷决策对照（蓝席回合，期望它开始按轮使用借科技）→ 完整局验收
   （蓝席 techBonus/科技数抬升、均分目标 ≥120、逐席分账 + 首差归因 + 留反例）。

## 追加（Round 19）：纠正——图灵"借科技"不产生 techBonus

`randomizer/game/industry/abilities.js:457-462` 的实现提示：

> `turing_borrow_tech`：请选择一项橙色或紫色科技**借用当前回合效果**（**不获得板块与 bonus**）

即：借用只给**当回合的科技效果**，不给板块、不给 bonus。因此：

- 我上一轮"多用借科技就能抬高 techBonus"的因果推断**不成立**，在此纠正。
- 蓝席终局 4 块（blue1/orange2/purple2/purple4）不是借来的：2 块来自研究，另 2 块需另找来源。
- AI 侧还有 `selectNonredundantTuringActions`（筛掉效果与分支内已有状态冗余的借用候选），
  说明"用得少"部分可能是设计使然（借用是情境性的，不是每轮白拿的引擎）。

## 修正后的剩余问题

蓝席与绿席都是 4 块科技，绿 10 分、蓝 0 分。差别更可能在**首拿时机**：

| 席位 | research_tech 步号 |
|---|---|
| brown | 90, 137, 236, 474, 571 |
| blue | 107, 361 |
| white | 81, 278, 440 |
| green | 128, 183, 357, 485 |

首拿 +2 是**按科技类型先到先得**（`FIRST_TAKE_TYPE_SCORE`，`bonuses.js:85`）。蓝1 的首拿被布朗
（步 90）拿走。所以真正要回答的是：**蓝席的研究为什么总是排在别人后面**——是宣传不够（研究要 6 宣传），
还是研究动作在优先级里被系统性压低。

## 下一步

1. 统计蓝席全场"宣传余额 ≥6 的回合数"与"实际研究次数"的比值（绿/棕做对照）；
   - 若蓝席很少达到 6 → 上游**宣传生成**问题；
   - 若经常达到 6 却没研究 → **优先级/估值**问题。
2. 需要蓝席回合的检查点输入（捕获模式见 `adhoc/capture-policy-input-42-20260906.js`）。
