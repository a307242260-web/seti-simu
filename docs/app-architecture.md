# Browser App 架构契约

本文是 `randomizer/index.html`、`randomizer/app/**` 与 `randomizer/app.js` 的当前权威契约。
公共规则、状态、Action、Decision 与 Effect 以 `randomizer/game/**` 为唯一 owner；Browser
只是宿主，不拥有第二套规则。

全局依赖方向、StateStore 与 Machine Player Coordinator 关系见
[`project-architecture.md`](./project-architecture.md)。页面投影和输入细节见
[`browser-host-ui.md`](./browser-host-ui.md)。

## 1. 唯一依赖方向

```text
DOM / Browser ViewState
        │
        ├── read ──> viewer-safe BrowserProjection / narrow DTO
        │
        └── input ─> Standard Action / Decision / Composition lifecycle
                                      │
                                      ▼
                            Production Composition
                                      │
                     Effect Session -> StateStore commit
```

- `randomizer/game/production-composition.js` 与 `production-kernel.js` 安装 23 个 Standard
  Action family（16 顶层 + 7 conditional，含 `complete_task`）、Effect domain、Decision owner
  和唯一提交链。
- Browser 与 Simulation 共用 Production rules、Action identity、Decision 和 commit 语义，
  但各自拥有不同的 projection、ViewState、存储与宿主服务。
- Browser 不得取得 canonical committed root、working root、StateStore CAS、规则 executor
  或可提交任意方法名的通用 command registry。

## 2. Browser 只允许四类职责

### Composition

`randomizer/app.js` 负责收集传统脚本依赖、创建 Production Composition、Browser Host、
领域 renderer/controller，并连接启动生命周期。它可以装配端口，但不能实现领域规则。

`randomizer/app/browser-rule-composition.js` 只负责 Browser 专属 state/projection adapter：

- visibility policy 在规则 root 离开边界前完成；
- caller 只得到带 viewer identity 的深冻结投影或窄 DTO；
- 不公开 `stateSourcePort`、working root、committed root 或任意 root mutation callback；
- lifecycle `newGame` 由 state adapter 一次性组合正式 game primitive，轮序、棋盘、牌区、
  RNG 与实体 sequence 随 canonical state 提交；Browser 不再做第二次初始化 mutation；
- renderer、query 或 Browser service 失败不反向污染规则状态。

**投影信息层与 UI 壳分离（host-unify）**：`projectBrowserState` 输出的 `projection.state`
同时包含：

- **规则观察信息层**（与 Simulation `buildRuleObservation` 完全同源，见
  `docs/browser-simulation-unification.md` §信息层统一）：顶层 `publicState.players/board`、
  `selfState.hand`、requirements —— 机器协调器 / AI 评估 / 训练从这里读盘面；
- **UI 展示视图**：`match`、`resident`（信息字段 + `resident.ui` 读模型壳）、
  `feedback` —— 人类 UI 从这里渲染。

**投影约束**：`resident` 的信息字段（players/board/cards/tech/aliens/
solar/planets/data/finalScoring）必须保留，读模型壳只作为 `resident.ui` 附加，不覆盖规则信息字段。

### Presentation

renderer、picker、Action Bar、玩家面板、卡牌/科技/扫描/外星人界面只消费当前 viewer 的
投影和独立 ViewState。

Presentation helper 必须满足：

- 输入是 projection/DTO 的隔离副本；
- 不补规则默认值、不推进 Effect、不排队机会、不调度 AI；
- 不通过“冻结后写不进去”证明安全，而是在签名上没有规则写端口；
- 隐藏牌序、对手手牌、未来 RNG、executor、checkpoint 和 canonical metadata 不进入 DTO。

### Input

人类与机器席位共用同一条输入链：

