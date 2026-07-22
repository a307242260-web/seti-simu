# SETI Standard Action 契约与迁移矩阵

## 目标与边界

Standard Action 是浏览器控件与训练 Policy 之间唯一共享的游戏决策协议。两端只选择语义 action；候选枚举、执行前校验、状态事务、规则结算和下一个决策边界均由无 DOM 的游戏层负责。

当前 15 个顶层 family 与 7 个 conditional family 均已进入同一个 app registry。浏览器 AI 与训练 Policy 选择完整 descriptor，并只通过 `registry.execute` 执行；条件动作由语义 provider 枚举、按 `target.kind` handler 执行。旧 kind switch、simulation 条件总分派器、`payload.legacyAction`、`executeLegacy` 与 runtime bypass 已删除。

## Action envelope

每个候选必须包含：

| 字段 | 语义 |
|---|---|
| `schemaVersion` | 固定为 `seti-standard-action-v1`；不兼容变更必须升版 |
| `family` | 下表冻结的 22 个语义 family 之一 |
| `phase` | `main`、`quick`、`turn_control` 或 `conditional` |
| `actionId` | 由 `family + actorId + target + payload` 稳定生成；不含 label、估值或 UI 状态 |
| `actorId` | 当前真实 decision owner；不是观察者或 automation controller |
| `stateVersion` | 权威游戏状态版本；任何规则状态变化后旧 action 失效 |
| `decisionVersion` | 当前策略选择点版本；确定性 drain 跨过选择点时递增 |
| `target` | 稳定业务对象身份，例如 `rocketId/planetId/cardId/slotId` |
| `payload` | 支付、方向、分支参数等执行输入；不得携带闭包、DOM 或估值 |
| `summary` | 仅供日志/展示，不参与 action identity 或合法性 |

`enumerate(context, actor)` 只能读取权威状态并输出候选。`validate(context, action)` 必须重新对照当前 owner、版本、合法候选与 family 前置条件。`execute(context, action)` 只能接受通过校验的候选，并调用 family 唯一规则实现。

## 事务与确定性 drain

完整执行入口按以下边界实现：

1. 捕获事务前 checkpoint、history source、RNG cursor 与 replay cursor。
2. 校验 schema、family 注册、actor、`stateVersion/decisionVersion` 和当前候选成员关系。
3. 执行 family 规则 handler；浏览器与 Policy 不得在入口外预扣资源或补写规则状态。
4. 依序结算确定性 effect。零选项按规则失败或自动落空；一个等价选项可自动推进；两个以上非等价选项必须停止并枚举 conditional Action。
5. 到 terminal 或下一个真实策略选择点后提交事务，输出稳定 `events/replay/nextDecision`。任一步失败应回滚到 checkpoint 或进入已声明的不可逆失败语义。

drain 必须有步数上界；未知 pending、未知 family、旧 resolver/recover/skip 依赖一律 fail-closed，并输出 `state/family/type/owner`。Policy、AI valuation、DOM callback、overlay 文案均不得成为 drain 的输入。

## Registry 与迁移矩阵

状态含义：`reference` 表示已进入 Standard Action registry，并有 enumerate/validate/execute 行为合约。

