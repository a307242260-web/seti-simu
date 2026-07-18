# SETI-53 reset 隔离 Proof Obligations

| 验收条款 | 可证伪命题 | 最小反例 | 实现落点 | 验证证据 |
|---|---|---|---|---|
| 同 env A/A 可复现 | 同一 `createHeadlessEnv()` 连续两次以 A reset 后，完整 observation、legalActions、replay cursor、action log、稳定 action id 与 RNG 状态相等 | 第一局执行一步后再次 reset，第二次 opening 的牌、轮盘、火箭、痕迹或 choiceCount 漂移 | `headless-env.js` 的 bundle/runtime 重建边界 | `headless-env.test.js` 的 A/A 深比较 |
| 同 env A/B/A 隔离 | B episode 不能改变再次进入 A 的任何 opening 状态 | B 消耗模块闭包计数器或 RNG，第三次 A 与第一次 A 不同 | reset 时清空 env 缓存并重建浏览器 bundle | `headless-env.test.js` 的 A/B/A 深比较 |
| fresh A parity | 热 reset 的 A 与冷启动 fresh A 完整相等 | reset 只清 env 局部数组，模块级状态仍残留 | 每次 reset 重新执行 bundle composition | `headless-env.test.js` 的 fresh A 深比较 |
| 常驻 worker 真实复用 | 同一 worker 内同一 env 连续 reset 100 个 seed，每个 opening observation 与 legalActions 等于 fresh direct env | worker 通过每局新建 env 掩盖 reset 泄漏 | `headless-worker.js` 常驻 env 的 `reset()` 路径 | `headless-worker.integration.test.js` 100 局逐 seed parity |
| seed 仍有区分度 | A 与 B 的 observation 不相等 | 清理逻辑把随机状态固定成常量 | seed RNG 在 bundle 启动前重建 | `headless-env.test.js` 的不同 seed 反例 |

失败语义：任一字段漂移由 `assert.deepEqual` 输出具体差异；worker reset 仍走真实 IPC 与真实 headless bundle，不以重启 worker 或每局新建 env 规避。
