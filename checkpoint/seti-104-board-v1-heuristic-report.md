# seti-104-board-v1 机器人逐回合行动报告

- seed：`seti-104-official-v1`
- board fingerprint：`9c8d340cfca6c745565e28b30c1a718459b808b2b8f7b0841a88bfc357a8115d`
- Policy 决策数：85
- 游戏回合数：20
- 价值口径：`Q` 只读取同一 Rule Composition/Standard Action/Effect Session/Decision/commit 链真实执行后的叶状态；已兑现分 1:1，未兑现资产使用 θ₀
- 诊断目标：初次接触玩家约 100 分；最终表同时列出各机器人的目标差距
- 固定反例：R1 T04 绿色登陆土星的标准链为 `land -> choose_target(yellow trace)`；登陆先兑现 8 分与首次 2 数据，两个痕迹槽叶分别为 13/11 分
- 同根 parity 门禁：`orbit/place_data/research_tech/play_card/scan/launch/move/pass`，以及 `analyze -> blue trace` 两叶，均逐 leaf 对照直接标准提交

## 开局待决选择

- 白色玩家：↳ 选择：巨麦哲伦望远镜
- 白色玩家：↳ 选择：b_1.webp
- 棕色玩家：↳ 选择：b_73.webp
- 棕色玩家：↳ 选择：dlc_35.png
- 绿色玩家：↳ 选择：b_130.webp
- 绿色玩家：↳ 选择：b_105.webp
- 绿色玩家：↳ 选择：dlc_3.png

## 自动诊断摘要

- 20 个玩家回合中，20 个回合没有获得分数。
- 58 个可计算 Q 的非结束决策中，33 个与至少一个备选动作同分，8 个选中动作的 Q 不大于 0；这两项可直接定位估值区分度不足。

## 第 1 轮

### T01 白色玩家

- 分数：6 → 6（0）
- 持有资源：钱 3→5(+2)，电 4→6(+2)，宣传 4→4(0)，数据 3→3(0)，手牌 4→7(+3)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 8 | PASS | Q=1.50；状态=settled/low；根(分6+资产31)；叶(分6+资产32.50)；链=pass:a1f33c73→choose_card:ec9d04d4；依据=counterfactual-standard-execution；耗时 fork 33.15ms/执行 85.46ms/投影 4.81ms/估值 0.10ms | — | 弃牌换1宣传 (0.50)；弃牌换1移动 (0.50)；弃牌换1移动 (0.50) |
| 9 | ↳ 选择：dlc_24.png | Q=1.50；状态=settled/low；根(分6+资产31)；叶(分6+资产32.50)；链=choose_card:4708c91c；依据=counterfactual-standard-execution；耗时 fork 33.17ms/执行 32.05ms/投影 2.39ms/估值 0.05ms | 手牌+1 | ↳ 选择：b_12.webp (1.50)；↳ 选择：b_117.webp (1.50)；↳ 选择：b_24.webp (1.50) |
| 10 | 结束回合 | Q=9；状态=settled/low；根(分6+资产32.50)；叶(分6+资产41.50)；链=end_turn:b2f9b29d；依据=counterfactual-standard-execution；耗时 fork 4.79ms/执行 9.59ms/投影 0.49ms/估值 0.02ms | 钱+2，电+2，手牌+2 | — |
### T02 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 3→6(+3)，电 2→3(+1)，宣传 10→10(0)，数据 2→2(0)，手牌 4→6(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 11 | PASS | Q=1.50；状态=settled/low；根(分7+资产37)；叶(分7+资产38.50)；链=pass:c858282e→choose_card:10304ac6；依据=counterfactual-standard-execution；耗时 fork 61.59ms/执行 334.21ms/投影 18.68ms/估值 0.28ms | — | 弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50) |
| 12 | ↳ 选择：b_128.webp | Q=1.50；状态=settled/low；根(分7+资产37)；叶(分7+资产38.50)；链=choose_card:10304ac6；依据=counterfactual-standard-execution；耗时 fork 26.84ms/执行 25.87ms/投影 1.93ms/估值 0.04ms | 手牌+1 | ↳ 选择：b_24.webp (1.50)；↳ 选择：b_117.webp (1.50)；↳ 选择：b_12.webp (1.50) |
| 13 | 结束回合 | Q=6.50；状态=settled/low；根(分7+资产38.50)；叶(分7+资产45)；链=end_turn:320f2608；依据=counterfactual-standard-execution；耗时 fork 4.83ms/执行 8.93ms/投影 0.48ms/估值 0.02ms | 钱+3，电+1，手牌+1 | — |
### T03 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 3→5(+2)，电 4→7(+3)，宣传 3→3(0)，数据 3→3(0)，手牌 4→7(+3)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 14 | PASS | Q=1.50；状态=settled/low；根(分8+资产29)；叶(分8+资产30.50)；链=pass:ac4b4ab2→choose_card:bc063520；依据=counterfactual-standard-execution；耗时 fork 27.51ms/执行 61.81ms/投影 2.91ms/估值 0.09ms | — | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；发射 (-2) |
| 15 | ↳ 选择：b_117.webp | Q=1.50；状态=settled/low；根(分8+资产29)；叶(分8+资产30.50)；链=choose_card:bc063520；依据=counterfactual-standard-execution；耗时 fork 22.05ms/执行 19.57ms/投影 1.43ms/估值 0.03ms | 手牌+1 | ↳ 选择：b_24.webp (1.50)；↳ 选择：b_12.webp (1.50) |
| 16 | 结束回合 | Q=11；状态=settled/low；根(分8+资产30.50)；叶(分8+资产41.50)；链=end_turn:d59ab08c；依据=counterfactual-standard-execution；耗时 fork 4.93ms/执行 8.41ms/投影 0.48ms/估值 0.02ms | 钱+2，电+3，手牌+2 | — |
### T04 绿色玩家