| family | phase | 当前 owner / 入口 | 状态 | 迁移依赖与验收重点 |
|---|---|---|---|---|
| `launch` | main | `game/actions/launch` | reference | 参考合约已证明 enumerate/validate/execute 共用 `canExecute/execute` |
| `orbit` | main | Standard Action registry；app/simulation adapter | reference | rocket/planet target 由 registry 枚举；唯一规则执行器为 `game/actions/orbit` |
| `land` | main | Standard Action registry；app/simulation adapter | reference | rocket/planet/satellite target 由 registry 枚举；唯一规则执行器为 `game/actions/land` |
| `scan` | main | Standard Action registry；scan-flow adapter | reference | registry 统一入口与支付合法性；sector/card 多选继续外显 pending |
| `analyze` | main | Standard Action registry；ability/effect adapter | reference | 数据来源固定为 computer/requiredSlot，费用写入 payload |
| `research_tech` | main | Standard Action registry；app/simulation adapter | reference | tile/blue slot 是稳定 target；唯一规则执行器为 `game/actions/research-tech` |
| `play_card` | main | Standard Action registry；hand-flow adapter | reference | cardInstanceId 稳定枚举，费用绑定 payload；DSL/trigger 为确定性 continuation |
| `pass` | main | Standard Action registry；turn-end adapter | reference | PASS 主动作统一；预留牌/必做效果仍由对应 owner 外显，不由 policy 代选 |
| `move` | quick | Standard Action registry；interaction adapter | reference | rocket、方向和移动支付入口固定，补充支付继续外显 pending |
| `quick_trade` | quick | Standard Action registry；`game/actions/quick-trades` | reference | registry 枚举 trade id，复用唯一交易执行器 |
| `industry` | quick | Standard Action registry；industry adapter | reference | 统一公司身份、1x 使用标志、picker 与不可逆 history |
| `card_corner` | quick | Standard Action registry；hand-flow adapter | reference | 统一卡牌实例、角标效果与移动 continuation |
| `place_data` | quick | Standard Action registry；data ability adapter | reference | 统一槽位候选、bonus、history 与无目标语义 |
| `runezu_face_symbol` | quick | Standard Action registry；alien adapter | reference | 统一符号来源、面板目标、分支与痕迹奖励 |
| `end_turn` | turn_control | Standard Action registry；turn-end adapter | reference | 只在无待决策且主行动完成时合法，统一 owner 推进 |
| `choose_card` | conditional | Standard Action registry；card pending adapter | reference | 稳定 card/slot 身份，多选保持独立 replay step |
| `choose_target` | conditional | Standard Action registry；move/scan/alien pending adapter | reference | 按目标类型枚举，registry 入口禁止 UI callback 代执行 |
| `choose_payment` | conditional | Standard Action registry；discard/resource pending adapter | reference | 支付集合绑定 descriptor 与 authority，执行时重新校验 |
| `choose_reward` | conditional | Standard Action registry；effect/industry/alien pending adapter | reference | 奖励 identity 与后续 effect chain 稳定 |
| `choose_branch` | conditional | Standard Action registry；card/alien/confirm pending adapter | reference | 分支使用语义化 target，禁止按钮文案作为协议 |
| `choose_final_scoring` | conditional | Standard Action registry；final scoring runtime | reference | 独立 owner、候选、replay 与 terminal 结算 |
| `accept_optional_effect` | conditional | Standard Action registry；optional effect adapter | reference | 明确 `accept/skip` target，禁止默认取首项 |

`game/actions/index.js#createStandardRegistry` 提供 composition；adapter 只暴露 `enumerate/resolveIntent/execute`。`resolveIntent` 仅服务浏览器 DOM 的窄输入边界，多目标返回 `STANDARD_ACTION_AMBIGUOUS`；浏览器 AI、simulation 与训练 Policy 不使用它。orbit/land 的目标分别固定为 `rocketId + planetId` 与 `rocketId + planetId + type/satelliteId`；research 的目标固定为 `tileId + blueSlot`。

阶段 1 行为证据：`randomizer/game/actions/standard-action-reference.test.js` 对四个 family 做同 checkpoint 全候选 fork，覆盖多 rocket、主星/卫星、科技 tile/blue slot；同时断言 stale、越权、篡改 target 时玩家状态、盘面、RNG cursor、history 与 replay 均不变化，并以两个独立 adapter 对同一 actionId 做结果/状态 parity。

阶段 2 行为证据：`randomizer/game/actions/standard-action-stage2.test.js` 对 scan/analyze/play_card/pass 做完整 family 枚举与同 checkpoint 全 legal fork，覆盖两张非等价手牌、稳定费用 payload、stale 无副作用、双 adapter parity 与 intent 多选 fail-closed。浏览器主动作与 AI executor 都经 `action-runtime.dispatchAction` 进入同一 adapter；后续 pending 保持独立 owner/replay 边界。

