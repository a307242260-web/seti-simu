# 绿方科技后续4入口：全部被队列裁剪

2026-09-08，生产 bb028006。Node inspector只读断点取证，无生产改动。

## 已证实去向

路径 `tech:gain:blue2 → data:analyze → income:gain:6,3,0,0,3,0` 的4次后续入口，
全部在trimSecondaryFrontier丢弃分支命中。每次retained.size=256，待执行动作
均为place_data，proxyDepth=2，前链长度8/8/9/9；rootActionId相同，均为b20弃牌角标。
4次执行计数为0，最终队列无该路径，与先前goalClusters证据一致。
因此去向已从“可能裁剪或留队”收敛为“全部因256队列裁剪丢弃”。

裁剪时搜索优先级的第三项分别9/10/12/12，另外两个较后字段同为12/-4。
不把这组排序字段当作最终评分，未改排序或权重。
最终255物理节点包含312来源：分析根303、发射根8、b20角标根1。
b20唯一保留来源是 `tech:gain:blue1 → data:analyze` 后的end_turn，不是blue2收入。

## 机制解释与边界

trimSecondaryFrontier先按rootAction.actionId为每个首动作保留至少一个节点，再按
compareNodes补满256；并不保证同一个首动作的每个root target、来源或后续目标都有
保留节点。蓝科技1与蓝科技2同由弃b20开始，因此当前保底规则可以保住前者同时丢掉
后者全部后续。这是现有队列机制的实际效果，不是已经证明的规则执行bug。

被裁掉的4条路径含不同分析奖励选择，不能因为下一个动作都叫放数据就直接合并。
它们后续可能更优也可能不优；12对23的比较不是完整穷尽结果，仍不能据此解释所有
终局降分。需要独立设计证明可消除的重复状态与目标来源保留边界，不能简单加队列或
节点预算、改权重，或把多个来源计数合并当作真实提速。

本轮还查看了根扫描225次来源执行但未完成目标的情况；没有据剩余2格直接判不可达。
正式规则允许同一SCAN_FINALIZE前放额外标记，须保留这条获胜路径，不能按格数粗剪。

## 证据与错误保留

- `green-final-frontier-20260908.json`：首次完整最终队列，含所有来源及目标路径；通过。
- `green-beam-cuts-20260908.json`：第一次裁剪读取失败。断点函数未捕获外层
  executedNodeCount，调试器读取该变量报ReferenceError；不是实际规则错误。
- `green-beam-cuts-v2-20260908.json`：去掉不可见的外层计数，只读当前node、priority、
  origins及retained.size，4次裁剪与完整末尾队列均捕获，通过。
- 对应三份 `green-round4-candidate-queue-inspection/beam-inspection/beam-v2-20260908.json`
  均保留搜索自身的一致性验证；评分、选中链、叶数、物理4096/输入5323与前次一致。
  运行分别15.278/15.542/15.589秒，调试运行不作为性能提速证据。未重跑完整局。

脚本 `inspect-green-final-frontier-20260908.js` 通过Debugger断点、throwOnSideEffect
读取真实局部变量，未修改生产、注入规则shim或改变状态；已有结果跳过。相关诊断脚本
语法与diff检查通过。仅诊断和报告变化，README/AGENTS/PROJECT_MEMORY/规则/AI接口
未变，无需更新。整体Goal未完成，生产候选仍不合dev。
