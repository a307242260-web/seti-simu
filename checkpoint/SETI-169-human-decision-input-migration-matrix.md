# SETI-169 Browser 人类 Decision 输入迁移矩阵

状态：设计冻结（2026-07-25；基线 `dev@4479d82`）。

## 范围、有限集合与根契约

本单只迁移 Browser 人类 active Effect Session Decision 输入。七个 conditional family 的有限
全集来自 `randomizer/game/actions/standard-action.js::CONDITIONAL_FAMILIES`：

`choose_card`、`choose_target`、`choose_payment`、`choose_reward`、`choose_branch`、
`choose_final_scoring`、`accept_optional_effect`。

正式 choice 的有限来源只来自 Production Domain Pack 已注册的五个 Effect domain：

- `card_play`：`randomizer/game/cards/play-domain.js`；
- `science`：`randomizer/game/effects/science-session.js`；
- `probe_turn`：`randomizer/game/effects/probe-turn-session.js`；
- `residual`：`randomizer/game/effects/residual-domain-session.js`；
- company/alien 子域：`randomizer/game/effects/industry-alien-session.js`；
- opening 的 `choose_card/choose_payment` 由 `randomizer/game/initial-setup.js` 建立，提交仍进入
  同一 Composition input port。

这些 owner 已由 SETI-158～163 建立 committed state、RNG/id/sequence、费用、实体迁移、
followup、journal/replay、CAS 与恢复契约。本单不得在 Browser 重建 choices、执行 resolver 或
followup；只把 viewer-safe projection 中的 identity 提交到 active Decision。

## Proof obligations

| 验收条款 | 可证伪命题 / 最小反例 | 唯一落点 | 失败语义与证据 |
|---|---|---|---|
| DOM 提交完整 Decision identity | 保存旧 DOM 后 decisionVersion 改变；点击不得进入 Composition | `HumanDecisionInputAdapter` 重读当前 viewer projection，校验 decisionId/version/owner/choiceId | stale，底层 submit 计数 0 |
| Browser 只呈现 viewer choices | p2 拥有 Decision，p1 projection 不得含任何 choice；p1 不能伪造 identity | `projection-adapter::normalizeDecision` owner visibility | wrong-owner/removed-choice，底层 submit 计数 0 |
| Browser 不构造合法项 | DOM 只持有 projection choiceId；不得按 label、target、数组索引或首项猜 choice | Human adapter 仅以精确 choiceId 对齐 active session choice identity | 相同 label/target 也不串项；缺 identity fail-closed |
| confirm/cancel 不执行规则 | confirm 只提交草稿 identity；cancel 只提交 projection 明示的 cancel/skip identity | `decision-ui` controller | 无 cancel choice 时拒绝；不调用 abort/领域 handler |
| 多步/多选不自动代选 | Decision 出现两个非等价 choice 时，render/focus 不得提交；只有显式 confirm 才提交 | `decision-ui` ViewState draft | focus 后 submit 计数 0；confirm 后恰好 1 |
| public API 无 Decision 旁路 | API 输入 stale/伪造 full choice 时不得绕过 viewer boundary | `public-api` 复用同一 Human Decision adapter | 与 DOM 相同 stale/owner/removed 结果 |
| 零副作用 | stale/wrong-owner/removed/篡改 identity 前后 committed bytes、journal、cursor 不变 | adapter 拒绝发生在 Composition 前 | submit spy 0 + Production composition 既有反例 |

Human adapter 可以在最后输入边界把精确 `choiceId` 对齐到 active session 中同 identity 的正式
choice；该对齐不按 label/target/predicate 解析，也不生成新 choice。Effect Session
`resolveDecision` 继续对完整 legal choice 做稳定序列化重验。

## 七 family 完整矩阵

| family | 正式 owner / committed state | Decision / transaction | Browser 展示与提交 | 删除义务 | 行为证据 |
|---|---|---|---|---|---|
| `choose_card` | opening、card、science、probe-turn、residual；player/card/match，card/RNG sequence | 牌实体 identity；抽取/迁牌/followup 同 session | 卡牌 renderer 只显示当前 owner 的 actionId | card selection builder、hand/public index matcher、blind/confirm continuation | opening、手牌、公共牌；双同名牌不串项 |
| `choose_target` | card/science/probe-turn/residual/company-alien；rocket/solar/data/tech/alien | target entity 与费用留在正式 choice；独立 replay step | board/tech renderer 提交 actionId | target string/predicate dispatcher、land/scan/move picker resolver | 至少两个目标；stale/wrong-owner |
| `choose_payment` | opening/card/probe-turn；player/card/match | 精确 cost/弃牌组合；费用与后续 effect 单 CAS | payment renderer 只呈现正式 cost DTO，提交 actionId | Browser 子集 builder、能量/手牌自动补齐、移动支付 resolver | 多支付项不取首项；资源漂移 removed |
| `choose_reward` | card/science/residual/company-alien | 奖励 exact choice；mutation/followup 归 session | generic/card renderer 提交 actionId | reward label/choiceId resolver | 同 label 奖励、skip/accept |
| `choose_branch` | card/residual/company-alien | 分支 exact choice；每分支独立 journal | generic/card renderer 提交 actionId | branch handler map、confirm mutation | 两分支 focus 不提交，confirm 单提交 |
| `choose_final_scoring` | residual final-scoring；player/final/match | tile/slot/threshold identity、标记与 CAS | final/generic renderer 提交 actionId | final UI tile mutation/provider | a/b/c/d legal tile、removed tile |
| `accept_optional_effect` | card/residual/company-alien | accept/skip 均为正式 choice 与 replay step | cancel/skip control 只提交明示 identity | abort session、cancel handler、optional followup | accept/skip 各一次，均无 Browser mutation |

