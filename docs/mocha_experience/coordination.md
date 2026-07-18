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

## 2026-07-19：架构总控建单前先做现有 issue 覆盖审计

- date: 2026-07-19
- source_issue: SETI-45
- observation: 从架构讨论进入实施总控前，应先按目标能力、接口依赖和当前状态盘点现有 issue；已有工作保留原父子结构并在新总控中做覆盖映射，只对真实缺口新建子项，避免重开实现、强行 reparent 或让两个总控同时拥有同一热路径。
- evidence: owner 在 SETI-45 评论 `13e932c0-a1fc-4fb6-921d-de892147469a` 明确要求建总控时检查现有 issue，因为部分工作已经推进；实际审计确认 SETI-30、56、62/69、71/87、72/80、14/39/41 已分别覆盖启发式分层、标准组件、训练链与浏览器推理，SETI-90 因此只补公共机器玩家契约与缺口验收，并保留原有层级。
- promote_to: none
- promotion_status: candidate
- decision: 当前为一次 AI 架构总控拆单证据，先记录 coordination candidate，不修改 issue-workflow、watcher 或 agent prompt；后续观察 2 个跨多条在途链路的新总控建单，若仍能稳定减少重复 issue 和所有权冲突，再评估是否提升为 coordination loop template。

## 2026-07-18：跨父级 waiting_on 不会自动建立完成触发

- date: 2026-07-18
- source_issue: SETI-14, SETI-36
- observation: `waiting_on=<ISSUE>` 只是当前等待对象的结构化提示，不能替代父子关系、子 issue 完成通知或其他显式续跑触发；等待另一个父级下的 issue 时，必须在依赖完成后有可验证的 watcher/通知/轮询路径，否则依赖即使变成 done，等待 issue 也不会自动恢复。
- evidence: SETI-14 在 2026-07-18 12:20 前写入 `waiting_on=SETI-36`，但 SETI-36 的真实父 issue 是 SETI-30；SETI-36 于 12:20:52 收口后只触发其父级链路，SETI-14 直到成员评论 `d721a9d6-7a09-40a8-89a0-9189040f555a` 追问才恢复。
- promote_to: none
- promotion_status: candidate
- decision: 当前仅一次跨父级依赖漏续跑证据，先记录 coordination candidate，不直接修改 watcher 或 issue-workflow；后续观察 2 次跨父级等待，若复现则评估增加“waiting_on 已 done 但等待 issue 未恢复”的 watcher 提醒。

## 2026-07-18：父级验收口径变更需同步覆盖全部子项

- date: 2026-07-18
- source_issue: SETI-30, SETI-33
- observation: owner 明确调整父级任务的验收口径时，应同步修改父 issue、全部已完成/进行中/待执行子 issue 的验收描述，并通过 issue-workflow 一并清理依赖被取消步骤的 blocker 和 blocked 状态；仓库通用验证建议不能反向覆盖该父子任务的显式契约。
- evidence: SETI-33 因父级原“真实 Chrome smoke”要求被置为 blocked；owner 在评论 `ab028e00-f08d-4245-99cc-b9b46c17ab9f` 明确取消 SETI-30 全部子 issue 的真实环境验收后，首轮只更新描述和 blocker metadata、未同步 status，成员随即在 `9ff1c760-58b1-48a3-a31d-fd292e6d33bc` 追问“那为什么这个issue还在已阻塞？”。
- promote_to: none
- promotion_status: candidate
- decision: 当前只有一个父子重构链的明确反馈，先记录为 coordination candidate；既有 issue-workflow 已支持 start/done 并清理 stale blocker，本次直接按现有流程纠正，不修改仓库通用 runtime 验证规则或 workflow 组件，后续观察 2 个父级验收口径变更。

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
