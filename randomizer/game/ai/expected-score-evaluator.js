(function (root, factory) {
  "use strict";

  let outcomeModel = root.SetiOutcomeModel;
  if (!outcomeModel && typeof require === "function") outcomeModel = require("./outcome-model");
  const api = factory(outcomeModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiExpectedScoreEvaluator = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (outcomeModel) {
  "use strict";

  const EVALUATION_MODEL = "counterfactual-probe-route-v1";
  const PARAMETER_VERSION = "seti-theta0-probe-v1";
  const OUTCOME_SCHEMA_VERSION = outcomeModel.OUTCOME_SCHEMA_VERSION;
  const PROBE_FAMILIES = Object.freeze(new Set(["launch", "move", "orbit", "land"]));
  const DEFAULT_PARAMETERS = Object.freeze({
    parameterVersion: PARAMETER_VERSION,
    resourceValues: Object.freeze({
      credits: 5,
      energy: 5,
      availableData: 2.5,
      publicity: 2.5,
      ordinaryCard: 2.5,
      alienCard: 10 / 3,
    }),
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
    const resourceValues = {
      ...DEFAULT_PARAMETERS.resourceValues,
      ...(input.resourceValues || {}),
    };
    for (const [key, value] of Object.entries(resourceValues)) {
      if (!Number.isFinite(Number(value)) || Number(value) < 0) {
        throw new TypeError(`leaf 资源价值 ${key} 必须是非负有限数值`);
      }
      resourceValues[key] = Number(value);
    }
    return deepFreeze({
      parameterVersion: String(input.parameterVersion || PARAMETER_VERSION),
      resourceValues,
    });
  }

  function evaluateState(observation, seatId, inputParameters = {}) {
    const parameters = mergeParameters(inputParameters);
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
    const assetBreakdown = {
      credits: finite(projection.assets.credits) * parameters.resourceValues.credits,
      energy: finite(projection.assets.energy) * parameters.resourceValues.energy,
      availableData: finite(projection.assets.availableData) * parameters.resourceValues.availableData,
      publicity: finite(projection.assets.publicity) * parameters.resourceValues.publicity,
      ordinaryCard: finite(projection.assets.ordinaryCards) * parameters.resourceValues.ordinaryCard,
      alienCard: finite(projection.assets.alienCards) * parameters.resourceValues.alienCard,
    };
    const unrealizedAssets = terminal
      ? 0
      : Object.values(assetBreakdown).reduce((total, value) => total + value, 0);
    return deepFreeze({
      schemaVersion: outcomeModel.VALUE_SCHEMA_VERSION,
      evaluationModel: EVALUATION_MODEL,
      parameterVersion: parameters.parameterVersion,
      terminal,
      realizedScore,
      unrealizedAssets,
      total: realizedScore + unrealizedAssets,
      assetBreakdown,
      fieldPaths: {
        realizedScore: terminal
          ? "outcomeProjection.scoring.officialTerminalScore"
          : "outcomeProjection.scoring.realizedScore",
        assets: outcomeModel.ASSET_PATHS,
      },
    });
  }

  function deltaValue(delta, parameters) {
    return finite(delta?.realizedScore)
      + finite(delta?.credits) * parameters.resourceValues.credits
      + finite(delta?.energy) * parameters.resourceValues.energy
      + finite(delta?.availableData) * parameters.resourceValues.availableData
      + finite(delta?.publicity) * parameters.resourceValues.publicity
      + finite(delta?.ordinaryCards) * parameters.resourceValues.ordinaryCard
      + finite(delta?.alienCards) * parameters.resourceValues.alienCard;
  }

  function unresolved(outcome, code) {
    return deepFreeze({
      evaluationModel: EVALUATION_MODEL,
      score: null,
      qProbe: null,
      status: outcome?.status || "unresolved",
      confidence: outcome?.confidence || "none",
      reasonCodes: [code],
    });
  }

  function evaluateOutcome(context, action, inputParameters = {}) {
    const outcome = (context?.actionOutcomes || []).find((candidate) => (
      candidate?.actionId === action?.actionId
    ));
    if (!outcome) return unresolved(null, "outcome-missing");
    if (outcome.schemaVersion !== OUTCOME_SCHEMA_VERSION || outcome.status !== "settled") {
      return unresolved(outcome, outcome.code || "outcome-unresolved");
    }
    const parameters = mergeParameters(inputParameters);
    const rootValue = outcome.rootObservation
      ? evaluateState(outcome.rootObservation, context.seatId, parameters)
      : null;
    const isProbeAction = PROBE_FAMILIES.has(action?.family);
    const evaluatedLeaves = (outcome.leaves || [])
      .filter((leaf) => leaf?.observation)
      .map((leaf) => {
        const leafValue = evaluateState(leaf.observation, context.seatId, parameters);
        const summary = leaf.observation.outcomeProjection.progress?.probeRoute?.candidate || null;
        const currentActionDelta = summary
          ? deltaValue(summary.currentDelta, parameters)
          : (rootValue ? leafValue.total - rootValue.total : null);
        const remainingRouteNet = summary
          ? deltaValue(summary.remainingRouteDelta, parameters)
          : 0;
        const qProbe = summary ? currentActionDelta + remainingRouteNet : null;
        return { leaf, leafValue, summary, currentActionDelta, remainingRouteNet, qProbe };
      })
      .filter((candidate) => (
        !isProbeAction || (candidate.summary?.endpointActionId && candidate.qProbe > 0)
      ))
      .sort((left, right) => (
        finite(right.qProbe ?? (right.leafValue.total - rootValue?.total))
        - finite(left.qProbe ?? (left.leafValue.total - rootValue?.total))
        || String(left.leaf.leafId || "").localeCompare(String(right.leaf.leafId || ""))
      ));
    const best = evaluatedLeaves[0] || null;
    if (!best || !rootValue) {
      return unresolved(outcome, isProbeAction ? "probe-route-no-positive-net" : "outcome-has-no-leaf");
    }
    const score = isProbeAction
      ? best.qProbe
      : best.leafValue.total - rootValue.total;
    return deepFreeze({
      evaluationModel: EVALUATION_MODEL,
      score,
      qProbe: isProbeAction ? best.qProbe : null,
      status: outcome.status,
      confidence: outcome.confidence || "high",
      rootValue,
      leafValue: best.leafValue,
      currentActionDelta: best.currentActionDelta,
      remainingRouteNet: isProbeAction ? best.remainingRouteNet : 0,
      publicityAlongRoute: isProbeAction ? finite(best.summary?.publicityAlongRoute) : 0,
      endpointDelta: isProbeAction ? cloneDelta(best.summary?.endpointDelta) : null,
      probeRouteSummary: isProbeAction ? best.summary : null,
      selectedLeafId: best.leaf.leafId || null,
      actionChain: best.leaf.actionChain || [],
      reasonCodes: [isProbeAction
        ? "probe-route-standard-outcomes"
        : "counterfactual-standard-execution"],
    });
  }

  function cloneDelta(value) {
    return value == null ? null : { ...value };
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
