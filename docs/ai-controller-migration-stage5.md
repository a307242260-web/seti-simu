# Stage 5：AI automation、controller wiring 与测试收口

## 最终结果

- `randomizer/app/ai-controller.js`：原始 22,960 行，Stage 5 收口后 1,968 行，减少 20,992 行；只保留规则/runtime 装配、状态重置、context 注入与稳定 controller API。
- `runAiNonTurnAutomationStep()`、`runAiAutomationStep()` 位于 `app/ai/automation-runtime.js`；顶层候选选择、执行与失败重试位于 `app/ai/action-executor.js`，控制器中没有同名函数体。
- Stage 1～4 新增的生产模块均低于 3,000 行；既有 `game/ai/battle-analytics.js` 不属于本轮新增模块，不计入该迁移边界。
- `public-api.js` 与 `headless-env.js` 继续只调用 controller 的稳定 API，没有依赖 pending runtime 或规则域内部实现。

## Controller composition

- 每个 app AI runtime 通过 `REQUIRED_CONTEXT_KEYS` 声明依赖；controller 装配时逐项校验，缺项会在创建 controller 时直接报出依赖名，不再静默过滤后延迟到深层分支失败。
- 收口校验发现 `initial-card-pending.js` 使用的深空交换阈值未进入 runtime context；现按迁移前同口径固定为 `10` 并显式注入。
- pending、回合、效果流和自动调度状态仍分别由 `app.js` 与 `control-runtime.js` 单一持有；controller 和各 runtime 不复制状态。

## 测试拆分

原 `ai-controller.integration.test.js` 为 10,295 行，并重复内嵌约 1,000 行 controller harness。现拆为：

- `ai-controller.pending.integration.test.js`：2,220 行。
- `ai-controller.alien.integration.test.js`：2,342 行。
- `ai-controller.action.integration.test.js`：2,338 行。
- `ai-controller.strategy.integration.test.js`：2,360 行。
- `ai-controller-test-harness.js`：1,033 行，共享 controller 夹具。
- `ai-controller-integration-fixtures.js`：119 行，共享外星人状态夹具。

另新增 `app/ai/automation-runtime.test.js` 与 `app/ai/action-executor.test.js`，直接覆盖 pending 短路顺序、idle 后顶层选择、异常转 bug、selector、稳定 dispatch、retry 判断和 planner shadow。原 10k 测试巨石及重复 harness 已删除。

## 删除与装配证据

- `app/ai/pending-domain-migration.test.js` 校验迁出函数体不在 controller、四个 runtime 均先于 controller 装配、生产模块行数与 context 缺项 fail-fast。
- `app/ai-controller.characterization.test.js` 校验 CommonJS/传统全局双入口、稳定 controller API、快照、pending owner、report 与调度契约。
- `app/ai-controller.seed-baseline.test.js` 校验固定 seed 的终局摘要、完成率、bug/block、行动序列与 replay 终态。

## 残余风险

- controller 仍有约 2,000 行显式 wiring；这是无构建、传统脚本模式下的 composition adapter，不应再承载规则或 resolver 正文。
- 本轮按父级更新后的契约不要求真实浏览器环境验收；传统脚本顺序由静态装配测试与 Node API bootstrap 覆盖。
