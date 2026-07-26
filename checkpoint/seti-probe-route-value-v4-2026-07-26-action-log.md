# seti-104-board-v1 机器人逐回合行动报告

- seed：`seti-104-official-v1`
- board fingerprint：`4196a19b423ab9c4732dabe4263a3984c13c72bd6caa70e732c67922b5d19b92`
- Policy 决策数：176
- 游戏回合数：26
- 决策口径：枚举每枚探测器到所有可用行星的最短路线，同移动消耗优先沿途宣传最高者；V 是该路线沿途宣传与环绕/登陆实际收益的等价分
- 执行口径：优先执行 V 最高且资源可支付路线的下一步；没有可支付路线时，快速交易、相关打牌或橙色科技只能用于降低该路线真实缺口；每步后从新盘面重算
- 资源口径：钱电只判断完整路线能否支付，不按主行动次数或路径长度扣分；数据仅在真实解锁蓝色痕迹并计分后进入收益
- 诊断目标：初次接触玩家约 100 分；最终表同时列出各机器人的目标差距
- 固定反例：R1 T04 绿色登陆土星按 `land -> choose_target(yellow trace)` 标准链展开；成本、地点奖励、首黄宣传及 alienCard 均取实际 root/leaf 字段，不复制规则常数
- 字段边界：projection 只保留固定上限的探测器目标需求摘要；拓扑、成本、减免与奖励引用均由生产规则 owner 生成，完整 checkpoint 不进入 Policy DTO

## 开局待决选择

- 白色玩家：↳ 选择：开始初始选择
- 白色玩家：↳ 选择：选择公司：未来跨度研究所
- 白色玩家：↳ 选择：选择：初始牌 15
- 白色玩家：↳ 选择：选择：初始牌 12
- 白色玩家：↳ 选择：确认初始选择
- 蓝色玩家：↳ 选择：选择公司：异星实验室
- 蓝色玩家：↳ 选择：选择：初始牌 7
- 蓝色玩家：↳ 选择：选择：初始牌 17
- 蓝色玩家：↳ 选择：确认初始选择
- 棕色玩家：↳ 选择：选择公司：寰宇动力
- 棕色玩家：↳ 选择：选择：初始牌 1
- 棕色玩家：↳ 选择：选择：初始牌 16
- 棕色玩家：↳ 选择：确认初始选择
- 绿色玩家：↳ 选择：选择公司：芬威克研究中心
- 绿色玩家：↳ 选择：选择：初始牌 2
- 绿色玩家：↳ 选择：选择：初始牌 20
- 绿色玩家：↳ 选择：确认初始选择
- 白色玩家：↳ 选择：b_102.webp
- 白色玩家：↳ 选择：dlc_41.png
- 蓝色玩家：↳ 选择：b_62.webp
- 蓝色玩家：↳ 选择：b_13.webp
- 蓝色玩家：↳ 选择：b_36.webp
- 棕色玩家：↳ 选择：b_65.webp
- 棕色玩家：↳ 选择：b_30.webp
- 绿色玩家：↳ 选择：b_51.webp
- 绿色玩家：↳ 选择：b_64.webp
- 绿色玩家：↳ 选择：dlc_39.png

## 自动诊断摘要

- 26 个玩家回合中，22 个回合没有获得分数。
- 123 个已解析的非结束决策中，74 个与至少一个备选目标同分，6 个不是正分探测器目标步骤。
- 实际提交行动族：launch=5，move=33，choose_payment=34，pass=16，choose_card=16，quick_trade=11，orbit=2，land=2，choose_target=3，play_card=1，end_turn=26；表格主列均为实际提交，备选列仅为未提交的反事实候选。
- 性能：路线 checkpoint 上限=10；每候选平均 23.68ms、最大 57.21ms；候选集整步最大 701.66ms，超过 1s 会立即中止整局。

## 第 1 轮

### T01 白色玩家

- 分数：7 → 7（0）
- 持有资源：钱 4→2(-2)，电 4→2(-2)，宣传 4→5(+1)，数据 2→2(0)，手牌 3→3(0)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 28 | 发射 | V=11.50；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动2；全路线需求=钱3/电3/移动2；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动2；链=launch:c94cda79；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(7候选合计) fork 76.50ms/执行 121.60ms/投影 15.21ms/估值 0.08ms；每候选 30.47ms | 钱-2 | 打出卡牌：b_105.webp（V 11.50）；b_105.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_56.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 29 | 移动火箭 3 ccw | V=11.50；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动2；全路线需求=钱1/电3/移动2；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动1；链=move:ddf0bb75→choose_payment:abbb51f1；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(6候选合计) fork 35.72ms/执行 70.48ms/投影 8.43ms/估值 0.10ms；每候选 19.10ms | — | 结束回合（V 11.50）；b_105.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_56.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 30 | ↳ 选择：消耗 1 能量 | V=11.50；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动2；全路线需求=钱1/电3/移动2；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动1；链=choose_payment:abbb51f1；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 10.47ms/执行 4.52ms/投影 1.11ms/估值 0.02ms；每候选 16.11ms | 电-1 | — |
| 31 | 移动火箭 3 ccw | V=11.50；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:ddf0bb75→choose_payment:abbb51f1；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(6候选合计) fork 34.63ms/执行 68.70ms/投影 8.16ms/估值 0.06ms；每候选 18.58ms | — | 结束回合（V 11.50）；b_105.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_56.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 32 | ↳ 选择：消耗 1 能量 | V=11.50；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:abbb51f1；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 10.49ms/执行 4.63ms/投影 1.32ms/估值 0.02ms；每候选 16.44ms | 电-1，宣传+1 | — |
| 33 | 结束回合 | V=9；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=end_turn:b2f9b29d；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(6候选合计) fork 33.64ms/执行 67.75ms/投影 7.96ms/估值 0.07ms；每候选 18.22ms | — | b_105.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_56.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_11.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
### T02 蓝色玩家

- 分数：4 → 4（0）
- 持有资源：钱 4→3(-1)，电 3→1(-2)，宣传 1→2(+1)，数据 3→3(0)，手牌 2→2(0)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 34 | 发射 | V=11.50；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动2；全路线需求=钱2/电3/移动2；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动2；链=launch:a4087d46；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(4候选合计) fork 32.26ms/执行 53.19ms/投影 7.32ms/估值 0.05ms；每候选 23.19ms | 钱-1 | dlc_25.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_3.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；PASS（不可选：COUNTERFACTUAL_BRANCH_LIMIT） |
| 35 | 移动火箭 4 ccw | V=11.50；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动2；全路线需求=钱1/电3/移动2；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动1；链=move:48b61031→choose_payment:5d7f4364；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(6候选合计) fork 26.44ms/执行 57.05ms/投影 6.32ms/估值 0.06ms；每候选 14.97ms | — | 结束回合（V 11.50）；dlc_25.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_3.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 36 | ↳ 选择：消耗 1 能量 | V=11.50；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动2；全路线需求=钱1/电3/移动2；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动1；链=choose_payment:5d7f4364；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 10.45ms/执行 4.93ms/投影 0.98ms/估值 0.02ms；每候选 16.36ms | 电-1 | — |
| 37 | 移动火箭 4 ccw | V=11.50；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:48b61031→choose_payment:5d7f4364；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(6候选合计) fork 26.26ms/执行 56.03ms/投影 6.15ms/估值 0.05ms；每候选 14.74ms | — | 结束回合（V 11.50）；dlc_25.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_3.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 38 | ↳ 选择：消耗 1 能量 | V=11.50；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:5d7f4364；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 10.31ms/执行 4.49ms/投影 0.97ms/估值 0.01ms；每候选 15.77ms | 电-1，宣传+1 | — |
| 39 | 结束回合 | V=9；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=end_turn:320f2608；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(6候选合计) fork 26.61ms/执行 55.97ms/投影 5.91ms/估值 0.06ms；每候选 14.75ms | — | dlc_25.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_3.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；移动火箭 4 ccw（不可选：not-current-probe-goal-step） |
### T03 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 3→7(+4)，电 3→3(0)，宣传 6→7(+1)，数据 2→2(0)，手牌 2→4(+2)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 40 | 移动火箭 1 ccw | V=11.50；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动2；全路线需求=钱1/电3/移动2；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动1；链=move:1e55ec9a→choose_payment:f893f500；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(10候选合计) fork 93.61ms/执行 135.45ms/投影 23.94ms/估值 0.14ms；每候选 25.30ms | — | dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_25.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；执行科技：寰宇动力 1x 行动（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 41 | ↳ 选择：消耗 1 能量 | V=11.50；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动2；全路线需求=钱1/电3/移动2；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动1；链=choose_payment:f893f500；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 11.53ms/执行 4.60ms/投影 1.43ms/估值 0.02ms；每候选 17.56ms | 电-1 | — |
| 42 | 移动火箭 1 ccw | V=11.50；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:1e55ec9a→choose_payment:f893f500；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(10候选合计) fork 91.20ms/执行 135.98ms/投影 23.43ms/估值 0.10ms；每候选 25.06ms | — | dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_25.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；执行科技：寰宇动力 1x 行动（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 43 | ↳ 选择：消耗 1 能量 | V=11.50；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:f893f500；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 11.65ms/执行 4.58ms/投影 1.43ms/估值 0.02ms；每候选 17.66ms | 电-1，宣传+1 | — |
| 44 | PASS | 不可选；状态=unresolved；置信=low；COUNTERFACTUAL_BRANCH_LIMIT | — | dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_25.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；执行科技：寰宇动力 1x 行动（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 45 | ↳ 选择：b_31.webp | V=9；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_card:2b3b532b；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(5候选合计) fork 35.72ms/执行 28.25ms/投影 7.10ms/估值 0.05ms；每候选 14.22ms | 手牌+1 | ↳ 选择：b_128.webp（V 9）；↳ 选择：dlc_1.png（V 9）；↳ 选择：b_106.webp（V 9） |
| 46 | 结束回合 | V=9；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=end_turn:d59ab08c；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(7候选合计) fork 43.05ms/执行 68.21ms/投影 10.28ms/估值 0.07ms；每候选 17.36ms | 钱+4，电+2，手牌+1 | 移动火箭 1 ccw（不可选：not-current-probe-goal-step）；移动火箭 1 cw（不可选：not-current-probe-goal-step）；移动火箭 2 ccw（不可选：not-current-probe-goal-step） |
### T04 绿色玩家

