# seti-104-board-v1 机器人逐回合行动报告

- seed：`seti-104-official-v1`
- board fingerprint：`594527b1b87b844363eaf62bb675fb615132c6416b5336be389051a37dda81ba`
- Policy 决策数：84
- 游戏回合数：20
- 价值口径：`Q` 只读取同一 Rule Composition/Standard Action/Effect Session/Decision/commit 链真实执行后的叶状态；已兑现分 1:1，未兑现资产使用 θ₀
- 诊断目标：初次接触玩家约 100 分；最终表同时列出各机器人的目标差距
- 固定反例：R1 T04 绿色登陆土星的标准链为 `land -> choose_target(yellow trace)`；登陆先兑现 8 分与首次 2 数据，两个痕迹槽叶分别为 13/11 分
- 同根 parity 门禁：`orbit/place_data/research_tech/play_card/scan/launch/move/pass`，以及 `analyze -> blue trace` 两叶，均逐 leaf 对照直接标准提交

## 开局待决选择

- 白色玩家：↳ 选择：语言学分析
- 白色玩家：↳ 选择：dlc_26.png
- 棕色玩家：↳ 选择：b_129.webp
- 棕色玩家：↳ 选择：b_73.webp
- 棕色玩家：↳ 选择：b_134.webp
- 绿色玩家：↳ 选择：dlc_38.png
- 绿色玩家：↳ 选择：b_130.webp

## 自动诊断摘要

- 20 个玩家回合中，20 个回合没有获得分数。
- 57 个可计算 Q 的非结束决策中，37 个与至少一个备选动作同分，33 个选中动作的 Q 不大于 0；这两项可直接定位估值区分度不足。

## 第 1 轮

### T01 白色玩家

