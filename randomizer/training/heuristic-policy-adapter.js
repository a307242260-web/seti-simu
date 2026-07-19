"use strict";

const policyPort = require("../game/ai/policy-port");
const standardAction = require("../game/actions/standard-action");
const heuristicPolicy = require("../game/ai/heuristic-policy");

function toStandardDescriptor(action) {
  if (!action || typeof action !== "object") return null;
  const actorId = action.actorPlayerId || action.actorId;
  const phase = action.actionFeature?.phase || standardAction.PHASE_BY_FAMILY[action.family];
  return {
    schemaVersion: policyPort.STANDARD_ACTION_SCHEMA_VERSION,
    family: action.family,
    phase,
    actionId: action.actionId,
    actorId,
    stateVersion: action.stateVersion,
    decisionVersion: action.decisionVersion,
    target: action.target || null,
    payload: action.payload || {},
    summary: action.summary || action.family,
  };
}

function createHeuristicPolicyAdapter(options = {}) {
  const policy = options.policy || heuristicPolicy.createHeuristicPolicy(options);
  let requestOrdinal = 0;

  function select(observation, legalActions, deterministicContext = {}) {
    if (!Array.isArray(legalActions) || !legalActions.length) {
      throw new heuristicPolicy.HeuristicPolicyError(
        "HEURISTIC_POLICY_EMPTY_LEGAL_SET",
        "Heuristic Policy adapter 不接受空 legal set",
      );
    }
    const descriptors = legalActions.map(toStandardDescriptor);
    const first = descriptors[0];
    const context = policyPort.createDecisionContext({
      requestId: `heuristic:${first.actorId}:${first.stateVersion}:${first.decisionVersion}:${requestOrdinal}`,
      seatId: first.actorId,
      stateVersion: first.stateVersion,
      decisionVersion: first.decisionVersion,
      observation,
      legalActions: descriptors,
      deterministicContext: {
        ...deterministicContext,
        requestOrdinal,
      },
    });
    requestOrdinal += 1;
    const decision = policy.decide(context);
    const action = legalActions.find((candidate) => candidate.actionId === decision.actionId) || null;
    if (!action) {
      throw new heuristicPolicy.HeuristicPolicyError(
        "HEURISTIC_POLICY_ACTION_MAPPING_FAILED",
        "PolicyDecision 无法映射回 Host legal action",
      );
    }
    return Object.freeze({ context, decision, action });
  }

  return Object.freeze({
    select,
    getProvenance: policy.getProvenance,
  });
}

module.exports = { createHeuristicPolicyAdapter, toStandardDescriptor };
