(function (root, factory) {
  "use strict";

  let catalog = root.SetiAlienCatalog;
  let placement = root.SetiAlienPlacement;
  let state = root.SetiAlienState;
  let randomizer = root.SetiAlienRandomizer;
  let jiuzhe = root.SetiAlienJiuzhe;
  let yichangdian = root.SetiAlienYichangdian;
  let fangzhou = root.SetiAlienFangzhou;
  let banrenma = root.SetiAlienBanrenma;
  let chong = root.SetiAlienChong;
  let amiba = root.SetiAlienAmiba;
  let aomomo = root.SetiAlienAomomo;
  let runezu = root.SetiAlienRunezu;
  let fangzhouCard1Queue = root.SetiFangzhouCard1Queue;
  let revealCardGrants = root.SetiAlienRevealCardGrants;

  if (typeof require === "function") {
    catalog = catalog || require("./catalog");
    placement = placement || require("./placement");
    state = state || require("./state");
    jiuzhe = jiuzhe || require("./jiuzhe");
    yichangdian = yichangdian || require("./yichangdian");
    fangzhou = fangzhou || require("./fangzhou");
    banrenma = banrenma || require("./banrenma");
    chong = chong || require("./chong");
    amiba = amiba || require("./amiba");
    aomomo = aomomo || require("./aomomo");
    runezu = runezu || require("./runezu");
    fangzhouCard1Queue = fangzhouCard1Queue || require("./fangzhou-card1-queue");
    revealCardGrants = revealCardGrants || require("./reveal-card-grants");
    randomizer = randomizer || require("./randomizer");
  }

  const api = factory(catalog, placement, state, randomizer, jiuzhe, yichangdian, fangzhou, banrenma, chong, amiba, aomomo, runezu, fangzhouCard1Queue, revealCardGrants);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (typeof module === "undefined") root.SetiAliens = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (catalog, placement, state, randomizer, jiuzhe, yichangdian, fangzhou, banrenma, chong, amiba, aomomo, runezu, fangzhouCard1Queue, revealCardGrants) {
  "use strict";

  function getTracePositionsForSpecies(species, traceType) {
    if (typeof species?.getPositionsForTraceType === "function") {
      return species.getPositionsForTraceType(traceType) || [];
    }
    return species?.TRACE_POSITIONS || [];
  }

  function canPlaceAnySpeciesTrace(species, methodName, alienState, alienSlotId, traceType, player, options = {}) {
    const canPlace = species?.[methodName];
    if (typeof canPlace !== "function") return false;
    return getTracePositionsForSpecies(species, traceType).some((position) => (
      Boolean(canPlace(alienState, alienSlotId, traceType, position, player, options)?.ok)
    ));
  }

  function canPlaceAnyRevealedAlienTrace(alienState, alienSlotId, traceType, player, options = {}) {
    if (jiuzhe?.isJiuzheRevealedSlot?.(alienState, alienSlotId)) {
      if (typeof jiuzhe.canPlaceJiuzheTrace === "function") {
        return canPlaceAnySpeciesTrace(
          jiuzhe,
          "canPlaceJiuzheTrace",
          alienState,
          alienSlotId,
          traceType,
          player,
          options,
        );
      }
      if (!jiuzhe.TRACE_TYPES?.includes(traceType)) return false;
      const grid = jiuzhe.getTraceGrid?.(alienState, alienSlotId);
      return jiuzhe.TRACE_POSITIONS.some((position) => !grid?.[traceType]?.[position]);
    }
    if (yichangdian?.isYichangdianRevealedSlot?.(alienState, alienSlotId)) {
      if (typeof yichangdian.canPlaceYichangdianTrace === "function") {
        return canPlaceAnySpeciesTrace(
          yichangdian,
          "canPlaceYichangdianTrace",
          alienState,
          alienSlotId,
          traceType,
          player,
          options,
        );
      }
      return Boolean(yichangdian.TRACE_TYPES?.includes(traceType));
    }
    if (fangzhou?.isFangzhouRevealedSlot?.(alienState, alienSlotId)) {
      return Boolean(fangzhou.canPlaceAnyFangzhouTrace?.(
        alienState,
        alienSlotId,
        traceType,
        player,
      ));
    }
    if (banrenma?.isBanrenmaRevealedSlot?.(alienState, alienSlotId)) {
      return Boolean(banrenma.canPlaceAnyBanrenmaTrace?.(
        alienState,
        alienSlotId,
        traceType,
        player,
        options,
      ));
    }
    if (chong?.isChongRevealedSlot?.(alienState, alienSlotId)) {
      return canPlaceAnySpeciesTrace(
        chong,
        "canPlaceChongTrace",
        alienState,
        alienSlotId,
        traceType,
        player,
        options,
      );
    }
    if (amiba?.isAmibaRevealedSlot?.(alienState, alienSlotId)) {
      return canPlaceAnySpeciesTrace(
        amiba,
        "canPlaceAmibaTrace",
        alienState,
        alienSlotId,
        traceType,
        player,
        options,
      );
    }
    if (aomomo?.isAomomoRevealedSlot?.(alienState, alienSlotId)) {
      return canPlaceAnySpeciesTrace(
        aomomo,
        "canPlaceAomomoTrace",
        alienState,
        alienSlotId,
        traceType,
        player,
        options,
      );
    }
    if (runezu?.isRunezuRevealedSlot?.(alienState, alienSlotId)) {
      return canPlaceAnySpeciesTrace(
        runezu,
        "canPlaceRunezuTrace",
        alienState,
        alienSlotId,
        traceType,
        player,
        options,
      );
    }
    return false;
  }

  return Object.freeze({
    ALIEN_TYPES: catalog.ALIEN_TYPES,
    ALIEN_TYPE_IDS: catalog.ALIEN_TYPE_IDS,
    ALIEN_BACK_SRC: catalog.ALIEN_BACK_SRC,
    TRACE_TYPES: placement.TRACE_TYPES,
    ALIEN_SLOT_IDS: placement.ALIEN_SLOT_IDS,
    TRACE_TYPE_LABELS: placement.TRACE_TYPE_LABELS,
    ALIEN_TRACE_TOKEN_SRC: placement.ALIEN_TRACE_TOKEN_SRC,
    ALIEN_TRACE_TOKEN_DISPLAY_SCALE: placement.ALIEN_TRACE_TOKEN_DISPLAY_SCALE,
    ALIEN_EXTRA_TRACE_TOKEN_DISPLAY_SCALE: placement.ALIEN_EXTRA_TRACE_TOKEN_DISPLAY_SCALE,
    YICHANGDIAN_TRACE_TOKEN_DISPLAY_SCALE: placement.YICHANGDIAN_TRACE_TOKEN_DISPLAY_SCALE,
    YICHANGDIAN_ANOMALY_MARKER_SCALE_PERCENT: placement.YICHANGDIAN_ANOMALY_MARKER_SCALE_PERCENT,
    EXTRA_TRACE_GRID_COLUMNS: placement.EXTRA_TRACE_GRID_COLUMNS,
    jiuzhe,
    yichangdian,
    fangzhou,
    banrenma,
    chong,
    amiba,
    aomomo,
    runezu,
    fangzhouCard1Queue,
    JIUZHE_ALIEN_ID: jiuzhe?.ALIEN_ID || "九折",
    JIUZHE_CARD_BACK_SRC: jiuzhe?.CARD_BACK_SRC,
    JIUZHE_THREAT_ICON_SRC: jiuzhe?.THREAT_ICON_SRC,
    YICHANGDIAN_ALIEN_ID: yichangdian?.ALIEN_ID || "异常点",
    YICHANGDIAN_CARD_BACK_SRC: yichangdian?.CARD_BACK_SRC,
    FANGZHOU_ALIEN_ID: fangzhou?.ALIEN_ID || "方舟",
    FANGZHOU_CARD1_BACK_SRC: fangzhou?.CARD1_BACK_SRC,
    BANRENMA_ALIEN_ID: banrenma?.ALIEN_ID || "半人马",
    BANRENMA_CARD_BACK_SRC: banrenma?.CARD_BACK_SRC,
    BANRENMA_TOKEN_SRC: banrenma?.TOKEN_SRC,
    CHONG_ALIEN_ID: chong?.ALIEN_ID || "虫",
    CHONG_CARD_BACK_SRC: chong?.CARD_BACK_SRC,
    CHONG_FOSSIL_BACK_SRC: chong?.FOSSIL_BACK_SRC,
    AMIBA_ALIEN_ID: amiba?.ALIEN_ID || "阿米巴",
    AMIBA_CARD_BACK_SRC: amiba?.CARD_BACK_SRC,
    AOMOMO_ALIEN_ID: aomomo?.ALIEN_ID || "奥陌陌",
    AOMOMO_CARD_BACK_SRC: aomomo?.CARD_BACK_SRC,
    AOMOMO_FOSSIL_SRC: aomomo?.FOSSIL_SRC,
    AOMOMO_WHEEL3_AMM_SRC: aomomo?.WHEEL3_AMM_SRC,
    RUNEZU_ALIEN_ID: runezu?.ALIEN_ID || "符文族",
    RUNEZU_CARD_BACK_SRC: runezu?.CARD_BACK_SRC,
    MIN_ALIEN_REVEAL_POOL_SIZE: randomizer.MIN_ALIEN_REVEAL_POOL_SIZE,
    NEUTRAL_SCORE_TRACE_THRESHOLDS: state.NEUTRAL_SCORE_TRACE_THRESHOLDS,
    NEUTRAL_SCORE_TRACE_ORDER: state.NEUTRAL_SCORE_TRACE_ORDER,
    createDefaultAlienState: state.createDefaultAlienState,
    getAlienRevealPool: randomizer.getAlienRevealPool,
    setAlienRevealPool: randomizer.setAlienRevealPool,
    randomizeAlienAssignments: randomizer.randomizeAlienAssignments,
    pickRandomAlienIdForReveal: randomizer.pickRandomAlienIdForReveal,
    revealRandomAlien: randomizer.revealRandomAlien,
    getAlienType: catalog.getAlienType,
    getAlienLabel: catalog.getAlienLabel,
    getAlienFaceSrc: catalog.getAlienFaceSrc,
    getAlienSlot: state.getAlienSlot,
    countPlacedFirstTraces: state.countPlacedFirstTraces,
    countFirstTracesForPlayerOnSlot: state.countFirstTracesForPlayerOnSlot,
    countTraceMarkersForPlayerOnSlot: state.countTraceMarkersForPlayerOnSlot,
    countFirstTracesByPlayerOnSlot: state.countFirstTracesByPlayerOnSlot,
    getFirstTraceRewardForSlot: state.getFirstTraceRewardForSlot,
    getExtraTraceReward: state.getExtraTraceReward,
    isAlienReadyToReveal: state.isAlienReadyToReveal,
    getExtraTraceMarker: state.getExtraTraceMarker,
    getExtraTraceOwnerColor: state.getExtraTraceOwnerColor,
    getNeutralScoreTraceMark: state.getNeutralScoreTraceMark,
    findNeutralScoreTraceTarget: state.findNeutralScoreTraceTarget,
    placeNeutralScoreTraceForThreshold: state.placeNeutralScoreTraceForThreshold,
    placeFirstTrace: state.placeFirstTrace,
    addExtraTrace: state.addExtraTrace,
    revealAlien: state.revealAlien,
    grantAlienCardsForFirstTraces: revealCardGrants?.grantAlienCardsForFirstTraces,
    getAlienSlotLabel: placement.getAlienSlotLabel,
    getTraceTypeLabel: placement.getTraceTypeLabel,
    getAlienTraceMarkerLayout: placement.getAlienTraceMarkerLayout,
    getAlienExtraTraceMarkerLayout: placement.getAlienExtraTraceMarkerLayout,
    getYichangdianAnomalyMarkerBoardPoint: placement.getYichangdianAnomalyMarkerBoardPoint,
    getExtraTraceGridOriginCenter: placement.getExtraTraceGridOriginCenter,
    getExtraTraceGridCenter: placement.getExtraTraceGridCenter,
    canPlaceAnyRevealedAlienTrace,
  });
});
