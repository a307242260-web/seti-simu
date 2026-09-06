# AI 四轮迭代收口审查（2026-09-06）

## 结论

当前累计实现213f34db通过本计划的实现与固定盘面效果验收。第一、二轮维持原通过
结论；第三、四轮在当前累计版本收口，不将此前未达标候选改写为通过，也不声称
第三轮单独贡献了多少分。后续迭代以本版本的固定盘面终局均108.5为比较基线。

这不是全游戏穷举、所有机制无缺陷或性能优化完成的结论。完整局527450ms（8分47秒），
明显高于原先约3分钟。采用用户放宽耗时后的4096物理节点、256队列、30秒单次搜索
期限口径；没有新增长时预算。原6d67a974的30秒超时没有复现，根因未查明，不能
因为后续完成一局就说已经修复。整局提速保留为后续独立工作，不无限延长本轮。

## 改动摘要

- 第三轮：按每次真实提交记录动作、具名依赖与揭示基线，计划逐步推进；同回合和
  跨回合统一检查。按正式实体绑定探测来源，目标完成后的奖励阶段只保留奖励依赖。
- 第四轮：按完整状态去重，使用有根覆盖的全局队列预算；移除次级搜索停止叶饱和、
  摘要支配、单目标调度和未绑定top-4；分开表达结果可用性与搜索完整性。
- 独立修复继续归属各自版本：板块依赖类型、扫描目录与标准扫描来源、收入选牌、
  探测来源、得分角标准入、轮初数据实体，以及复制/读取等价优化。不把它们统称为
  R3引入的次生缺陷，不将纯复制优化写成策略收益来源。

## 原始义务对照

审查HEAD为bc2a3439；其randomizer、assets、tools与213f34db没有差异。本次没有生产
修改。以下源码审查、窄接口测试、真实盘面证据分别承担不同义务，不互相冒充。

| 义务 | 当前实现核对 | 行为证据与边界 |
|---|---|---|
| 每次正式输入的前置证据 | rule-composition三处current/settleChoice/nextPlaceData均先captureStep，成功后retainStep；actionChain保持宏步骤原义 | plan-steps-r3-profile-20260905-d2f49e3e：143叶/2111步，逐叶对应执行计数；真实支付计划复用及连续数据unit。历史样本不冒充当前整局缓存日志 |
| 逐步而非整叶依赖 | compilePlanSteps按目标深度、目标、计划及奖励阶段分段；advancePlan切换整项证据 | plan-continuation unit覆盖自身数据推进、跨目标切换、复合依赖、无关路线变化；r3-brown-plan-realization：12步命中后公共牌变化失效 |
| 同回合新信息与失败边界 | coordinator同回合也调用planReuseCheck；actor/语义/合法性、揭示、依赖共同检查；成功execute后才保存计划 | coordinator unit覆盖同回合揭示/科技变化、跨回合开关、控制动作、提交失败不消费、reset清空。正式authority/CAS未新增旁路 |
| 来源、奖励与公开输入 | 依赖具名rocket/tech/sector/card/alien；正式slotId及traces层级；完成目标释放路线依赖而保留奖励选择 | probe-source-plan-verification六次正式续步；tile-dependency真实边界；scan-earth正式范围反例；外星sanitize与未知事实miss unit。不扩大到全扫描来源重构 |
| 状态等价与来源保留 | exactNodeKey包含完整canonical、session、动作与剩余深度；origin独立；旧摘要支配入口删除 | search-budget unit验证RNG/序号改变后继、共享物理节点保留两根、候选换序；search-equivalence及completion-state真实反例说明旧摘要不能证明等价 |
| 全局预算与真实叶 | trimSecondaryFrontier先保留各根最优节点再全局填充；次级maxLeaves不再截断；frontierLeaves不进入次级outcomes | search-budget与search-root-attribution unit验证beam/root/node；完成叶保留，未完成支付不作结果。真实绿方样本4096节点、2212叶。预算是有损选择，不保证最优 |
| 完整性与消费者 | 每根incompleteReasons归属beam/node/depth/代表选择/信息屏障/失败；未评估补齐not-evaluated；settled与完整性分离 | terminal-value在V开关及换序下加incomplete仍选同一动作与计划；projection复制/校验unit。不同原因标记点已逐项读源码，并非每种原因都有真实整局触发样本 |
| 截断、超时及正式执行隔离 | 宏步前后及输出组装后检查期限；超时清理fork并抛错；只经原正式inputPort提交；搜索结束校验根envelope未变 | search-budget微期限反例无真实根提交；唯一full-flow与恢复测试通过。同步宏步不能被中途抢占，30秒不是严格实时上限；旧30秒事故根因仍未知 |
| 观察优化等价 | observe一次枚举，projectState前复制独立decision，不跨调用缓存，不改cheap或枚举错误语义 | session-runtime unit；双viewer观察hash；当前绿方真实决策与优化前16结果、2212叶逐项hash、Policy、计划、提交后状态/观察/合法集一致 |
| 独立正式数据修复 | 轮初收入复用gainData生成实体与序号，满池按规则弃置，其他失败返回 | residual-domain-session容量/收入/owner组合；round-data-income-r4-real第144步仅新增应得实体和序号，前后恢复等价，重复旧动作拒绝 |

