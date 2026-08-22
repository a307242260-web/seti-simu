# 折叠链搜索状态记录（2026-08-22 收尾，供下个 session 恢复）

## 0. 用户最新裁定（本 session 末尾，必须遵守）

- 折叠链蓝槽判定规则修正：**不需要 `credits <= 1` / `energy <= 1` 这类绝对阈值，想要就拿**。
  即：只要对应蓝槽 eligible（蓝色科技在位 + 前置第一排位已填 + 未占用），且该蓝槽资源是
  当前想要的（钱→blue1、能量→blue2、牌→blue3、宣传→blue4），就直接填该蓝槽。
- **place_data 整体预期**（用户澄清）：place_data 与 quick_trade/card_corner 同类——
  **需求驱动 & 确定性，不探索**。搜索沿目标确定性折叠放置链（0 computer 槽→收入，
  8 节点→1 节点），搜索返回"填到哪为止"（foldTargetSlots），真实世界按计划一次填完，
  **填完后继续复用计划**（本回合剩余按计划走，不重新搜索）。迭代中发现的一坨 bug：
  ① 连续放置数据时策略计划与真实世界行动不一致 → 每放一个数据重新搜索（B1）；
  ② 搜索折叠链被多选打断 → 返回策略不对（想放收入只返回 [1,2] 格）（B2）。
- **需求规则细化**（2026-08-22 用户补充裁定）：**钱和电默认填充**（blue1/blue2 只要
  eligible 就填，不需要缺口判定）；**宣传挂靠科技目标**（blue4 仅在
  techGainRequirements.plans[].gap.publicity > 0 时填）；**牌看情况**（blue3 在
  income 目标有 card 计划时填）。
- **→ 实测推翻"钱/电默认填充"**（2026-08-22 隔离验证）：默认填充让白色 -63 分
  （107→44，credits=2 时填 blue1 是负收益——基线决策函数"无蓝需求不填"是对的）。
- **最终方案（用户拍板：统一缺口驱动需求规则）**：
  - **搜索内部 drain 与真实执行折叠链用同一选位逻辑**（`data/placement.js`
    `selectWantedBlueBonus`：credits≤1→blue1 / energy≤1→blue2 / handCount≤1→blue3 /
    publicity≤1→blue4，无缺口→computer）。
  - 搜索内部多选也按缺口选 blueBonus（不是强制 computer）——基线强制 computer 会
    丢失 blueBonus 评估价值（step67 棕 place_data 66.5→39.5，决策翻转 research_tech
    掉分）。
  - foldTargetSlots 保持搜索链末提取（drainable 保留，链完整 [1,2,3,4]）。
  - **机制实证**：统一后 step67 棕 place_data 恢复 66.5（不翻转）、执行选 blueBonus；
    step77 白 foldTargetSlots=[1,2,3,4] 完整（B2 修复）、执行选 computer（credits=2
    无缺口）——搜索评估与执行一致。
- 用户裁定：**本轮先验证搜索端（B2），plan 延续（B1 闭环，去掉"多格折叠后 plan 不
  延续"补偿、改为折叠链执行后 plan advance 到链末继续复用）留到下一轮**。
- 用户将开新 session 继续；本文件是恢复依据。

## 0.1 隔离验证记录（2026-08-22，定位漂移源）

| 实验 | 蓝 | 绿 | 棕 | 白 | 均 | 说明 |
|---|---|---|---|---|---|---|
| fold-chain-real（46c8d0cf 基线） | 56 | 89 | 126 | 130 | 100.3 | 已提交版本 |
| A：仅 drainable（搜索强制 computer） | 54 | 108 | 104 | 50 | 79.0 | 评估崩 → 决策翻转 |
| B：drainable+foldTargetSlots（无需求规则） | 45 | 113 | 115 | 107 | 95.0 | foldTargetSlots 恢复大部分 |
| C：全部（+需求规则默认填充） | 67 | 91 | 113 | 44 | 78.75 | 默认填充白崩 |
| D：统一缺口规则（selectWantedBlueBonus） | 待全盘 | | | | | 本轮实现，全盘验证中 |

