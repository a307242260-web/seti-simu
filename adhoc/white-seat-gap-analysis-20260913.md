# 白方席位 −41 分归因（2026-09-13 只读分析）

对象：同一固定世界 `human-405-world-v1`（seed `seti-free-analyze-v1`，4 席同一策略）两局完整记录。

- GAME_BEST：`fixed-world-405-20260913` / `b235ff5f.bddcdae9.full` / 561 步 / 82‑116‑65‑124，均 96.75
- GAME_NOW：`income-choice-greedy-20260913` / `ac7f0082.5ef60d81.full` / 529 步 / 75‑116‑70‑83，均 86

口径：步号一律取存档 `replaySteps[].stepIndex`（0 基）。HTML 报告的“N 步”按回合汇总，
110 回合求和只有 505/561、472/529，**不能累加成全局步号**。

## 1. 白方 124→83 的三项分解（存档 finalScores）

| 分项 | BEST | NOW | Δ |
|---|---|---|---|
| base 局内 | 74 | 63 | −11 |
| tile 板块 | 35（a=10×5, c=4×4, d=21×7） | 20（a=10×5, d=10×5） | −15 |
| card 终局牌 | 15（b_63 6 + dlc_8 9） | 0 | −15 |

## 2. 终局牌 −15 的真实原因：白方从未持有这两张牌

- `b_63`（观测开普勒22，终局 黄色扇区胜场×3）：实例 `card-45-0` 在 **step 131 由蓝席 land 抽到**，
  **step 147 蓝席 `card_corner` 当作弃牌角标弃掉**。
- `dlc_8`（量子数据存储，终局 剩余数据×3）：实例 `card-74-0` 在 **step 489 棕席 `choose_payment` 当费用弃掉**。
- 白席对两卡全程无 play_card / 弃牌 / 收入 / 选牌事件；存档全文各只命中 1 次，均非白席。
- 对照 BEST：同两实例由白席在 **step 145 / step 411 打出并保留到终局**。
- 无法证明（自动抽牌不入 replaySteps）：白席是否曾短暂持有；确切获得步号。

**结论：cardScore 归零不是“白方弃掉了自己的终局牌”，而是“持有终局牌的席位把它当角标/费用弃掉”。**
这正好落在 [round5-card-lifecycle-design-20260909.md](../reports/iteration/round5-card-lifecycle-design-20260909.md)
列出的未实现闭包（条件与数量型终局），也是 EFFECT-02 的 PASS381 案例。

### 单决策验证（本轮 CARD-TERMINAL-VALUE-01 候选）

取 step 147 的原始输入（前 146 步纯重放，action/after 逐步一致）：

| | 动作 | 说明 |
|---|---|---|
| 基线完整局记录 | `card_corner:d9c95165` | 弃 `b_63.webp` 换角标 |
| 候选代码冷决策 | **`pass:c858282e`** | 3.83 秒、失败码为空、改选 PASS 保住终局牌 |

蓝席当时手牌只有 `amiba_9.webp`（外星牌）与 `b_63.webp`，两者都不该被当角标弃掉。

## 3. 板块 −15：d 抢位失败 + c 不可达

- **d**：两局白方都标 d。BEST 在 **step 176（R2·T9）拿 slot1**（倍率 7）；NOW 蓝席 **step 211 先占 slot1**，
  白方 **step 289 才拿 slot2**（倍率 5）。同时 d2 的 baseValue＝⌊科技数/2⌋ 由 3 降到 2
  （ownedTiles BEST 7 个 → NOW 5 个）。21→10 = 位置 −6 + 科技数 −5。
- **c**：c1 规则＝已完成任务牌数，白方 `completedTaskCount` BEST 1 / NOW 0（baseValue 本为 0）；
  且 c slot1 阈值 70，NOW 白方峰值/终值 **63 < 70**，从未达标（全场无人标 c）。
- **a**：两局完全相同（a2 / slot3 / mult5 / bv2 ＝ 10）。

## 4. base −11 的分项（`scoreSources`）

| 来源 | BEST | NOW | Δ |
|---|---|---|---|
| techBonusScore | 15 | 6 | −9 |
| landScore | 6 | 0 | −6 |
| scanScore | 11 | 6 | −5 |
| blueTechScore | 8 | 4 | −4 |
| alienEffectScore | 8 | 6 | −2 |
| cardQuickScore | 1 | 0 | −1 |
| orbitScore | 6 | 12 | +6 |
| alienTracePink / Blue | 5 / 8 | 9 / 11 | +4 / +3 |
| cardEffectScore | 0 | 3 | +3 |

对应动作：研究次数 **5→3**（BEST 117/173/359/437/515；NOW 114/282/362）；
登陆 **1→0**（BEST 唯一登陆 step 530）；标准扫描 **5→4**；蓝科技 blue3+blue4 → blue2+blue3；
环绕 1→2 次（+6）抵消部分下降。

## 5. 首个分歧与关键白方决策

- **全局首个不同步：step 50，蓝席**（BEST 研究 orange2 / NOW 研究 purple4）；step 0–49 完全一致。
- 白方自身首个不同动作：R1·T9（dlc_9 结算后 NOW 多一次 `choose_card dlc_21`）。
- 同回合槽位换主行动：**R2·T4**，BEST `play_card b_63`（+5）vs NOW `play_card dlc_34`（+0）。
- NOW 白方最后一次主行动是 **step 501（R4·T14）PASS**，停在 63 分；
  BEST 继续到 step 530 登陆（+8）、step 554 扫描（+9）、step 559 标 c 达 74。
- 两局都以 `final_round_all_passed` 在第 4 轮结束（BEST 至 T23/cycle9，NOW 至 T21/cycle7）。

## 6. 可用结论与边界

- **可由白方策略层恢复**：R2·T4 出牌选择、d 标记时机、研究动作数量、是否登陆、R4·T14 是否提前 PASS。
- **不能归因于白方决策**：b_63 / dlc_8 落于蓝/棕席，是 step 50 全局分歧之后的牌序后果；
  日志只能给时间顺序，**不证明因果**。
- **尚不可确定**：两卡确切获得步；白方是否曾短暂持有；step 50 分歧与后续白方决策的贡献占比。