- 分数：9 → 9（0）
- 持有资源：钱 3→4(+1)，电 6→10(+4)，宣传 3→3(0)，数据 2→2(0)，手牌 3→5(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 17 | PASS | Q=1.50；状态=settled/low；根(分9+资产29.50)；叶(分9+资产31)；链=pass:ff716055→choose_card:8d52fb62；依据=counterfactual-standard-execution；耗时 fork 18.41ms/执行 56.30ms/投影 2.90ms/估值 0.05ms | — | 弃牌换1移动 (0.50)；弃牌换1宣传 (0.50)；弃牌换1移动 (0.50) |
| 18 | ↳ 选择：b_12.webp | Q=1.50；状态=settled/low；根(分9+资产29.50)；叶(分9+资产31)；链=choose_card:03718679；依据=counterfactual-standard-execution；耗时 fork 18.07ms/执行 13.49ms/投影 0.97ms/估值 0.03ms | 手牌+1 | ↳ 选择：b_24.webp (1.50) |
| 19 | 结束回合 | Q=10.50；状态=settled/low；根(分9+资产31)；叶(分9+资产41.50)；链=end_turn:1f65daa3；依据=counterfactual-standard-execution；耗时 fork 4.86ms/执行 9.82ms/投影 0.50ms/估值 0.02ms | 钱+1，电+4，手牌+1 | — |

## 第 2 轮

### T01 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 6→9(+3)，电 3→4(+1)，宣传 10→10(0)，数据 2→2(0)，手牌 6→8(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 20 | PASS | Q=1.50；状态=settled/low；根(分7+资产45)；叶(分7+资产46.50)；链=pass:c858282e→choose_card:481577ed；依据=counterfactual-standard-execution；耗时 fork 64.41ms/执行 324.08ms/投影 18.26ms/估值 0.28ms | — | 弃牌换1移动 (0.50)；弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50) |
| 21 | ↳ 选择：b_112.webp | Q=1.50；状态=settled/low；根(分7+资产45)；叶(分7+资产46.50)；链=choose_card:0c82af4f；依据=counterfactual-standard-execution；耗时 fork 32.49ms/执行 33.94ms/投影 2.43ms/估值 0.05ms | 手牌+1 | ↳ 选择：b_118.webp (1.50)；↳ 选择：b_52.webp (1.50)；↳ 选择：b_107.webp (1.50) |
| 22 | 结束回合 | Q=6.50；状态=settled/low；根(分7+资产46.50)；叶(分7+资产53)；链=end_turn:320f2608；依据=counterfactual-standard-execution；耗时 fork 4.82ms/执行 9.04ms/投影 0.50ms/估值 0.02ms | 钱+3，电+1，手牌+1 | — |
### T02 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 5→7(+2)，电 7→10(+3)，宣传 3→3(0)，数据 3→3(0)，手牌 7→10(+3)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 23 | PASS | Q=1.50；状态=settled/low；根(分8+资产41.50)；叶(分8+资产43)；链=pass:ac4b4ab2→choose_card:16d1974a；依据=counterfactual-standard-execution；耗时 fork 32.41ms/执行 79.10ms/投影 3.44ms/估值 0.05ms | — | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；发射 (-2) |
| 24 | ↳ 选择：b_52.webp | Q=1.50；状态=settled/low；根(分8+资产41.50)；叶(分8+资产43)；链=choose_card:16d1974a；依据=counterfactual-standard-execution；耗时 fork 27.77ms/执行 26.53ms/投影 1.96ms/估值 0.04ms | 手牌+1 | ↳ 选择：b_107.webp (1.50)；↳ 选择：b_60.webp (1.50)；↳ 选择：b_118.webp (1.50) |
| 25 | 结束回合 | Q=11；状态=settled/low；根(分8+资产43)；叶(分8+资产54)；链=end_turn:d59ab08c；依据=counterfactual-standard-execution；耗时 fork 5.40ms/执行 8.69ms/投影 0.50ms/估值 0.02ms | 钱+2，电+3，手牌+2 | — |
### T03 绿色玩家

- 分数：9 → 9（0）
- 持有资源：钱 4→5(+1)，电 10→14(+4)，宣传 3→3(0)，数据 2→2(0)，手牌 5→7(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 26 | PASS | Q=1.50；状态=settled/low；根(分9+资产41.50)；叶(分9+资产43)；链=pass:ff716055→choose_card:63d06eb4；依据=counterfactual-standard-execution；耗时 fork 25.92ms/执行 76.45ms/投影 3.97ms/估值 0.06ms | — | 弃牌换1宣传 (0.50)；弃牌换1移动 (0.50)；弃牌换1宣传 (0.50) |
| 27 | ↳ 选择：b_107.webp | Q=1.50；状态=settled/low；根(分9+资产41.50)；叶(分9+资产43)；链=choose_card:63d06eb4；依据=counterfactual-standard-execution；耗时 fork 23.42ms/执行 20.01ms/投影 1.49ms/估值 0.04ms | 手牌+1 | ↳ 选择：b_60.webp (1.50)；↳ 选择：b_118.webp (1.50) |
| 28 | 结束回合 | Q=10.50；状态=settled/low；根(分9+资产43)；叶(分9+资产53.50)；链=end_turn:1f65daa3；依据=counterfactual-standard-execution；耗时 fork 5.44ms/执行 9.03ms/投影 0.51ms/估值 0.02ms | 钱+1，电+4，手牌+1 | — |
### T04 白色玩家

- 分数：6 → 6（0）
- 持有资源：钱 5→7(+2)，电 6→8(+2)，宣传 4→4(0)，数据 3→3(0)，手牌 7→10(+3)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 29 | PASS | Q=1.50；状态=settled/low；根(分6+资产41.50)；叶(分6+资产43)；链=pass:a1f33c73→choose_card:0660c4b6；依据=counterfactual-standard-execution；耗时 fork 24.16ms/执行 89.07ms/投影 4.55ms/估值 0.06ms | — | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50) |
| 30 | ↳ 选择：b_118.webp | Q=1.50；状态=settled/low；根(分6+资产41.50)；叶(分6+资产43)；链=choose_card:0660c4b6；依据=counterfactual-standard-execution；耗时 fork 18.72ms/执行 13.74ms/投影 1.01ms/估值 0.02ms | 手牌+1 | ↳ 选择：b_60.webp (1.50) |
| 31 | 结束回合 | Q=9；状态=settled/low；根(分6+资产43)；叶(分6+资产52)；链=end_turn:b2f9b29d；依据=counterfactual-standard-execution；耗时 fork 5.15ms/执行 9.01ms/投影 0.50ms/估值 0.02ms | 钱+2，电+2，手牌+2 | — |

## 第 3 轮

### T01 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 7→9(+2)，电 10→13(+3)，宣传 3→3(0)，数据 3→3(0)，手牌 10→13(+3)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 32 | PASS | Q=1.50；状态=settled/low；根(分8+资产54)；叶(分8+资产55.50)；链=pass:ac4b4ab2→choose_card:abb36657；依据=counterfactual-standard-execution；耗时 fork 41.76ms/执行 110.58ms/投影 5.08ms/估值 0.28ms | — | 弃牌换1宣传 (0.50)；弃牌换1移动 (0.50)；弃牌换1宣传 (0.50) |
| 33 | ↳ 选择：b_33.webp | Q=1.50；状态=settled/low；根(分8+资产54)；叶(分8+资产55.50)；链=choose_card:44ad8ed9；依据=counterfactual-standard-execution；耗时 fork 33.89ms/执行 34.24ms/投影 2.53ms/估值 0.04ms | 手牌+1 | ↳ 选择：dlc_37.png (1.50)；↳ 选择：b_63.webp (1.50)；↳ 选择：b_110.webp (1.50) |
| 34 | 结束回合 | Q=11；状态=settled/low；根(分8+资产55.50)；叶(分8+资产66.50)；链=end_turn:d59ab08c；依据=counterfactual-standard-execution；耗时 fork 5.14ms/执行 9.33ms/投影 0.51ms/估值 0.02ms | 钱+2，电+3，手牌+2 | — |
### T02 绿色玩家

- 分数：9 → 9（0）
- 持有资源：钱 5→6(+1)，电 14→18(+4)，宣传 3→3(0)，数据 2→2(0)，手牌 7→9(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 35 | PASS | Q=1.50；状态=settled/low；根(分9+资产53.50)；叶(分9+资产55)；链=pass:ff716055→choose_card:f7f24460；依据=counterfactual-standard-execution；耗时 fork 35.74ms/执行 100.08ms/投影 5.19ms/估值 0.06ms | — | 弃牌换1宣传 (0.50)；弃牌换1移动 (0.50)；弃牌换1宣传 (0.50) |
| 36 | ↳ 选择：dlc_37.png | Q=1.50；状态=settled/low；根(分9+资产53.50)；叶(分9+资产55)；链=choose_card:445d5eac；依据=counterfactual-standard-execution；耗时 fork 28.62ms/执行 27.31ms/投影 2.02ms/估值 0.04ms | 手牌+1 | ↳ 选择：b_63.webp (1.50)；↳ 选择：b_110.webp (1.50)；↳ 选择：b_40.webp (1.50) |
| 37 | 结束回合 | Q=10.50；状态=settled/low；根(分9+资产55)；叶(分9+资产65.50)；链=end_turn:1f65daa3；依据=counterfactual-standard-execution；耗时 fork 5.35ms/执行 8.78ms/投影 0.51ms/估值 0.02ms | 钱+1，电+4，手牌+1 | — |
### T03 白色玩家

- 分数：6 → 6（0）
- 持有资源：钱 7→9(+2)，电 8→10(+2)，宣传 4→4(0)，数据 3→3(0)，手牌 10→13(+3)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 38 | PASS | Q=1.50；状态=settled/low；根(分6+资产52)；叶(分6+资产53.50)；链=pass:a1f33c73→choose_card:90794832；依据=counterfactual-standard-execution；耗时 fork 32.12ms/执行 125.83ms/投影 6.82ms/估值 0.08ms | — | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50) |
| 39 | ↳ 选择：b_110.webp | Q=1.50；状态=settled/low；根(分6+资产52)；叶(分6+资产53.50)；链=choose_card:90794832；依据=counterfactual-standard-execution；耗时 fork 24.48ms/执行 20.75ms/投影 1.56ms/估值 0.03ms | 手牌+1 | ↳ 选择：b_40.webp (1.50)；↳ 选择：b_63.webp (1.50) |
| 40 | 结束回合 | Q=9；状态=settled/low；根(分6+资产53.50)；叶(分6+资产62.50)；链=end_turn:b2f9b29d；依据=counterfactual-standard-execution；耗时 fork 6.67ms/执行 10.13ms/投影 0.53ms/估值 0.02ms | 钱+2，电+2，手牌+2 | — |
### T04 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 9→12(+3)，电 4→5(+1)，宣传 10→10(0)，数据 2→2(0)，手牌 8→10(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 41 | PASS | Q=1.50；状态=settled/low；根(分7+资产53)；叶(分7+资产54.50)；链=pass:c858282e→choose_card:80907762；依据=counterfactual-standard-execution；耗时 fork 53.22ms/执行 339.02ms/投影 18.64ms/估值 0.21ms | — | 弃牌换1移动 (0.50)；弃牌换1移动 (0.50)；弃牌换1宣传 (-1.50) |
| 42 | ↳ 选择：b_40.webp | Q=1.50；状态=settled/low；根(分7+资产53)；叶(分7+资产54.50)；链=choose_card:6d9c86a3；依据=counterfactual-standard-execution；耗时 fork 18.20ms/执行 14.46ms/投影 1.03ms/估值 0.28ms | 手牌+1 | ↳ 选择：b_63.webp (1.50) |
| 43 | 结束回合 | Q=6.50；状态=settled/low；根(分7+资产54.50)；叶(分7+资产61)；链=end_turn:320f2608；依据=counterfactual-standard-execution；耗时 fork 5.14ms/执行 9.31ms/投影 0.52ms/估值 0.02ms | 钱+3，电+1，手牌+1 | — |

## 第 4 轮

### T01 绿色玩家

- 分数：9 → 9（0）
- 持有资源：钱 6→7(+1)，电 18→22(+4)，宣传 3→7(+4)，数据 2→5(+3)，手牌 9→3(-6)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 44 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分9+资产65.50)；叶(分9+资产66)；链=card_corner:4a053388；依据=counterfactual-standard-execution；耗时 fork 16.76ms/执行 95.74ms/投影 4.69ms/估值 0.08ms | 宣传+1，手牌-1 | 弃牌换1移动 (0.50)；弃牌换1宣传 (0.50)；弃牌换1移动 (0.50) |
| 45 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分9+资产66)；叶(分9+资产66.50)；链=card_corner:3bb401d8；依据=counterfactual-standard-execution；耗时 fork 16.46ms/执行 83.69ms/投影 4.81ms/估值 0.09ms | 数据+1，手牌-1 | 弃牌换1移动 (0.50)；弃牌换1宣传 (0.50)；弃牌换1移动 (0.50) |
| 46 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分9+资产66.50)；叶(分9+资产67)；链=card_corner:68ffbc9a；依据=counterfactual-standard-execution；耗时 fork 20.12ms/执行 104.72ms/投影 5.44ms/估值 0.06ms | 数据+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1移动 (0.50)；弃牌换1宣传 (0.50) |
| 47 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分9+资产67)；叶(分9+资产67.50)；链=card_corner:11dd6e27；依据=counterfactual-standard-execution；耗时 fork 13.16ms/执行 66.93ms/投影 3.53ms/估值 0.06ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1移动 (0.50) |
| 48 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分9+资产67.50)；叶(分9+资产68)；链=card_corner:6e67e6b3；依据=counterfactual-standard-execution；耗时 fork 13.62ms/执行 60.33ms/投影 2.77ms/估值 0.05ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1移动 (0.50)；PASS (0) |
| 49 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分9+资产68)；叶(分9+资产68.50)；链=card_corner:a1aa5b8d；依据=counterfactual-standard-execution；耗时 fork 42.48ms/执行 305.89ms/投影 15.86ms/估值 0.20ms | 数据+1，手牌-1 | 弃牌换1宣传 (0.50)；PASS (0)；发射 (-2) |
| 50 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分9+资产68.50)；叶(分9+资产69)；链=card_corner:dd02bd71；依据=counterfactual-standard-execution；耗时 fork 39.69ms/执行 284.69ms/投影 14.51ms/估值 0.18ms | 宣传+1，手牌-1 | PASS (0)；发射 (-2)；研究 blue1（蓝槽 2） (-7) |
| 51 | PASS | Q=0；状态=settled/low；根(分9+资产69)；叶(分9+资产69)；链=pass:ff716055；依据=counterfactual-standard-execution；耗时 fork 37.20ms/执行 264.76ms/投影 14.07ms/估值 0.17ms | — | 发射 (-2)；研究 blue1（蓝槽 2） (-7)；研究 blue1（蓝槽 4） (-7) |
| 52 | 结束回合 | Q=10.50；状态=settled/low；根(分9+资产69)；叶(分9+资产79.50)；链=end_turn:1f65daa3；依据=counterfactual-standard-execution；耗时 fork 5.80ms/执行 9.12ms/投影 0.61ms/估值 0.06ms | 钱+1，电+4，手牌+1 | — |
### T02 白色玩家

