# 路线标记依赖用途审计

2026-09-08。范围：消除真实356因金星已有登陆数2→3引起的4096重搜，同时保留
奖励、成本、来源、自己的标记和后续操作所需信息。没有生产修改，没有完整局重跑。
设计尚未冻结；以下是源码用途与正式primitive证据，不冒充完整执行链验收。

## 奖励分段（正式函数逐项比较）

| 域 | 必须区分的已有标记数 |
| --- | --- |
| 全部8个环绕目标 | 0 / 至少1 |
| 普通主星登陆，除火星 | 0 / 至少1 |
| 火星登陆 | 0 / 1 / 至少2 |
| 奥陌陌登陆 | 0 / 1 / 2 / 至少3 |
| 卫星 | 奖励不按次数分段，但指定卫星占用决定合法性 |

目录来自planet-rewards的ORBIT_REWARDS、PLANET_LAND_REWARDS、SATELLITE_LAND_REWARDS。
脚本调用正式函数比较已有数0—6；生产源码只对首次/第二次/奥陌陌前三次分支，
其余走恒定奖励。不得只硬编码金星或把火星/奥陌陌所有非首次视为相同。

## 不能被奖励等价替代的事实

| 用途与源 | 约束 |
| --- | --- |
| abilities/planet.js：已有环绕影响登陆折扣 | 保留正式终点成本，不只保留移动paidPoints；当前plan事实没有完整终点成本 |
| planet-stats.js：卫星唯一占用 | 保留指定satelliteId占用/路线存在性，不以同星球卫星总数代替 |
| end-game-scoring.js、cards/effects.js、aliens/jiuzhe.js | 本席标记数量/分布参与任务与终局；不能让自己的标记变化被“重复奖励相同”吞掉 |
| cards/play-domain.js：REMOVE_PLANET_MARKER | 正式选择以planetId/kind/index定位自己的标记，后续移除计划需检查相应索引/拥有者 |
| abilities/planet.js：forceFirstLandingReward | 卡牌强制首次奖励仍由正式能力处理，不能从原始计数推断所有卡牌奖励 |
| planet-stats.js：显示位、超出显示容量 | 标记继续记录；显示数量不等于能否环绕/登陆，不修改正式状态或显示 |
| 正式orbit/land事件 | 事件给出planet/actor/source，不携带普通markerSequence；正式事件继续原样发出 |

预定owner仍是plan-continuation的公开事实采集/具名依赖；正式规则与RNG不归其修改。
奖励应复用planet-rewards primitive，不复制第二套奖励规则。来源、移动路线、公司
额度、当前合法Action及奖励阶段释放边界继续有效。不是把全局盘面合并为一个状态。

## 奥陌陌发现的独立一致性缺口

aomomo.createPanelMarker接收canonical alienEntity序号，用它生成唯一id和sequence；
abilities/planet.js的奥陌陌orbit/land执行结果直接将marker.sequence作为markerSequence，
奖励随后消费该数。另一方面，需求目录由countOrbitMarkers/countLandingMarkers+1
计算奖励。实体序号和“该种标记第几次”不是同一口径。

正式primitive反例：空奥陌陌面板，分配实体sequence=17，放入第一个环绕/登陆标记：

- count均为1、返回marker.sequence为17；按次数1与按实体17计算的正式奖励不相等。
- 首次环绕额外外星牌会在按实体17时缺失；首次登陆额外3数据同样缺失。
- 项目物种文档规定首次环绕额外牌、前3次登陆额外3/2/1数据，与按次数计算一致。

这是生产调用链可见的风险及primitive级复现；下一步需正式能力执行链反例，确认
reward payload与实际资源/Decision，再独立修复。保留实体id/RNG/sequence归属，
不能把alienEntity重置或改成每种标记局部序号来掩盖问题。
当前固定盘面是阿米巴/虫族，不把该问题说成棕方这局下降原因。

## 下一步与门禁

补齐奥陌陌正式能力链证明并独立处理序号口径；随后冻结路线等价的完整事实矩阵，
批量实现奖励阶段/本席标记/成本/指定卫星/索引依赖，集中验证真实356与连续计划。
4096预算不变，单点30秒门槛、真实输入计数、隐藏信息与无规则失败要求不变。
完整局仍须新生产版本提交后按去重流程一次验收，不能用审计报告替代落地与效果。

证据：route-marker-semantics-audit-20260908.json；脚本
adhoc/audit-route-marker-semantics-20260908.js。primitive断言通过，语法/diff检查通过。
本轮文档只更新调查报告与入口；未变生产/API/运行方式，README、AI设计及模拟接口
仍描述现有实现，不提前写入未实施设计。