资源下界用于已准入目录排序；原有目标引导、代表选择、单席未来与隐藏信息近似仍在。
此次没有将其宣称为全游戏无损剪枝。旧sameTurn合法性旁路、语义meta剥离、次级
摘要支配、停止叶饱和、单目标及top-4调度已核对不再供生产使用；历史报告字段与
非light单依赖诊断保留，明确不参与生产复用。Browser/Simulation共用协调器与决策函数。

## 本次复核结果

- `node tools/run_node_tests.js`：unit 76/78（19.67秒），唯一fullFlow 1/1（0.53秒）。
  两项指定旧失败仍为simulation-counterfactual-outcome.test.js:285的旧no-beam断言，
  strategic-goal-evaluator.test.js:386的旧分析目标释放断言；未改测试迁就它们。
- `node tools/audit_v_state_inputs.js`通过。原始env.observe不能直接喂V是预期拒绝，
  标准decision、反事实叶、Browser机器席位装配均通过。
- `adhoc/audit-ai-rounds-final-20260906.js`只读重核已有16结果/2212叶等价、存档SHA、
  快速前缀与终局；产物ai-rounds-final-evidence-20260906.json。没有重新运行固定盘面。
- 固定盘面702步，蓝/绿/棕/白96/84/130/124，均108.5，相对R2e均106.75增加1.75。
  使用match.finalScores.totalScore，不是阶段分；quick与full同提交续跑，保存完整报告。
- 登记审计仍有5项历史warn（4份旧孤儿全盘、fold-chain来源），本版本无新增warn。

## 文档、范围与后续

更新四轮计划、迭代说明、版本真相源及生成总览；历史设计/复盘添加当前收口指引，
不抹去失败结论。已检查README、AGENTS、PROJECT_MEMORY、AI设计、RL契约、机制说明、
effect-session-runtime、Node测试规范、app架构；本次只增加审计及状态记录，不改变
生产接口、玩法、运行/部署或目录入口，因此这些实现文档无需新增改动。仓库无
CLAUDE.md/PROGRESS.md。本次不涉及runtime迁移或脚本顺序调整，不新增Chrome迁移smoke。

性能后续若继续，先针对保存的绿方输入与CPU样本设计等价优化，再测完整决策，而非
只报局部复制加速。其他固定盘面、全轨迹依赖日志、所有扫描来源的系统化绑定和未复现
超时的根因仍未覆盖；不把这些独立扩展伪装成本计划已经完成的成果。当前没有新发现
且可复现、必须先修才能交付的实现偏差，不再为追分或满足“继续”而制造新版本。
