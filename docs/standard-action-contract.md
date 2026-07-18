# SETI Standard Action 契约与迁移矩阵

## 目标与边界

Standard Action 是浏览器控件与训练 Policy 之间唯一共享的游戏决策协议。两端只选择语义 action；候选枚举、执行前校验、状态事务、规则结算和下一个决策边界均由无 DOM 的游戏层负责。

当前阶段冻结协议和 proof obligations，不宣称 15+7 family 已完成行为迁移。`randomizer/app/headless-contract.js` 的 family label 与 normalize 层只能作为兼容适配，不能作为规则覆盖证据。参考实现位于 `randomizer/game/actions/standard-action.js`；`launch`、`orbit`、`land`、`research_tech` 已通过真实 `canExecute/execute` 进入 registry，后续 family 必须沿同一边界迁入。

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

状态含义：`reference` 已进入 Standard Action registry 并有行为合约；`legacy-shared` 已有部分 `game/actions` 或 `abilities` 规则，但入口仍分裂；`app-runtime` 主要由 app/UI/AI runtime 执行；`taxonomy-only` 只有条件 family 分类，尚未形成完整统一执行器。

| family | phase | 当前 owner / 入口 | 状态 | 迁移依赖与验收重点 |
|---|---|---|---|---|
| `launch` | main | `game/actions/launch` | reference | 参考合约已证明 enumerate/validate/execute 共用 `canExecute/execute` |
| `orbit` | main | Standard Action registry；app/headless adapter | reference | rocket/planet target 由 registry 枚举；唯一规则执行器为 `game/actions/orbit` |
| `land` | main | Standard Action registry；app/headless adapter | reference | rocket/planet/satellite target 由 registry 枚举；唯一规则执行器为 `game/actions/land` |
| `scan` | main | Standard Action registry；scan-flow adapter | reference | registry 统一入口与支付合法性；sector/card 多选继续外显 pending |
| `analyze` | main | Standard Action registry；ability/effect adapter | reference | 数据来源固定为 computer/requiredSlot，费用写入 payload |
| `research_tech` | main | Standard Action registry；app/headless adapter | reference | tile/blue slot 是稳定 target；唯一规则执行器为 `game/actions/research-tech` |
| `play_card` | main | Standard Action registry；hand-flow adapter | reference | cardInstanceId 稳定枚举，费用绑定 payload；DSL/trigger 为确定性 continuation |
| `pass` | main | Standard Action registry；turn-end adapter | reference | PASS 主动作统一；预留牌/必做效果仍由对应 owner 外显，不由 policy 代选 |
| `move` | quick | abilities + interaction/AI runtime | app-runtime | 统一 rocket、方向、移动力与补充支付 |
| `quick_trade` | quick | `game/actions/quick-trades` + app | legacy-shared | registry 枚举 trade id，复用唯一交易执行器 |
| `industry` | quick | `app/industry-runtime` + `game/industry` | app-runtime | 统一 1x 使用标志、picker、不可逆 history |
| `card_corner` | quick | `app/card-runtime` | app-runtime | 统一弃牌、角标效果、移动 continuation |
| `place_data` | quick | interaction runtime + `game/data` | app-runtime | 统一槽位候选、bonus、history 与无目标语义 |
| `runezu_face_symbol` | quick | alien species runtime | app-runtime | 统一符号来源、面板目标、分支与痕迹奖励 |
| `end_turn` | turn_control | turn flow / AI executor | app-runtime | 只在无待决策且主行动完成时合法，统一 owner 推进 |
| `choose_card` | conditional | 多种 pending / overlay | taxonomy-only | 稳定 card/slot 身份，多选必须独立 replay step |
| `choose_target` | conditional | move/scan/alien pending | taxonomy-only | 按目标类型注册 handler，禁止 UI callback 代执行 |
| `choose_payment` | conditional | discard/resource pending | taxonomy-only | 支付集合与资源版本绑定，禁止执行时重选 |
| `choose_reward` | conditional | effect/industry/alien pending | taxonomy-only | 奖励 identity 与后续 effect chain 稳定 |
| `choose_branch` | conditional | card/alien/confirm pending | taxonomy-only | 分支必须语义化，禁止按钮文案作为协议 |
| `choose_final_scoring` | conditional | final scoring runtime | taxonomy-only | 独立 owner、候选、replay 与 terminal 结算 |
| `accept_optional_effect` | conditional | skip/confirm pending | taxonomy-only | 明确 `accept/skip` payload，禁止默认取首项 |

