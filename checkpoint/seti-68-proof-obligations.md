# SETI-68 浏览器 Effect Session 接入证据义务

| ID | 可证伪命题 | 最小反例 | 证据 |
|---|---|---|---|
| ES6-01 输入单向 | DOM/input adapter 只提交 Standard Action/Decision 或 view intent | click callback 直接修改 state/pending 或调用 continuation | `effect-session-host.test.js` DOM identity 测试与禁用引用扫描 |
| ES6-02 单一 working projection | 活跃 session 每次 render 只消费该 flow 的 `observe()` | renderer 混读 committed state 或旧 pending | 研究/扫描/打牌中间 projection trace；render poison 不改变规则结果 |
| ES6-03 原子提交 | 只有 `completed` 才调用一次 `compareAndCommit` | awaiting_input 或失败后正式 store 已变化 | 研究成功 commit=1；奖励失败 commit=0 且完整恢复 base state |
| ES6-04 动画等价 | 逐 Effect `advance` 与自动 `drain` 的稳定状态一致 | UI 动画调度漏执行或多执行一个 Effect | 同初态/Action/Decision 的 animated vs automatic 深等价 |
| ES6-05 领域链无 continuation | 研究、扫描、打牌的宿主路径不接受或调用旧 continuation/pending resolver | host 调用 `renderAll`、`completeCurrentActionEffect` 或 `pendingState` | 生产源码 forbidden reference 扫描；各链固定 trace |
| ES6-06 quick fail-closed | 只有 flow/runtime 明确允许的 Effect 边界才能 interrupt | 研究 DecisionEffect 禁止 quick 但 UI 仍执行 | quick 提交返回结构化拒绝，decision snapshot 不变 |
| ES6-07 浏览器装配 | 传统脚本顺序中 host 在 dependencies/app composition 前可用 | Node 通过但页面缺 global 或初始化报错 | `index.html` 脚本顺序、dependencies 测试、真实 Chrome smoke |

范围限定：本阶段只接入阶段 2–5 已迁移的研究、扫描、打牌、quick 与失败恢复代表链。其余 legacy pending/领域 continuation 仍归阶段 8，不以本阶段 reference host 的存在宣称全页面所有流程已经迁移。
