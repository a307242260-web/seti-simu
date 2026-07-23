# seti-104-board-v1 机器人逐回合行动报告

- seed：`seti-104-official-v1`
- board fingerprint：`9c8d340cfca6c745565e28b30c1a718459b808b2b8f7b0841a88bfc357a8115d`
- Policy 决策数：85
- 游戏回合数：20
- 价值口径：`Q` 只读取同一 Rule Composition/Standard Action/Effect Session/Decision/commit 链真实执行后的叶状态；已兑现分 1:1，未兑现资产使用 θ₀
- 诊断目标：初次接触玩家约 100 分；最终表同时列出各机器人的目标差距

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
| 8 | PASS | Q=1.50；状态=settled/low；根(分6+资产31)；叶(分6+资产32.50)；链=pass:a1f33c73→choose_card:ec9d04d4；依据=counterfactual-standard-execution；耗时 fork 33.46ms/执行 85.55ms/投影 4.83ms/估值 0.10ms | — | 弃牌换1宣传 (0.50)；弃牌换1移动 (0.50)；弃牌换1移动 (0.50) |
| 9 | ↳ 选择：dlc_24.png | Q=1.50；状态=settled/low；根(分6+资产31)；叶(分6+资产32.50)；链=choose_card:4708c91c；依据=counterfactual-standard-execution；耗时 fork 31.81ms/执行 31.86ms/投影 2.36ms/估值 0.06ms | 手牌+1 | ↳ 选择：b_12.webp (1.50)；↳ 选择：b_117.webp (1.50)；↳ 选择：b_24.webp (1.50) |
| 10 | 结束回合 | Q=9；状态=settled/low；根(分6+资产32.50)；叶(分6+资产41.50)；链=end_turn:b2f9b29d；依据=counterfactual-standard-execution；耗时 fork 4.67ms/执行 9.34ms/投影 0.49ms/估值 0.02ms | 钱+2，电+2，手牌+2 | — |
### T02 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 3→6(+3)，电 2→3(+1)，宣传 10→10(0)，数据 2→2(0)，手牌 4→6(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 11 | PASS | Q=1.50；状态=settled/low；根(分7+资产37)；叶(分7+资产38.50)；链=pass:c858282e→choose_card:10304ac6；依据=counterfactual-standard-execution；耗时 fork 54.15ms/执行 291.04ms/投影 15.82ms/估值 0.25ms | — | 弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50) |
| 12 | ↳ 选择：b_128.webp | Q=1.50；状态=settled/low；根(分7+资产37)；叶(分7+资产38.50)；链=choose_card:10304ac6；依据=counterfactual-standard-execution；耗时 fork 27.45ms/执行 25.75ms/投影 2.17ms/估值 0.04ms | 手牌+1 | ↳ 选择：b_24.webp (1.50)；↳ 选择：b_117.webp (1.50)；↳ 选择：b_12.webp (1.50) |
| 13 | 结束回合 | Q=6.50；状态=settled/low；根(分7+资产38.50)；叶(分7+资产45)；链=end_turn:320f2608；依据=counterfactual-standard-execution；耗时 fork 4.86ms/执行 9.20ms/投影 0.48ms/估值 0.02ms | 钱+3，电+1，手牌+1 | — |
### T03 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 3→5(+2)，电 4→7(+3)，宣传 3→3(0)，数据 3→3(0)，手牌 4→7(+3)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 14 | PASS | Q=1.50；状态=settled/low；根(分8+资产29)；叶(分8+资产30.50)；链=pass:ac4b4ab2→choose_card:bc063520；依据=counterfactual-standard-execution；耗时 fork 24.35ms/执行 60.24ms/投影 2.87ms/估值 0.08ms | — | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；发射 (-2) |
| 15 | ↳ 选择：b_117.webp | Q=1.50；状态=settled/low；根(分8+资产29)；叶(分8+资产30.50)；链=choose_card:bc063520；依据=counterfactual-standard-execution；耗时 fork 22.38ms/执行 19.12ms/投影 1.42ms/估值 0.04ms | 手牌+1 | ↳ 选择：b_24.webp (1.50)；↳ 选择：b_12.webp (1.50) |
| 16 | 结束回合 | Q=11；状态=settled/low；根(分8+资产30.50)；叶(分8+资产41.50)；链=end_turn:d59ab08c；依据=counterfactual-standard-execution；耗时 fork 4.65ms/执行 8.70ms/投影 0.50ms/估值 0.02ms | 钱+2，电+3，手牌+2 | — |
### T04 绿色玩家

