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

- date: 2026-07-21
- source_issue: SETI-124 runs `627968ce-3dbf-4f24-ab3b-2f6724adf9df`、`f0b69138-48a4-48bd-b5f0-c3db2eb87dde`
- observation: 对超出单次 Codex run 可用上下文的 coding issue，“不得阶段性停工”的 agent prompt 只能约束表述，不能保证执行连续性。大量重复读取 skill、完整评论、文档和宽搜索会先耗尽单次 run 预算；模型随后会把干净 checkpoint、metadata、评论和 fast closeout 解释成合法退出点。issue 仍为 `in_progress` 且有可执行 `next_action` 时，续跑应由编排层显式保证，不能依赖模型在同一 run 中无限坚持，也不能靠定时轮询反复空查。
- evidence: prompt 已明确“阶段性产出不构成停止条件”，但 run `f0b69138-48a4-48bd-b5f0-c3db2eb87dde` 仍在约 16 分钟、162 条事件后主动完成；期间读取完整 workflow/评论并产生一次约 8 万 token 的截断输出，提交 `38dcaad`、`72c9eb7` 后明知真实 `app.js`、旧 authority、长期 slices 和 Decision 旁路未迁移，仍执行 metadata、issue 评论和 fast closeout。Mocha 返回 `status=completed, error=null`，证明不是网络、超时或代码阻塞；issue 保持 `in_progress` 后不会自动续跑，需外部 `rerun`。
- promote_to: issue_workflow
- promotion_status: candidate
- decision: 不再继续堆叠领航 prompt。候选方案是把“run completed + issue=in_progress + next_action 非空 + 无 blocker/review/owner 决策”定义为结构化续跑信号，由事件驱动编排立即创建下一 run；中间 run 只保留短 checkpoint，不执行 harness closeout 或长评论，新 run 优先读取 checkpoint/diff 而非完整历史。SETI-124 完成前仅记录候选，不修改 watcher 或 issue-workflow；以本 issue 后续 run 的完成耗时、重复读取量和人工 rerun 次数决定是否 promotion。

- date: 2026-07-21
- source_issue: SETI-124（续 SETI-40/72/88）
- observation: “队长负责复杂任务拆分”不能覆盖 coding issue 的直接实现职责。已冻结范围且下一步可在本机执行时，领航不得用只读审计、口头分组、阶段性门禁或局部小提交替代主实现；只有父级 coordination issue、owner 明确要求或真实独立工作面才允许拆子 issue。声称并行审计必须有真实派工记录，未完成且无 blocker 时不得主动结束 run。
- evidence: SETI-124 run `bc7a12a7-d9ba-4f10-91f8-eca98ee0a60b` 明确说“按队长职责”拆成三组并行只读审计，但完整日志只有 34 次 exec 和 3 次 patch，没有任何派工调用；运行约 70 分钟后仅提交 `2f770ce` 的 1 行生产门禁与 10 行测试，15 个顶层 family、7 个 conditional family、Browser 长期 slices、旧 authority、保存恢复和 AI 旁路均未实施，run 却主动完成并把 issue 留在 in_progress。owner 随后明确要求修改领航 instruction 并重启任务。
- promote_to: agent_prompt
- promotion_status: promote
- decision: 修订领航远端 instruction：拆单仅适用于父级协调或明确授权；coding issue 默认亲自连续实现；禁止无真实派工的“并行审计”表述；局部门禁、盘点和阶段性提交不构成完成或停止条件；有可执行 next_action 且无真实 blocker 时不得主动结束 run。首轮重启又发现 SETI-123 父级准备与活跃 SETI-124 child 并发实现同一主链，补充“活跃 child 期间父级只协调/验收，结构化 handoff 后方可接管”。

