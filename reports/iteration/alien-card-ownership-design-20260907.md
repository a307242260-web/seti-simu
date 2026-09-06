# 异常点专属打牌准入与执行缺陷（独立设计，待实现）

本项来自任意扫描正式打牌验证，原失败证据
`any-scan-production-v2-20260907.json`：异常点0未开始扫描即返回
CARD_PLAY_EFFECT_UNOWNED。当前不增加生产特判，不把该失败归因于任意扫描修复。

## 目录与责任边界

Card Play的REACHABLE_PLAY_EFFECT_TYPES及REACHABLE_RECURSIVE_EFFECT_TYPES
只遍历CARD_REFERENCE_MAP（182），但正式MODELS有242项。对全部模型的
buildPlayEffects递归检查后，当前KNOWN_CARD_EFFECT_TYPES中遗漏恰为六项：

| 牌 | 缺失类型 | 已有执行入口 |
|---|---|---|
| 异常点0 | yichangdian_anomaly_signal_score | executeYichangdianAnomalySignalScore |
| 异常点1 | yichangdian_next_anomaly_reward | executeYichangdianNextAnomalyReward |
| 异常点4 | yichangdian_public_all | executeYichangdianPublicAll |
| 异常点5 | yichangdian_next_anomaly_scan | executeYichangdianNextAnomalyScan |
| 异常点8 | yichangdian_draw_then_two_corners | executeYichangdianDrawThenTwoCorners |
| 异常点9 | yichangdian_launch_anomaly_move | executeYichangdianLaunchAnomalyMove |

六入口均已注册genericEffectRuntimeType，桥接也能到达，不能再做第二份执行器。
目录应基于正式模型而非参考图片表，但目录存在不证明六入口行为正确。需对这六个
入口及奖励、角标、发射/移动、扫描结算闭包逐项建立行为证据，不能仅放开准入。

## 已发现执行问题及证据边界

1. 已读取本地牌面`assets/aliens/异常点/cards/0.webp`：任意扇区扫描后，
   每个有异常扇区中的信号提供1分。现有executeYichangdianAnomalySignalScore
   却只读取lastScanNebulaId并发放该位置异常标记的奖励，语义明显不符。
   需要再核对正式规则对信号owner、额外标记、扫描结算先后的限定，不能凭猜测计数。
2. applyYichangdianAnomalyReward成功仅返回events/spawnedEffects，没有ok，
   两个调用者却用if (!applied.ok)判失败。属于返回契约缺口；实际非空异常奖励
   路径尚待正式复现，不能把源码发现冒充行为验证。
3. 扫描目标并非无写入：abilities/scan.js的scanNebula确实写入
   match.cardPlayContext.lastScanNebulaId。不得误诊为Science缺少目标透传，
   更不能为此重新扩大前轮已收紧的Decision payload。

## 下一步冻结要求

先读取六张牌面及相关规则，明确每条义务、正式primitive、RNG/序号、Decision
恢复/不可逆边界和来源绑定。目录遗漏与真实规则修复独立于任意扫描记录，但关联
端到端验证必须使用同一生产树。首个生产patch前完成矩阵，不逐个放行再猜行为。
本项不扩为整个外星人体系迁移，不改启发式、不降低预算或隐藏失败。

状态：已按冻结方案整批实现，验证中；任意扫描与本项候选尚未正式提交。

## 六牌规则复核与新增证据

已逐张查看本地0/1/4/5/8/9牌面，读取官方
`rules/seti-faq-base-en-202411.pdf`第24页完整内容（ET.14/15/20）：

- 0号：统计三个异常扇区中当前全部己方信号，包含本牌刚放的信号；若填满扇区，
  必须先得分再结算。因此不依赖lastScan单个目标，不计其他玩家，不发异常奖励。
- 1号：下一个即将触发的异常奖励；沿现有下一异常几何与奖励目录，成功返回契约
  必须完整，不能发出资源后缺失ok被当失败。
- 4号：拿当前牌列三张原卡；补牌仍使用现有正式抽牌上下文，隐藏翻牌不可逆。
- 5号：先完整扫描行动，再在下一个异常所在扇区标一个信号；基础扫描免费，紫科技
  附加费用正常支付。第二目标需在前一行动后读取当前盘面。
- 8号（ET.15）：盲抽3张，只能在这3张中选一张弃置并结算行动角；再从剩余两张中
  弃一张获得收入角对应资源，最后一张留手。旧代码两次CHOOSE_HAND_CORNER_REWARD
  既不弃牌，也不限制新抽实体，且第二次不是收入，必须按两阶段真实语义修复。
