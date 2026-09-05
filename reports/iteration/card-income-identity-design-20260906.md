# 卡牌收入选择身份修复（2026-09-06）

目的：修复实际第236步卡牌收入选择缺actionId/actorId导致AI无法决策的问题；不改变收入规则。
同一缺陷已存在于R2e提交20feca27，与当前收入资源准备代码分开归属。

| 边界 | 冻结职责 |
|---|---|
| 来源/owner | play-domain的INCOME正式效果唯一派生INCOME_DECISION，唯一incomeDecisionExecutor枚举本人手牌；不改空手牌跳过、owner或费用 |
| 正式primitive | 与同文件pickCardExecutor一致，getLegalChoices通过science-session.formalizeChoices生成Standard Action身份；family/target/payload/summary保持，基于actor/target/payload确定稳定ID |
| 决策/恢复 | session-runtime.getDecisionSnapshot每次调用getLegalChoices重新枚举，恢复既有checkpoint自然得到正式描述符；Decision owner/version校验沿既有submitDecision，不在AI边界填字段 |
| 效果/状态 | 收入、即时资源、抽牌/data效果、移出游戏、journal/RNG/sequence/不可逆边界不改；仅选择描述符新增正式身份字段 |
| 范围 | 不修改其它卡牌效果、通用runtime、Heuristic、资源准备、评分或搜索预算 |

验证：现有dlc_34卡牌收入unit覆盖正式身份、恢复前后选择一致、错误owner拒绝、正式收入及后继效果。
从已存失败checkpoint直接恢复，单决策不再报缺focalSeatId，核对收入轨和牌去向；不重跑失败前235步。
相关Node及V审计、单决策性能门槛通过后单独提交，新版本按去重流程跑固定盘面并登记；整轮基线106.75不变。
