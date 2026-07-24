# SETI-172 Host 来源归零迁移矩阵

## 冻结结论

本矩阵冻结于 SETI-171 的 `e22e45e` / `b2ac5ad` 之后。正式规则目标已经存在：

- `game/production-kernel.js` 是 Browser/Simulation Production factory 与 state/action context
  的唯一 owner。
- `game/production-composition.js` 安装唯一 Standard Action registry、deterministic drain、
  Decision owner、journal/replay 与提交链。
- `game/effects/standard-action-session.js`、`game/cards/play-domain.js`、
  `game/effects/science-session.js`、`game/effects/probe-turn-session.js`、
  `game/effects/residual-domain-session.js` 是仅有的五个 Production domain。
- `game/state/state-store.js` 与 Effect Session 是 committed root、working copy、CAS、RNG、
  sequence、Decision version 和 recovery 的唯一 owner。

Host 目标边界固定为：

```text
Browser projection / ViewState / renderer / Standard input / service / lifecycle
Simulation observation / policy / batch / report / lifecycle
                         │
                         ▼
             game Production Kernel + Composition
```

Browser 不再构造 state adapter、action context、pending owner、executor、history 或规则
callback。Simulation 不再读取 `stateSourcePort`，只消费 Production projection、input 与
lifecycle envelope。未知 family/effect/Decision、无合法项与错误 owner 均由 Composition
结构化 fail-closed；Host 不提供 fallback。

## 有限集合来源

集合由以下命令机械导出，不靠命名抽样：

```bash
rg -n '<script src=' randomizer/index.html
rg --files randomizer/app randomizer/training | sort
rg -n 'workingRoot|stateSourcePort|create[A-Za-z]*(Executor|Provider)|execute[A-Za-z]*Effect|openPendingDecision|readPendingDecision|quickActionHistory|historyCommands|continuation|fallback|unsupported|unavailable|no_legal_choice|registry|alias' \
  randomizer/index.html randomizer/app.js randomizer/app randomizer/training
```

动作完备集来自 `SetiStandardAction.ALL_FAMILIES`：`launch`、`orbit`、`land`、`scan`、
`analyze`、`research_tech`、`play_card`、`pass`、`move`、`quick_trade`、`industry`、
`card_corner`、`place_data`、`runezu_face_symbol`、`end_turn`、`choose_card`、
`choose_target`、`choose_payment`、`choose_reward`、`choose_branch`、
`choose_final_scoring`、`accept_optional_effect`。

## 目标轴：22 family / 5 domain

| Production owner | family | committed state / RNG / Decision / transaction |
|---|---|---|
| standard-action-session | `launch`、`orbit`、`land` | StateStore working copy；rocket/planet entity identity；费用、位置迁移与 CAS；无 Host callback |
| probe-turn | `pass`、`move`、`end_turn` | turn/rocket/player slices；rotation/turn sequence；支付、PASS/收入/跨轮 Decision；journal/replay |
| science | `scan`、`analyze`、`research_tech` | data/card/tech/solar slices；card/data/tech id 与 RNG cursor；target/payment/slot Decision |
| card-play | `play_card` | card/player/match slices；card instance/抽牌 sequence；支付、trigger、task、barrier |
| residual-domains | `industry`、`card_corner`、`place_data`、`runezu_face_symbol` | industry/card/data/alien/player slices；实体 id；公司/物种/奖励 Decision |
| Production continuation | `quick_trade`、全部 7 conditional family | 同一 active Session；decisionId/version/owner/choice；stale/late/wrong-owner 零副作用 |

五个 domain 均由 `createProductionDomainPack()` 构造期 claim family；重复 owner、缺失 family
或 Host 自定义 `productionRules` / `standardActionDomainOptions` / `effectDomains` /
`createActionRegistry` 必须构造期失败。

## 来源轴：旧符号、唯一去向与删除证据

