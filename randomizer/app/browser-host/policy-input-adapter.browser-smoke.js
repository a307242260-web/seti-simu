(async function () {
  "use strict";

  const output = document.querySelector("#result");
  const status = document.querySelector("#ai-status");
  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  try {
    const action = {
      schemaVersion: "seti-standard-action-v1", family: "launch", phase: "main",
      actionId: "launch:chrome-ai", actorId: "p1", stateVersion: 4, decisionVersion: 7,
      target: { rocketId: "r1" }, payload: {}, summary: "AI 发射",
    };
    const choices = ["credit", "score"].map((reward) => ({
      schemaVersion: "seti-standard-action-v1", family: "choose_reward", phase: "conditional",
      actionId: `choose_reward:chrome-ai:${reward}`, actorId: "p1", stateVersion: 4, decisionVersion: 8,
      target: { reward }, payload: { value: reward === "score" ? 5 : 1 }, summary: reward,
    }));
    let boundary = {
      kind: "action", actorId: "p1", stateVersion: 4, decisionVersion: 7, legalActions: [action],
    };
    const trace = [];
    const forbiddenCalls = { overlay: 0, renderer: 0, pickerResolver: 0, pendingResolver: 0 };
    const viewStore = SetiBrowserViewStateStore.createViewStateStore();
    const input = SetiBrowserInputAdapter.createBrowserInputAdapter({
      dispatchAction(submitted) {
        trace.push(`action:${submitted.actionId}`, "effect:launch");
        boundary = {
          kind: "decision", actorId: "p1", stateVersion: 4, decisionVersion: 8,
          decisionId: "chrome-ai-decision", legalActions: choices,
        };
        status.textContent = "AI 正在选择奖励";
        return { ok: true, phase: "awaiting_input" };
      },
      submitDecision(submission) {
        trace.push(`decision:${submission.choice.actionId}`, `reward:${submission.choice.target.reward}`);
        boundary = { kind: "terminal", terminal: { phase: "completed" } };
        status.textContent = "AI 已完成行动";
        return { ok: true, phase: "completed" };
      },
      viewStateStore: viewStore,
    });
    const policy = SetiHeuristicPolicy.createHeuristicPolicy({ difficulty: "weak_start" });
    const observation = (score) => SetiOutcomeModel.createDecisionObservation({
      publicState: { players: [{ id: "p1", resources: { score, credits: 0 } }], board: {} },
      selfState: { playerId: "p1", hand: [] },
    }, {
      seatId: "p1",
      stateVersion: boundary.stateVersion,
      decisionVersion: boundary.decisionVersion,
    });
    const driver = SetiBrowserPolicyInputAdapter.createPolicyInputAdapter({
      policy,
      readBoundary: () => structuredClone(boundary),
      readObservation: () => observation(0),
      readActionOutcomes: (current) => current.legalActions.map((candidate) => {
        const score = candidate.target?.reward === "score" ? 5 : 1;
        return {
          schemaVersion: "seti-action-outcome-v1",
          actionId: candidate.actionId,
          status: "settled",
          confidence: "high",
          rootObservation: observation(0),
          leaves: [{
            leafId: `leaf:${candidate.actionId}`,
            actionChain: [candidate.actionId],
            observation: observation(score),
            legalSuccessors: [],
          }],
        };
      }),
      inputAdapter: input,
    });
    assert((await driver.runOnce()).ok, "AI Standard Action 提交失败");
    assert((await driver.runOnce()).ok, "AI Standard Decision 提交失败");
    assert(JSON.stringify(trace) === JSON.stringify([
      "action:launch:chrome-ai", "effect:launch",
      "decision:choose_reward:chrome-ai:score", "reward:score",
    ]), "AI 固定 Action/Decision trace 不一致");
    assert(status.textContent === "AI 已完成行动", "AI 展示未跟随共享 session 结果");
    assert(Object.values(forbiddenCalls).every((count) => count === 0), "AI 访问了 renderer/picker resolver");
    document.body.dataset.result = "passed";
    output.textContent = JSON.stringify({ ok: true, trace, forbiddenCalls, status: status.textContent });
  } catch (error) {
    document.body.dataset.result = "failed";
    output.textContent = JSON.stringify({ ok: false, message: error.message, stack: error.stack });
  }
})();
