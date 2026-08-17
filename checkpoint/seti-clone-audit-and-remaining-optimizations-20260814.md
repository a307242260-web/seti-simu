# 原子操作克隆必要性审计与剩余优化方向（2026-08-14）

## 审计结论（structuredClone 打点，complete 决策 4096 节点）

单决策克隆从 **67 万次降至 31.5 万次（-53%）**，稳定基准 **3625ms → 2620ms（-28%）**，
搜索行为逐项不变（节点数/完备性指标一致）。

### 已移除的冗余克隆（fresh 对象防御性克隆，安全审计后删除）

| 站点 | 次数 | 依据 |
|---|---|---|
| probe/income requirement 的 endpointTarget/nextStep | ~89k | choice.target 由 listOrbit/Land/route 每次新建 fresh |
| formalizeChoices target/payload | ~72k | choices 由 makeChoice 新建 fresh；getDecisionSnapshot 存储时再克隆 |
| normalizeDescriptor target/payload | ~88k | family enumerate 每次新建 fresh；enumerateActions 会 deepFreeze |
| sanitizeRequirementPlans 二次克隆 | ~19k | 调用方已 clone 整棵观测，改原地过滤 |
| sanitizeHiddenInformationActions 无条件克隆 | ~20k→少量 | 只在真正遮蔽未知牌时才需要克隆 |
| selfStateOf | ~33k | source.selfState 由观测构建 fresh 并 frozen |
| getTurnState | ~8.5k | 调用方只瞬时读取原始字段 |
| buildObservation/observeWithActions 的 requirement 克隆 | ~21k | projectState 已构建 fresh requirement，再克隆纯冗余 |

### 保留的必要克隆（当前"构建即冻结"观测设计下必需）

| 站点 | 理由 |
|---|---|
| sanitizePublicPlayer techState/income（~50k） | 观测 deepFreeze 会冻结活状态，必须克隆脱离 |
| sanitizeAlienPublicState traces（~8.4k） | 同上 |
| sanitizeSelfPlayer hand/reserved（~13k） | 同上 |
| buildObservation board 克隆 rockets/planets/data/solarSystem（~17k） | 同上 |
| sanitizeFinalScoringState（~8.4k） | 同上 |
| maskUnknownCards（~10k） | 遮蔽路径需要可变副本 |
| getDecisionSnapshot choices（~13k） | 会话决策快照隔离 |
| normalizeResultArray/normalizeEffect（~22k） | effect 队列稳定性 |
| sectorWinRequirements wins（~4.3k） | 脱离活状态（移除外层克隆后内层必需） |

## 已完成的优化（2026-08-14 晚）

- 克隆：67 万 → 31.5 万次/决策（-53%），全部行为逐项不变；
- 稳定基准（benchmark_probe_policy 12 次）：**3625ms → 2387ms（-34%）**；
- complete 决策 #28：wall 13.7s → 12.1s；projection 分项 5150 → 3221ms（-37%）；
- **拓扑 requirement 缓存**（方向 B，已实现）：BFS 可达性按
  （gameId + 太阳系旋转 + 全火箭占位 + 玩家 orange2）缓存，quick_trade/place_data 链上
  火箭未移动时只重算资源缺口；projection 分项 -35%（commit 后投影 865→575ms）。

## 剩余两个大头（设计级改动，均无损）

### A. 观测生命周期重构（目标：消除 ~100k 观测克隆 + 每节点每玩家终局计分）

现状：反事实观测 = `buildObservation`（simulation-env.js:189）每节点全量构建——
4 名玩家 × sanitizePublicPlayer（techState/income 克隆）+ board 四块克隆 +
每玩家 `computePlayerFinalScore`（终局计分，仅叶评估需要）。

方案：中间节点观测不再 deepFreeze + 不克隆 board（引用活状态），完整观测只在
**叶存储时**构建/克隆；`computePlayerFinalScore` 只对叶计算。中间观测只被
selectSuccessors/branch priority 瞬时读取，不跨节点持有。

风险：冻结语义变化（观测可被变更/陈旧）；叶存储点（addLeaf/addFrontierLeaf/origin
rootActionObservation）必须补克隆；sanitize 路径依赖冻结观测。

### C. 编排开销（新发现：complete 决策 orchestration 3314ms，反超 projection 成最大分项）

现状：搜索循环每节点重建 origin 的 chain/routeActions/goalTrace 数组并深拷贝；
`routeResultTargetIds` 等数组逐 origin 克隆（6.4k 次/决策）。

