# seti-104-board-v1 机器人逐回合行动报告

- seed：`seti-104-official-v1`
- board fingerprint：`594527b1b87b844363eaf62bb675fb615132c6416b5336be389051a37dda81ba`
- Policy 决策数：130
- 游戏回合数：20
- 价值口径：本阶段只实现探测器路线；`Q_probe=当前动作真实标准结算价值+同一路线剩余真实净收益`，不按路线长度折价，不给 PASS/无关动作挂路线值
- 诊断目标：初次接触玩家约 100 分；最终表同时列出各机器人的目标差距
- 固定反例：R1 T04 绿色登陆土星按 `land -> choose_target(yellow trace)` 标准链展开；成本、地点奖励、首黄宣传及 alienCard 均取实际 root/leaf 字段，不复制规则常数
- 字段边界：projection 只保留最多两枚探测器位置和当前候选的 next action、沿途宣传、终点 outcome 引用及标准 delta；完整 checkpoint 不进入 Policy DTO

## 开局待决选择

- 白色玩家：↳ 选择：语言学分析
- 白色玩家：↳ 选择：dlc_26.png
- 棕色玩家：↳ 选择：b_129.webp
- 棕色玩家：↳ 选择：b_73.webp
- 棕色玩家：↳ 选择：b_134.webp
- 绿色玩家：↳ 选择：dlc_38.png
- 绿色玩家：↳ 选择：b_130.webp

## 自动诊断摘要

- 20 个玩家回合中，15 个回合没有获得分数。
- 103 个可计算 Q 的非结束决策中，68 个与至少一个备选动作同分，77 个选中动作的 Q 不大于 0；这两项可直接定位估值区分度不足。
- 实际提交行动族：pass=20，choose_card=12，card_corner=24，launch=9，move=14，choose_payment=14，land=5，choose_target=5，end_turn=20；表格主列均为实际提交，备选列仅为未提交的反事实候选。
- 性能：路线 checkpoint 上限=6；每候选平均 18.08ms、最大 35.09ms；候选集整步最大 815.31ms，超过 1s 会立即中止整局。

## 第 1 轮

### T01 白色玩家

- 分数：6 → 6（0）
- 持有资源：钱 5→9(+4)，电 3→4(+1)，宣传 4→4(0)，数据 3→3(0)，手牌 3→5(+2)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 8 | PASS | Vroot=71；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=73.50；沿途宣传=0@无；终点即时=无@{}；链=pass:a1f33c73→choose_card:ec9d04d4；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(5候选合计) fork 41.65ms/执行 102.23ms/投影 4.54ms/估值 0.07ms；每候选 29.68ms | — | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；发射 (0) |
| 9 | ↳ 选择：dlc_24.png | Vroot=71；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=73.50；沿途宣传=0@无；终点即时=无@{}；链=choose_card:4708c91c；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(5候选合计) fork 28.76ms/执行 29.71ms/投影 2.20ms/估值 0.04ms；每候选 12.13ms | 手牌+1 | ↳ 选择：b_12.webp (2.50)；↳ 选择：b_117.webp (2.50)；↳ 选择：b_24.webp (2.50) |
| 10 | 结束回合 | Vroot=73.50；当前动作实际delta=27.50；剩余路线净收益=0；Q_probe=—；排序Q=27.50；状态=settled/low；Vleaf=101；沿途宣传=0@无；终点即时=无@{}；链=end_turn:b2f9b29d；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 4.38ms/执行 9.94ms/投影 0.45ms/估值 0.02ms；每候选 14.77ms | 钱+4，电+1，手牌+1 | — |
### T02 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 3→6(+3)，电 2→3(+1)，宣传 10→10(0)，数据 2→2(0)，手牌 4→6(+2)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 11 | PASS | Vroot=72；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=74.50；沿途宣传=0@无；终点即时=无@{}；链=pass:c858282e→choose_card:10304ac6；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(30候选合计) fork 56.66ms/执行 290.06ms/投影 15.52ms/估值 0.22ms；每候选 12.08ms | — | 弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50) |
| 12 | ↳ 选择：b_128.webp | Vroot=72；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=74.50；沿途宣传=0@无；终点即时=无@{}；链=choose_card:10304ac6；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(4候选合计) fork 26.23ms/执行 25.85ms/投影 1.88ms/估值 0.03ms；每候选 13.49ms | 手牌+1 | ↳ 选择：b_24.webp (2.50)；↳ 选择：b_117.webp (2.50)；↳ 选择：b_12.webp (2.50) |
| 13 | 结束回合 | Vroot=74.50；当前动作实际delta=22.50；剩余路线净收益=0；Q_probe=—；排序Q=22.50；状态=settled/low；Vleaf=97；沿途宣传=0@无；终点即时=无@{}；链=end_turn:320f2608；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 4.85ms/执行 8.11ms/投影 0.47ms/估值 0.01ms；每候选 13.44ms | 钱+3，电+1，手牌+1 | — |
### T03 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 4→7(+3)，电 4→6(+2)，宣传 3→3(0)，数据 2→2(0)，手牌 4→7(+3)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 14 | PASS | Vroot=70.50；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=73；沿途宣传=0@无；终点即时=无@{}；链=pass:ac4b4ab2→choose_card:bc063520；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(6候选合计) fork 39.82ms/执行 117.61ms/投影 4.98ms/估值 0.05ms；每候选 27.07ms | — | 弃牌换1宣传 (0)；弃牌换1移动 (0)；弃牌换1宣传 (0) |
| 15 | ↳ 选择：b_117.webp | Vroot=70.50；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=73；沿途宣传=0@无；终点即时=无@{}；链=choose_card:bc063520；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(3候选合计) fork 20.29ms/执行 17.95ms/投影 1.35ms/估值 0.03ms；每候选 13.20ms | 手牌+1 | ↳ 选择：b_24.webp (2.50)；↳ 选择：b_12.webp (2.50) |
| 16 | 结束回合 | Vroot=73；当前动作实际delta=30；剩余路线净收益=0；Q_probe=—；排序Q=30；状态=settled/low；Vleaf=103；沿途宣传=0@无；终点即时=无@{}；链=end_turn:d59ab08c；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 4.29ms/执行 8.28ms/投影 0.41ms/估值 0.01ms；每候选 12.99ms | 钱+3，电+2，手牌+2 | — |
### T04 绿色玩家

