# 触发扫描复用正式转换（2026-09-07）

基于a3f4289c，独立分支fix/trigger-scan-mapping-20260907。真实反例为610检查点下b123
黄色扫描奖励，见b123-trigger-formal-v2-20260907.json；禁止恢复旧扫描executor。

## 冻结边界

从play-domain现有createSpawnedCardEffect抽出唯一createScienceScanEffect，返回正式
spawn描述符或null（明确表示非扫描类型）。打牌与residual触发均调用该纯转换。
依赖复核更正：createSpawnedCardEffect还引用域内GENERIC_EFFECT_DESCRIPTORS，不能整体外移。
只将纯genericEffectRuntimeType提到模块级；通用转换保留原闭包。probe回手followup在
共享扫描转换中生成同一个正式RETURN_PLAYED_CARD_TO_HAND_IF描述符（id/options/owner/priority
与原递归转换输出一致），不执行回手、不复制回手规则。首次提取在Node回归发现此遗漏，
未提交、未运行AI；先修订冻结设计再批量纠正，禁止移动整张描述表及其runtime依赖。
导出createScienceScanEffect及下述共享chainScanFinalize。非扫描类型仍走各自原路径，不改变residual研究决策
提前进入Decision的现状，避免将其与此修复混改。删除residual旧SCAN_ACTION专属映射及错误注释。

| 完整扫描目录（源于原转换switch及前置分支） | 正式owner/primitive | payload与闭包 |
| --- | --- | --- |
| PUBLIC_SCAN | science SCAN_STEP/public | selected/max/consumeMarkers保持原值 |
| SCAN_ACTION | science EXECUTE/scanQueue | skipCost=true，不额外消耗主行动；串尾finalize |
| SCAN_NEBULA | science SCAN_STEP/specified | nebulaIds/gainData/label |
| ANY_SECTOR_SCAN | science SCAN_STEP/any | sameSectorRemaining与gainData |
| SCAN_COLOR_CHOICE | science SCAN_STEP/color | color/gainData/label；b123三色同路径 |
| PLANET_SECTOR_SCAN | science SCAN_STEP/planet | planetId/gainData |
| LANDING_SECTOR_SCAN | science SCAN_STEP/landing | 既有登陆来源读取 |
| PROBE_SECTOR_SCAN | science SCAN_STEP/probe | 原options、selectedRocketIds；afterProbeScan回手effect保留同cardInstanceId |
| CONDITIONAL_SECTOR_SCAN | science SCAN_STEP/conditional | condition/gainData |

转换不读写游戏状态、不生成id、不消费RNG。残余触发只将外层priority从direct设为trigger；
嵌套followup保持原priority。ownerId/cardInstanceId贯穿；Science持有choices、stale/wrong-owner
拒绝、信号/数据/扇区结算和正式屏障；Session保持事务和序号。Browser与Simulation均经同模块，
无新增脚本或装配顺序。预算、AI目标/评分/去重不变。

## 证据义务

1. 原九类转换逐项输入输出保留；非扫描返回null；输入不变、后续独立修改不污染输入。
2. b123正式原失败链接受奖励后进入science颜色Decision；黄色/红色/蓝色分别只枚举对应扇区，
   完成奖励后提交成功、消耗一次触发、放置真实信号；checkpoint恢复候选与执行结果一致。
3. 原打牌扫描/嵌套probe回手回归，以及唯一full-flow；需要浏览器烟测时按实际可用工具执行，
   不用Node替代浏览器证据。
4. 新提交610真实冷搜索，记录耗时/节点/提交/失败；通过后标准list去重全盘，归因棕方降分。
5. 同步机制文档及中文提交；实际计分和零失败门禁不因模型更高分放宽。

## 当前实现与证据

共享九类扫描转换已接入；非扫描保留旧路径，未迁移通用效果描述表或任何runtime。
原b123失败链三个颜色正式验证通过：yellow=sector-4-a/sector-3-a，red=sector-2-b/sector-3-b，
blue=sector-2-a/sector-1-a；各自最终65分、会话idle、触发消耗；保存/恢复后的合法选择与
完整envelope（含RNG/序号）一致。证据b123-trigger-fixed-20260907.json，验证脚本不运行AI。
原卡牌域回归通过。共享函数九类输入/输出与独立性回归同步增加；真实610冷搜索与全盘未做。
仅纯描述符转换出闭包，注册表/执行器/装配顺序不变；未声称真实浏览器smoke通过。

## 收尾边界复核（提交前）

普通三色放置信号不足以证明满扇区结算。play-domain原chainScanFinalize在整批SCAN_STEP
之后追加一次SCAN_FINALIZE；residual原路径没有调用。冻结方案补全为共享该纯组链函数，
支持外层队列priority（打牌保持direct，触发用trigger），仅在批内含SCAN_STEP时追加一次。
SCAN_ACTION自身队列已有finalize，不再追加。转换+组链是本修复同一完整方案，不另造收尾规则。
新增义务：多扫描只追加一个串尾finalize，无扫描不追加，触发优先级一致；满扇区正式执行
必须产生扇区结算。未验证此项之前不提交生产候选、不运行AI或全盘。

共享组链已接入applyFormalCardEffects，原卡牌域回归再次通过；三色原复现证据对应
加入串尾之前的候选，不冒充当前完整验收。下一步补满扇区与串尾顺序证据，并核对
加入串尾后的正式三色恢复；当前临时工作树尚未提交，主目录dev不变。
已同步mechanics-reference模块契约；扫描规则、牌面DSL、脚本装配及AI接口未改变。

## 收尾验收补全

当前完整候选正式重放证据：`b123-trigger-finalized-20260907.json`。三色奖励每次
新增一个SCAN_FINALIZE及一个SETTLE，先收尾再结算；原盘面三个分支均65分。
分别预填奖励目标至剩一槽的独立fixture，黄色sector-4-a、红色sector-2-b、蓝色sector-2-a
均产生sectorCompleted，settlementCount增加1；这些预填状态不是原固定盘面成绩。
原盘面与满扇区fixture保存恢复后完整envelope一致（含RNG和序号）。
验证脚本首次统计把整次主扫描累计journal也算入奖励，得到两次收尾；核对session-runtime
累计契约后改为相对奖励Decision前journal长度统计新增部分，生产实现未因该断言修改。
两扫描批只追加一次串尾、direct/trigger优先级、主扫描不重复追加的unit通过。
验证命令：`node tools/run_node_tests.js --match cards/play-domain`，
`node tools/run_node_tests.js --match standard-flow`，均通过。
文档核对范围：mechanics-reference已更新；AGENTS/README、alien-design、卡牌DSL、
ai-design和rl-simulation-env的入口/规则/schema未改变，无需额外修改。
本轮尚未执行新版本610冷搜索及全盘，不能宣称总体零失败或性能目标通过。
