# Browser Host UI 契约与迁移总图

## 目标、边界与当前完成度

Browser Host 是浏览器玩家端的宿主边界。它只把权威状态或活跃 Effect Session 投影成可见、只读的 `BrowserProjection`，把 DOM 输入转换成 Standard Action、Standard Decision 或纯 UI intent，并保存可丢弃、可重建的 `ViewState`。

本阶段只冻结契约、所有权矩阵、proof obligations、迁移顺序和冲突边界，不宣称旧 UI 热路径已经迁移。当前 `randomizer/app.js`、`app/*-runtime.js`、`effect-choice-flow.js`、`events.js` 与 AI pending resolver 仍直接读取 `pendingState`、计算选项、确认后续跑规则或组织 continuation；后续必须按领域逐批替换，不能用本文档或静态类型名冒充行为完成证据。

Browser Host 的上游边界是：

- `CommittedGameState / StateStore`：唯一已提交游戏事实，由 SETI-71 负责。
- `Effect Session`：唯一 working state、队列、DecisionEffect、journal 与 commit/abort 生命周期，由 SETI-62 负责。
- `Standard Action`：action family、actor、target、payload、合法性和业务执行语义，由 SETI-56 负责。

Browser Host 不重定义这三份协议。浏览器与 headless/training 共享同一状态、Action 和 Effect Session，只分别实现 projection 与 input/policy adapter。

```text
StateStore snapshot ───────────────┐
                                  ├─> BrowserProjectionAdapter ─> BrowserProjection
EffectSession.inspect/observe ────┘                                  + ViewState
                                                                          │
DOM event ─> UI Intent ─> BrowserInputAdapter ─> Action / Decision ───────┘
```

## 冻结数据契约

公开 envelope 使用 `schemaVersion=seti-browser-host-v1`。所有跨边界对象必须是可序列化普通数据；不得携带 DOM、函数、模块引用、可变领域对象或宿主 callback。

### BrowserProjection

```js
{
  schemaVersion,
  projectionId,       // source kind/version + viewer + visibility policy 的稳定摘要
  source: {
    kind,              // committed | session
    stateVersion,
    sessionId,
    sessionRevision,
    phase
  },
  viewer: { viewerId, playerId, role },
  match,               // round/turn/active/terminal 等可见对局信息
  board,               // 太阳系、棋子、星球、数据与终局板的可见投影
  players,             // 自己完整可见资产 + 对手公开统计/隐藏占位
  cards,               // 手牌/保留/公共牌/弃牌的可见投影，不含牌库顺序
  tech,
  aliens,
  controls: {
    actions,           // 共享规则枚举的 Action 摘要与 disabledReason
    quickActions,
    canUndo,
    canEndTurn
  },
  decision,            // null 或由 SessionInspect 映射的标准 DecisionProjection
  feedback: { events, logs, progress, notices }
}
```

规则：

1. committed 模式只从 `StateStore.getSnapshot()` 派生；session 模式只从 `EffectSession.inspect/observe` 的同一 working state 派生。
2. projection adapter 不执行 Action、Effect、trigger 或 continuation，不修改输入，不补写 pending。
3. `controls.actions`、`decision.choices` 和禁用原因由 Standard Action / SessionInspect 提供；UI 不根据按钮、资源文案或 DOM 状态二次判定合法性。
4. 输出必须深冻结或按调用隔离；renderer 获得的投影无法反向修改规则状态。
5. `projectionId` 只用于 UI 去重和 stale 诊断，不代替 `stateVersion/decisionVersion` 的规则校验。

### 可见性与隐藏信息

投影采用默认拒绝的 viewer policy。未被明确允许的字段不输出，不能先生成全量对象再靠 CSS 隐藏。

| 信息 | 当前玩家 | 对手/旁观者 | 禁止输出 |
|---|---|---|---|
| 自己手牌/保留牌 | 可见实例与规则所需公开字段 | 数量与公开摘要 | 对手牌 identity、未来牌序 |
| 牌库/随机结果 | 已揭示结果 | 已公开结果 | deck order、未消费 RNG、未揭示抽取结果 |
| 公开盘面/资源 | 按规则可见 | 按规则可见 | 仅 debug 才存在的内部引用 |
| 活跃 Decision | owner 可见 choices | 仅公开 owner/等待状态，除非规则允许 | 私密 choice payload、其他玩家不可见支付组合 |
| journal/log | viewer 可见事件 | viewer 可见事件 | hidden RNG payload、未公开触发器内部数据 |

