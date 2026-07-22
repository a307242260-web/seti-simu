(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserResidentProjection = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-browser-host-v1";
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

  function createLegacyReadoutRoot(resident, options = {}) {
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

  return Object.freeze({
    SCHEMA_VERSION,
    LEGACY_SLICE_KEYS,
    validateProjection,
    createResidentProjection,
    clonePresentation,
    createLegacyReadoutRoot,
    createResidentPresentationBuilder,
  });
});
