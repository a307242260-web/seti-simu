# SETI-74 常驻只读桌面迁移 Proof Obligations

## 边界与反例

本批只迁移 round/turn、玩家与对手公开统计、太阳系、终局板、科技供应、公共牌的只读呈现。选择态、按钮合法性、pending、Decision、continuation、Action/Effect handler 均保留旧 owner，不进入 renderer。

最小反例：给 renderer 同一份冻结 projection，但同时把旧 `playerState`、`cardState`、`techGameState` 与 `pendingState` 替换为会在读取时抛错的 Proxy；若 DOM 重建失败，说明 renderer 仍混读 mutable domain。

## 可证伪义务

| ID | 可证伪命题 | 反例构造 | 实现落点 | 验证证据 | 失败语义 |
|---|---|---|---|---|---|
| R-01 单一输入 | 每个已迁移 renderer 只解构 `{ projection, viewState }`，不接收 mutable domain/pending | poison 旧状态并渲染 | `app/browser-host/resident-renderer.js` | 结构扫描 + poison test | 缺 projection/schema 时抛 `TypeError` |
| R-02 重建等价 | 清空目标 DOM 后用同 projection/ViewState 重建，稳定 DOM snapshot 等价 | 首次 render 留下隐式缓存 | resident renderer 的 replace/sync 操作 | 两次清空重建 snapshot 深等 | renderer 不保存领域事实或跨帧选择状态 |
| R-03 viewer 隐私 | 对手/旁观者投影不包含手牌 identity、牌库顺序、RNG、私有字段 | 在对手手牌与 deck 注入 canary | `projection-adapter.js` visibility policy | player/spectator snapshot + forbidden canary scan | 默认拒绝未知字段 |
| R-04 交互隔离 | 常驻只读 renderer 不枚举选择、不执行 continuation、不改写规则状态 | projection 携带 decision/pending canary | resident renderer | mutation/dispatch/continuation spy 恒为 0 | renderer 不暴露规则 callback |
| R-05 生产装配 | app composition 的常驻刷新先构造单份 projection，再将其传给 renderer；旧交互层只保留未迁选择 chrome | 刷新时各区域自行读取不同版本 | app composition proxy | composition contract test + Chrome 首屏 smoke | projection 构造失败时 fail-fast，不静默回旧 renderer |
| R-06 视觉资产稳定 | 公共牌、科技、终局板和太阳系节点使用 projection 中的公开 identity/布局重建 | 只输出文本导致资产/位置丢失 | resident projection mapper + renderer | 固定 projection DOM snapshot + Chrome 桌面 smoke | 缺可见 identity 时渲染空占位，不猜测隐藏值 |

## 完备性矩阵

| 区域 | projection 字段 | renderer 输出 | 禁止依赖 |
|---|---|---|---|
| round/turn | `match` | 轮次、回合、终局状态 | `turnState` |
| 玩家/对手统计 | `players`、`viewer`、`cards.opponentCounts` | 自己公开资产与对手公开摘要 | `playerState`、AI controller |
| 太阳系 | `board.solarSystem/pieces/planets/data` | 旋转、公开棋子/标记/数据节点 | `solarState`、`rocketState`、pending picker |
| 终局板 | `board.finalScoring` | tile、公开 marker/score | final pending、机会队列 |
| 科技供应 | `tech.supply` | supply 可见 tile/bonus/占用态 | `techGameState.ui`、科技选择 continuation |
| 公共牌 | `cards.market` | 三个公开牌位与资产 | `cardState`、card selection pending |

## 验证层级

1. `node --check`：新 adapter/renderer 与 `app.js` 装配语法。
2. 定向 Node：固定 projection、poison mutable source、DOM 重建、多 viewer canary、composition contract。
3. 全量 `node tools/run_node_tests.js`。
4. 真实 Chrome：首屏加载及桌面常驻区 smoke；不进入 Decision 路径。