工具：`/tmp/seti-iso`（A）、`/tmp/seti-iso-b`（B，python 剥需求规则版）、
`/tmp/seti-iso-c`（原版+foldTargetSlots 提取）、`/tmp/seti-iso-d`（干净 46c8d0cf）——
git worktree 隔离副本，记录写副本目录不污染主工作树。

## 1. 当前工作树改动（均未提交，半成品——不要提交）

1. `randomizer/game/rule-composition.js`（drainable 修复，**已验证**）：
   - place_data 节点选位多选（computer + blueBonus）也 drainable，`isPlaceDataNode` 时
     settleChoice 确定选 computer（蓝色 bonus 多选处不再截断链）。
   - 实测：搜索评估白色 data=6 的 place_data 链 settled slots=[1,2,3,4]（正确到收入格），
     foldTargetSlots=[1,2,3,4]。
2. `randomizer/game/ai/plan-continuation.js`（foldTargetSlots 提取）：
   - `planContinuationFromWinningLeaf(leaf, seatId)` 从 winning leaf 的
     `rootActionSettledObservation`（回退 `rootActionObservation`）取
     `dataProgress.computerSlots` → `foldTargetSlots`；`buildPlanFromSnapshot` /
     `advancePlan` 透传。
3. `randomizer/game/ai/machine-player-coordinator.js`（三处）：
   - ✅ 好：`chainedAction` recordStep 延迟——折叠链内提交的 place_data 动作**等到选位结算成功
     才一起记录**（消除"未放置的 place_data 多记"，原子动作 580→569 级问题）。
   - ✅ **已重做**：foldTargetSlots 目标检查（原 `chainIndex + 1 >= size` 有 bug——foldTargetSlots
     是**绝对槽位集合**，盘面已有数据时链内次数 ≠ size）。现在结算选位后 projection 读当前
     computerSlots（viewer 带 `resolvedSeatId`，之前 seatId=undefined 是只传 composition 不传
     seatId 的 bug），`currentSlots ⊇ foldTargetSlots` 则 break（交还决策函数）；读不到
     computerSlots 显式抛错 `MACHINE_PLAYER_PLACE_DATA_TARGET_SLOTS_UNREADABLE`。
   - ✅ **需求规则**（2026-08-22 用户细化裁定）：`wantedBlueTilesByResource(projectionState, seatId)`
     ——钱/电（blue1/blue2）默认填充；宣传（blue4）挂靠科技目标（tech plans gap.publicity>0）；
     牌（blue3）income 有 card 计划。多选时按优先级 [blue4, blue1, blue2, blue3] 选蓝槽，
     否则 computer。blueBonus 选项本身已保证 eligible（规则侧 isBlueBonusSlotEligible）。

## 2. 搜索链实证 trace（本 session 实测数据）

工具：`node tools/dump_decision_tree.js <存档> <步数> [out.json]`；定制脚本
`/tmp/trace67.js`、`/tmp/trace68.js`、`/tmp/trace77.js`；dump 输出
`/tmp/dump77.json`、`/tmp/dump68.json`。基线存档：
`seti-saves/seti-save-research-elig-sum4-56e9a9c0-full-v261.json`（535 决策 / 535 原子动作，
均分 99.75：蓝25 绿144 棕147 白83）。搜索端验证脚本 `/tmp/verify_foldtarget.js`。

### 2.1 step 77 边界（白色 place_data，空盘填第一排）
- 搜索评估 winning leaf：settledSlots=[1,2,3,4]、foldTargetSlots=[1,2,3,4]、
  next=choose_card:b04e9500（4 号位收入选牌）、rootPlan=income:data:computer-slot-4 / data:analyze。
- `runHeuristicPolicyDecision(false)` 后 chosen=choose_target:29b5215c（= 折叠链**最后结算的
  computer 选位**，source=scheme；machineStepResult.actionId 是最后一个 recordStep 的动作）。
- 白色状态：blue1 在位（techState.blueBoardSlots={blue1:1}）、credits=2（无蓝需求）→
  computer 链正确，与基线一致。
