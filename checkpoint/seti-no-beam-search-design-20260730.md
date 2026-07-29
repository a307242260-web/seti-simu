# SETI 次级代理搜索移除 beam 实验设计（2026-07-30）

## 目标

关闭“每个 root action + root target 只保留一个 frontier 节点”，再测量固定盘面首决策能否
在 10 秒内自然耗尽 frontier。该修改不改变目标、估值、状态等价或规则执行；用户已明确要求
先移除 beam，再根据真实结果决定是否继续 copy-on-write。

## 边界

- `maxProxyDepth=15` 保持，含义仍是最多 15 个次级代理目标；
- `maxNodes=128` 保持；
- 仅实验把 `maxExecutionNodes` 从 512 提到 2048，作为失控保护，不作为剪枝；
- `maxLeaves=8` 暂时保持，因此本实验只回答“移除 frontier beam 后是否撑得住”，尚不代表
  无限叶完备搜索；
- 若触发 2048 或 10 秒，结果标记 incomplete，不选取部分结果冒充完整搜索。

## 状态与事务矩阵

| 语义 | owner | 变化 | 不变量 | 证据 |
|---|---|---|---|---|
| frontier retention | Rule Composition | secondary search 实验模式返回全部 exact-merged nodes | node key、origin key、目标、优先级均不变 | diagnostics |
| physical sharing | Rule Composition | 不变 | 同 envelope/action/depth 仍只执行一次 | shared origin count |
| RNG/Decision | Production fork / Effect Session | 不变 | actionId、branch RNG、owner/version、checkpoint 不变 | counterfactual tests |
| node/time guard | benchmark caller | execution guard 2048 | 触顶显式 `executionLimitReached` | one-decision benchmark |
| canonical behavior | Browser/normal Simulation | 默认不开实验开关 | 现有 beam 行为字节不变 | full regression |

## 成功标准

- `beamPrunedOriginCount=0`；
- `executionLimitReached=false`、`remainingFrontierNodeCount=0`；
- 单决策 wall < 10 秒；
- candidate/root target 不减少，canonical state/RNG 隔离测试通过。

## 实验结果

固定盘面首决策，关闭 beam、`maxExecutionNodes=2048`：

- wall 12299.19ms，超过 10 秒；
- executed 2048，`executionLimitReached=true`；
- remaining frontier 4921，原始/保留 frontier 均为 4921；
- beam pruned origin 为 0，确认没有隐藏 beam；
- root target 42，expanded goal node 42，shared physical origin 237。

结论：当前 no-beam 搜索不能直接投入生产。剩余规模约 7000 个物理节点；即使继续把事务成本
降低 20%–30%，仍无法解决组合爆炸，因此暂不继续深层 Proxy/slice COW。下一步保持 beam
关闭，引入可证明的语义状态等价与资源支配：只有同一规则状态、同一目标、同一 Decision/RNG
边界下资源不多且累计成本不低的路线才可删除。该剪枝必须有反例测试，不能退回“每目标只取一条”。

在进入状态支配前，先修正搜索调度：当前实现按层执行整个 frontier，导致高价值路线尚未形成叶
时就物化同层全部低优先级分支。secondary search 改为 best-first，每轮只执行排序第一的物理
节点，其余节点原样保留并与新后继 exact-merge。该变化不删除节点；只有既有的每虚拟根 8 叶
上限、128/2048 保护或 exact transposition 可以终止 origin。

## Best-first 复测

固定盘面首决策：

- 2048 保护：wall 14034.11ms，剩余 frontier 40，未自然完成；
- 4096 保护：2738 个物理节点自然完成，wall 18487.15ms；
- root target 42、beam pruned 0，确认没有恢复 beam；
- 自然完成时规则执行 8428.60ms、投影 3369.98ms、checkpoint 1793.62ms、
  fork 822.68ms、frontier 287.52ms。

Best-first 解决了整层展开留下 4921 个 frontier 的调度问题，但没有达到 10 秒门槛。frontier
管理只占 1.6%，继续优化排序没有意义；需要处理规则状态复制和投影物化。

## Fork COW 冻结设计

本轮 COW 只作用于 `trustedIsolatedOwnership` 的隔离 counterfactual composition，不改变
Browser/canonical StateStore、存档格式或普通 Session。目标是让每个 Effect 从冻结的上一状态
创建惰性 draft，只复制被写入的对象/数组路径；Effect 返回后立即 materialize 为普通对象图，
未修改子树继续共享冻结引用。

