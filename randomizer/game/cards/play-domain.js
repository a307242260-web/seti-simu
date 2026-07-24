(function (root, factory) {
  "use strict";

  let standardAction = root.SetiStandardAction;
  let cards = root.SetiCards;
  let cardEffects = root.SetiCardEffects;
  let players = root.SetiPlayers;
  let abilities = root.SetiAbilities;
  let data = root.SetiData;
  let initialCards = root.SetiInitialCards;
  let tech = root.SetiTech;
  let solar = root.SetiSolarSystem;
  let rockets = root.SetiRockets;
  let planetStats = root.SetiPlanetStats;
  let aliens = root.SetiAliens;
  let actionShared = root.SetiActionShared;
  if (typeof require === "function") {
    standardAction = standardAction || require("../actions/standard-action");
    cards = cards || require("./deck");
    cardEffects = cardEffects || require("./effects");
    players = players || require("../players");
    abilities = abilities || require("../abilities");
    data = data || require("../data");
    initialCards = initialCards || require("../initial-cards");
    tech = tech || require("../tech");
    solar = solar || require("../../solar-system/core");
    rockets = rockets || require("../rockets");
    planetStats = planetStats || require("../planet-stats");
    aliens = aliens || require("../aliens");
    actionShared = actionShared || require("../actions/shared");
  }

  const api = factory(
    standardAction,
    cards,
    cardEffects,
    players,
    abilities,
    data,
    initialCards,
    tech,
    solar,
    rockets,
    planetStats,
    aliens,
    actionShared,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiCardPlayDomain = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  standardAction,
  cards,
  cardEffects,
  players,
  abilities,
  data,
  initialCards,
  tech,
  solar,
  rockets,
  planetStats,
  aliens,
  actionShared,
) {
  "use strict";

  const DOMAIN_ID = "card_play";
  const ACTION_FAMILIES = Object.freeze(["play_card"]);
  const EFFECT_TYPES = Object.freeze({
    PLAY: "card_play_domain_play",
    DIRECT: "card_play_domain_direct",
    DRAW_CARDS: "card_play_domain_draw_cards",
    PICK_CARD: "card_play_domain_pick_card",
    PICK_CARD_START: "card_play_domain_pick_card_start",
    INCOME_DECISION: "card_play_domain_income_decision",
    RESEARCH_TECH: "card_play_domain_research_tech",
    RESEARCH_TECH_DECISION: "card_play_domain_research_tech_decision",
    LAUNCH: "card_play_domain_launch",
    FIXED_NEBULA_SCAN: "card_play_domain_fixed_nebula_scan",
    COLOR_NEBULA_SCAN: "card_play_domain_color_nebula_scan",
    EFFECT: "card_play_domain_effect",
  });
  const EXECUTOR_ID = `${DOMAIN_ID}:executor:v1`;
  const REACHABLE_PLAY_EFFECT_TYPES = Object.freeze((() => {
    const types = new Set();
    for (const cardId of Object.keys(cardEffects.CARD_REFERENCE_MAP || {})) {
      for (const effect of cardEffects.buildPlayEffects({ cardId })) types.add(effect.type);
    }
    return [...types].sort();
  })());
  const KNOWN_CARD_EFFECT_TYPES = new Set([
    ...Object.values(cardEffects.EFFECT_TYPES || {}),
    ...Object.values(cardEffects.REWARD_TYPES || {}),
  ]);
  function collectRecursiveEffectTypes(value, types = new Set()) {
    if (!value || typeof value !== "object") return types;
    if (Array.isArray(value)) {
      for (const entry of value) collectRecursiveEffectTypes(entry, types);
      return types;
    }
    if (KNOWN_CARD_EFFECT_TYPES.has(value.type)) types.add(value.type);
    for (const [key, entry] of Object.entries(value)) {
      if (key !== "condition" && key !== "event") collectRecursiveEffectTypes(entry, types);
    }
    return types;
  }
  const REACHABLE_RECURSIVE_EFFECT_TYPES = Object.freeze((() => {
    const types = new Set();
    for (const cardId of Object.keys(cardEffects.CARD_REFERENCE_MAP || {})) {
      collectRecursiveEffectTypes(cardEffects.buildPlayEffects({ cardId }), types);
    }
    return [...types].sort();
  })());
  const DIRECT_EFFECT_TYPES = Object.freeze([
    cardEffects.REWARD_TYPES.GAIN_RESOURCES,
    cardEffects.REWARD_TYPES.GAIN_DATA,
    cardEffects.EFFECT_TYPES.COUNT_HAND_INCOME_RESOURCE,
    cardEffects.EFFECT_TYPES.COUNT_CURRENT_INCOME_RESOURCE,
    cardEffects.EFFECT_TYPES.TUCK_PLAYED_CARD_TO_INCOME,
    cardEffects.EFFECT_TYPES.PLUTO_RESERVE,
    cardEffects.EFFECT_TYPES.DISCARD_ALL_HAND,
    cardEffects.EFFECT_TYPES.INCOME,
    cardEffects.EFFECT_TYPES.COUNT_OWNED_TECH_REWARD,
    cardEffects.EFFECT_TYPES.COUNT_TECH_TYPES_REWARD,
  ]);
  const CARD_ENTITY_EFFECT_TYPES = Object.freeze([
    cardEffects.REWARD_TYPES.DRAW_CARDS,
    cardEffects.REWARD_TYPES.PICK_CARD,
  ]);
  const OWNED_PLAY_EFFECT_TYPES = REACHABLE_RECURSIVE_EFFECT_TYPES;

  function findUnownedEffect(value) {
    if (!value || typeof value !== "object") return null;
    if (Array.isArray(value)) {
      for (const entry of value) {
        const unowned = findUnownedEffect(entry);
        if (unowned) return unowned;
      }
      return null;
    }
    if (
      KNOWN_CARD_EFFECT_TYPES.has(value.type)
      && !OWNED_PLAY_EFFECT_TYPES.includes(value.type)
    ) {
      return value;
    }
    for (const [key, entry] of Object.entries(value)) {
      if (key === "condition" || key === "event") continue;
      const unowned = findUnownedEffect(entry);
      if (unowned) return unowned;
    }
    return null;
  }

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function fail(code, message, details = {}) {
    return { ok: false, code, message, ...details };
  }

  function stableSerialize(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableSerialize(value[key])}`
    )).join(",")}}`;
  }

  function getWorkingRoot(state, workingContext) {
    return workingContext?.workingRoot || workingContext || state;
  }

  function getSlice(root, browserKey, committedKey) {
    return root?.[browserKey] || root?.[committedKey] || {};
  }

  function getActor(root, actorId = null) {
    const playerState = getSlice(root, "playerState", "players");
    const resolvedId = actorId || playerState.currentPlayerId || root?.turn?.currentPlayerId || null;
    return (playerState.players || []).find((player) => player.id === resolvedId) || null;
  }

  function createActionContext(root, actorId) {
    const playerState = getSlice(root, "playerState", "players");
    const techGameState = getSlice(root, "techGameState", "tech");
    const solarState = getSlice(root, "solarState", "solarSystem");
    const rocketState = getSlice(root, "rocketState", "pieces");
    const actionPlayerState = actorId === playerState.currentPlayerId
      ? playerState
      : { ...playerState, currentPlayerId: actorId, players: playerState.players };
    const context = {
      workingRoot: root,
      playerState: actionPlayerState,
      cardState: getSlice(root, "cardState", "cards"),
      rocketState,
      solarState,
      nebulaDataState: getSlice(root, "nebulaDataState", "data"),
      planetStatsState: getSlice(root, "planetStatsState", "planets"),
      techGameState,
      techBoardState: techGameState.board,
      techUiState: techGameState.ui,
      alienGameState: getSlice(root, "alienGameState", "aliens"),
      turnState: getSlice(root, "turnState", "turn"),
      match: root.match,
      ensurePlayerTechState(player) {
        if (!player.techState) player.techState = players.normalizePlayerTechState(null);
      },
      standardActionAuthority: {
        actorId,
        stateVersion: root?.meta?.stateVersion ?? 0,
        decisionVersion: root?.match?.decisionVersion ?? 0,
      },
    };
    context.getPlanetLocations = () => solar.createSolarSnapshot(solarState).planetLocations;
    context.getEarthSectorCoordinate = () => {
      const earth = context.getPlanetLocations()
        .find((planet) => planet.planetId === "earth");
      return earth ? { x: earth.x, y: earth.y } : null;
    };
    context.rotateSolarOrbit = (count = 1) => {
      const beforeRotation = clone(solarState.rotation);
      solarState.rotation = solar.applySolarOrbitRotation(solarState.rotation, count);
      solarState.wheelSteps = solar.rotationToWheelSteps(solarState.rotation);
      return abilities.rocket.settleRocketsAfterSolarRotation(
        context,
        beforeRotation,
        solarState.rotation,
      );
    };
    context.drawBasicCardToPlayer = (player) => cards.blindDraw(
      context.cardState,
      actionPlayerState,
      player,
      () => nextCommittedRandom(root),
      { createCardInstance: createCommittedCardFactory(root) },
    );
    return context;
  }

  function hashSeed(value) {
    let hash = 2166136261;
    for (const character of String(value ?? "seti-card-play")) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function nextCommittedRandom(root) {
    if (!root?.meta) throw new TypeError("Card Play deterministic random 缺少 meta");
    if (!root.meta.rngState || typeof root.meta.rngState !== "object") root.meta.rngState = {};
    const previous = root.meta.rngState.cardPlay;
    const state = Number.isSafeInteger(previous?.state)
      ? previous.state >>> 0
      : hashSeed(root.meta.seed);
    const nextState = (state + 0x6D2B79F5) >>> 0;
    let value = nextState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    root.meta.rngState.cardPlay = {
      algorithm: "mulberry32-v1",
      state: nextState,
      cursor: (Number(previous?.cursor) || 0) + 1,
    };
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  function createCommittedCardFactory(root) {
    return (entry) => cards.createCommittedCardInstance(root, entry);
  }

  function createPlayCardProvider() {
    return Object.freeze(standardAction.createPlayCardProvider({
      players,
      cards,
      getCardPlayCost: cardEffects.getCardPlayCost,
      canStart(actionContext) {
        const root = actionContext?.workingRoot || actionContext;
        const actor = getActor(root, actionContext?.standardActionAuthority?.actorId);
        return actor && !actor.mainActionCompleted
          ? { ok: true }
          : fail("PLAY_CARD_BLOCKED", "当前无法开始打牌行动");
      },
      execute() {
        return fail("CARD_PLAY_SESSION_REQUIRED", "play_card 必须由 Card Play Effect Session 执行");
      },
    }));
  }

  function createExperimentalCardPlayDomain(options = {}) {
    const runtime = options.runtime;
    const commitWorkingState = options.commitWorkingState;
    if (typeof runtime?.registerExecutor !== "function") {
      throw new TypeError("Card Play domain 缺少 Effect runtime");
    }
    if (typeof commitWorkingState !== "function") {
      throw new TypeError("Card Play domain 缺少 commitWorkingState");
    }

    function genericEffectRuntimeType(effectType, decision = false) {
      return `${EFFECT_TYPES.EFFECT}:${decision ? "decision" : "effect"}:${effectType}`;
    }

    function createSpawnedCardEffect(effect, ownerId, cardInstanceId) {
      let type = EFFECT_TYPES.COLOR_NEBULA_SCAN;
      let decisionKind = "choose_target";
      if (DIRECT_EFFECT_TYPES.includes(effect.type)) {
        type = EFFECT_TYPES.DIRECT;
        decisionKind = null;
      } else if (effect.type === cardEffects.REWARD_TYPES.DRAW_CARDS) {
        type = EFFECT_TYPES.DRAW_CARDS;
        decisionKind = null;
      } else if (effect.type === cardEffects.REWARD_TYPES.PICK_CARD) {
        type = EFFECT_TYPES.PICK_CARD_START;
        decisionKind = null;
      } else if (effect.type === cardEffects.EFFECT_TYPES.RESEARCH_TECH) {
        type = EFFECT_TYPES.RESEARCH_TECH;
        decisionKind = null;
      } else if (effect.type === cardEffects.REWARD_TYPES.LAUNCH) {
        type = EFFECT_TYPES.LAUNCH;
        decisionKind = null;
      } else if (effect.type === cardEffects.EFFECT_TYPES.SCAN_NEBULA) {
        type = EFFECT_TYPES.FIXED_NEBULA_SCAN;
        decisionKind = null;
      } else if (![
        cardEffects.EFFECT_TYPES.SCAN_COLOR_CHOICE,
      ].includes(effect.type)) {
        type = genericEffectRuntimeType(effect.type);
        decisionKind = null;
      }
      const genericDescriptor = GENERIC_EFFECT_DESCRIPTORS[effect.type] || null;
      if (genericDescriptor?.decisionKind) {
        decisionKind = null;
        type = genericEffectRuntimeType(effect.type);
      }
      return {
        priority: "direct",
        effect: {
          type,
          ...(decisionKind ? { kind: "decision", decisionKind } : {}),
          ownerId,
          payload: { cardEffect: clone(effect), cardInstanceId },
        },
      };
    }

    runtime.registerExecutor(EFFECT_TYPES.PLAY, (state, sessionEffect, workingContext) => {
      const root = getWorkingRoot(state, workingContext);
      const action = sessionEffect.payload?.action;
      const actor = getActor(root, action?.actorId);
      const handIndex = actor?.hand?.findIndex(
        (card) => card.id === action?.target?.cardInstanceId,
      ) ?? -1;
      const card = handIndex >= 0 ? actor.hand[handIndex] : null;
      if (!actor || !card) return fail("PLAY_CARD_STALE", "手牌实体已失效");
      const cost = cardEffects.getCardPlayCost(card);
      if (stableSerialize(cost) !== stableSerialize(action.payload?.cost || {})) {
        return fail("PLAY_CARD_COST_STALE", "卡牌费用已失效");
      }
      const playEffects = cardEffects.buildPlayEffects(card);
      const unsupported = findUnownedEffect(playEffects);
      if (unsupported) {
        return fail("CARD_PLAY_EFFECT_UNOWNED", `Card Play domain 未拥有 ${unsupported.type}`, {
          effectType: unsupported.type,
        });
      }
      const spent = players.spendResources(actor, cost);
      if (!spent.ok) return spent;
      const removed = cards.discardFromHandAtIndex(actor, handIndex);
      if (!removed.ok) {
        players.gainResources(actor, cost);
        return removed;
      }
      const playedCard = removed.card;
      const model = cardEffects.getCardModel(playedCard);
      const cardType = cardEffects.getRuntimeCardTypeCode(playedCard);
      const reserved = [1, 2, 3].includes(cardType) || Boolean(model?.reserveAfterPlay);
      if (reserved) {
        if (!Array.isArray(actor.reservedCards)) actor.reservedCards = [];
        cardEffects.ensureCardEffectState(playedCard);
        actor.reservedCards.push(playedCard);
      } else {
        cards.addToDiscardPile(getSlice(root, "cardState", "cards"), playedCard);
      }
      actor.mainActionCompleted = true;
      return {
        ok: true,
        nextState: commitWorkingState(state, { source: EFFECT_TYPES.PLAY }),
        spawnedEffects: playEffects.map((effect) => (
          createSpawnedCardEffect(effect, actor.id, playedCard.id)
        )),
        events: [{
          type: "playCard",
          timing: "after_play_card",
          playerId: actor.id,
          cardId: playedCard.cardId || null,
          sourceCardInstanceId: playedCard.id,
          price: Number(cost.credits || 0),
          executorId: EXECUTOR_ID,
        }],
        history: [{
          type: "play_card",
          playerId: actor.id,
          cardInstanceId: playedCard.id,
          cardId: playedCard.cardId || null,
          cost: clone(cost),
          reserved,
        }],
      };
    });

    runtime.registerExecutor(EFFECT_TYPES.DIRECT, (state, sessionEffect, workingContext) => {
      const root = getWorkingRoot(state, workingContext);
      const effect = sessionEffect.payload?.cardEffect;
      const actor = getActor(root, sessionEffect.ownerId);
      if (!actor || !DIRECT_EFFECT_TYPES.includes(effect?.type)) {
        return fail("CARD_DIRECT_EFFECT_CONTEXT_STALE", "卡牌直接效果上下文已失效");
      }
      const options = effect.options || {};
      let result = null;
      let spawnedEffects = [];
      let irreversible = null;
      if (effect.type === cardEffects.REWARD_TYPES.GAIN_RESOURCES) {
        const gain = clone(options.gain || {});
        players.gainResources(actor, gain);
        result = { ok: true, gain };
      } else if (effect.type === cardEffects.REWARD_TYPES.GAIN_DATA) {
        const count = Math.max(0, Math.round(Number(options.count) || 0));
        const results = Array.from({ length: count }, () => (
          data.gainData(actor, { source: "play_card", root })
        ));
        result = { ok: true, count, results };
      } else if (effect.type === cardEffects.EFFECT_TYPES.COUNT_HAND_INCOME_RESOURCE) {
        const incomeCode = Number(options.incomeCode);
        const resource = options.resource || "energy";
        const per = Math.max(0, Number(options.per) || 1);
        const count = (actor.hand || [])
          .filter((card) => Number(cards.getIncomeCodeForCard(card)) === incomeCode)
          .length;
        const gain = { [resource]: Math.round(count * per) };
        if (gain[resource] > 0) players.gainResources(actor, gain);
        result = { ok: true, count, gain };
      } else if (effect.type === cardEffects.EFFECT_TYPES.COUNT_CURRENT_INCOME_RESOURCE) {
        const incomeKey = options.incomeKey || "credits";
        const resource = options.resource || "score";
        const per = Math.max(0, Number(options.per) || 1);
        const currentIncomeCount = Math.max(0, Math.round(Number(actor.income?.[incomeKey]) || 0));
        const industryEffect = initialCards.getIndustryEffect?.(actor.initialSelection?.industry);
        const companyBaseIncome = players.normalizeIncome(industryEffect?.baseIncome || null);
        const baseIncomeCount = Math.max(0, Math.round(Number(companyBaseIncome?.[incomeKey]) || 0));
        const count = Math.max(0, currentIncomeCount - baseIncomeCount);
        const gain = { [resource]: Math.round(count * per) };
        if (gain[resource] > 0) players.gainResources(actor, gain);
        result = { ok: true, count, currentIncomeCount, baseIncomeCount, gain };
      } else if (effect.type === cardEffects.EFFECT_TYPES.TUCK_PLAYED_CARD_TO_INCOME) {
        const cardState = getSlice(root, "cardState", "cards");
        const cardInstanceId = sessionEffect.payload?.cardInstanceId;
        const discardIndex = (cardState.discardPile || [])
          .findIndex((card) => card.id === cardInstanceId);
        if (discardIndex < 0) {
          return fail("CARD_TUCK_TARGET_STALE", "当前打出的卡牌不在弃牌堆");
        }
        const [playedCard] = cardState.discardPile.splice(discardIndex, 1);
        const gain = cards.getIncomeGainForCard(playedCard);
        if (!gain) return fail("CARD_TUCK_INCOME_UNKNOWN", "当前卡牌没有可识别收入");
        const drawnCards = [];
        const dataResults = [];
        players.gainIncome(actor, gain, {
          blindDraw(targetPlayer) {
            const draw = cards.blindDraw(
              cardState,
              getSlice(root, "playerState", "players"),
              targetPlayer,
              () => nextCommittedRandom(root),
              { createCardInstance: createCommittedCardFactory(root) },
            );
            if (draw.ok) drawnCards.push(draw.card);
            return draw;
          },
          gainData(targetPlayer) {
            const gainResult = data.gainData(targetPlayer, { source: "card_income", root });
            dataResults.push(gainResult);
            return gainResult;
          },
        });
        irreversible = drawnCards.length
          ? { code: "hidden_card_reveal", reason: "收入盲抽翻出新牌" }
          : null;
        result = { ok: true, gain, playedCard, drawnCards, dataResults };
      } else if (effect.type === cardEffects.EFFECT_TYPES.PLUTO_RESERVE) {
        const cardInstanceId = sessionEffect.payload?.cardInstanceId;
        const playedCard = (actor.reservedCards || [])
          .find((card) => card.id === cardInstanceId);
        if (!playedCard) return fail("CARD_PLUTO_RESERVE_STALE", "冥王星保留牌实体已失效");
        const cardEffectState = cardEffects.ensureCardEffectState(playedCard);
        cardEffectState.pluto = {
          ...(cardEffectState.pluto || {}),
          orbitDone: Boolean(cardEffectState.pluto?.orbitDone),
          landDone: Boolean(cardEffectState.pluto?.landDone),
        };
        result = { ok: true, cardInstanceId };
      } else if (effect.type === cardEffects.EFFECT_TYPES.DISCARD_ALL_HAND) {
        const cardState = getSlice(root, "cardState", "cards");
        const discarded = [];
        while ((actor.hand || []).length) {
          const removed = cards.discardFromHandAtIndex(actor, actor.hand.length - 1);
          if (!removed.ok) break;
          cards.addToDiscardPile(cardState, removed.card);
          discarded.push(removed.card);
        }
        spawnedEffects = (options.rewards || []).map((reward) => (
          createSpawnedCardEffect(
            reward,
            actor.id,
            sessionEffect.payload?.cardInstanceId || null,
          )
        ));
        result = { ok: true, discarded };
      } else if (effect.type === cardEffects.EFFECT_TYPES.INCOME) {
        if ((actor.hand || []).length) {
          spawnedEffects = [{
            priority: "direct",
            effect: {
              type: EFFECT_TYPES.INCOME_DECISION,
              kind: "decision",
              decisionKind: "choose_card",
              ownerId: actor.id,
              payload: {
                cardEffect: clone(effect),
                cardInstanceId: sessionEffect.payload?.cardInstanceId || null,
              },
            },
          }];
        }
        result = { ok: true, skipped: !(actor.hand || []).length };
      } else if (effect.type === cardEffects.EFFECT_TYPES.COUNT_OWNED_TECH_REWARD) {
        const techType = options.techType || null;
        const count = Object.keys(actor.techState?.ownedTiles || {})
          .filter((tileId) => (
            actor.techState.ownedTiles[tileId]
            && (!techType || String(tileId).startsWith(techType))
          ))
          .length;
        const total = Math.max(0, Math.round(count * Number(options.per || 1)));
        if (options.resource === "data") {
          for (let index = 0; index < total; index += 1) {
            data.gainData(actor, { source: "owned_tech_reward", root });
          }
        } else if (total > 0) {
          players.gainResources(actor, { [options.resource || "score"]: total });
        }
        result = { ok: true, count, total };
      } else if (effect.type === cardEffects.EFFECT_TYPES.COUNT_TECH_TYPES_REWARD) {
        const counts = ["orange", "purple", "blue"].map((techType) => (
          Object.keys(actor.techState?.ownedTiles || {})
            .filter((tileId) => (
              actor.techState.ownedTiles[tileId]
              && String(tileId).startsWith(techType)
            ))
            .length
        ));
        const count = Math.max(0, ...counts);
        const drawnCards = [];
        if (options.reward === "draw") {
          const drawResult = cards.drawCardsToHand(
            getSlice(root, "cardState", "cards"),
            getSlice(root, "playerState", "players"),
            actor,
            count,
            () => nextCommittedRandom(root),
            { createCardInstance: createCommittedCardFactory(root) },
          );
          drawnCards.push(...(drawResult.cards || []));
        }
        irreversible = drawnCards.length
          ? { code: "hidden_card_reveal", reason: "科技数量奖励盲抽翻出新牌" }
          : null;
        result = { ok: true, count, drawnCards };
      }
      if (!result?.ok) return result;
      return {
        ok: true,
        nextState: commitWorkingState(state, { source: effect.type }),
        spawnedEffects,
        irreversible,
        events: [{
          type: "card_effect",
          effectId: effect.id || null,
          effectType: effect.type,
          playerId: actor.id,
        }],
        history: [{
          type: "card_effect",
          effectId: effect.id || null,
          effectType: effect.type,
          executorId: EXECUTOR_ID,
        }],
      };
    });

    const incomeDecisionExecutor = {
      getLegalChoices(state, sessionEffect, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const actor = getActor(root, sessionEffect.ownerId);
        return (actor?.hand || []).map((card) => ({
          family: "choose_card",
          target: { choiceId: card.id, cardInstanceId: card.id },
          payload: { incomeCode: cards.getIncomeCodeForCard(card) },
          summary: `弃掉 ${cards.getCardLabel(card)} 作为收入`,
        }));
      },
      resolveDecision(state, sessionEffect, choice, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const actor = getActor(root, sessionEffect.ownerId);
        const legal = incomeDecisionExecutor.getLegalChoices(state, sessionEffect, workingContext)
          .find((candidate) => candidate.target.cardInstanceId === choice?.target?.cardInstanceId);
        if (!actor || !legal) return fail("CARD_INCOME_CHOICE_STALE", "收入卡牌选择已失效");
        const handIndex = actor.hand.findIndex((card) => card.id === legal.target.cardInstanceId);
        const removed = cards.discardFromHandAtIndex(actor, handIndex);
        if (!removed.ok) return removed;
        const gain = cards.getIncomeGainForCard(removed.card);
        if (!gain) return fail("CARD_INCOME_UNKNOWN", "所选卡牌没有可识别收入");
        cards.addToDiscardPile(getSlice(root, "cardState", "cards"), removed.card);
        const drawnCards = [];
        const dataResults = [];
        players.gainIncome(actor, gain, {
          blindDraw(targetPlayer) {
            const draw = cards.blindDraw(
              getSlice(root, "cardState", "cards"),
              getSlice(root, "playerState", "players"),
              targetPlayer,
              () => nextCommittedRandom(root),
              { createCardInstance: createCommittedCardFactory(root) },
            );
            if (draw.ok) drawnCards.push(draw.card);
            return draw;
          },
          gainData(targetPlayer) {
            const gainResult = data.gainData(targetPlayer, { source: "card_income", root });
            dataResults.push(gainResult);
            return gainResult;
          },
        });
        return {
          ok: true,
          nextState: commitWorkingState(state, { source: cardEffects.EFFECT_TYPES.INCOME }),
          irreversible: drawnCards.length
            ? { code: "hidden_card_reveal", reason: "收入盲抽翻出新牌" }
            : null,
          events: [{
            type: "card_effect",
            effectId: sessionEffect.payload?.cardEffect?.id || null,
            effectType: cardEffects.EFFECT_TYPES.INCOME,
            playerId: actor.id,
            cardInstanceId: removed.card.id,
          }],
          history: [{
            type: "card_effect_decision",
            effectType: cardEffects.EFFECT_TYPES.INCOME,
            choiceId: legal.target.choiceId,
            gain: clone(gain),
            executorId: EXECUTOR_ID,
          }],
        };
      },
    };
    runtime.registerExecutor(EFFECT_TYPES.INCOME_DECISION, incomeDecisionExecutor);

    function researchConditionMet(actor, condition) {
      if (!condition) return true;
      if (condition.type === "resourceEquals") {
        return Number(actor.resources?.[condition.resource] || 0) === Number(condition.count || 0);
      }
      if (condition.type === "resourceThreshold") {
        return Number(actor.resources?.[condition.resource] || 0) >= Number(condition.count || 0);
      }
      return false;
    }

    function listResearchChoices(root, sessionEffect) {
      const effect = sessionEffect.payload?.cardEffect;
      const actor = getActor(root, sessionEffect.ownerId);
      const techGameState = getSlice(root, "techGameState", "tech");
      if (!actor || !techGameState?.board || !researchConditionMet(
        actor,
        effect?.options?.requireCondition,
      )) return [];
      const filter = effect.options?.techTypes?.length
        ? { techTypes: effect.options.techTypes }
        : {};
      let tileIds = tech.resolver.listTakeableTiles(
        techGameState.board,
        actor.techState || players.normalizePlayerTechState(null),
        filter,
      );
      if (effect.options?.researchedByOthersOnly) {
        const others = getSlice(root, "playerState", "players").players
          .filter((player) => player.id !== actor.id);
        tileIds = tileIds.filter((tileId) => others.some((player) => (
          Boolean(player.techState?.ownedTiles?.[tileId])
        )));
      }
      const blueSlots = tech.getAvailableBlueSlots(
        actor.techState || players.normalizePlayerTechState(null),
      );
      return tileIds.flatMap((tileId) => {
        const slots = tech.getTechType(tileId) === "blue" ? blueSlots : [null];
        return slots.map((blueSlot) => ({
          family: "choose_target",
          target: {
            choiceId: blueSlot == null ? tileId : `${tileId}:slot:${blueSlot}`,
            tileId,
            blueSlot,
          },
          payload: {
            skipCost: effect.options?.skipCost !== false,
            skipRotate: Boolean(effect.options?.skipRotate),
            skipBonus: Boolean(effect.options?.skipBonus),
          },
          summary: blueSlot == null ? `研究 ${tileId}` : `研究 ${tileId}，放入蓝色槽 ${blueSlot}`,
        }));
      });
    }

    runtime.registerExecutor(EFFECT_TYPES.RESEARCH_TECH, (
      state,
      sessionEffect,
      workingContext,
    ) => {
      const root = getWorkingRoot(state, workingContext);
      const choices = listResearchChoices(root, sessionEffect);
      return {
        ok: true,
        nextState: commitWorkingState(state, {
          source: cardEffects.EFFECT_TYPES.RESEARCH_TECH,
        }),
        spawnedEffects: choices.length
          ? [{
            priority: "direct",
            effect: {
              type: EFFECT_TYPES.RESEARCH_TECH_DECISION,
              kind: "decision",
              decisionKind: "choose_target",
              ownerId: sessionEffect.ownerId,
              payload: clone(sessionEffect.payload),
            },
          }]
          : [],
        events: choices.length
          ? []
          : [{
            type: "card_effect",
            effectId: sessionEffect.payload?.cardEffect?.id || null,
            effectType: cardEffects.EFFECT_TYPES.RESEARCH_TECH,
            playerId: sessionEffect.ownerId,
            skipped: true,
            reason: "no_takeable_tech",
          }],
      };
    });

    const researchTechDecisionExecutor = {
      getLegalChoices(state, sessionEffect, workingContext) {
        return listResearchChoices(getWorkingRoot(state, workingContext), sessionEffect);
      },
      resolveDecision(state, sessionEffect, choice, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const effect = sessionEffect.payload?.cardEffect;
        const actor = getActor(root, sessionEffect.ownerId);
        const legal = listResearchChoices(root, sessionEffect)
          .find((candidate) => candidate.target.choiceId === choice?.target?.choiceId);
        if (!actor || !legal) return fail("CARD_RESEARCH_TECH_CHOICE_STALE", "科技选择已失效");
        const actionContext = createActionContext(root, actor.id);
        const takeOptions = {
          tileId: legal.target.tileId,
          blueSlot: legal.target.blueSlot,
          techTypes: effect.options?.techTypes,
          skipCost: effect.options?.skipCost !== false,
          skipRotation: Boolean(effect.options?.skipRotate),
        };
        let result;
        if (effect.options?.skipBonus) {
          const selected = tech.resolver.selectTechTile(actionContext, takeOptions);
          if (!selected.ok || selected.needsBlueSlotChoice) return selected;
          result = tech.resolver.takeSelectedTechTile(actionContext, {
            ...takeOptions,
            expectedBonusId: selected.bonusId,
            expectedFirstTake: selected.firstTake,
          });
          if (result.ok && !effect.options?.skipRotate) {
            const rotated = tech.resolver.rotateForResearch(actionContext, 1);
            if (!rotated.ok) return rotated;
          }
        } else {
          result = tech.resolver.executeTakeTech(actionContext, takeOptions);
        }
        if (!result?.ok) return result;

        const spawnedEffects = [];
        const appendPick = (suffix) => {
          spawnedEffects.push(createSpawnedCardEffect({
            id: `${effect.id || "research-tech"}-${suffix}`,
            type: cardEffects.REWARD_TYPES.PICK_CARD,
            label: "科技奖励：精选 1 张牌",
            options: { count: 1 },
          }, actor.id, sessionEffect.payload?.cardInstanceId || null));
        };
        if (result.awaitingCardSelection) appendPick("pick");
        const after = effect.options?.afterResearchReward;
        if (after?.kind === "techTypeCountScore") {
          const count = Object.keys(actor.techState?.ownedTiles || {})
            .filter((tileId) => (
              actor.techState.ownedTiles[tileId]
              && tech.getTechType(tileId) === result.techType
            ))
            .length;
          players.gainResources(actor, { score: count * Math.max(0, Number(after.scorePer) || 0) });
        } else if (after?.kind === "resourceValueScore") {
          players.gainResources(actor, {
            score: Math.max(0, Number(actor.resources?.[after.resource]) || 0),
          });
        } else if (after?.kind === "publicityIfNotFirstTake" && !result.firstTake) {
          players.gainResources(actor, {
            publicity: Math.max(0, Number(after.publicity) || 0),
          });
        } else if (after?.kind === "repeatBonus" && !effect.options?.skipBonus) {
          const repeated = tech.resolver.applyTechBonus(actionContext, {
            bonusId: result.bonusId,
            firstTake: false,
          });
          if (!repeated.ok) return repeated;
          if (repeated.awaitingCardSelection) appendPick("repeat-pick");
        }
        return {
          ok: true,
          nextState: commitWorkingState(state, {
            source: cardEffects.EFFECT_TYPES.RESEARCH_TECH,
          }),
          spawnedEffects,
          irreversible: {
            code: "tech_bonus_reveal",
            reason: "拿取科技后露出下一张 bonus",
          },
          events: [{
            type: "card_effect",
            effectId: effect.id || null,
            effectType: effect.type,
            playerId: actor.id,
            tileId: result.tileId,
            techType: result.techType,
          }],
          history: [{
            type: "card_effect_decision",
            effectId: effect.id || null,
            effectType: effect.type,
            choiceId: legal.target.choiceId,
            tileId: result.tileId,
            executorId: EXECUTOR_ID,
          }],
        };
      },
    };
    runtime.registerExecutor(
      EFFECT_TYPES.RESEARCH_TECH_DECISION,
      researchTechDecisionExecutor,
    );

    runtime.registerExecutor(EFFECT_TYPES.LAUNCH, (state, sessionEffect, workingContext) => {
      const root = getWorkingRoot(state, workingContext);
      const effect = sessionEffect.payload?.cardEffect;
      const actor = getActor(root, sessionEffect.ownerId);
      if (!actor || effect?.type !== cardEffects.REWARD_TYPES.LAUNCH) {
        return fail("CARD_LAUNCH_CONTEXT_STALE", "卡牌发射上下文已失效");
      }
      const result = abilities.executeAbility(
        "launchProbe",
        createActionContext(root, actor.id),
        {
          ...(clone(effect.options || {})),
          skipCost: effect.options?.skipCost !== false,
          source: "card",
          historyLabel: effect.label,
        },
      );
      if (!result.ok) return result;
      return {
        ok: true,
        nextState: commitWorkingState(state, { source: effect.type }),
        events: clone(result.events || []),
        history: [{
          type: "card_effect",
          effectId: effect.id || null,
          effectType: effect.type,
          abilityId: result.abilityId,
          rocketId: result.rocket?.id || null,
          executorId: EXECUTOR_ID,
        }],
      };
    });

    runtime.registerExecutor(EFFECT_TYPES.DRAW_CARDS, (state, sessionEffect, workingContext) => {
      const root = getWorkingRoot(state, workingContext);
      const effect = sessionEffect.payload?.cardEffect;
      const actor = getActor(root, sessionEffect.ownerId);
      if (!actor || effect?.type !== cardEffects.REWARD_TYPES.DRAW_CARDS) {
        return fail("CARD_DRAW_CONTEXT_STALE", "卡牌盲抽上下文已失效");
      }
      const count = Math.max(0, Math.round(Number(effect.options?.count) || 0));
      const result = cards.drawCardsToHand(
        getSlice(root, "cardState", "cards"),
        getSlice(root, "playerState", "players"),
        actor,
        count,
        () => nextCommittedRandom(root),
        { createCardInstance: createCommittedCardFactory(root) },
      );
      if (!result.ok && !(result.cards || []).length) return result;
      return {
        ok: true,
        nextState: commitWorkingState(state, { source: effect.type }),
        irreversible: {
          code: "hidden_card_reveal",
          reason: "盲抽翻出新牌",
        },
        rng: [{
          owner: "card_play",
          effectId: effect.id || null,
          cursor: root.meta.rngState.cardPlay?.cursor || 0,
        }],
        events: [{
          type: "card_effect",
          effectId: effect.id || null,
          effectType: effect.type,
          playerId: actor.id,
          count: result.cards?.length || 0,
        }],
        history: [{
          type: "card_effect",
          effectId: effect.id || null,
          effectType: effect.type,
          cardInstanceIds: (result.cards || []).map((card) => card.id),
          executorId: EXECUTOR_ID,
        }],
      };
    });

    const pickCardExecutor = {
      getLegalChoices(state, sessionEffect, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const cardState = getSlice(root, "cardState", "cards");
        const choices = (cardState.publicCards || []).flatMap((card, slotIndex) => (
          card
            ? [{
              family: "choose_card",
              target: { choiceId: `public:${slotIndex}`, source: "public", slotIndex },
              payload: { cardInstanceId: card.id },
              summary: cards.getCardLabel(card),
            }]
            : []
        ));
        if (cards.getAvailablePool(
          cardState,
          getSlice(root, "playerState", "players"),
        ).length) {
          choices.push({
            family: "choose_card",
            target: { choiceId: "blind", source: "blind" },
            payload: {},
            summary: "盲抽 1 张牌",
          });
        }
        return choices;
      },
      resolveDecision(state, sessionEffect, choice, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const effect = sessionEffect.payload?.cardEffect;
        const actor = getActor(root, sessionEffect.ownerId);
        const legal = pickCardExecutor.getLegalChoices(state, sessionEffect, workingContext)
          .find((candidate) => candidate.target.choiceId === choice?.target?.choiceId);
        if (!actor || effect?.type !== cardEffects.REWARD_TYPES.PICK_CARD || !legal) {
          return fail("CARD_PICK_CHOICE_STALE", "精选卡牌选择已失效");
        }
        const cardState = getSlice(root, "cardState", "cards");
        const playerState = getSlice(root, "playerState", "players");
        const random = () => nextCommittedRandom(root);
        const factoryOptions = { createCardInstance: createCommittedCardFactory(root) };
        const result = legal.target.source === "public"
          ? cards.pickFromPublic(
            cardState,
            playerState,
            actor,
            legal.target.slotIndex,
            random,
            factoryOptions,
          )
          : cards.blindDraw(cardState, playerState, actor, random, factoryOptions);
        if (!result.ok) return result;
        return {
          ok: true,
          nextState: commitWorkingState(state, { source: effect.type }),
          irreversible: legal.target.source === "blind"
            ? { code: "hidden_card_reveal", reason: "盲抽翻出新牌" }
            : null,
          rng: [{
            owner: "card_play",
            effectId: effect.id || null,
            cursor: root.meta.rngState.cardPlay?.cursor || 0,
          }],
          events: [{
            type: "card_effect",
            effectId: effect.id || null,
            effectType: effect.type,
            playerId: actor.id,
            cardInstanceId: result.card.id,
            source: legal.target.source,
          }],
          history: [{
            type: "card_effect_decision",
            effectId: effect.id || null,
            effectType: effect.type,
            choiceId: legal.target.choiceId,
            cardInstanceId: result.card.id,
            executorId: EXECUTOR_ID,
          }],
        };
      },
    };
    runtime.registerExecutor(EFFECT_TYPES.PICK_CARD, pickCardExecutor);
    runtime.registerExecutor(EFFECT_TYPES.PICK_CARD_START, (
      state,
      sessionEffect,
      workingContext,
    ) => {
      const root = getWorkingRoot(state, workingContext);
      const choices = pickCardExecutor.getLegalChoices(state, sessionEffect, workingContext);
      return {
        ...cardEffectResult(state, root, sessionEffect, {
          event: choices.length
            ? { awaitingDecision: true, legalChoiceCount: choices.length }
            : { skipped: true, reason: "no_available_target" },
        }),
        spawnedEffects: choices.length
          ? [{
            priority: "direct",
            effect: {
              type: EFFECT_TYPES.PICK_CARD,
              kind: "decision",
              decisionKind: "choose_card",
              ownerId: sessionEffect.ownerId,
              payload: clone(sessionEffect.payload),
            },
          }]
          : [],
      };
    });

    runtime.registerExecutor(EFFECT_TYPES.FIXED_NEBULA_SCAN, (
      state,
      sessionEffect,
      workingContext,
    ) => {
      const root = getWorkingRoot(state, workingContext);
      const effect = sessionEffect.payload?.cardEffect;
      const actor = getActor(root, sessionEffect.ownerId);
      if (!actor || effect?.type !== cardEffects.EFFECT_TYPES.SCAN_NEBULA) {
        return fail("CARD_SCAN_CONTEXT_STALE", "固定星云扫描上下文已失效");
      }
      const result = abilities.executeAbility("scanNebula", createActionContext(root, actor.id), {
        nebulaId: effect.options?.nebulaId,
        gainData: effect.options?.gainData,
        source: "card",
        prefix: effect.label,
      });
      if (!result.ok) return result;
      return {
        ok: true,
        nextState: commitWorkingState(state, { source: effect.type }),
        events: clone(result.events || []),
        history: [{
          type: "card_effect",
          effectId: effect.id || null,
          effectType: effect.type,
          abilityId: result.abilityId,
          executorId: EXECUTOR_ID,
        }],
      };
    });

    const colorDecisionExecutor = {
      getLegalChoices(state, sessionEffect, workingContext) {
        const effect = sessionEffect.payload?.cardEffect;
        return (cardEffects.NEBULA_IDS_BY_COLOR[effect?.options?.color] || []).map((nebulaId) => ({
          family: "choose_target",
          target: { choiceId: nebulaId, nebulaId },
          payload: { gainData: effect.options?.gainData !== false },
          summary: `扫描 ${nebulaId}`,
        }));
      },
      resolveDecision(state, sessionEffect, choice, workingContext) {
        const root = getWorkingRoot(state, workingContext);
        const effect = sessionEffect.payload?.cardEffect;
        const actor = getActor(root, sessionEffect.ownerId);
        const legal = colorDecisionExecutor.getLegalChoices(state, sessionEffect, workingContext)
          .some((candidate) => candidate.target.nebulaId === choice?.target?.nebulaId);
        if (!actor || !legal) return fail("CARD_SCAN_CHOICE_STALE", "星云扫描选择已失效");
        const result = abilities.executeAbility("scanNebula", createActionContext(root, actor.id), {
          nebulaId: choice.target.nebulaId,
          gainData: effect.options?.gainData,
          source: "card",
          prefix: effect.label,
        });
        if (!result.ok) return result;
        return {
          ok: true,
          nextState: commitWorkingState(state, { source: effect.type }),
          events: clone(result.events || []),
          history: [{
            type: "card_effect_decision",
            effectId: effect.id || null,
            effectType: effect.type,
            choiceId: choice.target.nebulaId,
            executorId: EXECUTOR_ID,
          }],
        };
      },
    };
    runtime.registerExecutor(EFFECT_TYPES.COLOR_NEBULA_SCAN, colorDecisionExecutor);

    function cardEffectResult(state, root, sessionEffect, extra = {}) {
      const effect = sessionEffect.payload?.cardEffect;
      return {
        ok: true,
        nextState: commitWorkingState(state, { source: effect?.type || EFFECT_TYPES.EFFECT }),
        events: [{
          type: "card_effect",
          effectId: effect?.id || null,
          effectType: effect?.type || null,
          playerId: sessionEffect.ownerId || null,
          ...(extra.event || {}),
        }, ...(extra.events || [])],
        history: [{
          type: extra.historyType || "card_effect",
          effectId: effect?.id || null,
          effectType: effect?.type || null,
          executorId: EXECUTOR_ID,
          ...(extra.history || {}),
        }],
        spawnedEffects: extra.spawnedEffects || [],
        irreversible: extra.irreversible || null,
        rng: extra.rng || [],
      };
    }

    function makeChoice(family, choiceId, target = {}, payload = {}, summary = choiceId) {
      return {
        family,
        target: { choiceId, ...target },
        payload: clone(payload),
        summary,
      };
    }

    function spawnCardEffects(effects, sessionEffect) {
      return (effects || []).map((effect) => createSpawnedCardEffect(
        effect,
        sessionEffect.ownerId,
        sessionEffect.payload?.cardInstanceId || null,
      ));
    }

    function listPlayerRockets(root, ownerId, options = {}) {
      const all = getSlice(root, "rocketState", "pieces").rockets || [];
      return all.filter((rocket) => (
        options.owner === "any" || rocket.playerId === ownerId
      ));
    }

    function listMoveChoices(root, sessionEffect) {
      const actor = getActor(root, sessionEffect.ownerId);
      if (!actor) return [];
      const context = createActionContext(root, actor.id);
      const remaining = Math.max(
        1,
        Math.round(Number(
          sessionEffect.payload?.remaining
          ?? sessionEffect.payload?.cardEffect?.options?.movementPoints
          ?? 1
        ) || 1),
      );
      const choices = [];
      for (const rocket of listPlayerRockets(root, actor.id)) {
        for (const direction of abilities.rocket.listMoveRequirements(
          context,
          actor,
          rocket.id,
          { ignoreAsteroidRestriction: false },
        )) {
          if (direction.requiredMovePoints > remaining) continue;
          choices.push(makeChoice(
            "choose_target",
            `${rocket.id}:${direction.deltaX}:${direction.deltaY}`,
            {
              rocketId: rocket.id,
              deltaX: direction.deltaX,
              deltaY: direction.deltaY,
            },
            { requiredMovePoints: direction.requiredMovePoints, remaining },
            `R${rocket.id} ${direction.label || `${direction.deltaX},${direction.deltaY}`}`,
          ));
        }
      }
      choices.push(makeChoice("choose_target", "skip", { skip: true }, { remaining }, "结束移动"));
      return choices;
    }

    function resolveMove(state, sessionEffect, choice, workingContext) {
      const root = getWorkingRoot(state, workingContext);
      const legal = listMoveChoices(root, sessionEffect)
        .find((candidate) => candidate.target.choiceId === choice?.target?.choiceId);
      if (!legal) return fail("CARD_MOVE_CHOICE_STALE", "卡牌移动选择已失效");
      if (legal.target.skip) {
        return cardEffectResult(state, root, sessionEffect, {
          historyType: "card_effect_decision",
          history: { choiceId: "skip" },
          event: { skipped: true },
        });
      }
      const actor = getActor(root, sessionEffect.ownerId);
      const result = abilities.executeAbility("moveProbe", createActionContext(root, actor.id), {
        rocketId: legal.target.rocketId,
        deltaX: legal.target.deltaX,
        deltaY: legal.target.deltaY,
        movementPoints: legal.payload.requiredMovePoints,
        skipCost: true,
        cost: {},
        source: "card",
      });
      if (!result.ok) return result;
      const remaining = Math.max(
        0,
        legal.payload.remaining - legal.payload.requiredMovePoints,
      );
      const spawnedEffects = remaining > 0
        ? [{
          priority: "direct",
          effect: {
            type: genericEffectRuntimeType(sessionEffect.payload.cardEffect.type, true),
            kind: "decision",
            decisionKind: "choose_target",
            ownerId: actor.id,
            payload: { ...clone(sessionEffect.payload), remaining },
          },
        }]
        : [];
      return cardEffectResult(state, root, sessionEffect, {
        spawnedEffects,
        events: result.events || [],
        historyType: "card_effect_decision",
        history: {
          choiceId: legal.target.choiceId,
          remaining,
          abilityId: result.abilityId,
        },
      });
    }

    function getNebulaSectorX(root, nebulaId) {
      const locations = solar.createSolarSnapshot(
        getSlice(root, "solarState", "solarSystem"),
      ).nebulaLocations || {};
      const location = Array.isArray(locations)
        ? locations.find((entry) => entry.id === nebulaId)
        : locations[nebulaId] || null;
      return location?.x == null ? null : solar.mod8(Number(location.x));
    }

    function listScannableNebulaChoices(root, nebulaIds, options = {}) {
      const unique = [...new Set((nebulaIds || []).filter(Boolean))];
      return unique
        .filter((nebulaId) => (
          (data.listNebulaTokens?.(
            getSlice(root, "nebulaDataState", "data"),
            nebulaId,
          ) || []).length > 0
        ))
        .map((nebulaId) => makeChoice(
          "choose_target",
          nebulaId,
          { nebulaId, sectorX: getNebulaSectorX(root, nebulaId) },
          { gainData: options.gainData !== false },
          `扫描 ${data.getNebulaLabel?.(nebulaId) || nebulaId}`,
        ));
    }

    function resolveNebulaScan(state, sessionEffect, choice, workingContext) {
      const root = getWorkingRoot(state, workingContext);
      const legal = listGenericChoices(root, sessionEffect)
        .find((candidate) => candidate.target.choiceId === choice?.target?.choiceId);
      if (!legal) return fail("CARD_SCAN_CHOICE_STALE", "卡牌扫描选择已失效");
      if (legal.target.skip) {
        const drawnCardId = sessionEffect.payload?.drawnCardId;
        if (drawnCardId && sessionEffect.payload?.cardEffect?.options?.discardDrawnOnSkip) {
          const actor = getActor(root, sessionEffect.ownerId);
          const index = actor.hand.findIndex((card) => card.id === drawnCardId);
          if (index >= 0) {
            const removed = cards.discardFromHandAtIndex(actor, index);
            cards.addToDiscardPile(getSlice(root, "cardState", "cards"), removed.card);
          }
        }
        return cardEffectResult(state, root, sessionEffect, {
          event: { skipped: true },
          historyType: "card_effect_decision",
          history: { choiceId: "skip" },
        });
      }
      const actor = getActor(root, sessionEffect.ownerId);
      const result = abilities.executeAbility("scanNebula", createActionContext(root, actor.id), {
        nebulaId: legal.target.nebulaId,
        gainData: legal.payload?.gainData !== false,
        source: "card",
        prefix: sessionEffect.payload.cardEffect.label,
      });
      if (!result.ok) return result;
      const drawnCardId = sessionEffect.payload?.drawnCardId;
      if (drawnCardId) {
        const index = actor.hand.findIndex((card) => card.id === drawnCardId);
        if (index >= 0) {
          const removed = cards.discardFromHandAtIndex(actor, index);
          cards.addToDiscardPile(getSlice(root, "cardState", "cards"), removed.card);
        }
      }
      return cardEffectResult(state, root, sessionEffect, {
        events: result.events || [],
        historyType: "card_effect_decision",
        history: { choiceId: legal.target.choiceId, abilityId: result.abilityId },
      });
    }

    function listPlanetChoices(root, sessionEffect, actionType) {
      const actor = getActor(root, sessionEffect.ownerId);
      if (!actor) return [];
      const context = createActionContext(root, actor.id);
      const effectOptions = sessionEffect.payload?.cardEffect?.options || {};
      const placements = actionShared.listPlayerRocketPlanetPlacements(context, {
        currentPlayer: actor,
      });
      const options = {
        ...clone(effectOptions),
        skipCost: effectOptions.skipCost !== false,
        cost: effectOptions.skipCost === false ? undefined : {},
        source: "card",
      };
      const requirements = placements.flatMap((placement) => (
        actionType === "orbit"
          ? abilities.planet.listOrbitRequirementsAt(context, placement, options)
          : abilities.planet.listLandRequirementsAt(context, placement, options)
      ));
      return requirements.map((entry) => {
        const target = entry.target || {};
        const choiceId = [
          actionType,
          entry.rocketId,
          entry.planetId,
          target.type || "planet",
          target.satelliteId || "",
        ].join(":");
        return makeChoice(
          "choose_target",
          choiceId,
          {
            actionType,
            rocketId: entry.rocketId,
            planetId: entry.planetId,
            landTarget: target,
          },
          { options },
          entry.label || `${actionType} ${entry.planetId}`,
        );
      });
    }

    function resolvePlanet(state, sessionEffect, choice, workingContext, actionType) {
      const root = getWorkingRoot(state, workingContext);
      const legal = listPlanetChoices(root, sessionEffect, actionType)
        .find((candidate) => candidate.target.choiceId === choice?.target?.choiceId);
      if (!legal) return fail("CARD_PLANET_CHOICE_STALE", "卡牌行星选择已失效");
      const actor = getActor(root, sessionEffect.ownerId);
      const result = abilities.executeAbility(
        actionType === "orbit" ? "orbitProbe" : "landProbe",
        createActionContext(root, actor.id),
        {
          ...legal.payload.options,
          rocketId: legal.target.rocketId,
          target: legal.target.landTarget,
          landTarget: legal.target.landTarget,
        },
      );
      if (!result.ok) return result;
      const effect = sessionEffect.payload.cardEffect;
      const spawnedEffects = [];
      if (actionType === "land") {
        const reward = (effect.options?.afterLandRewards || []).find((entry) => (
          (entry.planetIds || []).includes(result.planetId)
          && (entry.includeSatellites || result.markerKind !== "satellite")
        ));
        if (reward?.effect) spawnedEffects.push(...spawnCardEffects([reward.effect], sessionEffect));
        if (effect.options?.rememberPreLandingMarker || effect.options?.rememberPreLandingOwnMarker) {
          root.match.cardPlayContext = {
            ...(root.match.cardPlayContext || {}),
            lastLanding: {
              planetId: result.planetId,
              hadAnyMarker: Boolean(
                effect.options.rememberPreLandingMarker
                || effect.options.rememberPreLandingOwnMarker
              ),
            },
          };
        }
      }
      return cardEffectResult(state, root, sessionEffect, {
        spawnedEffects,
        events: result.events || [],
        historyType: "card_effect_decision",
        history: {
          choiceId: legal.target.choiceId,
          abilityId: result.abilityId,
          planetId: result.planetId,
        },
      });
    }

    function listCardChoices(cardsToList, family = "choose_card", extra = {}) {
      return (cardsToList || []).map((card, index) => makeChoice(
        family,
        card.id,
        { cardInstanceId: card.id, index, ...extra },
        {},
        cards.getCardLabel(card),
      ));
    }

    function cornerEffects(card, repeat = 1) {
      const reward = cards.getDiscardActionRewardForCard(card);
      const moveReward = cards.getDiscardActionMoveRewardForCard(card);
      const effects = [];
      for (let index = 0; index < Math.max(1, repeat); index += 1) {
        if (reward?.gain) effects.push({
          id: `corner:${card.id}:${index}:reward`,
          type: cardEffects.REWARD_TYPES.GAIN_RESOURCES,
          label: "卡牌角标奖励",
          options: { gain: clone(reward.gain) },
        });
        if (moveReward?.movementPoints) effects.push({
          id: `corner:${card.id}:${index}:move`,
          type: cardEffects.EFFECT_TYPES.CARD_MOVE,
          label: "卡牌角标移动",
          options: { movementPoints: moveReward.movementPoints },
        });
      }
      return effects;
    }

    function countSignalsInSector(root, actor, sectorX) {
      return Object.keys(cardEffects.NEBULA_IDS_BY_COLOR)
        .flatMap((color) => cardEffects.NEBULA_IDS_BY_COLOR[color])
        .filter((nebulaId) => getNebulaSectorX(root, nebulaId) === solar.mod8(sectorX))
        .reduce((count, nebulaId) => count + (
          data.listNebulaTokens(getSlice(root, "nebulaDataState", "data"), nebulaId)
            .filter((token) => (
              token.replacedByPlayerId === actor.id
              || token.replacedByPlayerColor === actor.color
            )).length
        ), 0);
    }

    function conditionMet(root, actor, condition) {
      return cardEffects.taskConditionMet(
        { condition },
        actor,
        {
          ...createActionContext(root, actor.id),
          dataTotals: {
            [actor.id]: Number(actor.resources?.availableData) || 0,
            [actor.color]: Number(actor.resources?.availableData) || 0,
          },
        },
      );
    }

    function getSpeciesTraceApi(slot) {
      const byId = {
        "九折": ["jiuzhe", "canPlaceJiuzheTrace", "placeJiuzheTrace"],
        "异常点": ["yichangdian", "canPlaceYichangdianTrace", "placeYichangdianTrace"],
        "方舟": ["fangzhou", "canPlaceFangzhouTrace", "placeFangzhouTrace"],
        "半人马": ["banrenma", "canPlaceBanrenmaTrace", "placeBanrenmaTrace"],
        "虫": ["chong", "canPlaceChongTrace", "placeChongTrace"],
        "阿米巴": ["amiba", "canPlaceAmibaTrace", "placeAmibaTrace"],
        "奥陌陌": ["aomomo", "canPlaceAomomoTrace", "placeAomomoTrace"],
        "符文族": ["runezu", "canPlaceRunezuTrace", "placeRunezuTrace"],
      };
      const descriptor = byId[slot?.alienId || slot?.assignedAlienId];
      if (!descriptor) return null;
      const [speciesId, canMethod, placeMethod] = descriptor;
      const api = aliens[speciesId];
      return api ? { speciesId, api, canMethod, placeMethod } : null;
    }

    function listSpeciesTraceChoices(alienState, alienSlotId, traceType, actor) {
      const slot = aliens.getAlienSlot(alienState, alienSlotId);
      const species = getSpeciesTraceApi(slot);
      if (!slot?.revealed || !species) return [];
      const positions = species.api.TRACE_POSITIONS
        || species.api.getPositionsForTraceType?.(traceType)
        || [];
      return positions.flatMap((position) => {
        const check = species.api[species.canMethod]?.(
          alienState,
          alienSlotId,
          traceType,
          position,
          actor,
          {},
        );
        return check?.ok
          ? [makeChoice(
            "choose_target",
            `${alienSlotId}:${traceType}:${species.speciesId}:${position}`,
            { alienSlotId, traceType, speciesId: species.speciesId, position },
            {},
            `${aliens.getAlienSlotLabel(alienSlotId)} ${aliens.getTraceTypeLabel(traceType)} ${position}`,
          )]
          : [];
      });
    }

    function genericExecute(state, sessionEffect, workingContext) {
      const root = getWorkingRoot(state, workingContext);
      const effect = sessionEffect.payload?.cardEffect;
      const actor = getActor(root, sessionEffect.ownerId);
      const options = effect?.options || {};
      if (!actor || !GENERIC_EFFECT_DESCRIPTORS[effect?.type]) {
        return fail("CARD_EFFECT_CONTEXT_STALE", "卡牌效果上下文已失效");
      }
      const descriptor = GENERIC_EFFECT_DESCRIPTORS[effect.type];
      if (descriptor.decisionKind) {
        const choices = listGenericChoices(root, sessionEffect);
        if (!choices.length) {
          return cardEffectResult(state, root, sessionEffect, {
            event: { skipped: true, reason: "no_available_target" },
            history: { skipped: true, reason: "no_available_target" },
          });
        }
        return cardEffectResult(state, root, sessionEffect, {
          spawnedEffects: [{
            priority: "direct",
            effect: {
              type: genericEffectRuntimeType(effect.type, true),
              kind: "decision",
              decisionKind: descriptor.decisionKind,
              ownerId: actor.id,
              payload: clone(sessionEffect.payload),
            },
          }],
          event: { awaitingDecision: true, legalChoiceCount: choices.length },
        });
      }
      let spawnedEffects = [];
      const event = {};
      if (effect.type === cardEffects.EFFECT_TYPES.CONDITIONAL_REWARD) {
        const met = conditionMet(root, actor, options.condition);
        if (met) spawnedEffects = spawnCardEffects(options.rewards, sessionEffect);
        event.conditionMet = met;
        event.skipped = !met;
      } else if (effect.type === cardEffects.EFFECT_TYPES.PROBE_STACK_REWARD) {
        const match = cardEffects.getProbeStackRewardMatch(
          getSlice(root, "rocketState", "pieces").rockets || [],
          actor,
          options,
        );
        if (match.conditionMet) spawnedEffects = spawnCardEffects(options.rewards, sessionEffect);
        event.conditionMet = Boolean(match.conditionMet);
        event.skipped = !match.conditionMet;
      } else if (effect.type === cardEffects.EFFECT_TYPES.COUNT_ROCKETS_REWARD) {
        const count = cardEffects.countRocketsForReward(
          getSlice(root, "rocketState", "pieces").rockets || [],
          actor,
          options,
        );
        const amount = Math.max(0, Math.round(count * Number(options.per || 1)));
        if (amount > 0) {
          if (options.resource === "data") {
            for (let index = 0; index < amount; index += 1) {
              data.gainData(actor, { source: "count_rockets_reward", root });
            }
          } else {
            players.gainResources(actor, { [options.resource || "score"]: amount });
          }
        }
        event.count = count;
        event.amount = amount;
      } else if (effect.type === cardEffects.EFFECT_TYPES.REGISTER_EVENT_BONUS) {
        if (!Array.isArray(root.match.cardTurnEventBonuses)) {
          root.match.cardTurnEventBonuses = [];
        }
        root.match.cardTurnEventBonuses.push({
          effectId: effect.id,
          ownerId: actor.id,
          event: clone(options.event || {}),
          reward: clone(options.reward || null),
          duration: options.duration || "flow",
          usedKeys: [],
        });
      } else if (effect.type === cardEffects.EFFECT_TYPES.RETURN_PLAYED_CARD_TO_HAND_IF) {
        const met = options.condition?.type === "lastLandingHadAnyMarker"
          ? Boolean(root.match.cardPlayContext?.lastLanding?.hadAnyMarker)
          : conditionMet(root, actor, options.condition);
        if (met) {
          const cardState = getSlice(root, "cardState", "cards");
          const cardId = sessionEffect.payload.cardInstanceId;
          let source = cardState.discardPile || [];
          let index = source.findIndex((card) => card.id === cardId);
          if (index < 0) {
            source = actor.reservedCards || [];
            index = source.findIndex((card) => card.id === cardId);
          }
          if (index >= 0) {
            const [card] = source.splice(index, 1);
            actor.hand.push(card);
            actor.resources.handSize = actor.hand.length;
          }
        }
        event.conditionMet = met;
      } else if (effect.type === cardEffects.EFFECT_TYPES.DRAW_THEN_SCAN) {
        const cardState = getSlice(root, "cardState", "cards");
        const draw = cards.blindDraw(
          cardState,
          getSlice(root, "playerState", "players"),
          actor,
          () => nextCommittedRandom(root),
          { createCardInstance: createCommittedCardFactory(root) },
        );
        if (!draw.ok) return draw;
        const scanCode = Number(
          draw.card.scanActionCode
          ?? cards.getCatalogEntryForCard(draw.card)?.scan_action_code,
        );
        const byCode = [
          cardEffects.NEBULA_IDS_BY_COLOR.yellow,
          cardEffects.NEBULA_IDS_BY_COLOR.red,
          cardEffects.NEBULA_IDS_BY_COLOR.blue,
          cardEffects.NEBULA_IDS_BY_COLOR.black,
        ];
        const nebulaIds = byCode[scanCode] || [];
        spawnedEffects = [{
          priority: "direct",
          effect: {
            type: genericEffectRuntimeType(cardEffects.EFFECT_TYPES.DRAW_THEN_SCAN, true),
            kind: "decision",
            decisionKind: "choose_target",
            ownerId: actor.id,
            payload: {
              ...clone(sessionEffect.payload),
              drawnCardId: draw.card.id,
              scanNebulaIds: clone(nebulaIds),
              drawCompleted: true,
            },
          },
        }];
        event.drawnCardId = draw.card.id;
        event.scanCode = scanCode;
        return cardEffectResult(state, root, sessionEffect, {
          spawnedEffects,
          event,
          irreversible: { code: "hidden_card_reveal", reason: "盲抽翻出新牌" },
          rng: [{
            owner: "card_play",
            effectId: effect.id || null,
            cursor: root.meta.rngState.cardPlay?.cursor || 0,
          }],
        });
      } else {
        return fail("CARD_EFFECT_EXECUTOR_INCOMPLETE", `未实现卡牌效果 ${effect.type}`);
      }
      return cardEffectResult(state, root, sessionEffect, { spawnedEffects, event });
    }

    function listGenericChoices(root, sessionEffect) {
      const effect = sessionEffect.payload?.cardEffect;
      const actor = getActor(root, sessionEffect.ownerId);
      const options = effect?.options || {};
      if (!actor) return [];
      if (effect.type === cardEffects.EFFECT_TYPES.ANY_SECTOR_SCAN) {
        return listScannableNebulaChoices(
          root,
          Object.values(cardEffects.NEBULA_IDS_BY_COLOR).flat(),
          options,
        );
      }
      if (effect.type === cardEffects.EFFECT_TYPES.CONDITIONAL_SECTOR_SCAN) {
        const sectorXs = [...new Set(Object.values(cardEffects.NEBULA_IDS_BY_COLOR)
          .flat().map((nebulaId) => getNebulaSectorX(root, nebulaId)).filter((x) => x != null))];
        const matching = cardEffects.getMatchingConditionalSectorXs(
          options.condition,
          sectorXs,
          (sectorX) => countSignalsInSector(root, actor, sectorX),
        );
        const ids = Object.values(cardEffects.NEBULA_IDS_BY_COLOR).flat()
          .filter((nebulaId) => matching.includes(getNebulaSectorX(root, nebulaId)));
        return listScannableNebulaChoices(root, ids, options);
      }
      if (effect.type === cardEffects.EFFECT_TYPES.PLANET_SECTOR_SCAN) {
        const x = solar.createSolarSnapshot(
          getSlice(root, "solarState", "solarSystem"),
        ).planetLocations?.find((planet) => planet.planetId === options.planetId)?.x;
        const ids = Object.values(cardEffects.NEBULA_IDS_BY_COLOR).flat()
          .filter((nebulaId) => getNebulaSectorX(root, nebulaId) === solar.mod8(x));
        return listScannableNebulaChoices(root, ids, options);
      }
      if (effect.type === cardEffects.EFFECT_TYPES.LANDING_SECTOR_SCAN) {
        const planetId = root.match.cardPlayContext?.lastLanding?.planetId;
        const x = solar.createSolarSnapshot(
          getSlice(root, "solarState", "solarSystem"),
        ).planetLocations?.find((planet) => planet.planetId === planetId)?.x;
        const ids = Object.values(cardEffects.NEBULA_IDS_BY_COLOR).flat()
          .filter((nebulaId) => getNebulaSectorX(root, nebulaId) === solar.mod8(x));
        return listScannableNebulaChoices(root, ids, options);
      }
      if (effect.type === cardEffects.EFFECT_TYPES.PROBE_SECTOR_SCAN) {
        const ids = [];
        for (const rocket of listPlayerRockets(root, actor.id, options)) {
          for (const nebulaId of Object.values(cardEffects.NEBULA_IDS_BY_COLOR).flat()) {
            const x = getNebulaSectorX(root, nebulaId);
            const distance = Math.min(
              solar.mod8(x - rocket.sectorX),
              solar.mod8(rocket.sectorX - x),
            );
            if (distance === 0 || (options.includeAdjacent && distance === 1)) ids.push(nebulaId);
          }
        }
        return listScannableNebulaChoices(root, ids, options);
      }
      if (effect.type === cardEffects.EFFECT_TYPES.SCAN_ACTION) {
        return listScannableNebulaChoices(
          root,
          Object.values(cardEffects.NEBULA_IDS_BY_COLOR).flat(),
          { gainData: true },
        );
      }
      if (effect.type === cardEffects.EFFECT_TYPES.DRAW_THEN_SCAN) {
        const choices = listScannableNebulaChoices(
          root,
          sessionEffect.payload?.scanNebulaIds || [],
          { gainData: true },
        );
        if (options.discardDrawnOnSkip) {
          choices.push(makeChoice("choose_target", "skip", { skip: true }, {}, "跳过并弃牌"));
        }
        return choices;
      }
      if ([
        cardEffects.EFFECT_TYPES.CARD_MOVE,
        cardEffects.EFFECT_TYPES.COUNT_HAND_CORNER_MOVE,
        cardEffects.EFFECT_TYPES.EARTH_SECTOR_CONTENT_MOVE,
      ].includes(effect.type)) return listMoveChoices(root, sessionEffect);
      if (effect.type === cardEffects.EFFECT_TYPES.CARD_ORBIT) {
        return listPlanetChoices(root, sessionEffect, "orbit");
      }
      if (effect.type === cardEffects.EFFECT_TYPES.CARD_LAND) {
        return listPlanetChoices(root, sessionEffect, "land");
      }
      if (effect.type === cardEffects.EFFECT_TYPES.CHOOSE_HAND_CORNER_REWARD) {
        return listCardChoices(actor.hand);
      }
      if (effect.type === cardEffects.EFFECT_TYPES.DISCARD_ANY_FOR_INCOME) {
        return [
          ...listCardChoices(actor.hand),
          makeChoice("choose_card", "done", { done: true }, {}, "完成弃牌"),
        ];
      }
      if (effect.type === cardEffects.EFFECT_TYPES.DISCARD_CARD_CORNER_REPEAT) {
        return listCardChoices((actor.hand || []).filter((card) => (
          !options.excludeAlienCards || !String(card.cardId || "").startsWith("alien")
        )));
      }
      if (effect.type === cardEffects.EFFECT_TYPES.DISCARD_PUBLIC_CORNER_REWARDS) {
        return listCardChoices(
          getSlice(root, "cardState", "cards").publicCards || [],
        );
      }
      if ([
        cardEffects.EFFECT_TYPES.HAND_SCAN,
        cardEffects.EFFECT_TYPES.OPTIONAL_DISCARD_SCAN,
      ].includes(effect.type)) {
        return [
          ...listCardChoices(actor.hand),
          makeChoice("choose_card", "skip", { skip: true }, {}, "跳过"),
        ];
      }
      if (effect.type === cardEffects.EFFECT_TYPES.PAY_CREDITS_FOR_REWARD) {
        const choices = [makeChoice("choose_reward", "skip", { skip: true }, {}, "停止支付")];
        if ((Number(actor.resources?.credits) || 0) >= 1) {
          choices.unshift(makeChoice("choose_reward", "pay", { pay: true }, {}, "支付1信用"));
        }
        return choices;
      }
      if (effect.type === cardEffects.EFFECT_TYPES.PICK_CARD_CORNER_REWARD) {
        const cardState = getSlice(root, "cardState", "cards");
        return listCardChoices(cardState.publicCards || []);
      }
      if (effect.type === cardEffects.EFFECT_TYPES.PUBLIC_SCAN) {
        return listCardChoices(getSlice(root, "cardState", "cards").publicCards || []);
      }
      if (effect.type === cardEffects.EFFECT_TYPES.RETURN_UNFINISHED_TASK_TO_HAND) {
        return listCardChoices((actor.reservedCards || []).filter((card) => (
          card.id !== sessionEffect.payload.cardInstanceId
          && cardEffects.isReturnUnfinishedTaskTarget(card, options)
        )));
      }
      if (effect.type === cardEffects.EFFECT_TYPES.REMOVE_PLANET_MARKER) {
        const choices = [];
        for (const planetId of Object.keys(
          getSlice(root, "planetStatsState", "planets").planets || {},
        )) {
          for (const kind of ["orbit", "land"]) {
            const markers = kind === "orbit"
              ? planetStats.getPlanetOrbitMarkers(
                getSlice(root, "planetStatsState", "planets"),
                planetId,
              )
              : planetStats.getPlanetLandingMarkers(
                getSlice(root, "planetStatsState", "planets"),
                planetId,
              );
            markers.forEach((marker, index) => {
              if (marker.playerId === actor.id || marker.playerColor === actor.color) {
                choices.push(makeChoice(
                  "choose_target",
                  `${planetId}:${kind}:${index}`,
                  { planetId, kind, index },
                  {},
                  `移除 ${planetId} ${kind}`,
                ));
              }
            });
          }
        }
        return choices;
      }
      if (effect.type === cardEffects.EFFECT_TYPES.REMOVE_ORBIT_TO_PROBE) {
        return listGenericChoices(root, {
          ...sessionEffect,
          payload: {
            ...sessionEffect.payload,
            cardEffect: {
              ...effect,
              type: cardEffects.EFFECT_TYPES.REMOVE_PLANET_MARKER,
            },
          },
        }).filter((choice) => choice.target.kind === "orbit");
      }
      if (effect.type === cardEffects.EFFECT_TYPES.PROBE_LOCATION_REWARD) {
        return listPlayerRockets(root, actor.id)
          .map((rocket) => makeChoice(
            "choose_target",
            String(rocket.id),
            { rocketId: rocket.id },
            {},
            `R${rocket.id}`,
          ));
      }
      if (effect.type === cardEffects.REWARD_TYPES.ALIEN_TRACE) {
        const choices = [];
        const allowed = options.allowedTraceTypes || aliens.TRACE_TYPES;
        const alienState = getSlice(root, "alienGameState", "aliens");
        for (const alienSlotId of aliens.ALIEN_SLOT_IDS || []) {
          const slot = aliens.getAlienSlot(alienState, alienSlotId);
          for (const traceType of allowed) {
            if (slot?.revealed) {
              choices.push(...listSpeciesTraceChoices(
                alienState,
                alienSlotId,
                traceType,
                actor,
              ));
            } else if (slot) {
              choices.push(makeChoice(
                "choose_target",
                `${alienSlotId}:${traceType}`,
                { alienSlotId, traceType },
                {},
                `${aliens.getAlienSlotLabel(alienSlotId)} ${aliens.getTraceTypeLabel(traceType)}`,
              ));
            }
          }
        }
        return choices;
      }
      return [];
    }

    function genericResolve(state, sessionEffect, choice, workingContext) {
      const root = getWorkingRoot(state, workingContext);
      const effect = sessionEffect.payload?.cardEffect;
      const actor = getActor(root, sessionEffect.ownerId);
      const options = effect?.options || {};
      const legal = listGenericChoices(root, sessionEffect)
        .find((candidate) => candidate.target.choiceId === choice?.target?.choiceId);
      if (!actor || !legal) return fail("CARD_EFFECT_CHOICE_STALE", "卡牌效果选择已失效");
      if ([
        cardEffects.EFFECT_TYPES.ANY_SECTOR_SCAN,
        cardEffects.EFFECT_TYPES.CONDITIONAL_SECTOR_SCAN,
        cardEffects.EFFECT_TYPES.PLANET_SECTOR_SCAN,
        cardEffects.EFFECT_TYPES.LANDING_SECTOR_SCAN,
        cardEffects.EFFECT_TYPES.PROBE_SECTOR_SCAN,
        cardEffects.EFFECT_TYPES.SCAN_ACTION,
        cardEffects.EFFECT_TYPES.DRAW_THEN_SCAN,
      ].includes(effect.type)) return resolveNebulaScan(state, sessionEffect, choice, workingContext);
      if ([
        cardEffects.EFFECT_TYPES.CARD_MOVE,
        cardEffects.EFFECT_TYPES.COUNT_HAND_CORNER_MOVE,
        cardEffects.EFFECT_TYPES.EARTH_SECTOR_CONTENT_MOVE,
      ].includes(effect.type)) return resolveMove(state, sessionEffect, choice, workingContext);
      if (effect.type === cardEffects.EFFECT_TYPES.CARD_ORBIT) {
        return resolvePlanet(state, sessionEffect, choice, workingContext, "orbit");
      }
      if (effect.type === cardEffects.EFFECT_TYPES.CARD_LAND) {
        return resolvePlanet(state, sessionEffect, choice, workingContext, "land");
      }
      const cardState = getSlice(root, "cardState", "cards");
      let spawnedEffects = [];
      let irreversible = null;
      const event = { choiceId: legal.target.choiceId };
      if (effect.type === cardEffects.EFFECT_TYPES.CHOOSE_HAND_CORNER_REWARD) {
        const card = actor.hand.find((entry) => entry.id === legal.target.cardInstanceId);
        spawnedEffects = spawnCardEffects(cornerEffects(card), sessionEffect);
      } else if (effect.type === cardEffects.EFFECT_TYPES.DISCARD_ANY_FOR_INCOME) {
        if (!legal.target.done) {
          const index = actor.hand.findIndex((entry) => entry.id === legal.target.cardInstanceId);
          const removed = cards.discardFromHandAtIndex(actor, index);
          if (!removed.ok) return removed;
          cards.addToDiscardPile(cardState, removed.card);
          const gain = cards.getIncomeGainForCard(removed.card);
          if (gain) players.gainIncome(actor, gain, {
            blindDraw: (target) => cards.blindDraw(
              cardState,
              getSlice(root, "playerState", "players"),
              target,
              () => nextCommittedRandom(root),
              { createCardInstance: createCommittedCardFactory(root) },
            ),
            gainData: (target) => data.gainData(target, { source: "card_income", root }),
          });
          if (actor.hand.length) {
            spawnedEffects.push({
              priority: "direct",
              effect: {
                type: genericEffectRuntimeType(effect.type, true),
                kind: "decision",
                decisionKind: "choose_card",
                ownerId: actor.id,
                payload: clone(sessionEffect.payload),
              },
            });
          }
        }
      } else if ([
        cardEffects.EFFECT_TYPES.DISCARD_CARD_CORNER_REPEAT,
        cardEffects.EFFECT_TYPES.HAND_SCAN,
        cardEffects.EFFECT_TYPES.OPTIONAL_DISCARD_SCAN,
      ].includes(effect.type)) {
        if (!legal.target.skip) {
          const index = actor.hand.findIndex((entry) => entry.id === legal.target.cardInstanceId);
          const removed = cards.discardFromHandAtIndex(actor, index);
          if (!removed.ok) return removed;
          cards.addToDiscardPile(cardState, removed.card);
          if (effect.type === cardEffects.EFFECT_TYPES.DISCARD_CARD_CORNER_REPEAT) {
            spawnedEffects = spawnCardEffects(
              cornerEffects(removed.card, options.cornerRepeat || 1),
              sessionEffect,
            );
          } else {
            const scanCode = cards.getDiscardActionCodeForCard(removed.card);
            const nebulaIds = Object.values(cardEffects.NEBULA_IDS_BY_COLOR).flat();
            const selectedNebula = nebulaIds[Math.abs(Number(scanCode) || 0) % nebulaIds.length];
            spawnedEffects = spawnCardEffects([{
              id: `${effect.id}:hand-scan`,
              type: cardEffects.EFFECT_TYPES.SCAN_NEBULA,
              label: "手牌扫描",
              options: { nebulaId: selectedNebula, gainData: true },
            }], sessionEffect);
          }
        }
      } else if (effect.type === cardEffects.EFFECT_TYPES.DISCARD_PUBLIC_CORNER_REWARDS) {
        const index = cardState.publicCards.findIndex((card) => card?.id === legal.target.cardInstanceId);
        const card = cardState.publicCards[index];
        cardState.publicCards[index] = null;
        cards.addToDiscardPile(cardState, card);
        spawnedEffects = spawnCardEffects(cornerEffects(card), sessionEffect);
        cards.replenishPublicSlot(
          cardState,
          getSlice(root, "playerState", "players"),
          index,
          () => nextCommittedRandom(root),
          { createCardInstance: createCommittedCardFactory(root) },
        );
        irreversible = { code: "hidden_card_reveal", reason: "公共牌补牌翻出新牌" };
      } else if (effect.type === cardEffects.EFFECT_TYPES.PAY_CREDITS_FOR_REWARD) {
        if (legal.target.pay) {
          const spent = players.spendResources(actor, { credits: 1 });
          if (!spent.ok) return spent;
          spawnedEffects = spawnCardEffects([options.reward], sessionEffect);
          if ((Number(actor.resources?.credits) || 0) > 0) {
            spawnedEffects.push({
              priority: "direct",
              effect: {
                type: genericEffectRuntimeType(effect.type, true),
                kind: "decision",
                decisionKind: "choose_reward",
                ownerId: actor.id,
                payload: clone(sessionEffect.payload),
              },
            });
          }
        }
      } else if ([
        cardEffects.EFFECT_TYPES.PICK_CARD_CORNER_REWARD,
        cardEffects.EFFECT_TYPES.PUBLIC_SCAN,
      ].includes(effect.type)) {
        const index = cardState.publicCards.findIndex((card) => card?.id === legal.target.cardInstanceId);
        const card = cardState.publicCards[index];
        if (effect.type === cardEffects.EFFECT_TYPES.PICK_CARD_CORNER_REWARD) {
          const result = cards.pickFromPublic(
            cardState,
            getSlice(root, "playerState", "players"),
            actor,
            index,
            () => nextCommittedRandom(root),
            { createCardInstance: createCommittedCardFactory(root) },
          );
          if (!result.ok) return result;
          spawnedEffects = spawnCardEffects(cornerEffects(result.card), sessionEffect);
        } else {
          cardState.publicCards[index] = null;
          spawnedEffects = spawnCardEffects([{
            id: `${effect.id}:public-scan`,
            type: cardEffects.EFFECT_TYPES.SCAN_NEBULA,
            label: "公共牌扫描",
            options: {
              nebulaId: Object.values(cardEffects.NEBULA_IDS_BY_COLOR)
                .flat()[Math.abs(cards.getDiscardActionCodeForCard(card) || 0) % 8],
              gainData: true,
            },
          }], sessionEffect);
          cards.addToDiscardPile(cardState, card);
        }
      } else if (effect.type === cardEffects.EFFECT_TYPES.RETURN_UNFINISHED_TASK_TO_HAND) {
        const index = actor.reservedCards.findIndex((card) => card.id === legal.target.cardInstanceId);
        const [card] = actor.reservedCards.splice(index, 1);
        actor.hand.push(card);
        actor.resources.handSize = actor.hand.length;
      } else if ([
        cardEffects.EFFECT_TYPES.REMOVE_PLANET_MARKER,
        cardEffects.EFFECT_TYPES.REMOVE_ORBIT_TO_PROBE,
      ].includes(effect.type)) {
        const state = getSlice(root, "planetStatsState", "planets");
        const planet = state.planets?.[legal.target.planetId];
        const key = legal.target.kind === "orbit" ? "orbitMarkers" : "landingMarkers";
        const markers = planet?.[key] || [];
        const [marker] = markers.splice(legal.target.index, 1);
        if (effect.type === cardEffects.EFFECT_TYPES.REMOVE_ORBIT_TO_PROBE && marker) {
          const location = solar.createSolarSnapshot(
            getSlice(root, "solarState", "solarSystem"),
          ).planetLocations?.find((planet) => planet.planetId === legal.target.planetId);
          const launched = rockets.launchRocketAtSector(
            getSlice(root, "rocketState", "pieces"),
            location,
            { playerId: actor.id, color: actor.color },
          );
          if (!launched.ok) return launched;
        }
      } else if (effect.type === cardEffects.EFFECT_TYPES.PROBE_LOCATION_REWARD) {
        const rocket = listPlayerRockets(root, actor.id)
          .find((entry) => String(entry.id) === String(legal.target.rocketId));
        const content = solar.resolveVisibleContent(
          getSlice(root, "solarState", "solarSystem"),
          rocket.sectorX,
          rocket.sectorY,
        )?.content;
        const isAsteroid = content?.kind === "asteroid";
        const amount = isAsteroid
          ? Number(options.asteroidData || 0)
          : Number(options.adjacentAsteroidData || 0);
        for (let index = 0; index < amount; index += 1) {
          data.gainData(actor, { source: "probe_location_reward", root });
        }
      } else if (effect.type === cardEffects.REWARD_TYPES.ALIEN_TRACE) {
        const alienState = getSlice(root, "alienGameState", "aliens");
        const slot = aliens.getAlienSlot(alienState, legal.target.alienSlotId);
        let placed;
        if (!slot?.traces?.[legal.target.traceType]?.firstPlaced) {
          placed = aliens.placeFirstTrace(
            alienState,
            legal.target.alienSlotId,
            legal.target.traceType,
            actor.color,
          );
        } else if (!slot.revealed) {
          placed = aliens.addExtraTrace(
            alienState,
            legal.target.alienSlotId,
            legal.target.traceType,
            actor.color,
          );
        } else {
          const species = getSpeciesTraceApi(slot);
          placed = species?.api?.[species.placeMethod]?.(
            alienState,
            legal.target.alienSlotId,
            legal.target.traceType,
            legal.target.position,
            actor,
            {},
          );
        }
        if (!placed?.ok) return placed;
        if (options.afterTraceReward?.kind === "traceCountScore") {
          const count = cardEffects.countTraceMarkers(
            alienState,
            actor,
          );
          players.gainResources(actor, {
            score: count * Math.max(0, Number(options.afterTraceReward.scorePer) || 0),
          });
        }
      } else {
        return fail("CARD_EFFECT_DECISION_INCOMPLETE", `未实现卡牌 Decision ${effect.type}`);
      }
      return cardEffectResult(state, root, sessionEffect, {
        spawnedEffects,
        irreversible,
        event,
        historyType: "card_effect_decision",
        history: { choiceId: legal.target.choiceId },
      });
    }

    const GENERIC_EFFECT_DESCRIPTORS = Object.freeze({
      [cardEffects.REWARD_TYPES.ALIEN_TRACE]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.ANY_SECTOR_SCAN]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.CHOOSE_HAND_CORNER_REWARD]: { decisionKind: "choose_card" },
      [cardEffects.EFFECT_TYPES.CONDITIONAL_REWARD]: {},
      [cardEffects.EFFECT_TYPES.CONDITIONAL_SECTOR_SCAN]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.COUNT_HAND_CORNER_MOVE]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.DISCARD_ANY_FOR_INCOME]: { decisionKind: "choose_card" },
      [cardEffects.EFFECT_TYPES.DISCARD_CARD_CORNER_REPEAT]: { decisionKind: "choose_card" },
      [cardEffects.EFFECT_TYPES.DISCARD_PUBLIC_CORNER_REWARDS]: { decisionKind: "choose_card" },
      [cardEffects.EFFECT_TYPES.DRAW_THEN_SCAN]: {},
      [cardEffects.EFFECT_TYPES.EARTH_SECTOR_CONTENT_MOVE]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.HAND_SCAN]: { decisionKind: "choose_card" },
      [cardEffects.EFFECT_TYPES.CARD_LAND]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.LANDING_SECTOR_SCAN]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.CARD_MOVE]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.OPTIONAL_DISCARD_SCAN]: { decisionKind: "choose_card" },
      [cardEffects.EFFECT_TYPES.CARD_ORBIT]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.PAY_CREDITS_FOR_REWARD]: { decisionKind: "choose_reward" },
      [cardEffects.EFFECT_TYPES.PICK_CARD_CORNER_REWARD]: { decisionKind: "choose_card" },
      [cardEffects.EFFECT_TYPES.PLANET_SECTOR_SCAN]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.PROBE_LOCATION_REWARD]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.PROBE_SECTOR_SCAN]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.PROBE_STACK_REWARD]: {},
      [cardEffects.EFFECT_TYPES.COUNT_ROCKETS_REWARD]: {},
      [cardEffects.EFFECT_TYPES.PUBLIC_SCAN]: { decisionKind: "choose_card" },
      [cardEffects.EFFECT_TYPES.REGISTER_EVENT_BONUS]: {},
      [cardEffects.EFFECT_TYPES.REMOVE_ORBIT_TO_PROBE]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.REMOVE_PLANET_MARKER]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.RETURN_PLAYED_CARD_TO_HAND_IF]: {},
      [cardEffects.EFFECT_TYPES.RETURN_UNFINISHED_TASK_TO_HAND]: { decisionKind: "choose_card" },
      [cardEffects.EFFECT_TYPES.SCAN_ACTION]: { decisionKind: "choose_target" },
    });

    for (const [effectType, descriptor] of Object.entries(GENERIC_EFFECT_DESCRIPTORS)) {
      const runtimeType = genericEffectRuntimeType(effectType);
      runtime.registerExecutor(runtimeType, genericExecute);
      if (descriptor.decisionKind) {
        runtime.registerExecutor(genericEffectRuntimeType(effectType, true), {
          getLegalChoices(state, sessionEffect, workingContext) {
            return listGenericChoices(getWorkingRoot(state, workingContext), sessionEffect);
          },
          resolveDecision: genericResolve,
        });
      }
      if (effectType === cardEffects.EFFECT_TYPES.DRAW_THEN_SCAN) {
        runtime.registerExecutor(genericEffectRuntimeType(effectType, true), {
          getLegalChoices(state, sessionEffect, workingContext) {
            return listGenericChoices(getWorkingRoot(state, workingContext), sessionEffect);
          },
          resolveDecision: genericResolve,
        });
      }
    }

    function createEffectGroup(_state, action) {
      if (action?.family !== "play_card") {
        return fail("CARD_PLAY_FAMILY_INVALID", "Card Play domain 只接受 play_card");
      }
      return {
        kind: "action",
        ownerId: action.actorId || null,
        action: clone(action),
        effects: [{
          type: EFFECT_TYPES.PLAY,
          ownerId: action.actorId || null,
          payload: { action: clone(action) },
        }],
      };
    }

    return Object.freeze({ actionFamilies: ACTION_FAMILIES, createEffectGroup });
  }

  return Object.freeze({
    DOMAIN_ID,
    ACTION_FAMILIES,
    EFFECT_TYPES,
    EXECUTOR_ID,
    REACHABLE_PLAY_EFFECT_TYPES,
    REACHABLE_RECURSIVE_EFFECT_TYPES,
    DIRECT_EFFECT_TYPES,
    CARD_ENTITY_EFFECT_TYPES,
    OWNED_PLAY_EFFECT_TYPES,
    createPlayCardProvider,
    createExperimentalCardPlayDomain,
  });
});
