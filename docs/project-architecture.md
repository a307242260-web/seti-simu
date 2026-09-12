# SETI 项目架构地图

本文记录当前生产装配。浏览器、Node simulation 与训练/评测共享一套规则模块、状态 schema、Action/Effect 协议和 Policy 端口；宿主只拥有各自的输入输出能力。

## 运行形态

| 运行形态 | 入口 | 正式职责 | 不拥有 |
|---|---|---|---|
| 浏览器 | `randomizer/index.html` | DOM、事件、BrowserProjection、ViewState、本地保存与人类/机器席位输入 | 规则状态、合法性、Effect 推进、Policy 估值 |
| Node simulation | `randomizer/app/simulation-env.js` | `reset/observe/legalActions/step/checkpoint/replay/dispose`，无 DOM 投影 | 第二套规则、候选 selector、恢复迁移 |
| 训练/评测 | `randomizer/training/**`、`tools/run_*training*`、`tools/run_rl_evaluation.js` | 模型、采样、训练 checkpoint、评测和报告 | 游戏规则、环境状态提交 |

Simulation 直接装配 `training/simulation-rule-composition.js` 与 `game/rule-composition.js`，复用 `game/**` 的状态、Action 与 Effect domain；它不读取 `index.html`，也不加载 `app.js`、DOM、Browser globals 或恢复 facade。

## 唯一 owner 与依赖方向

```text
Standard Action registry
  enumerate / validate / descriptor
                │
                ▼
Effect Session ───────────► StateStore.compareAndCommit
 working / decision / journal       │
                │                    ▼
                └────────► committed snapshot
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
             Browser Host                        Simulation Host
       projection / human input            observation / policy input
                    │                                   │
                    └──────────────┬────────────────────┘
                                   ▼
                  Machine Player Coordinator
              readBoundary / 复用 / 决策函数 / execute
                 （Browser/Simulation 共用一份实现）
```

- `randomizer/game/actions/standard-action.js` 是 16 个顶层 family 与 7 个 conditional family 的 identity、phase、枚举/校验协议 owner。
- `randomizer/game/effects/session-runtime.js` 是 working copy、DecisionEffect、队列、journal、undo/barrier 和提交门禁 owner。
- `randomizer/game/state/state-store.js` 是 committed schema、版本、RNG/sequence 与 compare-and-commit owner。
- `randomizer/app/browser-host/**` 只消费 committed/session projection，并把人类或机器输入交回标准端口。
- `randomizer/app/simulation-env.js` 只把相同 descriptor 投影成 RL envelope；沿用共享 action identity。
- `randomizer/game/ai/machine-player-coordinator.js` 编排机器人决策（readBoundary、计划复用、决策函数注册表、execute 提交、recordStep 记账钩子）；`policy-port.js` 定义公共 `DecisionContext -> PolicyDecision` 契约，具体 Policy 只选择传入 legal set 中的 `actionId`。

依赖只能由宿主指向公共协议和规则 owner。StateStore 不依赖 Action、Session、DOM 或 Policy；Policy 不依赖 DOM、resolver、executor、StateStore 或 Effect Session；renderer 不执行规则。

## 状态与恢复

规则事实只有两种合法形态：StateStore 的 committed snapshot，以及基于其 `baseVersion` 创建的单个 Effect Session working copy。Browser ViewState、observation、session journal、replay 和训练 checkpoint 都是宿主或派生产物，不得反向覆盖规则事实。

浏览器恢复包与 simulation checkpoint 只接受当前 schema。旧版本、缺版本、未知 root、未知 Action/Decision/Effect family、stale decision 和非法 Policy 输出均在调用提交/恢复端口前 fail-closed，不迁移、不猜测、不取首项。

## Composition root