- 分数：10 → 10（0）
- 持有资源：钱 5→7(+2)，电 5→9(+4)，宣传 3→3(0)，数据 0→1(+1)，手牌 4→6(+2)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 17 | PASS | Vroot=77.50；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=80；沿途宣传=0@无；终点即时=无@{}；链=pass:ff716055→choose_card:8d52fb62；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(6候选合计) fork 41.46ms/执行 126.07ms/投影 5.06ms/估值 0.06ms；每候选 28.77ms | — | 弃牌换1移动 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 18 | ↳ 选择：b_12.webp | Vroot=77.50；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=80；沿途宣传=0@无；终点即时=无@{}；链=choose_card:03718679；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(2候选合计) fork 16.34ms/执行 12.59ms/投影 0.95ms/估值 0.02ms；每候选 14.94ms | 手牌+1 | ↳ 选择：b_24.webp (2.50) |
| 19 | 结束回合 | Vroot=80；当前动作实际delta=35；剩余路线净收益=0；Q_probe=—；排序Q=35；状态=settled/low；Vleaf=115；沿途宣传=0@无；终点即时=无@{}；链=end_turn:1f65daa3；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 4.46ms/执行 8.70ms/投影 0.47ms/估值 0.01ms；每候选 13.63ms | 钱+2，电+4，数据+1，手牌+1 | — |

## 第 2 轮

### T01 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 6→9(+3)，电 3→4(+1)，宣传 10→10(0)，数据 2→2(0)，手牌 6→8(+2)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 20 | PASS | Vroot=97；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=99.50；沿途宣传=0@无；终点即时=无@{}；链=pass:c858282e→choose_card:481577ed；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(32候选合计) fork 70.57ms/执行 331.09ms/投影 19.06ms/估值 0.20ms；每候选 13.15ms | — | 弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50) |
| 21 | ↳ 选择：b_112.webp | Vroot=97；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=99.50；沿途宣传=0@无；终点即时=无@{}；链=choose_card:0c82af4f；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(5候选合计) fork 29.99ms/执行 31.20ms/投影 2.34ms/估值 0.03ms；每候选 12.71ms | 手牌+1 | ↳ 选择：b_118.webp (2.50)；↳ 选择：b_52.webp (2.50)；↳ 选择：b_107.webp (2.50) |
| 22 | 结束回合 | Vroot=99.50；当前动作实际delta=22.50；剩余路线净收益=0；Q_probe=—；排序Q=22.50；状态=settled/low；Vleaf=122；沿途宣传=0@无；终点即时=无@{}；链=end_turn:320f2608；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 4.61ms/执行 8.07ms/投影 0.47ms/估值 0.01ms；每候选 13.15ms | 钱+3，电+1，手牌+1 | — |
### T02 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 7→10(+3)，电 6→8(+2)，宣传 3→3(0)，数据 2→2(0)，手牌 7→10(+3)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 23 | PASS | Vroot=103；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=105.50；沿途宣传=0@无；终点即时=无@{}；链=pass:ac4b4ab2→choose_card:16d1974a；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(9候选合计) fork 68.84ms/执行 188.59ms/投影 8.04ms/估值 0.05ms；每候选 29.50ms | — | 弃牌换1宣传 (0)；弃牌换1移动 (0)；弃牌换1移动 (0) |
| 24 | ↳ 选择：b_52.webp | Vroot=103；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=105.50；沿途宣传=0@无；终点即时=无@{}；链=choose_card:16d1974a；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(4候选合计) fork 26.06ms/执行 24.97ms/投影 1.89ms/估值 0.03ms；每候选 13.23ms | 手牌+1 | ↳ 选择：b_107.webp (2.50)；↳ 选择：b_60.webp (2.50)；↳ 选择：b_118.webp (2.50) |
| 25 | 结束回合 | Vroot=105.50；当前动作实际delta=30；剩余路线净收益=0；Q_probe=—；排序Q=30；状态=settled/low；Vleaf=135.50；沿途宣传=0@无；终点即时=无@{}；链=end_turn:d59ab08c；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 4.71ms/执行 8.51ms/投影 0.47ms/估值 0.01ms；每候选 13.70ms | 钱+3，电+2，手牌+2 | — |
### T03 绿色玩家

- 分数：10 → 10（0）
- 持有资源：钱 7→9(+2)，电 9→13(+4)，宣传 3→3(0)，数据 1→2(+1)，手牌 6→8(+2)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 26 | PASS | Vroot=115；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=117.50；沿途宣传=0@无；终点即时=无@{}；链=pass:ff716055→choose_card:63d06eb4；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(8候选合计) fork 72.79ms/执行 199.44ms/投影 8.51ms/估值 0.04ms；每候选 35.09ms | — | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 27 | ↳ 选择：b_107.webp | Vroot=115；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=117.50；沿途宣传=0@无；终点即时=无@{}；链=choose_card:63d06eb4；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(3候选合计) fork 22.31ms/执行 18.85ms/投影 1.42ms/估值 0.02ms；每候选 14.19ms | 手牌+1 | ↳ 选择：b_60.webp (2.50)；↳ 选择：b_118.webp (2.50) |
| 28 | 结束回合 | Vroot=117.50；当前动作实际delta=35；剩余路线净收益=0；Q_probe=—；排序Q=35；状态=settled/low；Vleaf=152.50；沿途宣传=0@无；终点即时=无@{}；链=end_turn:1f65daa3；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 4.74ms/执行 8.31ms/投影 0.48ms/估值 0.01ms；每候选 13.53ms | 钱+2，电+4，数据+1，手牌+1 | — |
### T04 白色玩家

- 分数：6 → 6（0）
- 持有资源：钱 9→13(+4)，电 4→5(+1)，宣传 4→4(0)，数据 3→3(0)，手牌 5→7(+2)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 29 | PASS | Vroot=101；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=103.50；沿途宣传=0@无；终点即时=无@{}；链=pass:a1f33c73→choose_card:0660c4b6；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(7候选合计) fork 44.87ms/执行 128.68ms/投影 4.78ms/估值 0.04ms；每候选 25.48ms | — | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 30 | ↳ 选择：b_118.webp | Vroot=101；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=103.50；沿途宣传=0@无；终点即时=无@{}；链=choose_card:0660c4b6；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(2候选合计) fork 17.28ms/执行 12.62ms/投影 0.98ms/估值 0.02ms；每候选 15.44ms | 手牌+1 | ↳ 选择：b_60.webp (2.50) |
| 31 | 结束回合 | Vroot=103.50；当前动作实际delta=27.50；剩余路线净收益=0；Q_probe=—；排序Q=27.50；状态=settled/low；Vleaf=131；沿途宣传=0@无；终点即时=无@{}；链=end_turn:b2f9b29d；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 4.57ms/执行 8.45ms/投影 0.48ms/估值 0.01ms；每候选 13.51ms | 钱+4，电+1，手牌+1 | — |