- 基线白色 12 次 place_data 全 computer、credits 恒 2：step 77,79,81,83,86,88,388,390,392,394,418,420。
- **2026-08-22 复验（需求规则后）**：决策 77 白色 place_data，foldTargetSlots=[1,2,3,4] ✓
  （与 §2.1 一致，drainable 修复生效）。

### 2.2 step 67 边界（棕色 place_data，slots=[1,2,3,4]、credits=0）
- 状态：credits=0、energy=3、publicity=8、availableData=1、handCount=2、blue1 在位（槽1）、
  computerSlots=[1,2,3,4]（收入已触发过）。
- 搜索评估 winning leaf：settledSlots=[1,2,3,4,5]（data=1 → 只填 1 个 slot5）、
  foldTargetSlots=[1,2,3,4,5]、chain=[place_data, card_corner:d5283853, place_data, analyze, ...]、
  rootPlan=data:analyze / data:place_data。
- **注意**：当前代码在该边界 chosen=research_tech:547c8803，而基线存档 step67=place_data——
  差异可能来自 drainable 修复改变了搜索价值（链长 [1,2]→[1,2,3,4]），全盘验证时要核对是否分叉。
- **2026-08-22 复验**：决策 67 棕色 chosen=research_tech:547c8803（**已分叉**，基线是 place_data），
  plan.foldTargetSlots=[1,2,3,4]（research_tech 决策链的 computerSlots，非 place_data 链）；
  全盘验证观察分叉影响。

### 2.3 step 68 边界（棕色 choose_target，基线选 blueBonus）
- legal=[choose_target:69f502d4(blueBonus slot1), choose_target:9e798bfd(computer)]；
  基线存档 step68 = blueBonus(1)。棕色 credits=0 ≤ 1 → 需求规则命中 blue1 → 基线拿 blue1。
- **结论**：基线（无折叠）的 choose_target 步骤是**重新搜索**的（place_data 决策的 plan
  nextActionId=收入选牌永远不命中 choose_target 边界 → plan-reuse miss → 重搜），按
  selectDataPlacementChoice 需求逻辑选择。折叠链要 ≡ 基线，协调器折叠链每步结算必须按
  同一需求逻辑选（蓝槽需求 → 蓝槽；否则 computer）。
- 基线 blueBonus 共 7 次：step 68,95,144,314,371,470,506（棕 68,371；绿 95,144,314,470,506）。

## 3. 关键架构结论（本 session 推导）

1. **需求规则放协调器折叠链**（每步结算按"想要就拿"选蓝槽，否则 computer）；搜索内部 drain
   **保持 computer 链**（与基线搜索评估同一近似，避免搜索价值改变导致决策分叉）。
2. foldTargetSlots 是**绝对槽位集合**（搜索链结算后的 computerSlots），协调器折叠链填到
   `currentSlots ⊇ foldTargetSlots` 即停；无目标槽位时回退"还有就继续"。
3. 折叠链每次实际提交（place_data 动作 / 选位结算）都走 execute + recordStep；chainedAction
   延迟到结算成功才记录，对齐基线逐格原子动作序列。
4. 多格折叠后 plan 不延续（foldChainMultiFilled → planStores.delete），主行动基于真实状态
   重新搜索评估——基线靠 plan 错位自然重搜，折叠链必须显式不延续。
   **（下一轮改为：搜索评估修复后折叠链执行完 → plan advance 到链末位置继续复用，去掉
   "不延续"补偿，用户裁定）**。

## 4. 经验教训汇总（2026-08-22 用户裁定回退，完整记录供后续参考）

**回退裁定**：统一缺口规则策略本身不应掉分，本轮实现有问题；**回退到 elig-sum4
（56e9a9c0，均 99.75）**。以下经验是本轮全部相关改动的教训。

### 4.1 版本/实验时间线