- 分数：6 → 6（0）
- 持有资源：钱 5→9(+4)，电 3→4(+1)，宣传 4→4(0)，数据 3→3(0)，手牌 3→5(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 8 | PASS | Q=2.50；状态=settled/low；根(分6+资产65)；叶(分6+资产67.50)；链=pass:a1f33c73→choose_card:ec9d04d4；依据=counterfactual-standard-execution；耗时 fork 35.93ms/执行 78.84ms/投影 4.09ms/估值 0.10ms | — | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；发射 (-10) |
| 9 | ↳ 选择：dlc_24.png | Q=2.50；状态=settled/low；根(分6+资产65)；叶(分6+资产67.50)；链=choose_card:4708c91c；依据=counterfactual-standard-execution；耗时 fork 34.45ms/执行 33.39ms/投影 2.50ms/估值 0.06ms | 手牌+1 | ↳ 选择：b_12.webp (2.50)；↳ 选择：b_117.webp (2.50)；↳ 选择：b_24.webp (2.50) |
| 10 | 结束回合 | Q=27.50；状态=settled/low；根(分6+资产67.50)；叶(分6+资产95)；链=end_turn:b2f9b29d；依据=counterfactual-standard-execution；耗时 fork 4.93ms/执行 10.18ms/投影 0.54ms/估值 0.02ms | 钱+4，电+1，手牌+1 | — |
### T02 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 3→6(+3)，电 2→3(+1)，宣传 10→10(0)，数据 2→2(0)，手牌 4→6(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 11 | PASS | Q=2.50；状态=settled/low；根(分7+资产65)；叶(分7+资产67.50)；链=pass:c858282e→choose_card:10304ac6；依据=counterfactual-standard-execution；耗时 fork 59.13ms/执行 303.12ms/投影 17.05ms/估值 0.27ms | — | 弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50) |
| 12 | ↳ 选择：b_128.webp | Q=2.50；状态=settled/low；根(分7+资产65)；叶(分7+资产67.50)；链=choose_card:10304ac6；依据=counterfactual-standard-execution；耗时 fork 29.15ms/执行 28.98ms/投影 2.09ms/估值 0.05ms | 手牌+1 | ↳ 选择：b_24.webp (2.50)；↳ 选择：b_117.webp (2.50)；↳ 选择：b_12.webp (2.50) |
| 13 | 结束回合 | Q=22.50；状态=settled/low；根(分7+资产67.50)；叶(分7+资产90)；链=end_turn:320f2608；依据=counterfactual-standard-execution；耗时 fork 5.24ms/执行 8.95ms/投影 0.47ms/估值 0.02ms | 钱+3，电+1，手牌+1 | — |
### T03 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 4→7(+3)，电 4→6(+2)，宣传 3→3(0)，数据 2→2(0)，手牌 4→7(+3)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 14 | PASS | Q=2.50；状态=settled/low；根(分8+资产62.50)；叶(分8+资产65)；链=pass:ac4b4ab2→choose_card:bc063520；依据=counterfactual-standard-execution；耗时 fork 26.66ms/执行 76.76ms/投影 4.27ms/估值 0.07ms | — | 弃牌换1宣传 (0)；弃牌换1移动 (0)；弃牌换1宣传 (0) |
| 15 | ↳ 选择：b_117.webp | Q=2.50；状态=settled/low；根(分8+资产62.50)；叶(分8+资产65)；链=choose_card:bc063520；依据=counterfactual-standard-execution；耗时 fork 24.22ms/执行 20.70ms/投影 1.56ms/估值 0.04ms | 手牌+1 | ↳ 选择：b_24.webp (2.50)；↳ 选择：b_12.webp (2.50) |
| 16 | 结束回合 | Q=30；状态=settled/low；根(分8+资产65)；叶(分8+资产95)；链=end_turn:d59ab08c；依据=counterfactual-standard-execution；耗时 fork 5.41ms/执行 8.72ms/投影 0.79ms/估值 0.02ms | 钱+3，电+2，手牌+2 | — |
### T04 绿色玩家

- 分数：10 → 10（0）
- 持有资源：钱 5→7(+2)，电 5→9(+4)，宣传 3→3(0)，数据 0→1(+1)，手牌 4→6(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 17 | PASS | Q=2.50；状态=settled/low；根(分10+资产67.50)；叶(分10+资产70)；链=pass:ff716055→choose_card:8d52fb62；依据=counterfactual-standard-execution；耗时 fork 20.43ms/执行 67.78ms/投影 3.65ms/估值 0.07ms | — | 弃牌换1移动 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 18 | ↳ 选择：b_12.webp | Q=2.50；状态=settled/low；根(分10+资产67.50)；叶(分10+资产70)；链=choose_card:03718679；依据=counterfactual-standard-execution；耗时 fork 18.39ms/执行 14.10ms/投影 0.98ms/估值 0.03ms | 手牌+1 | ↳ 选择：b_24.webp (2.50) |
| 19 | 结束回合 | Q=35；状态=settled/low；根(分10+资产70)；叶(分10+资产105)；链=end_turn:1f65daa3；依据=counterfactual-standard-execution；耗时 fork 5.31ms/执行 9.88ms/投影 0.53ms/估值 0.02ms | 钱+2，电+4，数据+1，手牌+1 | — |

## 第 2 轮

### T01 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 6→9(+3)，电 3→4(+1)，宣传 10→10(0)，数据 2→2(0)，手牌 6→8(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 20 | PASS | Q=2.50；状态=settled/low；根(分7+资产90)；叶(分7+资产92.50)；链=pass:c858282e→choose_card:481577ed；依据=counterfactual-standard-execution；耗时 fork 69.68ms/执行 342.37ms/投影 18.74ms/估值 0.30ms | — | 弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50) |
| 21 | ↳ 选择：b_112.webp | Q=2.50；状态=settled/low；根(分7+资产90)；叶(分7+资产92.50)；链=choose_card:0c82af4f；依据=counterfactual-standard-execution；耗时 fork 33.87ms/执行 35.60ms/投影 2.62ms/估值 0.05ms | 手牌+1 | ↳ 选择：b_118.webp (2.50)；↳ 选择：b_52.webp (2.50)；↳ 选择：b_107.webp (2.50) |
| 22 | 结束回合 | Q=22.50；状态=settled/low；根(分7+资产92.50)；叶(分7+资产115)；链=end_turn:320f2608；依据=counterfactual-standard-execution；耗时 fork 5.02ms/执行 9.67ms/投影 0.54ms/估值 0.02ms | 钱+3，电+1，手牌+1 | — |
### T02 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 7→10(+3)，电 6→8(+2)，宣传 3→3(0)，数据 2→2(0)，手牌 7→10(+3)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 23 | PASS | Q=2.50；状态=settled/low；根(分8+资产95)；叶(分8+资产97.50)；链=pass:ac4b4ab2→choose_card:16d1974a；依据=counterfactual-standard-execution；耗时 fork 36.22ms/执行 99.73ms/投影 5.37ms/估值 0.09ms | — | 弃牌换1宣传 (0)；弃牌换1移动 (0)；弃牌换1移动 (0) |
| 24 | ↳ 选择：b_52.webp | Q=2.50；状态=settled/low；根(分8+资产95)；叶(分8+资产97.50)；链=choose_card:16d1974a；依据=counterfactual-standard-execution；耗时 fork 30.76ms/执行 29.61ms/投影 2.11ms/估值 0.05ms | 手牌+1 | ↳ 选择：b_107.webp (2.50)；↳ 选择：b_60.webp (2.50)；↳ 选择：b_118.webp (2.50) |
| 25 | 结束回合 | Q=30；状态=settled/low；根(分8+资产97.50)；叶(分8+资产127.50)；链=end_turn:d59ab08c；依据=counterfactual-standard-execution；耗时 fork 4.97ms/执行 10.52ms/投影 0.57ms/估值 0.02ms | 钱+3，电+2，手牌+2 | — |
### T03 绿色玩家

- 分数：10 → 10（0）
- 持有资源：钱 7→9(+2)，电 9→13(+4)，宣传 3→3(0)，数据 1→2(+1)，手牌 6→8(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 26 | PASS | Q=2.50；状态=settled/low；根(分10+资产105)；叶(分10+资产107.50)；链=pass:ff716055→choose_card:63d06eb4；依据=counterfactual-standard-execution；耗时 fork 31.55ms/执行 96.55ms/投影 4.84ms/估值 0.08ms | — | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 27 | ↳ 选择：b_107.webp | Q=2.50；状态=settled/low；根(分10+资产105)；叶(分10+资产107.50)；链=choose_card:63d06eb4；依据=counterfactual-standard-execution；耗时 fork 24.30ms/执行 21.77ms/投影 2.09ms/估值 0.04ms | 手牌+1 | ↳ 选择：b_60.webp (2.50)；↳ 选择：b_118.webp (2.50) |
| 28 | 结束回合 | Q=35；状态=settled/low；根(分10+资产107.50)；叶(分10+资产142.50)；链=end_turn:1f65daa3；依据=counterfactual-standard-execution；耗时 fork 5.27ms/执行 10.26ms/投影 0.54ms/估值 0.02ms | 钱+2，电+4，数据+1，手牌+1 | — |
### T04 白色玩家

- 分数：6 → 6（0）
- 持有资源：钱 9→13(+4)，电 4→5(+1)，宣传 4→4(0)，数据 3→3(0)，手牌 5→7(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 29 | PASS | Q=2.50；状态=settled/low；根(分6+资产95)；叶(分6+资产97.50)；链=pass:a1f33c73→choose_card:0660c4b6；依据=counterfactual-standard-execution；耗时 fork 22.20ms/执行 68.43ms/投影 3.11ms/估值 0.06ms | — | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 30 | ↳ 选择：b_118.webp | Q=2.50；状态=settled/low；根(分6+资产95)；叶(分6+资产97.50)；链=choose_card:0660c4b6；依据=counterfactual-standard-execution；耗时 fork 20.15ms/执行 14.53ms/投影 1.08ms/估值 0.03ms | 手牌+1 | ↳ 选择：b_60.webp (2.50) |
| 31 | 结束回合 | Q=27.50；状态=settled/low；根(分6+资产97.50)；叶(分6+资产125)；链=end_turn:b2f9b29d；依据=counterfactual-standard-execution；耗时 fork 5.35ms/执行 9.50ms/投影 0.53ms/估值 0.02ms | 钱+4，电+1，手牌+1 | — |

## 第 3 轮

### T01 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 10→13(+3)，电 8→10(+2)，宣传 3→3(0)，数据 2→2(0)，手牌 10→13(+3)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 32 | PASS | Q=2.50；状态=settled/low；根(分8+资产127.50)；叶(分8+资产130)；链=pass:ac4b4ab2→choose_card:abb36657；依据=counterfactual-standard-execution；耗时 fork 46.34ms/执行 129.86ms/投影 6.40ms/估值 0.10ms | — | 弃牌换1宣传 (0)；弃牌换1移动 (0)；弃牌换1移动 (0) |
| 33 | ↳ 选择：b_33.webp | Q=2.50；状态=settled/low；根(分8+资产127.50)；叶(分8+资产130)；链=choose_card:44ad8ed9；依据=counterfactual-standard-execution；耗时 fork 35.22ms/执行 37.07ms/投影 2.95ms/估值 0.04ms | 手牌+1 | ↳ 选择：dlc_37.png (2.50)；↳ 选择：b_63.webp (2.50)；↳ 选择：b_110.webp (2.50) |
| 34 | 结束回合 | Q=30；状态=settled/low；根(分8+资产130)；叶(分8+资产160)；链=end_turn:d59ab08c；依据=counterfactual-standard-execution；耗时 fork 5.26ms/执行 9.68ms/投影 0.53ms/估值 0.02ms | 钱+3，电+2，手牌+2 | — |
### T02 绿色玩家

- 分数：10 → 10（0）
- 持有资源：钱 9→11(+2)，电 13→17(+4)，宣传 3→3(0)，数据 2→3(+1)，手牌 8→10(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 35 | PASS | Q=2.50；状态=settled/low；根(分10+资产142.50)；叶(分10+资产145)；链=pass:ff716055→choose_card:f7f24460；依据=counterfactual-standard-execution；耗时 fork 37.26ms/执行 119.59ms/投影 6.74ms/估值 0.09ms | — | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 36 | ↳ 选择：dlc_37.png | Q=2.50；状态=settled/low；根(分10+资产142.50)；叶(分10+资产145)；链=choose_card:445d5eac；依据=counterfactual-standard-execution；耗时 fork 32.08ms/执行 29.32ms/投影 2.16ms/估值 0.04ms | 手牌+1 | ↳ 选择：b_63.webp (2.50)；↳ 选择：b_110.webp (2.50)；↳ 选择：b_40.webp (2.50) |
| 37 | 结束回合 | Q=35；状态=settled/low；根(分10+资产145)；叶(分10+资产180)；链=end_turn:1f65daa3；依据=counterfactual-standard-execution；耗时 fork 5.43ms/执行 9.46ms/投影 0.51ms/估值 0.02ms | 钱+2，电+4，数据+1，手牌+1 | — |
### T03 白色玩家

- 分数：6 → 6（0）
- 持有资源：钱 13→17(+4)，电 5→6(+1)，宣传 4→4(0)，数据 3→3(0)，手牌 7→9(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 38 | PASS | Q=2.50；状态=settled/low；根(分6+资产125)；叶(分6+资产127.50)；链=pass:a1f33c73→choose_card:90794832；依据=counterfactual-standard-execution；耗时 fork 29.55ms/执行 89.43ms/投影 4.31ms/估值 0.06ms | — | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 39 | ↳ 选择：b_110.webp | Q=2.50；状态=settled/low；根(分6+资产125)；叶(分6+资产127.50)；链=choose_card:90794832；依据=counterfactual-standard-execution；耗时 fork 28.95ms/执行 27.04ms/投影 1.67ms/估值 0.06ms | 手牌+1 | ↳ 选择：b_40.webp (2.50)；↳ 选择：b_63.webp (2.50) |
| 40 | 结束回合 | Q=27.50；状态=settled/low；根(分6+资产127.50)；叶(分6+资产155)；链=end_turn:b2f9b29d；依据=counterfactual-standard-execution；耗时 fork 5.90ms/执行 9.58ms/投影 0.65ms/估值 0.02ms | 钱+4，电+1，手牌+1 | — |
### T04 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 9→12(+3)，电 4→5(+1)，宣传 10→10(0)，数据 2→2(0)，手牌 8→10(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 41 | PASS | Q=2.50；状态=settled/low；根(分7+资产115)；叶(分7+资产117.50)；链=pass:c858282e→choose_card:80907762；依据=counterfactual-standard-execution；耗时 fork 86.38ms/执行 454ms/投影 29.93ms/估值 0.30ms | — | 弃牌换1移动 (0)；弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50) |
| 42 | ↳ 选择：b_40.webp | Q=2.50；状态=settled/low；根(分7+资产115)；叶(分7+资产117.50)；链=choose_card:6d9c86a3；依据=counterfactual-standard-execution；耗时 fork 20.26ms/执行 13.92ms/投影 1.06ms/估值 0.03ms | 手牌+1 | ↳ 选择：b_63.webp (2.50) |
| 43 | 结束回合 | Q=22.50；状态=settled/low；根(分7+资产117.50)；叶(分7+资产140)；链=end_turn:320f2608；依据=counterfactual-standard-execution；耗时 fork 5.83ms/执行 11.12ms/投影 0.54ms/估值 0.02ms | 钱+3，电+1，手牌+1 | — |

## 第 4 轮

### T01 绿色玩家

- 分数：10 → 10（0）
- 持有资源：钱 11→13(+2)，电 17→21(+4)，宣传 3→10(+7)，数据 3→4(+1)，手牌 10→4(-6)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 44 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分10+资产180)；叶(分10+资产180)；链=card_corner:182b049a；依据=counterfactual-standard-execution；耗时 fork 19.27ms/执行 117.22ms/投影 6.29ms/估值 0.10ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 45 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分10+资产180)；叶(分10+资产180)；链=card_corner:24cdd7ba；依据=counterfactual-standard-execution；耗时 fork 18.30ms/执行 102.20ms/投影 5.54ms/估值 0.09ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 46 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分10+资产180)；叶(分10+资产180)；链=card_corner:3c857eff；依据=counterfactual-standard-execution；耗时 fork 16.33ms/执行 93.14ms/投影 4.95ms/估值 0.08ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 47 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分10+资产180)；叶(分10+资产180)；链=card_corner:4a053388；依据=counterfactual-standard-execution；耗时 fork 44.80ms/执行 328.21ms/投影 18.22ms/估值 0.33ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 48 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分10+资产180)；叶(分10+资产180)；链=card_corner:986906b0；依据=counterfactual-standard-execution；耗时 fork 42.39ms/执行 314.01ms/投影 17.59ms/估值 0.25ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；PASS (0) |
| 49 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分10+资产180)；叶(分10+资产180)；链=card_corner:909eef4b；依据=counterfactual-standard-execution；耗时 fork 40.69ms/执行 302.96ms/投影 16.49ms/估值 0.23ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；PASS (0)；弃牌换1移动 (-7.50) |
| 50 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分10+资产180)；叶(分10+资产180)；链=card_corner:bfdb9d86；依据=counterfactual-standard-execution；耗时 fork 41.46ms/执行 298.94ms/投影 16.65ms/估值 0.22ms | 宣传+1，手牌-1 | PASS (0)；弃牌换1移动 (-7.50)；弃牌换1移动 (-7.50) |
| 51 | PASS | Q=0；状态=settled/low；根(分10+资产180)；叶(分10+资产180)；链=pass:ff716055；依据=counterfactual-standard-execution；耗时 fork 39.50ms/执行 290.25ms/投影 15.59ms/估值 0.25ms | — | 弃牌换1移动 (-7.50)；弃牌换1移动 (-7.50)；研究 orange2 (-8) |
| 52 | 结束回合 | Q=35；状态=settled/low；根(分10+资产180)；叶(分10+资产215)；链=end_turn:1f65daa3；依据=counterfactual-standard-execution；耗时 fork 5.48ms/执行 9.56ms/投影 0.50ms/估值 0.02ms | 钱+2，电+4，数据+1，手牌+1 | — |
### T02 白色玩家

