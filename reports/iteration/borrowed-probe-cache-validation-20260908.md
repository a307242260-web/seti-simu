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

## 单点与全盘进度

生产提交addcef7f；第161步单点根状态完全相同，耗时17478.86→17525.10ms，
物理节点4096不变，提交8128→8172。优胜27步动作及正式重放终态完全相同。
没有该点提速结论；预算仍截断。原始新证据保存在临时工作树
`/private/tmp/seti-borrowed-probe-cache-20260908/reports/iteration/blue161-borrowed-cache-fixed-20260908.json`。

已查重并通过标准入口启动`borrowed-probe-cache-20260908`完整局（addcef7f），
尚无终局结果；结束后登记新版本并同步完整原始产物到主目录。没有整局分数、
性能提升或所有搜索完成结论。未运行全量Node回归或真实Chrome smoke。

文档核对范围：AGENTS快速导航、README入口、docs/ai-design.md、rl-simulation-env契约、
node-testing分类、robot-iteration-registry流程及本轮计划。仅ai-design缓存说明需要更新；
没有新公开接口、运行方式或目录职责。测试已登记inventory，未更改项目记忆。
