# SETI AI 实施记录

目标：四席全 AI 整局 ≤180 秒、可复现，并在声明的决策范围内完成全部必要探索。
开发和验收口径见 [AI 开发流程](ai-development-workflow.md)。

## 统一接入与基础策略

新 `agent-runtime.js` 为每个席位创建独立 AI 实例。它复制并冻结席位观察和合法动作，
仅额外传递公开的多选选中状态，不传递 runtime session。策略同步返回 actionId，
由共享协调器走正式 Action/Decision 端口提交；未知动作、错误席位和 Promise 显式拒绝。
每次选择产出 `seti-agent-decision-trace-v1`，可用于重现输入和选择。

Browser 与 Simulation 共用 factory 和 runtime。Simulation 的 `runAgentDecision` 选择并提交一步，
`runHeuristicPolicyDecision` 保留原接口；reset/restore 重建新 AI 的席位实例。
Browser 的新实例也随 lifecycle invalidate 清空。

`completion` 是独立于旧 Heuristic 的确定性完成策略：按正式选中状态推进开局和弃牌，
数量满足后确认；主行动使用固定顺序，主行动结束后选择 end_turn。
它用于量规则和宿主成本，不具备搜索能力，也不宣称覆盖必要探索或具有足够棋力。

## 入口

```js
const env = createSimulationEnv();
env.reset({ seed: "agent-opening-v1", agentType: "completion", compactReplay: true });
const step = env.runAgentDecision();
// step.agentTrace 包含本次策略实际消费的只读输入和选择。
```

页面使用 `randomizer/index.html?agent=completion`；未指定时保留现有 AI 装配。
自定义算法使用 `createSimulationEnv({agentFactory: ({seatId, config}) => agent})`，
agent 提供 `decide(context)` 和 `getProvenance()`；恢复自定义 checkpoint 时仍须提供该 factory。

标准实验入口支持 `--config agentType=completion`，记录使用独立算法版本和指纹，
逐步决策 trace 保存到关联 `.decisions.jsonl`，搜索覆盖明确写为 not-evaluated。
完整局、性能、必要探索和复用缓存的验收结果在取得证据后补入本记录。

## 接入验证

在仅含 HEAD 和本批修改的独立源码快照中，100 个 unit 测试与唯一 full-flow 通过。
其中首次全量运行因快照漏带两份历史报告 JSON，两个报告测试失败；补入 HEAD 原始夹具后，
两项定向重跑通过，未修改相关生产逻辑。
真实 Chrome 的新 completion 页面完整 parity、原默认 AI 完整 parity 和启动入口共 3 项 smoke 通过。
本批验证覆盖接入、输入隔离、已选项推进、非法/异步返回拒绝、恢复和算法实验身份；
完整终局速度与必要探索尚未验收。

## 首个基础完整局

代码 `576bbc50`，种子 `seti-free-analyze-v1`，四席 completion：229 次正式输入后自然终局，
记录的对局运行耗时 7728 ms。该值未包含最终存档和报告写出，不用作端到端 180 秒验收。
该策略没有搜索，必要探索尚未验收。四席正式最终分为蓝 21、绿 21、棕 19、白 20；
分数只用于记录当前基础行为，不与旧 AI 成绩比较。

证据：

- [入库运行摘要](../reports/ai-foundation-20261022/run-summary-v1.json)与[确认动作序列](../reports/ai-foundation-20261022/confirmed-actions-v1.json)。
- [标准研究记录](../reports/research/cdbe7999.576bbc50.full.json)。
- [逐步策略输入](../reports/research/cdbe7999.576bbc50.full.json.decisions.jsonl)。
- [完整存档](../seti-saves/seti-save-research-ai-foundation-20261022-576bbc50-full-v126.json)。
- [逐步复盘](../reports/iteration/ai-foundation-20261022/cdbe7999.576bbc50.full.action-log.html)。
- [决策重算审计](../reports/ai-foundation-20261022/trace-replay-v1.json)：从原始可见输入重算 229 次选择，全部一致；未重复运行该成绩实验。

原始研究记录、16.5 MiB 的逐步输入和完整存档按仓库 `.gitignore` 留本机，未强制入库；
入库的是小型摘要、确认动作序列、审计指纹和复盘报告。

## 可信分析分支接口

`analysis-port.js` 提供 `openRoot/expand/close/getDiagnostics`。权威 envelope、隐藏牌序和
分支恢复能力留在闭包中；算法只收到公开观察、当前合法集、节点状态和信息边界。
分支复用同一正式 Production Composition，按完整 actionId 精确提交；支持有容量限制的精确结果缓存。
改变真实隐藏牌序后，正式弃两张牌再盲抽这条路径的可见结果保持一致；到屏障后禁止继续展开。
缓存关闭、命中和淘汰后重算得到同样结果，分支执行不改变真实根或 RNG。

单决策根展开诊断在固定输入上执行 23 个正式候选，全部成功；冷展开 82.45 ms，
缓存重取 1.66 ms，创建分析根另耗 8.81 ms。这只是根转换成本，尚未展开完整准备链，
不能外推为整局搜索已经满足速度或覆盖要求。
[诊断](../reports/ai-foundation-20261022/analysis-root-benchmark-v2.json)、
[输入检查点](../reports/ai-foundation-20261022/analysis-root-input-v2.json)、
[源码摘要](../reports/ai-foundation-20261022/analysis-source-manifest-v2.json)。

