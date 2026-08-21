(function (root, factory) {
  "use strict";

  let outcomeModel = root.SetiOutcomeModel;
  let quickTrades = root.SetiQuickTrades;
  let cardEffects = root.SetiCardEffects;
  let alienState = root.SetiAlienState;
  if (typeof require === "function") {
    outcomeModel = outcomeModel || require("./outcome-model");
    quickTrades = quickTrades || require("../actions/quick-trades");
    cardEffects = cardEffects || require("../cards/effects");
    alienState = alienState || require("../aliens/state");
  }
  const api = factory(outcomeModel, quickTrades, cardEffects, alienState);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiExpectedScoreEvaluator = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (
  outcomeModel,
  quickTrades,
  cardEffects,
  alienState,
) {
  "use strict";

  const EVALUATION_MODEL = "strategic-goal-search-v3";
  const PARAMETER_VERSION = "seti-strategic-goal-search-v3";
  const OUTCOME_SCHEMA_VERSION = outcomeModel.OUTCOME_SCHEMA_VERSION;
  const SECONDARY_AGENT_ROLLOUT_VERSION = "secondary-agent-rollout-v17";
  const DATA_ANALYZE_ROUTE_TARGET = "data:analyze";
  const CONTROL_FAMILIES = Object.freeze(new Set(["end_turn", "pass"]));
  // 统一搜索：未绑定分支每层最多展开的未绑定后继数（预算内优先级截断，见
  // docs/project-progress/unified-search-design-20260817.md §3 项 9）。
  const MAX_UNIFIED_SUCCESSORS = 4;
  // 统一搜索的"需求放行"family：目的型动作——本身没有独立价值，价值来自
  // "满足当前需求"（quick_trade 补资源缺口 / card_corner 弃牌角标收益 /
  // industry 公司能力）。unified 下这些动作凭需求进搜索（requiresRootCounterfactual
  // 已按缺口过滤 quick_trade），叶价值由 quick 根截断限制为立即效果；其余未绑定
  // 动作保持目标绑定评估（不平铺进搜索树）。
  const UNIFIED_PURPOSE_FAMILIES = Object.freeze(new Set([
    "quick_trade", "card_corner", "industry",
  ]));
  // quick 根截断 family（405ee903 误删，2026-08-21 恢复）：根动作是 quick 时，
  // 其叶价值只算立即效果，不搭后续主行动的便车（见 selectSecondaryAgentSuccessors
  // 截断分支注释）。move 曾在此集合（v4 时代），现 move 有独立探测价值（move:xx
  // 目标绑定进 targeted），仅保留纯目的型动作。
  const QUICK_ROOT_FAMILIES = Object.freeze(new Set([
    "quick_trade", "card_corner", "industry", "place_data",
    "runezu_face_symbol", "complete_task",
  ]));
  // 树内 untargeted 枚举排除的手段动作（2026-08-21 用户裁定"无目标 quick_trade/
  // card_corner 非法"贯彻到搜索树内层）：这几类动作只有目标缺口时才做（经目标
  // 目录资源准备进 targeted），无目标时不该在每层枚举压队吃预算。
  // **place_data 不在此列**（2026-08-21 实证）：把它从 untargeted 排除后，主行动
  // （play_card 等）评估链里缺少"填数据拿资源"后继 → 评估漂移（步23 白色改选
  // launch、全盘 84.5→57 崩）。place_data 是合法主行动后继（数据溢出/缺口时
  // 填上拿资源，"溢出不浪费"），untargeted 枚举保留。
  const UNTARGETED_MEANS_ONLY_FAMILIES = Object.freeze(new Set([
    "quick_trade", "card_corner",
  ]));
  // 未绑定后继的立即价值排序：family 基础价值（探测/着陆等直接推进盘面 > 纯资源
  // 转换 > 卡角/公司） + 净资源收益（cost/gain）。仅用于搜索预算分配，不是最终
  // 叶评分（ai-design.md：任何中间 action/family 没有固定奖励）。
  const UNTARGETED_FAMILY_BASE = Object.freeze({
    launch: 8, orbit: 9, land: 9, move: 6, scan: 6, analyze: 6,
    research_tech: 7, play_card: 5, place_data: 6, industry: 3,
    quick_trade: 2, card_corner: 1, complete_task: 1,
  });
  function compareUntargetedSuccessor(left, right, branchObservation) {
    const base = (action) => Number(UNTARGETED_FAMILY_BASE[action?.family] || 0);
    const netResources = (action) => {
      const cost = action?.payload?.cost || {};
      const gain = action?.payload?.gain || {};
      return (
        (Number(gain.credits) || 0) - (Number(cost.credits) || 0)
        + (Number(gain.energy) || 0) - (Number(cost.energy) || 0)
        + (Number(gain.publicity) || 0) - (Number(cost.publicity) || 0)
      );
    };
    return (base(left) - base(right))
      || (netResources(left) - netResources(right));
  }
  const CONDITIONAL_FAMILIES = Object.freeze(new Set([
    "choose_card",
    "choose_target",
    "choose_payment",
    "choose_reward",
    "choose_branch",
    "choose_final_scoring",
    "accept_optional_effect",
  ]));
  const DEFAULT_PARAMETERS = Object.freeze({
    parameterVersion: PARAMETER_VERSION,
    searchDepth: 15,
  });
  const INCOME_UNIT_VALUES = Object.freeze({
    credits: 8,
    energy: 10,
    publicity: 0,
    availableData: 0,
    handSize: 0,
    additionalPublicScan: 0,
  });
  const TECH_UNIT_VALUES = Object.freeze({
    orange1: 0,
    orange2: 7,
    orange3: 5,
    orange4: 0,
    purple1: 0,
    purple2: 10,
    purple3: 0,
    purple4: 10,
    blue1: 10,
    blue2: 10,
    blue3: 5,
    blue4: 5,
  });
  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function mergeParameters(input = {}) {
    return deepFreeze({
      parameterVersion: String(input.parameterVersion || PARAMETER_VERSION),
      searchDepth: Math.max(1, Math.round(finite(input.searchDepth) || DEFAULT_PARAMETERS.searchDepth)),
      // V(state) 接入开关（v-state-design-20260817.md）：默认关（当前决策不变），
      // 打开后 V 增量参与叶排序，让打牌/放痕迹/收入/科技的长期价值可见。
      vStateValueEnabled: Boolean(input.vStateValueEnabled),
    });
  }

  // ---- value 形状统一构造（审查清理项 9）----
  // evaluateState（完整 outcomeProjection 源）与 valueFromStrategicFacts
  // （轻量 strategicFacts 源）产出同一 value 形状（resourceFacts/infrastructure），
  // 统一由 resourceFactsFrom/infrastructureFrom 组装。strategicFacts 源不投影
  // alienSlots（createStrategicFacts 无槽位级数据）——分支优先级（getBranchPriority
  // 热路径）因此不感知外星进度增量，与统一前一致。
  function resourceFactsFrom(parts = {}) {
    return {
      credits: finite(parts.credits),
      energy: finite(parts.energy),
      publicity: finite(parts.publicity),
      availableData: finite(parts.availableData),
      ordinaryCards: finite(parts.ordinaryCards),
      alienCards: finite(parts.alienCards),
    };
  }

  function infrastructureFrom(parts = {}) {
    return {
      ownedTechIds: [...(parts.ownedTechIds || [])].sort(),
      income: { ...(parts.income || {}) },
      roundNumber: Math.max(1, finite(parts.roundNumber) || 1),
      finalRoundNumber: Math.max(1, finite(parts.finalRoundNumber) || 4),
      traceCount: Math.max(0, finite(parts.traceCount) || 0),
      // 外星槽位级进度（V 同源）：{ slotId, revealed, ownFirstTraces, ownExtraMarks }
      alienSlots: (parts.alienSlots || []).map((slot) => ({
        slotId: slot?.slotId ?? null,
        revealed: Boolean(slot?.revealed),
        ownFirstTraces: Math.max(0, finite(slot?.ownFirstTraces)),
        ownExtraMarks: Math.max(0, finite(slot?.ownExtraMarks)),
      })),
      sectorWinRequirements: parts.sectorWinRequirements
        ? structuredClone(parts.sectorWinRequirements)
        : null,
      dataProgress: { ...(parts.dataProgress || {}) },
    };
  }

  function infrastructureOf(projection) {
    return infrastructureFrom({
      ownedTechIds: projection.progress?.ownedTechIds,
      income: projection.progress?.income,
      roundNumber: projection.progress?.roundNumber,
      finalRoundNumber: projection.progress?.finalRoundNumber,
      traceCount: projection.progress?.traceCount,
      alienSlots: projection.progress?.alienSlots,
      sectorWinRequirements: projection.progress?.sectorWinRequirements,
      dataProgress: projection.progress?.dataProgress,
    });
  }

  function evaluateState(observation, seatId) {
    if (observation?.schemaVersion !== outcomeModel.OBSERVATION_SCHEMA_VERSION
      || observation?.viewer?.seatId !== seatId
      || observation?.outcomeProjection?.schemaVersion !== outcomeModel.PROJECTION_SCHEMA_VERSION) {
      throw new TypeError("Value 只接受同 viewer 的标准 Decision observation/outcome projection");
    }
    const projection = observation.outcomeProjection;
    const terminal = projection.terminal;
    const realizedScore = terminal
      ? finite(projection.scoring.officialTerminalScore)
      : finite(projection.scoring.realizedScore);
    return deepFreeze({
      schemaVersion: outcomeModel.VALUE_SCHEMA_VERSION,
      evaluationModel: EVALUATION_MODEL,
      parameterVersion: PARAMETER_VERSION,
      terminal,
      realizedScore,
      securedEndGameBonus: terminal ? 0 : finite(projection.scoring.securedEndGameBonus),
      total: realizedScore,
      infrastructure: infrastructureOf(projection),
      resourceFacts: resourceFactsFrom({
        credits: projection.assets.credits,
        energy: projection.assets.energy,
        publicity: projection.assets.publicity,
        availableData: projection.assets.availableData,
        ordinaryCards: projection.assets.ordinaryCards,
        alienCards: projection.assets.alienCards,
      }),
      fieldPaths: {
        realizedScore: terminal
          ? "outcomeProjection.scoring.officialTerminalScore"
          : "outcomeProjection.scoring.realizedScore",
        infrastructure: "outcomeProjection.progress.{ownedTechIds,income,roundNumber}",
        securedEndGameBonus: "outcomeProjection.scoring.securedEndGameBonus",
        resources: outcomeModel.ASSET_PATHS,
      },
    });
  }

  function unavailable(outcome, code) {
    return deepFreeze({
      evaluationModel: EVALUATION_MODEL,
      score: null,
      selectable: false,
      priorityClass: -1,
      status: outcome?.status || "unresolved",
      confidence: outcome?.confidence || "none",
      reasonCodes: [code],
    });
  }

  // =====================================================================
  // V(state) 状态价值函数（v-state-design-20260817.md）
  // V(state) = 榨取类（分数 + 资源流动性）+ 准备类（收入复利 + 科技效率 +
  // 外星进度 + 手牌期望）。编码长线价值，让浅搜索（depth 4-6）就能看到
  // "打牌→科技/收入/登陆链" 的收益，替代"暴搜 15 步 + 线性外推"。
  // 权重全部校准自用户 405 档（v-state-design 第 3 节）。
  // =====================================================================
  const V_INCOME_MULTIPLIER = 1.4; // 收入复利放大（收入→更多行动→更多分）
  const V_TECH_EFFICIENCY_UNIT = 4; // 每个已研究科技每轮效率红利（橙/紫降价等）
  const V_TRACE_FIRST_VALUE = 5; // 首痕迹价值（slot1 5分+1宣、slot2 3分+1宣）
  const V_ALIEN_REVEAL_BONUS = 15; // 三色齐→揭示的期望（位置分+外星牌链）
  const V_ALIEN_SLOT_POSITION_VALUE = 3; // 揭示后每个位置期望分（3-5 分/位置）
  const V_DATA_UNIT_VALUE = 4; // 数据→填槽/分析转化价值
  const V_CARD_EFFECT_VALUE = 6; // 手牌可打效果期望（科技/收入/移动/登陆链）

  function evaluateStateValue(observation, seatId) {
    const projection = observation?.outcomeProjection;
    if (!projection || projection.schemaVersion !== outcomeModel.PROJECTION_SCHEMA_VERSION) {
      throw new TypeError("V 只接受同 viewer 的标准 outcome projection");
    }
    const terminal = Boolean(projection.terminal);
    const realizedScore = terminal
      ? finite(projection.scoring.officialTerminalScore)
      : finite(projection.scoring.realizedScore);
    const roundNumber = Math.max(1, finite(projection.progress?.roundNumber) || 1);
    const finalRoundNumber = Math.max(1, finite(projection.progress?.finalRoundNumber) || 4);
    const remainingPayments = Math.max(0, finalRoundNumber - roundNumber); // 回合开始发放
    const assets = projection.assets || {};
    const income = projection.progress?.income || {};

    const scoreValue = finite(realizedScore) + (terminal ? 0 : finite(projection.scoring.securedEndGameBonus));
    // 资源流动性（手段不是价值，2026-08-18 修复根因 1）：资源库存**不按固定单价
    // 计入 V**——花 1 钱 -8 会掩盖真实收益（launch/scan/打牌全负），让唯一"不花钱"
    // 的 quick_trade 霸榜（实测白色 86→14，29 次 quick_trade）。资源价值通过
    // "能解锁什么"间接体现（收入复利/科技效率/外星进度/即时分），V 只保留
    // 数据→填槽/分析的转化期望（手段中唯一有明确未来路径的），钱/能/宣传 0。
    const liquidValue = (
      finite(assets.availableData) * V_DATA_UNIT_VALUE * 0.5 // 数据→填槽/分析，折半（预期未必全转化）
    );

    // 准备类：收入复利（收入率 × 剩余发放次数 × 单位价值 × 放大系数）
    const incomeValue = (
      finite(income.credits) * INCOME_UNIT_VALUES.credits
      + finite(income.energy) * INCOME_UNIT_VALUES.energy
      + finite(income.availableData) * V_DATA_UNIT_VALUE
    ) * remainingPayments * V_INCOME_MULTIPLIER;

    // 准备类：科技效率红利（每个已研究科技 × 剩余轮次 × 单位效率）
    const ownedTechIds = projection.progress?.ownedTechIds || [];
    const techEfficiencyValue = ownedTechIds.length
      * Math.max(0, finalRoundNumber - roundNumber)
      * V_TECH_EFFICIENCY_UNIT;

    // 准备类：外星进度（首痕迹 + 揭示期望 + 位置期望）
    const alienSlots = projection.progress?.alienSlots || [];
    let alienValue = 0;
    for (const slot of alienSlots) {
      if (!slot) continue;
      // 已放置的我方首痕迹：即时分（slot1 5 / slot2 3，近似 5）
      alienValue += slot.ownFirstTraces * V_TRACE_FIRST_VALUE;
      if (slot.revealed) {
        // 已揭示：位置期望（3-5 分/位置 × 剩余轮次）
        alienValue += V_ALIEN_SLOT_POSITION_VALUE * Math.max(0, finalRoundNumber - roundNumber);
      } else if (slot.ownFirstTraces >= 2) {
        // 差 1 个首痕迹齐三色：揭示奖励期望
        alienValue += V_ALIEN_REVEAL_BONUS;
      } else if (slot.ownFirstTraces > 0) {
        alienValue += V_ALIEN_REVEAL_BONUS * 0.3; // 有首痕迹但远未齐：部分期望
      }
    }

    // 准备类：手牌/保留牌可打效果期望（2026-08-18 修复根因 2——卡价值与获取路径
    // 绑定）。手牌价值 = 可打效果链期望（按卡面效果估算），不是固定 +6/张：
    //   - 固定 +6/张 让"任何获得 1 张牌"都 +6（quick_trade 用 0 价值资源换卡 =
    //     纯赚 → 霸榜）；且不看卡质量（废牌和科技牌同价）。
    //   - 手牌价值应来自"能打出的效果"：免费科技（省 6 宣传）/收入牌（每轮资源）/
    //     移动登陆链/外星痕迹。用 effectValue 按卡面估算，按剩余轮次折半（未必
    //     每张都打出）。
    const selfState = observation?.selfState || {};
    const publicPlayers = observation?.publicState?.players || [];
    const selfPublic = publicPlayers.find((p) => (
      String(p.playerId || p.color || "") === String(seatId)
    ));
    const handCards = (selfState?.hand || selfPublic?.hand || []).filter(Boolean);
    const reservedCards = (selfState?.reservedCards || []).filter(Boolean);
    const handEffectValue = (cards) => cards.reduce((total, card) => {
      const effects = cardEffects?.buildPlayEffects?.(card) || [];
      let value = 0;
      for (const effect of effects) {
        const type = effect?.type;
        const options = effect?.options || {};
        if (type === cardEffects?.EFFECT_TYPES?.RESEARCH_TECH) {
          value += 30; // 免费科技（省 6 宣传 + 立即生效）
        } else if (
          type === cardEffects?.EFFECT_TYPES?.INCOME
          || type === cardEffects?.EFFECT_TYPES?.TUCK_PLAYED_CARD_TO_INCOME
        ) {
          value += 8 * Math.max(1, remainingPayments); // 收入牌每轮资源
        } else if (type === cardEffects?.REWARD_TYPES?.LAUNCH) {
          value += 6; // 免费发射（省发射费 + 探测起点）
        } else if (type === cardEffects?.EFFECT_TYPES?.CARD_LAND) {
          value += 8; // 免费登陆（登陆奖励 + 外星链）
        } else if (
          type === cardEffects?.EFFECT_TYPES?.CARD_MOVE
          || type === cardEffects?.EFFECT_TYPES?.FREE_MOVE
        ) {
          value += 3 * Math.max(1, finite(options?.movementPoints) || 1);
        } else if (type === cardEffects?.REWARD_TYPES?.ALIEN_TRACE) {
          value += 6; // 外星痕迹（分 + 外星人牌）
        } else if (type === cardEffects?.REWARD_TYPES?.GAIN_RESOURCES) {
          const gain = options?.resources || options?.gain || {};
          value += finite(gain.score);
          value += finite(gain.credits) * 2; // 资源→行动的转化（比固定单价低）
          value += finite(gain.energy) * 3;
        }
      }
      return total + value;
    }, 0);
    // 手牌全价值但折半（未必全打出）+ 保留牌更低（要花行动取回）
    const cardValue = (
      handEffectValue(handCards) * 0.5
      + handEffectValue(reservedCards) * 0.25
    );

    const total = scoreValue + liquidValue + incomeValue + techEfficiencyValue
      + alienValue + cardValue;
    return deepFreeze({
      schemaVersion: "seti-state-value-v1",
      evaluationModel: EVALUATION_MODEL,
      terminal,
      roundNumber,
      finalRoundNumber,
      remainingPayments,
      total,
      components: {
        scoreValue,
        liquidValue,
        incomeValue,
        techEfficiencyValue,
        alienValue,
        cardValue,
      },
    });
  }

  function positiveDelta(after, before) {
    return Math.max(0, finite(after) - finite(before));
  }

  function stableSerialize(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`,
    ).join(",")}}`;
  }

  function actionSemanticKey(action) {
    return stableSerialize({
      family: action?.family || null,
      target: action?.target || {},
      payload: action?.payload || {},
    });
  }

  // 共享缺口判定（审查清理项 7）：quick_trade 是否缩小探测目标缺口——入口门控
  // （requiresRootCounterfactual）与出口目的检查（quickTradePurpose）共用同一实现，
  // 避免同一判定写两遍（缺口口径变更时只需改一处）。
  function quickTradeReducesProbeGap(observation, action, seatId) {
    return (rawProbeRequirements(observation)?.candidates || [])
      .some((goal) => {
        const projected = probeResourceGapAfterTrade(observation, goal, action, seatId);
        return projected && projected.after < projected.before;
      });
  }

  function quickTradePurpose(context, action, leaf) {
    if (action?.family !== "quick_trade") return { required: false, supported: true };
    const nextAgent = (leaf?.secondaryAgentTrace || [])
      .find((candidate) => candidate?.family !== "quick_trade");
    if (!nextAgent) {
      return { required: true, supported: false, reason: "quick-trade-no-followup-agent" };
    }
    const nextKey = actionSemanticKey(nextAgent);
    const alreadyLegal = (context?.legalActions || [])
      .filter((candidate) => !["quick_trade", "pass", "end_turn"].includes(candidate?.family))
      .some((candidate) => actionSemanticKey(candidate) === nextKey);
    const directlyLegal = (leaf?.rootActionSettledLegalSuccessors || [])
      .some((candidate) => actionSemanticKey(candidate) === nextKey);
    const projection = context?.observation?.outcomeProjection;
    const preparesReadyAnalyze = Boolean(
      projection?.progress?.dataProgress?.analyzeReady
      && finite(projection?.assets?.energy) === 0
      && ["credits-for-energy", "cards-for-energy"].includes(action.target?.tradeId),
    );
    const preparesProbeGoal = quickTradeReducesProbeGap(
      context?.observation,
      action,
      context?.seatId,
    );
    const dataRequirements = rawDataAnalyzeRequirements(context?.observation);
    const dataNextFamilies = new Set([
      dataRequirements?.nextStep,
      ...(dataRequirements?.acquisitionPlans || [])
        .map((plan) => plan.nextStep?.family),
    ].filter(Boolean));
    const preparesDataGoal = dataAnalyzeEligible(dataRequirements)
      && dataNextFamilies.has(nextAgent?.family)
      && dataPaymentGapAfterTrade(
        context?.observation,
        action,
        context.seatId,
      )?.reduction > 0;
    return {
      required: true,
      supported: preparesReadyAnalyze
        || preparesProbeGoal
        || preparesDataGoal
        || (directlyLegal && !alreadyLegal),
      reason: preparesReadyAnalyze
        ? "quick-trade-prepared-ready-analyze"
        : preparesProbeGoal
          ? "quick-trade-reduced-probe-goal-gap"
          : preparesDataGoal
            ? "quick-trade-reduced-data-goal-gap"
            : directlyLegal && !alreadyLegal
              ? "quick-trade-directly-unlocked-agent"
              : "quick-trade-did-not-directly-unlock-agent",
      nextAgent,
    };
  }

  function cardCornerPurpose(context, action, leaf, rootValue, parameters) {
    if (action?.family !== "card_corner") return { required: false, supported: true };
    const immediateObservation = leaf?.rootActionObservation;
    if (!immediateObservation) {
      return { required: true, supported: false, reason: "card-corner-immediate-outcome-missing" };
    }
    const immediateStateValue = valueFromStrategicFacts(
      outcomeModel.createStrategicFacts(immediateObservation, context.seatId),
    );
    const immediateValue = leafValue(
      rootValue,
      immediateStateValue,
      parameters,
    );
    if (immediateValue.primaryValue > 0) {
      return { required: true, supported: true, reason: "card-corner-immediate-primary" };
    }
    if (action.payload?.kind === "move") {
      return { required: true, supported: true, reason: "card-corner-probe-progress" };
    }
    if (
      finite(immediateStateValue.resourceFacts?.availableData)
      > finite(rootValue.resourceFacts?.availableData)
    ) {
      return { required: true, supported: true, reason: "card-corner-data-progress" };
    }
    if (selectReducedProbeGoal(
      context?.observation,
      immediateObservation,
      context?.seatId,
    )) {
      return { required: true, supported: true, reason: "card-corner-reduced-probe-goal-gap" };
    }
    const nextAgent = (leaf?.secondaryAgentTrace || []).find((candidate) => (
      !["card_corner", "end_turn", "pass"].includes(candidate?.family)
    ));
    if (!nextAgent) {
      return { required: true, supported: false, reason: "card-corner-no-followup-agent" };
    }
    const nextKey = actionSemanticKey(nextAgent);
    const rootLegal = (context?.legalActions || [])
      .some((candidate) => actionSemanticKey(candidate) === nextKey);
    const immediatelyLegal = (leaf?.rootActionLegalSuccessors || [])
      .some((candidate) => actionSemanticKey(candidate) === nextKey);
    return {
      required: true,
      supported: immediatelyLegal && !rootLegal,
      reason: immediatelyLegal && !rootLegal
        ? "card-corner-directly-unlocked-agent"
        : "card-corner-did-not-directly-unlock-agent",
      nextAgent,
    };
  }

  // 外星人 trace 价值：每个 trace 标记（第一放置 3-5 分即时 + 终局 trace 卡 2分/个
  // + 外星人牌：开牌即可继续获得外星人牌/终局计分/机制收益）。用户高分档首回合
  // 就抢第一放置、全盘 5 痕迹占满（阿米巴3+虫2）——痕迹是稳定大分源，估值提高。
  const TRACE_UNIT_VALUE = 5;

  function infrastructureDeltaValue(rootValue, leafValue) {
    const rootInfrastructure = rootValue.infrastructure;
    const leafInfrastructure = leafValue.infrastructure;
    if (leafValue.terminal) {
      return {
        total: 0,
        remainingRounds: 0,
        gainedTechIds: [],
        techValue: 0,
        blueBonusPlacementValue: 0,
        dataUtilizationValue: 0,
        incomeDelta: Object.fromEntries(Object.keys(INCOME_UNIT_VALUES).map((key) => [key, 0])),
        incomeValue: 0,
        traceDelta: 0,
        traceValue: 0,
      };
    }
    const remainingRounds = Math.max(
      0,
      leafInfrastructure.finalRoundNumber - leafInfrastructure.roundNumber,
    );
    const rootTech = new Set(rootInfrastructure.ownedTechIds);
    const gainedTechIds = leafInfrastructure.ownedTechIds
      .filter((tileId) => !rootTech.has(tileId));
    // 科技价值 = 每轮基础值 × 剩余轮次 + 蓝科技数据位槽收益（未来收益）。
    // 校准自用户 405 档（终局未结算-v223）实测：研究 blue2 = 16 分（8 次蓝列分×2）
    // + 2 首发 + 1 精选 + 8 能量 - 8 数据（四轮总量）。
    //   - 首发分 +2 与背面 bonus 是研究即得的即时分，由 actualScoreDelta 捕获
    //     （反事实结算真实发生），techValue 只计"未来收益"避免重复计分。
    //   - 蓝科技数据位槽：预期 4 次（用户 8 次减半）× 每次槽位价值 × 轮次权重
    //     （研究越靠后剩余轮次越少，可放的槽越少）。
    const BLUE_SLOT_UNIT_VALUES = Object.freeze({
      blue1: 5,
      blue2: 5,
      blue3: 4,
      blue4: 5,
    });
    const EXPECTED_BLUE_SLOT_PLACEMENTS = 4; // 用户 8 次减半
    const roundWeight = Math.min(1, Math.max(0, remainingRounds / 3));
    const baseTechValue = gainedTechIds.reduce((total, tileId) => (
      total + finite(TECH_UNIT_VALUES[tileId]) * remainingRounds
    ), 0);
    const blueSlotTechValue = gainedTechIds.reduce((total, tileId) => {
      const slotValue = BLUE_SLOT_UNIT_VALUES[tileId];
      if (!slotValue) return total;
      return total + slotValue * EXPECTED_BLUE_SLOT_PLACEMENTS * roundWeight;
    }, 0);
    const techValue = baseTechValue + blueSlotTechValue;
    // 蓝科技数据位槽"实际放置"的即时收益：用户 405 档 19 次放槽是"用上"科技的主要形态
    // （blue2 槽 8 次每次 +1 能量、blue1 槽 8 次 +1 信用、blue4 槽 2 次 +2 宣传、blue3 槽 1 次
    // 选牌）。此前 leafValue 只计研究时的预期（EXPECTED_BLUE_SLOT_PLACEMENTS=4 减半），
    // 实际放槽的即时资源收益在评估里 value=0 → AI 研究 blue2 后从不放槽（blueBonus 0）。
    // 按用户口径"实际产生的收益才是价值、预期次数才折半"：实际放置全额计。
    // 与 research 的 techValue 不重复：放槽分支 gainedTechIds 为空（科技已在位），
    // 研究分支 blueBonusCount 未增加；只有多步展开（研究→放槽）才可能同时出现，
    // 但预期(减半)+实际(全额)符合"预期次数折半、实际不折半"的口径。
    const rootBlueCount = finite(rootInfrastructure.dataProgress?.blueBonusCount);
    const leafBlueCount = finite(leafInfrastructure.dataProgress?.blueBonusCount);
    const blueBonusPlacementDelta = Math.max(0, leafBlueCount - rootBlueCount);
    // 放槽的即时收益按实际到手的资源货币化：资源（能量/信用）会被 AI 转换为分数
    // （能量→发射/移动/分析，信用→交易/研究），因此实际到手的资源按 INCOME_UNIT_VALUES
    // 计价值（blue2 槽 +1 能量→10，blue1 槽 +1 信用→8，blue4 槽 +2 宣传走研究门槛逻辑）。
    // 只在实际放槽（blueBonusCount 增加）时计入，避免 quick_trade/scan 等纯资源动作被高估。
    const rootEnergy = finite(rootValue.resourceFacts?.energy);
    const leafEnergy = finite(leafValue.resourceFacts?.energy);
    const rootCredits = finite(rootValue.resourceFacts?.credits);
    const leafCredits = finite(leafValue.resourceFacts?.credits);
    const blueBonusPlacementValue = blueBonusPlacementDelta > 0
      ? Math.max(0, leafEnergy - rootEnergy) * INCOME_UNIT_VALUES.energy
        + Math.max(0, leafCredits - rootCredits) * INCOME_UNIT_VALUES.credits
      : 0;
    // 数据预期用途价值：scan/打牌获得的数据是放槽（blueBonus 每次 +5 资源价值）与
    // analyze 的原料。数据库存本身不算分（测试契约"钱/电/宣传/数据/手牌库存不得
    // 冒充分数"），但"已有 blue 科技可放槽"时数据的预期转换价值应可见——否则 scan
    // 拿数据在评估里 value=0（白花 1c+2e），AI 从不扫描（用户 405 档 scan 13 次）。
    // 用 root（决策时）科技判断：scan 分支里没有研究动作，leaf 恒无 blue——数据能
    // 否放槽取决于决策时 AI 已拥有的 blue 科技。用户口径："用上了才有价值、预期
    // 次数折半"：预期利用率 0.5。
    const rootTechSet = new Set(rootInfrastructure.ownedTechIds);
    const hasBlueTechForData = [...rootTechSet].some((tileId) => (
      String(tileId).startsWith("blue")
    ));
    const rootDataCount = finite(rootValue.resourceFacts?.availableData);
    const leafDataCount = finite(leafValue.resourceFacts?.availableData);
    const dataDelta = Math.max(0, leafDataCount - rootDataCount);
    const DATA_TO_BLUE_SLOT_VALUE = INCOME_UNIT_VALUES.energy; // 数据→放槽→+1 能量（10）
    const EXPECTED_DATA_UTILIZATION = 0.5; // 预期折半（数据未必全转化为放槽）
    const dataUtilizationValue = hasBlueTechForData && dataDelta > 0
      ? dataDelta * DATA_TO_BLUE_SLOT_VALUE * EXPECTED_DATA_UTILIZATION
      : 0;
    const incomeDelta = Object.fromEntries(Object.keys(INCOME_UNIT_VALUES).map((key) => [
      key,
      positiveDelta(leafInfrastructure.income[key], rootInfrastructure.income[key]),
    ]));
    const incomePerWindowValue = Object.entries(INCOME_UNIT_VALUES)
      .reduce((total, [key, unitValue]) => total + incomeDelta[key] * unitValue, 0);
    const incomeValue = incomePerWindowValue * remainingRounds;
    // 外星人标记价值：新增 trace 标记 → 即时分 + 终局 trace 分 + 外星人牌。
    // traceValue 保持"每痕迹 5 分"（终局 trace 分近似）；另加 alienPurposeValue：
    // 放首痕迹的"揭示进度"期望（学习用户 405 档：R1-R2 放首痕迹 → R3 三色齐揭示 →
    // 位置分 + 外星牌链爆发）。首痕迹即时分（slot1 5分+1宣 / slot2 3分+1宣）由
    // actualScoreDelta 捕获（反事实真实结算），此处只计未来期望避免重复计分。
    const traceDelta = Math.max(
      0,
      finite(leafInfrastructure.traceCount) - finite(rootInfrastructure.traceCount),
    );
    const traceValue = traceDelta * TRACE_UNIT_VALUE;
    const alienPurposeValue = alienPurposeDelta(
      rootInfrastructure.alienSlots || [],
      leafInfrastructure.alienSlots || [],
      remainingRounds,
    );
    return {
      total: techValue + blueBonusPlacementValue + dataUtilizationValue
        + incomeValue + traceValue + alienPurposeValue,
      remainingRounds,
      gainedTechIds,
      techValue,
      blueBonusPlacementValue,
      dataUtilizationValue,
      incomeDelta,
      incomeValue,
      traceDelta,
      traceValue,
      alienPurposeValue,
    };
  }

  // 外星目的价值（"放首痕迹→三色齐→揭示→位置分+外星牌"链的期望，delta 版）：
  // - 新揭示（leaf revealed 而 root 未）：位置分期望（3-5 分/位置 × 剩余轮）+ 外星牌链
  // - 未揭示但抢到首痕迹（ownFirstTraces 增加）：**首痕迹价值 = 首痕迹分（即时分由
  //   actualScoreDelta 捕获）+ 一张外星人牌（用户规则：未揭示前只有首痕迹有价值，
  //   非首痕迹少一张外星人牌且分低）** + 接近三色齐的揭示期望
  // - 揭示后（两边 revealed）：**优先覆盖高收益位置（用户规则：开了外星人优先覆盖
  //   下两行高收益、有外星人牌的位置）**——extraMarks 增加 = 放位置标记，每个位置
  //   ≈ 位置分（3-5/位置 × 剩余轮）+ 外星牌期望
  const ALIEN_CARD_VALUE = 5;         // 放首痕迹给一张外星人牌（效果链价值；10 实测让分桶 AI 疯狂抢外星忽略其他，off 白色 86→35，取 5 平衡）
  const ALIEN_REVEAL_EXPECTATION = 15; // 三色齐揭示的期望（位置分 + 外星牌链，对齐 V 权重）
  const ALIEN_POSITION_UNIT = 3;       // 揭示后每位置每轮期望（3-5 分/位置，对齐 V）
  const ALIEN_POSITION_CARD_EXPECTATION = 4; // 高收益行给外星人牌的期望（部分位置）
  function alienPurposeDelta(rootSlots, leafSlots, remainingRounds) {
    let value = 0;
    const length = Math.max(rootSlots.length, leafSlots.length);
    for (let index = 0; index < length; index += 1) {
      const root = rootSlots[index] || { revealed: false, ownFirstTraces: 0, ownExtraMarks: 0 };
      const leaf = leafSlots[index] || { revealed: false, ownFirstTraces: 0, ownExtraMarks: 0 };
      if (leaf.revealed && !root.revealed) {
        value += ALIEN_REVEAL_EXPECTATION
          + ALIEN_POSITION_UNIT * Math.max(0, remainingRounds);
      } else if (leaf.revealed && root.revealed) {
        // 揭示后位置覆盖（高收益行优先：位置分 + 外星牌期望）
        const gainedMarks = Math.max(0, finite(leaf.ownExtraMarks))
          - Math.max(0, finite(root.ownExtraMarks));
        value += gainedMarks * (
          ALIEN_POSITION_UNIT * Math.max(1, remainingRounds)
          + ALIEN_POSITION_CARD_EXPECTATION
        );
      } else if (!leaf.revealed) {
        const rootTraces = Math.max(0, finite(root.ownFirstTraces));
        const leafTraces = Math.max(0, finite(leaf.ownFirstTraces));
        if (leafTraces > rootTraces) {
          const gainedFirstTraces = leafTraces - rootTraces;
          // 抢到首痕迹：外星人牌价值（每张首痕迹一张牌）+ 揭示进度期望
          value += ALIEN_CARD_VALUE * gainedFirstTraces;
          value += leafTraces >= 3
            ? ALIEN_REVEAL_EXPECTATION
            : leafTraces >= 2
              ? ALIEN_REVEAL_EXPECTATION * 0.3
              : ALIEN_REVEAL_EXPECTATION * 0.1;
        }
      }
    }
    return value;
  }

  function leafValue(rootValue, leafValueState, parameters) {
    const actualScoreDelta = (
      leafValueState.realizedScore + finite(leafValueState.securedEndGameBonus)
    ) - (
      rootValue.realizedScore + finite(rootValue.securedEndGameBonus)
    );
    const infrastructure = infrastructureDeltaValue(rootValue, leafValueState);
    // 宣传研究货币价值：宣传是研究科技的唯一货币（研究 cost 6 宣传，科技单位价值 10）。
    // 用户 405 档（终局未结算-v223）实测：打 b_117（免费发射+2 宣传）→ pub 4→6 达
    // 研究门槛 → 研究 blue2（蓝科技数据位槽 8 次）。此前 AI 评估打牌只算即时分，
    // 宣传增量=0 → b_117 不可选（no-score-tech-or-income-gain），AI 选 launch 而非打牌。
    // 宣传价值只在"跨过研究门槛"时兑现（pub 从 <6 到 >=6 的那部分），零星宣传
    // （远离门槛，如卡角 +1 宣传 pub 0→1）价值为 0——测试契约"只获得宣传的卡角
    // 不得归因"保持成立。
    // TECH_VALUE_PER_RESEARCH 从 10 提到 60：10 是"研究一次"的旧固定值，但研究
    // blue2 的实际 techValue ≈50（R1 时每轮 10×3 + 蓝槽预期 5×4），10 让打牌凑宣传
    // 只值 3.33，远低于 launch 的乐观探测链评估（103）→ AI 永远不学用户"先打牌凑
    // 宣传再研究"。提到 60 后 b_117 的 2 宣传 ≈20，与免费发射链叠加可超过 launch。
    const RESEARCH_PUBLICITY_COST = 6;
    const TECH_VALUE_PER_RESEARCH = 60;
    const rootPub = finite(rootValue.resourceFacts?.publicity);
    const leafPub = finite(leafValueState.resourceFacts?.publicity);
    // 跨门槛判断只看 leaf 终点 pub：研究动作本身（research_tech）花宣传，终点 pub
    // 下降 → 不触发（测试契约：R2 研究 orange2 score=14 不加宣传分）。b_117 打牌凑
    // 宣传→研究的链，其研究价值已由 techValue（gainedTechIds）兑现，宣传是前置动作，
    // 不重复计分；b_117 的 2 宣传价值由"打牌后 pub 达到 6"的 leaf 分支体现。
    const crossesThreshold = rootPub < RESEARCH_PUBLICITY_COST
      && leafPub >= RESEARCH_PUBLICITY_COST;
    const publicityResearchValue = crossesThreshold
      ? (RESEARCH_PUBLICITY_COST - rootPub)
        * (TECH_VALUE_PER_RESEARCH / RESEARCH_PUBLICITY_COST)
      : 0;
    return {
      total: actualScoreDelta + infrastructure.total + publicityResearchValue,
      primaryValue: actualScoreDelta + infrastructure.total + publicityResearchValue,
      actualScoreDelta,
      infrastructure,
      publicityResearchValue,
    };
  }

  function valueFromStrategicFacts(facts) {
    // 轻量 strategicFacts 源（getBranchPriority 热路径）：不投影 alienSlots
    // （createStrategicFacts 无槽位级数据），外星进度增量不参与分支优先级；
    // 最终叶排序走 evaluateState（完整 projection 源）。
    return {
      terminal: Boolean(facts.terminal),
      realizedScore: finite(facts.realizedScore),
      securedEndGameBonus: finite(facts.securedEndGameBonus),
      resourceFacts: resourceFactsFrom(facts.resourceFacts),
      infrastructure: infrastructureFrom({
        ownedTechIds: facts.ownedTechIds,
        income: facts.income,
        roundNumber: facts.roundNumber,
        finalRoundNumber: facts.finalRoundNumber,
        traceCount: facts.traceCount,
        sectorWinRequirements: facts.sectorWinRequirements,
        dataProgress: facts.dataProgress,
      }),
    };
  }

  function evaluateStrategicFactsBreakdown(rootFacts, branchFacts, parametersInput = {}) {
    if (!rootFacts || !branchFacts
      || rootFacts.viewerSeatId !== branchFacts.viewerSeatId) {
      throw new TypeError("Search priority 需要同 viewer 的战略事实");
    }
    const parameters = mergeParameters(parametersInput);
    return leafValue(
      valueFromStrategicFacts(rootFacts),
      valueFromStrategicFacts(branchFacts),
      parameters,
    );
  }

  function evaluateStrategicFactsPriority(rootFacts, branchFacts, parametersInput = {}) {
    return evaluateStrategicFactsBreakdown(
      rootFacts,
      branchFacts,
      parametersInput,
    ).total;
  }

  function gapSize(requirement) {
    const gap = requirement?.gap || {};
    return finite(gap.credits) + finite(gap.energy);
  }

  function goalValue(requirement) {
    return finite(
      requirement?.targetBenefit?.grossEquivalentValue
      ?? requirement?.targetBenefit?.score,
    );
  }

  function isAffordable(requirement) {
    return finite(requirement?.gap?.credits) === 0
      && finite(requirement?.gap?.energy) === 0;
  }

  function compareGoals(left, right) {
    return Number(isAffordable(right)) - Number(isAffordable(left))
      || goalValue(right) - goalValue(left)
      || finite(right?.targetBenefit?.score) - finite(left?.targetBenefit?.score)
      || gapSize(left) - gapSize(right)
      || String(left?.requirementId || "").localeCompare(String(right?.requirementId || ""));
  }

  function evaluateOutcome(context, action, parametersInput = {}) {
    const parameters = mergeParameters(parametersInput);
    const outcome = (context?.actionOutcomes || []).find((candidate) => (
      candidate?.actionId === action?.actionId
    ));
    if (!outcome) return unavailable(null, "outcome-missing");
    if (outcome.schemaVersion !== OUTCOME_SCHEMA_VERSION || outcome.status !== "settled") {
      return unavailable(outcome, outcome.code || "outcome-unresolved");
    }
    const rootValue = outcome.rootObservation
      ? evaluateState(outcome.rootObservation, context.seatId)
      : null;
    if (!rootValue) return unavailable(outcome, "outcome-root-missing");
    // V(state) 增量：V(leaf) - V(root)，编码长线价值（收入复利/科技效率/外星进度/手牌）
    const vEnabled = Boolean(parameters.vStateValueEnabled);
    const rootV = vEnabled ? evaluateStateValue(outcome.rootObservation, context.seatId).total : null;
    const evaluatedLeaves = (outcome.leaves || [])
      .filter((leaf) => leaf?.status !== "failed" && leaf?.observation)
      .map((leaf) => {
        const leafStateValue = evaluateState(leaf.observation, context.seatId);
        const vDelta = vEnabled
          ? evaluateStateValue(leaf.observation, context.seatId).total - rootV
          : 0;
        return {
          leaf,
          leafStateValue,
          strategicValue: leafValue(rootValue, leafStateValue, parameters),
          vDelta,
        };
      })
      .sort((left, right) => (
        right.strategicValue.primaryValue - left.strategicValue.primaryValue
        || (vEnabled ? (right.vDelta - left.vDelta) : 0)
        || right.strategicValue.total - left.strategicValue.total
        || right.strategicValue.actualScoreDelta - left.strategicValue.actualScoreDelta
        || Number(left.leaf.quickTradeCount || 0) - Number(right.leaf.quickTradeCount || 0)
        || Number(left.leaf.secondaryAgentDepth || 0) - Number(right.leaf.secondaryAgentDepth || 0)
        || String(left.leaf.leafId || "").localeCompare(String(right.leaf.leafId || ""))
      ));
    const best = evaluatedLeaves[0] || null;
    if (!best) return unavailable(outcome, "strategic-goal-leaf-missing");
    let bestLeafValue = best.strategicValue;
    const bestVD = best.vDelta || 0;
    const tradePurpose = quickTradePurpose(context, action, best.leaf);
    if (!tradePurpose.supported) return unavailable(outcome, tradePurpose.reason);
    const cornerPurpose = cardCornerPurpose(
      context,
      action,
      best.leaf,
      rootValue,
      parameters,
    );
    if (!cornerPurpose.supported) return unavailable(outcome, cornerPurpose.reason);
    const control = CONTROL_FAMILIES.has(action?.family);
    const conditional = action?.phase === "conditional";
    // 移动不是主行动：quick 相位的 move 是随时可用的免费快速行动（用电/移动牌/牌
    // corner/打牌效果/紫4扫描/公司能力），不应因"没有即时分/tech/income 增量"被过滤。
    // 它作为探测路线的达成步骤获得路线价值，无绑定路线时保持可选项但排末尾。
    const moveIsQuickAction = action?.family === "move";
    const selectable = bestLeafValue.primaryValue > 0 || control || conditional
      || moveIsQuickAction;
    if (!selectable) return unavailable(outcome, "no-score-tech-or-income-gain");
    return deepFreeze({
      evaluationModel: EVALUATION_MODEL,
      score: bestLeafValue.primaryValue,
      value: bestLeafValue.total,
      sortKey: [
        bestLeafValue.primaryValue,
        0,
        -Number(best.leaf.quickTradeCount || 0),
        -Number(best.leaf.secondaryAgentDepth || 0),
      ],
      selectable: true,
      priorityClass: conditional ? 3 : control ? 0 : 2,
      status: outcome.status,
      confidence: outcome.confidence || "high",
      rootValue,
      leafValue: best.leafStateValue,
      actualScoreDelta: bestLeafValue.actualScoreDelta,
      primaryValue: bestLeafValue.primaryValue,
      vDelta: bestVD,
      vStateValueEnabled: vEnabled,
      quickTradeCount: Number(best.leaf.quickTradeCount || 0),
      secondaryAgentDepth: Number(best.leaf.secondaryAgentDepth || 0),
      quickTradePurpose: tradePurpose.required ? tradePurpose : null,
      cardCornerPurpose: cornerPurpose.required ? cornerPurpose : null,
      infrastructureValue: best.strategicValue.infrastructure.total,
      techValue: best.strategicValue.infrastructure.techValue,
      gainedTechIds: best.strategicValue.infrastructure.gainedTechIds,
      incomeValue: best.strategicValue.infrastructure.incomeValue,
      incomeDelta: best.strategicValue.infrastructure.incomeDelta,
      remainingRounds: best.strategicValue.infrastructure.remainingRounds,
      probeRouteSummary: best.leaf.observation.outcomeProjection.progress?.probeRoute?.candidate || null,
      routeTargetId: best.leaf.rootRouteTargetId || null,
      goalPaths: (best.leaf.secondaryAgentGoalPaths || []).map((path) => [...path]),
      goalSelections: (best.leaf.secondaryAgentGoalSelections || []).map((selection) => ({
        targetId: selection.targetId || null,
        actions: (selection.actions || []).map((step) => ({
          family: step.family || null,
          summary: step.summary || null,
          target: { ...(step.target || {}) },
        })),
        quickTradeCount: Number(selection.quickTradeCount) || 0,
      })),
      selectedLeafId: best.leaf.leafId || null,
      actionChain: best.leaf.actionChain || [],
      reasonCodes: [
        best.strategicValue.actualScoreDelta > 0 ? "strategic-goal-score" : null,
        best.strategicValue.infrastructure.techValue > 0 ? "strategic-goal-tech" : null,
        best.strategicValue.infrastructure.incomeValue > 0 ? "strategic-goal-income" : null,
        tradePurpose.required ? tradePurpose.reason : null,
        cornerPurpose.required ? cornerPurpose.reason : null,
        conditional ? "required-standard-decision" : null,
        control ? "turn-control" : null,
      ].filter(Boolean),
    });
  }

  function requiresCounterfactualOutcome(action) {
    return !CONTROL_FAMILIES.has(action?.family);
  }

  function requiresRootCounterfactual(action, observation) {
    if (!requiresCounterfactualOutcome(action)) return false;
    // 2026-08-21 迭代（用户裁定"按目标搜索"）：quick_trade 的入口需求门控
    // （prepares* 补缺口）已删除——根动作只来自目标目录绑定（selectSecondaryAgentRootActions
    // = compatibleActionIds），目标目录的资源准备（selectMinimumCostResourcePreparation /
    // selectDataResourcePreparation / selectTechPublicityPreparation 等）已保证
    // quick_trade 只在"有目标缺口"时进入 compatibleActionIds，无缺口/无目标的
    // quick_trade 被目标目录挡住，不再需要 requiresRootCounterfactual 重复过滤
    // （双保险变单保险，行为应不变，A/B 验证）。card_corner 同理恒放行（价值由
    // 叶级出口检查判定）。
    return true;
  }

  function completesSecondaryAgentRouteTarget(input = {}) {
    const action = input.action;
    const targetId = String(input.targetId || "");
    if (!action || !targetId) return false;
    if (targetId === DATA_ANALYZE_ROUTE_TARGET) {
      // data:analyze 目标完成 = analyze 已执行（v4 语义）：place_data 填数据
      // **不算完成**——数据轨推进由需求驱动（用户裁定"有目标才填、数据不够想
      // 办法拿"），填到第 6 位解锁 analyze 才完成。v4（f6e4c887）即此语义，
      // 全盘 94.25/275s 无绕圈。
      return action.family === "analyze";
    }
    if (targetId === `decision:${action.actionId}`) return true;
    if (targetId.startsWith("card:resolve:")) {
      const instanceId = targetId.slice("card:resolve:".length);
      return !(input.branchObservation?.selfState?.hand || []).some((card) => (
        String(card?.id) === instanceId
      ));
    }
    if (targetId.startsWith("tech:gain:")) {
      const tileId = targetId.slice("tech:gain:".length);
      const ownedTechIds = input.branchObservation?.outcomeProjection?.progress?.ownedTechIds
        || outcomeModel.createStrategicFacts(
          input.branchObservation,
          input.focalSeatId,
        ).ownedTechIds
        || [];
      return ownedTechIds.includes(tileId);
    }
    if (targetId.startsWith("sector:win:")) {
      const [, , sectorId, settlementNumber] = targetId.split(":");
      return (rawSectorWinRequirements(input.branchObservation)?.wins || []).some((win) => (
        String(win?.sectorId) === sectorId
        && finite(win?.settlementNumber) === finite(settlementNumber)
      ));
    }
    if (targetId.startsWith("income:gain:")) {
      const baseline = targetId.slice("income:gain:".length)
        .split(",")
        .map(finite);
      const income = input.branchObservation?.outcomeProjection?.progress?.income
        || outcomeModel.createStrategicFacts(
          input.branchObservation,
          input.focalSeatId,
        ).income
        || {};
      return [
        "credits",
        "energy",
        "publicity",
        "availableData",
        "handSize",
        "additionalPublicScan",
      ].some((key, index) => finite(income[key]) > finite(baseline[index]));
    }
    const [family, planetId, targetType = "planet", satelliteId = ""] = targetId.split(":");
    if (!["orbit", "land"].includes(family) || action.family !== family) return false;
    return String(action.target?.planetId || "") === planetId
      && String(action.target?.type || "planet") === targetType
      && String(action.target?.satelliteId || "") === satelliteId;
  }

  function secondaryAgentCompletionFacts(observation, seatId) {
    const facts = outcomeModel.createStrategicFacts(observation, seatId);
    return {
      schemaVersion: "seti-secondary-agent-completion-facts-v2",
      score: finite(facts.realizedScore) + finite(facts.securedEndGameBonus),
      resources: {
        credits: finite(facts.resourceFacts?.credits),
        energy: finite(facts.resourceFacts?.energy),
        publicity: finite(facts.resourceFacts?.publicity),
        availableData: finite(facts.resourceFacts?.availableData),
        additionalPublicScan: finite(facts.resourceFacts?.additionalPublicScan),
        ordinaryCards: finite(facts.resourceFacts?.ordinaryCards),
        alienCards: finite(facts.resourceFacts?.alienCards),
      },
      income: {
        credits: finite(facts.income?.credits),
        energy: finite(facts.income?.energy),
        publicity: finite(facts.income?.publicity),
        availableData: finite(facts.income?.availableData),
        handSize: finite(facts.income?.handSize),
        additionalPublicScan: finite(facts.income?.additionalPublicScan),
      },
      dataProgress: {
        computerPlacedCount: finite(facts.dataProgress?.computerPlacedCount),
        analyzeReady: Boolean(facts.dataProgress?.analyzeReady),
      },
      ownedTechIds: [...new Set(facts.ownedTechIds || [])].map(String).sort(),
    };
  }

  function rawProbeRequirements(observation) {
    return observation?.probeRouteRequirements
      || observation?.outcomeProjection?.progress?.probeGoalRequirements
      || null;
  }

  function rawDataAnalyzeRequirements(observation) {
    return observation?.dataAnalyzeRequirements
      || observation?.outcomeProjection?.progress?.dataAnalyzeRequirements
      || null;
  }

  function dataAnalyzeEligible(requirements) {
    if (!requirements) return false;
    // 2026-08-21 用户裁定"想做但数据不够就想办法拿"：数据轨未满（第 6 位分析
    // 前置未达成）即 active——数据够（nextStep=place_data）挂 place_data，
    // 数据不够（nextStep=acquire_data）挂 scan/卡牌拿数据计划。此前要求"数据
    // 够填满第一排"（heldDataCanFillFirstRow）才 eligible → 数据少时目标消失
    // → 蓝色 scan 后不再攒数据、数据轨填不满、analyze 断（蓝 46 分）。
    // 数据轨满（placed≥6）后目标不再 active（analyze 前置已达成）。
    if (typeof requirements.eligible === "boolean" && requirements.eligible) return true;
    return finite(requirements.computerPlacedCount) < 6;
  }

  function rawSectorWinRequirements(observation) {
    return observation?.sectorWinRequirements
      || observation?.outcomeProjection?.progress?.sectorWinRequirements
      || null;
  }

  function rawIncomeGainRequirements(observation) {
    return observation?.incomeGainRequirements
      || observation?.outcomeProjection?.progress?.incomeGainRequirements
      || null;
  }

  function rawTechGainRequirements(observation) {
    return observation?.techGainRequirements
      || observation?.outcomeProjection?.progress?.techGainRequirements
      || null;
  }

  function publicPlayerOf(observation, seatId) {
    const players = observation?.publicState?.players;
    if (Array.isArray(players)) {
      return players.find((player) => (
        String(player?.id ?? player?.playerId) === String(seatId)
      )) || null;
    }
    return players?.[seatId] || Object.values(players || {}).find((player) => (
      String(player?.id ?? player?.playerId) === String(seatId)
    )) || null;
  }

  // 放置数据结算的需求驱动（2026-08-21 用户裁定：结算不搜索，按"我需要什么"直接
  // 选）：blue 槽奖励 blue1=+1信用 / blue2=+1能量 / blue3=精选1张 / blue4=+2宣传，
  // computer 槽位奖励 第2格=+1宣传 / 第4格=收入，蓝列分数 2分/套。
  // 需求优先级：宣传缺口（研究科技）→ 收入（第4格）→ 钱/电缺口 → 牌 → 默认推进。
  // 修复旧实现：只认 blue1/blue2 的 gap 资源（credits/energy）、blue3/blue4 奖励
  // 被滤掉导致折叠失效（白色 R3 决策 5555 个 choose_target 节点全展开）。
  const BLUE_TILE_REWARD = Object.freeze({
    blue1: { credits: 1 },
    blue2: { energy: 1 },
    blue3: { chooseCard: 1 },
    blue4: { publicity: 2 },
  });

  function blueTileOfSlot(observation, blueSlot, seatId) {
    const player = publicPlayerOf(observation, seatId);
    const blueSlots = player?.techState?.blueBoardSlots || {};
    return Object.keys(blueSlots).find((candidate) => (
      Number(blueSlots[candidate]) === Number(blueSlot)
    )) || null;
  }

  function computerSlotOf(action) {
    const text = String(action.summary || action.label || action.description || "");
    const match = text.match(/位置\s*(\d+)/);
    return match ? Number(match[1]) : null;
  }

  // place_data 需求型触发判定（2026-08-21 用户裁定：place_data 是需求型行动——
  // 能带来资源/收入/蓝色踪迹/分数，有这个目标的时候填上对应的数据去做；想做但
  // 数据不够，就想办法拿）。触发优先级：
  //   1. 缺钱(≤1)→blue1 / 缺电(≤1)→blue2（纯赚，用户裁定"数据填钱和电是纯赚"；
  //      缺牌不在此列，blue3 是选牌非纯赚；宣传不需要）
  //   2. 数据溢出（可放数据 ≥ 数据池上限 6，再拿会浪费）→ 填（避免浪费）
  //   3. 目标 active（income/data:analyze 下被调用）→ 填第一排 computer
  // 返回：null=非放置决策；[]=有放置但无触发（不填，收束）；[代表]=填哪。
  // 单选代表折叠（targetEquivalentChoiceCount），不展开搜索枚举。
  function selectDataPlacementChoice(observation, successors, seatId) {
    const dataChoices = successors.filter((action) => (
      String(action.target?.choiceId || "").startsWith("data:")
    ));
    if (!dataChoices.length) return null;
    const assets = resourceFactsOf(observation, seatId);
    const availableData = finite(assets.availableData);
    if (availableData <= 0) return [];
    const computer = dataChoices.find((action) => action.target?.target === "computer") || null;
    const blueBonuses = dataChoices.filter((action) => action.target?.target === "blueBonus");
    const blueOf = (tileId) => blueBonuses.find((action) => (
      blueTileOfSlot(observation, action.target?.blueSlot, seatId) === tileId
    )) || null;
    const foldOthers = (primary, list) => (
      list.length > 1
        ? [{ ...primary, targetEquivalentChoiceCount: list.length - 1 }]
        : [primary]
    );
    // 1. 缺钱→blue1 / 缺电→blue2（纯赚，用户裁定"数据填钱和电是纯赚行为"；
    //    缺牌不在此列——blue3 是选牌不是纯赚）。
    if (finite(assets.credits) <= 1) {
      const blue1 = blueOf("blue1");
      if (blue1) return foldOthers(blue1, blueBonuses);
    }
    if (finite(assets.energy) <= 1) {
      const blue2 = blueOf("blue2");
      if (blue2) return foldOthers(blue2, blueBonuses);
    }
    // 2. 数据溢出（可放数据 ≥ 数据池上限 6，再获取数据会弃置浪费）→ 填 computer。
    const DATA_POOL_LIMIT = 6;
    if (availableData >= DATA_POOL_LIMIT) {
      if (computer) return [computer];
    }
    // 3. 目标 active（income/data:analyze 下被调用）→ 填第一排 computer。
    if (computer) return [computer];
    return [];
  }

  function actionMatchesProbeStep(action, step) {
    if (!action || !step) return false;
    if (action.family !== step.family) return false;
    if (step.family === "move") {
      return String(action.target?.rocketId) === String(step.rocketId)
        && finite(action.target?.deltaX) === finite(step.deltaX)
        && finite(action.target?.deltaY) === finite(step.deltaY);
    }
    if (["orbit", "land"].includes(step.family)) {
      return String(action.target?.rocketId) === String(step.rocketId)
        && String(action.target?.planetId) === String(step.planetId)
        && String(action.target?.type || "planet") === String(step.target?.type || "planet")
        && String(action.target?.satelliteId || "") === String(step.target?.satelliteId || "");
    }
    return true;
  }

  function movementPointsFromCard(card) {
    if (!card || typeof cardEffects?.buildPlayEffects !== "function") return 0;
    return cardEffects.buildPlayEffects(card).reduce((total, effect) => (
      [cardEffects.EFFECT_TYPES.CARD_MOVE, cardEffects.EFFECT_TYPES.FREE_MOVE]
        .includes(effect?.type)
        ? total + Math.max(1, finite(effect?.options?.movementPoints) || 1)
        : total
    ), 0);
  }

  // 打牌 spawn 的免费发射：该 play_card 打出时含 LAUNCH（skipCost）效果，
  // 可作为探测的免费发射步骤（用户 405 档 b_117 = 免费发射 + 2 宣传）。
  // launchEffect 用 REWARD_TYPES.LAUNCH("launch")，EFFECT_TYPES 无 LAUNCH 键——
  // 此前用 EFFECT_TYPES.LAUNCH(undefined) 恒 false，b_117 免费发射从未被识别。
  function cardHasFreeLaunch(observation, action) {
    if (action?.family !== "play_card") return false;
    const instanceId = action.target?.cardInstanceId;
    const card = (observation?.selfState?.hand || []).find((candidate) => (
      String(candidate?.id) === String(instanceId)
    ));
    if (!card || typeof cardEffects?.buildPlayEffects !== "function") return false;
    const launchType = cardEffects.REWARD_TYPES?.LAUNCH ?? "launch";
    return cardEffects.buildPlayEffects(card).some((effect) => (
      effect?.type === launchType
      && effect?.options?.skipCost !== false
    ));
  }

  function movementPointsFromCardAction(observation, action) {
    if (action?.family !== "play_card") return 0;
    const instanceId = action.target?.cardInstanceId;
    const card = (observation?.selfState?.hand || []).find((candidate) => (
      String(candidate?.id) === String(instanceId)
    ));
    return movementPointsFromCard(card);
  }

  function selectProbeMovementCards(observation, goal, actions) {
    if (goal?.nextStep?.family !== "move") return [];
    return actions
      .filter((action) => movementPointsFromCardAction(observation, action) > 0)
      .sort((left, right) => (
        finite(left.payload?.cost?.credits) - finite(right.payload?.cost?.credits)
        || String(left.actionId).localeCompare(String(right.actionId))
      ));
  }

  function cardResearchTechTypes(observation, action) {
    if (action?.family !== "play_card") return null;
    const instanceId = String(action.target?.cardInstanceId || "");
    const card = (observation?.selfState?.hand || []).find((candidate) => (
      String(candidate?.id) === instanceId
    ));
    const effects = cardEffects?.buildPlayEffects?.(card) || [];
    const research = effects.find((effect) => (
      effect?.type === cardEffects.EFFECT_TYPES.RESEARCH_TECH
    ));
    return research ? [...(research.options?.techTypes || [])] : null;
  }

  function cardCanResearchTechPlan(observation, action, plan) {
    const techTypes = cardResearchTechTypes(observation, action);
    if (techTypes == null) return false;
    if (!techTypes.length) return true;
    const tileType = String(plan?.tileId || "").replace(/[0-9]+$/, "");
    return techTypes.includes(tileType);
  }

  function deferredProbeMovementCardCosts(observation, goal, seatId) {
    if (goal?.nextStep?.family !== "move") return [];
    const assets = resourceFactsOf(observation, seatId);
    return (observation?.selfState?.hand || [])
      .filter((card) => movementPointsFromCard(card) > 0)
      .map((card) => ({
        credits: Math.max(0, finite(card.price)),
        energy: 0,
        publicity: 0,
        handSize: 1,
      }))
      .filter((cost) => cost.credits <= finite(assets.credits));
  }

  function resourceCostDominates(left, right) {
    const keys = ["credits", "energy", "publicity", "handSize"];
    return keys.every((key) => finite(left?.[key]) <= finite(right?.[key]))
      && keys.some((key) => finite(left?.[key]) < finite(right?.[key]));
  }

  function preferDeferredProbeMovementCard(
    observation,
    goal,
    preparation,
    successors,
    seatId,
  ) {
    const cardCosts = deferredProbeMovementCardCosts(observation, goal, seatId);
    const endTurn = successors.find((action) => action.family === "end_turn");
    if (!cardCosts.length || !endTurn) return preparation;
    const nonDominatedPreparation = preparation.filter((action) => (
      !cardCosts.some((cost) => resourceCostDominates(cost, action.payload?.cost || {}))
    ));
    return [...nonDominatedPreparation, endTurn];
  }

  function resourceFactsOf(observation, seatId) {
    if (observation?.outcomeProjection?.assets) return observation.outcomeProjection.assets;
    return outcomeModel.createStrategicFacts(observation, seatId).resourceFacts || {};
  }

  function resourceGapAfterTrade(observation, required, action, seatId) {
    if (action?.family !== "quick_trade") return null;
    const cost = action.payload?.cost;
    const gain = action.payload?.gain;
    if (!cost || !gain) return null;
    const assets = resourceFactsOf(observation, seatId);
    let before = 0;
    let after = 0;
    for (const resource of ["credits", "energy"]) {
      before += Math.max(0, finite(required?.[resource]) - finite(assets[resource]));
      const availableAfterTrade = finite(assets[resource])
        - finite(cost[resource])
        + finite(gain[resource]);
      after += Math.max(0, finite(required?.[resource]) - availableAfterTrade);
    }
    return { before, after, reduction: Math.max(0, before - after) };
  }

  function probeResourceGapAfterTrade(observation, goal, action, seatId) {
    if (action?.family !== "quick_trade") return null;
    const cost = action.payload?.cost;
    const gain = action.payload?.gain;
    if (!cost || !gain) return null;
    const assets = resourceFactsOf(observation, seatId);
    const required = goal?.required || {};
    const before = {
      credits: Math.max(0, finite(goal?.gap?.credits)),
      energy: Math.max(0, finite(goal?.gap?.energy)),
    };
    const after = {};
    for (const resource of ["credits", "energy"]) {
      const availableAfterTrade = finite(assets[resource])
        - finite(cost[resource])
        + finite(gain[resource]);
      after[resource] = Math.max(0, finite(required[resource]) - availableAfterTrade);
    }
    return {
      before: before.credits + before.energy,
      after: after.credits + after.energy,
      reduction: Math.max(
        0,
        before.credits + before.energy - after.credits - after.energy,
      ),
    };
  }

  const PLANNED_RESOURCE_KEYS = Object.freeze([
    "credits",
    "energy",
    "publicity",
    "handSize",
  ]);
  const resourceDistanceCache = new Map();
  const resourcePreparationCache = new Map();

  function selectMinimumCostResourcePreparation(
    observation,
    required,
    successors,
    seatId,
  ) {
    const legalByTradeId = new Map(successors
      .filter((action) => action.family === "quick_trade")
      .map((action) => [action.target?.tradeId, action]));
    if (!legalByTradeId.size || !Array.isArray(quickTrades?.TRADE_ACTIONS)) return [];
    const assets = resourceFactsOf(observation, seatId);
    const initial = {
      credits: Math.max(0, Math.floor(finite(assets.credits))),
      energy: Math.max(0, Math.floor(finite(assets.energy))),
      publicity: Math.max(0, Math.floor(finite(assets.publicity))),
      handSize: Math.max(0, Math.floor(finite(assets.ordinaryCards))),
    };
    const target = {
      credits: Math.max(0, Math.ceil(finite(required?.credits))),
      energy: Math.max(0, Math.ceil(finite(required?.energy))),
    };
    const satisfied = (state) => (
      state.credits >= target.credits
      && state.energy >= target.energy
    );
    if (satisfied(initial)) return [];
    const preparationKey = [
      target.credits,
      target.energy,
      ...PLANNED_RESOURCE_KEYS.map((key) => initial[key]),
      ...[...legalByTradeId.keys()].sort(),
    ].join(":");
    if (resourcePreparationCache.has(preparationKey)) {
      return resourcePreparationCache.get(preparationKey)
        .map((tradeId) => legalByTradeId.get(tradeId))
        .filter(Boolean);
    }
    const stateKey = (state) => [
      target.credits,
      target.energy,
      ...PLANNED_RESOURCE_KEYS.map((key) => state[key]),
    ].join(":");
    const available = (state, trade) => PLANNED_RESOURCE_KEYS.every((key) => (
      state[key] >= Math.max(0, finite(trade.cost?.[key]))
    ));
    const applyTrade = (state, trade) => Object.fromEntries(
      PLANNED_RESOURCE_KEYS.map((key) => [
        key,
        state[key]
          - Math.max(0, finite(trade.cost?.[key]))
          + Math.max(0, finite(trade.gain?.[key])),
      ]),
    );
    const edgeLoss = (trade) => PLANNED_RESOURCE_KEYS.reduce((total, key) => (
      total
      + Math.max(0, finite(trade.cost?.[key]))
      - Math.max(0, finite(trade.gain?.[key]))
    ), 0);
    function minimumPlans(state) {
      if (satisfied(state)) {
        return [{
          loss: 0,
          steps: 0,
          terminalKey: PLANNED_RESOURCE_KEYS.map((key) => state[key]).join(":"),
        }];
      }
      const key = stateKey(state);
      if (resourceDistanceCache.has(key)) return resourceDistanceCache.get(key);
      const candidates = [];
      for (const trade of quickTrades.TRADE_ACTIONS) {
        const loss = edgeLoss(trade);
        if (loss <= 0 || !available(state, trade)) continue;
        for (const remaining of minimumPlans(applyTrade(state, trade))) {
          candidates.push({
            loss: loss + remaining.loss,
            steps: 1 + remaining.steps,
            terminalKey: remaining.terminalKey,
          });
        }
      }
      candidates.sort((left, right) => (
        left.loss - right.loss
        || left.steps - right.steps
        || left.terminalKey.localeCompare(right.terminalKey)
      ));
      const best = candidates[0] || null;
      const plans = best
        ? [...new Map(candidates
          .filter((candidate) => (
            candidate.loss === best.loss
            && candidate.steps === best.steps
          ))
          .map((candidate) => [candidate.terminalKey, candidate])).values()]
        : [];
      if (resourceDistanceCache.size >= 100000) resourceDistanceCache.clear();
      resourceDistanceCache.set(key, plans);
      return plans;
    }
    const candidates = [];
    for (const [tradeId, action] of legalByTradeId) {
      const trade = quickTrades.TRADE_ACTIONS.find((candidate) => candidate.id === tradeId);
      if (!trade || !available(initial, trade)) continue;
      for (const remaining of minimumPlans(applyTrade(initial, trade))) {
        candidates.push({
          action,
          loss: edgeLoss(trade) + remaining.loss,
          steps: 1 + remaining.steps,
          terminalKey: remaining.terminalKey,
        });
      }
    }
    candidates.sort((left, right) => (
      left.loss - right.loss
      || left.steps - right.steps
      || left.terminalKey.localeCompare(right.terminalKey)
      || String(left.action.actionId).localeCompare(String(right.action.actionId))
    ));
    const best = candidates[0] || null;
    const plannedTradeIds = (best
      ? [...new Map(candidates
        .filter((candidate) => (
          candidate.loss === best.loss
          && candidate.steps === best.steps
        ))
        .map((candidate) => [candidate.terminalKey, candidate])).values()]
      : [])
      .map((candidate) => candidate.action.target?.tradeId)
      .filter(Boolean);
    if (resourcePreparationCache.size >= 10000) resourcePreparationCache.clear();
    resourcePreparationCache.set(preparationKey, plannedTradeIds);
    return plannedTradeIds
      .map((tradeId) => legalByTradeId.get(tradeId))
      .filter(Boolean);
  }

  function selectProbeResourcePreparation(observation, goals, successors, seatId) {
    return goals.flatMap((goal) => selectMinimumCostResourcePreparation(
      observation,
      goal.required || {},
      successors,
      seatId,
    )).filter((action, index, actions) => (
      actions.findIndex((candidate) => candidate.actionId === action.actionId) === index
    ));
  }

  function dataPaymentGapAfterTrade(observation, action, seatId) {
    if (action?.family !== "quick_trade") return null;
    const requirements = rawDataAnalyzeRequirements(observation);
    const cost = action.payload?.cost;
    const gain = action.payload?.gain;
    if (!dataAnalyzeEligible(requirements) || !cost || !gain) return null;
    const assets = resourceFactsOf(observation, seatId);
    const costs = [
      requirements.nextCost || {},
      ...(requirements.acquisitionPlans || []).map((plan) => plan.nextCost || {}),
    ].filter((candidate) => (
      finite(candidate.credits) > 0 || finite(candidate.energy) > 0
    ));
    const gaps = costs.map((required) => {
      let before = 0;
      let after = 0;
      for (const resource of ["credits", "energy"]) {
        before += Math.max(0, finite(required[resource]) - finite(assets[resource]));
        const availableAfterTrade = finite(assets[resource])
          - finite(cost[resource])
          + finite(gain[resource]);
        after += Math.max(0, finite(required[resource]) - availableAfterTrade);
      }
      return { before, after, reduction: before - after };
    }).filter((gap) => gap.reduction > 0);
    return gaps.sort((left, right) => (
      right.reduction - left.reduction
      || left.after - right.after
      || left.before - right.before
    ))[0] || null;
  }

  function selectDataResourcePreparation(observation, successors, seatId) {
    const requirements = rawDataAnalyzeRequirements(observation);
    return dataAnalyzeEligible(requirements)
      ? selectMinimumCostResourcePreparation(
        observation,
        requirements.nextCost || {},
        successors,
        seatId,
      )
      : [];
  }

  function selectTechPublicityPreparation(observation, successors, seatId) {
    const requirements = rawTechGainRequirements(observation);
    if (!requirements) return [];
    const assets = resourceFactsOf(observation, seatId);
    if (finite(assets.publicity) >= finite(requirements.researchCost)) return [];
    const plans = requirements.publicityPreparationPlans || [];
    if (plans.some((plan) => plan.kind === "place_data")) {
      const placeData = successors.find((action) => action.family === "place_data");
      if (placeData) return [placeData];
    }
    const cardById = new Map((observation?.selfState?.hand || []).map((card) => [
      String(card.id),
      card,
    ]));
    const preservationRank = (card) => {
      const effects = cardEffects?.buildPlayEffects?.(card) || [];
      if (effects.some((effect) => effect?.type === cardEffects.EFFECT_TYPES.RESEARCH_TECH)) return 4;
      if (effects.some((effect) => [
        cardEffects.REWARD_TYPES.LAUNCH,
        cardEffects.EFFECT_TYPES.INCOME,
        cardEffects.EFFECT_TYPES.TUCK_PLAYED_CARD_TO_INCOME,
      ].includes(effect?.type))) return 3;
      if (effects.some((effect) => String(effect?.type || "").includes("scan"))) return 2;
      if (movementPointsFromCard(card) > 0) return 1;
      return 0;
    };
    const corners = successors.filter((action) => (
      action.family === "card_corner"
      && plans.some((plan) => (
        plan.kind === "card_corner"
        && String(action.target?.cardInstanceId) === String(plan.cardInstanceId)
      ))
    )).sort((left, right) => (
      preservationRank(cardById.get(String(left.target?.cardInstanceId)))
      - preservationRank(cardById.get(String(right.target?.cardInstanceId)))
      || String(left.actionId).localeCompare(String(right.actionId))
    ));
    return corners.slice(0, 1);
  }

  function selectBlueTechPlan(plans, computerPlacedCount) {
    const requiredComputerSlotByBlueSlot = { 1: 1, 2: 3, 3: 5, 4: 6 };
    return [...plans].sort((left, right) => {
      const leftRequired = requiredComputerSlotByBlueSlot[finite(left.blueSlot)] || 99;
      const rightRequired = requiredComputerSlotByBlueSlot[finite(right.blueSlot)] || 99;
      return Math.max(0, leftRequired - computerPlacedCount)
        - Math.max(0, rightRequired - computerPlacedCount)
        || leftRequired - rightRequired
        || String(left.planId).localeCompare(String(right.planId));
    })[0] || null;
  }

  // 科技评分（2026-08-18 用户裁决"给每个科技设定一个基础分数 + 单次利用价值 *
  // 预期使用次数，按总分取 top 3 做尝试"）：废弃硬编码场景规则（preferred/fallback
  // 按 probe/scan/sector 布尔过滤，导致 blue3/blue4/orange3/purple1 等永远不可见），
  // 改为每个科技按真实效果打分，搜索覆盖由价值排序决定（top 3 尝试，其余不评估）。
  // **不预估即时收益**（背面 bonus 随机翻到什么就是什么、首发分有就有没有就没有、
  // 扣 6 宣传）——这些由反事实搜索执行研究动作时**真实结算**进叶价值（evaluateState
  // 捕获实际 realizedScore/资源/科技），预筛只编码"反事实浅搜索看不到的未来价值"。
  // 科技分三类（2026-08-18 用户纠正）：
  //   1) **持续收益类**：每次使用都省钱/产资源 → 单次利用价值 × 预期使用次数
  //      blue1-4 数据槽（每槽 +1 资源）；orange2 移动自由（省绕路）；orange3 登陆-1能；
  //      purple4 扫描后发射/移动
  //   2) **一次性解锁类**：研究即解锁能力，无持续消耗 → 只有一次性解锁价值
  //      orange1 火箭上限 1→2；orange4 卫星登陆解锁——**没有"每次使用"收益**，
  //      不该用单次价值×次数算（用户纠正：橙1没有持续收益，应该只有基础分）
  //   3) **灵活性/有代价**：多一个选项但收益不变或消耗资源 → 价值很低
  //      purple1 扇区扫描升级（灵活性，收益可能完全不变）；purple2 水星扫描
  //      （多一个扫描目标）；purple3 手牌扫描（手牌是宝贵资源转换手段，换扫描
  //      不一定多赚，反而少了高效把钱转资源的渠道）
  // 一次性解锁价值（研究即得的固定收益，不乘次数）：
  const TECH_UNLOCK_VALUE = Object.freeze({
    orange1: 15, // 火箭上限 1→2（解锁第 2 探测器，一次性；用户纠正：橙1没有持续收益）
  });
  // 单次利用价值（每次使用该科技效果的价值，按 INCOME_UNIT_VALUES/行动收益校准）：
  //   blue1 槽 +1信用=8；blue2 槽 +1能量=10；blue3 槽选牌=6；blue4 槽 +2宣传=8
  //   orange2 无视小行星移动=6/次；orange3 登陆能量-1=10/次
  //   purple2 水星扫描：1 宣传 → 额外扇区信号 + 数据（真实收益，可跳过）
  //     = 数据 4 + 扇区信号 3 ≈ 7（用户纠正：紫2是收益不是纯灵活性）
  //   purple4 扫描后发射/移动=6/次
  //   purple1（改进扇区扫描=灵活性，收益可能完全不变）/ purple3（手牌扫描=
  //   消耗宝贵手牌，换扫描不一定赚）价值 0（用户纠正）
  const TECH_USE_VALUE = Object.freeze({
    blue1: 8, blue2: 10, blue3: 6, blue4: 8,
    orange1: 0, orange2: 6, orange3: 10, orange4: 0,
    purple1: 0, purple2: 7, purple3: 0, purple4: 6,
  });
  // 预期使用次数基准（每轮该科技效果被使用的期望次数；乘以剩余轮次折算）。
  // 未研究前按场景相关度估算：探测/登陆/扫描/数据位槽的活跃度。
  // 一次性解锁（orange1）和灵活性（purple1/purple3）无持续次数（0）。
  const TECH_USES_PER_ROUND = Object.freeze({
    blue1: 1.5, blue2: 1.5, blue3: 0.8, blue4: 0.6,   // 数据位槽（填轨活跃时高）
    orange1: 0, orange2: 1.5, orange3: 1.2, orange4: 0, // 探测/登陆
    purple1: 0, purple2: 0.8, purple3: 0, purple4: 1,    // 扫描
  });
  // 场景相关度权重（0-1）：该科技效果在当前盘面是否活跃。
  //   blue：数据位槽依赖"有数据可填轨"（availableData/填轨活跃）
  //   orange：探测相关（launch/move/land 目标）、卫星解锁（卫星可达）
  //   purple：扫描相关（数据获取需扫描/扇区目标）
  function techScenarioWeight(tileId, observation, context) {
    const dataReq = context?.dataRequirements;
    const probeCandidates = context?.probeCandidates || [];
    const sectorReq = context?.sectorRequirements;
    const assets = context?.assets || {};
    const scanRelevant = Boolean(
      (dataReq?.acquisitionPlans || []).some((plan) => plan.kind === "scan")
      || (sectorReq?.accessSources || []).some((source) => source.family === "scan")
    );
    const probeRelevant = probeCandidates.some((candidate) => (
      ["launch", "move"].includes(candidate.nextStep?.family)
    ));
    const landRelevant = probeCandidates.some((candidate) => (
      String(candidate.targetId || "").startsWith("land:")
    ));
    const satelliteRelevant = probeCandidates.some((candidate) => (
      candidate.endpointTarget?.type === "satellite"
      || String(candidate.targetId || "").includes(":satellite:")
    ));
    const blueActive = finite(assets.availableData) > 0
      || Boolean(dataReq?.computerPlacedCount > 0)
      || Boolean((dataReq?.acquisitionPlans || []).length);
    const type = String(tileId).replace(/[0-9]+$/, "");
    if (type === "blue") return blueActive ? 1 : 0.3;
    if (type === "orange") {
      if (tileId === "orange1") return probeRelevant ? 0.8 : 0.4;
      if (tileId === "orange2") return probeRelevant ? 1 : 0.4;
      if (tileId === "orange3") return landRelevant ? 1 : 0.3;
      if (tileId === "orange4") return satelliteRelevant ? 1 : 0.2;
    }
    if (type === "purple") {
      if (tileId === "purple1" || tileId === "purple2" || tileId === "purple4") {
        return scanRelevant ? 0.9 : 0.4;
      }
      if (tileId === "purple3") return scanRelevant ? 0.7 : 0.3;
    }
    return 0.5;
  }

  function selectHeuristicTechPlans(observation) {
    const requirements = rawTechGainRequirements(observation);
    const allPlans = requirements?.plans || [];
    if (!allPlans.length) return [];
    const dataRequirements = rawDataAnalyzeRequirements(observation);
    const computerPlacedCount = finite(dataRequirements?.computerPlacedCount);
    const plansByTile = new Map();
    for (const plan of allPlans) {
      const tilePlans = plansByTile.get(plan.tileId) || [];
      tilePlans.push(plan);
      plansByTile.set(plan.tileId, tilePlans);
    }
    const planByTile = new Map();
    for (const [tileId, plans] of plansByTile) {
      const selected = String(tileId).startsWith("blue")
        ? selectBlueTechPlan(plans, computerPlacedCount)
        : [...plans].sort((left, right) => (
          String(left.planId).localeCompare(String(right.planId))
        ))[0];
      if (selected) planByTile.set(tileId, selected);
    }

    const assets = resourceFactsOf(observation, requirements.playerId);
    const probeCandidates = rawProbeRequirements(observation)?.candidates || [];
    const sectorRequirements = rawSectorWinRequirements(observation);
    // 剩余轮次（研究科技的未来收益窗口）
    const roundNumber = Math.max(1, finite(
      observation?.outcomeProjection?.progress?.roundNumber,
    ) || 1);
    const finalRoundNumber = Math.max(1, finite(
      observation?.outcomeProjection?.progress?.finalRoundNumber,
    ) || 4);
    const remainingRounds = Math.max(0, finalRoundNumber - roundNumber + 1);

    const context = { dataRequirements, probeCandidates, sectorRequirements, assets };
    // 每个科技打分（2026-08-18 用户纠正三类）：
    //   持续收益 = 单次利用价值 × 预期使用次数 × 场景权重 × 剩余轮次
    //   一次性解锁 = 解锁价值（不乘次数/轮次——研究即得的固定收益）
    //   灵活性/有代价 = 0（purple1/purple3：收益可能不变或消耗手牌，不一定赚）
    //   orange4 卫星登陆解锁 = **条件性有限收益**（用户纠正：橙4解锁后才允许卫星
    //     登陆，但本身也能登陆/环绕本星；不是所有行星都有卫星；卫星槽位会被占、
    //     每颗卫星只能登陆一次）——价值 = 可达卫星目标数 × 单颗卫星增量收益
    //     （卫星登陆 8-12 分 vs 不登陆，保守 8）× 场景权重，**不乘每轮次数**
    //     （每颗卫星一次性）
    // 即时收益（背面 bonus/首发分/扣宣传）不预估——反事实搜索真实结算进叶价值。
    const reachableSatelliteCount = probeCandidates.filter((candidate) => (
      candidate.endpointTarget?.type === "satellite"
      || String(candidate.targetId || "").includes(":satellite:")
    )).length;
    const scored = [...planByTile.values()]
      .map((plan) => {
        const tileId = plan.tileId;
        const weight = techScenarioWeight(tileId, observation, context);
        const useValue = Number(TECH_USE_VALUE[tileId]) || 0;
        const usesPerRound = Number(TECH_USES_PER_ROUND[tileId]) || 0;
        const unlockValue = Number(TECH_UNLOCK_VALUE[tileId]) || 0;
        // 持续收益 × 次数（未来效率）；一次性解锁只算解锁价值（乘场景权重）
        const useScore = useValue * usesPerRound * remainingRounds * weight;
        // 橙4：条件性有限收益（可达卫星数 × 单颗卫星价值 × 权重）
        const orange4Score = tileId === "orange4"
          ? reachableSatelliteCount * 8 * weight
          : 0;
        const total = useScore + unlockValue * weight + orange4Score;
        return { plan, tileId, total, useScore, unlockValue, orange4Score };
      })
      .sort((left, right) => (
        right.total - left.total
        || String(left.tileId).localeCompare(String(right.tileId))
      ));
    // 取 top 3 尝试（用户裁决；其余科技不评估，避免全放开稀释搜索）
    return scored.slice(0, 3).map((entry) => entry.plan);
  }

  function enumerateSecondaryAgentRootTargets(input = {}) {
    const legalActions = [...(input.legalActions || [])]
      .sort((left, right) => String(left.actionId).localeCompare(String(right.actionId)));
    const legalIds = new Set(legalActions.map((action) => action.actionId));
    const targets = new Map();
    function add(targetId, planId, actions, resultTargetIds = [targetId]) {
      const compatibleActionIds = [...new Set(actions
        .map((action) => action?.actionId)
        .filter((actionId) => legalIds.has(actionId)))]
        .sort();
      if (!compatibleActionIds.length) return;
      const key = String(planId);
      const existing = targets.get(key) || {
        targetId,
        planId,
        resultTargetIds: [],
        compatibleActionIds: [],
      };
      if (existing.targetId !== targetId) {
        throw new TypeError(`次级目标计划 ${planId} 绑定了多个完成目标`);
      }
      targets.set(key, {
        ...existing,
        resultTargetIds: [...new Set([
          ...existing.resultTargetIds,
          ...resultTargetIds.filter(Boolean),
        ])].sort(),
        compatibleActionIds: [...new Set([
          ...existing.compatibleActionIds,
          ...compatibleActionIds,
        ])].sort(),
      });
    }

    const reachableProbeGoals = (rawProbeRequirements(input.rootObservation)?.candidates || [])
      .filter((goal) => probeGoalResourceReachable(
        input.rootObservation,
        goal,
        input.focalSeatId,
      ));
    const paretoProbeGoals = reachableProbeGoals.filter((goal, index, goals) => (
      !goals.some((other, otherIndex) => (
        otherIndex !== index && probeRouteDistanceDominates(other, goal)
      ))
    ));
    const probeGoals = selectHeuristicProbeGoals(input.rootObservation, paretoProbeGoals);
    function probePlanActions(goal) {
      const exact = legalActions.filter((action) => (
        actionMatchesProbeStep(action, goal.nextStep)
      ));
      // 打牌 spawn 的免费发射可作为探测的发射步骤：用户 405 档打 b_117
      // （LAUNCH skipCost 免费发射 +2 宣传）→ 免费探测 + 攒宣传研究科技。
      // 此前探测目标只认 launch 行动，打牌发射完全不可见（AI 评估 b_117
      // 无探测价值，只算宣传 3.33，选 launch 103 而非打牌）。
      // 即使 launch 本身可选也把免费发射牌并列：免费发射 = 探测链价值 + 省
      // 发射费 + 牌面宣传，理应优于付费 launch（用户 R1 打 b_117 而非 launch）。
      let launchCards = [];
      if (goal?.nextStep?.family === "launch") {
        launchCards = legalActions.filter((action) => (
          action.family === "play_card"
          && cardHasFreeLaunch(input.rootObservation, action)
        ));
      }
      const movementCards = selectProbeMovementCards(
        input.rootObservation,
        goal,
        legalActions,
      );
      const resourcePreparation = exact.length
        ? []
        : selectMinimumCostResourcePreparation(
          input.rootObservation,
          goal.required || {},
          legalActions,
          input.focalSeatId,
        );
      return [...exact.slice(0, 1), ...launchCards, ...movementCards, ...resourcePreparation];
    }
    for (const goal of probeGoals) {
      const contributesToAnalyze = dataAnalyzeEligible(
        rawDataAnalyzeRequirements(input.rootObservation),
      ) && (rawDataAnalyzeRequirements(input.rootObservation)?.acquisitionPlans || [])
        .some((plan) => (
          plan.kind === "probe"
          && plan.probeRequirementId === goal.requirementId
        ));
      add(
        goal.targetId,
        `probe:${goal.requirementId || goal.targetId}`,
        probePlanActions(goal),
        contributesToAnalyze
          ? [goal.targetId, DATA_ANALYZE_ROUTE_TARGET]
          : [goal.targetId],
      );
    }

    const dataRequirements = rawDataAnalyzeRequirements(input.rootObservation);
    if (dataAnalyzeEligible(dataRequirements)) {
      if (["place_data", "analyze"].includes(dataRequirements.nextStep)) {
        const requiredAction = legalActions.find((action) => (
          action.family === dataRequirements.nextStep
        ));
        // data:analyze 目标候选 = 统一 place_data 触发判定（溢出/缺口→蓝槽、
        // 目标 active→填第一排）+ requiredAction（place_data/analyze）兜底。
        // 触发式收敛（只返回触发选项）曾改变搜索评估链致全局分数 84.5→74.75，
        // 回退为 requiredAction 兜底（候选挂上，由搜索本身评估）。
        const placement = selectDataPlacementChoice(
          input.rootObservation,
          legalActions,
          input.focalSeatId,
        ) || [];
        const candidates = [
          ...(placement.length ? placement : []),
          ...(requiredAction ? [requiredAction] : selectDataResourcePreparation(
            input.rootObservation,
            legalActions,
            input.focalSeatId,
          )),
        ];
        if (candidates.length) {
          add(DATA_ANALYZE_ROUTE_TARGET, `data:${dataRequirements.nextStep}`, candidates);
        }
      }
      for (const plan of dataRequirements.acquisitionPlans || []) {
        if (!["scan", "card", "card_corner"].includes(plan.kind)) continue;
        let actions = [];
        if (plan.kind === "scan") {
          const scan = legalActions.find((action) => action.family === "scan");
          actions = scan
            ? [scan]
            : selectMinimumCostResourcePreparation(
              input.rootObservation,
              plan.nextCost || {},
              legalActions,
              input.focalSeatId,
            );
        } else if (plan.kind === "card") {
          actions = legalActions.filter((action) => (
            action.family === "play_card"
            && String(action.target?.cardInstanceId) === String(plan.cardInstanceId)
          ));
        } else if (plan.kind === "card_corner") {
          actions = legalActions.filter((action) => (
            action.family === "card_corner"
            && String(action.target?.cardInstanceId) === String(plan.cardInstanceId)
          ));
        }
        add(
          DATA_ANALYZE_ROUTE_TARGET,
          plan.planId,
          actions,
          plan.kind === "card"
            ? [DATA_ANALYZE_ROUTE_TARGET]
            : (plan.resultTargetIds || [DATA_ANALYZE_ROUTE_TARGET]),
        );
      }
    }

    const sectorRequirements = rawSectorWinRequirements(input.rootObservation);
    if (sectorRequirements) {
      const candidatesById = new Map((sectorRequirements.candidates || []).map((candidate) => [
        candidate.sectorId,
        candidate,
      ]));
      for (const source of sectorRequirements.accessSources || []) {
        const accessible = (source.sectorIds || [])
          .map((sectorId) => candidatesById.get(sectorId))
          .filter(Boolean)
          .sort((left, right) => (
            left.minimumOwnMarks - right.minimumOwnMarks
            || left.openSlotCount - right.openSlotCount
            || left.sectorId.localeCompare(right.sectorId)
          ));
        const candidate = accessible[0];
        if (!candidate) continue;
        if (source.family === "scan") {
          const scan = legalActions.find((action) => action.family === "scan");
          const preparation = scan
            ? [scan]
            : selectMinimumCostResourcePreparation(
              input.rootObservation,
              sectorRequirements.standardScanCost || {},
              legalActions,
              input.focalSeatId,
            );
          add(
            candidate.targetId,
            `sector:${source.sourceId}:${candidate.sectorId}`,
            preparation,
          );
        } else if (source.family === "play_card") {
          add(
            candidate.targetId,
            `sector:${source.sourceId}:${candidate.sectorId}`,
            legalActions.filter((action) => (
              action.family === "play_card"
              && String(action.target?.cardInstanceId) === String(source.cardInstanceId)
            )),
          );
        }
      }
    }

    const incomeRequirements = rawIncomeGainRequirements(input.rootObservation);
    if (incomeRequirements) {
      for (const plan of incomeRequirements.plans || []) {
        if (plan.kind === "probe") {
          const probe = probeGoals.find((goal) => (
            goal.requirementId === plan.probeRequirementId
          ));
          if (probe) {
            add(
              probe.targetId,
              plan.planId,
              probePlanActions(probe),
              [probe.targetId, incomeRequirements.targetId],
            );
          }
          continue;
        }
        if (plan.kind === "card") {
          add(
            incomeRequirements.targetId,
            plan.planId,
            legalActions.filter((action) => (
              action.family === "play_card"
              && String(action.target?.cardInstanceId) === String(plan.cardInstanceId)
            )),
            [incomeRequirements.targetId],
          );
          continue;
        }
        let actions = [];
        if (plan.kind === "data") {
          // income 目标的 data 计划：直接挂 nextStep 动作（place_data）候选。
          // 触发式收敛（selectDataPlacementChoice 只返回触发选项）曾改变搜索树
          // 评估链导致全局分叉（步23 白色 play_card→launch、全盘 84.5→57），
          // 回退为 unified 行为——候选挂上，由搜索本身评估。
          const direct = legalActions.find((action) => (
            action.family === plan.nextStep?.family
          ));
          actions = direct
            ? [direct]
            : selectMinimumCostResourcePreparation(
              input.rootObservation,
              plan.nextCost || {},
              legalActions,
              input.focalSeatId,
            );
        } else if (plan.kind === "industry") {
          actions = legalActions.filter((action) => (
            action.family === "industry"
            && String(action.target?.abilityId || action.payload?.abilityId || "")
              === String(plan.abilityId)
          ));
        }
        add(incomeRequirements.targetId, plan.planId, actions);
      }
    }

    const techRequirements = rawTechGainRequirements(input.rootObservation);
    const researchAction = legalActions.find((action) => action.family === "research_tech");
    const techPreparation = researchAction
      ? [researchAction]
      : selectTechPublicityPreparation(
        input.rootObservation,
        legalActions,
        input.focalSeatId,
      );
    for (const plan of selectHeuristicTechPlans(input.rootObservation)) {
      const researchCards = legalActions.filter((action) => (
        cardCanResearchTechPlan(input.rootObservation, action, plan)
      ));
      add(plan.targetId, plan.planId, [...techPreparation, ...researchCards]);
    }

    for (const action of legalActions) {
      if (action.phase === "conditional" || CONDITIONAL_FAMILIES.has(action.family)) {
        add(`decision:${action.actionId}`, `decision:${action.actionId}`, [action]);
        continue;
      }
    }
    const probeByPlanId = new Map(probeGoals.map((goal) => [
      `probe:${goal.requirementId || goal.targetId}`,
      goal,
    ]));
    return [...targets.values()].sort((left, right) => {
      const leftProbe = probeByPlanId.get(left.planId);
      const rightProbe = probeByPlanId.get(right.planId);
      if (leftProbe && rightProbe) {
        return String(probeEndpointFamily(leftProbe)).localeCompare(
          String(probeEndpointFamily(rightProbe)),
        )
          || finite(leftProbe.required?.movementPoints)
            - finite(rightProbe.required?.movementPoints)
          || finite(leftProbe.required?.movementSteps)
            - finite(rightProbe.required?.movementSteps)
          || finite(leftProbe.required?.credits) + finite(leftProbe.required?.energy)
            - finite(rightProbe.required?.credits) - finite(rightProbe.required?.energy)
          || left.targetId.localeCompare(right.targetId)
          || left.planId.localeCompare(right.planId);
      }
      if (leftProbe || rightProbe) return leftProbe ? -1 : 1;
      return left.targetId.localeCompare(right.targetId)
        || left.planId.localeCompare(right.planId);
    });
  }

  function selectSecondaryAgentRootActions(input = {}) {
    const legalActions = input.legalActions || [];
    // 统一搜索：搜索入口 = 目标引导（用户口径"按目标搜索，需要了再做"，乱按打字机的
    // 猴子写不出莎士比亚）——不把全部动作平铺进搜索树稀释主行动深搜。放行规则：
    //   根动作 = 目标目录绑定的动作（probe/data/sector/income/tech 目标下的正式动作
    //   与资源准备），**不再对 quick_trade/card_corner/industry 无条件放行**（2026-08-21
    //   迭代，用户裁定）：补缺口/凑宣传的 quick_trade/card_corner 已作为目标目录的
    //   资源准备动作（probePlanActions/selectMinimumCostResourcePreparation/
    //   selectTechPublicityPreparation 等）进入 compatibleActionIds——目标目录里
    //   没有的动作就是当前没有目标的，不该进深搜（无目标的手段动作进搜索会各自
    //   展开主行动树吃光节点预算：实测白色 R3 17 根（6 card_corner 无条件放行）→
    //   4096 预算耗尽 → 主行动 COUNTERFACTUAL_SEARCH_PRUNED → 只剩 pass 掉分）。
    //   打牌经目标绑定进入（income:card 收入牌 / tech:research 免费科技 / probe:
    //   免费发射 / sector:观测 / data:卡牌），不打散全部 play_card。
    const compatibleActionIds = new Set(enumerateSecondaryAgentRootTargets({
      focalSeatId: input.focalSeatId,
      rootObservation: input.rootObservation,
      legalActions,
      maxProxyDepth: input.maxProxyDepth,
    }).flatMap((target) => target.compatibleActionIds));
    return legalActions.filter((action) => compatibleActionIds.has(action.actionId));
  }

  function probeGoalResourceReachable(observation, goal, seatId) {
    const assets = resourceFactsOf(observation, seatId);
    const requiredCredits = Math.max(0, finite(goal?.required?.credits));
    const requiredEnergy = Math.max(0, finite(goal?.required?.energy));
    const optimisticFlexibleResources = Math.max(
      0,
      finite(assets.ordinaryCards) + finite(assets.availableData),
    );
    const credits = Math.max(
      0,
      finite(assets.credits) + optimisticFlexibleResources,
    );
    const energy = Math.max(
      0,
      finite(assets.energy) + optimisticFlexibleResources,
    );
    const optimisticCardsFromPublicity = Math.floor(
      (
        finite(assets.publicity)
        + Math.max(0, finite(goal?.publicityStops))
      ) / 3,
    );
    const cardPairs = Math.floor(
      (
        finite(assets.ordinaryCards)
        + finite(assets.alienCards)
        + optimisticCardsFromPublicity
      ) / 2,
    );
    for (let cardsForCredits = 0; cardsForCredits <= cardPairs; cardsForCredits += 1) {
      for (
        let cardsForEnergy = 0;
        cardsForEnergy <= cardPairs - cardsForCredits;
        cardsForEnergy += 1
      ) {
        const preparedCredits = credits + cardsForCredits;
        const preparedEnergy = energy + cardsForEnergy;
        for (
          let creditsForEnergy = 0;
          creditsForEnergy <= Math.floor(preparedCredits / 2);
          creditsForEnergy += 1
        ) {
          const afterCredits = preparedCredits - creditsForEnergy * 2;
          const afterEnergy = preparedEnergy + creditsForEnergy;
          if (afterCredits >= requiredCredits && afterEnergy >= requiredEnergy) return true;
        }
        for (
          let energyForCredits = 0;
          energyForCredits <= Math.floor(preparedEnergy / 2);
          energyForCredits += 1
        ) {
          const afterCredits = preparedCredits + energyForCredits;
          const afterEnergy = preparedEnergy - energyForCredits * 2;
          if (afterCredits >= requiredCredits && afterEnergy >= requiredEnergy) return true;
        }
      }
    }
    return false;
  }

  function probeEndpointFamily(goal) {
    return goal?.endpointFamily || String(goal?.targetId || "").split(":")[0];
  }

  function probeRouteDistanceDominates(left, right) {
    if (!left || !right || String(left.targetId) !== String(right.targetId)) return false;
    const leftCost = [
      finite(left.required?.movementPoints),
      finite(left.required?.movementSteps),
      finite(left.required?.credits),
      finite(left.required?.energy),
    ];
    const rightCost = [
      finite(right.required?.movementPoints),
      finite(right.required?.movementSteps),
      finite(right.required?.credits),
      finite(right.required?.energy),
    ];
    const leftBenefit = [
      finite(left.targetBenefit?.grossEquivalentValue),
      finite(left.targetBenefit?.score),
      finite(left.targetBenefit?.incomeCount),
      finite(left.targetBenefit?.dataCount),
      finite(left.publicityStops),
    ];
    const rightBenefit = [
      finite(right.targetBenefit?.grossEquivalentValue),
      finite(right.targetBenefit?.score),
      finite(right.targetBenefit?.incomeCount),
      finite(right.targetBenefit?.dataCount),
      finite(right.publicityStops),
    ];
    const noWorse = leftCost.every((value, index) => value <= rightCost[index])
      && leftBenefit.every((value, index) => value >= rightBenefit[index]);
    const strictlyBetter = leftCost.some((value, index) => value < rightCost[index])
      || leftBenefit.some((value, index) => value > rightBenefit[index]);
    return noWorse && strictlyBetter;
  }

  function compareProbeDistance(left, right) {
    return finite(left.required?.movementPoints) - finite(right.required?.movementPoints)
      || finite(left.required?.movementSteps) - finite(right.required?.movementSteps)
      || finite(left.required?.credits) + finite(left.required?.energy)
        - finite(right.required?.credits) - finite(right.required?.energy)
      || goalValue(right) - goalValue(left)
      || String(left.targetId).localeCompare(String(right.targetId))
      || String(left.requirementId).localeCompare(String(right.requirementId));
  }

  function selectHeuristicProbeGoals(observation, goals) {
    const roundNumber = finite(observation?.outcomeProjection?.progress?.roundNumber) || 1;
    const finalRoundNumber = finite(
      observation?.outcomeProjection?.progress?.finalRoundNumber,
    ) || 4;
    const satellitePlanetIds = new Set([
      "jupiter",
      "saturn",
      ...(roundNumber >= finalRoundNumber ? ["uranus", "neptune"] : []),
    ]);
    const mainPlanetGoals = goals.filter((goal) => (
      String(goal.endpointTarget?.type || "planet") !== "satellite"
    ));
    // 2026-08-21 迭代（用户裁定）：不再过滤 firstRewardSlotOpen=false 的目标——
    // 第一环绕/登陆奖励格被占时，后续格仍有价值（如金星后续格 +6分+收入、0 移动
    // 可立即环绕），是否值得做由反事实估值打分权衡（近的后续格 vs 远的第一格），
    // 不应在目标选择时一刀切丢弃。此前过滤导致免电盘面蓝色丢近目标（金星第一格
    // 被占 → 被迫去海王星 move×14 到不了）→ 探测链废 → 47 分。
    const nearestOrbit = mainPlanetGoals
      .filter((goal) => probeEndpointFamily(goal) === "orbit")
      .sort(compareProbeDistance)[0] || null;
    const nearestLand = mainPlanetGoals
      .filter((goal) => probeEndpointFamily(goal) === "land")
      .sort(compareProbeDistance)[0] || null;
    const satelliteGoals = goals.filter((goal) => (
      String(goal.endpointTarget?.type || "planet") === "satellite"
      && satellitePlanetIds.has(String(goal.planetId || ""))
    )).sort(compareProbeDistance);
    return [nearestOrbit, nearestLand, ...satelliteGoals].filter(Boolean);
  }

  function compareProbeRouteGoals(observation, left, right, seatId) {
    const leftReachable = probeGoalResourceReachable(observation, left, seatId);
    const rightReachable = probeGoalResourceReachable(observation, right, seatId);
    const leftNet = goalValue(left) - gapSize(left);
    const rightNet = goalValue(right) - gapSize(right);
    return Number(rightReachable) - Number(leftReachable)
      || rightNet - leftNet
      || compareGoals(left, right);
  }

  function selectReducedProbeGoal(rootObservation, branchObservation, seatId) {
    const branchGoals = rawProbeRequirements(branchObservation)?.candidates || [];
    return (rawProbeRequirements(rootObservation)?.candidates || [])
      .map((rootGoal) => ({
        rootGoal,
        branchGoal: branchGoals.find((candidate) => candidate.targetId === rootGoal.targetId),
      }))
      .filter(({ rootGoal, branchGoal }) => (
        branchGoal && gapSize(branchGoal) < gapSize(rootGoal)
      ))
      .sort((left, right) => compareProbeRouteGoals(
        branchObservation,
        left.branchGoal,
        right.branchGoal,
        seatId,
      ))[0]?.branchGoal || null;
  }

  function bestProbePotential(requirements) {
    return [...(requirements?.candidates || [])]
      .filter((goal) => finite(goal?.targetBenefit?.score) > 0)
      .sort((left, right) => (
        finite(right.targetBenefit.score) - finite(left.targetBenefit.score)
        || gapSize(left) - gapSize(right)
        || finite(left?.required?.movementSteps) - finite(right?.required?.movementSteps)
        || String(left.requirementId).localeCompare(String(right.requirementId))
      ))[0] || null;
  }

  function evaluateSecondaryAgentSearchPriority(input = {}, parametersInput = {}) {
    const rootFacts = outcomeModel.createStrategicFacts(input.rootObservation, input.focalSeatId);
    const branchFacts = outcomeModel.createStrategicFacts(input.branchObservation, input.focalSeatId);
    const routeTargetIds = [...new Set((input.routeTargetIds || []).filter(Boolean))];
    const completedBoundTarget = routeTargetIds.some((targetId) => (
      completesSecondaryAgentRouteTarget({
        action: input.currentAction,
        targetId,
        focalSeatId: input.focalSeatId,
        rootObservation: input.rootObservation,
        branchObservation: input.branchObservation,
      })
    ));
    const rootDataRequirements = rawDataAnalyzeRequirements(input.rootObservation);
    const branchDataRequirements = rawDataAnalyzeRequirements(input.branchObservation);
    const dataRouteProgress = routeTargetIds.includes(DATA_ANALYZE_ROUTE_TARGET)
      ? Math.max(
        0,
        finite(rootDataRequirements?.remainingPlacements)
          - finite(branchDataRequirements?.remainingPlacements),
      )
      : 0;
    const branchGoalsByTarget = new Map(
      (rawProbeRequirements(input.branchObservation)?.candidates || [])
        .map((goal) => [goal.targetId, goal]),
    );
    const rootGoalsByTarget = new Map(
      (rawProbeRequirements(input.rootObservation)?.candidates || [])
        .map((goal) => [goal.targetId, goal]),
    );
    const boundProbeProgress = routeTargetIds.reduce((best, targetId) => {
      const rootGoal = rootGoalsByTarget.get(targetId);
      const branchGoal = branchGoalsByTarget.get(targetId);
      if (!rootGoal || !branchGoal) return best;
      const rootRemaining = gapSize(rootGoal) + finite(rootGoal.required?.movementSteps);
      const branchRemaining = gapSize(branchGoal) + finite(branchGoal.required?.movementSteps);
      return Math.max(best, rootRemaining - branchRemaining);
    }, 0);
    const strategicValue = evaluateStrategicFactsBreakdown(
      rootFacts,
      branchFacts,
      parametersInput,
    );
    const rootGoals = rawProbeRequirements(input.rootObservation)?.candidates || [];
    const branchGoal = bestProbePotential(rawProbeRequirements(input.branchObservation));
    const matchedRoot = rootGoals
      .filter((goal) => actionMatchesProbeStep(input.currentAction, goal.nextStep))
      .sort(compareGoals)[0] || null;
    const branchSameRoute = matchedRoot
      ? (rawProbeRequirements(input.branchObservation)?.candidates || []).find((goal) => (
        goal.requirementId === matchedRoot.requirementId
        || (matchedRoot.sourceId === "launch" && goal.targetId === matchedRoot.targetId)
      ))
      : null;
    const gapReduction = matchedRoot && branchSameRoute
      ? Math.max(0, gapSize(matchedRoot) - gapSize(branchSameRoute))
      : 0;
    const rootPlaced = finite(rootFacts.dataProgress?.computerPlacedCount);
    const branchPlaced = finite(branchFacts.dataProgress?.computerPlacedCount);
    const rootDataGap = Math.max(
      0,
      6 - rootPlaced - finite(rootFacts.resourceFacts?.availableData),
    );
    const branchDataGap = Math.max(
      0,
      6 - branchPlaced - finite(branchFacts.resourceFacts?.availableData),
    );
    return {
      schemaVersion: "seti-secondary-search-priority-v1",
      sortKey: [
        Number(completedBoundTarget),
        dataRouteProgress + boundProbeProgress,
        strategicValue.primaryValue,
        finite(matchedRoot?.targetBenefit?.score),
        gapReduction,
        Math.max(0, finite(branchFacts.traceCount) - finite(rootFacts.traceCount)),
        Math.max(0, rootDataGap - branchDataGap),
        Math.max(0, branchPlaced - rootPlaced),
        Number(Boolean(branchFacts.dataProgress?.analyzeReady)
          && finite(branchFacts.resourceFacts?.energy) > 0),
        finite(branchGoal?.targetBenefit?.score),
        -finite(branchGoal?.required?.movementSteps),
      ],
    };
  }

  function selectSecondaryAgentRouteTarget(input = {}) {
    if (input.routeTargetId === DATA_ANALYZE_ROUTE_TARGET) {
      // 目标完成判定统一在 completesSecondaryAgentRouteTarget（analyze/place_data
      // 都算推进一步 → 收束），这里不再特判：analyze 完成时 completes 已返回 true，
      // completedGoal 收束后不会继续绑定本目标。
      return rawDataAnalyzeRequirements(input.branchObservation)?.nextStep === "acquire_data"
        ? null
        : DATA_ANALYZE_ROUTE_TARGET;
    }
    const branchFacts = outcomeModel.createStrategicFacts(
      input.branchObservation,
      input.focalSeatId,
    );
    const rootFacts = outcomeModel.createStrategicFacts(
      input.rootObservation,
      input.focalSeatId,
    );
    if (
      String(input.currentAction?.actorId || "") === String(input.focalSeatId || "")
      && (
        input.currentAction?.family === "place_data"
        || branchFacts.dataProgress?.analyzeReady
        || finite(branchFacts.resourceFacts?.availableData)
          > finite(rootFacts.resourceFacts?.availableData)
      )
      && (
        finite(branchFacts.resourceFacts?.availableData) > 0
        || finite(branchFacts.dataProgress?.computerPlacedCount) > 0
      )
      && dataAnalyzeEligible(rawDataAnalyzeRequirements(input.branchObservation))
    ) {
      return DATA_ANALYZE_ROUTE_TARGET;
    }
    const branchGoals = rawProbeRequirements(input.branchObservation)?.candidates || [];
    if (
      input.routeTargetId
      && branchGoals.some((goal) => goal.targetId === input.routeTargetId)
    ) {
      return input.routeTargetId;
    }
    if (
      String(input.currentAction?.actorId || "") !== String(input.focalSeatId || "")
    ) {
      return null;
    }
    if (input.currentAction?.family === "quick_trade") {
      const matchedTradeGoals = (rawProbeRequirements(input.rootObservation)?.candidates || [])
        .filter((goal) => {
          const projected = probeResourceGapAfterTrade(
            input.rootObservation,
            goal,
            input.currentAction,
            input.focalSeatId,
          );
          return projected && projected.after < projected.before
            && branchGoals.some((candidate) => candidate.targetId === goal.targetId);
        })
        .sort((left, right) => {
          const leftBranch = branchGoals.find((candidate) => candidate.targetId === left.targetId);
          const rightBranch = branchGoals.find((candidate) => candidate.targetId === right.targetId);
          return compareProbeRouteGoals(
            input.branchObservation,
            leftBranch,
            rightBranch,
            input.focalSeatId,
          );
        });
      if (matchedTradeGoals.length) return matchedTradeGoals[0].targetId;
    }
    if (input.currentAction?.family === "card_corner") {
      return selectReducedProbeGoal(
        input.rootObservation,
        input.branchObservation,
        input.focalSeatId,
      )?.targetId || null;
    }
    if (!["launch", "move", "orbit", "land"].includes(input.currentAction?.family)) return null;
    const matched = (rawProbeRequirements(input.rootObservation)?.candidates || [])
      .filter((goal) => actionMatchesProbeStep(input.currentAction, goal.nextStep))
      .filter((goal) => {
        const branchGoal = branchGoals.find((candidate) => (
          candidate.targetId === goal.targetId
        ));
        return Boolean(branchGoal);
      })
      .sort((left, right) => {
        const leftBranch = branchGoals.find((candidate) => candidate.targetId === left.targetId);
        const rightBranch = branchGoals.find((candidate) => candidate.targetId === right.targetId);
        return compareProbeRouteGoals(
          input.branchObservation,
          leftBranch,
          rightBranch,
          input.focalSeatId,
        );
      })[0] || null;
    return matched?.targetId || null;
  }

  function unfinishedTaskDistinguishesAlienSlot(observation, traceType) {
    const distributionConditionTypes = new Set([
      "allAliensHaveTrace",
      "allAliensHavePlayerTrace",
      "singleAlienTraceSet",
      "singleAlienTraceCount",
    ]);
    for (const card of observation?.selfState?.reservedCards || []) {
      const model = cardEffects.getCardModel(card);
      if (!model?.tasks?.length) continue;
      const completedTaskIds = new Set(card?.cardEffectState?.completedTaskIds || []);
      for (const task of model.tasks) {
        if (completedTaskIds.has(task.id)) continue;
        const condition = task?.condition || {};
        if (!distributionConditionTypes.has(condition.type)) continue;
        if (
          condition.traceType != null
          && String(condition.traceType) !== String(traceType)
        ) {
          continue;
        }
        if (
          Array.isArray(condition.traceTypes)
          && condition.traceTypes.length
          && !condition.traceTypes.includes(traceType)
        ) {
          continue;
        }
        return true;
      }
    }
    return false;
  }

  function gainDominates(left, right) {
    const keys = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);
    let strictlyBetter = false;
    for (const key of keys) {
      const leftValue = finite(left?.[key]);
      const rightValue = finite(right?.[key]);
      if (leftValue < rightValue) return false;
      if (leftValue > rightValue) strictlyBetter = true;
    }
    return strictlyBetter;
  }

  function sameGain(left, right) {
    const keys = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);
    return [...keys].every((key) => finite(left?.[key]) === finite(right?.[key]));
  }

  function selectUnrevealedAlienTraceChoices(observation, successors) {
    if (!successors.length || !successors.every((action) => (
      action.family === "choose_target"
      && action.target?.kind === "planet-reward-alien-trace"
      && action.target?.speciesId == null
      && action.target?.position == null
    ))) {
      return [];
    }
    const traceTypes = new Set(successors.map((action) => String(action.target?.traceType || "")));
    if (traceTypes.size !== 1) return [];
    const slots = observation?.publicState?.board?.aliens?.slots
      || observation?.publicState?.aliens?.slots;
    if (!Array.isArray(slots)) return [];
    const choices = successors.map((action) => {
      const alienSlotId = Math.round(finite(action.target?.alienSlotId));
      const slot = slots[alienSlotId - 1];
      const trace = slot?.traces?.[action.target?.traceType];
      if (!slot || slot.revealed || !trace) return null;
      const reward = trace.firstPlaced
        ? alienState.getExtraTraceReward()
        : alienState.getFirstTraceRewardForSlot(alienSlotId);
      if (!reward?.gain) return null;
      return { action, gain: reward.gain };
    });
    if (choices.some((choice) => choice == null)) return [];
    const traceType = successors[0].target.traceType;
    if (unfinishedTaskDistinguishesAlienSlot(observation, traceType)) return successors;

    const nonDominated = choices.filter((choice, index) => !choices.some((
      other,
      otherIndex,
    ) => otherIndex !== index && gainDominates(other.gain, choice.gain)));
    const selected = [];
    for (const choice of nonDominated) {
      if (selected.some((existing) => sameGain(existing.gain, choice.gain))) continue;
      selected.push(choice);
    }
    return selected.map((choice, index) => ({
      ...choice.action,
      ...(index === 0 && selected.length < nonDominated.length
        ? { targetEquivalentChoiceCount: nonDominated.length - selected.length }
        : {}),
    }));
  }

  function selectSecondaryAgentSuccessors(input = {}) {
    const successors = [...(input.legalSuccessors || [])]
      .sort((left, right) => String(left.actionId).localeCompare(String(right.actionId)));
    if (!successors.length) return [];
    const bindRoute = (
      actions,
      routeTargetId,
      routePlanId,
      routeResultTargetIds = input.routeResultTargetIds,
    ) => actions.map((action) => ({
      ...action,
      routeTargetId: routeTargetId || null,
      routePlanId: routePlanId || null,
      routeResultTargetIds: [...(routeResultTargetIds || (
        routeTargetId ? [routeTargetId] : []
      ))],
    }));
    const focalSeatId = String(input.focalSeatId || "");
    const actorId = String(successors[0]?.actorId || "");
    const targetUsesFungibleResources = input.routeTargetId === DATA_ANALYZE_ROUTE_TARGET
      || String(input.routeTargetId || "").startsWith("sector:win:")
      || String(input.routePlanId || "").startsWith("probe:")
      || input.routePlanId === "income:data:computer-slot-4"
      // 探测行动目标（直接环绕/登陆/移动）：支付是移动/环绕的资源成本（能量/移动牌/
      // 弃牌），与卡牌身份无关，等价可折叠。此前只认 probe:/data:/sector:/income 前缀，
      // 直接环绕/登陆目标（routePlanId 形如 orbit:.../land:...）的弃牌折叠不命中，
      // conditional 分支落到默认"全部返回"→ 弃牌选项指数展开（实测 3043 节点）。
      // card:/decision: 等卡牌身份目标仍保持全部 choice（弃哪张卡影响结算，不等价）。
      || String(input.routeTargetId || "").startsWith("orbit:")
      || String(input.routeTargetId || "").startsWith("land:")
      || String(input.routeTargetId || "").startsWith("move:");
    const continueBoundTargetNextTurn = (routePlanId = input.routePlanId) => {
      const endTurn = successors.find((action) => action.family === "end_turn");
      return bindRoute(
        endTurn ? [endTurn] : [],
        input.routeTargetId,
        routePlanId,
      );
    };
    if (actorId === focalSeatId) {
      const terminalHandIdentityChoices = !input.routeTargetId
        && successors[0]?.phase === "conditional"
        && successors.every((action) => (
          action.family === "choose_card"
          && ["pass-reserve-card", "pass-hand-limit"].includes(action.target?.kind)
        ));
      if (terminalHandIdentityChoices) {
        return bindRoute(successors.slice(0, 1), null, null, [])
          .map((action) => ({
            ...action,
            targetEquivalentChoiceCount: successors.length - 1,
          }));
      }
      // 未绑定分支的 conditional 不展开支付/选牌细节。弃牌付费、移动支付
      // 与交易选牌是纯结算步骤（付同一种资源 / 选哪张牌对未绑定目标等价），对
      // "评估根动作价值"无贡献；逐张展开会 toggle 振荡（executeDiscard 语义：
      // 已选→移除，无状态折叠恒选第一张 → selected 在 A↔∅ 间振荡），实测
      // choose_payment 单决策 2515→3042 节点吃光 4096 预算。未绑定分支价值由
      // "根动作 + 前几层 + PASS 叶 + 重新绑定目标"体现（rule-composition 未绑定
      // 分支浅尝 ≤3 层），支付细节直接 return [] 让 origin 收束（被尝试过）。
      // 绑定目标分支的弃牌仍走 routeTargetId 分支的折叠（会话少，够用）。
      if (
        !input.routeTargetId
        && successors[0]?.phase === "conditional"
      ) {
        const settlementOnly = (
          successors.every((action) => action.family === "choose_payment")
          || successors.every((action) => (
            action.family === "choose_card"
            && action.target?.kind === "trade-card-selection"
          ))
        );
        if (settlementOnly) {
          return [];
        }
      }
      if (!input.routeTargetId) {
        const targetCatalog = enumerateSecondaryAgentRootTargets({
          focalSeatId,
          rootObservation: input.branchObservation,
          legalActions: successors,
          maxProxyDepth: input.maxProxyDepth,
        });
        const legalById = new Map(successors.map((action) => [action.actionId, action]));
        function targetResourceLowerBound(target) {
          const probe = (rawProbeRequirements(input.branchObservation)?.candidates || [])
            .find((goal) => (
              target.targetId === goal.targetId
              && (
                target.planId === `probe:${goal.requirementId || goal.targetId}`
                || target.planId.startsWith("probe:")
              )
            ));
          if (probe) {
            return [
              finite(probe.required?.movementPoints),
              finite(probe.required?.movementSteps),
              finite(probe.gap?.credits) + finite(probe.gap?.energy),
              finite(probe.gap?.credits),
              finite(probe.gap?.energy),
              target.planId,
            ];
          }
          if (target.targetId === DATA_ANALYZE_ROUTE_TARGET) {
            const requirements = rawDataAnalyzeRequirements(input.branchObservation);
            return [
              finite(requirements?.nextGap?.credits)
                + finite(requirements?.nextGap?.energy)
                + finite(requirements?.remainingPlacements),
              finite(requirements?.nextGap?.credits),
              finite(requirements?.nextGap?.energy),
              finite(requirements?.remainingPlacements),
              target.planId,
            ];
          }
          if (String(target.targetId).startsWith("sector:win:")) {
            const sectorId = target.targetId.split(":")[2];
            const requirements = rawSectorWinRequirements(input.branchObservation);
            const candidate = (requirements?.candidates || []).find((entry) => (
              String(entry.sectorId) === sectorId
            ));
            const marks = finite(candidate?.minimumOwnMarks);
            const cost = requirements?.standardScanCost || {};
            return [
              marks * (finite(cost.credits) + finite(cost.energy)),
              marks * finite(cost.credits),
              marks * finite(cost.energy),
              marks,
              target.planId,
            ];
          }
          const actionCosts = target.compatibleActionIds
            .map((actionId) => legalById.get(actionId)?.payload?.cost || {})
            .map((cost) => ({
              total: finite(cost.credits)
                + finite(cost.energy)
                + finite(cost.publicity)
                + finite(cost.handSize),
              credits: finite(cost.credits),
              energy: finite(cost.energy),
              handSize: finite(cost.handSize),
            }))
            .sort((left, right) => (
              left.total - right.total
              || left.credits - right.credits
              || left.energy - right.energy
              || left.handSize - right.handSize
            ));
          const best = actionCosts[0] || {};
          return [
            finite(best.total),
            finite(best.credits),
            finite(best.energy),
            finite(best.handSize),
            target.planId,
          ];
        }
        const scheduledCatalog = (
          input.focalProxyDepth > 0
          && targetCatalog.length
          && input.completeTargetCatalog !== true
        )
          ? [[...targetCatalog].sort((left, right) => {
            const leftKey = targetResourceLowerBound(left);
            const rightKey = targetResourceLowerBound(right);
            for (let index = 0; index < leftKey.length; index += 1) {
              if (leftKey[index] !== rightKey[index]) {
                return typeof leftKey[index] === "number"
                  ? leftKey[index] - rightKey[index]
                  : String(leftKey[index]).localeCompare(String(rightKey[index]));
              }
            }
            return 0;
          })[0]]
          : targetCatalog;
        const targeted = scheduledCatalog.flatMap((target) => (
          target.compatibleActionIds.map((actionId) => ({
            ...legalById.get(actionId),
            routeTargetId: target.targetId,
            routePlanId: target.planId,
            routeResultTargetIds: target.resultTargetIds,
          }))
        ));
        const targetSchedulerPrunedCount = targetCatalog.length - scheduledCatalog.length;
        if (targeted.length && targetSchedulerPrunedCount > 0) {
          targeted[0] = {
            ...targeted[0],
            targetSchedulerPrunedCount,
          };
        }
        const controls = successors
          .filter((action) => CONTROL_FAMILIES.has(action.family))
          .map((action) => ({
            ...action,
            routeTargetId: null,
            routePlanId: null,
            routeResultTargetIds: [],
          }));
        // 统一搜索：把"只留目标绑定动作"的后继门控改为"targeted + 未绑定后继（按
        // 立即价值截断 top-K）+ controls"合并返回——搜索在每个节点都能尝试所有动作，
        // 覆盖不再受目标清单限制；但未绑定后继必须按立即价值截断，否则每层 17 个
        // 后继全展开（分支因子 17，配合未绑定浅尝 3 层仍到 17³ 节点）吃光预算。
        // 优先级由 getBranchPriority 在展开时再排序；此处的 top-K 是"预算内优先级
        // 截断"，低价值后继仍会在根/上层被尝试（见 §3 设计文档）。
        {
          // quick 根截断（2026-08-21 用户口径"需要了再做"恢复，405ee903 误删修正）：
          // 根动作是 quick 时，其叶价值只算立即效果，不搭后续主行动的便车。
          // leafValue 是整链价值（叶状态−根状态，不按动作分摊），quick 根
          // （quick_trade/card_corner/industry 等）展开后若继续主行动选择，链里
          // 主行动的收益被归因到 quick 根上 → 评估虚高 + 每层 quick 分支展开
          // 主行动树吃光预算（实测 4096 预算下 quick_trade 起源 826 节点、主行动
          // research_tech 只分到 8 节点 PRUNED → 全盘 55.75 分）。截断：quick 根
          // 的下一个主行动决策只给 control（end_turn/pass）→ 叶在 quick 完成后
          // 立即形成。405ee903 以"!routeTargetId 误触发有目标 quick 根"为由删除，
          // 实为误删——有目标的 quick 根由 targeted 进入（routeTargetId 非空、
          // targeted.length>0），此处仅截断真正未绑定目标的 quick 根。
          const rootActionId = String((input.actionChain || [])[0] || "");
          const rootFamily = rootActionId.split(":")[0];
          const rootIsQuick = QUICK_ROOT_FAMILIES.has(rootFamily);
          const atMainActionDecision = !(
            successors[0]?.phase === "conditional"
            || CONDITIONAL_FAMILIES.has(successors[0]?.family)
          );
          if (rootIsQuick && atMainActionDecision && !targeted.length) {
            return controls;
          }
          const targetedIds = new Set(targeted.map((action) => action.actionId));
          const untargeted = successors
            .filter((action) => (
              !targetedIds.has(action.actionId)
              && !CONTROL_FAMILIES.has(action.family)
              // 无目标的手段动作不枚举（2026-08-21 用户裁定"无目标 quick_trade/
              // card_corner 非法"贯彻到树内）：它们只该经目标目录资源准备
              // （targeted）进入搜索。untargeted 枚举会让每层每分支都带出同样的
              // 9 个 quick_trade 选项压队（实测单决策排队 826 次、4096 预算耗尽
              // 时占满队列），主行动反而 PRUNED 评估失真（步53 research_tech 只
              // 分到 8 节点 → 全盘 55.75 分）。
              && !UNTARGETED_MEANS_ONLY_FAMILIES.has(action.family)
            ))
            .map((action) => ({
              ...action,
              routeTargetId: null,
              routePlanId: null,
              routeResultTargetIds: [],
            }))
            .sort((left, right) => (
              compareUntargetedSuccessor(right, left, input.branchObservation)
              || String(left.actionId).localeCompare(String(right.actionId))
            ))
            .slice(0, MAX_UNIFIED_SUCCESSORS);
          return [...targeted, ...untargeted, ...controls];
        }
      }
      if (
        successors[0]?.phase === "conditional"
        || CONDITIONAL_FAMILIES.has(successors[0]?.family)
      ) {
        const immediateCardSettlement = successors.every((action) => (
          action.family === "accept_optional_effect"
          && action.target?.kind === "residual-domain"
        ));
        if (immediateCardSettlement) {
          const confirm = successors.find((action) => (
            String(action.target?.choiceId || "").startsWith("confirm:")
          ));
          if (confirm) {
            return bindRoute(
              [confirm],
              input.routeTargetId,
              input.routePlanId,
            ).map((action) => ({
              ...action,
              targetEquivalentChoiceCount: successors.length - 1,
            }));
          }
        }
        // 外星拿牌去掉 cancel（2026-08-21 用户裁定：不可能选取消）——display（拿
        // 已知展示牌）与 blind（盲抽）保留正常反事实评估（不贪心折叠），cancel 从
        // 搜索选项移除（AI 永远不会选取消）。
        const alienPickChoices = successors.filter((action) => (
          action.family === "choose_card"
          && action.target?.kind === "residual-domain"
          && ["display", "blind", "cancel"].includes(action.target?.source)
        ));
        if (alienPickChoices.length && alienPickChoices.length === successors.length) {
          const withoutCancel = alienPickChoices.filter((action) => (
            action.target?.source !== "cancel"
          ));
          if (withoutCancel.length) {
            return bindRoute(withoutCancel, input.routeTargetId, input.routePlanId);
          }
        }
        const alienTraceChoices = selectUnrevealedAlienTraceChoices(
          input.branchObservation,
          successors,
        );
        if (alienTraceChoices.length) {
          return bindRoute(
            alienTraceChoices,
            input.routeTargetId,
            input.routePlanId,
          );
        }
        // 揭示后痕迹位置选择（用户规则：开了外星人优先覆盖"下两行高收益、有外星
        // 人牌"的位置，如阿米巴 3/4 号位给精选外星牌）：选项 summary 带奖励描述
        // （"阿米巴 黄3号位（外星人牌）"），按奖励价值排序——外星人牌/精选牌 >
        // 有分数 > state-extra 冗余位（3 分/枚）> 无奖励。
        const revealedTracePositions = successors.filter((action) => (
          action.family === "choose_target"
          && action.target?.kind === "planet-reward-alien-trace"
          && action.target?.speciesId != null
          && action.target?.position != null
        ));
        if (revealedTracePositions.length === successors.length) {
          const tracePositionValue = (action) => {
            const summary = String(action.summary || "");
            if (summary.includes("外星人牌") || summary.includes("精选牌")) return 3;
            if (/[0-9]分/.test(summary)) return 2;
            if (action.target?.stateExtra) return 1;
            return 0;
          };
          return bindRoute(
            [...revealedTracePositions].sort((left, right) => (
              tracePositionValue(right) - tracePositionValue(left)
              || String(left.actionId).localeCompare(String(right.actionId))
            )),
            input.routeTargetId,
            input.routePlanId,
          );
        }
        // 弃牌等价性只对"资源目标"成立（付的是同一种资源，弃哪张卡不影响达成）；
        // 卡牌身份目标（card:/decision:）的弃牌影响结算，必须保留全部正式 choice。
        const fungiblePaymentChoices = targetUsesFungibleResources
          && successors.every((action) => (
            action.family === "choose_payment"
            && (
              action.target?.kind === "discard-hand-cards"
              || action.target?.kind === "discard-hand-card"
              || action.target?.kind === "confirm"
            )
          ));
        if (fungiblePaymentChoices) {
          // 振荡控制：弃牌会话是无状态折叠的陷阱——折叠恒选"第一张卡"，展开后
          // 规则把该卡加入 selected，下一层仍是同一弃牌决策，折叠又选同一张卡，
          // 规则语义"已选→移除"（toggle）→ selected 在 A↔∅ 间振荡，永不满
          // required，confirm 永远无法提交 → 一个弃牌会话无限消耗节点（统一搜索
          // 实测 3043 个 choose_payment 节点吃光 4096 预算）。同一会话的延续层
          // （actionChain 末尾已是 choose_payment）直接 return [] 收束：每个弃牌
          // 会话最多展开 1 层代表（被尝试过），不做完整逐张结算。
          const lastActionFamily = String(
            (input.actionChain || []).at(-1) || "",
          ).split(":")[0];
          if (lastActionFamily === "choose_payment") {
            return [];
          }
          const pickCard = successors.find((action) => (
            action.target?.kind === "discard-hand-card"
          ));
          const representative = pickCard || successors[0];
          return bindRoute(
            [representative],
            input.routeTargetId,
            input.routePlanId,
          ).map((action) => ({
            ...action,
            targetEquivalentChoiceCount: successors.length - 1,
          }));
        }
        const fungibleTradeCardChoices = targetUsesFungibleResources
          && successors.every((action) => (
            action.family === "choose_card"
            && action.target?.kind === "trade-card-selection"
          ));
        if (fungibleTradeCardChoices) {
          return bindRoute(
            successors.slice(0, 1),
            input.routeTargetId,
            input.routePlanId,
          ).map((action) => ({
            ...action,
            targetEquivalentChoiceCount: successors.length - 1,
          }));
        }
        // 移动支付等价折叠：按 energyCost + 弃牌数分组取代表（同一 energyCost 的
        // 支付路线资源等价，选一张代表即可；不同 energyCost 是不同资源结构，全保留
        // 交给终点评估）。等价性与目标无关（支付多少能量是移动的属性，不是目标
        // 的属性）——此前限定 targetUsesFungibleResources 导致探测路线（orbit/land
        // 目标）的移动支付链每层全展开（每个 move-payment 选项一个分支），depth
        // 5→14 层指数爆炸吃光 4096 预算（unified 实测 choose_payment 3043 节点）。
        const movePaymentChoices = successors.every((action) => (
          action.family === "choose_payment"
          && action.target?.kind === "move-payment"
        ));
        if (movePaymentChoices) {
          const representatives = new Map();
          for (const action of successors) {
            const key = [
              finite(action.payload?.energyCost),
              (action.target?.cardIds || []).length,
            ].join(":");
            if (!representatives.has(key)) representatives.set(key, action);
          }
          const selected = [...representatives.values()];
          return bindRoute(selected, input.routeTargetId, input.routePlanId)
            .map((action, index) => ({
              ...action,
              ...(index === 0 && selected.length < successors.length
                ? { targetEquivalentChoiceCount: successors.length - selected.length }
                : {}),
            }));
        }
        const publicScanDone = successors.find((action) => (
          action.family === "choose_card"
          && (
            action.target?.done === true
            || action.target?.choiceId === "public:done"
          )
        ));
        if (publicScanDone) {
          const assets = resourceFactsOf(input.branchObservation, input.focalSeatId);
          let remainingDataPlacements = null;
          if (input.routeTargetId === DATA_ANALYZE_ROUTE_TARGET) {
            remainingDataPlacements = finite(
              rawDataAnalyzeRequirements(input.branchObservation)?.remainingPlacements,
            );
          } else if (input.routePlanId === "income:data:computer-slot-4") {
            const incomePlan = (rawIncomeGainRequirements(input.branchObservation)?.plans || [])
              .find((plan) => plan.planId === input.routePlanId);
            remainingDataPlacements = incomePlan
              ? finite(incomePlan.remainingPlacements)
              : null;
          }
          if (
            remainingDataPlacements != null
            && finite(assets.availableData) >= remainingDataPlacements
          ) {
            const sectorCandidates = new Map(
              (rawSectorWinRequirements(input.branchObservation)?.candidates || [])
                .map((candidate) => [String(candidate.sectorId), candidate]),
            );
            const scoringOrCompleting = successors.filter((action) => {
              const candidate = sectorCandidates.get(String(action.target?.nebulaId || ""));
              return candidate && (
                finite(candidate.nextSlotScore) > 0
                || finite(candidate.openSlotCount) <= 1
              );
            }).sort((left, right) => {
              const leftCandidate = sectorCandidates.get(String(left.target?.nebulaId || ""));
              const rightCandidate = sectorCandidates.get(String(right.target?.nebulaId || ""));
              return finite(rightCandidate?.nextSlotScore) - finite(leftCandidate?.nextSlotScore)
                || finite(leftCandidate?.openSlotCount) - finite(rightCandidate?.openSlotCount)
                || String(left.actionId).localeCompare(String(right.actionId));
            });
            if (scoringOrCompleting.length) {
              return bindRoute(
                [scoringOrCompleting[0]],
                input.routeTargetId,
                input.routePlanId,
              );
            }
            // B3a（2026-08-14 用户裁决）：数据已足够且没有立即得分/结算放置时，
            // 不再强制"结束公共牌扫描"，落入下方通用扇区逻辑继续放置
            // （仍遵守扇区代表收敛，不展开全部 牌×扇区 组合）。
          }
        }
        if (String(input.routeTargetId || "").startsWith("tech:gain:")) {
          const plan = (rawTechGainRequirements(input.branchObservation)?.plans || [])
            .find((candidate) => candidate.planId === input.routePlanId);
          if (plan) {
            const techChoices = successors.filter((action) => (
              String(action.target?.tileId || "") === String(plan.tileId)
              && (
                plan.blueSlot == null
                || finite(action.target?.blueSlot) === finite(plan.blueSlot)
              )
            ));
            if (techChoices.length) {
              return bindRoute(techChoices, input.routeTargetId, input.routePlanId);
            }
          }
          if (input.currentAction?.family === "place_data") {
            // 放置数据 = 需求驱动的确定性选择（2026-08-21 用户裁定：数据够就填、
            // 不够去拿、拿不到截断；有蓝科时选择不多、不需要暴力搜索枚举）：
            // 统一走 selectDataPlacementChoice——按宣传/收入/钱电/牌缺口折叠出
            // 代表选项（计算机第一排按"从左到右下一空位"单选项，blueBonus 仅在
            // 有蓝科且对应工位资源缺口时入选），而非把 computer+blueBonus 全部
            // 返回让搜索枚举。此前全量返回导致"第一排放置位"在每个中间节点重复
            // 展开（data:analyze 目标链下 choose_target 766+ 节点吃掉 4096 预算
            // 36%），主行动 research_tech 只剩 14 节点 PRUNED 评估失真。
            const dataPlacementChoices = selectDataPlacementChoice(
              input.branchObservation,
              successors,
              input.focalSeatId,
            );
            if (dataPlacementChoices) {
              return dataPlacementChoices.length
                ? bindRoute(dataPlacementChoices, input.routeTargetId, input.routePlanId)
                : [];
            }
          }
        }
        const nebulaChoices = successors.filter((action) => action.target?.nebulaId);
        if (nebulaChoices.length) {
          const boundSectorId = String(input.routeTargetId || "").startsWith("sector:win:")
            ? input.routeTargetId.split(":")[2]
            : null;
          const candidateBySector = new Map(
            (rawSectorWinRequirements(input.branchObservation)?.candidates || [])
              .map((candidate) => [candidate.sectorId, candidate]),
          );
          const availableSectorIds = [...new Set(
            nebulaChoices.map((action) => String(action.target.nebulaId)),
          )];
          const selectedSectorId = boundSectorId && availableSectorIds.includes(boundSectorId)
            ? boundSectorId
            : availableSectorIds.sort((left, right) => {
              const leftCandidate = candidateBySector.get(left);
              const rightCandidate = candidateBySector.get(right);
              if (!leftCandidate && !rightCandidate) return left.localeCompare(right);
              if (!leftCandidate) return 1;
              if (!rightCandidate) return -1;
              return finite(leftCandidate.minimumOwnMarks) - finite(rightCandidate.minimumOwnMarks)
                || finite(leftCandidate.openSlotCount) - finite(rightCandidate.openSlotCount)
                || left.localeCompare(right);
            })[0];
          const selected = nebulaChoices.filter((action) => (
            String(action.target.nebulaId) === selectedSectorId
          ));
          if (selected.length) {
            return bindRoute(
              targetUsesFungibleResources ? selected.slice(0, 1) : selected,
              input.routeTargetId,
              input.routePlanId,
            ).map((action) => ({
              ...action,
              ...(targetUsesFungibleResources && selected.length > 1
                ? { targetEquivalentChoiceCount: selected.length - 1 }
                : {}),
            }));
          }
        }
        if (String(input.routeTargetId || "").startsWith("sector:win:")) {
          const sectorId = input.routeTargetId.split(":")[2];
          const sectorChoices = successors.filter((action) => (
            String(action.target?.nebulaId || "") === sectorId
          ));
          if (sectorChoices.length) {
            return bindRoute(sectorChoices, input.routeTargetId, input.routePlanId);
          }
        }
        if (
          String(input.routeTargetId || "").startsWith("income:gain:")
          && input.routePlanId === "income:data:computer-slot-4"
        ) {
          // 收入目标不耦合 blueBonus（2026-08-21 用户裁定）：要收入就填第一排
          // 第4格，blueBonus/宣传不参与收入目标判断。只返回 computer 单选项，
          // 不展开搜索枚举。
          const computer = successors.filter((action) => (
            action.target?.target === "computer"
          ));
          if (computer.length) {
            return bindRoute(
              computer.slice(0, 1),
              input.routeTargetId,
              input.routePlanId,
            ).map((action, index) => ({
              ...action,
              ...(index === 0 && computer.length > 1
                ? { targetEquivalentChoiceCount: computer.length - 1 }
                : {}),
            }));
          }
        }
        if (input.routeTargetId === DATA_ANALYZE_ROUTE_TARGET) {
          // data:analyze 目标放置 = 统一触发判定（selectDataPlacementChoice：
          // 数据溢出→填、缺钱/电/牌→对应蓝槽、目标 active→填第一排）。
          const dataPlacementChoices = selectDataPlacementChoice(
            input.branchObservation,
            successors,
            input.focalSeatId,
          );
          if (dataPlacementChoices) {
            return dataPlacementChoices.length
              ? bindRoute(dataPlacementChoices, input.routeTargetId, input.routePlanId)
              : [];
          }
        }
        const probeGoal = (rawProbeRequirements(input.branchObservation)?.candidates || [])
          .find((goal) => (
            goal.targetId === input.routeTargetId
          ));
        if (probeGoal?.nextStep?.family === "move") {
          const movementChoices = successors.filter((action) => (
            String(action.target?.rocketId || "") === String(probeGoal.nextStep.rocketId || "")
            && finite(action.target?.deltaX) === finite(probeGoal.nextStep.deltaX)
            && finite(action.target?.deltaY) === finite(probeGoal.nextStep.deltaY)
          ));
          if (movementChoices.length) {
            return bindRoute(
              movementChoices,
              input.routeTargetId,
              `probe:${probeGoal.requirementId || probeGoal.targetId}`,
            );
          }
        }
        return bindRoute(successors, input.routeTargetId, input.routePlanId);
      }
      if (String(input.routeTargetId || "").startsWith("tech:gain:")) {
        const requirements = rawTechGainRequirements(input.branchObservation);
        const plan = (requirements?.plans || []).find((candidate) => (
          candidate.planId === input.routePlanId
        ));
        if (!plan) return [];
        const research = successors.find((action) => action.family === "research_tech");
        if (research) {
          return bindRoute([research], input.routeTargetId, input.routePlanId);
        }
        const preparation = selectTechPublicityPreparation(
          input.branchObservation,
          successors,
          input.focalSeatId,
        );
        if (preparation.length) {
          return bindRoute(preparation, input.routeTargetId, input.routePlanId);
        }
        const assets = resourceFactsOf(input.branchObservation, input.focalSeatId);
        return finite(assets.publicity) >= finite(requirements.researchCost)
          ? continueBoundTargetNextTurn(input.routePlanId)
          : [];
      }
      if (String(input.routeTargetId || "").startsWith("sector:win:")) {
        if (!String(input.routePlanId || "").startsWith("sector:standard-scan:")) return [];
        const requirements = rawSectorWinRequirements(input.branchObservation);
        const scan = successors.find((action) => action.family === "scan");
        if (scan) return bindRoute([scan], input.routeTargetId, input.routePlanId);
        const preparation = selectMinimumCostResourcePreparation(
          input.branchObservation,
          requirements?.standardScanCost || {},
          successors,
          input.focalSeatId,
        );
        if (preparation.length) {
          return bindRoute(preparation, input.routeTargetId, input.routePlanId);
        }
        const assets = resourceFactsOf(input.branchObservation, input.focalSeatId);
        const scanCost = requirements?.standardScanCost || {};
        return finite(assets.credits) >= finite(scanCost.credits)
          && finite(assets.energy) >= finite(scanCost.energy)
          ? continueBoundTargetNextTurn()
          : [];
      }
      if (String(input.routeTargetId || "").startsWith("income:gain:")) {
        const requirements = rawIncomeGainRequirements(input.branchObservation);
        const plan = (requirements?.plans || []).find((candidate) => (
          candidate.planId === input.routePlanId
        ));
        if (!plan) return [];
        if (plan.kind === "card") {
          const play = successors.find((action) => (
            action.family === "play_card"
            && String(action.target?.cardInstanceId) === String(plan.cardInstanceId)
          ));
          return bindRoute(play ? [play] : [], input.routeTargetId, input.routePlanId);
        }
        if (plan.kind === "industry") {
          const industry = successors.find((action) => (
            action.family === "industry"
            && String(action.target?.abilityId || action.payload?.abilityId || "")
              === String(plan.abilityId)
          ));
          return bindRoute(industry ? [industry] : [], input.routeTargetId, input.routePlanId);
        }
        if (plan.kind === "data") {
          const direct = successors.find((action) => action.family === plan.nextStep?.family);
          if (direct) return bindRoute([direct], input.routeTargetId, input.routePlanId);
          const preparation = selectMinimumCostResourcePreparation(
            input.branchObservation,
            plan.nextCost || {},
            successors,
            input.focalSeatId,
          );
          if (preparation.length) {
            return bindRoute(preparation, input.routeTargetId, input.routePlanId);
          }
          const assets = resourceFactsOf(input.branchObservation, input.focalSeatId);
          return finite(assets.credits) >= finite(plan.nextCost?.credits)
            && finite(assets.energy) >= finite(plan.nextCost?.energy)
            ? continueBoundTargetNextTurn()
            : [];
        }
        if (plan.kind === "probe") {
          const goal = (rawProbeRequirements(input.branchObservation)?.candidates || [])
            .find((candidate) => candidate.requirementId === plan.probeRequirementId);
          if (!goal) return [];
          const exact = successors.filter((action) => actionMatchesProbeStep(action, goal.nextStep));
          const movementCards = selectProbeMovementCards(
            input.branchObservation,
            goal,
            successors,
          );
          const deferredMovement = movementCards.length
            ? []
            : preferDeferredProbeMovementCard(
              input.branchObservation,
              goal,
              [],
              successors,
              input.focalSeatId,
            );
          if (exact.length || movementCards.length) {
            return bindRoute(
              [...exact, ...movementCards, ...deferredMovement],
              input.routeTargetId,
              input.routePlanId,
            );
          }
          const preparation = selectMinimumCostResourcePreparation(
            input.branchObservation,
            goal.required || {},
            successors,
            input.focalSeatId,
          );
          return bindRoute(
            preferDeferredProbeMovementCard(
              input.branchObservation,
              goal,
              preparation,
              successors,
              input.focalSeatId,
            ),
            input.routeTargetId,
            input.routePlanId,
          );
        }
        return [];
      }
      if (input.routeTargetId === DATA_ANALYZE_ROUTE_TARGET) {
        const requirements = rawDataAnalyzeRequirements(input.branchObservation);
        if (!dataAnalyzeEligible(requirements)) return [];
        if (["analyze", "place_data"].includes(requirements.nextStep)) {
          const requiredAction = successors.find((action) => (
            action.family === requirements.nextStep
          ));
          if (requiredAction) {
            return bindRoute([requiredAction], input.routeTargetId, input.routePlanId);
          }
          const preparation = selectDataResourcePreparation(
            input.branchObservation,
            successors,
            input.focalSeatId,
          );
          if (preparation.length) {
            return bindRoute(preparation, input.routeTargetId, input.routePlanId);
          }
          const assets = resourceFactsOf(input.branchObservation, input.focalSeatId);
          const cost = requirements.nextCost || {};
          if (
            finite(assets.credits) >= finite(cost.credits)
            && finite(assets.energy) >= finite(cost.energy)
          ) return continueBoundTargetNextTurn();
        }
        if (requirements.nextStep === "acquire_data") {
          const availablePlans = (requirements.acquisitionPlans || [])
            .filter((plan) => ["scan", "card", "card_corner"].includes(plan.kind));
          const exactPlan = availablePlans.find((plan) => (
            plan.planId === input.routePlanId
          ));
          const plans = exactPlan
            ? [exactPlan]
            : availablePlans;
          const selected = [];
          for (const plan of plans) {
            let actions = [];
            if (plan.kind === "scan") {
              const scan = successors.find((action) => action.family === "scan");
              actions = scan
                ? [scan]
                : selectMinimumCostResourcePreparation(
                  input.branchObservation,
                  plan.nextCost || {},
                  successors,
                  input.focalSeatId,
                );
            } else if (plan.kind === "card") {
              actions = successors.filter((action) => (
                action.family === "play_card"
                && String(action.target?.cardInstanceId) === String(plan.cardInstanceId)
              ));
            } else if (plan.kind === "card_corner") {
              actions = successors.filter((action) => (
                action.family === "card_corner"
                && String(action.target?.cardInstanceId) === String(plan.cardInstanceId)
              ));
            }
            selected.push(...bindRoute(
              actions,
              input.routeTargetId,
              plan.planId,
              plan.resultTargetIds,
            ));
          }
          if (selected.length) return selected.filter((action, index, actions) => (
            actions.findIndex((candidate) => (
              candidate.actionId === action.actionId
              && candidate.routePlanId === action.routePlanId
            )) === index
          ));
          return continueBoundTargetNextTurn(input.routePlanId);
        }
        return [];
      }
      const goals = (rawProbeRequirements(input.branchObservation)?.candidates || [])
        .filter((goal) => !input.routeTargetId || (
          goal.targetId === input.routeTargetId
        ));
      if (input.routeTargetId && goals.length) {
        const exact = successors.filter((action) => (
          goals.some((goal) => actionMatchesProbeStep(action, goal.nextStep))
        ));
        const movementCards = goals.flatMap((goal) => selectProbeMovementCards(
          input.branchObservation,
          goal,
          successors,
        )).filter((action, index, actions) => (
          actions.findIndex((candidate) => candidate.actionId === action.actionId) === index
        ));
        const deferredDirectMovement = movementCards.length
          ? []
          : goals.flatMap((goal) => preferDeferredProbeMovementCard(
            input.branchObservation,
            goal,
            [],
            successors,
            input.focalSeatId,
          )).filter((action, index, actions) => (
            actions.findIndex((candidate) => candidate.actionId === action.actionId) === index
          ));
        if (exact.length || movementCards.length) {
          const nextPlanId = `probe:${goals[0].requirementId || goals[0].targetId}`;
          return bindRoute(
            [...exact, ...movementCards, ...deferredDirectMovement],
            input.routeTargetId,
            nextPlanId,
          );
        }
        const preparation = selectProbeResourcePreparation(
          input.branchObservation,
          goals,
          successors,
          input.focalSeatId,
        );
        const deferredMovement = goals.flatMap((goal) => (
          preferDeferredProbeMovementCard(
            input.branchObservation,
            goal,
            preparation,
            successors,
            input.focalSeatId,
          )
        )).filter((action, index, actions) => (
          actions.findIndex((candidate) => candidate.actionId === action.actionId) === index
        ));
        if (deferredMovement.length) {
          return bindRoute(
            deferredMovement,
            input.routeTargetId,
            `probe:${goals[0].requirementId || goals[0].targetId}`,
          );
        }
        if (goals.some((goal) => (
          ["launch", "orbit", "land"].includes(goal.nextStep?.family)
          && probeGoalResourceReachable(
            input.branchObservation,
            goal,
            input.focalSeatId,
          )
        ))) {
          return continueBoundTargetNextTurn(
            `probe:${goals[0].requirementId || goals[0].targetId}`,
          );
        }
        return [];
      }
      return [];
    }
    const error = new Error(`单席位规划收到 opponent action: ${actorId || "<missing>"}`);
    error.code = "SECONDARY_AGENT_OPPONENT_ACTION_FORBIDDEN";
    throw error;
  }

  return Object.freeze({
    EVALUATION_MODEL,
    PARAMETER_VERSION,
    OUTCOME_SCHEMA_VERSION,
    DEFAULT_PARAMETERS,
    INCOME_UNIT_VALUES,
    TECH_UNIT_VALUES,
    SECONDARY_AGENT_ROLLOUT_VERSION,
    mergeParameters,
    requiresCounterfactualOutcome,
    requiresRootCounterfactual,
    completesSecondaryAgentRouteTarget,
    secondaryAgentCompletionFacts,
    evaluateState,
    evaluateStateValue,
    evaluateStrategicFactsPriority,
    evaluateStrategicFactsBreakdown,
    evaluateSecondaryAgentSearchPriority,
    enumerateSecondaryAgentRootTargets,
    selectSecondaryAgentRootActions,
    selectSecondaryAgentRouteTarget,
    evaluateAction: evaluateOutcome,
    evaluateOutcome,
    selectSecondaryAgentSuccessors,
  });
});
