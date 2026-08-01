# 启发式 Policy 次级代理搜索矩阵（2026-07-28）

## 用户口径

一级目标不是路线终点，而是搜索叶的评估轴：

```text
V(leaf)
  = 从搜索根到 leaf 的累计实际分数增量
  + 搜索期间新增科技 × 取得时所在轮的剩余轮次价值
  + 搜索期间新增收入 × 取得时所在轮的剩余收入窗口价值
```

- 分数的单位价值不随轮次变化。
- 科技和收入的价值随轮次推进而下降；越晚取得，剩余生效窗口越少。
- 获得一次分数、科技或收入不会终止路线，搜索继续累计后续收益。
- 搜索在本席本轮实际 `PASS` 后终止，或累计执行 15 个本席次级代理后终止。
- 15 不是单个 Standard Action 内部的 DecisionEffect 深度。

Policy 仍只提交获胜路线的第一个当前 legal descriptor。真实提交后，下一次 Policy 请求从新的
committed state 重新搜索。

## 次级代理全集

有限集合机械来源为 `standard-action.js` 的顶层 family；conditional family 是代理内部的正式
规则选择，不是独立次级代理。

| 类别 | 次级代理 |
| --- | --- |
| 探测器 | `launch`、`move`、`orbit`、`land` |
| 扫描与数据 | `scan`、`place_data`、`analyze` |
| 卡牌与科技 | `play_card`、`card_corner`、`research_tech` |
| 资源与能力 | `quick_trade`、`industry`、`runezu_face_symbol` |
| 控制 | `pass` 是路线终点；`end_turn` 只推进真实 owner，不计代理深度 |
| 代理内部选择 | `choose_card`、`choose_target`、`choose_payment`、`choose_reward`、`choose_branch`、`choose_final_scoring`、`accept_optional_effect` |

“赢得扫描扇区、环绕、登陆、痕迹、科技、收入”等是上述代理执行后的真实状态结果，不另造
规则 action。未知 family 继续 fail-closed。

## 搜索状态

| 维度 | 冻结口径 |
| --- | --- |
| 根 | 同一 viewer、canonical stateVersion/decisionVersion、当前 legal set |
| 节点 | 完整隔离 Composition envelope、当前 action、根 action、focal seat、本席代理深度、完整标准 action chain |
| 状态等价 | committed state bytes + active Session checkpoint + 当前 actionId + focal seat + remaining proxy depth |
| 叶 | focal seat 已 PASS；focal proxy depth=15；terminal；或预算剪枝 |
| 价值 | 只比较根 observation 与叶 observation 的累计分数/科技/收入变化 |
| 非终止收益 | 中途出现正分、科技或收入只提高 branch priority，不产生叶、不停止展开 |

科技/收入若搜索跨入新轮，按各自实际取得时的轮号分段累计，不能把最终轮号统一套给整条路径。
本轮搜索正常在 focal PASS 时结束，因此不会把“所有人 PASS 后的新轮轮初收入”算作 focal PASS
自身价值。

## 跨回合与对手 owner

搜索必须经过真实 `end_turn` 和真实 turn owner，不能直接把 currentPlayer 改回 focal seat：

1. focal seat 的顶层 legal 代理全部作为分支；其 conditional Decision 全部由正式 owner 展开。
2. focal 主行动完成后的 `end_turn` 是确定性控制推进，不计代理深度。
3. intervening opponent 使用冻结的版本化 rollout policy 选择一个标准顶层行动；其 conditional
   Decision 使用同一冻结 rollout policy 的稳定选择，随后真实 `end_turn`。
4. 再次轮到 focal seat 后继续展开次级代理。
5. focal `PASS` 的必做 Decision 链完整结算后立即形成叶；不执行其后的 `end_turn`，避免把下一轮
   轮初收入归给 PASS。

rollout policy 只用于隔离搜索树中的对手动作，不提交 canonical root，也不改变正式
Machine Player Host 的 seat/policy identity。首版 `secondary-agent-rollout-v1` 的稳定顺序冻结为：

1. active Session conditional：按 actionId 取第一项；
2. 主行动已完成：取 `end_turn`；
3. `orbit`、`land`、`research_tech`、`scan`、`play_card`、`place_data`、`analyze`、
   `launch`、`industry`、`runezu_face_symbol`、`card_corner`、`quick_trade`；
4. `pass`；
5. 只有没有其他主行动或 PASS 时才使用 `move`，避免冻结对手在 focal 路线搜索中展开自己的
   多步快速移动树；