- 分数：6 → 6（0）
- 持有资源：钱 17→21(+4)，电 6→7(+1)，宣传 4→9(+5)，数据 3→4(+1)，手牌 9→4(-5)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 53 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分6+资产155)；叶(分6+资产155)；链=card_corner:1ce11ed2；依据=counterfactual-standard-execution；耗时 fork 17.42ms/执行 90.95ms/投影 4.23ms/估值 0.07ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1移动 (0) |
| 54 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分6+资产155)；叶(分6+资产155)；链=card_corner:2928d320；依据=counterfactual-standard-execution；耗时 fork 16.42ms/执行 80.33ms/投影 3.70ms/估值 0.07ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1移动 (0) |
| 55 | 弃牌换1移动 | Q=0；状态=settled/low；根(分6+资产155)；叶(分6+资产155)；链=card_corner:9e3c126b；依据=counterfactual-standard-execution；耗时 fork 43.41ms/执行 315.55ms/投影 17.27ms/估值 0.23ms | 数据+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 56 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分6+资产155)；叶(分6+资产155)；链=card_corner:aea03829；依据=counterfactual-standard-execution；耗时 fork 42.68ms/执行 310.61ms/投影 17.72ms/估值 0.20ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；PASS (0) |
| 57 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分6+资产155)；叶(分6+资产155)；链=card_corner:4f94419c；依据=counterfactual-standard-execution；耗时 fork 41.56ms/执行 294.02ms/投影 15.76ms/估值 0.22ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；PASS (0)；研究 orange2 (-8) |
| 58 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分6+资产155)；叶(分6+资产155)；链=card_corner:f05d7300；依据=counterfactual-standard-execution；耗时 fork 40.20ms/执行 281.77ms/投影 15.92ms/估值 0.18ms | 宣传+1，手牌-1 | PASS (0)；研究 orange2 (-8)；研究 orange3 (-8) |
| 59 | PASS | Q=0；状态=settled/low；根(分6+资产155)；叶(分6+资产155)；链=pass:a1f33c73；依据=counterfactual-standard-execution；耗时 fork 37.97ms/执行 273.06ms/投影 14.52ms/估值 0.26ms | — | 研究 orange2 (-8)；研究 orange3 (-8)；发射 (-10) |
| 60 | 结束回合 | Q=27.50；状态=settled/low；根(分6+资产155)；叶(分6+资产182.50)；链=end_turn:b2f9b29d；依据=counterfactual-standard-execution；耗时 fork 5.66ms/执行 10.13ms/投影 0.51ms/估值 0.02ms | 钱+4，电+1，手牌+1 | — |
### T03 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 12→15(+3)，电 5→6(+1)，宣传 10→10(0)，数据 2→4(+2)，手牌 10→9(-1)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 61 | 弃牌换1移动 | Q=0；状态=settled/low；根(分7+资产140)；叶(分7+资产140)；链=card_corner:8f44334f；依据=counterfactual-standard-execution；耗时 fork 49.58ms/执行 364.25ms/投影 19.46ms/估值 0.37ms | 数据+1，手牌-1 | 弃牌换1移动 (0)；PASS (0)；弃牌换1宣传 (-2.50) |
| 62 | 弃牌换1移动 | Q=0；状态=settled/low；根(分7+资产140)；叶(分7+资产140)；链=card_corner:e8826db5；依据=counterfactual-standard-execution；耗时 fork 48.19ms/执行 350.32ms/投影 18.75ms/估值 0.24ms | 数据+1，手牌-1 | PASS (0)；弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50) |
| 63 | PASS | Q=0；状态=settled/low；根(分7+资产140)；叶(分7+资产140)；链=pass:c858282e；依据=counterfactual-standard-execution；耗时 fork 47.48ms/执行 359.80ms/投影 19.49ms/估值 0.26ms | — | 弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50) |
| 64 | 结束回合 | Q=22.50；状态=settled/low；根(分7+资产140)；叶(分7+资产162.50)；链=end_turn:320f2608；依据=counterfactual-standard-execution；耗时 fork 6.36ms/执行 10.56ms/投影 0.55ms/估值 0.02ms | 钱+3，电+1，手牌+1 | — |
### T04 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 13→16(+3)，电 10→12(+2)，宣传 3→10(+7)，数据 2→4(+2)，手牌 13→6(-7)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 65 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分8+资产160)；叶(分8+资产160)；链=card_corner:087098db；依据=counterfactual-standard-execution；耗时 fork 24.29ms/执行 133.42ms/投影 6.80ms/估值 0.09ms | 宣传+1，手牌-1 | 弃牌换1移动 (0)；弃牌换1宣传 (0)；弃牌换1移动 (0) |
| 66 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分8+资产160)；叶(分8+资产160)；链=card_corner:3bd34dda；依据=counterfactual-standard-execution；耗时 fork 21.67ms/执行 124.84ms/投影 6.07ms/估值 0.07ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1宣传 (0) |
| 67 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分8+资产160)；叶(分8+资产160)；链=card_corner:89184bdb；依据=counterfactual-standard-execution；耗时 fork 21.15ms/执行 115.37ms/投影 5.47ms/估值 0.07ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1移动 (0) |
| 68 | 弃牌换1移动 | Q=0；状态=settled/low；根(分8+资产160)；叶(分8+资产160)；链=card_corner:3c540a1f；依据=counterfactual-standard-execution；耗时 fork 48.49ms/执行 341.08ms/投影 18.18ms/估值 0.27ms | 数据+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1移动 (0) |
| 69 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分8+资产160)；叶(分8+资产160)；链=card_corner:85fb49f2；依据=counterfactual-standard-execution；耗时 fork 47.65ms/执行 328.75ms/投影 17.76ms/估值 0.19ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1宣传 (0)；弃牌换1移动 (0) |
| 70 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分8+资产160)；叶(分8+资产160)；链=card_corner:5825a55d；依据=counterfactual-standard-execution；耗时 fork 49.66ms/执行 324.72ms/投影 17.83ms/估值 0.18ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0)；弃牌换1移动 (0)；弃牌换1宣传 (0) |
| 71 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分8+资产160)；叶(分8+资产160)；链=card_corner:9a0eeaf4；依据=counterfactual-standard-execution；耗时 fork 46.85ms/执行 312.47ms/投影 16.57ms/估值 0.18ms | 宣传+1，手牌-1 | 弃牌换1移动 (0)；弃牌换1宣传 (0)；PASS (0) |
| 72 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分8+资产160)；叶(分8+资产160)；链=card_corner:3108808e；依据=counterfactual-standard-execution；耗时 fork 44.76ms/执行 305.88ms/投影 15.50ms/估值 0.17ms | 宣传+1，手牌-1 | 弃牌换1移动 (0)；PASS (0)；研究 orange3 (-8) |
| 73 | 弃牌换1移动 | Q=0；状态=settled/low；根(分8+资产160)；叶(分8+资产160)；链=card_corner:b35d500c；依据=counterfactual-standard-execution；耗时 fork 42.84ms/执行 290.41ms/投影 15.09ms/估值 0.15ms | 数据+1，手牌-1 | PASS (0)；研究 orange3 (-8)；研究 orange2 (-8) |
| 74 | PASS | Q=0；状态=settled/low；根(分8+资产160)；叶(分8+资产160)；链=pass:ac4b4ab2；依据=counterfactual-standard-execution；耗时 fork 41.35ms/执行 281.03ms/投影 14.52ms/估值 0.15ms | — | 研究 orange3 (-8)；研究 orange2 (-8)；发射 (-10) |
| 75 | 结束回合 | Q=30；状态=settled/low；根(分8+资产160)；叶(分8+资产190)；链=end_turn:d59ab08c；依据=counterfactual-standard-execution；耗时 fork 5.37ms/执行 10.75ms/投影 0.57ms/估值 0.01ms | 钱+3，电+2，手牌+2 | — |

