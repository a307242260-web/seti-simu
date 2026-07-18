# SETI-44 Gate A：RL 环境正向验收面与反例计划

> 形成时间：2026-07-19（Asia/Shanghai）
> 审计对象：`dev@c3e4cc2` 加共享工作树现状
> Gate A 约束：本文件形成前未运行 headless 示例、随机、压力或性能测试；标准只从消费方、契约和实现边界正向推出。

## 1. 证据源与边界

- 上游契约：`docs/rl-headless-env.md`、`docs/implementation-proof-obligations.md`。
- 训练消费方：`randomizer/training/self-play.js`、`evaluation.js`、`worker-protocol.js`、`headless-worker.js`、`worker-pool.js`。
- 环境边界：`randomizer/app/headless-contract.js`、`headless-env.js`、`public-api.js`。
- transition/conditional owner：`randomizer/app/ai/action-executor.js`、`randomizer/app.js`。
- replay/checkpoint：`headless-env.js` 的 `step/getReplay/loadReplay/createCheckpoint/loadCheckpoint`。
- 现有测试仅用于 Gate B 的证据索引，不以其当前断言反向定义正确性。
- 本 issue 只审计、构造最小反例并报告；生产缺陷另拆 coding issue。

分类只能使用：`策略决策`、`唯一项自动推进`、`确定性事件`、`未支持并 fail-closed`。`PASS/FAIL/UNKNOWN` 只在 Gate B 写入。

## 2. 状态 × action family × decision owner × fallback 禁区矩阵

| 状态 | family / 事件 | 正确分类 | owner | enumerate → execute → transition/replay 必须成立 | 禁止 fallback | Gate B 最小反例 |
|---|---|---|---|---|---|---|
| opening | setup/company/initial cards | 确定性事件（当前 v1） | 环境 | seed/config 唯一驱动，reset 后 replay cursor=0 | UI picker、AI policy、跨局残留 | 同 seed 双 reset parity；连续 episode A/B/A |
| turn-main | `launch` | 策略决策 | 当前玩家 | 完整 selector 可执行，随后停在 conditional/turn/terminal | heuristic 重选、DOM handler fallback | 含 launch 的 checkpoint fork 全 legal |
| turn-main | `orbit` | 策略决策 | 当前玩家 | 父动作执行；多目标另起 `choose_target` step | wrapper 取首目标 | 构造两个可环绕目标 |
| turn-main | `land` | 策略决策 | 当前玩家 | 父动作执行；多目标另起 `choose_target` step | picker/首项 fallback | 构造两个可登陆目标 |
| turn-main | `scan` | 策略决策 | 当前玩家 | scan action 与后续目标选择分离 | 浏览器 scan resolver | 可扫描多个扇区/星云状态 |
| turn-main | `analyze` | 策略决策 | 当前玩家 | 分析动作执行，痕迹/奖励选择另起 step | AI 痕迹 picker | 可放多种痕迹的分析后状态 |
| turn-main | `research_tech` | 策略决策 | 当前玩家 | tile/blue slot 多选均为独立 conditional | 浏览器科技 picker | 多 tile、多 blue slot checkpoint |
| turn-main | `play_card` | 策略决策 | 当前玩家 | handIndex/card identity 直接可执行 | wrapper 二次选牌 | 同名/多实例手牌 checkpoint |
| turn-main | `pass` | 策略决策 | 当前玩家 | 与 `end_turn` 分离，PASS 后 pending/replay 完整 | 自动保留牌 heuristic | 有多张可保留牌的 PASS |
| turn-quick | `move` | 策略决策 | 当前玩家 | rocket/direction/payment 参数完整 | AI movement candidate 重建 | 多火箭多方向全 legal fork |
| turn-quick | `quick_trade` | 策略决策 | 当前玩家 | tradeId 直接执行，后续选择独立 | AI trade heuristic | 每个可用 trade 独立 fork |
| turn-quick | `industry` | 策略决策 | 当前玩家 | 公司 1x 后的卡/槽/分支外显 | industry resolver | 每个公司类型的代表状态 |
| turn-quick | `card_corner` | 策略决策 | 当前玩家 | card instance/corner/目标完整 | 旧角标 picker | 资源角标、移动角标各一例 |
| turn-quick | `place_data` | 策略决策 | 当前玩家 | target/blue slot 无损进入 selector | UI data picker | 多可放置位置 fork |
| turn-quick | `runezu_face_symbol` | 策略决策 | 当前玩家 | alienSlot/position/symbol 完整 | 符文族 UI picker | 两个可放 symbol 位置 |
| turn-control | `end_turn` | 策略决策 | 当前玩家 | 仅主行动已完成后出现，与 PASS 不混用 | recover/end-turn fallback | 主行动后 mask 与 replay |
| conditional | `choose_card` | 多项：策略决策；一项：唯一项自动推进 | pending/effect owner | 多项执行后 cursor +1；一项不产生 policy step | AI card resolver/取首项 | 2 项与 1 项成对夹具 |
| conditional | `choose_target` | 多项：策略决策；一项：唯一项自动推进 | pending/effect owner | target 参数无损、owner 稳定 | overlay/picker callback | land/scan/trace 各代表夹具 |
| conditional | `choose_payment` | 多项：策略决策；一项：唯一项自动推进 | pending/effect owner | 每种支付产生独立可重放结果 | AI payment heuristic | move payment 与弃牌支付 |
| conditional | `choose_reward` | 多项：策略决策；一项：唯一项自动推进 | pending/effect owner | reward id/slot 可执行 | reward resolver | strategy passive 多槽/单槽 |
| conditional | `choose_branch` | 多项：策略决策；一项：唯一项自动推进 | pending/effect owner | 确认/分支不是 UI 技术按钮伪装 | 默认 branch/首项 | 方舟与公共牌确认分支 |
| conditional | `choose_final_scoring` | 多项：策略决策；一项：唯一项自动推进 | 达阈值玩家 | 25/50/70 mark 选择独立 step/replay | final-score AI resolver | 多个合法终局板块 |
| conditional | `accept_optional_effect` | 有真实取舍：策略决策；无取舍：确定性事件 | pending/effect owner | accept/decline 都改变未来时才入 mask | 自动 accept/skip | pay-credit、可选 scan |
| effect drain | 收入/抽牌/洗牌/轮切/纯确认 | 确定性事件 | 环境 | 有界推进到下一策略边界，事件与 policy step 分流 | policy、DOM、recover/skip 掩错 | spy 禁用依赖 + 2000 上界 |
| pending | 已知但单一合法选项 | 唯一项自动推进 | pending/effect owner | 不进入 legal mask，不增加 policy replay cursor | 暴露给 policy | 每个 conditional family 单选夹具 |
| pending | 未迁移或未知 family/type | 未支持并 fail-closed | 原 pending owner | 停止且诊断含 state/family/type/owner | resolver、skip、顶层行动穿透 | 注入 unknown pending/family |
| terminal | 终局结算/replay flush | 确定性事件 | 环境 | pending 清空后才 terminal；legal=[]；分数/reward 真值一致 | 提前终局、跳过终局标记 | 终局前 pending 与最终一步 |

