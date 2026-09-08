# 发射前试验：按正式展示选择获得移动

2026-09-09，隔离候选872d80c7已实现，完整验收未完成。用于修复4bc44eb2的两个已复现信息泄漏，
不改第五轮资源权重，不扩展成通用反事实运行时暂停机制。

## 规则依据与判断

本地原始牌面`assets/cards/basic/split/b_98.webp`写明按“每展示一张”具有移动角标
的手牌获得移动，不是自动读取所有手牌。官方FAQ #74亦为“you show from your hand”，
并明确自由行动角是左上角：<https://czechgames.com/files/other-pdf/seti-faq.pdf>。
本地已有官方FAQ存档`rules/seti-faq-base-en-202411.pdf`，无需重复下载。

据此采用正式展示选择，而不是偷偷读取未知牌，也不是把真实额度强行设为0。
玩家可展示符合条件的手牌，展示不弃牌、不获得该牌的弃牌角标效果，每牌只能计1次；
结束展示后按已展示张数初始化移动额度。没有展示任何牌则正常结束数量移动效果。
AI不预测他人行动，展示已知合格牌没有本期模型内成本，因此贪心展示全部已知合格牌。

这与两个被否定方案不同：只过滤play_card漏掉DLC23事务内盲抽；仅在观察里隐藏
remaining仍允许规则分支用未知额度移动、获得资源并泄漏可达性。

## 有限执行链与职责

| 边界 | 唯一职责与状态 | 必须保留的行为证据 |
|---|---|---|
| 入口 | COUNT_HAND_CORNER_MOVE仍归card_play；buildPlayEffects只有b98调用该计数效果 | 全仓类型引用及模型闭包核对，不按卡牌ID写特判 |
| 前置发射与触发 | 原Production队列处理发射和DLC23可选盲抽，完成后进入展示 | 交易先抽与发射中抽两种反例都到达同一展示Decision |
| 展示阶段 | 正式choose_card；payload保存已展示cardInstanceIds，不修改手牌位置 | 展示后手牌/资源/RNG不变；同一张不能重复计数 |
| 合法输入 | 未展示的移动角标手牌逐张展示，另有始终存在的结束展示 | 0张合格牌也生成结束展示Decision，不以是否有未知移动牌改变阶段形状 |
| 展示提交 | 校验owner/version及当前手牌角标，再保存ID；复用正式卡面presentation | wrong-owner/stale/重复/已离手拒绝且事务不变 |
| 结束展示 | 已展示数量冻结为remaining；0点完成，正数进入原移动Decision | 0/1/2额度来自选择而非未展示手牌；移动继续扣真实地形成本 |
| 移动阶段 | 复用listMoveChoices/resolveMove，不再读取手牌角标 | 2→1→完成、提前结束、移动触发后不补额度 |
| 需求观察 | 展示未完成时不报手牌潜在移动总数；只允许展示完成后的冻结额度用于路线 | 两个隐藏牌面替换的公开观察、允许后继与已知路线结果一致 |
| 反事实过滤 | 展示输入含正式cardInstanceId，复用sanitizeHiddenInformationActions过滤未知牌 | 不能把展示伪装成只依赖数量的generic discard；结束展示始终保留 |
| 自动排空 | 展示choice进入现有信息边界检查；单一结束项可正常排空 | 不自动展示未知牌；不得因原始合法集有无未知候选导致已知结果不同 |
| AI选择 | 在过滤后的展示选项中贪心选固定顺序的已知牌，无牌则结束 | N张已知牌只生成N次展示+1次结束，不展开排列或所有子集 |
| 计划与叶 | 展示选择保留正式输入证据；未完成展示不当完成叶 | 同回合执行/恢复和盲抽揭示后重搜，不能拿悬空条件态估分 |
| Browser/Simulation | 共用同一card_play Decision，无环境条件分支 | Browser可展示/结束并继续移动；Node正式恢复重放一致 |

## 接口与删除账

- `getMovementAllowance`不再在COUNT_HAND_CORNER_MOVE的展示前统计完整手牌。
  冻结remaining的读契约及其他三种移动效果不变；展示阶段的观察表示需在实现前与
  `readProbeMovementContext`及路线消费者逐项核对，不以自动ordinary阶段误称额度已耗尽。
- 删除COUNT_HAND_CORNER_MOVE直接自动初始化的路径，不保留隐藏/非隐藏两套额度算法。
- 只使用Effect payload记录展示选择，不新增全局缓存、RNG、实体序号或第二份规则内核。
  正式新Decision消耗现有session序列，这是预期变化，需以新版本归档，不能要求旧动作ID完全一致。
