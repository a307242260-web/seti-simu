# Node 测试标准

默认 Node 回归长期只执行两类测试：

- `unit`：一个明确规则、纯函数、领域对象或窄接口的可观察行为。测试必须可隔离、确定性执行；历史 bug 必须通过业务输入输出复现。
- `fullFlow`：仓库唯一的版本化完整流程。固定初态、公共输入脚本和最终权威盘面位于 `randomizer/full-flow/standard-flow-v1.fixture.js`，执行入口为 `randomizer/full-flow/standard-flow.test.js`。

不得新增读取生产源码后匹配字符串、函数名、行数或装配顺序的测试，也不得用“模块能加载”“导出存在”、迁移阶段编号或旧文件已删除代替业务契约。新增测试必须先登记到 `tools/node-test-inventory.js`；未登记、重复登记或 full-flow 数量不是一个时，runner 会直接失败。

测试类型与架构归属是两个正交维度。每个 unit 必须按 SETI-45 已确认的组件归入“唯一 Action、唯一 Effect Queue、唯一 Session 状态、统一权威状态、网页 UI、机器人”之一；唯一 full-flow 同时覆盖前四个共享内部组件。归属取决于测试实际验收的契约，不取决于测试从 Browser、Headless 或其他宿主入口执行；不得用实现路径或 runtime core 等名词创造新的架构分类。

## 运行

```sh
node tools/run_node_tests.js
node tools/run_node_tests.js --list
node tools/run_node_tests.js --match game/actions
```

默认输出分别报告 unit/full-flow 数量和耗时。清单本身也只接受这两类，不保留 `merge`、`architectureGate` 或其他延期分类。

## 本轮清理

- 删除四个 `ai-controller.*.integration.test.js` 巨型重复 harness、`game/ai/ai.test.js`、controller characterization、migration/source-wiring 测试。
- 删除 `standard-action-reference/stage2..5` 阶段测试；保留的 registry、runtime、headless 窄接口回归承担正式行为契约。
- 删除重复完整对局/worker 集成入口：`headless-env.test.js`、`headless-terminal.test.js`、`headless-worker.integration.test.js`、`headless-effect-session-integration.test.js`。
- 将 game/ai 下 16 个数行级小测试合并为 `domain-units.test.js`。
- 从保留的行为测试中移除迁移禁词、旧 continuation、脚本装配顺序等源码文本断言。
- 将 `expected-score-evaluator.test.js`、`heuristic-policy.test.js` 去除源码扫描后作为行为 unit 保留；删除固定版面、固定 seed 整局和逐回合报告三套额外流程基线。
- 删除 StateStore 源码架构扫描器及三套负向 fixture；唯一 owner、快照隔离、CAS 冲突和恢复拒绝继续由对应状态行为 unit 与唯一 full-flow 验证。
- 删除 8 个浏览器自动化/观测工具测试与 6 个训练/worker 基础设施测试；这些套件不再作为机器人单元能力证据。自动化编排、日志/报告、调参、自博弈、评测与 worker 容错细节不再由默认 Node 回归验证。

被删除的迁移、装配和“旧符号不存在”风险不再验证；业务规则与状态行为风险继续由对应 unit 和唯一 full-flow 覆盖。
