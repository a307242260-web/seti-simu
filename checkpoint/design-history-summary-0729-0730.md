# SETI 性能阶段 5 份 checkpoint 结构化摘要

---

## 1. `checkpoint/seti-heuristic-normal-iterations-v36-v40-design-20260729.md`

**1.1 主题与要解决的问题**
启发式策略的 5 轮正常迭代（v36–v40）。每轮只实现**一个结构候选**，用固定局完整均分验证，只有"均分严格上升且行为正确"才保留，否则回退。解决的是目标选择、资源释放、转换效率等**行为质量**问题（非性能）。

**1.2 冻结的设计决策**
- 固定盘面/seed：`seti-104-board-v1` / `seti-104-official-v1`；v35 基线 68/60/49/49、均分 56.5、终局资源 12。
- 每轮一个结构候选；分数、科技、收入为一级评价；不增加库存分；不降低 128 node、15 代理目标、10s 门槛。

**1.3 实验/验证结果**

| 轮次 | 固定局结果 | 性能 | 结论 |
|---|---|---|---|
| v36 | 与 v35 完全一致 | 144.01ms/候选 | 回退 |
| v37 | 与 v35 完全一致 | 145.27ms/候选 | 回退 |
| v38 | 未完成 | 第 322 决策 10.606s 触发失控保护 | 回退 |
| v39 | 75/65/64/54，均分 64.5（+8），终局资源 6 | 153.84ms/候选，最慢 8.171s | **保留** |
| v40 | 与 v39 完全相同 | 153.25ms/候选 | 回退 |

最终保留 **v39**，发布为 `seti-heuristic-policy-v16` / `secondary-agent-rollout-v6`；固定局实交 34 次快速转换、12 发射、52 移动、5 环绕、9 登陆、7 卡角、4 打牌、4 分析。

**1.4 被否决或修正的方案及原因**
- v36 收窄到新增 `cardInstanceId`：换牌后借用原本已合法旧牌收益 → 否决。
- v37 比较"直接执行 vs 先转换再执行"资源下界：为花钱而放弃更便宜正式支付 → 否决。
- v38 扫描→分析跨目标锁定：数据不足却循环放置/PASS → 否决。
- v40 目标完成后释放 routeTarget 重选：追逐已消失 targetId → 否决。

**1.5 沉淀的长期约束/教训**
单一结构变更 + 严格上升门槛是可靠的保留准则；**跨回合可达性下界与状态去重**是防止搜索失控（10s 超时）的必需件；目标释放语义必须与正式资源缺口绑定，否则产生无意义转换。

---

## 2. `checkpoint/seti-counterfactual-runtime-performance-design-20260729.md`

**2.1 主题与要解决的问题**
反事实执行**无损**性能优化：在不减少目标、路线、conditional choice、叶或节点预算的前提下降低每节点规则执行成本，为后续恢复非支配路线探索腾预算。Profile 发现 `structuredClone` 占 3.78s，最大来源是 authority 仅为读 `stateVersion` 重复克隆完整 committed state；另一个确定性重复是反事实 submit 内部生成一份**从未被消费**的默认 projection。

**2.2 冻结的设计决策**
- 不降 `maxNodes=128`、`maxExecutionNodes=512`、`maxProxyDepth=15`、`maxLeaves=8`；不加 beam、不取第一项、不单目标/单转换；不缓存带随机消费、Decision owner、Session revision 或 working state 的执行结果。
- authority 优先读传入 root 的 `meta.stateVersion`，缺字段才回退 StateSource（只读字段，非法 context 仍走原 fallback）。
- 内部提交链增加 `skipProjection` option，仅 trusted counterfactual caller（`executeNode`）启用；默认 submit 仍返回 projection；叶 observation 必须 action 正式提交后生成，不缓存、不裁字段。

**2.3 实验/验证结果**
12 次 `benchmark_probe_policy`：median wall **5019.43→2956.30ms（−41.1%）**；p90 3055.07、max 3186.14；counterfactual 2704.43ms（提交事务 1496.58、projection 447.40、checkpoint 233.19、fork 104.73、其余 421.58）。覆盖逐项一致：candidate 15、executed 337、expanded 18、root target 11、frontier 52/15、pruned 316、transposition 0。

**2.4 被否决的方案**
Effect Runtime 单次 observe 复用 inspection 中的 Decision：三次 wall 2.87–3.03s，未稳定优于前版 2.79–2.87s（多数节点不等待 Decision，节省盖不住额外克隆）→ 撤销，不进生产。

**2.5 长期约束/教训**
克隆整棵 state 只为读一个 number 是最大浪费；未消费 projection 是重复物化；任何优化必须以 **benchmark diagnostics 证明覆盖逐项不变**为门禁，漂移即失败。