- 分数：6 → 6（0）
- 持有资源：钱 9→11(+2)，电 10→12(+2)，宣传 4→10(+6)，数据 3→5(+2)，手牌 13→7(-6)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 53 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分6+资产62.50)；叶(分6+资产63)；链=card_corner:26680dea；依据=counterfactual-standard-execution；耗时 fork 22.26ms/执行 144.54ms/投影 8.14ms/估值 0.11ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50) |
| 54 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分6+资产63)；叶(分6+资产63.50)；链=card_corner:17fd563d；依据=counterfactual-standard-execution；耗时 fork 20.22ms/执行 135.18ms/投影 6.94ms/估值 0.10ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50) |
| 55 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分6+资产63.50)；叶(分6+资产64)；链=card_corner:1ce11ed2；依据=counterfactual-standard-execution；耗时 fork 48.22ms/执行 364.91ms/投影 20.23ms/估值 0.65ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50) |
| 56 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分6+资产64)；叶(分6+资产64.50)；链=card_corner:1828d52e；依据=counterfactual-standard-execution；耗时 fork 45.78ms/执行 343.73ms/投影 19.09ms/估值 0.25ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50) |
| 57 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分6+资产64.50)；叶(分6+资产65)；链=card_corner:39e0bf18；依据=counterfactual-standard-execution；耗时 fork 46.27ms/执行 339.96ms/投影 19.33ms/估值 0.29ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50) |
| 58 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分6+资产65)；叶(分6+资产65.50)；链=card_corner:08f257dd；依据=counterfactual-standard-execution；耗时 fork 44.52ms/执行 325.04ms/投影 18.16ms/估值 0.20ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1移动 (0.50) |
| 59 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分6+资产65.50)；叶(分6+资产66)；链=card_corner:a9464d93；依据=counterfactual-standard-execution；耗时 fork 42.95ms/执行 318.10ms/投影 17.97ms/估值 0.22ms | 数据+1，手牌-1 | 弃牌换1移动 (0.50)；PASS (0)；弃牌换1宣传 (-1.50) |
| 60 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分6+资产66)；叶(分6+资产66.50)；链=card_corner:e17892ae；依据=counterfactual-standard-execution；耗时 fork 42.28ms/执行 310.74ms/投影 17.13ms/估值 0.19ms | 数据+1，手牌-1 | PASS (0)；弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50) |
| 61 | PASS | Q=0；状态=settled/low；根(分6+资产66.50)；叶(分6+资产66.50)；链=pass:a1f33c73；依据=counterfactual-standard-execution；耗时 fork 42.53ms/执行 308.39ms/投影 17.11ms/估值 0.20ms | — | 弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50) |
| 62 | 结束回合 | Q=9；状态=settled/low；根(分6+资产66.50)；叶(分6+资产75.50)；链=end_turn:b2f9b29d；依据=counterfactual-standard-execution；耗时 fork 5.37ms/执行 10.28ms/投影 0.57ms/估值 0.02ms | 钱+2，电+2，手牌+2 | — |
### T03 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 12→15(+3)，电 5→6(+1)，宣传 10→10(0)，数据 2→4(+2)，手牌 10→9(-1)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 63 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分7+资产61)；叶(分7+资产61.50)；链=card_corner:7c8e15ed；依据=counterfactual-standard-execution；耗时 fork 50.45ms/执行 368.53ms/投影 20.19ms/估值 0.23ms | 数据+1，手牌-1 | 弃牌换1移动 (0.50)；PASS (0)；弃牌换1宣传 (-1.50) |
| 64 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分7+资产61.50)；叶(分7+资产62)；链=card_corner:2f9e8a32；依据=counterfactual-standard-execution；耗时 fork 46.05ms/执行 343.50ms/投影 18.94ms/估值 0.21ms | 数据+1，手牌-1 | PASS (0)；弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50) |
| 65 | PASS | Q=0；状态=settled/low；根(分7+资产62)；叶(分7+资产62)；链=pass:c858282e；依据=counterfactual-standard-execution；耗时 fork 45.67ms/执行 339.56ms/投影 18.77ms/估值 0.20ms | — | 弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50) |
| 66 | 结束回合 | Q=6.50；状态=settled/low；根(分7+资产62)；叶(分7+资产68.50)；链=end_turn:320f2608；依据=counterfactual-standard-execution；耗时 fork 5.76ms/执行 10.16ms/投影 0.54ms/估值 0.01ms | 钱+3，电+1，手牌+1 | — |
### T04 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 9→11(+2)，电 13→16(+3)，宣传 3→8(+5)，数据 3→5(+2)，手牌 13→8(-5)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 67 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分8+资产66.50)；叶(分8+资产67)；链=card_corner:087098db；依据=counterfactual-standard-execution；耗时 fork 22.43ms/执行 114.01ms/投影 5.45ms/估值 0.06ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1移动 (0.50)；弃牌换1宣传 (0.50) |
| 68 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分8+资产67)；叶(分8+资产67.50)；链=card_corner:3bd34dda；依据=counterfactual-standard-execution；耗时 fork 21.84ms/执行 117.41ms/投影 5.81ms/估值 0.06ms | 宣传+1，手牌-1 | 弃牌换1移动 (0.50)；弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50) |
| 69 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分8+资产67.50)；叶(分8+资产68)；链=card_corner:712f1e6f；依据=counterfactual-standard-execution；耗时 fork 20.34ms/执行 99.34ms/投影 4ms/估值 0.06ms | 数据+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1移动 (0.50)；弃牌换1宣传 (0.50) |
| 70 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分8+资产68)；叶(分8+资产68.50)；链=card_corner:813b9719；依据=counterfactual-standard-execution；耗时 fork 18.82ms/执行 85.76ms/投影 3.33ms/估值 0.06ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1移动 (0.50) |
| 71 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分8+资产68.50)；叶(分8+资产69)；链=card_corner:5100f8b6；依据=counterfactual-standard-execution；耗时 fork 51.58ms/执行 347.90ms/投影 17.78ms/估值 0.19ms | 数据+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；PASS (0) |
| 72 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分8+资产69)；叶(分8+资产69.50)；链=card_corner:69f3057e；依据=counterfactual-standard-execution；耗时 fork 46.64ms/执行 308.69ms/投影 15.70ms/估值 0.16ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；PASS (0)；发射 (-2) |
| 73 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分8+资产69.50)；叶(分8+资产70)；链=card_corner:d4200691；依据=counterfactual-standard-execution；耗时 fork 45.12ms/执行 299.95ms/投影 15.12ms/估值 0.18ms | 宣传+1，手牌-1 | PASS (0)；发射 (-2)；研究 blue1（蓝槽 2） (-7) |
| 74 | PASS | Q=0；状态=settled/low；根(分8+资产70)；叶(分8+资产70)；链=pass:ac4b4ab2；依据=counterfactual-standard-execution；耗时 fork 43.26ms/执行 286.20ms/投影 14.78ms/估值 0.18ms | — | 发射 (-2)；研究 blue1（蓝槽 2） (-7)；研究 blue4（蓝槽 2） (-7) |
| 75 | 结束回合 | Q=11；状态=settled/low；根(分8+资产70)；叶(分8+资产81)；链=end_turn:d59ab08c；依据=counterfactual-standard-execution；耗时 fork 5.14ms/执行 10.01ms/投影 0.55ms/估值 0.01ms | 钱+2，电+3，手牌+2 | — |

