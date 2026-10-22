(function (root, factory) {
  "use strict";
  const policyPort = typeof module === "object" && module.exports
    ? require("./policy-port") : root.SetiPolicyPort;
  const api = factory(policyPort);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SetiAgentRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (policyPort) {
  "use strict";

  function createAgentDecisionFunction({ seatId, createAgent, config = {}, onDecision } = {}) {
    if (typeof seatId !== "string" || !seatId || typeof createAgent !== "function") {
      throw new TypeError("AGENT_FACTORY_INVALID: 需要 seatId 和 createAgent");
    }
    const agentConfig = policyPort.createDecisionContext({
      requestId: "agent-config", seatId, stateVersion: 0, decisionVersion: 0,
      observation: config,
    }).observation;
    const agent = createAgent({ seatId, config: agentConfig });
    if (typeof agent?.decide !== "function" || typeof agent?.getProvenance !== "function") {
      throw new TypeError("AGENT_FACTORY_INVALID: agent 需要 decide/getProvenance");
    }
    const provenance = Object.freeze(structuredClone(agent.getProvenance()));

    function run(boundary) {
      if (boundary.seatId !== seatId) throw new Error("AGENT_SEAT_MISMATCH");
      const actions = boundary.legalActions;
      if (!Array.isArray(actions) || !actions.length) throw new Error("AGENT_EMPTY_LEGAL_SET");
      const policyContext = policyPort.createDecisionContext({
        requestId: `agent:${seatId}:${actions[0].stateVersion}:${actions[0].decisionVersion}`,
        seatId,
        stateVersion: actions[0].stateVersion,
        decisionVersion: actions[0].decisionVersion,
        observation: boundary.observation,
        legalActions: actions,
      });
      // 只保留公开的多选状态，不把 presentation 卡面或 runtime session 传给算法。
      const selectedActionIds = Object.freeze(actions
        .filter(action => action.presentation?.selected === true)
        .map(action => action.actionId).sort());
      const context = Object.freeze({
        ...policyContext, schemaVersion: "seti-agent-context-v1", selectedActionIds,
      });
      const selection = agent.decide(context);
      if (typeof selection?.then === "function") throw new Error("AGENT_ASYNC_UNSUPPORTED");
      if (!actions.some(action => action.actionId === selection?.actionId)) {
        throw new Error(`AGENT_ACTION_NOT_LEGAL: ${selection?.actionId}`);
      }
      const decision = policyPort.createPolicyDecision(policyContext, {
        actionId: selection.actionId,
        policyType: provenance.type, policyVersion: provenance.version,
        modelChecksum: provenance.modelChecksum,
        diagnostics: { reasonCode: selection.reasonCode || "agent:selection" },
      });
      const agentTrace = Object.freeze({
        schemaVersion: "seti-agent-decision-trace-v1", context,
        actionId: selection.actionId, policy: decision.policy, reasonCode: decision.diagnostics.reasonCode,
        coverage: "not-evaluated",
      });
      if (onDecision) onDecision(agentTrace);
      return { actionId: selection.actionId, decision, agentTrace, actionOutcomes: [], searches: [] };
    }

    return Object.freeze({ run, getProvenance: () => provenance });
  }

  return Object.freeze({ createAgentDecisionFunction });
});