- 分数：9 → 9（0）
- 持有资源：钱 7→1(-6)，电 1→1(0)，宣传 4→5(+1)，数据 2→2(0)，手牌 2→0(-2)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 47 | 2张牌 → 1能量 | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电7/移动6；全路线需求=钱3/电8/移动6；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电6/移动6；链=quick_trade:0037d2c5→choose_payment:2bb8d7bc；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-gap-reduced-by-standard-leaf；耗时(5候选合计) fork 36.69ms/执行 64.66ms/投影 7.20ms/估值 0.08ms；每候选 21.71ms | — | 2信用点 → 1能量（V 28.50）；发射（V 28.50）；PASS（V 28.50） |
| 48 | ↳ 选择：b_44.webp、b_108.webp | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电7/移动6；全路线需求=钱3/电8/移动6；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电6/移动6；链=choose_payment:2bb8d7bc；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 11.13ms/执行 5.91ms/投影 1.02ms/估值 0.02ms；每候选 18.05ms | 电+1，手牌-2 | — |
| 49 | 2信用点 → 1能量 | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电6/移动6；全路线需求=钱3/电8/移动6；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电5/移动6；链=quick_trade:ee5652be；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-gap-reduced-by-standard-leaf；耗时(3候选合计) fork 24.91ms/执行 41.79ms/投影 5.97ms/估值 0.06ms；每候选 24.22ms | 钱-2，电+1 | 发射（V 28.50）；PASS（V 28.50）；执行科技：芬威克研究中心 1x 行动（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 50 | 2信用点 → 1能量 | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电5/移动6；全路线需求=钱3/电8/移动6；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电4/移动6；链=quick_trade:ee5652be；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-gap-reduced-by-standard-leaf；耗时(3候选合计) fork 25.27ms/执行 43.68ms/投影 5.84ms/估值 0.05ms；每候选 24.93ms | 钱-2，电+1 | 发射（V 28.50）；PASS（V 28.50）；执行科技：芬威克研究中心 1x 行动（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 51 | 发射 | V=11.50；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动2；全路线需求=钱3/电4/移动2；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动2；链=launch:70d77c1b；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(3候选合计) fork 26.04ms/执行 41.11ms/投影 5.81ms/估值 0.06ms；每候选 24.32ms | 钱-2 | PASS（V 11.50）；执行科技：芬威克研究中心 1x 行动（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；放置数据（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 52 | 移动火箭 5 ccw | V=11.50；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动2；全路线需求=钱1/电4/移动2；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动1；链=move:18a49c99→choose_payment:56560af3；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(4候选合计) fork 21.27ms/执行 37.70ms/投影 4.03ms/估值 0.05ms；每候选 15.75ms | — | 结束回合（V 11.50）；执行科技：芬威克研究中心 1x 行动（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；移动火箭 5 cw（不可选：not-current-probe-goal-step） |
| 53 | ↳ 选择：消耗 1 能量 | V=11.50；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动2；全路线需求=钱1/电4/移动2；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动1；链=choose_payment:56560af3；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 10.91ms/执行 4.65ms/投影 1ms/估值 0.02ms；每候选 16.56ms | 电-1 | — |
| 54 | 移动火箭 5 ccw | V=11.50；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电3/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:9c3b09ca→choose_payment:da1423b5；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(4候选合计) fork 20.91ms/执行 38.02ms/投影 4.31ms/估值 0.05ms；每候选 15.81ms | — | 结束回合（V 11.50）；执行科技：芬威克研究中心 1x 行动（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；移动火箭 5 out（不可选：not-current-probe-goal-step） |
| 55 | ↳ 选择：消耗 2 能量 | V=11.50；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电3/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:da1423b5；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 11.10ms/执行 5.24ms/投影 0.98ms/估值 0.02ms；每候选 17.32ms | 电-2，宣传+1 | — |
| 56 | 结束回合 | V=9；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=end_turn:1f65daa3；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(4候选合计) fork 19.85ms/执行 38.06ms/投影 4.11ms/估值 0.05ms；每候选 15.51ms | — | 执行科技：芬威克研究中心 1x 行动（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；移动火箭 5 ccw（不可选：not-current-probe-goal-step）；移动火箭 5 cw（不可选：not-current-probe-goal-step） |
### T05 白色玩家

- 分数：7 → 7（0）
- 持有资源：钱 2→5(+3)，电 2→4(+2)，宣传 5→5(0)，数据 2→2(0)，手牌 3→5(+2)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 57 | PASS | V=9；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=pass:a1f33c73→choose_card:4fcb2a38；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=pass-last-resort；耗时(9候选合计) fork 92.86ms/执行 113.60ms/投影 10.67ms/估值 0.10ms；每候选 24.13ms | — | b_105.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_56.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_11.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 58 | ↳ 选择：dlc_1.png | V=9；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_card:439e5d53；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(4候选合计) fork 25.52ms/执行 22.39ms/投影 4.55ms/估值 0.04ms；每候选 13.11ms | 手牌+1 | ↳ 选择：b_99.webp（V 9）；↳ 选择：b_106.webp（V 9）；↳ 选择：b_128.webp（V 9） |
| 59 | 结束回合 | V=9；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=end_turn:b2f9b29d；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(4候选合计) fork 20.38ms/执行 38.75ms/投影 4.16ms/估值 0.04ms；每候选 15.82ms | 钱+3，电+2，手牌+1 | 移动火箭 3 cw（不可选：not-current-probe-goal-step）；移动火箭 3 ccw（不可选：not-current-probe-goal-step）；移动火箭 3 out（不可选：not-current-probe-goal-step） |
### T06 蓝色玩家

