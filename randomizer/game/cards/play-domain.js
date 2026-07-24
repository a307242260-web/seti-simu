(function (root, factory) {
  "use strict";

  let standardAction = root.SetiStandardAction;
  let cards = root.SetiCards;
  let cardEffects = root.SetiCardEffects;
  let players = root.SetiPlayers;
  let abilities = root.SetiAbilities;
  if (typeof require === "function") {
    standardAction = standardAction || require("../actions/standard-action");
    cards = cards || require("./deck");
    cardEffects = cardEffects || require("./effects");
    players = players || require("../players");
    abilities = abilities || require("../abilities");
  }

  const api = factory(standardAction, cards, cardEffects, players, abilities);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiCardPlayDomain = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  standardAction,
  cards,
  cardEffects,
  players,
  abilities,
) {
  "use strict";

  const DOMAIN_ID = "card_play";
  const ACTION_FAMILIES = Object.freeze(["play_card"]);
  const EFFECT_TYPES = Object.freeze({
    PLAY: "card_play_domain_play",
    FIXED_NEBULA_SCAN: "card_play_domain_fixed_nebula_scan",
    COLOR_NEBULA_SCAN: "card_play_domain_color_nebula_scan",
  });
  const EXECUTOR_ID = `${DOMAIN_ID}:executor:v1`;
  const REACHABLE_PLAY_EFFECT_TYPES = Object.freeze((() => {
    const types = new Set();
    for (const cardId of Object.keys(cardEffects.CARD_REFERENCE_MAP || {})) {
      for (const effect of cardEffects.buildPlayEffects({ cardId })) types.add(effect.type);
    }
    return [...types].sort();
  })());
  const SLICE_EFFECT_TYPES = Object.freeze([
    cardEffects.EFFECT_TYPES.SCAN_NEBULA,
    cardEffects.EFFECT_TYPES.SCAN_COLOR_CHOICE,
  ]);

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
    return {
      workingRoot: root,
      playerState,
      cardState: getSlice(root, "cardState", "cards"),
      rocketState: getSlice(root, "rocketState", "pieces"),
      solarState: getSlice(root, "solarState", "solarSystem"),
      nebulaDataState: getSlice(root, "nebulaDataState", "data"),
      planetStatsState: getSlice(root, "planetStatsState", "planets"),
      techGameState: getSlice(root, "techGameState", "tech"),
      alienGameState: getSlice(root, "alienGameState", "aliens"),
      turnState: getSlice(root, "turnState", "turn"),
      match: root.match,
      standardActionAuthority: {
        actorId,
        stateVersion: root?.meta?.stateVersion ?? 0,
        decisionVersion: root?.match?.decisionVersion ?? 0,
      },
    };
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
      const unsupported = playEffects.find((effect) => !SLICE_EFFECT_TYPES.includes(effect.type));
      if (unsupported) {
        return fail("CARD_PLAY_SLICE_UNSUPPORTED", `代表竖切尚未覆盖 ${unsupported.type}`, {
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
        spawnedEffects: playEffects.map((effect) => ({
          priority: "direct",
          effect: effect.type === cardEffects.EFFECT_TYPES.SCAN_NEBULA
            ? {
              type: EFFECT_TYPES.FIXED_NEBULA_SCAN,
              ownerId: actor.id,
              payload: { cardEffect: clone(effect), cardInstanceId: playedCard.id },
            }
            : {
              type: EFFECT_TYPES.COLOR_NEBULA_SCAN,
              kind: "decision",
              decisionKind: "choose_target",
              ownerId: actor.id,
              payload: { cardEffect: clone(effect), cardInstanceId: playedCard.id },
            },
        })),
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
    SLICE_EFFECT_TYPES,
    createPlayCardProvider,
    createExperimentalCardPlayDomain,
  });
});
