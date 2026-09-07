# 同目标切换资源取得方式时的计划依赖：独立修复设计

日期：2026-09-07。阶段：设计已收敛，尚未实施。原始反例代码8f058cc7，补证902e6f08之后。

## 结论与范围修正

补取379优胜叶的原始planSteps，确认编译后计划与既有诊断严格相同。
`blue-plan-origin-379-20260907.json`为权威来源，不从动作名称猜准备关系：

| 原始步骤 | goalDepth | routeTargetId | routePlanId | 完成待奖 |
| --- | ---: | --- | --- | --- |
| 借科技入口 | 1 | null | null | false |
| 选择purple3 | 1 | decision:choose_target:dd16a166 | 同名decision | false |
| DLC28角标、放数据、选blue1 | 2 | data:analyze | data:corner:card-52-0 | false |
| 扫描、选扫描源、继续放数据、分析 | 2 | data:analyze | data:scan | false |
| 分析后蓝痕迹与阿米巴牌奖励 | 2 | data:analyze | data:scan | true |

需要修复的是412之前同一个分析目标内的依赖被取数据方式切换切断。410公司能力是
独立目标，现有证据不能将它定义为扫描准备，也不为了保留公司额度扩大成全计划后缀
检查。此前blue-plan-412-review中的“410或更早”仅为当时待设计要求，本原始来源证据
将验收收紧为“412弃牌前”；不宣称公司能力消耗是本缺陷造成的浪费。

## 冻结方案：目标依赖与来源身份分开

唯一修改owner为plan-continuation中的逐步证据编译。公共观察、正式执行与搜索展开
不变。依据goalDepth + routeTargetId + goalCompletionPending确定同一连续目标段；
routePlanId变化不再切断该目标段的公共依赖，但具名路线/来源的选择仍使用本步的
连续routePlanId子段。不是删除来源身份，也不是将不同目标混为一个目标。

每步的所有依赖事实仍从该步执行前facts读取，绝不直接复制未来步骤的事实值。
因此自己预期的放数据、移位、领奖不会被拿来与更早盘面比较。逐步推进仍原样消费
对应步骤的证据；完成后的奖励段只持有奖励依赖，不继承已完成目标。

实现形态：compilePlanSteps建立连续目标段；stepScopes收集公共选择依赖时用完整
目标段，addRoute确定具体rocket/source时只用当前routePlanId子段（step.action、
probeAction、routePlanId回退优先级不变）。当前输入自身的movementPreparation与
movementContext约束不变。不要修改planReuseCheck为“检查所有未来步骤”。

## 完整义务矩阵

| 语义 | owner/事实与作用域 | 验收/禁止 |
| --- | --- | --- |
| 同目标切换方式 | compilePlanSteps按目标depth/id/完成待奖分段 | 412的data:corner须包含同分析目标data:scan的公共牌、扇区与地球依赖 |
| 不同目标 | 同上，不跨depth或target边界 | 公司decision不继承分析；已有move→research样例保持进入研究后释放路线 |
| 路线/来源身份 | stepScopes.addRoute，当前routePlanId子段 + 当前动作/probeAction | 保留sourceId/rocketId、第二艘与收入probe身份；不得由后面的另一来源覆盖本步路线 |
| movement-context/source | 当前step事实与正式动作target | card/company/hidden结束和方向、公司起点约束不变；不继承未来移动阶段 |
| probe-scan-source | 段内实际选择rocket + 当前step位置/布局 | 保留正式所选探测器，不用目标摘要代替身份 |
| tech | 段内正式tech目标 + 当前step techSupply | 科技剩余/bonus/枯竭变化失效；final:<tile>不得误作科技 |
| final-tile | 具名终局板块及当前变体/marks | 同目标前置准备持有依赖，无关板块不触发 |
| sector | 段内实际目标扇区 + 当前step候选事实 | 只依赖相关扇区，不将所有扇区快照做整盘比较 |
| card/card-slot | 段内具名已公开牌/公共槽 + 当前step事实 | 412须看到原扫描公共牌已变化；不读取未知牌或未来盲抽牌面 |
| data | 己方当前step dataProgress | 蓝槽顺序修复保留；原计划内预期占用推进应连续命中 |
| scan-earth | 当前目标段后缀仍有标准scan时依赖当前step地球 | 扫描队列已创建、后缀无scan时释放；不把独立奖励扫描假装标准scan |
| alien与完成待奖 | 段内后续奖励选择；完成标志切段 | 目标已完成后不再检查原路线/扫描准备，仍查实际外星槽 |
| 空/缺失事实 | 原有valid/reason与显式miss | 不加默认事实、空数组兼容或吞错；可选空值维持既有语义 |
| 合法集/actor/Decision | coordinator与现有planReuseCheck | 不改owner、状态版本、动作语义、stale判断或规则输入 |
| 状态/RNG/id/事务 | capturePlanStep只读公共观察，compiler纯函数 | 不改规则状态、随机序列、卡牌身份、历史或不可逆边界 |
| 执行/性能预算 | 搜索与正式提交共用链保持原样 | 4096/30秒不变，不改node记账，不增加默认全盘重搜 |
| 旧入口 | 只替换编译时“目标段等同来源段”的判定 | 不恢复旧单依赖系统，不新增第二套计划复用入口 |

## 验证顺序

1. 在既有plan-continuation unit添加同分析目标、不同data取得方式的例子，先确认旧版
   缺少未来扫描公共依赖；按本步事实编译应命中不变观察、拒绝变化公共牌/地球。
2. 覆盖当前来源/后续第二来源区分、不同目标释放、goalCompletionPending奖励隔离，
   以及本步和未来data占用不同仍采用本步事实。不要用仅检查字段存在的测试代替行为。
3. 对真实379原始planSteps离线编译：412旧版hit，新版在原观察下因公共牌变化miss；
   不变假设观察hit。公司410不被强行绑定；计划原始数据不变。
4. 相关unit、standard-flow、语法/V输入契约检查。单根379实际决策检查≤30秒、节点与
   正式输入正确；后续412允许重搜改变动作，必须记录原因与原计划差异，不强求旧action。
5. 489同目标填数据连续复用不能退化为每格重搜。检查目标完成奖励依赖不扩大。
6. 独立生产提交后才以新版本标准入口去重跑完整局；均分、各席分数、失败和截断必须
   全部记录。未达门槛继续归因，不以正确性测试替代全盘结果，不回滚蓝槽排序掩盖缺陷。

预期影响：提前在412发现已失效的分析方案，避免先按旧计划付出角标资源；会改变该
决策及后续行为，不承诺必涨分。单次编译多遍历同目标后缀，不复制额外完整观察；记录
实际单点/全盘耗时。状态等价、去重、可达性、资源下界和搜索预算均未改变，不属于
新搜索策略或启发式权重改动。