方案：origin 记账改共享不可变结构（chain 用持久化链表或共享前缀）；只在变更时新建
小数组；`routeResultTargetIds` 用冻结共享数组（从不修改时）。

## 决策点

- 两个都做？先 A（观测克隆，~30% 时延）还是先 B（拓扑缓存，~15%）？
- A 涉及冻结语义与叶存储，需按 implementation-proof-obligations 冻结设计再动；
- B 是纯缓存，风险较低，可先行。

## 方向 D：计划延续复用（诊断已落地，2026-08-XX）

现状：每次决策对每个绑定目标的 legal action 都从同一 checkpoint 全量反事实搜索
到本席 PASS / 15 个结果目标。相邻同席决策（如 R1 两次行动之间）搜索的大部分内容
（目标目录、路线、计划下一步）是同一份计划的延续，被重复执行。

诊断工具（不改决策语义，纯只读采样）：

- `randomizer/game/ai/plan-continuation.js`：目录指纹（剥离资源缺口，只对搜索读到
  的外部结构事实敏感）、计划下一步提取（winning leaf chain[1] + 语义键）、同席
  连续决策配对、预测器 precision/recall、失效原因与事实变化分布。单元测试登记
  `policy/plan-continuation`。
- `tools/diagnose_plan_continuation.js`：record-once（跑一局采样，可 --max-decisions
  截断）/ analyze-many（纯读 JSON，可无限迭代）。模拟盘慢时不必跑 N 局。

关键设计：

- 目录指纹剥离资源缺口（credits/energy/…），本席自己的行动造成的「计划内变化」
  不改变指纹；目录候选数组按元素 stableHash 排序后再哈希，投影深度（cheap vs
  full）导致的枚举顺序差异不产生误报。
- 计划下一步 = winning leaf actionChain[1]，descriptor 从
  rootActionLegalSuccessors（根行动刚执行完的后继，含 conditional 决策）与
  rootActionSettledLegalSuccessors 解析，语义键比较避免 actionId 序号漂移。
- 尝试过「计划假设状态（rootActionObservation，cheap 投影）vs 实际状态」的整目录
  比较：cheap 投影与全量投影结构不同（公共牌延迟补牌、resourceGap 缺失、
  traceCount null），不可比，已从预测器中移除——外部事实发散由「上一决策全量目录
  vs 当前全量目录」（directorySame）覆盖，本席计划内变化的误报由实证 precision/
  recall 量化。
- 失效原因按事实分量点名（board.rotation / board.planets / board.aliens /
  board.data / board.publicCards / board.techSupply / directory.*）。

首测（固定盘面 seti-107，前 150 决策，4 席，48 对同席连续决策）：

- 实际命中（计划下一步 == 新搜索实际选择）37/48 = **77.1%**；
- 预测器：stepLegal precision 77.1% / recall 100%；directorySame precision
  80.6% / recall 78.4%；marginOk precision 80.4% / recall 100%；
  组合（stepLegal+directory+margin）precision 80.6% / recall 78.4%；
- 未命中 11 例：7 例 plan-degraded-or-alternative-improved（便宜检查全过但搜索
  改选——实证为条件决策平局 tie-break 发散，如 blue1 slot1 vs slot4 同值 52），
  4 例 directory-changed，2 例 margin-non-positive；
- 命中决策可省搜索耗时 6.2s（占配对 cur 搜索总耗时 73.9%）；实测 miss 的条件
  决策本身便宜（40-170ms），贵的根行动搜索命中率高；
- 搜索耗时构成（28.9s）：execution 31.4%、orchestration 27.4%、projection
  15.5%、fork 12.3%、checkpoint 11.6%、frontier 1.8%。

fast-path 设计启示：miss 集中在「根行动 → 条件决策」的平局选择，条件决策本身
便宜；可考虑只对非条件决策 fast-path，或对条件决策携带稳定 tie-break。

## 方向 D 落地：fast-path v2（三层判定，2026-08-XX）

实现（按用户口径，对照基准 = 上轮本家行动执行完的计划假设状态，而非执行前）：

- `plan-continuation.js`：`planDependencyFromPlan`（从 winning leaf 的 probeRoute
  终点 / 外星痕迹槽提取计划执行依赖的盘面事实）+ `currentDependencyFromStore`
  （从当前观测重算同一依赖，形状对齐才可比较）+ `attemptPlanContinuation`
  （三层判定）。
