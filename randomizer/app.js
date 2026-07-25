(function () {
  "use strict";

  const dependencies = window.SetiAppDependencies.collectDependencies(window);
  const {
    productionKernel,
    browserRuleComposition,
    projectionAdapter,
    viewStateStore,
    inputAdapter,
    policyInputAdapter,
    browserAiBootstrap,
    outcomeModel,
    heuristicPolicy,
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
    cards,
    solar,
    planetReferenceLayout,
    planetStats,
    aliens,
    tech,
  } = dependencies;
  const document = window.document;
  const els = dom.collectElements(document);
  const humanSeat = { playerId: null };
  let automationScheduled = false;
  let refreshScheduled = false;
  let aiDifficulty = "laughable";

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
    const playerColors = {
      blue: "#4da3ff",
      green: "#56d37a",
      brown: "#b2845a",
      white: "#f3f5ef",
    };
    const rocketAssets = {
      blue: "../assets/tokens/rocket-blue.png",
      green: "../assets/tokens/rocket-green.png",
      brown: "../assets/tokens/rocket-brown.png",
      white: "../assets/tokens/rocket-white.png",
    };
    const markerAssets = {
      orbit: {
        blue: "../assets/tokens/normal_token-blue.png",
        green: "../assets/tokens/normal_token-green.png",
        brown: "../assets/tokens/normal_token-brown.png",
        white: "../assets/tokens/normal_token-white.png",
      },
      land: {
        blue: "../assets/tokens/landding-blue.png",
        green: "../assets/tokens/landding-green.png",
        brown: "../assets/tokens/landding-brown.png",
        white: "../assets/tokens/landding-white.png",
      },
      satellite: {
        blue: "../assets/tokens/satellite-blue.png",
        green: "../assets/tokens/satellite-green.png",
        brown: "../assets/tokens/satellite-brown.png",
        white: "../assets/tokens/satellite-white.png",
      },
    };
    function presentBoardToken(token) {
      const reference = token.surface === "planets-reference" ? token.planetsReference : null;
      const boardPoint = !reference
        && Number.isFinite(Number(token.radius))
        && Number.isFinite(Number(token.angleDegrees))
        ? solar.polarToGlobalPoint(Number(token.radius), Number(token.angleDegrees))
        : null;
      return {
        ...structuredClone(token),
        target: reference ? "planets-reference" : "solar-board",
        percentX: reference
          ? Number(reference.percentX)
          : boardPoint
            ? (Number(boardPoint.x) / solar.GLOBAL_COORDINATE_SYSTEM.size) * 100
            : null,
        percentY: reference
          ? Number(reference.percentY)
          : boardPoint
            ? (Number(boardPoint.y) / solar.GLOBAL_COORDINATE_SYSTEM.size) * 100
            : null,
        imageSrc: token.tokenSrc || rocketAssets[token.color] || "../assets/tokens/rocket.png",
      };
    }
    function presentPlanetMarkers() {
      const result = [];
      for (const planetId of planetStats.PLANET_IDS) {
        for (const kind of ["orbit", "land"]) {
          const markers = kind === "orbit"
            ? planetStats.getPlanetOrbitMarkers(state.planets, planetId)
            : planetStats.getPlanetLandingMarkers(state.planets, planetId);
          for (const marker of markers) {
            if (!marker.displayed) continue;
            const placement = planetReferenceLayout.getPlanetSlot(
              planetId,
              kind,
              marker.displaySlot,
            );
            if (!placement) continue;
            result.push({
              id: `planet:${planetId}:${kind}:${marker.sequence}`,
              playerId: marker.playerId,
              color: marker.color,
              kind: "planet-marker",
              referenceKind: kind,
              target: "planets-reference",
              percentX: (placement.x / planetReferenceLayout.PLANETS_REFERENCE_SIZE.width) * 100,
              percentY: (placement.y / planetReferenceLayout.PLANETS_REFERENCE_SIZE.height) * 100,
              referenceOffsetTokenWidths: Number(marker.referenceOffsetTokenWidths) || 0,
              imageSrc: markerAssets[kind][marker.color] || markerAssets[kind].white,
            });
          }
        }
        for (const marker of planetStats.getSatelliteLandingMarkers(state.planets, planetId)) {
          const placement = planetReferenceLayout.getSatellitePlacement(
            planetId,
            marker.satelliteId,
          );
          if (!placement) continue;
          result.push({
            id: `planet:${planetId}:satellite:${marker.satelliteId}`,
            playerId: marker.playerId,
            color: marker.color,
            kind: "planet-marker",
            referenceKind: "satellite",
            target: "planets-reference",
            percentX: (placement.x / planetReferenceLayout.PLANETS_REFERENCE_SIZE.width) * 100,
            percentY: (placement.y / planetReferenceLayout.PLANETS_REFERENCE_SIZE.height) * 100,
            referenceOffsetTokenWidths: Number(marker.referenceOffsetTokenWidths) || 0,
            imageSrc: markerAssets.satellite[marker.color] || markerAssets.satellite.white,
          });
        }
      }
      return result;
    }
    function presentCard(card, fallbackLabel) {
      const entry = cards.getCatalogEntryForCard(card);
      return {
        id: card?.id || card?.cardId || fallbackLabel,
        imageSrc: card?.src || (entry ? cards.getCardSrc(entry) : ""),
        label: card?.cardName || entry?.card_name || card?.cardId || fallbackLabel,
      };
    }
    const resourceIcons = {
      credits: "../assets/symbol/effect/credits.webp",
      energy: "../assets/symbol/effect/energy.webp",
      publicity: "../assets/symbol/effect/publicity.webp",
      availableData: "../assets/symbol/effect/data.webp",
      additionalPublicScan: "../assets/symbol/effect/scan_action.webp",
      aomomoFossils: "../assets/aliens/奥陌陌/fossil.webp",
    };
    const resourceLabels = {
      credits: "信用点",
      energy: "能量",
      publicity: "宣传",
      availableData: "可用数据",
      additionalPublicScan: "额外公共扫描",
      aomomoFossils: "奥陌陌化石",
    };
    return {
      boardChrome: {
        wheelTransforms: [1, 2, 3, 4].map((wheelId) => ({
          wheelId,
          degrees: solar.getWheelStep(state.solarSystem?.rotation, wheelId) * 45,
        })),
        sectors: Object.entries(state.solarSystem?.sectorBySlot || {}).map(
          ([slotId, sectorId]) => ({ slotId: Number(slotId), sectorId: Number(sectorId) }),
        ),
        aomomoWheelImageSrc: null,
        rotateTokenSlot: Number(state.solarSystem?.rotation?.rotationCount) || 0,
      },
      tokenPresentation: {
        activeRocketId: input.boardCoordinate?.activeRocketId || null,
        draggingRocketId: null,
        tokens: [
          ...(input.boardCoordinate?.tokens || []).map(presentBoardToken),
          ...presentPlanetMarkers(),
        ],
      },
      playerPanels: {
        currentPlayerId: input.turnFlow?.currentPlayerId || null,
        interfacePlayerId: viewerId,
        players: players.map((player) => ({
          ...structuredClone(player),
          displayName: player.colorLabel || player.name || player.id,
          uiColor: player.uiColor || playerColors[player.color] || "",
          score: Number(player.resources?.score || player.score || 0),
          resourceStats: Object.keys(resourceLabels).map((key) => ({
            label: resourceLabels[key],
            value: key === "publicity"
              ? `${Number(player.resources?.publicity) || 0}/10`
              : Number(player.resources?.[key]) || 0,
            iconSrc: resourceIcons[key],
          })),
        })),
      },
      turnPresentation: structuredClone(input.turnFlow || {}),
      cardPanels: {
        publicCards: publicCards.map((card, index) => ({
          ...presentCard(card, `公共牌 ${index + 1}`),
          empty: !card,
          selectable: false,
          selected: false,
        })),
        handCards: (own?.hand || []).map((card, index) => (
          presentCard(card, `手牌 ${index + 1}`)
        )),
        publicControls: {},
        handPanel: { count: own?.hand?.length || 0, empty: !own?.hand?.length },
        initialSelection: structuredClone(input.initialSetup || {}),
        reservedCards: {
          items: (own?.reservedCards || []).map((card, index) => (
            presentCard(card, `保留牌 ${index + 1}`)
          )),
        },
      },
      dataPresentation: {
        playerTokens: [
          ...(own?.dataState?.poolTokens || []).map((token) => ({
            ...structuredClone(token),
            placementKind: "pool",
            imageSrc: "../assets/tokens/data.png",
          })),
          ...(own?.dataState?.placedTokens || []).map((token) => ({
            ...structuredClone(token),
            imageSrc: "../assets/tokens/data.png",
          })),
        ],
        blueDropZones: [],
        sectorTokensBySectorId: {},
        aomomoTokens: [],
      },
      markerPresentation: { anomalies: [], planetFossils: [], runezuSymbols: [] },
      techTilePresentation: {
        supplyTiles: Object.values(state.tech?.stacks || {}).map((stack) => ({
          tileId: stack.tileId,
          remaining: Number(stack.remaining) || 0,
          bonusId: stack.bonusId || null,
          bonusImageSrc: stack.bonusId ? `../assets/tech_tile/${stack.bonusId}.png` : "",
          firstTakeAvailable: stack.firstTakeClaimedBy == null,
        })),
        playerTiles: Object.keys(own?.techState?.ownedTiles || {}).map((tileId) => {
          const blueSlot = own?.techState?.blueBoardSlots?.[tileId] || null;
          return {
            tileId,
            imageSrc: `../assets/tech_tile/${tileId}.png`,
            disabled: Boolean(own?.techState?.disabledTiles?.[tileId]),
            layout: structuredClone(tech.getPlacementLayout(tileId, blueSlot)),
          };
        }),
      },
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
  const browserAi = browserAiBootstrap.createBrowserAiBootstrap({
    ruleComposition,
    outcomeModel,
    policyInputAdapterModule: policyInputAdapter,
    projectionAdapter: canonicalProjection,
    inputAdapter: residentInput,
    createPolicy: () => heuristicPolicy.createHeuristicPolicy({ difficulty: aiDifficulty }),
    projectionSource: ruleComposition.projectionSource,
    isMachineSeat: (seatId) => (
      humanSeat.playerId != null && String(seatId) !== String(humanSeat.playerId)
    ),
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

  function scheduleAutomation() {
    if (automationScheduled) return;
    const seatId = browserAi.machinePlayerPort.inspect().seatId;
    if (!seatId || String(seatId) === String(humanSeat.playerId)) return;
    automationScheduled = true;
    window.setTimeout(async () => {
      let result;
      try {
        result = await browserAi.machinePlayerPort.runOnce();
      } finally {
        automationScheduled = false;
      }
      if (result?.ok) scheduleRefreshAndAutomation();
      else if (result?.code !== "BROWSER_MACHINE_SEAT_NOT_CONTROLLED") {
        console.error("Browser Machine Player 已暂停", result);
      }
    }, 0);
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
    aiDifficulty = els.startAiDifficulty?.value || "laughable";
    browserRandom.setState(1);
    const result = ruleComposition.newGame({
      activePlayerCount,
      aiDifficulty,
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
    inspectMachinePlayer: () => browserAi.machinePlayerPort.inspect(),
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
