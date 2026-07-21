# SETI-107 Browser 唯一 StateStore proof obligations

| ID | 可证伪命题 | 最小反例 | 唯一落点 | 证据 |
|---|---|---|---|---|
| B1 | Browser composition 从首次建局起只创建一个长期 StateStore authority；`app.js` 不创建长期领域 state | 给任一领域 `create*State` 装 poison，加载 `app.js` 时被调用 | `app/browser-state-authority.js` | source inventory + composition poison |
| B2 | 规则代码只取得 authority 当前 working-copy 的窄引用；修改 snapshot 不改变 committed bytes | 把 snapshot 深层字段改写后 serialize bytes 漂移 | BrowserStateAuthority / StateStore | snapshot isolation test |
| B3 | working-copy 成功提交只令 `stateVersion +1`；stale、mutator/invariant 失败保持 bytes 与 journal 不变 | 两个 base version 同时提交，失败 writer 污染 committed root 或 journal | `commit` / `runTransaction` | CAS、poison、journal test |
| B4 | 保存直接调用长期 authority 的 `serialize()`，不再临时从传统切片创建 StateStore | poison `createCommittedGameState/createHighCouplingStateStore` 后保存触发 | `createGameRecoverySnapshot` | source assertion + fake store call trace |
| B5 | recovery/new game 在 lifecycle 边界替换 committed authority，并原位水合既有窄引用；旧注入 slice setter 不触发 | recovery callback 手工回填一个独立旧 owner | BrowserStateAuthority `replaceCommitted/resetWorking` | identity/poison recovery test |
| B6 | UI、选择、日志和 Policy 状态不进入 committed root | `statusNote`、card/tech UI 或 decision 被 serialize | purifier + exact root schema | forbidden field test / state audit |
| B7 | Browser/Headless 固定 seed 代表 trace 保持规则等价 | 相同 seed 的 action/effect/round trace 漂移 | production composition | Node full suite + Chrome action/choice/round smoke |

## 状态与写入 inventory

- committed slices：`match/turn/players/solarSystem/pieces/planets/data/cards/tech/aliens/finalScoring`，唯一 owner 为 BrowserStateAuthority 内的 StateStore。
- working-copy 窄引用：`turnState/playerState/solarState/rocketState/planetStatsState/nebulaDataState/cardState/techGameState/alienGameState/finalScoringState`；不得被持久化为第二棵 committed root。
- host/session：DecisionSession、setup selection、card task derived index、action/quick history、action log、UI/status/tech/card selection chrome。
- lifecycle：bootstrap 由领域 factory 只构造一次候选；new game 重置 working copy 后 CAS；recovery 校验 serialized committed root 后替换 authority 并水合现有引用。
