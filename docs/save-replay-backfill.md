# 旧档复盘：把「终局未结算-v223」的完整 scoreSources 补出来

本文档记录如何把旧档 `seti-saves/seti-save-终局未结算-v223.json` 用当前代码重放，
补出旧版缺失的得分来源拆分（scoreSources）。任何 agent 都可以按此流程复现。

## 背景：这个档是什么

- `终局未结算-v223.json`（savedAt 08-16 03:28）是一局完整打到终局的浏览器存档
  （sv 54→222，415 步 replaySteps），但保存时旧版代码的 scoreSources 只记录了
  卡牌/任务等少数来源，land/orbit/scan/techBonus/alienTrace 等大量来源为 0。
- 这个档本身**不是**从开局记录的：它的 replaySteps 从 sv=54（play_card dlc_31）
  开始，sv 1→53 是更早会话玩的，没有存档。
- 但仓库里还有两个更早的档，恰好衔接上：
  - `seti-save-重打R2末-v47.json`（08-15 22:38）：replaySteps 覆盖 sv 1→46（110 步，从初始选择开始）
  - `seti-save-无法登陆-v54.json`（08-15 22:45）：replaySteps 覆盖 sv 47→54（14 步）
- 三档拼接 = **sv 1→222 全覆盖**（v54 step12/13 与 v223 step0 是同一个动作
  `play_card:ec548c50`，去重），共 **537 步**，是同一局。

## 关键前置知识（踩过的坑，务必先读）

1. **seed 双层语义**（浏览器与 simulator 行为一致的根因）：
   - 主 RNG 起点 = `hashSeed("seti-free-analyze-v1")`（浏览器 startNewGame 里
     `browserRandom.setState(hashSeed(seed))` 后传给内核 `rngState.state`）。
   - **science 域 RNG**（研究科技补牌/收入盲抽/精选）用
     `hashSeed(root.meta.seed)` **独立初始化**（`randomizer/game/effects/science-session.js`
     的 `nextCommittedRandom`）。
   - **旧版浏览器 `newGame` 没传 seed** → `meta.seed` 落到内核默认 `"seti-simulation"`
     → science RNG 起点 = `hashSeed("seti-simulation")`。
   - 所以重放时：`createSimulationRuleComposition({ seed: META_SEED, ... })` 的
     `seed` 参数必须传 **档内 meta.seed**（`"seti-simulation"`），而 `newGame` 的
     `rngState.state` 传 `hashSeed("seti-free-analyze-v1")`。
   - 2026-08-16 已在 `randomizer/app.js` startNewGame 修复：`newGame({ ..., seed, ... })`
     显式传 seed，新档浏览器与 simulator 完全一致。

2. **读状态必须用 projection**：`lifecycle.save().envelope.committedState` 在
   effect session 未 commit 时返回**基础旧状态**；要用
   `kernel.composition.projection().state` 读当前工作状态。

3. **决策提交不能 JSON round-trip**：`JSON.parse(JSON.stringify(choice))` 会丢弃值为
   `undefined` 的字段（如 `afterLandRewards`），而 runtime 的 `stableSerialize` 保留
   undefined → 序列化不再相等 → `EFFECT_DECISION_NOT_LEGAL`。直接提交原对象。

4. **决策版本用当前 inspect 的**：存档 choice 里的 `decisionVersion` 是旧值，
   提交时用 `kernel.composition.inspect().session.decision.decisionVersion`。

## 重放策略

- **白色玩家（player-white）严格匹配**：按存档 actionId / choiceId / summary /
  target 精确匹配；匹配不到即报错（白色是复刻目标，必须逐点对齐）。
- **非白色玩家宽松匹配**：蓝/绿/棕每回合只 PASS + 选牌，选什么不影响白色复刻，
  直接取第一个未禁用的 choice。
- **已修复的可选效果决策自动跳过**：存档里存在 `accept_optional_effect "跳过 X"`，
  但当前代码（f9c9827 修复后）不再弹出——跳过无效果，直接 continue 跳过该步。
  - 这类决策出现 5 处，全是 amiba 任务结算弹窗（旧版把终局计分牌误当任务，见下）。

## 规则演变造成的两处分叉（非内核 bug，跳过/宽松处理）

1. **PASS 手牌上限**（89467ad「虫牌与其他牌一致」）：
   - 旧版：`非虫牌数 - 4`（虫牌不计入上限）
   - 当前：`全部手牌数 - 4`（虫牌计入上限）
   - 影响：蓝色 #267 PASS 弃牌数（弃 3 vs 弃 4），蓝色手牌与存档略差，
     **不影响白色**（验证过白色终局全对齐）。
2. **amiba 任务结算弹窗**（f9c9827「amiba_task 只对带理论任务的牌生成」）：
   - 旧版：任何阿米巴牌（含 amiba_7，无 CARD_TASKS）在 `isTheoryTaskReady` 时都弹
     「结算/跳过」决策（ruleId 兜底 `amiba_theory`）。
   - 当前：只有 index 8（amiba-8 理论任务）弹。
   - 影响：旧档 5 处「跳过 amiba_X」决策当前不存在 → 重放时直接跳过。

## 复现步骤