## 旧来源全集与删除分区

### A. Browser Decision builder / owner

1. `randomizer/game/effects/browser-pending-decision.js` 的 21 个 kind：
   `move_payment`、`discard`、`hand_scan`、`pass_reserve`、`scan_target`、
   `scan_free_move`、`public_scan`、`probe_sector_scan`、`probe_location_reward`、
   `card_move`、`card_corner_free_move`、`card_trigger_free_move`、`card_trigger`、
   `card_task_completion`、`industry_ability`、`industry_free_move`、`strategy_slot`、
   `alien_trace`、`land_target`、`data_placement`、`turn_end_reveal`。
2. `randomizer/game/effects/card-selection-decision.js` 的 public/hand/blind/confirm choice builder。
3. `randomizer/app/conditional-decision-domain.js` 的 `describePendingDecision`、
   `collectConditionalChoices`、`CONDITIONAL_CHOICE_HANDLERS` 与
   `executeProductionConditionalChoice`。
4. `randomizer/app/conditional-action-executor.js` 的 Browser
   `inspect/executeDeterministic/resolveDecision`。

这些来源不得继续为人类 DOM 枚举 choices 或执行 followup。SETI-170 尚未删除的 OwnerInput 根
兼容层不属于本单，但其中不得再承载 Decision builder/resolver。

### B. Browser resolver / continuation

- `app.js::createActiveDecisionPort/submitActiveCardDecision/submitChoiceById`；
- `app.js` generic controller 中从 `ruleComposition.inspect().session.decision.choices` 二次
  `.find()` 完整 choice；
- `action-interaction-runtime.js`、`scan-flow.js`、`tech-runtime.js`、`industry-runtime.js`、
  `income-runtime.js`、`card-trigger-runtime.js`、`alien-ui.js`、
  `aliens/species-runtime.js` 的 `submitActiveDecision(kind, predicate)`；
- hand/card/scan/land/payment/final/alien picker 中按 index、label、target、direction 或
  `choices[0]` 解析并调用规则 handler；
- cancel 路径对 `Composition.abort`、pending、费用、实体或 followup 的直接 mutation。

正式 presentation 可继续保留，但 active Decision 时必须只消费
`BrowserProjection.decision.choices` 的 DTO 与 choiceId。

### C. public / DOM 入口

- `window.SetiRandomizer.input.submitDecision` 必须复用 Human Decision adapter；
- `#compositionDecisionRoot` 是七 family 的统一提交入口；
- 旧 picker/confirm/cancel DOM 不得再调用 A/B 中的 resolver；领域板面若要定制展示，只能把
  projection choiceId 交给同一 controller。

## 批量实现与集中验证

1. 根输入批次：建立 Human Decision adapter；严格校验 identity 与 viewer-visible choice；
   generic controller/public facade 复用它，删除 `app.js` 二次 full-choice resolver。
2. Presentation 批次：七 family 都只从 projection 获得 actionId；focus/confirm/cancel 仅操作
   ViewState 和 identity；删除首项/label/target/index resolver 与 abort mutation。
3. 来源删除批次：移除 Browser choice builder/handler/continuation 接线；保留 SETI-170 才删除的
   OwnerInput/recovery 根壳，但 Decision authority 必须为零。
4. 集中验证：Decision adapter/UI unit → `node --check randomizer/app.js` →
   `node tools/run_node_tests.js` → 真实 Chrome 多步 Decision smoke。

## 完成门禁

- 7/7 family 的 DOM submission 都只含 decisionId/version/ownerId/choiceId identity。
- stale、wrong-owner、removed-choice、篡改 identity 的 Composition submit 次数均为 0。
- 两个以上非等价 choices 时，render/focus 不提交，显式 confirm 才恰好提交一次。
- Browser 生产调用图中 choice builder、首项/label/target predicate resolver、
  confirm/cancel mutation、字符串 target dispatch、旧 continuation callback 和 public API
  Decision 旁路归零。
- Production game domain、committed state、RNG/id/sequence、Decision owner、journal/replay 与
  CAS 语义不变。
