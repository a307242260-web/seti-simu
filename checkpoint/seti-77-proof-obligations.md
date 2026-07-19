# SETI-77 Proof Obligations

## 范围

阶段 4B 迁移打牌域的 Browser Decision 表达与共享 Effect Session adapter：选牌、支付、顺序卡牌效果、任务/被动 trigger、新 DecisionEffect、journal 和 commit/abort。卡牌 renderer 只消费 BrowserProjection 与 ViewState 草稿，不读取或推进规则状态。

## 可证伪义务

1. `play_card` 必须先停在支付 DecisionEffect；合法支付后才落牌，支付失败或 stale choice 不污染 committed state。
2. 卡牌 DSL 效果按声明顺序执行；任一后续 DecisionEffect 必须保留 owner，等待输入时不得提前 commit。
3. 卡牌全部顺序效果完成后才收集任务/被动 trigger；trigger 按稳定队列顺序执行，随后产生的选择仍由共享 DecisionEffect 承载。
4. 未登记 pending type、conditional family 或 trigger 必须 fail-closed 并 abort 到 base state，不调用旧 card/card-trigger continuation。
5. BrowserProjection 只向 decision owner 暴露 choices；非 owner 不可提交。ViewState 刷新、清空或 DOM renderer 销毁/重建不得增删合法 choices、消费支付或推进 trigger。
6. Decision 提交必须携带 `decisionId + decisionVersion + choiceId`；旧 projection 在 session revision 改变后必须 stale 且无规则副作用。
7. queue 非空或存在 awaiting input 时不得 commit；完成后 journal 必须分别记录打牌 Action、支付/后续选择和卡牌结果。
8. 固定打牌 trace 在 Node 与浏览器脚本装配中等价；迁移 adapter 源码对旧 pending/continuation 标识的引用为 0。

## 分层证据

- L1：`node --check randomizer/app.js` 及修改模块语法检查。
- L2：`randomizer/game/effects/scan-card-session.test.js` 覆盖支付、顺序效果、trigger priority、owner、fail-closed、replay 与旧 continuation 零引用。
- L3：`randomizer/app/browser-host/card-decision-ui.test.js` 覆盖卡牌 presenter/renderer、hidden owner、ViewState 销毁重建和 stale submission。
- L4：`node tools/run_node_tests.js` 全量 Node 回归。
- L5：真实 Chrome 打牌 smoke，确认 Browser Host Decision UI 可见、选择后队列继续且无 blocked/bug。

## 反证问题

- 是否存在卡牌 adapter/renderer 直接改玩家资源或 pendingState？
- 是否存在 trigger/pending 未登记却被当作成功完成？
- 是否能从非 owner projection 猜出隐藏手牌 choice，或提交另一玩家 decision？
- 是否清空 ViewState 后合法 choices 数量改变，或重复支付/领奖？
- 是否 queue 未清空就替换 committed state？
