# 单次会话观察重复枚举消除：冻结设计

目的：减少实际搜索观察路径的重复合法项枚举，不改状态空间、预算或估值。
前置性能证据：round-income-green-profile-20260906的getDecisionSnapshot复制栈有
实际采样开销。session-runtime.observe目前先inspect枚举decision，再调用
getDecisionSnapshot枚举一次，二者读取同一session、同一revision。
这不是原30秒超时根因已经确认；收益必须实测，不能预先宣称解决超时。

## 方案与义务

| 边界 | 设计 | 验证 |
|---|---|---|
| 唯一owner | 只改session-runtime.observe，沿用inspect/getDecisionSnapshot正式枚举与错误结果 | 同一观察的两份decision内容相同，枚举只调用一次 |
| 独立性 | 先形成inspect结果，再复制decision供观察返回，最后调用projectState | projector修改其inspect副本不能污染观察decision；外部修改不影响session及下次观察 |
| 无缓存 | 不跨调用/revision/viewer复用 | 下一次observe重新读取合法集，变更工作状态后不能沿用旧选择 |
| cheap | skipDecisionChoices仍跳过完整枚举，返回decision=null | cheap下不触发枚举器，保持元数据投影 |
| 非等待/失败 | 非awaiting状态无decision；枚举失败仍保留原code/message | 抛错枚举器的EFFECT_DECISION_ENUMERATION_FAILED不被隐藏 |
| 状态/事务 | 观察只读；不改提交、撤销、恢复、RNG/id/sequence或持久schema | 真实存档观察前后checkpoint不变、输出hash对照；原恢复/提交测试 |
| 同源 | Browser/Simulation共享runtime，无环境分支 | 两类viewer行为测试，不新增适配器 |

前提是正式getLegalChoices/projectState的只读契约；不能为支持枚举器暗中修改游戏
状态而保留重复调用。复制必须发生在projectState之前，保持两份消费者可变引用隔离。
不改readStateSource的其他重复观察、不动必要的fork session恢复复制，避免扩散。

## 验证计划

先用已保存的真实quick200条件决策checkpoint做纯observe基准（不运行AI），保存
各viewer完整输出SHA及输入不变证据；相同输入、次数比较优化前后中位数。
在现有session-runtime unit核对上述边界，集中相关/全量回归；通过后独立中文提交，
再以真实绿方210步完整决策验证动作、优胜叶/计划和预算语义，不以微小基准代替门禁。
只有真实决策证据通过才运行新版本固定盘面；仍需完整终局均分及正确性双验收。

文档范围：effect-session-runtime、RL观察契约、AI四轮计划及迭代版本记录。
README/AGENTS/机制规则与PROJECT_MEMORY无需因纯观察内部复用变更。
生产方案按上表实现，不扩展其他观察入口。

## 局部验证结果

新增unit在旧实现下失败（同次观察枚举2次，预期1次），修改后通过。投影器与外部
消费者修改副本均不影响session和后续观察；后续调用重新枚举，cheap不枚举，枚举
抛错仍返回原错误。真实quick200条件盘面两个viewer的完整观察SHA前后相同，整个
checkpoint不变；80次观察中位245.524ms→218.581ms（约减少11%）。数据见
observe-decision-before/after-20260906.json。该局部计时不外推整局提速。

全量Node unit76/78、fullFlow1/1；仍为既有beam与分析后目标释放两项失败，未处理。
语法和diff检查通过。尚未完成绿方210步新旧完整决策对照，未跑新固定盘面终局，
不得据局部基准宣称原超时解决或第三/第四轮验收通过。

## 完整决策及终局证据

优化前代码来自git archive 227133c8的randomizer与正式卡表，隔离于临时目录，不切换
共享分支；优化后213f34db。同一个保存的绿方210步输入，完整16动作、2212叶逐项hash、
PolicyDecision及计划、所有非耗时搜索诊断、提交后coreState/观察/合法集相同。
无CPU采样计时11698.907→11719.984ms，基本持平；不外推局部11%到整局。
证据：observe-decision-search-before/after-20260906.json及对应adhoc脚本。

新版本固定盘面完成702步，正式终局96/84/130/124，均108.5，相对已通过基线+1.75。
quick137841ms+续跑389609ms=527450ms（约8分47秒）；前200步与6d67a974全轨迹一致，
full前缀精确复用quick，终局正式分与记录一致，四席最终数据计数与池长均为0。
证据：observe-decision-full-verification-20260906.json，两个研究记录和对应报告均
归属observe-decision-r4-20260906。仅终局数据账一致不外推全程数据账。

分数门槛与第三/第四轮当前累计实现审查均已通过，完整义务、回归和局限见
ai-rounds-final-review-20260906.md；不将分数增加归因为纯观察优化，也不把一次
无超时当原超时根因已解决。保留全部失败候选，不回写其历史结论。
