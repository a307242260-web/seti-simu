# SETI-73 Browser Host reference core proof obligations

| 验收条款 | 可证伪命题 | 最小反例 | 唯一责任点 | 验证证据 | 失败语义 |
|---|---|---|---|---|---|
| committed/session 两类 projection | committed 只调用 `StateStore.getSnapshot()`；session 只调用同一 runtime 的 `inspect/observe`，且两者 revision/sessionId 一致 | session projection 又读取 store，混入尚未提交或旧版本事实 | `BrowserProjectionAdapter` source selector | 两类固定快照、调用 spy、mid-session/commit gate | 上游 envelope 不一致时 fail-closed，不返回 projection |
| viewer 默认拒绝 | 未列入 viewer policy 的 root/nested 字段和值不进入投影；非 owner 看不到 decision choices | 对手手牌、deck order、RNG canary 从任意深度出现在 JSON | 默认 visibility policy + decision mapper | 多 viewer forbidden-key/value canary | 未知字段丢弃；viewer 无 id/role 时拒绝 |
| 深冻结/隔离 | 修改投影或其嵌套对象不能改变 StateStore、Session observation 或下一次投影 | renderer 改写 resources/choice 后权威对象变化 | projection finalizer | `Object.isFrozen` + mutation throw + 二次 projection parity | 所有输出 clone 后 deep-freeze |
| ViewState 清空不变式 | 任意 view intent、`clear()`、projection reconcile 均不调用 action/decision 端口，也不改变合法集合 | 关闭 overlay 继续 effect，draft 保存已执行 choice | `ViewStateStore` | mutation ports spy=0 + clear/rebuild metamorphic | 未知/越权 view intent 拒绝且 state 不变 |
| action/decision/view intent 路由 | 每个 intent 恰好命中唯一端口，view 永不进入规则端口 | action 被当作 view 保存，decision 同时 dispatch action | `BrowserInputAdapter` | 三类端口计数与参数精确断言 | 未知 kind 返回 `BROWSER_INPUT_INTENT_UNKNOWN` |
| stale submission | adapter 不改写 version/choice；共享端口返回 stale 时刷新投影并原样暴露结构化错误 | adapter 用最新 version 包装旧按钮使提交成功 | `BrowserInputAdapter` + shared Action/Session validator | stale action/decision 负向测试、port 参数 identity、refresh spy | 返回共享错误；最多触发一次 refresh，不自动重试 |
| ViewState revision reconcile | projection 或 decision version 变化时草稿与最新 choiceIds 求交；decision identity 变化则清空 | 旧科技 choice 在新 decision 自动提交 | `ViewStateStore.reconcileProjection` | same-decision/new-version intersection + new-decision clear | 缺 projection/decision 时清空 decision draft |
| 浏览器装配 | 传统 script 顺序产生完整 `SetiBrowserHost` facade，且不读取 DOM/localStorage | Node 合约全绿但页面缺 global/加载顺序错 | `index.html` + `app/dependencies.js` | dependency test + 真实 Chrome smoke | 缺任一 reference module 时 dependencies fail-fast |

本阶段不接管生产 renderer，不修改旧 `pendingState`、DOM handler、AI resolver、localStorage 或 app continuation；Chrome smoke 只证明 reference core 的传统脚本装配与公开 facade。