## 第 3 轮

### T01 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 10→13(+3)，电 8→10(+2)，宣传 3→3(0)，数据 2→2(0)，手牌 10→13(+3)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 32 | PASS | Vroot=135.50；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=138；沿途宣传=0@无；终点即时=无@{}；链=pass:ac4b4ab2→choose_card:abb36657；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(12候选合计) fork 86.24ms/执行 231.53ms/投影 10.02ms/估值 0.05ms；每候选 27.32ms | — | 弃牌换1宣传 (0)；弃牌换1移动 (0)；弃牌换1移动 (0) |
| 33 | ↳ 选择：b_33.webp | Vroot=135.50；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=138；沿途宣传=0@无；终点即时=无@{}；链=choose_card:44ad8ed9；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(5候选合计) fork 31.36ms/执行 31.43ms/投影 2.39ms/估值 0.03ms；每候选 13.04ms | 手牌+1 | ↳ 选择：dlc_37.png (2.50)；↳ 选择：b_63.webp (2.50)；↳ 选择：b_110.webp (2.50) |
| 34 | 结束回合 | Vroot=138；当前动作实际delta=30；剩余路线净收益=0；Q_probe=—；排序Q=30；状态=settled/low；Vleaf=168；沿途宣传=0@无；终点即时=无@{}；链=end_turn:d59ab08c；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 4.64ms/执行 8.35ms/投影 0.49ms/估值 0.01ms；每候选 13.48ms | 钱+3，电+2，手牌+2 | — |
### T02 绿色玩家

- 分数：10 → 10（0）
- 持有资源：钱 9→11(+2)，电 13→17(+4)，宣传 3→3(0)，数据 2→3(+1)，手牌 8→10(+2)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 35 | PASS | Vroot=152.50；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=155；沿途宣传=0@无；终点即时=无@{}；链=pass:ff716055→choose_card:f7f24460；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(10候选合计) fork 80.62ms/执行 224.01ms/投影 10.13ms/估值 0.05ms；每候选 31.48ms | — | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 36 | ↳ 选择：dlc_37.png | Vroot=152.50；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=155；沿途宣传=0@无；终点即时=无@{}；链=choose_card:445d5eac；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(4候选合计) fork 27.15ms/执行 25.38ms/投影 1.93ms/估值 0.03ms；每候选 13.62ms | 手牌+1 | ↳ 选择：b_63.webp (2.50)；↳ 选择：b_110.webp (2.50)；↳ 选择：b_40.webp (2.50) |
| 37 | 结束回合 | Vroot=155；当前动作实际delta=35；剩余路线净收益=0；Q_probe=—；排序Q=35；状态=settled/low；Vleaf=190；沿途宣传=0@无；终点即时=无@{}；链=end_turn:1f65daa3；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 4.74ms/执行 8.71ms/投影 0.45ms/估值 0.01ms；每候选 13.91ms | 钱+2，电+4，数据+1，手牌+1 | — |
### T03 白色玩家

- 分数：6 → 6（0）
- 持有资源：钱 13→17(+4)，电 5→6(+1)，宣传 4→4(0)，数据 3→3(0)，手牌 7→9(+2)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 38 | PASS | Vroot=131；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=133.50；沿途宣传=0@无；终点即时=无@{}；链=pass:a1f33c73→choose_card:90794832；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(9候选合计) fork 66.69ms/执行 180.41ms/投影 7.46ms/估值 0.04ms；每候选 28.28ms | — | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 39 | ↳ 选择：b_110.webp | Vroot=131；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=133.50；沿途宣传=0@无；终点即时=无@{}；链=choose_card:90794832；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(3候选合计) fork 21.64ms/执行 19.44ms/投影 1.43ms/估值 0.02ms；每候选 14.17ms | 手牌+1 | ↳ 选择：b_40.webp (2.50)；↳ 选择：b_63.webp (2.50) |
| 40 | 结束回合 | Vroot=133.50；当前动作实际delta=27.50；剩余路线净收益=0；Q_probe=—；排序Q=27.50；状态=settled/low；Vleaf=161；沿途宣传=0@无；终点即时=无@{}；链=end_turn:b2f9b29d；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 4.75ms/执行 8.38ms/投影 0.49ms/估值 0.01ms；每候选 13.62ms | 钱+4，电+1，手牌+1 | — |
### T04 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 9→12(+3)，电 4→5(+1)，宣传 10→10(0)，数据 2→2(0)，手牌 8→10(+2)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 41 | PASS | Vroot=122；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=124.50；沿途宣传=0@无；终点即时=无@{}；链=pass:c858282e→choose_card:80907762；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(34候选合计) fork 61.98ms/执行 344.51ms/投影 18.44ms/估值 0.15ms；每候选 12.50ms | — | 弃牌换1移动 (0)；弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50) |
| 42 | ↳ 选择：b_40.webp | Vroot=122；当前动作实际delta=2.50；剩余路线净收益=0；Q_probe=—；排序Q=2.50；状态=settled/low；Vleaf=124.50；沿途宣传=0@无；终点即时=无@{}；链=choose_card:6d9c86a3；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(2候选合计) fork 18ms/执行 12.72ms/投影 0.97ms/估值 0.02ms；每候选 15.85ms | 手牌+1 | ↳ 选择：b_63.webp (2.50) |
| 43 | 结束回合 | Vroot=124.50；当前动作实际delta=22.50；剩余路线净收益=0；Q_probe=—；排序Q=22.50；状态=settled/low；Vleaf=147；沿途宣传=0@无；终点即时=无@{}；链=end_turn:320f2608；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 4.68ms/执行 8.78ms/投影 0.50ms/估值 0.01ms；每候选 13.96ms | 钱+3，电+1，手牌+1 | — |

## 第 4 轮

### T01 绿色玩家

