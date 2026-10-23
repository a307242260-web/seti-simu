# SETI AI 当前接口清单

核对日期：2026-10-22。依据当前工作树；核对起点 HEAD 为
`0e82a4b97c8e4b0b2ce77a11b549d7af1e8a2699`，包含尚未提交的代码，不能仅凭该提交重建本清单中的实现。

当前可以复用的基础是 Production 规则、按席位投影的观察、合法动作、隔离分支和存档恢复。
新 AI 可以绕过旧启发式策略与目标系统，接入共享协调器的决策函数边界。
2026-10-23更新：通用factory、可信分析端口、独立估值和搜索已提供；
Browser/Simulation都可显式选择实验search玩家，未闭合仍失败，不代表整局能力已完成。
搜索v20另提供按完整状态与合法信封校验的最优前缀复用；证明与容量见[复用契约](ai-plan-prefix-reuse-proof-20261023.md)。
搜索v21增加可信`knownCardMoneyOrder`，按已审计DSL结构证明稳定节点的钱电支配；
未知模型继续普通搜索，范围见[证明契约](ai-known-card-money-proof-20261023.md)。
搜索v22的`cardTradeBound`使用交易局部保留牌闭包，仍只返回数量变化与证明，
由冻结模型计算界并以真实信息边界核对，见[取牌界v4](ai-card-trade-bound-proof-20261022.md)。
搜索v23新增`postMainCornerChoiceSpec`，只对主行动后已证明的同用途角标给出代表/省略动作，
范围和身份限制见[角标选择等价](ai-post-main-corner-choice-proof-20261023.md)。
搜索v24扩展既有`postMainPlanSpec`的[不活动保留牌范围](ai-post-main-plan-proof-20261022.md)，
不增加接口、状态合并或新预算；未知和活动保留牌仍回到普通搜索。
搜索v25新增`preMainDataPlanSpec`，输出[主行动前数据资源下界与严格省略](ai-pre-main-data-proof-20261023.md)，
可与原开局计划合成；算法不读取私有状态，也不把未完成图作为计划证据。
搜索v26新增`postMainBorrowSpec/expandPostMainBorrow`，以[图灵主行动后更短继续路径](ai-post-main-borrow-proof-20261023.md)
省略无效借用，保留有效orange2，宏计两次正式输入；已提交的借用Decision仍比较所有选项。
新的开发顺序见 [AI 开发流程](ai-development-workflow.md)。

## 机器决策调用链

```text
Browser bootstrap                  Simulation env
        │                                │
        └── machine-player-coordinator ───┘
             readBoundary(seatId)
                ├── 当前 Decision choices 或 enumerateActions
                └── projection(viewer) → createDecisionObservation
             可选 planReuseCheck
             注册的同步决策函数(boundary) → { actionId, plan? }
             execute(当前合法集中的原始 descriptor)
                └── Production inputPort → Action / Decision / Effect
             recordStep（Simulation 记录 replay 和 reward）
```

决策函数是可替换点。协调器拥有正式执行与旧计划缓存；新完成证据留在本席算法和可信分析端口。
策略不需要复制执行器。
条件 Decision 的 owner 可能不是当前 turn 玩家，必须按当前合法集和 session 解析席位。

## 接口和责任

下表链接均指仓库源码。标为“现有”的 API 不代表已完成所有环境和场景验收。

