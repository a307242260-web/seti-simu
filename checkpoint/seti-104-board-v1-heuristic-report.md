# seti-104-board-v1 机器人逐回合行动报告

- seed：`seti-104-official-v1`
- board fingerprint：`cdf383576d8143dfc94422115b4dfdb48fc3aa8a5c1722015737031283e29db4`
- Policy 决策数：108
- 游戏回合数：20
- 决策口径：本阶段只实现探测器目标；只选择有正分标准终点叶的发射/移动/环绕/登陆下一步，资源仅用于展示路线实耗和缺口，不折算统一 V/Q
- 诊断目标：初次接触玩家约 100 分；最终表同时列出各机器人的目标差距
- 固定反例：R1 T04 绿色登陆土星按 `land -> choose_target(yellow trace)` 标准链展开；成本、地点奖励、首黄宣传及 alienCard 均取实际 root/leaf 字段，不复制规则常数
- 字段边界：projection 只保留最多两枚探测器位置和当前候选的 next action、沿途宣传、终点 outcome 引用及标准 delta；完整 checkpoint 不进入 Policy DTO

## 开局待决选择

- 白色玩家：↳ 选择：语言学分析
- 白色玩家：↳ 选择：dlc_26.png
- 蓝色玩家：↳ 选择：b_104.webp
- 蓝色玩家：↳ 选择：b_126.webp
- 棕色玩家：↳ 选择：b_129.webp
- 棕色玩家：↳ 选择：b_99.webp
- 棕色玩家：↳ 选择：b_134.webp
- 绿色玩家：↳ 选择：b_130.webp
- 绿色玩家：↳ 选择：b_22.webp
- 绿色玩家：↳ 选择：b_30.webp

## 自动诊断摘要

- 20 个玩家回合中，13 个回合没有获得分数。
- 78 个已解析的非结束决策中，42 个与至少一个备选目标同分，53 个不是正分探测器目标步骤。
- 实际提交行动族：pass=20，choose_card=12，research_tech=3，launch=7，move=12，choose_payment=12，land=6，choose_target=6，end_turn=20；表格主列均为实际提交，备选列仅为未提交的反事实候选。
- 性能：路线 checkpoint 上限=6；每候选平均 20.67ms、最大 40.30ms；候选集整步最大 564.20ms，超过 1s 会立即中止整局。

## 第 1 轮

### T01 白色玩家

- 分数：6 → 6（0）
- 持有资源：钱 5→9(+4)，电 3→4(+1)，宣传 4→4(0)，数据 3→3(0)，手牌 3→5(+2)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 11 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:a1f33c73→choose_card:ec9d04d4；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(5候选合计) fork 43.68ms/执行 110.41ms/投影 4.86ms/估值 0.08ms；每候选 31.79ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step）；发射（不可选：probe-goal-no-positive-endpoint） |
| 12 | ↳ 选择：dlc_24.png | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：dlc_24.png；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_card:4708c91c；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(5候选合计) fork 30.45ms/执行 30.88ms/投影 2.28ms/估值 0.03ms；每候选 12.72ms | 手牌+1 | ↳ 选择：b_12.webp（目标分 0）；↳ 选择：b_117.webp（目标分 0）；↳ 选择：b_24.webp（目标分 0） |
| 13 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:b2f9b29d；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 4.67ms/执行 8.96ms/投影 0.47ms/估值 0.01ms；每候选 14.10ms | 钱+4，电+1，手牌+1 | — |
### T02 蓝色玩家

- 分数：9 → 11（+2）
- 持有资源：钱 4→6(+2)，电 3→6(+3)，宣传 6→0(-6)，数据 0→0(0)，手牌 4→7(+3)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 14 | 研究 orange3 | 目标=补探测器橙色科技缺口(+1)；目标已兑现分=0；当前标准叶实际分差=2；缺口=—；全路线实耗=—；下一步=研究 orange3；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=research_tech:517b2872；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-route-orange-tech-gap；耗时(30候选合计) fork 63.68ms/执行 310.53ms/投影 16.24ms/估值 0.12ms；每候选 13.01ms | 分数+2，电+1，宣传-6 | 研究 orange1（目标分 0）；研究 orange4（目标分 0）；研究 orange2（目标分 0） |
| 15 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:c858282e→choose_card:10304ac6；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(6候选合计) fork 39.27ms/执行 107.25ms/投影 5.49ms/估值 0.03ms；每候选 25.33ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 16 | ↳ 选择：b_128.webp | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：b_128.webp；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_card:10304ac6；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(4候选合计) fork 25.74ms/执行 24.52ms/投影 1.84ms/估值 0.02ms；每候选 13.03ms | 手牌+1 | ↳ 选择：b_24.webp（目标分 0）；↳ 选择：b_117.webp（目标分 0）；↳ 选择：b_12.webp（目标分 0） |
| 17 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:320f2608；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 4.83ms/执行 8.25ms/投影 0.47ms/估值 0.01ms；每候选 13.55ms | 钱+2，电+2，手牌+2 | — |
### T03 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 5→9(+4)，电 3→4(+1)，宣传 3→3(0)，数据 2→2(0)，手牌 4→7(+3)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 18 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:ac4b4ab2→choose_card:bc063520；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(6候选合计) fork 41.88ms/执行 119.41ms/投影 5.18ms/估值 0.03ms；每候选 27.74ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step） |
| 19 | ↳ 选择：b_117.webp | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：b_117.webp；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_card:bc063520；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(3候选合计) fork 21.96ms/执行 18.62ms/投影 1.39ms/估值 0.02ms；每候选 13.99ms | 手牌+1 | ↳ 选择：b_24.webp（目标分 0）；↳ 选择：b_12.webp（目标分 0） |
| 20 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:d59ab08c；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 4.92ms/执行 8.45ms/投影 0.47ms/估值 0.01ms；每候选 13.84ms | 钱+4，电+1，手牌+2 | — |
### T04 绿色玩家

