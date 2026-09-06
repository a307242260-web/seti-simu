# 卡牌痕迹提交路径缺陷取证与设计边界（2026-09-06）

状态：6cd56452 已完成共享路径实现及代表性行为回归，真实466/585单决策通过；
完整固定盘面629步均107.25，未达108.5门槛；前述两个独立来源缺陷仍未解决。
这不是仅给阿米巴加序号的修复，也不是所有外星人的全面规则重写。

## 已证明的原因

play-domain.genericResolve的ALIEN_TRACE分支调用aliens.placeTraceForActor时传入空
options；science.placeAlienTrace则经正式stateSequences.take提供alienEntity。
真实466状态克隆复现相同的序号错误。只传序号后放置成功，但资源和细胞器位置
保持不变：primitive返回reward.region，卡牌分支未消费，而science会继续区域奖励。
证据card-trace-sequence-cause-20260906.json；没有改动真实状态或重跑AI。

因此不采用“只增加sequence”方案：它会把显式异常变成静默漏奖。目标方案是让
卡牌来源使用已有science痕迹Decision与后续结算，并删除卡牌的第二份枚举/提交。
不新增环境适配层、特例快路径或另一份物种奖励处理器。

## 来源账

当前MODELS递归目录11处：b106/112/121/27/32/35/36/51/52/67及异常点7；
具体playEffects、tasks、嵌套奖励路径与options见card-trace-source-catalog-20260906-v2.json。
第一版只遍历CARD_REFERENCE_MAP得到10处，漏外星牌，不作为完备性证据。
另有play-domain.applyYichangdianAnomalyReward运行期构造痕迹效果，不能漏掉。

| 来源 | 当前入口 | 拟收敛路径及边界 |
|---|---|---|
| 普通/外星牌打出 | createSpawnedCardEffect | 转science.ALIEN_TRACE，原owner/卡牌身份/允许颜色保留 |
| 嵌套条件/弃牌角标等奖励 | spawnCardEffects→createSpawnedCardEffect | 与顶层同一转换，不另建嵌套handler |
| 任务/触发 | residual.createFormalCardEffectNode | 必须一起转换，不能只修打出路径 |
| 异常奖励运行期痕迹 | applyYichangdianAnomalyReward | 经同一createSpawnedCardEffect，不保留generic旁路 |
| 标准分析/行星痕迹 | science既有ALIEN_TRACE | 继续使用既有owner，不迁移或复制 |
| 初始牌豁免 | initial-cards.applyAlienTrace | 开局不发奖励的已确认例外，不改成普通领奖路径 |

## 实现前义务

| 边界 | 必须满足的行为证据 |
|---|---|
| 身份/序号 | 使用正式root序列，枚举不分配实体；一次真实正面放置消费一次，恢复一致 |
| 位置/奖励 | 未揭示首/额外位、已揭示正面及state额外位由同一science合法集决定；位置分、外星牌、区域奖励沿现有结算 |
| Decision | 卡牌来源仍是同一owner的真实选择；错误owner/stale输入拒绝，旧generic pending显式不兼容或经正式迁移，不静默提交 |
| 后续效果 | 保留原卡牌效果相对顺序，隐藏抽牌屏障立即生效，区域确定性动作不伪造外部输入 |
| 颜色限制 | allowedTraceTypes必须用于science枚举及再校验，不能默认扩大为三色 |
| 特殊目标 | targetRule=playerHasSameTrace（b27/32/35）、singleAlienTraceSet+requiredTraceTypes（b67）须明确落点；旧枚举目前未读取这些字段 |
| 放置后分数 | b36 afterTraceReward须核对“所选颜色痕迹数”及参数顺序；旧调用countTraceMarkers(alienState,actor)与正式签名(player,aliensState,traceType)相反 |
| 删除账 | 删除generic的第二份ALIEN_TRACE枚举/提交和其旧决策入口；保留正式类型来源登记，不能把源码目录覆盖等同于运行闭包 |
| 测试/性能 | 真实466无序号异常且奖励正确；覆盖卡牌/嵌套/任务来源与恢复，随后单决策计数/耗时、去重quick→full，门槛仍108.5 |

