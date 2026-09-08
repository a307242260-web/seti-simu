# Node 测试标准

默认 Node 回归长期只执行两类测试：

- `unit`：一个明确规则、纯函数、领域对象或窄接口的可观察行为。测试必须可隔离、确定性执行；历史 bug 必须通过业务输入输出复现。
- `fullFlow`：仓库唯一的版本化完整流程。它通过公共 Standard Action / Decision 输入完成开局、
  发射、移动、支付和 checkpoint 恢复，并核对恢复前后的 observation、合法行动与 committed
  state。配置和 provenance 位于 `randomizer/full-flow/standard-flow-v1.fixture.js`，执行入口为
  `randomizer/full-flow/standard-flow.test.js`。

不得新增读取生产源码后匹配字符串、函数名、行数或装配顺序的测试，也不得用“模块能加载”“导出存在”、迁移阶段编号或旧文件已删除代替业务契约。新增测试必须先登记到 `tools/node-test-inventory.js`；未登记、重复登记、登记文件不存在、条目字段不完整或 full-flow 数量不是一个时，runner 会直接失败。仓库不保留 inventory 之外的 `.test.js`。

测试失败时先判断其义务是否仍属于当前公共契约。只服务于已删除 API、旧状态形状、旧文件布局、
历史随机轨迹或 checkpoint 字节哈希的测试应删除或改写为当前行为测试；不得为使它通过而恢复兼容
代码。测试数量和全绿本身都不是架构完成证据。

测试类型与 owner 是两个正交维度。每个 inventory 条目必须逐文件显式登记 `file`、`owner`、`obligation`、`counterexample`；owner 取决于实际验收的公共契约，不由文件路径或正则推导。正式基础设施使用 `architecture/*`，游戏规则使用 `rules/*`，策略实现使用 `policy/*`。

正式 owner、proof obligation 和反例以 `tools/node-test-inventory.js` 的逐文件登记及对应
公共契约文档为准。新增测试先找到唯一 owner 和可观察失败语义，再进入 inventory。

## 运行

```sh
node tools/run_node_tests.js
node tools/run_node_tests.js --list
node tools/run_node_tests.js --match game/actions
node tools/run_browser_smokes.js --list
node tools/run_browser_smokes.js
```

默认 Node 输出分别报告 unit/full-flow 数量、耗时和逐 owner 计数。Chrome smoke 使用独立固定清单，不伪装成 Node unit；它覆盖页面装配、projection 隐私、人类 Action/Decision、Policy 输入与 save/recovery。

Chrome smoke 从 `window.SetiRandomizer.inspect().projection.resident.ui.browserReadModel.render`
读取页面渲染模型，与浏览器 app 使用同一读取路径；不得把旧 `resident.browserReadModel`
路径读到的空值误报为盘面或渲染缺失。盘面内容、隐藏信息隔离与真实 DOM 断言仍须分别核对。

历史测试迁移、逐文件删除清单和阶段数量不属于长期契约；需要追溯时使用 Git 历史，不在
当前文档中维护第二份流水账。
