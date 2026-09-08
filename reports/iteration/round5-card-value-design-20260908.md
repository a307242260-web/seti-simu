# 第五轮：卡牌价值与选牌贪心设计输入

2026-09-08，输入审计基于dev 698299de。普通牌完整估值尚未实施；外星拿牌子项已在
独立候选aa277dac完成实验（拿牌-30.2%、均111.25，但完整性未通过），未合dev。
数据配对6319beb1、顺序438305b4、身份0b01af15均继续隔离，不借新权重把旧候选判为通过。
前置重复动作仍有未验收项，本设计不撤销原Goal顺序或三项效果门槛。

## 先处理哪类选择

证据：`round5-card-value-inputs-20260908.json`，只读正确基线c43c1f88.70043d34.full.json。

| 真实选牌行为 | 全盘物理节点 | 处理边界 |
|---|---:|---|
| 外星人展示牌/盲抽 | 11495 | 正式alienCardChoices仅展示、盲抽、取消；按现行外星牌均值12比较，不逐外星牌估值 |
| 收入（常规4020、公司1079、重组1329） | 6428 | 收入窗口与当前一次性收益分开；重组不是永久收入 |
| 扫描用牌 | 4921 | 比较扫描贡献与失去的手牌价值，不能只选“牌最差”的一张 |
| 普通精选 | 4455 | 比较获得牌的模型价值；目的绑定指定牌优先保留 |
| 公司换牌 | 3882 | 换出/换入两步，不将每步各自最优冒充组合最优 |
| 标准交易选牌 | 2003 | 同收益时弃低价值牌；精选与弃牌方向相反 |
| 其他（保留牌、角标奖励等） | 110 | 逐Decision确认，不按choose_card名字一刀切 |

合计33294/143252=23.24%。实际执行上限截断子集中为30300/122888=24.66%；
旧版未记录beam，不把这个子集称作“所有未完成搜索”。后续必须同时统计实际输入分类和后继节点。

下一处有明确完整边界的切入点是外星人展示/盲抽：它是拿牌选择，不是外星人标记槽位。
正式来源在residual-domain-session的alienCardChoices；现有选择器只排除取消，仍同时保留
展示与盲抽。采用均值12时两者不是状态等价，但可以按用户要求做贪心取舍。
实现前必须补齐绑定目标、独立条件根、无展示牌/无盲抽牌以及后续奖励链的行为证据，
不能误用于外星人卡牌效果内部的其他选择。该子项不替代普通牌完整估值或整个第五轮。

## 数值与用途分开

正式卡牌来源：cards/effects的getCardModel、buildPlayEffects、getCardPlayCost；
普通及扩展牌182张均有模型，嵌套效果48种，无函数值。全部路径、options、任务与触发槽
已经落在输入checkpoint，不能只枚举顶层playEffects。

- 打出净值遵守已确认公式：即时收益+0.5×任务/终局预期−打牌资源−平均手牌6。
- 净值用于牌的相对好坏；与“花1牌还是1电”的机会成本不能混为同一个数。
  跨资源支付口径必须在实现前明确，不能把扣过一次手牌6的净值再扣一次6。
- 当前卡牌角标0/1/2按正式规则分别兑现宣传4、数据6、移动5。全目录平均为4.8242，
  可作为《拨款》未知精选对象的初始模型假设，不使用未来随机抽到的牌面。
  对应《拨款》净值−5.1758；《低成本航天发射》净值20−10−6=+4。
  这是设计算例，尚未修改生产权重；角标均值假设与“当前公开精选最佳收益”不能混用。
- 卡牌扫描标记7、额外公共扫描6采用用户初值；gainData、repeat、手牌消耗必须显式处理，
  不得丢掉“不获得数据”、重复倍数或额外支付，也不得把替代标准行动与完整行动收益叠加。
- 收入沿用现有发放窗口。名义单价与既有钱电随轮次折价的适用边界需在模型中分别说明。
- 任务和终局仅预期折半，正式计分不变。数量型终局奖励基数必须明确；不默认按上限得满分。
  可复用end-game-scoring.computePlayerCardScore读取正式公式，但必须提供完整公开计分上下文。

