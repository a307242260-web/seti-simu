# 奥陌陌奖励次数错误：正式能力复现

2026-09-08。无生产修改、无完整局重跑。证据层级从面板primitive提升到正式
abilities.executeAbility入口、真实扣费/火箭移除与buildRewardEffectsForAction。
尚未验证完整Production composition的奖励队列结算，不把能力测试称为端到端。

复用现有actions.test.js的公开上下文模式：奥陌陌已揭示，探测器位于奥陌陌，
本席10钱10电，canonical alienEntity从17开始，面板没有环绕或登陆标记。
环绕、登陆分别用独立状态执行，不修改正式能力、不注入替代执行器。

| 检查 | 环绕 | 登陆 |
| --- | --- | --- |
| 正式合法选项预告markerSequence | 1 | 1 |
| 正式能力执行结果markerSequence | 17 | 17 |
| 实体序号执行后 | 18 | 18 |
| 火箭移除、费用扣除 | 成功 | 成功 |
| 实际奖励构建缺少 | 首次环绕1张奥陌陌牌 | 首次登陆3数据 |

仅在奖励构建诊断副本中把奖励次数改为1，两类应有奖励出现。结果证实
abilities/planet.js将实体sequence误作奖励次数：目录按面板计数+1预告，执行却
取aomomo标记实体序号，生产输入输出不一致。不是AI权重问题，也不是金星盘面
棕方下降原因；固定盘面的物种仍为阿米巴/虫族。

下一轮独立修复职责：entity id与meta.sequences.alienEntity继续唯一编号、只消耗一次；
能力结果markerSequence使用对应面板orbit/landing实际次数，land的
rewardMarkerSequence再由forceFirstLandingReward正式规则覆盖。原生事件、扣费、
火箭移除、回滚快照和普通星球/卫星路径不变。需覆盖非1实体起点、连续前三次与
后续、两种标记交错、保存恢复、失败不消耗序号、强制首次奖励，并补正式composition
奖励结算证据。先闭合独立设计与回归，再实施，不改变面板实体sequence以迁就奖励。

证据：aomomo-ability-sequence-proof-20260908.json；脚本
adhoc/prove-aomomo-ability-sequence-20260908.js，checkpoint存在即跳过。
脚本断言、node --check、git diff --check通过。未改生产/API/规则文档，当前只更新
调查报告及入口，避免将待实施修复写成生产口径。路线等价优化仍未完成。