- 分数：4 → 4（0）
- 持有资源：钱 3→7(+4)，电 1→3(+2)，宣传 2→2(0)，数据 3→4(+1)，手牌 2→4(+2)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 60 | PASS | V=9；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=pass:c858282e→choose_card:38c19566；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=pass-last-resort；耗时(7候选合计) fork 53.68ms/执行 82.55ms/投影 7.99ms/估值 0.06ms；每候选 20.60ms | — | dlc_25.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_3.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；移动火箭 4 ccw（不可选：not-current-probe-goal-step） |
| 61 | ↳ 选择：b_128.webp | V=9；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_card:38c19566；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(3候选合计) fork 20.21ms/执行 17.96ms/投影 2.92ms/估值 0.03ms；每候选 13.70ms | 手牌+1 | ↳ 选择：b_99.webp（V 9）；↳ 选择：b_106.webp（V 9） |
| 62 | 结束回合 | V=9；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=end_turn:320f2608；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(4候选合计) fork 20.50ms/执行 38.56ms/投影 4.10ms/估值 0.04ms；每候选 15.79ms | 钱+4，电+2，数据+1，手牌+1 | 移动火箭 4 ccw（不可选：not-current-probe-goal-step）；移动火箭 4 cw（不可选：not-current-probe-goal-step）；移动火箭 4 out（不可选：not-current-probe-goal-step） |
### T07 绿色玩家

- 分数：9 → 18（+9）
- 持有资源：钱 1→0(-1)，电 1→0(-1)，宣传 5→5(0)，数据 2→2(0)，手牌 0→0(0)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 63 | 环绕金星（R5） | V=9；目标=venus/orbit；路线终点实际分=9；行动后已兑现分变化=9；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=orbit:83f031df@{"realizedScore":9,"credits":-1,"energy":-1,"publicity":0,"availableData":0,"ordinaryCards":0,"alienCards":0}；叶后同目标缺口=目标已完成；链=orbit:83f031df；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-completed-standard-leaf；耗时(6候选合计) fork 48.03ms/执行 80.12ms/投影 11.07ms/估值 0.05ms；每候选 23.20ms | 分数+9，钱-1，电-1 | PASS（V 9）；执行科技：芬威克研究中心 1x 行动（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；移动火箭 5 ccw（不可选：not-current-probe-goal-step） |
| 64 | 结束回合 | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱3/电8/移动6；全路线需求=钱3/电8/移动6；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱3/电8/移动6；链=end_turn:1f65daa3；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 5.41ms/执行 9.18ms/投影 1ms/估值 0.02ms；每候选 15.58ms | — | 执行科技：芬威克研究中心 1x 行动（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；放置数据（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；3宣传 → 精选1张牌（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
### T08 绿色玩家

- 分数：18 → 18（0）
- 持有资源：钱 0→6(+6)，电 0→1(+1)，宣传 5→6(+1)，数据 2→2(0)，手牌 0→1(+1)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 65 | PASS | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱3/电8/移动6；全路线需求=钱3/电8/移动6；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱3/电8/移动6；链=pass:ff716055→choose_card:c77cf38a；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=pass-last-resort；耗时(2候选合计) fork 31.02ms/执行 41.52ms/投影 6.96ms/估值 0.03ms；每候选 39.75ms | — | 执行科技：芬威克研究中心 1x 行动（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；放置数据（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；3宣传 → 精选1张牌（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 66 | ↳ 选择：b_106.webp | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱3/电8/移动6；全路线需求=钱3/电8/移动6；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱3/电8/移动6；链=choose_card:2d5cbbff；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 16.60ms/执行 11.04ms/投影 2ms/估值 0.02ms；每候选 14.82ms | 手牌+1 | ↳ 选择：b_99.webp（V 28.50） |
| 67 | 结束回合 | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱3/电8/移动6；全路线需求=钱3/电8/移动6；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电7/移动6；链=end_turn:1f65daa3；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 5.41ms/执行 12.27ms/投影 1.03ms/估值 0.24ms；每候选 18.71ms | 钱+6，电+1，宣传+1 | 放置数据（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |

## 第 2 轮

### T01 蓝色玩家

- 分数：4 → 9（+5）
- 持有资源：钱 7→3(-4)，电 3→3(0)，宣传 2→3(+1)，数据 4→5(+1)，手牌 4→4(0)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 68 | 登陆金星（主星，R4，2能量） | V=10.83；目标=venus/land；路线终点实际分=5；行动后已兑现分变化=5；缺口=钱0/电0/移动0；全路线需求=钱0/电2/移动0；下一步=land；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=land:284288e5@{"realizedScore":5,"credits":0,"energy":-2,"publicity":1,"availableData":1,"ordinaryCards":0,"alienCards":1}；叶后同目标缺口=目标已完成；链=land:284288e5→choose_target:d64e085d；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-completed-standard-leaf；耗时(9候选合计) fork 120.63ms/执行 155.99ms/投影 19.60ms/估值 0.09ms；每候选 32.91ms | 分数+5，电-2，数据+1 | dlc_25.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_128.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_12.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 69 | ↳ 选择：外星人 1 黄色痕迹 | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电7/移动6；全路线需求=钱2/电8/移动6；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电7/移动6；链=choose_target:d64e085d；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 19.78ms/执行 10.12ms/投影 1.97ms/估值 0.02ms；每候选 15.94ms | 宣传+1 | ↳ 选择：外星人 2 黄色痕迹（V 28.50） |
| 70 | 2信用点 → 1能量 | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电7/移动6；全路线需求=钱2/电8/移动6；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电6/移动6；链=quick_trade:e49b3d11；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-gap-reduced-by-standard-leaf；耗时(3候选合计) fork 24.19ms/执行 48.24ms/投影 6.27ms/估值 0.04ms；每候选 26.23ms | 钱-2，电+1 | 结束回合（V 28.50）；dlc_25.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_128.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 71 | 2信用点 → 1能量 | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电6/移动6；全路线需求=钱2/电8/移动6；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电5/移动6；链=quick_trade:e49b3d11；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-gap-reduced-by-standard-leaf；耗时(3候选合计) fork 24.57ms/执行 47.96ms/投影 6.26ms/估值 0.04ms；每候选 26.26ms | 钱-2，电+1 | 结束回合（V 28.50）；dlc_25.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_128.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 72 | 结束回合 | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电5/移动6；全路线需求=钱2/电8/移动6；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电5/移动6；链=end_turn:320f2608；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(3候选合计) fork 23.78ms/执行 50.14ms/投影 5.99ms/估值 0.05ms；每候选 26.64ms | — | dlc_25.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_128.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_12.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
### T02 棕色玩家

- 分数：8 → 13（+5）
- 持有资源：钱 7→1(-6)，电 3→1(-2)，宣传 7→9(+2)，数据 2→2(0)，手牌 4→4(0)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 73 | 登陆金星（主星，R1，2能量） | V=10.83；目标=venus/land；路线终点实际分=5；行动后已兑现分变化=5；缺口=钱0/电0/移动0；全路线需求=钱0/电2/移动0；下一步=land；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=land:ada8f13a@{"realizedScore":5,"credits":0,"energy":-2,"publicity":0,"availableData":0,"ordinaryCards":0,"alienCards":0}；叶后同目标缺口=目标已完成；链=land:ada8f13a→choose_target:55267bf9；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-completed-standard-leaf；耗时(13候选合计) fork 164.25ms/执行 192.94ms/投影 29.76ms/估值 0.12ms；每候选 29.77ms | 分数+5，电-2 | dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_9.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_31.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 74 | ↳ 选择：外星人 2 黄色痕迹 | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电7/移动6；全路线需求=钱1/电8/移动6；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电7/移动6；链=choose_target:de100b79；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 18.60ms/执行 9.30ms/投影 1.91ms/估值 0.03ms；每候选 14.90ms | 宣传+1 | ↳ 选择：外星人 1 黄色痕迹（V 28.50） |
| 75 | 2信用点 → 1能量 | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电7/移动6；全路线需求=钱1/电8/移动6；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电6/移动6；链=quick_trade:5ad269c5；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-gap-reduced-by-standard-leaf；耗时(6候选合计) fork 40.25ms/执行 78.19ms/投影 8.76ms/估值 0.07ms；每候选 21.20ms | 钱-2，电+1 | 移动火箭 2 ccw（V 28.50）；结束回合（V 28.50）；dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 76 | 2信用点 → 1能量 | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电6/移动6；全路线需求=钱1/电8/移动6；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电5/移动6；链=quick_trade:5ad269c5；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-gap-reduced-by-standard-leaf；耗时(6候选合计) fork 38.67ms/执行 79.39ms/投影 8.66ms/估值 0.07ms；每候选 21.12ms | 钱-2，电+1 | 移动火箭 2 ccw（V 28.50）；结束回合（V 28.50）；dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 77 | 2信用点 → 1能量 | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电5/移动6；全路线需求=钱1/电8/移动6；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电4/移动6；链=quick_trade:5ad269c5；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-gap-reduced-by-standard-leaf；耗时(6候选合计) fork 40.75ms/执行 76.40ms/投影 8.66ms/估值 0.07ms；每候选 20.97ms | 钱-2，电+1 | 移动火箭 2 ccw（V 28.50）；结束回合（V 28.50）；dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 78 | 移动火箭 2 ccw | V=8.50；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动2；全路线需求=钱1/电4/移动2；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动1；链=move:626aa02f→choose_payment:f893f500；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(5候选合计) fork 37.33ms/执行 68.91ms/投影 8.97ms/估值 0.06ms；每候选 23.04ms | — | 结束回合（V 8.50）；dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_9.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 79 | ↳ 选择：消耗 1 能量 | V=8.50；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动2；全路线需求=钱1/电4/移动2；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动1；链=choose_payment:f893f500；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 11.13ms/执行 4.71ms/投影 0.97ms/估值 0.02ms；每候选 16.80ms | 电-1 | — |
| 80 | 移动火箭 2 ccw | V=8.50；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电3/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:c18d2398→choose_payment:015c7b42；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(5候选合计) fork 37.68ms/执行 69.16ms/投影 8.13ms/估值 0.06ms；每候选 22.99ms | — | 结束回合（V 8.50）；dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_9.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 81 | ↳ 选择：消耗 2 能量 | V=8.50；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电3/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:015c7b42；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 10.65ms/执行 5.07ms/投影 0.98ms/估值 0.02ms；每候选 16.70ms | 电-2，宣传+1 | — |
| 82 | 结束回合 | V=6；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=end_turn:d59ab08c；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(5候选合计) fork 38.36ms/执行 71.40ms/投影 8.20ms/估值 0.05ms；每候选 23.59ms | — | dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_9.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_31.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
### T03 绿色玩家

