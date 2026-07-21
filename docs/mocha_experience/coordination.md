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

## 2026-07-21：产品目标对齐先给可核对的现状，再讨论删改

- date: 2026-07-21
- source_issue: SETI-104
- observation: 当 owner 要对齐机器人等既有产品能力的首发目标时，先说明当前默认席位、难度、规则补强、特殊内容分配和普通策略偏好的边界，再提出删除或调参方案；不能让目标提案替代现状说明，也不能把规则资源补强与策略权重混成同一类“强度”。
- evidence: owner 在 SETI-104 评论 `53c760ac-6493-4699-b3d6-edd8807d3b0d` 先确认“浏览器默认机器人、稳定一个档位”，随后明确要求“先说明现在机器人的设定”，再处理移除强度补强和只保留非 DIY 公司。
- promote_to: none
- promotion_status: candidate
- decision: 当前只有一次产品对齐中的展示顺序反馈，先记录 candidate，不修改 issue-workflow、agent prompt、loop template、watcher 或项目记忆；后续 2 次同类产品目标对齐若仍要求先补现状，再评估是否并入 coordination loop template。

## 2026-07-21：skill 随附执行器必须给出可直接调用的解析入口

- date: 2026-07-21
- source_issue: owner 在 Codex 会话中连续反馈领航每轮都会先报“仓库内执行器路径不存在”，并纠正“不需要禁止搜索或播报，只要没有错误信息”
- observation: skill 正文把随附脚本写成 `scripts/issue_transition.py` 时，agent 会从业务仓库根解析，先产生必现的文件不存在，再定位 skill 挂载目录。修复点应是把入口改为当前 runtime 可直接调用的绝对路径；不应再叠加“禁止搜索/禁止播报”这类表现层 prompt 约束。
- evidence: SETI 远端 issue-workflow skill `6e816de3-7377-4f99-9a49-96473a47d039` 原正文全部使用仓库相对路径；本机 `/Users/bilibili/.codex/skills/issue-workflow/scripts/issue_transition.py` 存在且可执行。更新后一次性领航 run `83eebe43-ca25-4bc5-af10-12226e9dc619` 直接执行固定入口 `--help`，退出码 0、未发生路径探测。
- promote_to: issue_workflow
- promotion_status: promote
- decision: SETI 远端 skill 与领航职责行统一改为绝对入口；撤销额外的“不要搜索/不要播报”prompt，只从根因上消除错误路径。观察后续 10 个 issue run，若本机 skill 路径因安装位置变化失效，则改为平台提供的动态 skill-root 变量，而不是恢复仓库相对路径。

## 2026-07-19：架构总控建单前先做现有 issue 覆盖审计

- date: 2026-07-19
- source_issue: SETI-45
- observation: 从架构讨论进入实施总控前，应先按目标能力、接口依赖和当前状态盘点现有 issue；已有工作保留原父子结构并做覆盖映射。若缺口已由在途链路实施，应补跨链总契约、纠正 stale 依赖并跟进解锁，而不是重开讨论或新建重复总控；只有真实无人负责的缺口才建新项。
- evidence: owner 在 SETI-45 评论 `13e932c0-a1fc-4fb6-921d-de892147469a` 要求建总控前检查已推进工作，SETI-90 因此只补公共机器玩家契约并保留原层级；评论 `1d5c9b33-bb89-4dd2-a45a-5887ef8ea637` 进一步要求对已在推进的 GameRuntime/persistence 范围“落好文档，跟进推进”。本轮新增 `docs/game-runtime-persistence-contract.md`，未建新总控，并在核验显式前置后实际解锁 SETI-86、69。
- promote_to: none
- promotion_status: candidate
- decision: 已获得第 1 个独立后续证据：跨 SETI-62/71/72/90 的缺口通过总契约和依赖续跑收敛，没有重复建单。保持 coordination candidate，不修改 issue-workflow、watcher 或 agent prompt；再观察 1 个跨多条在途链路的架构总控或总契约任务后评估是否提升为 coordination loop template。

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
- source_issue: SETI-14, SETI-72
- observation: 父 issue 的阶段拆解只负责表达总体顺序；每次解锁 backlog 子 issue 时，仍需读取所有等待项的自身描述，并以其中声明的依赖为准。若描述与父级拆解冲突，应保持 backlog 并先确认，不能按父级摘要直接推进；若描述级依赖与另一条收口链互相等待形成环，确认解除后必须把依赖改写为单向契约，并同步父级 `waiting_on`、旧 `decision_needed` 和另一侧 blocker，不能只把状态强行改成 todo。
- evidence: SETI-16 完成后的系统线程 `4cf797c6-5827-407a-ad7e-ba7a5f1fb155` 与 SETI-15 完成后的线程 `ebfab6b9-5c59-446b-b52b-c1bfbf2f76ac` 均要求逐项核对；实际核对后先只解锁依赖 headless simulator 的 SETI-15，继续保留依赖 baseline/checkpoint 的 SETI-18，待 SETI-15 完成后才解锁 SETI-18。SETI-72 逐项核对 SETI-73～81 时发现 SETI-81 要求 SETI-71 最终接口稳定，而 SETI-71 的 SETI-88 又 `waiting_on=SETI-81`；先保持 SETI-81 backlog 并在评论 `be63881d-15c6-4c65-bae8-3b52879d1917` 请求确认，owner 在 `072d5334-f6d0-454b-a629-545f259a3d7c` 要求解除后，将 SETI-81 改为基于当前稳定公开接口开工、SETI-88 后置，并同步两侧 metadata。最终 SETI-81 完成 162/162 Node、inventory、Chrome 恢复/Decision/完整对局验收。
- promote_to: none
- promotion_status: candidate
- decision: 已累计两个含 backlog 依赖链的父 issue，且第二个补充了真实循环依赖的确认与单向改写证据；保持 coordination candidate，不修改 issue-workflow、watcher、loop template 或 agent prompt。再观察 1 个含多个 backlog 依赖项的父 issue 后，评估是否升级为 coordination loop template 或结构化依赖环检查。

## 2026-07-17：大型拆分与跨域重构用结果硬门槛验收

- date: 2026-07-17
- source_issue: SETI-2, SETI-56
- observation: 大型单文件拆分或跨域重构不能以“新模块/统一协议已建立 + 测试通过”判定完成；父级验收需同时检查职责拆账、原实现与重复入口删除、生产代码净增量，以及最终真实浏览器路径。若目标删除量未达到，必须逐项列出保留代码及真实 caller，不能机械追求行数或把真实业务规则误删。
- evidence: owner 在 SETI-2 指出拆分后 `app.js` 仍约 2.9 万行；随后 SETI-23 至 SETI-27 采用分域净减行数与删除原函数体硬门槛，SETI-28 最终确认 `app.js` 29,573→9,930 行、模块均低于 3,000 行，并通过 Node 与 Chrome smoke。SETI-56 首轮阶段 0～5 虽完成 22-family Standard Action 与 132/132 Node、Chrome 验证，但生产代码净增 992 行且仍保留 legacy executor/fallback；owner 在评论 `01e19754-d647-4082-94e4-692a8f556042` 明确要求清理后，追加 SETI-89，最终删除旧执行入口并使 legacy/bypass/public alias 生产引用归零、生产代码净减 133 行，同时对保留的真实 conditional 枚举给出 caller 说明。
- promote_to: none
- promotion_status: candidate
- decision: 继续作为 coordination 候选经验保留；SETI-56 是 SETI-2 后第一个独立跨域重构证据，验证了“新协议完成不等于旧入口清理完成”，但尚未达到原定两个后续重构的评估窗口，不升级通用 loop template。
