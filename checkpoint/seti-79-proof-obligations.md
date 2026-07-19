# SETI-79 Browser Host Action Bar Proof Obligations

## 边界

本批只迁移 Browser Host 的主行动、Quick、PASS、结束回合、撤销入口和 Effect 进度呈现。Action 合法性来自 Standard Action 枚举，Decision/quick/undo/barrier/progress 来自 Effect Session inspect；不修改 interrupt/resume、decision revalidation、history/journal、barrier 或回合推进规则。

## 可证伪义务

| ID | 可证伪命题 | 最小反例 | 实现落点 | 证据 |
|---|---|---|---|---|
| 79-01 controls 同源 | 给定同一 projection，Action Bar 的 action id、可用状态与 disabledReason 集合逐项等于 `projection.controls` | renderer 自行按资源或 pending 隐藏一项 | `browser-host/action-bar.js` model | 集合等价测试；renderer 禁用符号扫描 |
| 79-02 输入单向 | 任意 Action/PASS/结束/Quick 点击只提交 projection 中原始 Standard Action；撤销只调用 Effect Session undo port | handler 直接扣资源、改 pending、调用 continuation | Action Bar controller / DOM renderer | 端口 spy；领域 mutation spy 恒为 0；伪造 action id fail-closed |
| 79-03 stale 不补救 | quick interrupt 后旧 decision 提交被共享层拒绝，Host 只刷新 projection，不改 version、不重试 | handler 把旧 version 改成新 version 后重交 | BrowserInputAdapter + Effect Session | 真实 quick-session 负向 trace；提交次数为 1；working state parity |
| 79-04 undo/barrier 不退化 | inspect 的 `canUndo` 与 top undo frame/barrier 相容；越 barrier 时 false 并保留共享 disabled reason | UI 仅按 undoFrames.length 启用，允许越 barrier | Effect Session inspect -> projection controls | 无 barrier/有 barrier/空 history 三态测试；runtime undo 结果对照 |
| 79-05 progress 同源 | Effect 进度只映射 inspect 的 revision、queueLength/currentEffect，不读 legacy effect flow | renderer 读取 `pendingState.actionEffectFlow.currentIndex` | projection adapter + Action Bar model | fixed inspect snapshot；禁用符号扫描 |
| 79-06 full legal fork | projection 暴露的每个 enabled Standard Action 从同一 authority checkpoint 独立提交时均被 action port 接受 | 某个显示为 enabled 的 action 实际 stale/非法 | controller + Standard Action port | enabled action 全 fork 合约；disabled action 不提交 |
| 79-07 Chrome parity | 主行动、Quick、PASS、结束、撤销和进度在真实 DOM 中保持稳定 identity、disabled reason 与点击路由 | Node 通过但按钮不可点击/错误路由 | Action Bar DOM renderer | Chrome browser-host smoke |

## 禁区

- `action-bar.js` 不得出现 `pendingState`、`actionHistory`、`quickActionHistory`、资源扣减、Effect queue mutation 或领域 continuation 名称。
- renderer/controller 不得从 label 推断 family，不得补写 `stateVersion` / `decisionVersion`。
- stale、interrupt、undo 和 barrier 的接受/拒绝结论仍由 Standard Action / Effect Session 端口产生。
