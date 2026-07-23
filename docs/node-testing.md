# Node 测试标准

默认 Node 回归长期只执行两类测试：

- `unit`：一个明确规则、纯函数、领域对象或窄接口的可观察行为。测试必须可隔离、确定性执行；历史 bug 必须通过业务输入输出复现。
- `fullFlow`：仓库唯一的版本化完整流程。固定初态、公共输入脚本和最终权威盘面位于 `randomizer/full-flow/standard-flow-v1.fixture.js`，执行入口为 `randomizer/full-flow/standard-flow.test.js`。

不得新增读取生产源码后匹配字符串、函数名、行数或装配顺序的测试，也不得用“模块能加载”“导出存在”、迁移阶段编号或旧文件已删除代替业务契约。新增默认测试必须先登记到 `tools/node-test-inventory.js`；重复登记、登记文件不存在、条目字段不完整或 full-flow 数量不是一个时，runner 会直接失败。仓库中未登记的 feature/tooling 测试不会进入新架构默认回归。

测试类型与 owner 是两个正交维度。每个 inventory 条目必须逐文件显式登记 `file`、`owner`、`obligation`、`counterexample`；owner 取决于实际验收的公共契约，不由文件路径或正则推导。正式基础设施使用 `architecture/*`，游戏规则使用 `rules/*`，策略实现使用 `policy/*`。

正式 owner、proof obligation、反例以及现有文件的删除/重写边界见
`docs/node-test-architecture-matrix.md`。新增测试先找到唯一 owner 和可观察失败语义，再进入 inventory。

## 运行

```sh
node tools/run_node_tests.js
node tools/run_node_tests.js --list
node tools/run_node_tests.js --match game/actions
node tools/run_browser_smokes.js --list
node tools/run_browser_smokes.js
```

默认 Node 输出分别报告 unit/full-flow 数量、耗时和逐 owner 计数。Chrome smoke 使用独立固定清单，不伪装成 Node unit；它覆盖页面装配、projection 隐私、人类 Action/Decision、Policy 输入与 save/recovery。

逐文件保留、移出和合并结果见 `docs/node-test-audit-result.md`。

## 本轮清理

- 删除四个 `ai-controller.*.integration.test.js` 巨型重复 harness、`game/ai/ai.test.js`、controller characterization、migration/source-wiring 测试。
- 删除 `standard-action-reference/stage2..5` 阶段测试；保留的 registry、runtime、simulation 窄接口回归承担正式行为契约。
- 删除重复完整对局/worker 集成入口：`simulation-env.test.js`、`simulation-terminal.test.js`、`simulation-worker.integration.test.js`、`simulation-effect-session-integration.test.js`。
- 从保留的行为测试中移除迁移禁词、旧 continuation、脚本装配顺序等源码文本断言。
- 删除固定版面、固定 seed 整局和逐回合报告三套额外流程基线。
- 删除 StateStore 源码架构扫描器及三套负向 fixture；唯一 owner、快照隔离、CAS 冲突和恢复拒绝继续由对应状态行为 unit 与唯一 full-flow 验证。
- 删除 8 个浏览器自动化/观测工具测试与 6 个训练/worker 基础设施测试；这些套件不再作为机器人单元能力证据。自动化编排、日志/报告、调参、自博弈、评测与 worker 容错细节不再由默认 Node 回归验证。
- 删除旧 AI runtime characterization 与装配 key 枚举；机器人只保留正式 Policy Port、Machine Player Host、Policy→Browser 输入和浏览器机器席位 composition 的行为 unit。
- Action unit 只保留玩家可选择的主行动、快速行为，以及外星人标记会产生差异结果的物种行为；删除误归其中的展示、协议、simulation、状态初始化、资料同步、UI 坐标、能力链、公司与起始卡测试，不挪到其他模块继续保留。
- 清除保留测试中的生产 `.js/.html` 源码读取、脚本装配、旧符号缺失、Browser/Node 源码 parity 和资源文件存在性断言；不以 AST、snapshot 或导出枚举替代。

被删除的迁移、装配和“旧符号不存在”风险不再验证；业务规则与状态行为风险继续由对应 unit 和唯一 full-flow 覆盖。
