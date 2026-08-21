# 机器人迭代记录与复盘体系（2026-08-21 建立）

> 解决的问题：历史版本难定位、记录与代码版本对不上（脏树运行 / 指纹不含 commit）、
> 分数口径漂移（历史记录只显示 base 分）、同一实验被重复跑浪费时间。
> 核心原则：**版本登记（`versions.json`）是唯一真相源，页面与报告全部从数据生成，
> 绝不重跑同一版本，每个历史版本都有完整复盘记录。**
> 配套入口：`node tools/robot_iterate.js`（标准迭代入口，见 §2）。

## 1. 数据流与文件

```text
人工维护（真相源）                   自动生成
reports/iteration/versions.json ─┐
reports/research/*.json（调研记录）├─→ tools/robot-iteration-lib.js
seti-saves/*.json（存档，可选）    │      └→ reports/iteration/registry.json（构建产物）
                                 │      └→ reports/robot-iteration.html（总览页，数据内嵌）
                                 └──→ reports/iteration/<version-id>/<record-key>.action-log.html
                                          （逐步复盘报告，纯重放存档 replaySteps）
```

| 文件 | 角色 |
|---|---|
| `reports/iteration/versions.json` | **唯一真相源**（人工维护）：版本定义、改动摘要、记录归属、roadmap 注记 |
| `reports/research/*.json` | 调研记录（`run_research_validation.js` 产物，指纹含 gitCommit） |
| `seti-saves/*.json` | 存档（可选）；有存档的终局运行可读完整终局分、可生成复盘报告 |
| `reports/iteration/registry.json` | 构建产物：版本+结果+best-of+审计合并后的数据 |
| `reports/robot-iteration.html` | 总览页：顶部最佳卡 + 当前 baseline 迭表（**历史版本折叠归档**）；数据内嵌可离线打开 |
| `reports/iteration/<vid>/<key>.action-log.html` | 逐步复盘报告 |
| `tools/robot_iterate.js` | 标准迭代入口 CLI |
| `tools/robot-iteration-lib.js` | 核心库（扫描/富化/best-of/审计/报告/渲染） |

## 2. 标准迭代入口

每次迭代只做两件事：**改核心策略 + 分析历史版本**。迭代闭环：

```text
1. 改核心策略代码，同步文档（改动即文档），提交代码
2. node tools/robot_iterate.js run --name <id> [--full] [--steps N] [--config k=v] --summary "..."
   → 跑验证（底层指纹去重，绝不重跑）
   → 自动登记版本（head/commits/baseline 自动推导，写 versions.json 前自动 .bak 备份）
   → 生成复盘报告（纯重放，无 AI 重跑）→ 重建总览页

`run` 的子进程用**异步 spawn 实时透传** stdout/stderr（2026-08-21 修复，替代原 spawnSync
同步阻塞）：全盘数分钟期间，run_research_validation 默认逐决策写 stderr 的进度行
（`progress.js`，minIntervalMs=1000：轮次/回合/决策#/席位/动作/各席分数/用时）会实时
出现在终端，而不是等结束才一次性吐出；`--progress N` 的每 N 步汇总同样实时可见。
3. 人工核对 versions.json 的 summary / 记录注记（可再跑 register/build 微调）
4. 提交记录体系产物（与代码改动同一次提交或紧随其后）
5. 分析历史：review --best / --show / --compare / check
```

命令一览：

```sh
# 跑验证 + 登记 + 报告 + 页面（默认 200 步快速；--full 全盘）
node tools/robot_iterate.js run --name card-value-fix --full --summary "打牌价值修正：…"
node tools/robot_iterate.js run --name search-timing --steps 200 --config planNewTurnReuse=false

# 手动登记已有记录为版本（不重跑；幂等，已有定义保持不变）
node tools/robot_iterate.js register --version-id <id> --name "显示名" --summary "…" \
    --commits abc1234,def5678 --records fp.commit.full.json --baseline <vid> --date YYYY-MM-DD

# 重建 registry + 页面；--reports 为所有有存档但缺报告的记录补齐复盘报告
node tools/robot_iterate.js build [--reports]

# 历史分析（只读）
node tools/robot_iterate.js review --best                 # 固定盘面最佳（白分/均分/耗时）
node tools/robot_iterate.js review --show <id>            # 版本详情（提交/结果/回退命令）
node tools/robot_iterate.js review --compare <a>..<b>     # 两版本对比
node tools/robot_iterate.js check                         # 完整性审计（exit 1 = 有警告）
```

`run` 的防重跑双层保障：

1. **登记守卫**：同一版本 id 已登记于当前 HEAD → 直接拒绝（exit 2）。
2. **底层指纹去重**：`run_research_validation` 指纹含 gitCommit，同实验同代码版本同模式已有
   记录 → exit 2；`--force` 覆盖前自动备份旧记录。

