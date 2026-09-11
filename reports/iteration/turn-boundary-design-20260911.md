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

## 实施设计冻结

PASS新增独立pass-decision依赖，由现有capturePlanStep采集，compilePlanSteps编译，
planReuseCheck同回合/跨回合统一比较。事实取本席公开状态（除显示标签）、本席私有
状态、轮次，以及已有逐步事实与五类完整目标要求（probe/data/sector/income/tech）。
五类要求保留费用与资源缺口，不复用剥资源的目录指纹。已有逐步事实覆盖路线及终点
奖励、移动来源、扫描布局、科技供应、终局板块、扇区竞争、公共牌、外星痕迹与数据布局。
不读取其他席私有状态、不比较其他席资源或全局stateVersion/turnNumber。
这是一项保守的退出条件证据，不保证对所有无收益变化做最小化；正确性优先于命中率。

全部生产采集均经rule-composition.captureStep，已读取同viewer且经信息屏障遮蔽的观察；
同一个capturePlanStep也用于实际复用前重采集，不新增第二套估值或目标目录。
只在PASS步骤采集新增事实，不把退出证据传递成普通动作的跨目标限制；后缀传播时
跳过pass-decision，因为在较早步骤没有该退出状态且本次不实现整轮计划。
旧内存PASS缺该依赖须显式miss，不接受空数组充当完整证据；非PASS计划格式保持。
删除control-step-redecide及sameTurn参数；协调器仍保留newTurnReuseEnabled实验开关。
规则owner、RNG/id/sequence、Decision、事务、搜索节点数与预算均不改；失败/非法/
错owner/揭示检查保留。end_turn不新增全盘条件，只清理无依据的跨turn特例。

必要性约束：PASS是“放弃当前所有可行机会”的决定，依赖不能仅沿用已完成的单一
具名目标。现有directoryFactsSnapshot会剥离资源字段，不能直接当作PASS机会证据；
新增事实应保留本人资源与私有可用牌、正式目标要求及其奖励机会，排除与退出无关的
对手资源和全局递增版本号。须先核对生产采集入口与目标目录的消费者闭包，再冻结字段。
目前尚未批准以同回合/跨回合作为PASS正确性的替代判据。

## 实现与针对性验收

临时目录已实现上述退出条件依赖，删除控制动作无条件重搜。
`turn-boundary-verified-20260911.json`记录修复后真实输入：两次交易均使旧PASS失效；
正式fork与多席回合均不允许新turn直接end_turn。共享协调器在正式fork执行
end_turn→下一本席PASS：只调用一次决策函数，第二步为plan-reuse，计划消费为空。
该计划取另一隔离fork的真实退出前观察，未手造资源与合法集。
unit82通过、2项既有基线失败，唯一fullFlow通过，V输入审计全部通过。
日志`/tmp/seti-turn-boundary-tests-20260911.log`、`/tmp/seti-turn-boundary-v-audit-20260911.log`。
完整局与合回仍待完成；当前不能将针对性验证替代本项全部验收。

搜索状态等价、目标可达性和资源下界剪枝不在本项修改；全局4096节点、256队列、
30秒期限保持。若实现影响搜索调用，先单决策验证再按标准去重入口运行完整局。
PASS门槛：上述行为证据通过，无新增回归/规则失败，完整局自然终局、指标留档、
文档同步、临时目录合回并更新报告中心。不要求本项涨分；整体目标仍未完成。