## 第 5 轮

### T01 白色玩家

- 分数：6 → 6（0）
- 持有资源：钱 21→25(+4)，电 7→8(+1)，宣传 9→10(+1)，数据 4→4(0)，手牌 4→4(0)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 76 | 弃牌换1宣传 | Q=0；状态=settled/low；根(分6+资产182.50)；叶(分6+资产182.50)；链=card_corner:6e1d1448；依据=counterfactual-standard-execution；耗时 fork 41.03ms/执行 287.33ms/投影 14.93ms/估值 0.16ms | 宣传+1，手牌-1 | PASS (0)；研究 orange2 (-8)；研究 orange3 (-8) |
| 77 | PASS | Q=0；状态=settled/low；根(分6+资产182.50)；叶(分6+资产182.50)；链=pass:a1f33c73；依据=counterfactual-standard-execution；耗时 fork 39.72ms/执行 277.16ms/投影 14.54ms/估值 0.15ms | — | 研究 orange2 (-8)；研究 orange3 (-8)；发射 (-10) |
| 78 | 结束回合 | Q=27.50；状态=settled/low；根(分6+资产182.50)；叶(分6+资产210)；链=end_turn:b2f9b29d；依据=counterfactual-standard-execution；耗时 fork 5.59ms/执行 10.44ms/投影 0.58ms/估值 0.02ms | 钱+4，电+1，手牌+1 | — |
### T02 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 15→18(+3)，电 6→7(+1)，宣传 10→10(0)，数据 4→4(0)，手牌 9→10(+1)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 79 | PASS | Q=0；状态=settled/low；根(分7+资产162.50)；叶(分7+资产162.50)；链=pass:c858282e；依据=counterfactual-standard-execution；耗时 fork 48.91ms/执行 360.48ms/投影 19.61ms/估值 0.18ms | — | 弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50)；弃牌换1宣传 (-2.50) |
| 80 | 结束回合 | Q=22.50；状态=settled/low；根(分7+资产162.50)；叶(分7+资产185)；链=end_turn:320f2608；依据=counterfactual-standard-execution；耗时 fork 5.31ms/执行 10.32ms/投影 0.52ms/估值 0.02ms | 钱+3，电+1，手牌+1 | — |
### T03 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 16→19(+3)，电 12→14(+2)，宣传 10→10(0)，数据 4→4(0)，手牌 6→8(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 81 | PASS | Q=0；状态=settled/low；根(分8+资产190)；叶(分8+资产190)；链=pass:ac4b4ab2；依据=counterfactual-standard-execution；耗时 fork 45.94ms/执行 303.52ms/投影 15.46ms/估值 0.17ms | — | 研究 orange3 (-8)；研究 orange2 (-8)；发射 (-10) |
| 82 | 结束回合 | Q=30；状态=settled/low；根(分8+资产190)；叶(分8+资产220)；链=end_turn:d59ab08c；依据=counterfactual-standard-execution；耗时 fork 5.43ms/执行 10.79ms/投影 0.56ms/估值 0.02ms | 钱+3，电+2，手牌+2 | — |
### T04 绿色玩家

