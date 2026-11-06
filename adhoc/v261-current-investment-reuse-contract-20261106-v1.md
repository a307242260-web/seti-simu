# V261 同次投资基线复用契约

V259/V260实际132冷样本均175次输入、约640ms失败，首次结果保留。V260逐次观察证明，同一basePurposeCapital调用已知的held+paid研究资本及预付电脑资本，等于探测器初始投资895次、收入分配初始投资930次，分别重复约12.82/9.63ms。另118次fork canonical序列化中35次恢复同一个冻结Native提交对象后重算，重复约6.74ms。

仅复用已计算的当前基线：`sum([held+paid,computer],weights)`，保留先held+paid再正式sum的精确求和顺序、自定义权重和电脑分数。探测器所有后续钱包/手牌/外星人变化仍重算；收入分配所有后续供应牌、公司交换与匿名类别仍重算。没有用整份purposeCapital.total替代子组合，没有跨用途叠加同一钱包。新增输入仅为同次已算出的数字，不伪造观察、Native后继、已知牌、RNG或剪枝上界。

StateStore仅在已有trusted isolated/full-frozen Native committed root契约内，以同一对象引用复用自己生成过的canonical bytes。保留最近一次热命中，并增加最多64对象且UTF16字节合计8MiB的FIFO；大于上限的单根不加入扩展表。不同对象、同版本不同根仍分别序列化，普通宿主serialize校验不变，输入envelope字节不能直接充当canonical缓存。恢复、提交、journal、undo、规则校验与RNG不变。

测试先证明旧版重复计算/跨根序列化，然后验证完整quote一致、只跳过初始投资、后续投资仍调用、变更钱包重算、坏的预计算值显式拒绝；canonical A/B/A引用复用、同版本不同根、失败提交、普通恢复、64项和8MiB限制。相关测试通过后冻结V261，在独立物理工作树先actual132，再原728个具名冷根及前两轮完整契约；每个必要根必须闭合且≤256 Native输入/600ms。四项生产预算仍null，既有完整状态/actor/session/RNG/intent身份、等价与资源下界保持，无新beam、叶限额或深度截断。

本次未采用全图内容缓存、层级资本缓存、固定预览缓存或延迟诊断endpoint原型：命中/耗时收益不足，延迟getter还需要额外保持公开quote对可变调用输入的契约。基线V41和真实V256第三轮87/6/7钱2电1牌保持；未全部准入不运行新自主局。
