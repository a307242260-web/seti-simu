# DIRECT-LAND-TARGET-01 调查

所属预算截断专项；起始d9397c00，独立目录`/tmp/seti-land-target-20260912.mJO25e`。
当前正式记录42bace26.126ed66e.full.json：506步4096节点、战略18265.572542ms，
最大分类痕迹1069节点，土卫六奖励第一枚4种各61次，第二枚更多分支；完整计数在记录。
此前编号排列去重候选已证伪，本轮不重复其键归一化/随机采样实验。

发现：selectSecondaryAgentSuccessors的landChoices分支只在routePlanId以probe:
开头时按目标星球/卫星筛选，直接land:目标未经过该分支。

真实复现：`direct-land-target-before-20260912.json`，从现有506checkpoint按当前
完整存档重放506至512，完整动作与after逐步一致。513步三个合法落点：土星主星、
土卫二、土卫六。分别绑定land:saturn:satellite:titan和
land:saturn:satellite:enceladus后，两种调用均返回全部三个落点，而非对应目标。
此证据直接调用原生后继筛选，无AI，只证明这一输入的判定差异，不能外推真实搜索
所有重复来源的数量，也不能直接宣称已经节省了奖励展开。

下一步：核对直接登陆目标完成/失效判定及路线生成，确认这些越目标选择是否属于
必要后继。若非必要，则作为明确目标绑定问题插入修复：沿用同一后继函数的正式落点
匹配，保留其他目标及未绑定行为；不把更强的目标过滤伪称全局等价剪枝。先建立
目标/非目标/主星/卫星/不可达反例测试和506单决策节点门槛，再决定修改。

## 调查结论：撤回当前bug判断，不改生产

继续读取目标目录发现，探测目标统一生成probe:requirementId；真实506单决策保存的
winning plan也使用probe:rocket:11:land:saturn:satellite:titan。上一复现脚本手填的
routePlanId=routeTargetId并非该生产路径，不能将其返回全部候选外推为实际搜索缺陷。

`direct-land-target-contract-20260912.json`：同一513原生观察按正式probe路线调用，
土卫六仅返回土卫六，土卫二仅返回土卫二。无AI、无新完整局。根目标目录、原计划及
真实输入共同说明本次怀疑不足以支持修改；不添加未证明有生产调用者的直接land分支。
目标完成事件亦精确区分planetId/type/satelliteId。

当前最大痕迹搜索仍需分析，但不得把多个分别合法登陆目标的奖励展开误算为越目标搜索。
本调查不产生策略候选、不算预算改善，保留错误假设及纠正证据；生产文件未改。
