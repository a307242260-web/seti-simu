# FIXED-WORLD-01：固定局可比性插入修复

2026-09-13用户确认：固定种子应固定牌序、外星人及基础盘面，不同策略在同一基础上比较。
用户进一步明确：包括科技顺序、每轮末可选牌及尚未揭示的信息；是整局底层配置固定，
不是只锁当前已揭示结果。所有这些要求均为本项验收范围。
起点329bd8a0；临时目录/tmp/seti-fixed-world-20260913.uLB8c7/repo。
预算专项和PLAN-SYMBOL-DEPENDENCY-01暂缓；后者证据已在独立目录cff7e8d5归档，
本项不混入该候选代码。主目录保持原状态，不改权重、不调整预算、不新跑完整局。

## 已复现与范围

reproduce-fixed-world-20260913.js调用现有正式primitive，在同seed/同有序牌库下，
改变调用前随机游标。结果fixed-world-reproduction-20260913.json：普通牌5→12、
阿米巴牌3→9、物种也改变。此为底层受控反例，不冒充完整动作链。
首次运行诊断fixture传字符串entity sequence被正式校验拒绝；改为合法数字1后复现，
未变更生产代码、未吞错。

完整局的真实物种漂移已在前项alien-comparability-20260913.json交叉核验：
107.75为阿米巴/虫，public-card-runezu-greedy开始为阿米巴/符文族。
相同seed只能保证相同随机调用序列可重现，尚不符合用户要求的动作无关固定局。

## 必须满足的契约

最新用户决定（2026-09-13）：正常局按种子固定；免电分析局以用户手打405分对局的
全部已揭示信息为约束，未揭示部分确定性补齐。先前只固定阿米巴/虫的候选定义不足，
不能用新随机牌序覆盖该档的已知牌序或配件。此要求优先于前述候选生成结果。

已定位主目录seti-saves/seti-save-537-merged.json：白色249基础/405终局，516步，
槽1阿米巴/槽2虫。human-405-world-audit-20260913.json记录源SHA256、77个普通牌
实体和12个外星牌实体；普通实体序号1..94缺17项，不能仅按终态实体排序推出完整牌序。
该档是三段迁移合成档，需审查迁移时补齐的初始选择。终态符号/化石位置不能当初态。
replay after只有资源摘要，后续从原档/可验证历史重放补已知信息；尚未将审计结果注入生产。

历史证据补齐：git archive 4fe33887的randomizer/tools/assets到独立目录
/tmp/seti-human-405-history-20260913.6wxLds。未修改主目录或候选内核。
检查并修改历史fast_forward_save：取消非白色无匹配时选第一项；每步比较四席
score/credits/energy/publicity/手牌数与原档after前5项，另保存初态及每步完整状态。
516/516通过，耗时4942ms；终态players/cards/aliens/tech/solarSystem/finalScoring六域
deepEqual全部EXACT。517个检查点在该目录human-405-history-checkpoints-20260913.jsonl。
阿米巴首次揭示#115、虫#208（原stepIndex，零起点）。这是旧规则的人类动作重放，
不是AI实验，也不是当前候选规则验收。下一步提取牌序约束和首次揭示配置，保留源指纹。

extract-human-405-config-20260913.js已输出human-405-config-evidence-20260913.json：
历史检查点中普通牌实体1..94全部找到，94个不同牌ID，无缺号；终态缺失17项已补齐。
保留每个实体的首次出现步及ID，另记录初态科技/太阳系/终局板块/PASS预留/公共牌。
阿米巴#115初始符号依次4/2/1/5/3（orange1/orange2/blue3/red1/red2）；虫#208
木星02/05/03、土星06/01/07、面板04。提取21条外星牌首次实体/展示变化事件，
不把展示牌领取重复加入牌堆。尚未生成正式配置或覆盖候选随机数据。

build-human-405-world-20260913.js已产出human-405-fixed-config-20260913.json：普通
94张已知生成前缀+88张确定性未知尾部，总182张不重复。阿米巴固定牌序
9/0/1/3/7/5/2/8/4/6，虫9/0/7/2/3/8/4/6/1/5；首张为初始展示牌。
以新顶牌规则逐条重放21个展示/取牌事件全部匹配；阿米巴10张均已观测，虫9张已观测，
仅最后5号未知。配件保留首次揭示状态。该配置仍为带源指纹的候选数据，未接生产。

共享内核已接入state/fixed-world-config.js，删除randomizer内重复身份常量；免电盘面
普通牌与物种配置同源，meta.worldVersion=human-405-world-v1，正常局seeded-world-v1。
正式Simulation.reset对历史初态solarSystem/tech/finalScoring逐域deepEqual通过；
公共牌、三轮PASS牌ID及剩余148张牌序、两物种配置牌序匹配。41项定向与standard-flow
通过。完整回归仍有直接fixture缺配置问题，世界版本恢复门禁/实验指纹未完成，未合主。

测试fixture迁移：九个外星人测试文件显式调用各物种createInitialConfiguration准备
开局配置，保持原确定性随机样例；不改规则期缺配置失败。外星人10/10文件重新通过。
residual-domain-session的八物种正式owner揭示样例也补显式配置，整文件通过。
其余跨域fixture、方舟混洗隔离、隐藏信息、保存恢复与版本指纹仍未完成，未合主。

方舟混洗已隔离：initialConfiguration.rewardShuffleSeed固定专属种子，
card1ShuffleCount保存循环次数，每次5张后以种子+次数生成新9张排列；阈值前空牌池
显式失败。42/42定向检查通过，新增第7张后JSON恢复再连续20张比对，5次混洗一致，
传禁止调用的外部随机函数亦通过。方舟既有测试通过。Browser Random脚本前移到
fangzhou之前；正式恢复/分支与真实Browser仍需单独验证，不以JSON克隆测试代替。

effects域回归13/13文件通过。science-scan-flow首次失败原断言只显示空信息，补完整
失败结果后确认为fixture缺权威普通牌序；改用cards.createCardState，并为虫揭示样例
显式生成开局配置。没有给生产增加缺字段默认牌堆或揭示时补抽。保存/恢复与搜索
付款隐藏边界相关既有测试随该域通过，但新增世界字段的专门隐藏与恢复验收仍待完成。

