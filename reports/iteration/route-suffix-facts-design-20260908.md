# 等额终点与剩余计划依赖：实现冻结设计

2026-09-08，基于组合5d17835f，独立分支perf/route-suffix-facts-20260908。
目的：341金星总标记3→4且奖励/路线相同时不重搜；370旧反例的后续公共牌、
扇区变化仍须在自由决策时使计划失效。不是恢复旧bb028006整版，不调权重。

## 唯一职责与完整作用域

| 语义 | 来源与owner | 保存/比较及边界 |
|---|---|---|
| 终点正式奖励、费用 | production-kernel候选构建调用已有planetRewards/planetAbility | endpointFacts复用正式完整效果、费用与己方标记；不读总标记数代替奖励 |
| 路线/第二来源/额度 | 原probe目录和plan-continuation具名scope | requirement/source/步数/首步/移动费/总费用保留，第二艘仍独立依赖 |
| 己方标记/移除索引 | 正式普通行星、奥陌陌面板 | 所有己方orbit/land/satellite位置和内容；具名移除索引；目标消失仍拒绝 |
| 后续计划依赖 | 同一winning leaf的全部真实步骤，经既有stepScopes和scopedFact | 先编译各段当前依赖，再反向汇集后续具名scope；每步保存该步开始时的事实，不用未来事实回填当前 |
| 完整scope目录 | route、planet-marker、tech、final-tile、sector、data、card-slot、card、alien、movement-context、movement-source、probe-scan-source、scan-earth | 当前依赖沿用必需事实门禁；后续依赖明确保存present/value，尚不存在的未来探测器等不冒充缺失结果；现有路线结构不完整显式抛错 |
| Own effects | 每个正式输入前capturePlanStep | 自己补牌、移动、填数之后，以新一步预期事实重新比较，不拿整条计划的最初事实反复检查 |
| 强制结算与不可逆边界 | 原Action.phase与goalCompletionPending | 后续依赖仅main/quick且非奖励阶段检查；conditional/已完成待奖励沿用本段依赖，不因后续目标变化打断强制奖励 |
| 目标归属 | 原goalDepth/routeTargetId/routePlanId分段 | 当前段不合并、不删除；后续依赖单独字段，scope稳定去重，已失效后续段不能让前面自由动作继续消费收益假设 |
| 恢复、旧入口 | plan唯一owner | plan v4，probe requirements v3；旧计划拒绝，reset/load继续清空；原markers仅历史诊断保留，不作为生产比较路径 |
| 正式执行/隐藏信息 | 原composition/inputPort | 规则、Action/Decision owner、RNG/id/sequence不变；仅公开事实，不新增随机读取，不改正式合法集 |

后续scope不存在用明确present:false表示；不是none/undefined结果。目录字段仍由
capturePlanStep统一构造，非法scope抛错；本段缺失继续产生显式无效计划。
为了完整覆盖，后续无效段传播为当前自由决策计划无效，不静默忽略。
后续依赖反向去重汇集，当前段依赖不重复存入；不复制整个observation或增加缓存。

## 预算、等价性和验收

不改状态等价/nodeKey、搜索可达性、资源下界、4096执行/256队列与30秒单点预算。
这是计划有效性优化，不以截断代替剪枝。代价是计划证据增加；先测327实际搜索
和341真实复用，单点超30秒时不运行完整局，不能用省一次搜索掩盖单节点开销。

单测覆盖：正式奖励等额/非等额、费用、己方标记、移除、卫星占用；所有具名scope
后续变化、自己推进、未来来源当前缺席、强制奖励阶段不扩大依赖、旧版本拒绝。
真实341等额标记应命中；旧370后续公共牌/扇区变化须拒绝；真实执行路径必须核对。
使用现有唯一full-flow与相关unit，V输入审计；实际规则失败0。实现符合预期且
单点门槛通过才冻结新版本，标准去重唯一完整局，对照108.75组合与101.75dev；
同时要求目标物理节点大幅减少、均分上升、截断更少。失败不合生产，分别归因。

生产删除账：capture routes不再保存markers；scopedFact不再比较markers；
旧v2/v3计划不能由v4恢复。后续义务单独字段，不用跨段合并或全盘脏标记替代。
同步AI/RL契约、相应unit及迭代中心，普通牌估值和重复准备等原Goal仍未完成。
