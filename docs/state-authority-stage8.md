# StateStore 零兼容权威状态

## 结论

Browser 与 Headless 的唯一已提交游戏事实是 `seti-committed-game-state-v1`。
recovery version 2 与 RL checkpoint `coreState` 只保存 `StateStore.serialize()` 的
`committedState` JSON。version 1、缺版本、未知版本、旧 10/12-slice root 和损坏 JSON
全部结构化拒绝；仓库不提供旧存档迁移、双写或读取窗口。

## 恢复边界

- `app/game-recovery.js` 只调用注入的 `StateStore.serialize/deserialize`，验证完成前不调用
  Browser restore port。
- Browser restore port 负责把已验证 committed domain 数据装入规则 runtime；UI、picker、
  overlay、status note 与派生计数由 Browser ViewState / renderer 重建，不能进入 committed root。
- Headless reset 从 Browser bundle 生成的 v2 committed JSON 建立高耦合 StateStore；每个
  Effect Session 从 `beginWorkingCopy()` 开始，在稳定边界通过一次 `compareAndCommit()` 提交。
- checkpoint 的 Decision choices、journal、replay cursor 与 machine-player host snapshot 仍由各自
  版本化协议持有，不塞入 CommittedGameState。

## 所有权

- StateStore：committed root、schema/invariant、序列化、working copy 与 CAS。
- Effect Session：queue、Decision、journal、barrier 与活跃 working state。
- Browser Host：projection、ViewState、renderer、input adapter、debug/public facade。
- Headless Host：observation、legal descriptors、replay/checkpoint orchestration。
- `cardTaskState` 是由 cards/players 派生的查询索引；setup selection 是 session 状态。

## 机械门禁

`randomizer/game/state/authority-inventory.js` 只允许 `status=formal`，并要求每项都有
owner/source/target。`tools/audit_state_authority.js` 阻断禁用符号、文件和非当前 schema 恢复输入，
并要求 recovery 同时存在 StateStore serializer/deserializer。proof obligations 与最小反例见
`checkpoint/seti-98-proof-obligations.md`。