**绝不重跑**：同一代码版本（head）绝不跑两遍。行为改动 → 新 commit → 自动新指纹新记录。

## 3. versions.json 版本登记 schema

```jsonc
{
  "schemaVersion": "seti-robot-iteration-registry-v1",
  "defaultBoard": { "seed": "seti-free-analyze-v1", "name": "免电分析盘面", "note": "…" },
  "versions": [                    // 数组顺序 = 最新在前（页面倒序展示）
    {
      "id": "v26-unified",         // 稳定 id（页面/回退/对比都用它）
      "name": "v26 统一搜索（on/off 合并）",
      "date": "2026-08-18",
      "baseline": null,            // 基线版本 id（该版本基于哪个版本）
      "head": "53abbd5a",          // 该版本代码树（记录 gitCommit 的对照基准）
      "commits": ["6caeb0f7", "10ded3e9", "dd5da46e", "53abbd5a"],  // 本版本引入的提交（旧→新）
      "summary": "改动摘要（人工撰写）",
      "records": {                 // 记录归属：reports/research/ 下的文件名 → 注记
        "d2c50ffe.53abbd5.full.json": { "note": "on-head：557 步，完整终局 107/68/98/83 均 89" }
      },
      "roadmap": null              // 无 research 记录时的手工分数（来源标注 roadmap）
    }
  ]
}
```

归属规则：

- **每个固定盘面的全盘记录必须归属到某个版本**（`check` 会把未归属的全盘记录列为
  **warn 级孤儿记录**）——孤儿记录说明有实验跑了但没登记，页面会一直提示直到登记。
- 记录 gitCommit 应在版本 commits 内（前缀匹配）。运行于**脏工作树**时记录 gitCommit
  取 HEAD、可能与实际代码不符——这种情况下在记录注记里写明，并接受 audit 的
  provenance 警告（已知例外，如 `newfast-recovery` 的 `25bdb5e9` 记录）。
- 进行中的实验（未收口、脏树运行）**不登记为版本**，以孤儿记录形式留在页面上
  可见（如 `6062da9f`（v27strategy-reverted）），收口后再 register。

## 4. 分数口径（用户规定：所有分数以最终总分为准）

每份结果的 `scoreSource` 三档优先级：

| 来源 | 说明 |
|---|---|
| `save-final` | 有存档的终局运行：从存档 `committedState.match.finalScores` 读**完整终局分**（total = base + 板块 + 卡牌），最可信 |
| `record` | 无存档/非终局：用记录 `summary.scores`（当时运行口径；2026-08-20 finalScore 修复前只显示 base 分） |
| `roadmap` | 无 research 记录：用 versions.json 的 `roadmap` 字段（文档来源，如 v27-tech-v3 白 106/均 77.5） |

页面每个分数格都带来源徽标，杜绝口径混用（旧总览页的教训：base 分与完整分混在一张表里）。

## 5. 逐步复盘报告（每个实验的完整复盘记录）

**硬规矩（2026-08-21 用户口径）**：标准迭代入口 `robot_iterate run` **默认**产出完整复盘三件套
（存档 + 复盘报告 + 记录）：跑验证默认写存档（不经 `--no-save`）→ 自动登记版本 → 从存档
纯重放生成行动级复盘报告 → run 结束**硬校验**：记录/存档/复盘报告任一缺失即显式失败
（exit 非 0，提示原因），不允许"跑完没复盘"的迭代收口。`build --reports` 可补齐历史缺报告记录。

历史欠账（2026-08-21 用户拍板**不补跑**）：5 个评估实验（v27strategy-reverted 479 步 /
newfast-recovery 321 步 / newfast A/B 206+230 步 / v26 on-baseline quick-200）当时未存
存档，无行动级复盘，审计列为 info 提示（记录 JSON 仍有行动族分布/外星时间线可复盘）；
**有存档却缺报告仍是 warn**（`build --reports` 立即可修复）。

生成方式：`node tools/robot_iterate.js build --reports`（为所有有存档但缺报告的记录补齐；
报告模板/聚合逻辑改动后用 `--force-reports` 强制重新生成全部报告）。**纯重放存档
`replaySteps`（`after` 快照含每步后的分数/钱/电/宣传/手牌），不做任何 AI 搜索——绝不重跑。**

报告内容（2026-08-21 起按**玩家回合**聚合——2026-08-21 用户口径：一个玩家的回合 =
主行动 + 附属快速/条件步骤合并为一行，不再把打牌/选目标等子步骤拆行）：

