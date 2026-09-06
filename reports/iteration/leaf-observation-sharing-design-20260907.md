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
| 唯一owner | 优先在Outcome生成不可变观察的批次内复用，不能让Policy端口接受trusted绕过 |
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