同一规则状态对不同 viewer 可以得到不同 projection；投影差异不得改变提交同一合法 Action/Decision 后的规则事实。

### DecisionProjection

```js
{
  decisionId,
  decisionVersion,
  ownerId,
  kind,                // choose_card / choose_target / choose_payment / ...
  titleKey,
  promptKey,
  choices: [{ choiceId, label, presentation, disabledReason }],
  minChoices,
  maxChoices,
  optional,
  allowQuickActions,
  presentationHint    // 只选择 renderer，不参与合法性或执行
}
```

领域 renderer 只能把标准 choice 呈现为卡牌、科技 tile、棋盘目标、资源支付或外星人面板位置。它不能新增/删除合法项、默认代选、组织奖励队列或决定提交后的下一步。

### ViewState

```js
{
  overlay: { activeId, minimizedIds },
  hover: { entityRef, anchorRef },
  focus: { entityRef, controlId },
  tabs: { report, playerPanel, alienPanel },
  scroll: { regionId: offset },
  layout: { viewport, panelSizes, collapsedRegions },
  draft: { intentKind, selectedChoiceIds, text },
  animation: { acknowledgedEventIds }
}
```

允许保存的内容必须同时满足：不影响规则结论、可从相同 projection 重新建立、清空后不改变 action/decision 合法集合。禁止保存资源、牌、棋子位置、pending、奖励队列、continuation、RNG、规则 owner、已执行 choice 或任何恢复后不能重建的游戏事实。

`draft.selectedChoiceIds` 只是尚未提交的输入草稿；每次 projection/decision version 变化必须重新与 choices 相交，旧 decision 的草稿不得被自动提交。

### UI Intent 与 BrowserInputAdapter

UI intent 分三类：

| 类别 | 示例 | 唯一去向 |
|---|---|---|
| `action` | 点击主行动、PASS、快速交易、拖拽后确认移动 | `dispatchAction(StandardAction)` |
| `decision` | 选科技、选蓝槽、选扫描目标、确认支付、跳过可选效果 | `submitDecision({ decisionId, decisionVersion, choice })` |
| `view` | 开关面板、hover、tab、滚动、调整布局、编辑未提交草稿 | `ViewStateStore.dispatch(intent)` |

BrowserInputAdapter 的目标接口：

```js
{
  dispatchAction(action),
  submitDecision(submission),
  dispatchViewIntent(intent),
  inspectInputState()
}
```

DOM handler 只解析稳定 `data-*` identity、指针/键盘信息和当前 projection identity，再提交 intent。禁止直接写领域切片、`pendingState`、history、effect queue，禁止调用 `confirm*` 后在 UI 层续跑 continuation。过期 action/decision 必须由共享规则层拒绝，adapter 只刷新 projection 并展示结构化错误。

## 渲染与事件边界

### Renderer 输入

正式 renderer 只接受 `{ projection, viewState, dispatchIntent }`。允许读取静态资产和布局常量；不得抓取 `app.js` 闭包、规则模块可变引用、`pendingState` 或 AI controller。

统一 Decision UI 使用 registry：

```text
decision.kind / presentationHint
  -> generic shell
  -> cards | tech | board-target | payment | alien-panel renderer
  -> action/decision/view intent
```

generic shell 统一 owner、标题、确认/取消、禁用原因、stale 状态、键盘焦点与可访问性；领域 renderer 只负责视觉映射。`optional=false` 时关闭 overlay 不能绕过 DecisionEffect；取消/跳过必须是共享协议明确提供的 choice。

### Browser services

`localStorage`、存档下载、行动日志下载、debug、failsafe、公开 API、Chrome smoke hook 属于浏览器宿主服务，与正式玩家输入分端口：

- persistence 只保存 StateStore serialize 结果、明确的 session 恢复协议和可选 ViewState；不从 DOM 反推规则状态。
- download 只消费稳定快照或格式化结果，不读隐藏牌序。
- debug/failsafe 提交显式 debug command/Standard Action，或调用隔离的开发端口；不得伪装成玩家 UI handler。
- public API 暴露 host facade，不泄漏 mutable domain references。
- headless 不加载这些 service，不创建伪 DOM，也不靠 no-op callback 掩盖规则依赖。

## 当前所有权与迁移矩阵

