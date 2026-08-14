# SETI 启发式机器人接手计划（2026-08-14）

本文是 codex/multica 阶段开发工作的交接与后续执行计划。历史脉络与经验教训见
`docs/retrospectives/heuristic-development-lessons-20260814.md`；当前唯一权威设计文档为
`docs/ai-design.md`。

## 1. 当前基线（2026-08-14 实测）

- 分支 `dev`，HEAD = `e92d964`（2026-08-03 01:43），工作树干净；Policy 版本
  `seti-heuristic-policy-v26`。
- 全量回归：`node tools/run_node_tests.js` = 62 unit + 1 full-flow 全绿；
  `node --check randomizer/app.js` 通过。
- 固定盘面（`seti-104-board-v1` / `seti-104-official-v1`）v26 报告：白 57 / 蓝 49 / 棕 49 /
  绿 41，**均分 49**，低于锦标赛冠军 61.25（64/64/61/56），属 08-03 新估值方向回退。
- 首决策 benchmark（12 次）：median 3625ms / p90 3714ms / max 3738ms。分项中位：
  projection 1391ms（42%）、orchestration 808ms（25%）、execution 648ms（20%）、
  checkpoint 231ms、fork 124ms（4%）。诊断：`executionLimitReached=false`、
  `remainingFrontierNodeCount=0`、`beamPrunedOriginCount=0`、`maxCompletedGoalDepth=4`；
  隐藏信息 barrier：`hidden_card_reveal` 13、`tech_bonus_reveal` 13，过滤 347 个
  依赖未知身份的 successor。
- 慢决策样本：决策 #320（绿，第 4 轮，place_data）11.69s，目标深度 5/15；爆炸模式为
  `放置数据 → 快速转换 → 扫描 → 选卡牌` × 外星人痕迹槽 × 公共牌组合，大量执行后被支配淘汰。

## 2. 阶段路线

每阶段结束都有可证伪验收义务；顺序沿用“单次 Decision benchmark → 固定盘面 → 完整局报告”。

### Phase 0 交接基线（本日）

- [x] 回归全绿、benchmark 取数、历史文档梳理（本文件 + 复盘文档 + 两份历史摘要）。
- [x] 新增可迭代 benchmark：`tools/benchmark_secondary_search.js`（完整局逐决策
      完备性+性能汇总；`--record` 存轨迹、`--replay` 快进采样、`--complete` 开完整目标目录、
      `--detail` 逐决策明细）。
- [x] 2026-08-14 用户裁决（已落码/落文档）：
  - 规则修复：公共牌区扫描放置后**留空**，扫描流程结束时统一补牌（`science-session.js`
    PUBLIC_REFILL；参考行动日志“公共区留空待扫描结束补牌”）；RNG 序列不变，full-flow 哈希
    通过。
  - B1：打开完整目标目录（`completeTargetCatalog`，消除最低成本尾部调度截断）。
  - B3a：数据足够且无立即得分/结算放置时，允许公共扫描继续（落入通用扇区代表收敛）。
  - A3（科技收敛、数据门槛、单席位规划）确认为用户给定设计，保留。
  - 有损剪枝纪律：任何新增/改动有损剪枝前必须先与用户讨论。
- [ ] SETI-156（核心启发式 outcome 单）仍挂在 `blocked`，但 blocker SETI-161 早已 done，
      状态过期；收尾时恢复跟踪或按现状收口。
- 延后：v26 估值回退归因（61.25→49 主要源于 08-03 估值/目标调度改动）——按“暂不考虑
      评估函数优劣”的口径暂缓；若后续恢复估值优化，从逐提交归因重新开始。

### Phase 1 完备性基线测量（进行中）

- [x] 截断模式全量基线（423 决策 / 365 搜索）：整局丢弃目标绑定 **17637**（
      `totalTargetSchedulerPrunedCount`），10 次触 4096 上限、**13 次超 10s**（最大 23.8s）、
      剩余 frontier 合计 7780；四席 57/49/49/41（均 49），median 133ms / p90 975ms。
      即当前“高效”截断模式本身已违反 10s 门禁。
