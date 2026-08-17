# 原子操作克隆必要性审计与剩余优化方向（2026-08-14）

## 审计结论（structuredClone 打点，complete 决策 4096 节点）

单决策克隆从 **67 万次降至 31.5 万次（-53%）**，稳定基准 **3625ms → 2620ms（-28%）**，
搜索行为逐项不变（节点数/完备性指标一致）。

### 已移除的冗余克隆（fresh 对象防御性克隆，安全审计后删除）

| 站点 | 次数 | 依据 |
|---|---|---|
| probe/income requirement 的 endpointTarget/nextStep | ~89k | choice.target 由 listOrbit/Land/route 每次新建 fresh |
| formalizeChoices target/payload | ~72k | choices 由 makeChoice 新建 fresh；getDecisionSnapshot 存储时再克隆 |
| normalizeDescriptor target/payload | ~88k | family enumerate 每次新建 fresh；enumerateActions 会 deepFreeze |
| sanitizeRequirementPlans 二次克隆 | ~19k | 调用方已 clone 整棵观测，改原地过滤 |
| sanitizeHiddenInformationActions 无条件克隆 | ~20k→少量 | 只在真正遮蔽未知牌时才需要克隆 |
| selfStateOf | ~33k | source.selfState 由观测构建 fresh 并 frozen |
| getTurnState | ~8.5k | 调用方只瞬时读取原始字段 |
| buildObservation/observeWithActions 的 requirement 克隆 | ~21k | projectState 已构建 fresh requirement，再克隆纯冗余 |

### 保留的必要克隆（当前"构建即冻结"观测设计下必需）

| 站点 | 理由 |
|---|---|
| sanitizePublicPlayer techState/income（~50k） | 观测 deepFreeze 会冻结活状态，必须克隆脱离 |
| sanitizeAlienPublicState traces（~8.4k） | 同上 |
| sanitizeSelfPlayer hand/reserved（~13k） | 同上 |
| buildObservation board 克隆 rockets/planets/data/solarSystem（~17k） | 同上 |
| sanitizeFinalScoringState（~8.4k） | 同上 |
| maskUnknownCards（~10k） | 遮蔽路径需要可变副本 |
| getDecisionSnapshot choices（~13k） | 会话决策快照隔离 |
| normalizeResultArray/normalizeEffect（~22k） | effect 队列稳定性 |
| sectorWinRequirements wins（~4.3k） | 脱离活状态（移除外层克隆后内层必需） |

## 已完成的优化（2026-08-14 晚）

- 克隆：67 万 → 31.5 万次/决策（-53%），全部行为逐项不变；
- 稳定基准（benchmark_probe_policy 12 次）：**3625ms → 2387ms（-34%）**；
- complete 决策 #28：wall 13.7s → 12.1s；projection 分项 5150 → 3221ms（-37%）；
- **拓扑 requirement 缓存**（方向 B，已实现）：BFS 可达性按
  （gameId + 太阳系旋转 + 全火箭占位 + 玩家 orange2）缓存，quick_trade/place_data 链上
  火箭未移动时只重算资源缺口；projection 分项 -35%（commit 后投影 865→575ms）。

## 剩余两个大头（设计级改动，均无损）

### A. 观测生命周期重构（目标：消除 ~100k 观测克隆 + 每节点每玩家终局计分）

现状：反事实观测 = `buildObservation`（simulation-env.js:189）每节点全量构建——
4 名玩家 × sanitizePublicPlayer（techState/income 克隆）+ board 四块克隆 +
每玩家 `computePlayerFinalScore`（终局计分，仅叶评估需要）。

方案：中间节点观测不再 deepFreeze + 不克隆 board（引用活状态），完整观测只在
**叶存储时**构建/克隆；`computePlayerFinalScore` 只对叶计算。中间观测只被
selectSuccessors/branch priority 瞬时读取，不跨节点持有。

风险：冻结语义变化（观测可被变更/陈旧）；叶存储点（addLeaf/addFrontierLeaf/origin
rootActionObservation）必须补克隆；sanitize 路径依赖冻结观测。

### C. 编排开销（新发现：complete 决策 orchestration 3314ms，反超 projection 成最大分项）

现状：搜索循环每节点重建 origin 的 chain/routeActions/goalTrace 数组并深拷贝；
`routeResultTargetIds` 等数组逐 origin 克隆（6.4k 次/决策）。

方案：origin 记账改共享不可变结构（chain 用持久化链表或共享前缀）；只在变更时新建
小数组；`routeResultTargetIds` 用冻结共享数组（从不修改时）。

## 决策点

- 两个都做？先 A（观测克隆，~30% 时延）还是先 B（拓扑缓存，~15%）？
- A 涉及冻结语义与叶存储，需按 implementation-proof-obligations 冻结设计再动；
- B 是纯缓存，风险较低，可先行。

## 方向 D：计划延续复用（诊断已落地，2026-08-XX）

现状：每次决策对每个绑定目标的 legal action 都从同一 checkpoint 全量反事实搜索
到本席 PASS / 15 个结果目标。相邻同席决策（如 R1 两次行动之间）搜索的大部分内容
（目标目录、路线、计划下一步）是同一份计划的延续，被重复执行。

