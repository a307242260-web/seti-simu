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
- [ ] SETI-156（核心启发式 outcome 单）仍挂在 `blocked`，但 blocker SETI-161 早已 done，
      状态过期；收尾时恢复跟踪或按现状收口。

### Phase 1 v26 回退归因

目标：定位 61.25 → 49 的回归来源。嫌疑提交（08-03 策略改动，按时间序）：

- `4851418` 按行星距离规划登陆环绕并补全报告盘面
- `dfe6008` 报告复用正式盘面并启发式收敛科技搜索
- `5301f58` 按真实距离调度行星目标并移除无目的打牌
- `580c195` 按目标收益约束额外公共扫描
- `2213a51` 按最近空置奖励格收敛行星目标
- `c83491a` 按轮次细化收入与科技终点评价

方法：逐提交用低成本信号定位——首决策 benchmark + `strategic-goal-evaluator` 定向测试 +
决策 #320 单节点 trace（行为/节点/耗时是否漂移）；锁定嫌疑提交后，仅对关键分界跑完整
固定盘面（约 423 次 Policy 决策，分钟级，避免全量逐提交跑）。

决策规则：正确性修复（如信息边界）保留；纯策略导致均分回退的提交回退。回退后冠军基线
61.25 必须可复现。

验收：固定盘面均分回到 ≥ 61.25；benchmark 覆盖指标（candidate/executed/root target/
frontier）与回退目标一致；无行为漂移。

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

### Phase 4 性能分项优化

当前瓶颈画像：projection 42% > orchestration 25% > execution 20% > checkpoint 7% >
fork 4%。方向：

1. projection 物化裁剪：profile 每个投影字段是否被 Policy 实际消费，去掉未消费物化；
2. orchestration 与 frontier 管理开销分项；
3. 规则执行热路径（在覆盖不变门禁下）。

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
