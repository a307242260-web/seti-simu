# StateStore 阶段 7：宿主同源 projection 与 observation

## 结论与边界

浏览器、headless 与训练宿主现在通过同一条 `committed / working` 状态读取边界生成派生数据：空闲时只读 `StateStore.getSnapshot()`，Effect Session 活跃时只读该 session 的 working state。projection、observation、legal action、history/replay 都是可丢弃派生物，不能反向提交状态。

阶段 7 不负责删除全仓旧 12 切片；该 inventory 的最终删除属于 Stage 8。当前 headless 规则执行仍通过显式 legacy adapter 调用尚未迁移的领域函数，但每一步只从 session working candidate 建立临时投影，执行后立即净化回同 schema candidate；正式事实只由 Effect Session 的一次 `compareAndCommit()` 成立。

## 端口

- `randomizer/game/state/host-source.js`：宿主共同使用的只读 source selector。输出携带 `committed | working`、state/session version 与 decision，且深冻结、调用隔离。
- `randomizer/app/effect-session-host.js`：浏览器空闲投影兼容真实 StateStore snapshot，并订阅 commit 触发刷新；renderer 失败只记宿主错误，不影响已经成立的提交。
- `randomizer/app/headless-effect-session-host.js`：配置 `stateStore` 后使用 `dispatchStoredAction()`，working state、checkpoint 与最终 committed state 均为 `seti-committed-game-state-v1`；不再用 headless 私有 `{stateVersion,snapshot}` 作为权威事实。
- `randomizer/app/headless-env.js`：reset 时从 recovery v2 建立 StateStore；领域执行前后只通过 recovery/legacy adapter 投影和净化，observation 只由当前 committed/working source 单向生成。

## Checkpoint 与 Decision

多选 Decision 的 choices 属于 Effect Session，而不属于 CommittedGameState。headless DecisionEffect 在创建时把稳定 choices 写入 effect payload，因此非零 checkpoint 恢复不依赖被明确排除的 `pendingState`、UI picker、resolver 或模块闭包。恢复后 observation、legal actions、decision owner、RNG、replay cursor 与未分叉路径一致。

卡牌展示名、玩家标签等 host-only 字段即使出现在 observation，也只是由静态目录或宿主投影重建的展示数据，不进入 Action/Decision candidate、RNG 或 CAS candidate。checkpoint 恢复通过 confirmed replay 重建 legacy session adapter，再以 Effect Session checkpoint 校验 working state 与 choices，展示差异不能改变同一输入轨迹的 committed 事实。

## 删除与禁止清单

已迁移宿主路径中禁止：

- Policy、AI 或 renderer 直接修改 committed/working state；
- headless checkpoint 旁路保存第二份规则 snapshot；
- renderer/commit listener 抛错反向取消提交；
- checkpoint 恢复调用旧 pending resolver、recover 或 skip；
- observation 的差异参与 Action/Decision 执行或 CAS candidate 生成。

Stage 8 继续关闭全仓 legacy adapter inventory、恢复直写和未迁移浏览器 UI 热路径。

## 验证

定向证据：

```text
node randomizer/game/state/host-source.test.js
node randomizer/app/effect-session-host.test.js
node randomizer/app/headless-effect-session-host.test.js
node randomizer/app/headless-env.test.js
node randomizer/app/headless-effect-session-integration.test.js
```

最终还需运行全量 Node、完整对局 benchmark 与真实 Chrome 的 StateStore/Effect Session/browser host smoke。