- 分数：10 → 15（+5）
- 持有资源：钱 11→9(-2)，电 17→16(-1)，宣传 3→10(+7)，数据 3→6(+3)，手牌 10→4(-6)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 44 | 弃牌换1宣传 | Vroot=190；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=190；沿途宣传=0@无；终点即时=无@{}；链=card_corner:182b049a；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(12候选合计) fork 65.01ms/执行 219.32ms/投影 11.92ms/估值 0.06ms；每候选 24.69ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 45 | 弃牌换1宣传 | Vroot=190；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=190；沿途宣传=0@无；终点即时=无@{}；链=card_corner:24cdd7ba；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(11候选合计) fork 64.29ms/执行 210.08ms/投影 9.48ms/估值 0.05ms；每候选 25.80ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 46 | 弃牌换1宣传 | Vroot=190；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=190；沿途宣传=0@无；终点即时=无@{}；链=card_corner:3c857eff；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(10候选合计) fork 62.32ms/执行 202.60ms/投影 8.82ms/估值 0.05ms；每候选 27.37ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 47 | 弃牌换1宣传 | Vroot=190；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=190；沿途宣传=0@无；终点即时=无@{}；链=card_corner:4a053388；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(33候选合计) fork 86.98ms/执行 402.36ms/投影 20.25ms/估值 0.14ms；每候选 15.44ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 48 | 弃牌换1宣传 | Vroot=190；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=190；沿途宣传=0@无；终点即时=无@{}；链=card_corner:986906b0；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(32候选合计) fork 84.92ms/执行 394.37ms/投影 19.50ms/估值 0.13ms；每候选 15.59ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；PASS (0) |
| 49 | 弃牌换1宣传 | Vroot=190；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=190；沿途宣传=0@无；终点即时=无@{}；链=card_corner:909eef4b；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(31候选合计) fork 84.54ms/执行 387.60ms/投影 19.46ms/估值 0.14ms；每候选 15.86ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；PASS (0)；弃牌换1移动 (-7.50) |
| 50 | 弃牌换1宣传 | Vroot=190；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=190；沿途宣传=0@无；终点即时=无@{}；链=card_corner:bfdb9d86；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(30候选合计) fork 83.98ms/执行 379.86ms/投影 18.54ms/估值 0.13ms；每候选 16.08ms | 宣传+1，手牌-1 | PASS (0)；弃牌换1移动 (-7.50)；弃牌换1移动 (-7.50) |
| 51 | 发射 | 状态=failed；置信=none；COUNTERFACTUAL_EXECUTION_FAILED | 钱-2 | PASS (0)；弃牌换1移动 (-7.50)；弃牌换1移动 (-7.50) |
| 52 | 移动火箭 3 ccw | 状态=failed；置信=none；COUNTERFACTUAL_EXECUTION_FAILED | — | PASS (0)；弃牌换1移动 (-2.50)；弃牌换1移动 (-7.50) |
| 53 | ↳ 选择：消耗 1 能量 | Vroot=180；当前动作实际delta=-5；剩余路线净收益=0；Q_probe=—；排序Q=-5；状态=settled/low；Vleaf=175；沿途宣传=0@无；终点即时=无@{}；链=choose_payment:9938c7f8；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 12.97ms/执行 8.81ms/投影 0.49ms/估值 0.01ms；每候选 22.27ms | 电-1 | — |
| 54 | 移动火箭 3 ccw | 状态=failed；置信=none；COUNTERFACTUAL_EXECUTION_FAILED | — | PASS (0)；弃牌换1移动 (-2.50)；弃牌换1移动 (-7.50) |
| 55 | ↳ 选择：消耗 1 能量 | Vroot=175；当前动作实际delta=-5；剩余路线净收益=0；Q_probe=—；排序Q=-5；状态=settled/low；Vleaf=170；沿途宣传=0@无；终点即时=无@{}；链=choose_payment:9938c7f8；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 13.78ms/执行 7.18ms/投影 0.87ms/估值 0.02ms；每候选 21.83ms | 电-1 | — |
| 56 | 登陆金星（主星，R3，3能量） | 状态=settled；置信=low；probe-route-no-positive-net | 分数+5，电-3，数据+2 | PASS (0)；弃牌换1移动 (-2.50)；弃牌换1移动 (-7.50) |
| 57 | ↳ 选择：外星人1：yellow痕迹 | Vroot=165；当前动作实际delta=3.33；剩余路线净收益=0；Q_probe=—；排序Q=3.33；状态=settled/low；Vleaf=168.33；沿途宣传=0@无；终点即时=无@{}；链=choose_target:2c385295；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(2候选合计) fork 15.35ms/执行 12.92ms/投影 0.96ms/估值 0.02ms；每候选 14.62ms | — | ↳ 选择：外星人2：yellow痕迹 (3.33) |
| 58 | 发射 | 状态=settled；置信=low；probe-route-no-positive-net | 钱-2 | PASS (0)；研究 orange2 (-8)；研究 orange3 (-8) |
| 59 | PASS | Vroot=158.33；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=158.33；沿途宣传=0@无；终点即时=无@{}；链=pass:ff716055；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(28候选合计) fork 46.59ms/执行 270.86ms/投影 14.89ms/估值 0.12ms；每候选 11.87ms | — | 弃牌换1移动 (-2.50)；研究 orange2 (-8)；研究 orange3 (-8) |
| 60 | 结束回合 | Vroot=158.33；当前动作实际delta=35；剩余路线净收益=0；Q_probe=—；排序Q=35；状态=settled/low；Vleaf=193.33；沿途宣传=0@无；终点即时=无@{}；链=end_turn:1f65daa3；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 5.09ms/执行 8.82ms/投影 0.53ms/估值 0.01ms；每候选 14.44ms | 钱+2，电+4，数据+1，手牌+1 | — |
### T02 白色玩家