- 判定规则：
  - **复用**：下一步仍合法 且 计划依赖环节未变。覆盖：
    - tier1 盘面无变化（对照基准 = 上轮本家行动执行完）；
    - tier2 盘面有变化但不影响计划执行——**当前直接复用**（记录为后续优化点）：
      - 其他玩家火箭移动 / 打牌 / 资源变化（可能后续影响本家行动，现在不考虑）；
      - 计划不涉及的扇区变化；太阳系转动但计划无探测器移动（可能出现更优选择，
        现在不管）。
  - **重新决策**：依赖环节变了——着陆需要的移动更多了 / 目标外星人槽位被占 /
    第一奖励格被占 / 目标路线消失等。
- tier3 内部的部分复用（原一步登陆变两步，可能仍去登陆只是少 1 电或多打一张
  移动牌）**明确延后不实现**。
- store 重建用 `extractPlanSnapshot(..., { light: true })`：跳过 rankActions
  （margin 已不参与判定，rankActions 仅剩诊断工具使用）。

首测 A/B（seti-107，前 120 决策）：fast-path 命中 31/92（33.7%），miss 全部为
no-plan（结构上限，约 2/3 决策的 winning leaf 链条不足 2 步，多为条件/控制等
便宜决策——用户裁决先不管，属当前启发式在条件决策根边界成叶所致）；所有有
store 的尝试全部命中（依赖环节在窗口内未变）；终局分差四席合计 +1，提交失败 0。

后续优化点（记录，暂不实现）：tier2 的「可能出现更优选择」；tier3 的部分复用
（warm start：成本调整后仍沿用路线）；no-plan 结构上限（多步链消费 / 条件决策
延续提取）。

## 方向 D 落地：fast-path v1（simulation env，opt-in，历史版本）

实现：

- `plan-continuation.js` 新增 `extractPlanSnapshot`（诊断 record 与 fast-path 共用：
  从全量搜索结果提取 winning leaf 计划下一步 + 目录指纹 + margin）与
  `attemptPlanContinuation`（护栏：store 存在 + 下一步仍合法 + 目录指纹未变）。
- `simulation-env.js` 新增 `planContinuationFastPath` 配置（默认关）：每次决策先
  attempt，命中则跳过全量反事实搜索、直接提交计划下一步（经 env.step 合法集/
  authority 重验），未命中才全量搜索并重建 store；计数进 diagnostics。
- `tools/verify_plan_continuation_fastpath.js`：同 seed 关/开 A/B，对比终局分与
  计数器。

护栏演进（含被否定的设计）：

- margin 门槛已移除：上一次决策的赢面与「本次继续计划是否安全」无因果关系
  （实测 margin=null 占 store 尝试 77%，全部误杀；严格更优候选案例由
  directory-changed 拦截）。原则：盘面（目录）未变 → 照旧执行计划，含 tie-break。
- 计划假设状态整目录比较已移除（cheap 投影与全量投影结构不同，见上）。

首测 A/B（seti-107，前 120 决策）：

- fast-path 命中 28/92（30.4% 的决策），其中「有延续计划（store 存在）」的决策
  命中 28/36 = 77.8%——与诊断实际命中 77.1% 一致；其余 56 例 no-plan 是结构上限
  （约 2/3 决策的 winning leaf 链条不足 2 步，多为 setup/条件决策/控制决策，本身
  便宜），8 例 directory-changed 被护栏拦截；
- 终局分差（ON - OFF）四席 +7（蓝 -4、绿 +7、棕 -1、白 +5），mid-game 截断样本，
  未出现塌方；提交失败 0。

剩余杠杆（未实现）：no-plan 结构上限——多步链消费（winning leaf 只携带
rootActionLegalSuccessors，第 2 步及以后需 rule-composition 侧扩展）或条件决策
延续提取。

后续 fast-path 落地的红线（尚未实现，仅诊断）：

- 命中决策提交前必须对 fresh state 重验（validateFresh / policy-input-adapter 边界）；
- 缓存键含 policyType/version/modelChecksum/configChecksum；隐藏信息屏障后失效；
- 同一 seed 下开/关缓存的决策逐位一致（或作为显式近似 + 计数器登记，同
  targetSchedulerPrunedCount 文化）；
- 只把复用当「种子 / 优先级」，不当剪枝依据。
