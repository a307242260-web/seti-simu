# 第471步规则执行失败定位（2026-09-07）

结论：真实三个选择中，展示牌与盲抽成功，取消失败。根因是
residual-domain-session.js的ALIEN_CARD_DECISION.resolveDecision取消分支返回
`{ok:true,spawnedEffects:[],irreversible:null}`，缺少正式executor必需的nextState。
session-runtime.applyResult明确要求ok与nextState，所以报EFFECT_EXECUTION_FAILED。
不是牌堆耗尽，也不是搜索预算问题；禁止删取消选项或放宽runtime验证绕过。

证据：`adhoc/inspect-choice-failure-471-20260907.js`从既有433检查点重放38个
正式动作至471，逐步动作描述符与完整after摘要均与a4453b64完整存档相同。
每个候选从同一envelope恢复执行，不运行AI搜索，不改变实际对局。
结果`choice-failure-471-20260907.json`保留三次完整规则结果；失败为
chong:cancel，effect为residual_alien_card_decision。检查点另行保存，后续复用。

拟修复边界：同一executor取消分支使用既有result(state,root,...)封装，保证保留
此前分析/痕迹得分，取消本次拿牌不改手牌/牌堆/展示牌/RNG/实体序列，不新增抽牌
事件或不可逆屏障；正常抽牌逻辑不改。该executor共用物种的取消路径也要验证，
不能只为虫写特例。先核对规则/文档与现有测试，冻结本修复边界后实施。

当前仅定位，未修改生产，未宣称归零。433的两次打牌失败尚未归因，不能由本例
推断它们也是同一原因。已检查性能计划与迭代规范，追加本证据入口；公共规则、
接口、README/AGENTS和AI设计未变化，无需修改，生产修复时再同步相应契约文档。
