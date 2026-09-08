# 路线停止结果与计划可选性：冻结设计

2026-09-09。基于af937808，独立fix/route-leaf-eligibility-20260909；证据为蓝99的
route-unreachable叶、目标深度0、宣传预期3.5，却消费2钱2电1牌。不是规则费用bug。

## 全部出口及职责

| 出口（rule-composition） | 语义和保留策略 |
|---|---|
| root-decision-next-boundary / root-decision-settled | 独立强制选择的公开边界，不要求主目标完成，保持原契约 |
| focal-pass-decision-boundary / focal-pass | PASS公开边界，不枚举未来未知预留牌，保持原契约 |
| secondary-agent-depth | 完成目标计数达到上限；保留结果和截断标记 |
| goal-completed | 完成目标且条件奖励排空；始终保留已完成前缀 |
| 无选中正常后继 | completedGoal为真则标goal-completed，否则route-unreachable；结果均保留 |
| 最后默认出口（无successor/childEnvelope） | 战略搜索同样按completedGoal区分；非战略保持原语义 |
| 条件无后继 / 条件深度 | 不产可评分工作态，保留既有显式截断/失败 |
| 未绑定深度、节点/前沿预算 | 不放宽、不新增叶，保留完成前缀和诊断 |

叶生产owner仍为rule-composition；完成判据只复用completesRouteTarget及
goalCompletionPending/awaitingDecision，不另推演规则、不靠目标深度猜当前后缀完成。
评分owner仍为expected-score-evaluator：route-unreachable非终局叶不参加优胜排序，
完整outcome和所有叶不删除。正式终局叶继续按正式分比较，不能因路线名称屏蔽终局。
过滤在排序前，保证混合叶选择已完成前缀，不让高分未完成后缀挡住有效前缀。
全为不可用路线时返回明确unavailable原因，由现有control决定正式合法动作。

## 边界和不变量

无新schema字段、兼容层、缓存、规则执行或Decision owner；无RNG/id/sequence改动。
只修正现有terminalReason生产语义及其评分消费者。既有完整结果保存契约不撤销。
物理等价/nodeKey、目标可达性和资源下界、排序权重、4096/256/30秒预算不变。
不把此次结果筛选称为节点优化；若全局行为变化，必须重新验证三项整体门槛。
删除义务：两处正常路线停止不得仍无条件作为可选叶；不删真实结果或完成前缀。

## 可证伪验收

1. 窄搜索契约：未完成停止仍保存原状态和route-unreachable；完成且无选中后继标goal-completed；没有合法后继也能区分完成/未完成。
2. 评分：高宣传未完成叶不能压过较低分完成叶；只有未完成叶明确不可选；正式终局仍有效；输入outcome未修改。
3. 已完成目标后预算耗尽的旧回归继续通过；条件根/PASS及唯一full-flow保留。
4. 蓝99真实单点不再选择原失败准备叶；检查合法选择、0规则失败、原17节点统计和30秒门槛。若没有可用目标，不伪造胜出叶。
5. 单点与相关回归通过后冻结代码，再去重运行唯一完整局；降分继续归因，不补权重。

同步AI/RL文档、现有两个unit及inventory义务、迭代中心。旧两断言不纳入本修复范围。