新增正式Production lifecycle差分测试：反转隐藏普通牌序及两物种配置牌序、交换
未揭示身份，当前完整投影观察与合法动作均不变；保存可保留改后的隐藏配置，恢复原
envelope后committed state逐字段相同。43/43定向检查通过。首次测试错误地将原始
committed state与装配投影比较，缺少派生requirements导致失败；改为两侧同一正式
投影路径，无生产放宽。此为开局边界证据，不代替游戏中非零checkpoint/揭示搜索屏蔽。

1. 相同世界版本、seed、人数及显式盘面配置生成相同初始基础盘面、公司/初始牌、
   普通牌序、物种与槽位、物种自身牌序及随机配件。选择谁来揭示不重抽物种。
2. 正常抽牌/公共补牌只消费所属既定牌堆顺序；其他物种或行动的随机消耗不能改序。
   领取者及抽取次数可不同，不要求不同策略最后持牌或公开牌完全相同。
3. 2026-09-13用户明确：没有弃牌回洗，牌库用完即耗尽，不补造牌、不重建整副牌。
   普通牌与外星人手牌牌堆都检查耗尽路径，删除弃牌回洗和空堆自动重建。用户随后明确
   方舟奖励抽奖池是专属混洗例外，保留规则；各次混洗按本局种子与混洗次数固定，
   不受其他随机调用影响。空堆是正常规则
   状态，与缺少必需牌堆字段的错误区分；无法抽牌的返回/奖励结算按正式契约验证。
   不同科技供应等由行动造成的输入差异必须保留，不能用固定结果抹去策略效果。
4. 所有状态在committed root内，纳入fork/checkpoint/replay和事务回滚；禁止模块全局
   RNG或仅Simulation生效的覆盖。Browser/Simulation共享同一个世界生成与抽取实现。
5. 未揭示物种、未抽牌和未来随机结果只在权威状态；observation/Policy/搜索叶评分
   不可读。既有按assignedAlienId判断物种的入口要逐一审查，避免预分配提前启用能力。
6. 评测记录保存世界版本和初始配置指纹，同seed但不同世界版本不宣称同盘面受控对照。
   老记录不可改写成新契约成绩；没有历史固定牌序，不能凭空补造。
7. 用户目标盘面物种为阿米巴/虫；明确槽位1/2来自既有目标存档。不得靠试seed找
   符合结果的随机常数；应通过可追溯盘面定义实现，并保持Policy未知。
8. 用户补充确认：每局只有两个外星人。开局只确定这两个物种及槽位，并只准备这两个
   物种需要的牌序和随机配件；不为未入选物种生成随机配置。八种是可选物种的实现与
   测试覆盖范围，六种是共用展示牌/盲抽机制的分组，都不是单局初始化数量。
   验收须证明未入选物种不生成牌堆/随机配件，且不消耗对应随机流；空默认状态不等于
   已生成随机配置。揭示阶段只激活既定配置，按当时合法状态结算动态奖励。

## 实现调查清单（未完成，不作完成矩阵）

| 范围 | 当前入口及缺口 | 所需证据 |
|---|---|---|
| 初始世界 | initial-game-state、production-kernel、newGame、Browser开局、Simulation.reset | 同seed同配置初态指纹；正式盘面映射 |
| 科技/轮末可选牌 | tech/board-state开局生成bonusQueue、createCardGame开局preparePassReservePiles三轮牌 | 保持现有确定性；不同动作和读取不能重排未来队列 |
| 普通牌/公共牌/PASS预留 | cards/deck抽时随机选剩余池，无完整初始牌序；还有不应存在的弃牌回洗 | 同堆不同获取路径保持顶牌顺序；耗尽后不再产牌 |
| 物种选择 | aliens/randomizer揭示时抽取；初始化只清空槽位 | 两槽揭示次序和中间效果变化不改物种 |
| 八种物种 | 多个blindDrawCard从已洗牌堆再次随机抽；部分空牌堆自动重建，另有随机配件 | 完整消费者清单与逐类队列/隔离测试；空堆不重建 |
| 随机owner | residualDomains与其他domain RNG、主RNG | 机械枚举调用点，按语义归属而非按动作family拆流 |
| 恢复与隐藏 | initial snapshot、save schemas、低耦合切片、观察裁剪、反事实揭示 | 非零fork、rollback、恢复及隐藏差分测试 |
| 实验/报告 | fingerprint、版本登记、固定盘面文档 | 不同世界版本不混比；主报告中心核验 |

## 验收与效果预期

- 先补会失败的行为测试，再分契约实现；跨域问题允许随调查修订，不要求盲目一次实现。
- fresh A/A，同实例A/A及A/B/A；跨玩家/动作交错抽取；先揭示1/2与2/1；
  非零checkpoint恢复及反事实执行不改变实际世界；Browser真实smoke。
- 所有选定随机来源均需归属与证据，不能只修普通牌或只锁两种物种就整体通过。
- 单决策性能门槛通过后再评估是否需要新的完整局；先查重，世界配置必须进入指纹。
- 本项会改变过去动态随机模型的轨迹，分数不能预测单调上升。预期收益是比较条件
  可信，而不是追到107.75；新世界上的策略对照另行登记，不能重跑历史版本冒充旧局。
- 当前仅完成反例复现和初步契约，未实现修复，未更新生产文档，未合主或发布。

## 2026-09-13回归红灯基线

新增且登记fixed-world-decks.test.js：普通盲抽、公共补牌、弃牌不回洗；阿米巴、虫、
奥陌陌、半人马、符文族、异常点各验证按顶牌盲抽、盲抽耗尽、最后展示牌领取/耗尽。
运行node tools/run_node_tests.js --match fixed-world-decks，21条全部按预期暴露随机
取牌/空堆重建；unit 0/1，exit 1。这是修复前红灯，不得报告测试通过。
九折为一次性发牌、方舟为独立奖励牌堆，尚需分别覆盖，不能算进上述六类。
普通deck.test.js已有回洗成功断言，与用户新确认规则冲突，实施时需改写为耗尽断言，
不能用旧测试把回洗重新加回生产。

