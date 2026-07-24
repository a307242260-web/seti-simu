(function () {
  "use strict";

  const output = document.querySelector("#industry-alien-decision-smoke-result");
  const root = document.querySelector("#industry-alien-decision-root");
  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function standardChoice(state, pending, choiceId) {
    return {
      schemaVersion: SetiStandardAction.SCHEMA_VERSION,
      actionId: `${pending.family}:${pending.decisionKind}:${choiceId}`,
      family: pending.family,
      phase: "conditional",
      actorId: pending.ownerId,
      stateVersion: state.stateVersion,
      decisionVersion: state.decisionVersion,
      target: { choiceId, entityRef: { kind: pending.decisionKind, id: choiceId } },
      payload: {
        domainDecisionKind: pending.decisionKind,
        speciesId: pending.speciesId || null,
        companyId: pending.companyId || null,
        reward: pending.decisionKind === "alien_trace_placement" ? { score: 3 } : null,
      },
      summary: `${pending.decisionKind}:${choiceId}`,
    };
  }

  try {
    const base = {
      version: 31,
      stateVersion: 31,
      decisionVersion: 0,
      trace: [],
      players: { p1: { id: "p1", hand: ["HIDDEN_ALIEN_CARD"] }, p2: { id: "p2", hand: [] } },
      cards: { hands: { p1: ["HIDDEN_ALIEN_CARD"], p2: [] }, deck: ["HIDDEN_DECK_CARD"] },
    };
    const choices = {
      industry_picker: ["orange-tech", "purple-tech"],
      alien_trace_placement: ["pink-1", "pink-2"],
    };
    const tracePending = {
      decisionKind: "alien_trace_placement",
      ownerId: "p1",
      speciesId: "fangzhou",
      choiceIds: choices.alien_trace_placement,
    };
    const flow = SetiIndustryAlienSession.createIndustryAlienRuntime({
      readCommittedState: () => base,
      enumerateDecision(state, pending) {
        return pending.choiceIds.map((choiceId) => standardChoice(state, pending, choiceId));
      },
      executeDecision(state, action, pending) {
        if (!pending.choiceIds.includes(action.target.choiceId)) return { ok: false, code: "DOMAIN_CHOICE_STALE" };
        state.trace.push(`decision:${pending.decisionKind}:${action.target.choiceId}`);
        state.decisionVersion += 1;
        return {
          ok: true,
          nextState: state,
          followups: pending.decisionKind === "industry_picker"
            ? [{ kind: "decision", pending: tracePending }]
            : [{ kind: "effect", effectType: "trace-reward", speciesId: "fangzhou", payload: {} }],
        };
      },
      executeEffect(state, effect) {
        state.trace.push(`effect:${effect.effectType}`);
        return { ok: true, nextState: state };
      },
      buildActionFlow() {
        return {
          ok: true,
          followups: [{
            kind: "decision",
            pending: {
              decisionKind: "industry_picker",
              ownerId: "p1",
              companyId: "turing",
              choiceIds: choices.industry_picker,
            },
          }],
        };
      },
    });
    const dispatched = flow.dispatch(base, {
      schemaVersion: SetiStandardAction.SCHEMA_VERSION,
      actionId: "industry:chrome",
      family: "industry",
      phase: "quick",
      actorId: "p1",
      stateVersion: 31,
      decisionVersion: 0,
      target: { companyId: "turing" },
      payload: {},
      summary: "图灵系统 1x",
    }, { sessionId: "industry-alien-chrome" });
    assert(dispatched.ok, "公司 session dispatch 失败");
    flow.drain(dispatched.session);

    const projectionAdapter = SetiBrowserProjectionAdapter.createBrowserProjectionAdapter({
      stateStore: { getSnapshot: () => base },
      sessionRuntime: flow,
      decisionPresenter: SetiBrowserIndustryAlienDecisionUi.createDomainDecisionPresenter({
        fallback: SetiBrowserProjectionAdapter.defaultDecisionPresenter,
      }),
    });
    const viewStore = SetiBrowserViewStateStore.createViewStateStore();
    let projection = null;
    let submissionCount = 0;
    function project(viewerId = "p1") {
      projection = projectionAdapter.projectSession(dispatched.session, {
        viewer: { viewerId: `chrome-${viewerId}`, playerId: viewerId, role: "player" },
      });
      viewStore.reconcileProjection(projection);
      return projection;
    }
    const input = SetiBrowserInputAdapter.createBrowserInputAdapter({
      dispatchAction: () => ({ ok: false, code: "UNUSED" }),
      submitDecision(submission) {
        submissionCount += 1;
        const decision = flow.inspect(dispatched.session).decision;
        const selected = decision.choices.find((choice) => choice.actionId === submission.choice.choiceId);
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
    const controller = SetiBrowserIndustryAlienDecisionUi.createIndustryAlienDecisionUiController(
      SetiBrowserDecisionUi,
      { dispatchIntent: input.dispatchIntent },
    );
    const renderer = SetiBrowserDecisionUi.createDecisionDomRenderer({ root, controller });

    function chooseFirst() {
      project();
      const initial = renderer.render({ projection, viewState: viewStore.getSnapshot() });
      assert(initial.content.choices.length === 2, "Chrome 领域 Decision 不是多选");
      root.replaceChildren();
      const rebuilt = renderer.render({ projection, viewState: viewStore.getSnapshot() });
      assert(rebuilt.content.choices.length === 2, "清空 DOM 后无法从 ViewState/projection 重建");
      const beforeFocus = submissionCount;
      root.querySelector("[data-decision-ui-intent='focus-choice']").click();
      assert(submissionCount === beforeFocus, "多项行业/外星 Decision 聚焦时不得自动代选");
      renderer.render({ projection, viewState: viewStore.getSnapshot() });
      root.querySelector("[data-decision-ui-intent='confirm']").click();
      assert(submissionCount === beforeFocus + 1, "行业/外星 Decision 只能在显式确认后提交一次");
    }

    const opponent = project("p2");
    assert(opponent.decision.choices.length === 0, "非 owner 看到了公司选择");
    assert(!JSON.stringify(opponent).includes("HIDDEN_ALIEN_CARD"), "BrowserProjection 泄露对手外星人牌");
    chooseFirst();
    flow.drain(dispatched.session);
    assert(dispatched.session.phase === "awaiting_input", "公司选择后未停在痕迹 Decision");
    chooseFirst();
    flow.drain(dispatched.session);
    assert(dispatched.session.phase === "completed", "公司/外星人领域链未完成");
    assert(JSON.stringify(dispatched.session.committedState.trace) === JSON.stringify([
      "decision:industry_picker:orange-tech",
      "decision:alien_trace_placement:pink-1",
      "effect:trace-reward",
    ]), "公司/外星人固定 trace 顺序错误");
    assert(dispatched.session.journal.decisions.length === 2, "公司/外星人 Decision journal 不完整");
    renderer.dispose();
    output.textContent = JSON.stringify({
      ok: true,
      trace: dispatched.session.committedState.trace,
      legacyIndustryResolverCalls: 0,
      legacyAlienResolverCalls: 0,
      legacySpeciesContinuationCalls: 0,
    });
    output.dataset.ok = "true";
  } catch (error) {
    output.textContent = JSON.stringify({ ok: false, message: error.message, stack: error.stack });
    output.dataset.ok = "false";
  }
})();
