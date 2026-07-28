# 启发式 Policy 单步性能改造矩阵（2026-07-28）

## 目标与基线

- 固定盘面：`seti-104-official-v1`，4 人，完成 27 步标准初始选择后的首个正常回合 Decision。
- 修正 benchmark 初始选择死循环后，当前单次 Policy 实测约 `2328ms`，18 个 legal action、112 个已执行反事实节点。
- 首阶段硬门禁：`tools/benchmark_probe_policy.js` 每次 Decision 不超过 `1000ms`；未通过前不运行完整局或批量实验。
- 本轮只优化当前 v9 的“当前 Action + 必需 DecisionEffect 闭包”，不恢复旧 AI 规划与自动推进设施。

## 完整设计矩阵

| 维度 | 冻结口径 | 反例与验证 |
| --- | --- | --- |
| 语义来源 | legal set、Action/Decision 执行、状态提交全部来自 Production Rule Composition；Policy 只消费标准 outcome | 不新增规则副本、Host executor 或兼容旁路 |
| 唯一 owner | `simulation-env` 只决定哪些 root action 值得求 outcome；`rule-composition` 独占分支执行、去重、预算与叶截断；`cards/play-domain` 独占卡牌 Decision choice 规范化 | 卡牌 choice 不得以主 Action 方式提交；Policy 不解释牌效果 |
| 状态等价 | 节点等价仍为 `stableHash(envelope) + actionId + remainingDepth`；envelope 包含 committed state 与 active Session checkpoint | 候选顺序翻转后 outcome 不变；不同 Session/深度不得错误合并 |
| 去重 | 继续使用全局 frontier transposition；同节点合并 root origins，保留稳定字典序 action chain | 不以 `maxLeaves` 冒充去重或 beam |
| 目标可达性 | v9 可选目标仅为当前闭包已兑现的分数、科技、收入；`end_turn/pass` 是控制保底，conditional 是必需输入 | 快速交易只改变即时资源/手牌，当前模型下不可能直接达到上述目标，因此不建立它的反事实根；缺失 outcome 显式标为未评估且不可选 |
| 资源下界剪枝 | 本轮不新增推测性资源估值；只做已证明不可能命中 v9 目标的 `quick_trade` root 剪枝 | 不过滤 `card_corner`、打牌、扫描、探测器或控制 Action |
| 叶预算 | `maxLeaves=8/root`；一个 root 达到上限后，后续 frontier 节点先移除该 saturated origin；共享节点仍为未饱和 origins 继续执行 | 固定 scan 的叶集合保持稳定，已满 root 不再执行剩余兄弟节点 |
| 全局预算 | `maxDepth=15`、`maxNodes=128`，全局按稳定 actionId 顺序推进；不新增逐根 leaf cap 之外的隐式预算 | diagnostics 必须报告实际执行/剪枝节点，超预算 outcome 保持 low confidence |
| RNG / id / sequence | 每个分支继续从同一 canonical envelope 恢复；branch key、Production RNG、state/action/decision version 不变 | 评估前后 checkpoint bytes 完全一致 |
| Decision owner | 卡牌域所有非 science Decision choices 也通过正式 `formalizeChoices` 生成 schema、conditional phase、actionId、actor/version | `b_11` 的移动选择不得再触发 `RULE_COMPOSITION_SESSION_ACTIVE`；stale/late/wrong-owner 继续 fail-closed |
| 事务边界 | 每条分支在隔离 fork 内完成整个 active Session；canonical root 零提交、零 history/replay/RNG 污染 | 直接标准执行与对应反事实叶的公开 projection 一致 |
| 旧入口 | 不新增或恢复旧 AI 规划与自动推进设施；全仓残留审计沿用既有删除账 | `rg` 不得出现新 legacy 入口 |
| Benchmark | benchmark 使用与 full-flow 相同的显式初始选择推进：每位玩家 1 公司 + 2 初始牌 + 确认，guard `<50` | 不能重复点击首个公司 choice；输出 setup step 数与实际 evaluated candidate 数 |

## 实现闭包

1. 修复 benchmark 的初始选择推进；父进程硬超时设为 25 秒，覆盖 12 次单步门禁与初始选择/GC 固定开销。
2. 将卡牌域通用 Decision choices 全部规范化为标准 conditional descriptors。
3. Policy outcome root 集合排除 `quick_trade`，完整 legal set 中以 `STRATEGIC_GOAL_NOT_EVALUATED` 回填。
4. frontier 执行前剔除已达到 `maxLeaves` 的 origins；若节点没有剩余 origin，则计为剪枝且不执行。
5. 增加 `b_11` 反事实全链、快速交易不评估、叶饱和停止执行、canonical 零污染与固定 benchmark 门禁证据。

## 验收

- `node --check randomizer/app.js`
- 相关 unit：卡牌域、Simulation counterfactual、Policy evaluator
- `node tools/benchmark_probe_policy.js`：12 次全部 `<1000ms`
- `node tools/run_node_tests.js`
- 真实 Chrome smoke；若当前 Browser runtime 无可用浏览器，明确记录为环境阻塞，不以 Node 测试冒充
- 仅提交矩阵列出的文件，并核对 commit 文件清单与提交后 worktree/index
