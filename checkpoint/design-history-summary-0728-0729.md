# SETI 启发式机器人早期设计记录结构化摘要

## 1. `seti-heuristic-secondary-agent-search-matrix-20260728.md`

**文件主题与要解决的问题**：确立"次级代理搜索"（反事实目标搜索）的完整口径——一级目标（分数/科技/收入）不是路线终点，而是搜索叶的评估轴；解决"搜索该展开多深、如何跨回合、如何与正式规则共存"的语义问题。

**冻结的设计决策**：
- 叶价值公式：`V(leaf) = 累计实际分数增量 + 科技×取得时剩余轮次价值 + 收入×剩余收入窗口价值`；分数恒值，科技/收入随轮次衰减（跨轮按实际取得轮分段累计）。
- 终止：本席实际 `PASS`（必做链结算后立即成叶，不观察下一轮轮初收入）或累计 15 个本席次级代理；`maxDecisionDepth=15` 单列，二者独立。
- 次级代理全集 = `standard-action.js` 顶层 family（launch/move/orbit/land/scan/place_data/analyze/play_card/card_corner/research_tech/quick_trade/industry/runezu_face_symbol）；`pass` 是终点、`end_turn` 不计深度；conditional 是代理内部规则选择。
- 跨回合必须走真实 `end_turn` 与真实 turn owner；对手用冻结版本化 rollout `secondary-agent-rollout-v1`（固定稳定顺序，`move` 排最后避免对手展开快速移动树）。
- 预算：15 代理 / 15 DecisionEffect / 全局 128 节点 / 后续 beam 保留最佳同源节点+2 路线 / 每 root 8 叶；2000ms 单决策目标、10000ms 防失控。
- 剪枝语义：所有 root legal action 进首层；被预算截断的 root 标 low-confidence/unresolved，不得伪装完整叶。

**实验/验证结果**：本文档为设计冻结稿，验证顺序列于文末（叶价值 unit → 小型 fixture → 2000ms benchmark → 全量 Node 回归 → 固定盘面与约 47 分历史局对比 → Chrome smoke），无具体分数结果。

**被否决/修正的方案**：删除"15 个真实 Decision"产品口径；删除"一级目标是路线终点、取得即停止"；删除"只搜索一个 Action+必选 Decision 闭包"；不恢复旧 candidate/selector/pending automation 旁路。

**长期约束与教训**：搜索是"评估轴"而非"终止点"、中途收益只提 branch priority 不停止展开；跨轮收益按实际轮号分段。此口径后来被 7-29 的资源闭环设计进一步修正——"转换不占 15 深度/只靠状态等价键去重"被替换为"转换必须有目的、直接解锁下一正式代理"。

---

## 2. `seti-heuristic-frontier-beam-matrix-20260728.md`

**文件主题与要解决的问题**：性能瓶颈收敛——`play_card:b46d9f77`（b_9.webp）单根广度优先在首个叶前展开完整中间层（58 节点、首个叶前 51 节点），`maxLeaves` 降为 1 仍要执行 51 个节点，证明需引入真正的逐根分层 beam。

**冻结的设计决策**：
- 逐根分层 beam：每 root 每 breadth 层保留 8 个 frontier 节点（`maxFrontierPerRoot=8`）；共享节点按 key 只存一次但分别保留各 root origin，被剪 origin 标记 `pruned`/`COUNTERFACTUAL_SEARCH_PRUNED`（low confidence）。
- 根公平性：所有 root legal action 一律进首层，不对 root 做 beam 截断。
- 全局预算 `maxDepth=15`、`maxNodes=128`、每 root 8 叶；单次墙钟硬门禁 1000ms；不靠提高上限换行为。
- 状态等价升级 v2：`hash(committedState bytes)+hash(Session checkpoint)+actionId+remainingDepth`，不再 JSON 二次转义；branch seed 升级 v2（canonical/branch envelope hash+actionId）。
- 目标优先级：`expected-score-evaluator` 独占 v9 价值口径；beam 用相对 root 已兑现的分数/科技/收入；稳定排序 = v9 priority 降序 → actionId → node key 字典序。
- 收入语义澄清：正常收入阶段只在新轮开始；`gainIncome` 提高收入轨的即时奖励属于效果自身。
- Checkpoint：仅存在 successor 时才保存 child envelope；已深冻结状态走 trusted serialize 快路径，终叶不保存。

