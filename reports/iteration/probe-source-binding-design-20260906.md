# 探测路线来源身份审查（2026-09-06，设计中）

## 已证实的问题

真实固定盘面cf4280fd索引230，绿色玩家有2张手牌、0钱、0电、3宣传。
冷决策84ms选择PASS，仅执行2节点，无预算截断。
`r3-green-pass-choice-20260906.json`保存完整输入和搜索结果：

- 准备动作绑定`probe:rocket:1:land:mars:planet:`，1号火箭已在火星，正式需求1电。
- 两牌换1电及支付正确完成，随后选择的却是移动5号火箭，耗掉唯一能量。
- 叶仍标记1号路线，最终以`route-unreachable`结束，不可选，PASS胜出。
- 正式执行证据`r3-green-land-witness-20260906.json`：同一状态执行相同支付后，
  选择登陆及`land:1:mars:planet:`，基础分22→28、数据0→1、锁定终局分0→5。
  只验证到登陆奖励当前状态，后续外星痕迹选择仍有待处理；不是完整局成绩。

因此已证明存在可执行的得分路线被搜索错误换来源而丢失，不只是分数下降猜测。
该按targetId聚合同终点路线的代码在20feca27已存在，是既有搜索缺陷；不称为第三轮
引入，也不以本地6分收益推断终局必然超过106.75。

## 根因位置与边界

`expected-score-evaluator.selectSecondaryAgentSuccessors`的普通探测后继分支只按
`routeTargetId`筛选全部来源，混合动作后再用`goals[0]`重新绑定；conditional分支
也有只按targetId找第一条候选的读取。根选择已经携带明确routePlanId，后继未保持。
必须核对原生搜索的origin绑定与共享执行拆分，不能只把本例的`find`换成另一个`find`。

补充消费者证据`probe-source-consumers-20260906.json`（正式重放支付，纯函数调用，
没有新搜索）：支付后合法集含`land`、target=`{select:true}`。现有
`actionMatchesProbeStep`要求land入口携带rocketId/planetId，因此根目录和后继都
漏掉这条正式两阶段登陆路径；普通后继只剩5号移动。翻转候选顺序仍未选登陆，
但动作的routePlanId从1号变为5号，进一步证明身份绑定依赖目录顺序。

完整修复必须同时覆盖两阶段动作：主行动入口只确认有绑定来源的合法登陆机会，
真正的rocket/planet/satellite身份在正式choose_target阶段严格选择；不能把通用
land入口伪造成携带某一火箭的第二份正式动作，也不能只放宽入口而任意选靶。

已核对的状态归属：根目录按`probe:<requirementId>`登记，rule-composition每个origin
保存routePlanId，两个selectSuccessors调用点都会传递，后继显式routePlanId会覆盖
origin；共享物理执行不能用混合后的首项重写身份。goal完成后普通后继清空目标与计划，
奖励conditional还保留绑定信息，故选靶筛选不能错误作用于外星痕迹/扫描奖励。
Production仅在没有活动太阳系火箭时添加sourceId=launch，已发射来源为rocket:<id>。
待发射身份转换仍须覆盖免费发射牌及嵌套效果，不能仅凭这个目录前置条件宣称映射完成。

完成边界新增正式反例`probe-completion-boundary-20260906.json`：已执行的
`choose_target:7af35885`明确为1号火箭登陆火星，绿方登陆标记0→1，但
`completesSecondaryAgentRouteTarget`返回false。正式land有两个出口：唯一目标直接
`settleLandProbe`，多个目标先请求LAND_CHOICE，再由同一出口结算。不能只支持
choose_target而漏单目标直连，也不能把generic land入口开始选靶当成已完成。

已核对正式发射原语`abilities/rocket.launchProbe`：成功结果携带实际rocket对象，
events有launch/rocketId/playerId。来源信息应由实际执行事实确定，而非推测nextId。
搜索宏步内还包含settleChoice和nextPlaceData的正式提交；若使用事件映射，必须覆盖
各提交并按事件身份处理累计journal，不能再引入只覆盖根提交的半套来源收集。
优先评估能否仅凭已有分支观察与明确launch占位来源完成绑定，避免为此重建事件账本。

实施前剩余设计决策明确为两项：launch占位如何转换（包括一次效果链多次发射），
以及单目标直连的完成证据如何与多目标选择保持同源。来源保持、land入口、选靶和
完成四个消费者应一次实现、集中验证；本阶段不提交零碎生产修订。

待冻结义务：

| 路径 | 必须满足 | 待核对证据 |
|---|---|---|
| 根目标与来源绑定 | 同终点的不同火箭/待发射来源分别有身份，不合并成第一来源 | 根描述符与origin创建 |
| 普通后继 | 资源准备、移动、环绕/登陆沿同一来源；明确重新规划才能换来源 | 本次两火箭真实反例、候选顺序交换 |
| conditional | 支付、移动选择、登陆选靶不能跳到其他来源；奖励阶段不误继承已完成路线 | 正式选择与完成边界 |
| 发射 | 待发射来源变成正式rocketId时有可核验映射，不能用第一条候选猜 | launch提交前后与origin更新 |
| 收入探测路线 | 与直接环绕/登陆复用同一来源读取契约，不恢复另一份选择逻辑 | income的probeRequirementId消费 |
| 跨回合与完成 | 来源消失显式不可达/重新决策；目标完成后按现有奖励阶段清空依赖 | continueBoundTargetNextTurn与完成判定 |
| 共享状态与预算 | 去重合并物理执行不丢origin；不加4096预算、不改权重来掩盖身份错误 | origin传播与单决策性能门槛 |

唯一修改范围拟为搜索来源绑定与对应行为验证，正式Production执行器、RNG、资源收费、
存档和跨环境装配均不改变。矩阵未闭合，尚未写生产代码；完成设计后作为独立版本修复。

## 验证与交付

先用本次真实状态证明旧搜索错用5号、正式1号可以登陆；修复后同状态必须保留正确
来源且生成可选的兑现叶，候选换序和发射映射不能回归。真实慢样本单决策通过10秒
门槛后，提交生产与AI/RL对应文档，再按去重入口快速200步及同提交续跑完整盘面。
保持第三轮验收基线106.75，第四轮预算/裁剪整体义务不变。两项用户指定既有测试
失败不在修复范围。