- 分数：18 → 18（0）
- 持有资源：钱 6→2(-4)，电 1→1(0)，宣传 6→6(0)，数据 2→2(0)，手牌 1→1(0)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 83 | 2信用点 → 1能量 | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电7/移动6；全路线需求=钱3/电8/移动6；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电6/移动6；链=quick_trade:ee5652be；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-gap-reduced-by-standard-leaf；耗时(4候选合计) fork 45.16ms/执行 70.75ms/投影 9.73ms/估值 0.04ms；每候选 31.41ms | 钱-2，电+1 | 发射（V 28.50）；b_106.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；执行科技：芬威克研究中心 1x 行动（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 84 | 发射 | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电6/移动6；全路线需求=钱3/电8/移动6；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电6/移动6；链=launch:70d77c1b；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(4候选合计) fork 45.59ms/执行 70.92ms/投影 9.85ms/估值 0.05ms；每候选 31.59ms | 钱-2 | b_106.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；执行科技：芬威克研究中心 1x 行动（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；PASS（不可选：COUNTERFACTUAL_BRANCH_LIMIT） |
| 85 | 移动火箭 6 ccw | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电6/移动6；全路线需求=钱1/电8/移动6；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电6/移动5；链=move:812cd598→choose_payment:56560af3；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(5候选合计) fork 22.55ms/执行 46.59ms/投影 4.92ms/估值 0.05ms；每候选 14.81ms | — | 结束回合（V 28.50）；b_106.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；执行科技：芬威克研究中心 1x 行动（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 86 | ↳ 选择：消耗 1 能量 | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电6/移动6；全路线需求=钱1/电8/移动6；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电6/移动5；链=choose_payment:56560af3；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 10.79ms/执行 4.75ms/投影 0.98ms/估值 0.02ms；每候选 16.52ms | 电-1 | — |
| 87 | 结束回合 | V=28.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电6/移动5；全路线需求=钱1/电7/移动5；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电6/移动5；链=end_turn:1f65daa3；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(2候选合计) fork 6.72ms/执行 18.20ms/投影 1.95ms/估值 0.03ms；每候选 13.43ms | — | b_106.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；执行科技：芬威克研究中心 1x 行动（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；放置数据（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
### T04 白色玩家

- 分数：7 → 7（0）
- 持有资源：钱 5→8(+3)，电 4→3(-1)，宣传 5→8(+3)，数据 2→2(0)，手牌 5→6(+1)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 88 | 移动火箭 3 out | V=8.50；目标=mars/land；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱0/电4/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:e0158279→choose_payment:b7a77d86；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(12候选合计) fork 179.68ms/执行 197.98ms/投影 21.59ms/估值 0.12ms；每候选 33.27ms | — | b_105.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_56.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_10.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 89 | ↳ 选择：消耗 1 能量 | V=8.50；目标=mars/land；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱0/电4/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:abbb51f1；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 14.97ms/执行 10.27ms/投影 2.10ms/估值 0.03ms；每候选 13.67ms | 电-1，宣传+1 | ↳ 选择：弃 1 张移动牌（V 8.50） |
| 90 | 移动火箭 3 in | V=8.50；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:c488b99f→choose_payment:abbb51f1；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(14候选合计) fork 379.81ms/执行 289.51ms/投影 29.05ms/估值 0.10ms；每候选 49.88ms | — | b_105.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_56.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_10.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 91 | ↳ 选择：消耗 1 能量 | V=8.50；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:abbb51f1；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 15.11ms/执行 9.67ms/投影 2ms/估值 0.03ms；每候选 13.39ms | 电-1，宣传+1 | ↳ 选择：弃 1 张移动牌（V 8.50） |
| 92 | 移动火箭 3 out | V=8；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:e0158279→choose_payment:b7a77d86；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(13候选合计) fork 201.65ms/执行 225.26ms/投影 26.23ms/估值 0.08ms；每候选 34.86ms | — | b_105.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_56.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_10.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 93 | ↳ 选择：消耗 1 能量 | V=8；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:abbb51f1；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 14.85ms/执行 9.49ms/投影 2.02ms/估值 0.02ms；每候选 13.18ms | 电-1，宣传+1 | ↳ 选择：弃 1 张移动牌（V 8） |
| 94 | PASS | 不可选；状态=unresolved；置信=low；COUNTERFACTUAL_BRANCH_LIMIT | — | b_105.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_56.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_10.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 95 | ↳ 选择：弃置 b_56.webp | V=5.50；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_card:1d9d7188；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(5候选合计) fork 30.63ms/执行 24.47ms/投影 8.98ms/估值 0.04ms；每候选 12.82ms | 手牌-1 | ↳ 选择：弃置 b_11.webp（V 5.50）；↳ 选择：弃置 dlc_1.png（V 5.50）；↳ 选择：弃置 b_10.webp（V 5.50） |
| 96 | ↳ 选择：b_78.webp | V=5.50；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_card:3174942b；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(5候选合计) fork 36.82ms/执行 29.77ms/投影 4.92ms/估值 0.04ms；每候选 14.30ms | 手牌+1 | ↳ 选择：dlc_23.png（V 5.50）；↳ 选择：b_127.webp（V 5.50）；↳ 选择：b_80.webp（V 5.50） |
| 97 | 结束回合 | V=5.50；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=end_turn:b2f9b29d；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(5候选合计) fork 42.90ms/执行 69.86ms/投影 8.87ms/估值 0.05ms；每候选 24.33ms | 钱+3，电+2，手牌+1 | 移动火箭 3 cw（不可选：not-current-probe-goal-step）；移动火箭 3 in（不可选：not-current-probe-goal-step）；移动火箭 3 ccw（不可选：not-current-probe-goal-step） |
### T05 蓝色玩家

