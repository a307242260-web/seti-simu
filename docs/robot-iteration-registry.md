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

### 2.1 迭代逻辑与验收标准（2026-09-05用户明确要求）

每轮必须同时确认**实现符合预期**与**固定盘面效果达标**，不得用均分提升替代正确性。

1. 改动前写清目的、预期行为、影响边界和可证伪证据；实现后逐项复核，不靠得分上涨
   推断逻辑正确。检查受影响消费者、正式规则/状态/资源和恢复边界，避免引入新bug。
2. 改动后效果下降，先判断实现是否符合预期：
   - **不符合预期**：找出实际行为与设计的偏差及其原因，修正实现，不直接调权重补分。
   - **符合预期，但牵连其他效应**：保留正确改动，把已查明的连带问题单独设计、修复、
     提交和登记；不得混入本轮摘要。未证明由本轮引入的缺陷，不称为本轮导致的次生问题。
   - **原因未明**：继续取证，明确未知项；单步现象、得分拆分或触顶次数不能代替因果证据。
3. 逻辑正确仍不自动通过效果验收：固定盘面完整终局均分应提高，或均分不变且逻辑更
   合理；快速阶段分数不能替代终局。未达标如实记录，不为追回分数恢复已确认错误的逻辑。
4. 均分提升也不自动收口：核对实现、相关行为回归与新bug风险，明确证据覆盖不到的
   边界。测试通过不是无bug保证；不得绕过错误或用无意义构造测试制造“全绿”。用户明确
   暂不处理的既有失败需列明，不伪称全量通过，也不擅自扩大本轮修复范围。
5. 每轮完成后登记版本、同步文档并向用户报告：改了什么、预期与实际、验证证据、完整
   终局、已知问题与未完成项。摘要只写改动；成绩与验收结论放结果注记。遵守固定实验
   去重，保留失败候选及独立修复记录，不混淆版本贡献。
6. 范围审查（2026-09-06）：持续判断工作是否直接服务于本轮目的；用户提醒不等于
   已证明方向错误，应自行依据证据判断。完整设计覆盖本次问题的执行边界，不自动
   扩成所有同类机制的重构。跨模块审查可必要，但新增基础设施需证明必要性；未证明
   关联的缺陷单独记录，不以减少文件数或提高均分替代正确性，也不无限阻塞主线。

本标准是后续迭代的固定流程，不因某轮得分提高而省略；详见当轮计划与验收矩阵。

### 2.2 执行与登记

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
      "id": "v0",                 // 稳定 id（页面/回退/对比都用它）
      "name": "v0 基线（当前代码默认装配）",
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

改动摘要 `summary` 只描述改了什么；分数、步数、验证结果和验收结论放在实验结果或记录注记中，不混入改动摘要。

归属规则：

- **每个固定盘面的全盘记录必须归属到某个版本**（`check` 会把未归属的全盘记录列为
  **warn 级孤儿记录**）——孤儿记录说明有实验跑了但没登记，页面会一直提示直到登记。
- 记录 gitCommit 应在版本 commits 内（前缀匹配）。运行于**脏工作树**时记录 gitCommit
  取 HEAD、可能与实际代码不符——这种情况下在记录注记里写明，并接受 audit 的
  provenance 警告。
- 进行中的实验（未收口、脏树运行）**不登记为版本**，以孤儿记录形式留在页面上
  可见，收口后再 register。

## 4. 分数口径（用户规定：所有分数以最终总分为准）

每份结果的 `scoreSource` 三档优先级：

| 来源 | 说明 |
|---|---|
| `save-final` | 有存档的终局运行：从存档 `committedState.match.finalScores` 读**完整终局分**（total = base + 板块 + 卡牌），最可信 |
| `record` | 无存档/非终局：用记录 `summary.scores`（当时运行口径；2026-08-20 finalScore 修复前只显示 base 分） |
| `roadmap` | 无 research 记录：用 versions.json 的 `roadmap` 字段（文档来源记录的分） |

页面每个分数格都带来源徽标，杜绝口径混用（旧总览页的教训：base 分与完整分混在一张表里）。

## 5. 逐步复盘报告（每个实验的完整复盘记录）

