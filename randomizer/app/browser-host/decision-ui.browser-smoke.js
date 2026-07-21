(function () {
  "use strict";

  const output = document.querySelector("#result");
  const root = document.querySelector("#decision-root");

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  try {
    let committed = {
      version: 11,
      stateVersion: 11,
      decisionVersion: 0,
      actorId: "p1",
      trace: [],
      legalTechChoices: [],
      players: { p1: { id: "p1", name: "一号" } },
      cards: {}, tech: {}, aliens: {}, match: {}, turn: {},
    };
    let latestObservation = null;
    let latestInspection = null;
    let commitCount = 0;
    const forbiddenCalls = { takeTech: 0, reward: 0, continuation: 0 };
    const store = {
      getSnapshot: () => ({ state: structuredClone(committed) }),
      beginWorkingCopy(baseVersion = committed.version) {
        return baseVersion === committed.version
          ? { ok: true, baseVersion, state: structuredClone(committed) }
          : { ok: false, code: "STATE_VERSION_CONFLICT", baseVersion, currentVersion: committed.version };
      },
      compareAndCommit(baseVersion, nextState) {
        if (baseVersion !== committed.version) return { ok: false, code: "STATE_VERSION_CONFLICT" };
        committed = structuredClone(nextState);
        committed.version = baseVersion + 1;
        committed.stateVersion = baseVersion + 1;
        commitCount += 1;
        return { ok: true, snapshot: structuredClone(committed) };
      },
    };
    const actionRegistry = SetiStandardAction.createRegistry({
      getAuthority: (state) => ({
        actorId: state.actorId,
        stateVersion: state.stateVersion,
        decisionVersion: state.decisionVersion,
      }),
    });
    actionRegistry.register(SetiStandardAction.createOptionDefinition("research_tech", {
      getOptions: () => ({ ok: true, choices: [{ target: { id: "research" } }] }),
      canExecute: () => ({ ok: true }),
      execute: () => { throw new Error("Decision UI 不得调用 legacy action execute"); },
    }));
    const flow = SetiResearchTechSession.createResearchTechRuntime({
      stateStore: store,
      actionRegistry,
      rotate(state) {
        state.trace.push("rotate");
        state.legalTechChoices = [
          { choiceId: "blue2@slot-a", tileId: "blue2", slotId: "slot-a", slotLabel: "蓝槽 A" },
          { choiceId: "blue2@slot-b", tileId: "blue2", slotId: "slot-b", slotLabel: "蓝槽 B" },
          { choiceId: "purple1", tileId: "purple1" },
        ];
        return { ok: true, nextState: state };
      },
      listChoices: (state) => state.legalTechChoices,
      place(state, choice) {
        state.trace.push(`place:${choice.tileId}:${choice.slotId || "direct"}`);
        return { ok: true, nextState: state, placement: choice };
      },
      buildImmediateRewards: () => [{ kind: "score", amount: 3 }],
      applyImmediateReward(state, reward) {
        state.trace.push(`reward:${reward.kind}:${reward.amount}`);
        return { ok: true, nextState: state };
      },
    });
    const viewStore = SetiBrowserViewStateStore.createViewStateStore();
    const projectionAdapter = SetiBrowserProjectionAdapter.createBrowserProjectionAdapter({
      stateStore: store,
      sessionRuntime: {
        inspect: () => structuredClone(latestInspection),
        observe: () => structuredClone(latestObservation),
      },
    });
    let host;
    let domRenderer;
    function currentProjection() {
      const inspection = host.inspect();
      return inspection.phase === "idle"
        ? projectionAdapter.projectCommitted({ viewer: { viewerId: "chrome-p1", playerId: "p1", role: "player" } })
        : projectionAdapter.projectSession({}, { viewer: { viewerId: "chrome-p1", playerId: "p1", role: "player" } });
    }
    function renderLatest() {
      const projection = currentProjection();
      viewStore.reconcileProjection(projection);
      domRenderer.render({ projection, viewState: viewStore.getSnapshot() });
      return projection;
    }
    host = SetiAppEffectSessionHost.createBrowserEffectSessionHost({
      stateStore: store,
      actionRegistry,
      flows: { research_tech: flow },
      renderProjection(observation, inspection) {
        latestObservation = observation;
        latestInspection = inspection.session;
        if (domRenderer) renderLatest();
      },
    });
    const input = SetiBrowserInputAdapter.createBrowserInputAdapter({
      dispatchAction: (action) => host.dispatchAction(action),
      submitDecision(submission) {
        return host.submitDecisionChoice(
          submission.decisionId,
          submission.decisionVersion,
          submission.choice.choiceId,
        );
      },
      viewStateStore: viewStore,
      refreshProjection: renderLatest,
    });
    const controller = SetiBrowserDecisionUi.createDecisionUiController({ dispatchIntent: input.dispatchIntent });
    domRenderer = SetiBrowserDecisionUi.createDecisionDomRenderer({ root, controller });

    const action = host.enumerateActions({ family: "research_tech" })[0];
    assert(host.dispatchAction(action).ok, "研究科技 action dispatch 失败");
    let projection = renderLatest();
    assert(projection.decision.choices.length === 3, "projection 未逐项映射科技 choices");
    root.querySelector('[data-decision-ui-intent="focus-tech"][data-tile-id="blue2"]').click();
    projection = renderLatest();
    assert(root.querySelectorAll(".decision-ui-tech-slot").length === 2, "蓝槽未从 choices 聚合");
    root.querySelector('[data-choice-id="blue2@slot-b"]').click();
    renderLatest();
    root.querySelector('[data-decision-ui-intent="confirm"]').click();

    assert(commitCount === 1, "研究科技链必须原子提交一次");
    assert(JSON.stringify(committed.trace) === JSON.stringify(["rotate", "place:blue2:slot-b", "reward:score:3"]), "固定 trace 不一致");
    assert(root.hidden, "完成后 Decision shell 应隐藏");
    assert(JSON.stringify(forbiddenCalls) === JSON.stringify({ takeTech: 0, reward: 0, continuation: 0 }), "UI 调用了规则 continuation");

    document.body.dataset.result = "passed";
    output.textContent = JSON.stringify({ ok: true, trace: committed.trace, commitCount, forbiddenCalls });
  } catch (error) {
    document.body.dataset.result = "failed";
    output.textContent = JSON.stringify({ ok: false, message: error.message, stack: error.stack });
  }
})();
