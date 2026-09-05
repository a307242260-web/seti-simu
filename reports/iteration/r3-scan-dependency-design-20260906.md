# 第三轮扫描计划依赖：反例与设计义务（2026-09-06）

## 当前实施范围：标准扫描首步几何依赖（设计冻结）

以下是本次工程判断，不将用户提醒直接当作纠偏结论。此前全来源审查保留为风险
目录，但通用来源追踪、事件协议和全部卡牌/外星人扫描改造不作为本次前置任务。
已复现的两个反例均改变标准扫描必执行的首个地球扫描范围；其来源可在既有正式
scanQueue创建之前计算，无需新事件或持久化字段。此次只修这个明确遗漏。

| 项目 | 冻结实现/义务 |
|---|---|
| 唯一来源 | science-session导出getPlanetScanSource，复用solar正式行星数组和扇区映射；原scanQueue的地球/紫1/水星几何计算改为调用此函数，费用/顺序/可选性不变 |
| 公共只读事实 | Production sectorWinRequirements新增standardScanEarthSource，按buildScanEffectQueue第一项的正式type计算；普通为sectorX，紫1为nebulaIds。缓存键包含此值，不能因并集相同沿用旧首步 |
| 计划采集/作用域 | capturePlanStep保存该公开事实；同目标段剩余步骤含scan时加入具名scan-earth依赖。扫描本身及此前资源准备受约束；其后段没有未来scan则不继承已绑定几何 |
| 预期变化 | 外部改变地球扫描源时，scan扣费前miss；无关轮盘变化但正式首步范围不变则hit；自身按计划推进后按下一步基线比较 |
| 缺失/旧会话 | 需要scan-earth却缺事实则明确miss；已有队列中的独立条件根无未来scan，不凭空要求新事实。load/reset继续清空瞬态计划 |
| 状态与算法 | 不改canonical/session payload/journal/RNG/id/sequence、Decision owner、事务、搜索状态等价、预算和评分；只是正式几何函数复用及公共观察/计划元数据 |
| 排除项 | 不声称修复卡牌触发完整扫描、单独卡牌/奖励/异常点/盲抽扫描的全部前置依赖；这些在风险目录单独保留，不因本项通过而关闭 |
| 验证 | 两个已有正式反例修复；无关轮盘同范围命中；已创建队列不错误继承；准备步骤到scan前一致；缺事实拒绝；正式扫描收费/顺序不变；单决策≤10秒后提交并标准去重全盘 |

实现文件限制为science-session、production-kernel、plan-continuation及相关测试/文档；
不修改runtime、card factory、反事实事件协议。相关Node/V审计和固定盘面106.75双门禁
保持不变。此范围不是第三轮全部义务的替代；第三轮仍需完整效果验收。

## 历史审查与独立风险目录

以下保留此前广义扫描来源方案的取证与设计问题，供独立任务追溯；其中“必须闭合”、
“下一项设计决策”等要求针对该广义方案，不作为本文顶部已冻结首步修复的前置门禁。

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

上述SCAN_STEP路径由同一个scanStepChoices/resolveScanStep执行，9种mode为有限集合；
这不是全部扫描执行闭包，后续核对发现另外两个直接入口，见文末。不能只为公开顶层
行动或SCAN_STEP补事实。

## 下一项设计决策

单纯从当前action.target推断来源不可行：普通地球、付费水星、奖励specified在动作
描述符上都是nebula/sectorX；来源信息在部分factory已经被丢弃。当前公共观察的
decision也没有mode或绑定时点。必须先确定正式来源身份如何在创建/prepare/后继间
保留，并以viewer-safe只读形式给逐步证据使用；不能从中文label猜来源。

之后才能定义来源依赖在动作前、已绑定队列内及目标完成阶段的生命周期。若需要为
正式effect增加只读来源元数据，必须同时列明持久化/旧checkpoint/隐藏信息契约，
重新审核前文“不新增恢复字段”的初步约束，不得在实现中临时增加字段。
目前仍未冻结，不写生产patch；已排除并集指纹和事后从journal反推两个不完整方向。