- 普通行动提交完整 Standard Action descriptor；
- 多步选择提交 active Decision 的 owner、version 与 choice identity；
- 人类 Decision 统一经 `createHumanDecisionInputAdapter` 重读当前 viewer-safe projection，
  精确校验 `decisionId/decisionVersion/ownerId/choiceId` 后，才把 identity 对齐到 active
  Effect Session 的正式 choice；DOM 与 public facade 不读取完整 legal choice；
- 新局、保存和恢复只调用 Composition lifecycle；
- Browser 不根据 label、selector 或旧 pending 猜测 legal choice；
- stale、wrong-owner、removed-choice、unknown family 必须零副作用失败。

规则输入端口最终调用正式 `dispatchAction` / `submitDecision`，不按任意字符串转发方法。

### Browser 能力与恢复

Browser composition root 可以使用 timer、focus、overlay 等纯宿主能力，但这些能力不形成通用
service registry，也不能取得规则写端口。当前保存恢复只有一个显式组合点：

- `game-recovery.js` 只组合 Composition lifecycle envelope 与独立 ViewState；
- 机器席位协调器（`machine-player-coordinator.js`）与决策函数的装配状态只归 `browser-bootstrap.js`；
- timer、focus、overlay 与 status 只影响 ViewState 或调度，不执行规则。

这些 Browser 能力不接收 projection root 或规则 input port，不执行收入、回合、扫描、卡牌、
科技、公司、外星人、undo/recovery 等规则 mutation，也不接 Composition lifecycle、
StateStore 或 Effect Session。`game-recovery.js` 的显式 checkpoint adapter 才能把正式
Composition lifecycle envelope 与独立 ViewState 组合/恢复。

## 3. 文件职责

| 位置 | 职责 |
|---|---|
| `randomizer/index.html` | 传统脚本加载顺序与页面 DOM |
| `randomizer/app/dependencies.js` | Browser 全局依赖收集和缺项校验 |
| `randomizer/app.js` | composition root 与端口装配 |
| `randomizer/app/browser-rule-composition.js` | Browser Production factory 的窄 Host facade |
| `randomizer/app/browser-host/input-adapter.js` | 人类 Standard Action/Decision 输入 |
| `randomizer/app/browser-host/projection-adapter.js` | viewer visibility policy |
| `randomizer/app/browser-host/resident-renderer.js` | projection 到 DOM 的渲染隔离 |
| `randomizer/app/game-recovery.js` | Composition lifecycle + ViewState checkpoint 适配 |
| `randomizer/app/ai/browser-bootstrap.js` | 机器席位端口：协调器 + Heuristic 决策函数装配 |
| `randomizer/app/public-api.js` | 冻结的 inspect/capture/restore/input facade |

领域展示消费 viewer-safe projection，交互提交 Standard Action/Decision。

## 4. 宿主边界

Browser 不允许以下行为：

- Browser 通用 target registry 或任意方法名 dispatch；
- canonical root clone 作为 renderer context；
- Browser 专有 Action provider、executor、Decision resolver 或 deterministic drain；
- render-time 补状态、结算奖励、恢复 pending、续跑 Effect 或调度 Policy；
- Simulation adapter、no-op DOM、headless shim 或训练专用规则进入 Browser；
- public API 暴露规则 helper、mutable state、候选 selector 或调试 mutation；
- 以入口行数、文件迁出、禁词搜索或改名代替 owner/行为证明。

## 5. 变更验收

修改 Browser 架构时，先写清有限 owner 集合、旧入口删除清单和可失败义务。实现完成后按顺序
验证：

1. 相关窄 unit：projection 隐私、input identity、service 隔离、renderer 失败隔离。
2. `node --check randomizer/app.js`。
3. `node tools/run_node_tests.js`。
4. 真实 `index.html` 的必要 Chrome smoke。
5. 涉及跨宿主规则时，补 Browser/Simulation 同 descriptor、Decision、journal 与 committed
   checkpoint parity。

大型迁移按范围清单核对完整输入、执行、恢复链。调查与测试中发现的新事实可用于修订设计；
完成声明须与实际覆盖范围一致。
