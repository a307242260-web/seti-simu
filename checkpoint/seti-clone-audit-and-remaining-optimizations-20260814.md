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

### B. 拓扑 requirement 缓存（目标：消除 solar-core ~15% 路径搜索）

现状：`buildProbeRouteRequirements` 每节点对每个火箭做太阳系网格 BFS 路径搜索；
quick_trade/place_data 链上火箭未移动时路线完全相同，只资源缺口变化。

方案：按（火箭坐标 + 太阳系旋转 + 玩家 + 游戏身份）缓存"无缺口候选拓扑"
（planetId、path、movePoints、totalCost、rewards），每节点只重算 resourceGap
并 spread 新候选（共享嵌套字段，已冻结只读）。

风险：缓存键正确性（火箭移动/旋转/游戏身份都入键）；跨决策缓存需含游戏身份防污染；
每节点 spread 候选的开销 vs 路径搜索的收益需实测。

## 决策点

- 两个都做？先 A（观测克隆，~30% 时延）还是先 B（拓扑缓存，~15%）？
- A 涉及冻结语义与叶存储，需按 implementation-proof-obligations 冻结设计再动；
- B 是纯缓存，风险较低，可先行。