- date: 2026-07-21
- source_issue: SETI-104
- observation: 产品级机器人验收不能引用 PASS-first、first-legal 之类刻意绕开策略决策的终局基线；这类测试即使稳定终局、分数和 trace，也只证明最弱状态推进没有崩，不能证明机器人行为、强度或档位。若仓库已有真实 Policy 固定回归，应删除重复的伪 smoke，并只把真实 Policy、多 seed 分布和浏览器完整局作为机器人证据。
- evidence: owner 在评论 `f2ab213b-167f-44fe-a1ff-fdc477150351` 追问该 smoke 能验证什么，并在 `088d91da-fa05-444e-a97b-67edfe96a346` 明确指出“优先pass的话，这个smoke完全无意义”；审计确认旧测试始终优先 PASS/结束回合。删除后复跑真实 Policy 基线立即暴露“未来跨度研究所”在无目标牌时仍被 Standard Action 枚举，导致 `industry` 连续 1957 次、2000 步不终局；补齐纯 legality 后真实 Policy 306 步终局，并实际覆盖打牌、科技、扫描、分析、移动、环绕和登陆。
- promote_to: none
- promotion_status: candidate
- decision: 删除 PASS-first 测试及 JSON，迁移文档统一指向真实 Heuristic Policy 固定回归，并修复普通公司 1x 的可执行性枚举；真实 Policy 基线只作为确定性行为回归，不作为强度验收。当前作为一次 owner 反馈记录 candidate，不修改 agent prompt、watcher、issue-workflow 或项目记忆。后续再出现将非策略终局测试误报为机器人质量证据时，评估升级 proof obligation 的证据命名/口径门禁。

- date: 2026-07-19
- source_issue: SETI-39
- observation: 冻结评测的 `maxSteps` 必须与当前 policy-owned decision 粒度一致；在 conditional 也成为独立 timestep 后，不能只把 PyTorch checkpoint 接入同一 seed/分数统计而忽略旧上限，否则会把超步后的终局分误计为合格样本。协议上限若已无法覆盖正常完整局，应发布新 protocol id，不能在适配器里静默放宽旧协议。
- evidence: `stable-200-v1` 固定 `maxSteps=100`；SETI-39 的 BC-only PyTorch checkpoint 在完整 20 个冻结 seed 上每局需要 307–377 个 `turn_action`（另有 conditional timestep），20/20 均超过上限。严格报告因此为 completionRate=0、blockRate=1、scoreCount=0；仅作诊断的超步终局 80 席均分约 57，不能纳入验收。
- promote_to: project_memory
- promotion_status: promote
- decision: 全量证据形成后，同 issue 并行交付 `01bc567` 已发布不可变的 `stable-200-v2`，沿用 20 seed/80 席与得分门槛，只把 policy 决策上限提升到 1000；PyTorch `evaluate` 默认同步到 v2，v1 及其历史 baseline 保持不变。

- date: 2026-07-19
- source_issue: SETI-76（续 SETI-51/61/69/85）
- observation: 私有 `GIT_INDEX_FILE` 即使从当时最新 HEAD 初始化，也会在长回归期间因并行提交而变成旧父树；随后直接 `git commit` 会以新的 HEAD 为 parent、却提交旧父树派生的 tree，把新父提交文件误显示为当前 issue 的删除/回滚。提交前必须再次比较 private-index base 与当前 HEAD；不一致就重建并复验，最终 ref 更新宜使用 old-HEAD compare-and-swap，失败后重新集成，不能继续提交旧 tree。
- evidence: SETI-76 验证期间 HEAD 连续从 `3eb447f` 前进到 `d66348d`、`a7052f0`、`d3c2ac7`；私有 index 最后一次基于 `a7052f0`，普通 commit `c7921a6` 却挂到 `d3c2ac7`，意外把 SETI-39 的 24 行 `app.js` 变更回退。提交后 name-only/stat 立即发现，追加 CAS 修复 `2bc8307` 精确恢复父 blob；最终从 `d3c2ac7..2bc8307` 的净 diff 只剩 SETI-76 九个目标文件，158/158 Node 与 Chrome smoke 通过。
- promote_to: none
- promotion_status: candidate
- decision: 这是已 promote 私有 index 规则仍缺少的 parent-CAS 原子性，但当前只有一次“验证期间 HEAD 前进后旧 tree 挂新 parent”的直接证据；先记录候选，不立即修改 AGENTS、git-workflow、watcher 或 issue-workflow。后续 2 次高并发私有 index 提交验证 CAS/重建方案后再决定是否升级。