## 第 5 轮

### T01 白色玩家

- 分数：6 → 6（0）
- 持有资源：钱 11→13(+2)，电 12→14(+2)，宣传 10→10(0)，数据 5→5(0)，手牌 7→9(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 76 | PASS | Q=0；状态=settled/low；根(分6+资产75.50)；叶(分6+资产75.50)；链=pass:a1f33c73；依据=counterfactual-standard-execution；耗时 fork 46.30ms/执行 327.26ms/投影 17.25ms/估值 0.15ms | — | 弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50) |
| 77 | 结束回合 | Q=9；状态=settled/low；根(分6+资产75.50)；叶(分6+资产84.50)；链=end_turn:b2f9b29d；依据=counterfactual-standard-execution；耗时 fork 5.22ms/执行 10.12ms/投影 0.56ms/估值 0.01ms | 钱+2，电+2，手牌+2 | — |
### T02 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 15→18(+3)，电 6→7(+1)，宣传 10→10(0)，数据 4→4(0)，手牌 9→10(+1)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 78 | PASS | Q=0；状态=settled/low；根(分7+资产68.50)；叶(分7+资产68.50)；链=pass:c858282e；依据=counterfactual-standard-execution；耗时 fork 49.12ms/执行 367.25ms/投影 20.03ms/估值 0.21ms | — | 弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50) |
| 79 | 结束回合 | Q=6.50；状态=settled/low；根(分7+资产68.50)；叶(分7+资产75)；链=end_turn:320f2608；依据=counterfactual-standard-execution；耗时 fork 5.96ms/执行 10.66ms/投影 0.56ms/估值 0.02ms | 钱+3，电+1，手牌+1 | — |
### T03 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 11→13(+2)，电 16→19(+3)，宣传 8→9(+1)，数据 5→6(+1)，手牌 8→8(0)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 80 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分8+资产81)；叶(分8+资产81.50)；链=card_corner:2a7d2f36；依据=counterfactual-standard-execution；耗时 fork 46.48ms/执行 320.31ms/投影 15.90ms/估值 0.16ms | 宣传+1，手牌-1 | 弃牌换1移动 (0.50)；PASS (0)；发射 (-2) |
| 81 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分8+资产81.50)；叶(分8+资产82)；链=card_corner:73104be3；依据=counterfactual-standard-execution；耗时 fork 45.33ms/执行 309.98ms/投影 15.88ms/估值 0.14ms | 数据+1，手牌-1 | PASS (0)；发射 (-2)；研究 blue1（蓝槽 2） (-7) |
| 82 | PASS | Q=0；状态=settled/low；根(分8+资产82)；叶(分8+资产82)；链=pass:ac4b4ab2；依据=counterfactual-standard-execution；耗时 fork 44.26ms/执行 302.38ms/投影 15.07ms/估值 0.14ms | — | 发射 (-2)；研究 blue1（蓝槽 2） (-7)；研究 blue4（蓝槽 2） (-7) |
| 83 | 结束回合 | Q=11；状态=settled/low；根(分8+资产82)；叶(分8+资产93)；链=end_turn:d59ab08c；依据=counterfactual-standard-execution；耗时 fork 5.72ms/执行 10.54ms/投影 0.61ms/估值 0.01ms | 钱+2，电+3，手牌+2 | — |
### T04 绿色玩家