- 分数：6 → 11（+5）
- 持有资源：钱 17→17(0)，电 6→2(-4)，宣传 4→10(+6)，数据 3→6(+3)，手牌 9→4(-5)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 61 | 弃牌换1宣传 | Vroot=161；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=161；沿途宣传=0@无；终点即时=无@{}；链=card_corner:1ce11ed2；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(11候选合计) fork 57.12ms/执行 187.17ms/投影 7.55ms/估值 0.04ms；每候选 22.89ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1移动 (0) |
| 62 | 弃牌换1宣传 | Vroot=161；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=161；沿途宣传=0@无；终点即时=无@{}；链=card_corner:2928d320；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(10候选合计) fork 55.26ms/执行 181.18ms/投影 7.24ms/估值 0.04ms；每候选 24.37ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1移动 (0) |
| 63 | 弃牌换1移动 | Vroot=161；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=161；沿途宣传=0@无；终点即时=无@{}；链=card_corner:9e3c126b；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(33候选合计) fork 80.67ms/执行 388.12ms/投影 19.25ms/估值 0.15ms；每候选 14.79ms | 数据+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 64 | 弃牌换1宣传 | Vroot=161；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=161；沿途宣传=0@无；终点即时=无@{}；链=card_corner:aea03829；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(32候选合计) fork 81.92ms/执行 391.40ms/投影 18.42ms/估值 0.16ms；每候选 15.37ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；PASS (0) |
| 65 | 弃牌换1宣传 | Vroot=161；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=161；沿途宣传=0@无；终点即时=无@{}；链=card_corner:4f94419c；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(31候选合计) fork 78.43ms/执行 368.11ms/投影 17.48ms/估值 0.14ms；每候选 14.97ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；PASS (0)；研究 orange2 (-8) |
| 66 | 弃牌换1宣传 | Vroot=161；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=161；沿途宣传=0@无；终点即时=无@{}；链=card_corner:f05d7300；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(30候选合计) fork 77.69ms/执行 359.06ms/投影 17.20ms/估值 0.12ms；每候选 15.13ms | 宣传+1，手牌-1 | PASS (0)；研究 orange2 (-8)；研究 orange3 (-8) |
| 67 | 发射 | 状态=failed；置信=none；COUNTERFACTUAL_EXECUTION_FAILED | 钱-2 | PASS (0)；研究 orange2 (-8)；研究 orange3 (-8) |
| 68 | 移动火箭 5 ccw | 状态=failed；置信=none；COUNTERFACTUAL_EXECUTION_FAILED | — | PASS (0)；弃牌换1移动 (-2.50)；弃牌换1移动 (-2.50) |
| 69 | ↳ 选择：消耗 1 能量 | Vroot=151；当前动作实际delta=-5；剩余路线净收益=0；Q_probe=—；排序Q=-5；状态=settled/low；Vleaf=146；沿途宣传=0@无；终点即时=无@{}；链=choose_payment:31e55dce；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 13.34ms/执行 8.90ms/投影 0.52ms/估值 0.01ms；每候选 22.75ms | 电-1 | — |
| 70 | 移动火箭 5 ccw | 状态=failed；置信=none；COUNTERFACTUAL_EXECUTION_FAILED | — | PASS (0)；弃牌换1移动 (-2.50)；弃牌换1移动 (-2.50) |
| 71 | ↳ 选择：消耗 1 能量 | Vroot=146；当前动作实际delta=-2.50；剩余路线净收益=0；Q_probe=—；排序Q=-2.50；状态=settled/low；Vleaf=143.50；沿途宣传=0@无；终点即时=无@{}；链=choose_payment:31e55dce；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 13.88ms/执行 7.13ms/投影 0.49ms/估值 0.01ms；每候选 21.50ms | 电-1，宣传+1 | — |
| 72 | 登陆金星（主星，R5，3能量） | 状态=settled；置信=low；probe-route-no-positive-net | 分数+5，电-3，数据+2 | PASS (0)；弃牌换1移动 (-2.50)；弃牌换1移动 (-2.50) |
| 73 | ↳ 选择：外星人2：yellow痕迹 | Vroot=138.50；当前动作实际delta=3.33；剩余路线净收益=0；Q_probe=—；排序Q=3.33；状态=settled/low；Vleaf=141.83；沿途宣传=0@无；终点即时=无@{}；链=choose_target:489729aa；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(2候选合计) fork 15.76ms/执行 12.90ms/投影 1ms/估值 0.02ms；每候选 14.83ms | — | ↳ 选择：外星人1：yellow痕迹 (0) |
| 74 | 发射 | 状态=settled；置信=low；probe-route-no-positive-net | 钱-2 | PASS (0)；研究 orange2 (-8)；研究 orange3 (-8) |
| 75 | PASS | Vroot=131.83；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=131.83；沿途宣传=0@无；终点即时=无@{}；链=pass:a1f33c73；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(28候选合计) fork 73ms/执行 324.79ms/投影 17.42ms/估值 0.12ms；每候选 14.83ms | — | 弃牌换1移动 (-2.50)；弃牌换1移动 (-2.50)；弃牌换1移动 (-2.50) |
| 76 | 结束回合 | Vroot=131.83；当前动作实际delta=27.50；剩余路线净收益=0；Q_probe=—；排序Q=27.50；状态=settled/low；Vleaf=159.33；沿途宣传=0@无；终点即时=无@{}；链=end_turn:b2f9b29d；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 5.08ms/执行 9.43ms/投影 0.51ms/估值 0.01ms；每候选 15.02ms | 钱+4，电+1，手牌+1 | — |
### T03 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 12→13(+1)，电 5→4(-1)，宣传 10→10(0)，数据 2→4(+2)，手牌 10→9(-1)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 77 | 弃牌换1移动 | Vroot=147；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=147；沿途宣传=0@无；终点即时=无@{}；链=card_corner:8f44334f；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(36候选合计) fork 55.93ms/执行 362.92ms/投影 19.30ms/估值 0.15ms；每候选 12.17ms | 数据+1，手牌-1 | 弃牌换1移动 (0)；PASS (0)；弃牌换1宣传 (-2.50) |
| 78 | 弃牌换1移动 | Vroot=147；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=147；沿途宣传=0@无；终点即时=无@{}；链=card_corner:e8826db5；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(35候选合计) fork 56.08ms/执行 354.48ms/投影 18.63ms/估值 0.14ms；每候选 12.26ms | 数据+1，手牌-1 | PASS (0)；弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50) |
| 79 | 发射 | 状态=settled；置信=low；probe-route-no-positive-net | 钱-2 | PASS (0)；弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50) |
| 80 | 移动火箭 7 out | 状态=settled；置信=low；probe-route-no-positive-net | — | PASS (0)；弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50) |
| 81 | ↳ 选择：消耗 1 能量 | Vroot=137；当前动作实际delta=-5；剩余路线净收益=0；Q_probe=—；排序Q=-5；状态=settled/low；Vleaf=132；沿途宣传=0@无；终点即时=无@{}；链=choose_payment:08ce11f7；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 13.66ms/执行 9.19ms/投影 0.53ms/估值 0.01ms；每候选 23.38ms | 电-1 | — |
| 82 | 移动火箭 7 out | 状态=settled；置信=low；probe-route-no-positive-net | — | PASS (0)；弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50) |
| 83 | ↳ 选择：消耗 1 能量 | Vroot=132；当前动作实际delta=-5；剩余路线净收益=0；Q_probe=—；排序Q=-5；状态=settled/low；Vleaf=127；沿途宣传=0@无；终点即时=无@{}；链=choose_payment:08ce11f7；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 13.90ms/执行 8.92ms/投影 0.55ms/估值 0.01ms；每候选 23.37ms | 电-1 | — |
| 84 | PASS | Vroot=127；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=127；沿途宣传=0@无；终点即时=无@{}；链=pass:c858282e；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(33候选合计) fork 61.37ms/执行 410.74ms/投影 20.36ms/估值 0.15ms；每候选 14.92ms | — | 弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50) |
| 85 | 结束回合 | Vroot=127；当前动作实际delta=22.50；剩余路线净收益=0；Q_probe=—；排序Q=22.50；状态=settled/low；Vleaf=149.50；沿途宣传=0@无；终点即时=无@{}；链=end_turn:320f2608；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 5.49ms/执行 9.61ms/投影 0.53ms/估值 0.01ms；每候选 15.62ms | 钱+3，电+1，手牌+1 | — |
### T04 棕色玩家