## 3. Proof obligations：契约 → 可失败命题 → 反例 → 证据

| ID | 原契约 | 可失败命题 | 最小反例 | 实现落点 | review 问题 | 证据类型 | 失败诊断 |
|---|---|---|---|---|---|---|---|
| O01 | reset/seed/config 与 episode 隔离 | 同 seed/config 产生同 opening；不同 episode metadata 不串；reset 清空 replay/RNG/cache | A/B/A 连续 reset，B 写入一步后回 A | `reset/boot`、worker `episode` journal | reset 是否清空所有局内状态且只由 seed/config 决定？ | direct metamorphic + worker 连续局 | seed、episodeId、首个 observation diff |
| O02 | observation schema 与 viewer 隔离 | 任意 viewer 仅见自己的私域；对手手牌/牌库/未来 bonus/未揭示 alien 不可达 | 4 人 opening，对每个 viewer 交叉比较 | `buildObservation`、各 sanitizer | 公共树中是否存在任一私有字段或值？ | schema walk + 值级 canary | JSON path、viewer、泄漏类别 |
| O03 | decision owner 稳定 | legal/observation/step 的 actor 均为 pending→effect→current 解析结果 | pending owner 与 current player 不同 | `getHeadlessConditionalPlayer`、`buildDecision` | source/effectOwner/current 是否为真实值而非 action 类型猜测？ | owner fixture + wrong actor | pending type、三种 owner、actionId |
| O04 | legalActions 稳定、版本、mask | 同一决策重复调用顺序/id/mask 不变；状态变化后旧 action 拒绝且不改状态 | 缓存前后调用、旧版本 step | normalize/cache/version checks | actionId 是否对完整 selector 单射？ | property + state snapshot | duplicate id、selector diff、版本 |
| O05 | legal→executable | 对同 checkpoint 的每个 `a∈legal(s)`，fresh fork `step(a)` 成功 | 每个决策点逐 action fork | enumerator + `executeAiTurnAction`/conditional executor | 是否存在 mask 内动作被 transition 拒绝？ | 全 legal-action 合约 | seed、cursor、family、action、precondition |
| O06 | 15 个顶层 family 行为覆盖 | 每个 family 至少有真实 reachable state、enumerate、execute、transition、replay 证据 | 每 family 独立 fixture/checkpoint | action executor/public API/env | 是否只有静态 family label 而没有真实行为证据？ | family matrix runner | family、缺失阶段、checkpoint |
| O07 | 7 个 conditional family 行为覆盖 | 每个 family 有多选状态，外部选择产生独立 replay step | 每 family 两个非等价选项 | `enumerateHeadlessConditionalActions`/executor | 是否能实际枚举和执行，而非仅在常量数组声明？ | conditional fixtures | family、owner、choices、cursor |
| O08 | 唯一项自动推进 | conditional 合法项只有 1 个时，legal mask 不出现它且 replay policy cursor 不增 | 每 family 单选状态 | `drainDeterministicEffects` | drain 是否区分 1 项与 2+ 项？ | 局部断言 + replay check | family、choiceCount、cursor before/after |
| O09 | deterministic drain 有界且策略分离 | 自动推进不调用 policy/heuristic/resolver，≤上界到边界；失败不自动 skip 掩盖 | 禁用依赖抛错；活动 effect execute 失败 | drain loop/composition | effect 失败后调用 skip 是否会把生产缺陷伪装为成功？ | source scan + runtime spy | dependency、call count、effect、step count |
| O10 | 禁浏览器/DOM/UI | Node reset/step/replay/checkpoint 不读写 document/overlay/localStorage/Image 或 UI callback | 禁用 getter 访问即抛错 | headless config/view adapter/load bundle | 所有代表路径是否保持调用为 0？ | poison globals + source dependency scan | symbol、stack、family |
| O11 | 未迁移/未知 fail-closed | 任意未知 pending/family 不暴露顶层 action、不 resolve/skip，并返回结构化 state/family/owner | checkpoint 注入 unknown pending | conditional default、pending detection、drain | 未知字段是否可能不被 `hasActivePendingSubFlow` 识别而穿透？ | mutation negative test | error code、pending key/type、owner |
| O12 | reward 真值 | immediate/resource delta 等于规则状态差；terminalScoreDelta 等于终局真值增量且 shaping 不改 replay | 最终一步触发终局计分 | `buildReward`、final summaries | terminal reward 是否只重复即时基础分而漏终局公式？ | 逐步 state diff + terminal oracle | player、before/after、summary、reward |
| O13 | terminal/round/turn 语义 | terminal 当且仅当所有终局 pending 已结算；terminal 后 legal=[]、step 拒绝且状态不变 | 终局 mark pending 与 terminal 后 step | `isTerminal`/turn flow | `gameEnded` 是否早于终局 pending/replay flush？ | 边界 fixture + negative step | round/turn/pending/gameEnded |
| O14 | 非法动作语义 | wrong owner/unknown/stale/schema 错误都不改变状态、RNG、cursor、legal mask | 每类非法 step 前后 checkpoint | `step`、worker error mapping | 拒绝是否原子且错误分类稳定？ | metamorphic state equality | code、action、before/after hash |
| O15 | replay 非零恢复 | 至少一步真实动作后 loadReplay 与源环境 observation/legal/cursor/RNG parity | 非 PASS 动作 + 后续 conditional | replay/loadReplay | action schema/version 是否可跨 fresh env 重建？ | exact parity | first divergent cursor/path |
| O16 | checkpoint 非零恢复 | 非零 cursor checkpoint 在 fresh env 恢复 observation/legal/RNG/replay parity，继续同 action 后仍一致 | step 1 后 checkpoint，双分支续跑 | checkpoint API | 恢复是否重算 derived state并保持 RNG？ | fork metamorphic | cursor、RNG state、action ids、diff |
| O17 | worker/direct parity | 同 config/action 序列 direct 与 IPC 每步 observation/legal/reward/replay/checkpoint 一致 | 1+ conditional 的非零轨迹 | worker/headless worker | worker 是否改变 schema、错误或 episode metadata？ | stepwise parity | workerId、requestId、cursor、diff |
| O18 | worker 超时/崩溃恢复 | 仅已确认成功 action 入 journal；timeout/crash 后恢复到同状态，不跨 episode | action 成功→hang/crash→state；reset 新 episode | `WorkerSlot` recovery | 失败/非法 step 是否误写 journal？ | fixture + real worker | generation、episodeId、journal length |
| O19 | 背压 | 超过有界队列稳定返回 backpressure，不乱序、不丢已接受请求 | maxPending=1 并发两请求 | `rawRequest/batch` | batchIndex 与 requestId 是否稳定对齐？ | concurrency test | workerId、pending/max、batchIndex |
| O20 | determinism/metamorphic | 同 seed+actions 轨迹逐步相同；checkpoint/load、replay/load 与直接续跑等价 | 多 seed、多切点 | env/replay/checkpoint/worker | parity 是否比较 observation+legal，而非只比较终局分？ | property/metamorphic | seed、cut、first diff |
| O21 | 长轨迹可靠性 | 固定 seed 和随机策略均无非法/阻塞/跨局污染，失败可复现 | 单/多 worker 连续 100 局 | self-play/worker pool | 终局率是否掩盖任一硬契约 FAIL/UNKNOWN？ | stress（最后执行） | seed、episode、cursor、action |
| O22 | 单/多 worker 性能 | 常驻窗口 aggregate ≥50 decision/s，且保留 boot/step/serialization/inference 分项 | 1 与 4 worker、相同 games/worker | benchmark tools | 是否通过扩大等待或删协议字段制造提升？ | benchmark（最后执行） | 环境/Node/参数/分项 |

