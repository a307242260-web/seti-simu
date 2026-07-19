"use strict";

const policyPort = require("../game/ai/policy-port");
const standardAction = require("../game/actions/standard-action");
const heuristicPolicy = require("../game/ai/heuristic-policy");
const machinePlayerHost = require("../game/ai/machine-player-host");

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
  let host = null;
  let initializedSeatIds = [];
  let currentInput = null;

  function createHost() {
    return machinePlayerHost.createMachinePlayerHost({
      requestPrefix: "headless-policy",
      defaultDeadlineMs: options.defaultDeadlineMs,
      adapter: {
        readDecisionInput(seatId) {
          if (!currentInput || currentInput.seatId !== seatId) {
            return { ok: false, code: "HEADLESS_POLICY_INPUT_MISSING", message: "headless Policy 决策输入缺失" };
          }
          return currentInput;
        },
        validateFresh(input, action) {
          if (currentInput !== input) {
            return { ok: false, code: "HEADLESS_POLICY_INPUT_STALE", message: "headless Policy 输入已失效" };
          }
          const freshAction = input.legalActions.find((candidate) => candidate.actionId === action.actionId);
          if (!freshAction) {
            return { ok: false, code: "HEADLESS_POLICY_ACTION_NOT_LEGAL", message: "Policy actionId 已不在当前 legal set" };
          }
          return { ok: true, action: freshAction };
        },
        submit(action, input, context) {
          const originalAction = input.originalActions.find((candidate) => candidate.actionId === action.actionId);
          if (!originalAction) {
            return { ok: false, code: "HEADLESS_POLICY_ACTION_MAPPING_FAILED", message: "PolicyDecision 无法映射回 Host legal action" };
          }
          if (typeof input.submitAction !== "function") {
            return { ok: true, selectedAction: originalAction };
          }
          const result = input.submitAction(originalAction, context.policyDecision);
          return result?.ok === false ? result : { ok: true, result, selectedAction: originalAction };
        },
      },
    });
  }

  function initializeSeats(seatIds, initOptions = {}) {
    const normalized = [...new Set((seatIds || []).map(String))];
    if (!normalized.length) throw new TypeError("Heuristic Policy adapter 需要至少一个固定席位");
    host = createHost();
    const provenance = policy.getProvenance();
    host.initializeSeats(normalized.map((seatId) => ({
      seatId,
      policy,
      identity: {
        policyType: provenance.type,
        policyVersion: provenance.version,
        modelChecksum: provenance.modelChecksum ?? null,
        config: provenance.config || {},
        configChecksum: provenance.configChecksum,
        seed: options.seed ?? initOptions.seed ?? null,
      },
    })), {
      phase: initOptions.phase || "new_game",
    });
    initializedSeatIds = normalized;
    return host.inspect();
  }

  function ensureSeat(seatId) {
    if (!host) return initializeSeats([seatId]);
    if (!initializedSeatIds.includes(seatId)) {
      throw new heuristicPolicy.HeuristicPolicyError(
        "HEURISTIC_POLICY_SEAT_NOT_INITIALIZED",
        `Heuristic Policy 席位未在开局固定: ${seatId}`,
      );
    }
    return null;
  }

  function restoreHostSnapshot(snapshot) {
    if (!host) host = createHost();
    const provenance = policy.getProvenance();
    const restored = host.restore(snapshot, {
      resolvePolicy(identity) {
        if (identity.policyType !== provenance.type
          || identity.policyVersion !== provenance.version
          || (identity.modelChecksum ?? null) !== (provenance.modelChecksum ?? null)) {
          return null;
        }
        return policy;
      },
    });
    initializedSeatIds = restored.seats.map((seat) => seat.seatId);
    return restored;
  }

  function runDecision(observation, legalActions, deterministicContext = {}, submitAction = null) {
    if (!Array.isArray(legalActions) || !legalActions.length) {
      throw new heuristicPolicy.HeuristicPolicyError(
        "HEURISTIC_POLICY_EMPTY_LEGAL_SET",
        "Heuristic Policy adapter 不接受空 legal set",
      );
    }
    const descriptors = legalActions.map(toStandardDescriptor);
    const first = descriptors[0];
    ensureSeat(first.actorId);
    currentInput = {
      ok: true,
      seatId: first.actorId,
      stateVersion: first.stateVersion,
      decisionVersion: first.decisionVersion,
      observation,
      legalActions: descriptors,
      deterministicContext: {
        ...deterministicContext,
        inputSchemaVersion: "seti-headless-policy-input-v1",
      },
      originalActions: legalActions,
      submitAction,
    };
    const result = host.requestDecisionSync(first.actorId);
    const action = result?.submission?.selectedAction || null;
    currentInput = null;
    if (!result?.ok || !action) {
      throw new heuristicPolicy.HeuristicPolicyError(
        result?.code || "HEURISTIC_POLICY_ACTION_MAPPING_FAILED",
        result?.message || "PolicyDecision 无法映射回 Host legal action",
      );
    }
    return Object.freeze({
      context: policyPort.createDecisionContext({
        requestId: result.requestId,
        seatId: first.actorId,
        stateVersion: first.stateVersion,
        decisionVersion: first.decisionVersion,
        observation,
        legalActions: descriptors,
        deterministicContext,
      }),
      decision: result.policyDecision,
      action,
      submission: result.submission,
      policyIdentity: result.policyIdentity,
    });
  }

  function select(observation, legalActions, deterministicContext = {}) {
    return runDecision(observation, legalActions, deterministicContext, null);
  }

  return Object.freeze({
    select,
    runDecision,
    initializeSeats,
    inspectHost: () => host?.inspect() || null,
    createHostSnapshot: () => host?.createSnapshot() || null,
    restoreHostSnapshot,
    getProvenance: policy.getProvenance,
  });
}

module.exports = { createHeuristicPolicyAdapter, toStandardDescriptor };
