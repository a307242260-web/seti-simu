# Browser App 架构契约

本文是 `randomizer/index.html`、`randomizer/app/**` 与 `randomizer/app.js` 的当前权威契约。
公共规则、状态、Action、Decision 与 Effect 以 `randomizer/game/**` 为唯一 owner；Browser
只是宿主，不拥有第二套规则。

全局依赖方向、StateStore 与 Machine Player Host 关系见
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

- `randomizer/game/production-composition.js` 与 `production-kernel.js` 安装 22 个 Standard
  Action family、Effect domain、Decision owner 和唯一提交链。
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
- renderer、query 或 Browser service 失败不反向污染规则状态。

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
- 新局、保存和恢复只调用 Composition lifecycle；
- Browser 不根据 label、selector 或旧 pending 猜测 legal choice；
- stale、wrong-owner、removed-choice、unknown family 必须零副作用失败。

不得创建按字符串方法名转发旧 runtime target 的所谓 `StandardInputRegistry`。只有最终调用
正式 `dispatchAction` / `submitDecision` 的端口才是规则输入。

### Browser services

Browser service 可以操作：

- `localStorage` 中的隔离 envelope（service 只把它视为可克隆 payload）；
- 下载、Blob/URL 生命周期；
- timer、resize、focus、overlay 等 UI 能力；
- status/debug ViewState；
- Machine Player Host 的席位配置与调度状态。

Browser service 不接收 projection root 或规则 input port，不执行收入、回合、扫描、卡牌、
科技、公司、外星人、undo/recovery 等规则 mutation，也不接 Composition lifecycle、
StateStore 或 Effect Session。`game-recovery.js` 的显式 checkpoint adapter 才能把正式
Composition lifecycle envelope 与独立 ViewState 组合/恢复。

## 3. 文件职责

| 位置 | 职责 |
|---|---|
| `randomizer/index.html` | 传统脚本加载顺序与页面 DOM |
| `randomizer/app/dependencies.js` | Browser 全局依赖收集和缺项校验 |
| `randomizer/app.js` | composition root 与端口装配 |
| `randomizer/app/browser-rule-composition.js` | Browser projection/state adapter |
| `randomizer/app/browser-host/input-adapter.js` | 人类 Standard Action/Decision 输入 |
| `randomizer/app/browser-host/policy-input-adapter.js` | PolicyDecision 到相同输入端口 |
| `randomizer/app/browser-host/projection-adapter.js` | viewer visibility policy |
| `randomizer/app/browser-host/resident-projection.js` | 窄 resident DTO |
| `randomizer/app/browser-host/resident-renderer.js` | projection 到 DOM 的渲染隔离 |
| `randomizer/app/browser-host/browser-services.js` | storage/download/timer/focus 独立宿主能力 |
| `randomizer/app/start-screen.js` | 开始页与初始选择 presentation |
| `randomizer/app/events.js` | DOM 事件到显式 input callback 的路由 |
| `randomizer/app/render-runtime.js` | DOM renderer 与纯 ViewState |
| `randomizer/app/game-recovery.js` | Composition lifecycle + ViewState checkpoint 适配 |
| `randomizer/app/ai/control-runtime.js` | 不写 player slice 的机器席位/难度配置、generation 与调度状态 |
| `randomizer/app/ai/browser-bootstrap.js` | Machine Player Host 与 Policy input 装配 |
| `randomizer/app/public-api.js` | 冻结的 inspect/capture/restore/input facade |

领域 UI 文件如 `card-runtime.js`、`scan-flow.js`、`tech-runtime.js`、`industry-runtime.js`、
`alien-ui.js` 和 `aliens/species-runtime.js` 最终只保留 presentation、ViewState 与正式输入
映射。若其中仍存在直接规则写入、continuation、history mutation、executor 或 working-root
参数，它们属于待删除的旧架构，不构成可继续扩展的正式边界。

## 4. 禁止恢复的模式

- Browser `OwnerInput`、通用 target registry 或任意方法名 dispatch；
- `createReadoutRoot`、传统 slice root、canonical root clone 作为 renderer context；
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

测试用于验证已经推导出的架构，不用于逐次发现下一个待迁移 handler。跨域任务必须按一个
Production domain 的完整纵向链交付，旧路径物理删除后再开启下一域。
