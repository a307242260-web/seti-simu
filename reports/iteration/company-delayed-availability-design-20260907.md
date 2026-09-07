# 公司未来额度：独立修复设计（2026-09-07）

当前状态：9968644b已实现并完成唯一固定局；正式反例、阶段与单决策验证通过，
完整局仍均100.5，低于109.5门槛。全部行动/终局状态同上一版，不能宣称整体通过。

## 目的与反例

77d36854将当前公司Action可枚举性作为未来路线额度。真实148检查点先用b24移动到
小行星(5,2)，此时公司不能提供所需的2点；付2点移出到(5,1)后，公司仍可免费一步
到金星(4,1)。当前目录却算3付费点。见company-delayed-availability-repro-20260907.json。
只修该遗漏，不扩大目标集合、不改策略权重、规则费用或4096上限；尚未证明它导致
上一轮均分下降9分，不能把独立修复预期写成找到了全部降分原因。

## 实施矩阵

| 边界 | 唯一来源与责任 | 正向义务及反例 |
|---|---|---|
| 公司额度 | residual-domain-session共享owner/PASS/公司身份/active检查，沿用industryAbilities.canStartActiveAbility与industry.canMarkIndustryAction | 尚有1x标记额度不等于当前有合法1点方向；已用/PASS/错误公司不能预支 |
| 正式启用 | canStartCompany继续执行当前几何、科技/公共牌前置及标记合法性 | 2点小行星上的单艘仍不枚举公司，不制造空Decision；保持原失败优先顺序 |
| 派生读取 | 从上述共享判定读取未来公司移动额度，不从当前Action枚举反推额度 | 当前不可启用但移出后可用应保留未来2次额度；不是新增持久状态 |
| 路线状态 | 沿用coordinate/cardRemaining/companyAvailable/companyPending/firstStep | 本来源只能在1点边消费公司点；先付费2点后公司1点可达，原图完全求解、无新增截断 |
| 根入口 | 仍与完整正式合法Action相交 | 目录允许未来公司手段，不能在当前不可启用位置返回非法industry首步 |
| 当前Session | companyPending仍由正式remaining/usedRocketIds读取 | 开启后不重新发2点、同一来源不重复，卡牌阶段结束后按真实状态重读 |
| 缓存/计划 | 新额度事实进入已有拓扑键及movementContext依赖 | 同坐标但公司标记/PASS变化不得命中错误额度；来源和主/次目的传递不变 |
| RNG/事务/输入 | 只读额度，不改变任何执行owner或输入协议 | 正式小行星路线支付前后状态与存档恢复一致，数值从正式支付获得 |

公共读取只返回寰宇额度2或0。必要的owner/公司active公共前缀从canStartCompany提取，
正式canStartCompany仍按原顺序检查几何/其他公司前置/mark；额度读取独立调用同一
mark primitive，不复制槽规则、不调用执行器。移除本轮引入的未用公司Action枚举常量。
`movementContext.companyAvailable`明确表示未开启且尚有额度，而非此刻一定可启动；
没有发射的来源仍不得提前抵扣。

## 验收

1. 正式反例从目录付费3修正为2；小行星上仍无公司Action，移出后才可用，最终到达
   金星。检查已用/PASS/其他公司与pending第2艘，不靠仅改断言证明。
2. 相关规则unit、完整流程、主/次计划依赖和V输入审计；已知失败单独列明。
3. 实际单决策≤30秒，物理节点、正式提交、真实计划链与失败分类落记录后才跑全盘。
4. 中文独立提交，research --list后robot_iterate唯一固定局；仍以已通过基线109.5
   为效果门槛，不能把失败版本100.5作为新合格线。先纠正实现，再分析剩余降分因果。

## 已有验证证据

- `company-delayed-availability-before-fix-20260907.json`：修复前同一正式7输入路线
  实付2点，目录3点，固定模式断言失败；不是凭理论改断言。
- `company-delayed-availability-fixed-cache-20260907.json`：目录修正为2，正式行动
  与费用不变，7次输入逐项恢复重执行含RNG一致。同坐标额度/已标记/恢复额度/PASS/
  恢复额度5种缓存用例费用为2/3/2/3/2；后者是明确构造的缓存unit场景，不冒充实战动作。
- `company-delayed-allowance-stage-regression-20260907.json`：42公司双来源主/次
  计划依赖及148/497既有4条卡牌路线，共5例通过。
- `company-delayed-allowance-decision-42-20260907.json`：真实冷决策16481.642292ms、
  4096物理节点、6546正式输入、26步优胜计划真实重放通过、0规则失败。仍满额，
  节点与上一版相同，不宣称本修复降低搜索节点。
- 文档核对范围：AI设计、Simulation接口、迭代中心、性能计划已同步；README、
  AGENTS与PROJECT_MEMORY的入口/职责未变化，无需修改。没有修改公司正式规则说明。
- 本次提交前全量Node：unit 78/80（22.29秒）、唯一fullFlow 1/1（0.62秒）；
  两个既有失败保持为simulation-counterfactual-outcome.test.js:292的12001≠0，
  strategic-goal-evaluator.test.js:432的data:analyze≠null。未改测试规避失败，
  不据此宣称零异常总门禁通过。V输入审计、修改脚本语法与diff空白检查通过。
- 完整局见`company-delayed-allowance-full-verification-20260907.json`：584步、
  101/124/97/80、均100.5、136381节点、174587正式输入、27策略及7控制截断、
  0规则失败；行动记录和终局状态同77d36854。耗时566004→564236ms，不足以证明
  实际提速。本修复对该固定局未改善结果，不把此前降分归因于这个反例。
