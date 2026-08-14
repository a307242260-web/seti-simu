# 次级搜索高效化：确定性宏步 + 完成态 DP 缓存（2026-08-14）

目标：在 **complete 模式（完整目标目录，`targetSchedulerPrunedCount=0`）** 下把单次决策压回
10s 门禁内（理想 100ms），同时保持搜索空间完备（不引入新的有损剪枝）。两者都是**无损**
性能技术。基线数据：complete 模式 45 决策采样中 4/17 搜索决策触 4096 上限（剩余 frontier
734-818）、4 个超 10s（16-17s）；截断模式整局丢弃 17637 个目标绑定且 13 次超 10s。

## 1. 确定性资源缺口宏步（Macro-step）

### 问题

已绑定目标的路线中，`selectMinimumCostResourcePreparation`（`expected-score-evaluator.js`
938-1071）已把资源准备收敛为最小损耗方案的**首个动作**，且每个中间选择都被等价合并
（`targetEquivalentChoicePrunedCount`）。但搜索执行层把每个 quick_trade / 支付当作独立
frontier 节点：执行一个 trade 后节点重新入堆，再执行下一个，每次都是一次 fork + submit +
checkpoint + 重新入队。决策 #320 的 `放置数据 → 快速转换 → 扫描 → 选卡牌` 重复展开正是
这种"确定性段被逐节点重放"的体现。

### 语义

对已绑定目标、且后继被判定为"确定性资源准备"的节点，**内联连续执行**：不把该后继放入
frontier，而是在同一节点处理内直接执行其正式 action/decision 链，直到到达
（a）真正有选择的点（>1 个非等价后继）、（b）目标完成点、或（c）内联深度上限。
中间步骤仍走正式 executor / Decision 链与 commit 语义，不手写规则。

### 内联判定（全部满足才内联）

| 条件 | 来源 |
|---|---|
| `selectedRoutes.length === 1`（单一后继，已被规划器/等价收敛） | rule-composition 2751 |
| 后继 family 属于资源准备集：`quick_trade`、`choose_payment`（discard-hand-cards /
  move-payment）、`place_data`（目标内确定性放置） | 硬编码窄集合 + 版本化 |
| 执行后 `execution.awaitingDecision === false`（不产生新的选择分叉） | executeNode 结果 |
| 执行后不是目标完成点（完成点必须重新枚举目录，是分叉点） | `completesRouteTarget` 判定 |
| 内联链深度 ≤ `macroStepMaxDepth`（默认 8，受 `maxExecutionNodes` 物理保护） | 新参数 |

### 执行闭包

- 内联复用同一可信 fork 连续提交（不重建 fork、不重复 checkpoint），只读新观察；
- 链上每个 action 计入 `executedNodeCount`（不免费），但**不入 frontier、不重新分支**；
- 若链中某步 `awaitingDecision` 或出现 >1 后继，立即停止内联，剩余部分走正常 frontier；
- 链结束后把最终状态作为单节点合并入 frontier（等价于把整条链当作一个超节点）。

### 诊断

- `macroStepExecutedCount`：内联的节点数；
- `macroStepChainCount`：内联链条数；
- `macroStepMaxChainDepth`：最长链。

### 验收义务

1. complete 模式下定向决策（决策 28/30/32/38）节点数与时延下降；
2. `targetSchedulerPrunedCount` 保持 0、`beamPrunedOriginCount` 保持 0；
3. 行为义务测试（资源手段必须解锁正式代理）不降；
4. 内联链上的正式 action 全部可重放（journal/checkpoint 完整）；
5. 无内联的普通路径（非资源准备、有选择点）行为不变。

## 2. 完成态 DP 缓存（Completion DP cache）

### 问题

complete 模式下，目标完成后重新枚举目录，不同 root origin / 不同目标顺序可能到达**同一
正式状态 + 同一剩余目标深度**，其后续搜索（目录枚举 + 执行）完全相同，但被重复探索。
transposition 只合并"相同 envelope + 下一 action"的物理节点，不合并"完成态之后的整个
子问题"。

### 语义

目标完成后（`completedGoal === true`、`routeTargetId` 重置为 null、即将重新枚举目录的点），
以 `(正式状态等价 + 剩余目标深度 + 隐藏信息边界)` 为键缓存该子问题；相同键的子问题只
探索一次，后续 origin 直接跳过探索。

### 缓存键

```
completionSearchKey = stableHash([
  stableHash(childEnvelope),   // 正式状态等价（committed bytes + session + RNG）
  nextProxyDepth,              // 剩余目标深度
  Boolean(origin.informationMasked),  // 隐藏信息边界
])
```

不含 `rootActionId` / 已完成的 `routeTargetId`（这正是"去掉目标顺序排列重复"）；只在
"完成态、无绑定目标、即将目录选择"的点应用，因此不会合并"绑定中目标不同"的 origin。

### 探索语义（截断安全）

- 首次遇到某 key：标记 `exploring`，正常探索；
- 该子问题**自然耗尽**（`executionLimitReached=false` 且剩余 frontier=0）后标记 `done`；
- 后续 origin 遇到 `done` 的 key → 跳过探索（`completionDpCacheHitCount++`），其完成态
  叶子已由首次探索者的 Pareto frontier 覆盖；
- 若首次探索被截断（budget 触顶）→ 保持 `exploring`，后续 origin **不跳过**（继续探索，
  直到某次自然耗尽才标记 `done`）——不因缓存丢失搜索。

### 约束

- 只缓存"完成态之后"的子问题；目标中途状态不缓存（"不得合并当前目标不同的 origin"）；
- 信息边界参与键：mask 状态不同不合并；
- 缓存不改变叶子评价、目录枚举、Pareto 支配或预算；
- 该缓存是 transposition 的补充，不是替代：transposition 继续合并物理节点。

### 诊断

- `completionDpCacheHitCount` / `completionDpCacheMissCount`；
- `completionDpCacheDoneCount` / `completionDpCacheTruncatedCount`。

### 验收义务

1. complete 模式下跨 origin 重复探索下降（hit 数 > 0）；
2. `targetSchedulerPrunedCount=0`、`beamPrunedOriginCount=0` 保持；
3. 截断场景（预算内）不因缓存丢搜索：构造"首探索被截断"用例验证后续 origin 仍探索；
4. 目标中途（绑定中）状态不被缓存合并的定向测试；
5. 固定盘面行为（最终分、行动族）与缓存前一致（complete 模式）。

## 3. 实施与验证顺序

1. 宏步：rule-composition 内联执行 + 诊断；定向测试（quick_trade 链内联、支付内联、
   到达选择点停止）；
2. DP 缓存：completedGoal 路径缓存 + 诊断；定向测试（同状态不同目标顺序合并、截断安全、
   绑定中不合并）；
3. `tools/benchmark_secondary_search.js` 对比：
   - 截断模式 / complete 模式 / complete+宏步 / complete+宏步+DP 四档；
   - 指标：median/p90/max 时延、触顶次数、剩余 frontier、总节点、hit 计数；
4. 全量固定盘面（complete 模式）验证四席分与行动族不变；
5. `node tools/run_node_tests.js` 全绿 + full-flow 通过后提交。

## 4. 边界声明

- 宏步与 DP 缓存均不减少目标、路线、conditional choice 或叶；不改变 node cap、15 目标
  深度、4096 物理保护；
- 不做任何新的有损近似；若实现中发现必须牺牲完备性，回到设计讨论（用户纪律）；
- 评估函数（一级价值权重）不参与本次改动。