- 分数：10 → 15（+5）
- 持有资源：钱 5→5(0)，电 5→3(-2)，宣传 3→5(+2)，数据 0→2(+2)，手牌 4→6(+2)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 21 | 发射 | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动2；全路线实耗=钱2/电5/移动2；下一步=发射；状态=settled/low；沿途宣传=2@move:b3c8bb56→choose_payment:9938c7f8→land:d1c172e3→choose_target:2c385295；终点标准叶=land:d1c172e3@{"realizedScore":5,"credits":0,"energy":-3,"publicity":1,"availableData":2,"ordinaryCards":0,"alienCards":1}；叶后资源=钱3/电0（仅供后续路线补缺，不折算 V/Q）；链=launch:70d77c1b→move:b3c8bb56→choose_payment:9938c7f8→move:b3c8bb56→choose_payment:9938c7f8→land:d1c172e3→choose_target:2c385295；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(6候选合计) fork 58.82ms/执行 165.85ms/投影 6.73ms/估值 0.03ms；每候选 38.57ms | 钱-2 | PASS（目标分 0）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 22 | 移动火箭 4 ccw | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动1；全路线实耗=钱0/电5/移动2；下一步=移动火箭 4 ccw；状态=settled/low；沿途宣传=2@move:b3c8bb56→choose_payment:9938c7f8→land:d1c172e3→choose_target:2c385295；终点标准叶=land:d1c172e3@{"realizedScore":5,"credits":0,"energy":-3,"publicity":1,"availableData":2,"ordinaryCards":0,"alienCards":1}；叶后资源=钱3/电0（仅供后续路线补缺，不折算 V/Q）；链=move:b3c8bb56→choose_payment:9938c7f8→move:b3c8bb56→choose_payment:9938c7f8→land:d1c172e3→choose_target:2c385295；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(6候选合计) fork 57.34ms/执行 158.59ms/投影 6.27ms/估值 0.04ms；每候选 37.03ms | — | PASS（目标分 0）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 23 | ↳ 选择：消耗 1 能量 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：消耗 1 能量；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_payment:9938c7f8；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 14.86ms/执行 8.52ms/投影 0.48ms/估值 0.01ms；每候选 23.86ms | 电-1 | — |
| 24 | 移动火箭 4 ccw | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动0；全路线实耗=钱0/电4/移动1；下一步=移动火箭 4 ccw；状态=settled/low；沿途宣传=1@land:d1c172e3→choose_target:2c385295；终点标准叶=land:d1c172e3@{"realizedScore":5,"credits":0,"energy":-3,"publicity":1,"availableData":2,"ordinaryCards":0,"alienCards":1}；叶后资源=钱3/电0（仅供后续路线补缺，不折算 V/Q）；链=move:b3c8bb56→choose_payment:9938c7f8→land:d1c172e3→choose_target:2c385295；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(6候选合计) fork 52.81ms/执行 152.39ms/投影 5.77ms/估值 0.04ms；每候选 35.16ms | — | PASS（目标分 0）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 25 | ↳ 选择：消耗 1 能量 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：消耗 1 能量；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_payment:9938c7f8；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 12.68ms/执行 6.65ms/投影 0.50ms/估值 0.01ms；每候选 19.83ms | 电-1，宣传+1 | — |
| 26 | 登陆金星（主星，R4，3能量） | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动0；全路线实耗=钱0/电3/移动0；下一步=登陆金星（主星，R4，3能量）；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=land:d1c172e3@{"realizedScore":5,"credits":0,"energy":-3,"publicity":1,"availableData":2,"ordinaryCards":0,"alienCards":1}；叶后资源=钱3/电0（仅供后续路线补缺，不折算 V/Q）；链=land:d1c172e3→choose_target:2c385295；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(8候选合计) fork 46.12ms/执行 125.26ms/投影 5.21ms/估值 0.04ms；每候选 22.07ms | 分数+5，电-3，数据+2 | PASS（目标分 0）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 27 | ↳ 选择：外星人1：yellow痕迹 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：外星人1：yellow痕迹；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_target:2c385295；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 15.26ms/执行 12.09ms/投影 0.94ms/估值 0.01ms；每候选 14.14ms | 宣传+1 | ↳ 选择：外星人2：yellow痕迹（目标分 0） |
| 28 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:ff716055→choose_card:8d52fb62；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(6候选合计) fork 20.27ms/执行 65.55ms/投影 3.54ms/估值 0.04ms；每候选 14.89ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step） |
| 29 | ↳ 选择：b_12.webp | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：b_12.webp；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_card:03718679；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 19.49ms/执行 14.17ms/投影 1.08ms/估值 0.02ms；每候选 17.37ms | 手牌+1 | ↳ 选择：b_24.webp（目标分 0） |
| 30 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:1f65daa3；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 4.88ms/执行 9.62ms/投影 0.56ms/估值 0.01ms；每候选 15.05ms | 钱+2，电+3，手牌+1 | — |

## 第 2 轮

### T01 蓝色玩家

- 分数：11 → 11（0）
- 持有资源：钱 6→8(+2)，电 6→8(+2)，宣传 0→0(0)，数据 0→0(0)，手牌 7→10(+3)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 31 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:c858282e→choose_card:481577ed；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(9候选合计) fork 50.79ms/执行 134.42ms/投影 6.72ms/估值 0.04ms；每候选 21.33ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 32 | ↳ 选择：b_112.webp | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：b_112.webp；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_card:0c82af4f；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(5候选合计) fork 32.32ms/执行 32.33ms/投影 2.45ms/估值 0.02ms；每候选 13.42ms | 手牌+1 | ↳ 选择：b_118.webp（目标分 0）；↳ 选择：b_52.webp（目标分 0）；↳ 选择：b_107.webp（目标分 0） |
| 33 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:320f2608；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 4.71ms/执行 8.91ms/投影 0.51ms/估值 0.01ms；每候选 14.13ms | 钱+2，电+2，手牌+2 | — |
### T02 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 9→13(+4)，电 4→5(+1)，宣传 3→3(0)，数据 2→2(0)，手牌 7→10(+3)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 34 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:ac4b4ab2→choose_card:16d1974a；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(9候选合计) fork 57.45ms/执行 162.82ms/投影 6.94ms/估值 0.03ms；每候选 25.24ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step） |
| 35 | ↳ 选择：b_52.webp | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：b_52.webp；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_card:16d1974a；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(4候选合计) fork 27.24ms/执行 26.04ms/投影 1.94ms/估值 0.02ms；每候选 13.81ms | 手牌+1 | ↳ 选择：b_107.webp（目标分 0）；↳ 选择：b_60.webp（目标分 0）；↳ 选择：b_118.webp（目标分 0） |
| 36 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:d59ab08c；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 5.08ms/执行 8.69ms/投影 0.50ms/估值 0.01ms；每候选 14.27ms | 钱+4，电+1，手牌+2 | — |
### T03 绿色玩家