- [x] B1 完整目标目录（`--complete`，45 决策采样）：**`targetSchedulerPrunedCount=0`
      （完备性达成）**，但 4/17 搜索决策触 4096 上限（剩余 frontier 734-818）、4 个超 10s
      （16.2-17.0s）；单决策 median 99ms / p90 4241ms；completedGoalTransitions 2741。
      与 08-02 完整尾部实验（4096 触顶 / 884 剩余）一致。
- [x] 修复：`completeTargetCatalog` 原本只传到第一处 `selectSuccessors` 调用点，第二处
      （深度推进路径）未传导致开关失效（`c1a9e2e`）。
- [ ] B3a-only 全量测量：B3a+规则修复后晚盘病态慢（全量 >70min 未完成），早中期 120 决策
      40s 正常；晚盘慢是已知“必须高效化”的独立证据。
- [ ] 完整局 `--complete` 测量（预计 40-60 min，待高效化后更有意义）。

### Phase 2 结构候选 A：确定性资源缺口宏步

冻结定义（五轮锦标赛结论）：为选定目标建立标准反事实宏步——同一目标所需的快速转换、
数据奖励与支付先求最小损耗方案，再用正式 primitive 逐次提交，**不把中间确定性选择重新
作为搜索分叉**。宏步走正式 executor 与 Decision 链，不手写规则；目标内部等价保留
`targetEquivalentChoicePrunedCount` 诊断。

基准：先以决策 #320 为单步基准，达到 10 秒门槛内并显著下降后再跑整局。

验收：单次决策耗时显著下降且 `executionLimitReached=false`；行为义务（手段必须解锁
正式代理）不降；固定盘面均分不降。

### Phase 3 结构候选 B：完成态 DP 缓存

冻结定义：对“完成目标后的同盘面后续搜索”做动态规划缓存，缓存键含正式状态等价 +
剩余目标深度 + 隐藏信息边界，去掉已完成目标顺序造成的排列重复；**不得合并当前目标
不同的 origin**。完成态支配继续按 `rootActionId + goalDepth + targetId` 分组。

验收：单次决策压回 2 秒记录目标内；固定盘面分数不降；`targetSchedulerPrunedCount`
与 `executionLimitReached` 保持诚实公开。

### Phase 4 性能分项优化（原子操作，进行中）

当前瓶颈画像：projection 42% > orchestration 25% > execution 20% > checkpoint 7% >
fork 4%。方向：

1. projection 物化裁剪：profile 每个投影字段是否被 Policy 实际消费，去掉未消费物化；
2. orchestration 与 frontier 管理开销分项；
3. 规则执行热路径（在覆盖不变门禁下）。

**2026-08-14 晚（第二轮，原子操作 + 观测生命周期，commit 系列）**：
- 克隆 67 万 → ~31.5 万次/决策（-53%）；稳定基准 3625 → ~1950ms（-46%）；
- complete 决策 #28：13.7s → ~8.5s（projection 1860 / 编排 3121 / 执行 2593 / checkpoint 907）；
- 观测生命周期重构：中间节点 cheap 观测（跳过 planets/data/solarSystem/finalScoring 克隆，
  只含 requirements/资源/rockets/aliens/公共牌/科技），叶形成时重建完整观测并按需遮蔽
  （评估器只读 aliens/rockets；报告 winning state 读完整 board）——行为逐项不变，
  complete max -35%、probe -46%（commit 6f07254）。
- 探索结论：
  - per-node 全量序列化（envelope 快照模型核心，薄引用需持久化状态重构）——保留；
  - per-submit 全量校验（fail-closed 契约，文档明确保留）——保留；
  - enumerateActions deepFreeze（安全网）——保留；
  - routeActions 构建时 target/payload 克隆——已移除（描述符已冻结，叶时整体克隆）。