诊断工具（不改决策语义，纯只读采样）：

- `randomizer/game/ai/plan-continuation.js`：目录指纹（剥离资源缺口，只对搜索读到
  的外部结构事实敏感）、计划下一步提取（winning leaf chain[1] + 语义键）、同席
  连续决策配对、预测器 precision/recall、失效原因与事实变化分布。单元测试登记
  `policy/plan-continuation`。
- `tools/diagnose_plan_continuation.js`：record-once（跑一局采样，可 --max-decisions
  截断）/ analyze-many（纯读 JSON，可无限迭代）。模拟盘慢时不必跑 N 局。

关键设计：

- 目录指纹剥离资源缺口（credits/energy/…），本席自己的行动造成的「计划内变化」
  不改变指纹；目录候选数组按元素 stableHash 排序后再哈希，投影深度（cheap vs
  full）导致的枚举顺序差异不产生误报。
- 计划下一步 = winning leaf actionChain[1]，descriptor 从
  rootActionLegalSuccessors（根行动刚执行完的后继，含 conditional 决策）与
  rootActionSettledLegalSuccessors 解析，语义键比较避免 actionId 序号漂移。
- 尝试过「计划假设状态（rootActionObservation，cheap 投影）vs 实际状态」的整目录
  比较：cheap 投影与全量投影结构不同（公共牌延迟补牌、resourceGap 缺失、
  traceCount null），不可比，已从预测器中移除——外部事实发散由「上一决策全量目录
  vs 当前全量目录」（directorySame）覆盖，本席计划内变化的误报由实证 precision/
  recall 量化。
- 失效原因按事实分量点名（board.rotation / board.planets / board.aliens /
  board.data / board.publicCards / board.techSupply / directory.*）。

首测（固定盘面 seti-107，前 150 决策，4 席，48 对同席连续决策；margin 预测器在
后续判定演进中已移除，此处不再引用）：

- 实际命中（计划下一步 == 新搜索实际选择）37/48 = **77.1%**；
- 预测器：stepLegal precision 77.1% / recall 100%；directorySame precision
  80.6% / recall 78.4%；组合（stepLegal+directory）precision 80.6% /
  recall 78.4%；
- 未命中 11 例：7 例 plan-degraded-or-alternative-improved（便宜检查全过但搜索
  改选——实证为条件决策平局 tie-break 发散，如 blue1 slot1 vs slot4 同值 52），
  4 例 directory-changed；
- 命中决策可省搜索耗时 6.2s（占配对 cur 搜索总耗时 73.9%）；实测 miss 的条件
  决策本身便宜（40-170ms），贵的根行动搜索命中率高；
- 搜索耗时构成（28.9s）：execution 31.4%、orchestration 27.4%、projection
  15.5%、fork 12.3%、checkpoint 11.6%、frontier 1.8%。

## 方向 D 落地：fast-path v3（分层架构：simulation 管复用，方案输出计划，2026-08-XX）

按用户架构重构：simulation 侧负责模拟，每个机器人决策点先看能否直接复用上次
计划；不复用才调用决策方案，方案输出 { actionId（至少下一步）, plan?（完整
计划，用于复用判断）}。

- 契约：`heuristic-decision-function` 输出携带 `plan`（winning leaf 的
  chain.slice(1) 完整链 + 依赖 + 揭示基线）；simulation 的 store 存完整计划，
  `planReuseCheck` 命中后 `advancePlan` 前进一步存回（多步逐步消费），链条耗尽
  或判定失败才调用方案。
- 判定不变：下一步合法 + 揭示基线未增 + 依赖环节未变（含跨出路线终点守卫）→
  复用；否则重新决策。
- 复用的决策来源 = 计划缓存（不透明于 policy 接口的近似，见红线）；方案接口对
  任何 policy 可插拔（输出含 plan 即可参与复用）。

首测 A/B（seti-107，前 120 决策）：命中 76/92 = **82.6%**（多步消费使一次搜索
覆盖后续多个决策），wall 16.8s vs baseline 36.2s（**省 53.7%**），miss 12 例
no-plan + 4 例 step-not-legal；终局分差四席合计 +1（白 -6 / 棕 +5 / 绿 +2），
提交失败 0。全量 Node 回归通过。

## 演进历史（已删除的中间设计，不实现）

- v1/v2 的 `attemptPlanContinuation`（单步 store + 全局目录指纹门槛 + margin 门槛）
  已删除：margin 与「本次续用是否安全」无因果关系；全局目录指纹会把本家行动
  造成的计划内变化误判为失效。
- 判定演进结论保留在当前 v3：对照基准 = 上轮本家行动执行完的计划假设状态；
  依赖环节（路线终点移动步数/第一奖励格、外星痕迹槽占用）未变即复用，翻开了
  外星人无条件重新决策。

## 后续红线（fast-path 落地约束）

- 命中决策提交前必须对 fresh state 重验（合法集/authority，经 env.step）；
- 缓存键含 policyType/version/modelChecksum/configChecksum；隐藏信息屏障后失效；
- 同一 seed 下开/关缓存的决策逐位一致（或作为显式近似 + 计数器登记，同
  targetSchedulerPrunedCount 文化）；
- 只把复用当「种子 / 优先级」，不当剪枝依据。
