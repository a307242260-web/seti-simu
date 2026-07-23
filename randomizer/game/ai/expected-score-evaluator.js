(function (root, factory) {
  "use strict";

  let outcomeModel = root.SetiOutcomeModel;
  if (!outcomeModel && typeof require === "function") outcomeModel = require("./outcome-model");
  const api = factory(outcomeModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiExpectedScoreEvaluator = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (outcomeModel) {
  "use strict";

  const EVALUATION_MODEL = "counterfactual-leaf-value-v1";
  const PARAMETER_VERSION = "seti-theta0-v1";
  const OUTCOME_SCHEMA_VERSION = outcomeModel.OUTCOME_SCHEMA_VERSION;
  const DEFAULT_PARAMETERS = Object.freeze({
    parameterVersion: PARAMETER_VERSION,
    resourceValues: Object.freeze({
      credits: 1,
      energy: 2,
      availableData: 2,
      publicity: 2,
      ordinaryCard: 1.5,
      alienCard: 5,
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
    const score = terminal
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
      : Object.values(assetBreakdown).reduce((sum, value) => sum + value, 0);
    return deepFreeze({
      evaluationModel: EVALUATION_MODEL,
      parameterVersion: parameters.parameterVersion,
      terminal,
      realizedScore: score,
      unrealizedAssets,
      total: score + unrealizedAssets,
      assetBreakdown,
      fieldPaths: {
        realizedScore: terminal
          ? "outcomeProjection.scoring.officialTerminalScore"
          : "outcomeProjection.scoring.realizedScore",
        assets: outcomeModel.ASSET_PATHS,
      },
    });
  }

  function evaluateOutcome(context, action) {
    const outcome = (context?.actionOutcomes || []).find((candidate) => (
      candidate?.actionId === action?.actionId
    ));
    if (!outcome) {
      return deepFreeze({
        evaluationModel: EVALUATION_MODEL,
        score: null,
        status: "unresolved",
        confidence: "none",
        reasonCodes: ["outcome-missing"],
      });
    }
    if (outcome.schemaVersion !== OUTCOME_SCHEMA_VERSION
      || outcome.status !== "settled") {
      return deepFreeze({
        evaluationModel: EVALUATION_MODEL,
        score: null,
        status: outcome.status || "unresolved",
        confidence: outcome.confidence || "none",
        reasonCodes: [outcome.code || "outcome-unresolved"],
      });
    }
    const leaves = Array.isArray(outcome.leaves) ? outcome.leaves : [];
    const evaluatedLeaves = leaves
      .filter((leaf) => leaf?.observation)
      .map((leaf) => ({
        leaf,
        value: evaluateState(leaf.observation, context.seatId),
      }))
      .sort((left, right) => (
        right.value.total - left.value.total
        || String(left.leaf.leafId || "").localeCompare(String(right.leaf.leafId || ""))
      ));
    const best = evaluatedLeaves[0] || null;
    const rootValue = outcome.rootObservation
      ? evaluateState(outcome.rootObservation, context.seatId)
      : null;
    const reward = best
      ? outcomeModel.createReward(outcome.rootObservation, best.leaf.observation)
      : null;
    return deepFreeze({
      evaluationModel: EVALUATION_MODEL,
      score: best && rootValue ? best.value.total - rootValue.total : null,
      status: best ? outcome.status : "unresolved",
      confidence: outcome.confidence || (best ? "high" : "none"),
      rootValue,
      leafValue: best?.value || null,
      reward,
      valueDelta: best && rootValue ? best.value.total - rootValue.total : null,
      selectedLeafId: best?.leaf?.leafId || null,
      actionChain: best?.leaf?.actionChain || [],
      reasonCodes: best ? ["counterfactual-standard-execution"] : ["outcome-has-no-leaf"],
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