**硬规矩（2026-08-21 用户口径）**：标准迭代入口 `robot_iterate run` **默认**产出完整复盘三件套
（存档 + 复盘报告 + 记录）：跑验证默认写存档（不经 `--no-save`）→ 自动登记版本 → 从存档
纯重放生成行动级复盘报告 → run 结束**硬校验**：记录/存档/复盘报告任一缺失即显式失败
（exit 非 0，提示原因），不允许"跑完没复盘"的迭代收口。`build --reports` 可补齐缺报告记录。

生成方式：`node tools/robot_iterate.js build --reports`（为所有有存档但缺报告的记录补齐；
报告模板/聚合逻辑改动后用 `--force-reports` 强制重新生成全部报告）。**纯重放存档
`replaySteps`（`after` 快照含每步后的分数/钱/电/宣传/手牌），不做任何 AI 搜索——绝不重跑。**

报告内容（2026-08-21 起按**玩家回合**聚合——2026-08-21 用户口径：一个玩家的回合 =
主行动 + 附属快速/条件步骤合并为一行，不再把打牌/选目标等子步骤拆行）：

- 头部：seed / gitCommit / policy / flags / 模式 / 步数 / 耗时 + 记录 JSON 与存档路径
- 终局分数表：完整终局分 + base/板块/卡牌拆分 + 均分；**结算明细**——每玩家列出
  base 构成（初始/扫描/环绕/登陆/蓝科技/科技bonus/外星痕迹/卡牌效果等，逐项分数）、
  各板块得分、卡牌得分（卡名+分数），即"具体什么获得了几分"（2026-08-21 用户口径）
- **每名玩家行动清单**：按蓝/绿/棕/白分组，每玩家**每回合一行**（轮/回合、主行动
  标签+摘要、该回合步数、分数变化、回合后分数与资源）；初始选择并入该玩家第一回合；
  **纯 end_turn（结束回合）回合不展示**——结束回合不是玩家一动（2026-08-21 用户口径）；
  **卡牌编号显示为卡牌名称**（`assets/cards/card_model.json` + `assets/aliens/*/card_model.csv`
  GBK 解码，外星卡 id 拼接物种前缀；查不到的保留原编号）；
  **该回合的附属动作按发生顺序合并为一行列出**（快速/盲抽/收入/终局标记/初始牌，
  2026-08-21 用户口径）：快速行动摘要完整；**盲抽/精选显示抽到的牌**（重放对比 hand 增量，
  如"抽牌 大耳朵射电望远镜"）；**收入显示插的牌与获得资源**（重放对比 income 增量，
  如"收入 水手10号任务（获得 信用点+1）"，按插牌 income 码给单一资源——orbit 摘要中
  误导性的"获得 1 次收入（R1，1信用点+1能量）"文案已修正为"获得 1 次收入"）；终局标记、
  初始牌（编号+效果）同样并入。条件/目标选择子步骤仍并入回合不单列；纯 end_turn 回合不展示。
- **全程依次复盘**：按轮分组的全量玩家回合时间线（同上一行格式，含玩家列；同样不展示纯 end_turn 回合）
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

总览页迭表展示**全部版本完整行**（2026-08-21 用户口径修正：历史版本与当前 baseline
一样完整展示，只是页面不额外展开提交/diff 细节；此前误实现为只显示 baseline 一行）。
`registry.currentBaseline` 判定：head 精确匹配
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

## 8. 当前版本（2026-09-06）

