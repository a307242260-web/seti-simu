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
- observation: SETI workspace 原先没有 autopilot 或 watcher skill，跨父级 `waiting_on` 只作提示而不会自动续跑；部署后发现 issue 评论会直接唤醒领航，因此 owner/长运行提醒会创建无效 run，“先评论再 rerun”还会对同一 issue 双重触发。
- evidence: 源 fire watcher autopilot `aa55458d-101a-4edf-ba69-337ebf53b570`；SETI watcher skill `affe4ad6-9c17-43f0-a34f-4e32eb78653b`；autopilot `121571af-90e0-4ffb-88a9-50c74dcc3c0e`；首轮 run `0a5f7662-0bb0-4034-9d16-f38213b42e4d` 完成 SETI-14 解阻并提醒 SETI-97 补 loop_type；SETI-95 的 owner 提醒评论唤醒了无事可做的领航 run，且 `mocha issue comment add --help` 无 no-trigger/suppress-trigger 选项。
- promote_to: watcher_lint
- promotion_status: promote
- decision: 迁移源 watcher 的确定性兜底能力并收窄到 SETI：失败 run 最多自动重跑两次、明确依赖全部终态后解阻、无安全断点的孤儿任务标 needs_owner。评论只用于确实需要领航修正状态/交接的分支，`reviewer=owner`/`needs_owner=true` 不进入领航交接提醒；失败恢复和依赖解阻只 rerun 一次，owner 和长运行提醒只写 metadata。owner/handoff 去重签名不使用 watcher 自己会改写的 `issue.updated_at`，避免 metadata 自循环。SETI 没有受管通知代理前不伪造外部通知成功标记。