- date: 2026-07-19
- source_issue: SETI-51, SETI-61, SETI-85, SETI-69
- observation: 共享工作树的 index 在 staged 检查、独立快照验证与 commit 之间仍会被并行任务改写；高并发提交必须从最新 HEAD 创建私有 `GIT_INDEX_FILE`，且初始化与后续每条 index 命令都要在同一 shell segment 显式携带该变量，只装入本 issue 的明确 blob并在 commit 后核对实际文件清单。裸跑 `git read-tree HEAD` 会立即覆盖共享 staged 状态，不能靠下一条命令再补变量。
- evidence: SETI-51 曾把其他任务文件套入当前 message；SETI-61 的目标 hunk 在并行 commit 后从实际提交消失；SETI-85 中已暂存目标被并行提交消费；SETI-69 首次初始化时漏传 `GIT_INDEX_FILE`，共享 staged 状态被清空，随后依据操作前 status、可恢复 blob 与明确路径恢复，并用正确私有 index 提交 `f318d52`，实际文件清单仅含本 issue 的 8 个目标文件。
- promote_to: agent_prompt
- promotion_status: promote
- decision: 既有规则已升级，但 SETI-69 暴露命令级防误用缺口；修订仓库根 `AGENTS.md`，明确禁止裸跑 `read-tree` 并要求每条命令原子携带私有 index 变量，不修改 watcher、issue-workflow 或 project memory。

- date: 2026-07-19
- source_issue: SETI-51, SETI-52
- observation: 私有 `GIT_INDEX_FILE` 能隔离并行 staging，但更新既有文件时不能统一硬编码 `100644`；必须从当前 HEAD tree 继承每个路径的 mode，否则脚本内容与测试全绿仍可能把可执行 CLI 静默降权。新文件才按交付类型显式选择 `100644/100755`。
- evidence: SETI-51 用私有 index 成功避免内容错配；SETI-52 首次隔离提交将原为 `100755` 的 `tools/benchmark_rl_workers.js` 与 `tools/rl_worker_client.py` 写成 `100644`，`git show --stat` 明确显示 mode change。后续从 HEAD blob 恢复 `100755` 并以提交 `33a0ddc` 修正，未改写历史。
- promote_to: none
- promotion_status: candidate
- decision: 修订 SETI-51 的共享 index 竞态候选，补充“继承 tree mode”前置检查；再观察后续 2 次含可执行文件的私有 index 提交，不修改 git-workflow、agent prompt、loop template 或 watcher。

- date: 2026-07-19
- source_issue: SETI-36, SETI-48
- observation: 显式 runtime context 中的 `null` 可以表示“此宿主刻意禁用该依赖”，不能用 `context.document || root.document` 把它误判为缺项；可选宿主依赖应仅在 `undefined` 时回退，并用会计数且抛错的 poison getter 覆盖 reset/step/replay/checkpoint/dispose，证明没有隐式读取浏览器全局。
- evidence: SETI-36 的 `REQUIRED_CONTEXT_KEYS` fail-fast 已证明 composition 需要区分漏注入与显式可选值；SETI-48 在 app 明确传入 `document: null` 后，final-ui、action-briefing、alien-ui、debug-runtime、bootstrap 五处 `|| root.document` 仍读取 poison getter。改为仅 `undefined` 回退后，document/localStorage/Image/requestAnimationFrame/getComputedStyle/alert/confirm/prompt 在全路径访问计数均为 0，独立 HEAD 全量测试通过。
- promote_to: none
- promotion_status: candidate
- decision: 已有两类显式 context 证据，但静态类型或统一依赖容器可能提供更轻的长期约束；保持 candidate，再观察 1 个 null sentinel/宿主依赖迁移 issue，不修改 agent prompt、loop template、watcher 或 issue-workflow。

- date: 2026-07-19
- source_issue: SETI-51
- observation: 共享工作树中即使 `git diff --cached` 在提交前检查时干净，其他并行任务仍可能在检查后、`git commit` 前替换共享 index，导致提交内容与 issue、message 错配；高并发提交应从当前 HEAD 创建私有 `GIT_INDEX_FILE`，只写入本 issue 的明确 blob，复核私有 staged diff 后再 commit，并在完成后只同步共享 index 中自己的路径。
- evidence: SETI-51 首次提交前已确认目标文件与 staged 内容，但并行任务在提交窗口写入 `docs/standard-action-contract.md`、`randomizer/game/actions/standard-action.js` 及其测试，最终 `19a0e1c` 被错误套用 SETI-51 message；随后从最新 HEAD 构造私有 index，只加入 `headless-env.js` 与 `headless-effect-failure.test.js` 的目标 blob，提交 `de934d2` 内容、message 与独立快照验证一致，同时保留共享工作树其余改动。
- promote_to: none
- promotion_status: candidate
- decision: 这是既有“验证 staged 独立快照”规则未覆盖的提交瞬时竞态，但当前仅一次证据；先记录私有 index 实践，不修改 git-workflow、agent prompt、loop template 或 watcher，观察后续 3 次并行共享 index 提交。

