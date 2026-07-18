# 跨模块状态机与迁移任务 Proof Obligations

## 目的

测试用于验证已经推导出的正确性，不负责首次定义正确性。跨模块状态机、规则内核或 runtime 迁移在实现前，应把每条验收条款转换成可证伪的 proof obligation，并明确实现落点、检查问题和证据。静态 family 清单、coverage label、单条 happy path 或最终吞吐数字都不能单独证明行为完成。

## 使用时机与完成条件

以下任一情况触发本模板：

- 枚举器与执行器分离，例如 `legalActions` / `step`、mask / transition。
- 一个动作会进入新的 owner、phase、pending 或 conditional decision。
- 迁移要求禁止旧实现、resolver、policy 或 fallback 继续参与。
- 多个 family、状态或模块从旧 runtime 迁往新边界。
- 完成代码和验证后还需同步 issue 状态收口。

模板完成的判据不是“每行都填了”，而是：

1. 每条验收条款至少对应一个可失败的命题。
2. 每个全称、否定或完备性命题都有与量词匹配的证据，不能只给示例。
3. 每个 fallback 禁区都有结构或运行时证据。
4. 每个非等价决策都有 owner、独立 timestep 和 replay 归属。
5. 完成判据、验证结果和 issue 最终 transition 能在同一收口回合机械对齐。

## 正向推导流程

### 1. 拆出边界与量词

先圈出验收条款中的边界词：`所有`、`不得`、`唯一`、`两个以上`、`未迁移`、`同一版本`、`独立`、`直接`。它们决定证据强度。

| 条款形态 | 必须推出的义务 | 不能接受的替代证据 |
|---|---|---|
| 所有 family / action | 对完整集合逐项成立，且集合来源可解释 | 列出名称、挑一条 happy path |
| 不得调用 / fallback | 禁止依赖不可达，或调用即失败 | 正常样例里“似乎没调用” |
| 两个以上非等价选项 | 必须停在外部 owner 的决策边界 | 环境内部取第一项或旧 policy 代选 |
| 未迁移 | 明确拒绝并报告状态，不得继续 | 静默跳过、自动 resolve |
| replay / checkpoint parity | 每个策略决策均有独立事件并可重放 | 只比较终局分数 |

### 2. 建立完备性矩阵

至少按以下四个维度展开，不允许只按代码文件或已知路径检查：

- 状态：opening、turn、pending、conditional、terminal，以及迁移中的未知状态。
- action family：全部顶层和条件动作族。
- decision owner：当前玩家、对手、环境确定性结算、外部 policy。
- fallback 禁区：旧 resolver、heuristic policy、DOM/UI callback、recover/skip。

每个矩阵单元标记为 `策略决策`、`唯一项自动推进`、`确定性事件` 或 `未支持并 fail-closed`。只写 `covered` 不构成完成证明。

### 3. 填写 proof obligation

每条义务使用以下模板：

| 字段 | 内容 |
|---|---|
| 验收条款 | 原始自然语言，不改写成弱化版本 |
| 可证伪命题 | 给定哪些状态/输入，必须成立或必须不发生什么 |
| 反例构造 | 最小失败状态、动作、owner 或 fallback 调用是什么 |
| 实现落点 | 枚举、transition、drain、composition、replay 或 workflow 的唯一责任点 |
| 检查问题 | reviewer 能用“是/否 + 证据”回答的问题 |
| 验证证据 | 与命题量词匹配的结构检查、断言、合约或轨迹 |
| 失败语义 | 义务不满足时如何 fail-fast / fail-closed，包含哪些诊断字段 |

### 4. 先造反例，再实现 happy path

实现前至少写出一个会推翻当前设计的最小反例。全称命题优先生成集合内逐项反例；否定命题优先给禁用依赖装 spy 或结构扫描；迁移完备性优先构造未知 family / pending。不能构造反例通常说明条款仍不可验证。

### 5. 常驻 runtime 的 episode / checkpoint 隔离矩阵

对会复用同一 runtime、worker、bundle 或模块注册表的环境，`fresh env + 同 seed` 可复现只证明冷启动路径，不能证明 reset 清空了模块级状态。至少同时比较完整 observation、legalActions、replay cursor、RNG 与稳定 id：

