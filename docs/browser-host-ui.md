# Browser Host UI 契约

Browser Host 是浏览器玩家端的正式宿主边界。它只把 StateStore committed snapshot 或当前 Effect Session working state 投影成只读 `BrowserProjection`，把 DOM 输入转换成 Standard Action、Standard Decision 或纯 View intent，并保存可丢弃的 `ViewState`。

## 上游协议

- StateStore：唯一 committed 事实。
- Effect Session：唯一 working state、queue、Decision、journal、undo/barrier 与 commit/abort 生命周期。
- Standard Action：15 个顶层 family、7 个 conditional family、identity、actor、target/payload、合法性和业务 handler。
- Machine Player Host / Policy：机器席位只返回当前 legal set 的 `actionId`，提交前由 Host 复核 freshness。

Browser Host 不重定义这些协议，也不保存规则切片。

```text
StateStore snapshot ───────────────┐
EffectSession inspect / observe ───┼─> BrowserProjection ─> renderer
                                   │
DOM input ─> BrowserInputAdapter ──┴─> Action / Decision / View intent
PolicyDecision ─> PolicyInputAdapter ─> 同一 Action / Decision port
```

## Projection 与可见性

`game/state/host-source.js` 是 Browser Host 的唯一状态读取口；`app/browser-host/projection-adapter.js` 在 committed/session 两种来源中二选一：

1. 无活跃 session 时只读 `StateStore.getSnapshot()`。
2. 有活跃 session 时只读同一 `EffectSession.inspect/observe` envelope。
3. projection 深拷贝并冻结，不暴露 mutable state、executor、callback 或 registry。
4. 非 decision owner 看不到隐藏 choices；对手只看到公开统计和手牌数量。
5. renderer 需要新字段时必须先声明 viewer 可见性，不能复制完整 state 后删少量字段。

`resident-projection.js` 只校验/冻结规范 BrowserProjection（或显式 StateSource projector 结果），传统 `playerState/turnState/cardState/...` key 会结构化拒绝。`resident-renderer.js` 负责 round/turn、玩家公开统计、太阳系棋子、终局板、科技供应与公共牌。Decision renderer registry 负责 action bar、研究科技、扫描/数据/登陆、卡牌、公司和八种外星人 choice presentation。renderer 只接受 `{ projection, viewState }`。

## 输入边界

`app/browser-host/input-adapter.js` 路由三类互斥输入：

| 输入 | 提交到 | 失败行为 |
|---|---|---|
| `action` | Standard Action port | stale/disabled/unknown 时刷新并显示结构化错误 |
| `decision` | Effect Session decision port | 校验 decision id/version/owner/choice，不重试或改写 |
| `view` | ViewState store | 只改 panel/hover/tab/scroll/draft，不触碰规则 |

DOM handler 只解析稳定 identity、指针/键盘信息与当前 projection。不得直接写玩家、卡牌、科技、棋子、history、queue 或 session；不得在确认后从 UI 层续跑规则。

`policy-input-adapter.js` 为机器席位读取同一 boundary、observation 和完整 descriptor，经 Machine Player Host 验证后提交同一 Action/Decision port。它不读 DOM、overlay、renderer、picker 或领域 continuation。Policy 失败只产生结构化暂停；确定性 Effect、唯一选择、触发顺序、commit、event/log/replay 仍由 Effect Session 独占。

## ViewState

ViewState 只包含可丢弃的宿主信息，例如打开面板、hover、tab、滚动和未提交草稿。清空 ViewState、重建 DOM 或 renderer 抛错都不得改变 committed/session state、legal set、decision owner 或 replay cursor。

规则相关 identity 不能藏在 ViewState。当前 PASS dismiss 位于正式 `runtime.ui`，扫描展示关联位于 `runtime.browserHost`；二者不承担合法性或流程推进。

## Browser Services 与恢复

`app/browser-host/browser-services.js` 负责 local persistence、恢复、下载、debug/failsafe command、public facade 与提交后的刷新订阅：

- committed 只能来自 `StateStore.serialize()`。
- active session checkpoint 与 ViewState 保持各自 schema。
- 恢复先预验证 state/session/view；预验证失败时全部 restore 调用为 0。恢复阶段任一端口拒绝时，已恢复的 resident StateStore/session/ViewState 回滚到调用前 bytes。
- StateStore 通过同一 resident instance 的 `restore()` 原位替换 committed snapshot；不得创建临时 validation store，也不得用 CAS 伪造额外版本。
- version 1、缺版本、未知 schema、未知 root、损坏 JSON 和 stale session 全部 fail-closed。
- renderer/下载/localStorage 失败不能回滚已成立的规则提交。

## 当前 owner 清单

| 区域 | 规则/状态 owner | Browser 模块职责 |
|---|---|---|
| 常驻状态 | StateStore / host source | projection + resident renderer |
| Action bar / PASS / quick / undo | Standard Action / Effect Session | controls presentation + input adapter |
| 通用 choice、科技、扫描、卡牌 | Effect Session | Decision presentation |
| 公司与外星人 | `industry-alien-session.js` | 领域 presentation registry |
| 人类席位 | 当前 BrowserInputAdapter | DOM identity -> Action/Decision |
| 机器席位 | Machine Player Host | PolicyDecision -> 同一 Action/Decision |
| 保存与恢复 | StateStore + session checkpoint | Browser Services envelope / ViewState |

## Fail-closed 矩阵

| 反例 | 必须成立 |
|---|---|
| renderer 抛错 | committed bytes 与 version 已提交且不回滚 |
| stale action/decision | state、journal、cursor 不变 |
| 非 owner 提交 choice | 明确拒绝，不隐藏改成当前玩家 |
| 未知 renderer kind/family | 不显示可提交控件，不调用领域函数 |
| 非法 Policy actionId / identity drift | submit 调用为 0，Host 暂停 |
| 损坏 save/session/view | 所有 restore port 调用为 0 |
| 清空 ViewState/DOM | projection、legal set 与 decision 保持等价 |

## 验证

- Node：projection/input/action-bar/Decision/Policy/Browser Services 合约与 poison tests。
- Chrome：常驻渲染、Action/Decision、人类输入、Policy 输入和 recovery smoke。
- 完整局：固定 seed 四席机器终局，`blocked=false`、`bugCount=0`。
- 结构：`node tools/audit_state_authority.js` 与全量 `node tools/run_node_tests.js`。

历史分阶段证据保存在对应 checkpoint；当前长期契约以本文件、`docs/project-architecture.md` 和 `docs/game-runtime-persistence-contract.md` 为准。
