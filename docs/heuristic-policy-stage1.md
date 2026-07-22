# 公共 Heuristic Policy

## 边界

`randomizer/game/ai/heuristic-policy.js` 是公共 `DecisionContext -> PolicyDecision` 端口的启发式实现。它只读取 viewer observation、当前 legal Standard Action descriptors、确定性上下文和实例化时冻结的难度/策略配置；不请求或提交动作，不持有 pending，不执行 Effect，不读取 DOM、renderer、picker 或存储。

`randomizer/game/ai/heuristic-evaluator.js` 直接对 typed legal descriptor 估值并排序。原 `toLegacyCandidate`、`buildCandidates`、`policy.chooseTurnAction/choosePlayCard` 与 `candidate-pipeline.js` 已删除；app 顶层电脑行动的估值结果也必须先绑定完整 Standard Action descriptor，再经与玩家相同的 Action input port 提交。未知 family、family/phase 错配、空 legal set 或全部被配置禁用均结构化 fail-closed，不允许取首项或调用旧 resolver。

Policy 身份固定为 `heuristic / seti-heuristic-policy-v1`。`getProvenance()` 返回难度、family 权重与稳定配置 checksum，teacher demonstration、冻结 opponent 和浏览器席位必须记录同一份 provenance，不能另建训练专用 selector。

## Proof obligations

| 验收条款 | 可证伪命题 | 反例 | 证据 / 失败语义 |
|---|---|---|---|
| 只从 legal set 选择 | 对 15 个顶层与 7 个 conditional family，给定多项 descriptor 时返回的 `actionId` 均属于输入 legal set | 返回合成 id、旧候选或 hidden fallback | `heuristic-policy.test.js` 逐 family 双候选断言；公共 validator 再复核 |
| 无宿主职责 | 模块不访问 DOM/storage/Host automation，也不返回 effect、状态补丁或 continuation | poison getter 被读取，或 decision 多出字段 | 源码禁用依赖断言 + `PolicyDecision` 白名单 |
| fail-closed | 空 legal set、未知 family 或全被配置禁用时不取首项；同一 conditional request 可按共享 runtime 的合法集合混合 family | `actions[0]` 静默执行，或误拒“奖励/跳过”等跨 family 选项 | `HEURISTIC_POLICY_EMPTY_LEGAL_SET` / `UNSUPPORTED_FAMILY` / `NO_ENABLED_ACTION`；混合 family 完整对局反例 |
| 固定身份与配置 | 同配置的 policy provenance checksum 稳定，难度与权重不在迁移中改写 | teacher 与 opponent 各自维护版本/默认值 | provenance 精确断言；replay/export 记录该对象 |
| teacher/opponent 同实例 | 相同 context/legal set 经同一实例得到相同 action identity | training 专用分叉或 conditional 取首项 | 共享实例 fixture 对比 decision 与 policy version |

## 状态 × family × owner × fallback 矩阵

| 状态 | family | owner | Policy 行为 | 禁止 fallback |
|---|---|---|---|---|
| opening / turn | 15 个顶层 family | 当前席位 | 对 legal descriptors 做确定性排序并返回一个 id | action executor、DOM click、recover |
| pending / conditional | 7 个 conditional family，多项 | pending owner | family 内选择一个 descriptor | resolver、skip、首项兜底 |
| pending / conditional | 唯一项 | shared runtime | 不应创建 Policy request；若 Host 仍传入，Policy 只能返回该项 | 伪造额外选择 |
| terminal | 空集 | shared runtime | `HEURISTIC_POLICY_EMPTY_LEGAL_SET` | PASS / recover 伪装终局动作 |
| unknown | 未知 family 或错误 family/phase | shared runtime | `HEURISTIC_POLICY_UNSUPPORTED_FAMILY` / `DESCRIPTOR_INVALID` | legacy selector / 首项 |

浏览器 Host 与 simulation Host 仍拥有请求 session、公共 validator、提交、deterministic drain 和 journal；Policy 实例没有这些方法。

## 固定策略行为基线

`randomizer/training/heuristic-policy.seed-baseline.json` 冻结 `weak_start`、4 席、固定 seed 的完整 306 步 action trace hash、逐席终局分、family 计数和 policy provenance。测试要求真实 Policy 终局、完整选择身份与逐席分数不漂移，并要求打牌、科技、扫描、分析、移动、环绕和登陆均真实发生，同时限制公司 1x 不得重复空转；它是确定性行为回归，不是机器人强度或稳定档位验收。产品水平必须另用多 seed 分布、低尾与浏览器完整局判断。
