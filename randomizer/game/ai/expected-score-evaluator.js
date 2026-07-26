(function (root, factory) {
  "use strict";

  let outcomeModel = root.SetiOutcomeModel;
  if (!outcomeModel && typeof require === "function") outcomeModel = require("./outcome-model");
  const api = factory(outcomeModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiExpectedScoreEvaluator = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (outcomeModel) {
  "use strict";

  const EVALUATION_MODEL = "greedy-probe-route-value-v4";
  const PARAMETER_VERSION = "seti-probe-route-value-v4";
  const OUTCOME_SCHEMA_VERSION = outcomeModel.OUTCOME_SCHEMA_VERSION;
  const PROBE_FAMILIES = Object.freeze(new Set(["launch", "move", "orbit", "land"]));
  const PROBE_ENABLER_FAMILIES = Object.freeze(new Set([
    "quick_trade", "play_card", "research_tech",
  ]));
  const CONTROL_FAMILIES = Object.freeze(new Set(["end_turn", "pass"]));
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
    return finite(gap.credits) + finite(gap.energy);
  }

  function requirementSize(requirement) {
    const required = requirement?.required || {};
    return finite(required.credits) + finite(required.energy);
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

  function outcomeDeltaValue(rootValue, leafValue) {
    return leafValue.realizedScore - rootValue.realizedScore
      + (finite(leafValue.resourceFacts?.credits) - finite(rootValue.resourceFacts?.credits)) * 5
      + (finite(leafValue.resourceFacts?.energy) - finite(rootValue.resourceFacts?.energy)) * 5
      + (finite(leafValue.resourceFacts?.publicity) - finite(rootValue.resourceFacts?.publicity)) * 2.5
      + (finite(leafValue.resourceFacts?.ordinaryCards) - finite(rootValue.resourceFacts?.ordinaryCards)) * 2.5
      + (finite(leafValue.resourceFacts?.alienCards) - finite(rootValue.resourceFacts?.alienCards)) * (10 / 3);
  }

  function compareGoals(left, right) {
    return Number(isAffordable(right)) - Number(isAffordable(left))
      || goalValue(right) - goalValue(left)
      || finite(right?.publicityStops) - finite(left?.publicityStops)
      || finite(right?.targetBenefit?.score) - finite(left?.targetBenefit?.score)
      || gapSize(left) - gapSize(right)
      || String(left?.requirementId || "").localeCompare(String(right?.requirementId || ""));
  }

  function bestGoal(requirements) {
    return [...(requirements?.candidates || [])]
      .filter((candidate) => finite(candidate?.targetBenefit?.score) > 0)
      .sort(compareGoals)[0] || null;
  }

  function sameRoute(requirements, goal) {
    const candidates = requirements?.candidates || [];
    return candidates.find((candidate) => (
      candidate?.requirementId && candidate.requirementId === goal?.requirementId
    )) || candidates
      .filter((candidate) => (
        candidate?.targetId === goal?.targetId
        && (
          candidate?.sourceId === goal?.sourceId
          || goal?.sourceId === "launch"
        )
      ))
      .sort(compareGoals)[0] || null;
  }

  function evaluateSetupProbeGoals(observation, seatId) {
    evaluateState(observation, seatId);
    const requirements = observation.outcomeProjection.progress?.probeGoalRequirements;
    const goal = bestGoal(requirements);
    const gap = goal?.gap || {};
    return deepFreeze({
      evaluationModel: EVALUATION_MODEL,
      reachable: Boolean(goal),
      affordable: isAffordable(goal),
      targetBenefitScore: finite(goal?.targetBenefit?.score),
      targetValue: goalValue(goal),
      gap: {
        credits: finite(gap.credits),
        energy: finite(gap.energy),
        movementSteps: finite(gap.movementSteps),
      },
      targetId: goal?.targetId || null,
      fieldPaths: {
        requirements: "outcomeProjection.progress.probeGoalRequirements.candidates",
        targetBenefit: "outcomeProjection.progress.probeGoalRequirements.candidates[].targetBenefit.score",
        gap: "outcomeProjection.progress.probeGoalRequirements.candidates[].gap",
      },
    });
  }

  function compareSetupProbeGoals(left, right) {
    const leftGap = left?.gap || {};
    const rightGap = right?.gap || {};
    return Number(Boolean(right?.reachable)) - Number(Boolean(left?.reachable))
      || Number(Boolean(right?.affordable)) - Number(Boolean(left?.affordable))
      || finite(right?.targetValue) - finite(left?.targetValue)
      || finite(right?.targetBenefitScore) - finite(left?.targetBenefitScore)
      || gapSize({ gap: leftGap }) - gapSize({ gap: rightGap })
      || finite(leftGap.credits) - finite(rightGap.credits)
      || finite(leftGap.energy) - finite(rightGap.energy)
      || finite(leftGap.movementSteps) - finite(rightGap.movementSteps);
  }

  function matchesNextStep(action, step) {
    if (!action || !step || action.family !== step.family) return false;
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
    const rootGoals = rootRequirements?.candidates || [];
    if (!rootGoals.length && isProbeAction) {
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
        value: legacyBest.goalScoreGain,
        selectable: true,
        priorityClass: 0,
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
    const techTileId = String(action?.target?.tileId || "");
    if (/^(blue|purple)\d+$/.test(techTileId)) {
      return unavailable(outcome, "probe-policy-orange-tech-only");
    }
    const rootGoal = bestGoal(rootRequirements);
    const evaluatedLeaves = (outcome.leaves || [])
      .filter((leaf) => leaf?.status !== "failed" && leaf?.observation)
      .map((leaf) => {
        const leafValue = evaluateState(leaf.observation, context.seatId);
        const summary = leaf.observation.outcomeProjection.progress?.probeRoute?.candidate || null;
        const leafRequirements = leaf.observation.outcomeProjection.progress?.probeGoalRequirements;
        const actualScoreDelta = leafValue.realizedScore - rootValue.realizedScore;
        const directOutcomeValue = outcomeDeltaValue(rootValue, leafValue);
        const orangeTechGain = Math.max(0,
          finite(leaf.observation.outcomeProjection.progress?.orangeTechCount)
          - finite(outcome.rootObservation.outcomeProjection.progress?.orangeTechCount));
        const rootProbeCount = rootValue
          ? outcome.rootObservation.outcomeProjection.progress?.probeRoute?.deployedProbes?.length || 0
          : 0;
        const leafProbeCount = leaf.observation.outcomeProjection.progress?.probeRoute?.deployedProbes?.length || 0;
        const orangeTechLaunchedProbe = leafProbeCount > rootProbeCount;
        const leafGoal = rootGoal ? sameRoute(leafRequirements, rootGoal) : null;
        const leafBestGoal = bestGoal(leafRequirements);
        const divertedEndpoint = Boolean(
          rootGoal
          && summary?.endpointTargetId
          && summary.endpointTargetId !== rootGoal.targetId
        );
        const gapReduction = rootGoal && leafGoal && !divertedEndpoint
          ? Math.max(0, gapSize(rootGoal) - gapSize(leafGoal))
          : 0;
        const requirementReduction = rootGoal && leafGoal && !divertedEndpoint
          ? Math.max(0, requirementSize(rootGoal) - requirementSize(leafGoal))
          : 0;
        const completed = Boolean(
          rootGoal
          && actualScoreDelta > 0
          && summary?.endpointTargetId === rootGoal.targetId
        );
        const orangeRouteImproved = orangeTechGain > 0
          && (!orangeTechLaunchedProbe || rootProbeCount === 0)
          && Boolean(
          gapReduction > 0
          || requirementReduction > 0
          || (
            leafBestGoal
            && (
              !rootGoal
              || goalValue(leafBestGoal) > goalValue(rootGoal)
              || !rootGoals.some((candidate) => candidate.targetId === leafBestGoal.targetId)
            )
          )
        );
        const evaluatedGoal = orangeRouteImproved && leafBestGoal
          ? leafBestGoal
          : rootGoal;
        return {
          leaf,
          leafValue,
          rootGoal,
          leafGoal,
          leafBestGoal,
          evaluatedGoal,
          summary,
          divertedEndpoint,
          actualScoreDelta,
          directOutcomeValue,
          gapReduction,
          requirementReduction,
          orangeTechGain,
          orangeTechLaunchedProbe,
          orangeRouteImproved,
          completed,
          value: evaluatedGoal ? goalValue(evaluatedGoal) : directOutcomeValue,
        };
      })
      .sort((left, right) => (
        right.value - left.value
        || Number(right.completed) - Number(left.completed)
        || right.gapReduction - left.gapReduction
        || right.requirementReduction - left.requirementReduction
        || right.orangeTechGain - left.orangeTechGain
        || right.actualScoreDelta - left.actualScoreDelta
        || String(left.leaf.leafId || "").localeCompare(String(right.leaf.leafId || ""))
      ));
    const controlFlow = action?.phase === "conditional";
    const controlAction = CONTROL_FAMILIES.has(action?.family);
    const allowedEnabler = PROBE_ENABLER_FAMILIES.has(action?.family);
    const routeAffordable = isAffordable(rootGoal);
    const eligibleLeaves = evaluatedLeaves.filter((candidate) => {
      const nextProbeStep = matchesNextStep(action, rootGoal?.nextStep);
      if (isProbeAction) {
        return candidate.completed || (nextProbeStep && !candidate.divertedEndpoint);
      }
      if (action?.family === "research_tech") {
        return candidate.orangeRouteImproved;
      }
      if (allowedEnabler) {
        return candidate.gapReduction > 0
          || candidate.requirementReduction > 0
          || candidate.orangeRouteImproved;
      }
      return controlFlow || controlAction;
    });
    const best = eligibleLeaves[0] || null;
    if (!best) {
      return unavailable(
        outcome,
        PROBE_FAMILIES.has(action?.family) || PROBE_ENABLER_FAMILIES.has(action?.family)
          ? "not-current-probe-goal-step"
          : "outside-probe-policy-scope",
      );
    }
    const nextProbeStep = matchesNextStep(action, rootGoal?.nextStep);
    const routeAdvanced = isProbeAction && nextProbeStep && !best.completed;
    const directGapFill = allowedEnabler && (
      best.gapReduction > 0
      || best.requirementReduction > 0
      || best.orangeRouteImproved
    );
    const selectable = best.completed || routeAdvanced || directGapFill || controlFlow || controlAction;
    if (!selectable) return unavailable(outcome, "not-current-probe-goal-step");
    const priorityClass = best.completed
      ? 4
      : routeAdvanced
        ? routeAffordable ? 3 : 1
        : directGapFill
          ? 2 + Math.min(0.9, (best.gapReduction + best.requirementReduction) / 10)
          : controlFlow
            ? 3 + Math.min(0.9, (
              best.gapReduction
              + best.requirementReduction
              + Math.max(0, best.directOutcomeValue) / 100
              + Math.max(0, best.actualScoreDelta) / 100
            ) / 10)
            : 0;
    return deepFreeze({
      evaluationModel: EVALUATION_MODEL,
      score: best.value,
      value: best.value,
      selectable: true,
      priorityClass,
      goalScoreGain: finite(best.evaluatedGoal?.targetBenefit?.score),
      status: outcome.status,
      confidence: outcome.confidence || "high",
      rootValue,
      leafValue: best.leafValue,
      actualScoreDelta: best.actualScoreDelta,
      probeGoalRequirement: best.evaluatedGoal,
      leafProbeGoalRequirement: best.leafGoal,
      gapReduction: best.gapReduction,
      requirementReduction: best.requirementReduction,
      orangeTechGain: best.orangeTechGain,
      orangeRouteImproved: best.orangeRouteImproved,
      probeRouteSummary: isProbeAction ? best.summary : null,
      selectedLeafId: best.leaf.leafId || null,
      actionChain: best.leaf.actionChain || [],
      reasonCodes: [best.completed
        ? "probe-goal-completed-standard-leaf"
        : routeAdvanced
          ? "probe-goal-route-advanced"
          : directGapFill
            ? action.family === "research_tech"
              ? "probe-goal-gap-reduced-by-orange-tech"
              : "probe-goal-gap-reduced-by-standard-leaf"
        : controlFlow
          ? "required-standard-decision"
          : action?.family === "end_turn"
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
    evaluateSetupProbeGoals,
    compareSetupProbeGoals,
    evaluateAction: evaluateOutcome,
    evaluateOutcome,
  });
});
