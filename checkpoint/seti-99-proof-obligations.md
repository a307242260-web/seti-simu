# SETI-99 零兼容总验收 Proof Obligations

## 状态 × owner × 宿主 × 反例矩阵

| 状态 | 唯一 owner | Browser / Headless 行为 | 最小反例与失败语义 |
|---|---|---|---|
| opening | setup session + StateStore | 同一 Standard Action/Decision 输入，committed schema 初始化 | 旧 candidate 或无 Standard Action descriptor：不生成 RL action |
| turn | Standard Action + Effect Session | 同一 registry descriptor、working copy 与 CAS | 旧 selector id、stale action：提交 0、journal 0 |
| pending / conditional | Effect Session | 同 decision id/version/owner/choices | 未知 family、错误 owner、stale decision：结构化拒绝，不取首项 |
| recovery | StateStore + Effect Session checkpoint | 当前 committed/session schema round-trip | version 1、缺版本、未知 root、损坏 JSON：restore port 0 |
| terminal | StateStore | 最终 committed score 与 replay cursor 可恢复 | terminal 后 action：state/replay 不变 |
| Policy request | Machine Player Host | 公共 DecisionContext -> legal PolicyDecision | 非法 id、identity drift、timeout、迟到响应：submit 0 |

## 可证伪义务

| ID | 命题 | 责任点 | 证据 |
|---|---|---|---|
| Z1 | 状态 adapter、旧切片 projection、旧 turn/play selector、candidate pipeline 的生产引用与文件均为 0 | `tools/audit_state_authority.js` | `forbiddenReferences=[]`、`forbiddenFiles=[]` |
| Z2 | authority inventory 只含正式组件且每项有唯一 owner/source/target | `game/state/authority-inventory.js` | schema v2、`nonFormal=[]`、最终 residual inventory |
| Z3 | Headless 只接受 Standard Action descriptor，不从旧 id 生成 family/actionId/payload | `app/headless-contract.js` | 15+7 family 正向矩阵；旧形状返回 null |
| Z4 | StateStore/Effect Session/Browser Host/Policy 依赖只向下，renderer/Policy 不执行规则 | 各公共端口 | source audit、poison tests、全量 Node |
| Z5 | 旧/未知 schema、未知 family、stale decision、非法 Policy 输出全部 fail-closed | recovery/headless/policy/host validators | 负向测试矩阵，提交/restore/resolver 调用为 0 |
| Z6 | 新存档、非零 checkpoint、replay、RNG 与 cursor 恢复等价 | StateStore + session/headless checkpoint | checkpoint/replay/fork tests |
| Z7 | 固定 seed Browser/Headless 与四席机器完整局不漂移 | shared Action/Session/Policy | seed baseline、完整 headless、真实 Chrome |
| Z8 | 长期文档只描述当前 owner/命令/模块职责，删除迁移窗口与陈旧状态 | AGENTS + app/state/AI/RL/recovery/mechanics docs | 文档扫描与实际 `wc -l` |

固定策略仍为 460 步、分数 `[61,69,36,29]`、family 计数与 provenance 不变；删除旧
`end-turn` payload 映射后，trace 只发生 identity 规范化，冻结 hash 更新为
`d2e46582443a68f9d20116520b21a0facaaad260de75a88c9daa905bf0c2a4f4`。

## 最终 residual inventory

只允许以下正式组件：

| id | owner | source -> target |
|---|---|---|
| `committed-game-state-v1` | StateStore | snapshot/working copy -> compare-and-commit |
| `card-task-index` | card task query runtime | committed cards/players -> derived index |
| `setup-selection` | setup session | setup Decision/Effect -> committed match/players |
| `card-tech-rocket-ui` | Browser ViewState | BrowserProjection/ViewState -> renderer |

不得出现 adapter、临时豁免、到期字段或第二规则 owner。

## 验证结果

- 结构审计：`node tools/audit_state_authority.js` PASS；schema v2，`nonFormal=[]`、
  `forbiddenReferences=[]`、`forbiddenFiles=[]`，residual inventory 仅上述 4 项。
- Node：`node --check randomizer/app.js` PASS；`node tools/run_node_tests.js` 168/168。
- 负向路径：旧/缺失/未知 StateStore 与 recovery schema、未知 pending/type/family、stale
  Action/Decision、非法/迟到 Policy 输出均 fail-closed，restore/submit/resolver 调用为 0。
- 恢复与 parity：StateStore round-trip、non-zero checkpoint fork、worker crash replay、
  RNG/cursor/session journal 与 Browser/Headless fixed trace 测试全部通过。
- Headless：`node tools/benchmark_headless_env.js --games 3 --max-steps 1200`，3/3 终局，
  315 decisions，54.337 decisions/s。
- Chrome 人类/恢复/Policy smoke：Browser Host input、Browser Services recovery、Policy
  Action/Decision 三页均 `data-result=passed`；Policy poison counters 全为 0。
- Chrome 四席完整局：seed `seti99-zero-compat:1`，748 步终局，`blocked=false`、
  `bugCount=0`，四席最高分 112、最低分 46。
