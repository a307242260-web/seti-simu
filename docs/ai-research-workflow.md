# 机器人调研-验证流程（2026-08-17 用户确认）

> 本文是机器人（机器玩家）迭代调研的统一流程，由用户 2026-08-17 确认：
> **每次调研跑 200 步快速验证效果；有机会则全盘验证；每次验证都存下记录便于
> 分析复盘；绝不跑同一个实验多遍浪费时间。**
> 配套工具：`tools/run_research_validation.js`（记录 schema
> `seti-research-validation-record-v1`，落盘 `reports/research/`）。
>
> 全盘进度可见性：`run_research_validation` / `run_simulate_save` /
> `save_checkpoints` / `compare_vguided_vs_baseline` 均接入
> `tools/progress.js` 的持续进度输出——每次机器决策（至少每秒一行）输出
> `[<标签>进度] 第X轮 第Y回合 决策#N 席位= 动作= 各席分数 用时 步/s` 到
> **stderr**，单次决策耗时数秒时也不会看起来"卡住"；`--progress` 等原有
> 固定步数输出保持原语义不变。stderr 不污染 stdout 上的最终结果。

## 1. 流程总纲

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

## 2. 实验指纹（去重判据）

指纹 = sha256 稳定序列化：

```text
{ seed, activePlayerCount, aiDifficulty, policyVersion, flags }
```

- `flags` = 行为配置开关（`unifiedSearch` / `planContinuationFastPath` /
  `vStateValueEnabled` / `completeTargetCatalog` /
  `traceCounterfactualGoalClusters` / `compactReplay`），只收显式传入的键。
- `policyVersion` = 当前启发式 Policy 版本（如 `seti-heuristic-policy-v26`），
  策略实现变更自动生成新指纹，不会误当作旧实验。
- 模式（`quick-N` / `full`）不进指纹，但记录按 `指纹.模式.json` 分文件，
  同一实验的快速与全盘记录并存、互不覆盖。

## 3. 用法

```sh
# 快速验证（默认 200 步，评估行为方向）
node tools/run_research_validation.js --name unified-on --config unifiedSearch=true
node tools/run_research_validation.js --name baseline                    # 无开关的基线

# 全盘验证（有机会时；自动从同实验快速存档续跑）
node tools/run_research_validation.js --name unified-on --config unifiedSearch=true --full

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

默认 seed 为免电分析盘面 `seti-free-analyze-v1`（路线基线：白色 86 / 均分 64.3，
目标均分 100），4 家，`aiDifficulty=laughable`。

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