- 分数：9 → 9（0）
- 持有资源：钱 3→4(+1)，电 6→10(+4)，宣传 3→3(0)，数据 2→2(0)，手牌 3→5(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 17 | PASS | Q=1.50；状态=settled/low；根(分9+资产29.50)；叶(分9+资产31)；链=pass:ff716055→choose_card:8d52fb62；依据=counterfactual-standard-execution；耗时 fork 18.11ms/执行 57.47ms/投影 2.94ms/估值 0.05ms | — | 弃牌换1移动 (0.50)；弃牌换1宣传 (0.50)；弃牌换1移动 (0.50) |
| 18 | ↳ 选择：b_12.webp | Q=1.50；状态=settled/low；根(分9+资产29.50)；叶(分9+资产31)；链=choose_card:03718679；依据=counterfactual-standard-execution；耗时 fork 17.24ms/执行 13.02ms/投影 0.95ms/估值 0.03ms | 手牌+1 | ↳ 选择：b_24.webp (1.50) |
| 19 | 结束回合 | Q=10.50；状态=settled/low；根(分9+资产31)；叶(分9+资产41.50)；链=end_turn:1f65daa3；依据=counterfactual-standard-execution；耗时 fork 4.65ms/执行 9.41ms/投影 0.59ms/估值 0.02ms | 钱+1，电+4，手牌+1 | — |

## 第 2 轮

### T01 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 6→9(+3)，电 3→4(+1)，宣传 10→10(0)，数据 2→2(0)，手牌 6→8(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 20 | PASS | Q=1.50；状态=settled/low；根(分7+资产45)；叶(分7+资产46.50)；链=pass:c858282e→choose_card:481577ed；依据=counterfactual-standard-execution；耗时 fork 62.71ms/执行 319.25ms/投影 18.20ms/估值 0.27ms | — | 弃牌换1移动 (0.50)；弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50) |
| 21 | ↳ 选择：b_112.webp | Q=1.50；状态=settled/low；根(分7+资产45)；叶(分7+资产46.50)；链=choose_card:0c82af4f；依据=counterfactual-standard-execution；耗时 fork 32.43ms/执行 33.49ms/投影 2.44ms/估值 0.05ms | 手牌+1 | ↳ 选择：b_118.webp (1.50)；↳ 选择：b_52.webp (1.50)；↳ 选择：b_107.webp (1.50) |
| 22 | 结束回合 | Q=6.50；状态=settled/low；根(分7+资产46.50)；叶(分7+资产53)；链=end_turn:320f2608；依据=counterfactual-standard-execution；耗时 fork 4.83ms/执行 9.03ms/投影 0.50ms/估值 0.02ms | 钱+3，电+1，手牌+1 | — |
### T02 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 5→7(+2)，电 7→10(+3)，宣传 3→3(0)，数据 3→3(0)，手牌 7→10(+3)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 23 | PASS | Q=1.50；状态=settled/low；根(分8+资产41.50)；叶(分8+资产43)；链=pass:ac4b4ab2→choose_card:16d1974a；依据=counterfactual-standard-execution；耗时 fork 33.18ms/执行 79.25ms/投影 3.47ms/估值 0.06ms | — | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；发射 (-2) |
| 24 | ↳ 选择：b_52.webp | Q=1.50；状态=settled/low；根(分8+资产41.50)；叶(分8+资产43)；链=choose_card:16d1974a；依据=counterfactual-standard-execution；耗时 fork 28.48ms/执行 26.88ms/投影 1.98ms/估值 0.04ms | 手牌+1 | ↳ 选择：b_107.webp (1.50)；↳ 选择：b_60.webp (1.50)；↳ 选择：b_118.webp (1.50) |
| 25 | 结束回合 | Q=11；状态=settled/low；根(分8+资产43)；叶(分8+资产54)；链=end_turn:d59ab08c；依据=counterfactual-standard-execution；耗时 fork 4.95ms/执行 9.11ms/投影 0.50ms/估值 0.02ms | 钱+2，电+3，手牌+2 | — |
### T03 绿色玩家

- 分数：9 → 9（0）
- 持有资源：钱 4→5(+1)，电 10→14(+4)，宣传 3→3(0)，数据 2→2(0)，手牌 5→7(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 26 | PASS | Q=1.50；状态=settled/low；根(分9+资产41.50)；叶(分9+资产43)；链=pass:ff716055→choose_card:63d06eb4；依据=counterfactual-standard-execution；耗时 fork 29.32ms/执行 77.11ms/投影 4.29ms/估值 0.06ms | — | 弃牌换1宣传 (0.50)；弃牌换1移动 (0.50)；弃牌换1宣传 (0.50) |
| 27 | ↳ 选择：b_107.webp | Q=1.50；状态=settled/low；根(分9+资产41.50)；叶(分9+资产43)；链=choose_card:63d06eb4；依据=counterfactual-standard-execution；耗时 fork 22.93ms/执行 20.48ms/投影 1.50ms/估值 0.03ms | 手牌+1 | ↳ 选择：b_60.webp (1.50)；↳ 选择：b_118.webp (1.50) |
| 28 | 结束回合 | Q=10.50；状态=settled/low；根(分9+资产43)；叶(分9+资产53.50)；链=end_turn:1f65daa3；依据=counterfactual-standard-execution；耗时 fork 5.31ms/执行 8.71ms/投影 0.49ms/估值 0.01ms | 钱+1，电+4，手牌+1 | — |
### T04 白色玩家

- 分数：6 → 6（0）
- 持有资源：钱 5→7(+2)，电 6→8(+2)，宣传 4→4(0)，数据 3→3(0)，手牌 7→10(+3)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 29 | PASS | Q=1.50；状态=settled/low；根(分6+资产41.50)；叶(分6+资产43)；链=pass:a1f33c73→choose_card:0660c4b6；依据=counterfactual-standard-execution；耗时 fork 24.73ms/执行 88.04ms/投影 4.50ms/估值 0.07ms | — | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50) |
| 30 | ↳ 选择：b_118.webp | Q=1.50；状态=settled/low；根(分6+资产41.50)；叶(分6+资产43)；链=choose_card:0660c4b6；依据=counterfactual-standard-execution；耗时 fork 18ms/执行 13.97ms/投影 1ms/估值 0.03ms | 手牌+1 | ↳ 选择：b_60.webp (1.50) |
| 31 | 结束回合 | Q=9；状态=settled/low；根(分6+资产43)；叶(分6+资产52)；链=end_turn:b2f9b29d；依据=counterfactual-standard-execution；耗时 fork 5.21ms/执行 9.06ms/投影 0.51ms/估值 0.01ms | 钱+2，电+2，手牌+2 | — |

## 第 3 轮

### T01 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 7→9(+2)，电 10→13(+3)，宣传 3→3(0)，数据 3→3(0)，手牌 10→13(+3)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 32 | PASS | Q=1.50；状态=settled/low；根(分8+资产54)；叶(分8+资产55.50)；链=pass:ac4b4ab2→choose_card:abb36657；依据=counterfactual-standard-execution；耗时 fork 41.23ms/执行 110.26ms/投影 5.01ms/估值 0.06ms | — | 弃牌换1宣传 (0.50)；弃牌换1移动 (0.50)；弃牌换1宣传 (0.50) |
| 33 | ↳ 选择：b_33.webp | Q=1.50；状态=settled/low；根(分8+资产54)；叶(分8+资产55.50)；链=choose_card:44ad8ed9；依据=counterfactual-standard-execution；耗时 fork 34.23ms/执行 34.14ms/投影 2.54ms/估值 0.04ms | 手牌+1 | ↳ 选择：dlc_37.png (1.50)；↳ 选择：b_63.webp (1.50)；↳ 选择：b_110.webp (1.50) |
| 34 | 结束回合 | Q=11；状态=settled/low；根(分8+资产55.50)；叶(分8+资产66.50)；链=end_turn:d59ab08c；依据=counterfactual-standard-execution；耗时 fork 5.26ms/执行 8.69ms/投影 0.50ms/估值 0.02ms | 钱+2，电+3，手牌+2 | — |
### T02 绿色玩家

- 分数：9 → 9（0）
- 持有资源：钱 5→6(+1)，电 14→18(+4)，宣传 3→3(0)，数据 2→2(0)，手牌 7→9(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 35 | PASS | Q=1.50；状态=settled/low；根(分9+资产53.50)；叶(分9+资产55)；链=pass:ff716055→choose_card:f7f24460；依据=counterfactual-standard-execution；耗时 fork 34.42ms/执行 99.44ms/投影 5.45ms/估值 0.06ms | — | 弃牌换1宣传 (0.50)；弃牌换1移动 (0.50)；弃牌换1宣传 (0.50) |
| 36 | ↳ 选择：dlc_37.png | Q=1.50；状态=settled/low；根(分9+资产53.50)；叶(分9+资产55)；链=choose_card:445d5eac；依据=counterfactual-standard-execution；耗时 fork 28.58ms/执行 27.35ms/投影 2.01ms/估值 0.04ms | 手牌+1 | ↳ 选择：b_63.webp (1.50)；↳ 选择：b_110.webp (1.50)；↳ 选择：b_40.webp (1.50) |
| 37 | 结束回合 | Q=10.50；状态=settled/low；根(分9+资产55)；叶(分9+资产65.50)；链=end_turn:1f65daa3；依据=counterfactual-standard-execution；耗时 fork 5.18ms/执行 8.81ms/投影 0.50ms/估值 0.01ms | 钱+1，电+4，手牌+1 | — |
### T03 白色玩家

- 分数：6 → 6（0）
- 持有资源：钱 7→9(+2)，电 8→10(+2)，宣传 4→4(0)，数据 3→3(0)，手牌 10→13(+3)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 38 | PASS | Q=1.50；状态=settled/low；根(分6+资产52)；叶(分6+资产53.50)；链=pass:a1f33c73→choose_card:90794832；依据=counterfactual-standard-execution；耗时 fork 32.99ms/执行 128.92ms/投影 6.74ms/估值 0.08ms | — | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50) |
| 39 | ↳ 选择：b_110.webp | Q=1.50；状态=settled/low；根(分6+资产52)；叶(分6+资产53.50)；链=choose_card:90794832；依据=counterfactual-standard-execution；耗时 fork 23.92ms/执行 21.67ms/投影 1.58ms/估值 0.03ms | 手牌+1 | ↳ 选择：b_40.webp (1.50)；↳ 选择：b_63.webp (1.50) |
| 40 | 结束回合 | Q=9；状态=settled/low；根(分6+资产53.50)；叶(分6+资产62.50)；链=end_turn:b2f9b29d；依据=counterfactual-standard-execution；耗时 fork 4.99ms/执行 9.46ms/投影 0.51ms/估值 0.01ms | 钱+2，电+2，手牌+2 | — |
### T04 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 9→12(+3)，电 4→5(+1)，宣传 10→10(0)，数据 2→2(0)，手牌 8→10(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 41 | PASS | Q=1.50；状态=settled/low；根(分7+资产53)；叶(分7+资产54.50)；链=pass:c858282e→choose_card:80907762；依据=counterfactual-standard-execution；耗时 fork 53.51ms/执行 327.64ms/投影 17.66ms/估值 0.21ms | — | 弃牌换1移动 (0.50)；弃牌换1移动 (0.50)；弃牌换1宣传 (-1.50) |
| 42 | ↳ 选择：b_40.webp | Q=1.50；状态=settled/low；根(分7+资产53)；叶(分7+资产54.50)；链=choose_card:6d9c86a3；依据=counterfactual-standard-execution；耗时 fork 18.33ms/执行 14.48ms/投影 1.02ms/估值 0.03ms | 手牌+1 | ↳ 选择：b_63.webp (1.50) |
| 43 | 结束回合 | Q=6.50；状态=settled/low；根(分7+资产54.50)；叶(分7+资产61)；链=end_turn:320f2608；依据=counterfactual-standard-execution；耗时 fork 5.53ms/执行 9.24ms/投影 0.54ms/估值 0.02ms | 钱+3，电+1，手牌+1 | — |

## 第 4 轮

### T01 绿色玩家

- 分数：9 → 9（0）
- 持有资源：钱 6→7(+1)，电 18→22(+4)，宣传 3→7(+4)，数据 2→5(+3)，手牌 9→3(-6)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 44 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分9+资产65.50)；叶(分9+资产66)；链=card_corner:4a053388；依据=counterfactual-standard-execution；耗时 fork 17.06ms/执行 91.04ms/投影 4.64ms/估值 0.08ms | 宣传+1，手牌-1 | 弃牌换1移动 (0.50)；弃牌换1宣传 (0.50)；弃牌换1移动 (0.50) |
| 45 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分9+资产66)；叶(分9+资产66.50)；链=card_corner:3bb401d8；依据=counterfactual-standard-execution；耗时 fork 16.07ms/执行 85.45ms/投影 4.23ms/估值 0.07ms | 数据+1，手牌-1 | 弃牌换1移动 (0.50)；弃牌换1宣传 (0.50)；弃牌换1移动 (0.50) |
| 46 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分9+资产66.50)；叶(分9+资产67)；链=card_corner:68ffbc9a；依据=counterfactual-standard-execution；耗时 fork 14.12ms/执行 72.81ms/投影 3.65ms/估值 0.05ms | 数据+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1移动 (0.50)；弃牌换1宣传 (0.50) |
| 47 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分9+资产67)；叶(分9+资产67.50)；链=card_corner:11dd6e27；依据=counterfactual-standard-execution；耗时 fork 13.26ms/执行 63.55ms/投影 3.11ms/估值 0.05ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1移动 (0.50) |
| 48 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分9+资产67.50)；叶(分9+资产68)；链=card_corner:6e67e6b3；依据=counterfactual-standard-execution；耗时 fork 11.50ms/执行 54.63ms/投影 2.59ms/估值 0.05ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1移动 (0.50)；PASS (0) |
| 49 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分9+资产68)；叶(分9+资产68.50)；链=card_corner:a1aa5b8d；依据=counterfactual-standard-execution；耗时 fork 37.60ms/执行 273.60ms/投影 14.44ms/估值 0.21ms | 数据+1，手牌-1 | 弃牌换1宣传 (0.50)；PASS (0)；发射 (-2) |
| 50 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分9+资产68.50)；叶(分9+资产69)；链=card_corner:dd02bd71；依据=counterfactual-standard-execution；耗时 fork 37.62ms/执行 261.72ms/投影 14.46ms/估值 0.17ms | 宣传+1，手牌-1 | PASS (0)；发射 (-2)；研究 blue1（蓝槽 2） (-7) |
| 51 | PASS | Q=0；状态=settled/low；根(分9+资产69)；叶(分9+资产69)；链=pass:ff716055；依据=counterfactual-standard-execution；耗时 fork 35.85ms/执行 252.28ms/投影 13.28ms/估值 0.17ms | — | 发射 (-2)；研究 blue1（蓝槽 2） (-7)；研究 blue1（蓝槽 4） (-7) |
| 52 | 结束回合 | Q=10.50；状态=settled/low；根(分9+资产69)；叶(分9+资产79.50)；链=end_turn:1f65daa3；依据=counterfactual-standard-execution；耗时 fork 5.02ms/执行 9.36ms/投影 0.66ms/估值 0.02ms | 钱+1，电+4，手牌+1 | — |
### T02 白色玩家

