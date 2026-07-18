# Coding Experience

记录 coding loop 中可复用的实现、调试、测试和提交经验。

## Entry Template

- date:
- source_issue:
- observation:
- evidence:
- promote_to:
- promotion_status:
- decision:

## Entries

- date: 2026-07-19
- source_issue: SETI-40
- observation: coding issue 已有明确验收门槛、`next_action` 且没有 owner 决策或新增权限需求时，阶段性提交与进度评论不能替代持续执行；agent 应直接续跑到门槛通过或出现真实 blocker。
- evidence: SETI-40 返工期间先后在评论 `c3aedb02-e789-4230-aeaa-85a7f30b9d56`、`b11be42c-6e15-42fa-9c81-c74a96ebe7a4`、`56c6e824-2497-4ebc-a7cc-e4dc8e61ff9a` 被成员追问为何停止；本轮无需新增确认即继续迁移剩余 conditional、切断两条 AI resolver fallback，并完成 uniform-random 100/100 terminal、0 失败、293 decisions/s 与全量 Node 回归。
- promote_to: none
- promotion_status: rejected
- decision: 现有 agent prompt 的 autonomy/persistence 与仓库 `AGENTS.md` 已明确要求在安全范围内持续推进，本次属于未遵守既有规则，不是缺少长期组件；保留复盘证据但不重复修改 prompt、loop template、watcher 或 issue-workflow。

- date: 2026-07-18
- source_issue: SETI-38, SETI-40
- observation: RL/checkpoint 恢复测试不能只覆盖 opening 或零 action 快照；至少应在真实 policy action 后比较 observation、legalActions、reward/replay cursor。常驻 runtime 可复用普通 episode，但跨 seed 后加载 checkpoint 应以 fresh runtime 按 journal 重放，避免传统全局模块闭包残留污染恢复结果。
- evidence: SETI-38 的非零 action checkpoint 首次暴露恢复后 legal action `choiceCount` 从 3 漂到 11；SETI-40 为提升吞吐复用 bundle 后，`reset(other_seed) -> load_checkpoint` 再次使 observation/board/RNG parity 大幅漂移。恢复分支强制 fresh bundle 后，IPC/direct observation、legalActions、reward、replay metadata 与全量 Node 回归通过，同时普通 episode 继续复用 runtime。
- promote_to: none
- promotion_status: candidate
- decision: 已在两个连续 RL issue 复现，保持 coding candidate；不修改 agent prompt、loop template、watcher 或 issue-workflow，再观察 1 个搜索/采样/checkpoint 任务后决定是否升级 coding loop。

- date: 2026-07-18
- source_issue: SETI-36
- observation: 通过 `REQUIRED_CONTEXT_KEYS` 声明窄 context 的 runtime，controller composition 不应静默过滤缺失键；应在创建 runtime 前 fail-fast 并列出缺项，否则漏接线只会在低频深层分支以 `undefined` 或 `ReferenceError` 暴露。
- evidence: SETI-36 将 `pickAiAppRuntimeContext` 从静默 `.filter()` 改为缺项校验后，controller characterization 立即暴露深空交换阈值未注入，固定 seed bootstrap 又暴露 `app.js` 未向 controller 传 `cancelCardTriggerChoice`；补齐后工作树与仅 staged 快照全量 tracked Node 回归均通过。
- promote_to: none
- promotion_status: candidate
- decision: 当前证据来自同一次 AI controller 总收口，先记录为 coding candidate；不修改 agent prompt、loop template、watcher 或 issue-workflow，后续 3 次显式 context runtime 装配观察是否复现。

- date: 2026-07-18
- source_issue: SETI-34
- observation: 在 zsh 中用 `tests=$(...)` 后直接 `for test in $tests` 不会按换行自动拆分文件列表，会把全部测试路径当成一个参数；全量 Node 回归应使用 `rg ... | while IFS= read -r test`（或 zsh 数组）逐文件执行。
- evidence: SETI-34 首轮全量命令把 100 余个 `.test.js` 路径拼成一个模块名并报 `MODULE_NOT_FOUND`；改为 `while IFS= read -r test` 后从 app、headless、game/ai、aliens 到 training 的全部测试逐个执行并以 exit 0 完成。
- promote_to: none
- promotion_status: candidate
- decision: 当前是一次 shell 驱动层证据，记录为 coding candidate，不修改 agent prompt、loop template 或 watcher；后续 3 次 zsh 全量回归观察是否复现或是否值得收口成仓库脚本。

- date: 2026-07-18
- source_issue: SETI-31
- observation: 对刻意不改生产行为的 characterization / Stage 0 交付，收口摘要应先说明“本阶段不会产生页面或玩法变化”，再用新增护栏、可拦截的回归类型和后续迁移用途解释价值；只列测试文件、行数和通过项，容易让 reviewer 误以为没有实际产出。
- evidence: SETI-31 首次交付摘要以新增契约测试、固定 seed 基线和验证结果为主后，成员追问“看起来基本没变哇，实际你做了啥？”；补充说明本阶段硬边界、400 行新增/112 行迁移及后续能阻断的 API/schema/owner 漂移后，成员回复“那就收”。
- promote_to: none
- promotion_status: candidate
- decision: 当前只有一次 Stage 0 沟通反馈，记录为 coding candidate，不修改 agent prompt、loop template 或 issue-workflow；后续 3 个“行为不变但增加迁移护栏”的交付中观察是否仍需同类澄清。

