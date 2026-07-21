# 状态权威与可执行架构审计

## 当前 owner

生产规则只有五个正式边界：Standard Action registry、Effect Session runtime、StateStore、Browser Host、Machine Player Host / Policy port。`randomizer/game/state/authority-inventory.js` 为机器可读清单；每项必须声明 source、target 和唯一 mutation gate。`RESIDUAL_INVENTORY` 必须为空，不提供 allowlist、expiry 或兼容身份。

StateStore 是 committed root 的唯一 owner。Effect Session 从 `beginWorkingCopy()` 取得隔离副本，在稳定边界经 `compareAndCommit()` 提交。Browser Host 只消费 StateSource、session inspect 与 ViewState；机器席位只消费 `DecisionContext + legal descriptors`，输出由 Host 复核后进入与人类相同的 Standard input port。

## 审计范围

`node tools/audit_state_authority.js` 递归枚举 `randomizer/**` 的全部生产 JS/HTML，并为每个入口输出依赖以及 authority/write/read/projection/recovery/policy 能力边。浏览器 HTML 的每个本地脚本必须存在。

审计按结构和数据形状阻断以下语义残留，而不是依赖某组旧接口名：

- 非 lifecycle 位置创建第二 StateStore；
- 修改 committed snapshot，或 StateStore 提交后继续写 shadow/mirror/cache；
- Browser Host 接收由传统 slice 重新拼出的 projection bundle；
- 保存路径手工拼 canonical committed root；
- 恢复路径把 committed root 拆回多个传统 slice owner；
- Policy/AI helper 在失败或未知 family 下取 legal set 首项；
- 生产路径读取已删除字段。

审计还执行两类运行时证据：StateStore commit trace 证明 working-copy isolation、单版本提交和 stale 零污染；Browser Projection poison 证明传统 slice getter 不会被读取。负向 fixture 位于 `randomizer/game/state/semantic-architecture-audit.test.js`，九类注入必须逐项非零失败。

## Browser authority hard-cut 门禁

`tools/lib/browser-authority-hard-cut-audit.js` 在同一份生产入口集合上追加 Browser 硬切审计。它不按文件名或路径放行，而是按接口形态识别 StateStore kernel、Effect Session runtime/terminal host 与单次 working-copy transaction；其余模块不得：

- 聚合并经 getter、Proxy 或 wrapper 暴露多个长期可变规则对象；
- 把分散 slice 拼成 canonical root，或把 committed root hydrate 回常驻 slice；
- 从 working/slice 接口取得引用后在 Effect Session 外直接写；
- 在 StateStore/Effect Session 边界外调用 CAS，或暴露额外 CAS 形成双提交路径。
- 由玩家版、训练版等产品外延分别实例化 StateStore 或镜像 committed snapshot；两个产品只能消费同一游戏内部 runtime 的 StateSource/session 端口。

`randomizer/game/state/browser-authority-hard-cut-audit.test.js --fixtures-only` 固定九类负向反例与三类允许形态（只读 projection、短生命周期 Effect Session workingState、StateStore 内部实现）。不带参数执行时还会扫描全部 production；在硬切完成前必须保持红灯，迁移完成后应自然转绿，不需增补路径白名单。当前假绿基线与 production authority/write/read/commit/restore 链图见 `checkpoint/seti-112-proof-obligations.md`。

## 验证

```bash
node --check randomizer/app.js
node tools/audit_state_authority.js
node randomizer/game/state/semantic-architecture-audit.test.js
node randomizer/game/state/browser-authority-hard-cut-audit.test.js
node tools/run_node_tests.js
```

完整收口还包括固定 seed、非零 checkpoint/replay、worker recovery、完整 headless 多局、Browser/Headless trace parity，以及真实 Chrome 的人类和机器席位路径。Proof obligations 见 `checkpoint/seti-110-proof-obligations.md`。