- 分数：6 → 6（0）
- 持有资源：钱 9→11(+2)，电 10→12(+2)，宣传 4→10(+6)，数据 3→5(+2)，手牌 13→7(-6)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 53 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分6+资产62.50)；叶(分6+资产63)；链=card_corner:26680dea；依据=counterfactual-standard-execution；耗时 fork 21.16ms/执行 136.70ms/投影 7.36ms/估值 0.09ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50) |
| 54 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分6+资产63)；叶(分6+资产63.50)；链=card_corner:17fd563d；依据=counterfactual-standard-execution；耗时 fork 20.53ms/执行 128.54ms/投影 6.99ms/估值 0.09ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50) |
| 55 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分6+资产63.50)；叶(分6+资产64)；链=card_corner:1ce11ed2；依据=counterfactual-standard-execution；耗时 fork 47.30ms/执行 356.13ms/投影 19.52ms/估值 0.22ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50) |
| 56 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分6+资产64)；叶(分6+资产64.50)；链=card_corner:1828d52e；依据=counterfactual-standard-execution；耗时 fork 45.03ms/执行 336.86ms/投影 18.40ms/估值 0.22ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50) |
| 57 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分6+资产64.50)；叶(分6+资产65)；链=card_corner:39e0bf18；依据=counterfactual-standard-execution；耗时 fork 43.80ms/执行 326.85ms/投影 17.94ms/估值 0.22ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50) |
| 58 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分6+资产65)；叶(分6+资产65.50)；链=card_corner:08f257dd；依据=counterfactual-standard-execution；耗时 fork 43.51ms/执行 320.30ms/投影 17.84ms/估值 0.22ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1移动 (0.50) |
| 59 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分6+资产65.50)；叶(分6+资产66)；链=card_corner:a9464d93；依据=counterfactual-standard-execution；耗时 fork 42.09ms/执行 306.05ms/投影 17.14ms/估值 0.21ms | 数据+1，手牌-1 | 弃牌换1移动 (0.50)；PASS (0)；弃牌换1宣传 (-1.50) |
| 60 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分6+资产66)；叶(分6+资产66.50)；链=card_corner:e17892ae；依据=counterfactual-standard-execution；耗时 fork 40.88ms/执行 301.45ms/投影 16.41ms/估值 0.21ms | 数据+1，手牌-1 | PASS (0)；弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50) |
| 61 | PASS | Q=0；状态=settled/low；根(分6+资产66.50)；叶(分6+资产66.50)；链=pass:a1f33c73；依据=counterfactual-standard-execution；耗时 fork 40.51ms/执行 301.85ms/投影 16.51ms/估值 0.19ms | — | 弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50) |
| 62 | 结束回合 | Q=9；状态=settled/low；根(分6+资产66.50)；叶(分6+资产75.50)；链=end_turn:b2f9b29d；依据=counterfactual-standard-execution；耗时 fork 5.30ms/执行 9.67ms/投影 0.53ms/估值 0.01ms | 钱+2，电+2，手牌+2 | — |
### T03 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 12→15(+3)，电 5→6(+1)，宣传 10→10(0)，数据 2→4(+2)，手牌 10→9(-1)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 63 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分7+资产61)；叶(分7+资产61.50)；链=card_corner:7c8e15ed；依据=counterfactual-standard-execution；耗时 fork 46.68ms/执行 343.47ms/投影 18.84ms/估值 0.22ms | 数据+1，手牌-1 | 弃牌换1移动 (0.50)；PASS (0)；弃牌换1宣传 (-1.50) |
| 64 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分7+资产61.50)；叶(分7+资产62)；链=card_corner:2f9e8a32；依据=counterfactual-standard-execution；耗时 fork 44.98ms/执行 334.68ms/投影 18.30ms/估值 0.22ms | 数据+1，手牌-1 | PASS (0)；弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50) |
| 65 | PASS | Q=0；状态=settled/low；根(分7+资产62)；叶(分7+资产62)；链=pass:c858282e；依据=counterfactual-standard-execution；耗时 fork 45.15ms/执行 327.60ms/投影 18.98ms/估值 0.20ms | — | 弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50) |
| 66 | 结束回合 | Q=6.50；状态=settled/low；根(分7+资产62)；叶(分7+资产68.50)；链=end_turn:320f2608；依据=counterfactual-standard-execution；耗时 fork 5.72ms/执行 9.73ms/投影 0.53ms/估值 0.02ms | 钱+3，电+1，手牌+1 | — |
### T04 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 9→11(+2)，电 13→16(+3)，宣传 3→8(+5)，数据 3→5(+2)，手牌 13→8(-5)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 67 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分8+资产66.50)；叶(分8+资产67)；链=card_corner:087098db；依据=counterfactual-standard-execution；耗时 fork 22.50ms/执行 111.58ms/投影 4.95ms/估值 0.06ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1移动 (0.50)；弃牌换1宣传 (0.50) |
| 68 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分8+资产67)；叶(分8+资产67.50)；链=card_corner:3bd34dda；依据=counterfactual-standard-execution；耗时 fork 20.87ms/执行 102.22ms/投影 4.32ms/估值 0.08ms | 宣传+1，手牌-1 | 弃牌换1移动 (0.50)；弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50) |
| 69 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分8+资产67.50)；叶(分8+资产68)；链=card_corner:712f1e6f；依据=counterfactual-standard-execution；耗时 fork 19.73ms/执行 91.53ms/投影 3.78ms/估值 0.04ms | 数据+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1移动 (0.50)；弃牌换1宣传 (0.50) |
| 70 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分8+资产68)；叶(分8+资产68.50)；链=card_corner:813b9719；依据=counterfactual-standard-execution；耗时 fork 18.06ms/执行 83.78ms/投影 3.27ms/估值 0.10ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；弃牌换1移动 (0.50) |
| 71 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分8+资产68.50)；叶(分8+资产69)；链=card_corner:5100f8b6；依据=counterfactual-standard-execution；耗时 fork 46.03ms/执行 317.61ms/投影 16.12ms/估值 0.15ms | 数据+1，手牌-1 | 弃牌换1宣传 (0.50)；弃牌换1宣传 (0.50)；PASS (0) |
| 72 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分8+资产69)；叶(分8+资产69.50)；链=card_corner:69f3057e；依据=counterfactual-standard-execution；耗时 fork 44.25ms/执行 301.63ms/投影 15.24ms/估值 0.15ms | 宣传+1，手牌-1 | 弃牌换1宣传 (0.50)；PASS (0)；发射 (-2) |
| 73 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分8+资产69.50)；叶(分8+资产70)；链=card_corner:d4200691；依据=counterfactual-standard-execution；耗时 fork 43.42ms/执行 288.83ms/投影 14.38ms/估值 0.14ms | 宣传+1，手牌-1 | PASS (0)；发射 (-2)；研究 blue1（蓝槽 2） (-7) |
| 74 | PASS | Q=0；状态=settled/low；根(分8+资产70)；叶(分8+资产70)；链=pass:ac4b4ab2；依据=counterfactual-standard-execution；耗时 fork 42.84ms/执行 283.69ms/投影 14.07ms/估值 0.14ms | — | 发射 (-2)；研究 blue1（蓝槽 2） (-7)；研究 blue4（蓝槽 2） (-7) |
| 75 | 结束回合 | Q=11；状态=settled/low；根(分8+资产70)；叶(分8+资产81)；链=end_turn:d59ab08c；依据=counterfactual-standard-execution；耗时 fork 5.43ms/执行 9.65ms/投影 0.54ms/估值 0.02ms | 钱+2，电+3，手牌+2 | — |