规则取证补充：b67 牌面为同一物种粉/黄/蓝各一，并非任意三枚。模型独立修正见
linguistic-trace-set-design-20260906.md；v2 目录保留为修正前证据，不覆盖历史快照。
后续迁移须读取当前模型的 requiredTraceTypes，不再沿用旧 requiredTraceCount。

## 冻结的实现矩阵

| 语义项 | 唯一 owner、状态及执行边界 | 可证伪验证 / 删除证据 |
|---|---|---|
| 11 个模型来源及运行期异常奖励 | Card/Residual 两个 converter 共用 Science 的 createAlienTraceEffect；保留 cardEffect/cardInstanceId/ownerId，入口仍按 direct/trigger 优先级插入 | 正式打牌、嵌套 b112、任务 b67、异常点牌来源执行；递归目录逐项核对转换可达 |
| 选择前准备 | 同一 Science ALIEN_TRACE executor 增加 execute，非 decision 入口先筛合法集，再生成同类型 Decision；空集成功记录 alienTraceSkipped，不生成空 Decision | 无同色既有痕迹的 b27 正常完成且不放置；无 actor 属错误，不按空集吞掉 |
| 目标资格 | Card Effects 纯函数 isAlienTraceTargetAllowed 复用 alienSlotHasPlayerTrace/slotHasPlayerTraceSet；无新缓存和状态；未知 targetRule 显式抛错 | b27/32/35 三色分别只允许本人已有同色的槽；b67 只允许本人三色齐全的槽，不能借其他玩家痕迹 |
| 允许颜色 | Science 在同一枚举函数中交集处理来源 traceType 和 cardEffect.options.allowedTraceTypes；非法颜色/规则不降级 | 所有暴露选项满足颜色限制；resolver 从同一个最新受限集合再校验 |
| 放置及物种奖励 | 仍由现有 Science placeAlienTrace/ALIEN_TRACE resolve 执行；players/aliens/meta 为 working root，alienEntity 经 take；选牌交 Residual，区域奖励交既有确定性 Amiba effect | 实际 b32 正面黄色放置：序号一次、区域奖励一次、固定移动；真实466不再丢分支或抛序号异常 |
| b36 后计分 | Science 新确定性 ALIEN_TRACE_SCORE effect 排在该次位置领奖效果之后、外层后续卡牌效果之前；payload 只携带选中 traceType、倍率、cardInstanceId；计数调用 countTraceMarkers(actor,aliens,traceType) | 粉/黄/蓝总数不同的状态逐色验证，包含本次新痕迹；不生成额外玩家选择，不在多选领奖前提前完成 |
| RNG/隐藏信息 | 准备/枚举/评分无 RNG 或 id 写；领奖沿既有 draw context 与不可逆屏障，无复制物种奖励表 | 区域盲抽后的 RNG/手牌/序号/完整存档恢复重放一致 |
| 输入与恢复 | Science Decision owner 不变；runtime 既有完整合法项比较拒绝伪造、wrong-owner、stale/late；保存 payload 自足，不用闭包 | pending 保存恢复后合法集与执行 envelope 相同；拒绝错误输入不改变 committed root |
| 旧 pending | 不迁移旧 card_play_domain_effect:{effect,decision}:alien_trace；物理删除注册后 runtime 明确 EFFECT_EXECUTOR_NOT_REGISTERED / EFFECT_DECISION_EXECUTOR_MISSING | 修改保存的 pending 为旧类型，恢复/提交显式失败，禁止退回 generic |
| 保留项 | 标准分析/行星等已有 kind=decision Science 来源不改变准备方式；初始牌 awardRewards:false 豁免不变；卡牌单细胞器真实选择不动 | 原有 Science/initial/Amiba 测试与唯一 fullFlow 回归 |