| 关系 | 必须证明 | 典型反例 |
|---|---|---|
| fresh A / fresh A | 冷启动同 seed/config 完全一致 | seed 未覆盖某个随机源 |
| same instance A / A | reset 清空 cache、pending、日志、计数器和模块闭包 | 第二次 reset 牌序、轮盘或 action id 漂移 |
| same instance A / B / A | 中间 episode 不污染再次进入 A | B 的状态、RNG 或派生 cache 残留到 A |
| non-zero checkpoint fork | 真实 policy action 后恢复 observation/legal/reward/cursor/RNG parity | opening 恢复通过，执行一步后候选漂移 |
| crash/timeout recovery | 只重放已确认 action，恢复结果等价于 fresh reset+journal | 失败 action 入 journal 或旧 episode 串入新局 |

若传统模块以 `globalThis`、模块单例或闭包持有局内状态，测试必须使用真实复用实例；每次都新建 env/worker 会把污染隐藏掉。性能 benchmark 也不能用“每局重启”替代隔离修复。

## SETI-40 失效链

SETI-40 原始契约已经包含“已验证 action”“非等价策略结果立即停在 conditional”“resolver/policy 不进入热路径”“未迁移不得静默 fallback”。四个缺口都可在不运行 SETI-39 下游测试时正向推出。

| 失效点 | 原契约推出的义务 | 本应发现阶段 | 原检查为何漏掉 | 提前阻断证据 |
|---|---|---|---|---|
| legal 可枚举但执行拒绝 | 对任意 checkpoint `s` 和 `a ∈ legalActions(s)`，从同一 `s` 执行 `step(a)` 必须成功或达到声明的终态 | 设计：枚举与执行共享 legality；实现：每个 selector 有可执行前置条件；自检：同 checkpoint fork 逐项执行 | smoke 总是优先 PASS/end-turn，只证明一条轨迹可走；稳定 action id 和 mask 不证明 transition 接受 | 全 legal-action 合约：快照一次、逐动作独立恢复执行；失败输出 state/family/action/precondition |
| conditional 只有静态 label | 若选项数大于 1 且结果不等价，环境必须在该 owner 的 `conditional_choice` 停止；一次外部选择对应一个 replay step | 需求拆解：区分 family 清单与行为 timestep；实现：enumerate/execute/replay 三处成对落地 | `CONDITIONAL_FAMILIES` 只证明名称存在；终局 parity 会掩盖环境内部代选 | 为每个 conditional family 构造多选状态，断言 owner、mask、独立 step、replay cursor +1，且未调用 policy |
| 旧 heuristic/resolver 仍代选 | rollout 热路径对禁用依赖的调用次数恒为 0；多选结果只能由外部 policy 提供 | 架构设计：画清 decision owner 和 forbidden dependency；代码检查：扫描 composition 与 drain | 性能达到门槛、正常终局都不能证明依赖不可达；旧 resolver 恰好选中合法项时行为表面正常 | 源码/依赖结构检查 + runtime spy/counter；任一禁用调用使合约失败 |
| 未迁移状态静默 fallback | 任意未声明迁移的 pending/family 必须返回结构化 unsupported 并停止，不能 resolve、skip 或取首项 | 迁移设计：矩阵每格只有 migrated 或 fail-closed；实现：默认分支拒绝 | 只验证已知 family 的 coverage，没有刻意进入未知/长尾状态 | 注入未知 pending/family 的负向测试；断言错误包含 state、family、owner 且旧 resolver 调用为 0 |
| 返工和完成后流程中断 | `next_action` 非空且无真实 blocker 时继续执行；完成判据满足后同一回合写 evidence/decision 并执行 `done` | 执行编排与收口 | 阶段性结果被当成交付边界；代码完成、metadata 和状态 transition 分成了不同回合 | issue timeline lint/人工收口检查：无 blocker 不停止；`verification_result + decision + done` 同回合对齐 |

这条链说明首因不是“缺一条随机测试”，而是全称、否定和决策所有权条款没有被转换成与量词匹配的义务。随机轨迹只是碰巧替设计阶段构造了反例。

## 验证手段分层