- 分数：15 → 15（0）
- 持有资源：钱 5→7(+2)，电 3→6(+3)，宣传 5→5(0)，数据 2→2(0)，手牌 6→8(+2)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 37 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:ff716055→choose_card:63d06eb4；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(8候选合计) fork 46.78ms/执行 144.05ms/投影 6.49ms/估值 0.15ms；每候选 24.66ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 38 | ↳ 选择：b_107.webp | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：b_107.webp；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_card:63d06eb4；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(3候选合计) fork 23.66ms/执行 19.70ms/投影 1.45ms/估值 0.02ms；每候选 14.94ms | 手牌+1 | ↳ 选择：b_60.webp（目标分 0）；↳ 选择：b_118.webp（目标分 0） |
| 39 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:1f65daa3；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 4.80ms/执行 9.03ms/投影 0.51ms/估值 0.01ms；每候选 14.34ms | 钱+2，电+3，手牌+1 | — |
### T04 白色玩家

- 分数：6 → 6（0）
- 持有资源：钱 9→13(+4)，电 4→5(+1)，宣传 4→4(0)，数据 3→3(0)，手牌 5→7(+2)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 40 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:a1f33c73→choose_card:0660c4b6；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(7候选合计) fork 46.04ms/执行 131.50ms/投影 4.97ms/估值 0.03ms；每候选 26.07ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 41 | ↳ 选择：b_118.webp | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：b_118.webp；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_card:0660c4b6；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 17.67ms/执行 13.46ms/投影 0.99ms/估值 0.01ms；每候选 16.06ms | 手牌+1 | ↳ 选择：b_60.webp（目标分 0） |
| 42 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:b2f9b29d；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 4.70ms/执行 8.94ms/投影 0.49ms/估值 0.01ms；每候选 14.13ms | 钱+4，电+1，手牌+1 | — |

## 第 3 轮

### T01 棕色玩家

- 分数：8 → 13（+5）
- 持有资源：钱 13→15(+2)，电 5→1(-4)，宣传 3→4(+1)，数据 2→4(+2)，手牌 10→13(+3)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 43 | 发射 | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动2；全路线实耗=钱2/电5/移动2；下一步=发射；状态=settled/low；沿途宣传=1@move:25a61302→choose_payment:d008d903；终点标准叶=land:508e9443@{"realizedScore":5,"credits":0,"energy":-3,"publicity":0,"availableData":2,"ordinaryCards":0,"alienCards":0}；叶后资源=钱11/电0（仅供后续路线补缺，不折算 V/Q）；链=launch:c1616852→move:25a61302→choose_payment:d008d903→move:25a61302→choose_payment:d008d903→land:508e9443→choose_target:2f6b4fb8；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(12候选合计) fork 84.49ms/执行 232.69ms/投影 10.34ms/估值 0.05ms；每候选 27.29ms | 钱-2 | PASS（目标分 0）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step） |
| 44 | 移动火箭 5 ccw | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动1；全路线实耗=钱0/电5/移动2；下一步=移动火箭 5 ccw；状态=settled/low；沿途宣传=1@move:25a61302→choose_payment:d008d903；终点标准叶=land:508e9443@{"realizedScore":5,"credits":0,"energy":-3,"publicity":0,"availableData":2,"ordinaryCards":0,"alienCards":0}；叶后资源=钱11/电0（仅供后续路线补缺，不折算 V/Q）；链=move:25a61302→choose_payment:d008d903→move:25a61302→choose_payment:d008d903→land:508e9443→choose_target:2f6b4fb8；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(12候选合计) fork 124.14ms/执行 312.58ms/投影 15.02ms/估值 0.07ms；每候选 37.64ms | — | PASS（目标分 0）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step） |
| 45 | ↳ 选择：消耗 1 能量 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：消耗 1 能量；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_payment:d008d903；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 13.45ms/执行 8.90ms/投影 0.51ms/估值 0.01ms；每候选 22.86ms | 电-1 | — |
| 46 | 移动火箭 5 ccw | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动0；全路线实耗=钱0/电4/移动1；下一步=移动火箭 5 ccw；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=land:508e9443@{"realizedScore":5,"credits":0,"energy":-3,"publicity":0,"availableData":2,"ordinaryCards":0,"alienCards":0}；叶后资源=钱11/电0（仅供后续路线补缺，不折算 V/Q）；链=move:25a61302→choose_payment:d008d903→land:508e9443→choose_target:2f6b4fb8；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(12候选合计) fork 115.57ms/执行 298.49ms/投影 13.98ms/估值 0.08ms；每候选 35.67ms | — | PASS（目标分 0）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step） |
| 47 | ↳ 选择：消耗 1 能量 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：消耗 1 能量；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_payment:d008d903；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 13.79ms/执行 7.14ms/投影 0.52ms/估值 0.01ms；每候选 21.44ms | 电-1，宣传+1 | — |
| 48 | 登陆金星（主星，R5，3能量） | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动0；全路线实耗=钱0/电3/移动0；下一步=登陆金星（主星，R5，3能量）；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=land:508e9443@{"realizedScore":5,"credits":0,"energy":-3,"publicity":0,"availableData":2,"ordinaryCards":0,"alienCards":0}；叶后资源=钱11/电0（仅供后续路线补缺，不折算 V/Q）；链=land:508e9443→choose_target:2f6b4fb8；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(14候选合计) fork 109.29ms/执行 272.66ms/投影 13.21ms/估值 0.07ms；每候选 28.23ms | 分数+5，电-3，数据+2 | PASS（目标分 0）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step） |
| 49 | ↳ 选择：外星人1：yellow痕迹 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：外星人1：yellow痕迹；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_target:2f6b4fb8；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 15.82ms/执行 12.45ms/投影 1.35ms/估值 0.01ms；每候选 14.81ms | — | ↳ 选择：外星人2：yellow痕迹（目标分 0） |
| 50 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:ac4b4ab2→choose_card:abb36657；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(12候选合计) fork 42.10ms/执行 123.53ms/投影 6.74ms/估值 0.05ms；每候选 14.36ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step） |
| 51 | ↳ 选择：b_33.webp | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：b_33.webp；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_card:44ad8ed9；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(5候选合计) fork 33.55ms/执行 32.86ms/投影 2.51ms/估值 0.02ms；每候选 13.78ms | 手牌+1 | ↳ 选择：dlc_37.png（目标分 0）；↳ 选择：b_63.webp（目标分 0）；↳ 选择：b_110.webp（目标分 0） |
| 52 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:d59ab08c；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 4.93ms/执行 9.18ms/投影 0.51ms/估值 0.01ms；每候选 14.62ms | 钱+4，电+1，手牌+2 | — |
### T02 绿色玩家

