# SETI-100 Policy 硬切 Proof Obligations

| 验收条款 | 可证伪命题 / 最小反例 | 唯一责任点 | 验证证据 / 失败语义 |
|---|---|---|---|
| Policy 只消费公共输入 | 给定 `DecisionContext`，策略不得构造 legacy candidate、读取 resolver/executor/DOM 或调用旧 selector | `game/ai/heuristic-policy.js`、`heuristic-evaluator.js` | 禁用符号结构断言；Policy source/adapter poison；`PolicyDecision` 字段白名单 |
| 22 个 family 只选 legal set | 每个顶层/conditional family 给两个不同估值 descriptor，返回 id 必须属于且由传入集合决定 | `heuristic-evaluator.selectLegalAction` | `heuristic-policy.test.js` 遍历 `ALL_FAMILIES`；公共 validator 二次验证 |
| 未支持输入 fail-closed | 空集、未知 family、family/phase 错配或全部禁用不得取第一项、调 resolver 或单步 fallback | `heuristic-policy.assertContext` 与 evaluator 空结果 | `EMPTY_LEGAL_SET`、`UNSUPPORTED_FAMILY`、`DESCRIPTOR_INVALID`、`NO_ENABLED_ACTION` 精确断言 |
| app 不再调用旧 selector | action executor、初始/卡牌 pending、interaction pending 的生产源码不得出现旧两个 selector；执行仍要求完整 Standard Action descriptor | `app/ai/**` 与 Action runtime input port | 源码零引用；`STANDARD_ACTION_DESCRIPTOR_REQUIRED`；app controller integration 全量回归 |
| 旧 candidate pipeline 删除 | 旧 pipeline 文件和浏览器 script 不存在，策略不能注入 `buildCandidates` | evaluator typed descriptor 绑定与 `index.html` | 文件不存在、装配零引用、script-loading/dependencies 回归 |
| 行为与水平不漂移 | 固定 seed 的选择 trace、460 步、逐席分数、family 计数和 provenance 与冻结基线完全相同 | shared Heuristic Policy + training adapter | `heuristic-policy.seed-baseline.test.js` 精确 deepEqual；最低分门禁保留 |
| 同一版本覆盖所有宿主 | teacher、冻结 opponent、browser/headless 席位使用相同 Policy 实例身份和版本 | Browser/Headless Policy input adapter | shared-instance、browser integration、teacher/export、headless 完整局测试 |

状态矩阵：opening/turn 使用 15 个顶层 family；pending/conditional 使用 7 个 conditional family；terminal 空集由 Host 收口；未知 family/错误 phase 结构化拒绝。所有 Policy 响应均只返回 legal `actionId`，提交、freshness、Effect、journal/replay 仍归公共 Host/Input port。