## 第 5 轮

### T01 白色玩家

- 分数：6 → 6（0）
- 持有资源：钱 11→13(+2)，电 12→14(+2)，宣传 10→10(0)，数据 5→5(0)，手牌 7→9(+2)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 76 | PASS | Q=0；状态=settled/low；根(分6+资产75.50)；叶(分6+资产75.50)；链=pass:a1f33c73；依据=counterfactual-standard-execution；耗时 fork 43.36ms/执行 312.34ms/投影 16.53ms/估值 0.15ms | — | 弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50) |
| 77 | 结束回合 | Q=9；状态=settled/low；根(分6+资产75.50)；叶(分6+资产84.50)；链=end_turn:b2f9b29d；依据=counterfactual-standard-execution；耗时 fork 5.38ms/执行 9.65ms/投影 0.54ms/估值 0.01ms | 钱+2，电+2，手牌+2 | — |
### T02 蓝色玩家

- 分数：7 → 7（0）
- 持有资源：钱 15→18(+3)，电 6→7(+1)，宣传 10→10(0)，数据 4→4(0)，手牌 9→10(+1)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 78 | PASS | Q=0；状态=settled/low；根(分7+资产68.50)；叶(分7+资产68.50)；链=pass:c858282e；依据=counterfactual-standard-execution；耗时 fork 46.70ms/执行 342.54ms/投影 18.77ms/估值 0.16ms | — | 弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50)；弃牌换1宣传 (-1.50) |
| 79 | 结束回合 | Q=6.50；状态=settled/low；根(分7+资产68.50)；叶(分7+资产75)；链=end_turn:320f2608；依据=counterfactual-standard-execution；耗时 fork 5.28ms/执行 10.13ms/投影 0.55ms/估值 0.01ms | 钱+3，电+1，手牌+1 | — |
### T03 棕色玩家