## 普通牌内核实现中间结果（未完成整项）

createCardGame在共享Production内调用initializeDrawPile，开局生成182张完整排列；
沿用逐次抽随机位置的排列算法，使原开局发牌前缀不因改为Fisher-Yates而无关改变。
所有运行期普通取牌统一takeNextEntryForDraw，耗尽不回洗、不从目录补牌；缺字段抛错。
createCardState提供完整卡表顺序作为未洗牌的新状态，生产开局显式随机排列。

普通deck.test通过（含全部182张按序消费、耗尽及弃牌不再产牌）；唯一standard-flow
通过，V输入审计通过。固定世界21项测试当前3项普通牌通过、18项物种牌仍失败。
check-fixed-world-initial输出fixed-world-initial-ordinary-20260913.json：初始剩余牌序
148张，科技、基础盘面、三轮末预留牌的SHA256与修改前相同；fresh A/A、同实例A/A、
A/B/A通过。物种仍未预分配。尚未完成Browser smoke、旧档契约/版本门禁与全域验收。
没有执行完整机器人局，没有合主；继续同一FIXED-WORLD-01，不作为独立整体验收。

## 六类运行期牌堆验证（未完成整项）

调查新增规则冲突：方舟 implementation.md 的 card1 为9张奖励牌，翻5张后的下一次
奖励明确要求重新洗混；不是进入玩家手牌的普通/外星人卡牌。先不删除这一专属机制，
须核实所引官方规则并与用户“不回洗”适用范围对齐。固定随机世界与是否循环是两项
独立契约：如保留循环，各次循环次序仍必须由本局种子决定，不受其他行动随机消耗影响。

开局接入审查：initial-game-state 与 production-kernel.randomizeBoard 都重置物种，
不可在前者预分配后被后者清掉。八种 is*AlienSlot 和 getSpeciesTraceApi 会读取
assignedAlienId，预分配前须核对合法入口的 revealed 门禁；观察层 sanitizeAlienPublicState
已对槽位身份做 revealed 判断，但仍需验证新配置字段及派生合法动作均不泄露。

六类展示补牌与盲抽已改为消费已有顶牌，空堆不重建，最后展示牌可取；空取牌不创建
实体。fixed-world-decks 21/21通过；residual-domain-session正式选牌/耗尽/取消测试
通过，standard-flow唯一完整流程通过（本次实测0.71s），git diff --check通过。
正式测试fixture改用createCardState提供权威普通牌序，没有恢复缺字段默认猜牌逻辑。
当前物种仍在揭示时初始化随机配置：每局两种的开局选择、仅两种配置预生成、九折与
方舟特殊机制、隐藏/恢复/浏览器及世界指纹均待完成；未合主，未宣称固定世界通过。

## 物种预分配红灯（生产基准67c844a3）

fixed-world-decks新增三项：开局两个互异且未揭示身份；预定阿米巴/虫按1→2与2→1
揭示不调用随机数；交换隐藏身份不改变公共物种观察。实测22/24通过、exit 1：
开局assignedAlienId仍null，揭示即使已设置身份仍调用随机数，两项明确失败；观察
裁剪差分通过。该观察测试只证明sanitizeAlienPublicState，不代替完整合法动作、
Policy和反事实新信息屏蔽验证。测试失败为下一阶段红灯，不回退已通过的21项牌堆契约。

上述两项已转绿：randomizeAlienAssignments显式取随机数并无放回分配两槽，揭示
验证并读取assignedAlienId，不消费随机数；initial-game-state用独立派生开局流，
production-kernel.randomizeBoard不再重复重置分配。24/24通过，standard-flow通过。
注意Simulation当前仍将meta.seed传为seti-simulation：实际盘面seed与正式世界版本
尚未接入，不能据此宣称不同盘面已正确生成身份，也未保证目标阿米巴/虫定义。
两物种配件/牌序预生成、能力隐藏、旧档缺分配的明确版本拒绝仍待完成。修改尚未提交。

实际seed后续接入：Simulation.reset不再覆盖config.seed，Production收到真实盘面seed。
fixed-world-initial-assignments-20260913.json记录fresh A/A、同实例A/A、A/B/A通过；
科技、太阳系、PASS预留和公共牌四项指纹与ordinary阶段一致。standard-flow再次通过。
该算法自然分配免电盘面为方舟/异常点，并非用户指定阿米巴/虫，故当前仍不可验收。
下一步将用户目标身份及槽位作为版本化固定盘面定义接入，不调整随机常数凑物种。

目标定义已接入共享randomizer：免电seed对应1阿米巴/2虫；其他seed无放回选两种。
25/25定向检查通过，fixed-world-initial-target-20260913.json证明三类重复开局相同，
四项基础指纹不变且身份为阿米巴/虫。身份定义未被导出到公共观察。
检查Browser脚本发现initial-game-state新增Random依赖时，原index的random.js在其后；
已前移至initial-game-state之前，避免捕获undefined。尚需真实Chrome烟测及完整Node
回归，不能用Node通过代替Browser验证。配件、世界版本/指纹、恢复契约继续待完成。

阿米巴/虫已拆出纯createInitialConfiguration：分别生成完整牌序+5符号排列、
完整牌序+7化石排列；揭示初始化复用配置生成与确定性配件应用，不重复维护洗牌代码。
新增两项同seed排列测试后27/27通过，外星人10文件通过。当前调用时间仍在揭示，
下一步才接入开局权威配置存储与揭示读取；不得将纯函数通过当作已完成预生成。

其余四类也已拆分：奥陌陌/半人马仅牌序，异常点三枚正反面+牌序，符文族符号袋+牌序。
保留各自原随机调用顺序；异常点地球坐标、半人马分数阈值及符文族科技可用性仍在揭示
时计算。31/31定向检查与外星人10文件通过。九折/方舟仍待拆分，六类尚未统一接入
开局存储。符文族袋为空后的随机补充与方舟多轮奖励牌序仍需各自固定随机来源。

2026-09-13用户确认方舟抽奖池保留混洗，规则冲突已澄清；九折与方舟其他配置同样固定。
八种createInitialConfiguration均已实现；初态按实际分配的两个槽位生成并存储到
物种initialConfiguration，其余六种只保留空默认状态，不调用配置生成器。
当前揭示尚需切换读取该配置，不能将开局存储完成外推为运行期已固定。