状态含义：`host-ready` 可保留在宿主；`mixed` 同时含展示与规则推进；`legacy-rule-owner` 当前仍拥有 pending/合法项/continuation；`target` 是迁移后的唯一归属。

| 范围 | 当前入口/所有者 | 当前状态 | 目标归属 | 删除或切换条件 |
|---|---|---|---|---|
| 固定 DOM 收集 | `app/dom.js` | host-ready | Browser Host DOM registry | 不读取规则状态 |
| 事件绑定 | `app/events.js` 的大量领域 callback | mixed | EventBindings -> UI intent | handler 对领域 continuation 调用为 0 |
| 常驻渲染 | `app/render-runtime.js`、`app.js#renderAll` | mixed | projection renderers | 已迁移 renderer 只收 projection + ViewState |
| Action bar/PASS/quick/undo | `app.js`、`action-runtime`、`events.js` | mixed | controls projection + input adapter | 可用/禁用来自 Standard Action/SessionInspect |
| 通用 effect choice | `effect-choice-flow.js`、`effects/rewards.js` | legacy-rule-owner | DecisionEffect + renderer registry | UI 不枚举 choices、不续跑 queue |
| 科技 | `tech-runtime.js` | legacy-rule-owner | research Effect Session + tech renderer | rotate->choice->blue slot->reward trace 无 UI continuation |
| 扫描/数据/登陆 | `scan-flow.js`、`action-interaction-runtime.js` | legacy-rule-owner | Effect Session + board/payment renderer | target/reward/draw decisions 全由 inspect 驱动 |
| 卡牌/任务/触发 | `card-runtime.js`、`card-trigger-runtime.js`、`hand-flow.js` | legacy-rule-owner | Effect Session + card renderer | payment/trigger/task queue 不在 UI 持有 |
| 公司 | `industry-runtime.js` | legacy-rule-owner | Standard Action/Decision + renderer | 1x/picker/history/rollback 不由 UI 组织 |
| 外星人 | `alien-ui.js`、`alien-runtime.js`、`aliens/species-runtime.js` | legacy-rule-owner | DecisionEffect + alien renderers | 机会队列/followup/痕迹规则不在 UI |
| AI pending resolver | `app/ai/initial-card-pending.js`、`interaction-pending.js`、`automation-runtime.js` | 第二套 resolver | Policy -> 同一 Action/Decision adapter | 多选 resolver 调用为 0；未知项 fail-closed |
| headless no-op view | `app/view-adapter.js` | 兼容层 | 无 DOM shared runtime | 规则执行不需要 render/no-op callback |
| 恢复/本地继续 | `game-recovery.js`、`start-screen.js` | mixed | Browser persistence service | 状态/session/view 分 schema 保存和恢复 |
| 下载/debug/failsafe/API | `app.js`、`debug-runtime.js`、`public-api.js` | mixed | 独立 BrowserServices | 正式玩家 renderer/input 不调用 debug 规则旁路 |

旧路径统计不能单独证明迁移完成。尤其 `pendingState` 在 `app.js` 和多个 runtime 中仍被大量读取；字段数减少、函数改名或 overlay 外观不变都不是所有权迁移证据。

## 正式 UI 覆盖矩阵

| UI 范围 | Projection 必含 | 输入协议 | 代表 proof case |
|---|---|---|---|
| 开始/继续/建局 | setup options、可恢复摘要、validation | view intent + setup Action/Decision | 同存档恢复后 projection/action 集合一致 |
| 三栏桌面 | round/turn、终局板、外星人、太阳系、科技、公共牌、对手公开统计 | view intent；可点对象转 action/decision | 销毁 DOM 后由同 projection 重建一致 |
| 玩家操作区 | 主/快动作、PASS、结束、撤销、效果进度、禁用原因 | Standard Action/Decision | stale 按钮被共享层拒绝，UI 不补救规则 |
| 玩家资产 | 玩家版图、手牌、保留牌、科技/数据/marker | card/board decision + view intent | 对手 viewer 不泄漏手牌 identity |
| Decision UI | owner、kind、choices、min/max、optional、revision | Standard Decision | research、scan、play-card、alien 多选均停在 awaiting_input |
| 反馈层 | 可见 events/logs/notices/AI briefing/终局 | view intent | hidden journal payload 不进入对手 projection |
| Browser tools | recovery/download/debug/failsafe/public API | 独立 service command | headless import/完整局不创建 DOM 或 service |

