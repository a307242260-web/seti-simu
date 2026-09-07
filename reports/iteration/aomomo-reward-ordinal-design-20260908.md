# 奥陌陌奖励次数独立修复

2026-09-08；基于 3da3ccdd。修复规则错误，不修改搜索预算、路线依赖或估值。

## 冻结方案

正式规则见物种 implementation.md 与 mechanics-reference.md：首次环绕额外一张牌，
前 3 次登陆额外 3/2/1 数据。此前正式能力复现中首次的实体编号 17 被误传成奖励次数。
implementation.md 引用的 face_detail.md 当前不存在；不以缺失文件充当已读取证据。

| 边界 | 唯一职责与实现 | 验证义务 |
| --- | --- | --- |
| 面板标记 | aomomo.addOrbitMarker/addLandingMarker 保留全局实体 sequence、id、owner | 从 17 开始，交错两种动作后编号连续且身份不变 |
| 能力结果 | planet.orbitProbe/landProbe 以新增后对应面板总数返回 markerSequence，payload 同步 | 预告次数与执行次数一致，不按单个玩家计数 |
| 登陆规则覆盖 | 既有 getLandRewardMarkerSequence 保留 forceFirstLandingReward | 实际第 5 次仍可按第 1 次奖励，不改实体或实际次数 |
| 奖励消费者 | planet-rewards 构建器、probe-turn-session 主行动、play-domain 登陆共用结果 | 首次环绕牌、前 3 次数据及后续无额外奖励；不新增奖励表 |
| 原生状态与恢复 | 不新增状态、不改 RNG 或 sequence 分配；保存已有面板与 meta 足够恢复次数 | 序列化恢复后继续第 2/3/4 次；资源不足失败不改变面板、资源、火箭和序号 |
| 选择与事务 | 原有 legal/stale 校验、成本、火箭移除、事件、回滚边界不改 | 保留普通行星、卫星、多火箭选择既有回归 |
| 旧入口 | 仅删除两条 AoMoMo 能力结果把实体序号当次数的路径 | 全仓 markerSequence 消费者核对；实体编号仍用于显示和身份 |

这里不是状态机迁移，没有新增 Decision owner、回调、异步边界或隐藏信息处理。
局部规则回归先复现失败，再一次实现两条能力路径。需要补 Production composition 奖励结算
证据，之后按标准入口唯一全盘登记。当前固定盘面为阿米巴/虫族，预期分数不变；本修复
不解释棕方下降，也不据此宣布性能 Goal 通过。全盘前仍验证单决策门槛，不能重复旧全盘。

## 验收状态

已实现能力输出次数与实体编号分离，普通行星/卫星路径、全局序号、事件及奖励表不变。

- 新增 actions 回归在修改前失败：17 !== 1；修改后通过。相关 actions 3 项、aomomo
  1 项、probe-turn-session 1 项 unit，以及唯一 full-flow 1 项通过。
- 正式 Production 队列证据：`aomomo-reward-ordinal-verification-v2-20260908.json`。
  前四次登陆实际到账数据 3/2/1/0，每次 9 分、2 化石；首次环绕到账 1 张牌，第二次 0 张；
  两次均 10 分、1 化石、1 扫描所得数据。标准输入全部成功，标记实体编号仍为 17+既有次数。
- 该诊断通过合法开局生成状态后，用正式 checkpoint 恢复隔离规则场景，不运行 AI。
  首次诊断夹具错误地替换整个 aliens，遗漏九折状态，被冻结观察显式拒绝；未修改生产
  代码绕过。v2 保留正式初始化的其他物种状态，仅修改本次相关状态；旧失败 checkpoint 保留。
- 序列化恢复/不同 owner/强制首次奖励在能力单元回归覆盖；实际 composition 证据覆盖
  标准环绕/登陆奖励，不外推卡牌完整链或浏览器交互已验证。
- 已检查 README、AGENTS、PROJECT_MEMORY、ai-design、rl-simulation-env 的相关描述；
  没有字段 schema 或入口变更，无需改动。同步更新物种 implementation 与 mechanics-reference。
- 语法与 diff 检查通过。尚未执行本版本固定全盘、单决策性能复核与版本登记；本项未收口。
  固定盘面分数下降和第 356 步计划无效重搜仍待解决，整体 Goal 未完成。
  后续完整局已完成，见 [完整验收](aomomo-reward-ordinal-full-review-20260908.md)：
  640 步均 101.75，动作/状态/非耗时搜索统计不变，规则失败 0，本项通过，整体性能未通过。

### 全盘前单决策复核

第 306 步真实盘面，修复后 13673.275ms（前版 13907.053ms），控制 1 节点/1 输入，
战略 4096 节点/4981 输入，仍截断；失败计数为空。决策、各根选中计划、评分和节点/
输入计数与前版一致。通过 30 秒单决策门槛，不把这次计时差称作性能改善。

证据 `brown-round3-root-aomomo-ordinal-20260908.json` 保留首次比较失败：内存结果与旧 JSON
比较时，负零和可选 undefined 字段被 JSON 转成 0/省略，导致诊断断言不等。
对同一份已落盘 JSON 与旧 JSON 逐字段重验通过，未重跑搜索，也未过滤实际规则失败。
相关可选字段是隐藏牌身份与无计划结果，不能把 JSON 比较通过外推为全局零异常。
脚本比较改为两侧同一 JSON 格式。该诊断修改不改变生产实现。