---

## 3. `checkpoint/seti-trusted-fork-ownership-design-20260730.md`

**3.1 主题与要解决的问题**
物理共享恢复 42 个目标后打满 `maxExecutionNodes=512` 保护（median 4.63s）。按计划进入 COW 方向，但**首批不直接上 Proxy/slice COW**，而是在严格隔离的 counterfactual fork 内实施"所有权转移"：executor 返回后把独占 `nextState` 所有权转给 Session，commit 时转给 fork-local StateStore，验证+CAS 后原位冻结，Session/Store 共享同一不可变对象，消除多次全量复制。

**3.2 冻结的设计决策**
唯一开关链：`createCounterfactualFork → createRuleComposition({allowTrustedForkLifecycle:true}) → StateStore/EffectRuntime({trustedIsolatedOwnership:true})`。任何 canonical composition、Browser restore、普通 Simulation step、训练 replay 都不能设置；只凭 caller 参数不能临时开启。禁止：跳过 validateState/CAS、省略 undo frame/journal/Decision owner/RNG/replay、mutable state 进跨节点缓存、canonical 用 ownership transfer、因性能改 beam 预算。

**3.3 实验/验证结果**
同一 512 节点 benchmark：median **4629.13→3926.92ms（−15.2%）**；submit transaction 2292.65→1615.19（**−29.6%**）；42 targets、293 shared origins、512 executed nodes、5 remaining frontier 及全部 pruned 指标与优化前一致。诊断提到 `maxExecutionNodes=1024`：852 节点后 frontier 归零、5.79s，42 targets、305 shared origins——仍有 **409 个 origin 被"每虚拟目标一条路线"beam 剪掉**。

**3.4 被否决/修正**
当前**不引入** Proxy/slice COW；结论：所有权转移保留，现有性能能在 10s 内完成 beam 限定的 42 目标搜索；下一步把保护提到 1024 并移除有损 beam，只有该版本重新超 10s 才做 slice COW。

**3.5 长期约束/教训**
低风险"少复制一次"也能拿 15% 级收益，先榨干复制/所有权浪费再考虑 Proxy；beam 剪枝才是剩余性能问题的主要来源，COW 决策要等 no-beam 真实结果。

---

## 4. `checkpoint/seti-physical-action-sharing-design-20260730.md`

**4.1 主题与要解决的问题**
同一反事实 envelope、同一 Standard Action、同一规则深度的执行结果与虚拟 `routeTargetId` 无关，应**只提交一次真实 Action/Decision**，再把 observation、successors、Session checkpoint、RNG 结果分发给所有兼容虚拟目标 origin。这是无损公共子表达式消除，不是结果缓存，也不减少目标或路线。

**4.2 冻结的设计决策**
- 物理节点等价键 = `envelope bytes + session checkpoint + actionId + rule depth`（branch key 不含虚拟目标，同一物理 action 只消费一次派生 RNG，仍建立正式 child checkpoint）。
- 虚拟 origin key = `rootActionId + rootRouteTargetId + currentRouteTargetId + proxyDepth`（不创建规则 id、不消费 RNG）。
- 根目标从 `matchedGoals[0]` 恢复为**全部 matched goals**；后继选择 per-origin 不共享 selector 结果；leaf/frontier id 必须含 root target。
- beam 公平单元修正为 `root action + root target`，但**每虚拟目标仍只保留一个 frontier 节点**——明确是有损 beam，本批不解决，单独移除。

**4.3 实验/验证结果**
12 次 benchmark：root target **11→42**，同一物理节点服务 **293 个额外虚拟 origin**；transposition/物理合并 337 次、实际执行 512 次，不共享需约 805 次提交；median 4629.13ms、p90 4704.20、max 4711.66；frontier 76/40、最大 origin 96；触发 512 保护、5 个 frontier 未执行——**明确非完备探索**。

**4.4 被否决/修正**
不得把本批结果描述成完备搜索；每目标单路线 beam 将在物理共享 benchmark 后单独移除，不能混淆"共享"与"完备"。

**4.5 长期约束/教训**
物理共享收益巨大（805→512 次提交）且必须保留；但恢复 42 目标后已打满执行保护，进入 COW 合理——**绝不能用跳过状态校验或 Session 事务换速度**；共享执行后 per-origin 的 chain/目标/深度 metadata 必须独立。

---

## 5. `checkpoint/seti-no-beam-search-design-20260730.md`

**5.1 主题与要解决的问题**
关闭"每个 root action + root target 只保留一个 frontier 节点"的 beam，测量固定盘面首决策能否 10 秒内自然耗尽 frontier；用户明确要求**先移除 beam，再根据真实结果决定是否继续 COW**。不改变目标、估值、状态等价或规则执行。

