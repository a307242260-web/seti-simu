# 第五轮子项：外星人拿牌贪心

2026-09-08；独立于未通过的数据配对、快速行动顺序和身份归一候选，基于dev d24ee799。

## 目的与完整边界

正确基线全盘外星人拿展示牌/盲抽11495个物理节点。现行外星牌统一均值12，
本子项在同一物种、同一行动者的纯拿牌Decision中同值优先展示牌，无展示牌才盲抽。
这是启发式取舍，不是状态等价证明；不改正式合法集、不读取未来牌面、不计为等价节点。
普通牌价值、收入、扫描选牌不在本子项；既有未验收问题仍保留，不借本次涨分收口旧候选。

| 义务 | 来源、实现与证据 |
|---|---|
| 有限目录 | residual-domain-session.alienCardChoices六物种amiba/chong/aomomo/banrenma/runezu/yichangdian；aomomoCardChoices同种展示/盲抽无取消 |
| 唯一owner | expected-score-evaluator共享选择函数，独立条件根及嵌套后继均使用；删除旧后继专属去取消逻辑 |
| 准入 | 全组choose_card/conditional/residual-domain，choiceId物种与source一致，同actor；混合或非拿牌选择原样保留 |
| 目的绑定 | 若当前目标或计划为本组某个decision:actionId，保留指定动作；普通拨款指定牌走原有规则 |
| 状态、RNG、序列 | 不改写descriptor/observation，不执行抽牌；正式executor继续takeDisplayedCard/blindDrawCard及stateSequences、RNG，不增加状态 |
| 奖励、事务、恢复 | 正式ALIEN_CARD_DECISION仍校验owner和合法输入，保留不可逆屏障；父奖励队列和计划依赖不更改 |
| 无收益可取 | 无展示则盲抽，仅取消时保留取消；不生成空的必需Decision |
| 去重与可达性 | 不修改nodeKey、状态等价、目标目录和资源下界；仅同一拿牌Decision贪心选一个合法代表 |
| 预算 | 4096执行/256前沿保持，单点30秒门槛；不以新增截断或虚减计数作为收益 |
| 完整性证据 | heuristic-decision-function只透传已有beamPrunedOriginCount、remainingFrontierNodeCount、maxFrontierNodes到逐次记录；不更改搜索。旧基线缺beam字段，不能按0比较 |

单测覆盖六物种、根/绑定/未绑定后继、动作顺序、缺牌、混合Decision、指定目标和不可变输入。
随后重放正确基线第101步前状态，仅搜索该决策，记录实际拿牌节点、总节点、截断、失败及计划。
单点通过后冻结代码提交，按标准去重入口仅跑一次完整局。三门槛仍为物理节点下降、
完整终局均分上升、截断更少；不因单点省节点即声称完成第五轮。

单点已完成：第101步外星拿牌38→21，总4096不变，11207ms，规则失败0，计划步骤依赖有效。
证据alien-card-pick-greedy-single-20260908.json；这是候选工作树单点，不是完整局成绩。
