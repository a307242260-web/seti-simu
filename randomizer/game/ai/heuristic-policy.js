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
  const POLICY_VERSION = "seti-heuristic-policy-v26";
  const DEFAULT_DIFFICULTY = "laughable";
  const KNOWN_FAMILIES = Object.freeze(new Set(standardAction.ALL_FAMILIES));
  const FALLBACK_FAMILIES = Object.freeze(new Set([
    ...standardAction.CONDITIONAL_FAMILIES,
    "end_turn",
    "pass",
  ]));

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
    const hasEvaluatedSelection = (context.actionOutcomes || []).some((outcome) => (
      outcome?.status === "settled" && (outcome.leaves?.length || 0) > 0
    ));
    if (hasEvaluatedSelection) return null;
    const setup = context.observation?.publicState?.resident?.initialSetup;
    const offer = setup?.offer;
    const industry = actions.find((action) => (
      action.target?.kind === "select_initial_card"
      && action.target?.selectionKind === "industry"
    ));
    if ((setup?.active && offer && !offer.selectedIndustryId) || (!offer && industry)) {
      return industry || null;
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
    const DATA_UNIT_VALUE = 4; // 1 数据 ≈ 填数据轨收入 + 蓝科技转换价值
    const initialCardValue = (effect) => {
      if (!effect) return 0;
      let value = 0;
      value += Number(effect.resources?.score || 0);
      value += Number(effect.resources?.credits || 0);
      value += Number(effect.resources?.energy || 0) * 1.5;
      value += Number(effect.resources?.publicity || 0) * 0.4;
      value += Number(effect.resources?.additionalPublicScan || 0) * 3;
      value += Number(effect.dataGain || 0) * DATA_UNIT_VALUE;
      value += Number(effect.income?.availableData || 0) * DATA_UNIT_VALUE;
      value += Number(effect.income?.handSize || 0) * 2;
      value += Number(effect.blindDraw || 0) * 1.5;
      if (effect.orbitPlanetId) value += 3;
      if (effect.scan) value += 3 + (Number(effect.scan.count) || 0) * 1.5;
      if (effect.alienTrace) value += 5;
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
    if (actions.length > 0 && actions.every((action) => (
      action.family === "choose_payment"
      && action.target?.kind === "discard-hand-cards"
    ))) {
      return actions[0];
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
      const selected = evaluatedSelection || selectControlFallbackAction(context);
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