**实验/验证结果**：b_9.webp 单根：无 beam+`maxLeaves=8` 约 58 节点/首个叶前 51 节点；exhaustive 352 叶最高 V=7；beam=8 → 25 节点、8 叶、最高 V=5。因 beam 未覆盖 V=7 叶，明确声明只能低置信近似、不能声称等价。固定盘面第 55 决策（含 PASS/end_turn 真实后继）：12 反事实根、58 节点、原始 frontier 84/保留 16/剪枝 origin 118；修复后内部 856–862ms、墙钟 943–956ms。首 Decision 12 次 benchmark 中位约 601ms。完整局 109 次决策整步最大 970.33ms，未触发 1 秒门禁；但策略质量仍有大量 PASS、四席探测器得分为 0 的独立问题，不以提高搜索预算掩盖。

**被否决/修正的方案**：不通过提高 node/depth/time 上限换行为；不能把 `maxLeaves` 描述成 beam；不合并不同 Session/RNG/version/剩余深度；beam 与 leaf cap 是两道独立预算。

**长期约束与教训**：beam 是有损近似，覆盖不到 exhaustive 最优叶时必须保持 low-confidence 标记；后续 7-29 迭代把固定 beam 4 再演进为"按 root 代理目标分组"（全局 best-first 与每 root 路线都被否决），并新增 `maxExecutionNodes=4×maxNodes` 物理保护。

---

## 3. `seti-resource-closure-goal-search-design-20260729.md`

**文件主题与要解决的问题**：资源闭环目标搜索。根因：`selectSecondaryAgentSuccessors` 锁定 `routeTargetId` 后只保留 `probeGoalRequirements.nextStep`，路线总能量有缺口且下一步不合法时 selector 只返回 `end_turn/PASS`，搜索无法在环绕/登陆路线内部执行正式快速转换；且 `selectSecondaryAgentRouteTarget` 未把"最少转换次数"计入 15 代理可达性，高收益远目标排挤可兑现近目标。

**冻结的设计决策**：
- 探测器目标由 Production Kernel `buildProbeRouteRequirements` 唯一 owner；`requirementId` 保留火箭来源、`targetId` 维持发射前后连续性。
- 资源缺口只比较 credits/energy 正缺口；后继必须使同目标缺口**严格下降**（防钱电来回换循环）。
- 快速转换复用 Quick Trades executor，完整 tradeId/cost/gain；只保留"缺口下降最多、净损耗最低"一项；锁定目标后的机械转换不占 128/15，仍占 `4×execution guard`。
- 15 只计"已完成的次级代理目标"：发射/移动/转换/放数据/卡角是目标内部路线，不增加 proxyDepth（但计入 executedNodeCount 与 quickTradeCount）。
- 未锁定目标时普通 quick_trade 不进入反事实根（分析已 ready 且缺电除外）。
- 失败语义：缺口无法缩小→只允许控制动作、路线淘汰；descriptor 缺 cost/gain 或无法证明缺口下降→fail-closed；单决策超 10 秒→停止整局做性能定位，不偷缩 128/15。
- 预算不偷缩：`maxNodes=128`、`maxProxyDepth=15`、10s 保护保持不变。

**实验/验证结果**：v25 修复断路后固定局与 v21 完全相同（证明真正阻塞在 routeTarget 阶段）。通过版本 v35：四席 68/60/49/49，均分 56.5（基线 v21 为 50.5）；终局钱+电+手牌=12，较基线 51 下降 76.5%；35 次快速转换、13 发射、56 移动、9 环绕、6 登陆；每候选平均 145.43ms，最慢 8352.20ms，未触发 10 秒保护。保留原因：资源下降与一级分数同时上升，转换根只来自正式探测器缺口/ready 分析/`card:play` 目标，未加库存分、未调预算。

**被否决/修正的方案**：v25 的"断路修复"被证明修错了层（结果不变）；不得提前用固定库存负分强迫消耗（先做转换闭包，卡牌/分析闭包留到下一阶段）；把"当前付不起"误判成整条跨代理路线不可达被列为反例。

**长期约束与教训**：目标选择必须把"达成目标所需最少手段数"计入可达性；资源手段（转换）只能作为目标前置存在、不能自成目标；资源闭环必须"先转换闭包、再卡牌/分析闭包"分层推进。

---

## 4. `seti-heuristic-structural-iteration-design-20260729.md`

**文件主题与要解决的问题**：结构性五轮迭代（v12→v13）：收入时序（第 4 轮提高信用收入仍被估 5 分）、快速转换目的性（转换亏模但可作补缺口手段）、路线支配与短路（无探测器仍弃牌换移动）、数据/科技顺序（`place_data` 抢在可立即取得科技之前）、报告归因。