```bash
# 前置：工作区干净或至少这几个文件在
#   seti-saves/seti-save-重打R2末-v47.json
#   seti-saves/seti-save-无法登陆-v54.json
#   seti-saves/seti-save-终局未结算-v223.json

# 1) 完整重放 + 终局对比 + 白色 scoreSources（推荐入口）
node tools/backfill_full_chain.js

# 2) 调试用：拼接链逐步重放（失败时打印每一步）
node tools/replay_joined_chain.js

# 3) 调试用：只验证"非白色宽松 + 白色严格"能走到终局
node tools/replay_white_strict.js
```

## 预期输出（backfill_full_chain.js）

```
537 步全部完成（跳过 5 处不存在的可选效果）

=== 终局对比（重放 vs v223 存档）===
player-green: ... ✓
player-brown: ... ✓
player-white: 分249 钱0 能0 手[] ✓   ← 白色完全一致
player-blue: ... ✗（仅手牌差异，规则演变遗留，不影响白色）

=== 白色 scoreSources（完整拆分）===
键数: 15，各来源合计: 249，白色总分: 249   ← 行动分全部分解，无缺口
  blueTechScore: 40（旧档记录 0）    ← 数据放置蓝列加分
  alienEffectScore: 38（旧档记录 0） ← 阿米巴细胞器/痕迹计数/异常点奖励
  landScore: 41（旧档记录 0）        ← 登陆奖励（含卡牌触发登陆）
  techBonusScore: 30（旧档记录 0）   ← 12 次研究科技：首次类型 2 分×N + 背面 bonus
  alienTracePinkScore: 22（旧档记录 0）
  scanScore: 21（旧档记录 0）        ← 扫描替换星云 token 第二槽位 +2 分
  alienTraceBlueScore: 15（旧档记录 0）
  alienTraceYellowScore: 15（旧档记录 0）
  taskCardScore: 15
  initialScore: 6（旧档记录 0）      ← 顺位 1 + 初始牌 21 的 3 分 + 初始牌 1 天狼星扫描 2 分
  cardQuickScore: 3
  orbitScore: 3（旧档记录 0）
  cardEffectScore: 0
  industryEffectScore: 0
  alienCardQuickScore: 0
```

## 结果可信度

- 白色玩家从开局（初始选择）到终局逐点对齐存档：分数 0→249、钱/能/手牌、
  公共牌（`b_129/b_130/b_56`）全部一致。
- 绿色/棕色玩家也完全对齐；仅蓝色玩家手牌因 PASS 上限规则演变有差异。
- 白色 scoreSources **15 键合计 249 = 总分 249**（行动分全部分解，无缺口），
  旧档只有 5 个非零键（cardQuickScore 3 / taskCardScore 15 等）。
- 逐步骤核验脚本 `tools/step_score_check.js`：每步后校验 score === sources 合计，
  全程一致。

## techBonusScore 构成（30 分，示例局）

12 次研究科技：10 次 +2、2 次 +5（#99 blue1、#482 orange3）。
- +2 = 首次获取某类型科技 tile 的统一奖励（`FIRST_TAKE_TYPE_SCORE = 2`，catalog.js）
- +5 = 首次类型 2 分 + 该 tile 背面 bonus_3f 的 3 分
- 合计 10×2 + 2×5 = 30 ✓

## 常用验证（不要漏）

```bash
node --check randomizer/app.js
node tools/run_node_tests.js   # 64/65 通过；simulation-counterfactual-outcome 是预存失败
```

## 关联提交

- `433d942`：终局计分来源完整拆分（2026-08-16 提交，含本次全部修复）
  - `randomizer/app.js`：startNewGame 显式传 seed（science RNG 对齐）
  - `randomizer/game/effects/science-session.js`：place_data 蓝列分→blueTechScore、
    扇区结算→scanScore、Helios 被动→industryEffectScore、蓝槽科技 firstTake→techBonusScore
  - `randomizer/game/cards/play-domain.js`：卡牌 GAIN_RESOURCES→cardEffectScore、
    阿米巴细胞器→alienEffectScore、卡牌登陆/环绕→landScore/orbitScore、
    痕迹计数/异常点→alienEffectScore
  - `randomizer/game/tech/bonuses.js`：科技研究 bonus（bonus_3f 等）→techBonusScore
  - `randomizer/game/data/nebula-state.js`：扫描替换星云 token +2 分走 gainResources
    （记 scanScore/initialScore，不再直接改 score）
  - `randomizer/game/abilities/scan.js`：扫描给分传 scanScore
  - `randomizer/game/initial-cards.js`：初始牌/公司效果分→initialScore/industryEffectScore
- 89467ad：虫牌计入 PASS 手牌上限（规则改动，旧档重放分叉点之一）
- f9c9827：amiba_task 只对带理论任务的牌生成（规则改动，旧档重放分叉点之二）

## 相关工具脚本

- `tools/backfill_full_chain.js`：权威入口（完整重放 + 终局对比 + scoreSources）
- `tools/step_score_check.js`：逐步校验 score === sources 合计
- `tools/trace_tech_bonus.js`：追踪 techBonusScore 每次加分构成
- `tools/replay_joined_chain.js` / `tools/replay_white_strict.js`：调试用
