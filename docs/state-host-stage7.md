# StateStore 阶段 7：宿主同源 projection 与 observation

## 结论与边界

浏览器、simulation 与训练宿主现在通过同一条 `committed / working` 状态读取边界生成派生数据：空闲时只读 `StateStore.getSnapshot()`，Effect Session 活跃时只读该 session 的 working state。projection、observation、legal action、history/replay 都是可丢弃派生物，不能反向提交状态。

阶段 8 硬切后，Simulation 不再装配旧状态 adapter。reset、action candidate、checkpoint 与恢复均直接使用同一 committed schema；正式事实只由 Effect Session 的一次 `compareAndCommit()` 成立。

## 端口

- `randomizer/game/state/host-source.js`：宿主共同使用的只读 source selector。输出携带 `committed | working`、state/session version 与 decision，且深冻结、调用隔离。
- `randomizer/app/rule-composition.js`：浏览器唯一 Rule Composition 直接持有 StateStore 与 active Session；Browser Host 只读其 projection/source port 并经 input port 提交。
- `randomizer/game/rule-composition.js`：配置 `stateStore` 后使用 `dispatchStoredAction()`，working state、checkpoint 与最终 committed state 均为 `seti-committed-game-state-v1`；不再用 simulation 私有 `{stateVersion,snapshot}` 作为权威事实。
- `randomizer/app/simulation-env.js`：reset 时从 recovery v2 committed JSON 建立 StateStore；observation 只由当前 committed/working source 单向生成。

## Checkpoint 与 Decision

多选 Decision 的 choices 属于 Effect Session，而不属于 CommittedGameState。simulation DecisionEffect 在创建时把稳定 choices 写入 effect payload，因此非零 checkpoint 恢复不依赖被明确排除的 `pendingState`、UI picker、resolver 或模块闭包。恢复后 observation、legal actions、decision owner、RNG、replay cursor 与未分叉路径一致。

卡牌展示名、玩家标签等 host-only 字段即使出现在 observation，也只是由静态目录或宿主 projection 重建的展示数据，不进入 Action/Decision candidate、RNG 或 CAS candidate。checkpoint 恢复通过 confirmed replay 与 Effect Session checkpoint 校验 working state 和 choices，展示差异不能改变同一输入轨迹的 committed 事实。

## 删除与禁止清单

已迁移宿主路径中禁止：

- Policy、AI 或 renderer 直接修改 committed/working state；
- simulation checkpoint 旁路保存第二份规则 snapshot；
- renderer/commit listener 抛错反向取消提交；
- checkpoint 恢复调用旧 pending resolver、recover 或 skip；
- observation 的差异参与 Action/Decision 执行或 CAS candidate 生成。

Stage 8 已删除旧状态 adapter、旧存档读取和过渡 inventory；未知 schema 一律 fail-closed。

## 验证

定向证据：

```text
node randomizer/game/state/host-source.test.js
node randomizer/app/rule-composition.test.js
node randomizer/app/simulation-env.test.js
node randomizer/app/simulation-effect-session-integration.test.js
```

最终还需运行全量 Node、完整对局 benchmark 与真实 Chrome 的 StateStore/Effect Session/browser host smoke。
