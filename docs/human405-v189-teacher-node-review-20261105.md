# V189前两轮教师逐节点复核（2026-11-05）

使用已完成391具名/308独立冷根中的教师根证据，不查询新策略。比较点之前65个白席节点：60同选、5项差异；教师第二轮PASS及选牌两根另外保留。根表的“已得值”、固定策略排除和未执行动作不冒充所有出口的精确最大值。

第25步普通移动与教师能量换移动，第56步先打DLC9再取蓝奖励与教师先取再打，各有两条正式原生后缀对照，合计16输入；结束后完整白席状态、牌区、盘面、回合及RNG切片相同。第43步是同值下准备时机差异。第87/89步把5/6格准备与下一次分析绑定；实际先研究蓝1再准备/分析，在实际104后完整白席状态、所有相关盘面资产已与教师轮末相同。没有把中间输入状态合并为相同搜索节点。

| 教师输入 | 轮次 | 教师行动 | V189选择ID | 分类 | 教师根证据 |
|---|---|---|---|---|---|
| 24 | 1 | play_card | `play_card:124d76d3` | 同选 | 同选 |
| 25 | 1 | quick_trade | `move:e0158279` | 移动表示不同，原生资产相同 | excluded-by-movement-policy |
| 26 | 1 | choose_target | `choose_target:d9014565` | 同选 | 同选 |
| 27 | 1 | end_turn | `end_turn:b2f9b29d` | 同选 | 同选 |
| 35 | 1 | research_tech | `research_tech:806ccfc8` | 同选 | 同选 |
| 36 | 1 | choose_target | `choose_target:3fcecb14` | 同选 | 同选 |
| 37 | 1 | choose_card | `choose_card:56497dc2` | 同选 | 同选 |
| 38 | 1 | end_turn | `end_turn:b2f9b29d` | 同选 | 同选 |
| 39 | 1 | orbit | `orbit:44937d1f` | 同选 | 同选 |
| 40 | 1 | choose_card | `choose_card:669ddc72` | 同选 | 同选 |
| 41 | 1 | choose_target | `choose_target:96270e4a` | 同选 | 同选 |
| 42 | 1 | choose_card | `choose_card:6ddc2a28` | 同选 | 同选 |
| 43 | 1 | end_turn | `place_data:8fd12fd3` | 同值，较早准备 | proved-plan-value；已得值69.16666666666667 |
| 44 | 1 | industry | `industry:e887dc52` | 同选 | 同选 |
| 45 | 1 | choose_card | `choose_card:406ad170` | 同选 | 同选 |
| 46 | 1 | choose_card | `choose_card:2882fca6` | 同选 | 同选 |
| 47 | 1 | place_data | `place_data:8fd12fd3` | 同选 | 同选 |
| 48 | 1 | choose_target | `choose_target:29b5215c` | 同选 | 同选 |
| 49 | 1 | place_data | `place_data:8fd12fd3` | 同选 | 同选 |
| 50 | 1 | choose_target | `choose_target:29b5215c` | 同选 | 同选 |
| 51 | 1 | place_data | `place_data:8fd12fd3` | 同选 | 同选 |
| 52 | 1 | choose_target | `choose_target:29b5215c` | 同选 | 同选 |
| 53 | 1 | place_data | `place_data:8fd12fd3` | 同选 | 同选 |
| 54 | 1 | choose_target | `choose_target:29b5215c` | 同选 | 同选 |
| 55 | 1 | choose_card | `choose_card:66acc520` | 同选 | 同选 |
| 56 | 1 | place_data | `play_card:8faf8ead` | 已筹资顺序不同，原生资产相同 | complete；已得值63 |
| 57 | 1 | choose_target | `choose_target:44b74627` | 同选 | 同选 |
| 58 | 1 | play_card | `play_card:8faf8ead` | 同选 | 同选 |
| 59 | 1 | choose_target | `choose_target:062d2a7a` | 同选 | 同选 |
| 60 | 1 | end_turn | `end_turn:b2f9b29d` | 同选 | 同选 |
| 61 | 1 | pass | `pass:a1f33c73` | 同选 | 同选 |
| 62 | 1 | choose_card | `choose_card:e1e8d8f7` | 同选 | 同选 |
| 72 | 2 | scan | `scan:2d21a323` | 同选 | 同选 |
| 73 | 2 | choose_target | `choose_target:8a5d7b2d` | 同选 | 同选 |
| 74 | 2 | choose_card | `choose_card:00a51ff4` | 同选 | 同选 |
| 75 | 2 | choose_card | `choose_card:c1d20eee` | 同选 | 同选 |
| 76 | 2 | choose_target | `choose_target:5bb27a70` | 同选 | 同选 |
| 77 | 2 | end_turn | `end_turn:b2f9b29d` | 同选 | 同选 |
| 78 | 2 | play_card | `play_card:720c219a` | 同选 | 同选 |
| 79 | 2 | choose_target | `choose_target:12318841` | 同选 | 同选 |
| 80 | 2 | end_turn | `end_turn:b2f9b29d` | 同选 | 同选 |
| 81 | 2 | play_card | `play_card:719591bb` | 同选 | 同选 |
| 82 | 2 | choose_target | `choose_target:12318841` | 同选 | 同选 |
| 83 | 2 | end_turn | `end_turn:b2f9b29d` | 同选 | 同选 |
| 84 | 2 | play_card | `play_card:684d5f30` | 同选 | 同选 |
| 85 | 2 | choose_target | `choose_target:6b287122` | 同选 | 同选 |
| 86 | 2 | choose_target | `choose_target:2618cdf2` | 同选 | 同选 |
| 87 | 2 | place_data | `end_turn:b2f9b29d` | 准备推迟到绑定的分析用途 | excluded-by-resource-policy |
| 88 | 2 | choose_target | `choose_target:29b5215c` | 同选 | 同选 |
| 89 | 2 | place_data | `end_turn:b2f9b29d` | 准备推迟到绑定的分析用途 | excluded-by-resource-policy |
| 90 | 2 | choose_target | `choose_target:29b5215c` | 同选 | 同选 |
| 91 | 2 | end_turn | `end_turn:b2f9b29d` | 同选 | 同选 |
| 92 | 2 | research_tech | `research_tech:806ccfc8` | 同选 | 同选 |
| 93 | 2 | choose_target | `choose_target:0cbf059c` | 同选 | 同选 |
| 94 | 2 | place_data | `place_data:8fd12fd3` | 同选 | 同选 |
| 95 | 2 | choose_target | `choose_target:7be78a55` | 同选 | 同选 |
| 96 | 2 | end_turn | `end_turn:b2f9b29d` | 同选 | 同选 |
| 97 | 2 | choose_target | `choose_target:91d79691` | 同选 | 同选 |
| 98 | 2 | analyze | `analyze:a5629aa3` | 同选 | 同选 |
| 99 | 2 | choose_target | `choose_target:8f2f1c72` | 同选 | 同选 |
| 100 | 2 | place_data | `place_data:8fd12fd3` | 同选 | 同选 |
| 101 | 2 | choose_target | `choose_target:29b5215c` | 同选 | 同选 |
| 102 | 2 | place_data | `place_data:8fd12fd3` | 同选 | 同选 |
| 103 | 2 | choose_target | `choose_target:44b74627` | 同选 | 同选 |
| 104 | 2 | end_turn | `end_turn:b2f9b29d` | 同选 | 同选 |
| 105 | 2 | pass | `quick_trade:f385e2ac` | 超过教师停止点继续发展 | complete；已得值94.58333333333333 |
| 106 | 2 | choose_card | `choose_card:c3064b92` | 同选 | 同选 |

完整JSON及每个原始gzip/证据SHA：`reports/ai-foundation-20261104/two-rounds-teacher-v2/v189-teacher-alignment-audit-20261105-v1.json`。原生顺序对照：`v189-teacher-order-native-controls-20261105-v1.json`。当前教师原生重放：`v189-teacher-current-native-replay-20261105-v1.json`。