| 层 | 现有入口 | 输入输出与边界 |
| --- | --- | --- |
| 共享规则装配 | [production-kernel.js](../randomizer/game/production-kernel.js)、[production-composition.js](../randomizer/game/production-composition.js) | 创建正式规则与 composition；Browser 和 Simulation 共用 |
| 合法动作 | `composition.inputPort.enumerateActions({})` | 返回原生 Standard Action descriptor；awaiting_input 时协调器读 `inspect().session.decision.choices` |
| 正式提交 | `inputPort.submitAction`、`submitQuickAction`、`submitDecision` | Action 与 Decision 使用不同提交信封；Decision 带 decisionId、decisionVersion、ownerId、choice |
| 席位观察 | `composition.projection(viewer).state` | viewer 为 `{playerId, role:"player", viewerId?}`；只把该席位可见信息交给策略 |
| AI 观察构造 | [outcome-model.js](../randomizer/game/ai/outcome-model.js) 的 `createDecisionObservation(source, {seatId,stateVersion,decisionVersion})` | 深冻结的决策观察，含 viewer、authority、publicState、selfState、outcomeProjection |
| 机器协调 | [machine-player-coordinator.js](../randomizer/game/ai/machine-player-coordinator.js) 的 `createMachinePlayerCoordinator({composition,execute,recordStep?,onDiagnostic?})` | `registerSeat(seatId, fn)`、`readBoundary`、`runDecision`、`resetPlans`；fn 同步返回 `{actionId,plan?}` |
| Policy 数据协议 | [policy-port.js](../randomizer/game/ai/policy-port.js) | `createDecisionContext`、`createPolicyDecision`、`validatePolicyDecision`；这是策略内部可选协议，不等同于协调器函数签名 |
| 旧搜索服务 | [rule-composition.js](../randomizer/game/rule-composition.js) 的 `counterfactualPort.evaluate(actions, options)` | 在正式规则分支执行并输出 actionOutcomes；已含搜索与策略回调机制，不能视为纯规则原语 |
| 分支原语 | `counterfactualPort.createFork(envelope, forkOptions)` | 从生命周期 envelope 创建隔离分支；只供可信搜索适配层使用，不能把 envelope 交给策略 |
| 新分析与证据 | [analysis-port.js](../randomizer/game/ai/analysis-port.js) 的 `openRoot/expand/rememberPlan/reusePlan` | 不透明节点；完整窗口完成后颁发本席证书，按完整身份、RNG、合法信封和模型验证后复用 |
| 分支诊断 | `counterfactualPort.getDiagnostics()` | 上次 evaluate 的预算、执行和裁剪诊断；不是所有自定义搜索的通用计时器 |
| 旧估值 | [expected-score-evaluator.js](../randomizer/game/ai/expected-score-evaluator.js) 的 `evaluateState`、`evaluateStateValue` | 同文件还含目标枚举、后继选择与搜索优先级；新 AI 不把整个模块作为规则依赖 |
| 旧计划复用 | [plan-continuation.js](../randomizer/game/ai/plan-continuation.js) | 从真实执行证据构造计划；协调器逐步检查依赖和合法性后消费 |

Standard Action 使用 `seti-standard-action-v1`，主要字段为：

```js
{
  schemaVersion, actionId, actorId, stateVersion, decisionVersion,
  family, phase, target, payload, summary
}
```

`actionId` 属于当次权威边界。恢复、状态推进或重新枚举后，不能只按 family 找一个相似动作替代。
`summary` 是展示文本，策略应使用结构化字段。
正式 family 以 Production registry 为准；`simulation-contract.js` 的静态列表遗漏了
Production 已有的 `complete_task`，不宜作为完整动作词表。

## 三种容易混淆的观察和结果

| 数据 | 当前 schema | 使用者 |
| --- | --- | --- |
| Simulation observation | `seti-rl-observation-v1` | 环境调用方；含 perspectivePlayerId、decision、requirements、terminal 等 |
| 决策 observation | `seti-decision-observation-v2` | 协调器决策函数和 Policy；由 outcome-model 派生，不能直接假设字段与 RL observation 相同 |
| Policy context | `seti-policy-context-v1` | Policy；含 requestId、seat/version、observation、legalActions、actionOutcomes、deterministicContext |
| Policy decision | `seti-policy-decision-v1` | Policy 校验器；含请求身份、actionId、policy 元数据和白名单 diagnostics |
| Action outcome | `seti-action-outcome-v1` | 旧搜索与 Policy；含根观察、settled/unresolved 状态及叶 |
| Simulation checkpoint | `seti-rl-checkpoint-v1` | 可信宿主恢复，包含隐藏权威状态，不是策略输入 |
| Simulation replay | `seti-rl-replay-v1` | 已确认输入的重放和训练记录 |

Policy context 会复制、校验和深冻结数据，但禁止字段名检查不能代替上游的隐私投影。
`validatePolicyDecision` 需要调用方提供 `registry.validate` 和 `runtimeContext`。
协调器当前直接检查返回的 actionId 是否属于边界合法集，再交给 execute；并不自动走此 validator。

## Simulation 可用接口

入口是 [simulation-env.js](../randomizer/app/simulation-env.js) 的 `createSimulationEnv()`。