| 版本 | head | 均分 | 改动 |
|---|---|---|---|
| elig-sum4（用户指定回退点） | 56e9a9c0 | 99.75 | 无折叠链（基线） |
| fold-chain-only | 70da1e5f | 83.5 | 折叠链雏形 |
| fold-multifill / fold-chain-real | 0a377f88 / 29e66b9b / 46c8d0cf | 100.25/100.3 | 折叠链 + 多格 plan 不延续 |
| iso-a-drain（仅 drainable） | 46c8d0cf 脏树 | 79.0 | 搜索内部多选强制 computer |
| iso-b（drainable+foldTargetSlots） | 46c8d0cf 脏树 | 95.0 | 无需求规则 |
| fold-demand-v1（+默认填充） | 46c8d0cf 脏树 | 78.75 | 需求规则"钱/电默认填充" |
| fold-unified（统一缺口规则） | 46c8d0cf 脏树 | 72.25 | selectWantedBlueBonus 统一 |

### 4.2 机制结论（实证）

1. **搜索评估与真实执行必须一致**：搜索内部折叠的选位逻辑若与执行折叠链不同 →
   评估价值与执行行为脱节 → 决策漂移掉分。基线（46c8d0cf）搜索内部**多选交还
   决策函数**（blueBonus 价值进搜索树），执行折叠链也在多选处交还 → 一致 → 100.3。
2. **blueBonus 评估价值不可丢**：drainable 强制 computer 让 step67 棕 place_data
   评估 66.5→39.5（blueBonus +1 钱价值丢失）→ 决策翻转 research_tech → 全盘漂移。
3. **"钱/电默认填充"是负收益**：白色 credits=2 时填 blue1(+1 钱)是浪费——基线
   决策函数"无蓝需求不填"（§2.1 白色 12 次 place_data 全 computer、credits 恒 2）
   是对的。缺口驱动（≤1）正确。
4. **fold-chain-real 无 B2**：B2（想放收入只填 1、2 格）是更早无折叠链版本的 bug；
   fold-chain-real 靠"多选交还决策函数"让白色持续填到收入（决策 77 填 1 格→交还→
   决策函数选 place_data→…→收入），不需要 foldTargetSlots。
5. **折叠近似不如交还质量**：fold-chain-real 决策 77 只填 1 格（交还决策函数完整
   搜索）；工作树一次填 4 格（foldTargetSlots）→ 错过中途转向（填 1 格后决策函数
   可能转 scan/研究）+ 填满后行为不同（继续填槽 5、6 vs end_turn）→ 节奏崩。
6. **chainedAction recordStep 延迟有价值**：折叠链内 place_data 动作等到选位结算
   成功才记录，消除"未放置的 place_data 多记"（原子动作 580→569 级）——记账改进
   可单独保留验证，与折叠策略解耦。

### 4.3 后续方向（若重启 place_data 折叠）

- **不要**在搜索内部强制 computer 链（丢 blueBonus 价值）；**不要**默认填充蓝槽。
- 折叠链若保留，多选处**交还决策函数**（fold-chain-real 行为）或与搜索评估完全
  一致的选位逻辑。
- foldTargetSlots（搜索返回"填到哪"）需要与执行节奏解耦；plan 延续（B1 闭环）
  是独立方向，需先验证搜索评估与执行一致后再做。

## 5. 下步待办（已回退，仅供参考）

1. ✅ 重做 `machine-player-coordinator.js` 的 foldTargetSlots 检查：结算后 projection 读
   computerSlots（viewer 带 `resolvedSeatId`），`⊇ foldTargetSlots` 则 break。
2. ✅ 协调器折叠链加需求规则（**钱/电默认填充；宣传挂靠科技目标 gap.publicity>0；牌 income
   card 计划**；多选优先级 [blue4, blue1, blue2, blue3]，无对应蓝槽 → 默认推进 computer）。
3. 🔄 全盘验证 vs 基线 99.75（535 决策/535 原子动作；step67 chosen 差异已分叉，观察影响）。
4. 验证好后一次提交（中文提交信息），并同步更新文档（改动即文档；ai-design.md §3.2.1
   折叠边界描述需更新：多选不再"交还决策函数"，而是按需求规则选蓝槽）。
5. **（下一轮）plan 延续**：搜索评估修复后，折叠链执行完 plan advance 到链末位置继续复用，
   去掉"多格折叠后 plan 不延续"补偿，place_data 正常延续 plan（B1 闭环）。

