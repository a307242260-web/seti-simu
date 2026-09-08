# 方舟解锁牌打出未发奖励（2026-09-08，候选已实现待验收）

候选代码954e51c0：正式play_card接受方舟粉1，扣2信用点、移出手牌并完成主行动，
但奖励牌堆与翻开记录完全不变，Session直接idle，无高级奖励。这是规则缺陷，
不能把缺失扫描造成的更少节点认定为性能优化。

证据：[正式提交检查点](fangzhou-play-missing-reward-v2-20260908.json)，脚本
`adhoc/reproduce-fangzhou-play-20260908.js`。从第50步真实根派生fixture，新增正式
方舟粉1定义对应手牌，设置奖励牌1在顶；高级奖励1应为盲抽2及完整扫描。正式结果
6钱→4钱、4手牌→3手牌、mainActionCompleted=true、奖励牌堆和revealed均不变。
不执行AI；不声称原历史第50步或当前固定完整局实际触发过此缺陷。

首次fixture直接带入createCard2Definition的src/label/cardName，被committed-state
校验以STATE_HOST_FIELD_FORBIDDEN拒绝，尚未打牌，不能计为生产规则执行失败。
失败原件[保留](fangzhou-play-missing-reward-20260908.json)。按已核对的正式状态
契约去掉三个显示字段后复现成功，未改生产校验或规则。

根因位置：

- cards/play-domain只从cards.effects.buildPlayEffects取打出效果；无模型返回空数组。
- cards.MODELS没有方舟card2模型；正式打牌未拒绝空效果，照常付费和消费主行动。
- fangzhou-card1-queue保留高级效果构建，但全仓生产调用检索只见定义/导出/装配，
  未见调用该生成器；residual中的flipCard1Reward调用只有basic。
- 规则资料assets/aliens/方舟/implementation.md及模块CARD1_DEFINITIONS明确高级
  奖励；不得把当前缺失行为定为规则或以此删紫科技需求。

独立修复范围：正式打出方舟card2接入高级翻牌与共享
效果队列，完整覆盖9种高级奖励、RNG/实体序号、不可逆屏障、嵌套Decision及恢复；
复用正式reward/scan/research/launch/move原语，不恢复Browser专用第二执行链。
不调整方舟槽位贪心或其他策略。需求式图灵提取必须以修复后的真实能力读取为准。
不能只给高级奖励1打特例；先完整设计，再临时分支开发、定向事务验证和独立登记。
完整接入方案见[高级奖励设计](fangzhou-major-reward-design-20260908.md)：12模型、9项
奖励、正式执行入口、RNG/隐藏屏障及恢复门禁已列明；已开发，尚未完整验收通过。

后续进展：生产候选4d3711c5已在独立临时分支接入全部9种高级奖励，9项正式事务、
满额发射/无科技目标、恢复和重洗测试通过；未合dev。隐藏边界、Chrome和完整局仍
待验收，见[修复进度](fangzhou-major-reward-progress-20260908.md)。现有95.5完整局
不重跑，不用此fixture解释历史白方降分。整体Goal未完成。