- date: 2026-07-19
- source_issue: SETI-40, SETI-88, SETI-72
- observation: coding issue 已有明确验收门槛、`next_action` 且没有 owner 决策或新增权限需求时，阶段性提交与进度评论不能替代持续执行；若验收由可递减债务计数定义，正数本身就是继续条件。批量迁移应按同域/同所有权形成可审计批次，批内跑定向证据、批末跑全量门禁，直到计数归零或出现有日志证据的真实 blocker。
- evidence: SETI-40 返工期间先后在三条评论中被成员追问为何停止；SETI-88 在 `waiting_on=SETI-81` 已完成后仍保留 stale blocked，成员通过评论 `c82de376-9696-4ae7-8744-ae53c790c07c`、`b9823496-fa37-4f02-a91c-34b5218ef012` 连续要求说明并继续。SETI-72 又在 SETI-88 已 done 后保留 stale waiting；本次 owner 评论 `d68ef992-4d2c-4677-a29a-d5d8f1141cf6` 明确指出 32 项 dated adapter 时迁 2 项即停不合格，并指定同域 6～8 项批次。随后连续提交 `47687e0`、`96c2533`、`82679e6`、`71d9091`、`5c02439`，dated adapter 从 32 归零；owner 后续进一步要求删除剩余 host-only 白名单与旧容器。
- promote_to: none
- promotion_status: rejected
- decision: 现有 agent prompt 的 autonomy/persistence 与仓库 `AGENTS.md` 已明确要求在安全范围内持续推进；SETI-72 再次属于同一 agent 未遵守既有规则，而不是缺少长期组件。owner 给出的 6～8 项是本次迁移的执行粒度，不泛化为所有 coding issue 的固定批量。维持 reject，不重复修改 prompt、loop template、watcher 或 issue-workflow；若后续不同 agent 也复现，再评估机械提醒。

- date: 2026-07-19
- source_issue: SETI-72
- observation: 迁移债务计数归零不等于旧架构已删除；若过渡 registry/schema/audit 只剩“合法 host-only”豁免项，应先把这些状态迁入正式 owner store，再整体删除过渡基础设施。不能为了保留可接受的业务状态而继续保留旧容器和字段白名单。
- evidence: SETI-72 先以 `total=2 / hostOnly=2 / datedAdapters=0` 汇报完成，随后 owner 在评论 `500867a4-646e-4023-bded-a5ac2934514a`、`cbb70177-bc6a-4e46-9cfb-61bdfe2d97d3` 连续追问两项为何存在，并在 `6e6c07cf-7c63-4c20-a5b3-540d4a197bbe` 明确要求老代码全部清理。最终将 overlay dismiss 与扫描序号迁入 `runtime.ui` / `runtime.browserHost`，删除旧 inventory、audit、HTML 接线和 runtime pending 创建入口。
- promote_to: loop_template
- promotion_status: promote
- decision: 该反馈直接修正跨模块迁移的通用完成判据，且与既有“旧路径调用为 0”义务互补；已在 `docs/implementation-proof-obligations.md` 的最小 review checklist 增加“债务归零后删除过渡基础设施”门禁，不修改 watcher、issue-workflow、agent prompt 或 project memory。