6. 仍无候选则 fail-closed。

同一 family 内按 actionId 稳定排序。该 rollout 只解决合法跨 owner 状态推进，不进入 focal
最终 V；其版本进入搜索 provenance 和 branch key。

## Decision、事务与确定性

| 维度 | owner / 义务 |
| --- | --- |
| Action/Decision 枚举执行 | Production Rule Composition 与 22-family registry |
| 搜索编排 | Rule Composition counterfactual port 的显式 `secondaryAgentSearch` 模式 |
| 对手 rollout | 版本化、确定性的标准 descriptor selector；未知/无选择 fail-closed |
| 回合/PASS | committed `turnState` / `turn-flow.js` |
| RNG/id/sequence | fork envelope + branch RNG；canonical RNG、sequence、journal、history、replay 零变化 |
| stale/late/wrong-owner | 每个 fork step 重新枚举并按 actionId 匹配；不复用过期 descriptor |
| conditional | 非等价 choice 是独立标准 Decision；focal 分支、opponent 由冻结 rollout 选一 |
| 事务 | 每个 action 仍由 Effect Session 完整结算；搜索路线不是一个 canonical 跨回合事务 |

## 剪枝、beam 与预算

| 预算 | 冻结值 |
| --- | --- |
| focal 次级代理深度 | 15 |
| 单代理内部 DecisionEffect 深度 | 15，独立命名为 `maxDecisionDepth` |
| 全局执行节点 | 128 |
| 后续全局 beam | 先按 root 保留最佳同源节点，再保留 2 条路线 |
| 每 root 叶 | 8 |

- 所有当前 root legal action 都进入首层，保持 legal/outcome 对齐。
- 后续按累计一级目标价值排序；同值时优先正式 projection 中可见的正分探测器上界，再按剩余
  资源和稳定 identity 决胜。探测器上界只用于 beam，不进入最终 V。
- 资源不足且当前/后续 legal set 无法执行的 action 自然不会被 registry 枚举；不手写规则副本。
- 快速转换的不同排列通过完整状态等价键去重；不得仅靠深度或 leaf cap 冒充去重。
- 被 node/beam/leaf budget 截断的 root 标为 low-confidence/unresolved，不把半条路线伪装成完整叶。
- 本轮按 owner 要求先使用 `2000ms` 单决策记录目标跑完整策略结果，不通过收紧 node cap 换时延；
  报告记录实际最大值，仅以 `10000ms` 防止实验失控。

## 旧口径删除账

- 删除“15 个真实 Decision”的产品口径。
- 删除“一级目标是路线终点/取得即停止”的设计。
- 删除“当前只搜索一个 Action + 必选 Decision 闭包”的产品口径。
- 不恢复任何旧式回调命名、旧 candidate/selector/pending automation 或
  Browser 旁路。

## 可证伪行为义务

1. 路线在中途取得分数后仍能继续，并以 15 代理内累计分更高的叶胜出。
2. 同样的分数增量在第 1 轮和第 4 轮价值相同。
3. 同样的科技或收入增量在第 1 轮价值高于第 4 轮。
4. 一条路线先取得科技/收入再跨轮时，只按实际取得轮号计算其剩余窗口。
5. `launch -> move* -> orbit/land -> 后续代理` 可跨 focal 的多个真实行动机会展开。
6. 第 15 个 focal 代理完整结算后形成叶；第 16 个不得执行。
7. focal PASS 必做选择完整结算后形成叶，不观察随后新轮轮初收入。
8. 对手节点使用冻结 rollout，且每步 actor/decision owner 与真实 Composition 一致。
9. conditional choice 不计 focal 代理深度，但每个非等价 focal choice 保留独立搜索分支。
10. action 枚举顺序翻转不改变选择；搜索前后 canonical state/RNG/session/journal/history/replay
    bytes 完全一致。

## 验证顺序

1. 叶价值：分数恒值、科技/收入逐轮下降、跨轮取得时间。
2. 小型 Composition fixture：中途得分不终止、15/16 边界、focal PASS、真实对手 owner。
3. 固定首 Decision benchmark，所有样本 `<2000ms`。
4. 全量 Node unit + 唯一 full-flow。
5. 固定盘面完整局和 HTML 行动报告，与历史约 47 分的正常机器人局比较行动结构和得分。
6. 真实 Chrome smoke；环境没有 Browser runtime 时明确记录，不能用 Node 替代。
