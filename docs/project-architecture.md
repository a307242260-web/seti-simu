# SETI 项目架构地图

本文记录当前生产装配，不再描述迁移期目标。浏览器、Node headless 与训练/评测共享一套规则模块、状态 schema、Action/Effect 协议和 Policy 端口；宿主只拥有各自的输入输出能力。

## 运行形态

| 运行形态 | 入口 | 正式职责 | 不拥有 |
|---|---|---|---|
| 浏览器 | `randomizer/index.html` | DOM、事件、BrowserProjection、ViewState、本地保存与人类/机器席位输入 | 规则状态、合法性、Effect 推进、Policy 估值 |
| Node headless | `randomizer/app/headless-env.js` | `reset/observe/legalActions/step/checkpoint/replay/dispose`，无 DOM 投影 | 第二套规则、候选 selector、恢复迁移 |
| 训练/评测 | `randomizer/training/**`、`tools/run_*training*`、`tools/run_rl_evaluation.js` | 模型、采样、训练 checkpoint、评测和报告 | 游戏规则、环境状态提交 |

headless 从 `index.html` 读取同一脚本清单，在 Node 中装配同一 `game/**`、`app/**` 与 `app.js`。`SetiHeadlessRuntimeConfig` 只替换宿主能力，不替换规则实现。

## 唯一 owner 与依赖方向

```text
Standard Action registry
  enumerate / validate / descriptor
                │
                ▼
Effect Session ───────────► StateStore.compareAndCommit
 working / decision / journal       │
                │                    ▼
                └────────► committed snapshot
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
             Browser Host                        Headless Host
       projection / human input            observation / policy input
                    │                                   │
                    └──────────────┬────────────────────┘
                                   ▼
                      Machine Player Host
                 DecisionContext -> PolicyDecision
```

- `randomizer/game/actions/standard-action.js` 是 15 个顶层 family 与 7 个 conditional family 的 identity、phase、枚举/校验协议 owner。
- `randomizer/game/effects/session-runtime.js` 是 working copy、DecisionEffect、队列、journal、undo/barrier 和提交门禁 owner。
- `randomizer/game/state/state-store.js` 是 committed schema、版本、RNG/sequence 与 compare-and-commit owner。
- `randomizer/app/browser-host/**` 只消费 committed/session projection，并把人类或机器输入交回标准端口。
- `randomizer/app/headless-env.js` 只把相同 descriptor 投影成 RL envelope；不接受旧 candidate 形状，也不生成新的 action identity。
- `randomizer/game/ai/machine-player-host.js` 拥有请求代次、deadline、取消、输出验证与 stale 去重；`policy-port.js` 定义公共请求/响应，具体 Policy 只选择传入 legal set 中的 `actionId`。

依赖只能由宿主指向公共协议和规则 owner。StateStore 不依赖 Action、Session、DOM 或 Policy；Policy 不依赖 DOM、resolver、executor、StateStore 或 Effect Session；renderer 不执行规则。

## 状态与恢复

规则事实只有两种合法形态：StateStore 的 committed snapshot，以及基于其 `baseVersion` 创建的单个 Effect Session working copy。Browser ViewState、行动日志、observation、replay 和训练 checkpoint 都是宿主或派生产物，不得反向覆盖规则事实。

浏览器恢复包与 headless checkpoint 只接受当前 schema。旧版本、缺版本、未知 root、未知 Action/Decision/Effect family、stale decision 和非法 Policy 输出均在调用提交/恢复端口前 fail-closed，不迁移、不猜测、不取首项。

## Composition root

`randomizer/app.js` 当前 11,532 行，是共享 composition root、浏览器顶层流程接线与公开服务装配点，不是第二个 StateStore、Action registry 或 Policy。`randomizer/app/ai-controller.js` 当前 1,980 行，只负责 AI runtime/rule domain 注入和稳定 API 转发；具体 resolver、automation、executor、日志与估值分别位于 `app/ai/**` 和 `game/ai/**`。

传统 `window.Seti*` 只作为无构建脚本的模块注册方式。是否使用全局命名空间不改变状态 owner，也不能成为跨局可变事实或隐藏 fallback 的理由。

## 验证入口

- `node --check randomizer/app.js`
- `node tools/run_node_tests.js`
- 固定 seed headless 完整局、非零 checkpoint/replay fork、Browser/Headless parity
- 真实 Chrome 人类输入 smoke、机器席位完整局与 Browser Services recovery smoke

更细契约见 `docs/standard-action-contract.md`、`docs/effect-session-runtime.md`、`docs/committed-game-state.md`、`docs/browser-host-ui.md`、`docs/machine-player-host.md`、`docs/policy-port-contract.md` 与 `docs/rl-headless-env.md`。

StateStore 的唯一 owner、快照隔离、单次 CAS、恢复拒绝和 Policy fail-closed 均由相应行为单元测试与唯一完整流程验证，不再维护读取源码形态的独立架构扫描器。