八种揭示已切换读取initialConfiguration，配置原件保持不变，缺配置报错。新增八种
禁止随机调用的揭示测试，41/41通过；standard-flow通过。原外星人测试10文件中9失败，
均需审查直接构造状态而缺配置的fixture；当前不宣称全量回归通过。下一步逐项补正式
开局配置，不在生产恢复临时补抽；方舟后续混洗隔离仍未完成。

### 公共牌耗尽回归与插入式规则修复

2026-09-13：cards/play-domain 正式 composition 回归复现公共牌 null 空位读取 id 崩溃。
新增空区、仅中间一张、满三张三类测试后，进一步证实 b_23 的 count=3 从未消费，
实际只弃一张并发一次角标。修复为排除合法空位并保留槽位下标；先完成本批选择，
统一弃除、补牌后按选择顺序结算原牌角标。新补牌不加入本批选择。
三类盘面分别验证空牌堆与有三张补牌的六个场景，逐项断言槽位、奖励次数与剩余牌序。
cards 五个测试文件全部通过（包含182张普通/DLC牌正式会话，以及43项固定世界契约）。
语法与 git diff --check 通过。这不是完整固定世界验收；世界版本恢复门禁、符文随机
来源审计、真实浏览器烟测及完整 Node 回归仍未完成，本轮没有恢复机器人全盘实验。

完整 Node 回归已运行结束：unit 89/96、fullFlow 1/1，exit 1。
失败文件为 actions、end-game-scoring、quick-timing-contract、strategic-goal-evaluator、
simulation-standard-action-composition，以及两个 robot-report 测试。actions/scoring 的
直接构造夹具补齐初始配置后，二者定向通过；没有修改生产层去临时补随机配置。
报告测试缺少临时目录中的既有 seti-save-research-quick-timing-20260912-60f8cca6-quick-24-v2.json。

为区分既有失败与引入的回归，从329bd8a0导出独立快照
`/tmp/seti-fixed-world-baseline-20260913.gtqsgt`，对三个剩余行为文件做原版本对照：
quick-timing-contract 与 simulation-standard-action-composition 原版通过、本候选失败；
strategic-goal-evaluator 两边都在571行 data:analyze 目标未释放断言失败。
因此下一步先定位前两个新回归的初态/夹具前置条件，既有目标释放失败单独调查，
不把它算成本次新问题，也不忽略其验收缺口。尚未提交或合回主目录。

### 两个新失败的前置条件定位

对329bd8a0与候选的真实开局状态做只读对照：quick-timing-stage-contract 原版白席
5信用/5电，可枚举launch；候选白席2信用/4电，选择寰宇动力后已有两枚探测器，
不能继续发射。测试目的为主行动阶段观察与移动窗口，不是验证随机起始公司发牌。
测试现显式恢复到5信用/5电、空探测器盘面，保留原阶段、付款、回合切换、恢复及
旋转成本全部断言。未更改生产发射准入。

PASS门槛测试候选白席 availableData=0、poolTokens=[]，原测试只补了火箭和电，
却假定起始卡必给可放数据。改为在同一场景构造中调用正式gainData并断言成功，
保留PASS前可枚举、PASS后关闭的完整正反对照。未更改生产快速行动准入。
`node tools/run_node_tests.js --match quick-timing-contract --match simulation-standard-action-composition.test`
两个文件通过（含quick-timing的10个子测试），2.16秒。尚未重跑全量；此前既有
strategic-goal-evaluator失败和报告存档依赖仍待审查，固定世界验收未完成。

既有571行失败的调用链初查：正式rule-composition在2578行调用completesRouteTarget，
2597行等待Decision排空后设置completedGoal，2915行向后继选择器传null目标；
不是让selectSecondaryAgentRouteTarget独自负责完成释放。测试1250行以后已经另测
扫描不完成、分析完成的回调契约。需据正式闭包补验证并修正过期断言/注释，而非
未经证据修改生产目标释放逻辑；本轮尚未改动该文件或估值实现。

### Simulation 检查点权威状态恢复

新增差分测试先复现：带replaySteps时loadCheckpoint从头重放，只比对序列计数，
忽略保存的剩余普通牌序。现删除这条替代恢复路径，统一交composition.lifecycle.restore；
replaySteps仅恢复为记录，loadReplay继续负责显式重放。恢复前验证JSON、世界版本与seed、
envelope一致性、RNG；不支持的worldVersion在重置前拒绝，测试核对当前对局完全不变。
唯一序列目录仍与正式初态目录比对，数值与实体一致性交给共享状态验证器。

普通牌序/外星配置差分后完整committedState相等，非零检查点后续动作、观察、收益及
再次保存一致；缺replaySteps的活跃Decision恢复原有测试保持通过。
`node tools/run_node_tests.js --match simulation --match game-recovery`：10文件通过，29.69秒，
包括Effect Session工作进程崩溃恢复、反事实outcome与Standard Action组合。
随后增强完整committedState差分断言，checkpoint文件再次通过；语法/diff检查通过。
docs/rl-simulation-env.md同步恢复契约。本阶段不外推Browser恢复版本门禁已完成，
也未完成世界指纹登记、符文随机源或真实Chrome烟测；仍不合回主目录。

### 405分局已知起始选项补齐

历史step0的meta.seed为seti-simulation，当前已修成真实seed，导致起始公司与初始卡
重新生成。逐席对照证实选项发生变化，不能只因白席仍有异星实验室就认为相同。
固定配置补充原局四席industry/initial选项，共享initial-setup按席位读取；不替玩家
选择，不改正常局的种子生成路径。44项固定世界测试及唯一standard-flow通过。

新增verify-human-405-opening-20260913.js，从已核验历史JSONL直接比对当前正式环境，
逐项通过solarSystem/tech/finalScoring/publicCards/passReservePiles/四席完整手牌/
全部initialSetup（含选项、顺序、未确认状态）。证据
human-405-opening-proof-20260913.json，openingHash=
6a91429d1ef12560a7b3d7ed0e6f670c3b8140799c2e0a2da72c133eadbfc9f5。
没有重复机器人实验；后续运行期随机、Browser烟测和完整验收仍未完成。

