# 探测器扫描执行契约修复

状态：已按下表整批实现，8模型定向规则测试及9个正式composition场景通过；
固定完整局已完成，但非probe透传范围复查未通过，候选不得收口。本项为移动需求目录接入前发现的独立执行缺陷，不计作
移动搜索已优化，也不改变4096预算或启发式分值。

## 2026-09-07规则复核与实现矩阵

已读取本地官方FAQ `rules/seti-faq-base-en-202411.pdf` 第14、17、20页完整相关页。
第14页限定太阳系探测器并要求先移动后标记；第17页英文b22（印刷编号88）是
“一个有己方探测器的扇区”内两次标记，因此采用一次来源选择、同扇区重复；第20页
b88（印刷编号120）回手发生在扇区结算前，标记导致扇区完成也不影响回手资格。
官方来源：https://czechgames.com/files/other-pdf/seti-faq.pdf 。在线读取受限，复核
使用既有本地副本，没有覆盖或重新下载旧文件。

全242模型递归复核后，PROBE_SECTOR_SCAN闭包仍只有8处：b22/b50/b53/b54/b58/
b64/b88/b96，没有外星人卡嵌套同型效果。下表为本次完整执行设计，不扩大到其他扫描模式。

| 边界 | 唯一责任、状态与行为义务 | 删除/验证证据 |
|---|---|---|
| 模型展开 | Card Effects保留probe repeat，不在来源选择前拆散；其余repeat规则不改 | 8模型构建均一项来源流程，旧probe预展开归零 |
| Card Play桥接 | 完整传递owner/maxTargets/repeat/includeAdjacent/gainData；b88提供现有RETURN_PLAYED_CARD_TO_HAND_IF的具体后续effect，保留cardInstanceId | 不新增Science搬卡实现；其余卡牌回手契约不变 |
| 来源选择 | Science SCAN_STEP probe模式；普通太阳系探测器，按owner过滤；choice含rocketId及当前nebulaId；b50保留结束、最多3个不同实体 | 无对手错误过滤、无按扇区去重丢同格多艘；已选不得再选 |
| 单来源扫描 | 来源确定后转换到现有specified模式，剩余次数与来源身份保存在payload；b22/b64两次、b96三次且不取数据 | 不重新选择另一个探测器；每次仍executeNebulaScan，逐次正式事件/序号 |
| 邻接扫描 | b58保存原扇区和两邻接扇区的剩余义务；多于一个时允许选择顺序，每个一次 | 不将三次缩成一次，不硬编码不可证的固定顺序 |
| 多来源继续 | b50每艘扫描结算后继续来源Decision，已选集合随payload；最多3艘或主动结束 | 每个来源一份信号，同格仍可标记两次；无额外SETTLE |
| 卡牌回手 | Science只提供该信号结算后/流末结算前的正式扇区计数事实；具体回手effect由Card Play验证并执行 | 原卡实例从弃牌/保留区回手，不创建替代卡，不静默忽略缺事实 |
| 异步/事务 | 所有新选择、剩余义务、卡实例及后续effect进入正式payload；state/RNG/实体ID仍由既有runtime执行和恢复 | wrong-owner/stale/恢复重放由公共输入链验证；无外部callback或模块级游标 |
| 计划依赖 | 源选择descriptor标识probe扫描来源；capture/compile读取实际被选探测器事实，计划复用检查位置/owner/存在性 | 不仅保留扇区排名而漏来源；奖励完成前不提前截叶 |
| 规则结束 | 仍使用Card Play原链尾SCAN_FINALIZE，回手在其前；现有SETTLE处理痕迹/RNG/补牌 | 单张牌一次流末结算，零新增独立扫描执行器 |

验证门禁：先加入覆盖上述分支的正式owner单测并确认旧版失败；整批实现后运行
定向规则/计划测试、现有全量回归及V输入审计。再用正式composition确认b50多来源、
b58全扫描、b88完成扇区回手及恢复；单点42必须零规则失败、计划可重放且30秒内。
生产提交后才运行唯一固定完整局；分数下降必须解释，不用策略补分。

## 修复前规则与证据（历史反例）

