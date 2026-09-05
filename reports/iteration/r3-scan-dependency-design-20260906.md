# 第三轮扫描计划依赖：反例与设计义务（2026-09-06，未冻结）

## 已证实的实现偏差

当前逐步计划仅采集扇区竞争/结算事实，不采集扫描触达来源。隔离正式输入中，无公共牌、
无紫2，先正式执行scan与地球sector-1-a选择并采集执行前证据。恢复相同输入，只改变
太阳系wheel1Steps=2，地球扫描来源变为sector-2-a。编译出的scan步骤仍被planReuseCheck
判hit；正式提交扫描扣费后，原定sector-1-a已不在合法选项，只有sector-2-a。

证据：`r3-scan-access-dependency-20260906-v2.json`和生成器
`adhoc/audit-r3-scan-access-dependency-20260906.js`。观察、原始隔离状态、步骤、复用
结果及付费后正式合法集全部落盘。未调用AI搜索，不是历史优胜计划，也不能解释固定
盘面11分差距。最初记录使用诊断自定义routePlanId；v2改用生产目录的
`sector:standard-scan:sector-1-a`后仍复现；两份记录保留，正式证据以v2为准。

这是第三轮“逐步检查计划依赖”的遗漏。S2目录输出已经随盘面正确变化，不能再归咎
缓存，也不能只在scan提交后用下一步非法来代替提交前的依赖检查。

## 已核对的执行边界与完整义务

| 边界 | 正式来源/owner | 必须满足的依赖语义 |
|---|---|---|
| scan之前及同目标资源准备 | science-session.scanQueue、scan-effects.buildScanEffectQueue | 未来所需来源丢失应在不可逆扣费前失效；不能只看scan是否合法 |
| 地球/紫1/紫2 | 正式solar行星坐标、扇区分配、有效科技 | 区分具体来源、选择范围与次数；整个accessSources并集不足以表达地球/水星来源交换或重复标记 |
| 已创建的普通扫描队列 | scanQueue将地球/水星坐标或紫1 nebulaIds写入SCAN_STEP payload | 不能用执行中当前太阳系位置覆盖已绑定队列；来源检查须区分尚未创建和已创建阶段 |
| 公共扫描 | scanStepChoices(public)、publicScanChoices、resolveScanStep | 具体卡/槽、扫描码、selected/max与可追加次数；自身消费后的下一步基线更新，完成前不补公共牌 |
| 紫3手牌扫描 | handScanChoices及正式弃牌提交 | 具体私有牌和有效科技；不暴露隐藏新牌，不用公共牌依赖替代 |
| 紫4及哨兵派生扫描 | SCAN_ACTION_4→正式发射/移动→地球扫描→FINALIZE | 嵌套效果也在同一正式扫描流；不能将其混同主行动最初的地球扫描 |
| 卡牌/奖励扫描 | SCAN_STEP any/color/specified/planet/landing/probe/conditional | 固定颜色/扇区不依赖无关旋转；planet/landing/probe/conditional依赖各自正式来源，不把所有扫描强套standard-scan |
| 步骤来源与目标段 | rule-composition三个正式提交入口、origin元数据、compilePlanSteps | 同一目标可跨多次scan；完成pending/后继目标不能继承已完成来源；折叠步骤和条件根不能漏证据 |
| 正式状态/Decision/失败 | Production session与现有inputPort | 不新增执行器、假提交、RNG/id/sequence或恢复字段；缺必要来源证据显式失效，不能补generic |
| Browser/Simulation | 共用观察、决策函数与协调器 | 单一viewer-safe来源；当前公开decision仅有owner/type/count，不足以识别SCAN_STEP mode或来源 |

## 方案选择前必须闭合

优先评估复用正式扫描来源的只读投影，而不是在计划模块重新实现scanQueue。需要明确
该投影是“尚未创建的来源能力”还是“已创建的具体队列”，及它如何沿三类正式提交
和每个origin携带到步骤；不可把当前无成本能力并集宣称为完整队列/可达性证明。

不采用“任何太阳系旋转都失效”：它会破坏无关变化可复用的已批准要求。
不采用“扫描动作仍合法就继续”：当前反例直接证明不够。
不采用重放/重新搜索每个后续动作预测其合法性：会引入第二套执行或抹掉计划复用目标。

冻结前需完成全部SCAN_STEP模式、嵌套来源、生成时点与消费时点的对应矩阵，再选择
最小共享正式primitive及观察接口；目前只完成反例与上述执行审查，**未冻结、未改生产**。

## 验证门禁

1. 修复前上述反例hit，修复后必须在scan扣费前miss；无关旋转且计划来源不变则hit。
2. 来源并集相同但具体来源/次数不同、公共牌自身消费、借用科技过期、紫4嵌套、
   队列创建前后、独立条件根、跨目标完成阶段，分别使用正式规则输入验证。
3. 自身计划内推进保持逐步基线，未知/隐藏证据拒绝，不恢复全状态比较或同回合旁路。
4. 必要unit、唯一fullFlow、V输入审计；两项用户指定旧失败继续排除修复范围。
5. 真实单决策性能≤10秒后中文提交；干净版本标准去重快速→完整终局，仍对比106.75，
   正确性与效果分别核对。不得预先把此反例当成11分损失的因果证明。
