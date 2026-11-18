# 机器人调研-验证流程（2026-08-17 用户确认）

> 本文是机器人（机器玩家）迭代调研的统一流程，由用户 2026-08-17 确认：
> **每次调研跑 200 步快速验证效果；有机会则全盘验证；每次验证都存下记录便于
> 分析复盘；绝不跑同一个实验多遍浪费时间。**
> 配套工具：`tools/run_research_validation.js`（记录 schema
> `seti-research-validation-record-v1`，落盘 `reports/research/`）。
>
> 全盘进度可见性：`run_research_validation` / `run_simulate_save` /
> `compare_vguided_vs_baseline` 均接入
> `tools/progress.js` 的持续进度输出——每次机器决策（至少每秒一行）输出
> `[<标签>进度] 第X轮 第Y回合 决策#N 席位= 动作= 各席分数 用时 步/s` 到
> **stderr**，单次决策耗时数秒时也不会看起来"卡住"；`--progress` 等原有
> 固定步数输出保持原语义不变。stderr 不污染 stdout 上的最终结果。

## 1. 流程总纲

目标分层、PASS 标准、验收门限、专项自迭代和交接记录统一维护在
[迭代 loop 规范 §2.1](robot-iteration-registry.md)。本文只说明调研工具与证据采集，
不另设通过门槛；以下快速／全盘步骤不能代替小目标自身的验收条件。

每次调研（改搜索覆盖 / 价值模型 / 行为规则等）按以下节奏推进：

```text
提出可证伪假设
  -> 跑 200 步快速验证（默认，--steps 200）
  -> 看行为方向（分数、行动族分布、quick_trade、外星时间线、覆盖指标）
  -> 方向合理且有机会 -> 全盘验证（--full，自动复用快速验证存档续跑，不重跑前 200 步）
  -> 每次验证都落盘记录 -> 复盘 -> 决定收口或下一轮
```

铁律：

1. **绝不重跑**：同一实验（指纹相同）同模式已有记录时工具直接拒绝
   （exit 2），必须 `--force` 且写明覆盖原因才允许。
2. **全盘覆盖快速**：某实验已有全盘记录时，再跑快速验证会被拒绝（快速验证
   已被全盘覆盖）。
3. **记录必存**：每次验证自动写 `reports/research/<指纹>.<模式>.json`，
   含完整配置、指纹、git commit、分数、行动族分布、外星时间线、耗时。
4. **快速验证留档供续跑**：快速验证默认写 seti-saves 存档；全盘验证优先
   从同实验快速验证存档续跑，前 200 步不重跑（省时且行为一致）。

### 1.1 教学学习与性能超限的前置诊断（2026-11-18）

教学学习或已知超限点先完成定点诊断，达到对应单点准入后，再进入上述200步／全盘流程。此顺序沿用当前256次完整规则提交、600ms单点和180秒整局要求；不以200步实验绕过单点门槛。

1. **先说明业务差异。** 一张决策卡固定相同起点、当时可见信息、备选行动、共同结算边界、盘面分、科技、收入、资源和预投入。教师行动作为合法参考，不预设最优；不同起点和不同结算时机不作因果比较。
2. **先归因再改代码。** 依次核查候选、贪心筹资与计划、比较边界、价值分项、执行和复用。复用既有证据，只补能区分假设的最小原生对照；记录可推翻根因的观察及预期行为。性能、策略、规则三类改动分别验收，策略修正不能要求旧估值全部不变。
3. **先估算收益与成本。** 性能方案先写热点占比、最大收益和通往门槛的组合路径；上限不足的微调不作为连续主线。状态搜索沿用等价／去重、资源可达下界、全局预算及必要覆盖约束；固定计划的预览与估值工作计入总耗时，完整规则提交次数不能代替全部计算量。
4. **目标案例与迁移反例一起验。** 预先列出目标变化和已知更优计划，对比完整已知后缀的共同结算资产。每例旧最好结果独立核对；测试PASS或达到旧最低值，不等于没有退步。局部改善但违反事先声明的对照条件，立即否决原型，不级联补丁或扩大实验。
5. **分层验证并及时收口。** 原型先语法和相关行为检查，方向成立后完成项目要求的检查、源码可还原验证，再按既有去重流程扩大实验。对失败写明已排除原因和下一最小证据；同源码同实验不重跑。连续两张决策卡没有新增因果结论或可验收修正时，重审选题与方法，不自动回到旧优化队列。