本地牌面已读取：`assets/cards/basic/split/b_50.webp`、`b_58.webp`、`b_88.webp`、
`b_22.webp`。b50明确“至多3个探测器（你或其他玩家的）”，每个扫描对应扇区；
b58明确在有己方探测器的扇区和两个相邻扇区各标记一个；b88说明标记后该扇区
恰有己方1个信号则回手。b22中文复数扫描图标本身不足以消除来源选择的歧义，
正式模型声明maxTargets=1、repeat=2，须继续核对来源锁定规则后冻结实现。

`probe-scan-contract-reproduction-20260907.json` 使用真实42盘面派生隔离状态，
调整两艘坐标/其中一艘owner并替换测试手牌，调用正式Card Play PLAY→Science
SCAN_STEP的prepare、合法集、resolveDecision；不是完整session、CAS或RNG
重放，b58的前置移动没有执行，验证的是该移动后扫描节点的职责。

- b50：对手探测器扇区不在合法集；只有一个扫描节点，选择后无第二/三艘后续。
- b58：只有一个扫描节点，选择后无两个相邻扇区扫描。与本地牌面明确矛盾。
- b22：拆为两个独立扫描节点，第二次仍可选择两艘所在的不同扇区。该行为已证实，
  与模型单来源意图不符，但不能仅凭模型把来源锁定认定为已核准规则。
- b88：转换和prepare均未转移回手条件/卡实例，源码存在缺口；尚无回手行为反例，
  不以源码检索替代规则执行验证。

## 根因及完整方案边界

1. Card Play转换PROBE_SECTOR_SCAN只输出mode/gainData/label，丢掉owner、
   maxTargets、includeAdjacent及回手条件。后续Science prepare又只保留options，
   卡实例与原效果身份未传到Decision。
2. Science probe模式把己方太阳系棋子映射为扇区并去重，没有探测器身份；同格
   两艘在b50下应有两份扫描义务，不能按同扇区提前合并。
3. effects.expandEffects预先展开repeat，尚未选择来源就拆成多个独立选择。
4. 因此不能只把options spread进去。需在同一Science扫描流程先确定合法来源，
   再由现有指定扇区SCAN_STEP完成每个实际信号，保持SCAN_FINALIZE只在整串末尾
   结算。不得恢复第二套扫描结算器或提前结算扇区。

| 实现义务 | Owner与证据 |
|---|---|
| 来源目录 | 复用正式棋子/盘面读取，区分己方/任意玩家、普通探测器/化石；公开需求目录与正式选择同源 |
| 至多多来源 | b50保留结束和不同探测器身份，已选择不能再次选择；同扇区多艘不能丢份数 |
| 固定扫描义务 | b58为原扇区及左右扇区各一次；重复类先核准来源语义，再统一生成指定扫描序列 |
| 真实执行 | 每次标记仍调用现有executeNebulaScan，保留gainData、signalMarked、奖励插入及流末SETTLE |
| 回手 | b88按对应扇区的正式己方信号计数；复用Card Play卡实体归属和移动责任，不在Science另写卡实体搬运旁路 |
| 身份与恢复 | 卡实例、源探测器、已选择集合、未完成扫描义务进入正式effect payload；Decision owner/version、恢复与计划重放验证 |
| AI接入 | 来源/扇区选择的descriptor与目标推进匹配必须同步，不能正式规则修对后让AI报空或执行失败 |
| 验证与登记 | 全部8个当前普通/DLC模型及全模型递归检索复核；单决策时间/节点/输入/计划通过后按唯一版本跑固定局 |

上述矩阵已在生产patch前冻结；旧版定向测试先在b22来源预展开断言失败，然后整批
实施。原有effects.test中b22/b64“两个独立节点”的断言已改为单来源保留repeat，
实际信号次数由Science owner和正式composition验证，不恢复旧拆散路径。

当前证据：probe-scan-production-20260907.json的9个正式场景包含b50选择0/1/3艘、
b58完整移动后扫描、b88首次/已有信号/完成扇区三情形，以及b22/b96重复。16个
Decision逐一保存、恢复再提交，完整envelope/RNG/序号一致，每场景一次SETTLE。
源变化依赖同时检查探测器与sectorBySlot，避免棋子未动但星云扇区映射变化时误复用。

文档核对：AI设计、RL接口、卡牌DSL、mechanics-reference及测试清单已同步；
README/AGENTS入口、浏览器装配、部署方式未变化，无需更新。完整局结果见下。

