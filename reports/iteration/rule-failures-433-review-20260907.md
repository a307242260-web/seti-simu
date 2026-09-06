# 第433步剩余规则失败取证

两次EFFECT_EXECUTION_FAILED均来自后续获得并打出的b138，不是根状态三张牌。
真实规则返回：launchProbe，火箭数量已达上限（1/1）。尚未修复，不吞错或删除候选。

root-cards-433-20260907.json：同一根envelope分别提交b140/b17/b58均成功。
rule-failures-433-20260907.json：对真实433冷决策设置Node inspector条件断点，
捕获session-runtime正式失败判定处的effect、返回值、完整workingState及journal，
两条捕获与failedNodeCountByCode计数一致。未替换生产函数，不作为性能测量。
脚本为adhoc/capture-rule-failures-433-20260907.js，已有证据即跳过。

两次均为card_play_domain_launch，b138-launch，card-34-pass-3-5，
skipCost=true、ignoreRocketLimit=false、repeat=1。需要先核对规则：打牌的不可执行
效果如何结算，以及正式打牌准入与效果执行各自职责；不能仅凭错误推断应禁止整张牌，
也不能把任意launch失败转换成功。下一轮独立设计、复现、修复、单决策及版本完整局验证。

规则已核实（2026-09-07）：CGE 官方 FAQ 第2页 General Q2 明确以“已达探测器
上限但需要发射”为例，要求跳过该效果并继续其他效果；Q1 要求本可执行的行动效果
正常执行。27页英文原件已下载到 rules/seti-faq-base-en-202411.pdf，pypdf校验内容，
不是HTML跳转页。修复方向已确定：不禁止整张牌、不忽略上限、不捕获所有失败。
设计边界见 card-launch-limit-design-20260907.md；正式节点已实现，六种边界回归通过，
真实433单决策与完整局结果仍须分别验证。