迁移顺序：先以 launch/orbit/land/research_tech 固化参考模式；再迁 scan/analyze/play_card/pass；再迁全部 quick action 与 end_turn；最后统一 conditional registry 和 deterministic drain。后续阶段只能把矩阵状态升级为有行为证据的状态，不得仅修改标签。

四个参考 action 的 composition 由 `game/actions/index.js#createStandardRegistry` 提供；浏览器与 headless 只应持有 `createStandardAdapter()` 返回的 `enumerate/execute/executeLegacy`。`executeLegacy` 在多目标时返回 `STANDARD_ACTION_AMBIGUOUS`，不得沿用旧入口的默认首项语义。orbit/land 的目标分别固定为 `rocketId + planetId` 与 `rocketId + planetId + type/satelliteId`；research 的目标固定为 `tileId + blueSlot`。完整 conditional registry 和 effect drain 仍属于阶段 4，本阶段不把静态 conditional family 标成行为完成。

阶段 1 行为证据：`randomizer/game/actions/standard-action-reference.test.js` 对四个 family 做同 checkpoint 全候选 fork，覆盖多 rocket、主星/卫星、科技 tile/blue slot；同时断言 stale、越权、篡改 target 时玩家状态、盘面、RNG cursor、history 与 replay 均不变化，并以两个独立 adapter 对同一 actionId 做结果/状态 parity。

阶段 2 行为证据：`randomizer/game/actions/standard-action-stage2.test.js` 对 scan/analyze/play_card/pass 做完整 family 枚举与同 checkpoint 全 legal fork，覆盖两张非等价手牌、稳定费用 payload、stale 无副作用、双 adapter parity 与 legacy 多选 fail-closed。浏览器主动作与 AI executor 都经 `action-runtime.dispatchAction` 进入同一 adapter；后续 pending 保持独立 owner/replay 边界。

## Proof obligations

| 验收条款 | 可证伪命题 | 最小反例 | 必需证据 |
|---|---|---|---|
| registry 完备 | 22 个 family 均有唯一 definition，且每个 definition 同时实现 enumerate/validate/execute | family 有标签但无 handler，或重复注册 | registry exhaustive test + 每 family 行为 checkpoint |
| legal 可执行 | 对任意 checkpoint `s` 与 `a ∈ enumerate(s)`，从同一 `s` 执行 `a` 成功或到声明终态 | 候选由 AI builder 生成，规则 executor 拒绝 | 同 checkpoint 逐候选 fork 执行 |
| stale/越权拒绝 | actor 或任一版本不匹配时状态、RNG、history/replay 均不变化 | 旧按钮 action 在对手回合仍能执行 | 负向合约 + 前后完整 checkpoint parity |
| 单一规则入口 | 浏览器点击与 Policy 对同一 actionId 调用相同 registry.execute | UI 预扣资源，headless 走另一 switch | composition 结构检查 + 双入口 parity |
| 策略边界正确 | 两个以上非等价选项一定停止；唯一等价项才自动 drain | resolver 取第一项或 AI policy 代选 | 每 conditional family 多选状态 + resolver spy=0 |
| 未迁移 fail-closed | 未注册 family/未知 pending 不改变状态且结构化拒绝 | fallback skip 后继续回合 | 注入未知 family/pending 的负向测试 |
| 事务/replay 一致 | 每个外部选择恰好增加一个 policy replay step，确定性事件只进 environment events | conditional 被吞进同一步或失败 action 入 journal | non-zero checkpoint fork + cursor/RNG parity |
| 无外延依赖 | 核心 action 在无 DOM/localStorage/overlay/AI valuation 环境可枚举执行 | handler 读取 document 或 planner score | 禁用依赖结构扫描 + runtime poison/spies |

## 分阶段门禁

每批迁移至少需要：代表性规则测试、全 legal-action fork、旧入口调用为零或仅为显式 adapter 的结构证据、replay/checkpoint parity、全量 Node 回归。涉及浏览器 composition 或传统脚本顺序时，额外执行真实 Chrome smoke；涉及常驻 worker 时，再覆盖同实例 A/A、A/B/A 与 crash/timeout recovery。