## Proof obligations

| ID | 可证伪命题 | 最小反例 | 唯一责任点 | 必需证据 |
|---|---|---|---|---|
| UI-01 单一投影源 | 已迁移 renderer 的全部规则事实来自一个 projection | renderer 直接读 `pendingState` 或 mutable player | projection adapter + renderer signature | 结构扫描、poison mutable source、固定 projection snapshot |
| UI-02 输入单向 | 任意正式 DOM handler 只产生 Action/Decision/view intent | click 直接扣资源或调用 continuation | EventBindings/InputAdapter | handler spy：领域 mutation/continuation 调用为 0 |
| UI-03 legal 单一所有者 | UI 展示的 action/choice 与共享枚举逐项一致 | UI 隐藏合法项或新增非法项 | Standard Action/SessionInspect mapping | 同版本集合等价 + 每项 fork 执行 |
| UI-04 stale 拒绝 | projection/decision 更新后旧提交不改变状态 | quick action 后旧蓝槽按钮仍生效 | shared validate/resolveDecision | stale action/decision 负向测试 + 完整状态 parity |
| UI-05 ViewState 可丢弃 | 清空 ViewState 与 DOM 后规则状态、decision 和合法集合不变 | overlay flag 决定是否继续奖励 | ViewStateStore/renderer | rebuild metamorphic test + continuation spy=0 |
| UI-06 隐藏信息 | 任意 viewer projection 只含 policy 白名单 | 对手 projection 含手牌 id/deck order/RNG | projection visibility policy | 多 viewer snapshot + forbidden-key/value canary |
| UI-07 Decision 通用 | 每个 decision kind 均经 registry，领域 renderer 不决定流程 | scan renderer 自动取第一个奖励 | Decision registry | 7 conditional family 多选测试 + resolver spy=0 |
| UI-08 working/committed | 活跃 session 只展示其 working projection，正式 store 仅在 commit 后变化 | effect 1 后 renderer 混读 committed 与旧 pending | projection source selector | mid-session fixed trace + commit gate spy |
| UI-09 AI/headless 隔离 | AI/Policy 不依赖 DOM、overlay、renderer 或 UI picker resolver | headless 创建假 DOM 才能完整局 | shared session + policy adapter | poisoned DOM import、固定 Action/Decision trace parity、完整局 |
| UI-10 services 隔离 | localStorage/download/debug/failsafe 不进入规则层 | core import 访问 localStorage 或 debug 直写状态 | BrowserServices ports | Node poison + dependency scan + public API contract |
| UI-11 兼容层可删除 | 每个 legacy adapter 单向、可观测、有 owner 和到期条件 | 新旧双写后任一端成为真相 | migration registry | 每批旧路径调用计数、fail-closed、删除清单 |
| UI-12 视觉交互 parity | 七类正式 UI 的关键布局、点击、键盘和恢复语义保持 | Node 全绿但 overlay 不可操作 | Browser render/event integration | 固定截图/DOM contract、真实 Chrome 主路径与 decision/recovery smoke |

全称义务必须覆盖完整 renderer/intent/decision registry；否定义务必须用结构检查或 poison/spy 证明禁用路径不可达。单条 happy path、页面能点击、Node 全绿或完整一局结束都不能单独证明 UI 已剥离。

## 分阶段迁移与共享热路径边界

### 阶段 1 reference core（SETI-73）

`randomizer/app/browser-host/**` 已提供不接管生产 renderer 的纯逻辑 reference core：

- `projection-adapter.js` 只通过 `StateStore.getSnapshot()` 或同一 `EffectSession.inspect/observe` envelope 选择 committed/session 来源；默认 viewer policy 为拒绝未知字段，并对非 decision owner 隐藏 choices。
- `view-state-store.js` 只保存可清空的 overlay/hover/focus/tab/scroll/layout/draft/animation 状态；projection 或 decision revision 变化时重新求交草稿 choice id，decision identity 变化时清空草稿。
- `input-adapter.js` 把 action、decision、view intent 路由到三个互斥端口；共享层返回 stale 时只刷新 projection、保留结构化错误，不改写 version、不自动重试。
- `index.js` 暴露 `SetiBrowserHost` facade；传统页面已按顺序装配，但 `app.js` 与旧 renderer/handler 尚未切换到该 facade。