- date: 2026-07-19
- source_issue: SETI-38, SETI-40, SETI-44
- observation: RL/checkpoint 恢复测试不能只覆盖 opening 或零 action 快照；至少应在真实 policy action 后比较 observation、legalActions、reward/replay cursor。常驻 runtime 的 episode 隔离还必须分别验证 fresh A/fresh A、同实例 A/A 与同实例 A/B/A；fresh env 可复现不能证明复用实例的模块级状态、RNG、id counter 和 cache 已被 reset 清空。
- evidence: SETI-38 的非零 action checkpoint 首次暴露恢复后 legal action `choiceCount` 从 3 漂到 11；SETI-40 的 `reset(other_seed) -> load_checkpoint` 使 observation/board/RNG parity 大幅漂移；SETI-44 中 fresh env 的 `seti44-repeat` digest 两次均为 `10c293...33b`，但同一 env 第一次/第二次 reset 分别为 `10c293...33b` 与 `774a79...8a7f`，A/B/A 还漂移牌、轮盘、火箭、痕迹和 choiceCount。
- promote_to: loop_template
- promotion_status: promote
- decision: 三个连续 RL issue 已覆盖非零 checkpoint、跨 seed 恢复与同实例 episode reset 三类污染；达到既定第三次评估窗口，将 fresh/复用实例隔离矩阵写入 `docs/implementation-proof-obligations.md`，不修改 watcher、issue-workflow、agent prompt 或 project memory。

- date: 2026-07-18
- source_issue: SETI-36
- observation: 通过 `REQUIRED_CONTEXT_KEYS` 声明窄 context 的 runtime，controller composition 不应静默过滤缺失键；应在创建 runtime 前 fail-fast 并列出缺项，否则漏接线只会在低频深层分支以 `undefined` 或 `ReferenceError` 暴露。
- evidence: SETI-36 将 `pickAiAppRuntimeContext` 从静默 `.filter()` 改为缺项校验后，controller characterization 立即暴露深空交换阈值未注入，固定 seed bootstrap 又暴露 `app.js` 未向 controller 传 `cancelCardTriggerChoice`；补齐后工作树与仅 staged 快照全量 tracked Node 回归均通过。
- promote_to: none
- promotion_status: candidate
- decision: 当前证据来自同一次 AI controller 总收口，先记录为 coding candidate；不修改 agent prompt、loop template、watcher 或 issue-workflow，后续 3 次显式 context runtime 装配观察是否复现。

- date: 2026-07-18
- source_issue: SETI-34, SETI-86, SETI-70
- observation: 在 zsh 中手写命令替换/数组循环容易把全部测试路径拼成一个参数，或像 SETI-70 首轮那样得到空数组却输出 `total=0`；全量 Node 回归应统一由跨 shell runner 逐文件执行并输出非零总数汇总。
- evidence: SETI-34 将 100 余个路径拼成单个 `MODULE_NOT_FOUND` 参数；SETI-86 对 143 个路径复现；SETI-70 首轮 zsh 数组写法未执行任何测试并输出 `passed=0 failed=0 total=0`，改用逐行循环后实际发现 148 项及既有 baseline 失败。三次独立 issue 达到预设升级窗口。
- promote_to: loop_template
- promotion_status: promote
- decision: 新增 `tools/run_node_tests.js`，并把根 `AGENTS.md` 默认全量验证切换到该 runner；保留 `--list/--match/--exclude`，不修改 watcher 或 issue-workflow。

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

- date: 2026-07-19
- source_issue: SETI-16, SETI-60
- observation: 当 in-app Browser 因运行环境缺少 sandbox 元数据而无法建立控制通道时，非交互式本地页面验收可在明确报告通道故障后，使用隔离 HEAD 快照、本地静态服务与系统 headless Chrome 继续验证真实脚本装配和公开 API；该兜底不能替代需要视觉或交互定位的 browser 测试。
- evidence: SETI-16 因同类 browser 控制通道故障未能执行真实页面 smoke；SETI-60 再次遇到 `sandboxPolicy` 元数据缺失后，在仅含提交内容的隔离快照启动本地服务，以系统 Chrome `--headless=new --dump-dom` 验证首屏标题、七类 conditional family、公开枚举/执行 API 和空 pending 返回，结果 `ok=true`，同时 129/129 Node 回归通过。
- promote_to: none
- promotion_status: candidate
- decision: 当前只有一次成功兜底证据，且 headless Chrome 不覆盖视觉交互；记录为 coding candidate，不修改 browser skill、agent prompt、loop template、issue-workflow 或 watcher，后续 3 次同类通道故障观察兜底稳定性。

