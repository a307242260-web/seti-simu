# 方舟高级奖励修复进度（2026-09-08）

独立候选分支fix/fangzhou-major-reward-20260908，生产提交4d3711c5，基于954e51c0；未合dev。
已实现12张card2模型→正式翻高级奖励→共享执行器，删除旧专用奖励type，
fangzhou_reward_reveal纳入搜索隐藏信息边界。不改方舟槽位策略、评分或搜索预算。

验证：9种奖励正式事务全部完成，付费/翻牌一次、效果结算、中途恢复全envelope一致；
错误owner/版本拒绝且状态不变。额外验证满额时无视上限发射、无科技目标时公转后
继续、第五张后重洗冷实例一致。最初新增测试误读journal.actions的action包装，
按正式日志结构修正后通过，未修改生产日志接口。

syntax及diff检查通过；V输入审计必需路径全部通过，唯一full-flow通过。
全量Node：unit 81通过/2失败，共83；fullFlow 1通过。原候选954e51c0再次定向
复现相同两项失败：simulation-counterfactual-outcome.test.js:292要求beam=0但
实际10130；strategic-goal-evaluator.test.js:520期待目标null但实际data:analyze。
这两项不是本修复新增，不改旧断言来制造全绿；本次不宣称全量通过。
本轮完整日志位于adhoc/fangzhou-node-regression-20260908.log（临时工作树运行产物）。

追加验收（2026-09-08）：
- 隐藏边界：奖励5既不抽牌也不重洗，单一打牌反事实仍产生fangzhou_reward_reveal；
  全部叶标记该边界，正式根全envelope/RNG/牌堆不变、实际失败0。仅1节点，不是性能基准。
  证据：fangzhou-hidden-boundary-4d3711c5-20260908.json。
- 正式撤销：奖励0在黄痕迹选位等待时，两步可逆效果可撤销；第三次被
  EFFECT_UNDO_IRREVERSIBLE_BARRIER拒绝，拒绝前后全envelope一致。这是预期负向输入，
  不是搜索规则失败。证据：fangzhou-undo-4d3711c5-20260908.json。
- Chrome：通过生产页面读档、选中方舟粉1、点击打牌；钱6→4、电2→6、额外公共
  扫描0→1、手牌4→3、主行动结束、撤销禁用，控制台无warning/error。
  使用奖励5派生fixture，不伪称历史盘面；只读临时服务已停止。
  证据：fangzhou-browser-4d3711c5-20260908.json（前后DOM）。
- 蓝方第50步未限制候选的真实决策：13355.78ms、4096物理节点、5101输入、失败0，
  与直接父版954e51c0（14998.43ms）相同动作/节点/输入，优胜计划正式逐步执行成功。
  通过30秒单点门槛；该盘面无方舟，不证明新奖励策略质量；仍截断，不称性能通过。
  证据：blue50-expiry-fangzhou-20260908.json。

已先执行研究记录--list，候选4d3711c5此前没有完整局。标准入口正在运行
fangzhou-major-reward-20260908完整局，直接基线turing-immediate-expiry-20260908。
进度逐步透传，不重跑旧局。终局结果、完整局异常审查及版本登记尚未完成，不能称
修复完整通过或性能目标完成。本项按规则bug例外验收，整体Goal门槛不变。
原扣费无奖励复现与完整设计保存在主dev报告中心，本文件随生产候选保存。

文档已同步方舟机制、卡牌DSL、AI隐藏边界、测试inventory及设计；README/AGENTS
入口和RL观察/输入schema未变化，无需更新。无新依赖，无长期记忆修改。