### 方舟解锁牌随机补发入口清除

审计dealPlayerCard2发现variants缺失时仍调用createPlayerCard2Variants(random)，使
不完整世界配置被运行期随机结果掩盖。先以缺少第二席配置复现禁止随机源异常，再
修为只读initialConfiguration.playerCard2Variants；揭示前核验所有席位三色牌号，
防止第二席失败时第一席已经发牌。测试覆盖缺席位、0、5和字符串牌号并断言状态
完全不变。直接发牌测试夹具显式构造初始配置，不恢复随机旁路。
fixed-world-decks 45/45、fangzhou与residual-domain-session三文件通过，语法与diff
检查通过。方舟文档同步接口与失败契约。该修复不涉及高级奖励缺失的既有独立问题。

### 符文符号池耗尽规则纠正

用pypdf读取主目录rules/seti-alien-species-space-agencies-en.pdf第3–4页完整文本。
第4页GAINING GLYPH TOKENS明确供应耗尽后顶部格位不再有效；原随机补造符号无
规则依据。新增禁止随机源的最后一个符号领取测试先失败，再移除drawSymbol池空
随机补充与自动重建。最后符号仍入玩家库存，格位保留null；再次领取返回显式
skipped/symbol_supply_empty且状态不变，缺失格位仍失败。位置是否仍可放痕迹沿用
既有规则，未据此关闭整个痕迹动作。
符文单测、45项fixed-world检查、science-scan三文件通过。尚需正式Science痕迹
耗尽组合测试；符号来源按科技可用性导致的分配漂移仍未解决。此次只查规则文本，
未做PDF视觉审查；未更改原PDF。文档删除“池空随机补充”错误描述。

符号耗尽后续验证：runezu-panel-trace原测试仍要求池空消费一次RNG，已改为正式规则
断言并扩展三色：最后符号领取/空位重复痕迹、库存与其他玩家资源不变、RNG不变、
不产生隐藏符号屏障，实际痕迹数增加。不是删除失效断言后跳过该场景。
另外在play-domain正式composition中增加b_32 -> 黄色符文1号位的两个场景（最后一枚、
已空），验证完整Session完成、一次CAS、符号数量与空位、RNG不变；从真实未决Decision
envelope恢复并再次提交后，完整状态和journal一致。两个文件通过，1.38秒。
本轮只补规则与恢复证据，未改估值/预算、未运行机器人完整局。

### 符文揭示按具名位置固定配置

同一initialConfiguration的对照复现：可用科技减少会改变面板符号，因为原实现只为
当前科技消耗符号池，然后给面板发牌。新增对照先失败，再改为固定目录（7星球、
8扇区、12科技、6面板）消费开局35符号；面板分配后移除不可用科技位置，预定符号
按科技目录顺序归入剩余池。其他位置不漂移，仍只布置正式可用科技。
对照覆盖无科技、逆序科技清单、逐一去除12项科技；核验各位置一致、科技资格正确、
总计35枚且7种各5枚，初始配置不变、揭示不调用随机数。
符文/面板痕迹/fixed-world/play-domain四文件通过（1.57秒）；语法、diff检查通过。
这不完成Browser实际页面验证或所有随机资产审计；尚未合回主目录。

### 当前完整回归与实际Chrome验证

当前合并候选完整Node：unit 93/96，fullFlow 1/1；37.63秒+0.51秒，exit 1。
剩余strategic-goal-evaluator既有断言失败，以及两个报告测试缺输入文件。
将主目录已有的quick-timing 60f8cca6存档、7bb2c6d4研究记录和counted-card-move
历史HTML仅复制到隔离目录（不覆盖来源、不重跑实验），报告测试进一步暴露
REPORT_REPLAY_CHOICE_MISSING step=1。不是文件补齐就通过：旧版本初始选项与
当前实际seed配置不同。必须保留历史正文/版本证据，不能任意匹配替代选择。

Chrome标准工具首次受沙箱回环listen EPERM限制；经授权在沙箱外运行同一项目工具，
使用临时profile与回环服务。production-start-button、production-fixed-board-free-analyze
两项通过。随后完整10项顺序运行：start-button、trajectory-recording通过，在
production-fixed-board失败：双发seti-107白席当前为芬威克/未来跨度，不含寰宇动力。
docs/fixed-boards.md仍明确双发盘面白席寰宇动力/异星实验室，因此不能删断言。
完整Chrome在第3项失败退出，其余7项未执行；相关进程已结束。
下一步补齐正式双发盘面的起始配置契约，并分离当前规则报告与历史重放版本问题。
本轮没有改生产代码，也没有合回主目录；目标仍在进行。

### 双发正式盘面开局契约恢复

先以329bd8a0隔离快照核对，证实原seti-107白席选项确为寰宇动力/异星实验室。
共享固定配置新增getFixedInitialOffers，保留双发四席全部起始选项；免电仍读取405
选项；普通非预设seed仍种子生成。未将meta.seed改回seti-simulation。
verify-dual-launch-opening-20260913.js验证整个initialSetup与原版一致并记录
dual-launch-opening-proof-20260913.json，setupHash=
ad83e182818f982232dea3dea84f395d2a505aeab7d72933c0e85acefd38aed8。
定向45项fixed-world、initial-setup及唯一full-flow通过。

真实Chrome完整重试前5项通过：start-button、trajectory-recording、fixed-board、
custom-seed、fixed-board-free-analyze；第6项browser-full-parity等待launch超时，
输出证实白席赫利昂联合体/初始5与15，只有1信用3电，发射不合法。后4项未执行，
不是全部Chrome通过。下一步核对UI smoke的资源前置条件，不改生产发射门槛。
历史报告重放版本问题及原有战略目标测试仍待处理。

### 当前候选真实Chrome整套通过

