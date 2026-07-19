# SETI-70 Effect Session 阶段 8 proof obligations

> 历史说明：本文件记录阶段 8 的迁移期 inventory 门禁。SETI-72 最终收口已删除该 inventory、旧 pending 创建入口与专项 audit；以下条目仅保留当时证据，不代表当前架构仍允许字段白名单。

| ID | 可证伪命题 | 最小反例 | 证据 |
|---|---|---|---|
| ES8-01 inventory 完备 | `createPendingState` 的每个字段恰好属于 deleted/session-owned/host-only/dated-adapter 之一 | app 新增第 53 个隐式 pending | `legacy-flow-inventory.test.js` 对 52 项集合双向等价与未知/缺失字段负测 |
| ES8-02 adapter 可到期 | 每个仍推进规则的 legacy 字段都有 owner、ISO 到期日，过期后审计失败 | adapter 永久兼容且没有失败门禁 | `auditLegacyPendingState(..., asOf)` 过期负测；`tools/audit_effect_session_legacy.js` |
| ES8-03 单一清单 | app runtime 不再复制维护 52 项默认值 | inventory 与 `createPendingState` 漂移 | runtime 只调用 `createLegacyPendingState()`；源码逐字段禁止重复默认值 |
| ES8-04 已迁移热路径零回流 | Browser/Headless Effect Session host 不引用 pending、ability chain 或 AI recover/resolver | 新 adapter 偷跑旧 continuation | 两个生产 host 的 forbidden-reference 结构扫描 |
| ES8-05 兼容面可观测 | 每个仍有 legacy callsite 的字段都能机械列出，未知字段和过期项使命令非零退出 | 只在文档宣称收口 | `node tools/audit_effect_session_legacy.js` JSON 报告 |
| ES8-06 回归与装配 | inventory 模块在 Node 与浏览器脚本顺序均可用，不改变当前规则结果 | Node 绿但浏览器缺 global | 全量 Node、`node --check`、真实 Chrome smoke |

本阶段不把仍存在的 app 兼容路径伪报为 deleted/session-owned。当前只有 `passReserveSelectionDismissed` 与 `scanRunSequence` 是 host-only；其余字段均为带 owner 与到期日的兼容 adapter。阶段 2–7 已迁移 Browser/Headless reference host 继续保持旧 resolver 调用为零。
