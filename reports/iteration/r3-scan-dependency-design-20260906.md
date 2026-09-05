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

## 来源顺序反例及生成入口核对

`r3-scan-source-order-20260906.json`使用原隔离盘面紫2、3宣传，无公共牌；仅将
wheel1Steps由0改成4。两者accessSources完全相同，都是sector-1-a/sector-4-a；
但正式第一次地球选择从sector-1-a变为sector-4-a，第二次水星选择反向交换，第二次
均实际扣1宣传。故“只增加标准扫描来源并集指纹”仍漏判，不能作为完整修复。
两组完整非零session checkpoint、实际选择和支付前后资源已落盘，没有AI搜索。

checkpoint中的正式queue证明普通地球/水星被保存为specified模式及sectorX：地球5、
水星1，水星另带cost={publicity:1}/skippable=true；prepare生成的Decision复制同一
options。此证据证明绑定的保存形状，**没有模拟队列创建后的真实旋转事件**，不将它
当作该事件的行为测试。session journal.effects只保留effectId/type等，不保留已弹出
effect的完整payload；不能事后靠parentEffectId恢复丢失的具体来源。

全仓正式生产者闭包目前核对如下（不是仅枚举SCAN_STEP执行器）：

| 生产者 | 产生的输入 | 绑定时点与来源保留现状 |
|---|---|---|
| science.scanQueue | 地球/紫1/水星specified；public；hand；紫4决策；FINALIZE | 地球/紫1/水星在建队列时绑定；队列项不保留原planetId，仅sectorX或nebulaIds |
| cards.play-domain.createSpawnedCardEffect | 7类基础扫描mode：specified/any/color/planet/landing/probe/conditional | 保留cardInstanceId和cardEffect；planet/landing/probe/conditional在scanStepChoices消费当前规则状态 |
| 同一card factory的PUBLIC_SCAN | public、selected/max/consumeMarkers=false | 后继公共选择复制options；不等于普通scan的额外信号标记计数 |
| 同一card factory的SCAN_ACTION | science EXECUTE中的完整scan（skipCost=true） | 仍经science.scanQueue；不能仅检查顶层action.family===scan，否则漏掉打牌触发 |
| probe-turn.REWARD | 行星扫描/任意星云/颜色奖励统一specified | 转交时把planetId解析为sectorX；扫描作为单节点流附FINALIZE |
| science.SCAN_ACTION_4 | 哨兵发射后追加地球specified | 发射执行后解析当时地球；位于原扫描流FINALIZE前，不是原始地球步骤 |
| science.SCAN_STEP prepare/resolve(public) | Decision或后继公共选择 | 复制已有options，不是新的来源；自身消费按selected推进，不提前补牌 |
| residual-domain旧扫描入口 | 委托card factory | 不是第二个扫描执行器；不得恢复旧扫描实现 |

以上终点均由同一个scanStepChoices/resolveScanStep执行，9种mode为有限集合。
卡牌效果链及奖励的后续/嵌套调用必须沿既有factory进入，不能只为公开顶层行动补事实。

## 下一项设计决策

单纯从当前action.target推断来源不可行：普通地球、付费水星、奖励specified在动作
描述符上都是nebula/sectorX；来源信息在部分factory已经被丢弃。当前公共观察的
decision也没有mode或绑定时点。必须先确定正式来源身份如何在创建/prepare/后继间
保留，并以viewer-safe只读形式给逐步证据使用；不能从中文label猜来源。

之后才能定义来源依赖在动作前、已绑定队列内及目标完成阶段的生命周期。若需要为
正式effect增加只读来源元数据，必须同时列明持久化/旧checkpoint/隐藏信息契约，
重新审核前文“不新增恢复字段”的初步约束，不得在实现中临时增加字段。
目前仍未冻结，不写生产patch；已排除并集指纹和事后从journal反推两个不完整方向。
