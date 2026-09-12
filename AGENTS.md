# SETI 快速入口

无构建步骤的浏览器原型。页面为 `randomizer/index.html`，装配根为
`randomizer/app.js`，宿主在 `randomizer/app/**`，规则内核在 `randomizer/game/**`。

## 工作约定

- 验证完成后自动提交本次修改，提交信息用中文；不自动推送。
- 不覆盖他人改动，只提交本次内容。共享工作树的 index 隔离与快照验证按
  `git-workflow` 技能的 SETI 章节执行。
- Browser 与 Simulation 共用 Production 内核、机器协调器和评估器；宿主只负责输入输出。
- 规则、搜索和估值失败必须显式上报；容错须有明确契约。新增评估输入路径时运行
  `node tools/audit_v_state_inputs.js`。
- 大型架构迁移保留范围清单、关键契约和验收矩阵，允许随调查与测试更新设计；
  具体参考 `docs/implementation-proof-obligations.md`。普通修改不要求完整迁移矩阵。
- `SETI-*` 使用 `/Users/bilibili/.local/bin/mocha` 默认 workspace，操作前核对
  `mocha config show` 中 ID 为 `6377be1d-624b-40f3-aec9-810bdeaff66d`；不带
  `--profile algo1-wyfx`，不将缺失的 SETI issue 改查为同号 ALG issue。

## 按任务查阅

只读取当前任务相关资料，阶段进度不作为每次开工的必读项。

| 任务 | 资料入口 |
|---|---|
| 架构、模块定位 | `docs/project-architecture.md`（含模块导航）、`docs/app-architecture.md` |
| 规则、状态、事务 | `docs/mechanics-reference.md`、`docs/standard-action-contract.md`、`docs/effect-session-runtime.md` |
| 机器玩家、搜索、估值 | `docs/ai-design.md` |
| Simulation、训练、恢复 | `docs/rl-simulation-env.md`、`docs/save-replay-guide.md` |
| 卡牌、效果 | `docs/card-data-sources.md`、`docs/card-modeling-dsl-spec.md`、`docs/effect-glossary.md` |
| 公司、外星人、终局 | `assets/industry/industry-abilities.md`、`docs/alien-design.md`、对应物种的 `implementation.md`、`assets/final/final_detail.md` |
| 机器人实验、版本登记 | `docs/robot-iteration-registry.md`、`docs/fixed-boards.md` |
| 长期决定、阶段进度 | `PROJECT_MEMORY.md`、`docs/progress-20260912.md`（按需） |

## 验证与实验

- Node 行为验证：`node tools/run_node_tests.js`，可用 `--match` 定向执行；测试登记与
  unit/唯一 full-flow 分类见 `docs/node-testing.md`。
- 修改 JavaScript 时执行相关文件的 `node --check`；Browser 装配、页面输入或恢复链
  变化时补 `node tools/run_browser_smokes.js`，大型迁移运行完整 Node 回归及相关 Chrome smoke。
- 机器人快速/全盘实验先 `node tools/run_research_validation.js --list`，复用已有记录。
  使用 `node tools/robot_iterate.js` 登记版本并运行；同实验、同代码版本不重复运行，
  不用裸工具绕过去重。成绩以可追溯的完整终局为准。