**冻结的设计决策**：
- 一级目标仅分数/科技/收入；收入窗口 R1/R2/R3/R4 = 3/2/1/0（第 4 轮收入轨增量长期价值为 0）。
- 快速转换是合法手段但不得成为路线目标、交换本身无正向代理奖励；比较"转换后完成的一级目标价值 − 转换损耗"。
- 每轮闸门：先通过行为义务，再比较固定盘面四席均分；行为失败或均分下降即放弃；不缩小 node/beam/深度换耗时。
- 关键新增约束（第 5 轮）：**转换后的第一项非转换代理必须是 root 原本不合法、转换后才解锁的标准行动**——允许多次转换共同补足一个明确目标，拒绝与目标无关的资源振荡。

**实验/验证结果**（同盘面/seed、`maxNodes=128`、全局 beam 4、15 代理）：v12 对照 43/37/35/20 均分 33.75；轮1 收入只计后续轮初 → 32.50（正确性强制保留）；轮2 加路线净资源机会成本 → 35.50（保留）；轮3 同状态少转换/短路线支配 → 35.50（分数无增益，作为搜索语义约束保留）；轮4 无探测器移动角标修复 → 35.50（行为修复保留）；轮5 转换解锁下一代理 → 36.75（保留）。最终 v13 相对 v12：均分 +3（33.75→36.75）、最低席 20→30、最高席 43→49、快速转换 22→2（剩余两次分别直接解锁扫描与登陆）、科技 3→6、弃牌角标 36→23、每候选 284.72ms。

**被否决/修正的方案**：第 2～4 轮中间均分 35.5 被拒绝——绿色玩家连续 14 次钱电互换，报告证明每次转换都把很远之后的收入重复归因给当前转换，且转换后第一项非转换代理（放置数据）在转换前已合法；行为义务失败即使分数更高也否决。

**长期约束与教训**：行为义务（目的性证据）优先级高于均分；"转换/手段必须直接解锁原本不合法的下一正式代理"成为此后所有资源手段（quick_trade、card_corner、place_data）的通用判据。

---

## 5. `seti-heuristic-structural-iterations-6-10-design-20260729.md`

**文件主题与要解决的问题**：结构迭代 6～10（v14–v24）：数据进度可见性、分析链连续性、快速放置目的性、卡角目的性、综合路线支配；以及资源使用阶段的方向纠正（v21 后终局仍剩 51 份钱/电/手牌）。

**冻结的设计决策**：
- 数据进度只能用于 beam 保留路线，最终 selectable 仍需真实一级收益；痕迹数量不折算分数。
- 卡角是支付/铺路手段，必须满足之一：即时一级收益 / 移动角标推进探测器路线 / 获数据推进分析路线 / 直接让原本不合法代理合法。
- `maxNodes` 语义修正：只约束本席真正有代理选择的节点；所有正式执行仍计 `executedNodeCount`，另加 `maxExecutionNodes=4×maxNodes` 物理保护。
- 当前阶段不规划对手行动：反事实遇其他席直接提交正式 PASS，只推进合法回合与生命周期（避免偏乐观）。
- 目标目录机制（v21 后冻结）：Production projection 列出正式目标（`goalId+family+entity target+required/gap`）；快速转换前置（gain 命中目标正缺口）、蓝科技放置前置（正式奖励命中缺口）、目标完成（gap 清零后只执行 nextStep、完成即解除 goalId）；先冻结 `goalId` 再绑定根动作，未绑定的转换不得随机扩展。
- 删除 family 固定 rank；beam 用无权重的字典序证据（一级收益→正式目标收益→目标缺口→数据缺口→机会成本），完全相同才按 actionId。
- 第 6 轮：非终局 observation 调用正式 `computePlayerFinalScore`，只加入已锁定的终局 bonus，不预测未来、不设分表；第 7 轮统一 completed/frontier leaf schema；第 8 轮接通 `requiresCounterfactualOutcome` 入口（end_turn/pass 走控制 fallback，quick trade 照常搜索）；第 9 轮记录 root 完成全部 mandatory conditional 后的 legal successors。

**实验/验证结果**：v13 基线 36.75 → v14 37.25（只保留 observation 能力，分析仍为 0）→ v15 全局 best-first 均分 10（探测器路线归零，否决）→ v16 每 root 路线 28.5（否决）→ v17 节点语义纠正 55.25（强度上升但卡角行为不合格）→ v18/v19 40.25（卡角降至 1、接入终局分；规则能力保留、策略不保留）→ v20 45.75（转换借用遥远目标，否决）→ **v21 50.5 保留基线**（转换 5、卡角 6、打牌 9、分析 3、终局钱+电+手牌 51）→ v22 连续转换正向扩展未完成（方向错误，撤销）→ v23 37.5（目标分支挤占节点，否决）→ v24 42（绿色探测器分 0，否决）。

