# POLICY-OBSERVATION-COST-01 第二轮定位

基线3418fea7，原生产f599b974。主目录与符文修复候选均未修改。
独立目录/tmp/seti-policy-share-check-20260913.qPiyZk。
前轮23b745a8将共享后移到完整复制之后，98.09秒未通过；不继承该生产改动。

本次将真实334根观察独立复制100份，直接执行原policyOutcomeView（无AI搜索）：
原34.02ms，带逐操作计时94.85ms。77900次isFrozen累计约3.00ms，378200次
getOwnPropertyDescriptor约18.68ms。计时本身有显著开销，不能将这些比例外推至全决策。
以非扩展+属性不可配置/不可写代替isFrozen的等价实验33.48ms，没有明显收益，不采用。

另一次独立变体将原型toJSON检查移至单次函数调用开始：基线33.68ms、变体31.32ms。
收益仍小，仅支持减少重复原型读取的局部假设，不证明可以消除38.9秒主体成本；
该变体保守拒绝所有含任一原型toJSON的输入，不完全保持原数组分支准入，因此不直接生产化。

源码核对：projectOutcomeObservations逐叶创建完整Decision observation；publicStateOf
克隆publicState，selfState在同席位时复用。完整叶fullLeafObservation每个origin重新投影。
WeakMap只能复用同一对象身份；真实叶的对象数量、重复内容及投影复制成本是下一取证重点。
应获取逐叶摘要和对象规模，不能再将整份actionOutcomes展开为一个JSON字符串。

未修改生产，不宣布性能项通过；既定逐叶/计划等价及冷总时门槛不变。
