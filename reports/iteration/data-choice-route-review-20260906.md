# 填数据需求选位：来源差异取证（2026-09-06）

结论：棕52确实有已由需求选择器收敛的单选后继，但不能对共享节点统一取首项。
同一观察、当前动作和合法集下，收入目标选择计算机第2格，分析目标选择blue1奖励槽，
发现3个观察分组反例。观察相同本身不证明底层状态等价，不能把这3组当作完整
物理共享节点计数；它们已足以否定“与目标无关，全部固定computer”的方案。

## 证据

使用棕52已存checkpoint，通过正式Production factory恢复，正式Heuristic与
协调器读边界不变，只在evaluate的selectSuccessors回调参数记录原函数输入输出。
不修改函数对象、返回项、预算或生产代码。1079次目标来源调用：1019单选、60空、
0多选；不是1079物理节点或1019可省节点。513个观察分组，3组目标选位不同。

具体反例：合法集choose_target:9e798bfd（计算机第2格）和choose_target:69f502d4
（blue1下方）；income:data:computer-slot-4返回前者，data:analyze/data:place_data
返回后者。分析目标还可能选blue2奖励槽；不能忽略正式资源需求。

最终证据data-choice-routes-52-20260906-verified.json：动作、计划与旧52基线一致，
全部叶hash一致；与相同checkpoint真实env决策的完整actionOutcomes、plan、decision
逐项deepEqual。单次取证耗时含callback记录成本，不用于性能验收。

两个未通过的诊断也保留：最初错误地在禁止嵌套搜索的counterfactual fork里发起
搜索，立即退化为fallback，数据不可用；第二次改用正式root factory后已取得统计，
但旧连续重放入口的outcome元数据原始hash不一致，不能宣称全对象通过。最终通过
同一恢复入口的真实env全对象对照确认；不把旧跨入口hash差异解释成生产bug或
已查明的具体字段差异，不修改生产恢复规则来适配诊断。

## 实施边界（尚未冻结完整设计，禁止据此直接改生产）

| 事项 | 必须满足的设计约束 |
|---|---|
| 需求owner | 复用selectSecondaryAgentSuccessors及内部selectDataPlacementChoice，不复制资源阈值 |
| 来源 | 每个origin使用已推进的routeTarget/routePlan/resultTargets；不同选位保留分支，空结果保留原不可达语义 |
| 折叠时机 | 必须在本步目标完成/奖励待完成/隐藏信息/来源推进后判定，不能用执行前旧origin猜选位 |
| 执行 | 唯一inputPort逐步提交，保留Decision owner/version、capture/retain步骤及奖励事件，不跳过真实输入 |
| 隐藏信息 | 使用原先相同的masked观察和合法集；遇选牌、揭示或目标变化边界不能越过消费者判定 |
| 状态与预算 | 物理状态去重、origin隔离与全局4096/256/30秒不变；必须省掉真实fork/队列/投影成本，而非仅改计数 |
| 搜索语义 | 明确折叠对depth、actionChain、分支排序、根动作settled观察、跨目标结果保留的影响 |
| 验证 | 先单决策实际耗时/节点/正式提交/逐步计划，后去重quick/full终局均分至少108.5 |

待解决：选择器当前在外层origin推进后调用，executeNode的排空发生在此前；不能
直接往drainable加一个判断就完整满足上述边界。下一步应先闭合这两层的状态推进
设计，再实施。数据选位仅占全局1.75%，也必须判断所需改动是否值得局部收益。

本轮仅新增诊断和设计证据，无生产行为变更、无新性能成果、未重跑完整局。
核对AI/RL/Node文档及README/AGENTS：无需接口说明变更；性能计划同步链接本证据。
