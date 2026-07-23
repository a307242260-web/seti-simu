(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserResidentProjection = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-browser-host-v1";
  const BROWSER_PROJECTION_KEYS = Object.freeze([
    "schemaVersion", "projectionId", "source", "viewer", "match", "board", "players",
    "cards", "tech", "aliens", "resident", "controls", "decision", "feedback",
  ]);
  const RUNTIME_PROJECTION_SCHEMAS = Object.freeze({
    finalUi: "seti-final-ui-projection-v1",
    finalScoreAi: "seti-final-score-ai-projection-v1",
    actionLog: "seti-action-log-projection-v1",
    recovery: "seti-recovery-projection-v1",
  });
  const FINAL_READ_MODEL_SCHEMA = "seti-final-read-model-v1";
  const FINAL_UI_KEYS = Object.freeze([
    "schemaVersion", "identity", "turn", "players", "finalBoard", "revealFlags",
  ]);
  const FINAL_SCORE_AI_KEYS = Object.freeze([
    "schemaVersion", "identity", "turn", "players", "finalBoard", "candidatesByPlayerId",
  ]);
  const FINAL_READ_MODEL_KEYS = Object.freeze([
    "schemaVersion", "turn", "players", "finalBoard", "candidatesByPlayerId", "revealFlags",
  ]);
  const FINAL_TURN_KEYS = Object.freeze([
    "roundNumber", "turnNumber", "displayedTurnNumber", "actionCycleNumber", "currentPlayerId", "activePlayerIds",
    "passedPlayerIds", "completedTurnPlayerIds", "gameEnded", "gameEndReason",
  ]);
  const FINAL_PLAYER_KEYS = Object.freeze([
    "id", "color", "colorLabel", "name", "score", "publicity", "industryId", "industryLabel", "passed",
    "scoreSources", "metrics", "breakdown",
  ]);
  const FINAL_METRIC_KEYS = Object.freeze([
    "completedTaskCount", "reservedTaskCount", "handTaskCount", "type3Reserved", "type3InHand",
    "traceCounts", "techCounts", "orbitLandCount", "sectorWins",
  ]);
  const FINAL_BOARD_KEYS = Object.freeze([
    "thresholds", "tiles", "formulaMultipliers", "pendingByPlayerId",
    "claimedThresholdsByPlayerId", "markedTileIdsByPlayerId", "legalTilesByPlayerId",
  ]);
  const FINAL_CANDIDATE_KEYS = Object.freeze([
    "tileId", "variant", "formulaId", "available", "reason", "slotIndex", "baseValue",
    "multiplier", "immediateScore",
  ]);
  const LEGACY_SLICE_KEYS = Object.freeze([
    "playerState", "turnState", "cardState", "solarState", "rocketState",
    "planetStatsState", "nebulaDataState", "finalScoringState", "techGameState",
    "alienGameState", "viewerPlayer", "displayedTurn",
  ]);

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

  function assertExactKeys(value, keys, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(`${label} 必须是普通对象`);
    }
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    const unknownKeys = actual.filter((key) => !expected.includes(key));
    const missingKeys = expected.filter((key) => !actual.includes(key));
    if (unknownKeys.length || missingKeys.length) {
      throw new TypeError(`${label} 字段不匹配：unknown=${unknownKeys.join(",") || "-"} missing=${missingKeys.join(",") || "-"}`);
    }
  }

  function assertDeepFrozen(value, label, seen = new WeakSet()) {
    if (value == null || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (!Object.isFrozen(value)) throw new TypeError(`${label} 必须深冻结`);
    for (const child of Object.values(value)) assertDeepFrozen(child, label, seen);
  }

  function assertCanonicalBrowserProjection(projection) {
    assertExactKeys(projection, BROWSER_PROJECTION_KEYS, "BrowserProjection");
    const validation = validateProjection(projection);
    if (!validation.ok) throw new TypeError(`${validation.code}: ${validation.message}`);
    assertDeepFrozen(projection, "BrowserProjection");
    return projection;
  }

  function createRuntimeIdentity(projection) {
    return {
      projectionId: projection.projectionId,
      sourceKind: projection.source.kind,
      stateVersion: projection.source.stateVersion,
      sessionId: projection.source.sessionId ?? null,
      sessionRevision: projection.source.sessionRevision ?? null,
      viewerId: projection.viewer.viewerId,
      viewerPlayerId: projection.viewer.playerId ?? null,
    };
  }

  function getFinalReadModel(projection) {
    const readModel = projection.resident?.finalReadModel;
    if (!readModel || readModel.schemaVersion !== FINAL_READ_MODEL_SCHEMA) {
      throw new TypeError(`BrowserProjection 缺少 ${FINAL_READ_MODEL_SCHEMA} finalReadModel`);
    }
    assertDeepFrozen(readModel, "finalReadModel");
    assertExactKeys(readModel, FINAL_READ_MODEL_KEYS, "finalReadModel");
    assertExactKeys(readModel.turn, FINAL_TURN_KEYS, "finalReadModel.turn");
    assertExactKeys(readModel.finalBoard, FINAL_BOARD_KEYS, "finalReadModel.finalBoard");
    assertExactKeys(readModel.revealFlags, ["jiuzhe", "runezu"], "finalReadModel.revealFlags");
    if (!Array.isArray(readModel.players)) throw new TypeError("finalReadModel.players 必须是数组");
    for (const player of readModel.players) {
      assertExactKeys(player, FINAL_PLAYER_KEYS, "finalReadModel.player");
      assertExactKeys(player.metrics, FINAL_METRIC_KEYS, "finalReadModel.player.metrics");
    }
    for (const candidates of Object.values(readModel.candidatesByPlayerId || {})) {
      for (const candidate of Object.values(candidates || {})) {
        assertExactKeys(candidate, FINAL_CANDIDATE_KEYS, "finalReadModel.candidate");
      }
    }
    return readModel;
  }

  function selectFinalUiProjection(browserProjection) {
    const projection = assertCanonicalBrowserProjection(browserProjection);
    const readModel = getFinalReadModel(projection);
    const selected = deepFreeze({
      schemaVersion: RUNTIME_PROJECTION_SCHEMAS.finalUi,
      identity: createRuntimeIdentity(projection),
      turn: clone(readModel.turn),
      players: clone(readModel.players),
      finalBoard: clone(readModel.finalBoard),
      revealFlags: clone(readModel.revealFlags),
    });
    assertExactKeys(selected, FINAL_UI_KEYS, "FinalUiProjection");
    return selected;
  }

  function selectFinalScoreAiProjection(browserProjection) {
    const projection = assertCanonicalBrowserProjection(browserProjection);
    const readModel = getFinalReadModel(projection);
    const selected = deepFreeze({
      schemaVersion: RUNTIME_PROJECTION_SCHEMAS.finalScoreAi,
      identity: createRuntimeIdentity(projection),
      turn: clone(readModel.turn),
      players: clone(readModel.players),
      finalBoard: clone(readModel.finalBoard),
      candidatesByPlayerId: clone(readModel.candidatesByPlayerId),
    });
    assertExactKeys(selected, FINAL_SCORE_AI_KEYS, "FinalScoreAiProjection");
    return selected;
  }

  function selectActionLogProjection(browserProjection) {
    const projection = assertCanonicalBrowserProjection(browserProjection);
    for (const key of ["roundNumber", "turnNumber", "actionCycleNumber"]) {
      if (!Number.isSafeInteger(projection.match?.[key]) || projection.match[key] < 1) {
        throw new TypeError(`ActionLogProjection 缺少合法 match.${key}`);
      }
    }
    const readModel = getFinalReadModel(projection);
    const playerViews = projection.resident?.players?.players || [];
    const impactByPlayerId = Object.fromEntries(playerViews.filter((player) => player?.id).map((player) => [
      String(player.id),
      {
        id: String(player.id),
        color: player.color || null,
        colorLabel: player.colorLabel || null,
        name: player.name || null,
        resources: clone(player.resources || {}),
        income: clone(player.income || {}),
      },
    ]));
    const currentPlayer = readModel.players.find(
      (player) => String(player.id) === String(projection.match.currentPlayerId),
    );
    return deepFreeze({
      schemaVersion: RUNTIME_PROJECTION_SCHEMAS.actionLog,
      identity: createRuntimeIdentity(projection),
      roundNumber: projection.match.roundNumber,
      turnNumber: projection.match.turnNumber,
      displayedTurnNumber: readModel.turn.displayedTurnNumber,
      actionCycleNumber: projection.match.actionCycleNumber,
      activePlayerCount: Math.max(1, readModel.turn.activePlayerIds.length || readModel.players.length || 1),
      currentPlayerId: projection.match.currentPlayerId ?? null,
      currentPlayerLabel: currentPlayer?.colorLabel || currentPlayer?.name || currentPlayer?.id || null,
      terminal: Boolean(projection.match.terminal),
      gameEndReason: projection.resident.turn?.gameEndReason || null,
      impactByPlayerId,
    });
  }

  function selectRecoveryProjection(browserProjection) {
    const projection = assertCanonicalBrowserProjection(browserProjection);
    for (const key of ["roundNumber", "turnNumber", "actionCycleNumber"]) {
      if (!Number.isSafeInteger(projection.match?.[key]) || projection.match[key] < 1) {
        throw new TypeError(`RecoveryProjection 缺少合法 match.${key}`);
      }
    }
    return deepFreeze({
      schemaVersion: RUNTIME_PROJECTION_SCHEMAS.recovery,
      identity: createRuntimeIdentity(projection),
      roundNumber: projection.match.roundNumber,
      turnNumber: projection.match.turnNumber,
      actionCycleNumber: projection.match.actionCycleNumber,
      currentPlayerId: projection.match.currentPlayerId ?? null,
    });
  }

  function validateProjection(projection) {
    if (!projection || projection.schemaVersion !== SCHEMA_VERSION) {
      return fail("RESIDENT_PROJECTION_SCHEMA_UNSUPPORTED", `常驻投影需要 ${SCHEMA_VERSION} BrowserProjection`);
    }
    if (!projection.projectionId || !projection.source?.kind || !projection.viewer?.viewerId) {
      return fail("RESIDENT_PROJECTION_IDENTITY_INVALID", "BrowserProjection 缺少 projection/source/viewer identity");
    }
    if (!Number.isSafeInteger(projection.source.stateVersion) || projection.source.stateVersion < 0) {
      return fail("RESIDENT_PROJECTION_VERSION_INVALID", "BrowserProjection source.stateVersion 必须是非负安全整数");
    }
    return { ok: true };
  }

  function createResidentProjection(input = {}) {
    const legacyKeys = LEGACY_SLICE_KEYS.filter((key) => Object.hasOwn(input, key));
    if (legacyKeys.length) {
      return fail("RESIDENT_PROJECTION_LEGACY_SLICE_REJECTED", "常驻投影拒绝传统规则 slice 输入", { legacyKeys });
    }
    let projection = input.projection || null;
    if (!projection && input.stateSource?.project && typeof input.projector === "function") {
      projection = input.stateSource.project(input.projector, input.viewer || null);
    }
    const validation = validateProjection(projection);
    return validation.ok ? deepFreeze(clone(projection)) : validation;
  }

  function clonePresentation(value, seen = new WeakMap()) {
    if (value == null || typeof value !== "object") {
      return typeof value === "function" || typeof value === "symbol" ? undefined : value;
    }
    if (seen.has(value)) return undefined;
    if (value instanceof Set) return [...value].map((item) => clonePresentation(item));
    if (value instanceof Map) {
      return Object.fromEntries([...value.entries()].map(([key, item]) => [
        String(key), clonePresentation(item),
      ]));
    }
    const output = Array.isArray(value) ? [] : {};
    seen.set(value, output);
    for (const [key, item] of Object.entries(value)) {
      const cloned = clonePresentation(item, seen);
      if (cloned !== undefined) output[key] = cloned;
    }
    return output;
  }

  function createReadoutRoot(resident, options = {}) {
    const solarKey = options.solarKey || "solar";
    return {
      turnState: structuredClone(resident.turn || {}),
      playerState: structuredClone(resident.players || { currentPlayerId: null, players: [] }),
      solarState: structuredClone(resident[solarKey] || {}),
      rocketState: structuredClone(resident.pieces || {}),
      planetStatsState: structuredClone(resident.planets || {}),
      nebulaDataState: structuredClone(resident.data || {}),
      cardState: structuredClone(resident.cards || {}),
      techGameState: structuredClone(resident.tech || {}),
      alienGameState: structuredClone(resident.aliens || {}),
      finalScoringState: structuredClone(resident.finalScoring || {}),
      ...(options.includeMatch ? { match: structuredClone(resident.match || {}) } : {}),
    };
  }

  function createResidentPresentationBuilder(context = {}) {
    const {
      setupSelectionState = {}, cardTaskState = {}, cardEffects = {}, players = {},
      banrenma = {}, jiuzhe = {}, cards = {}, fangzhou = {}, resourceIconSrc = {},
    } = context;
    const clonePresentationValue = context.clonePresentation || clonePresentation;

    function createInitialSelection(viewer, resident) {
      const active = setupSelectionState.phase === "selecting";
      const currentPlayerId = setupSelectionState.currentPlayerId == null
        ? null
        : String(setupSelectionState.currentPlayerId);
      const viewerPlayerId = viewer?.playerId == null ? null : String(viewer.playerId);
      const projectedPlayer = resident.players.players.find(
        (player) => String(player?.id) === viewerPlayerId,
      );
      const offer = active && currentPlayerId === viewerPlayerId
        ? clonePresentationValue(setupSelectionState.offersByPlayerId?.[currentPlayerId] || null)
        : null;
      return {
        active,
        interactive: active && !context.isAiPlayer?.(currentPlayerId),
        currentPlayerId,
        offer,
        selectedCards: clonePresentationValue(
          projectedPlayer?.initialSelection?.industry ? [projectedPlayer.initialSelection.industry] : [],
        ),
      };
    }

    function createReservedCards(viewer, resident) {
      const viewerPlayerId = viewer?.playerId == null ? null : String(viewer.playerId);
      const projectedPlayer = resident.players.players.find(
        (entry) => String(entry?.id) === viewerPlayerId,
      ) || null;
      const player = clonePresentationValue(projectedPlayer);
      const alienReadoutState = clonePresentationValue(resident.aliens);
      const initialSelection = createInitialSelection(viewer, resident);
      const reservedCards = Array.isArray(player?.reservedCards) ? player.reservedCards : [];
      const readyByCardId = { ...(cardTaskState.readyType2ByCardId || {}) };
      for (const card of reservedCards) {
        const specialReady = context.getReadyChongTask?.(card, player)
          || context.getReadyAmibaTask?.(card, player)
          || context.getReadyRunezuTask?.(card, player);
        if (specialReady) readyByCardId[card.id] = specialReady;
      }
      const taskBlockReason = context.getTaskBlockReason?.() || null;

      function createRegularItem(card, originalIndex) {
        const ready = Boolean(readyByCardId[card.id]);
        const consumed = cardEffects.getConsumedTriggerIndexes(card);
        const runezuProgress = context.getRunezuTaskProgressIndexes?.(card) || [];
        const plutoState = cardEffects.getCardModel?.(card)?.pluto
          ? context.getPlutoActionState?.(card)
          : null;
        return {
          kind: "regular", originalIndex,
          imageSrc: card.src || players.CARD_BACK_SRC,
          imageAlt: card.cardName || `保留牌 ${originalIndex + 1}`,
          ready,
          disabled: !ready || Boolean(taskBlockReason),
          title: ready ? (taskBlockReason || "任务已满足，点击确认完成") : "",
          progressIndexes: consumed.length ? consumed : runezuProgress,
          plutoState: plutoState ? {
            orbitDone: Boolean(plutoState.orbitDone),
            landDone: Boolean(plutoState.landDone),
          } : null,
        };
      }

      const taskItems = [];
      const finalItems = [];
      const banrenmaItems = [];
      reservedCards.forEach((card, originalIndex) => {
        if (banrenma.isBanrenmaCard?.(card)) {
          const mark = banrenma.getPlayerScoreMarks?.(alienReadoutState, player)
            ?.find((entry) => entry.id === card.banrenmaScoreMarkId || entry.cardInstanceId === card.id);
          const threshold = mark?.threshold ?? card.banrenmaThreshold ?? "-";
          const ready = Number(player?.resources?.score || 0) >= Number(threshold);
          banrenmaItems.push({
            kind: "banrenma", originalIndex,
            imageSrc: card.src || banrenma.getCardSrc?.(card.alienCardId) || resourceIconSrc.banrenmaCard,
            imageAlt: cards.getCardLabel(card), threshold,
            thresholdIconSrc: resourceIconSrc.banrenmaToken,
            ready, disabled: !ready,
            title: ready
              ? `半人马条件已达成：${cards.getCardLabel(card)}`
              : `半人马阈值：达到 ${threshold} 分后可结算条件效果`,
          });
          return;
        }
        const item = createRegularItem(card, originalIndex);
        if (context.getCardTypeCode?.(card) === 3 || cardEffects.getCardModel?.(card)?.displayRow === "bottom") {
          finalItems.push(item);
        } else {
          taskItems.push(item);
        }
      });

      const jiuzheCards = jiuzhe.getPlayerJiuzheCards?.(alienReadoutState, player) || [];
      const jiuzheItem = jiuzheCards.length ? {
        kind: "jiuzhe", imageSrc: jiuzhe.CARD_BACK_SRC,
        count: jiuzhe.countPlayedCards(alienReadoutState, player),
        playerId: player?.id || "", playerColor: player?.color || "",
      } : null;
      const debugFangzhouUnlock = context.isDebugAlienTraceMode?.() || false;
      const fangzhouItems = (fangzhou.getPlayerCard2Reserved?.(alienReadoutState, player) || [])
        .map((card) => ({
          kind: "fangzhou", traceType: card.traceType, imageSrc: card.src, imageAlt: card.label,
          debugUnlock: debugFangzhouUnlock, disabled: !debugFangzhouUnlock,
          title: debugFangzhouUnlock
            ? `${card.label}（点击追加 state 额外痕迹并解锁）`
            : `${card.label}（未解锁）`,
        }));
      return {
        title: initialSelection.active
          ? `初始选择 · ${player?.colorLabel || ""}玩家`
          : `保留牌区 · 完成任务 ${player?.completedTaskCount || 0}`,
        initialSelectionActive: initialSelection.active,
        empty: !initialSelection.active && reservedCards.length === 0 && !jiuzheItem
          && fangzhouItems.length === 0 && initialSelection.selectedCards.length === 0,
        rows: [
          { type: "task", label: "1、2型任务牌", items: taskItems },
          { type: "final", label: "3型终局计分牌与九折/方舟/半人马牌", items: [
            ...(jiuzheItem ? [jiuzheItem] : []), ...fangzhouItems, ...banrenmaItems, ...finalItems,
          ] },
        ],
      };
    }

    return Object.freeze({ createInitialSelection, createReservedCards });
  }

  function createResidentRenderInputBuilder(context = {}) {
    const presentation = context.presentationBuilder;
    function createRenderInput() {
      if (!context.viewStateStore || !context.projectionAdapter) return null;
      const viewer = context.getViewer();
      const canonical = context.projectionAdapter.projectSource({ viewer });
      const readoutRoot = context.createReadoutRoot(canonical.resident);
      const decisions = {
        movePayment: context.getPendingMovePayment?.(),
        cardSelectionDecision: context.readCardSelectionDecision?.(readoutRoot),
        alienTraceDecision: context.getPendingAlienTraceDecision?.(readoutRoot),
        alienTracePickerState: context.uiRuntimeState?.alienTracePickerState || null,
        actionEffectFlow: context.getActionEffectFlow?.(readoutRoot),
        publicCardSelectedSlots: [...(context.uiRuntimeState?.publicCardSelectedSlots || [])],
        discardDecision: context.getPendingDiscardDecision?.(),
        discardSelectedHandIndexes: [...(context.uiRuntimeState?.discardSelectedHandIndexes || [])],
        handScanDecision: context.getPendingHandScanDecision?.(),
        scanTargetDecision: context.getPendingScanTargetDecision?.(),
        playCardSelection: context.uiRuntimeState?.playCardSelection,
        handCardPlayAction: context.uiRuntimeState?.handCardPlayAction,
        cardCornerQuickAction: context.uiRuntimeState?.cardCornerQuickAction,
      };
      const projectedPlayers = canonical.resident?.players?.players || [];
      const finalScoreBreakdownsByPlayerId = Object.fromEntries(projectedPlayers.map((player) => [
        String(player.id),
        clonePresentation(context.computePlayerFinalScoreBreakdown?.(player, readoutRoot)),
      ]));
      const interfacePlayer = projectedPlayers.find((player) => String(player?.id) === viewer.playerId)
        || projectedPlayers.find((player) => (
          String(player?.id) === String(canonical.resident.players.currentPlayerId)
        ))
        || null;
      const handCount = Array.isArray(interfacePlayer?.hand)
        ? interfacePlayer.hand.length
        : Math.max(0, Math.round(Number(interfacePlayer?.resources?.handSize) || 0));
      const selectionActive = Boolean(context.isCardSelectionActive?.());
      const allowsBlindDraw = selectionActive && Boolean(context.allowsBlindDrawInSelection?.());
      const blindDrawAvailable = Boolean(context.canBlindDraw?.());
      const projection = createResidentProjection({
        projection: {
          ...canonical,
          resident: {
            ...canonical.resident,
            turn: structuredClone(canonical.resident.turn),
            players: {
              currentPlayerId: canonical.resident.players.currentPlayerId,
              players: structuredClone(projectedPlayers),
            },
            solar: structuredClone(canonical.resident.solar),
            pieces: structuredClone(canonical.resident.pieces),
            planets: structuredClone(canonical.resident.planets),
            data: structuredClone(canonical.resident.data),
            cards: {
              ...canonical.resident.cards,
              publicCards: structuredClone(canonical.resident.cards.publicCards || []),
              publicMarket: structuredClone(canonical.resident.cards.publicCards || []),
              ui: {
                selectionActive: Boolean(canonical.resident.cards.ui?.selectionActive),
                discardSelectionActive: Boolean(canonical.resident.cards.ui?.discardSelectionActive),
                playCardSelectionActive: Boolean(canonical.resident.cards.ui?.playCardSelectionActive),
              },
              publicControls: {
                selectionActive,
                multiSelectActive: Boolean(context.isPublicCardMultiSelectActive?.()),
                blindDrawEnabled: selectionActive && allowsBlindDraw && blindDrawAvailable,
                blindDrawReason: !selectionActive
                  ? "请先进入精选"
                  : !allowsBlindDraw
                    ? "本次精选不能盲抽"
                    : blindDrawAvailable ? "盲抽一张牌加入手牌" : "牌库已空",
              },
            },
            handPanel: {
              count: handCount, overLimit: handCount > 4,
              hint: context.getPlayerHandPanelTitleHint?.(),
            },
            initialSelection: presentation.createInitialSelection(viewer, canonical.resident),
            reservedCards: presentation.createReservedCards(viewer, canonical.resident),
            tech: {
              board: structuredClone(canonical.resident.tech.board || {}),
              ui: structuredClone(canonical.resident.tech.ui || {}),
            },
            aliens: structuredClone(canonical.resident.aliens),
            finalScoring: {
              ...structuredClone(canonical.resident.finalScoring),
              breakdownsByPlayerId: finalScoreBreakdownsByPlayerId,
            },
            decisions: {
              ...clonePresentation(decisions),
              alienRevealConfirmation: clonePresentation(context.uiRuntimeState?.alienRevealConfirmation),
            },
          },
        },
      });
      if (projection.ok === false) throw new TypeError(`${projection.code}: ${projection.message}`);
      context.viewStateStore.reconcileProjection(projection);
      return { projection, viewState: context.viewStateStore.getSnapshot() };
    }
    return Object.freeze({ createRenderInput });
  }

  function createViewerResolver(context = {}) {
    return function getViewer() {
      const player = context.getInterfacePlayer();
      return Object.freeze({
        viewerId: `browser:${player?.id || "spectator"}`,
        playerId: player?.id == null ? null : String(player.id),
        role: player ? "player" : "spectator",
      });
    };
  }

  return Object.freeze({
    SCHEMA_VERSION,
    BROWSER_PROJECTION_KEYS,
    RUNTIME_PROJECTION_SCHEMAS,
    LEGACY_SLICE_KEYS,
    validateProjection,
    assertCanonicalBrowserProjection,
    createResidentProjection,
    selectFinalUiProjection,
    selectFinalScoreAiProjection,
    selectActionLogProjection,
    selectRecoveryProjection,
    clonePresentation,
    createReadoutRoot,
    createResidentPresentationBuilder,
    createResidentRenderInputBuilder,
    createViewerResolver,
  });
});