- 分数：9 → 9（0）
- 持有资源：钱 3→2(-1)，电 3→0(-3)，宣传 3→4(+1)，数据 5→5(0)，手牌 4→4(0)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 98 | 发射 | V=26；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电4/移动5；全路线需求=钱2/电7/移动5；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电4/移动5；链=launch:a4087d46；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(5候选合计) fork 69.89ms/执行 104.87ms/投影 17.42ms/估值 0.10ms；每候选 38.44ms | 钱-1 | PASS（V 26）；dlc_25.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_128.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 99 | 移动火箭 7 ccw | V=26；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电4/移动5；全路线需求=钱1/电7/移动5；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电4/移动4；链=move:b3b8b230→choose_payment:5d7f4364；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(6候选合计) fork 40.02ms/执行 84.95ms/投影 9.37ms/估值 0.08ms；每候选 22.39ms | — | 结束回合（V 26）；dlc_25.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_128.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 100 | ↳ 选择：消耗 1 能量 | V=26；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电4/移动5；全路线需求=钱1/电7/移动5；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电4/移动4；链=choose_payment:5d7f4364；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 11.19ms/执行 4.84ms/投影 0.99ms/估值 0.02ms；每候选 17.02ms | 电-1 | — |
| 101 | 移动火箭 7 ccw | V=26；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电4/移动4；全路线需求=钱1/电6/移动4；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电4/移动3；链=move:7ea60c47→choose_payment:9c023706；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(6候选合计) fork 39.16ms/执行 81.25ms/投影 9.04ms/估值 0.06ms；每候选 21.57ms | — | 结束回合（V 26）；dlc_25.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_128.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 102 | ↳ 选择：消耗 2 能量 | V=26；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电4/移动4；全路线需求=钱1/电6/移动4；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电4/移动3；链=choose_payment:9c023706；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 11.12ms/执行 4.79ms/投影 1.27ms/估值 0.02ms；每候选 17.17ms | 电-2，宣传+1 | — |
| 103 | 结束回合 | V=23.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电4/移动3；全路线需求=钱1/电4/移动3；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电4/移动3；链=end_turn:320f2608；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(3候选合计) fork 23.98ms/执行 49.82ms/投影 6.38ms/估值 0.04ms；每候选 26.73ms | — | dlc_25.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_128.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_12.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
### T06 棕色玩家

- 分数：13 → 13（0）
- 持有资源：钱 1→5(+4)，电 1→3(+2)，宣传 9→9(0)，数据 2→2(0)，手牌 4→6(+2)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 104 | PASS | V=6；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=pass:ac4b4ab2→choose_card:9d489b26；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=pass-last-resort；耗时(7候选合计) fork 101.34ms/执行 131.74ms/投影 15.08ms/估值 0.07ms；每候选 35.45ms | — | dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_9.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_31.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 105 | ↳ 选择：b_80.webp | V=6；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_card:04d3b23b；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(4候选合计) fork 25.78ms/执行 23.13ms/投影 5.25ms/估值 0.03ms；每候选 13.54ms | 手牌+1 | ↳ 选择：b_127.webp（V 6）；↳ 选择：b_132.webp（V 6）；↳ 选择：dlc_23.png（V 6） |
| 106 | 结束回合 | V=6；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=end_turn:d59ab08c；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(4候选合计) fork 32.98ms/执行 55.02ms/投影 7ms/估值 0.05ms；每候选 23.75ms | 钱+4，电+2，手牌+1 | 移动火箭 2 ccw（不可选：not-current-probe-goal-step）；移动火箭 2 out（不可选：not-current-probe-goal-step）；移动火箭 2 cw（不可选：not-current-probe-goal-step） |
### T07 绿色玩家

- 分数：18 → 18（0）
- 持有资源：钱 2→8(+6)，电 1→1(0)，宣传 6→8(+2)，数据 2→2(0)，手牌 1→1(0)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 107 | PASS | V=26；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电5/移动4；全路线需求=钱1/电6/移动4；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电5/移动4；链=pass:ff716055→choose_card:6ea4c79f；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=pass-last-resort；耗时(3候选合计) fork 39.41ms/执行 59.17ms/投影 8.76ms/估值 0.04ms；每候选 35.78ms | — | b_106.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；执行科技：芬威克研究中心 1x 行动（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；放置数据（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 108 | ↳ 选择：b_132.webp | V=26；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电5/移动4；全路线需求=钱1/电6/移动4；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电5/移动4；链=choose_card:45c21a7e；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(3候选合计) fork 20.92ms/执行 18.70ms/投影 3ms/估值 0.03ms；每候选 14.21ms | 手牌+1 | ↳ 选择：dlc_23.png（V 26）；↳ 选择：b_127.webp（V 26） |
| 109 | 移动火箭 6 ccw | V=26；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电5/移动4；全路线需求=钱1/电6/移动4；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电4/移动3；链=move:ddd3c15f→choose_payment:9e3c21f8；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(4候选合计) fork 20.99ms/执行 41.60ms/投影 3.97ms/估值 0.04ms；每候选 16.64ms | — | 结束回合（V 26）；移动火箭 6 out（不可选：not-current-probe-goal-step）；移动火箭 6 cw（不可选：not-current-probe-goal-step） |
| 110 | ↳ 选择：弃 1 张移动牌 + 1 能量 | V=26；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电5/移动4；全路线需求=钱1/电6/移动4；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电4/移动3；链=choose_payment:9e3c21f8；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 11.11ms/执行 4.82ms/投影 0.98ms/估值 0.02ms；每候选 16.91ms | 电-1，宣传+1，手牌-1 | — |
| 111 | 结束回合 | V=23.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电4/移动3；全路线需求=钱1/电4/移动3；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电3/移动3；链=end_turn:1f65daa3；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 5.44ms/执行 10.83ms/投影 1.01ms/估值 0.02ms；每候选 17.27ms | 钱+6，电+1，宣传+1 | 放置数据（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
### T08 蓝色玩家

- 分数：9 → 9（0）
- 持有资源：钱 2→6(+4)，电 0→2(+2)，宣传 4→4(0)，数据 5→6(+1)，手牌 4→6(+2)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 112 | PASS | V=23.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电4/移动3；全路线需求=钱1/电4/移动3；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电4/移动3；链=pass:c858282e→choose_card:a0639532；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=pass-last-resort；耗时(4候选合计) fork 62.15ms/执行 90.41ms/投影 12.05ms/估值 0.06ms；每候选 41.15ms | — | dlc_25.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_128.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_12.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 113 | ↳ 选择：b_127.webp | V=23.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电4/移动3；全路线需求=钱1/电4/移动3；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电4/移动3；链=choose_card:95f3676d；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 16.52ms/执行 12.25ms/投影 2.02ms/估值 0.02ms；每候选 15.40ms | 手牌+1 | ↳ 选择：dlc_23.png（V 23.50） |
| 114 | 结束回合 | V=23.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电4/移动3；全路线需求=钱1/电4/移动3；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电2/移动3；链=end_turn:320f2608；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 5.70ms/执行 12.78ms/投影 1.01ms/估值 0.02ms；每候选 19.49ms | 钱+4，电+2，数据+1，手牌+1 | 放置数据（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |

## 第 3 轮

### T01 棕色玩家

