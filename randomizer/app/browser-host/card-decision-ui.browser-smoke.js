(function () {
  "use strict";

  const output = document.querySelector("#card-decision-smoke-result");
  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }
  function choice(state, pending, id) {
    return {
      schemaVersion: SetiStandardAction.SCHEMA_VERSION,
      actionId: `${pending.family}:${id}`,
      family: pending.family,
      actorId: pending.ownerId,
      stateVersion: state.version,
      decisionVersion: state.decisionVersion,
      target: { id },
      payload: {},
      summary: id,
      presentation: pending.family === "choose_payment"
        ? { cost: { [id]: 1 } }
        : { reward: { [id]: 1 } },
    };
  }

  try {
    const base = {
      version: 7, decisionVersion: 0, actorId: "p1", payments: ["energy"], rewards: ["score"],
      trace: [], cards: { hands: { p1: [{ id: "card-7" }], p2: [{ id: "HIDDEN_CANARY" }] } },
      players: { p1: { id: "p1" }, p2: { id: "p2" } }, match: { currentPlayerId: "p1" },
    };
    const flow = SetiScanCardSession.createScanCardRuntime({
      readCommittedState: () => base,
      enumerateConditional(state, pending) {
        const ids = pending.family === "choose_payment" ? state.payments : state.rewards;
        return ids.map((id) => choice(state, pending, id));
      },
      executeConditional(state, action, pending) {
        const ids = pending.family === "choose_payment" ? state.payments : state.rewards;
        const id = action.target.id;
        if (!ids.includes(id)) return { ok: false, code: "CARD_CHOICE_STALE" };
        state.trace.push(`decision:${pending.type}:${id}`);
        state.decisionVersion += 1;
        return { ok: true, nextState: state };
      },
      runScan: () => ({ ok: false }),
      buildScanSectorPending: () => null,
      settleScan: () => ({ ok: false }),
      buildScanFollowups: () => [],
      applyParticipantReward: (state) => ({ ok: true, nextState: state }),
      drawDeferredCard: (state) => ({ ok: true, nextState: state }),
      playCard(state, payload) {
        state.trace.push(`play:${payload.action.target.cardId}`);
        return { ok: true, nextState: state, card: { cardId: payload.action.target.cardId } };
      },
      buildCardEffects() {
        return [{ id: "first" }, { id: "second" }];
      },
      applyCardEffect(state, effect) {
        state.trace.push(`effect:${effect.id}`);
        return { ok: true, nextState: state };
      },
      buildCardTriggers() {
        return [{ id: "task", type: "task" }, { id: "passive", type: "passive", needsChoice: true }];
      },
      applyTrigger(state, trigger) {
        state.trace.push(`trigger:${trigger.id}`);
        return { ok: true, nextState: state, trigger };
      },
      buildTriggerDecision(_state, result) {
        return result.trigger.needsChoice
          ? { type: "card_trigger_choice", family: "choose_reward", ownerId: "p1", presentationHint: "card" }
          : null;
      },
    });
    const dispatched = flow.dispatch(base, {
      family: "play_card", actorId: "p1", actionId: "play-card:chrome", target: { cardId: "card-7" },
    }, { sessionId: "card-chrome" });
    assert(dispatched.ok, "打牌 session dispatch 失败");
    flow.drain(dispatched.session);

    const presenter = SetiBrowserCardDecisionUi.createCardDecisionPresenter({
      fallback: SetiBrowserProjectionAdapter.defaultDecisionPresenter,
    });
    const projectionAdapter = SetiBrowserProjectionAdapter.createBrowserProjectionAdapter({
      stateStore: { getSnapshot: () => base },
      sessionRuntime: flow,
      decisionPresenter: presenter,
    });
    const viewStore = SetiBrowserViewStateStore.createViewStateStore();
    let currentProjection = null;
    let submissionCount = 0;
    function project() {
      currentProjection = projectionAdapter.projectSession(dispatched.session, {
        viewer: { viewerId: "chrome-p1", playerId: "p1", role: "player" },
      });
      viewStore.reconcileProjection(currentProjection);
      return currentProjection;
    }
    const input = SetiBrowserInputAdapter.createBrowserInputAdapter({
      dispatchAction: () => ({ ok: false }),
      submitDecision(submission) {
        submissionCount += 1;
        const decision = flow.inspect(dispatched.session).decision;
        const selected = decision.choices.find((entry) => entry.actionId === submission.choice.choiceId);
        return flow.resolveDecision(dispatched.session, {
          decisionId: submission.decisionId,
          decisionVersion: submission.decisionVersion,
          ownerId: submission.ownerId,
          choice: selected,
        });
      },
      viewStateStore: viewStore,
      refreshProjection: project,
    });
    const controller = SetiBrowserCardDecisionUi.createCardDecisionUiController(SetiBrowserDecisionUi, {
      dispatchIntent: input.dispatchIntent,
    });
    const renderer = SetiBrowserDecisionUi.createDecisionDomRenderer({
      root: document.querySelector("#card-decision-root"), controller,
    });
    function chooseVisible() {
      project();
      renderer.render({ projection: currentProjection, viewState: viewStore.getSnapshot() });
      const beforeFocus = submissionCount;
      document.querySelector("[data-decision-ui-intent='focus-choice']").click();
      assert(submissionCount === beforeFocus, "多项 Card Decision 聚焦时不得自动代选");
      renderer.render({ projection: currentProjection, viewState: viewStore.getSnapshot() });
      document.querySelector("[data-decision-ui-intent='confirm']").click();
      assert(submissionCount === beforeFocus + 1, "Card Decision 只能在显式确认后提交一次");
    }
    chooseVisible();
    flow.drain(dispatched.session);
    assert(dispatched.session.phase === "awaiting_input", "trigger 新选择未停在 owner");
    chooseVisible();
    flow.drain(dispatched.session);
    assert(dispatched.session.phase === "completed", "打牌链未完成");
    assert(JSON.stringify(base).includes("decision:") === false, "session 完成前污染 base state");
    assert(dispatched.session.journal.decisions.length === 2, "支付/trigger journal 不完整");
    assert(JSON.stringify(currentProjection).includes("HIDDEN_CANARY") === false, "BrowserProjection 泄露隐藏牌");
    assert(JSON.stringify(dispatched.session.committedState.trace) === JSON.stringify([
      "decision:play_card_payment:energy", "play:card-7", "effect:first", "effect:second",
      "trigger:task", "trigger:passive", "decision:card_trigger_choice:score",
    ]), "固定打牌 trace 顺序错误");
    renderer.dispose();
    output.textContent = JSON.stringify({ ok: true, trace: dispatched.session.committedState.trace, legacyContinuationCalls: 0 });
    output.dataset.ok = "true";
  } catch (error) {
    output.textContent = JSON.stringify({ ok: false, message: error.message, stack: error.stack });
    output.dataset.ok = "false";
  }
})();