方法有效性的证据是定位可复现原因、排除错误提案或交付无退步的决策修正；测试数量、报告数量和局部耗时下降不能替代原有整体目标。后续仍需用合法终局、逐轮资产、固定盘面分布、总耗时和可复现性验收AI。方法试验见[经验记录](mocha_experience/exploratory_research.md)与[升级决策](mocha_experience/promotion_log.md)。

### 1.2 有限工作单元与收口（2026-11-18）

§1.1已经定位任务匹配遗漏，也否决过迁移退步的原型；但局部问题仍可能连续占用整个学习过程。当前正式整局仍为272分。第289步候选从1573.7ms降至639.7ms，只证明该点的准备流程有所改善；它没有通过600ms，浏览器检查亦有未归类失败。不能据此宣布整局质量或方法的最终效果通过。证据见[只读复核](../reports/ai-foundation-20261118/methodology-review-20261118-v2.json)。

后续按以下方式限制研究投入，沿用原有验收要求：

1. **一个工作单元只回答一个问题。** 开工前写明同起点备选、预期行为／资产变化、反例、最大收益、验收条件和停止条件。一次只改变一个已定位原因；性能优化、策略修改和测试口径修正分别记录。不能把启发式限制候选称为等价剪枝。
2. **先读既有记录，再安排新执行。** 原始证据足够就直接判断；仅补能区分假设的最小对照。实验指纹使用实际源码和输入，不因修改文档、版本名或提交号而重跑相同运行时。不同源码单次计时的改善不能表述为稳定延迟分布。
3. **设定研究投入上限。** 下一工作单元最多投入60分钟主动研究，或检验两个可证伪假设，以先到者为准。到点保存结论、已排除原因与剩余问题并收口，不自动串接下一补丁。这个上限限制研究工作，不截断必要搜索，不改变运行时预算或256／600ms门槛；若不能在范围内证明，结论写未解决。
4. **明确四种出口。** 已证实且达本单元条件的改动保留为候选；迁移退步或假设被推翻则拒绝；证据不足则冻结；正式采用须另通过全部原准入条件。验证缺依赖、历史失败与新失败分别列明；任何未归类失败都不能计为已通过。
5. **按业务结果汇报。** 每次只报告正式结果相对上次的变化、候选的实际变化、未过条件和下一项问题。诊断有效、局部修复有效、准入通过、整局提升、20盘泛化是不同层级，逐级举证。没有新整局就明确正式成绩未变；不以测试、报告、版本数替代进展。

当前只允许整理证据和方法，保持正式AI不变，不启动新搜索或整局。下一项若恢复执行，先限定为浏览器与Node的运输检查差异归因，使用已有原生端点核对同一行动和结算边界，不先修改断言。该项结束后再决定性能准入的工作范围；仍不得越过单点门槛直接跑新局。

方法在当前阶段的有效证据是：选题筛掉了收益上限不足的微优化，原生对照定位了实际计划遗漏，迁移反例拦下了退步，结构性方案降低了该困难点的计算量。正式成绩和固定盘面分布仍未改善验收；只有后续交付这些业务结果，才能认为整套迭代方法有效。

## 2. 实验指纹（去重判据）

指纹 = sha256 稳定序列化：

```text
{ seed, activePlayerCount, aiDifficulty, policyVersion, flags, gitCommit }
```