- 分数：13 → 24（+11）
- 持有资源：钱 5→4(-1)，电 3→1(-2)，宣传 9→10(+1)，数据 2→3(+1)，手牌 6→7(+1)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 115 | 移动火箭 2 out | V=8；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:7c6adb55→choose_payment:4411819f；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(11候选合计) fork 178.81ms/执行 207.13ms/投影 27.18ms/估值 0.12ms；每候选 37.56ms | — | dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_9.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_15.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 116 | ↳ 选择：弃 1 张移动牌 | V=8；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:4411819f；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(3候选合计) fork 19.60ms/执行 14.59ms/投影 2.94ms/估值 0.03ms；每候选 12.38ms | 宣传+1，手牌-1 | ↳ 选择：弃 1 张移动牌（V 8）；↳ 选择：消耗 1 能量（V 8） |
| 117 | 移动火箭 2 out | V=21；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电0/移动2；全路线需求=钱1/电3/移动2；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动1；链=move:7c6adb55→choose_payment:f893f500；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(12候选合计) fork 342.44ms/执行 250.41ms/投影 27.29ms/估值 0.13ms；每候选 51.68ms | — | dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_9.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_15.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 118 | ↳ 选择：弃 1 张移动牌 | V=21；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电0/移动2；全路线需求=钱1/电3/移动2；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动1；链=choose_payment:e2b1c12f；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 14.92ms/执行 10.31ms/投影 2ms/估值 0.03ms；每候选 13.62ms | 手牌-1 | ↳ 选择：消耗 1 能量（V 21） |
| 119 | 移动火箭 2 out | V=21；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:7c6adb55→choose_payment:f893f500；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(10候选合计) fork 104.71ms/执行 153.57ms/投影 18.63ms/估值 0.08ms；每候选 27.69ms | — | dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_9.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_31.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 120 | ↳ 选择：消耗 1 能量 | V=21；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:f893f500；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 11.59ms/执行 4.92ms/投影 0.99ms/估值 0.02ms；每候选 17.50ms | 电-1 | — |
| 121 | 环绕天王星（R2） | V=18.50；目标=uranus/orbit；路线终点实际分=11；行动后已兑现分变化=11；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=orbit:55680308@{"realizedScore":11,"credits":-1,"energy":-1,"publicity":0,"availableData":1,"ordinaryCards":3,"alienCards":0}；叶后同目标缺口=目标已完成；链=orbit:55680308→choose_target:caf66fde；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-completed-standard-leaf；耗时(10候选合计) fork 118.61ms/执行 166.67ms/投影 20.47ms/估值 0.09ms；每候选 30.57ms | 分数+11，钱-1，电-1，手牌+3 | dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_9.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_31.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 122 | ↳ 选择：扫描 织女一 | V=23；目标=uranus/orbit；路线终点实际分=8；行动后已兑现分变化=0；缺口=钱0/电6/移动5；全路线需求=钱3/电7/移动5；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电6/移动5；链=choose_target:a2536ed6；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 23.06ms/执行 11.94ms/投影 2.36ms/估值 0.03ms；每候选 18.68ms | 数据+1 | ↳ 选择：扫描 绘架座β（V 23） |
| 123 | 结束回合 | V=23；目标=uranus/orbit；路线终点实际分=8；行动后已兑现分变化=0；缺口=钱0/电6/移动5；全路线需求=钱3/电7/移动5；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电6/移动5；链=end_turn:d59ab08c；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(3候选合计) fork 26.58ms/执行 51.88ms/投影 6.37ms/估值 0.04ms；每候选 28.28ms | — | b_17.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_9.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
### T02 绿色玩家

- 分数：18 → 18（0）
- 持有资源：钱 8→14(+6)，电 1→2(+1)，宣传 8→9(+1)，数据 2→2(0)，手牌 1→2(+1)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 124 | PASS | 不可选；状态=unresolved；置信=low；COUNTERFACTUAL_BRANCH_LIMIT | — | b_106.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；执行科技：芬威克研究中心 1x 行动（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；移动火箭 6 out（不可选：not-current-probe-goal-step） |
| 125 | ↳ 选择：b_135.webp | V=6；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_card:1a859927；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(5候选合计) fork 34.57ms/执行 30.33ms/投影 5.06ms/估值 0.04ms；每候选 13.99ms | 手牌+1 | ↳ 选择：b_112.webp（V 6）；↳ 选择：b_47.webp（V 6）；↳ 选择：b_22.webp（V 6） |
| 126 | 结束回合 | V=6；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=end_turn:1f65daa3；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(4候选合计) fork 22ms/执行 40.59ms/投影 4.34ms/估值 0.04ms；每候选 16.73ms | 钱+6，电+1，宣传+1 | 移动火箭 6 out（不可选：not-current-probe-goal-step）；移动火箭 6 ccw（不可选：not-current-probe-goal-step）；移动火箭 6 cw（不可选：not-current-probe-goal-step） |
### T03 白色玩家

- 分数：7 → 7（0）
- 持有资源：钱 8→11(+3)，电 3→3(0)，宣传 8→10(+2)，数据 2→2(0)，手牌 6→6(0)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 127 | 移动火箭 3 in | V=8.50；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:c488b99f→choose_payment:abbb51f1；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(13候选合计) fork 389.41ms/执行 265.95ms/投影 24.03ms/估值 0.14ms；每候选 52.26ms | — | b_105.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_10.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_14.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 128 | ↳ 选择：消耗 1 能量 | V=8.50；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:abbb51f1；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 15.69ms/执行 11ms/投影 2.05ms/估值 0.03ms；每候选 14.37ms | 电-1，宣传+1 | ↳ 选择：弃 1 张移动牌（V 8.50） |
| 129 | 移动火箭 3 out | V=8；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:e0158279→choose_payment:b7a77d86；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(12候选合计) fork 177.91ms/执行 199.72ms/投影 22.27ms/估值 0.08ms；每候选 33.33ms | — | b_105.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_10.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_14.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 130 | ↳ 选择：消耗 1 能量 | V=8；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:abbb51f1；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 16.26ms/执行 10.06ms/投影 2.02ms/估值 0.02ms；每候选 14.17ms | 电-1，宣传+1 | ↳ 选择：弃 1 张移动牌（V 8） |
| 131 | PASS | 不可选；状态=unresolved；置信=low；COUNTERFACTUAL_BRANCH_LIMIT | — | b_105.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_10.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_14.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 132 | ↳ 选择：弃置 b_105.webp、b_78.webp | V=5.50；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_card:0e778ce9；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(15候选合计) fork 78.98ms/执行 60.43ms/投影 27.71ms/估值 0.08ms；每候选 11.14ms | 手牌-2 | ↳ 选择：弃置 dlc_1.png、b_10.webp（V 5.50）；↳ 选择：弃置 b_11.webp、dlc_1.png（V 5.50）；↳ 选择：弃置 b_10.webp、b_14.webp（V 5.50） |
| 133 | ↳ 选择：b_22.webp | V=5.50；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_card:6a62aa8e；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(4候选合计) fork 29.64ms/执行 25.32ms/投影 3.98ms/估值 0.03ms；每候选 14.74ms | 手牌+1 | ↳ 选择：b_1.webp（V 5.50）；↳ 选择：b_112.webp（V 5.50）；↳ 选择：b_47.webp（V 5.50） |
| 134 | 结束回合 | V=5.50；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=end_turn:b2f9b29d；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(5候选合计) fork 60.01ms/执行 90.34ms/投影 13.01ms/估值 0.09ms；每候选 32.67ms | 钱+3，电+2，手牌+1 | 移动火箭 3 cw（不可选：not-current-probe-goal-step）；移动火箭 3 in（不可选：not-current-probe-goal-step）；移动火箭 3 ccw（不可选：not-current-probe-goal-step） |
### T04 蓝色玩家

- 分数：9 → 9（0）
- 持有资源：钱 6→10(+4)，电 2→3(+1)，宣传 4→5(+1)，数据 6→6(0)，手牌 6→6(0)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 135 | 移动火箭 7 out | V=8；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:6274d346→choose_payment:5d7f4364；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(12候选合计) fork 198.30ms/执行 224.26ms/投影 23.48ms/估值 0.10ms；每候选 37.17ms | — | dlc_25.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_128.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_127.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 136 | ↳ 选择：消耗 1 能量 | V=8；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:5d7f4364；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 11.66ms/执行 4.96ms/投影 1.31ms/估值 0.02ms；每候选 17.93ms | 电-1，宣传+1 | — |
| 137 | PASS | 不可选；状态=unresolved；置信=low；COUNTERFACTUAL_BRANCH_LIMIT | — | dlc_25.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_128.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_127.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 138 | ↳ 选择：弃置 dlc_25.png、b_12.webp | V=5.50；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_card:06f447a2；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(15候选合计) fork 83.15ms/执行 60.36ms/投影 27.33ms/估值 0.08ms；每候选 11.39ms | 手牌-2 | ↳ 选择：弃置 b_12.webp、b_16.webp（V 5.50）；↳ 选择：弃置 b_3.webp、b_12.webp（V 5.50）；↳ 选择：弃置 b_128.webp、b_16.webp（V 5.50） |
| 139 | ↳ 选择：b_1.webp | V=5.50；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_card:20cb0f26；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(3候选合计) fork 24.07ms/执行 19.14ms/投影 3.01ms/估值 0.03ms；每候选 15.41ms | 手牌+1 | ↳ 选择：b_112.webp（V 5.50）；↳ 选择：b_47.webp（V 5.50） |
| 140 | 结束回合 | V=5.50；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=end_turn:320f2608；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(5候选合计) fork 44.22ms/执行 71.44ms/投影 9.27ms/估值 0.05ms；每候选 24.98ms | 钱+4，电+2，手牌+1 | 移动火箭 7 in（不可选：not-current-probe-goal-step）；移动火箭 7 out（不可选：not-current-probe-goal-step）；移动火箭 7 ccw（不可选：not-current-probe-goal-step） |
### T05 棕色玩家