**被否决/修正的方案**：v15 全局单路 best-first（预算集中少数未完成数据路线）；v22 从转换向外找目标（方向错误）；v23/v24 只给 quick_trade/place_data 加目标标签（不能闭合资源路线——绿色 v24 终局 23 钱/1 电/5 数据/4 手牌，能打的资源牌因自身无一级收益被裁掉）。

**长期约束与教训**：**目标必须成为搜索根，由卡牌、扫描、数据放置、转换等所有资源手段统一提供 `state → gap` 转移**，不得继续在 action-root 搜索上叠加 quick/data 特判——这是文件 6 阶段工作的直接出发点。

---

## 6. `seti-heuristic-100-target-v41-v45-design-20260729.md`

**文件主题与要解决的问题**：均分 100 探索 v41–v45，从 v39/Policy v16（75/65/64/54，均分 64.5，终局钱+电+手牌 6）出发，目标是把正常扫描（当前为 0）与科技价值纳入路线。

**冻结的设计决策**：
- 状态等价沿用 committed envelope hash、actionId、剩余深度、proxyDepth、routeTargetId；新增阶段必须编码进正式 targetId 或 committed observation。
- 目标可达性：先选定 `data:analyze`/card/probe 正式目标，再允许严格缩小缺口的动作，不得"先随机动作再从结果挑收益"。
- 数据下界：分析要求第一排第 6 格已有数据且支付 1 能量；已有槽位与可用数据先确定性放置，缺数据才搜索正式来源。
- 预算恒定：128 completed-goal nodes、15 代理、`4×maxNodes`、每 root 8 叶、10s 保护。
- v41：科技通用资产价值只计算**未来仍未开始的轮次**；取得当轮的能力价值必须由后续真实行动兑现（第 4 轮未使用科技通用价值为 0）。
- v42：分析目标锁定后数据用尽只允许正式 `scan` 获取下一批数据，随后确定性放置并最终分析。
- v43：蓝/橙/粉紫科技分别要求路线中有后续数据/探测器/扫描行动证据，才保留未来轮科技价值。
- v44：正式选择 `blueBonus` 并结算奖励后释放数据目标。
- v45：Production 投影含公司修正后的标准扫描成本，锁定 `data:analyze` 后只允许缩小扫描缺口的转换，支付满足后执行正式扫描。

**实验/验证结果**：v41 75/65/64/61 均分 66.25（+1.75，科技 9→8、绿色 54→61、每候选 150.88ms、最慢 7.975s，保留）；v42 60.75（−5.5，扫描仍为 0、转换 34→36，否决回退）；v43 62.25（−4，有限叶漏掉未来科技使用，否决回退）；v44 60.25（−6，蓝槽奖励未形成正式后续目标、提前释放造成未兑现分支，否决回退）；v45 57.0（−9.25，扫描仍为 0，requirement 只在目标锁定后生效、缺少独立目标选择节点，否决回退）。**最终保留 v41，发布为 `seti-heuristic-policy-v17`**。

**被否决/修正的方案**：v42–v45 全部回退；核心失败模式是从 `quick_trade` 动作反推目标（v45）与提前释放目标（v44）。

**长期约束与教训**：下一阶段必须先引入**不消耗行动的正式 `data:analyze` 目标选择节点**，再让该目标的扫描支付 requirement 驱动转换；不能再次从 `quick_trade` 动作反推目标——目标必须是搜索的根，不能是动作的副产品。

---

## 跨文件总结（约 190 字）

这个阶段沉淀出三条核心经验。(1) **行为义务先于分数**：均分提升若伴随资源振荡或借用遥远收益（绿色 14 次钱电互换、无目的卡角）一律否决；一切手段（转换/卡角/放置）必须直接解锁原本不合法或缩短明确缺口的正式代理。(2) **目标在前、手段在后**：从动作反推目标（v22/v23/v45）全部失败；必须让正式目标成为搜索根，由所有资源手段统一提供 state→gap 转移。(3) **预算与评分不偷工**：128 节点/15 代理/4× 保护恒定，不设固定分、不计库存、科技按剩余轮次衰减；被截断的搜索必须标 low-confidence，不得伪装完整叶。