| 层级 | 主要职责 | 典型缺陷 | 不能单独证明 |
|---|---|---|---|
| 类型 / 结构检查 | schema、依赖方向、禁用符号、exhaustive switch、required context | 漏字段、旧 resolver 仍接线、声明 family 无 handler | 运行时前置条件与真实状态可达性 |
| 运行时断言 | 版本、owner、状态不变量、未知分支 fail-closed | stale action、owner 错配、静默 fallback | 全状态空间都触发过 |
| 示例测试 | 已知规则与错误消息的精确回归 | 典型 family 的局部行为错误 | `∀ action/state` 的完备性 |
| 全 legal-action 合约 | 同一状态下 mask 与 executor 一致 | legal→executable 断裂 | 长轨迹后的状态污染与稀有状态 |
| property / metamorphic | 多 seed、多状态下不变量，重排/重放/恢复关系 | checkpoint 漂移、枚举不稳定、owner/replay 不守恒 | 绝对禁止依赖，除非同时装 spy |
| 随机 / 压力测试 | 可达长尾、终局率、阻塞率、吞吐与资源稳定性 | 稀有 pending、组合爆炸、性能退化 | 正确性定义；失败后仍需回到具体 proof obligation |

推荐顺序是结构检查和局部断言随实现落地，再跑示例、全 legal 合约、property/metamorphic，最后用随机/压力扩大状态覆盖。后层不能替前层补定义。

## 非过拟合检查：SETI-36 runtime context 迁移

SETI-36 不是 legal-action 环境，而是 controller/runtime composition 迁移。用同一模板可从“收窄 `createAiController(context)` 注入面、保持稳定 API、完成 controller wiring”推出：

| 验收条款 | 可证伪义务 | 反例 | 提前证据 |
|---|---|---|---|
| runtime 声明显式 context | 每个 `REQUIRED_CONTEXT_KEYS` 在 composition 创建时都存在；缺项不能推迟到深层 callback | 删除 `cancelCardTriggerChoice` 或深空换牌阈值注入 | bootstrap fail-fast 枚举缺失 keys |
| controller 只做 wiring | 迁移函数体不再留在 controller，稳定 API adapter 仍指向新 owner | 新模块存在但旧实现仍可达，或 API 仍引用已删除闭包 | 原实现删除结构检查 + API contract smoke |
| runtime 边界稳定 | 代表性 pending/confirm/cancel 路径只使用声明 context | 语法通过，但低频嵌套 callback 首次执行才 `ReferenceError` | 领域执行路径 + 全量 Node；浏览器装配变更再补 Chrome smoke |

该义务在 SETI-36 实际于提交前发现 `cancelCardTriggerChoice` 和深空换牌阈值两处漏接线。它验证了模板的核心不是某个 headless family，而是“从边界声明提取全称/否定命题，再用可证伪证据检查 composition 完备性”。

## 最小 Implementation Review Checklist

- [ ] 每条验收条款是否有独立 proof obligation，还是只有自然语言复述？
- [ ] 状态 × action family × decision owner × fallback 禁区矩阵是否完整？
- [ ] `legal/enumerate` 的每个结果是否能从同一版本状态执行？
- [ ] 非等价多选是否外显为独立 step，并由正确 owner 决策、独立写 replay？
- [ ] 唯一选项与确定性事件是否明确区分，自动 drain 是否有上界？
- [ ] 旧 policy/resolver/UI/recover 路径是否有“调用为 0”的结构或 runtime 证据？
- [ ] 未迁移或未知状态是否 fail-closed，并输出 state/family/owner 诊断？
- [ ] family coverage 是否包含真实状态、enumerate、execute、replay 证据，而非静态 label？
- [ ] checkpoint/replay 是否至少跨过一个真实策略动作，比较 observation、legalActions 与 cursor？
- [ ] 常驻 runtime 是否同时通过 fresh A/A、同实例 A/A、同实例 A/B/A 与非零 checkpoint fork，而不是只验证冷启动 determinism？
- [ ] representative path、全 legal 合约、property 与压力测试是否各自承担清晰职责？
- [ ] 完成判据满足后，verification、decision 与 issue 最终 transition 是否同回合闭环？

## 采用与后续门禁

本模板先作为项目级 loop template 使用。当前不新增通用 coding 子 issue：SETI-40 已有全 legal-action、禁 resolver 和 fail-closed 定向合约，SETI-36 也已有 context fail-fast；立即再造跨架构通用 runner 容易把不同状态模型硬套成同一接口。后续若第二个独立状态机再次出现“coverage label 代替行为证据”或“legal→executable”断裂，再拆边界明确的 coding issue，将矩阵 schema、禁用依赖 spy 和同 checkpoint action fork 做成可复用门禁。
