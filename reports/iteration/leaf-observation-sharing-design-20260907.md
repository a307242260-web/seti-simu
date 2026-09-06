# 叶观察重复复制：取证与生产方案门禁

结论：出现值得实施验证的候选，但生产设计尚未冻结。真实42的2938条保留叶存在
1989份完整值重复的独立观察，离线合并观察引用后，含索引开销的Policy处理5.484→
1.387秒。所有叶、25动作完整评分、选择和来源值不变。不是节点减少或整局新成绩。

## 证据

- `census-leaf-observations-20260907.js`读取既有V8图，输出
  `leaf-observation-census-20260907.json`；按完整JSON键分组、重复项再deepEqual。
- observation：2938个对象、949种完整值；独立对象JSON字节154085155，唯一值
  49277372。此数字不是运行堆大小，也不是可节省物理节点数。
- rootActionObservation、rootActionSettledObservation分别已只有3个共享对象，
  不重复优化这两项。
- `benchmark-leaf-interning-20260907.js`输出`leaf-interning-benchmark-20260907.json`：
  baseline5484.240ms，索引295.181ms，candidate含索引1386.910ms；2938叶/949观察，
  全值deepEqual、25动作评分/PolicyDecision相同，源V8图哈希不变。
- 同一可信实际输入的单次离线候选门禁，不运行规则搜索；没有新的固定局记录。

## 生产完整边界（未闭合前不写生产）

| 项 | 义务 |
|---|---|
| 唯一owner | HDF内部Policy视图按本批次复用不可变观察，不能让Policy端口接受trusted绕过 |
| 等价 | 完整观察所有字段相同才共享，包括viewer、authority、隐藏信息处理结果和probeRouteSummary；不是只比资源或游戏状态 |
| 图与隔离 | 只共享本批次不可变观察；不跨决策/席位/可变源缓存，不合并叶、链、来源或planSteps |
| 输入安全 | JSON.stringify不具备通用注入性：undefined/非有限数/特殊对象等可碰撞或转换；不得照搬离线JSON键实现并跳过校验 |
| 异常 | 原先拒绝的输入必须继续显式拒绝；不可用有效代表覆盖无效输入，accessor/toJSON等不能在新路径被意外执行 |
| 正式行为 | 规则输入、节点数、RNG、ID、beam/deadline以及排序字段全部不变；原计划证据保持 |
| 证据 | 补边界反例和消费者审查，随后真实42单决策评分/完整计划/节点与执行次数对照，再去重完整固定局均分≥108.5 |

下一步先比较按对象来源身份复用与按严格完整值复用的可行性。前者安全边界较小，
但Outcome投影当前逐叶新建、遮蔽可产生不同对象，必须量化能覆盖多少重复；后者
收益已见，但需要完整值及错误保持证明。不能为了更小diff牺牲覆盖，也不先改后猜。

源码审查：fullLeafObservation会按origin处理隐藏信息，projectOutcomeObservations
又逐叶createDecisionObservation并加入probeRouteSummary。只缓存fork完整投影
不自动意味着输出叶可共享；不能混用不同路径摘要或揭示边界。

已检查AI设计/RL契约/README/AGENTS与迭代流程：本次无生产接口、规则或运行方式
变化，仅更新性能计划与本候选证据。语法及diff检查通过；不重跑已有全盘或登记
未实施策略版本，不修改长期记忆。

## 生产方案冻结（2026-09-07）

采用HDF内部Policy视图批次级完整值共享，不改变Outcome生产与外部返回。这比缓存
fork观察更直接覆盖已量化的1989份重复，不耦合搜索执行和逐来源遮蔽顺序。
唯一修改点为HDF既有剔除planSteps的视图构造：本次调用创建WeakMap资格缓存与
Map完整JSON键，只有资格通过的leaf.observation才驻留为同一不可变对象。

资格完整定义：null/string/boolean、有限且不是负零的number；递归已冻结的普通
Object.prototype对象或Array.prototype数组。每个own key必须是字符串、可枚举
数据属性，无toJSON；数组仅允许连续自有索引及length；原型也不能有toJSON。
循环、不规则数组、特殊原型、symbol、accessor、undefined、非有限数、负零等
不做共享，原样送原Policy校验，不吞失败、不调用转换函数。资格缓存仅本批次，
递归处理中先置false保证循环不误判为通过，完成再置true。

在这个子集上完整JSON文本保持字段、值、类型及数组顺序；键顺序不同保守不合并。
只改变本批次相等不可变观察之间的引用共享，不要求原有对象别名拓扑相同；所有
原始actionOutcomes/planSteps及对外结果完全不改，Policy仍独立复制并深冻结。
viewer/authority/probe摘要/遮蔽结果皆包含在键中；所有链与来源元数据逐叶保留。
不新增公共API、配置、脚本依赖或搜索调用，无状态/ID/RNG/事务变化。

严格候选基准`safe-leaf-sharing-benchmark-20260907.json`：边界反例通过，冻结
真实输入图恢复生产前提（冻结时间不计），处理5959.794→2211.688ms，资格/索引
1115.563ms；2938叶仍949对象，完整值和评分相同。首次脚本多一右括号的语法错误
已修正，生产未受影响。之后按HDF集成反例、原安全unit、V审计、真实42及完整局
顺序验证；仍不以离线成绩宣称生产通过。

## 生产单点验收（2026-09-07，完整局待验）

已按冻结方案实现。HDF集成测试验证同批共享、原始输出不合并、跨请求不共享，
无效NaN观察仍被Policy拒绝。77个unit和唯一fullFlow通过；用户豁免的
simulation-counterfactual-outcome与strategic-goal-evaluator未纳入本次回归。
V输入审计、HDF语法和diff检查通过。

真实42单决策证据`shared-leaf-decision-42-20260907.json`：14393.059ms，
较上一生产版本16915.432ms减少14.9%；4096物理节点、4804规则执行次数不变，
25动作完整评价、完整原始actionOutcomes和29步计划逐字段相同。此为单次本机
测量，不代表多次稳定均值；收尾期间启动过只读旧结果分析，未据此推断独占运行。
优化没有删叶、链或选择，不能把1989份重复观察换算成1989个可删除节点。

已核对AI设计、RL契约、性能计划、迭代流程、README及AGENTS导航；内部视图
行为更新于AI/RL文档，公共API与运行命令不变，README/AGENTS无需修改。
生产提交后只运行一次该版本固定完整局，再核对全程动作、终局状态与非时间诊断，
登记迭代中心及结论。当前尚未通过完整局验收，不宣称本项或Goal完成。

后续：完整局已按计划仅运行一次。569步均109，全replay、完整终局状态和非时间
诊断相同；总375302→387053ms（+3.13%），性能收益未证实，不能作为性能通过。
完整证据与阶段结论见shared-leaf-full-review-20260907.md，第一Goal继续。