| 语义 | 唯一 owner | COW 行为 | 不变量 / 失败边界 |
|---|---|---|---|
| committed base | StateStore | 只读冻结对象，draft 不得反写 | canonical 与父分支字节不变 |
| working draft | Effect Runtime | 每个 execute/resolve 单独创建，写时复制路径 | 不跨 Effect 暴露 Proxy |
| Effect result | Rule Composition wrapper | residual followup 前先 materialize；followup 使用新 draft，结束后再 materialize | `nextState` 进入 journal/commit/project/save 前必须是普通图 |
| undo / abort | Effect Runtime | trusted fork 保存上一普通状态引用；abort 回到 base 引用 | 隔离 fork 丢弃分支即可恢复；普通 runtime 仍深拷贝 |
| commit | StateStore | trusted candidate 只浅复制 root/meta 后递增版本，未改切片可共享 | 完整 invariant 仍执行；不得跳过验证 |
| RNG / sequence | Production wrapper | 对 draft 的 `meta` 写入触发 COW | 分支 seed、sequence 与既有执行字节一致 |
| Decision | Effect Runtime | choice 枚举仍消费普通 materialized state | owner/version/stale/late 语义不变 |
| envelope / hash | Rule Composition | 仍稳定序列化完整普通图 | exact transposition identity 不变 |

反例义务：

- 修改嵌套对象、数组 push/splice、delete 不得污染 base；
- 未修改 sibling 保持引用共享，修改路径不得共享；
- Effect 返回 draft、返回新对象以及 residual transform 三种路径均只能产出普通图；
- conditional Decision 跨 checkpoint 恢复后与非 COW 字节一致；
- canonical StateStore 的 working copy 隔离测试不变。

本轮不把 projection 或 envelope 改为惰性对象；两者仍是后续独立优化。因此 COW 是否足以达到
10 秒只由复测决定，不预设结论。

### COW 可行性结果

原型未通过行为验证，已全部撤回，不进入生产 diff。原因不是 COW draft 自身的嵌套写入：
规则域有 38 个文件直接调用原生 `structuredClone`，真实卡牌和登陆执行路径会对收到的 state
或其子树直接做快照；原生 `structuredClone` 不支持 Proxy，分别触发
`EFFECT_EXECUTOR_THROWN` / `DataCloneError`。要安全启用 Proxy COW，必须先把这些调用迁移到
统一、可识别 draft 的正式 snapshot primitive，并对 rollback、conditional Decision、
residual followup、RNG 和全部 action family 做迁移证据。这已属于跨 38 文件的状态架构迁移，
不能作为本次 no-beam 调度 patch 的附带优化。

因此当前结论是：

- beam 可以从语义上移除，best-first 保留全部 frontier；
- 当前实现以 2738 个物理节点、18.49 秒自然完成，尚不满足 10 秒生产门槛；
- COW 值得作为独立迁移，但不能直接开启；本次不以破坏规则路径的原型换取 benchmark 数字；
- no-beam 代码在后续性能工作完成前仍受默认 `maxExecutionNodes=512` 保护，触顶结果必须保持
  incomplete，不能把部分搜索结果当作完备结果。

## 目标约束搜索修正

no-beam 复测暴露出既有 `selectSecondaryAgentSuccessors` 并非全程目标搜索：探测器、数据和
打牌目标找不到下一直接步骤时，会退回控制动作或宽泛的 legal action 集合；route target
清空后则由已执行 action 反猜目标。这会把无关动作排列物化成数千节点。

修正后的状态机：

| 状态 | owner | 允许后继 | 禁止 |
|---|---|---|---|
| target-bound | Expected Score Evaluator | 直接执行目标 nextStep；或真实 outcome 后严格缩小同一目标正式资源缺口的准备动作 | 通用 legal fallback、切换目标、以 PASS 掩盖不可达 |
| target-decision | Effect Session + Evaluator | 与当前目标相容的全部 conditional choice | 字典序 `slice(0,1)` 冒充完整选择 |
| target-completion-pending | Rule Composition origin | 当前计深度动作已执行，但必须等待同一 Session conditional/followup 完成 | 提前枚举下一目标 |
| target-completed | Rule Composition | 从结算后 observation 重新枚举正式目标目录，并为每个 `targetId + compatibleActionId` 建立绑定 origin | 先选 action、执行后再猜 target |
| target-blocked | Rule Composition | 结束该 origin，保留已形成的 frontier leaf 供估值 | PASS/end_turn 继续漫游 |

`maxProxyDepth=15` 仍只统计完成的次级代理动作；快速转换、移动、发射、放置数据和 conditional
仍是目标内部步骤。相同物理 `envelope + action + depth` 可以共享执行，但 origin identity
必须包含当前 target 与 completion-pending，避免错误合并。

## 精确剪枝设计冻结

固定盘面首决策在目标绑定与资源规划完成后的自然耗尽结果：

- 1850 次物理规则执行，其中真正计入次级目标深度 102 次；
- conditional 结算 940 次：`choose_payment=493`、`choose_card=353`、
  `choose_target=94`；
