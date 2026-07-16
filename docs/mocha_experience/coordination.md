# Coordination Experience

记录拆单、交接、review、owner 协作和留档收口的可复用经验。

## Entry Template

- date:
- source_issue:
- observation:
- evidence:
- promote_to:
- promotion_status:
- decision:

## 2026-07-17：大型拆分用结果硬门槛验收

- date: 2026-07-17
- source_issue: SETI-2
- observation: 大型单文件拆分不能以“模块已建立 + 测试通过”判定完成；父级验收需同时检查源文件职责拆账、原实现删除、净减行数目标，以及最终真实浏览器路径。
- evidence: owner 在 SETI-2 指出拆分后 `app.js` 仍约 2.9 万行；随后 SETI-23 至 SETI-27 采用分域净减行数与删除原函数体硬门槛，SETI-28 最终确认 `app.js` 29,573→9,930 行、模块均低于 3,000 行，并通过 Node 与 Chrome smoke。
- promote_to: none
- promotion_status: candidate
- decision: 先作为 coordination 候选经验保留；当前证据集中在一个大型重构父 issue，不立即升级通用 loop template。
