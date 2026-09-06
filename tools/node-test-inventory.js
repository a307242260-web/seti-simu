"use strict";

function entry(file, owner, obligation, counterexample) {
  return Object.freeze({ file, owner, obligation, counterexample });
}

module.exports = Object.freeze({
  schemaVersion: "seti-node-test-inventory-v2",
  unit: Object.freeze([
    entry("randomizer/game/ai/probe-source-binding.test.js", "policy/heuristic-policy", "探测来源保持、两阶段登陆与正式完成事件一致", "同终点换火箭、通用登陆入口漏选、已登陆却未完成、重复发射覆盖来源"),
    entry("randomizer/app/rule-composition.test.js", "architecture/rule-composition", "组合层独占 registry、session 与原子提交", "handler 或 renderer 失败污染 committed state"),
    entry("randomizer/app/host-architecture-audit.test.js", "architecture/host-source-zero", "Host 规则来源归零且 22 family/5 domain owner 完备", "第二 owner、直接 root 写、改名 bridge 或成功 fallback 重新进入 Host"),
    entry("randomizer/training/simulation-standard-action-composition.test.js", "architecture/standard-action", "生产 composition 唯一注册 22 family 并正式执行", "synthetic registry 掩盖漏注册、错误 phase 或 stale 重放"),

    entry("randomizer/game/effects/session-runtime.test.js", "architecture/effect-session", "Effect Session 独占 working copy、队列、Decision 与提交；单次观察枚举一次且消费者副本隔离", "多选自动代选、失败 effect 入 journal、脏提交、投影修改污染返回决策或观察隐藏枚举错误"),
    entry("randomizer/game/effects/session-journal.test.js", "architecture/effect-session", "session journal 可重放且 barrier/undo 语义稳定", "barrier 后伪回滚或失败步骤进入 journal"),
    entry("randomizer/game/effects/state-store-session.test.js", "architecture/effect-session", "Session 只经 StateStore CAS 原子提交", "并发 working copy 覆盖新版本 committed state"),
    entry("randomizer/game/effects/standard-action-session.test.js", "architecture/effect-session", "Standard Action 领域只经统一 Session/Decision 入口", "conditional choice 绕过 owner/version 校验"),
    entry("randomizer/game/effects/probe-turn-session.test.js", "architecture/effect-session", "探测器、PASS 与纯回合推进只编排正式规则和跨域 handoff", "公司、收入、外星人或卡牌语义在 probe_turn 内执行或越过 handoff 先推进回合"),
    entry("randomizer/game/effects/residual-domain-session.test.js", "architecture/effect-session", "公司、外星人、收入、卡牌触发与终局消费真实 handoff 并由统一 Session 提交；轮初数据收入生成各席真实token并遵守容量和编号", "effectType 错读、公司误耗主行动、收入仅加数字而无可放置数据、任务空结算或终局未写玩家正式结果"),

    entry("randomizer/game/state/state-store.test.js", "architecture/state-store", "StateStore 快照隔离、版本单调与 CAS", "修改只读快照或旧版本提交污染权威状态"),
    entry("randomizer/game/state/high-coupling-slices.test.js", "architecture/state-store", "高耦合 slices 以单一 root 原位水合", "restore 替换 root identity 或漏掉耦合 slice"),
    entry("randomizer/game/state/low-coupling-slices.test.js", "architecture/state-store", "低耦合 slices 按 schema 克隆与恢复", "未知 slice 被猜测接受或共享可写引用"),

    entry("randomizer/app/browser-host/browser-host.test.js", "architecture/browser-host", "Browser Host 只接收 projection 与正式 input port", "renderer 或 ViewState 改写规则状态"),
    entry("randomizer/app/browser-host/action-bar.test.js", "architecture/browser-host", "Action Bar 只呈现 legal descriptor 并提交 intent", "disabled/未知按钮仍触发规则提交"),
    entry("randomizer/app/browser-host/decision-ui.test.js", "architecture/browser-host", "通用 Decision UI 保留 owner 与 decisionVersion", "过期 DOM choice 被重新解释执行"),
    entry("randomizer/app/browser-host/resident-renderer.test.js", "architecture/browser-host", "resident renderer 单向消费冻结 selector", "renderer 异常撤销或污染规则提交"),
    entry("randomizer/app/public-api.test.js", "architecture/browser-host", "SetiRandomizer 只暴露 viewer-safe inspect/save/restore 与标准输入", "旧 Browser 规则 executor 或可写 projection 重新进入 public facade"),
    entry("randomizer/app/game-recovery.test.js", "architecture/browser-host", "Browser recovery 包 round-trip 且瞬态 UI 不入权威状态", "损坏 schema 或 UI 临时态覆盖 composition"),

    entry("randomizer/app/simulation-host-contract.test.js", "architecture/simulation-host", "Simulation reset/observe/legalActions/step/reward/terminal/dispose 公共契约", "schema、stale、越权、篡改、terminal/dispose 后调用产生提交"),
    entry("randomizer/app/simulation-decision-owner.test.js", "architecture/simulation-host", "Simulation Decision owner 与合法集一致", "非 owner 观察或提交隐藏 choice"),
    entry("randomizer/app/simulation-effect-session-worker-recovery.test.js", "architecture/simulation-host", "worker 恢复 active Session 与 journal", "恢复只还原 committed state 而丢失 active Decision 链"),
    entry("randomizer/app/simulation-no-browser-globals.test.js", "architecture/simulation-host", "rules-only Simulation 不依赖 DOM/Window", "训练入口加载浏览器全局或 app composition"),
    entry("randomizer/app/simulation-state-checkpoint.test.js", "architecture/simulation-host", "checkpoint 当前 schema round-trip 保持 action identity", "未知 schema 或非零版本恢复后 legal set 漂移"),
    entry("randomizer/app/simulation-counterfactual-outcome.test.js", "architecture/policy-host", "真实决策（runHeuristicPolicyDecision）actionOutcomes 覆盖全部合法 action 且已结算/显式原因，叶 projection 与直接标准执行一致", "actionOutcomes 静默占位、与合法集不对齐或失败 fork 污染 canonical root"),
    entry("randomizer/app/simulation-training-replay.test.js", "architecture/simulation-host", "训练 replay 逐步复现 observation/action/reward", "stale 或篡改 replay 被静默接受"),
    entry("randomizer/training/simulation-rule-composition.test.js", "architecture/simulation-host", "生产 rules-only composition 经正式 Decision 提交", "直接 helper 调用绕过 composition working root"),
    entry("randomizer/training/trajectory-recorder.test.js", "training/trajectory", "录制器按 seti-self-play-log-v1 产出逐步记录与 episode 汇总且可截断对齐", "步骤缺 actor/action/reward/legalMask、汇总缺 players 或汇总后仍被改写仍被接受"),
    entry("randomizer/training/self-play-demo.test.js", "training/trajectory", "人类示范日志按 self-play 更新口径灌入 action-kind agent 并去重", "机器席位混入默认示范、错误终局分 target 或同一 demo 重复灌入"),
    entry("randomizer/app/browser-host/trajectory-recording.test.js", "architecture/browser-host", "Browser 轨迹录制只读 projection 与标准输入链，撤销后与确认 replay 对齐", "录制改写规则状态、失败提交入轨迹或 undo 后轨迹与已确认输入不一致"),

    entry("randomizer/game/ai/policy-port.test.js", "architecture/policy-host", "Policy Port schema、取消、超时与迟到响应零副作用", "重复、迟到或未知 actionId 被宿主提交"),
    entry("randomizer/game/ai/outcome-projection.test.js", "architecture/policy-host", "标准结果投影保留逐步证据与元数据，重建观察且不污染来源", "复制优化丢字段、复用可变输入、冻结调用者对象或共享事实被外部改写"),
    entry("randomizer/app/ai/browser-machine-player.test.js", "architecture/policy-host", "Browser 机器席位经同一协调器装配（协调器读边界/决策函数注册/execute 提交/失败转 fail 结果）", "浏览器 AI 绕过公共 input port 直接执行规则或残留内联搜索拷贝"),
    entry("randomizer/game/ai/heuristic-policy.test.js", "policy/heuristic-policy", "启发式策略确定性选择且只返回 legal actionId", "空集、畸形配置、未知或 disabled action 未 fail-closed"),
    entry("randomizer/game/ai/strategic-goal-evaluator.test.js", "policy/heuristic-policy", "战略目标只读取标准叶已兑现的分数、科技和收入变化", "资源库存或未兑现的未来路线冒充目标收益"),
    entry("randomizer/game/ai/heuristic-evaluator.test.js", "policy/heuristic-evaluator", "估值稳定排序且不修改 observation/descriptors", "tie-break 漂移、条件选择漏惩罚或输入被改写"),
    entry("randomizer/game/ai/terminal-value.test.js", "policy/heuristic-evaluator", "终局正式分唯一决定叶价值、V、搜索优先级和计划优胜路径", "宣传门槛、资源库存或未来收益使低正式分终局叶胜出"),
    entry("randomizer/game/ai/score-corner-target.test.js", "policy/heuristic-evaluator", "正式得分角标按实例准入并完成，非得分角标不无条件放行", "得分角标在PASS前被漏评或其他实例离手误判完成"),
    entry("randomizer/game/ai/resource-value.test.js", "policy/heuristic-evaluator", "Policy、标准叶、轻量事实与V共用资源单价和真实未来收入窗口", "钱电单价颠倒、折价方向反转、末轮虚构收入或非钱电被错误折价"),
    entry("randomizer/game/ai/research-potential.test.js", "policy/heuristic-evaluator", "宣传预期绑定正式科技与费用；蓝科技未来奖励只计一次，标准叶/事实/V同源", "蓝科技额外叠旧固定轮次价值、研究后重复计宣传预期或标准叶与搜索事实不一致"),
    entry("randomizer/game/ai/blue-bonus-value.test.js", "policy/heuristic-evaluator", "蓝槽来源只作归因；同库存同牌面的V与叶估值不因来源改变", "分析清空丢来源、其他收入复活来源、来源资源支付被额外扣分或蓝3牌面估值被排除"),
    entry("randomizer/game/effects/search-root-attribution.test.js", "architecture/effect-session", "共享状态收益归属每个根；目标无后继或完成后继续搜索触顶仍保留实际结果", "后到根或已完成目标收益被后续截断抹掉，或未完成目标虚增收益"),
    entry("randomizer/game/effects/search-payment-choices.test.js", "architecture/effect-session", "不同费用结果分别执行；支付未完成不能成叶，根状态不变", "固定选首项丢路线，或未结算费用的状态冒充完成目标"),
    entry("randomizer/game/effects/search-budget.test.js", "architecture/effect-session", "全局队列容量、根覆盖、共享来源与完整性；超时不提交真实根；尝试/失败/提交计数守恒", "逐根叶计数或摘要支配吞结果、换序改变覆盖、超时返回部分策略或漏记失败尝试"),
    entry("tools/research-search-statistics.test.js", "training/research-statistics", "逐次搜索记录与续跑只累计真实evaluate，区别满额和剩余队列截断", "计划复用重复计数、旧快速记录缺统计被冒充完整或续跑丢前缀"),
    entry("randomizer/game/ai/conditional-resolution.test.js", "policy/heuristic-evaluator", "同收益条件决策选择较少实际提交，正式收益与终局排序优先", "折叠隐藏执行长度使点选与取消同分循环，或长度奖励压过正式分"),
    entry("randomizer/game/ai/machine-player-coordinator.test.js", "policy/machine-player-coordinator", "共享协调器逐步复用：同回合/跨回合检查揭示与依赖，解析后的 seat 持有计划，成功提交才消费", "同回合只检查合法性漏掉新信息、旧证据继续执行、失败提交消费计划或缓存跨 owner"),
    entry("randomizer/game/ai/plan-continuation.test.js", "policy/plan-continuation", "逐步动作证据与具名复合依赖：目标切换同步推进基线、预期自身推进可复用、正式外星槽输入与缺失事实失效；只读诊断可复算", "整叶根依赖残留到后续目标、缺失事实被当成未变化、无关扇区触发失效、外星槽编号或痕迹层级读错"),
    entry("randomizer/training/heuristic-policy-turn-report.test.js", "policy/heuristic-policy", "固定盘面报告保留根行动、目标路线与剪枝漏斗", "报告只展示赢家和前三备选而无法解释节点内部搜索"),

    entry("randomizer/game/actions/standard-action.test.js", "rules/actions", "Standard Action registry 的 identity、phase、validate/execute 协议", "未知、stale、越权 descriptor 到达 handler"),
    entry("randomizer/game/initial-setup.test.js", "rules/actions", "初始选择结算：任务中继站开局确认后立即在终局 c 板块 3 号位放置标记", "非任务中继站公司误放终局 c 板块标记或槽位/顺序错误"),
    entry("randomizer/game/actions/actions.test.js", "rules/actions", "发射、环绕、登陆、科技生产规则的合法性与提交（统一能力层引擎 launchProbe/orbitProbe/landProbe）", "资源不足或非法目标仍修改规则状态"),
    entry("randomizer/game/actions/quick-trades.test.js", "rules/actions", "快速交易成本、次数与资源变更", "不足资源、重复交易或未知交易成功"),
    entry("randomizer/game/players.test.js", "rules/actions", "玩家资源/收入/支付不变量", "负资源、越界收入或失败支付部分写入"),
    entry("randomizer/game/rockets.test.js", "rules/actions", "火箭创建、占位与 owner 规则", "未知 owner 或重复占位被接受"),
    entry("randomizer/game/rockets.move.test.js", "rules/actions", "火箭移动边界、方向和移动点", "越界或不可达移动仍提交坐标"),
    entry("randomizer/game/planet-stats.test.js", "rules/actions", "星球轨道/登陆统计按权威占位计算", "重复 marker 或错误 owner 计分"),
    entry("randomizer/solar-system/core.test.js", "rules/actions", "太阳系旋转、坐标和轨道投影确定", "旋转后坐标漂移或输入被原位修改"),

    entry("randomizer/game/cards/deck.test.js", "rules/cards", "牌库抽取、弃牌、补充与实例 identity", "同一实体复活、重复抽取或空堆猜测"),
    entry("randomizer/game/cards/effects.test.js", "rules/cards", "卡牌效果解析为显式规则结果", "未知效果 fallback 或失败效果部分写入"),
    entry("randomizer/game/cards/play-domain.test.js", "rules/cards", "打牌事务、跨域能力与 Decision 共享同一 game owner", "Browser 写错根、Simulation 简化重写或未覆盖效果部分扣费"),
    entry("randomizer/game/cards/task-state.test.js", "rules/cards", "任务状态转换与完成门禁", "未达条件任务被确认或重复领奖"),

    entry("randomizer/game/data/data.test.js", "rules/data", "数据获得、放置、分析与容量不变量", "满容量、未知目标或重复放置成功"),
    entry("randomizer/game/data/nebula.test.js", "rules/data", "星云数据槽与奖励结算", "非法槽位或重复奖励被接受"),
    entry("randomizer/game/effects/science-scan-flow.test.js", "rules/data", "扫描串尾统一结算；四种蓝槽正式奖励、来源恢复与不同完成路线保留", "重复/漏扇区结算、蓝槽来源未入账、普通科技精选误归蓝槽、恢复丢来源或评分摘要吞掉不同盘面"),

    entry("randomizer/game/tech/tech.test.js", "rules/tech", "科技供应、取得、蓝槽与 owner 规则", "被占/被封锁科技仍取得"),
    entry("randomizer/game/tech/bonuses.test.js", "rules/tech", "科技奖励按 tile/slot 唯一结算", "重复触发或错误颜色奖励"),

    entry("randomizer/game/aliens/amiba.test.js", "rules/aliens", "阿米巴物种奖励与机会规则", "未满足条件仍产生物种收益"),
    entry("randomizer/game/aliens/aomomo.test.js", "rules/aliens", "奥陌陌物种轨迹与奖励规则", "非法轨迹或重复奖励成功"),
    entry("randomizer/game/aliens/banrenma.test.js", "rules/aliens", "半人马物种机会与目标规则", "非 owner 或未知目标被接受"),
    entry("randomizer/game/aliens/chong.test.js", "rules/aliens", "虫族任务与化石选择规则", "未达任务或 stale 选择领奖"),
    entry("randomizer/game/aliens/fangzhou.test.js", "rules/aliens", "方舟物种奖励与位置规则", "非法位置或重复占位获得奖励"),
    entry("randomizer/game/aliens/jiuzhe.test.js", "rules/aliens", "九折物种机会队列与卡牌规则", "跳序、重复机会或未知卡牌执行"),
    entry("randomizer/game/aliens/runezu.test.js", "rules/aliens", "符文族 symbol 与分支规则", "未知 symbol 或已消费分支重放"),
    entry("randomizer/game/aliens/yichangdian.test.js", "rules/aliens", "异常点物种奖励与推进规则", "不足条件或重复推进成功"),
    entry("randomizer/game/aliens/reveal-card-grants.test.js", "rules/aliens", "外星揭示卡奖励按 owner 唯一发放", "非参与者或重复揭示获得奖励"),
    entry("randomizer/game/aliens/trace-placement-legality.test.js", "rules/aliens", "外星痕迹槽位、类型与 owner 合法性", "满槽、错类型或越权放置成功"),

    entry("randomizer/game/final-scoring.test.js", "rules/scoring", "终局计分板选择、占位与分数", "非法 tile、重复标记或错 owner 得分"),
    entry("randomizer/game/end-game-scoring.test.js", "rules/scoring", "终局总分只汇总正式分源", "重复分源、遗漏 owner 或结束前结算"),
  ]),
  fullFlow: Object.freeze([
    entry("randomizer/full-flow/standard-flow.test.js", "full-flow/standard-flow-v1", "唯一固定流程经生产 composition 公共 Action/Decision 到版本化权威盘面", "直接 helper、第二条完整流程入口、未清 session 或 replay 不一致"),
  ]),
});