- 快速转换 396 次；
- exact physical merge 4215 次，最大物理 frontier 281、origin frontier 999；
- `maxLeaves=8` 产生 930 次既有截断；beam 仍为 0，128/2048 保护均未触发；
- 单次 wall 9214.49ms，Rule Composition 内计时 8442.98ms。

用户确认实施资源不可达、conditional 等价和资源支配三类剪枝；明确禁止把非等价
conditional 固定选择为一个选项。

### 状态与 owner 矩阵

| 剪枝 | 唯一 owner | 可删除条件 | 必须保留的边界 | 失败语义 |
|---|---|---|---|---|
| 目标资源不可达 | Expected Score Evaluator | 正式 probe requirement 在“资源可自由提前使用、途中宣传提前到账、手牌/数据可乐观同时补信用和能量”的上界下仍无法经正式 quick trade 达到总信用/能量需求 | data/card/未知目标不使用该证明；缺字段视为可达；不改变 legal action | 不证明不可达就保留目标 |
| conditional 行为等价 | Rule Composition | 同一完整 committed gameplay state，仅 `meta.stateVersion` / `match.decisionVersion` 不同；无 active Session；下一 action 的 actor/family/phase/target/payload 完全相同 | RNG state、entity sequences、牌实例/牌堆、盘面、Decision payload、目标 origin 全部参与 key；active Session 使用原 exact key | 任一边界不同即不合并 |
| 同目标资源支配 | Rule Composition | 同 virtual root、同 route target、同完成深度、同 pass/owner 状态、同下一 action，且 committed state 除焦点玩家信用/能量/宣传和版本号外完全相同；支配路线三项资源逐项不少、quick trade 次数不多，且至少一项严格更优 | 手牌身份、数据 token、科技、分数、收入、盘面位置、RNG、sequence、对手状态完全相同；不同 root candidate 不互剪 | 不形成逐项偏序就两条都保留 |

### Decision / RNG / 事务义务

- conditional 的每个非等价 choice 仍由 Effect Session 正式执行，保留独立
  Decision/replay；本次不选择“第一项”。
- conditional 等价只在 choice 已结算且 Session 已提交后合并后续 frontier；若仍有
  followup/awaiting Decision，checkpoint/session 使用原完整 identity。
- semantic representative 的 committed `meta.rngState` 与 `meta.sequences` 必须相同；
  Production `runWithWorkingState` 从该 RNG state 恢复随机源，因此代表路线不得改变后续随机结果。
- canonical Browser/Simulation StateStore、CAS、journal、save/restore 格式均不改变；剪枝只存在于
  counterfactual frontier。
- dominance 只能删除同一个 virtual root 内的 origin，不能用另一个首行动的好路线替代当前候选，
  否则会破坏每个 legal root action 的独立估值。

### 可证伪义务与反例

| 命题 | 最小反例 | 必须证据 |
|---|---|---|
| 乐观上界不足才删除 | 当前资源不足，但途中宣传或移动牌足以补齐 | 目标仍在目录；真正总资源不足的目标被删除 |
| 非等价 conditional 不合并 | 同成本弃掉两张不同能力的牌，剩余手牌不同 | 两个后继 state key 不同，两个 Decision 都执行 |
| 版本号之外完全相同可合并 | 两个结算态只差 state/decision version | 后续同 action 只物理执行一次且两个 origin 都保留 |
| RNG 不同不得合并 | 盘面资源相同但 `meta.rngState.state` 不同 | semantic key 不同 |
| 富资源只支配同上下文贫资源 | 同目标同盘面 4/3/2 与 4/2/2；以及不同手牌、不同 target、不同 root | 仅第一组贫资源被删，三类反例全部保留 |
| 不恢复 beam/固定 conditional | 多个非等价 choice 与多个不可互相支配资源向量 | `beamPrunedOriginCount=0`，choice/向量数量不减少 |

实现中若发现需要忽略新的 committed 字段、Session 字段或牌实例身份，立即返回本设计阶段；
不得通过扩大 normalize allowlist 让测试通过。

### 固定盘面结果

12 次重复首决策门禁：

- executed 1812、expanded goal node 102、root target 42；
- `executionLimitReached=false`、remaining frontier 0、beam pruned 0；
- conditional equivalent merge 0、resource dominated origin 0：该盘面没有满足完整等价/支配证明
  的路线，因而没有把非等价选项硬剪；执行数下降主要来自正式 data conditional 排除
  skip/蓝附加槽和资源不可达路线；
- median 9465.82ms、p90 9611.25ms、max 9958.68ms，通过单次 10 秒门禁；
- median Rule Composition 8737.60ms，其中 execution 3674.27ms、projection 1642.00ms、
  checkpoint 935.72ms、frontier 284.51ms、orchestration 1842.49ms；
- `maxLeaves=8` 仍产生 937 次显式截断，因此结果是 no-beam、有物理保护且有限叶的搜索，
  不是无限叶完备搜索。