| 版本 | head | 说明 |
|---|---|---|
| `card-income-id-r3c1-20260906` | `cf4280fd` | 卡牌收入选择身份独立修复；583步均105.5，低于R2e基线1.25，第三轮仍未通过 |
| `income-reserve-r3i1-20260906` | `082d3e12` | 收入资源准备保留插牌容量；快速200步均38.5，全盘第236步遇既有卡牌收入接口缺陷，无终局 |
| `scan-earth-r3s1-20260906` | `4fba7beb` | 标准扫描逐步依赖正式地球来源；529步均89.25，未通过；后续独立修复分别登记 |
| `sector-directory-s2-20260906` | `904acf13` | 独立扇区目录修复：补水星来源及完整缓存依赖；612步均95.75，与R3-T1全程动作/摘要/终局明细一致，局部正确性通过；第三轮仍低于R2e基线11分，未通过 |
| `tile-dependency-r3t1-20260906` | `5ebc336e` | **第三轮仍未通过**：纠正终局板块被误认科技的计划依赖；612步、62/96/89/136、均95.75，较R3原候选提高3.5，仍低于R2e基线11分 |
| `planet-read-r3p2-20260906` | `186f97c1` | 第三轮独立行星读取优化：真实单状态评分/优胜叶/计划/节点数等价，9.56秒通过单状态10秒门槛；未跑全盘，不是第三轮验收通过版本；证据见`reports/iteration/r3-planet-read-verification-20260906.json` |
| `copy-cost-r3p1-20260906` | `d56bf23a` | 第三轮独立复制优化：真实单状态评分/优胜叶/计划/节点数等价；11.61秒→10.59秒，仍超10秒门槛，未跑全盘，不是验收通过版本；证据见`reports/iteration/r3-copy-cost-verification-20260906.json` |
| `plan-steps-r3-20260906` | `d7a78140` | **第三轮未通过候选**：逐步计划依赖；593步、63/100/82/124、均92.25，较R2e下降14.5；因果定位进行中 |
| `blue-future-r2e-20260905` | `20feca27` | **当前验收版本**：蓝科技未来价值去重；667步、79/134/117/97、均106.75，较R1提高7，第二轮通过 |
| `search-result-retention-s1-20260905` | `e80ca9e7` | 独立搜索结果保留修复：584步、82/84/109/119、均98.5，较R2c提高16.75；仍低于验收基线99.75，第二轮未通过 |
| `conditional-progress-r2c-20260905` | `fda901b9` | **未通过候选**：实际支付循环消除；固定盘面469步、80/114/46/87、均81.75，较验收基线下降18；快速与完整存档、报告均保留 |
| `resource-realization-r2b-20260905` | `c1b7bd49` | **续跑未完成**：200步阶段均34.25；从快速存档续跑后弃牌点选循环，已停止，无正式终局成绩 |
| `resource-attribution-r2-20260905` | `4f994f86` | **未通过候选**：资源、宣传和蓝槽归因修正；固定盘面464步、64/90/83/91、均分82，较验收基线下降17.75；快速与完整记录均保留 |
| `terminal-value-r1-20260905` | `d9283ce5` | **第一轮通过版本**：终局宣传预期、V与搜索优先级统一正式分；固定盘面535步、25/144/147/83、均分99.75，与基线动作和状态摘要完全一致，按“均分不变且逻辑合理”通过 |
| `fold-rollback` | `5045a3ff` | 2026-08-22 回退：回退折叠链实验（29e66b9b），代码与 `elig-sum4`（56e9a9c0）一致；place_data 无折叠链、无 foldTargetSlots。折叠链完整经验见 `reports/iteration/fold-chain-search-status.md` |
| `elig-sum4` | `56e9a9c0` | 第一轮对照基线（无折叠链默认装配）：全盘535决策/535原子动作，完整终局均99.75（有存档有报告） |
| `fold-chain-real` | `29e66b9b` | 已回退（2026-08-22）：折叠链 + 多格 plan 不延续，均 100.3（A/B 记录保留） |

已知口径注记：

- 记录 `summary.scores` 为运行当时口径；有存档的终局运行由 build 从存档 finalScores
  读取完整终局分（save-final），total = base + 板块 + 卡牌。
- `registry.currentBaseline` 按代码祖先解析为`card-income-id-r3c1-20260906`，只表示当前
  代码归属，不表示验收通过；最近通过版本仍为`blue-future-r2e-20260905`。四轮计划与
  验收证据见`docs/ai-iteration-plan-20260905.md`。
- 2026-09-05 用户追加验收：每轮必须验证固定盘面完整终局，均分提高，或均分不变且逻辑
  更合理才可收口；200步快速结果不替代终局验收，续跑使用同代码提交的快速存档。

## 9. 与调研流程的关系

`docs/ai-research-workflow.md` 定义调研实验流程（快速验证 → 全盘 → 记录落盘）；本体系
在其之上增加**版本登记与复盘层**：`run_research_validation` 只管跑与记录，版本归属、
报告生成、总览页全部由 `robot_iterate` 接管。默认盘面一致（免电分析盘面
`seti-free-analyze-v1`）。