`randomizer/app.js` 是 Browser composition root：收集依赖、创建 Rule Composition/Browser Host、连接 projection/inputPort/DOM 并启动页面。它不是第二个 StateStore、Action registry、规则 runtime 或 simulation 入口。机器席位由 `app/ai/browser-bootstrap.js` 装配与 Simulation 同一协调器（`machine-player-coordinator.js`）与 Heuristic 决策函数，唯一差异是 recordStep 记账钩子（browser 空操作）。

传统 `window.Seti*` 只作为无构建脚本的模块注册方式。是否使用全局命名空间不改变状态 owner，也不能成为跨局可变事实或隐藏 fallback 的理由。

## 验证入口

- `node --check randomizer/app.js`
- `node tools/run_node_tests.js`
- `node tools/run_browser_smokes.js`
- 固定 seed simulation 完整局、非零 checkpoint/replay fork、Browser/Simulation parity
- 真实 Chrome 人类输入、机器席位标准提交与 Composition checkpoint recovery smoke

更细契约见 `docs/standard-action-contract.md`、`docs/effect-session-runtime.md`、`docs/committed-game-state.md`、`docs/browser-host-ui.md`、`docs/policy-port-contract.md` 与 `docs/rl-simulation-env.md`。

StateStore 的唯一 owner、快照隔离、单次 CAS、恢复拒绝和 Policy fail-closed 由相应行为单元测试与唯一完整流程验证。脚本存在性、装配顺序、旧文件删除和源码禁词不再作为默认 Node 行为回归；浏览器真实装配由固定 Chrome smoke 清单验证。

## 模块导航

