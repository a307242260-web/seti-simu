# POLICY-OBSERVATION-COST-01：节点内完整叶投影复用

起点09d4ad6a；含单独未证明提速的批次副本复用2cf360bf，本候选将其作为管线组成验证，
不把前项改判成已验收。符文修复f599b974独立贡献不变。

同一executeNode返回后，origin循环只编译计划/选择后继/添加叶，不推进规则。
fullLeafObservation目前逐origin重新读取完整投影。改为每个物理节点懒建一次完整
冻结投影；遮蔽结果按informationBarrier对象身份分别缓存（null为独立键），未遮蔽
观察不进入遮蔽缓存。进入每次executeNode之前清空全部缓存，不按stateVersion跨节点复用。
rootObservation/viewer在整个搜索调用固定。任何投影错误仍抛出，不回退cheap或root。
下游批次复制复用使同一原始事实继续保持只读共享，原资格/Policy校验不变。

PASS：相关投影、Policy、真实counterfactual unit与唯一full-flow通过；真实334缓存值
与每次重建投影逐叶深比较一致（包括所有遮蔽边界）；全部6701叶评分、赢家/计划等价。
冷总时<65117.26425ms、战略<=19872.366875ms，4096/256/30000预算不变。
单决策通过后继续唯一完整局，分别登记规则修复和性能候选、合主更新报告中心。
