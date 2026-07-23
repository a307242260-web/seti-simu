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

  function gapSize(requirement) {
    const gap = requirement?.gap || {};
    return finite(gap.credits) + finite(gap.energy) + finite(gap.movementSteps);
  }

  function sameTarget(requirements, goal) {
    return (requirements?.candidates || [])
      .filter((candidate) => candidate?.targetId === goal?.targetId)
      .sort((left, right) => gapSize(left) - gapSize(right))[0] || null;
  }

  function matchesNextStep(action, step) {
    if (!action || !step || action.family !== step.family) return false;
    if (step.family !== "move") return true;
    return String(action.target?.rocketId) === String(step.rocketId)
      && finite(action.target?.deltaX) === finite(step.deltaX)
      && finite(action.target?.deltaY) === finite(step.deltaY);
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
    const rootRequirements = outcome.rootObservation.outcomeProjection.progress?.probeGoalRequirements;
    const rootGoal = rootRequirements?.candidates?.[0] || null;
    if (!rootGoal && isProbeAction) {
      const legacyBest = (outcome.leaves || [])
        .filter((leaf) => leaf?.status !== "failed" && leaf?.observation)
        .map((leaf) => {
          const leafValue = evaluateState(leaf.observation, context.seatId);
          const summary = leaf.observation.outcomeProjection.progress?.probeRoute?.candidate || null;
          return { leaf, leafValue, summary, goalScoreGain: finite(summary?.goalScoreGain) };
        })
        .filter((candidate) => candidate.summary?.endpointActionId && candidate.goalScoreGain > 0)
        .sort((left, right) => right.goalScoreGain - left.goalScoreGain)[0];
      if (!legacyBest) return unavailable(outcome, "probe-goal-no-positive-endpoint");
      return deepFreeze({
        evaluationModel: EVALUATION_MODEL,
        score: legacyBest.goalScoreGain,
        selectable: true,
        priorityClass: 4,
        goalScoreGain: legacyBest.goalScoreGain,
        status: outcome.status,
        confidence: outcome.confidence || "high",
        rootValue,
        leafValue: legacyBest.leafValue,
        actualScoreDelta: legacyBest.leafValue.realizedScore - rootValue.realizedScore,
        probeRouteSummary: legacyBest.summary,
        selectedLeafId: legacyBest.leaf.leafId || null,
        actionChain: legacyBest.leaf.actionChain || [],
        reasonCodes: ["probe-goal-standard-route"],
      });
    }
    const evaluatedLeaves = (outcome.leaves || [])
      .filter((leaf) => leaf?.status !== "failed" && leaf?.observation)
      .map((leaf) => {
        const leafValue = evaluateState(leaf.observation, context.seatId);
        const summary = leaf.observation.outcomeProjection.progress?.probeRoute?.candidate || null;
        const leafRequirements = leaf.observation.outcomeProjection.progress?.probeGoalRequirements;
        const leafGoal = sameTarget(leafRequirements, rootGoal);
        const actualScoreDelta = leafValue.realizedScore - rootValue.realizedScore;
        const gapReduction = rootGoal && leafGoal
          ? Math.max(0, gapSize(rootGoal) - gapSize(leafGoal))
          : 0;
        const completed = Boolean(
          rootGoal
          && actualScoreDelta > 0
          && (summary?.endpointActionId || ["orbit", "land"].includes(action?.family)),
        );
        return {
          leaf,
          leafValue,
          leafGoal,
          summary,
          actualScoreDelta,
          gapReduction,
          completed,
        };
      })
      .sort((left, right) => (
        Number(right.completed) - Number(left.completed)
        || right.gapReduction - left.gapReduction
        || right.actualScoreDelta - left.actualScoreDelta
        || String(left.leaf.leafId || "").localeCompare(String(right.leaf.leafId || ""))
      ));
    const best = evaluatedLeaves[0] || null;
    if (!best) return unavailable(outcome, "outcome-has-no-leaf");

    const controlFlow = action?.phase === "conditional";
    const endTurn = action?.family === "end_turn";
    const pass = action?.family === "pass";
    const nextProbeStep = matchesNextStep(action, rootGoal?.nextStep);
    const routeAdvanced = nextProbeStep && (
      best.completed
      || best.gapReduction > 0
      || Boolean(best.summary?.endpointActionId)
    );
    const directGapFill = !isProbeAction && best.gapReduction > 0;
    const selectable = Boolean(rootGoal && (best.completed || routeAdvanced || directGapFill))
      || controlFlow
      || endTurn
      || pass;
    if (!selectable) return unavailable(outcome, "not-current-probe-goal-step");
    const priorityClass = best.completed
      ? 5
      : routeAdvanced
        ? 4
        : directGapFill
          ? 3
          : controlFlow
            ? 2
            : endTurn
              ? 1
              : 0;
    return deepFreeze({
      evaluationModel: EVALUATION_MODEL,
      score: best.completed
        ? finite(rootGoal?.targetBenefit?.score)
        : best.gapReduction,
      selectable: true,
      priorityClass,
      goalScoreGain: finite(rootGoal?.targetBenefit?.score),
      status: outcome.status,
      confidence: outcome.confidence || "high",
      rootValue,
      leafValue: best.leafValue,
      actualScoreDelta: best.actualScoreDelta,
      probeGoalRequirement: rootGoal,
      leafProbeGoalRequirement: best.leafGoal,
      gapReduction: best.gapReduction,
      probeRouteSummary: isProbeAction ? best.summary : null,
      selectedLeafId: best.leaf.leafId || null,
      actionChain: best.leaf.actionChain || [],
      reasonCodes: [best.completed
        ? "probe-goal-completed-standard-leaf"
        : routeAdvanced
          ? "probe-goal-route-advanced"
          : directGapFill
            ? "probe-goal-gap-reduced-by-standard-leaf"
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