- 分数：24 → 24（0）
- 持有资源：钱 4→1(-3)，电 1→0(-1)，宣传 10→10(0)，数据 3→4(+1)，手牌 7→6(-1)，预留牌 0→1(+1)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 141 | 打出卡牌：b_60.webp | V=20.50；目标=uranus/orbit；路线终点实际分=8；行动后已兑现分变化=0；缺口=钱0/电5/移动4；全路线需求=钱3/电6/移动4；下一步=launch；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电5/移动4；链=play_card:d02b3f50；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-gap-reduced-by-standard-leaf；耗时(8候选合计) fork 104.01ms/执行 137.06ms/投影 15.52ms/估值 0.07ms；每候选 32.07ms | 钱-3，数据+1，手牌-1，预留牌+1 | 发射（V 20.50）；b_17.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 142 | 移动火箭 8 out | V=20.50；目标=uranus/orbit；路线终点实际分=8；行动后已兑现分变化=0；缺口=钱0/电5/移动4；全路线需求=钱1/电6/移动4；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电5/移动3；链=move:baaab89b→choose_payment:f893f500；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(5候选合计) fork 40.17ms/执行 74.96ms/投影 8.31ms/估值 0.05ms；每候选 24.69ms | — | 结束回合（V 20.50）；b_17.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 143 | ↳ 选择：消耗 1 能量 | V=20.50；目标=uranus/orbit；路线终点实际分=8；行动后已兑现分变化=0；缺口=钱0/电5/移动4；全路线需求=钱1/电6/移动4；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电5/移动3；链=choose_payment:f893f500；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 11.60ms/执行 5.39ms/投影 1.01ms/估值 0.02ms；每候选 17.99ms | 电-1 | — |
| 144 | 结束回合 | V=20.50；目标=uranus/orbit；路线终点实际分=8；行动后已兑现分变化=0；缺口=钱0/电5/移动3；全路线需求=钱1/电5/移动3；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电5/移动3；链=end_turn:d59ab08c；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(2候选合计) fork 25.28ms/执行 44.38ms/投影 5.41ms/估值 0.03ms；每候选 37.53ms | — | b_17.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_9.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
### T06 棕色玩家