- 头部：seed / gitCommit / policy / flags / 模式 / 步数 / 耗时 + 记录 JSON 与存档路径
- 终局分数表：完整终局分 + base/板块/卡牌拆分 + 均分
- **每名玩家行动清单**：按蓝/绿/棕/白分组，每玩家**每回合一行**（轮/回合、主行动
  标签+摘要、该回合步数、分数变化、回合后分数与资源）；初始选择并入该玩家第一回合
- **全程依次复盘**：按轮分组的全量玩家回合时间线（同上一行格式，含玩家列）
- 行动族统计（记录级，全量步骤口径）

没有存档的记录无法生成行动级报告——页面标注"仅记录级指标"（记录 JSON 本身含
行动族分布/外星时间线，仍可复盘）。`check` 会列出有存档但缺报告的记录。

### 5.1 任意存档复盘（手打档/临时实验）

```sh
node tools/robot_iterate.js report --save <存档> [--title "名称"] [--out <路径>]
```

不登记版本、不重跑，直接从任意 `seti-browser-save-v2` 存档纯重放生成行动级复盘报告
（默认输出 `reports/iteration/human-reports/<存档名>.action-log.html`）。
示例——用户手打的免电分析盘面 405 分档（`seti-save-537-merged.json`，516 步）：
`node tools/robot_iterate.js report --save seti-saves/seti-save-537-merged.json --title "手打 405 分档"`
报告含完整终局分（白 405 = base 249 + 板块 118 + 卡牌 38）、每玩家回合清单与全程复盘。

## 6. 当前 baseline 与历史版本查询

总览页迭表只展示**当前 baseline** 一行（2026-08-21 用户口径：迭表只保留新的 baseline，
历史版本与回退/定位改动不在页面展示）。`registry.currentBaseline` 判定：head 精确匹配
git HEAD，否则取 head 为 HEAD 最近祖先的版本——策略提交后又提交工具/文档时 HEAD 会
前进到非版本提交，策略基线不变（如当前 HEAD 为工具提交时 baseline 仍解析为最新策略版本）。

历史版本信息用命令行查询（只读，不重跑）：

```sh
node tools/robot_iterate.js review --show <id>      # 版本详情（日期/head/baseline/改动摘要/提交/结果）
node tools/robot_iterate.js review --compare <a>..<b>  # 两版本分数/步数/耗时对比
node tools/robot_iterate.js review --best           # 固定盘面最佳（白分/均分/耗时）
```

## 7. 完整性审计（命令行 check）

| 级别 | 检查项 |
|---|---|
| warn | 固定盘面全盘记录未归属任何版本（孤儿） |
| warn | 记录 gitCommit 不在版本 commits 内（provenance 不匹配，脏树运行需注记说明） |
| warn | 版本声明了不存在的记录文件 / 有存档但缺复盘报告 |
| info | 非全盘孤儿记录 / roadmap-only 版本 / 声明存档已删除 / 工作树脏 |

`check` 退出码 1 = 有 warn，用于 CI/提交前自查。

## 8. 种子版本与已知注记（2026-08-21）

| 版本 | head | 说明 |
|---|---|---|
| `newfast-recovery` | `ec5cfb9f` | HEAD：end_turn/pass 特例恢复；321 步/白 58（记录 gitCommit=9e75c9cd，脏树运行） |
| `newfast` | `9e75c9cd` | 默认装配固化（fastPath+新回合复用开）；A/B 对照记录（bb319981/bced1aa3，无存档） |
| `v27-playvalue` | `1d063418` | 打牌价值+计划复用线；quick-200 记录（b2a3aa41，有存档有报告） |
| `v27-tech-v3` | `d347e658` | 科技价值打分线；roadmap 基线白 106/均 77.5（无 research 记录） |
| `v26-unified` | `53abbd5a` | 统一搜索合并；两个全盘记录均有存档有报告（on 均 89 / off 均 85.5） |

已知口径注记：

- 历史记录（2026-08-17/18）的 `summary.scores` 多为 base 分（finalScore 传 null bug 修复前），
  **有存档的已由 build 富化为 save-final 完整终局分**（如 v26 on 实际 107/68/98/83 均 89）。
- `v27strategy-reverted`（`6062da9f.ec5cfb9f.full.json`，479 步/均 72.75）为**进行中的
  "策略接口回退"实验**（工作树脏：expected-score-evaluator / production-kernel /
  rule-observation 回退到 d347e658），未登记为版本，页面以孤儿记录提示。

## 9. 与调研流程的关系

`docs/ai-research-workflow.md` 定义调研实验流程（快速验证 → 全盘 → 记录落盘）；本体系
在其之上增加**版本登记与复盘层**：`run_research_validation` 只管跑与记录，版本归属、
报告生成、总览页全部由 `robot_iterate` 接管。默认盘面一致（免电分析盘面
`seti-free-analyze-v1`）。