- 分数：8 → 8（0）
- 持有资源：钱 11→13(+2)，电 16→19(+3)，宣传 8→9(+1)，数据 5→6(+1)，手牌 8→8(0)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 80 | 弃牌换1宣传 | Q=0.50；状态=settled/low；根(分8+资产81)；叶(分8+资产81.50)；链=card_corner:2a7d2f36；依据=counterfactual-standard-execution；耗时 fork 46.58ms/执行 321.19ms/投影 16.14ms/估值 0.14ms | 宣传+1，手牌-1 | 弃牌换1移动 (0.50)；PASS (0)；发射 (-2) |
| 81 | 弃牌换1移动 | Q=0.50；状态=settled/low；根(分8+资产81.50)；叶(分8+资产82)；链=card_corner:73104be3；依据=counterfactual-standard-execution；耗时 fork 44.87ms/执行 297.55ms/投影 15.52ms/估值 0.14ms | 数据+1，手牌-1 | PASS (0)；发射 (-2)；研究 blue1（蓝槽 2） (-7) |
| 82 | PASS | Q=0；状态=settled/low；根(分8+资产82)；叶(分8+资产82)；链=pass:ac4b4ab2；依据=counterfactual-standard-execution；耗时 fork 42.91ms/执行 287.30ms/投影 14.72ms/估值 0.13ms | — | 发射 (-2)；研究 blue1（蓝槽 2） (-7)；研究 blue4（蓝槽 2） (-7) |
| 83 | 结束回合 | Q=11；状态=settled/low；根(分8+资产82)；叶(分8+资产93)；链=end_turn:d59ab08c；依据=counterfactual-standard-execution；耗时 fork 5.69ms/执行 9.88ms/投影 0.55ms/估值 0.01ms | 钱+2，电+3，手牌+2 | — |
### T04 绿色玩家