- 分数：24 → 24（0）
- 持有资源：钱 1→5(+4)，电 0→2(+2)，宣传 10→10(0)，数据 4→4(0)，手牌 6→6(0)，预留牌 1→1(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 145 | PASS | 不可选；状态=unresolved；置信=low；COUNTERFACTUAL_BRANCH_LIMIT | — | b_17.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_9.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 146 | ↳ 选择：弃置 b_31.webp、b_9.webp | V=20.50；目标=uranus/orbit；路线终点实际分=8；行动后已兑现分变化=0；缺口=钱0/电5/移动3；全路线需求=钱1/电5/移动3；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电5/移动3；链=choose_card:11089c5a；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(15候选合计) fork 83.34ms/执行 60.52ms/投影 27.36ms/估值 0.11ms；每候选 11.41ms | 手牌-2 | ↳ 选择：弃置 dlc_24.png、b_31.webp（V 20.50）；↳ 选择：弃置 b_31.webp、b_17.webp（V 20.50）；↳ 选择：弃置 b_9.webp、b_35.webp（V 20.50） |
| 147 | ↳ 选择：b_112.webp | V=20.50；目标=uranus/orbit；路线终点实际分=8；行动后已兑现分变化=0；缺口=钱0/电5/移动3；全路线需求=钱1/电5/移动3；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电5/移动3；链=choose_card:a673a243；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 19.51ms/执行 12.12ms/投影 2.01ms/估值 0.03ms；每候选 16.82ms | 手牌+1 | ↳ 选择：b_47.webp（V 20.50） |
| 148 | 结束回合 | V=20.50；目标=uranus/orbit；路线终点实际分=8；行动后已兑现分变化=0；缺口=钱0/电5/移动3；全路线需求=钱1/电5/移动3；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电3/移动3；链=end_turn:d59ab08c；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 5.52ms/执行 13.32ms/投影 1.03ms/估值 0.02ms；每候选 19.86ms | 钱+4，电+2，手牌+1 | 放置数据（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |

## 第 4 轮

### T01 绿色玩家

- 分数：18 → 18（0）
- 持有资源：钱 14→14(0)，电 2→1(-1)，宣传 9→10(+1)，数据 2→2(0)，手牌 2→2(0)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 149 | 移动火箭 6 out | V=8；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:41d48368→choose_payment:56560af3；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(10候选合计) fork 92.10ms/执行 146.07ms/投影 16.63ms/估值 0.12ms；每候选 25.48ms | — | PASS（V 8）；b_135.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_106.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 150 | ↳ 选择：消耗 1 能量 | V=8；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:56560af3；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 11.63ms/执行 5.04ms/投影 1ms/估值 0.02ms；每候选 17.67ms | 电-1，宣传+1 | — |
| 151 | PASS | V=5.50；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=pass:ff716055；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=pass-last-resort；耗时(10候选合计) fork 191.31ms/执行 180.21ms/投影 16.15ms/估值 0.09ms；每候选 38.77ms | — | b_135.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_106.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；执行科技：芬威克研究中心 1x 行动（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 152 | 结束回合 | V=5.50；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=end_turn:1f65daa3；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(5候选合计) fork 28.64ms/执行 50.31ms/投影 5.30ms/估值 0.04ms；每候选 16.85ms | — | 移动火箭 6 out（不可选：not-current-probe-goal-step）；移动火箭 6 ccw（不可选：not-current-probe-goal-step）；移动火箭 6 cw（不可选：not-current-probe-goal-step） |
### T02 白色玩家

- 分数：7 → 7（0）
- 持有资源：钱 11→11(0)，电 3→1(-2)，宣传 10→10(0)，数据 2→2(0)，手牌 6→5(-1)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 153 | 移动火箭 3 in | V=8.50；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:c488b99f→choose_payment:abbb51f1；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(13候选合计) fork 404.87ms/执行 270.81ms/投影 25.98ms/估值 0.11ms；每候选 53.97ms | — | PASS（V 8.50）；b_10.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_14.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 154 | ↳ 选择：弃 1 张移动牌 | V=8.50；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:95c38abc；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(3候选合计) fork 20.39ms/执行 15.23ms/投影 4.25ms/估值 0.03ms；每候选 13.29ms | 手牌-1 | ↳ 选择：消耗 1 能量（V 8.50）；↳ 选择：弃 1 张移动牌（V 8.50） |
| 155 | 移动火箭 3 out | V=8；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:e0158279→choose_payment:b7a77d86；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(12候选合计) fork 175.19ms/执行 183.45ms/投影 20.62ms/估值 0.14ms；每候选 31.60ms | — | PASS（V 8）；b_10.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_14.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 156 | ↳ 选择：消耗 1 能量 | V=8；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:abbb51f1；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 16.36ms/执行 10.54ms/投影 2.11ms/估值 0.03ms；每候选 14.51ms | 电-1 | ↳ 选择：弃 1 张移动牌（V 8） |
| 157 | 移动火箭 3 in | V=8.50；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:c488b99f→choose_payment:abbb51f1；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(12候选合计) fork 348.84ms/执行 223.09ms/投影 18.98ms/估值 0.09ms；每候选 49.24ms | — | PASS（V 8.50）；b_10.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_14.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 158 | ↳ 选择：消耗 1 能量 | V=8.50；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:abbb51f1；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 15.54ms/执行 10.82ms/投影 2.04ms/估值 0.03ms；每候选 14.21ms | 电-1 | ↳ 选择：弃 1 张移动牌（V 8.50） |
| 159 | PASS | V=6；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=pass:a1f33c73；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=pass-last-resort；耗时(11候选合计) fork 158.34ms/执行 162.22ms/投影 17ms/估值 0.08ms；每候选 30.69ms | — | b_10.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_14.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_18.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 160 | 结束回合 | V=6；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=end_turn:b2f9b29d；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(4候选合计) fork 33.89ms/执行 56.97ms/投影 7.09ms/估值 0.05ms；每候选 24.49ms | — | 移动火箭 3 cw（不可选：not-current-probe-goal-step）；移动火箭 3 ccw（不可选：not-current-probe-goal-step）；移动火箭 3 out（不可选：not-current-probe-goal-step） |
### T03 蓝色玩家

- 分数：9 → 9（0）
- 持有资源：钱 10→10(0)，电 3→1(-2)，宣传 5→8(+3)，数据 6→6(0)，手牌 6→5(-1)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 161 | 移动火箭 7 in | V=8.50；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:2ed2cb88→choose_payment:3193e6f5；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(12候选合计) fork 364.28ms/执行 241.96ms/投影 22.50ms/估值 0.13ms；每候选 52.40ms | — | PASS（V 8.50）；b_128.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_19.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 162 | ↳ 选择：弃 1 张移动牌 | V=8.50；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:3193e6f5；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 15.80ms/执行 10.19ms/投影 2.72ms/估值 0.03ms；每候选 14.35ms | 宣传+1，手牌-1 | ↳ 选择：消耗 1 能量（V 8.50） |
| 163 | 移动火箭 7 out | V=8；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:6274d346→choose_payment:5d7f4364；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(11候选合计) fork 135.48ms/执行 156.85ms/投影 15.48ms/估值 0.09ms；每候选 27.98ms | — | PASS（V 8）；b_128.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_19.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 164 | ↳ 选择：消耗 1 能量 | V=8；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:5d7f4364；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 11.41ms/执行 5.58ms/投影 1.02ms/估值 0.02ms；每候选 18.01ms | 电-1，宣传+1 | — |
| 165 | 移动火箭 7 in | V=8.50；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:2ed2cb88→choose_payment:5d7f4364；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(11候选合计) fork 300.82ms/执行 204.45ms/投影 15.01ms/估值 0.11ms；每候选 47.30ms | — | PASS（V 8.50）；b_128.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_19.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 166 | ↳ 选择：消耗 1 能量 | V=8.50；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:5d7f4364；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 12.13ms/执行 5.05ms/投影 1.01ms/估值 0.02ms；每候选 18.20ms | 电-1，宣传+1 | — |
| 167 | PASS | V=6；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=pass:c858282e；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=pass-last-resort；耗时(10候选合计) fork 123.28ms/执行 142.87ms/投影 13.82ms/估值 0.08ms；每候选 28ms | — | b_128.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_19.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_127.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 168 | 结束回合 | V=6；目标=venus/orbit；路线终点实际分=6；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=end_turn:320f2608；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(4候选合计) fork 21.54ms/执行 41.47ms/投影 4.05ms/估值 0.04ms；每候选 16.77ms | — | 移动火箭 7 out（不可选：not-current-probe-goal-step）；移动火箭 7 ccw（不可选：not-current-probe-goal-step）；移动火箭 7 cw（不可选：not-current-probe-goal-step） |
### T04 棕色玩家

- 分数：24 → 24（0）
- 持有资源：钱 5→1(-4)，电 2→1(-1)，宣传 10→10(0)，数据 4→4(0)，手牌 6→6(0)，预留牌 1→1(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 169 | 2信用点 → 1能量 | V=20.50；目标=uranus/orbit；路线终点实际分=8；行动后已兑现分变化=0；缺口=钱0/电3/移动3；全路线需求=钱1/电5/移动3；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电2/移动3；链=quick_trade:5ad269c5；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-gap-reduced-by-standard-leaf；耗时(10候选合计) fork 75.18ms/执行 136.04ms/投影 16.14ms/估值 0.11ms；每候选 22.74ms | 钱-2，电+1 | 移动火箭 8 out（V 20.50）；PASS（V 20.50）；b_17.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 170 | 2信用点 → 1能量 | V=20.50；目标=uranus/orbit；路线终点实际分=8；行动后已兑现分变化=0；缺口=钱0/电2/移动3；全路线需求=钱1/电5/移动3；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电1/移动3；链=quick_trade:5ad269c5；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-gap-reduced-by-standard-leaf；耗时(10候选合计) fork 74.27ms/执行 132.77ms/投影 16.67ms/估值 0.09ms；每候选 22.37ms | 钱-2，电+1 | 移动火箭 8 out（V 20.50）；PASS（V 20.50）；b_17.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 171 | 移动火箭 8 ccw | V=8；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动2；全路线需求=钱1/电4/移动2；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动1；链=move:8339be9a→choose_payment:015c7b42；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(8候选合计) fork 71.40ms/执行 118.97ms/投影 13.60ms/估值 0.08ms；每候选 25.50ms | — | PASS（V 8）；b_17.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 172 | ↳ 选择：消耗 2 能量 | V=8；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动2；全路线需求=钱1/电4/移动2；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动1；链=choose_payment:015c7b42；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 11.30ms/执行 5.14ms/投影 1ms/估值 0.02ms；每候选 17.44ms | 电-2 | — |
| 173 | 移动火箭 8 ccw | V=8；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=move:f4211899→choose_payment:f893f500；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=probe-goal-route-advanced；耗时(8候选合计) fork 93.34ms/执行 117.86ms/投影 14.88ms/估值 0.09ms；每候选 28.26ms | — | PASS（V 8）；b_17.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 174 | ↳ 选择：消耗 1 能量 | V=8；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动1；全路线需求=钱1/电2/移动1；下一步=move；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=choose_payment:f893f500；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 11.53ms/执行 4.99ms/投影 1.02ms/估值 0.02ms；每候选 17.54ms | 电-1 | — |
| 175 | PASS | V=5.50；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=钱0/电0/移动0；链=pass:ac4b4ab2；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=pass-last-resort；耗时(9候选合计) fork 318.33ms/执行 183.04ms/投影 13.49ms/估值 0.06ms；每候选 57.21ms | — | b_17.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；dlc_24.png：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED）；b_112.webp：弃牌角标（不可选：PROBE_POLICY_SCOPE_EXCLUDED） |
| 176 | 结束回合 | V=5.50；目标=mars/orbit；路线终点实际分=3；行动后已兑现分变化=0；缺口=钱0/电0/移动0；全路线需求=钱1/电1/移动0；下一步=orbit；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后同目标缺口=目标已完成或不再可用；链=end_turn:d59ab08c；字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(5候选合计) fork 28.67ms/执行 54.22ms/投影 4.82ms/估值 0.06ms；每候选 17.54ms | — | 移动火箭 8 in（不可选：not-current-probe-goal-step）；移动火箭 8 cw（不可选：not-current-probe-goal-step）；移动火箭 8 out（不可选：not-current-probe-goal-step） |

## 各席探测器目标与资源用途

| 机器人 | 已执行目标 | 最后路线缺口 | 路线下一步 | 探测器实际得分 | 剩余钱/电用途 |
| --- | --- | --- | --- | ---: | --- |
| 棕色玩家 | venus/orbit、venus/land、uranus/orbit、mars/orbit | 钱0/电0/移动0 | orbit | 16 | 钱1/电1：仅供后续可解析探测器路线补缺 |
| 绿色玩家 | uranus/orbit、venus/orbit、mars/orbit | 钱0/电0/移动0 | orbit | 9 | 钱14/电1：仅供后续可解析探测器路线补缺 |
| 蓝色玩家 | venus/orbit、venus/land、uranus/orbit、mars/orbit | 钱0/电0/移动0 | orbit | 5 | 钱10/电1：仅供后续可解析探测器路线补缺 |
| 白色玩家 | venus/orbit、mars/land、mars/orbit | 钱0/电0/移动0 | orbit | 0 | 钱11/电1：仅供后续可解析探测器路线补缺 |

## 最终分数、目标差距与剩余资源

| 名次 | 机器人 | 总分 | 实局增长 | 距 100 分 | 钱 | 电 | 宣传 | 数据 | 手牌 | 预留牌 |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 棕色玩家 | 24 | +24 | -76 | 1 | 1 | 10 | 4 | 6 | 1 |
| 2 | 绿色玩家 | 18 | +18 | -82 | 14 | 1 | 10 | 2 | 2 | 0 |
| 3 | 蓝色玩家 | 9 | +9 | -91 | 10 | 1 | 8 | 6 | 5 | 0 |
| 4 | 白色玩家 | 7 | +7 | -93 | 11 | 1 | 10 | 2 | 5 | 0 |
