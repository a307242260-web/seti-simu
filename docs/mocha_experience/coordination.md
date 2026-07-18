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

## 2026-07-18：父级验收口径变更需同步覆盖全部子项

- date: 2026-07-18
- source_issue: SETI-30, SETI-33
- observation: owner 明确调整父级任务的验收口径时，应同步修改父 issue、全部已完成/进行中/待执行子 issue 的验收描述，并清理依赖被取消步骤的 blocker；仓库通用验证建议不能反向覆盖该父子任务的显式契约。
- evidence: SETI-33 因父级原“真实 Chrome smoke”要求被置为 blocked；owner 随后在评论 `ab028e00-f08d-4245-99cc-b9b46c17ab9f` 明确“代码要，但是不要真实环境验收的步骤了，包括父 issue 下的其他子 issue”，需要一次性同步 SETI-30 与 SETI-31 至 SETI-36，而非只改单个子 issue。
- promote_to: none
- promotion_status: candidate
- decision: 当前只有一个父子重构链的明确反馈，先记录为 coordination candidate；不修改仓库通用 runtime 验证规则，也不升级 issue-workflow，后续观察 2 个父级验收口径变更是否再次出现漏同步或陈旧 blocker。

## 2026-07-17：串行子 issue 按自身依赖逐项解锁

- date: 2026-07-17
- source_issue: SETI-14
- observation: 父 issue 的阶段拆解只负责表达总体顺序；每次解锁 backlog 子 issue 时，仍需读取所有等待项的自身描述，并以其中声明的依赖为准。若描述与父级拆解冲突，应保持 backlog 并先确认，不能按父级摘要直接推进。
- evidence: SETI-16 完成后的系统线程 `4cf797c6-5827-407a-ad7e-ba7a5f1fb155` 与 SETI-15 完成后的线程 `ebfab6b9-5c59-446b-b52b-c1bfbf2f76ac` 均要求逐项核对；实际核对后先只解锁依赖 headless simulator 的 SETI-15，继续保留依赖 baseline/checkpoint 的 SETI-18，待 SETI-15 完成后才解锁 SETI-18。
- promote_to: none
- promotion_status: candidate
- decision: 当前证据来自一个四阶段串行父 issue，先保留为 coordination 候选经验，不修改 issue-workflow；后续观察 3 个含 backlog 依赖链的父 issue。

## 2026-07-17：大型拆分用结果硬门槛验收

- date: 2026-07-17
- source_issue: SETI-2
- observation: 大型单文件拆分不能以“模块已建立 + 测试通过”判定完成；父级验收需同时检查源文件职责拆账、原实现删除、净减行数目标，以及最终真实浏览器路径。
- evidence: owner 在 SETI-2 指出拆分后 `app.js` 仍约 2.9 万行；随后 SETI-23 至 SETI-27 采用分域净减行数与删除原函数体硬门槛，SETI-28 最终确认 `app.js` 29,573→9,930 行、模块均低于 3,000 行，并通过 Node 与 Chrome smoke。
- promote_to: none
- promotion_status: candidate
- decision: 先作为 coordination 候选经验保留；当前证据集中在一个大型重构父 issue，不立即升级通用 loop template。