browser-full-parity前置条件核查：场景先执行2信用换1能量，当前起始资源因此只剩
1信用；发射正式费用2信用，等待按钮启用不会自行补资源。保留原快速交易断言，
在发射前通过真实DOM再执行2能量换1信用，验证提交序号和Standard Action结果后
继续原主行动、后续Decision、隐私、renderer、机器席位与保存恢复检查。
不修改生产成本、不直接写玩家资源、不删除原验收条件。该项单独通过后运行全套：
`node tools/run_browser_smokes.js`，10/10通过，exit 0。全部使用隔离临时profile和
本机回环服务，经权限批准运行，已结束并由工具清理profile。
本结果证明现有10项页面契约，不替代尚缺的固定世界指纹、历史报告版本处理与
战略目标测试核验；Node全量上次为93/96，尚未更新成全绿。未合回主目录。

### 战略目标测试旧契约核对

原571行直接调用目标选择器要求分析后返回null，与正式完成责任不符。改测正式
completesSecondaryAgentRouteTarget回调；并在search-root-attribution的真实搜索组合
接入此生产回调，验证分析后后继目标/计划均null、真实3分叶为goal-completed。
该组合测试通过。生产逻辑未改，仅纠正“place_data也算完成”的错误注释。
随后原876行把availableData=0的scanReady用于放数据测试，改为明确持有1数据的
placementReady，并保留无数据时返回空后继的反向断言。
继续执行暴露约997行探测目标缺电转换断言失败；把已修正测试在内存中加载到
329bd8a0独立快照，也在同一断言失败。该问题仍需审查，不能宣称战略测试已通过。
本轮未更改策略判定、估值或预算，预期不影响得分，不触发全局实验。

后续完成该文件核对：探测后继补齐具名routePlanId；发射选择补正式launch事件和
rocket身份映射，并按当前目标/计划对象接口断言；登陆完成保留“无事件不完成”
反例，新增本席事件成功与他席事件不完成。科技放数据补正式data: choiceId，
蓝2放置补手头数据。排序零值按数值比较，允许不影响排序的负零。
蓝科技两个测试仍叠加已删除的固定10/10/5/5价值，与docs/ai-design.md现行
R2e规则矛盾；删除测试中的重复项，保留未来正式奖励计算断言，不改生产估值。
strategic-goal-evaluator与search-root-attribution两文件均通过。此阶段只有测试
与一处说明注释变更，预期分数不变；未运行AI实验，也未宣称固定世界整体验收。
将修订后同一测试源码以内存Module加载到329bd8a0独立基线目录，完整文件也通过。
因此上述修订在固定世界变更前后均成立，没有借本次生产改动改变测试预期。

### 报告固定世界重放边界

报告富化器原来始终使用免电局随机源。改为存档committed meta.seed、turn人数和
构造内核之前保存的初始RNG状态；重放前校验世界版本，未知/缺失/种子不匹配版本
显式REPORT_REPLAY_WORLD_VERSION_UNSUPPORTED，不用新世界重写旧成绩。
报告窄接口测试用正式开局选择加一次快速交易生成26步当前存档，无AI搜索。
旧档保留版本拒绝测试；缺步骤、损坏JSON、白/绿错误选择、错误提交仍报错。
robot-report两项通过；历史正文逐字保留、元数据刷新幂等及链接实际存在通过。
补复制主目录既有f14a863e.4bc44eb2.full.json到稀疏候选供历史元数据测试，未生成
或修改研究成绩。文档同步到robot-iteration-registry。
另诊断三人局reset(seed=report,activePlayerCount=3)在候选和329bd8a0均报
STATE_INACTIVE_PLAYER_REFERENCE($.turn.currentPlayerId)，属已复现旧bug，待插入修复。

Node全量此时通过unit96/96、fullFlow1/1，耗时39.06s+0.51s。
随后三人初始化修复：createTurnState已限定有效席位，但initial-game-state外层仍强写
默认白席，在盘面重排之前构造StateStore即失败。沿用正式turnState的有效集合与
startPlayerId，只有默认席位已有效时才保留；不改随机排序、不更换四人局盘面。
新增三人非零checkpoint恢复、三人报告重放、405免电局报告重放通过；相关三文件
通过，四人旧报告正文保护继续通过。此后尚未重新跑全量，不能把前次结果冒充最终快照。
包含三人修复的当前快照重新全量通过：unit96/96（40.00s）、fullFlow1/1（0.51s）；
49个修改/新增JavaScript文件语法检查通过，git diff --check通过。
本次临时提交仅留档候选进度，固定世界指纹、共享恢复版本门禁及隐藏揭示边界未完成，
不合主、不推动临时origin（其指向主目录），不宣称AI得分提升或固定世界整体验收。

### 共享committed恢复世界门禁

42798ef4之后：在Production StateStore注册固定世界不变量，Browser与Simulation
统一拒绝缺seed或世界版本未知/缺失/与seed不匹配；不在UI另加版本判断。
getWorldVersion只返回版本字符串，Simulation与报告不再为版本判断克隆405全配置。
实际Browser/Simulation两种factory×正常/免电两seed，通过Browser recovery适配器
测试三类错误版本均拒绝，权威envelope与ViewState均不变；正确存档恢复成功。
测试最初遗漏Browser必需的只读projection端口，补装共享buildRuleObservation后通过。
game-recovery与simulation-state-checkpoint定向通过。范围明确为committed root；
Effect Session的workingState/undoFrames等恢复快照仍需核验，不据此宣称所有恢复闭包完成。
当前修改全量unit96/96（42.01s）、fullFlow1/1（0.52s）通过；隔离真实Chrome
10/10通过。修改的6个JavaScript文件node --check及git diff --check通过。
Effect Session恢复目录已查明：baseState、workingState、可空committedState及
undoFrames[].stateBefore；runtime.restoreCheckpoint目前只校验schema/replay/undo数组，
还未检查这些快照的世界版本。下一步须覆盖此目录，不以committed root校验代替。

### 进行中行动的世界恢复门禁

