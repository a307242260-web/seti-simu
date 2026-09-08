# 收入盲抽隐藏信息边界：独立修复设计

状态：2026-09-08收入屏障已修复，定向测试、真实第24步与完整局已完成；完整局均分109.75，下降归因尚未闭合，不宣称今日效果目标通过。

## 目的与范围

science_domain_income插收入时实际盲抽了新牌，但返回的scienceResult不含不可逆屏障。既有隐藏后继只在识别屏障后过滤未知牌面，因此第24步提前使用霍尔角标。只修该收入来源的信息事实，不夹带选牌贪心或资源权重调整，不恢复错误收益。

## 执行义务

| 语义 | 唯一owner及复用 | 预期证据 |
|---|---|---|
| 合法收入选择、收入牌移出游戏 | science-session INCOME；listIncomeChoices、discardFromHandAtIndex、addRemovedFromGame | 旧合法选择不变；重复/stale选择拒绝，无额外扣牌 |
| 增长收入与一次性资源 | players.gainIncome及applyImmediateIncomeReward | 钱、电、数据、抽牌各自只发一次，不改收入数值 |
| 实际盲抽 | cards.createCardDrawContext.blindDraw | 根据真实成功抽牌结果产生hidden_card_reveal；deck穷尽可用新牌和弃牌回收后返回ok:false，本owner显式返回SCIENCE_INCOME_DRAW_FAILED，不静默提交缺少奖励的收入，不虚报揭示 |
| RNG与实例序号 | nextCommittedRandom与deck正式实例创建 | 不为探测是否抽牌提前抽样，不二次抽牌；恢复同状态后结果一致 |
| 事务不可逆屏障 | scienceResult→现有session-runtime | 新信息阻止跨屏障撤销，非抽牌收入不增加屏障；不改Decision owner/version协议 |
| 搜索隐藏后继 | 现有rule-composition屏障与knownCardIds | 根未知卡不用于卡角/打牌/扫描/移动支付，根已知卡保留；真实执行后的新Decision可以看实际入手牌 |

先用正式收入executor的行为测试覆盖成功抽牌与非抽牌收入，不用手造hiddenCase替代来源证据；再补正式composition/真实第24步检查点验证隐藏后继及恢复。现有search-payment-choices仅证明屏障已存在时的过滤，不能当作来源已覆盖。

本修复不改状态等价、目标目录、资源下界或搜索预算；仍4096执行/256队列及原时间门槛。先单点验证实际节点、输入与耗时，未达单点门槛不跑整局。完整局按标准工具先list去重，独立登记修复后基线及分数，不把正常消除信息泄漏后的分数变化强行归为策略退化。

## 实施与已完成证据

- 正式抽牌callback检查实际结果；成功才设置隐藏信息屏障，失败返回具名错误。没有预抽样或增加第二份发奖逻辑。
- 修前science-scan-flow新增真实收入断言失败：已抽到dlc_40.png但irreversible为undefined。修后5种收入码（钱、电、牌、数据、宣传）及牌库耗尽显式失败验证通过；恢复重放全root一致，重复收入选择不改变root。
- `node tools/run_node_tests.js --match science-scan-flow`通过；`--match search-payment-choices`通过；`--match standard-flow`唯一full-flow通过；`node tools/audit_v_state_inputs.js`通过；生产文件语法通过。
- 当前代码只重放历史前32步正式输入：第32步收入选择成功，真实收入抽牌后observation正常包含新牌。此检查没有运行AI，不能替代搜索屏障传播验证。
- 检查并同步ai-design与测试inventory；未改Browser/Simulation公共接口、运行方式或目录结构，README/AGENTS和部署说明无需变更。本设计与生产/测试同次提交，今日Goal状态说明一并同步。

## 当前诊断补充

bd498c3a真实第24步搜索已完成一次，证据income-boundary-step24-bd498c3a-20260908.json；先list研究记录。捕获4096策略执行及1控制执行，未知牌面卡角/打牌/移动支付执行为0，断点与输入检查错误为0，耗时20597ms包含日志开销，不当作性能提升成绩。单点脚本verify-income-boundary-search-20260908.js按提交命名且拒绝覆盖；生产代码已提交，运行时仅新增只读诊断脚本，未改变生产实现。单点通过后运行的完整局结果见下一段。

上述单点后，完整局记录197640a3.f520347d.full.json已完成：608步终局114/103/88/134，均109.75；138721节点、171560正式输入、536633ms，规则失败0。相对aaaed8d0均分下降14，战略执行预算截断27/98→28/96，控制截断11/87→9/79，不能只凭总截断38→37称搜索改善。前23步完全一致，第24步白方放数据改发射；四席终局变化+27/-44/-33/-6。逐项数据见income-boundary-full-comparison-20260908.json，由只读脚本summarize-income-boundary-full-20260908.js生成，不重跑实验。完整局下降尚未归因，不以第五轮调权重掩盖问题；第五轮尚未实施。

补采获胜叶后已确认：新发射方案95.5中含错误的终局a2待标记预估22分。共享计分函数未按真实公司ID读取默认收入，将公司基础收入也计入增长量。该既有缺陷足以颠倒捕获的发射/放数据两叶排序，需独立修复；未证明整局下降全部由此造成。证据、同轨迹重计分及下一步见step24-income-boundary-attribution-20260908.md。

旧第24步去上限进程已返回143（终止信号退出），最后工具进度为144640节点、队列44402、5477.2秒；未正常完成，不能报告全展开总节点。保留既有JSONL，不自动重启同一实验，不把它混入本次有限预算修复验证。终止来源尚未核实。
