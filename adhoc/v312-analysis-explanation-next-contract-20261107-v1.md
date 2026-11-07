# 下一项：分析候选解释延迟构造（尚未实现）

当前隔离SOURCE为V311，首次完整162Native/608.938250ms失败。不得重跑同源冷样本或新自主局。最新精确读取诊断位于reports/ai-foundation-20261107/analysis-explanation-use-v1/eager-candidate-explanation-usage-20261107-v1.json：1823条局部quote急切构造9027候选端点，其中1823选中；candidates列表只被incomePreparation的对象spread读取887次，算法中没有其他列表读取。936个数组完全未读。这个诊断没有实现lazy，也不是验收时间。

下一步先做内存原型，保留所有候选局部打分、排序、钱包/trace/trigger计算，只尝试将未选中候选的完整endpoint/解释对象物化延后。必须始终完整物化选中项以执行原portfolio回调。不能借解释延迟删局部候选或省略正式事件/可达性。

关键义务：

- 最终公开结果的字段、顺序、候选数组顺序和全部值与V311完全一致，包含选中项与数组中相应对象的原有身份关系、planNetGain=null/已报价区别。
- 不因getter在incomePreparation的spread中立刻触发；需要保持包装后相同字段与收入前缀的selected克隆/原candidates关系。
- 如使用枚举getter，重复读取应返回同一数组，JSON/structuredClone结果一致；保留既有赋值/删除能力或明确验证所有权契约，不能悄悄改变调用方操作。
- 延迟部分只读取同次quote的私有稳定值。原输入中曾按值复制的字段、slot外壳、blueSlots、nextFinalMark/选项等应在原时点取得快照，不能在稍后读取已被外部修改的mutable输入。原本只读借用的子树仍遵循现有契约，不冻结来源。
- 选中端点必须在portfolio调用前建立；未知牌可用数量、触发消费与首次标记必须保持，不把未选中的局部候选冒充完整未来报价。
- 不吞构造/读取失败，不提供旧估值fallback，不缓存可变来源引用。生产StateValue公有接口之外不新增Native状态/观察/实体或隐藏身份。

先用旧源复现不必要端点物化，再验证所有完整候选/1536历史组合及定向mutable/frozen/metadata变更、收入包装、空候选/新标记边界；相关Native/Browser/输入审计通过后才冻结新SOURCE和唯一首冷。单点≤256/600后才继续全1258/source准入、前两轮实际资产、原23自主前三轮和R2轮末回查。完整goal及V41保持。