fe858c57后真实Browser factory首次反例：baseState.worldVersion改为unknown仍恢复
成功。Production增加validateSessionRestore，Rule Composition在安装session之前
调用，遍历baseState、workingState、可空committedState及每个undo.stateBefore，
逐项校验有效版本和与外层committed一致的seed。四类快照×版本/seed两种改动×
Browser/Simulation两factory×普通/405两seed均拒绝，规则envelope/ViewState不变；
真实未完成开局Decision保存恢复完整相同。该校验不添加到搜索节点循环。
进一步反例：Simulation加载坏workingState虽然抛错，但先reset导致旧replayCursor
从1变0。已有composition现先执行共享validateRestore，成功才reset；新增检查点
逐字段不变断言通过。定向game-recovery和simulation-state-checkpoint通过。
范围仍是世界身份，不把此结果扩充为任意坏session或隐藏牌堆内容完全验证。
生产修改后unit96/96（42.21s）、fullFlow1/1（0.51s）、隔离Chrome10/10通过；
5个修改JavaScript语法及diff检查通过。恢复测试进一步扩展为逐个撤销帧分别篡改，
而非仅第一个，定向重跑通过（0.41s）。未改AI估值/搜索策略，不预期改变合法同世界
续局得分；未运行AI实验，未合主。世界指纹与揭示中的隐藏信息隔离仍待完成。

### 研究记录初始世界指纹

ed8b5633后：fixed-world-identity工具通过正式Simulation reset及一次开局输入，
提取初始规则全域、初始选项、随机状态。规范化对象键序后SHA-256，输出总hash与
分域hash，原始隐藏配置不进入研究记录。buildIdentity在去重前生成世界身份，纳入
实验指纹，并将world保存到新研究记录；新逐步报告显示版本/hash，缺历史证据标未知。
405当前指纹2d9f8f5344864fcd683204661f0ab70c07dbd086b2ff8e2c00ea2ff283213d8c。
纯开局定向测试验证牌序、外星序、科技、选项、人数、seed变化可区分；策略配置与
对象字段顺序变化不改变指纹。fixed-world-identity和两项robot-report共3文件通过。
没有运行AI实验，不把生成开局身份称为机器人快测；尚未验证新研究记录实际落盘及
快速续跑全过程，旧记录与报告未覆盖，报告中心合并仍待整体验收。

### 研究续跑接口验证

05a66fe3之后发现checkpointFromSave会把任意rngState.algorithm强制改为当前算法。
移除此行为；未知算法现明确拒绝且已有env checkpoint不变。研究续跑窄接口测试使用
正式开局加一次交易的26步存档，检查恢复committedState、session、所有replaySteps
与源完整相同；继续一条合法输入后历史前缀保持、只增加1步，源存档不被修改。
identity测试通过真实buildIdentity/fingerprintOf确认策略开关改变实验身份但不改
世界身份，相同实验稳定去重，世界指纹变化必改变实验指纹。
research-world-resume、fixed-world-identity、research-search-statistics三文件通过，
未运行AI实验。此为实际续跑适配器和合法输入验证，不等于完整实验CLI落盘/全盘验收。

### 正式揭示反事实泄漏修复

7e2edf76后构造开局完成、三色痕迹齐全的正式end_turn窄场景。首次使用隔离fork
再次搜索被COUNTERFACTUAL_FORK_UNAVAILABLE拒绝；改为正式Production主composition
后复现搜索叶直接看到阿米巴身份，根仍未揭示。原因：识别表只有alien_revealed，
正式owner使用alien_reveal/alien_reveal_turn_end，方舟另用fangzhou_reward_reveal；
检查现有规则屏障目录后补齐这三项，不修改正式结算。
补齐后继续反转阿米巴隐藏牌序，完整叶观察差分发现techGainRequirements.
publicityPreparationPlans仍暴露alien-amiba牌ID和宣传收益；现与plans同样按根已知
牌过滤。真实end_turn实际揭示且拿到不同牌，反事实两侧完整观察相同、主状态不变。
新增正式known b11手牌验证已知宣传准备仍保留，避免用全删方案掩盖泄漏。
已沉淀tools/alien-reveal-hidden.test.js并登记，定向通过；原hidden payment测试通过。
audit_v_state_inputs只取得首项PASS输出，进程随后经只读查询确认已退出，但退出码及
后续输出未取得，不将其计作通过证据。未重启该审计。
本修复移除偷看新身份/牌的收益路线，不改权重；可能改变搜索选择与得分，终局变化
不能预先承诺上涨。尚未覆盖全部物种/方舟抽奖的实际差分，不宣称隐藏闭包已完成。
当前生产修改全量unit99/99（41.70s）、fullFlow1/1（0.52s）通过；随后将同一
正式差分扩展至虫族并定向通过（0.59s）。两物种均验证真实揭示消耗不同牌、搜索
完整观察相同、已知准备保留及canonical root不变。其余物种/抽奖仍待补证。

### 八物种揭示扩展与方舟随机收益红项

569633e4后，正式end_turn差分扩展至奥陌陌、半人马、符文族、异常点、九折。
额外物种是独立规则场景，替换一个槽及其配置，每例仍仅两种，不改变405生产配置。
九折牌实际位于jiuzhe.playerCardsById保留区，按该正式位置确认两次真实发牌不同。
七种牌堆差分通过，方舟三色解锁牌variant差分亦通过；当前这些测试仅改变对应隐藏
牌内容，不代表不同隐藏物种身份或所有随机配件都已等价。
新增方舟card1奖励牌序反转后出现明确红项：搜索叶公共白席score/finalScore为9对6，
credits为4对5。两侧输入公共信息相同，差异只来自未知抽奖结果。随机收益已由
initializeAlienReveal/方舟角标的applyFormalCardEffects写入权威分支，现有mask只遮
牌名和候选，不能遮住这些收益及其后继可达性。因此不采用直接重置分数字段的局部
处理；须处理随机奖励结算到搜索观察的边界，并保留正式真实执行结果。
当前alien-reveal-hidden.test.js明确失败（8类卡牌场景通过，奖励场景3个字段差异），
作为插入式bug证据留档，不宣称当前Node全绿、不合主。没有新增AI实验或估值权重。

### 搜索随机契约核查：独立RNG不等于隐藏世界采样

