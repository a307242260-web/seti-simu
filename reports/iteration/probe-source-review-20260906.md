# 探测来源与登陆修复实现验证（2026-09-06）

## 改动

搜索按具名requirement保持火箭来源；正式发射事件将launch占位转换为实际rocketId。
直接路线和收入探测共用后继选择，资源准备保持原绑定。识别通用land入口并在后续
选靶匹配火箭、行星及主星/卫星；以本次正式orbit/land事件判定完成。每次真实提交
同步推进后续计划来源和奖励阶段；rollout版本更新为v18。

## 已完成验证

- `probe-source-binding.test.js`覆盖来源消失、候选换序、两阶段land、收入探测复用、
  席位/主星/卫星完成事件、首发转换和后续发射不改绑定。
- 真实绿方PASS前状态：约290ms、85节点，选择两牌换电，选中的叶正式登陆1号火星，
  路线评分17、目标深度1；不再误移动5号。17为这条叶的实际分差口径，不是终局成绩。
  证据`probe-source-search-verification-20260906.json`。
- 直接执行该已保存计划，支付、land入口、1号选靶及外星奖励连续6步复用全部命中，
  奖励阶段不再依赖已移出的火箭。没有重搜。证据`probe-source-plan-verification-20260906.json`。
- 真实棕方慢样本9841.20ms/4096节点，仍选择launch:c1616852，首步launch占位在
  次步正确转为rocket:4，整个生成计划无invalid步骤。通过10秒门槛但余量小；
  `probe-source-performance-20260906.json`的gitCommit为实现前HEAD，诊断运行于本次
  实现工作树，不是干净版本全盘记录；生产文件哈希记在plan-verification中。
- 默认Node：74/76 unit通过，唯一full-flow通过。两个用户指定既有失败保留。
  新出现的heuristic-evaluator测试失败因fixture缺requirementId/routePlanId；
  补齐当前正式身份字段后通过，不改生产实现兼容旧的无来源输入。
- V输入审计通过，语法与diff检查通过。尚未运行新提交固定盘面完整局，不能判第三轮通过。

## 文档与范围

同步AI设计、RL内部搜索契约、Node清单及四轮计划；检查README、AGENTS、PROJECT_MEMORY
导航和Node测试规范，没有启动、部署、正式动作或存档schema变化，无其他对应更新。
没有修改规则收费、RNG、终点评分、4096预算或用户指定既有失败；第四轮整体预算与
裁剪义务仍未完成。下一步从干净生产提交按研究去重入口运行200步并同提交续跑。