- 分数：9 → 9（0）
- 持有资源：钱 7→8(+1)，电 22→26(+4)，宣传 7→7(0)，数据 5→5(0)，手牌 3→4(+1)，预留牌 0→0(0)

| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |
| ---: | --- | --- | --- | --- |
| 84 | PASS | Q=0；状态=settled/low；根(分9+资产79.50)；叶(分9+资产79.50)；链=pass:ff716055；依据=counterfactual-standard-execution；耗时 fork 39.82ms/执行 281.37ms/投影 14.57ms/估值 0.14ms | — | 发射 (-2)；研究 blue1（蓝槽 2） (-7)；研究 blue1（蓝槽 4） (-7) |
| 85 | 结束回合 | Q=-79.50；状态=settled/low；根(分9+资产79.50)；叶(分9+资产0)；链=end_turn:1f65daa3；依据=counterfactual-standard-execution；耗时 fork 5.32ms/执行 10.26ms/投影 0.56ms/估值 0.02ms | 钱+1，电+4，手牌+1 | — |

## 最终分数、目标差距与剩余资源

| 名次 | 机器人 | 总分 | 距 100 分 | 钱 | 电 | 宣传 | 数据 | 手牌 | 预留牌 |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 绿色玩家 | 9 | -91 | 8 | 26 | 7 | 5 | 4 | 0 |
| 2 | 棕色玩家 | 8 | -92 | 13 | 19 | 9 | 6 | 8 | 0 |
| 3 | 蓝色玩家 | 7 | -93 | 18 | 7 | 10 | 4 | 10 | 0 |
| 4 | 白色玩家 | 6 | -94 | 13 | 14 | 10 | 5 | 9 | 0 |