- 分数：8 → 13（+5）
- 持有资源：钱 13→12(-1)，电 10→7(-3)，宣传 3→10(+7)，数据 2→6(+4)，手牌 13→6(-7)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 86 | 弃牌换1宣传 | Vroot=168；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=168；沿途宣传=0@无；终点即时=无@{}；链=card_corner:087098db；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(15候选合计) fork 74.57ms/执行 252.85ms/投影 10.78ms/估值 0.06ms；每候选 22.55ms | 宣传+1，手牌-1 | 弃牌换1移动 (0)；弃牌换1宣传 (0)；弃牌换1移动 (0) |
| 87 | 弃牌换1宣传 | Vroot=168；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=168；沿途宣传=0@无；终点即时=无@{}；链=card_corner:3bd34dda；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(14候选合计) fork 74.38ms/执行 248.66ms/投影 10.49ms/估值 0.05ms；每候选 23.82ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 88 | 弃牌换1宣传 | Vroot=168；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=168；沿途宣传=0@无；终点即时=无@{}；链=card_corner:89184bdb；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(13候选合计) fork 71.81ms/执行 233.67ms/投影 9.68ms/估值 0.04ms；每候选 24.24ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1移动 (0) |
| 89 | 弃牌换1移动 | Vroot=168；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=168；沿途宣传=0@无；终点即时=无@{}；链=card_corner:3c540a1f；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(36候选合计) fork 100.37ms/执行 453.64ms/投影 22.27ms/估值 0.12ms；每候选 16.01ms | 数据+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1移动 (0) |
| 90 | 弃牌换1宣传 | Vroot=168；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=168；沿途宣传=0@无；终点即时=无@{}；链=card_corner:85fb49f2；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(35候选合计) fork 97.38ms/执行 446.85ms/投影 21.62ms/估值 0.13ms；每候选 16.17ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1移动 (0) |
| 91 | 弃牌换1宣传 | Vroot=168；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=168；沿途宣传=0@无；终点即时=无@{}；链=card_corner:5825a55d；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(34候选合计) fork 96.76ms/执行 434.67ms/投影 20.78ms/估值 0.14ms；每候选 16.24ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1移动 (0)；弃牌换1宣传 (0) |
| 92 | 弃牌换1宣传 | Vroot=168；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=168；沿途宣传=0@无；终点即时=无@{}；链=card_corner:9a0eeaf4；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(33候选合计) fork 95.06ms/执行 424.66ms/投影 20.45ms/估值 0.50ms；每候选 16.37ms | 宣传+1，手牌-1 | 弃牌换1移动 (0)；弃牌换1宣传 (0)；PASS (0) |
| 93 | 弃牌换1宣传 | Vroot=168；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=168；沿途宣传=0@无；终点即时=无@{}；链=card_corner:3108808e；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(32候选合计) fork 94.35ms/执行 415.59ms/投影 20.27ms/估值 0.12ms；每候选 16.57ms | 宣传+1，手牌-1 | 弃牌换1移动 (0)；PASS (0)；研究 orange3 (-8) |
| 94 | 弃牌换1移动 | Vroot=168；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=168；沿途宣传=0@无；终点即时=无@{}；链=card_corner:b35d500c；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(31候选合计) fork 92.72ms/执行 405.73ms/投影 19.37ms/估值 0.11ms；每候选 16.70ms | 数据+1，手牌-1 | PASS (0)；研究 orange3 (-8)；研究 orange2 (-8) |
| 95 | 发射 | 状态=failed；置信=none；COUNTERFACTUAL_EXECUTION_FAILED | 钱-2 | PASS (0)；研究 orange3 (-8)；研究 orange2 (-8) |
| 96 | 移动火箭 8 ccw | 状态=failed；置信=none；COUNTERFACTUAL_EXECUTION_FAILED | — | PASS (0)；弃牌换1移动 (-2.50)；弃牌换1移动 (-2.50) |
| 97 | ↳ 选择：消耗 1 能量 | Vroot=158；当前动作实际delta=-5；剩余路线净收益=0；Q_probe=—；排序Q=-5；状态=settled/low；Vleaf=153；沿途宣传=0@无；终点即时=无@{}；链=choose_payment:d008d903；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 14.49ms/执行 9.25ms/投影 0.55ms/估值 0.01ms；每候选 24.28ms | 电-1 | — |
| 98 | 移动火箭 8 ccw | 状态=failed；置信=none；COUNTERFACTUAL_EXECUTION_FAILED | — | PASS (0)；弃牌换1移动 (-2.50)；弃牌换1移动 (-2.50) |
| 99 | ↳ 选择：消耗 1 能量 | Vroot=153；当前动作实际delta=-5；剩余路线净收益=0；Q_probe=—；排序Q=-5；状态=settled/low；Vleaf=148；沿途宣传=0@无；终点即时=无@{}；链=choose_payment:d008d903；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 14.43ms/执行 7.58ms/投影 0.53ms/估值 0.01ms；每候选 22.54ms | 电-1 | — |
| 100 | 登陆金星（主星，R8，3能量） | 状态=settled；置信=low；probe-route-no-positive-net | 分数+5，电-3，数据+2 | PASS (0)；弃牌换1移动 (-2.50)；弃牌换1移动 (-2.50) |
| 101 | ↳ 选择：外星人1：yellow痕迹 | Vroot=143；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=143；沿途宣传=0@无；终点即时=无@{}；链=choose_target:2f6b4fb8；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(2候选合计) fork 17.31ms/执行 13.34ms/投影 1.05ms/估值 0.02ms；每候选 15.86ms | — | ↳ 选择：外星人2：yellow痕迹 (0) |
| 102 | 发射 | 状态=settled；置信=low；probe-route-no-positive-net | 钱-2 | PASS (0)；研究 orange3 (-8)；研究 orange2 (-8) |
| 103 | PASS | Vroot=133；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=133；沿途宣传=0@无；终点即时=无@{}；链=pass:ac4b4ab2；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(29候选合计) fork 95ms/执行 390.30ms/投影 21.03ms/估值 0.14ms；每候选 17.46ms | — | 弃牌换1移动 (-2.50)；弃牌换1移动 (-2.50)；弃牌换1移动 (-2.50) |
| 104 | 结束回合 | Vroot=133；当前动作实际delta=30；剩余路线净收益=0；Q_probe=—；排序Q=30；状态=settled/low；Vleaf=163；沿途宣传=0@无；终点即时=无@{}；链=end_turn:d59ab08c；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 5.42ms/执行 10.55ms/投影 0.56ms/估值 0.01ms；每候选 16.53ms | 钱+3，电+2，手牌+2 | — |