下表按可达脚本/模块闭包分组；每行内所有导出及其内部 helper 均同归一个删除义务，不能留下
改名 bridge、no-op 或成功 stub。

| 旧来源（全部符号） | 当前规则职责 | 唯一 Production primitive | 调用者/脚本删除 |
|---|---|---|---|
| `app/effects/{bootstrap,dispatcher,movement-scan,rewards,aliens}.js` | Effect executor suite、规则 dispatch、奖励/扫描/物种 mutation | 五个 Production domain executor | 从 `app.js`、`dependencies.js`、`index.html` 删除；文件物理删除 |
| `app/effect-flow.js`、`app/effect-choice-flow.js` | actionEffectFlow、insert/drain/skip、choice/history | Effect Session queue/Decision/journal | 同上，文件物理删除 |
| `app/conditional-decision-domain.js`、`app/conditional-action-executor.js` | conditional builder/provider/executor、deterministic boundary | Production continuation + 7 conditional family | 同上，测试迁至 architecture audit/Production 行为证据 |
| `app/quick-turn-action-executor.js` | Host quick/turn executor | probe-turn + residual + quick-trade source | 同上，文件物理删除 |
| `app/action-runtime.js` | Host action provider/context/dispatch runtime | Production action registry/input port | 同上，文件物理删除 |
| `app/action-interaction-runtime.js` | launch/orbit/land/move/analyze/data/Pluto mutation 与 picker 混合体 | Production descriptors；Browser 仅 action/Decision presentation | 删除规则 runtime；UI 只从 projection/descriptor 提交 |
| `app/hand-flow.js`、`app/card-runtime.js`、`app/card-trigger-runtime.js` | card pending、支付、移动、task、history、trigger | card-play/residual/Production Decision | 删除规则 owner；卡牌展示由 resident projection/renderer |
| `app/scan-flow.js` | scan target、card/sector settle、延迟补牌 | science domain | 删除规则 owner；目标只由 Decision UI 展示 |
| `app/tech-runtime.js` | research/blue slot/undo/history mutation | science domain | 删除规则 owner；科技展示只读 projection |
| `app/industry-runtime.js` | 公司能力、rollback、pending | residual domain | 删除规则 owner；公司 Decision 用通用 Decision UI |
| `app/alien-runtime.js`、`app/alien-trace-reward-flow.js` | 揭示、痕迹、奖励、机会队列 | residual domain | 删除规则 owner |
| `app/alien-ui.js`、`app/aliens/species-runtime.js` 中规则端口 | 物种 picker + mutation/session/history | residual domain | 删除规则部分；正式 projection/Decision UI 保留可视化 |
| `app/income-runtime.js` | income effect/pending continuation | probe-turn/residual domain | 删除规则 owner |
| `app/score-source-runtime.js` | Host score ledger 与撤销 command | game player/final scoring/journal | 文件物理删除 |
| `app/turn-flow.js` Host runtime、`app/turn-end-flow.js` | new-game randomization、PASS/end-turn/reveal/income continuation | Production Kernel lifecycle + probe-turn | 删除 Host runtime；只保留 projection 格式化时也不得读 working root |
| `app/final-ui-runtime.js` 规则方法 | final pending mark、markTile、history | final-scoring + conditional family | 删除规则 owner；最终展示只读 final read model |
| `app/browser-host/action-bar.js` 的 ActionSession/guard/history runtime | pending/session/history/working-root guard | Composition inspection + Action descriptors | 仅保留 selector/model/controller/DOM presentation |
| `app/browser-host/card-decision-ui.js` 的 working-root/pending helper | 私有 card pending viewer | 通用 viewer-safe Decision projection | 删除 helper；renderer registry 仅匹配 presentation |
| `app/runtime.js` 的 Browser rule state/match runtime | create/restore working root、pending 容器 | Production Kernel state adapter/lifecycle | Browser 仅保留独立 ViewState；规则 adapter 物理删除 |
| `app.js` | suite/provider/runtime 装配、working-root callback、history、pending、规则 public glue | Browser Production factory + projection/input/services | 重写为窄 composition root；禁止规则 callback |
| `app/dependencies.js` | 收集上述 Host rule globals | 只收集 game Production 与 allowlisted Browser modules | 删除旧 global key |
| `randomizer/index.html` | 装载上述 Host rule scripts | 只装载 game Production 与 allowlisted Browser scripts | 删除旧 `<script>`；不存在兼容 alias |
| `app/public-api.js` | 若暴露任意规则 helper/bypass | inspect/capture/restore + Standard Action/Decision input | 固定 allowlist，负向审计 |
| `app/simulation-env.js` `getWorkingProjection/stateSourcePort` | Simulation 读取 private committed/working root | `composition.projection/inspect/lifecycle` | `stateSourcePort` 引用归零 |
| `training/**` | policy/self-play/worker/checkpoint/report | 只调用 Simulation Host/Composition | 禁止 provider/executor/conditional registry 与规则 fallback |

