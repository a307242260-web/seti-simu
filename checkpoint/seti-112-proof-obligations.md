# SETI-112 Browser authority 假绿基线

## 结论

基线 commit `e275cea` 的旧 authority 审计为绿；在最新 `dev` 独立快照上，无路径白名单的 hard-cut 审计在 195 个 production JS/HTML 中稳定检出 14 项违规。现状不满足 StateStore 唯一 authority；本 checkpoint 只建立可证伪门禁，不宣称迁移完成。

## Production authority / write / read / commit / restore 链

| 能力 | 当前生产链 | 唯一 authority 目标 | 当前断点 |
|---|---|---|---|
| authority | `app.js:249` 创建 `browserStateAuthority`；`browser-state-authority.js:38-62` 创建并长期持有 10 个 working slices；`:98-105` 再安装 StateStore | 仅 StateStore committed root | working slices 与 StateStore 同时常驻 |
| write | `app.js:268-279` 解构 `browserStateAuthority.working`；Action/Effect/turn/setup 代码继续直接修改这些引用 | 仅活跃 Effect Session workingState | 审计在 `app.js` 命中 solar/player/turn/rocket/tech/card 六类直接写 |
| read | UI/AI/public 通过 app 闭包中的长期 slices 读取；部分新 Browser Host 使用 StateSource/session observe | committed/session StateSource 或只读 projection | 新旧读源并存，poison 旧 slice 仍会击中真实 app 链 |
| commit | `browser-state-authority.js:107-126` 将 working slices 拼成 candidate 后 CAS；`:128-143` 的 serialize/reset 也会触发该 commit；`:215-240` 同时暴露 raw CAS 与 transaction/commit | Effect Session 完成时单次 compare-and-commit | 存在 session 外提交与额外 CAS 入口 |
| restore | Browser Services 恢复 StateStore 后，`browser-state-authority.js:146-180,222-225` 将 committed root hydrate 回 working slices | 校验后的 StateStore/session restore | root→slice 回填重建第二状态树 |
| product extent | Browser `browser-state-authority.js:99` 与训练 `headless-env.js:496` 分别实例化 resident StateStore | 玩家版/训练版只消费共享游戏 runtime 端口 | 两个产品外延分别持有规则 authority |

机器枚举同时记录 capability chain：authority 7、write 17、read 36、commit 7、restore 23 个调用点；JSON 结构由 `auditRepository().capabilityChain` 提供，供后续迁移逐项重扫。

## Proof fixtures

负向 fixture（均必须被拒绝）：

1. 改名 getter 长期 owner；
2. Proxy 包装长期 owner；
3. wrapper 暴露长期 owner；
4. slice→root 拼装；
5. root→slice hydrate；
6. Effect Session 外直接写；
7. Effect Session/StateStore kernel 外提交；
8. 双 `compareAndCommit` 调用点。
9. 玩家版与训练版产品外延各自持有 StateStore 或 committed snapshot mirror。

允许 fixture（均不得误报）：只读 projection、短生命周期 Effect Session workingState、StateStore 内部合法实现。

## 基线验证

- `node randomizer/game/state/browser-authority-hard-cut-audit.test.js --fixtures-only`：PASS，9 negative / 3 allowed。
- `node randomizer/game/state/browser-authority-hard-cut-audit.test.js`：EXPECTED FAIL；fixture 先全部通过，production 随后报告 14 项违规。
- `node tools/audit_state_authority.js`：EXPECTED FAIL；主 authority gate 已接入相同 hard-cut 结果，旧实现不能继续假绿。
- `node tools/run_node_tests.js`：EXPECTED FAIL，`170 passed / 2 failed / 172 total`；失败仅为 hard-cut 本体及调用主审计的 `authority-inventory.test.js`，二者报告同一组 14 项 production 违规。

后续 SETI-113/114 只有删除上述 production 链后才能让门禁转绿；不得通过变量改名、getter/Proxy/wrapper 或路径白名单消除报告。
