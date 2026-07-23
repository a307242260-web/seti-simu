# SETI 项目长期记忆

## Mocha issue workspace 路由

- `SETI-*` 属于本机 SETI workspace，workspace ID 为 `6377be1d-624b-40f3-aec9-810bdeaff66d`。使用 `/Users/bilibili/.local/bin/mocha` 的当前默认配置，不硬编码历史端口，也不得附加 `--profile algo1-wyfx`；执行 mutation 前用 `mocha config show` 核对当前 server 与 workspace。
- `ALG-*` 属于文艺复兴 / `algo1-wyfx` workspace。仅处理明确的 `ALG-*` issue 时使用 `/Users/bilibili/.local/bin/mocha --profile algo1-wyfx`。
- 读取、评论、改状态或触发 issue 前，必须先按 issue key 前缀选择 workspace。不得把不存在于当前 workspace 的 `SETI-N` 自动改查或改写为同号 `ALG-N`，反之亦然。
- 如果 issue key 与当前入口不匹配，应停止 mutation，先核对入口；不能通过猜测同号 issue 继续操作。

证据：2026-07-19，SETI-92 的纠偏评论因误带 `--profile algo1-wyfx` 被发到 ALG-92。ALG-92 agent 识别出任务不匹配且未改代码，随后纠偏已重新发送到本机 SETI-92。

## 架构迁移完成度判断

- 架构迁移必须分别报告两类证据，不能互相代替：
  1. 新主链义务：唯一 owner、调用方向、输入端口、提交边界和失败语义是否成立。
  2. 旧路径清理：全仓旧状态、旧入口、兼容 adapter、fallback、旁路和只服务旧实现的测试是否物理归零。
- 少数竖切片完成，只能证明迁移方法可行，不能据此估算全仓旧代码清理完成度。阶段里程碑结束后必须从提交快照重新做全仓 residual inventory，再拆下一组有限 issue。
- “测试全绿”“入口文件变小”“新模块已经存在”都不是旧架构清理完成的证据。若旧实现仍承载必要行为，应先迁移行为，随后删除旧字段、getter、handler、恢复路径、脚本入口、alias 和测试依赖；不存在“旧代码可保留”分类。
- 对 owner 汇报整体完成度时，必须给出可复核的残留计数、作用域和提交基线。没有全仓计数时，只能汇报局部里程碑，不能给出整体百分比或“接近完成”的判断。

证据：2026-07-23，SETI-137、138 分别完成 Browser Machine Player Host 和单一 Card Selection DecisionEffect，SETI-139 开始 Action Bar DTO 竖切片；随后从提交 `f7b4c01` 冷快照复审仍发现 22 类 continuation、约 173 处直接引用，以及 `createReadoutRoot=30`、`getRuleReadout=81`、`createReadoutActionContext=8`、`createResidentReadoutRoot=2`、`createStateSourceReadoutRoot=36`，另有中央 Host Command、Simulation Policy 旁路和旧 AI pending runtime。此前把三条竖切片的成功外推为整体迁移接近完成，属于证据层级错误。
