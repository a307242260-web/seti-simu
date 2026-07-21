# SETI-110 最终语义架构审计 Proof Obligations

| ID | 可证伪命题 | 最小反例 | 唯一落点 | 证据 |
|---|---|---|---|---|
| A1 | 全部生产 JS/HTML 均进入 authority/write/read/projection/recovery/policy inventory，每个能力边有 source/target/mutation gate | 新增未入清单的生产脚本，或 HTML 引用不存在脚本 | `tools/lib/state-authority-audit.js` | `productionEntryAudit` 全量清单与 missingScripts=0 |
| A2 | Standard Action、Effect Session、StateStore、Browser Host、Machine Player Host/Policy 各有唯一正式 owner，过渡/豁免 residual 为零 | 重复 owner、缺 gate、`status != formal` 或 residual 非空 | `game/state/authority-inventory.js` | v3 inventory schema 结构校验 |
| A3 | 生产入口不能建立第二 StateStore root、直接修改 committed snapshot 或在提交后双写镜像 | 在任意非 lifecycle 文件创建 StateStore；修改 `getSnapshot()`；commit 后写 shadow/cache | semantic source rules | `SEMANTIC_SECOND_MUTABLE_ROOT` / `DIRECT_COMMITTED_WRITE` / `DUAL_WRITE` fixture |
| A4 | Projection 只消费 StateSource/Effect Session projection，不因 adapter 改名重新接收传统 slice bundle | 在 Browser Host 内用四个以上传统 slice 拼任意 display/view 对象 | semantic shape rule + interface poison | renamed bridge fixture；legacy getter 读取次数为 0 |
| A5 | 保存只持久化 StateStore serializer，恢复只装入 resident StateStore/session/host，不能手工拼/拆 root | 保存时拼 8 个以上 canonical root；恢复时拆到 3 个以上传统 slice | semantic shape rules | save stitch / recovery split fixture |
| A6 | Policy 只从公共 legal descriptors 返回经验证的 actionId；旧 helper、旧 schema 和未知 fallback 均 fail-closed | `choose(candidates){return candidates[0]}`；读取 `techState.ownedTileByType`；default 取首项 | semantic policy/schema rules | 三类负向 fixture 逐项非零 |
| A7 | working-copy 写在 commit 前不改变 committed bytes；成功提交只增一版并发一事件；stale writer 不改变 bytes | 修改 working 后 serialize 漂移；一次提交增两版；stale 仍成功 | StateStore runtime trace | `runtimeCommitTrace` 全字段通过 |
| A8 | 正常生产路径零违规，独立提交快照与共享树结果一致 | 审计依赖未提交文件或共享 index 中其他改动 | 私有 index + detached archive | audit、全量 Node 与定向集成在两份快照复验 |

## 验收矩阵

- 结构：正式 owner inventory、全生产入口依赖/能力清单、脚本存在性、语义残留规则。
- 接口：Browser Projection poison；旧 schema、未知 family、旧 Policy helper 的负向 fixture。
- 状态：StateStore working/committed isolation、单次版本推进、stale 零污染 commit trace。
- 行为：固定 seed、非零 checkpoint/replay、worker recovery、完整 headless 多局、Browser/Headless trace parity。
- 宿主：真实 Chrome 人类建局/行动/决策/保存恢复/跨轮/终局与机器席位完整局。

完成判据：正常 audit `ok=true`、九类负向 fixture 全部命中预期 code、residual inventory 为空，且共享树与独立提交快照的机械/行为验证均无失败。
