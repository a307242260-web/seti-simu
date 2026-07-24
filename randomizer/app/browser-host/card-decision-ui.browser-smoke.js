(function () {
  "use strict";
  const output = document.querySelector("#card-decision-smoke-result");
  try {
    const projection = {
      projectionId: "card-smoke-projection",
      decision: {
        decisionId: "card-smoke-decision",
        decisionVersion: 7,
        ownerId: "p1",
        kind: "choose_card",
        titleKey: "选择卡牌",
        promptKey: "请选择一张牌",
        minChoices: 1,
        maxChoices: 1,
        optional: false,
        choices: [
          { choiceId: "card-1", label: "卡牌一", presentation: { cardId: "card-1", image: "card-1.webp" } },
          { choiceId: "card-2", label: "卡牌二", presentation: { cardId: "card-2", image: "card-2.webp" } },
        ],
      },
    };
    const viewStore = SetiBrowserViewStateStore.createViewStateStore();
    viewStore.reconcileProjection(projection);
    const submissions = [];
    const input = SetiBrowserInputAdapter.createBrowserInputAdapter({
      dispatchAction: () => ({ ok: false }),
      submitDecision(submission) {
        submissions.push(submission);
        return { ok: true };
      },
      viewStateStore: viewStore,
    });
    const controller = SetiBrowserCardDecisionUi.createCardDecisionUiController(SetiBrowserDecisionUi, {
      dispatchIntent: input.dispatchIntent,
    });
    const renderer = SetiBrowserDecisionUi.createDecisionDomRenderer({
      root: document.querySelector("#card-decision-root"),
      controller,
    });
    const render = () => renderer.render({ projection, viewState: viewStore.getSnapshot() });
    render();
    const choice = document.querySelector("[data-decision-ui-intent='focus-choice'][data-choice-id='card-2']");
    if (!choice) throw new Error("Card Decision choice 未渲染");
    choice.click();
    if (submissions.length !== 0) throw new Error("聚焦时不得自动提交");
    render();
    const confirm = document.querySelector("[data-decision-ui-intent='confirm']:not(:disabled)");
    if (!confirm) throw new Error("Card Decision confirm 未启用");
    confirm.click();
    if (submissions.length !== 1 || submissions[0].choice.choiceId !== "card-2") {
      throw new Error("Card Decision 未原样经过 Standard input");
    }
    renderer.dispose();
    output.textContent = JSON.stringify({ ok: true, submission: submissions[0] });
    output.dataset.ok = "true";
  } catch (error) {
    output.textContent = JSON.stringify({ ok: false, message: error.message, stack: error.stack });
    output.dataset.ok = "false";
  }
})();