提交前验证：最终42冷决策14.889秒、4096物理节点/4804正式输入、0规则失败，
根动作仍place_data:dbe01b29，30个计划输入全部正式重放成功。前一份15.338秒
证据早于补齐来源扇区布局依赖，不替代最终代码验证。见
`probe-scan-final-decision-42-20260907.json`；本项没有声称减少该热点节点。
全量回归77/79 unit、1/1 fullFlow通过；剩余为既有beam断言和data目标释放断言，
没有新增失败。V输入审计通过。PROJECT_MEMORY长期规则未变，无需写入本轮流水账。

## 完整局与范围复查（def25c80）

证据：`probe-scan-full-verification-20260907.json`，原记录
`reports/research/b48d2904.def25c80.full.json`，仅一次全盘。
581步终局113/95/135/112、均113.75；167搜索、124241节点、152820正式输入、
0规则失败、32截断、444391ms。前版572步均107、116451节点、31截断、416701ms。
首个实际动作差异433：白方由b17改打b58。与本次规则有关的卡已进入实际选择，但
尚未隔离证明全部得分变化原因，不能把均分提升认定为正确性或性能验收通过。

发现的范围偏差：SCAN_STEP generic prepare原先只传options，本次clone整个payload
不仅保留probe证据，也改变非probe Decision的卡牌元数据。其他扫描模式不应随本轮
改变，且元数据可能参与搜索状态身份；影响是否导致本次分歧尚未证实。

下一次生产修改前冻结的收紧义务：仅mode=probe或options.probeFlow的扫描继续
保留卡实例与回手后续，其他模式维持原options边界；覆盖源选择、多来源再次选择、
邻接多目标Decision、重复单目标自动执行和回手。不得删除真实扫描修复，也不得
改变卡牌主链、RNG、ID或Decision owner。用非probe原边界断言、现有8模型、9个正式
场景/恢复和42单决策复核，再以新提交运行唯一固定局。本版记录保留，不重跑覆盖。
本候选范围门槛未通过；none/undefined完整核验、目的式移动与place_data仍未完成。

## 透传范围收紧（1f0d82ec，局部通过）

严格按上节已冻结边界实施：generic prepare仅在mode=probe或options.probeFlow时
保留payload，普通扫描仍只传options。未改变任何扫描目标、信号结算、评分或预算。
先以正式specified多扇区扫描复现Decision多出cardInstanceId/cardEffect，收紧后
specified及color原边界断言通过；既有8模型扫描与计划测试通过。正式Production
9场景、16次Decision恢复验证全部通过，证据`probe-scan-scoped-production-20260907.json`。

边界验证期间另见独立缺陷：mode=any调用listNebulaChoices时未提供nebulaIds，
而该函数默认空数组，实际prepare输出零个后续。初始测试实测0而非1，未进入payload
断言。该问题不是本次透传产生，不在本次改动中混修；下一独立修复需复核全部any
调用者、正式完整扇区目录以及无数据/奖励/保存恢复边界。不得将无目标跳过当作正常
完成。此项与现有未分类none一起保持未解决，不宣称零异常门槛已通过。

文档同步检查：本次只调整Science内部Decision保留范围，RL接口与本设计同步；
AI评分/计划契约、mechanics规则、DSL、README/AGENTS入口、运行方式及长期记忆
没有进一步变化，无需修改。既有扫描测试文件已在Node清单内，无新增测试入口。

收紧后单点42：15.406秒、4096节点、4804正式输入、0规则失败、30个计划输入
重放成功，根动作不变；见`probe-scan-scoped-decision-42-20260907.json`。未证明提速。
全量回归77/79 unit、1/1 fullFlow；失败仍为既有beam与data目标释放断言，未新增。
未新增V输入路径，不需要新增装配审计；语法通过。完整局在生产提交后按新版本登记。

完整局已完成且仅运行一次：`reports/research/ddc98722.1f0d82ec.full.json`。
581步终局113/95/135/112、均113.75，全部动作及终局状态同def25c80；
167搜索、124241节点不变，正式输入152820→152813，0规则失败，32截断不变。
耗时444391→440588ms，不据此宣称稳定提速。对比证据见
`probe-scan-scope-full-verification-20260907.json`。范围修正按均分不变且边界
合理通过；整体Goal未通过。any空目录/重复义务另见any-scan-design-20260907.md，
不能用本局零规则报错掩盖被静默跳过的合法扫描。