- `randomizer/index.html`：浏览器页面入口。
- `randomizer/app/dependencies.js`：app 层全局模块依赖收集与脚本顺序校验。
- `randomizer/app/dom.js`：固定 DOM 元素注册表。
- `randomizer/app/public-api.js`：调试、AI 验证和外部脚本使用的 `window.SetiRandomizer` API 组装。
- `randomizer/app/ai/browser-bootstrap.js`：Browser 机器席位端口——装配与 Simulation 同一协调器（`machine-player-coordinator.js`）与 Heuristic 决策函数（`heuristic-decision-function.js`），唯一差异是 `recordStep` 记账钩子（browser 空操作）；席位判定、决策前稳定化、同 decision 去重、lifecycle 失效重建、失败转显式 fail 结果。创建期校验必需端口。
- `randomizer/game/ai/policy-port.js`：启发式与 Learned Policy 共用的 `DecisionContext -> PolicyDecision` 契约、公共 validator 和请求失效语义；Policy 不在此执行规则。
- `randomizer/game/ai/heuristic-policy.js`：无 DOM/Host 推进依赖的版本化 Heuristic Policy，实现公共端口并为浏览器席位、teacher 与冻结 opponent 提供同一 provenance。
- `randomizer/game/ai/heuristic-evaluator.js`、`expected-score-evaluator.js`：只消费公共 observation、legal descriptors 与标准反事实 outcome，负责纯估值和稳定排序。
- `randomizer/game/ai/machine-player-coordinator.js`：机器人玩家协调器（Browser/Simulation 共用）——席位决策函数注册表、裸调共享 composition 读边界（合法集原生 + 观察直接 createDecisionObservation(projection.state)）、计划复用（`planReuseCheck`）、调用决策函数、execute 提交共享 inputPort、recordStep 记账钩子；失败直接抛错。详见 `docs/ai-design.md` §1。
- `randomizer/game/ai/heuristic-decision-function.js`：Heuristic 决策函数（AI 类型）——统一反事实搜索（目标引导 + 需求引导单一路径，无 bounded 分桶）+ 直调启发式 Policy + 从 winning leaf 构建 plan；实现 `(ctx) => ({ actionId, plan? })` 接口。
- `randomizer/game/ai/plan-continuation.js`：逐步计划复用的纯逻辑——`capturePlanStep`/`compilePlanSteps`采集并编译真实提交前证据，`buildPlanFromSnapshot`/`advancePlan`同步推进动作、具名依赖与揭示基线；同回合与新回合都调用`planReuseCheck`，目标完成后的奖励阶段保留奖励选择依赖。详见`docs/ai-design.md` §3.2。装配在`randomizer/app/simulation-env.js`（`planContinuationFastPath`默认开，`false`可关），诊断/验证工具`tools/diagnose_plan_continuation.js`、`tools/verify_plan_continuation_fastpath.js`。
- `randomizer/training/self-play.js`：Node self-play 训练、action-kind baseline、逐步 JSONL 与 episode checkpoint。
- `randomizer/training/trajectory-recorder.js`：`seti-self-play-log-v1` 轨迹录制器（Browser/Node 共用，人类示范与 self-play 同一格式）。
- `randomizer/app/browser-host/trajectory-recording.js`：Browser 输入链录制适配器（只读 projection、按确认 replay 对齐、终局导出 JSONL）。
- `randomizer/training/worker-protocol.js`、`simulation-worker.js`、`worker-pool.js`：Python/PyTorch 常驻采样协议、隔离 worker、超时/背压/崩溃恢复与批量请求。
- `tools/run_self_play_training.js`：训练、恢复和评测命令行入口。
- `tools/run_rl_worker_server.js`、`tools/rl_worker_client.py`：Node JSONL worker 服务与 Python 标准库客户端；`tools/benchmark_rl_workers.js` 为分项吞吐闸门。
- `randomizer/app.js`：Browser Production composition、projection/ViewState、标准输入、服务与渲染的窄装配根。
- `randomizer/game/effects/residual-domain-session.js`、`randomizer/app/browser-host/decision-ui.js`：公司、卡牌、数据与八种外星人的标准 Decision/Effect owner 和只读 presentation；机会队列、痕迹奖励、followup、history/rollback 归 session，UI 只消费 projection。
- `randomizer/game/production-kernel.js`、`randomizer/game/production-composition.js`：Browser/Simulation 共用的唯一 Production factory、23 family registry（16 顶层 + 7 conditional）、六个 domain（opening/standard/card/science/probe-turn/residual）、Decision 与提交链。
- `randomizer/style.css`：页面布局、交互聚焦、高亮与各区视觉状态。
- `randomizer/solar-system/layout.js`：太阳系盘面坐标、扇区、星云与内容类型定义。
- `randomizer/solar-system/core.js`：太阳系渲染与旋转相关核心逻辑。
- `randomizer/game/players.js`：玩家资源、收入、手牌、保留牌、科技与初始选择状态。
- `randomizer/game/rockets.js`：火箭状态、发射、移动、旋转推动与访问事件。部分地方可能把火箭称为探测器，他们是同一个东西。
- `randomizer/game/planet-stats.js`：星球环绕、登陆、卫星登陆和参考图标记统计。
- `randomizer/game/initial-cards.js`：公司牌和初始牌的初始选择结算。
- `randomizer/game/final-scoring.js`：终局计分板块标记流程。
- `randomizer/game/end-game-scoring.js`：终局板块与 3 型卡实时计分。
- `randomizer/game/abilities/**`：可复用能力函数与能力链，包括发射、移动、扫描、科技、环绕、登陆、分析等。
- `randomizer/game/actions/**`：主行动和快速行动的效果构建、奖励表与交易逻辑。
- `randomizer/game/history/**`：主行动/快速行动事务历史、撤销命令和不可撤销屏障。
- `randomizer/game/cards/**`：卡牌牌库、效果模型、任务状态和卡牌触发结算。
- `randomizer/game/data/**`：数据池、计算机放置、星云数据 token 与扇区结算规则。
- `randomizer/game/tech/**`：科技供应区、玩家科技板、bonus 与放置规则。
- `randomizer/game/industry/**`：公司牌目录、1x 主动能力、被动钩子与标记槽规则。
- `randomizer/game/aliens/**`：外星人通用状态、揭示、痕迹与物种专属机制。DOM 渲染统一位于 `randomizer/app/browser-host/**`。
