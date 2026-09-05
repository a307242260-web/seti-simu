# 得分角标目标准入：完整设计

## 目的与边界

真实绿方第二轮PASS前amiba_1角标可完成+1分，现行V也+1，但目标准入将它排除。
仅修复直接得分角标的目录准入，归属独立版本；不声称预算改动导致该旧遗漏。
不加卡名/席位/PASS特例，不调整评分，不放行全部quick，不更改正式奖励或执行规则。

## 冻结矩阵

| 边界 | 正式来源/唯一owner | 方案与可证伪义务 |
|---|---|---|
| 完整类型目录 | cards/deck的getDiscardActionCodeForCard、getDiscardActionRewardForCode、getDiscardActionMoveRewardForCode | 两种奖励表gain.score>0均准入：当前code4数据+1分、code5移动+1分；code0/1/2/3及未知不因本规则准入。不复制数字表 |
| 可见性与实例 | 现有合法card_corner描述符及同viewer selfState.hand | 按cardInstanceId精确匹配；不读其他玩家手牌或牌堆，不按相同卡名合并 |
| 目标与计划身份 | 已有card:resolve:<实例ID> | targetId与planId复用同一身份；现有data/probe等目标并存，来源由原originKey保留，不额外制造奖励 |
| 准入owner | expected-score-evaluator.enumerateSecondaryAgentRootTargets | 根与后继目标目录同一实现，不给某个调用点单独开口 |
| 正式提交与完成事实 | Production card_corner/inputPort、completesSecondaryAgentRouteTarget | 成功执行后实例离手触发既有完成事实；实例仍在手或另一个实例离手不完成。不得仅凭score增长判断来源 |
| 条件闭包 | composition.goalCompletionPending和awaitingInput/conditional | code4数据放置/蓝槽奖励及嵌套选择，code5移动/支付/无目标skip，沿用正式排空；目标完成事实不等于已可产叶，未排空不算完成收益 |
| 计划依赖 | plan-continuation.stepScopes已有card:resolve白名单和实例依赖 | 根消费对应手牌依赖，完成后奖励阶段只保留具体选择依赖，不新增未知目标前缀。保持revealedCount等失效规则 |
| 估值与后续 | 标准outcome投影、V、winning leaf提取 | 收益只从正式完成叶计算，不给目录额外+1；完成目标后的统一调度不改，不借新增权重追分 |
| 状态与预算 | Production fork/完整状态去重、4096/256/30秒 | RNG/id/Decision归原owner；不增加节点、局部搜索或逐根配额；近似裁剪继续显式报告 |
| Browser/Node | SetiCards（deck.js）/require(cards/deck) | index.html中deck在evaluator之前，复用同一API，不更改脚本顺序或浏览器独立逻辑 |

## 验证

unit覆盖两种正式得分类型及所有非得分类型、实例匹配、目录换序、完成判定与条件
选择延续。真实保存PASS盘面单次诊断必须看到角标有完成叶、正确+1、合法后续计划，
不能只有枚举测试。相关搜索、计划与V输入审计；完成后中文提交，在干净版本按研究
去重流程运行快速/全盘并登记。终局至少106.75且实现符合设计才收口；局部+1不代替
终局或证明全局最优。若实际实现不符合预期，先找偏差，不调预算或权重补偿。

同步AI设计、四轮计划、版本记录；接口schema/存档、README、AGENTS、PROJECT_MEMORY、
RL观察字段及部署/脚本顺序未变，无需调整。新Node测试纳入既有unit分类清单。

## 局部实现证据

现已按矩阵实现，无需修改计划或规则内核。真实绿方保存盘面77.6ms、3节点，
选card_corner:68d40e4b；完成叶包含角标+结束移动，另有继续PASS叶。计划下一步为
choose_target:5b51e8f7，实际通过plan-continuation-fast-path提交，分数25→26。
证据score-corner-r4-real-20260906.json来自新实现工作树，不冒充干净提交的全盘。
score-corner-target unit覆盖正式得分/非得分目录、换序及实例完成；无新终局结论。
默认回归76/78 unit通过、唯一full-flow通过；两项指定旧失败仍分别为“不恢复beam”
和分析后目标释放断言，未修改。V输入审计、语法及diff检查通过。

## 固定盘面结果与局限

生产0d21aebf，quick-200为144137ms，随后同提交存档续跑350913ms，总模拟495050ms。
579步正式终局74/118/116/108、均104；较101.5候选提高2.5，低于验收基线106.75的
2.75。第三/第四轮未通过，不能将独立漏评修复的局部成功外推为整体完成。

7a4c63fd.0d21aebf.quick-200/full均归本版本。只读核验前200步完整replay一致、
正式终局与研究记录一致；绿方第257步amiba_1角标+1，下一步正式结束移动。
本局三次角标即时加分分别为amiba_1、chong_7、chong_9，其他角标仍可经原目标进入。
但与上一候选首处分歧为第254步白方公司换牌：从换出chong_7变为换出chong_2，
后续换入也不同。入口用于后继目录，可能改变此前选择的搜索评价，需核对实际优胜
叶而非认定行为越界或分数回升就通过。当前没有该更早选择的因果验收证据。

首次核验脚本错误预设首分歧就是旧绿方PASS位置，被实际253索引推翻；修正为先
测量首分歧、再独立定位角标实际执行。未改生产以迎合断言，未重新运行AI。
验证数据及源存档哈希见score-corner-r4-full-verification-20260906.json。
