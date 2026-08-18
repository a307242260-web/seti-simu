# 机器人速度优化（2026-08-18，第二轮）

> 用户诉求："再开启一次机器人速度优化，太慢了"。本轮目标：**行为完全不变**的前提下
> 降低单决策耗时（覆盖指标逐项一致为硬门禁，见 `docs/project-progress/heuristic-takeover-plan-20260814.md` §3）。

## 1. 基线（优化前，2026-08-18 实测）

`tools/benchmark_probe_policy.js`（固定盘面 seti-104-official-v1，首决策 12 次重复）：

- 单决策中位 **7199ms**（counterfactual 搜索内部 totalMilliseconds 7024ms）
- 分项中位：execution 2356ms（34%）> orchestration 1940ms > projection 1073ms
  > checkpoint 775ms > fork 514ms > frontier 279ms > identity 48ms
- 单决策执行 2802 物理节点；`executionLimitReached=false`；`maxCompletedGoalDepth=2`

CPU profile 热点（self-time 采样）：

- **structuredClone ~35%**（js_transferable 原生实现，多个调用点合计）
- GC ~6%；stableSerialize（state-store fork 快照 / rule-composition 哈希）~9%
- 单点最大克隆：`rule-composition.js` `contextualizeExecutor.wrap` 的
  `transformEffectResult` 包装——**每个 effect 执行都整状态 structuredClone**
  （单决策 3552 次，约 600ms/11%）

## 2. 本轮改动（两处，均为行为中立）

### 2.1 transformEffectResult 包装跳过同引用 nextState 的全量克隆

`randomizer/game/rule-composition.js` `contextualizeExecutor`：

- 原因：production 唯一 `transformEffectResult` = `residualDomainSession.augmentEffectResult`
  （`randomizer/game/effects/residual-domain-session.js`），它只**原地增补** result 并返回
  新外壳对象，`nextState` 恒为同一引用。原实现无论引用是否变化都 `clone(nextState)`——
  每次 effect 执行克隆整份 committed state（3552 次/决策 ≈ 600ms + GC 压力）。
- 修复：`nextState === result.nextState` 时直接复用引用（语义不变：`applyResult` 在
  trusted fork 下本就采用 `result.nextState`，非 trusted 路径也会再 `cloneState`）；
  仅当 transform 真的产出新状态对象时才防御性克隆（契约保持）。

### 2.2 化石运输到达判定无任务时短路

`randomizer/game/effects/residual-domain-session.js` `listFossilArrivalEvents`：

- 原因：该函数在**每个 effect 执行后**都被调用（3552 次/决策），无虫族运输任务时
  `listTransportArrivalEvents` 恒返回 `[]`（`!task → continue`），但此前仍遍历
  aliens/rockets（含逐运输任务 `createSolarSnapshot` 坐标解析——solar 盘面函数合计
  占采样 ~8%）。
- 修复：`transportTasksByRocketId` 为空时直接返回 `[]`，跳过整段遍历。
- 附带：坐标解析失败从"静默 null"改为 `console.error` 上报 + 返回 null（容错理由
  见代码注释：辅助送达语义，失败不升级为整个行动失败；但错误必须可见）。

## 3. 验证（行为中立性证据）

1. **probe benchmark 覆盖指标逐项一致**：COVERAGE FIELDS（candidateCount /
   executedNodeCount / rootTargetCount / transpositionHitCount / … / executionLimitReached
   / prunedNodeCount 等）优化前后 JSON 全等；12 次重复内部无漂移。
2. **完整局行动序列一致**（seti-free-analyze-v1，四席全 AI，300 决策）：
   优化前后每个决策的 actionId 序列、行动族分布、终局分数全部一致
   （蓝54/绿24/棕37/白5 逐位相同）。
3. **旧档快进一致**：`tools/fast_forward_save.js` 对 seti-save-537-merged.json
   （516 步，含虫族运输场景）重放，终局状态输出逐字段一致。
4. **全量回归**：`node tools/run_node_tests.js` 67 unit + 1 fullFlow 全绿。

## 4. 结果

- probe benchmark：executionMilliseconds **2356 → 1499ms（-36%）**；单决策中位
  **7199 → 6282ms**（机器有 ~10% 跑间方差，execution 分项是可靠信号）。
- 完整局墙钟：**447.5s → 345.7s（-22.7%）**。
- 顺带修复：`tools/benchmark_probe_policy.js` 初始设置排空死锁（描述符用 `actorId`
  而非 `actorPlayerId`，共享进度 map 导致 50 步内排不完）；`randomizer/game/cards/effects.js`
  aomomo_8.webp 卡表模型迁移（ceda731）丢失 `endGameScoring` 的既有回归
  （end-game-scoring.test "奥陌陌8 0≠3"）。

## 5. 后续候选（未在本轮实施，需浏览器验证）

- **浏览器 counterfactual fork 的投影路径**：fork 经 `createCounterfactualFork`
  （production-kernel）继承宿主 `hostKind` 与 `options`；浏览器宿主未传
  `trustedProjectionReader` → fork 每节点投影可能整状态 clone（simulation 宿主
  传了 `trustedProjectionReader: true`）。需在真实浏览器 composition 上 profile
  确认后再动（本轮无浏览器环境，不盲改）。
- `beginWorkingCopy`（state-store）每 action 整状态 clone（1579 次/决策 ≈ 280ms）：
  取消需改 trusted fork 的冻结/可变模型，回归风险高，留待专门一轮。
- `serializeForkSnapshot` 换 JSON.stringify **不可行**：`canonicalEnvelopeHash` 直接
  哈希 envelope 字节 → 序列化格式变化会改变 fork RNG 种子 → 搜索行为改变（不满足
  覆盖不变门禁）。
