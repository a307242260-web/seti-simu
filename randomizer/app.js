(function () {
  "use strict";

  const dependencies = window.SetiAppDependencies.collectDependencies(window);
  const {
    productionKernel,
    browserRuleComposition,
    projectionAdapter,
    viewStateStore,
    inputAdapter,
    actionBar,
    decisionUi,
    residentRenderer,
    gameRecovery,
    publicApi,
    dom,
    finalReadModel,
    browserReadModel,
    finalScoring,
    endGameScoring,
    cardEffects,
    solar,
    aliens,
    tech,
  } = dependencies;
  const document = window.document;
  const els = dom.collectElements(document);
  const humanSeat = { playerId: null };
  let openingAutomation = false;
  let automationScheduled = false;
  let automationSteps = 0;
  let refreshScheduled = false;
  const openingPolicyState = new Map();

  function createBrowserRandom(initialState = 1) {
    let state = Number(initialState) >>> 0 || 1;
    const random = () => {
      state = Math.imul(state ^ (state >>> 15), 1 | state);
      state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
      return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
    };
    random.getState = () => state >>> 0;
    random.setState = (nextState) => { state = Number(nextState) >>> 0 || 1; };
    return random;
  }

  function createRenderPresentation(input = {}) {
    const state = input.state || {};
    const players = input.players || [];
    const viewerId = input.viewer?.playerId || null;
    const publicCards = state.cards?.publicCards || state.cards?.publicMarket || [];
    const own = players.find((player) => String(player?.id) === String(viewerId)) || null;
    const finalPlayers = input.finalReadModel?.players || [];
    return {
      boardChrome: {
        wheelTransforms: [],
        sectors: [],
        aomomoWheelImageSrc: null,
        rotateTokenSlot: null,
      },
      tokenPresentation: {
        activeRocketId: input.boardCoordinate?.activeRocketId || null,
        draggingRocketId: null,
        tokens: (input.boardCoordinate?.tokens || []).map((token) => ({
          ...structuredClone(token),
          imageSrc: token.tokenSrc || token.src || "",
        })),
      },
      playerPanels: {
        currentPlayerId: input.turnFlow?.currentPlayerId || null,
        interfacePlayerId: viewerId,
        players: players.map((player) => ({
          ...structuredClone(player),
          displayName: player.colorLabel || player.name || player.id,
          score: Number(player.resources?.score || player.score || 0),
          resourceStats: [],
        })),
      },
      turnPresentation: structuredClone(input.turnFlow || {}),
      cardPanels: {
        publicCards: publicCards.map((card, index) => ({
          imageSrc: card?.src || "",
          label: card?.cardName || `公共牌 ${index + 1}`,
          empty: !card,
          selectable: false,
          selected: false,
        })),
        handCards: (own?.hand || []).map((card) => ({
          id: card.id,
          imageSrc: card.src || "",
          label: card.cardName || card.id,
        })),
        publicControls: {},
        handPanel: { count: own?.hand?.length || 0, empty: !own?.hand?.length },
        initialSelection: structuredClone(input.initialSetup || {}),
        reservedCards: { items: structuredClone(own?.reservedCards || []) },
      },
      dataPresentation: {
        playerTokens: [],
        blueDropZones: [],
        sectorTokensBySectorId: {},
        aomomoTokens: [],
      },
      markerPresentation: { anomalies: [], planetFossils: [], runezuSymbols: [] },
      techTilePresentation: { supplyTiles: [], playerTiles: [] },
      finalScorePresentation: {
        breakdownsByPlayerId: Object.fromEntries(finalPlayers.map((player) => [
          String(player.id),
          structuredClone(player.breakdown || {}),
        ])),
      },
      readoutLines: [],
    };
  }

  const finalReadModelOwner = finalReadModel.createFinalReadModelOwner({
    finalScoring,
    endGameScoring,
    cardEffects,
  });
  const browserReadModelOwner = browserReadModel.createBrowserReadModelOwner({
    solar,
    aliens,
    tech,
  });
  const browserRandom = createBrowserRandom();
  const ruleComposition = browserRuleComposition.createBrowserRuleComposition({
    productionKernelApi: productionKernel,
    random: browserRandom,
    browserProjection: {
      visibilityPolicy: projectionAdapter.defaultVisibilityPolicy,
      getFinalReadModelOwner: () => finalReadModelOwner,
      getBrowserReadModelOwner: () => browserReadModelOwner,
      createRenderPresentation,
    },
  });
  const residentViewState = viewStateStore.createViewStateStore();

  function getViewer() {
    return humanSeat.playerId == null
      ? { viewerId: "browser:spectator", playerId: null, role: "spectator" }
      : {
        viewerId: `browser:player:${humanSeat.playerId}`,
        playerId: String(humanSeat.playerId),
        role: "player",
      };
  }

  const canonicalProjection = projectionAdapter.createBrowserProjectionAdapter({
    stateSource: ruleComposition.projectionSource,
    sourceStateIsVisible: true,
    decisionPresenter: projectionAdapter.defaultDecisionPresenter,
    createActionContext: ({ state }) => ({ actorId: state?.match?.currentPlayerId ?? null }),
    actionAdapter: {
      enumerate(context) {
        return ruleComposition.inputPort.enumerateActions(
          context.actorId == null ? {} : { actorId: context.actorId },
        );
      },
    },
  });

  function readProjection() {
    return canonicalProjection.projectSource({ viewer: getViewer() });
  }

  const residentInput = inputAdapter.createBrowserInputAdapter({
    dispatchAction(action) {
      return action?.phase === "quick"
        ? ruleComposition.inputPort.submitQuickAction(action)
        : ruleComposition.inputPort.submitAction(action);
    },
    submitDecision: (submission) => ruleComposition.inputPort.submitDecision(submission),
    viewStateStore: residentViewState,
    refreshProjection: readProjection,
  });
  const humanActionInput = inputAdapter.createHumanActionInputAdapter({
    readLegalActions: () => ruleComposition.inputPort.enumerateActions({}),
    dispatchAction: (action) => residentInput.dispatchAction(action),
    afterDispatch: () => scheduleRefreshAndAutomation(),
  });
  const humanDecisionInput = inputAdapter.createHumanDecisionInputAdapter({
    readDecisionProjection: () => readProjection().decision,
    readActiveDecision: () => ruleComposition.inspect().session?.decision || null,
    submitDecision: (submission) => residentInput.submitDecision(submission),
    afterSubmit: () => scheduleRefreshAndAutomation(),
  });

  const decisionController = decisionUi.createDecisionUiController({
    dispatchIntent(intent) {
      if (intent?.kind === "decision") return humanDecisionInput.submit(intent.submission);
      const result = residentInput.dispatchIntent(intent);
      scheduleRefresh();
      return result;
    },
  });
  const decisionRenderer = decisionUi.createDecisionDomRenderer({
    root: document.getElementById("compositionDecisionRoot"),
    controller: decisionController,
  });
  const desktopRenderer = residentRenderer.createResidentRenderer({ document, els });
  const renderDesktop = residentRenderer.createDesktopRenderPort({
    createRenderInput() {
      const projection = readProjection();
      residentViewState.reconcileProjection(projection);
      return { projection, viewState: residentViewState.getSnapshot() };
    },
    renderer: desktopRenderer,
    decisionRenderer,
  });

  function selectActionBarProjection() {
    return actionBar.selectActionBarProjection(readProjection(), {
      inspection: ruleComposition.inspect(),
    });
  }
  const desktopActionBar = actionBar.createBrowserDesktopActionBarController({
    projectionPort: { getProjection: selectActionBarProjection },
    inputPort: {
      dispatchIntent(intent) {
        if (intent?.kind !== "action") {
          return { ok: false, code: "BROWSER_ACTION_INTENT_INVALID", message: "仅接受 Standard Action" };
        }
        return humanActionInput.submit(intent.action);
      },
    },
    hostPort: {
      els,
      syncFinalResultButton() {},
    },
  });

  const browserCheckpoint = gameRecovery.createBrowserCheckpointAdapter({
    ruleLifecycle: ruleComposition.lifecycle,
    viewStateStore: residentViewState,
    viewSchemaVersion: viewStateStore.SCHEMA_VERSION,
  });

  function renderInitialSelection(projection) {
    const setup = projection.resident?.initialSetup || {};
    els.initialSelectionArea.hidden = !setup.active;
    if (!setup.active) {
      els.initialSelectionArea.replaceChildren();
      return;
    }
    const marker = document.createElement("button");
    marker.type = "button";
    marker.disabled = true;
    marker.className = "initial-selection-card-button";
    marker.textContent = setup.interactive ? "请在决策框完成初始选择" : "等待其他玩家完成初始选择";
    els.initialSelectionArea.replaceChildren(marker);
  }

  function refresh() {
    const projection = readProjection();
    renderDesktop();
    renderInitialSelection(projection);
    desktopActionBar.updateActionButtons();
    return projection;
  }

  function scheduleRefresh() {
    if (refreshScheduled) return;
    refreshScheduled = true;
    queueMicrotask(() => {
      refreshScheduled = false;
      refresh();
    });
  }

  function automateOpeningSeat() {
    automationScheduled = false;
    if (!openingAutomation) return;
    automationSteps += 1;
    if (automationSteps > 64) {
      openingAutomation = false;
      throw new Error("机器席位初始 Policy 超过 64 步上限");
    }
    const inspection = ruleComposition.inspect();
    const decision = inspection.session?.decision || null;
    if (inspection.phase === "awaiting_input" && decision) {
      if (String(decision.ownerId) === String(humanSeat.playerId)) return;
      const choices = (decision.choices || []).filter((entry) => !entry.disabledReason);
      const ownerKey = String(decision.ownerId);
      const policyState = openingPolicyState.get(ownerKey) || { company: false, initialCards: 0 };
      let choice = null;
      if ((decision.kind || decision.decisionKind) === "choose_card") {
        if (!policyState.company) {
          choice = choices.find((entry) => String(entry.summary || "").startsWith("选择公司："));
          policyState.company = Boolean(choice);
        } else if (policyState.initialCards < 2) {
          choice = choices.find((entry) => String(entry.summary || "").startsWith("选择："));
          if (choice) policyState.initialCards += 1;
        } else {
          choice = choices.find((entry) => entry.target?.kind === "confirm_initial_setup");
        }
        openingPolicyState.set(ownerKey, policyState);
      }
      choice ||= choices[0] || null;
      if (!choice) throw new Error("机器席位初始 Decision 没有合法 choice");
      const result = residentInput.submitDecision({
        decisionId: decision.decisionId,
        decisionVersion: decision.decisionVersion,
        ownerId: decision.ownerId,
        choice,
      });
      if (result?.ok === false) throw new Error(result.message || result.code);
      scheduleRefreshAndAutomation();
      return;
    }
    const projection = readProjection();
    if (!projection.resident?.initialSetup?.active && inspection.phase === "idle") {
      openingAutomation = false;
    }
  }

  function scheduleAutomation() {
    if (automationScheduled || !openingAutomation) return;
    automationScheduled = true;
    window.setTimeout(automateOpeningSeat, 0);
  }

  function scheduleRefreshAndAutomation() {
    scheduleRefresh();
    scheduleAutomation();
  }

  function findSingleAction(family, predicate = () => true) {
    const actions = humanActionInput.listLegalActions()
      .filter((action) => action.family === family && predicate(action));
    return actions.length === 1 ? actions[0] : null;
  }

  function startNewGame() {
    const activePlayerCount = Math.max(2, Math.min(4, Number(els.startPlayerCount?.value) || 4));
    browserRandom.setState(1);
    const result = ruleComposition.newGame({
      activePlayerCount,
      aiDifficulty: els.startAiDifficulty?.value || "laughable",
      rngState: {
        algorithm: "seti-browser-mulberry32-v1",
        state: browserRandom.getState(),
      },
    });
    if (result?.ok === false) throw new Error(result.message || result.code);
    const spectator = ruleComposition.projectionSource.read({
      viewerId: "browser:spectator",
      playerId: null,
      role: "spectator",
    }).state;
    humanSeat.playerId = spectator.match?.currentPlayerId
      || Object.keys(spectator.players || {})[0]
      || null;
    openingPolicyState.clear();
    automationSteps = 0;
    openingAutomation = true;
    const startAction = findSingleAction(
      "choose_card",
      (action) => action.target?.kind === "start_initial_setup",
    );
    if (!startAction) throw new Error("Production Composition 未提供 start_initial_setup");
    const started = humanActionInput.submit(startAction);
    if (started?.ok === false) throw new Error(started.message || started.code);
    els.startScreen.hidden = true;
    if (els.appWrap) els.appWrap.hidden = false;
    scheduleRefreshAndAutomation();
  }

  function bindActionButton(button) {
    button?.addEventListener("click", () => {
      if (!button.dataset.actionId) return;
      const result = desktopActionBar.activateAction(button.dataset.actionId);
      if (result?.ok === false) throw new Error(result.message || result.code);
      scheduleRefreshAndAutomation();
    });
  }

  els.startScreenStartButton?.addEventListener("click", startNewGame);
  [
    els.actionLaunchButton, els.actionOrbitButton, els.actionLandButton, els.actionScanButton,
    els.actionAnalyzeButton, els.actionPlayCardButton, els.actionResearchTechButton,
    els.actionPassButton, els.actionConfirmButton,
  ].forEach(bindActionButton);
  els.actionQuickButton?.addEventListener("click", () => desktopActionBar.toggleQuickPanel());
  els.quickActionsTrades?.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-quick-trade][data-action-id]");
    if (!button || button.disabled || !button.dataset.actionId) return;
    const result = desktopActionBar.activateAction(button.dataset.actionId);
    if (result?.ok === false) throw new Error(result.message || result.code);
    scheduleRefreshAndAutomation();
  });
  els.actionUndoButton?.addEventListener("click", () => {
    const inspection = ruleComposition.inspect();
    const result = ruleComposition.inputPort.undo({
      sessionId: inspection.session?.sessionId || null,
      revision: inspection.session?.revision ?? null,
    });
    if (result?.ok === false) throw new Error(result.message || result.code);
    scheduleRefreshAndAutomation();
  });

  window.SetiRandomizer = publicApi.createPublicApi({
    structuredClone,
    inspectProjection: readProjection,
    inspectInput: () => residentInput.inspectInputState(),
    capture: () => browserCheckpoint.capture(),
    restore(envelope) {
      const result = browserCheckpoint.restore(envelope);
      if (result?.ok) scheduleRefreshAndAutomation();
      return result;
    },
    dispatchAction: (action) => humanActionInput.submit(action),
    submitDecision: (submission) => humanDecisionInput.submit(submission),
  });

  if (els.appWrap) els.appWrap.hidden = false;
  refresh();
})();
