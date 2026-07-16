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
- source_issue: SETI-26, SETI-28
- observation: 从大型闭包迁出 runtime 时，`node --check` 与模块级 Node 回归只能证明语法和已建模路径成立，不能证明显式 context、传统脚本初始化顺序和嵌套回调里的全部自由变量；至少要执行代表性 runtime 路径，并在改动脚本装配时补真实浏览器首屏 smoke。
- evidence: SETI-26 首轮语法检查通过后，科技选择路径暴露 `renderRunezuBoardSymbols` 未注入；SETI-28 两轮全量 Node 回归通过后，浏览器首屏仍连续暴露 runtime TDZ、漏导出和漏迁移 helper，修复后公开 API 155 个入口及“开始游戏”路径无异常。
- promote_to: none
- promotion_status: candidate
- decision: 保持 candidate，不修改 agent prompt 或 loop template；当前已累计两次同类迁移证据，等待第 3 次 runtime 拆分后按既定评估窗口复审。

- date: 2026-07-16
- source_issue: SETI-7
- observation: 对已经实现完成、验证完成且没有待 owner 拍板事项的 coding issue，如果 `reviewer` 仍指向自己，就不应走 `review_pass -> in_review`；这会制造伪 review 状态，增加额外追问成本。
- evidence: `checkpoint/mocha_issue_timeline/SETI-7.jsonl` 中 `review_pass` 把 issue 从 `in_progress` 置为 `in_review`，同时 `reviewer` 仍为 `13e5c469-264f-4a3c-837d-2cbc26bbba19`；随后成员在评论中追问“这个issue为什么没有自动置为done？”与“置为in-review，你是想谁来review说什么？”
- promote_to: issue_workflow
- promotion_status: candidate
- decision: 先作为流程候选经验记录；后续若再次出现“self-review 导致伪 in_review”的收口偏差，再考虑把 `done` 前置检查或 `review_pass` 约束升级到 issue-workflow。

- date: 2026-07-16
- source_issue: SETI-23, SETI-24, SETI-25
- observation: 在共享 dirty worktree 中重构与他人改动重叠的文件时，验证工作树通过并不能证明本次 staged 快照独立成立；提交前应同时检查 staged diff，并在需要时从 HEAD 构造仅含本次改动的快照验证，避免卷入他人改动或把其修复误算为本次交付。
- evidence: SETI-23 提交 `9414cc4` 通过临时 HEAD 快照隔离 effect 重构并识别工作树与 staged 验证差异；SETI-24 提交 `ff667a3` 再次从 HEAD 构造独立 staged 快照；SETI-25 在 `app.js` 与其他 agent 改动重叠时，以 HEAD 构造仅含本 issue 的 staged blob，并在临时 checkout-index 快照运行全量 tracked 测试。
- promote_to: agent_prompt
- promotion_status: promote
- decision: 三次连续重叠提交均证明 staged 独立验证能避免卷入他人改动或误用工作树修复，已达到预设评估窗口；将规则写入仓库根 `AGENTS.md`。