- 9号：发射后若“它”在异常扇区则获得1移动；需要以本次发射实际来源和位置验证，
  不能仅用地球位置推断或在发射跳过时凭已有探测器冒领奖励。

成功返回缺口已通过隔离正式owner复现：从42的root派生，在地球逆时针一格放
c_2异常，直调已注册y1执行器；能量3→4且生成蓝痕迹后续，但返回对象没有ok。
这是owner层反例，不是完整Production事务提交成功。没有修改生产代码。

## 完整实现矩阵补充（仍待来源与两阶段闭包最后复核）

| 边界 | 责任与正式primitive | 可证伪义务 |
|---|---|---|
| 准入 | Card Play目录改遍历MODELS，保留递归排除condition/event | 全242模型，六新增类型均唯一既有executor，无unknown兜底 |
| 0号计分 | Card Play读取异常坐标对应nebula，data.getSectorRanking读取己方含额外标记；players.gainResources记分 | 多异常/他方/非异常/本次填满/额外信号；先记分后SETTLE |
| 1号奖励 | 原getNextAnomalySectorX/getAnomalyReward、资源/数据/精选/痕迹primitive | 6面奖励、地球在异常也选下一处、失败完整暴露、恢复不重复奖励 |
| 4号取牌 | 唯一drawCtx.pickFromPublic，以开始时实例清单选择 | 不拿补出的牌，原三实体进手、序号/RNG一致、部分空位按规则处理 |
| 5号扫描 | 既有扫描行动与异常扫描执行器 | 前段费用、后段准确扇区、各流结算时序、跨Decision恢复 |
| 8号两阶段 | Card Play专属流程持有新抽3实体ID与阶段；正式discardFromHandAtIndex/addToDiscardPile、cornerEffects及收入资源primitive | 老手牌不可选、首次副作用后续完成才选第二张、选项仅剩原2张、不重抽、真实弃两留一 |
| 9号来源 | 正式发射结果/实例与位置，接既有CARD_MOVE义务 | 发射成功/满额跳过、在异常/不在异常、只能由真实发射事实触发，保存恢复 |

8号不能把通用“不弃牌的角标选择”改成全局弃牌，不能把任意弃牌收入的循环动作
拿来替代强制一次收入。需要复用规则primitive而不是篡改其他卡的语义。实施前还需
查清发射事件的现有来源传递，以及8号角标嵌套后续/收入盲抽的阶段owner。

目录口径补充：全部模型的原始顶层类型共66种（旧45），其中额外15种外星人
命名类型不在KNOWN_CARD_EFFECT_TYPES，原准入本就不以该集合拦截；已确认它们
不是本次新增放行的六种。递归KNOWN目录为52种（旧46），新增准入仍恰为六种。
不得将顶层目录的数量增加21误报为新开放21种效果；测试应分别验证两个口径。

## 实施冻结

已复核LAUNCH、incomeDecision、cornerEffects、genericResolve与扫描链尾。
采用以下完整方案，不改通用角标/收入选择含义：

1. 准入两目录从MODELS生成，保持六既有专属executor唯一归属。
2. 0号按去重的异常扇区目录累加data.getSectorRanking中actor的count（含额外
   标记），players.gainResources按alienEffectScore记分；事件记录逐扇区计数。
   移除错误的lastScan条件和异常奖励发放路径。现有PLAY链尾保证评分先于结算。
3. 1号共享奖励函数成功返回ok:true；失败保持显式结果，不恢复静默成功。
4. 4/5号不改当前效果内容，只验证正式取原公共牌与下一异常扫描执行链。
5. 8号保留同一专属runtime的prepare/decision两种类型。prepare一次盲抽3张，
   payload保存drawnCardIds、stage=corner、cardInstanceId；第一阶段只列新抽实体，
   正式弃牌后spawnCardEffects(cornerEffects)再追加stage=income的同owner决策。
   第二阶段只列其余新抽且仍在手实体，弃牌后用getIncomeGainForCard读资源码，
   通过buildRewardEffects生成一次性资源/盲抽效果。不调用会增加永久收入的
   players.gainIncome。两阶段无取消/跳过；新抽牌身份与阶段完全在payload恢复，
   禁止重新抽3张或允许原手牌参与。收入码不识别、阶段不识别、必需来源缺失显式失败。
6. 9号由既有LAUNCH在match.cardPlayContext.cardLaunch写本次cardInstanceId、
   actorId和rocketId；满额跳过也写同卡的显式skipped结果，不能沿用旧卡来源。
   后续专属executor验证同卡/owner结果；成功时读取该实体当前扇区是否异常，
   若符合则沿既有CARD_MOVE发放1移动（移动点仍可正常用于任意合法己方来源）。
   无发射事实或成功事实丢实体显式失败；合法满额跳过不触发奖励。