允许保留且必须为纯 Host 的模块：`browser-host/projection-adapter.js`、
`view-state-store.js`、`input-adapter.js`、`policy-input-adapter.js`、纯化后的
`action-bar.js`/`decision-ui.js`、`resident-projection.js`、`resident-renderer.js`、
`browser-services.js`、`game-recovery.js`、`public-api.js`、AI control/bootstrap、
storage/download/timer/focus、训练 policy/batch/report/worker protocol。

## Proof obligations

| 验收条款 | 可证伪命题 | 最小反例 | 证据 |
|---|---|---|---|
| 22 family / 5 domain 唯一 owner | Production pack coverage 恰为全集且 owner 不重复 | fixture 注入第二 `launch` owner | architecture audit + Production coverage |
| Host facade allowlist | app/training production 文件只命中允许模块与端口 | 改名 `RuleBridge` 转发 root | import/global/script graph audit |
| Host 自定义 owner 构造失败 | 任意 Host registry/executor/continuation/working transaction option 都抛错 | `effectDomains: []` 或自定义 provider | negative fixture |
| canonical root 不出 game | Browser/Simulation 无 `stateSourcePort`、working/committed root 读取或直接 slice 写 | `projection.state.players[0]...=` 或 `stateSourcePort.read()` | source audit + frozen projection behavior |
| fallback 归零 | unknown/unsupported/unavailable/generic pending/no legal choice 不继续推进 | 注入未知 pending 后返回成功 | negative fixture + fail-closed behavior |
| Browser 功能不空壳 | 真实页面有人类主/快/回合动作、多步 Decision、完整 renderer、保存恢复 | 静态 DOM 或只跑 API 不渲染 | `production-browser-full-parity` Chrome smoke |
| 双 Host parity | 同 checkpoint/family 的 result、journal、Decision、committed state 一致 | Browser 预扣费用或 Simulation 简化执行 | Production Composition fork/parity tests |
| 常驻恢复 | fixed seed 终局、A/A、A/B/A、非零 replay、worker crash recovery | 第二局 sequence/RNG 漂移 |既有 SETI-171/Simulation 证据 + 本次相关回归 |

## 批量实现顺序

1. 在 game Production Kernel 建立 Browser factory，Browser composition 不再接收 Host
   state/action context；Simulation 切断 `stateSourcePort`。
2. 重写 Browser composition root 与 presentation/input/lifecycle 装配，纯化混合
   Browser modules。
3. 一次性删除旧 runtime 文件、dependency globals 与 HTML scripts。
4. 建立可执行 architecture audit 与四类负向 fixture，再集中运行 Node/Chrome/full-flow。

若验证首次暴露 owner、state、RNG 或 Decision 契约遗漏，停止 patch 并回到本矩阵补齐，不以
局部 handler 修补继续推进。