## 第 5 轮

### T01 白色玩家

- 分数：11 → 11（0）
- 持有资源：钱 17→21(+4)，电 2→1(-1)，宣传 10→10(0)，数据 6→6(0)，手牌 4→5(+1)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 105 | 移动火箭 6 ccw | 状态=settled；置信=low；probe-route-no-positive-net | — | PASS (0)；弃牌换1移动 (-2.50)；弃牌换1移动 (-2.50) |
| 106 | ↳ 选择：消耗 1 能量 | Vroot=159.33；当前动作实际delta=-5；剩余路线净收益=0；Q_probe=—；排序Q=-5；状态=settled/low；Vleaf=154.33；沿途宣传=0@无；终点即时=无@{}；链=choose_payment:31e55dce；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 14.85ms/执行 9.71ms/投影 0.55ms/估值 0.01ms；每候选 25.11ms | 电-1 | — |
| 107 | 移动火箭 6 ccw | 状态=settled；置信=low；probe-route-no-positive-net | — | PASS (0)；弃牌换1移动 (-2.50)；弃牌换1移动 (-2.50) |
| 108 | ↳ 选择：消耗 1 能量 | Vroot=154.33；当前动作实际delta=-5；剩余路线净收益=0；Q_probe=—；排序Q=-5；状态=settled/low；Vleaf=149.33；沿途宣传=0@无；终点即时=无@{}；链=choose_payment:31e55dce；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 13.76ms/执行 7.98ms/投影 0.54ms/估值 0.01ms；每候选 22.27ms | 电-1 | — |
| 109 | PASS | Vroot=149.33；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=149.33；沿途宣传=0@无；终点即时=无@{}；链=pass:a1f33c73；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(29候选合计) fork 79.25ms/执行 356.93ms/投影 19.21ms/估值 0.15ms；每候选 15.70ms | — | 弃牌换1移动 (-2.50)；弃牌换1移动 (-2.50)；弃牌换1宣传 (-2.50) |
| 110 | 结束回合 | Vroot=149.33；当前动作实际delta=27.50；剩余路线净收益=0；Q_probe=—；排序Q=27.50；状态=settled/low；Vleaf=176.83；沿途宣传=0@无；终点即时=无@{}；链=end_turn:b2f9b29d；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 5.72ms/执行 11.52ms/投影 0.58ms/估值 0.02ms；每候选 17.83ms | 钱+4，电+1，手牌+1 | — |
### T02 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 13→16(+3)，电 4→5(+1)，宣传 10→10(0)，数据 4→4(0)，手牌 9→10(+1)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 111 | PASS | Vroot=149.50；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=149.50；沿途宣传=0@无；终点即时=无@{}；链=pass:c858282e；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(34候选合计) fork 63.29ms/执行 414.78ms/投影 20.93ms/估值 0.20ms；每候选 14.68ms | — | 弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50) |
| 112 | 结束回合 | Vroot=149.50；当前动作实际delta=22.50；剩余路线净收益=0；Q_probe=—；排序Q=22.50；状态=settled/low；Vleaf=172；沿途宣传=0@无；终点即时=无@{}；链=end_turn:320f2608；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 5.24ms/执行 10.08ms/投影 0.55ms/估值 0.02ms；每候选 15.87ms | 钱+3，电+1，手牌+1 | — |
### T03 棕色玩家

