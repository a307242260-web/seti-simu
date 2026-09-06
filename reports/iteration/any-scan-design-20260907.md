# 任意扇区扫描独立修复设计（已实现，验收中）

背景：1f0d82ec固定局运行期间只读取证；不修改运行版本。完整模型目录见
`any-scan-catalog-20260907.json`，242模型中5张牌、6处效果。
目标是恢复真实扫描义务，不是减少合法规则选择或修改启发式。

## 已确认来源与根因

- Science的any分支没有传入nebulaIds，通用枚举默认空目录，prepare实际输出零后续。
- `assets/aliens/半人马/cards/8.webp`牌面写明两枚扫描图标“in a sector of your
  choice”；本地implementation也要求选定一个扇区后扫描两次。当前expandEffects
  把ANY_SECTOR_SCAN repeat=2预展开为独立节点，恢复目标后会允许错误的不同扇区。
- dlc19是CONDITIONAL_REWARD的两个独立任意信号，不获得数据；不能与半人马8的
  同来源repeat合并。条件为至少3个己方信号扇区，未满足时不产生奖励属正常规则。

## 实现与证据矩阵

| 边界 | 唯一owner及完整义务 | 验证 |
|---|---|---|
| 扇区目录 | Science any分支显式用现有NEBULA_IDS_BY_COLOR完整8扇区；通用listNebulaChoices空集语义不改 | 8个真实合法扇区、指定空集仍空 |
| 模型重复 | Effects保留ANY_SECTOR_SCAN repeat，Card Play将次数传Science；不改变其他类型repeat | 全部6处构建；半人马8不预拆，dlc19仍两个独立节点 |
| 首次选择 | Science any仍标准choose_target；第一次确认后锁定nebulaId | 任意8目标均可首选；无虚构默认目标 |
| 剩余义务 | 沿现有SCAN_STEP specified自动执行同扇区余次，次数进入正式options；不复用probeFlow伪造探测器 | 同扇区两信号、没有第二来源选择、每次正式事件/ID |
| 数据与满扇区 | 每次仍executeNebulaScan；保留gainData，满扇区额外标记及统一流末结算 | 取数据/不取数据、首次填满后第二次额外标记 |
| 嵌套奖励 | Card Play既有spawnCardEffects与chainScanFinalize承担条件奖励和单次流末SETTLE | dlc19条件满足/不满足、两次可选不同扇区、一次结算 |
| 状态与事务 | 卡实例/RNG/序号归原Production；次数/锁定扇区归正式effect options；无外部缓存 | 每个Decision保存恢复提交全envelope相同，错误owner/过期决策由公共输入校验 |
| 搜索与计划 | 沿用nebulaId选择与标准事件；不添加评分、预算或第二执行路径 | 实际单决策、物理节点/输入、计划正式重放；再新版本唯一固定局 |

实现前应完整复核Science resolveScanStep及Card Play扫描桥接/链尾，确认不会
重复SETTLE。不将该修复扩成所有扫描模式的重构。保留既有探测器规则修复和
普通扫描payload边界。局部规则证据不代替固定局均分≥108.5或零截断验收。

历史设计状态：当时待最终执行闭包复核，尚未写生产代码。要求当前固定局先完成，
登记其结果后再进入本项；不能因发现后续缺陷重跑或覆盖现有版本记录。

## 开工冻结

1f0d82ec完整局及登记已完成。复核PLAY链尾、spawnCardEffects嵌套链尾与
resolveScanStep：半人马8顶层只追加一次FINALIZE；dlc19仅嵌套奖励追加一次，
外层无直接扫描不追加。剩余扫描沿direct优先级插在已有FINALIZE之前。
新options.sameSectorRemaining表示含当前在内的剩余同扇区标记次数，由ANY桥接
从模型repeat给出（未指定合法默认1），每次实际标记后递减；后续指定唯一nebulaId，
不再使用probeFlow或透传原卡元数据。其他模式不产生此字段。
旧版正式owner测试已复现any prepare零后续（预期1）；修复前未改变生产代码。
矩阵已闭合，可以按上述同一方案整批实施；正式composition与固定局仍待验证。

## 当前进展

已整批实现Effects保留repeat、Card Play次数桥接、Science完整目录与同扇区后续。
八扇区×取数据开关共16场景的正式扫描owner测试通过：首次8目标、两次同扇区信号、
只有首次Decision、正确数据增量；指定空集不变，半人马8构建不再拆散。
effects.test与既有扫描回归通过。尚未完成全部卡牌正式composition、满扇区、
恢复、单决策与唯一完整局，生产候选未提交，不声称本轮验收通过。

## 正式composition验证进展

`adhoc/verify-any-scan-production-20260907.js`从42派生受控牌与正式信号状态，
每次决策保存→提交→恢复→重提交，比较完整envelope。当前证据：

- b19：`any-scan-production-20260907.json`第一案例通过，一信号一次结算。
- 半人马8：`any-scan-banrenma-production-v2-20260907.json`空扇区和填满两场景通过，
  同一来源两信号；填满后的额外标记不再取数据，每场景一次结算。
- dlc19：`any-scan-dlc19-production-v3-20260907.json`条件满足/不满足通过，
  两个独立来源、零取数据、一次结算；不满足无奖励、无额外结算。
- b9：`any-scan-b9-production-20260907.json`完整行动3信号通过；该牌先完整扫描
  行动再额外任意扫描，沿既有两个流各结算一次，并非单一repeat流重复结算。
- 42冷决策：`any-scan-decision-42-20260907.json`15.035秒、4096节点/4804输入、
  0规则失败、30计划输入正式重放成功，根动作不变；未声称减少热点节点。

异常点0实际打牌在前置ownership检查被拒绝：CARD_PLAY_EFFECT_UNOWNED，缺少
yichangdian_anomaly_signal_score归属。证据`any-scan-production-v2-20260907.json`。
扫描尚未执行，不能假装该牌验证通过；另行核对已有handler注册与ownership目录。
当前任意扫描候选仍未完成整轮验收，不运行全盘来掩盖此失败。

诊断脚本早期失败均保留且区分原因：首份将外星人牌传普通deck目录得到null；
已改用对应物种createAlienCard与canonical alienEntity序号。半人马首份只清资源数
未清真实poolTokens导致数据计数偏差，已修正隔离输入。dlc19前两份在find谓词里
自增选址计数导致错误选择，已将计数移至确认选择之后。均不是生产规则修复，
不得将这些诊断错误混计为生产失败，也不得删除证据冒充首次全绿。

任意扫描生产已独立提交858c756a；提交前私有索引快照验证effects、Science与
Card Play测试通过，未借用工作树中的异常点修复。异常点缺陷另行提交后，以
组合版本运行唯一完整局；本提交没有单独终局分，不将组合效果冒充独立贡献。
# 2026-09-07 完整局补记

本修复858c756a与异常点独立修复0caa713a仅运行一份组合固定局，记录
0b8c855d.0caa713a.full.json：582步均112.75，较前版下降1分，0规则失败但仍32截断。
局部正式扫描证据通过；效果待因果核对，不能从组合分数拆推本提交贡献。
完整数据与未完成项见alien-card-ownership-design-20260907.md末节及
any-alien-full-verification-20260907.json；未完成移动需求式优化。