- **最终验证（2026-08-14 晚）**：整局（截断模式）422 决策、四席 30/49/57/47，与
  规则修复后基线完全一致——全部优化行为中立性成立；整局墙钟 276s（干净机器，无病态决策，
  此前"13-14s 慢决策"为机器负载假象）；probe median 2128ms；complete 模式仍有 4 个
  4096 触顶决策（~11s，节点墙待宏步/DP 缓存）。
- **拓扑缓存漂移修复（commit d367c45/a2568a5）**：整局轨迹对比发现缓存键漏依赖——
  rotation 是对象（`{wheel1Steps..}`）被 `Number()` 成 NaN 导致不同旋转碰撞同键、
  漏 player.id（同盘面不同玩家 sources 不同）、漏火箭上限（orange1+行业被动）。
  修复后整局轨迹与规则修复后基线完全一致（行为中立性恢复）。
- 节点数削减评估：complete 决策 4096 节点为 transposition 合并后的**唯一物理状态**
  （单决策 4416 次 transposition 命中 + 3308 次共享 origin），非可去重重复；
  宏步（深版内联）与完成态 DP 缓存的收益被物理共享与预算截断下的探索顺序变化限制；
  深版宏步需重构主循环，风险高、收益 ~10% 编排。

验收：每次改动 benchmark 覆盖指标逐项一致（Phase 口径）；median 目标 2 秒内，理想
100ms；任何常规决策不得进入秒级。禁止通过缩 node cap / beam / leaf cap 伪造通过。

### Phase 5 策略缺口

- 登陆缺失：冠军局登陆极少，分析原因（路线优先级、可达性、估值）；
- 后三席偏低：四席分数方差大，定位公共扫描/公共牌争夺的时序问题；
- 快速转换审计：确认每次转换都服务于随后得分路线，无后续转化的分支加状态等价或
  资源下界剪枝。

验收：固定盘面四席均分、最低席、行动族分布逐项报告；行为义务优先于均分。

### Phase 6 收尾

- SETI-156 状态恢复跟踪/收口；
- 当前环境无浏览器实例，真实 Chrome smoke 在可用环境补做；
- `docs/ai-design.md` 与实现同步复核（机制变更时同步更新）。

## 3. 全程纪律

- **有损剪枝必须先行讨论（2026-08-14 用户约定）**：任何丢弃"无法证明等价或被正式支配"的
  备选分支/目标/时机/路线剪枝——新增或改动现有近似（如最低成本尾部调度、公共扫描提前结束、
  科技候选收敛、residual 立即结算等）——动手前先与用户讨论；等价合并、正式 Pareto 支配、
  乐观上界不可达属无损剪枝，可直接做但需在提交/文档中标注类别；
- 顺序固定：单次 Decision benchmark → 固定盘面 → 完整局报告；
- 10 秒单次决策门禁；不缩 128 / 15 / 4096 预算；no-beam；触顶必须标 incomplete；
- 每轮一个结构候选；均分严格上升且行为正确才保留；行为义务优先于均分；
- 显式性能近似必须公开并带诊断计数；
- 调权重不得改变搜索空间（可达性/路线枚举/预算/剪枝集合）；
- 每次修改验证后自动提交（中文提交信息）；机制/状态/资料路径变化同步更新文档；
- 性能目标：常规决策毫秒级，优先 100ms 内；2 秒为必须显式报告的记录目标。

## 4. 关键文件

- 搜索执行核心：`randomizer/game/rule-composition.js`（counterfactual 次级代理搜索，
  `maxExecutionNodes` / `maxProxyDepth` / transposition / 目标调度）
- 目标目录与调度：`randomizer/game/ai/expected-score-evaluator.js`
- 观测投影：`randomizer/game/ai/outcome-model.js`
- 固定盘面报告：`randomizer/training/heuristic-policy-turn-report.js` +
  `tools/report_heuristic_fixed_board.js`（`--focus-decision N` 单节点 trace）
- 基准：`tools/benchmark_probe_policy.js`
- 回归：`tools/run_node_tests.js`
