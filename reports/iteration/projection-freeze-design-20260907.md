# 完整投影冻结可变规则状态：独立缺陷

状态：独立修复744c5cf9已完成行为验证；完整局均105.5，整体Goal门槛未通过。

## 对照证据

`inspect-projection-freeze-471-20260907.js`复用真实471检查点，只改变正式取消前
的投影读取方式。`projection-freeze-471-20260907.json`：不读取、simulation-cheap、
player-full、player-cheap都成功；只有simulation-full随后报
EFFECT_SESSION_COMMIT_THROWN：stateVersion只读。读取前后的序列化envelope
仍相同，说明只比较JSON值不足以发现冻结副作用。

## 已读源码关系与修复义务

Rule Composition启用trusted fork时，Session.observe可把working state直接传给
projectState；Production adapter启用trustedProjectionReader时只浅展开state。
simulation完整视图保留meta等引用，projectionInner的deepFreeze冻结观察同时
冻结了session内部meta。后续commit写stateVersion才失败。玩家视图经过
buildObservation形成独立值，本样本未受影响，不能据此声称其他路径绝对安全。

修复应在完整投影快照的所有权边界隔离可变源后再冻结，不取消冻结，不屏蔽写入
错误，不按本次species/cancel特判。明确idle committed/active working、完整/cheap、
玩家/全量视图、trusted/普通装配各边界；cheap内部临时只读用途不能冒充可持有的
完整快照，完整快照后续不能因继续执行而变化，也不能冻结规则状态。

验收：真实471四种读取方式与不读取结果一致；完整快照持有后继续输入、恢复、
二次读取均保持旧快照不变，RNG/序号/完整状态与无读取路径相同。正常玩家搜索
单决策须测实际开销，不靠移除公共投影功能规避。修复后单独中文提交和完整局登记。
以上是修复前对照，不声称该对照覆盖全部状态；实施与完整局证据见下文。

## 本项冻结方案

唯一修改点：Rule Composition的activeSession完整投影返回边界，在deepFreeze前
复制observed；直接复用既有clone primitive。idle路径的store snapshot已隔离/
冻结，保持原逻辑；cheap是内部即时读取，不冻结且不在此新建长期快照，保持原逻辑。
不按viewer.role或物种特殊处理，不改Production adapter/Session规则executor，
不增加缓存、配置或第二投影实现。完整投影值/类型保持，引用不再别名到working root。

| 边界 | 行为义务 |
|---|---|
| active + full，所有viewer | 先形成独立快照再冻结；执行后旧快照不变，源状态可继续执行 |
| idle + full | 原冻结committed snapshot可保留；后续状态替换不改旧快照 |
| cheap | 保持内部临时只读边界，不在此扩为完整持久观察 |
| trusted/普通装配 | 都遵守完整投影独立性；不能因trusted跳过此所有权边界 |
| Decision/恢复 | 读取不改变选项/owner/版本，真实输入与无读取对照的envelope相同 |
| RNG/实体/事件 | 只复制返回快照，不执行规则，不改变任何序列和事件 |
| 性能 | 真实471五方式验证后，真实42单决策计时与结果/节点/完整计划对照；未过不跑全盘 |

测试先以现有非零checkpoint通过真实fork连续执行，持有完整快照并复读，核对与
无读取执行相同；另复用471实际失败样本。测试不读取生产源码，不绕过runtime。
完整局按独立版本只跑一次，不能将旧取消修复的105.5当作已过108.5门槛。

实施：activeSession完整投影在冻结前复制，其他分支不变。非零checkpoint测试
先红，读投影后下一公司选择报selectedIndustryId只读；修复后与无读取对照的
完整envelope相同，复读与继续执行不改变已持有快照。真实471五读取方式证据
projection-freeze-fixed-471-20260907.json全部正常完成，不再出现stateVersion只读。
42代表性单决策与完整局结果见下文。

42验证已完成：15521.578ms，4096节点/4804规则执行，25动作完整评价、原始
actionOutcomes及29步计划与保存基线逐字段相同。较此前14393.059ms单次测量
增加约7.84%，必要隔离有成本，不宣称提速；仍在现有30秒单决策预算内，无预算修改。
完整Node回归77/79 unit及唯一fullFlow通过，两个既有失败相同；V输入审计、语法
和diff检查通过。已更新RL观察契约和现有测试清单；AI评分、规则、README/AGENTS
和公共接口未变化，无需修改。

完整局已按版本唯一运行：0eee8b82.744c5cf9.full.json，562步，正式终局
109/88/118/107、均105.5，低于108.5门槛。与61cc94af全部replay、终局完整状态及
179次非时间搜索诊断完全相同，核验与文件哈希见projection-full-verification-20260907.json。
105127节点/129504次成功规则输入/21满额，433两次失败不变；380303→376016ms
仅单次完整局对照，不宣称稳定提速。投影隔离修复行为符合预期，整体Goal尚未通过。
