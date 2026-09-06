# 高移动节点决策CPU取证（2026-09-06）

结论：先优化Policy输入校验复制，而非扩大公司移动的策略裁剪。
真实42单次冷决策中，createDecisionContext累计约10.49秒，超过搜索累计约9.10秒。
减少节点仍是Goal主线，但本样本的显著耗时不全在节点执行，不能把节点占比当耗时占比。

## 输入与证据

- 取证时HEAD f9b44e37，生产行为795cd6eb。
- 输入为已从新环境正式重放41步验证的company-movement-input-42-20260906.json。
- 执行前查询research列表，未重跑固定完整局；仅执行一次专门CPU采样的冷决策。
- `adhoc/profile-movement-decision-42-20260906.js`，Node原生`--cpu-prof`，产物
  `movement-decision-42-20260906.cpuprofile`及`movement-cpu-decision-42-20260906.json`。
- `adhoc/summarize-movement-cpu-20260906.js`按sample/timeDeltas汇总，产物
  `movement-cpu-summary-42-20260906.json`。self为自身采样时间；inclusive含子调用，不能相加。

## 数量及耗时

根动作仍place_data:dbe01b29，4096物理节点、4804成功提交、无执行失败。
决策wall22.844秒，采样全进程22.967秒（含启动与写盘）；采样开销未扣除，不能当优化收益。

| 函数/类别 | 自身采样ms | 累计采样ms |
|---|---:|---:|
| policy-port.copySerializable | 9829.00 | 10227.12 |
| policy-port.createDecisionContext | 0 | 10491.54 |
| rule-composition.evaluateCounterfactualOutcomes | 80.71 | 9101.43 |
| rule-composition.executeNode | 16.54 | 6124.97 |
| structuredClone（所有调用者合计） | 3544.07 | 3544.07 |
| GC | 1715.53 | 1715.53 |

关闭目标簇诊断后，节点family和提交数仍与先前开启诊断的冷运行一致，均比历史
完整局少15次提交（quick_trade少5、choose_target多5）。这排除了“仅因开目标簇
诊断导致差异”的解释；尚未证明实际根因，不称冷/历史搜索完全等价。

## 范围判断与下一项

移动本身存在visitPlanet/visitComet/visitAsteroid事件和独立位置价值；当前probe
目录只枚举行星终点。现有标准state观察也未提供公司remaining/usedRocketIds，
仅凭合法选位无法一般性区分首次没有匹配方向与已经移动过该火箭的后续阶段。
因此完整公司需求式改造不能当作简单去重；暂不扩展公开需求模型，不关闭公司入口。

Policy复制已有单次图WeakMap复用和祖先集合原地维护，本轮不得重复实现这些优化。
下一项先在真实actionOutcomes图上定位重复字段校验、错误路径构造与副本成本，
比较保持相同安全校验及输出图的实现方案。禁止trusted bypass、跨请求共享可变引用、
省略禁止字段/循环/accessor检查、删计划证据或减少真实叶。单决策提速必须同时
验证动作、叶排序、计划、节点及提交数不变，再依标准流程做固定终局验收。

本轮仅增加采样与汇总脚本及原始记录；语法与汇总样本数量校验通过。
已检查Policy端口、Outcome投影、AI设计以及此前两项copy优化记录；更新性能计划
和公司方案状态。生产接口/规则未变，README/AGENTS、AI设计/RL及公司规则无需改写。
