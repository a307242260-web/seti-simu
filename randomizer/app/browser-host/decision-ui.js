(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserDecisionUi = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const TECH_KINDS = new Set(["research_tech_choice", "choose_tech", "choose_tech_slot"]);
  const BOARD_KINDS = new Set(["choose_target", "scan_target", "scan_sector", "data_placement", "land_target"]);
  const PAYMENT_KINDS = new Set(["choose_payment", "land_payment", "card_payment"]);
  const CANCEL_ROLES = new Set(["cancel", "skip"]);

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function deepFreeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function fail(code, message, details = {}) {
    return deepFreeze({ ok: false, code, message, ...clone(details) });
  }

  function choiceRole(choice) {
    const role = choice?.presentation?.role;
    return role == null ? null : String(role).toLowerCase();
  }

  function isCancelChoice(choice) {
    return CANCEL_ROLES.has(choiceRole(choice));
  }

  function createDecisionRendererRegistry() {
    const entries = [];

    function register(key, renderer, options = {}) {
      if (!key || typeof renderer !== "function") {
        throw new TypeError("Decision renderer register 需要 key 与 renderer");
      }
      entries.push(Object.freeze({
        key: String(key),
        renderer,
        matches: typeof options.matches === "function" ? options.matches : null,
      }));
      return api;
    }

    function resolve(decision) {
      const hint = decision?.presentationHint == null ? null : String(decision.presentationHint);
      const kind = decision?.kind == null ? null : String(decision.kind);
      return entries.find((entry) => entry.matches?.(decision))
        || entries.find((entry) => entry.key === hint)
        || entries.find((entry) => entry.key === kind)
        || entries.find((entry) => entry.key === "generic")
        || null;
    }

    function render(input) {
      const decision = input?.projection?.decision;
      if (!decision) return deepFreeze({ ok: true, hidden: true, decision: null });
      const resolved = resolve(decision);
      if (!resolved) return fail("DECISION_UI_RENDERER_MISSING", `缺少 Decision renderer: ${decision.kind}`);
      const content = resolved.renderer({
        decision: clone(decision),
        projection: clone(input.projection),
        viewState: clone(input.viewState || {}),
      });
      if (!content || content.ok === false) return deepFreeze(clone(content));
      const selectedChoiceIds = (input.viewState?.draft?.selectedChoiceIds || []).map(String);
      const legalIds = new Set(decision.choices.map((choice) => String(choice.choiceId)));
      const selectedLegalIds = selectedChoiceIds.filter((id) => legalIds.has(id));
      const cancelChoice = decision.choices.find(isCancelChoice) || null;
      const minChoices = Math.max(0, Number(decision.minChoices) || 0);
      const maxChoices = Math.max(minChoices, Number(decision.maxChoices) || 1);
      const stale = input.viewState?.projection?.decisionId != null && (
        input.viewState.projection.decisionId !== decision.decisionId
        || input.viewState.projection.decisionVersion !== decision.decisionVersion
      );
      return deepFreeze({
        ok: true,
        hidden: false,
        rendererKey: resolved.key,
        identity: {
          decisionId: decision.decisionId,
          decisionVersion: decision.decisionVersion,
          ownerId: decision.ownerId,
          projectionId: input.projection.projectionId,
        },
        shell: {
          ownerId: decision.ownerId,
          title: decision.titleKey || "请选择",
          prompt: decision.promptKey || "",
          stale,
        },
        content: clone(content),
        controls: {
          selectedChoiceIds: selectedLegalIds,
          confirmDisabled: stale || selectedLegalIds.length < minChoices || selectedLegalIds.length > maxChoices,
          cancelChoiceId: cancelChoice?.choiceId || null,
        },
      });
    }

    const api = Object.freeze({ register, resolve, render });
    return api;
  }

  function renderGeneric({ decision }) {
    return {
      ok: true,
      type: "choices",
      choices: decision.choices.filter((choice) => !isCancelChoice(choice)).map((choice) => ({
        choiceId: choice.choiceId,
        label: choice.label,
        presentation: clone(choice.presentation),
        disabledReason: choice.disabledReason,
      })),
    };
  }

  function techTileId(choice) {
    return String(choice?.presentation?.tileId ?? choice?.choiceId);
  }

  function techSlotId(choice) {
    const value = choice?.presentation?.slotId;
    return value == null ? null : String(value);
  }

  function renderTech({ decision, viewState }) {
    const domainChoices = decision.choices.filter((choice) => !isCancelChoice(choice));
    const focusedTileId = viewState?.focus?.entityRef?.kind === "tech-tile"
      ? String(viewState.focus.entityRef.id)
      : null;
    const groups = new Map();
    for (const choice of domainChoices) {
      const tileId = techTileId(choice);
      if (!groups.has(tileId)) groups.set(tileId, []);
      groups.get(tileId).push(choice);
    }
    const tiles = [...groups].map(([tileId, choices]) => ({
      tileId,
      label: choices[0].presentation?.tileLabel || choices[0].label,
      color: choices[0].presentation?.color || null,
      image: choices[0].presentation?.image || null,
      directChoiceId: choices.length === 1 && techSlotId(choices[0]) == null ? choices[0].choiceId : null,
      slotCount: choices.filter((choice) => techSlotId(choice) != null).length,
      disabledReason: choices.every((choice) => choice.disabledReason)
        ? choices.map((choice) => choice.disabledReason).filter(Boolean).join("；")
        : null,
    }));
    const focusedChoices = focusedTileId == null ? [] : (groups.get(focusedTileId) || []);
    return {
      ok: true,
      type: "tech",
      focusedTileId,
      tiles,
      slots: focusedChoices.filter((choice) => techSlotId(choice) != null).map((choice) => ({
        slotId: techSlotId(choice),
        choiceId: choice.choiceId,
        label: choice.presentation?.slotLabel || choice.label,
        disabledReason: choice.disabledReason,
      })),
    };
  }

  function renderBoardTarget({ decision }) {
    return {
      ok: true,
      type: "board-target",
      choices: decision.choices.filter((choice) => !isCancelChoice(choice)).map((choice) => ({
        choiceId: choice.choiceId,
        label: choice.label,
        targetRef: clone(choice.presentation?.targetRef || null),
        icon: choice.presentation?.icon || null,
        disabledReason: choice.disabledReason,
      })),
    };
  }

  function renderPayment({ decision }) {
    return {
      ok: true,
      type: "payment",
      choices: decision.choices.filter((choice) => !isCancelChoice(choice)).map((choice) => ({
        choiceId: choice.choiceId,
        label: choice.label,
        cost: clone(choice.presentation?.cost || null),
        remaining: clone(choice.presentation?.remaining || null),
        disabledReason: choice.disabledReason,
      })),
    };
  }

  function createDefaultDecisionRegistry() {
    const registry = createDecisionRendererRegistry();
    registry.register("tech", renderTech, {
      matches: (decision) => TECH_KINDS.has(decision.kind) || decision.presentationHint === "tech",
    });
    registry.register("board-target", renderBoardTarget, {
      matches: (decision) => BOARD_KINDS.has(decision.kind) || decision.presentationHint === "board-target",
    });
    registry.register("payment", renderPayment, {
      matches: (decision) => PAYMENT_KINDS.has(decision.kind) || decision.presentationHint === "payment",
    });
    registry.register("generic", renderGeneric);
    return registry;
  }

  function createDecisionUiController(options = {}) {
    const registry = options.registry || createDefaultDecisionRegistry();
    const dispatchIntent = options.dispatchIntent;
    if (typeof dispatchIntent !== "function") throw new TypeError("Decision UI controller 需要 dispatchIntent");

    function dispatchUiIntent(intent, input) {
      const model = registry.render(input);
      if (model.ok === false || model.hidden) return model;
      if (intent?.type === "focus") {
        const choiceId = intent.choiceId == null ? null : String(intent.choiceId);
        if (choiceId != null) {
          const choice = input.projection.decision.choices.find((entry) => String(entry.choiceId) === choiceId);
          if (!choice || choice.disabledReason) {
            return fail("DECISION_UI_CHOICE_NOT_FOCUSABLE", "choice 不可聚焦", { choiceId });
          }
          return dispatchIntent({ kind: "view", type: "draft.set", intentKind: "decision", selectedChoiceIds: [choiceId] });
        }
        if (intent.entityRef?.kind === "tech-tile") {
          const tileId = String(intent.entityRef.id);
          const tile = model.content.tiles?.find((entry) => entry.tileId === tileId);
          if (!tile || tile.disabledReason) {
            return fail("DECISION_UI_ENTITY_NOT_FOCUSABLE", "科技 tile 不在当前可聚焦 choices 中", { tileId });
          }
          const focusResult = dispatchIntent({ kind: "view", type: "focus.set", entityRef: { kind: "tech-tile", id: tileId }, controlId: null });
          if (tile.directChoiceId) {
            return dispatchIntent({ kind: "view", type: "draft.set", intentKind: "decision", selectedChoiceIds: [tile.directChoiceId] });
          }
          dispatchIntent({ kind: "view", type: "draft.clear" });
          return focusResult;
        }
        return fail("DECISION_UI_FOCUS_INVALID", "focus intent 缺少标准 choice/entity identity");
      }
      if (intent?.type === "confirm") {
        if (model.controls.confirmDisabled) return fail("DECISION_UI_CONFIRM_DISABLED", "当前 Decision 草稿不能确认");
        const choiceId = model.controls.selectedChoiceIds[0];
        return dispatchIntent({
          kind: "decision",
          submission: {
            decisionId: model.identity.decisionId,
            decisionVersion: model.identity.decisionVersion,
            ownerId: model.identity.ownerId,
            choice: { choiceId },
          },
        });
      }
      if (intent?.type === "cancel") {
        if (!model.controls.cancelChoiceId) {
          return fail("DECISION_UI_CANCEL_UNAVAILABLE", "当前 Decision 未提供标准取消/跳过 choice");
        }
        return dispatchIntent({
          kind: "decision",
          submission: {
            decisionId: model.identity.decisionId,
            decisionVersion: model.identity.decisionVersion,
            ownerId: model.identity.ownerId,
            choice: { choiceId: model.controls.cancelChoiceId },
          },
        });
      }
      return fail("DECISION_UI_INTENT_UNKNOWN", `未知 Decision UI intent: ${intent?.type || "<missing>"}`);
    }

    return Object.freeze({ render: registry.render, dispatchUiIntent });
  }

  function appendButton(documentRef, parent, label, dataset, options = {}) {
    const button = documentRef.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = options.className || "decision-ui-choice";
    button.disabled = Boolean(options.disabled);
    for (const [key, value] of Object.entries(dataset)) button.dataset[key] = String(value);
    parent.appendChild(button);
    return button;
  }

  function createDecisionDomRenderer(options = {}) {
    const rootNode = options.root;
    const controller = options.controller;
    if (!rootNode?.ownerDocument || !rootNode.addEventListener || !rootNode.replaceChildren) {
      throw new TypeError("Decision DOM renderer 需要真实 root element");
    }
    if (!controller?.render || !controller?.dispatchUiIntent) {
      throw new TypeError("Decision DOM renderer 需要 controller");
    }
    const documentRef = rootNode.ownerDocument;
    let currentInput = null;

    function render(input) {
      currentInput = { projection: clone(input?.projection), viewState: clone(input?.viewState || {}) };
      const model = controller.render(currentInput);
      rootNode.replaceChildren();
      rootNode.hidden = Boolean(model.hidden || model.ok === false);
      if (rootNode.hidden) return model;
      const dialog = documentRef.createElement("section");
      dialog.className = "decision-ui-shell";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.dataset.decisionId = model.identity.decisionId;
      dialog.dataset.decisionVersion = String(model.identity.decisionVersion);
      const title = documentRef.createElement("h2");
      title.className = "decision-ui-title";
      title.textContent = model.shell.title;
      dialog.appendChild(title);
      if (model.shell.prompt) {
        const prompt = documentRef.createElement("p");
        prompt.className = "decision-ui-prompt";
        prompt.textContent = model.shell.prompt;
        dialog.appendChild(prompt);
      }
      const content = documentRef.createElement("div");
      content.className = `decision-ui-content decision-ui-content-${model.content.type}`;
      const choices = model.content.type === "tech" ? model.content.tiles : model.content.choices;
      for (const choice of choices) {
        const choiceId = choice.directChoiceId || choice.choiceId;
        appendButton(documentRef, content, choice.label, choiceId
          ? { decisionUiIntent: "focus-choice", choiceId }
          : { decisionUiIntent: "focus-tech", tileId: choice.tileId }, {
          className: model.content.type === "tech"
            ? "decision-ui-choice decision-ui-tech-tile"
            : "decision-ui-choice",
          disabled: choice.disabledReason,
        });
      }
      for (const slot of model.content.slots || []) {
        appendButton(documentRef, content, slot.label, { decisionUiIntent: "focus-choice", choiceId: slot.choiceId }, {
          className: "decision-ui-choice decision-ui-tech-slot",
          disabled: slot.disabledReason,
        });
      }
      dialog.appendChild(content);
      const controls = documentRef.createElement("footer");
      controls.className = "decision-ui-controls";
      appendButton(documentRef, controls, "确认", { decisionUiIntent: "confirm" }, { disabled: model.controls.confirmDisabled });
      if (model.controls.cancelChoiceId) appendButton(documentRef, controls, "取消", { decisionUiIntent: "cancel" });
      dialog.appendChild(controls);
      rootNode.appendChild(dialog);
      return model;
    }

    function handleEvent(event) {
      const target = event?.target?.closest?.("[data-decision-ui-intent]");
      if (!target || !currentInput) return { ok: true, ignored: true };
      const kind = target.dataset.decisionUiIntent;
      if (kind === "focus-choice") return controller.dispatchUiIntent({ type: "focus", choiceId: target.dataset.choiceId }, currentInput);
      if (kind === "focus-tech") return controller.dispatchUiIntent({ type: "focus", entityRef: { kind: "tech-tile", id: target.dataset.tileId } }, currentInput);
      return controller.dispatchUiIntent({ type: kind }, currentInput);
    }

    rootNode.addEventListener("click", handleEvent);
    return Object.freeze({ render, dispose: () => rootNode.removeEventListener("click", handleEvent) });
  }

  return Object.freeze({
    createDecisionRendererRegistry,
    createDefaultDecisionRegistry,
    createDecisionUiController,
    createDecisionDomRenderer,
  });
});
