# 目标选择异常传播：冻结方案

2026-09-08，基于dev bea25aee，独立分支fix/route-selection-error-20260908。目的只是不再吞掉目标选择回调异常；不修改目标目录、优先级、估值、预算或数据组合策略，不用于解释此前降分。

当前rule-composition.evaluateCounterfactualOutcomes在未绑定目标时调用selectRouteTarget，catch后静默保留旧target/plan。当前heuristic-decision-function启用allowUntargetedRootActions，路径可达。合法的null返回与抛出异常含义不同，不能同样按无目标继续。

| 义务 | 唯一实现与验证 |
|---|---|
| 正常返回字符串/对象/null | 原有目标解析完全不变；原search-budget正常路径回归 |
| 回调异常 | 原对象向调用方抛出，不形成完成叶或退回旧目标；两种fork模式注入同一Error验证 |
| 非复用fork | executeNode的finally已释放；禁止在回调失败时重复释放 |
| 复用fork | 在该异常边界释放池中composition，并将引用清空；按实际dispose契约验证订阅已清除，后续正式提交不通知旧监听器 |
| 释放也异常 | AggregateError保留选择错误和释放错误，不丢任一错误；不静默吞掉 |
| 正式状态/RNG/历史 | 只释放隔离fork，不提交root；异常前后完整root envelope相同 |
| 搜索预算 | 4096/256/30秒及所有计数不变；失败不返回半成品诊断/动作 |
| 范围 | 只修selectRouteTarget这一处捕获；其他异常捕获不得借机重构 |

先让新增行为测试在原代码失败，再实现完整异常边界并运行search-budget及相关搜索回归。正常真实第24步单决策确认后，通过标准去重流程运行完整局，预期动作和101.75正确基线一致；如暴露真实选择异常，独立定位根因，不恢复吞错或调分。代码与docs/ai-design.md及本记录同步提交。未通过完整局前不合入dev。

验证记录：原实现新增回调异常测试失败（Missing expected exception），已复现吞错。初版测试误假设dispose后save抛错，实际dispose只取消订阅/清空监听器，不能为满足错误测试扩展生产生命周期；已修订义务为旧订阅不再收到后续提交通知。生产修复方案不变，失败记录如实保留于此。

复用模式夹具还需显式启用与Production相同的allowTrustedForkLifecycle，否则其restore在到达目标选择回调前已经失败，不能验证回调抛错。补齐该既有正式能力开关，不增加生产兼容路径。
