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
