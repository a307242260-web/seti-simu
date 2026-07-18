# SETI 项目架构地图

本文是 SETI 全局架构的长期讨论载体。它以仓库当前实现为证据，区分“当前事实”“阶段决策”“目标候选”和“未决问题”；具体 app、AI 与 headless 契约分别以 [app-architecture.md](./app-architecture.md)、[ai-design.md](./ai-design.md) 和 [rl-headless-env.md](./rl-headless-env.md) 为准。

## 第 1 轮：运行形态与顶层系统

### 1. 当前事实

SETI 当前有三种运行形态，但只有一套实际游戏运行时。

| 运行形态 | 主要目标 | 入口 | 宿主与交互 | 自己拥有的状态/产物 |
|---|---|---|---|---|
| 浏览器交互原型 | 人类游玩、电脑对手、规则调试、视觉与浏览器 smoke | `randomizer/index.html` | DOM、事件、overlay、真实 render、`localStorage` | UI 状态、本地恢复包、行动日志展示 |
| Node headless 模拟 | 确定性对局、合法动作接口、回放、并行采样的统一环境 | `randomizer/app/headless-env.js#createHeadlessEnv` | Node；从 `index.html` 读取同一脚本清单，以 no-op view 启动 `app.js` | observation、legal action、reward、replay、环境 checkpoint、诊断 |
| 训练与评测 | 策略更新、批量采样、固定种子评估、吞吐基准和训练报告 | `tools/run_self_play_training.js`、`tools/run_pytorch_training.py`、`tools/run_rl_evaluation.js` 等 | Node CLI、worker_threads、Python/PyTorch 客户端 | 模型/agent 参数、训练随机状态、episode checkpoint、JSONL、评测与 HTML 报告 |

这里的“同一套实际游戏运行时”不是理想化描述，而是当前装配事实：headless 会解析 `index.html` 的 `<script>` 列表，在 Node 中加载相同的 `game/**`、`app/**` 和最终 `app.js`；`SetiHeadlessRuntimeConfig` 让 composition root 跳过 DOM、事件和浏览器持久化，并通过 `view-adapter.js` 注入 no-op 展示接口。

因此：

- headless 是共享运行时之上的宿主适配与 RL 契约层，不是第二套 simulator 或规则实现。
- 训练/评测是 headless 契约的消费者，不应直接拥有或修补游戏规则。
- AI 是决策子系统，不是第四种运行形态。浏览器电脑玩家使用它驱动对局；headless 的训练 agent 通常直接在合法动作上决策，只有 offline teacher 等场景才调用现有 AI 策略。

### 2. 当前系统上下文图

```text
人类玩家 / 调试者                         训练器 / 评测器 / Python 客户端
        │                                           │
        ▼                                           ▼
浏览器宿主适配                                训练与评测基础设施
DOM / events / render / localStorage          self-play / worker / checkpoint / report
        │                                           │
        │                                           ▼
        │                                   Headless 环境契约
        │                              reset / observe / legalActions / step
        │                                           │
        └──────────────────┬────────────────────────┘
                           ▼
                  App 运行时与流程编排
           app.js composition root + app/** flows/runtime
            权威单局状态 / pending / continuation / refresh
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
       游戏规则与棋盘域                AI 决策系统
 game/** + solar-system/**       game/ai/** + app/ai/**
 规则、合法性、结算、领域状态       候选估值、策略、自动调度、执行适配
```

图中的箭头表示“调用/装配依赖”，不表示所有源码已经达到理想分层。尤其是 `randomizer/app.js` 目前既是浏览器 composition root，也是 headless 实际复用的共享单局 runtime；`game/**` 提供规则语义和领域操作，但尚不是能被独立实例化的完整模拟器。

### 3. 顶层系统职责与边界

#### 浏览器宿主适配

- 负责页面结构、输入事件、overlay/picker、渲染、浏览器生命周期和本地恢复体验。
- 通过 app flow 发出意图并展示结果，不应成为规则合法性或结算的唯一实现位置。
- `index.html` 当前兼任浏览器入口和全项目脚本装配清单；headless 也依赖这个清单，这是事实上的共享 manifest。

#### App 运行时与流程编排

- `app.js` 创建并持有一局游戏的权威运行态，装配 `app/**`、`game/**`、AI 和公开 API。
- 负责跨域流程、pending owner、continuation、效果推进、统一刷新与宿主能力开关。
- `app/**` 不能整体等同于“UI 层”：其中既有浏览器交互模块，也有 headless contract、流程 runtime、恢复和 AI 控制适配。
- 当前最重要的架构接缝不是 `app/**` 对 `game/**` 的目录线，而是“宿主相关能力”与“可无界面复用的单局运行时”之间的能力注入线。

#### 游戏规则与棋盘域

- `game/**` 负责玩家、行动、能力、卡牌、科技、公司、外星人、历史和计分等规则语义；`solar-system/**` 提供棋盘布局与太阳系状态/渲染能力。
- 规则域是浏览器与 headless 必须共享的唯一事实来源。
- 当前规则模块仍通过传统全局脚本注册并由 `app.js` 组合，不能把“规则文件已拆出”误判为“已有独立 domain kernel”。

#### AI 决策系统

- `game/ai/**` 负责只读候选、价值、目标、路线和策略判断；`app/ai/**` 负责控制状态、pending resolver、自动调度和行动执行适配。
- AI 消费状态投影和合法候选并产生决策，不拥有权威游戏状态，也不定义 headless observation 契约。
- 浏览器自动对战、AI 调参和 offline teacher 可以复用该系统；RL agent 可以绕过启发式策略，直接消费 headless action space。