- 默认规则合法选择完整；AI的展示贪心属于显式、可验证的选择收敛，不改变4096/256上限或物理计数。
- 卡面展示可能对未来预测对手有信息成本，但当前用户已排除预测对手；此处不新增该策略模型。

## 接入点核对结果与实现约定

1. 展示阶段采用`movementContext.phase="card-reveal"`、`cardRemaining=0`，保留来源
   cardInstanceId。0表示尚未授予额度，不是断言手牌不能产生移动；展示结束后才切换
   原`card`阶段。`buildTopologyBody`只读取已授予额度；不为展示阶段构建虚假免费路线。
   `selectSecondaryAgentSuccessors`在按目的地过滤前，直接保持展示选择的既有目标绑定。
   自动结算通常会排空整个展示阶段；即使32次排空保护结束，也保留这条绑定继续展示，
   不用调大保护上限或把未完成展示当作完成叶。
2. 共用贪心放在反事实模块内，作为`counterfactualPort.selectCardRevealChoices(actions)`
   的纯选择方法：仅处理整组`choose_card/target.kind=counted-move-reveal`；优先固定
   cardInstanceId顺序的一个展示项，无展示项才选结束；其他合法集原样返回，不影响别的选牌。
   `heuristic-decision-function.run`先用它收敛本次候选，再拆control/strategic和构建Policy
   输入，最终所选仍必须属于协调器提供的原合法集。这样真实条件决策不会把结束展示
   与逐张展示重新当成竞争策略，也不会让未评估的被淘汰项重新被Policy选中。
3. `rule-composition.executeNode`的自动结算先做现有隐藏信息过滤，再调用相同方法；
   每次展示仍通过正式submitDecision、retainStep记账，不能直接修改selected数组。
   后继统一过滤后也调用同一方法，覆盖排空保护后的剩余展示；不在选牌评分器里复制算法。
   过滤未知项不能按`trade-card-selection`的数量使用例外放行。
4. 原control/strategic分类不变，choose_card属于strategic（control只有end_turn/pass）。
   根展示之后剩余展示在正式排空中结算；主搜索仍沿既有目标继续。`executionStepCount`/成功输入计数必须逐次累加，
   32次后回队列继续的部分也不能漏计。不得以宏节点数替代物理输入节省证据。
5. `randomizer/index.html`中heuristic-decision-function在rule-composition之前加载。
   因此通过已装配composition的counterfactualPort调用纯方法，不新增模块顶层导入，
   不为此调整浏览器脚本顺序。端口缺失必须显式报错，不做fallback返回原选项。
6. Browser展示选项使用已有`cards.getCardPickPresentation`和通用Decision UI；结束项
   为明确的“结束展示”。展示事件记录牌身份但不改变手牌位置，公开展示采用独立的
   `hand_card_shown`不可撤销标记；它不是让该玩家获得未知牌面的hidden barrier。
   同一事务已有盲抽屏障必须保留，不能被后续展示标记覆盖后丢失搜索的隐藏信息状态。

屏障义务修订（混合手牌验证证据）：session-runtime.applyResult保存最后一次标记；
不能假定本节点初次提交的result.irreversibleBarrier总是含盲抽标记。已有已知牌时，
第一次展示使用会话的盲抽屏障过滤成功，但公开展示覆盖会话标记后，第二次循环会丢失
盲抽事实。自动排空必须在提交任何下一项之前，从当前inspection捕获首次隐藏屏障到
drainHiddenBarrier，后续只累积不清除；节点末遮蔽、计划步骤和后继过滤共用该事实。
覆盖直接交易、接受发射触发、零/一/多张已知牌，不能只测过滤后的第一项。
无需修改通用runtime，也不把hand_card_shown归为“自己获知了未知牌面”。

## 验收

先做正式0/2牌展示、部分展示、重复选择拒绝、skip、恢复/owner/version、移动扣减回归；
再将两个隐藏替换反例扩成含1张已知移动牌的对照，证明保留确定收益且不读取未知角标。
节点上界按实际提交计：N张展示需要N+1次展示阶段输入，无排列爆炸。
确认主搜索与控制路径一致后做单点性能，再标准去重唯一完整局；不复跑4bc44eb2。
同步mechanics-reference、ai-design、rl-simulation-env及迭代中心；新增Decision需真实Chrome验证。
不能把本设计或规则依据核对当作修复通过。生产已在隔离候选实现，实际验收见counted-card-reveal-progress-20260909.md。
