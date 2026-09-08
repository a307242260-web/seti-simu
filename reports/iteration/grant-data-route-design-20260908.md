# 精选角标补数据计划设计

状态：2026-09-08目录漏项修复完成，已合入dev（3d42ba22）；基线573bf76e。本项按均分不变且补齐可行路线通过，不是第五轮性能验收通过。

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

已完成：新增绑定选择测试修前包含无数据牌而失败，修后通过；战略目标整文件随后在旧“分析提交后立即释放目标”断言失败，未改dev上同样复现，故不宣称该文件全绿，也不为旧断言改变当前奖励结算契约。隐藏嵌套来源过滤测试通过；真实B目录、唯一绑定精选、实际获得1数据并填到6/6全部通过（grant-data-route-fixed-20260908.json）。唯一standard-flow通过，V输入审计全部通过，生产与诊断语法通过。合入后隐藏支付与standard-flow复核通过，randomizer生产代码与完整局提交1501ebfd一致。

## 单点与完整局结果

- 缺口单点3707节点、4128输入、10644.28ms、规则失败0；保留拨款精选轨道加注后分析的完整叶。未触及4096，但裁剪4083个前沿来源，结果仍标beam-budget等不完整原因，不能称全展开。
- 单点原始JSON以grant-data-route-search-v4-20260908.json.gz无损保存，解压字节SHA256见grant-search-orders-20260908.json；不重复搜索。早期诊断错误为在执行分支嵌套搜索、创建期RNG假设错误、未装配完整观察，三份失败原始证据保留于临时分支1501ebfd；v4用正式根、种子RNG和共用buildRuleObservation通过，生产实现未因这些接线错误修改。
- 完整局1a061690.1501ebfd.full.json：613步，终局74/105/115/113，均101.75，与直接基线全部replaySteps逐字段一致；143252节点不变，战略执行上限截断30/88、控制8/84不变，失败0。576539→579822ms，不能声称提速。
- 实际输入182814→182804，仅第24步搜索变化：同为4096节点，6450→6440输入；例如play_card节点7→13、place_data564→572、launch37→23、move43→27。说明预算内分配改变，不是所有搜索内部路径不变；最终选择及整局行为保持一致。
- 全盘记录未保存beamPrunedOriginCount，前沿裁剪总量未知，不记为0；grant-full-comparison-v2-20260908.json明确记null。初版摘要遗漏该缺失口径，以v2为准。

结论：明确漏项修复通过并保留；第五轮三项效果门槛均未由本轮达成。下一步继续重复搜索与卡牌组合贪心，不调其他策略追回分数。