- 分数：13 → 18（+5）
- 持有资源：钱 12→13(+1)，电 7→4(-3)，宣传 10→10(0)，数据 6→6(0)，手牌 6→8(+2)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 113 | 移动火箭 9 ccw | 状态=failed；置信=none；COUNTERFACTUAL_EXECUTION_FAILED | — | PASS (0)；弃牌换1移动 (-2.50)；弃牌换1移动 (-2.50) |
| 114 | ↳ 选择：消耗 1 能量 | Vroot=163；当前动作实际delta=-5；剩余路线净收益=0；Q_probe=—；排序Q=-5；状态=settled/low；Vleaf=158；沿途宣传=0@无；终点即时=无@{}；链=choose_payment:d008d903；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 14.36ms/执行 9.34ms/投影 0.56ms/估值 0.01ms；每候选 24.26ms | 电-1 | — |
| 115 | 移动火箭 9 ccw | 状态=failed；置信=none；COUNTERFACTUAL_EXECUTION_FAILED | — | PASS (0)；弃牌换1移动 (-2.50)；弃牌换1移动 (-2.50) |
| 116 | ↳ 选择：消耗 1 能量 | Vroot=158；当前动作实际delta=-5；剩余路线净收益=0；Q_probe=—；排序Q=-5；状态=settled/low；Vleaf=153；沿途宣传=0@无；终点即时=无@{}；链=choose_payment:d008d903；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 14.46ms/执行 7.96ms/投影 0.55ms/估值 0.01ms；每候选 22.96ms | 电-1 | — |
| 117 | 登陆金星（主星，R9，3能量） | 状态=settled；置信=low；probe-route-no-positive-net | 分数+5，电-3 | PASS (0)；弃牌换1移动 (-2.50)；弃牌换1移动 (-2.50) |
| 118 | ↳ 选择：外星人1：yellow痕迹 | Vroot=143；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=143；沿途宣传=0@无；终点即时=无@{}；链=choose_target:2f6b4fb8；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(2候选合计) fork 17.13ms/执行 13.85ms/投影 1.08ms/估值 0.02ms；每候选 16.03ms | — | ↳ 选择：外星人2：yellow痕迹 (0) |
| 119 | 发射 | 状态=settled；置信=low；probe-route-no-positive-net | 钱-2 | PASS (0)；研究 orange3 (-8)；研究 orange2 (-8) |
| 120 | PASS | Vroot=133；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=133；沿途宣传=0@无；终点即时=无@{}；链=pass:ac4b4ab2；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(31候选合计) fork 122.57ms/执行 439.61ms/投影 24.09ms/估值 0.16ms；每候选 18.91ms | — | 弃牌换1移动 (-2.50)；弃牌换1移动 (-2.50)；弃牌换1移动 (-2.50) |
| 121 | 结束回合 | Vroot=133；当前动作实际delta=30；剩余路线净收益=0；Q_probe=—；排序Q=30；状态=settled/low；Vleaf=163；沿途宣传=0@无；终点即时=无@{}；链=end_turn:d59ab08c；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 5.45ms/执行 9.79ms/投影 0.55ms/估值 0.01ms；每候选 15.79ms | 钱+3，电+2，手牌+2 | — |
### T04 绿色玩家

- 分数：15 → 20（+5）
- 持有资源：钱 9→9(0)，电 16→15(-1)，宣传 10→10(0)，数据 6→6(0)，手牌 4→5(+1)，预留牌 0→0(0)

| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |
| ---: | --- | --- | --- | --- |
| 122 | 移动火箭 4 ccw | 状态=failed；置信=none；COUNTERFACTUAL_EXECUTION_FAILED | — | PASS (0)；弃牌换1宣传 (-2.50)；弃牌换1移动 (-2.50) |
| 123 | ↳ 选择：消耗 1 能量 | Vroot=193.33；当前动作实际delta=-5；剩余路线净收益=0；Q_probe=—；排序Q=-5；状态=settled/low；Vleaf=188.33；沿途宣传=0@无；终点即时=无@{}；链=choose_payment:9938c7f8；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 14.49ms/执行 9.84ms/投影 0.56ms/估值 0.01ms；每候选 24.90ms | 电-1 | — |
| 124 | 移动火箭 4 ccw | 状态=failed；置信=none；COUNTERFACTUAL_EXECUTION_FAILED | — | PASS (0)；弃牌换1宣传 (-2.50)；弃牌换1移动 (-2.50) |
| 125 | ↳ 选择：消耗 1 能量 | Vroot=188.33；当前动作实际delta=-5；剩余路线净收益=0；Q_probe=—；排序Q=-5；状态=settled/low；Vleaf=183.33；沿途宣传=0@无；终点即时=无@{}；链=choose_payment:9938c7f8；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 14.81ms/执行 7.68ms/投影 0.55ms/估值 0.01ms；每候选 23.04ms | 电-1 | — |
| 126 | 登陆金星（主星，R4，3能量） | 状态=settled；置信=low；probe-route-no-positive-net | 分数+5，电-3 | PASS (0)；弃牌换1宣传 (-2.50)；弃牌换1移动 (-2.50) |
| 127 | ↳ 选择：外星人1：yellow痕迹 | Vroot=173.33；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=173.33；沿途宣传=0@无；终点即时=无@{}；链=choose_target:2c385295；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(2候选合计) fork 20.78ms/执行 14.06ms/投影 1.10ms/估值 0.02ms；每候选 17.97ms | — | ↳ 选择：外星人2：yellow痕迹 (0) |
| 128 | 发射 | 状态=settled；置信=low；probe-route-no-positive-net | 钱-2 | PASS (0)；弃牌换1宣传 (-2.50)；研究 orange2 (-8) |
| 129 | PASS | Vroot=163.33；当前动作实际delta=0；剩余路线净收益=0；Q_probe=—；排序Q=0；状态=settled/low；Vleaf=163.33；沿途宣传=0@无；终点即时=无@{}；链=pass:ff716055；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(29候选合计) fork 53.85ms/执行 316.88ms/投影 17.59ms/估值 0.16ms；每候选 13.39ms | — | 弃牌换1宣传 (-2.50)；弃牌换1移动 (-2.50)；研究 orange2 (-8) |
| 130 | 结束回合 | Vroot=163.33；当前动作实际delta=-143.33；剩余路线净收益=0；Q_probe=—；排序Q=-143.33；状态=settled/low；Vleaf=20；沿途宣传=0@无；终点即时=无@{}；链=end_turn:1f65daa3；字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate；依据=counterfactual-standard-execution；耗时(1候选合计) fork 5.57ms/执行 10ms/投影 0.55ms/估值 0.02ms；每候选 16.13ms | 钱+2，电+4，手牌+1 | — |

## 最终分数、目标差距与剩余资源

| 名次 | 机器人 | 总分 | 实局增长 | 距 100 分 | 钱 | 电 | 宣传 | 数据 | 手牌 | 预留牌 |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 绿色玩家 | 20 | +10 | -80 | 9 | 15 | 10 | 6 | 5 | 0 |
| 2 | 棕色玩家 | 18 | +10 | -82 | 13 | 4 | 10 | 6 | 8 | 0 |
| 3 | 白色玩家 | 11 | +5 | -89 | 21 | 1 | 10 | 6 | 5 | 0 |
| 4 | 蓝色玩家 | 7 | 0 | -93 | 16 | 5 | 10 | 4 | 10 | 0 |
