# SETI 流程回调删除矩阵（2026-07-28）

## 完成标准

- 规则层只执行一个标准动作及其直接产生的必选 Decision 链。
- 稳定边界后的下一标准动作只能由玩家输入或 Policy 发起。
- 开局初始化由 Production Composition 内显式 Effect owner 启动。
- 标准动作及 Decision 的后续效果只通过 `decisionEffect` / `spawnedEffects` 表达。
- Host 不得注入规则回调、Decision resolver 或事务 owner。
- 全仓代码、测试、文档、报告与文件名不再保留被废弃的英文术语。

## 设计矩阵

| 执行闭包 | 旧语义来源 | 唯一 owner | 正式 primitive | 状态 / Decision 归属 | 删除动作 | 行为证据 |
| --- | --- | --- | --- | --- | --- | --- |
| 标准动作打开必选选择 | Standard Action Session 的回调对象 | 对应 Production family executor | `decisionEffect`、`spawnedEffects` | Effect Session journal 与 DecisionEffect | 删除回调注册、检查、确定性执行和恢复入口 | 标准动作 session 单元测试覆盖多段必选选择 |
| Decision 提交后再打开 Decision | 回调对象重新检查 canonical state | 对应 choice executor | executor 返回新的 `decisionEffect` | 当前 Effect Session | Decision resolver 直接执行已注册 choice 并生成下一 Effect | 多段选择测试覆盖 choice → choice |
| 开局选牌 / 支付 / 收入 | drain 期间回调发现开局状态 | Production opening Effect domain | opening Effect、initial setup source、income DecisionEffect | Production Composition | 新建显式 opening owner，删除 drain 回调 | initial setup 与 full-flow |
| 快速交易的后续选择 | 条件 source 执行后回调重新检查 | Quick Trade source | `attachNextDecision` | Quick Trade Decision context | source 结果显式附加下一 DecisionEffect | quick trade 与 standard action composition 测试 |
| 反事实中的必选选择 | 规则组合器递归执行合法 Decision choice | Rule Composition counterfactual evaluator | save / fork / submitDecision | fork 内 Effect Session | 只保留当前动作产生的 Decision 闭包 | counterfactual 定向测试 |
| 稳定边界后的下一标准动作 | 战略实验在规则组合器中调用选路函数 | 无；该职责不属于规则层 | Policy 下一次标准输入 | Policy / Machine Player Host | 删除选择函数、排序函数和规则层扩展钩子 | 静态归零；策略测试只消费单动作 outcome |
| Host 自定义规则 | Host option 注入内部回调 | 无 | Production Composition 固定 owner | 构造期 fail-closed | 整体拒绝 `standardActionDomainOptions` | 构造期负向测试 |
| 历史术语与文件名 | 迁移矩阵、报告、记忆和测试描述 | 文档 owner | 当前 Effect / Decision 术语 | 不适用 | 改名或删除历史残留 | 全仓 `rg` 与文件名搜索归零 |

## 不可逆边界

- canonical state 只在 Effect Session commit 后替换。
- 反事实 fork 不得污染 canonical state、RNG、session、journal、history 或 replay。
- 删除旧路径后不保留兼容字段、别名、fallback 或 Host adapter。

## 验证账

- 静态：生产代码、测试、文档、报告和文件名全仓无旧英文术语；已通过。
- 行为：Standard Action Session、Production Composition、Rule Composition、Simulation 反事实定向测试；已通过。
- 回归：`node --check randomizer/app.js`、61 项 unit 与唯一 full-flow；已通过。
- 浏览器：运行环境未提供可用浏览器实例，本轮未取得真实 Chrome smoke 证据。
