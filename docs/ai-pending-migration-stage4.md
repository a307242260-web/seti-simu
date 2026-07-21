# Stage 4：AI pending resolver 与 action executor 迁移记录

## 结果

- `randomizer/app/ai-controller.js`：5,686 行 → 1,961 行，原 resolver、executor 与自动化编排函数体已删除。
- `randomizer/app/ai/initial-card-pending.js`：1,097 行，承接初始选择、收入/弃牌、PASS 预留、公共牌/手牌选择、卡牌触发/任务与打牌。
- `randomizer/app/ai/interaction-pending.js`：2,283 行，承接数据、移动支付、登陆、扫描、免费移动、科技、公司与外星人 pending。
- `randomizer/app/ai/action-executor.js`：742 行，承接顶层候选汇总、行动执行、失败重试与 planner shadow 日志。
- `randomizer/app/ai/automation-runtime.js`：404 行，承接 pending 优先级、效果恢复、选定行动执行与 `runAiAutomationStep`。

## 契约保持

- pending、回合、效果流状态仍由 `app.js` 传入的 `state` / 各 state 对象单一持有，新模块不创建状态副本。
- `getPendingAutomationPlayerId` 及 pending owner 判定继续归 `control-runtime.js` 所有。
- `automation-runtime.js` 保留原 `runAiNonTurnAutomationStep` 顺序，resolver 的 `progressed`、`skipped`、`blocked` 返回和日志调用保持原样。
- controller 先建立 app/runtime 回调注册表，再按各模块的 `REQUIRED_CONTEXT_KEYS` 生成窄 context；跨域调用使用惰性回调，避免模块抓取 controller 闭包。

## 删除与装配证据

`randomizer/app/ai/pending-domain-migration.test.js` 会校验函数体真实删除、模块与控制器行数、浏览器脚本顺序和 pending 状态所有权。

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
