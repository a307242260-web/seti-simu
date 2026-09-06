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

## 修复设计冻结

来源：虫实现说明和通用外星人设计均明确允许取消；执行器由六个有blindDrawCard的
物种共用：异常点、半人马、虫、阿米巴、奥陌陌、符文族。九折/方舟无该能力，不接入。
唯一owner仍为ALIEN_CARD_DECISION.resolveDecision，唯一生产修改为取消分支调用
已有result(state,root,source,extra)，不改变Choice枚举、Decision版本/owner验证、
抽牌处理或runtime结果验证。source使用具名alien:<species>_card_cancel。

状态义务：取消不改当前working root，已有奖励保留；只通过既有commitWorkingState
生成nextState并让原Session继续/提交。手牌、资源、外星人牌堆、展示、RNG和实体
序列相同，无新抽牌事件、followup或不可逆屏障。Session自身确认Decision的journal
与版本推进是正常行为，不要求这些元数据不变。

验证：六物种各以有牌/无牌状态走真实executor，检查nextState与完整root不变；
真实471从保存检查点执行取消并核对取消前working root中的玩家/外星人/RNG/序列，
再做单决策失败数与计划检查；相关回归、中文提交后按去重流程完整局验收。
433另外两次失败不混入本修复，不扩大到所有executor返回值重构。

## 实施与局部验证

已实现唯一取消分支的正式result封装。六物种×有牌/无牌测试先红（缺nextState），
修复后全部通过；完整root、无新增抽牌事件/后续/屏障均按冻结义务核对。
真实471证据`alien-card-cancel-471-verification-20260907-v4.json`通过：取消后
玩家、牌堆、外星人、数据、棋子、RNG与实体序列和取消前working root相同；
搜索仍3节点，成功执行2→3、失败1→0。选中的动作由拿展示牌变为取消，不能宣称
策略动作与旧版相同；原先失败的合法结果恢复后排序改变，完整局效果待验，不调权重。

取证失败也保留：初版/v2在执行前调用完整simulation投影，导致共享meta被冻结，
后续提交报EFFECT_SESSION_COMMIT_THROWN（stateVersion只读）；这是独立待修复
问题，不加生产绕过。v3改用正式envelope取证，取消执行成功，但脚本未解码字符串
committedState导致比较失败；v4解码后通过。前三份不是三次生产修复，仅脚本
取证修正；生产始终只有既定result封装一项改动。

投影问题证据：rule-composition.projectionInner对完整观测deepFreeze，
production-kernel的trustedProjectionReader路径浅展开state，meta仍可共享。
它与取消结果契约分开修复；不能因普通搜索此单点通过就声称投影问题不存在。

提交前门禁：单决策总81.689ms，3物理节点/3正式执行，无失败；此为修复验证，
不与历史26ms搜索内部时间混作提速对比。全部Node回归77/79 unit通过，唯一
fullFlow通过；两项既有失败与修复前相同，另案待判定处理。V输入审计、语法与
diff检查通过。已同步通用外星人契约、虫说明和性能计划；README/AGENTS/AI及
RL公共接口未改变，无需更新。本项完整终局待提交后验证，未宣称第一Goal通过。