- 分数：15 → 25（+10）
- 持有资源：钱 7→7(0)，电 6→4(-2)，宣传 5→0(-5)，数据 2→4(+2)，手牌 8→10(+2)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 53 | 发射 | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动2；全路线实耗=钱2/电5/移动2；下一步=发射；状态=settled/low；沿途宣传=2@move:88e3c0fc→choose_payment:9938c7f8→land:456ae115→choose_target:f7462680；终点标准叶=land:456ae115@{"realizedScore":5,"credits":0,"energy":-3,"publicity":1,"availableData":2,"ordinaryCards":0,"alienCards":1}；叶后资源=钱5/电1（仅供后续路线补缺，不折算 V/Q）；链=launch:70d77c1b→move:88e3c0fc→choose_payment:9938c7f8→move:88e3c0fc→choose_payment:9938c7f8→land:456ae115→choose_target:f7462680；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(10候选合计) fork 78.33ms/执行 227.43ms/投影 10.56ms/估值 0.05ms；每候选 31.63ms | 钱-2 | PASS（目标分 0）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step） |
| 54 | 移动火箭 6 ccw | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动1；全路线实耗=钱0/电5/移动2；下一步=移动火箭 6 ccw；状态=settled/low；沿途宣传=1@move:88e3c0fc→choose_payment:9938c7f8；终点标准叶=land:456ae115@{"realizedScore":5,"credits":0,"energy":-3,"publicity":0,"availableData":2,"ordinaryCards":0,"alienCards":0}；叶后资源=钱5/电1（仅供后续路线补缺，不折算 V/Q）；链=move:88e3c0fc→choose_payment:9938c7f8→move:88e3c0fc→choose_payment:9938c7f8→land:456ae115→choose_target:2c385295；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(10候选合计) fork 91.78ms/执行 246.20ms/投影 12.85ms/估值 0.05ms；每候选 35.08ms | — | PASS（目标分 0）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step） |
| 55 | ↳ 选择：消耗 1 能量 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：消耗 1 能量；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_payment:9938c7f8；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 13.72ms/执行 9.61ms/投影 0.52ms/估值 0.01ms；每候选 23.86ms | 电-1 | — |
| 56 | 移动火箭 6 ccw | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动0；全路线实耗=钱0/电4/移动1；下一步=移动火箭 6 ccw；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=land:456ae115@{"realizedScore":5,"credits":0,"energy":-3,"publicity":0,"availableData":2,"ordinaryCards":0,"alienCards":0}；叶后资源=钱5/电1（仅供后续路线补缺，不折算 V/Q）；链=move:88e3c0fc→choose_payment:9938c7f8→land:456ae115→choose_target:2c385295；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(10候选合计) fork 76.61ms/执行 240.34ms/投影 9.74ms/估值 0.06ms；每候选 32.67ms | — | PASS（目标分 0）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step） |
| 57 | ↳ 选择：消耗 1 能量 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：消耗 1 能量；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_payment:9938c7f8；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 13.74ms/执行 7.50ms/投影 0.51ms/估值 0.01ms；每候选 21.76ms | 电-1，宣传+1 | — |
| 58 | 登陆金星（主星，R6，3能量） | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动0；全路线实耗=钱0/电3/移动0；下一步=登陆金星（主星，R6，3能量）；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=land:456ae115@{"realizedScore":5,"credits":0,"energy":-3,"publicity":1,"availableData":2,"ordinaryCards":0,"alienCards":1}；叶后资源=钱5/电1（仅供后续路线补缺，不折算 V/Q）；链=land:456ae115→choose_target:f7462680；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(36候选合计) fork 97.06ms/执行 430.77ms/投影 21.97ms/估值 0.12ms；每候选 15.27ms | 分数+5，电-3，数据+2 | 研究 orange1（目标分 0）；研究 orange4（目标分 0）；研究 orange2（目标分 0） |
| 59 | ↳ 选择：外星人1：yellow痕迹 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：外星人1：yellow痕迹；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_target:2c385295；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 15.78ms/执行 13.12ms/投影 1.01ms/估值 0.01ms；每候选 14.96ms | — | ↳ 选择：外星人2：yellow痕迹（目标分 0） |
| 60 | 研究 orange1 | 目标=补探测器橙色科技缺口(+1)；目标已兑现分=0；当前标准叶实际分差=5；缺口=—；全路线实耗=—；下一步=研究 orange1；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=research_tech:5a80cef7；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-route-orange-tech-gap；耗时(34候选合计) fork 61.44ms/执行 333.13ms/投影 19.06ms/估值 0.11ms；每候选 12.17ms | 分数+5，宣传-6 | 研究 orange4（目标分 0）；研究 orange2（目标分 0）；研究 orange3（目标分 0） |
| 61 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:ff716055→choose_card:f7f24460；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(10候选合计) fork 34.94ms/执行 114.85ms/投影 6.64ms/估值 0.04ms；每候选 15.64ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 62 | ↳ 选择：dlc_37.png | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：dlc_37.png；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_card:445d5eac；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(4候选合计) fork 28.89ms/执行 26.88ms/投影 2.43ms/估值 0.02ms；每候选 14.55ms | 手牌+1 | ↳ 选择：b_63.webp（目标分 0）；↳ 选择：b_110.webp（目标分 0）；↳ 选择：b_40.webp（目标分 0） |
| 63 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:1f65daa3；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 5.37ms/执行 9.91ms/投影 0.53ms/估值 0.01ms；每候选 15.81ms | 钱+2，电+3，手牌+1 | — |
### T03 白色玩家

