# 原23输入自主前三轮的后续验收入口（2026-11-07）

当前先完成V277同教师112输入起点的唯一第三轮验证。该受控局不替代原23输入开局的自主前三轮，也不能证明继承的3处首轮准备顺序变化不影响资产。以下为已定位实现范围，尚未编码或运行。

已有宿主并非独立first2模块，而是`tools/research-human405-round1.js`统一处理首轮、首两轮、教师第三轮及B117固定前缀。原23输入入口`opening()`已验证SHA，`initialize()`可逐字恢复Native状态/RNG并要求机器缓存为空；`stopAfterRound`及`settled()`已支持目标轮数，原生before-PASS回调也已记录每轮六收入和完整资产。因此建议增加一个独立scenario ID（例如human405-white-first3-v1），复用这些正式入口，不复制新模拟器，不把112教师前缀或旧V189前两轮存档冒充新AI自主。

需修改的明确契约：

1. `research-human405-round1.js`：新ID白席共享搜索，其他三席沿用原23开局的PASS/强制选择策略；openingInputs=23、stopAfterRound=3、autonomousScope=rounds1-3、独立comparisonScope和临时三轮分数语义；初始化不得载入教师控制前缀。
2. `run_research_validation.js`：新ID正常/失败记录都写firstThreeRoundsSettled、completedRoundEnds、23输入后的新增数量；停因first-three-rounds-settled必须与教师third-round-settled区别。比较summary取R3提交PASS前的checkpoint，保存仍允许完成PASS选牌与推进R4；不得将R4收入混入轮末资产。
3. `robot-iteration-lib.js`及报告/实验中心语义：新场景不是完整终局，不进完整局排行榜、不晋升V41；同盘面但与教师受控起点分开，独立指纹去重。每轮报告科技槽位/失效、全部收入、钱电数据、手牌、电脑蓝槽、探测器、扫描与外星人/终局预投入。
4. 测试复用已登记的首两轮、受控第三轮和实验中心测试模式，检验真实开局23信封/RNG、不使用teacher112、不调用AI的停止边界、before-PASS口径、独立实验身份、旧场景行为不变。新增宿主文件纳入源证明；Native搜索/估值代码不变时，不重跑同一已验证冷根来刷计时，明确复用相同Runtime SHA准入证据。
5. 使用`robot_iterate`唯一登记运行，保留首样本每步256Native/600ms拒绝与checkpoint。若新根超限不提交/不代PASS，不重跑同源码同实验。首两轮资产对照V189已验证发展和当前教师、第三轮同时看盘面/具体科技/收入/存量与预投入，不能只按一个分数宣布达标。

最终goal仍包括：先完成第三轮具体行动学习，复核第二轮轮末的额外登陆/收入/保牌投入，再以此入口验证原23输入自主前三轮。计划不是实现证据或已通过的验收，不把当前小修复定义为整个goal完成。