## 4. Gate A 静态高风险空白（不是 Gate B 结论）

1. `drainDeterministicEffects()` 只判断 `conditional.candidates.length`，未见 `length === 1` 自动执行分支；O08 优先证伪。
2. `choose_final_scoring` 在契约常量中存在，但当前阅读尚未找到 `enumerateHeadlessConditionalActions()` 的行为产出；O07 对该 family 优先判定。
3. `hasActiveEffectSubFlow()` 识别的外星人、任务、最终计分等 pending 明显多于 headless conditional enumerator 的分支；它们可能 fail-closed，也可能因 detection/default 不完备而穿透，O11 必须注入负例。
4. `drainDeterministicEffects()` 在活动 effect 执行失败后尝试 `skipHeadlessActionEffect()`；如果 skip 成功，可能违反“生产失败不得由 recover/skip 掩盖”，O09 必须 runtime spy。
5. `buildDecision()` 把 conditional 的 source 固定推断为 `effect_owner`，并把 `effectOwnerPlayerId` 固定为 `null`；这不等同于契约要求的 pending→effect→current 真实 owner 诊断，O03 优先检查。
6. observation sanitizer 仍需值级而非只按 key 名检查；`techSupply.bonusId`、board snapshots 和 alien private identity 必须用 canary 证明，O02 目前 UNKNOWN。
7. 现有 checkpoint 示例检查发生在零 action opening；验收硬门槛要求非零 action cursor，O15/O16 需新证据。
8. opening 全 legal fork 不能证明所有状态/family；O05 要在长轨迹多个 checkpoint 重复执行。
9. worker fixture 证明协议机制但不等同于真实 env 的 crash/timeout/recovery parity；O17/O18 要区分 fake 与 real 证据。
10. 性能与 100 局终局只能在所有硬契约完成后报告，不能覆盖上述 FAIL/UNKNOWN。

## 5. Gate B 执行顺序与判定

1. 结构/依赖：family producer/consumer 完备性、禁用符号/全局 poison、pending inventory 对照。
2. 局部断言与已有示例：contract/env/legality/worker/self-play。
3. 同 checkpoint 全 legal-action：opening + 固定策略采样出的每个决策点 fork。
4. conditional 夹具：7 family 的多选、唯一项、owner、独立 replay step。
5. property/metamorphic：determinism、viewer、非法动作原子性、非零 replay/checkpoint、direct/IPC。
6. 固定 seed 长轨迹与随机/压力：任何 failure 固化 seed/cursor/action。
7. 单/多 worker benchmark：只报告性能，不改变正确性结论。
8. 每个 O01–O22 写 `PASS/FAIL/UNKNOWN`；硬契约存在任一 FAIL/UNKNOWN 时训练不放行。