- 分数：9 → 9（0）
- 持有资源：钱 7→8(+1)，电 22→26(+4)，宣传 7→7(0)，数据 5→5(0)，手牌 3→4(+1)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 84 | PASS | Q=0；状态=settled/low；根(分9+资产79.50)；叶(分9+资产79.50)；链=pass:ff716055；依据=counterfactual-standard-execution；耗时 fork 40.67ms/执行 289.56ms/投影 15.10ms/估值 0.14ms | — | 发射 (-2)；研究 blue1（蓝槽 2） (-7)；研究 blue1（蓝槽 4） (-7) |
| 85 | 结束回合 | Q=-79.50；状态=settled/low；根(分9+资产79.50)；叶(分9+资产0)；链=end_turn:1f65daa3；依据=counterfactual-standard-execution；耗时 fork 5.55ms/执行 10.36ms/投影 0.64ms/估值 0.02ms | 钱+1，电+4，手牌+1 | — |

## 最终分数、目标差距与剩余资源

| 名次 | 机器人 | 总分 | 距 100 分 | 钱 | 电 | 宣传 | 数据 | 手牌 | 预留牌 |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 绿色玩家 | 9 | -91 | 8 | 26 | 7 | 5 | 4 | 0 |
| 2 | 棕色玩家 | 8 | -92 | 13 | 19 | 9 | 6 | 8 | 0 |
| 3 | 蓝色玩家 | 7 | -93 | 18 | 7 | 10 | 4 | 10 | 0 |
| 4 | 白色玩家 | 6 | -94 | 13 | 14 | 10 | 5 | 9 | 0 |
