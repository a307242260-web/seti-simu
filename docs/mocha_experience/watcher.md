# Watcher Experience

记录可机械检查的状态、metadata、通知和依赖标记问题。watcher 只能提醒、标记或请求补证据。

## Entry Template

- date:
- source_issue:
- observation:
- evidence:
- promote_to:
- promotion_status:
- decision:

## Entries

- date: 2026-07-21
- source_issue: owner 在 Codex 会话中直接要求“把 Mocha 上我的 watcher 兜底迁移到 SETI”
- observation: SETI workspace 原先没有 autopilot 或 watcher skill，跨父级 `waiting_on` 只作提示而不会自动续跑；部署前 dry-run 确认 SETI-14 仍等待已完成的 SETI-92。
- evidence: 源 fire watcher autopilot `aa55458d-101a-4edf-ba69-337ebf53b570`；SETI watcher skill `affe4ad6-9c17-43f0-a34f-4e32eb78653b`；autopilot `121571af-90e0-4ffb-88a9-50c74dcc3c0e`；首轮 run `0a5f7662-0bb0-4034-9d16-f38213b42e4d` 完成 SETI-14 解阻并提醒 SETI-97 补 loop_type。
- promote_to: watcher_lint
- promotion_status: promote
- decision: 迁移源 watcher 的确定性兜底能力并收窄到 SETI：失败 run 最多自动重跑两次、明确依赖全部终态后解阻、状态字段缺失和长运行只提醒、无安全断点的孤儿任务标 needs_owner；SETI 没有受管通知代理前不伪造外部通知成功标记。
