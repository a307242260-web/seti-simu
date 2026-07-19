(function () {
  "use strict";

  const output = document.querySelector("#result");
  const root = document.querySelector("#decision-root");

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  try {
    let committed = {
      version: 60,
      stateVersion: 60,
      decisionVersion: 0,
      actorId: "p1",
      players: { p1: { id: "p1" }, p2: { id: "p2" } },
      cards: { hands: { p1: [], p2: [] }, deck: ["hidden-chrome", "future-hidden"] },
      choices: {
        scan_target: ["nebula-a", "nebula-b"],
        scan_sector: ["yellow", "blue"],
        scan_participant_reward: { p1: ["score", "data"], p2: ["energy", "card"] },
        data_placement: ["computer-a", "computer-b"],
        land_target: ["mars", "europa"],
        land_payment: ["energy", "card"],
      },
      trace: [],
    };
    let latestObservation = null;
    let latestInspection = null;
    let commitCount = 0;
    const forbiddenCalls = { pendingOwner: 0, continuation: 0, aiResolver: 0 };

    function listChoiceIds(state, pending) {
      const source = state.choices[pending.type];
      return Array.isArray(source) ? source : (source[pending.ownerId] || []);
    }

    const registry = SetiStandardAction.createRegistry({
      getAuthority(context) {
        const state = context.state || context;
        return {
          actorId: context.pending?.ownerId || state.actorId,
          stateVersion: state.stateVersion,
          decisionVersion: state.decisionVersion,
        };
      },
    });
    for (const family of ["scan", "place_data", "land"]) {
      registry.register(SetiStandardAction.createOptionDefinition(family, {
        getOptions: () => ({ ok: true, choices: [{ target: { intent: family }, label: family }] }),
        canExecute: () => ({ ok: true }),
        execute: () => { forbiddenCalls.continuation += 1; return { ok: false }; },
      }));
    }
    for (const family of ["choose_target", "choose_payment", "choose_reward"]) {
      registry.register(SetiStandardAction.createConditionalDefinition(family, {
        getOptions(context) {
          return {
            ok: true,
            choices: listChoiceIds(context.state, context.pending).map((choiceId) => ({
              target: { kind: context.pending.type, choiceId },
              payload: context.pending.type === "land_payment" ? { cost: { resource: choiceId, amount: 1 } } : {},
              label: `${context.pending.type}:${choiceId}`,
            })),
          };
        },
        canExecute(context, option) {
          return listChoiceIds(context.state, context.pending).includes(option.target.choiceId)
            ? { ok: true }
            : { ok: false, message: "stale" };
        },
        execute(context, option) {
          context.state.decisionVersion += 1;
          context.state.trace.push(`decision:${context.pending.type}:${context.pending.ownerId}:${option.target.choiceId}`);
          return { ok: true, nextState: context.state };
        },
      }));
    }

    const flow = SetiScanCardSession.createScanCardRuntime({
      readCommittedState: () => structuredClone(committed),
      enumerateConditional(state, pending) {
        return registry.enumerate({ state, pending }, { family: pending.family, actorId: pending.ownerId });
      },
      executeConditional(state, action, pending) {
        return registry.execute({ state, pending }, action);
      },
      runScan(state, payload) {
        state.trace.push(`scan:${payload.targetAction.target.choiceId}`);
        return { ok: true, nextState: state, scan: {} };
      },
      buildScanSectorPending: () => ({ type: "scan_sector" }),
      settleScan(state, payload) {
        state.trace.push(`sector:${payload.sectorAction.target.choiceId}`);
        return { ok: true, nextState: state };
      },
      buildScanFollowups: () => [
        { priority: "deferred", kind: "deferred_draw", payload: { playerId: "p1" } },
        { priority: "direct", kind: "participant_reward", ownerId: "p1", payload: { playerId: "p1" } },
        { priority: "direct", kind: "participant_reward", ownerId: "p2", payload: { playerId: "p2" } },
      ],
      buildParticipantRewardPending: (_state, reward) => ({ ownerId: reward.playerId }),
      applyParticipantReward(state, reward) {
        state.trace.push(`reward:${reward.playerId}:${reward.rewardAction.target.choiceId}`);
        return { ok: true, nextState: state };
      },
      drawDeferredCard(state, draw) {
        const cardId = state.cards.deck.shift();
        state.cards.hands[draw.playerId].push(cardId);
        state.trace.push(`draw:${cardId}`);
        return {
          ok: true,
          nextState: state,
          rng: [{ kind: "hidden-draw", cardId }],
          irreversible: { kind: "hidden-information", reason: "draw revealed" },
        };
      },
      placeData(state, payload) {
        state.trace.push(`data:${payload.placementAction.target.choiceId}`);
        return { ok: true, nextState: state };
      },
      buildLandPaymentPending: () => ({}),
      land(state, payload) {
        state.trace.push(`land:${payload.targetAction.target.choiceId}:${payload.paymentAction.target.choiceId}`);
        return { ok: true, nextState: state };
      },
      playCard() { forbiddenCalls.continuation += 1; return { ok: false }; },
      buildCardEffects() { forbiddenCalls.continuation += 1; return []; },
      applyCardEffect() { forbiddenCalls.continuation += 1; return { ok: false }; },
      buildCardTriggers() { forbiddenCalls.continuation += 1; return []; },
      applyTrigger() { forbiddenCalls.continuation += 1; return { ok: false }; },
    });
    const store = {
      getSnapshot: () => ({ state: structuredClone(committed) }),
      compareAndCommit(baseVersion, nextState) {
        assert(baseVersion === committed.version, "state version conflict");
        committed = structuredClone(nextState);
        committed.version += 1;
        committed.stateVersion = committed.version;
        commitCount += 1;
        return { ok: true };
      },
    };
    const viewStore = SetiBrowserViewStateStore.createViewStateStore();
    const projectionAdapter = SetiBrowserProjectionAdapter.createBrowserProjectionAdapter({
      stateStore: store,
      sessionRuntime: {
        inspect: () => structuredClone(latestInspection),
        observe: () => structuredClone(latestObservation),
      },
    });
    let host;
    let renderer;
    function renderLatest() {
      if (host.inspect().phase === "idle") {
        renderer?.render({ projection: { projectionId: "idle", decision: null }, viewState: viewStore.getSnapshot() });
        return null;
      }
      const ownerId = latestInspection.decision?.ownerId || "p1";
      const projection = projectionAdapter.projectSession({}, {
        viewer: { viewerId: `chrome-${ownerId}`, playerId: ownerId, role: "player" },
      });
      const inspectIds = latestInspection.decision.choices.map((choice) => choice.actionId).sort();
      const projectionIds = projection.decision.choices.map((choice) => choice.choiceId).sort();
      assert(JSON.stringify(inspectIds) === JSON.stringify(projectionIds), "projection choices 与 inspect 不等价");
      viewStore.reconcileProjection(projection);
      renderer?.render({ projection, viewState: viewStore.getSnapshot() });
      return projection;
    }
    host = SetiAppEffectSessionHost.createBrowserEffectSessionHost({
      stateStore: store,
      actionRegistry: registry,
      flows: { scan: flow, place_data: flow, land: flow },
      renderProjection(observation, inspection) {
        latestObservation = observation;
        latestInspection = inspection.session;
        if (renderer) renderLatest();
      },
    });
    const input = SetiBrowserInputAdapter.createBrowserInputAdapter({
      dispatchAction: (action) => host.dispatchAction(action),
      submitDecision: (submission) => host.submitDecisionChoice(
        submission.decisionId,
        submission.decisionVersion,
        submission.choice.choiceId,
      ),
      viewStateStore: viewStore,
      refreshProjection: renderLatest,
    });
    const controller = SetiBrowserDecisionUi.createDecisionUiController({ dispatchIntent: input.dispatchIntent });
    renderer = SetiBrowserDecisionUi.createDecisionDomRenderer({ root, controller });

    function dispatchFamily(family) {
      const action = host.enumerateActions({ family })[0];
      assert(action && input.dispatchIntent({ kind: "action", action }).ok, `${family} dispatch 失败`);
      renderLatest();
    }

    function clickChoice(labelSuffix, expectedType) {
      const projection = renderLatest();
      assert(root.querySelector(`.decision-ui-content-${expectedType}`), `缺少 ${expectedType} renderer`);
      const choice = projection.decision.choices.find((entry) => entry.label.endsWith(`:${labelSuffix}`));
      assert(choice, `缺少 ${labelSuffix} choice`);
      root.querySelector(`[data-choice-id="${choice.choiceId}"]`).click();
      renderLatest();
      root.querySelector('[data-decision-ui-intent="confirm"]').click();
    }

    dispatchFamily("scan");
    clickChoice("nebula-b", "board-target");
    clickChoice("blue", "board-target");
    clickChoice("data", "choices");
    assert(!JSON.stringify(renderLatest()).includes("hidden-chrome"), "补牌前泄漏隐藏牌");
    assert(!JSON.stringify(renderLatest()).includes("future-hidden"), "泄漏未来牌序");
    clickChoice("card", "choices");
    dispatchFamily("place_data");
    clickChoice("computer-b", "board-target");
    dispatchFamily("land");
    clickChoice("europa", "board-target");
    clickChoice("energy", "payment");

    const expected = [
      "decision:scan_target:p1:nebula-b", "scan:nebula-b",
      "decision:scan_sector:p1:blue", "sector:blue",
      "decision:scan_participant_reward:p1:data", "reward:p1:data",
      "decision:scan_participant_reward:p2:card", "reward:p2:card", "draw:hidden-chrome",
      "decision:data_placement:p1:computer-b", "data:computer-b",
      "decision:land_target:p1:europa", "decision:land_payment:p1:energy", "land:europa:energy",
    ];
    assert(JSON.stringify(committed.trace) === JSON.stringify(expected), "scan/data/land 固定 trace 不一致");
    assert(commitCount === 3, "三个动作应各自原子提交一次");
    assert(JSON.stringify(forbiddenCalls) === JSON.stringify({ pendingOwner: 0, continuation: 0, aiResolver: 0 }), "命中旧 owner/resolver/continuation");
    document.body.dataset.result = "passed";
    output.textContent = JSON.stringify({ ok: true, trace: committed.trace, commitCount, forbiddenCalls });
  } catch (error) {
    document.body.dataset.result = "failed";
    output.textContent = JSON.stringify({ ok: false, message: error.message, stack: error.stack });
  }
})();
