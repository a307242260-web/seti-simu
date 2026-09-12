# RUNEZU-PANEL-TRACE-01

起点1e3cc2e6；独立目录/tmp/seti-runezu-panel-fix-20260913.XyRaVv。
插入式规则修复，预算调查保存在/tmp/seti-budget334-20260913.OJif7i；不混入候选贪心。
确认science痕迹入口遗漏panelSymbol奖励，粉1/4实际符号未入库，面板不变。

目标：通过已有takePanelSymbol正式原语，science痕迹1位领取补充、4位领取不补充；
三色映射由placeRunezuTrace返回的panelSymbolSlotId确定，不另抄映射或奖励公式。
使用science已提交RNG，补出隐藏符号须记录不可撤销边界；4位不消耗补充RNG。
失败显式返回，不返回nextState。正式事务负责不提交失败working state。
必需奖励字段缺失显式报错，不能默默跳过。

PASS：三色1/4位库存+1、对应面板正确更新、分数0/7、其他玩家不获符号；
1位从已洗好的availableSymbols首取，池空时使用正式随机补充且恢复重放一致；4位不补充不消耗随机；
2/3位拿牌路径不变，缺面板符号显式失败；相关unit与唯一full-flow通过。
真实334前缀仅作为修复复核，不要求继续保持含错误收益的旧完整轨迹。
单决策334冷运行战略不超过原19872.366875ms，预算4096/256/30000ms不变、错误归零；
若符号收益新增合法动作引起未达标，先定位成本，不绕过门槛直接全盘。
通过前置门槛后查重并运行唯一完整局，规则纠错不要求保持旧分；记录新热点与长期趋势。
文档、测试、结果独立提交，验收后合主并核验报告中心。

基线失败已复现：node tools/run_node_tests.js --match runezu-panel-trace，
pink1符号库存实际0、预期1，exit1；三色/1与4位及恢复一致性测试已登记。
Science已接入正式takePanelSymbol；三色1/4、2/3、缺面板、池空RNG与恢复一致性通过。
相关science-scan-flow与唯一standard-flow通过，源码语法通过。真实334已保存前缀复核通过：
粉1领取symbol_2并补充，粉4领取symbol_7不补充；分差含扫描后续奖励，不误算为仅痕迹奖励。
新增其他玩家完整状态不变断言，覆盖三色1/4位。尚待
单决策门槛、完整局及报告交付，不宣称整体修复已验收。
初次测试误用文档旧字段symbolBag，已按源码改为availableSymbols并同步物种文档；
正常池首取不耗RNG，只有原语池空补充才耗用已提交RNG，未改变这一既有规则。