- 分数：6 → 13（+7）
- 持有资源：钱 13→15(+2)，电 5→1(-4)，宣传 4→1(-3)，数据 3→5(+2)，手牌 7→9(+2)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 64 | 发射 | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动2；全路线实耗=钱2/电5/移动2；下一步=发射；状态=settled/low；沿途宣传=1@move:82d88955→choose_payment:31e55dce；终点标准叶=land:107147dc@{"realizedScore":5,"credits":0,"energy":-3,"publicity":0,"availableData":2,"ordinaryCards":0,"alienCards":0}；叶后资源=钱11/电0（仅供后续路线补缺，不折算 V/Q）；链=launch:c94cda79→move:82d88955→choose_payment:31e55dce→move:82d88955→choose_payment:31e55dce→land:107147dc→choose_target:5f7c0323；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(9候选合计) fork 73.34ms/执行 207.73ms/投影 8.95ms/估值 0.04ms；每候选 32.23ms | 钱-2 | PASS（目标分 0）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 65 | 移动火箭 7 ccw | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动1；全路线实耗=钱0/电5/移动2；下一步=移动火箭 7 ccw；状态=settled/low；沿途宣传=2@move:82d88955→choose_payment:31e55dce→land:107147dc→choose_target:489729aa；终点标准叶=land:107147dc@{"realizedScore":5,"credits":0,"energy":-3,"publicity":1,"availableData":2,"ordinaryCards":0,"alienCards":1}；叶后资源=钱11/电0（仅供后续路线补缺，不折算 V/Q）；链=move:82d88955→choose_payment:31e55dce→move:82d88955→choose_payment:31e55dce→land:107147dc→choose_target:489729aa；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(9候选合计) fork 98.35ms/执行 247.87ms/投影 10.87ms/估值 0.05ms；每候选 39.68ms | — | PASS（目标分 0）；弃牌换1移动（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 66 | ↳ 选择：消耗 1 能量 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：消耗 1 能量；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_payment:31e55dce；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 13.68ms/执行 9.03ms/投影 0.54ms/估值 0.01ms；每候选 23.26ms | 电-1 | — |
| 67 | 移动火箭 7 ccw | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动0；全路线实耗=钱0/电4/移动1；下一步=移动火箭 7 ccw；状态=settled/low；沿途宣传=1@land:107147dc→choose_target:489729aa；终点标准叶=land:107147dc@{"realizedScore":5,"credits":0,"energy":-3,"publicity":1,"availableData":2,"ordinaryCards":0,"alienCards":1}；叶后资源=钱11/电0（仅供后续路线补缺，不折算 V/Q）；链=move:82d88955→choose_payment:31e55dce→land:107147dc→choose_target:489729aa；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(9候选合计) fork 91.53ms/执行 238.05ms/投影 10.63ms/估值 0.07ms；每候选 37.80ms | — | PASS（目标分 0）；弃牌换1移动（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 68 | ↳ 选择：消耗 1 能量 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：消耗 1 能量；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_payment:31e55dce；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 13.88ms/执行 7.29ms/投影 0.52ms/估值 0.01ms；每候选 21.70ms | 电-1，宣传+1 | — |
| 69 | 登陆金星（主星，R7，3能量） | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动0；全路线实耗=钱0/电3/移动0；下一步=登陆金星（主星，R7，3能量）；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=land:107147dc@{"realizedScore":5,"credits":0,"energy":-3,"publicity":1,"availableData":2,"ordinaryCards":0,"alienCards":1}；叶后资源=钱11/电0（仅供后续路线补缺，不折算 V/Q）；链=land:107147dc→choose_target:489729aa；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(11候选合计) fork 85.09ms/执行 216.35ms/投影 9.96ms/估值 0.05ms；每候选 28.31ms | 分数+5，电-3，数据+2 | PASS（目标分 0）；弃牌换1移动（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 70 | ↳ 选择：外星人2：yellow痕迹 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：外星人2：yellow痕迹；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_target:489729aa；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 16.49ms/执行 13.29ms/投影 1.03ms/估值 0.01ms；每候选 15.40ms | 宣传+1 | ↳ 选择：外星人1：yellow痕迹（目标分 0） |
| 71 | 研究 orange4 | 目标=补探测器橙色科技缺口(+1)；目标已兑现分=0；当前标准叶实际分差=2；缺口=—；全路线实耗=—；下一步=研究 orange4；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=research_tech:4cf7ce10；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-route-orange-tech-gap；耗时(33候选合计) fork 57.27ms/执行 315.41ms/投影 17.07ms/估值 0.14ms；每候选 11.81ms | 分数+2，宣传-5 | 研究 orange2（目标分 0）；研究 orange1（目标分 0）；研究 orange3（目标分 0） |
| 72 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:a1f33c73→choose_card:90794832；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(9候选合计) fork 30.78ms/执行 97.96ms/投影 4.90ms/估值 0.04ms；每候选 14.85ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 73 | ↳ 选择：b_110.webp | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：b_110.webp；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_card:90794832；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(3候选合计) fork 25.37ms/执行 22.55ms/投影 1.67ms/估值 0.02ms；每候选 16.53ms | 手牌+1 | ↳ 选择：b_40.webp（目标分 0）；↳ 选择：b_63.webp（目标分 0） |
| 74 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:b2f9b29d；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 5.36ms/执行 9.74ms/投影 0.53ms/估值 0.01ms；每候选 15.64ms | 钱+4，电+1，手牌+1 | — |
### T04 蓝色玩家

