# b123触发扫描执行器缺失（2026-09-07）

结论：已从610真实盘面用正式动作复现规则缺陷，尚未修改生产代码。
《望远镜时间分配》b123扫描触发奖励生成了不存在的
`card_play_domain_effect:effect:card_scan_color_choice`执行器。

## 证据与边界

executor-root-610-20260907.json由646858ac完整存档前609个正式输入恢复，逐步动作及
after摘要全部一致；未运行前609步AI。610独立冷搜索执行后，诊断脚本错误读取可选
reasonCodes而未落结果；已留失败标记，不重跑该冷搜索，也不虚构其错误详情。

b123-trigger-formal-v2-20260907.json保存替代正式复现：3宣传换公共b123→打出→
结束行动并进入本席下一行动→两手牌换能量→扫描→接受b123黄色扫描奖励→
result.ok=false，failure.code=EFFECT_EXECUTOR_NOT_REGISTERED，failure.type为上述旧名。
脚本最初误读result.code，原始结果已由finally保存；改为读取failure.code后只验证既有
证据，不重放。较早v1误将b134移动角当能量，停在移动Decision，作为失败构造留档，
不作为规则缺陷证据，不把该诊断错误算到生产代码上。

## 根因

residual-domain-session.createFormalCardEffectNode默认拼接旧effect执行器名，只有完整
SCAN_ACTION转science；其注释声称触发奖励没有其他扫描来源，与b123三色触发模型矛盾。
play-domain.createSpawnedCardEffect已将SCAN_COLOR_CHOICE及其他扫描家族路由到science
SCAN_STEP，但这份正式转换在内部闭包中，触发奖励没有复用。

本正式复现与全盘610同盘面、同失败族和错误码，足以证明需修复的真实缺陷；原全盘
记录未保存完整失败链，不能声称已还原当时每个搜索输入，也不能声称这解释了棕方全部降20。

下一步独立设计共享卡牌效果转换的复用边界，覆盖扫描类型与嵌套followup、保持触发
priority/owner/cardInstanceId、RNG及事务归属；不注册旧扫描第二套实现，不仅给b123特判。
本轮只改诊断工具并保存证据，已核对ai-design、迭代流程、相关卡牌/运行文档，无生产
接口变化，文档同步限本取证记录；后续生产修复需另行更新机制说明与回归。