- date: 2026-07-17
- source_issue: SETI-18
- observation: 预计运行超过数分钟的固定 seed 评测，应在每局结束时输出 `completed/total`、seed、终局、阻塞和步数；只在整批结束后输出会把正常高 CPU 运行误判为死锁，也无法定位慢 seed。
- evidence: SETI-18 首次 20 局 baseline 运行 14 分钟无输出后被中止；补充逐局进度后，单局确认约 48 秒、32 步终局，完整 20 局随后全部完成并生成固定报告。
- promote_to: none
- promotion_status: candidate
- decision: 进度输出已在本 issue 的评测 CLI 内实现，但目前只有一次长批次证据；记录为 coding candidate，不升级 agent prompt、loop template 或 watcher，待后续不同 checkpoint 的长评测复验。

- date: 2026-07-17
- source_issue: SETI-16
- observation: headless simulator 的完成标准应区分“规则/决策可在 Node 中直接推进”和“用宿主 shim 把浏览器 composition root 跑起来”；后者可用于迁移期定位，但不应继续靠补 DOM 行为扩张，最终边界应是 runtime composition + 可注入 no-op view adapter。
- evidence: SETI-16 owner 明确拒绝 fake DOM 并要求完成拆分；随后 `headless-env.js` 删除 400 余行 fake window/document/element，composition 注入 `view-adapter.js`，完整 4 人局、终局分摘要和 replay 在全局无 `document` 条件下通过，工作树与 staged 独立快照全量回归通过。
- promote_to: none
- promotion_status: candidate
- decision: no-op view adapter 已验证能取代宿主 shim，但真实浏览器烟测因浏览器控制通道环境错误未能执行；保持 candidate，不升级 agent prompt 或 loop template，待补一次 browser/headless parity 后复审。

- date: 2026-07-17
- source_issue: SETI-27
- observation: 通过 `issue_transition.py` 写入包含 shell 变量的 `verification_command` 时，若命令参数由外层双引号包裹，`$test` 会在写 metadata 前被当前 shell 展开，造成记录与实际验证命令不一致；应使用能保留字面量的引用方式，并在收口前核对 metadata。
- evidence: SETI-27 的第二次 `start` timeline 将预期的 `node "$test"` 记录成 `node ""`，而实际工作树与 staged 快照全量回归均使用了正确循环命令并通过。
- promote_to: none
- promotion_status: candidate
- decision: 记录为 coding 流程候选经验；当前仅一次命令引用失真，不修改 issue-workflow 或 agent prompt，等待后续同类 metadata 写入是否复现。

- date: 2026-07-17
- source_issue: SETI-26, SETI-28, SETI-32
- observation: 从大型闭包迁出 runtime 时，`node --check` 与模块级 Node 回归只能证明语法和已建模路径成立，不能证明显式 context、传统脚本初始化顺序和嵌套回调里的全部自由变量；至少要执行代表性 runtime 路径，并在改动脚本装配时补真实浏览器首屏 smoke。
- evidence: SETI-26 首轮语法检查通过后，科技选择路径暴露 `renderRunezuBoardSymbols` 未注入；SETI-28 两轮全量 Node 回归通过后，浏览器首屏仍连续暴露 runtime TDZ、漏导出和漏迁移 helper；SETI-32 首轮 Stage 0 契约发现 `applyAiDifficultyToPlayer` 漏注入，补领域测试后全量 Node 与真实 Chrome smoke 通过。
- promote_to: loop_template
- promotion_status: promote
- decision: 三次 app runtime 拆分均证明语法检查不足以覆盖显式 context、嵌套回调与传统脚本装配；已将“领域代表路径 + 全量 Node + Chrome smoke”写入仓库根 `AGENTS.md` 的 coding 规则。

- date: 2026-07-18
- source_issue: SETI-7, SETI-32, SETI-30
- observation: 对已经实现完成、验收通过且没有待 owner 拍板事项的 coding issue，应直接收口为 `done`；不得把自己设为 reviewer，也不得以“等待明确收口指令”为由继续停在 `in_progress`。
- evidence: SETI-7 因 self-review 未自动 done；SETI-32 因不必要的 owner review 停留；SETI-30 的全部子 issue 与父级验收均完成后仍保持 `in_progress`，成员再次追问状态与结论。
- promote_to: agent_prompt
- promotion_status: promote
- decision: 已达到既定 3 次评估窗口；将直接 done 的收口前置检查写入仓库根 `AGENTS.md`，后续没有真实 reviewer/owner 决策时不再制造伪等待状态。

- date: 2026-07-16
- source_issue: SETI-23, SETI-24, SETI-25
- observation: 在共享 dirty worktree 中重构与他人改动重叠的文件时，验证工作树通过并不能证明本次 staged 快照独立成立；提交前应同时检查 staged diff，并在需要时从 HEAD 构造仅含本次改动的快照验证，避免卷入他人改动或把其修复误算为本次交付。
- evidence: SETI-23 提交 `9414cc4` 通过临时 HEAD 快照隔离 effect 重构并识别工作树与 staged 验证差异；SETI-24 提交 `ff667a3` 再次从 HEAD 构造独立 staged 快照；SETI-25 在 `app.js` 与其他 agent 改动重叠时，以 HEAD 构造仅含本 issue 的 staged blob，并在临时 checkout-index 快照运行全量 tracked 测试。
- promote_to: agent_prompt
- promotion_status: promote
- decision: 三次连续重叠提交均证明 staged 独立验证能避免卷入他人改动或误用工作树修复，已达到预设评估窗口；将规则写入仓库根 `AGENTS.md`。
