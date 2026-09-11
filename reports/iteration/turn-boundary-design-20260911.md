# TURN-BOUNDARY-01：回合边界与结束动作复用

2026-09-11；起点60454d5d；独立目录
`/tmp/seti-turn-boundary-20260911.ACGpry`。所属整体计划：外星估值修正后的第二项，
先澄清阶段与计划执行，再进入快速行动时机、目标准入和预算专项。

## 目标与边界

目标：真实回合推进与缓存步骤一致；不能把新turn未做主行动时的end_turn当成合法选择，
也不能把PASS与end_turn共用“重新寻找主行动”的理由。
已充分评估且相关条件未变的退出决定应能复用；条件变化必须失效。
不在本项实现整轮规划、不改变外星牌12分、不调预算与评分。

## 已验证证据（实现前）

`node adhoc/turn-boundary-evidence-20260911.js`通过正式env.step完成开局、
主行动、回合结束、其他席行动并返回本席。输出落在
`reports/iteration/turn-boundary-evidence-20260911.json`，不运行AI、不是完整局。

- 本席R1/T1尚未行动：有PASS、无end_turn；发射后有end_turn、无PASS。
- 正式回到本席R1/T5：有PASS、无end_turn；保留的已执行end_turn计划先被
  `step-not-legal`拒绝，没有到达`control-step-redecide`。
- `probe-turn-session`的TURN_ADVANCE清除当前和下一席的mainActionCompleted，
  并清除当前席passCompletionPending。end_turn枚举只认完成标记。
- `advanceFocalPlanningTurn`只能在可信fork且会话排空后推进；它修改当前席与回合号，
  不恢复主行动完成标记。运行证据已补：隔离fork正式提交end_turn后调用该接口，
  返回本席时有PASS、无end_turn；根状态的观察边界保持不变。
- 裸PASS的compilePlanSteps结果没有dependencies或futureDependencies。
  同一观察sameTurn=true命中，sameTurn=false被控制动作特例拒绝。
  这仅证明现有依赖证据不足以表达退出机会条件，尚未证明完整生产计划一定误用PASS。
- 真实交易反例：保存裸PASS证据后执行energy-for-credit，本席钱/电从3/2变为4/0，
  扫描与移动等动作消失，旧PASS仍在sameTurn=true时命中。再在4/0保存PASS，
  执行credits-for-energy到2/1，三种移动及能量换移动机会恢复，旧PASS仍命中。
  此处没有修改规则状态或伪造合法集；但计划由诊断主动保存，并非winning leaf生成，
  因而证据只证明复用接口缺少退出条件失效检查，不外推为实际AI已选错或导致降分。
  诊断初次误读资源嵌套字段已按正式sanitizePublicPlayer的扁平字段修正；最终证据
  由上述正式输入完整重算，不将诊断脚本读取错误归类为生产bug。

## 待闭合的设计义务

| 义务 | 唯一责任点与正式接口 | 必需证据 |
| --- | --- | --- |
| 一次协调器调用只消费一个原子输入 | coordinator.execute、buildPlanFromSnapshot、advancePlan | 正式计划跨主行动/条件选择/end_turn执行，成功后恰好前进一步 |
| 新turn不可跳过主行动直接end_turn | 正式TURN_ADVANCE与合法集；planReuseCheck先合法性校验 | 正式多席返回与可信fork推进均通过 |
| PASS不会因身份强制重搜 | capturePlanStep/compilePlanSteps的退出决定证据 | 相同退出条件跨turn可复用，资源或机会变化必须miss |
| 防护删除有充分依据 | 先证明PASS依赖完整，再删除无条件控制动作分支 | 不能仅删除分支并沿用空依赖；不靠历史分数证明必要性 |
| 恢复与失败不被绕过 | existing owner/semantic/reveal检查、resetPlans | wrong-owner、非法步骤、揭示、计划清空仍失效 |

当前不写生产patch：PASS的退出条件证据需要先闭合，防止将无条件重搜改成无条件退出。
优先方案是以退出决策实际使用的可见资源和机会事实形成证据；不以整份观察序列化
替代语义判定（会因无关对手变化重搜）。若无法覆盖，显式保留未获充分评估的PASS
重搜条件，而不是声称全部PASS都可复用。该方案尚待消费者与真实输入核验后冻结。

必要性约束：PASS是“放弃当前所有可行机会”的决定，依赖不能仅沿用已完成的单一
具名目标。现有directoryFactsSnapshot会剥离资源字段，不能直接当作PASS机会证据；
新增事实应保留本人资源与私有可用牌、正式目标要求及其奖励机会，排除与退出无关的
对手资源和全局递增版本号。须先核对生产采集入口与目标目录的消费者闭包，再冻结字段。
目前尚未批准以同回合/跨回合作为PASS正确性的替代判据。

搜索状态等价、目标可达性和资源下界剪枝不在本项修改；全局4096节点、256队列、
30秒期限保持。若实现影响搜索调用，先单决策验证再按标准去重入口运行完整局。
PASS门槛：上述行为证据通过，无新增回归/规则失败，完整局自然终局、指标留档、
文档同步、临时目录合回并更新报告中心。不要求本项涨分；整体目标仍未完成。
