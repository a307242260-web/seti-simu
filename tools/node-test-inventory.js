"use strict";

function entry(file, owner, obligation, counterexample) {
  return Object.freeze({ file, owner, obligation, counterexample });
}

module.exports = Object.freeze({
  schemaVersion: "seti-node-test-inventory-v2",
  unit: Object.freeze([
    entry("randomizer/app/rule-composition.test.js", "architecture/rule-composition", "组合层独占 registry、session 与原子提交", "handler 或 renderer 失败污染 committed state"),
    entry("randomizer/app/conditional-decision-domain.test.js", "architecture/standard-action", "条件选择统一映射为有 owner/version 的 Standard Action", "stale、错 owner 或未知选择进入领域 handler"),
    entry("randomizer/app/card-runtime.test.js", "architecture/effect-session", "卡牌移动点先投影到 badge 再打开 Session DecisionEffect", "提前 return 导致 badge 未初始化或旧 match continuation 复活"),
    entry("randomizer/training/simulation-standard-action-composition.test.js", "architecture/standard-action", "生产 composition 唯一注册 22 family 并正式执行", "synthetic registry 掩盖漏注册、错误 phase 或 stale 重放"),

    entry("randomizer/game/effects/session-runtime.test.js", "architecture/effect-session", "Effect Session 独占 working copy、队列、Decision 与提交", "多选自动代选、失败 effect 入 journal 或脏提交"),
    entry("randomizer/game/effects/session-journal.test.js", "architecture/effect-session", "session journal 可重放且 barrier/undo 语义稳定", "barrier 后伪回滚或失败步骤进入 journal"),
    entry("randomizer/game/effects/state-store-session.test.js", "architecture/effect-session", "Session 只经 StateStore CAS 原子提交", "并发 working copy 覆盖新版本 committed state"),
    entry("randomizer/game/effects/standard-action-session.test.js", "architecture/effect-session", "Standard Action 领域只经统一 Session/Decision 入口", "conditional choice 绕过 owner/version 校验"),
    entry("randomizer/game/effects/quick-action-session.test.js", "architecture/effect-session", "快速行动 continuation 由 Session 串行推进", "快速行动失败后遗留 working mutation"),
    entry("randomizer/game/effects/research-tech-session.test.js", "architecture/effect-session", "科技选择与蓝槽选择共享一个 Decision owner", "旧科技选择在新 decisionVersion 执行"),
    entry("randomizer/game/effects/scan-card-session.test.js", "architecture/effect-session", "扫描卡牌链通过 Effect Session 有序提交", "扫描多选被静默取首项"),
    entry("randomizer/game/effects/industry-alien-session.test.js", "architecture/effect-session", "公司与外星人 continuation 共用 session journal", "机会队列或 followup 绕过 session owner"),

    entry("randomizer/game/state/state-store.test.js", "architecture/state-store", "StateStore 快照隔离、版本单调与 CAS", "修改只读快照或旧版本提交污染权威状态"),
    entry("randomizer/game/state/host-source.test.js", "architecture/state-store", "Host 只读取冻结的权威投影", "宿主通过 projection 引用回写 committed state"),
    entry("randomizer/game/state/deterministic-sequences.test.js", "architecture/state-store", "序列号随 checkpoint 确定性恢复", "恢复后实体 identity 漂移或重复"),
    entry("randomizer/game/state/high-coupling-slices.test.js", "architecture/state-store", "高耦合 slices 以单一 root 原位水合", "restore 替换 root identity 或漏掉耦合 slice"),
    entry("randomizer/game/state/low-coupling-slices.test.js", "architecture/state-store", "低耦合 slices 按 schema 克隆与恢复", "未知 slice 被猜测接受或共享可写引用"),

    entry("randomizer/app/browser-host/browser-host.test.js", "architecture/browser-host", "Browser Host 只接收 projection 与正式 input port", "renderer 或 ViewState 改写规则状态"),
    entry("randomizer/app/browser-host/browser-services.test.js", "architecture/browser-host", "保存恢复只接受 composition 当前 schema", "旧、损坏或缺 version 包被部分应用"),
    entry("randomizer/app/browser-host/action-bar.test.js", "architecture/browser-host", "Action Bar 只呈现 legal descriptor 并提交 intent", "disabled/未知按钮仍触发规则提交"),
    entry("randomizer/app/browser-host/decision-ui.test.js", "architecture/browser-host", "通用 Decision UI 保留 owner 与 decisionVersion", "过期 DOM choice 被重新解释执行"),
    entry("randomizer/app/browser-host/card-decision-ui.test.js", "architecture/browser-host", "卡牌 Decision 仅投影公开 choice 并原样提交", "隐藏卡或非候选 cardId 进入提交"),
    entry("randomizer/app/browser-host/industry-alien-decision-ui.test.js", "architecture/browser-host", "公司/外星选择经 presentation registry 映射", "未知领域 choice 回退到旧 pending handler"),
    entry("randomizer/app/browser-host/player-stats-ui.test.js", "architecture/browser-host", "常驻玩家统计只读 projection", "渲染 normalize 反向修改玩家规则数据"),
    entry("randomizer/app/browser-host/policy-input-adapter.test.js", "architecture/browser-host", "人类与 Policy 共用正式 Action/Decision 输入", "非法 Policy actionId 仍调用 submit"),
    entry("randomizer/app/browser-host/resident-renderer.test.js", "architecture/browser-host", "resident renderer 单向消费冻结 selector", "renderer 异常撤销或污染规则提交"),
    entry("randomizer/app/events.test.js", "architecture/browser-host", "DOM dataset 只路由到 Standard intent/显式 input callback", "disabled、未知 dataset 或旧 pending getter 驱动规则"),
    entry("randomizer/app/game-recovery.test.js", "architecture/browser-host", "Browser recovery 包 round-trip 且瞬态 UI 不入权威状态", "损坏 schema 或 UI 临时态覆盖 composition"),

    entry("randomizer/app/simulation-host-contract.test.js", "architecture/simulation-host", "Simulation reset/observe/legalActions/step/reward/terminal/dispose 公共契约", "schema、stale、越权、篡改、terminal/dispose 后调用产生提交"),
    entry("randomizer/app/simulation-decision-owner.test.js", "architecture/simulation-host", "Simulation Decision owner 与合法集一致", "非 owner 观察或提交隐藏 choice"),
    entry("randomizer/app/simulation-effect-session-worker-recovery.test.js", "architecture/simulation-host", "worker 恢复 active Session 与 journal", "恢复只还原 committed state 而丢失 continuation"),
    entry("randomizer/app/simulation-no-browser-globals.test.js", "architecture/simulation-host", "rules-only Simulation 不依赖 DOM/Window", "训练入口加载浏览器全局或 app composition"),
    entry("randomizer/app/simulation-state-checkpoint.test.js", "architecture/simulation-host", "checkpoint 当前 schema round-trip 保持 action identity", "未知 schema 或非零版本恢复后 legal set 漂移"),
    entry("randomizer/app/simulation-counterfactual-outcome.test.js", "architecture/policy-host", "每个 legal action 从同根隔离 fork 经标准链生成 outcome", "枚举顺序、失败 fork 或 RNG 消耗污染 canonical root"),
    entry("randomizer/app/simulation-training-replay.test.js", "architecture/simulation-host", "训练 replay 逐步复现 observation/action/reward", "stale 或篡改 replay 被静默接受"),
    entry("randomizer/training/simulation-rule-composition.test.js", "architecture/simulation-host", "生产 rules-only composition 经正式 Decision 提交", "直接 helper 调用绕过 composition working root"),

    entry("randomizer/game/ai/policy-port.test.js", "architecture/policy-host", "Policy Port schema、取消、超时与迟到响应零副作用", "重复、迟到或未知 actionId 被宿主提交"),
    entry("randomizer/game/ai/machine-player-host.test.js", "architecture/policy-host", "Machine Player Host 独占代次、取消和合法性门禁", "旧 generation 响应推进当前回合"),
    entry("randomizer/app/ai/browser-machine-player.test.js", "architecture/policy-host", "Browser 机器席位通过 PolicyInputAdapter 装配", "浏览器 AI 绕过公共 input port 直接执行规则"),
    entry("randomizer/game/ai/heuristic-policy.test.js", "policy/heuristic-policy", "启发式策略确定性选择且只返回 legal actionId", "空集、畸形配置、未知或 disabled action 未 fail-closed"),
    entry("randomizer/game/ai/heuristic-evaluator.test.js", "policy/heuristic-evaluator", "估值稳定排序且不修改 observation/descriptors", "tie-break 漂移、条件选择漏惩罚或输入被改写"),

    entry("randomizer/game/actions/standard-action.test.js", "rules/actions", "Standard Action registry 的 identity、phase、validate/execute 协议", "未知、stale、越权 descriptor 到达 handler"),
    entry("randomizer/game/actions/actions.test.js", "rules/actions", "发射、环绕、登陆、科技生产规则的合法性与提交", "资源不足或非法目标仍修改规则状态"),
    entry("randomizer/game/actions/quick-trades.test.js", "rules/actions", "快速交易成本、次数与资源变更", "不足资源、重复交易或未知交易成功"),
    entry("randomizer/game/players.test.js", "rules/actions", "玩家资源/收入/支付不变量", "负资源、越界收入或失败支付部分写入"),
    entry("randomizer/game/rockets.test.js", "rules/actions", "火箭创建、占位与 owner 规则", "未知 owner 或重复占位被接受"),
    entry("randomizer/game/rockets.move.test.js", "rules/actions", "火箭移动边界、方向和移动点", "越界或不可达移动仍提交坐标"),
    entry("randomizer/game/planet-stats.test.js", "rules/actions", "星球轨道/登陆统计按权威占位计算", "重复 marker 或错误 owner 计分"),
    entry("randomizer/solar-system/core.test.js", "rules/actions", "太阳系旋转、坐标和轨道投影确定", "旋转后坐标漂移或输入被原位修改"),

    entry("randomizer/game/cards/deck.test.js", "rules/cards", "牌库抽取、弃牌、补充与实例 identity", "同一实体复活、重复抽取或空堆猜测"),
    entry("randomizer/game/cards/effects.test.js", "rules/cards", "卡牌效果解析为显式规则结果", "未知效果 fallback 或失败效果部分写入"),
    entry("randomizer/game/cards/task-state.test.js", "rules/cards", "任务状态转换与完成门禁", "未达条件任务被确认或重复领奖"),

    entry("randomizer/game/data/data.test.js", "rules/data", "数据获得、放置、分析与容量不变量", "满容量、未知目标或重复放置成功"),
    entry("randomizer/game/data/nebula.test.js", "rules/data", "星云数据槽与奖励结算", "非法槽位或重复奖励被接受"),

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
    entry("randomizer/game/history/action-history.test.js", "rules/scoring", "规则行动 history 的 commit/undo 边界", "barrier 后撤销或失败行动入历史"),
    entry("randomizer/game/history/commands.test.js", "rules/scoring", "history command 正反向应用保持不变量", "undo/redo 非互逆或作用于错误实体"),
  ]),
  fullFlow: Object.freeze([
    entry("randomizer/full-flow/standard-flow.test.js", "full-flow/standard-flow-v1", "唯一固定流程经生产 composition 公共 Action/Decision 到版本化权威盘面", "直接 helper、第二条完整流程入口、未清 session 或 replay 不一致"),
  ]),
});