- 分数：10 → 10（0）
- 持有资源：钱 13→15(+2)，电 21→25(+4)，宣传 10→10(0)，数据 4→5(+1)，手牌 4→5(+1)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 83 | PASS | Q=0；状态=settled/low；根(分10+资产215)；叶(分10+资产215)；链=pass:ff716055；依据=counterfactual-standard-execution；耗时 fork 41.65ms/执行 314.06ms/投影 16.77ms/估值 0.16ms | — | 弃牌换1宣传 (-2.50)；研究 orange2 (-8)；研究 orange3 (-8) |
| 84 | 结束回合 | Q=-215；状态=settled/low；根(分10+资产215)；叶(分10+资产0)；链=end_turn:1f65daa3；依据=counterfactual-standard-execution；耗时 fork 5.40ms/执行 9.90ms/投影 0.62ms/估值 0.02ms | 钱+2，电+4，数据+1，手牌+1 | — |

## 最终分数、目标差距与剩余资源

| 名次 | 机器人 | 总分 | 距 100 分 | 钱 | 电 | 宣传 | 数据 | 手牌 | 预留牌 |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 绿色玩家 | 10 | -90 | 15 | 25 | 10 | 5 | 5 | 0 |
| 2 | 棕色玩家 | 8 | -92 | 19 | 14 | 10 | 4 | 8 | 0 |
| 3 | 蓝色玩家 | 7 | -93 | 18 | 7 | 10 | 4 | 10 | 0 |
| 4 | 白色玩家 | 6 | -94 | 25 | 8 | 10 | 4 | 4 | 0 |
