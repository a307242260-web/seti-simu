# 快速移动丢失正式能力事件（2026-09-08）

结论：候选81ee9ed6的快速交易移动确实丢失底层能力返回的事件。
这是独立规则事件传递缺陷，不是借科技消费诊断字段，也尚未证明导致历史降分。

脚本：`adhoc/reproduce-quick-move-events-20260908.js`。
有效复现：`reports/iteration/quick-move-events-v3-81ee9ed6-20260908.json`。
从真实第50步根派生fixture：把现有探测器改属蓝方，将公共区已有b2移入蓝方保留区。
通过正式quick_trade的energy-for-move进入Decision，逐个恢复该Decision快照并提交
全部四个合法方向。对照调用同一个正式moveProbe原语，原options完全一致。
没有运行AI或完整局，也没有伪造规则执行事件。

| 方向 | 底层返回但外层丢失的事件 |
| --- | --- |
| out | move、visitAsteroid |
| cw | move、visitAsteroid |
| ccw | move |
| in | move、visitPlanet（earth） |

四次正式提交均成功，但外层journal只包含quick_trade及quick_move。
production-composition.executeMove调用moveProbe后重建返回值，没有转交result.events。
地球访问不满足b2的非地球要求，因此本fixture不证明该任务漏奖；需另补满足真实任务
条件的访问用例。不能仅从nextDecision=null推出任务bug的具体收益。

首次fixture重复创建了公共区已有b2，restore拒绝STATE_CARD_LOCATION_CONFLICT；
第二次诊断从inspect摘要读取不存在的workingState导致脚本TypeError。
两份失败记录保留为v1/v2，均非实际AI搜索失败。v3改为移动已有卡牌实体、从正式
checkpoint读取工作状态后复现通过，没有修改生产代码或放宽规则验证。

## 独立修复计划（未实施）

目标：快速移动保持正式move与全部到达事件的内容、来源及顺序，另保留现有quick_move
交易审计事件；不二次执行移动、不二次发放到达资源、不修改候选策略、费用或随机机制。

1. 修复前补非地球访问任务的正式复现，确认下游事件处理而不只比对数组。
2. 在独立临时工作树修复executeMove的事件传递；核对standard-action/residual处理链
   不重复消费这些事件，完整保留卡牌来源排除与任务互斥选择。
3. 验证四方向事件保留、资源和坐标与原语一致、任务选择/领奖恰好一次，及错误owner、
   stale输入、等待任务奖励时存档恢复边界。不得只改事件数组后立即跑全盘。
4. 同步机制/AI规则执行说明及相关测试，语法、V输入审计、相关unit/full-flow。
   单点仍需实际耗时、节点、输入、计划执行验证；满足单点门槛后按登记去重跑全盘。
5. 按独立规则bug例外验收并记录真实终局；不把该例外扩成性能候选低于108.5也通过。

本次仅完成复现与修复计划。已检查迭代规范；无生产或接口变更，无需改README/AGENTS/
AI及RL接口说明。取证脚本及报告同期留档，不登记为已完成的策略版本。

## 进展：非地球访问复现与独立候选

后续v4将同一探测器放到地球位置，经正式energy-for-move向外访问火星。
正式匹配器识别b2三个奖励，旧版实际无任务Decision，漏触发得到具体业务证明。
证据：`quick-move-events-v4-81ee9ed6-20260908.json`；不是历史盘面降分归因。

独立候选`c50e4f01`，分支`fix/quick-move-events-20260908`，工作树
`/private/tmp/seti-quick-move-events-20260908.RYFIBr`（基于81ee9ed6）。
改动：快速移动转交底层已有events，再附quick_move审计；不二次移动或发奖。
候选已同步mechanics-reference与修复设计，未合入主目录dev、未推送远端。

正式composition测试修复前move事件0≠1失败，修复后通过：火星访问出现三个互斥
任务奖励，能量奖只领一次；错误owner、重复提交不改envelope；奖励等待中存档恢复
后完整envelope一致。定向回归unit 7/7、full-flow 1/1，V输入审计通过。
没有运行全量83个unit。单点性能/计划、额外到达事件类别及固定全盘仍待验收，
没有新增终局成绩，也没有将该规则候选登记为已通过的性能版本。
