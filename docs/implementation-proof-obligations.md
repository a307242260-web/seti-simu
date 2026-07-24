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

### 6. 复杂 Implementation 的设计冻结与批量执行

当任务已有可读取的旧生产实现，并满足以下任一条件时，不得采用“改少量代码、跑测试、从失败中猜下一处”的探索式调试：

- 存在 10 个以上可枚举的语义项、family 或 effect type；
- 跨越 3 个以上 owner、状态容器、Decision 或恢复边界；
- 验收要求完整迁移并物理删除旧入口。

首个生产 patch 前必须冻结完整 migration matrix。每个可达语义项至少写明：

| 字段 | 必须回答的问题 |
|---|---|
| 语义来源 | 完整集合从哪里机械导出，数量为何有限且可复核？ |
| 唯一 owner | 哪个 production domain 执行，是否只是复用现有正式 primitive？ |
| 状态归属 | 修改 committed root 的哪些字段，是否仍读取 Browser/模块全局状态？ |
| 确定性 | RNG、实体 id、sequence、时间或排序由谁持有并参与 replay/recovery？ |
| Decision | 是否有非等价选择，owner、legal choices、stale/late/wrong-owner 如何拒绝？ |
| 事务语义 | 费用、实体迁移、后续 effect、不可逆屏障和 CAS 边界是什么？ |
| 旧路径 | 旧 Browser/Simulation executor、pending、dispatcher 和 public bypass 在哪里？ |
| 删除证据 | 新路径完成后哪些符号、文件或调用必须为零？ |
| 行为证据 | 哪个正式 composition 测试证明完整 committed state、journal、replay 与恢复一致？ |

执行分为三个不可倒置的阶段：

1. **设计冻结**：读完完整旧实现和有限目录，填完整矩阵；未知项必须在此阶段显式解决或上报 blocker。矩阵未闭合，不得写生产代码。
2. **批量实现**：按相同 owner 与事务语义成批修改。批内允许 `node --check` 等快速语法检查；不得每增加一两个 handler 就提交、跑全量或依赖测试失败发现下一段设计。发现设计遗漏时，停止 patch，先回补矩阵并重新检查全部剩余项。
3. **集中验证与删除**：完整语义批次后运行定向行为证据；全部映射完成后运行 full-flow/全量门禁并物理删除旧路径。覆盖数增长、入口行数下降、局部 checkpoint 或测试暂绿都不构成完成。

reviewer 首先审 migration matrix 与根契约，再审代码。如果测试首次暴露的是“谁拥有状态、RNG 或 Decision”这类设计问题，应退回设计冻结阶段，而不是继续局部打补丁。

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

## 最小 Implementation Review Checklist

- [ ] 每条验收条款是否有独立 proof obligation，还是只有自然语言复述？
- [ ] 复杂迁移是否在首个生产 patch 前完成并冻结全量 migration matrix，而不是靠逐步测试发现设计？
- [ ] matrix 是否逐项覆盖 owner、state/RNG/sequence、Decision、事务边界、旧入口和删除证据？
- [ ] 状态 × action family × decision owner × fallback 禁区矩阵是否完整？
- [ ] `legal/enumerate` 的每个结果是否能从同一版本状态执行？
- [ ] 非等价多选是否外显为独立 step，并由正确 owner 决策、独立写 replay？
- [ ] 唯一选项与确定性事件是否明确区分，自动 drain 是否有上界？
- [ ] 旧 policy/resolver/UI/recover 路径是否有“调用为 0”的结构或 runtime 证据？
- [ ] 迁移债务归零后，合法保留状态是否已进入正式 owner store，并删除过渡 registry/schema/audit，而不是依靠 host-only/allowlist 豁免继续借用旧容器？
- [ ] 未迁移或未知状态是否 fail-closed，并输出 state/family/owner 诊断？
- [ ] family coverage 是否包含真实状态、enumerate、execute、replay 证据，而非静态 label？
- [ ] checkpoint/replay 是否至少跨过一个真实策略动作，比较 observation、legalActions 与 cursor？
- [ ] 常驻 runtime 是否同时通过 fresh A/A、同实例 A/A、同实例 A/B/A 与非零 checkpoint fork，而不是只验证冷启动 determinism？
- [ ] representative path、全 legal 合约、property 与压力测试是否各自承担清晰职责？
- [ ] 完成判据满足后，verification、decision 与 issue 最终 transition 是否同回合闭环？

## 采用

本模板是跨模块状态机和架构迁移任务的默认设计门禁。具体任务只引用与本次 proof obligation
直接相关的条目；历史 issue、阶段编号和临时文件清单不写入本长期模板。
