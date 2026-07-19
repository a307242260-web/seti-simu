# SETI-78 公司与八种外星人 Decision 迁移 Proof Obligations

## 边界与矩阵

本阶段只新增公司/外星人领域的标准 Decision/Effect Session adapter、只读 presentation renderer 与浏览器装配。旧 `industry-runtime`、`alien-ui`、`species-runtime` 仍是未切换整页宿主的兼容实现；新热路径不得调用它们的 pending resolver、dialog continuation 或规则 mutation。

| 域 | 真实多选 Decision | 标准 family | presentation | Effect Session 责任 |
| --- | --- | --- | --- | --- |
| 公司 | 公司 1x picker / 奖励槽 / 目标 | `choose_target` / `choose_reward` | `industry` | 标记、picker、奖励顺序、history/rollback |
| 通用痕迹 | 正面槽 / 公共额外位 | `choose_target` | `alien-trace` | 放置、奖励、物种 followup |
| 九折 | 可打牌 / 放弃机会 | `choose_card` | `alien-card` | 机会队列逐项消费 |
| 异常点 | 展示牌 / 盲抽 / 取消 | `choose_card` | `alien-card` | 新信息 barrier、角标 followup |
| 半人马 | 顶部奖励位 / 条件牌 | `choose_reward` | `alien-opportunity` | 达分机会与后续牌获取 |
| 方舟 | 面板放置 / 解锁 card2 | `choose_branch` | `alien-branch` | 分支、基础/高级奖励顺序 |
| 虫族 | 化石 / 搬运任务完成 | `choose_reward` | `alien-task` | 任务 owner、化石奖励 followup |
| 阿米巴 | symbol / 痕迹移除目标 | `choose_branch` / `choose_target` | `alien-branch` | symbol 顺序与确定性移动 |
| 奥陌陌 | 展示牌 / 盲抽 / 取消 | `choose_card` | `alien-card` | 牌获取与化石/扫描 followup |
| 符文族 | symbol 分支 / 黑圈放置 | `choose_branch` / `choose_target` | `alien-branch` | symbol 奖励与放置顺序 |

## 可证伪义务

| ID | 验收条款 | 可证伪命题与最小反例 | 实现落点 | 验证证据 | 失败语义 |
| --- | --- | --- | --- | --- | --- |
| IA-01 schema | 公司 picker、痕迹、机会、牌、任务、分支用标准 Decision 表达 | 任一 choice 缺 `seti-standard-action-v1` identity，或 owner/family 与 pending 不符 | `industry-alien-session.js` | schema/owner/family 负向测试 | `INDUSTRY_ALIEN_CHOICE_IDENTITY_INVALID`，session 回滚 |
| IA-02 全矩阵 | 公司与八物种逐项存在至少两个非等价可执行项 | 任一矩阵行只有静态 label、被自动取首项或不能执行 | session 行为矩阵测试 | 每行 `awaiting_input`、choices>=2、resolve、journal cursor +1 | 未注册 pending / 未迁移 kind fail-closed |
| IA-03 顺序 | 机会队列、痕迹奖励与 followup 由 session direct→trigger→deferred 顺序推进 | UI callback 抢跑，或第二机会覆盖第一机会 | domain followup normalization + session queue | 固定 trace 与 journal effects | 未知 followup kind/priority 中止并回滚 |
| IA-04 renderer | 领域 renderer 只消费 Decision projection，且六类 presentation exhaustive | renderer 读取 `pendingState`/规则模块，或已知 kind 落 generic | `industry-alien-decision-ui.js` | coverage assertion + 禁用符号扫描 | 缺 renderer 返回 `DECISION_UI_RENDERER_MISSING` |
| IA-05 旧 resolver=0 | 新热路径不得调用 industry/alien/species pending resolver 或 continuation | 多选时旧 AI/UI resolver 自动代选 | session/browser adapter composition | runtime spy + 源码禁用符号 | 任一 spy 调用使测试失败 |
| IA-06 stale/visibility/rebuild | 非 owner 看不到 choice；旧 version 不提交；相同 projection 清空 ViewState 后可等价重建 | 旁观者看到隐藏牌、stale 被重写重试、DOM state 成为规则源 | projection/view-state/input/renderer | Node + Chrome smoke | stale 原样返回并刷新 projection |
| IA-07 rollback/barrier | 未越屏障失败恢复 base；揭示/盲抽后拒绝伪回滚 | 决策后 effect 失败但资源残留，或新信息后回滚牌堆 | Effect Session journal | rollback 与 irreversible test | `aborted` / `irreversible_locked` |
| IA-08 browser assembly | 浏览器脚本顺序与 registry 装配包含领域模块 | Node 可 require 但真实页面缺全局模块 | `index.html`、`browser-host/index.js` | 真实 Chrome 公司/外星人 smoke | composition fail-fast |

## 反例优先

1. 注入未知 legacy pending 字段，必须报告 type/owner，不得调用兼容 resolver。
2. 构造 owner 为 `p2` 的多选机会，`p1` projection choices 必须为空。
3. 取得 Decision 后先推进 revision，再提交旧 identity，必须 stale 且零规则调用。
4. 决策后执行器失败，base state、journal confirmed decisions 与 committed state 均不得残留半步结果。
5. 已知六类 presentation 删除任一 renderer，exhaustive assertion 必须失败。

## 完成证据

- `node --check randomizer/app.js`
- `node tools/run_node_tests.js`
- `node randomizer/game/effects/industry-alien-session.test.js`
- `node randomizer/app/browser-host/industry-alien-decision-ui.test.js`
- 真实 Chrome：`randomizer/app/browser-host/industry-alien-decision-ui.browser-smoke.html`
- 结构扫描：新 session/renderer 对 `pendingState`、旧 resolver/dialog/continuation 引用为 0