RNG/序号：仅正式盲抽与发射原语消费，新增事实/Decision不自增实体编号；所有
新后续同cardInstanceId、同owner，direct队列使角标完整后续先于收入阶段。
wrong-owner/stale/late仍由共享输入链阻断；阶段非法或来源丢失另外显式上报。
不可逆：8号首次盲抽及收入盲抽沿现有规则标记；4号补公共牌保留原不可逆标记。

验证应覆盖0号己方/他方/三个异常/额外信号/填满先记分，1号奖励分支，4/5号完整
动作，8号三种收入码与行动角嵌套/保存恢复/错误输入/旧手牌排除，9号成功/跳过/
非异常/来源丢失。设计已冻结；下一步先写正式owner反例，再整批生产实现和全链验收。

## 实施与当前证据

已整批实现目录、0号计分、1号ok返回、8号两阶段弃牌与9号真实发射结果；
4/5仍复用原执行器。语法和play-domain.test通过；原182张逐牌CAS验证保留，
其覆盖断言明确限定182组，不能据此声称全部242模型行为通过。
新增owner测试验证己方三信号计3分、排除其他玩家和非异常扇区、不发异常奖励；
1号奖励结果含ok。异常点0正式打牌已从UNOWNED失败变为一次扫描/一次结算，
Decision恢复通过，证据any-scan-yichangdian-production-20260907.json。
该场景没有异常，不能替代异常计分端到端证据。8号三种收入/后续/恢复、9号
发射/跳过/来源丢失，以及其他矩阵义务仍需验证，不宣称整轮完成。

已同步异常点implementation和RL接口；README/AGENTS/部署入口未变。尚需提交前
全仓核对旧182目录及错误两次角标口径、全量回归、最终单决策和唯一固定局。

## 正式流程验证补充

`yichangdian-flow-v3-20260907.json`六个唯一Production场景通过：8号真实抽三张/
仅新牌两次弃置/留一张/旧手牌保留/永久收入不变，9号满额跳过、异常内发射、
非异常发射，4号拿开始时公共牌，5号完整扫描后追加信号。共5个Decision逐个
验证错误owner拒绝且状态不变、保存恢复重提交完整envelope一致。
8号信用/能量/盲抽三种收入码另经play-domain.test正式owner执行证明，真实弃牌、
资源或牌数增量正确，永久收入均不变；测试通过。

前两份yichangdian-flow诊断在构造无探测器盘面时直接过滤数组，留下activeRocketId
悬空，restore正确拒绝STATE_PIECE_REFERENCE_INVALID；改用正式removeRocket
同步处理引用后通过。不是生产发射失败，失败产物保留，不修改正式校验掩盖问题。

尚需0号填满/额外信号先记分、1号各奖励、8号角标嵌套和来源非法边界、最终单点
及整局；不将这些局部通过外推为全部义务完成。当前没有运行中的完整局。

## 最终局部门禁进展

`yichangdian-edges-v3-20260907.json`新增8场景通过：0号填满扇区先按全部己方
信号计分再SETTLE，1号六种异常面奖励（含精选/痕迹后续），8号真实移动角后续
完成后再进入收入选择。共12个Decision错误owner拒绝与恢复重放一致。前两份
edges失败来自诊断误认事件名，实际事件为alienTrace；未修改生产规则，原记录保留。
play-domain.test补充旧手牌选择拒绝且状态不变、缺失发射事实失败。

最终42冷决策`any-alien-final-decision-42-20260907.json`：14.876秒、4096节点/
4804正式输入、0规则失败、30计划输入重放成功、根动作不变。该计时不与全量测试
并行；不能把单次耗时差异认定为稳定提速。最终全量回归与V审计进行中，完整局
需在提交后按唯一版本运行。

当前文档及关键字核对覆盖RL接口、卡牌DSL、mechanics、两物种implementation、
测试清单和AI设计；README/AGENTS/部署入口未改无需更新。历史序列化类型
yichangdian_draw_then_two_corners保留标识，不再表示两次行动角：执行语义由
两阶段drawnCardIds/stage正式payload定义，避免为改名破坏已有类型标识。

提交门禁：最终全量回归77/79 unit、1/1 fullFlow，仍为既有beam/data目标断言，
没有新增失败；V输入审计通过。任意扫描已独立提交858c756a，并在仅含该提交的
私有索引快照中通过effects、science-scan-flow和原play-domain测试。异常点修复
随后单独提交；唯一固定局验证二者组合，不能从组合分数拆推各自贡献。
