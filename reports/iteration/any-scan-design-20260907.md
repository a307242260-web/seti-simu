# 任意扇区扫描独立修复设计（待实现）

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

状态：设计待最终执行闭包复核，尚未写生产代码、未声称修复。当前固定局先完成，
登记其结果后再进入本项；不能因发现后续缺陷重跑或覆盖现有版本记录。