- 分数：11 → 11（0）
- 持有资源：钱 8→10(+2)，电 8→10(+2)，宣传 0→0(0)，数据 0→0(0)，手牌 10→13(+3)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 75 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:c858282e→choose_card:80907762；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(12候选合计) fork 42.93ms/执行 151.42ms/投影 7.02ms/估值 0.04ms；每候选 16.78ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 76 | ↳ 选择：b_40.webp | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：b_40.webp；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_card:6d9c86a3；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 18.84ms/执行 15.13ms/投影 1.15ms/估值 0.02ms；每候选 17.56ms | 手牌+1 | ↳ 选择：b_63.webp（目标分 0） |
| 77 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:320f2608；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 5.38ms/执行 10.28ms/投影 0.58ms/估值 0.01ms；每候选 16.24ms | 钱+2，电+2，手牌+2 | — |

## 第 4 轮

### T01 绿色玩家

- 分数：25 → 25（0）
- 持有资源：钱 7→9(+2)，电 4→7(+3)，宣传 0→0(0)，数据 4→4(0)，手牌 10→11(+1)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 78 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:ff716055；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(12候选合计) fork 46.06ms/执行 193.28ms/投影 8.90ms/估值 0.05ms；每候选 20.69ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step） |
| 79 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:1f65daa3；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 5.47ms/执行 9.20ms/投影 0.53ms/估值 0.01ms；每候选 15.20ms | 钱+2，电+3，手牌+1 | — |
### T02 白色玩家

- 分数：13 → 13（0）
- 持有资源：钱 15→19(+4)，电 1→2(+1)，宣传 1→1(0)，数据 5→5(0)，手牌 9→10(+1)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 80 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:a1f33c73；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(11候选合计) fork 23.12ms/执行 107.76ms/投影 5.01ms/估值 0.04ms；每候选 12.35ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 81 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:b2f9b29d；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 5.11ms/执行 9.74ms/投影 0.54ms/估值 0.01ms；每候选 15.39ms | 钱+4，电+1，手牌+1 | — |
### T03 蓝色玩家

- 分数：11 → 18（+7）
- 持有资源：钱 10→10(0)，电 10→7(-3)，宣传 0→1(+1)，数据 0→2(+2)，手牌 13→15(+2)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 82 | 发射 | 目标=jupiter/land；目标已兑现分=7；当前标准叶实际分差=7；缺口=钱0/电0/移动2；全路线实耗=钱2/电5/移动2；下一步=发射；状态=settled/low；沿途宣传=1@move:d70638dd→choose_payment:08ce11f7；终点标准叶=land:51b3867c@{"realizedScore":7,"credits":0,"energy":-2,"publicity":0,"availableData":2,"ordinaryCards":0,"alienCards":0}；叶后资源=钱8/电5（仅供后续路线补缺，不折算 V/Q）；链=launch:a4087d46→move:bdc22ebc→choose_payment:08ce11f7→move:d70638dd→choose_payment:08ce11f7→land:51b3867c→choose_target:c1253ec9；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(15候选合计) fork 45.28ms/执行 171.93ms/投影 7.54ms/估值 0.05ms；每候选 14.98ms | 钱-2 | PASS（目标分 0）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 83 | 移动火箭 8 out | 目标=jupiter/land；目标已兑现分=7；当前标准叶实际分差=7；缺口=钱0/电0/移动1；全路线实耗=钱0/电5/移动2；下一步=移动火箭 8 out；状态=settled/low；沿途宣传=1@move:d70638dd→choose_payment:08ce11f7；终点标准叶=land:51b3867c@{"realizedScore":7,"credits":0,"energy":-2,"publicity":0,"availableData":2,"ordinaryCards":0,"alienCards":0}；叶后资源=钱8/电5（仅供后续路线补缺，不折算 V/Q）；链=move:bdc22ebc→choose_payment:08ce11f7→move:d70638dd→choose_payment:08ce11f7→land:51b3867c→choose_target:07f08ac4；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(15候选合计) fork 135.61ms/执行 321.22ms/投影 15.76ms/估值 0.10ms；每候选 31.51ms | — | PASS（目标分 0）；弃牌换1移动（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 84 | ↳ 选择：消耗 1 能量 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：消耗 1 能量；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_payment:08ce11f7；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 14.20ms/执行 9.22ms/投影 0.55ms/估值 0.01ms；每候选 23.98ms | 电-1 | — |
| 85 | 移动火箭 8 out | 目标=jupiter/land；目标已兑现分=7；当前标准叶实际分差=7；缺口=钱0/电0/移动0；全路线实耗=钱0/电4/移动1；下一步=移动火箭 8 out；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=land:51b3867c@{"realizedScore":7,"credits":0,"energy":-2,"publicity":0,"availableData":2,"ordinaryCards":0,"alienCards":0}；叶后资源=钱8/电5（仅供后续路线补缺，不折算 V/Q）；链=move:d70638dd→choose_payment:08ce11f7→land:51b3867c→choose_target:07f08ac4；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(15候选合计) fork 126.57ms/执行 330ms/投影 17.56ms/估值 0.10ms；每候选 31.61ms | — | PASS（目标分 0）；弃牌换1移动（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 86 | ↳ 选择：消耗 2 能量 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：消耗 2 能量；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_payment:08ce11f7；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 14.18ms/执行 7.27ms/投影 0.54ms/估值 0.01ms；每候选 21.98ms | 电-2，宣传+1 | — |
| 87 | 登陆木星（主星，R8，2能量） | 目标=jupiter/land；目标已兑现分=7；当前标准叶实际分差=7；缺口=钱0/电0/移动0；全路线实耗=钱0/电2/移动0；下一步=登陆木星（主星，R8，2能量）；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=land:51b3867c@{"realizedScore":7,"credits":0,"energy":-2,"publicity":0,"availableData":2,"ordinaryCards":0,"alienCards":0}；叶后资源=钱8/电5（仅供后续路线补缺，不折算 V/Q）；链=land:51b3867c→choose_target:07f08ac4；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(16候选合计) fork 120.36ms/执行 303.24ms/投影 17.08ms/估值 0.09ms；每候选 27.54ms | 分数+7，电-2，数据+2 | PASS（目标分 0）；弃牌换1移动（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 88 | ↳ 选择：外星人1：yellow痕迹 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：外星人1：yellow痕迹；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_target:07f08ac4；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 16.81ms/执行 13.48ms/投影 1.07ms/估值 0.02ms；每候选 15.68ms | — | ↳ 选择：外星人2：yellow痕迹（目标分 0） |
| 89 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:c858282e；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(15候选合计) fork 21.79ms/执行 114.65ms/投影 5.64ms/估值 0.04ms；每候选 9.47ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 90 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:320f2608；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 5.16ms/执行 9.36ms/投影 0.54ms/估值 0.01ms；每候选 15.06ms | 钱+2，电+2，手牌+2 | — |
### T04 棕色玩家

