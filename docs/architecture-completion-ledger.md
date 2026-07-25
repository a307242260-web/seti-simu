# SETI 新架构完成账本

本账本记录全仓新架构迁移的可核对证据。已知残留只是审计起点，不是验收白名单；后续发现的任何旧架构实现、适配器、兼容入口、重复 owner、死亡接线或过时资料都必须纳入同一个收口目标。

## 最终完成条件

1. 生产规则只在 Effect Session canonical working state 上运行，并且只由 StateStore 提交 committed state。
2. Browser、Simulation、训练和 Policy 共用同一 Action、Decision、Effect、状态与恢复协议。
3. Browser 只持有 ViewState、服务和 viewer-safe projection，不持有规则事实或规则流程。
4. 全仓不存在旧架构实现、适配器、旁路、兼容 fallback、重复 owner、死亡生产接线或维护旧结构的测试和文档。
5. Node 行为测试、唯一 full-flow、真实 Chrome 动态交互、保存恢复和 Browser/Simulation parity 均由真实行为证据证明。
6. 最终从生产代码、测试、工具、文档、HTML、CSS 和入口清单重新执行独立全仓审计，审计结论不是“未发现明显问题”，而是逐项证明上述义务成立。

## 可重复基线

运行：

```sh
node tools/report_architecture_residuals.js
```

该报告只负责持续量化已识别的残留族群，不单独构成完成证明。2026-07-25 的初始审计还确认：

- 生产 JavaScript 均可由 Browser script 或 Node 生产入口到达；“被加载”不能代替真实生产消费者证明。
- Standard Action registry 当前登记 22 个 family，Effect Session 当前登记 5 个 production domain。
- Node 当前 64/64 unit、1/1 full-flow 通过；Chrome smoke 当前 3/3 通过，但 smoke 中部分展示检查只验证静态容器或空 DTO 存在。
- `randomizer/app/dom.js` 的 160 个顶层 DOM key 中，有 131 个在生产 JavaScript 中没有静态消费者。

## 里程碑账本

| 里程碑 | 审计基线 | 完成证明 | 当前状态 |
|---|---|---|---|
| M1 canonical state | 长期旧 `workingState`、`stateAdapter/projectWorkingState`、旧 root slice 名和模块级序列仍在生产路径 | 规则 domain 直接消费 Session canonical state；上述设施物理删除；恢复、反事实与提交只操作同一 schema | 未完成 |
| M2 Session / ViewState | `pendingDecision`、`initialIncomeQueue`、card/tech UI selection、规则层 `statusNote` 仍存在 | 所有流程状态归 Effect Session Decision/queue；展示状态只归 Browser ViewState/Projection | 未完成 |
| M3 旧执行设施 | Action History、History Commands、Ability Chain、无消费者 readout、`actionEffectFlow` 仍被加载或导出 | 文件、script、import/export、调用、专属测试和文档接线全部删除 | 未完成 |
| M4 Browser 外延 | 多组 projection DTO 为空；大量旧 DOM/HTML/CSS 无生产消费者 | 真实盘面、数据、科技、外星人、卡牌、计分均由新 projection 动态呈现和输入；旧 UI 物理删除 | 未完成 |
| M5 验收与资料 | 当前 Chrome smoke 存在静态容器假阳性；当前文档仍描述已删除或尚未成立的边界 | 动态行为、恢复、parity 和负向 owner 证据成立；当前文档与代码一致；最终全仓审计通过 | 未完成 |

## 实施记录

### 2026-07-25：建立基线并删除第一批旧执行设施

- 新增可重复残留报告 `tools/report_architecture_residuals.js`；它是量化工具，不是完成门禁。
- 物理删除 `game/abilities/chain.js`、`game/history/action-history.js`、`game/history/commands.js` 及旧设施专属测试。
- 删除 Browser script、production kernel、abilities index 和 Node test inventory 中的全部生产接线。
- 删除规则结果中的 undo closure；Standard Action 的纯数据 `history` 现在进入 Effect Session journal，不再被旧兼容过滤器丢弃。
- 删除无意义的 `meta.sequences.historyStep`，并更新固定 full-flow checkpoint。
- `legacyExecutionFacilities` 从 16 处 / 10 文件下降到 1 处 / 1 文件；剩余项是 `actionEffectFlow`。
- 生产 JavaScript 从 118 个下降到 115 个；`legacyRootSlices` 从 1476 处 / 36 文件下降到 1399 处 / 35 文件，其中本轮下降来自旧 commands 实现删除，不代表 M1 已迁移。
- 完整回归通过：62/62 unit、1/1 full-flow、3/3 真实 Chrome smoke。

## 每轮更新格式

每轮实现后必须记录：

- 本轮触及的架构义务。
- 修改前残留数量、修改后残留数量及完整文件清单。
- 实际物理删除的文件、入口、字段、导出和调用。
- 新增的生产能力及其唯一 owner。
- 运行的行为验证、失败项和残余风险。
- 对应提交与推送状态。

不得用入口文件行数、提交数量、测试总数或“继续收口”等表述代替上述证据。