- date: 2026-07-19
- source_issue: SETI-61（续 SETI-51）
- observation: SETI-51 记录的共享 index 提交瞬时竞态再次复现：即使独立 staged 快照全量通过，commit 前的并行提交仍可能让已 staged 的目标 hunk 消失；提交后必须立即以 `git show --name-only/--stat` 对照预期文件清单，且高并发窗口优先使用私有 index 或平台提交锁。
- evidence: SETI-61 的 staged 独立快照为 0 失败，但并行提交发生后首个提交 `32813e3` 未包含目标 `randomizer/app/headless-env.js`；提交后立即核对发现缺口，以 `17df650` 追加该 hunk，最新 HEAD + 本 issue staged 快照再次全量 0 失败，未回滚其他 agent 改动。
- promote_to: none
- promotion_status: candidate
- decision: 与 SETI-51 合计两次独立证据，仍未达到三次升级窗口；保留 candidate，下一次复现时评估升级 git-workflow、agent prompt 或平台级隔离。

- date: 2026-07-19
- source_issue: SETI-92
- observation: 当 owner 明确放宽迁移的行为等价性证明义务时，应立即停止追逐已失效的旧 trace parity，并把验收改写为仍然有效的架构边界、合法性、完整流程与迁移后冻结基线；新基线必须记录版本、配置、seed、轨迹摘要和水平下限，不能只删除旧断言。
- evidence: SETI-92 原要求固定 seed 旧 teacher 456 步与新 Policy trace/state/score parity；owner 评论 `5462c1ea-06ea-4024-8bb7-264d2f3f8602` 明确表示行为和分数变化无所谓、继续正常迁移。随后停止补旧状态投影，冻结公共 Heuristic Policy 的 460 步、`[61,69,36,29]`、trace `57e126dd…` 迁移后基线，并保留 legal-only、无 executor/pending/scheduler、浏览器接线、完整 Node 与 Chrome 对局门禁。
- promote_to: none
- promotion_status: candidate
- decision: 当前只有一次 owner 主动放宽 proof obligation 的直接证据；记录候选，不修改 agent prompt、loop template、watcher、issue-workflow 或项目记忆。后续 2 次迁移任务出现同类验收口径调整时，再评估是否形成通用规则。

- date: 2026-07-21
- source_issue: SETI-95
- observation: 训练流水线具备可执行入口、已有 checkpoint 或能恢复 dataset，不等于训练架构已经具备开工条件；当模型/数据/环境/评测/部署的职责边界与启动门槛尚未被 owner 接受时，应立即停止算力任务并以 `blocked_owner` 保留证据和恢复条件，不能用“先跑起来再看”替代架构澄清。
- evidence: SETI-95 已完成一次 10 episode 阶段评测并交付 `6a6ce36`，随后因旧 next_action 不合理恢复 dataset 生成；owner 评论 `509d2494-623b-415d-aaa1-acd09204bfe1` 明确指出当前训练架构不清晰、要求先 block 且不要开始。生成任务在 20/32 时停止，issue 通过 `blocked_owner` 写明重启条件，不自动续跑 partial。
- promote_to: none
- promotion_status: candidate
- decision: 这是一次明确的 owner 架构启动门槛反馈，但尚不足以修改 agent prompt、loop template、watcher、issue-workflow 或项目记忆；先保留 candidate，后续 2 个涉及高成本训练/数据生成的 issue 观察是否同样需要“架构契约先于可执行流水线”的门禁。
- date: 2026-07-21
- source_issue: SETI-106, SETI-110
- observation: 架构迁移审计若只扫描已知禁用字符串，会把接口改名误判为语义完成；唯一 owner、禁止直接写、projection/recovery/persistence 数据流和未知 fallback 必须转换为结构规则、接口 poison、运行时 commit trace 与可失败的负向 fixture。
- evidence: SETI-106 开工时旧 `audit_state_authority.js` 返回 ok，但 Browser composition 仍长期持有十组传统可变 slice，`app.js + app/**` 约 1,654 处成员访问且恢复路径手工回填；SETI-110 提交 `a0bda84` 后审计覆盖 193 个生产 JS/HTML 入口，九类语义反例逐项非零，正常路径 residual/violations 为零，StateStore commit trace 与 projection poison 通过。
- promote_to: watcher_lint
- promotion_status: promote
- decision: 既有 proof-obligation loop 已要求全称/否定命题使用匹配证据，但静态 audit 仍未机械执行该语义；本次把规则升级为仓库可执行 watcher_lint，保留字符串扫描仅作补充，不修改 issue-workflow 或 agent prompt。
