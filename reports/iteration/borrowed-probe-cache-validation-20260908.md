# 临时科技缓存验证（2026-09-08）

## 已验证

- 生产修改仅为探测结构缓存补齐正式有效橙3/橙4，规则、预算和AI评分未改。
- 新unit在旧生产代码上复现“借用orange3热/冷目录必须一致”失败；修复后通过。
  unit覆盖切换、清除、到期、跨席位观察、永久拥有及禁用。准备阶段曾使用未完成
  开局及未扣供应区的非法状态，已改用正式开局输入与科技供应/持有primitive；不是生产修复。
- 真实第161步正式借用复核：新热缓存橙3为11项、橙4为20项；分别启动新Node进程
  恢复同一个借用后committedState，两个目录逐字段与热缓存一致。见同目录
  `turing-directory-cache-fixed-{warm,cold-orange3,cold-orange4}-20260908.json`。
- `run_node_tests --match probe-directory-cache`、`--match simulation-standard-action-composition`、
  `--match standard-flow`全部通过；`audit_v_state_inputs.js`通过；production-kernel语法通过。

## 单点与完整局

生产提交addcef7f。第161步根相同，17478.86→17525.10ms，4096节点不变，
8128→8172输入；优胜27步与正式重放终态相同。原始证据见
[单点161](blue161-borrowed-cache-fixed-20260908.json)。

已按标准入口完成唯一完整局：666步、82/120/90/152、均111；正式重算明细一致。
实际失败0，仍28次战略截断和5次控制截断，整体Goal未完成。
详见[完整局报告](borrowed-probe-cache-full-review-20260908.md)。
未运行全量Node回归或真实Chrome smoke。

文档核对范围：AGENTS快速导航、README入口、docs/ai-design.md、rl-simulation-env契约、
node-testing分类、robot-iteration-registry流程及本轮计划。仅ai-design缓存说明需要更新；
没有新公开接口、运行方式或目录职责。测试已登记inventory，未更改项目记忆。
