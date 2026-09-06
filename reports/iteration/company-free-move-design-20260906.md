# 公司免费移动执行设计（2026-09-06，生产修改前冻结）

目的：修复真实第605步四个合法方向全部执行失败的既有缺陷，不调整搜索预算或评分。
卡面 `assets/industry/寰宇动力.png` 明示“最多2个探测器”，每个1移动力且不同。
共享卡牌移动 `play-domain.js:listMoveChoices/resolveMove` 同样允许结束移动。

## 有限执行闭包

| 来源 | 入口 | 次数与后续 | 唯一执行责任 |
|---|---|---|---|
| 寰宇动力 | companyQueue:huanyu_free_moves | 最多2次；已移动火箭不得再次选择 | Residual COMPANY_DECISION → moveProbe |
| 层云核心 | applyCompanyChoice:stratus_corner | 角标奖励产生1次移动，其他角标继续原队列 | 同上 |
| 芬威克 | applyCompanyChoice:public_card | 精选与角标奖励之后1次移动 | 同上 |
| 哨兵 | industry_sentinel_corner | 打牌角标产生1次移动 | 同上 |
| 寰宇后续 | applyCompanyChoice:free_move | 剩余次数减1、记录已移动ID；无目标直接结束 | 同上 |

五个产出点复用一个构造函数：仅有合法可移动火箭时创建现有Decision；无目标不是执行失败，
不创建空Decision。已有Decision始终提供“结束移动”，以保留玩家放弃剩余移动的权利。
不新增effect类型、兼容宿主、搜索快路径或另一套移动规则。

## 状态、输入、事件和恢复义务

- 枚举和执行共同复用 science.createActionContext 与正式 rocket 移动能力。方向使用
  顶层deltaX/deltaY，movementPoints=1、cost={}、source=industry，不补付费用或改变地形。
- root.pieces保存位置，root.players保存宣传奖励；remaining/usedRocketIds归现有effect.payload。
  moveProbe没有抽牌或实体生成，不增加RNG/实体序列；后续任务仍由现有事件消费者负责。
- moveProbe.events原样通过applyCompanyChoice与COMPANY_DECISION结果交给正式事件链，
  不另算奖励，不自行补发visit事件。结束移动记录显式company_move_skipped事件。
- 启动时仍按正式公司primitive消耗1x；结束或无第二目标不退还标记。公开牌补牌屏障不改。
- COMPANY_DECISION重新枚举并匹配actionId；正式输入层保留owner/version/CAS校验，
  非法、过期或其他玩家动作不应修改committed state。恢复继续使用原Decision类型和payload。
- 删除五处重复构造及嵌套target方向传参；不改其他公司效果和卡牌移动owner。

## 可证伪验收

1. 数字ID的真实太阳系火箭，所有公开方向都能执行；位置变化符合方向，信用/能量不变。
2. 一艘火箭移动后没有空后续Decision；两艘时第二次排除首艘，可继续也可结束。
3. 四类来源都复用同一构造；无火箭的角标移动不阻塞后续，已有Decision可显式结束。
4. 到达奖励与move/visit事件只结算一次；非法actionId拒绝且root不变。
5. 从既有第605步检查点测试全部合法选项、非零pending恢复一致，再执行一次真实AI决策，
   记录节点/正式输入/失败/耗时及实际胜出计划。单步通过不等于全局效果通过。
6. 定向unit与唯一full-flow回归后中文提交；固定盘面严格按登记去重，终局门槛仍108.5。

范围备注：机制手册旧文写“可补移动牌/能量”，当前公司枚举只接受1移动力，本轮不把这一
既有差异混成参数错误修复，也不以删文档宣称补付机制已实现；后续单独核实。
## 实施与行为验收

已按上述五个产出点一次实施；未改搜索器或移动能力本体。现有Residual unit扩展覆盖
四来源有/无火箭、单艘结束、两艘排除重复与可结束、非法首艘重选不改状态、到达水星
宣传+1及唯一visitPlanet事件。构造测试曾因选取小行星起点、芬威克宣传不足失败，
按正式地形/费用契约修正fixture，未放宽生产规则。

真实605：四个原有移动选项及新增结束选项均成功，逐项pending恢复后的完整检查点和
合法动作一致；记录company-free-move-contract-20260906.json。回归77 unit + 1 fullFlow
通过（6.59s + 0.51s）；按用户既定要求排除simulation-counterfactual-outcome与
strategic-goal-evaluator，不宣称包含这两项的全量通过。

文档一致性核对：更新公司能力、机制手册及性能计划；README/AGENTS/AI设计/RL接口的
入口和状态schema未变，无需改动；不修改长期记忆。单步搜索和固定终局效果仍待验证。
