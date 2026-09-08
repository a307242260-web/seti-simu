# 独立修复：失效科技不得继续获得能力未来价值

2026-09-08，来自拿牌候选aa277dac第186步棕方交叉取证。独立修复已实现，尚待完整局。
证据alien-pick-brown-cross-summary-20260908.json：两盘面旧搜索均选环绕32.3333、研究30；
新搜索均选研究41.6667、环绕40.8333。新优胜路线研究紫2后使用赫利昂使其失效，
但techValue仍增加20。正式removePlayerTile将active真→假、owned保持真；V完全不变已复现。
这证明估值缺陷，不证明它解释完整局棕方全部14分下降。

## 冻结边界与职责矩阵

| 义务 | 来源、唯一owner、实现边界与证据 |
|---|---|
| 正式语义 | player-tech的ownedTiles/disabledTiles及playerHasActiveTile；mechanics-reference明确失效保留片、无能力、仍计科技数量、不能再拿同编号 |
| 新事实 | outcome-model从公共techState投影disabledTechIds，仅提取已拥有且disabled的ID；完整projection.progress与轻量createStrategicFacts同时提供同源事实 |
| 保留所有权 | ownedTechIds、techCount、orangeTechCount、已研究目标完成、researchOptions排除已拥有和正式终局公式保持原义，不用active列表替换owned |
| 未来能力估值 | expected-score-evaluator.infrastructureFrom携带disabledTechIds；infrastructureOf与valueFromStrategicFacts分别传入；唯一infrastructureTechPotential排除失效片 |
| 消费者闭包 | V的techEfficiencyValue、叶/根primary的techValue差、搜索热路径priority共用该potential；宣传研究机会仍按未拥有候选计算，不给已失效片重新研究机会 |
| 状态与隐私 | 只读公共科技状态；不改Rule State、Action/Decision、交易、公司奖励链、RNG/id/sequence、回放或不可逆屏障；不使用对手隐藏信息 |
| 兼容边界 | 新disabledTechIds是公共事实加字段，空数组表示无失效；基础无科技状态/现有调用保持原行为。所有正式生产投影点同时补字段，不从牌名或公司名猜测 |
| 搜索边界 | 不更改状态等价/nodeKey、目标可达性、资源下界或4096/256预算；估值事实修正可能改变搜索顺序，必须独立记录分数与截断 |
| 诊断持久化 | heuristic-decision-function透传已有maxFrontierNodes/beamPrunedOriginCount/remainingFrontierNodeCount，使完整局能统计两种截断；不更改其计算 |
| 删除账 | 仅删除potential对全部owned无条件计未来值的旧语义；没有新增旧路径兼容层，也不改正式科技拥有统计 |

在临时独立分支从正确dev建修复，不包含未通过拿牌/顺序/数据/身份候选。
先单测正式disable前后拥有统计不变、能力未来价值减去20、root/leaf丢能力扣值、
已失效→已失效无重复扣值、V/primary/priority三路同源、终局正式分不变。
随后复用已捕获第186步观察做真实叶估值证据，再固定第186步单决策（30秒门槛、失败0、有效计划）。
实现符合计划后提交冻结版本、标准去重完整局一次。修复实际影响拿牌候选需另做交叉验证，
不得只凭单位反例通过就宣布棕方降分已解决或拿牌候选可合入。

实施验证：新增unit通过；全量79/81 unit、1/1 full-flow，两项既有断言失败不变，
V输入审计和语法通过。第186步正确盘面独立修复搜索14329ms、4096节点、失败0，仍选环绕32.3333。
真实缓存的拿牌候选两条路线，仅移除虚假科技价值20，环绕40.8333→20.8333、研究41.6667→21.6667；
其他收益分项不变。该缓存重估不等于拿牌+修复组合重新搜索后的最佳方案。
