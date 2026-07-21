# SETI-108 阶段 3 Proof Obligations

## 决策边界矩阵

| 旧职责 | Standard Decision family | legal descriptor 来源 | evaluator | 唯一提交端口 | 反例 |
|---|---|---|---|---|---|
| 开局公司 + 初始牌 | `choose_branch` | 当前 offer 的公司 × 初始牌组合 | `selection-evaluator.scoreOpeningCombination` | `heuristic-policy.decideChoice` 返回 `PolicyDecision.actionId` | 两个非等价组合、错误 owner、stale、空 offer |
| 弃牌 / PASS 预留 | `choose_card` | 当前手牌组合 / 当前预留牌堆 | 收入、交易、卡牌价值评分 | 同上 | 两张非等价牌、空 legal set |
| 科技片 / 蓝槽 | `choose_target` | 当前供应合法候选 / 当前可用槽 | 科技与槽位评分 | 同上 | 候选失效、未知 family |
| 移动支付 | `choose_payment` | 当前移动牌与能量可支付组合 | 机会成本与保能量评分 | 同上 | 两种支付、stale version |
| 外星人机会 / 分支 | `choose_reward` | 当前 session/UI 已枚举选项 | 外星人选项评分 | 同上 | confirm 与 skip、全部 disabled |

## 可证伪义务

1. **旧 Policy 为零**：`game/ai/policy.js`、`SetiAIPolicy`、`ai.policy`、旧 `choose*` caller 和 HTML 脚本装配均不存在。反例是任一生产文件仍命中这些符号。
2. **公共端口唯一**：上述每类选择至少以两个非等价 Standard descriptor 构造 `DecisionContext`，Heuristic Policy 只返回 legal `actionId`，随后通过公共 validator。错误 owner、空集、未知 family、stale decision 必须结构化失败；不得取首项、调用 DOM 或 resolver。
3. **策略 provenance 一致**：Browser、Headless teacher 与 frozen opponent 均使用 `seti-heuristic-policy-v1`；决策 trace 包含公共 policy version 和 config checksum。
4. **历史 schema fail-closed**：`techState.ownedTileByType`、`techState.blueBoardSlot` 在玩家输入、科技领域输入和 committed StateStore validator 中均结构化拒绝。StateStore 注入失败时 version 与序列化 bytes 不变。
5. **行为不漂移**：迁移只改变决策传输边界，不改变原评分、排序、规则或训练算法；既有 AI/固定 seed 回归、完整 headless 与真实 Chrome 机器席位必须通过。

## 分层证据

- 结构：旧文件/全局/export/caller 扫描为 0；当前 schema 禁用 key 扫描。
- 合约：`heuristic-policy.test.js` 覆盖五类迁移 family、双 choice、owner/unknown/empty/stale；PolicyDecision provenance 断言。
- 状态：`players.test.js`、`tech.test.js` 与 `high-coupling-slices.test.js` 覆盖旧字段拒绝及 StateStore 零污染。
- 集成：全量 Node、authority audit、固定 seed、完整 headless、Chrome browser policy smoke 与机器席位完整局。
