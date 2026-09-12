# FINAL-MARK-INPUT-01

起点1015cad0，独立目录/tmp/seti-final-income-fix-20260913.G3xEyA。
证据在/tmp/seti-income432-audit-20260913.TPxMg7，bbef874a：正式142根字段齐全，
A2策略基础值2、正式1，原因是公司基础收入未投影。cheap字段缺失属于设计，不修改。
目标：共享buildRuleObservation提供正式getPlayerCompanyBaseIncome的公开副本，
Policy终局标记必需输入缺失显式报错；不修改搜索过滤、公式权重或终局执行规则。
PASS：A1/A2与正式玩家计算一致、初始收入不计增长、输入不变、对手手牌不泄露，
真实142复核、相关Policy/观察/full-flow测试及audit_v_state_inputs通过。
单决策门槛：同一432输入战略<=17044.438583ms、错误为空、4096/256/30秒预算不变，
观察字段变化不删原获胜完整链；通过后查重运行唯一完整局，规则纠错不要求维持旧分。
独立提交/版本/报告，修复验收后合主，再恢复终局标记搜索贪心调查。
