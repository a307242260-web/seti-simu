# 搜索节点正式输入来源分类（2026-09-07，冻结设计）

目的：修复 `family:target.kind` 把合法条件选择记成 `<none>` 的统计缺陷，
区分共享免费移动流程的公司能力与卡牌效果来源，为移动需求优化提供真实分布。
本项不是节点剪枝或性能收益，不改变第一 Goal 的验收范围。

| 边界 | 唯一来源与实现 | 证据 |
|---|---|---|
| 物理节点 | executeNode 正式提交前、从当前合法集找回 raw action 后捕获；仅统计节点首个输入，不把折叠输入加为节点 | 总节点、正式输入与旧版本一致 |
| 普通输入 | 非 conditional 按正式 action.phase 与 family 分类，无 Decision 是协议规定而非缺失 | 主行动启动支付后仍记主行动，不误记后继支付 |
| 条件输入 | inspect.session.decision.decisionKind 与 currentEffect.type；两者必须为非空字符串 | 缺必需上下文显式 COUNTERFACTUAL_INPUT_CONTEXT_INVALID，不写默认分类 |
| 流程细分 | 仅附加当前 Effect payload 中存在的 step、kind、abilityId、cardEffect.type、decisionContext.kind 字符串 | 同 choose_target 的公司 free_move 与 CARD_MOVE 能区分，不读取 successor Effect |
| 数据边界 | 不复制完整 payload，不包含卡实例/牌名/Effect实例/资源/坐标，不进入状态、观察、Policy、计划或 hash | 原状态、RNG、完整计划、正式重放及终局相同 |
| 失败 | 分类错误走既有显式失败诊断；真实失败计数不清空、不改名 | failedNodeCountByCode 必须为空，未分类必需项不容错 |
| 消费者 | 原 executedNodeCountByDecisionKind 与目标交叉统计使用相同新 key；保留旧记录原义，不重写历史 | collector 原样保留分类；全局统计加总等于成功物理节点 |

key 为 `family:phase`，conditional 再附 `/decision=…/effect=…` 和上述具名字段。
这些细分字段不是所有 Effect 的必需字段，缺省时不输出该维度；不能以它们缺省
判为规则失败。通用 Decision/Effect 来源仍完整。目标未绑定与输入来源分类是不同
问题，不把 `<unbound>` 改名冒充需求式目标已经接入。

搜索状态等价、去重、目标可达性与资源下界、4096 节点/原时间和 beam 预算、
动作顺序和叶排序全部不变。先支付行为 unit、真实42单决策（30秒门槛）、完整
计划重放与非分类诊断对照；再中文提交，标准入口唯一固定全局，对照所有动作、
终局状态、非分类非时间诊断与均分，最后登记报告。原两个既有断言失败单列。

## 单决策与回归验收

真实42：4096节点、4804正式输入、15.137秒、零失败，30输入计划重放通过。
新分类寰宇 free_move 为2950节点；所有分类加总4096，无未分类key。
根动作、完整计划、重放输入、全部非分类/非耗时诊断与1585d689基线相同；
maxMilliseconds仍参加相等比较。最初对照脚本只排除总耗时，误把分项计时也作
相等断言；保留该失败证据，v2显式列出8个实测耗时字段后通过，没有重跑AI。
证据：input-classification-decision-42-20260907.json、
input-classification-parity-42-v2-20260907.json。

支付行为unit覆盖无target.kind及主行动/后继Decision区分；Node unit78/80、
full-flow1/1，仅旧no-beam与分析目标释放两个已知断言失败；V输入审计通过。
完整局尚待新提交唯一运行，不能据单点声称全盘分类完整或性能目标通过。