初次诊断发现正式合法集在无本席探测器时仍提供 energy-for-move，提交必然失败。
已让 Production 枚举复用实际移动选择的可用性检查，并更新旧的“先枚举再失败”测试。
此修复服务于新搜索逐候选执行，未继续处理旧策略待办。

## 基础策略开发集

代码 `2bc7b88c` 在独立源码快照中完成 8 个固定种子、四席 AI 的开发集：
全部自然终局，共 1964 次正式输入，每局 221～264 步。
包含结果写出与复盘生成的冷 Node 进程耗时为 10.27～13.40 秒；这是完整游戏计算时间的保守上界。
测试机器为 Apple M4、10 逻辑核心、16 GiB 内存、Node v22.22.0；未预热算法缓存，未清空 OS 文件缓存。
该结果仅适用于 completion 基础策略，不能外推为搜索 AI 的 180 秒要求已经通过。

[开发集记录](../reports/ai-foundation-20261022/devset-v1.json)保存每局种子、代码、指纹、动作数、
耗时、分数和产物路径。[决策重算](../reports/ai-foundation-20261022/devset-trace-replay-v1.json)
核对全部 1964 个可见输入的选择；[恢复验证](../reports/ai-foundation-20261022/devset-recovery-v1.json)
从每局中点 checkpoint 比较原路径和恢复路径的后缀，共 984 个后缀决策，动作和观察全部一致。
恢复验证使用原记录前缀做规则重放，不产生新的成绩实验。

首局标准工具在游戏结束、结果落盘后尝试重建无关历史报告而退出。
只在评测快照中把版本登记限定为本次基础 AI，随后补生成该局报告并继续其余种子；
首局退出原因保留在开发集记录，没有重跑该局或迁移旧档。共享登记只增加本次条目。

## 独立估值

`state-value.js` 是新的纯估值函数，不导入旧启发式模块。
当前范围是已兑现分、按当前盘面正式公式计算的终局加分、资源与手牌数量、剩余轮初收入；
正式终局只返回 finalScore。未知牌按数量处理，缺玩家/自身手牌/收入或非有限数字显式失败。
轮初收入按正式第2/3/4轮窗口计入，插收入的立即奖励已进入当前资源，不重复增加。

默认资源刻度属于首版估值假设，不是规则兑换率或收益上界，禁止用它证明剪枝。
科技未来能力、任务的未来兑现和长期路线价值尚未实现；目前也没有把该函数接成新的搜索策略。
手算、输入缺失和真实分析观察的测试通过。
[输入审计](../reports/ai-foundation-20261022/state-value-input-audit-v1.json)显示新路径通过；
同次标准审计中的旧 V 在冻结对象上添加 aomomo 字段失败，保留原始日志，未修订旧 V。

## 完整决策图与循环去重

新增 `decision-search.js`，比较边界为本席当前可见决策窗口到其他 owner、信息屏障或终局。
stable 不作为叶：主行动前后仍可用的准备动作及全部条件选择继续展开。
以可信端口的不透明身份令牌合并节点，保留每个根动作和所有回边；只有完整图闭合后，
才从边界叶逆向传播估值。无边界可达的闭合部分记为 unreachable；分数不参与剪枝。
同分选最短完成路径，再以 actionId 稳定打平，避免执行零收益循环。

向前状态等价保留全部规则状态、实体序号、数组顺序、假设 RNG、剩余队列及中断上下文。
仅剥离 authority 版本、历史日志、撤销副本及对应传输编号；Effect/Group 引用按引用关系规范化。
该等价仅适用于端口提供的向前正式输入，不适用于 undo/abort 或可读取 journal 的自定义规则。
开局和弃牌“选择→取消”及其后继等价的真实 Production 测试通过；不同选中状态、
不同弃牌顺序仍保留。算法只能取得空的身份令牌，无法读取隐藏状态键。

新分析分支使用显式 opt-in 的快照 RNG 恢复：根随机状态从公开输入构造，后继继承已保存状态，
不再由路径长度重置。原有 counterfactual 调用未启用此选项，保持原契约。
分支依然不改变正式根、RNG 或 replay；隐藏牌序替换、缓存关闭和淘汰后重算测试通过。
当前缓存仍是同一节点/路径的精确结果缓存，尚未跨真实决策复用计划。

单决策诊断额度为全根合计 128 次正式输入、129 个唯一节点、128 个待处理节点和 1000 ms 监控；
任何额度耗尽均返回 incomplete、逐节点已走边和未走 actionId，actionId 为空。
尚未加入资源下界或收益上界剪枝，不以深度、低分或队列截断删除分支。

[固定主行动基准](../reports/ai-foundation-20261022/decision-search-benchmark-v1.json)
使用原有输入 checkpoint，在隔离源码快照中测量：23 个根候选、128 次正式输入、125 个唯一节点，
识别 4 次等价，仍有 87 个节点待完成。关/开缓存分别耗时 445.56/365.98 ms，图和覆盖结论一致；
两次均无缓存命中，耗时差包含进程内预热，不能算作缓存收益。
结果为 transition-budget/incomplete，**未通过完整覆盖门槛，因此未跑搜索版完整局**。
600 ms 只是由基础局 264 次决策、13.40 秒总耗时反推的初步单决策性能门槛，不替代整局验收。

8 项相关 unit 与唯一 full-flow 在独立源码快照验证通过。后续需减少有证明的重复展开、
加入跨真实决策的计划/完成证据复用，再验证完整搜索的分数和整局 180 秒要求。
