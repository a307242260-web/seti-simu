# 逐次搜索统计：冻结设计（2026-09-06）

目的：满足用户“整体节点占比与满额搜索节点占比”要求，并为失败尝试归因。
这是观测改动，不是性能优化成果。基点ca371810，生产行为基线213f34db/均108.5。

| 边界 | 唯一owner与实现义务 | 验证 |
|---|---|---|
| 每次evaluate | rule-composition入口清空旧诊断；执行前记尝试family，失败记family/code，三处成功正式提交统一在retainStep计数 | 成功+失败计数守恒，折叠提交计数不等于宏节点数；根不变 |
| 搜索与决策 | Heuristic每次run使用局部searches列表；control/strategic分别在evaluate返回时取本次统计 | 双搜索各一次，setup无搜索为空；不修改Policy输入、plan或outcomes |
| 缺诊断/抛错 | evaluate早退不借上次诊断；以null明确缺失，记录器拒绝冒充完整统计；原搜索异常继续抛出 | 缺数据不默认零；超时无完整局报告不算覆盖 |
| 宿主透传 | Simulation普通决策/teacher返回本次searches，计划复用明确[]；Browser不增加执行路径 | 真实一次scheme加后续reuse，观察/计划/逐叶hash与旧版等价 |
| 研究收集 | 只消费result.searches，不再读env的last诊断；按step与搜索顺序保存kind和统计 | 复用不重复触顶；control不混充策略满额 |
| 快速续跑 | quick完整searches播种后追加新段；旧记录无searches显式拒绝，不猜旧次数 | 新记录拼接等于完整前后列表；旧记录仍只读可查看 |
| 满额口径 | kind=strategic且executedNodeCount达到maxExecutionNodes（当前4096）；与“达到且还有frontier”的executionLimitReached分开 | 自然恰好4096也算满额，旧budgetHits继续表示仍有队列的截断 |
| 隔离与成本 | 统计只复制少量计数/分类/时间，不复制观察或叶；不进入持久游戏状态、不影响RNG/id/Decision/排序 | 真实存档与结果对照；不增加逐节点计时开销 |

状态等价、目标可达性与资源下界、4096/256/30秒、beam排序和真实规则均不变。
新增attemptedNodeCountByFamily包含失败尝试；原executedNodeCountByFamily保留“成功
宏节点”含义。successfulInputSubmissionCount计真实成功Action/Decision（包括之后
宏步其他阶段失败之前的已成功输入），不含单席位时钟推进；不能据此改变预算。

先完成unit、单状态行为等价和计划复用统计，再提交观测版本；去重登记新版本的
quick→full，取得用户所需全局数据。新版本有明确采集目的，不重跑旧版本已有实验。
完整终局成绩、统计覆盖与性能分别报告；尚无全局分布时不外推五个满额样本。

## 单状态验收进展

2026-09-06：全量Node unit 77/79、full-flow 1/1；仅用户指定暂不处理的两个既有
断言失败（旧no-beam、分析目标释放）。V输入审计通过，新增统计与预算unit通过。

白24：动作、计划、全部叶和提交后完整coreState与旧基线一致；control 1节点/1提交，
strategic 4096节点/6297成功提交；随后真实计划复用searches=[]。单次10.66秒，旧10.23秒，
不是提速结论。证据search-statistics-step-24-20260906.json。

绿42：动作、计划、全部叶一致。最初完整coreState哈希比较失败，保留失败记录
search-statistics-step-42-20260906.json。补证recovery记录确认正式游戏状态完全一致，
差异仅在会话恢复后的effect-session-1与连续重放的effect-session-10及其引用；
同一恢复入口、不搜索、直接正式提交旧基线动作，完整coreState哈希与搜索后提交
同为b979e44ed0f982d3478f54bf297cc499c5a8be574f312afc7e65e6605079abc6。
这不是统计改动改变了规则状态，不修改恢复机制来满足跨入口原始hash断言。
strategic 4096节点/4376成功提交，1398次失败均为EFFECT_EXECUTION_FAILED；
该通用错误码不能证明1398次具体message均为撞边界。单次10.35秒，旧10.30秒。

当前尚未提交观测版本或运行其quick/full，整局占比与性能优化仍待完成。
