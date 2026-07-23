# Stage 4：AI pending resolver 与 action executor 迁移记录

> 历史快照：本文只记录 Stage 4 当时把旧 pending/automation 从 controller 迁出的过程，不描述当前 Browser 生产契约。当前 `action-executor.js`、`automation-runtime.js` 与 `experiment-runner.js` 均已删除，Browser 不再存在 `runAiAutomationStep` 或 autobattle/batch/A-B/tuning 执行入口。

## 当时结果

- `randomizer/app/ai-controller.js`：5,686 行 → 1,961 行，原 resolver、executor 与自动化编排函数体已删除。
- `randomizer/app/ai/initial-card-pending.js`：1,097 行，承接初始选择、收入/弃牌、PASS 预留、公共牌/手牌选择、卡牌触发/任务与打牌。
- `randomizer/app/ai/interaction-pending.js`：2,283 行，承接数据、移动支付、登陆、扫描、免费移动、科技、公司与外星人 pending。
- 当时 `randomizer/app/ai/action-executor.js` 为 742 行，承接顶层候选汇总、行动执行、失败重试与 planner shadow 日志；现已删除。
- 当时 `randomizer/app/ai/automation-runtime.js` 为 404 行，承接 pending 优先级、效果恢复、选定行动执行与 `runAiAutomationStep`；现已删除。

## 当时的契约保持

- pending、回合、效果流状态仍由 `app.js` 传入的 `state` / 各 state 对象单一持有，新模块不创建状态副本。
- `getPendingAutomationPlayerId` 及 pending owner 判定继续归 `control-runtime.js` 所有。
- 当时 `automation-runtime.js` 保留原 `runAiNonTurnAutomationStep` 顺序；该顺序及 resolver 返回不属于当前 Browser 契约。
- controller 先建立 app/runtime 回调注册表，再按各模块的 `REQUIRED_CONTEXT_KEYS` 生成窄 context；跨域调用使用惰性回调，避免模块抓取 controller 闭包。

## 删除与装配证据

以下测试命令仅是 Stage 4 当时的代表性证据；其中旧 automation/action executor 专项后来已随模块删除，不应解释为当前生产装配要求。

代表性验证：

```bash
node randomizer/app/ai/pending-domain-migration.test.js
node randomizer/app/ai-controller.characterization.test.js
node randomizer/app/ai-controller.pending.integration.test.js
node randomizer/app/ai-controller.alien.integration.test.js
node randomizer/app/ai-controller.action.integration.test.js
node randomizer/app/ai-controller.strategy.integration.test.js
node tools/run_node_tests.js --match app/ai
```
