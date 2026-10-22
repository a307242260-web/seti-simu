# 共享搜索玩家接入

本接口仍为实验版本。Simulation通过`reset({agentType:"search"})`选择，
Browser通过`?agent=search`选择；两端都调用`game/ai/search-agent.js`的同一factory。
未改变默认旧策略，也没有将简易completion策略的整局成绩算给搜索玩家。

## 输入与所有权

宿主向共享`createAgentDecisionFunction`提供`analysisPortFactory({seatId})`。
runtime只在算法读取`analysisPort`时创建可信端口；completion与不搜索的custom无需创建分支。
factory收到冻结config和按席位绑定的端口，拿不到composition、envelope、RNG或runtime session。
每次decide的观察与合法集继续经过Policy Port复制、校验和冻结。

搜索玩家打开根后逐项核对当前合法集：actionId、owner、authority、Decision、family、phase、target、payload。
错误席位或失效边界失败，不按family找替代。正式提交仍由共享机器协调器对当前合法descriptor执行，
每次run只提交一个真实输入，Simulation只新增一个replay事件。
Browser高频inspect不复制原始actionOutcomes，查看lastOutcomeSummary；本次runOnce仍返回完整结果。

## 搜索与复用

固定配置为256输入、257节点、256前沿、600毫秒watchdog；现有六种证明开关显式开启，
状态等价、可达性/资源下界、比较边界与全局预算沿用既有搜索契约，没有新增截断。
算法身份绑定search版本、state-value版本及完整固定配置；实验指纹与completion/旧策略分离。
这只是单决策诊断配置，不是整局180秒已通过的证据。

搜索v19的取牌界接受已审计的11种标准公司组合及未达成B114/DLC9任务，仍逐项验证队列。
`cardChoiceEquivalence`分别使用交易信息边界证明和[已知PASS预留证明](ai-pass-reserve-choice-proof-20261023.md)；
代表动作必须真实到达各自预期边界并符合V。PASS之前搜索停在`hidden_pass_reserve_offer`，
不读未来选项、不计尚未取得的手牌。实际公开后的下一真实根才允许预留选择等价。

每次finally关闭分析端口，释放fork及精确转换缓存。已完成纯付款选择组件的opaque token
只保存在本席算法中，下一真实点击仍核对完整依赖与全部出口完成证据。
关闭端口不删除该份证据；reset、恢复、Browser invalidate和dispose均丢弃旧算法实例及临时token。
搜索v20另显式启用`planReuse`，复用[已闭合窗口的最优前缀](ai-plan-prefix-reuse-proof-20261023.md)。
同一回合的假设种子按公开配置和回合身份重建；完整状态、RNG、队列及合法信封仍须一致。
证书最多记录32个真实单输入前缀，宏内部、信息边界和其他owner不冒充已有节点。
它保留原完整比较结论及真实后缀见证；不能仅凭下一步合法就续用，也不能救活未闭合的首次搜索。

## 结果和失败

成功的agentTrace.coverage为complete，search保存scope、根去向、完整图、等价/证明归属、
未完成集合、预算与耗时，selectionContinuation与planContinuation均不导出。
searches返回本次搜索证据；选择或最优前缀续用记录0次新模拟及原证据引用，不把旧计算重复记账。
rootAndSearchMilliseconds包括打开根，analysis诊断保留正式提交、投影、缓存等成本。
value是非终局窗口估值，游戏分数须来自正式完整终局。

未闭合或没有可选边界时抛出SEARCH_INCOMPLETE并携带search诊断；runtime向onDecision发失败trace，
actionId为null。协调器保留cause，Simulation抛出，Browser返回明确code/message/search并停止自动推进。
不产生正式输入、replay或备用PASS。规则、观察、估值异常同样关闭端口并显式上报。

## 验证范围

search-agent.test比较真实收入检查点在直接搜索、Browser、Simulation的选择、估值和权威状态，
检查缓存开关、一个输入对应一个replay，以及复杂开局超预算时两端根/RNG/replay不变。
主行动后真实数据窗口也通过共享Simulation接入。
实际付款点击的两次完成证据命中与恢复后重新计算后缀一致，非法payload和错误边界拒绝。
主行动后窗口在共享Simulation中命中一般前缀证据，与恢复后的动作、估值、正式状态及会话引用关系一致。
真实Chrome的production-search-agent-entry检查脚本加载、机器提交和保存恢复。

这些是具体输入与共享接入的验证，不构成全部规则状态、整个游戏、搜索质量或单局速度验收。
复杂主行动、科技/任务/外星人更广范围、宏内部复用及完整局性能仍需继续。
旧heuristic的production-browser-full-parity未通过，本轮失败记录为60秒外层超时。
最终版只重跑启动、新搜索和completion三项Chrome检查；没有将旧流程算作搜索速度通过。