## 完整执行入口复核与接口约束（2026-09-06）

从实际扫描执行函数反向核对，而不是只搜SCAN_STEP类型，发现此前生产者矩阵还需
增加两条直接路径。当前`executeNebulaScan`在生产代码有三个调用点：

| 调用点 | 来源、绑定与实际执行 | 隐藏/恢复义务 |
|---|---|---|
| science-session.resolveScanStep | 前述9种mode、正式队列与所有对应factory | prepare/公共后继保留绑定；自动单目标也要采集，不能只在用户Decision前采集 |
| cards.play-domain.resolveNebulaScan | DRAW_THEN_SCAN：正式盲抽后按扫描码确定scanNebulaIds，随后独立Decision；选中后弃掉抽到的牌 | 抽牌前不能将未来scanNebulaIds写进可用计划依赖；抽后新的独立根可读取已知牌。skip和discardDrawnOnSkip不产生扫描收益 |
| cards.play-domain.executeYichangdianNextAnomalyScan | 正式地球位置→yichangdian.getNextAnomalySectorX→扇区，直接扫描并追加FINALIZE | 无条件Decision步骤，不能靠未来action.target推断此依赖；依赖地球及已公开异常点布局，未揭示信息仍遮蔽 |

三处均复用science.executeNebulaScan→abilities.executeAbility("scanNebula")，没有
理由将后两处迁回SCAN_STEP；本任务只补计划证据，不改变其执行owner、盲抽/弃牌顺序、
结算时点或RNG。对生产game目录直接扫描调用的反向搜索已核对这三个入口；仅统计
SCAN_STEP类型或顶层action.family===scan不足以界定本任务集合。

### 已确定的接口职责（尚未冻结生产签名）

1. **来源必须由正式生产者给出**：普通队列、card factory、probe奖励、紫4哨兵、
   DRAW_THEN_SCAN与异常点直接扫描分别说明其来源；不由计划模块从坐标/收费/label猜测。
2. **生成与消费分开记录**：位置在创建队列时绑定的来源，绑定完成后不继续依赖当前
   行星位置；实时读取来源持续检查到其正式消费边界。自动效果与折叠提交也须覆盖。
3. **同一执行链采集**：继续使用rule-composition三类正式提交的成功步骤链；新增来源
   信息必须能关联到这些步骤，不改现有actionChain、节点/执行计数、RNG或目标排序。
4. **只给计划可见事实**：projection(viewer)由Production读取正式根/session，再经
   rule-observation输出；当前sanitizeHiddenInformationObservation只遮蔽既有字段，
   任何新增来源字段都必须纳入遮蔽，尤其是drawnCardId/scanNebulaIds。不能因为字段不叫
   hand就把新抽牌内容传入计划。未知来源证据显式miss，不补默认事实。
5. **生命周期有明确端点**：从同目标段的前置准备传播到绑定或实时消费的那一步，
   随advance推进。绑定后的步骤继续检查其具名扇区/公共牌等依赖，不继承已完成来源。
6. **旧checkpoint**：正式规则仍按既有payload正常执行；旧checkpoint不含新来源信息
   时，不得猜来源使计划命中。计划是瞬态且load/reset清空；读取旧会话的缺证据应有
   明确miss，不使规则恢复失败，也不引入第二套旧版规则执行。

剩余设计问题已经收敛为一个：选定正式来源的携带位置，并使“创建/消费对应哪次
正式提交”的关联可机械验证。当前session journal.effects不保存已执行payload，
但applyResult会正式归档events，且撤销按journal长度回退；若用事件携带，必须同步
定义事件增量去重、失败不入成功步骤、信息遮蔽与checkpoint续接，不能只加一个来源字段。
该关联闭合后才能冻结批量实现，当前不宣称设计已完成。