## 效果闭包清单与剩余设计义务

以下覆盖全部48种效果；详细实例和嵌套路径以checkpoint为准。尚未全部闭合前不写普通牌估值生产代码，
不能把未实现处理器当作价值0，也不能将其牌从候选集静默删掉。

| 组 | effect.type（省略统一card_前缀） | 需要明确的处理 |
|---|---|---|
| 基础资源 | gain_resources、gain_data、draw_cards、pick_card | 共享单位，数量与额外成本；盲抽只用均值 |
| 移动 | free_move、move | 移动力单位；不模拟盲目移动来估值 |
| 扫描 | scan_nebula、scan_color_choice、public_scan、any_sector_scan、probe_sector_scan、planet_sector_scan、landing_sector_scan、conditional_sector_scan | repeat、目标数量、是否得数据、条件成立与行动边界 |
| 标准行动 | launch、orbit、land、research_tech、scan_action | 正式费用primitive，标准替代价值不与同一奖励重复相加 |
| 远期/条件奖励 | register_event_bonus、conditional_reward | 嵌套rewards、一次/多次、触发时限、条件收益是否确定 |
| 公开数量 | count_hand_income_resource、count_current_income_resource、count_aliens_resource、earth_sector_content_move、count_hand_corner_move、count_rockets_reward、count_owned_tech_reward、count_tech_types_reward | 只读当前公开计数；本卡离手/入收入前后时机；虫族运输化石计数 |
| 位置条件 | probe_location_reward、probe_stack_reward | 正式位置判定与可选目标范围，不预测对手移动 |
| 收入 | income、tuck_played_card_to_income | 收入种类、支付窗口、本卡是否仍在手上 |
| 卡牌转换 | pick_card_corner_reward、draw_then_scan、discard_public_corner_rewards、optional_discard_scan、hand_scan、choose_hand_corner_reward、discard_card_corner_repeat、discard_any_for_income | 扣真实消耗，选择取最大而非全部相加；明确未知牌只用均值 |
| 移除/返回/额外成本 | return_played_card_to_hand_if、return_unfinished_task_to_hand、discard_all_hand、pay_credits_for_reward、remove_planet_marker | 条件、数量和机会成本；不可将任意次数奖励当无限收益 |
| 外星痕迹 | alien_trace | 复用正式可选槽奖励，不能擅自添固定痕迹单价；未知揭示不读真实未来物种 |
| 持续能力 | pluto_reserve | 能力本身与未来环绕/登陆奖励区分，防重复估值 |

终局10类：sectorWinsByColor、traceCount、techCount、planetOrbitOrLand、distinctSignalSectors、
probeLocation、unmarkedFinalRightmost、remainingResource、planetLandingPairs、allOrbitOrLand。
这些是正式公式目录，不意味着已实现回收数量预测。奥陌陌化石/符文仍排除本期；外星牌均值12。

## 搜索接入门禁

唯一owner应是expected-score-evaluator的候选选择，不改正式合法集或公共规则。
收入选牌、精选、弃牌支付和扫描用牌分别计算方向；完整同目标方案比较收入、剩余牌、支付。
先经过目的绑定过滤，再贪心选代表；拨款的data:card:…:pick指定实例不能被通用排序改掉。
独立条件根也需消费同一准则，开局选择等不同Decision不能意外套用。
不新增深度/逐根叶上限冒充剪枝，仍4096执行/256前沿；单点30秒门禁通过才跑唯一完整局。
测试必须覆盖未知牌、同值稳定选择、合法代表不存在、目的指定牌、不同收入/支付结构、
多步奖励及共享来源归属；复用实际第24步B路径验证，不用纯构造测试代替真实固定盘面。

本文件原输入审计不单独登记策略版本；后续外星拿牌实验独立登记为alien-card-pick-greedy-20260908，
详见对应设计与进度，不代表普通牌完整估值已实现或第五轮通过。
