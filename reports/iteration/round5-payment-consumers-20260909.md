# 第五轮：卡牌选择的实际消费者与支付边界

2026-09-09，源码核对基于dev 73d2ad7e；本次不修改生产。

## 结论

只修改selectSecondaryAgentSuccessors不足以落实按牌值弃牌：通用弃牌会在
rule-composition的结算循环中选择第一张未选牌，选满后正式确认，绕过该排序器。
第五轮必须覆盖此消费者，但不能把结算循环误判为“支付没完成”。
当前结算读取正式pending.selected/count，不靠actionChain猜已经付了几张牌。
旧选择器中“遇到连续choose_payment就停止”的注释不能单独证明生产支付中断。

## 历史第24步的执行证据

来源step24-goal-trace-aaaed8d0-20260908.json；只统计strategic行的execution.inputs，
每个实际输入计一次，不按共享目标来源重复计算。脚本audit-round5-payment-consumers-20260909.js
和同名JSON保存分类及各类前三个完整实例。不重跑搜索，不把历史数字标成当前dev指标。

| 实际输入 | 合计 | 独立节点首输入 | 同节点后续结算输入 |
|---|---:|---:|---:|
| 逐张选择弃牌 | 706 | 0 | 706 |
| 确认弃牌 | 353 | 0 | 353 |
| 移动支付 | 25 | 6 | 19 |
| 交易精选 | 181 | 181 | 0 |

706与353说明这些记录中存在完整的选牌/确认提交；统计本身不证明所有弃牌组合最优。
移动支付19次同节点结算也不能直接认定冗余：当前实现只自动处理唯一合法移动支付。
历史日志未保存所有被淘汰候选，不能据此反推它们的牌值或原候选数量。

## 接入矩阵与正式状态归属

| 消费者 | 当前行为 | 第五轮设计义务 |
|---|---|---|
| production-composition.discardChoices/executeDiscard | 正式手牌点选toggle，pending保存selected/count，选满提供confirm | 不修改规则；不从presentation.selected读取正式状态；不另存已选集合 |
| rule-composition结算排空 | 第一张未选牌，随后confirm；实际输入仍计入物理节点 | 接入同一个纯牌值选择器；仅在合法未选牌中择低值，选满仍走正式confirm；未知牌按平均值，不读原始牌面 |
| expected-score-evaluator移动支付 | 同energyCost+弃牌数量取首代表，不同资源结构都保留 | 同成本组按失去的牌值择优；牌与电比较使用同一单位，不能再按actionId偶然挑牌 |
| expected-score-evaluator交易精选 | 资源目标下取首张 | 同收益精选取高值；不得混同开局收入、角标、扫描等不同用途 |
| evaluateStateValue手牌项 | 特定效果硬编码后手牌×0.5、保留牌×0.25；未扣完整打牌成本 | 与第五轮持牌价值统一，删除被替代的手牌估值，不同时累加两套；终局仍用正式分 |
| heuristic-policy开局插收入 | 即时收入资源+后续发放窗口 | 本期普通搜索贪心不能误覆盖这个独立开局入口；如要改开局手牌机会成本，须明确纳入版本范围和验证 |

正式来源：production-composition.js的discardChoices/executeDiscard；probe-turn-session.js
的getMovePaymentChoices/MOVE_PAYMENT；rule-composition.js的drainable/settleChoice；
expected-score-evaluator.js的movePaymentChoices、fungibleTradeCardChoices、evaluateStateValue；
heuristic-decision-function.js的secondaryAgentSearch装配；heuristic-policy.js的开局插收入。

纯估值唯一owner应与选牌排序共享；规则内核不直接依赖AI。若通过现有搜索配置传入
结算选择能力，输入只能是已遮蔽的公开观察、合法候选与正式已选数量/ID，输出必须
属于合法集。不得读取完整root、推进RNG/ID，或用回调在内核里再次执行支付。
自动结算、独立条件根和普通后继都必须使用相同牌值，不增加第二套启发式实现。

## 支付计算的确定部分和仍需定案的部分

令G为即时收益加半值远期收益、C为打牌资源成本、M=6为本牌均值：
净值N=G−C−M；打牌能兑现的价值G−C=N+M。
N适合比较相同张数的牌，不能直接作为“花一张牌”的成本：否则负净值牌被扔掉
会成为无条件正收益。也不能对已经扣过手牌成本的N再减M。

同支付数量、同电费、同目标时，保留其他条件，只需比较所弃牌的相对价值；
不同电费的完整支付方案，应比较energyCost×电单位+所弃牌的持有机会成本。
支付已经体现在后状态时，终点评分不得再减一次同一费用。
收入选择比较新增收入价值与失去手牌的机会成本；叶状态已经包含收入和剩余牌时，
不额外再发一份“选择收入奖励”。

2026-09-09实现设计已明确H=max(G−C,角标)，未知牌6，未插收入不预加收入价值；
见round5-payment-value-design-20260909.md及七张真实模型算例。属于实现假设，尚未上线。
扫描和条件奖励/终局基数待确认项仍保留；本次没有引入新的数值口径。

## 后续行为验证义务

- 真实两张弃牌：按低值顺序点选、不会toggle回去、选满确认，正式扣除指定两牌。
- 同费移动两牌质量不同：保留低值支付；高值移动牌与1电比较不得固定弃牌。
- 未知牌面置换后同样选择；已绑定目标所需牌不能被通用贪心误弃。
- 同收入状态两条路线只差手牌时，局部选择和终点评分方向一致。
- 自动结算输入继续逐项记账；不通过改计数制造节点减少。

文档一致性：本次为审计与设计，更新第五轮契约、Goal和迭代中心。
README、AI/RL生产契约与规则未改；上述新接入义务尚未实现，不能写成已通过。

验证：脚本语法和历史输入分类断言通过；node tools/run_node_tests.js --match
search-payment-choices通过1项unit，包含不同支付结果与未知牌支付/普通入手边界。
该测试不接入新牌值，也不是全量回归或第五轮正确性验收。
