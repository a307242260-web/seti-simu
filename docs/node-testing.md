# Node 测试标准

默认 Node 回归长期只执行两类测试：

- `unit`：一个明确规则、纯函数、领域对象或窄接口的可观察行为。测试必须可隔离、确定性执行；历史 bug 必须通过业务输入输出复现。
- `fullFlow`：仓库唯一的版本化完整流程。固定初态、公共输入脚本和最终权威盘面位于 `randomizer/full-flow/standard-flow-v1.fixture.js`，执行入口为 `randomizer/full-flow/standard-flow.test.js`。

不得新增读取生产源码后匹配字符串、函数名、行数或装配顺序的测试，也不得用“模块能加载”“导出存在”、迁移阶段编号或旧文件已删除代替业务契约。新增测试必须先登记到 `tools/node-test-inventory.js`；未登记、重复登记或 full-flow 数量不是一个时，runner 会直接失败。

## 运行

```sh
node tools/run_node_tests.js
node tools/run_node_tests.js --list
node tools/run_node_tests.js --match game/actions
```

默认输出分别报告 unit/full-flow 数量和耗时。`merge` 是已被默认回归隔离、等待并入主契约后物理删除的旧文件，不是第三类测试。

StateStore authority 审计不属于 Node 回归。当前候选方案 A 将它临时保留为独立架构闸门，由 `node tools/audit_state_authority.js` 执行；相关负向 fixture 在清单中标为 `architectureGate`，不会混入默认回归。若 owner 选择方案 B，应删除该闸门或把风险改写为行为级 unit/full-flow 后再登记。

## 本轮清理

- 删除四个 `ai-controller.*.integration.test.js` 巨型重复 harness、`game/ai/ai.test.js`、controller characterization、migration/source-wiring 测试。
- 删除 `standard-action-reference/stage2..5` 阶段测试；保留的 registry、runtime、headless 窄接口回归承担正式行为契约。
- 删除重复完整对局/worker 集成入口：`headless-env.test.js`、`headless-terminal.test.js`、`headless-worker.integration.test.js`、`headless-effect-session-integration.test.js`。
- 将 game/ai 下 16 个数行级小测试合并为 `domain-units.test.js`。
- 从保留的行为测试中移除迁移禁词、旧 continuation、脚本装配顺序等源码文本断言。

被删除的迁移、装配和“旧符号不存在”风险不再由默认 Node 回归验证；其中 StateStore 唯一 owner 风险按上述 owner 决策暂由独立审计闸门承担。业务规则风险继续由对应 unit 和唯一 full-flow 覆盖。