- `flags` = 行为配置开关（`planContinuationFastPath` /
  `planNewTurnReuse` / `vStateValueEnabled` / `completeTargetCatalog` /
  `traceCounterfactualGoalClusters` / `compactReplay`），只收显式传入的键。
- `policyVersion` = 当前启发式 Policy 版本（`seti-heuristic-policy-v0`），
  策略实现变更自动生成新指纹，不会误当作旧实验。
- `gitCommit` = 当前 HEAD 短哈希（工作树脏时仍取 HEAD；无法取到用 `dirty`）。
  **2026-08-20 缺陷修复**：此前指纹**不含 gitCommit**，协调器/搜索时机等行为层
  改动若未升 `policyVersion`（如 `48f0af3e`、`185028b3`），指纹不变 → 工具拒绝
  重跑（行为变化反而无新记录），或 `--force` 直接覆盖旧记录丢失对比基准。
  现在指纹含 gitCommit：**同一实验（seed+policy+flags）不同代码版本自动产生
  不同指纹，记录按 `<指纹8>.<commit8>.<模式>.json` 分文件并存、互不覆盖**，
  每条记录可精确追溯到代码版本。
- 模式（`quick-N` / `full`）不进指纹，但记录按 `指纹.模式.json` 分文件，
  同一实验的快速与全盘记录并存、互不覆盖。
- `--force` 覆盖同一代码版本的记录前，**自动备份旧记录**
  （`<记录文件>.bak-<时间戳>`），保留对比基准。
**不要用 `benchmark_fixed_boards.js` / `run_simulate_save.js` 等无记录工具绕行
去重**（2026-08-20 教训：用 benchmark 裸跑免电盘面重跑 8 分钟全盘，且 HEAD
行为退化 219 决策终局/均分 27.3 没有被任何记录捕获）。

## 3. 用法

```sh
# 快速验证（默认 200 步，评估行为方向）
node tools/run_research_validation.js --name vguided --config vStateValueEnabled=true
node tools/run_research_validation.js --name baseline                    # 基线 = v0（当前 HEAD 默认装配：fastPath 开 + 新回合复用开）
node tools/run_research_validation.js --name base --config planContinuationFastPath=false   # 关快路径（对照）
node tools/run_research_validation.js --name noreuse --config planNewTurnReuse=false        # 关新回合复用（对照）

# 全盘验证（有机会时；自动从同实验快速存档续跑）
node tools/run_research_validation.js --name vguided --config vStateValueEnabled=true --full

# 复盘
node tools/run_research_validation.js --list                             # 全部记录
node tools/run_research_validation.js --show unified-on                  # 按名称
node tools/run_research_validation.js --show <指纹前缀>                   # 按指纹

# 其它
node tools/run_research_validation.js --name x --steps 300               # 自定义步数
node tools/run_research_validation.js --name x --config k=v --force      # 覆盖（写明原因）
node tools/run_research_validation.js --name x --no-save                 # 不写 seti-saves 存档
node tools/run_research_validation.js --name x --seed seti-107           # 换盘面
```

默认 seed 为免电分析盘面 `seti-free-analyze-v1`，4 家，`aiDifficulty=laughable`。
基线 = v0（当前 HEAD 默认装配：`planContinuationFastPath` 开 + `planNewTurnReuse` 开），
分数是否作为本项门限及具体数值按统一规范在小目标开工前定义，不设通用目标均分。

## 4. 记录内容（复盘看什么）

每条记录字段：

