# 精选角标补数据计划设计

状态：2026-09-08设计冻结，基线573bf76e（正确计分完整局101.75），本轮只修复目录漏项及对应选择约束。

## 目的和有限范围

正式B路线证据grant-data-route-evidence-20260908-v2.json：5/6计算机、0数据、2钱时，拨款打出并精选轨道加注，保留牌且获得1数据；目录未列出该路线。当前卡牌效果目录仅b48使用单一PICK_CARD_CORNER_REWARD立即效果。本轮识别这一效果形态，不按牌名特判，不扩大为任意嵌套卡牌收益解释器。

## 冻结矩阵

| 边界 | 唯一来源与处理 | 证据要求 |
|---|---|---|
| 需求与准入 | production-kernel.buildDataAnalyzeRequirements，沿用eligible且acquire_data | 数据够用时不额外生成打牌准备；原直接GAIN_DATA/扫描/卡角计划不变 |
| 效果语义 | cardEffects.buildPlayEffects单一PICK_CARD_CORNER_REWARD | 正式效果与目录一致；不把普通抽牌当角标收益 |
| 可选来源 | workingState.cards.publicCards，cards.getDiscardActionRewardForCard.dataCount | 只为有数据角标的公共牌建立成对计划；数据数按正式映射，不估算隐藏牌 |
| 计划身份 | data:card:<打出实例>:pick:<精选实例> | 复用kind=card与既有打牌费用/目标；selection.cardInstanceId显式保存来源 |
| 隐藏边界 | 既有sanitizeRequirementPlans递归containsUnknownCardReference | selection嵌套引用使未知公共牌计划被过滤；不能只有dataCount泄漏收益而不暴露来源 |
| 条件选择 | expected-score-evaluator，data目标且当前为该计划的play_card | 只选择计划绑定的精选实例；缺失即无该路线，不退回任意卡；不改独立条件根及其他目标 |
| 自动结算闭包 | card-play正式owner：选公开牌→入手→角标奖励 | 若唯一选择自动排空，沿用place_data后继；多选择时保持绑定，奖励后继续填数据/分析 |
| 状态与去重 | 既有originKey含routePlanId、物理节点共享 | 不新增状态字段、缓存或第二份规则执行，单一物理打牌可共享多个计划来源 |
| RNG/ID/事务 | 全部正式kernel负责 | 目录只读不抽牌、不写root；不改变Decision owner/stale处理和不可逆边界 |
| 预算与下界 | 仍4096执行/256前沿/30000ms；既有需求和资源判定 | 不放宽截断补齐路线，单点先验收，再标准去重完整局 |

成功标准：真实缺口入口目录出现拨款→轨道加注；实际搜索执行对应精选并继续补数据，不产生未知牌面使用或执行失败。修漏枚举可能增加节点，不冒充第五轮贪心节省；分数变化依标准先归因，完整局与版本独立记录。

验证：绑定选择正例、目标卡缺失、其他目标不受约束的unit；真实B入口目录/正式选择/后续单点，隐藏嵌套来源过滤；语法、战略目标与唯一full-flow定向回归。同步ai-design、rl-simulation-env的计划字段与本记录，不改正式API、游戏运行方式或脚本装配。

已完成：新增绑定选择测试修前包含无数据牌而失败，修后通过；战略目标整文件随后在旧“分析提交后立即释放目标”断言失败，未改dev上同样复现，故不宣称该文件全绿，也不为旧断言改变当前奖励结算契约。隐藏嵌套来源过滤测试通过；真实B目录、唯一绑定精选、实际获得1数据并填到6/6全部通过（grant-data-route-fixed-20260908.json）。唯一standard-flow通过，V输入审计全部通过，生产与诊断语法通过。独立搜索与完整局待验证。
