# SETI 分析数据路线门槛与来源设计（2026-07-31）

## 目标与成功标准

`data:analyze` 只在以下任一条件成立时进入次级目标目录：

1. 当前已放计算机数加可用数据数不少于 4，手头数据足以填满第一行；
2. 计算机第一行 4 格已经放满。

手头数据不足以填满第一行且第一行尚未放满时，不为了分析主动搜索扫描、探测器、卡牌或资源转换。
第一行放满后，分析路线允许使用正式规则已经证明能获得数据的扫描、环绕/登陆、卡牌与弃牌
角标来源；选定来源之后才允许为该来源补足费用。

## 设计矩阵

| 语义 | 正式来源与唯一 owner | 搜索表示 | 状态 / Decision / RNG | 失败与剪枝 |
|---|---|---|---|---|
| 分析门槛 | `production-kernel.buildDataAnalyzeRequirements` 读取正式计算机 token 与可用数据 | `eligible`、`eligibilityReason` | 只读 projection；不执行规则 | 不满足门槛时不建立 `data:analyze` 根目标，快速转换也不得借该目标进入 root |
| 已有数据 | Data state 与正式 `place_data` descriptor | `data:place` | 放置及蓝槽/计算机 Decision 仍由 Science Session 执行 | 数据不足以达到门槛时，放置可服务其他目标，但不得自动锁定分析路线 |
| 正式分析 | Data state 与正式 `analyze` descriptor | `data:analyze` | 分析费用、结算和清空由 Science Session 执行 | 只有正式 analyze action 证明目标完成 |
| 标准扫描 | `SetiScanEffects.getStandardScanCost` 与正式 scan descriptor | `data:scan` | 星云、公共牌与数据 token 由 Science Session 结算 | 只在第一行已满且没有可放数据时成为数据来源；费用不足时求最小损耗转换 |
| 探测器数据奖励 | `buildProbeRouteRequirements` 使用 `SetiPlanetRewards` 正式 effect | 复用 `probe:<requirementId>`，把 `data:analyze` 加入 result ids | launch/move/orbit/land、奖励 Decision 与 RNG 全走正式 Session | 只收录 `GAIN_DATA` 数量大于 0 的具体终点；不得复制第二套 data probe 路线 |
| 卡牌数据奖励 | `SetiCardEffects.buildPlayEffects/getCardPlayCost` | 复用 `card:<instanceId>`，把 `data:analyze` 加入 result ids | 支付、卡牌实体、嵌套 effect/Decision/RNG 由 Card Session 执行 | 只收录直接正式 `GAIN_DATA`；不得复制第二套 data card 路线 |
| 弃牌角标数据 | `SetiCards.getDiscardActionRewardForCard` 与公司倍增被动 | `data:corner:<instanceId>` | 弃牌实体与数据奖励由 Residual Session 执行 | 只收录正式 `dataCount > 0` 的角标 |
| 其他链内数据 | 任一已选正式目标的实际 outcome | 结算后重新读取 requirement | 不预测 effect；只读取已提交 branch observation | 若结算使门槛成立，后续才可锁定分析；未结算的潜在奖励不算数据 |

## 路线连续性

- `eligible=false` 时，`requiresRootCounterfactual`、根目标目录和自动 route lock 都忽略
  `data:analyze`。
- `eligible=true` 且有可用数据时，下一步只能是 `place_data`；数据位置继续按当前资源缺口选择
  蓝科技奖励，否则放入计算机。
- `eligible=true` 且 analyze ready 时，下一步只能是 `analyze` 或其必要能源准备。
- 第一行已满、没有可用数据时，扫描和数据角标由分析目标直接建立计划；探测器与卡牌复用它们
  原有的具名结果目标。放完一批数据仍未到分析格时释放分析绑定，由正常目标调度重新选择下一
  个来源，避免同一物理路线以 probe/card 和 data 两个 origin 重复展开。
- 某个其他目标实际获得数据后，若新 observation 满足门槛，route 才转入 `data:analyze`。

## 预算与验收

- 不修改 15 个已完成结果目标上限、4096 物理执行保护或无 beam 约束。
- 已经正式触发、且只有“结算奖励/跳过奖励”的 residual card settlement 在搜索中确定性结算，
  不展开可重复出现的 skip 分支。该策略可能漏掉资源接近上限时延迟领奖，但避免同一未消耗
  trigger 在后续每个事件上重复形成指数分支；通过 `targetEquivalentChoicePrunedCount` 记录。
- 单次固定盘面 Decision 必须先通过 10 秒门槛，之后才运行完整固定盘面。
- 定向测试覆盖门槛两侧、第一行满后的扫描/探测器/卡牌/角标目录、未满足门槛的快速转换
  不可达，以及真实 analyze 完成。
- 完整固定盘面记录分数、分析次数、数据来源、节点数和单次最慢决策。
