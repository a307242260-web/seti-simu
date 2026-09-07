# 移动目的的正式完成证据与接入落点（2026-09-07）

## 本轮确定的结论

无需为访问目标新增正式规则事件字段：现有move/visitPlanet/visitComet/visitAsteroid
已携带playerId和rocketId。需要改变的是搜索保留和读取这些事件的方式。
148彗星奖励的实际完成输入是choose_payment，497两站奖励完成输入是choose_target；
不能仅在action.family为move时检查完成，也不能按付费动作发起时的位置预判完成。

证据movement-completion-events-20260907.json由同名audit脚本重放既有148/497四条
路线，共20个正式输入、20个移动/访问事件。每次先校验完整合法Action，再按当前
生产事件游标语义取本次新增journal事件；不运行AI、不重跑固定局。输入checkpoint
和路线文件的SHA256保留。每个访问事件均对应同次move的真实探测器和owner。

- 148有/无公司两条路线：彗星事件在最后choose_payment提交中发生，共享正式
  describeEventBonusProgress返回reward，正式claimedKeys更新并获得4分。
- 497有/无公司两条路线：到土星返回progress、0分且仍awaiting_input；返回火星
  才返回reward、写领取并获得3分。不能把第一站零分视为无用，也不能把返回原坐标
  当作原状态。路线总分变化与旧记录精确一致。
- 本证据只覆盖这四条既有路线，不覆盖奖励再插入新Decision、旋转、运输、重复
  无claimKey奖励或所有模型。保存恢复证据复用既有路线记录，本脚本不冒充新增恢复验证。

## 生产接入矩阵：完成证据这一个边界

下面是待实现契约，不是已经上线的接口。不另起搜索或规则执行器。

| 边界/唯一责任点 | 必须实现的职责 | 不可接受的旧入口/错误替代 | 可证伪证据 |
|---|---|---|---|
| AbilityRocket正式移动与Residual奖励增补 | 保持现有位置、费用、move→visit事件顺序、owner和rocketId；状态/RNG/id/Decision仍由原owner持有 | AI模拟奖励后直接写资源，或新增第二套移动执行器 | 本轮20正式输入及既有恢复证明；后续实际搜索计划再次走inputPort |
| rule-composition.executeNode.retainStep | 保留本次journal增量中的移动/访问事件，与真实action、提交前证据对应 | 现有仅launch/orbit/land的filter；不分游标重复读取整个journal | 148在choose_payment捕获visitComet，497两个choose_target分开保留 |
| capturePlanStep及每输入的完成事实 | 从当前working observation采集该步骤的来源、访问进度、公司/卡牌阶段；必要的提交后事实同样归该输入 | 将execution.leafObservation用于此前全部折叠输入的进度判断 | 一个节点中先访问后奖励时，较早步骤不能提前看到最终领取状态 |
| evaluator.completesSecondaryAgentRouteTarget | 按该origin的目的/来源/开始基线、实际事件及正式进度完成；任何family提交都可产生移动完成事件 | 只检查顶层move或只比较总分；拿另一个rocket的事件串源 | 148支付完成、497progress不完成；另一来源事件不能完成当前目的 |
| rule-composition逐步编译及goalCompletionPending | 完成成立后标pending，只有正式Decision排空才结束目标；每个planStep保留真实提交前状态 | 当前逐步完成检查仅orbit/land；把卡牌移动结束等同bonus完成 | 第一站继续移动，领取后奖励未排空时继续正式奖励选择 |
| selector→origin→plan | 主目的不被公司第二艘的准备目的覆盖；次要证据按origin传递并进入来源去重及计划依赖 | 仅按actionId回查三个route字段丢新证据；共享物理步骤被某个origin写入目的 | 同动作多origin各有自己的依赖；实际第二艘位置改变时该计划必须失效 |

正式事件已有身份，因此本边界不需要修改AbilityRocket、奖励规则或journal schema。
新目的的进度事实/来源仍需经过Production当前工作状态投影、公共观察和隐藏信息
过滤；不能将canonical root交给Policy。对未知新牌和旧注册记录的来源处理继续遵守
visit-source-contract-20260907.md，不以当前同模型卡推断原实例。

## 批次边界与未完成项

移动生产批次仍按“完整目的目录及资源下界→根/条件候选→逐origin完成/来源→计划
依赖→删除无需求入口”一起实现、集中验证。此文只关闭事件是否需要新增及支付时点
这两个疑问，不宣布整个设计冻结。仍须把所有目的的路线收益差异、共享移动额度、
来源/隐藏信息与上述完成证据统一到完整矩阵；不能先删公司全方向回退再补遗漏。

本轮只有证据与设计，没有生产优化或新策略版本。README、AGENTS、AI/RL公开接口、
规则/存档说明核对无需变更；性能计划和公司设计同步这项接入结论。生产基线仍
135649节点、36截断、均109.5，第一Goal未完成。