**5.2 冻结的设计决策/边界**
`maxProxyDepth=15`、`maxNodes=128` 保持；仅实验把 `maxExecutionNodes` 从 512 提到 2048（作为失控保护，**不作为剪枝**）；`maxLeaves=8` 暂时保持；触发 2048 或 10s 即标记 incomplete，不拿部分结果冒充完备。

**5.3 实验/验证结果（三段递进）**
1. **关 beam + 2048**：wall 12299ms 超时；executed 2048 触顶、remaining frontier 4921、beam pruned 0；root target 42。剩余约 7000 物理节点——事务成本再降 20–30% 也救不了组合爆炸。
2. **改 best-first**（每轮只执行排序第一的物理节点，其余 exact-merge，不删节点）：2048 保护下 wall 14034ms、剩 40 frontier；4096 下 **2738 个物理节点自然完成、wall 18487ms**；frontier 管理仅占 1.6%，瓶颈在规则状态复制与投影物化。
3. **Proxy COW 原型未通过行为验证、全部撤回**：规则域 **38 个文件直接调用原生 `structuredClone`**，不认 Proxy，触发 `EFFECT_EXECUTOR_THROWN`/`DataCloneError`；必须先把这些调用迁移到统一、可识别 draft 的 snapshot primitive（跨 38 文件状态架构迁移），不能作为附带优化。

随后两项修正并冻结：
- **目标约束搜索状态机**：target-bound / target-decision / target-completion-pending / target-completed / target-blocked；禁止通用 legal fallback、字典序 `slice(0,1)` 冒充完整 choice、PASS 掩盖不可达、先执行再反猜 target。`maxProxyDepth=15` 只统计完成的次级代理动作。
- **三类可证伪剪枝**：①目标资源不可达（乐观上界证明：资源自由提前使用、宣传提前到账、手牌/数据乐观补足仍不够才删；data/card/未知目标不证明、缺字段视为可达，不改变 legal action）；②conditional 行为等价（同一完整 committed state 仅版本号不同、无 active Session、下一 action 的 actor/family/phase/target/payload 完全相同才合并；RNG/sequence/牌实例/盘面/Decision payload/目标 origin 全参与 key）；③同目标资源支配（同 virtual root、同 route target、同完成深度/状态，三项资源逐项不少、quick trade 不多、至少一项严格更优；不同 root candidate 不互剪）。**禁止把非等价 conditional 固定为一个选项**。

固定盘面 12 次门禁：executed 1812、expanded goal 102、root target 42；`executionLimitReached=false`、remaining frontier 0、beam pruned 0；conditional merge 0、resource dominated 0（该盘面没有满足完整等价/支配证明的路线，未硬剪非等价选项；执行数下降主要来自正式 data conditional 排除 skip/蓝附加槽和资源不可达路线）；**median 9465.82ms、p90 9611.25、max 9958.68，通过 10s 门禁**；`maxLeaves=8` 仍 937 次显式截断——是 no-beam、有物理保护、**有限叶**的搜索，不是无限叶完备。

**5.4 被否决/修正**
纯常数级优化救不了组合爆炸（先修调度 best-first 再谈剪枝）；Proxy COW 被原生 structuredClone 卡死、原型全部撤回（不能以破坏规则路径的原型换 benchmark 数字）；no-beam 代码在性能工作完成前仍受 512 保护，触顶必须保持 incomplete。

**5.5 长期约束/教训**
10 秒门槛与 incomplete 语义不可妥协；剪枝必须可证伪并有反例测试（乐观上界、完整等价 key、逐项偏序），**禁止退回"每目标只取一条"或固定 conditional**；发现需忽略新 committed/Session 字段时立即返回设计阶段，不得扩大 normalize allowlist 让测试通过。

---

## 跨文件总结（性能阶段最核心的 3 条经验教训）

① **覆盖不变是性能改动的硬门禁**：每次优化都以 executed/expanded/pruned/leaf/root target 等指标逐项一致为验收，任何减少目标、路线或 conditional 的方案一律回退。

② **先削复制成本、再动结构**：为读版本号克隆整棵 state、未消费 projection、多次全量复制先后被消除（wall −41%、−15%）；但组合爆炸非常数优化可解，no-beam 仍需 18.5s。

③ **剪枝必须可证伪、不冒充完备**：靠乐观上界资源不可达、conditional 等价、同目标支配三类证明把 wall 压到 9.5s；Proxy COW 被 38 处原生 structuredClone 卡死，须先迁移统一 snapshot 原语；触顶必须标 incomplete，禁止恢复 beam 或固定 conditional。