reference projection 当前刻意采用保守白名单，未列入的 board/player/card 字段不会为了旧 UI parity 自动透传。后续领域 renderer 需要新增字段时，应先在 viewer policy 中明确可见性，再补多 viewer canary；不得改成先复制完整 StateStore/Session state 再删除少数字段。

### 阶段 2 常驻只读桌面（SETI-74）

`app/browser-host/resident-projection.js` 是生产旧状态到 `BrowserProjection` 的窄兼容 mapper；它只收集 round/turn、玩家公开统计、太阳系公开棋子、终局板、科技供应和公共牌，并在 mapper 边界复制、冻结数据。对手手牌只投影数量，牌库只投影数量，identity/RNG/未揭示顺序均不进入输出。

`app/browser-host/resident-renderer.js` 是上述六类区域的 DOM renderer。其正式调用面只接受 `{ projection, viewState }`，不注入 `pendingState`、mutable player/card/tech/rocket state、Action/Effect handler 或 continuation。`app.js` composition 每次刷新先建立单份 projection，再由 renderer 重建常驻区域；交互选择 chrome 仍由后续 Decision 阶段迁移，本批不改变选择合法性或后续流程。

迁移证据位于 `checkpoint/seti-74-proof-obligations.md` 和 `app/browser-host/resident-renderer.test.js`：包括 renderer 禁用符号扫描、mutable source 隔离、同 projection 清空 DOM 后重建等价、真实 committed array slice、多 viewer hidden canary，以及真实 Chrome reference/生产首局 smoke。

### 阶段 3 统一 Decision UI（SETI-75）

`app/browser-host/decision-ui.js` 提供 generic shell、renderer registry、科技 presentation、语义 UI intent controller 与 DOM renderer。科技 tile 和蓝槽只对同一 `DecisionProjection.choices` 分组，不读取科技 catalog 枚举合法项；focus 只写 `ViewState`，confirm/cancel 只提交原 `decisionId + decisionVersion + choiceId`。shell 仅在 projection 明确包含 `presentation.role=cancel|skip` choice 时提供取消，`optional` 或关闭 DOM 不构成规则跳过。

`projection-adapter.js` 使用与 Effect Session browser host 一致的稳定 choice identity，并把研究科技 choice 的显式 tile/slot presentation 映射到投影；renderer 不获得原 working state。生产传统脚本入口在 facade 前加载 Decision UI，实际规则推进仍由 SETI-62 的 Effect Session/browser host 端口完成。固定 Chrome trace 为 `rotate -> place:blue2:slot-b -> reward:score:3`，只产生一次原子 commit；UI take/reward/continuation spy 均为 0。quick interrupt 后旧 decision version 由共享 host 明确拒绝为 stale，adapter 只刷新、不重写或重试。

### 阶段 4A 扫描、数据与登陆多选择链（SETI-76）

`game/effects/scan-card-session.js` 的 action family 扩展为 `scan / play_card / place_data / land`。扫描链按 `target -> sector -> participant reward(owner p1...) -> participant reward(owner p2...) -> deferred draw` 运行：每个非等价项都是独立 DecisionEffect，参与者 owner 不从当前可见玩家推断；延迟补牌保持 deferred priority，并在揭示隐藏牌时写 RNG journal 与 irreversible barrier。数据放置是 board target Decision；登陆是 board target 后接 payment Decision，规则执行只发生在两个 choice 均被 session 接受之后。

统一 Decision registry 新增 `board-target` 与 `payment` renderer。`projection-adapter.js` 只从 inspect choice 的 Standard Action target/payload 推导只读 presentation；renderer 输出的 choiceId 集合必须与同 revision 的 inspect choices 逐项相等。固定 Node/Chrome trace 覆盖两个扫描目标、两个扇区、两名参与者奖励、隐藏补牌、两个数据槽、两个登陆目标和两种支付；迁移模块对旧 scan/data/land pending owner、AI resolver 和 UI continuation 的引用/调用均为 0。证据见 `checkpoint/seti-76-proof-obligations.md`、`app/browser-host/scan-data-land-session.test.js` 与 `scan-data-land.browser-smoke.html`。