| 字段 | 含义 |
|------|------|
| `fingerprint` | 实验指纹（去重判据） |
| `mode` | `quick-N`（快速验证，N=步数）或 `full`（全盘） |
| `seed / activePlayerCount / aiDifficulty / policyVersion / flags` | 完整实验配置 |
| `createdAt / gitCommit` | 时间与代码版本（复盘定位改动来源） |
| `steps / stepsLimit / terminal` | 实际步数、上限、是否终局 |
| `resumedFrom / resumeStep` | 全盘续跑来源（null 表示从头跑） |
| `summary.scores / avgScore` | 各席分数与均分（快速验证为当前分，非终局） |
| `metrics.famsBySeat` | 每席行动族分布（看行为是否变化） |
| `metrics.whiteQuickTrade` | 白色 quick_trade 次数（V 引导翻车指标） |
| `metrics.whiteResearchSteps` | 白色研究科技发生的步点 |
| `metrics.traceEvents / revealEvents` | 外星人首痕迹 / 揭示时间线 |
| `savePath` | 存档相对路径（可快进/续跑/查中间过程） |

复盘时对同一实验的 baseline 与改动版记录做对比（`--show` 各看一份，或
直接读 JSON 对比）：分数方向、行动族分布变化、quick_trade 是否失控、
外星时间线是否提前。深入分析可结合：

- `tools/fast_forward_save.js <存档>`：快进复现中间过程
- `tools/load_save_simulation.js <存档> --run-ai/--decide N`：从存档继续打
- `tools/diagnose_plan_continuation.js --analyze <record>`：计划延续命中分析

## 5. 与其他工具的分工

- `tools/run_simulate_save.js`：手工跑全盘并存盘（无指纹去重），保留用于临时实验。
- `tools/benchmark_fixed_boards.js`：固定盘面均分基准（无记录），保留。
- `tools/run_research_validation.js`（本文档）：**机器人调研的默认入口**——去重、
  记录、快速→全盘续跑一体。
- `tools/compare_vguided_vs_baseline.js` / `tools/diag_vguided_quicktrade.js`：
  V 引导专项对比/成分分解，按需使用。
- `tools/dump_decision_tree.js`：**单步决策搜索树 dump（2026-08-21 标准化调研工具）**——
  加载存档重放到指定决策点，跑一次真实决策函数，把该决策的完整搜索数据
  （合法动作 / 目标目录 / 根动作 / 每根 outcome 与叶子链 / 搜索诊断 / **实际耗时
  wallMs**）dump 成 JSON（默认 `reports/iteration/decision-dumps/`），供多轮离线
  分析，**不反复重放**。用于定位"状态复杂 → 搜索慢/预算耗尽"类问题（如免电盘面
  白色 R3 决策 16384 预算下实测 42s、frontier 1.8 万节点）。输出文件名
  `<存档名>.step<N>.json`，含 `wallMs / rootActionCount / targetCount /
  outcomeStatusSummary / diagnostics`（executionLimitReached、frontier 分布等）。
  用法：`node tools/dump_decision_tree.js <存档> <重放步数> [输出.json]`。

## 6. 版本登记与复盘（迭代记录体系，2026-08-21）

调研记录落盘后，用 `tools/robot_iterate.js` 做**版本登记 → 复盘报告 → 总览页**：

```sh
node tools/robot_iterate.js run --name <id> --full --summary "..."   # 跑验证+登记+报告+页面
node tools/robot_iterate.js register --version-id <id> --summary "..." [--commits ...] [--records ...]
node tools/robot_iterate.js build --reports                          # 补齐复盘报告+重建页面
node tools/robot_iterate.js review --best | --show <id> | --compare <a>..<b>
node tools/robot_iterate.js check                                    # 完整性审计
```

- 版本登记真相源：`reports/iteration/versions.json`；总览页：`reports/robot-iteration.html`。
- `robot_iterate run` 实时透传子进程 stderr（逐决策进度），全盘数分钟全程可见，不会"卡死无输出"。
- 逐步复盘报告：`reports/iteration/<版本>/<记录>.action-log.html`（**纯重放存档，绝不重跑**）。
- **每个固定盘面的全盘记录必须归属到某个版本**（`check` 把未归属记录列为 warn 孤儿）。
- 机制与 schema 详见 `docs/robot-iteration-registry.md`。