阶段 3 行为证据：`randomizer/game/actions/standard-action-stage3.test.js` 对 move/quick_trade/industry/card_corner/place_data/runezu_face_symbol/end_turn 做完整 family 枚举与同 checkpoint 全 legal fork，覆盖快速行动不消耗主行动、公司 1x、显式支付、history source、stale/越权/重复/无目标 fail-closed，以及浏览器/Policy adapter parity。浏览器快速交易与回合结束、AI 七类执行都经 `action-runtime.dispatchAction` 进入同一 registry；AI valuation 与候选评分保持在 adapter 外。

阶段 4 行为证据：`randomizer/game/actions/standard-action-stage4.test.js` 对七类 conditional family 建立真实 `enumerate/validate/execute` definition，逐类覆盖两个非等价候选、owner、独立 decision version、stale 与零选项；`randomizer/app/simulation-conditional-drain.test.js` 覆盖唯一候选自动推进、多候选策略边界、replay environment event 与 drain 上界；`randomizer/app/simulation-fail-closed.test.js` 覆盖未知 pending/type/family，并以 spy 证明 resolver/DOM/recover/skip 调用为零。simulation app 仅通过 registry adapter 暴露与执行 conditional descriptor，确定性 drain 不再按 UI 文案触发 skip。

上述迁移阶段、descriptor 装配与 simulation identity parity 证据不再作为 Action 单元测试保留；Action unit 只验证玩家可选择的主行动、快速行为和外星人标记产生的差异行为，跨模块组合由唯一 full-flow 验证。

残余兼容面只有浏览器 DOM 的 `standard_intent`：它把明确 family/selector 解析为唯一 descriptor 后立即进入同一 registry；多目标 fail-closed。Browser Host Policy 经 `browser-host/policy-input-adapter.js` 选择完整 descriptor，并与玩家共用 `BrowserInputAdapter` 的 Action/Decision submission；AI、simulation、Policy、conditional provider 和 public API 均不保留旧执行入口。

## Proof obligations

| 验收条款 | 可证伪命题 | 最小反例 | 必需证据 |
|---|---|---|---|
| registry 完备 | 22 个 family 均有唯一 definition，且每个 definition 同时实现 enumerate/validate/execute | family 有标签但无 handler，或重复注册 | registry exhaustive test + 每 family 行为 checkpoint |
| legal 可执行 | 对任意 checkpoint `s` 与 `a ∈ enumerate(s)`，从同一 `s` 执行 `a` 成功或到声明终态 | 候选由 AI builder 生成，规则 executor 拒绝 | 同 checkpoint 逐候选 fork 执行 |
| stale/越权拒绝 | actor 或任一版本不匹配时状态、RNG、history/replay 均不变化 | 旧按钮 action 在对手回合仍能执行 | 负向合约 + 前后完整 checkpoint parity |
| 单一规则入口 | 浏览器点击与 Policy 对同一 actionId 调用相同 registry.execute | UI 预扣资源，simulation 走另一 switch | composition 结构检查 + 双入口 parity |
| 策略边界正确 | 两个以上非等价选项一定停止；唯一等价项才自动 drain | resolver 取第一项或 AI policy 代选 | 每 conditional family 多选状态 + resolver spy=0 |
| 未迁移 fail-closed | 未注册 family/未知 pending 不改变状态且结构化拒绝 | fallback skip 后继续回合 | 注入未知 family/pending 的负向测试 |
| 事务/replay 一致 | 每个外部选择恰好增加一个 policy replay step，确定性事件只进 environment events | conditional 被吞进同一步或失败 action 入 journal | non-zero checkpoint fork + cursor/RNG parity |
| 无外延依赖 | 核心 action 在无 DOM/localStorage/overlay/AI valuation 环境可枚举执行 | handler 读取 document 或 planner score | 禁用依赖结构扫描 + runtime poison/spies |

## 分阶段门禁

每批迁移至少需要：代表性规则测试、全 legal-action fork、旧入口调用为零或仅为显式 adapter 的结构证据、replay/checkpoint parity、全量 Node 回归。涉及浏览器 composition 或传统脚本顺序时，额外执行真实 Chrome smoke；涉及常驻 worker 时，再覆盖同实例 A/A、A/B/A 与 crash/timeout recovery。