#### Headless 环境契约

- 将共享 app runtime 投影成稳定的 `reset / observe / legalActions / step / checkpoint / replay` 接口。
- 负责固定 seed、公私 observation、动作版本校验、确定性 effect drain、reward/replay 和无 DOM 宿主隔离。
- 不重新实现规则，不把浏览器点击或 DOM selector 暴露给训练器；遇到未迁移 pending 应显式失败，而不是回退浏览器 AI resolver 掩盖缺口。

#### 训练与评测基础设施

- Node self-play、worker pool、Python 客户端和 PyTorch trainer 都只依赖 headless 协议与训练数据 schema。
- 负责采样并发、策略/模型更新、训练 checkpoint、恢复、评测种子池、指标和报告。
- 训练 checkpoint 与环境 checkpoint 是不同所有权：前者保存学习进度和 episode 游标，后者保存可恢复/回放的单局环境边界。

### 4. 两条核心数据流

浏览器交互流：

```text
用户/AI 意图 → events 或 AI controller → app flow/pending
→ game 规则与状态变更 → app continuation/refresh
→ DOM render + 行动日志 + 按需持久化
```

训练采样流：

```text
trainer/policy → legalActions + observation → 选择 action
→ headless step → 共享 app flow + game 规则 → 自动推进确定性 effect
→ 新 observation + reward + replay event → agent 更新/评测/产物
```

两条流必须在“同一状态下的合法性与结算结果”上保持一致，但展示状态、训练状态和持久化产物不要求相同。

### 5. 当前问题

1. `app.js` 同时承担浏览器 composition root 和共享 runtime，目录名与真实职责不完全一致，容易把 headless 依赖误读为“训练依赖 UI”。
2. headless 通过解析 `index.html` 获得模块清单，保证了浏览器/Node 装配一致，但也让 Node 环境依赖浏览器入口格式和全局加载顺序。
3. `game/**` 是规则语义来源，却还不是完整、可实例化、与宿主无关的状态机；权威状态和 pending/continuation 仍大量集中于 app runtime。
4. AI 同时存在只读规则域和有副作用的 app 执行/调度域；若只按 `ai` 目录名讨论，很容易混淆 policy、controller 与游戏执行权。
5. 浏览器存档、headless replay/checkpoint、训练 checkpoint 分属不同系统，后续必须先定义状态所有权，再讨论统一或转换关系。

### 6. 备选方向

| 方向 | 含义 | 收益 | 代价/风险 | 首轮判断 |
|---|---|---|---|---|
| A. 正式承认 `app.js` 为共享 runtime | 保持当前单内核装配，只继续用能力注入隔离浏览器/headless | 迁移小，现有一致性最好 | composition root 继续偏大，宿主边界靠纪律维持 | 当前过渡方案 |
| B. 提取可实例化 runtime core | 浏览器与 headless 成为同级 adapter，共同装配独立 session/runtime | 状态所有权、并发实例和测试边界最清晰 | 跨状态机迁移风险高，需先完成状态/流程证据 | 目标架构候选，尚未拍板 |
| C. 另写专用 simulator | 训练侧维护独立快速规则实现 | 理论吞吐上限高 | 双规则源、回放漂移和长期同步成本极高 | 默认不采用，除非未来有量化瓶颈证据 |

### 7. 首轮阶段决策

在后续讨论中先采用以下共同语言：

1. 项目有浏览器、Node headless、训练/评测三种运行形态；三者不是三套规则实现。
2. 顶层系统分为浏览器宿主、app 运行时、游戏规则域、AI 决策系统、headless 契约、训练/评测基础设施。
3. AI 是可替换决策提供者；headless 是环境适配器；训练器是环境消费者。三者不得拥有游戏规则真相。
4. 当前共享内核的实际边界在 `app.js + app/** + game/**` 的组合，而不是简单把 `game/**` 称为完整内核。
5. 近期继续以单规则源和浏览器/headless 行为一致为硬约束；不在本轮启动 runtime core 提取。
6. 下一轮先画清系统上下文的接口和依赖方向，再下钻启动、建局、回合、pending、结算、渲染与恢复主链路。

### 8. 未决问题

1. headless 是否被视为长期一等运行形态，还是仅作为 RL/测试工具？这个选择会影响其兼容性承诺和版本策略。
2. `index.html` 是否继续作为浏览器与 Node 的共享模块 manifest，还是未来需要独立、可校验的 composition manifest？
3. 目标架构是否接受 B（可实例化 runtime core）作为长期方向？在状态所有权和主链路梳理完成前不启动迁移。
4. 浏览器 AI 自动对战属于产品能力、测试工具还是两者兼有？不同定位会影响 app AI runtime 的稳定 API 范围。

## 证据索引

- 浏览器脚本与 composition：`randomizer/index.html`、`randomizer/app.js`、`randomizer/app/dependencies.js`
- 宿主能力隔离：`randomizer/app/view-adapter.js`、`randomizer/app/bootstrap.js`
- Headless 装配与契约：`randomizer/app/headless-env.js`、`randomizer/app/headless-contract.js`
- AI 边界：`randomizer/app/ai-controller.js`、`randomizer/app/ai/**`、`randomizer/game/ai/**`
- 训练/评测：`randomizer/training/**`、`tools/run_self_play_training.js`、`tools/run_rl_worker_server.js`、`tools/run_pytorch_training.py`、`tools/run_rl_evaluation.js`
