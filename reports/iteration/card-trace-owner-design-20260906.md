# 卡牌痕迹提交路径缺陷取证与设计边界（2026-09-06）

状态：原因已复现，来源目录已取证；生产尚未修改，完整迁移设计待闭合。
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

尚待闭合：后续计分owner；runtime对空合法集的
science Decision处理，以及旧pending明确失败证据。未知项不能通过默认分支吞掉。
发现的targetRule和b36旧缺陷不擅自以当前错误行为作为迁移契约，也不夹带其他
物种奖励表修订。完成这一有限路径设计后再批量实现，不做“补一行→看下一个错”。

本轮未运行新的全盘，没有新分数。旧559f3ce9局部结果与未通过状态保持原样。
已核对AI/RL契约、外星人总纲和两正式domain；本轮仅取证与设计记录，生产接口和
行为未改，无需改其当前实现说明。同步性能计划，不改项目记忆。
