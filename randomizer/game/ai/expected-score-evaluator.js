(function (root, factory) {
  "use strict";

  let outcomeModel = root.SetiOutcomeModel;
  if (!outcomeModel && typeof require === "function") outcomeModel = require("./outcome-model");
  const api = factory(outcomeModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiExpectedScoreEvaluator = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (outcomeModel) {
  "use strict";

  const EVALUATION_MODEL = "counterfactual-probe-goal-v1";
  const PARAMETER_VERSION = "seti-probe-goal-v1";
  const OUTCOME_SCHEMA_VERSION = outcomeModel.OUTCOME_SCHEMA_VERSION;
  const PROBE_FAMILIES = Object.freeze(new Set(["launch", "move", "orbit", "land"]));
  const DEFAULT_PARAMETERS = Object.freeze({ parameterVersion: PARAMETER_VERSION });

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
    return deepFreeze({ parameterVersion: String(input.parameterVersion || PARAMETER_VERSION) });
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
      total: realizedScore,
      resourceFacts: {
        credits: finite(projection.assets.credits),
        energy: finite(projection.assets.energy),
        publicity: finite(projection.assets.publicity),
        ordinaryCards: finite(projection.assets.ordinaryCards),
        alienCards: finite(projection.assets.alienCards),
      },
      fieldPaths: {
        realizedScore: terminal
          ? "outcomeProjection.scoring.officialTerminalScore"
          : "outcomeProjection.scoring.realizedScore",
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

  function evaluateOutcome(context, action) {
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

    const isProbeAction = PROBE_FAMILIES.has(action?.family);
    const hasIncompleteProbeRoute = (context?.actionOutcomes || []).some((candidateOutcome) => (
      candidateOutcome?.status === "settled"
      && (candidateOutcome.leaves || []).some((leaf) => {
        const candidate = leaf?.observation?.outcomeProjection?.progress?.probeRoute?.candidate;
        return candidate && !candidate.endpointActionId;
      })
    ));
    const evaluatedLeaves = (outcome.leaves || [])
      .filter((leaf) => leaf?.status !== "failed" && leaf?.observation)
      .map((leaf) => {
        const leafValue = evaluateState(leaf.observation, context.seatId);
        const summary = leaf.observation.outcomeProjection.progress?.probeRoute?.candidate || null;
        const goalScoreGain = finite(summary?.goalScoreGain);
        return { leaf, leafValue, summary, goalScoreGain };
      })
      .filter((candidate) => (
        !isProbeAction
        || (candidate.summary?.endpointActionId && candidate.goalScoreGain > 0)
      ))
      .sort((left, right) => (
        right.goalScoreGain - left.goalScoreGain
        || finite(left.summary?.routeCost?.credits) - finite(right.summary?.routeCost?.credits)
        || finite(left.summary?.routeCost?.energy) - finite(right.summary?.routeCost?.energy)
        || String(left.leaf.leafId || "").localeCompare(String(right.leaf.leafId || ""))
      ));
    const best = evaluatedLeaves[0] || null;
    if (!best) {
      return unavailable(outcome, isProbeAction ? "probe-goal-no-positive-endpoint" : "outcome-has-no-leaf");
    }

    const controlFlow = action?.phase === "conditional";
    const endTurn = action?.family === "end_turn";
    const pass = action?.family === "pass";
    const orangeTechDelta = finite(
      best.leaf.observation.outcomeProjection.progress?.orangeTechCount,
    ) - finite(
      outcome.rootObservation.outcomeProjection.progress?.orangeTechCount,
    );
    const fillsProbeTechGap = hasIncompleteProbeRoute && orangeTechDelta > 0;
    const selectable = isProbeAction || fillsProbeTechGap || controlFlow || endTurn || pass;
    if (!selectable) return unavailable(outcome, "not-current-probe-goal-step");
    const priorityClass = isProbeAction ? 3 : fillsProbeTechGap ? 2 : controlFlow ? 2 : endTurn ? 1 : 0;
    return deepFreeze({
      evaluationModel: EVALUATION_MODEL,
      score: isProbeAction ? best.goalScoreGain : 0,
      selectable: true,
      priorityClass,
      goalScoreGain: isProbeAction ? best.goalScoreGain : 0,
      status: outcome.status,
      confidence: outcome.confidence || "high",
      rootValue,
      leafValue: best.leafValue,
      actualScoreDelta: best.leafValue.realizedScore - rootValue.realizedScore,
      orangeTechDelta,
      probeRouteSummary: isProbeAction ? best.summary : null,
      selectedLeafId: best.leaf.leafId || null,
      actionChain: best.leaf.actionChain || [],
      reasonCodes: [isProbeAction
        ? "probe-goal-standard-route"
        : fillsProbeTechGap
          ? "probe-route-orange-tech-gap"
        : controlFlow
          ? "required-standard-decision"
          : endTurn
            ? "end-turn-no-probe-step"
            : "pass-last-resort"],
    });
  }

  return Object.freeze({
    EVALUATION_MODEL,
    PARAMETER_VERSION,
    OUTCOME_SCHEMA_VERSION,
    DEFAULT_PARAMETERS,
    mergeParameters,
    evaluateState,
    evaluateAction: evaluateOutcome,
    evaluateOutcome,
  });
});
