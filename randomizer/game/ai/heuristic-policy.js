(function (root, factory) {
  "use strict";

  let policyPort = root.SetiPolicyPort;
  let standardAction = root.SetiStandardAction;
  let heuristicEvaluator = root.SetiHeuristicEvaluator;
  let expectedScoreEvaluator = root.SetiExpectedScoreEvaluator;
  let outcomeModel = root.SetiOutcomeModel;
  let endGameScoring = root.SetiEndGameScoring;
  let initialCards = root.SetiInitialCards;

  if ((!policyPort || !standardAction || !heuristicEvaluator || !expectedScoreEvaluator || !outcomeModel || !endGameScoring) && typeof require === "function") {
    policyPort = policyPort || require("./policy-port");
    standardAction = standardAction || require("../actions/standard-action");
    heuristicEvaluator = heuristicEvaluator || require("./heuristic-evaluator");
    expectedScoreEvaluator = expectedScoreEvaluator || require("./expected-score-evaluator");
    outcomeModel = outcomeModel || require("./outcome-model");
    endGameScoring = endGameScoring || require("../end-game-scoring");
    initialCards = initialCards || require("../initial-cards");
  }

  const api = factory(policyPort, standardAction, heuristicEvaluator, expectedScoreEvaluator, outcomeModel, endGameScoring, initialCards);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiHeuristicPolicy = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (policyPort, standardAction, heuristicEvaluator, expectedScoreEvaluator, outcomeModel, endGameScoring, initialCards) {
  "use strict";

  const POLICY_TYPE = "heuristic";
  // v0 基线：搜索机制单一路径（目标引导 + 需求引导，无 bounded 分桶与
  // unifiedSearch 开关），打牌只经目标绑定进入搜索。
  const POLICY_VERSION = "seti-heuristic-policy-v0";
  const DEFAULT_DIFFICULTY = "laughable";
  const KNOWN_FAMILIES = Object.freeze(new Set(standardAction.ALL_FAMILIES));
  const FALLBACK_FAMILIES = Object.freeze(new Set([
    ...standardAction.CONDITIONAL_FAMILIES,
    "end_turn",
    "pass",
  ]));

  // 与正式叶评分/V共用单价与逐次收入窗口，不持有第二份资源表。
  const { RESOURCE_UNIT_VALUES, resourceUnitValue, incomeFutureValue } = expectedScoreEvaluator;
  const INCOME_RESOURCE_BY_CODE = Object.freeze({
    0: "credits", 1: "energy", 2: "handSize", 3: "availableData", 4: "publicity",
  });

  class HeuristicPolicyError extends Error {
    constructor(code, message, details = {}) {
      super(message);
      this.name = "HeuristicPolicyError";
      this.code = code;
      Object.assign(this, details);
    }
  }

  function stableSerialize(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }

  function stableHash(value) {
    const input = stableSerialize(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function isObservationFeasible(context, action) {
    const isMoveLike = action.family === "move"
      || (action.family === "card_corner" && action.payload?.kind === "move");
    if (!isMoveLike) return true;
    const rockets = context.observation?.publicState?.board?.rockets;
    if (!Array.isArray(rockets)) return true;
    return rockets.some((rocket) => (
      rocket?.playerId === context.seatId
      && rocket?.surface === "solar-board"
    ));
  }

  function selectInitialSetupAction(context) {
    const actions = context.legalActions || [];
    const start = actions.find((action) => action.target?.kind === "start_initial_setup");
    if (start) return start;
    const confirm = actions.find((action) => action.target?.kind === "confirm_initial_setup");
    if (confirm) return confirm;
    // 固定用户开局：按玩家精确复刻 405 分档（终局未结算-v223）的初始选择——
    // 白色=深空探测+initial:21/1，蓝色=图灵系统+initial:10/5，
    // 绿色=寰宇动力+initial:14/20，棕色=赫利昂联合体+initial:17/19。
    // 这些是用户实测高分开局（深空探测 dataGain+scan，白色后续 58 次 place_data），
    // 直接按档内选择匹配，不走反事实/打分（初始效果延迟到 confirm 结算，反事实
    // 评估看不到价值）。
    const setup = context.observation?.publicState?.resident?.initialSetup;
    const USER_INITIAL_PICKS = {
      "player-white": { industry: "industry:深空探测.png", initials: ["initial:21", "initial:1"] },
      "player-blue": { industry: "industry:图灵系统.png", initials: ["initial:10", "initial:5"] },
      "player-green": { industry: "industry:寰宇动力.png", initials: ["initial:14", "initial:20"] },
      "player-brown": { industry: "industry:赫利昂联合体.png", initials: ["initial:17", "initial:19"] },
    };
    const pickForSeat = (seatId) => {
      const pick = USER_INITIAL_PICKS[seatId];
      if (!pick) return null;
      const selectedInitialIds = new Set(
        (setup?.offer?.selectedInitialIds || []).map(String),
      );
      const industryPicked = Boolean(setup?.offer?.selectedIndustryId);
      if (!industryPicked) {
        const industry = actions.find((action) => (
          action.target?.kind === "select_initial_card"
          && action.target?.selectionKind === "industry"
          && String(action.target?.cardId || "") === String(pick.industry)
        ));
        if (industry) return industry;
      }
      const initial = actions.find((action) => (
        action.target?.kind === "select_initial_card"
        && action.target?.selectionKind === "initial"
        && pick.initials.includes(String(action.target?.cardId || ""))
        && !selectedInitialIds.has(String(action.target?.cardId || ""))
      ));
      if (initial) return initial;
      return null;
    };
    const seatId = actions[0]?.actorPlayerId || actions[0]?.actorId || null;
    const userPick = pickForSeat(seatId);
    if (userPick) return userPick;
    const hasEvaluatedSelection = (context.actionOutcomes || []).some((outcome) => (
      outcome?.status === "settled" && (outcome.leaves?.length || 0) > 0
    ));
    if (hasEvaluatedSelection) return null;
    const offer = setup?.offer;
    // 行业选择价值评估：宣传是研究科技的唯一货币（6 宣传/次，techBonus 是稳定大分源，
    // 用户高分档 12 科技 +30 分）、数据是填数据轨/蓝科技数据位的燃料（用户 405 档
    // 深空探测 dataGain 1 → 58 次 place_data）、盲抽/收入是资源滚雪球起点。此前直接
    // 返回第一个行业（offer 顺序决定），AI 常选到低宣传/低数据行业，开局就落后。
    // 这里按真实效果打分，选价值最高的行业（不硬编码倾向，只让价值进入视野）。
    const industryOptions = actions.filter((action) => (
      action.target?.kind === "select_initial_card"
      && action.target?.selectionKind === "industry"
    ));
    if ((setup?.active && offer && !offer.selectedIndustryId) || (!offer && industryOptions.length)) {
      if (industryOptions.length > 1) {
        // 行业价值打分（2026-08-21 改版：改用对齐价值表 RESOURCE_UNIT_VALUES，
        // 替换早期随意权重 宣传×3/信用×1/能量×1.5/数据×5 等）：
        //   即时资源按单位价值（钱10 电8 宣传4 数据6 牌6，钱/电逐轮贬值）；
        //   baseIncome 每轮收入 × 单位价值 × 剩余轮次窗口。
        const roundNumber = Math.max(1, Number(context.observation?.publicState?.roundNumber) || 1);
        const finalRoundNumber = Math.max(1, Number(context.observation?.publicState?.finalRoundNumber) || 4);
        const unit = (resource) => resourceUnitValue(resource, roundNumber, finalRoundNumber);
        const industryValue = (industryId) => {
          const label = String(industryId || "").replace(/^industry:/, "").replace(/\.png$/, "");
          const effect = initialCards?.INDUSTRY_EFFECTS?.[label];
          if (!effect) return 0;
          let value = 0;
          value += Number(effect.resources?.score || 0) * RESOURCE_UNIT_VALUES.score;
          value += Number(effect.resources?.credits || 0) * unit("credits");
          value += Number(effect.resources?.energy || 0) * unit("energy");
          value += Number(effect.resources?.publicity || 0) * RESOURCE_UNIT_VALUES.publicity;
          value += Number(effect.dataGain || 0) * RESOURCE_UNIT_VALUES.availableData;
          value += Number(effect.blindDraw || 0) * RESOURCE_UNIT_VALUES.ordinaryCard;
          // launchCount / incomeIncreaseCount 是手段（发射/插收入次数），不直接算分；
          // baseIncome 每轮收入按剩余轮次窗口计。
          value += incomeFutureValue(effect.baseIncome, roundNumber, finalRoundNumber);
          return value;
        };
        let bestIndustry = null;
        let bestValue = -1;
        for (const action of industryOptions) {
          const value = industryValue(action.target?.cardId);
          if (value > bestValue) {
            bestValue = value;
            bestIndustry = action;
          }
        }
        return bestIndustry || industryOptions[0] || null;
      }
      return industryOptions[0] || null;
    }
    const selectedInitialIds = new Set(offer?.selectedInitialIds || []);
    // 初始牌效果价值评估：AI 的反事实评估看不到初始牌价值（效果延迟到 confirm 结算，
    // 评估选牌步骤时效果未执行 → 全部 0）。这里按真实效果直接打分——分数/资源/
    // 数据（数据→填 4 数据轨→收入 + 蓝科技 1 数据换 1 能量，用户高分策略的核心燃料）
    // /环绕器/扫描（给数据 token）/外星人痕迹——选价值最高的牌。
    const initialOptions = actions.filter((action) => (
      action.target?.kind === "select_initial_card"
      && action.target?.selectionKind === "initial"
      && !selectedInitialIds.has(action.target?.cardId)
    ));
    const effectOf = (action) => {
      const number = Number(String(action.target?.cardId || "").replace("initial:", ""));
      return initialCards?.INITIAL_CARD_EFFECTS?.[number] || null;
    };
    // 初始牌价值打分（2026-08-21 改版：改用对齐价值表 RESOURCE_UNIT_VALUES，
    // 替换早期随意权重 宣传×0.4/数据×4/扫描3+1.5×次/外星痕迹+5 等）：
    //   分数 1/1、钱 10、电 8（逐轮贬值）、宣传 4、数据 6、盲抽牌 6、
    //   收入（数据/手牌）×剩余轮次窗口、环绕器 6、扫描次数×5、外星痕迹=外星牌 12。
    const roundNumber = Math.max(1, Number(context.observation?.publicState?.roundNumber) || 1);
    const finalRoundNumber = Math.max(1, Number(context.observation?.publicState?.finalRoundNumber) || 4);
    const unit = (resource) => resourceUnitValue(resource, roundNumber, finalRoundNumber);
    const initialCardValue = (effect) => {
      if (!effect) return 0;
      let value = 0;
      value += Number(effect.resources?.score || 0) * RESOURCE_UNIT_VALUES.score;
      value += Number(effect.resources?.credits || 0) * unit("credits");
      value += Number(effect.resources?.energy || 0) * unit("energy");
      value += Number(effect.resources?.publicity || 0) * RESOURCE_UNIT_VALUES.publicity;
      value += Number(effect.resources?.additionalPublicScan || 0) * 0; // 额外公共扫描=手段
      value += Number(effect.dataGain || 0) * RESOURCE_UNIT_VALUES.availableData;
      value += incomeFutureValue(effect.income, roundNumber, finalRoundNumber);
      value += Number(effect.blindDraw || 0) * RESOURCE_UNIT_VALUES.ordinaryCard;
      if (effect.orbitPlanetId) value += 6; // 环绕器：开局免费环绕（奖励分+资源）
      if (effect.scan) value += (Number(effect.scan.count) || 0) * 5; // 扫描→数据/扇区信号
      if (effect.alienTrace) value += RESOURCE_UNIT_VALUES.alienCard; // 外星痕迹→外星牌
      return value;
    };
    let bestInitial = null;
    let bestValue = -1;
    for (const action of initialOptions) {
      const value = initialCardValue(effectOf(action));
      if (value > bestValue) {
        bestValue = value;
        bestInitial = action;
      }
    }
    const initial = bestInitial || initialOptions[0] || null;
    if ((setup?.active && offer && selectedInitialIds.size < 2) || (!offer && initial)) {
      return initial || null;
    }
    // 插收入选牌（2026-08-21 改版，替换"无脑选第一个"）：插收入 = 弃一张手牌插进
    // 收入轨，牌的 income 码决定哪条收入轨每轮 +1。按对齐价值表选收入轨单位价值
    // 最高的牌（钱 10 > 电 8 > 数据 6 = 牌 6 > 宣传 4，钱/电逐轮贬值）——
    // 即"我需要哪条收入轨"。不是反事实搜索（插收入是简单逻辑判断），也不落进
    // 初始牌价值打分（那套是选牌用的，语义错位）。
    if (actions.length > 0 && actions.every((action) => (
      action.family === "choose_payment"
      && action.target?.kind === "discard-hand-cards"
    ))) {
      const hand = context.observation?.selfState?.hand || [];
      const cardOf = (action) => {
        const id = action.target?.cardInstanceId || action.target?.cardIds?.[0];
        return hand.find((card) => (
          String(card?.id) === String(id) || String(card?.cardId) === String(id)
        ));
      };
      const incomeValueOf = (action) => {
        const card = cardOf(action);
        const incomeCode = Number(card?.incomeCode);
        const resource = INCOME_RESOURCE_BY_CODE[incomeCode];
        if (!resource) return 0;
        const resourceKey = resource === "handSize" ? "ordinaryCard" : resource;
        return unit(resourceKey) + incomeFutureValue({ [resource]: 1 }, roundNumber, finalRoundNumber);
      };
      let best = actions[0];
      let bestValue = -1;
      for (const action of actions) {
        const value = incomeValueOf(action);
        if (value > bestValue) {
          bestValue = value;
          best = action;
        }
      }
      return best;
    }
    return null;
  }

  function assertContext(context, options = {}) {
    if (context?.schemaVersion !== policyPort.CONTEXT_SCHEMA_VERSION) {
      throw new HeuristicPolicyError("HEURISTIC_POLICY_CONTEXT_INVALID", "Heuristic Policy 需要公共 DecisionContext");
    }
    if (!Array.isArray(context.legalActions) || context.legalActions.length === 0) {
      throw new HeuristicPolicyError("HEURISTIC_POLICY_EMPTY_LEGAL_SET", "Heuristic Policy 不接受空 legal set");
    }
    const unknownFamilies = [...new Set(context.legalActions
      .map((action) => action.family)
      .filter((family) => !KNOWN_FAMILIES.has(family)))];
    if (unknownFamilies.length) {
      throw new HeuristicPolicyError(
        "HEURISTIC_POLICY_UNSUPPORTED_FAMILY",
        `Heuristic Policy 不支持 family: ${unknownFamilies.join(", ")}`,
        { families: unknownFamilies },
      );
    }
    if (options.skipOutcomeValidation !== true) {
      try {
        outcomeModel.assertOutcomeSet(context.actionOutcomes, context.legalActions);
      } catch (error) {
        throw new HeuristicPolicyError(
          "HEURISTIC_POLICY_OUTCOME_INVALID",
          error?.message || "Heuristic Policy 需要与 legal set 对齐的标准 outcome",
        );
      }
    }
    const malformed = context.legalActions.find((action) => (
      standardAction.PHASE_BY_FAMILY[action.family] !== action.phase
    ));
    if (malformed) {
      throw new HeuristicPolicyError(
        "HEURISTIC_POLICY_DESCRIPTOR_INVALID",
        `Heuristic Policy descriptor family/phase 不匹配: ${malformed.family}/${malformed.phase}`,
        { actionId: malformed.actionId },
      );
    }
  }

  function selectControlFallbackAction(context) {
    const settledIds = new Set((context.actionOutcomes || [])
      .filter((outcome) => outcome?.status === "settled" && (outcome.leaves?.length || 0) > 0)
      .map((outcome) => outcome.actionId));
    const phasePriority = { conditional: 0, main: 1, quick: 2 };
    return (context.legalActions || [])
      .filter((action) => (
        FALLBACK_FAMILIES.has(action.family)
        && (
          settledIds.has(action.actionId)
          || ["pass", "end_turn"].includes(action.family)
        )
      ))
      .sort((left, right) => (
        (phasePriority[left.phase] ?? 3) - (phasePriority[right.phase] ?? 3)
        || String(left.actionId).localeCompare(String(right.actionId))
      ))[0] || null;
  }

  // 终局计分标记决策（FINAL_MARK）：legal actions 全为 choose_target + tileId(a/b/c/d) 时，
  // 按各板块公式 baseValue × 下一槽位倍率直接打分选最优瓦片。板块变体/标记/玩家公开
  // 数据均可从观测读取，不依赖反事实搜索。
  function selectFinalMarkAction(context) {
    const legalActions = context.legalActions || [];
    if (!legalActions.length) return null;
    const isFinalMarkDecision = legalActions.every((action) => (
      action.family === "choose_target"
      && /^[a-d]$/.test(String(action.target?.tileId || ""))
    ));
    if (!isFinalMarkDecision) return null;
    const observation = context.observation;
    const seatId = String(context.seatId || "");
    const players = observation?.publicState?.players || [];
    const player = players.find((candidate) => (
      String(candidate.playerId || candidate.color || "") === seatId
    ));
    if (!player) return legalActions[0];
    const board = observation?.publicState?.board || {};
    const finalScoring = board.finalScoring || {};
    const tiles = finalScoring.tiles || {};
    const variants = finalScoring.tileVariants || {};
    const playerForFormula = {
      ...player,
      // 公式 c2 需要 type3 卡（保留区），从 selfState 补
      reservedCards: observation?.selfState?.reservedCards || [],
    };
    const formulaContext = {
      aliens: board.aliens || {},
      planets: board.planets || {},
      data: board.data || {},
    };
    const getCardTypeCode = (card) => Number(card?.cardTypeCode);
    let best = null;
    for (const action of legalActions) {
      const tileId = String(action.target?.tileId || "");
      const tile = tiles[tileId] || {};
      const marks = Array.isArray(tile?.marks) ? tile.marks : [];
      const nextSlot = !marks.some((mark) => Number(mark?.slotIndex) === 1) ? 1
        : !marks.some((mark) => Number(mark?.slotIndex) === 2) ? 2 : 3;
      const formulaId = endGameScoring.getFormulaId(tileId, variants[tileId]);
      const baseValue = Number(endGameScoring.getFormulaBaseValue(
        formulaId,
        playerForFormula,
        formulaContext,
        { getCardTypeCode },
      ) || 0);
      const multiplier = Number(endGameScoring.getSlotMultiplier(formulaId, nextSlot) || 0);
      const score = baseValue * multiplier;
      if (!best || score > best.score || (
        score === best.score && action.actionId < best.action.actionId
      )) {
        best = { action, score };
      }
    }
    return best?.action || legalActions[0];
  }

  function createHeuristicPolicy(options = {}) {
    const difficulty = String(options.difficulty || DEFAULT_DIFFICULTY);
    const evaluationParameters = expectedScoreEvaluator.mergeParameters(options.evaluationParameters);
    const evaluateAction = options.evaluateAction || (
      (context, action) => expectedScoreEvaluator.evaluateAction(
        context,
        action,
        evaluationParameters,
      )
    );
    if (typeof evaluateAction !== "function" || typeof heuristicEvaluator?.selectLegalAction !== "function") {
      throw new HeuristicPolicyError("HEURISTIC_POLICY_CONFIG_INVALID", "Heuristic Policy 缺少纯 action evaluator");
    }
    const provenance = Object.freeze({
      type: POLICY_TYPE,
      version: POLICY_VERSION,
      config: Object.freeze({ difficulty, evaluationParameters }),
      configChecksum: stableHash({ difficulty, evaluationParameters }),
    });
    function decide(context) {
      const setupSelection = selectInitialSetupAction(context);
      const finalMarkSelection = selectFinalMarkAction(context);
      assertContext(context, { skipOutcomeValidation: Boolean(setupSelection || finalMarkSelection) });
      const evaluatedSelection = setupSelection || finalMarkSelection
        || heuristicEvaluator.selectLegalAction(context, {
          evaluateAction,
          isFeasible: isObservationFeasible,
        });
      const selected = evaluatedSelection || selectControlFallbackAction(context)
        // 唯一合法动作兜底（用户裁定"结算不搜索"延伸，2026-08-21 修复）：
        // 残余域强制结算（如阿米巴效果选牌 choiceCount=1）被 requiresRootCounterfactual
        // 送进战略搜索，搜索对条件根（rootWasConditional）只展开 1 节点成叶且叶非
        // settled → actionOutcomes 无 settled 叶 → 打分必失败 → 此前全盘崩溃
        // （HEURISTIC_POLICY_NO_SELECTION）。唯一合法动作没有选择余地，直接选它
        // 不依赖打分。16384 预算全盘不崩只是存档轨迹（步53 分叉点）绕开该状态，
        // 并非搜索处理正确；4096 下撞上即崩。
        || (context.legalActions?.length === 1 ? context.legalActions[0] : null);
      if (!selected) {
        throw new HeuristicPolicyError("HEURISTIC_POLICY_NO_SELECTION", "Heuristic Policy 未能选择 legal descriptor");
      }
      return policyPort.createPolicyDecision(context, {
        actionId: selected.actionId,
        policyType: POLICY_TYPE,
        policyVersion: POLICY_VERSION,
        modelChecksum: null,
        diagnostics: {
          reasonCode: evaluatedSelection
            ? `heuristic:${selected.family}`
            : `heuristic:settled-fallback:${selected.family}`,
          traceId: `${context.requestId}:${provenance.configChecksum}`,
        },
      });
    }

    return Object.freeze({ decide, getProvenance: () => provenance });
  }

  return Object.freeze({
    POLICY_TYPE,
    POLICY_VERSION,
    DEFAULT_DIFFICULTY,
    HeuristicPolicyError,
    createHeuristicPolicy,
  });
});