e3c1ea8c后核查发现第二项实证：现有差分测试全部outcome均为confidence=high、
code=null、reasonCodes=[]，包括方舟奖励泄漏。定向命令
`node tools/run_node_tests.js --match alien-reveal-hidden`为0/1（1.22s），保留原红项。
运行时rule-composition的confidence只检查失败、裁剪和evaluateOptions.confidence；
game及simulation-env不存在COUNTERFACTUAL_RANDOM_SAMPLE标记或随机消费跟踪。
原ai-design将低置信度随机采样写成现状，与实现不符，现已明确当前实现及未通过门禁。

根因范围：production-kernel的fork创建/复用确实装配独立RNG，但rule-composition
branchKey以完整canonicalEnvelopeHash和完整节点envelopeHash派生，包含隐藏状态；
方舟flipCard1Reward直接shift固定牌堆，混洗又从隐藏rewardShuffleSeed+次数派生，
均不依赖传入的分支random。因此不能通过重设fork RNG或单改confidence消除泄漏。
下一实现须在搜索世界边界解决未知结果，保留真实局固定配置和共享正式结算；若采用
采样，输入及种子须仅依赖玩家已知信息，不能把真实隐藏序列shuffle后当成独立样本。
还须覆盖节点恢复、复用fork、未完成session及奖励后的资源可达性；禁止只重置评分字段。
本轮仅增加失败测试的诊断输出并修正文档，不更改生产规则/策略，不运行AI全局实验。

### 用户确认后的方舟奖励假设世界实现

用户否定“未知奖励只计期望、不参与后续资源规划”：需要时奖励资源参与本大轮后续行动。
ca924bc2后实现搜索根prepareCounterfactualEnvelope：仅克隆隔离状态，方舟奖励从公开目录、
已翻历史和rootObservation稳定哈希生成假设顺序/混洗种子；不shuffle真实未知顺序。
committed、session base/working/committed/undo副本一起处理；后继持有样本执行快照，
复用fork不会重新采样。正式flip和applyFormalCardEffects不变，不增加节点或改变预算。
经过隐藏信息屏障的outcome改为low、counterfactual-hidden-information，不再错误标high。
单次搜索共用单样本以控制成本、避免候选枚举次序影响奖励，不宣称精确概率期望或全隐藏域采样。

八物种牌面差分和方舟奖励反转差分通过。新增方舟公开已翻4张、未揭示两类场景，
同时反转真实牌堆并改变真实混洗种子，连续抽12次（跨多次混洗）结果相同且不抽回当前已翻牌。
正式已揭示方舟角标→发射测试：根差1钱没有合法发射，假设给钱后搜索真实执行发射形成叶；
未给钱样本不出现发射，canonical根不变。测试夹具最初漏同步handSize，恢复被不变量拒绝，
补齐夹具手牌数量后通过，没有为测试放宽生产校验。定向alien-reveal-hidden 1/1（1.50s）、
fangzhou 1/1（0.04s）通过。当前完整回归和Chrome仍在执行；未做AI实验，未合主。
随后完整Node unit99/99（43.09s）、fullFlow1/1（0.52s）通过。Chrome首次启动被沙箱
本地listen EPERM阻止，获准后同命令隔离Chrome10/10通过。四个修改生产/测试JS语法及
diff检查通过。本次从偷看真实奖励改为假设奖励，可能改变方舟路线选择与终局分数；
预期是消除真实隐藏牌序对选择的影响、保留资源后继，而不是承诺涨分。没有AI终局成绩证据。

### 未揭示物种身份隔离

184135fb后将已有牌序差分扩展为不同隐藏物种之间的相同公开根比较，复现九折
搜索叶手牌数4对阿米巴7：只遮名称仍让真实物种的奖励类型影响策略。
Production现从公开revealPoolAlienIds排除根已揭示身份，无放回生成未知槽位的假设
身份，只生成假设选中的配置，不使用真实assignedAlienId或隐藏initialConfiguration。
分配在根计算一次，各committed/session副本一致；根已揭示身份不重抽。
新测试八种实际隐藏身份的根观察相同、完整搜索叶观察相同，包含互换两槽的虫场景；
已揭示方舟资源后继场景额外断言身份/揭示状态保留。定向1/1（1.61s）通过。
生产改动全量unit99/99（42.79s）、fullFlow1/1（0.52s）、隔离Chrome10/10通过，
之后仅扩展测试与文档，定向重跑通过。语法/diff通过。未知身份不再决定真实隐藏
奖励类型，路线/终局分数可能变化；未运行AI实验，未合主，不把此证据外推为所有
普通牌、科技或已揭示物种未来配件的完整采样证明。

### 405历史证据持久归档

将已存在的30MB历史检查点和当时修改的严格fast_forward_save源码原样归档到
adhoc/human-405-history-evidence-20260913.json.gz（3,983,600字节），没有重跑任何对局。
归档SHA256=f31e79b16d41af7c9e698b8fd4e65d3238b869354f69de9c99ffe41555c62468；
解压后517条检查点的SHA256仍为6c905f29b4707eff3fc7858268183416e36791bd341c932721c1e4959a6443e3，
与既有提取证据完全相同。archive-human-405-evidence-20260913.js在已有归档时只校验，
缺归档时要求显式历史目录并拒绝不符hash；生成后解压回读通过。不是当前内核全局验收。

### 主行动性能门槛准备

已分别运行临时目录与主目录run_research_validation --list，主目录159条记录，
没有当前世界/代码的新实验。d035a5e8的首个单决策夹具仍在交易后的choose_card：
64.2ms、3节点，原始输入和搜索诊断保留fixed-world-decision-d035a5e8-20260913.json。
此记录不是主行动性能证据，不作为启动全盘的依据。基准脚本现先沿正式合法输入
结算剩余conditional，再断言存在主行动并保存该实际根，下一提交上只测一次。

### 完整局验收收口

bddcdae9主行动基准完成后执行唯一quick40，随后通过研究工具full续跑，561步自然终局。
正式分82/116/65/124，均96.75；quick和续跑合计924819ms。世界指纹匹配，前40步保留，
实际阿米巴和虫，搜索错误0。原始证据与范围见reports/iteration/fixed-world-405-acceptance-20260913.md。
自身目标通过，预算专项未完成（战略53+控制6次截断）。下一入口154步绿色4096节点18.36秒。
报告层额外修复跨世界混排：以最新版本世界指纹筛选终局；不改实验数据、不重跑AI。
