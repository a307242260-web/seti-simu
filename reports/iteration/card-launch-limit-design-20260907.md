# 卡牌发射满额结算：独立修复设计（2026-09-07）

状态：正式节点已实现，六种边界回归及真实433搜索/33步计划验证通过；完整局待验。不是性能优化版本。

## 目的与来源

433真实搜索两次b138-launch返回launchProbe失败，原因均为数量1/1。CGE官方FAQ
11.2024第2页General Q2要求无法完成的发射效果跳过，其他效果继续；Q1要求可执行
的效果不能任意跳过。原件在rules/seti-faq-base-en-202411.pdf（27页）。
免费免的是主行动费用，不是探测器上限；基础规则第8页及第28页FAQ仍有效。

## 唯一实现边界

只修改card_play_domain_launch正式executor。先用当前actor的正式ActionContext，
复用abilities.rocket.getActiveRocketCountForPlayer和getRocketLimitForPlayer；
不重复写orange1/公司加成公式。若未声明ignoreRocketLimit且当前数量已满，复用
cardEffectResult提交明确的skipped/rocket_limit事件和历史，保持卡牌后续效果队列。
否则仍调用同一个launchProbe，成功路径不变，其他失败仍显式返回。
判定在实际执行时发生，不在打牌根动作提前裁掉整张牌，也不按b138特判。

| 义务 | owner / 证据要求 |
|---|---|
| 规则可执行性 | 卡牌executor负责FAQ跳过语义；发射能力继续拒绝非法直接发射 |
| 上限计算 | 复用正式数量/上限primitive，包含科技与公司；不影响显式忽略上限 |
| 状态归属 | 使用Session当前working state；不修改探测器、资源、activeRocketId |
| RNG / id / sequence | 跳过不调用发射、不分配rocket id、不抽随机数；Session自身记账仍正常 |
| 事件与任务 | 明确记录跳过原因，但不产生launch/访问事件，不触发发射奖励 |
| 后续/事务 | 卡牌费用及主行动已发生；剩余拿牌/移动/得分/任务等继续，原Session负责撤销恢复 |
| Decision | 本节点不新增选择；后续Decision owner/version与既有机制相同 |
| 错误 | actor缺失、错误effect类型、资源/布局/内核故障仍显式失败；无catch/default成功 |
| 搜索/计划 | 合法牌保留；真实执行链必须可重放，不能仅将失败统计清零 |
| 预算/评分 | 4096/现有time及队列预算均不改；不调启发式追回均分 |

## 有限目录检查

对CARD_REFERENCE_MAP全部buildPlayEffects递归遍历，忽略condition/event数据，
获得18个launch描述符、17张牌：b21、b37（两次显式忽略上限）、b60、b69、b77、
b87、b98、b105、b116、b117、b119、b126、b127、b129、b138、dlc11、dlc14。
当前launch描述符均为免费、repeat=1；嵌套目录未发现其他launch描述符。
spawnEffect统一把launch送入同一executor，后续动态spawn同样按执行时状态判定。
异常点专用launch_anomaly_move不是此描述符，不扩大为物种/能力重构。

## 验证顺序

1. 正式composition回归先复现满额失败；满额b138正常结束（本牌只有发射效果），b21继续拿牌。
2. 无探测器时正常发射；orange1一架仍可发射、两架跳过；b37满额仍执行两次发射。
3. 检查跳过事件、无launch事件/新rocket id、后续效果和恢复一致；错误上下文不被吞掉。
4. 复用真实433冷决策，保存结果/计划/节点/耗时及错误诊断，重放选中链条。
5. 相关Node与V输入审计后独立中文生产提交；查重，唯一版本完整局，登记结果。
   必须将“规则修复符合预期”与“完整终局≥108.5、全搜索完成、零异常”分别核验。

实施前已核对正式spawn映射、发射能力、现有cardEffectResult与composition测试。
测试先红：b138在1/1时返回EFFECT_EXECUTION_FAILED；按方案实施后六种边界全通过。
验证含b138无探测器/满额/科技提高上限、b37显式忽略上限两次发射、b21满额后拿牌，
并核对rocket序号、探测器状态、launch与跳过事件、牌面费用、奖励保存恢复重放。
生产仅复用正式数量/上限查询并在满额返回显式跳过结果，不改发射能力、规则合法集、
评分或预算。相关DSL文档及现有Node清单已同步；完整局未验收。

真实433：13492.769ms、4096节点、4532次成功输入，EFFECT_EXECUTION_FAILED从2归零；
获选动作仍为play_card:2e224f59。完整结果保存在card-launch-433-result-20260907.v8.gz。
card-launch-433-verification-20260907.json保留初版诊断脚本失败：误把协调器已提交的
根动作再次执行；测量与搜索零失败数据有效，整体passed=false不能冒充验收通过。
单独只读重放脚本不运行搜索：第一版普通多人回合不能直接接续单席位跨回合计划；
首次fork版又把Decision当Action枚举。三份失败证据保留，均未驱动生产改动。
按正式fork的Decision输入与advanceFocalPlanningTurn契约修正工具后，
card-launch-433-fork-replay-v2-20260907.json的33步全部成功。
这证明既定单席位反事实计划可执行，不声称真实对手回合后计划必然仍有效。

Node回归77/79 unit通过，唯一fullFlow通过；既有beam与data:analyze断言仍失败，
不是全绿。V输入审计通过。README/AGENTS/公共接口与运行方式不变，无需修改；
卡牌DSL、机制参考、迭代计划及本设计同步更新。下一步独立生产提交后的唯一完整局。
