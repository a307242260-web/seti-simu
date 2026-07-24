# SETI 浏览器原型

这是一个无构建步骤的 SETI 浏览器原型。页面入口是 `randomizer/index.html`，Browser Host
位于 `randomizer/app/**`，装配根是 `randomizer/app.js`，唯一规则与状态 owner 位于
`randomizer/game/**`。

## 快速开始

用本地静态服务器打开仓库根目录，再访问 `randomizer/index.html`。页面支持人类与机器席位、
保存恢复、行动日志和调试入口。

## 架构入口

- `AGENTS.md`：仓库导航、工作约定与常用验证。
- `docs/project-architecture.md`：Browser、Simulation、Production Composition 与状态依赖方向。
- `docs/app-architecture.md`：Browser Host 的职责和禁止边界。
- `docs/mechanics-reference.md`：玩法机制参考。
- `docs/standard-action-contract.md`：玩家与机器席位共用的 Action 协议。
- `docs/effect-session-runtime.md`：Effect、Decision、事务与 replay 协议。
- `docs/ai-design.md`：机器玩家与启发式策略设计。

## 验证

```bash
node --check randomizer/app.js
node tools/run_node_tests.js
node tools/run_browser_smokes.js
```

Node 测试的分类与准入规则见 `docs/node-testing.md`。Chrome smoke 仅在涉及 Browser composition、
真实页面输入或恢复链时运行。