- 分数：13 → 13（0）
- 持有资源：钱 15→19(+4)，电 1→2(+1)，宣传 4→4(0)，数据 4→4(0)，手牌 13→15(+2)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 91 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:ac4b4ab2；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(15候选合计) fork 28.39ms/执行 144.55ms/投影 7.04ms/估值 0.05ms；每候选 12ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step） |
| 92 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:d59ab08c；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 5.42ms/执行 9.85ms/投影 0.54ms/估值 0.01ms；每候选 15.82ms | 钱+4，电+1，手牌+2 | — |

## 第 5 轮

### T01 白色玩家

- 分数：13 → 13（0）
- 持有资源：钱 19→23(+4)，电 2→3(+1)，宣传 1→1(0)，数据 5→5(0)，手牌 10→11(+1)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 93 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:a1f33c73；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(12候选合计) fork 24.78ms/执行 116.92ms/投影 5.49ms/估值 0.05ms；每候选 12.27ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 94 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:b2f9b29d；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 5.24ms/执行 9.85ms/投影 0.56ms/估值 0.01ms；每候选 15.65ms | 钱+4，电+1，手牌+1 | — |
### T02 蓝色玩家

- 分数：18 → 18（0）
- 持有资源：钱 10→12(+2)，电 7→9(+2)，宣传 1→1(0)，数据 2→2(0)，手牌 15→17(+2)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 95 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:c858282e；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(17候选合计) fork 37.42ms/执行 174.53ms/投影 7.73ms/估值 0.07ms；每候选 12.92ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 96 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:320f2608；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 5.58ms/执行 9.56ms/投影 0.55ms/估值 0.01ms；每候选 15.69ms | 钱+2，电+2，手牌+2 | — |
### T03 棕色玩家

- 分数：13 → 13（0）
- 持有资源：钱 19→23(+4)，电 2→3(+1)，宣传 4→4(0)，数据 4→4(0)，手牌 15→17(+2)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 97 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:ac4b4ab2；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(17候选合计) fork 30.55ms/执行 168.03ms/投影 8.56ms/估值 0.07ms；每候选 12.18ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step） |
| 98 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:d59ab08c；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 5.31ms/执行 10.07ms/投影 0.56ms/估值 0.01ms；每候选 15.94ms | 钱+4，电+1，手牌+2 | — |
### T04 绿色玩家

- 分数：25 → 30（+5）
- 持有资源：钱 9→7(-2)，电 7→4(-3)，宣传 0→1(+1)，数据 4→6(+2)，手牌 11→12(+1)，预留牌 0→0(0)

| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 99 | 发射 | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动2；全路线实耗=钱2/电6/移动2；下一步=发射；状态=settled/low；沿途宣传=1@move:1c915102→choose_payment:9938c7f8；终点标准叶=land:409976f4@{"realizedScore":5,"credits":0,"energy":-3,"publicity":0,"availableData":2,"ordinaryCards":0,"alienCards":0}；叶后资源=钱7/电1（仅供后续路线补缺，不折算 V/Q）；链=launch:70d77c1b→move:6e38f7d1→choose_payment:9938c7f8→move:1c915102→choose_payment:9938c7f8→land:409976f4→choose_target:2c385295；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(13候选合计) fork 66.19ms/执行 241.08ms/投影 10.57ms/估值 0.06ms；每候选 24.45ms | 钱-2 | PASS（目标分 0）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 100 | 发射 | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动2；全路线实耗=钱2/电6/移动2；下一步=发射；状态=settled/low；沿途宣传=1@move:133d4012→choose_payment:9938c7f8；终点标准叶=land:e3ebaea8@{"realizedScore":5,"credits":0,"energy":-3,"publicity":0,"availableData":2,"ordinaryCards":0,"alienCards":0}；叶后资源=钱5/电1（仅供后续路线补缺，不折算 V/Q）；链=launch:70d77c1b→move:16a57b3f→choose_payment:9938c7f8→move:133d4012→choose_payment:9938c7f8→land:e3ebaea8→choose_target:2c385295；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(14候选合计) fork 132.82ms/执行 414ms/投影 17.38ms/估值 0.06ms；每候选 40.30ms | 钱-2 | 移动火箭 9 ccw（目标分 5）；PASS（目标分 0）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 101 | 移动火箭 10 ccw | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动1；全路线实耗=钱0/电6/移动2；下一步=移动火箭 10 ccw；状态=settled/low；沿途宣传=1@move:133d4012→choose_payment:9938c7f8；终点标准叶=land:e3ebaea8@{"realizedScore":5,"credits":0,"energy":-3,"publicity":0,"availableData":2,"ordinaryCards":0,"alienCards":0}；叶后资源=钱5/电1（仅供后续路线补缺，不折算 V/Q）；链=move:16a57b3f→choose_payment:9938c7f8→move:133d4012→choose_payment:9938c7f8→land:e3ebaea8→choose_target:2c385295；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(13候选合计) fork 101.02ms/执行 315.90ms/投影 14.72ms/估值 0.06ms；每候选 33.20ms | — | PASS（目标分 0）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 102 | ↳ 选择：消耗 1 能量 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：消耗 1 能量；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_payment:9938c7f8；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 15.14ms/执行 9.60ms/投影 0.59ms/估值 0.01ms；每候选 25.33ms | 电-1 | — |
| 103 | 移动火箭 10 ccw | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动0；全路线实耗=钱0/电5/移动1；下一步=移动火箭 10 ccw；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=land:e3ebaea8@{"realizedScore":5,"credits":0,"energy":-3,"publicity":0,"availableData":2,"ordinaryCards":0,"alienCards":0}；叶后资源=钱5/电1（仅供后续路线补缺，不折算 V/Q）；链=move:133d4012→choose_payment:9938c7f8→land:e3ebaea8→choose_target:f7462680；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(13候选合计) fork 96.57ms/执行 319.80ms/投影 14.84ms/估值 0.06ms；每候选 33.17ms | — | PASS（目标分 0）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 104 | ↳ 选择：消耗 2 能量 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：消耗 2 能量；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_payment:9938c7f8；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(1候选合计) fork 15.04ms/执行 8.28ms/投影 0.58ms/估值 0.01ms；每候选 23.90ms | 电-2，宣传+1 | — |
| 105 | 登陆金星（主星，R10，3能量） | 目标=venus/land；目标已兑现分=5；当前标准叶实际分差=5；缺口=钱0/电0/移动0；全路线实耗=钱0/电3/移动0；下一步=登陆金星（主星，R10，3能量）；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=land:e3ebaea8@{"realizedScore":5,"credits":0,"energy":-3,"publicity":0,"availableData":2,"ordinaryCards":0,"alienCards":0}；叶后资源=钱5/电1（仅供后续路线补缺，不折算 V/Q）；链=land:e3ebaea8→choose_target:f7462680；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=probe-goal-standard-route；耗时(15候选合计) fork 90.44ms/执行 288.99ms/投影 13.93ms/估值 0.08ms；每候选 26.22ms | 分数+5，电-3，数据+2 | PASS（目标分 0）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step） |
| 106 | ↳ 选择：外星人1：yellow痕迹 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=↳ 选择：外星人1：yellow痕迹；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=choose_target:2c385295；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=required-standard-decision；耗时(2候选合计) fork 18.63ms/执行 14.57ms/投影 1.16ms/估值 0.02ms；每候选 17.18ms | — | ↳ 选择：外星人2：yellow痕迹（目标分 0） |
| 107 | PASS | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=PASS；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=pass:ff716055；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=pass-last-resort；耗时(13候选合计) fork 35.04ms/执行 158.55ms/投影 9.07ms/估值 0.09ms；每候选 15.59ms | — | 弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1宣传（不可选：not-current-probe-goal-step）；弃牌换1移动（不可选：not-current-probe-goal-step） |
| 108 | 结束回合 | 目标=无；目标已兑现分=0；当前标准叶实际分差=0；缺口=—；全路线实耗=—；下一步=结束回合；状态=settled/low；沿途宣传=0@无（不计分）；终点标准叶=无@{}；叶后资源=无探测器用途；链=end_turn:1f65daa3；字段=outcomeProjection.scoring.realizedScore/progress.probeRoute.candidate；依据=end-turn-no-probe-step；耗时(1候选合计) fork 5.71ms/执行 10.81ms/投影 0.60ms/估值 0.01ms；每候选 17.11ms | 钱+2，电+3，手牌+1 | — |

## 各席探测器目标与资源用途

| 机器人 | 已执行目标 | 最后路线缺口 | 路线下一步 | 探测器实际得分 | 剩余钱/电用途 |
| --- | --- | --- | --- | ---: | --- |
| 绿色玩家 | venus/land | 钱0/电0/移动0 | 登陆金星（主星，R10，3能量） | 15 | 钱7/电4：仅供后续可解析探测器路线补缺 |
| 蓝色玩家 | jupiter/land | 钱0/电0/移动0 | 登陆木星（主星，R8，2能量） | 7 | 钱12/电9：仅供后续可解析探测器路线补缺 |
| 棕色玩家 | venus/land | 钱0/电0/移动0 | 登陆金星（主星，R5，3能量） | 5 | 钱23/电3：仅供后续可解析探测器路线补缺 |
| 白色玩家 | venus/land | 钱0/电0/移动0 | 登陆金星（主星，R7，3能量） | 5 | 钱23/电3：仅供后续可解析探测器路线补缺 |

## 最终分数、目标差距与剩余资源

| 名次 | 机器人 | 总分 | 实局增长 | 距 100 分 | 钱 | 电 | 宣传 | 数据 | 手牌 | 预留牌 |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 绿色玩家 | 30 | +20 | -70 | 7 | 4 | 1 | 6 | 12 | 0 |
| 2 | 蓝色玩家 | 18 | +9 | -82 | 12 | 9 | 1 | 2 | 17 | 0 |
| 3 | 棕色玩家 | 13 | +5 | -87 | 23 | 3 | 4 | 4 | 17 | 0 |
| 4 | 白色玩家 | 13 | +7 | -87 | 23 | 3 | 1 | 5 | 11 | 0 |