| 方法 | 当前行为 |
| --- | --- |
| `reset(config)` | 创建新局；主要配置含 seed、activePlayerCount、aiDifficulty、计划复用与旧 V 开关 |
| `observe(playerId?)` | 返回席位观察 |
| `legalActions(playerId?)` | 返回原生 descriptor；指定非当前 owner 时为空；terminal 时为空 |
| `step(descriptor)` | 校验并提交一个 Action/Decision；返回 ok、observation、legalActions、reward、done、replayEvent 等 |
| `isTerminal()` | 检查正式结束和剩余终局标记；不能用“第 5 轮”或某个席位 pass 代替 |
| `createCheckpoint()`、`loadCheckpoint(cp)` | 保存和恢复权威生命周期、RNG 与 replay；恢复会重建宿主和清空计划 |
| `getReplay()`、`loadReplay(replay)` | 导出、加载环境 replay |
| `saveBrowserSave(options)` | 导出 Browser 存档 |
| `createCounterfactualFork(envelope?, options?)` | 暴露底层隔离分支，含可信规则能力 |
| `getDiagnostics()`、`dispose()` | 环境诊断与释放 |
| `runHeuristicPolicyDecision()` | 选择并实际提交一步，内部固定创建旧决策函数 |
| `runAgentDecision()` | 经共享factory与协调器选择并实际提交一步；支持completion、实验search和注入的custom |
| `runVGuidedDecision(options)` | 只选择，返回 `{action,seatId,diagnostics,evaluations}`；调用方还要 step |

runVGuidedDecision只选择，其余上述run方法实际提交，不能互换。
内置类型在reset的agentType选择；自定义factory通过createSimulationEnv({agentFactory})注入。
搜索使用[共享玩家契约](ai-search-agent-contract-20261023.md)，不调用旧目标或估值模块。

## 当前 AI 实现的接入限制

1. **旧 Heuristic 将多层职责绑在一起。**
   `heuristic-decision-function.run` 先过滤候选、调用内置反事实搜索，再调 Policy 并提取计划。
   只换 Policy 无法验证独立的候选生成或搜索算法。
2. **V 引导包装的分派没有实际消费。**
   `v-guided-decision-function` 向 Heuristic factory 传 `policyFor`，但后者只调用
   `defaultPolicy.decide(context)`，没有读取 `policyFor`。不能据包装注释宣称主行动已用 V Policy。
3. **Browser 和 Simulation 的 V 开关装配不同。**
   Browser bootstrap 给 Heuristic 传估值参数；Simulation 切到 V 包装 factory。
   新 AI 必须共享 factory 与配置，不能仅凭开关同名推断一致。
4. **直接 fork 的 V 路径不适合作为新基座。**
   `v-guided-search.js` 有本机绝对 require、同 family 替代原动作、条件取首项、枚举异常转空集等行为；
   `runVGuidedDecision` 仍调用旧目标筛选。隔离 fork 能力可以复用，这套搜索策略不继承。
5. **异步请求生命周期尚未实现。**
   `policy-port-contract.md` 描述了 runPolicy、deadline、取消和迟到响应语义；当前
   `policy-port.js` 没有这些导出，协调器也直接同步调用决策函数。异步推理需单独实现并验收。
6. **现有实验入口尚未支持任意新 AI。**
   robot_iterate → run_research_validation 仍调用旧机器决策入口，身份主要沿用 Heuristic 版本和配置。
   新 AI 要先扩展算法身份与装配，再使用该入口跑实验，不能换个实验名就认作新算法。

这些是新开发的接口边界，不构成本轮修复旧实现的任务清单。

## 本次验证范围

以下定向回归在上述工作树通过，共 5 个 unit 测试文件：

```sh
node tools/run_node_tests.js --match policy-port --match machine-player-coordinator \
  --match simulation-host-contract --match simulation-state-checkpoint \
  --match simulation-no-browser-globals
```

通过范围为数据协议、协调器行为、环境基本提交、检查点恢复及无浏览器依赖。
本轮未跑完整局、Browser smoke、训练或性能实验，也未验证新算法棋力。

分析端口v30新增`postMainValueBound`、`postMainOptimalPlanSpec`及`expandPostMainOptimalPlan`：
前者只提供默认V的受限上界，后者执行并核对最短达到上界的正式见证。
搜索v29分别报告图节点与内部证据状态，后者同样受全局预算约束；内部证书的完整依赖及失效
沿用`rememberPlan`/`reusePlan`。范围与反例见[证明说明](ai-post-main-attained-bound-20261023.md)。

分析端口v31新增`standardScanValueBound`，按实际扫描队列提供到公共补牌信息边界的默认V上界；
原生ScienceSession导出只读`listPublicScanChoices`供正式Decision及可信分析共用。
`postMainValueBound`可记录已有静止继续路径的证明依赖及保留动作。算法仍拿不到隐藏牌堆、完整状态或Session。
详见[扫描界及组合证明](ai-standard-scan-bound-20261023.md)。