后计分来源仍沿用旧 alienEffectScore，不夹带计分归因改名。b36 牌面“然后每拥有一个
该颜色痕迹获得1分”已由本地 b_36.webp 核对。目标限制三张单色牌亦逐张核对牌面。
本轮不引入搜索去重、自动选择唯一目标、减少预算或新增通用回调设施。
完整修复后再集中运行行为测试，单决策验证通过前不跑完整局。

验证边界补充：真实打出 b52 的小行星条件被既有 buildProbeLocationData 中固定
locationType="solar" 阻断，未进入奖励。本轮不改变位置分类；嵌套路径改由同一个
CONDITIONAL_REWARD 入口的 b112 验证。b52 转换后的痕迹处理仍由相同 spawnCardEffects
负责，但不能宣称 b52 端到端通过。该上游既有缺陷独立待处理；另见旧
PROBE_LOCATION_REWARD 对 resolveVisibleContent 参数顺序也有可疑调用，尚未单独验证。

来源复核另发现运行期异常奖励辅助函数 applyYichangdianAnomalyReward 的成功返回缺少
ok:true，调用方却检查 !applied.ok；该来源会在派发痕迹前失败。本轮 converter 已
映射新路径，但不把该运行期来源写成端到端通过。独立修复该成功返回契约后再补
真实异常奖励行为证据，不对调用方加忽略失败的旁路。异常点7打牌来源已实际通过。

## 当前验证

已通过正式 Card Play composition：三张单色目标牌的本人/他人/空目标；b32 区域
数据+盲抽+固定移动及一次序号；b36 三色差异计分与跨选牌后计分；b112 嵌套条件
奖励；b67 完成任务目标限制；异常点7任意痕迹；错误 owner/stale/伪造颜色拒绝、
完整 envelope 恢复重放、旧 Decision pending 显式拒绝。最终回归77 unit+1 fullFlow
通过，耗时6.73/0.52秒（沿用两项用户指定排除）。

## 固定提交单决策结果

基准为 probe-scan-dependency-step-{466,585}-20260906.json；当前证据为
card-trace-owner-step-{466,585}-6cd56452-20260906.json，均来自原始实际盘面检查点。
下表节点/提交只列 strategic，另各有 control 1节点/1提交。

| 决策 | 原耗时 → 新耗时 | 节点 | 正式提交 | 异常 | 根动作 |
|---|---|---|---|---|---|
| 466 | 16.50 → 14.65秒 | 4096 → 4096 | 4593 → 4605 | 原12次RESOLVER_THROWN → 无失败 | launch:c1616852不变 |
| 585 | 11.48 → 11.08秒 | 2614 → 2614 | 3448 → 3448 | 两版均无失败 | industry:2259bbe0不变 |

判断：序号异常消失、此前失败的12次提交正常执行，不是通过删失败分支减少节点。
节点数未减少，单次耗时差异不作为显著性能收益证据；此次属于规则执行正确性修复。
计划框架未改，代表性完整恢复与既有计划回归通过，但单决策根动作相同不等于整局
计划/效果验收完成。按标准去重进入quick→full验证，不降低108.5门槛。

快速200步记录220d6a11.6cd56452.quick-200.json：153182ms，阶段均24.75，
与be6bd7b6前200步完整replay相同；节点均47727，成功提交59201→59203。
3098次EFFECT_EXECUTION_FAILED与上一版相同，没有新增抛异常类别。当前完整局从
该存档第200步续跑已完成；快速结果不作为终局分数或性能验收结论。
完整验收见card-trace-full-review-20260906.md：总559331ms，146061节点；抛异常类别
清零，但5813次普通执行失败仍需定位，优先第605步绿方的2187次失败。

本轮未运行新的全盘，没有新分数。旧559f3ce9局部结果与未通过状态保持原样。
实现时同步机制参考、外星人总纲、卡牌 DSL 与性能计划；不改项目记忆。