1. 阶段 0（SETI-72 总控）：冻结本文契约、所有权/覆盖矩阵、proof obligations 和子 issue 依赖；不改共享规则热路径。
2. 阶段 1：在 `app/browser-host/**` 建立纯 `BrowserProjectionAdapter`、`ViewStateStore`、`BrowserInputAdapter` reference core。只消费 SETI-71/62/56 的稳定公开接口，不读取旧闭包。
3. 阶段 2：迁移常驻只读区域。优先 round/turn、玩家/对手统计、太阳系、终局板、科技/公共牌；不碰 pending/continuation。
4. 阶段 3：统一 Decision shell/renderer registry 与研究科技代表链已建立；后续领域只注册 presentation renderer，不复制合法性或 continuation。
5. 阶段 4：迁移扫描、打牌、数据、登陆多选择链。只有相应 Standard Action/Effect Session 领域链行为通过后，才删除 UI pending owner。
6. 阶段 5：迁移公司与八种外星人 renderer；机会队列、followup、痕迹奖励顺序归 Effect Session，UI 只呈现 decision schema。
7. 阶段 6：统一 Action bar、Quick Action、PASS、结束、撤销和效果进度；interrupt/revalidation/history/barrier 归共享流程。
8. 阶段 7：删除 AI DOM/picker resolver。Policy 与玩家分别提交同一 Action/Decision；未知/未迁移 decision fail-closed。
9. 阶段 8：收敛 ViewState、恢复/刷新、local persistence、download、debug/failsafe 与 public API；删除 no-op view 对规则 callback 的遮蔽。
10. 阶段 9：完成七类 UI parity、可访问性、性能、固定 trace、全量 Node、真实 Chrome 主路径/decision/recovery smoke 与完整对局，更新架构文档并审计 adapter inventory。

### 阶段 6 Action Bar（SETI-79）

`app/browser-host/action-bar.js` 将 `BrowserProjection.controls` 原样映射为主行动、Quick、PASS、结束回合和撤销控件，并只呈现 `feedback.progress` 的 Effect 进度。renderer/controller 不读取玩家资源、`pendingState`、history 或 effect queue，也不从 label/DOM 推断合法性；enabled Action 点击提交 projection 中原始 Standard Action descriptor，stale/disabled identity fail-closed。撤销通过带 `sessionId + sessionRevision` 的 Effect Session port 提交，不调用旧 `undoPendingAction`。

Effect Session `inspect()` 现在明确公开 `controls.canUndo/undoDisabledReason/allowQuickActions` 与 `progress`。`canUndo` 由共享 undo frame、当前 phase 和 irreversible barrier 共同决定；Browser projection 只映射该结论。等待 Decision 时 Quick interrupt 仍由共享 runtime 执行并提升 revision，旧 Decision 提交仍由共享 stale 校验拒绝，UI 不改写 version 或自动重试。

证据位于 `checkpoint/seti-79-proof-obligations.md`、`app/browser-host/action-bar.test.js`、Effect Session undo/barrier/progress 合约和 Browser Host Chrome smoke。旧页面 `events.js` 的传统 Action Bar callback 仍作为后续整页生产切换的兼容入口；新 Browser Host Action Bar 本身对领域 mutation/continuation 调用为 0。

阶段 1 依赖 SETI-71 的 StateStore reference contract；阶段 3-7 依赖 SETI-62 对应领域 Effect Session 和 SETI-56 conditional Action/Decision 的行为迁移。共享文件发生重叠时，规则状态/Effect/Action 由对应总控 owner 修改，Browser Host 子 issue只改 projection、renderer、input、event/service adapter；集成点使用窄公开接口分提交接线。

## 每批完成门禁

每个迁移子 issue 至少提供：

1. 一个可失败的领域 proof case 和对应反例。
2. projection/renderer/input adapter 纯逻辑测试。
3. legal choices 与共享 inspect 的集合等价、同 checkpoint 逐项执行或明确 fail-closed。
4. 旧 pending/continuation/UI resolver 在该热路径调用为 0 的结构或 runtime 证据。
5. ViewState 清空重建、stale submission、viewer 隐藏信息测试。
6. `node --check randomizer/app.js` 与全部 `randomizer/**/*.test.js`。
7. 涉及浏览器装配时的真实 Chrome 代表路径；最终阶段覆盖主路径、Decision、恢复和完整对局。

只有 adapter inventory 的目标项达到 `deleted`、`shared-owned`、`host-only` 或带明确 owner/到期日的 `legacy-adapter`，并且全部 proof obligations 有与量词匹配的证据，才能关闭 SETI-72。
