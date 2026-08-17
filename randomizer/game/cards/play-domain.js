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
  let rockets = root.SetiRocketActions;
  let planetStats = root.SetiPlanetStats;
  let planetRewards = root.SetiPlanetRewards;
  let aliens = root.SetiAliens;
  let actionShared = root.SetiActionShared;
  let yichangdian = root.SetiAlienYichangdian;
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
    planetRewards = planetRewards || require("../actions/planet-rewards");
    aliens = aliens || require("../aliens");
    actionShared = actionShared || require("../actions/shared");
    yichangdian = yichangdian || require("../aliens/yichangdian");
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
    planetRewards,
    aliens,
    actionShared,
    yichangdian,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiCardPlayDomain = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (
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
  planetRewards,
  aliens,
  actionShared,
  yichangdian,
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
    LAUNCH: "card_play_domain_launch",
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
    return workingContext?.state || workingContext || state;
  }

  function getScienceDomain() {
    const api = typeof globalThis !== "undefined" ? globalThis.SetiScienceSession : null;
    if (api) return api;
    if (typeof require === "function") return require("../effects/science-session");
    throw new TypeError("Card Play 缺少 Science production domain");
  }

  function getProbeTurnDomain() {
    const api = typeof globalThis !== "undefined" ? globalThis.SetiProbeTurnSession : null;
    if (api) return api;
    if (typeof require === "function") return require("../effects/probe-turn-session");
    throw new TypeError("Card Play 缺少 Probe Turn production domain");
  }

  // 构建探测器位置索引（供卡牌条件/任务判定）：
  // details 每项带 playerId/color、sectorX/Y、adjacentToEarth（与地球扇区正交相邻，
  // 含环向 x 与径向 y，曼哈顿距离为 1）；index 按玩家 id/color 汇总 locationType。
  function buildProbeLocationData(root) {
    const solarSystemState = getWorkingSlice(root, "solarSystem");
    const earth = solar.createSolarSnapshot(solarSystemState)
      .planetLocations.find((planet) => planet.planetId === "earth");
    const earthX = earth?.x;
    const earthY = earth?.y;
    const details = [];
    const index = {};
    for (const rocket of (root?.pieces?.rockets || [])) {
      if (!rocket.playerId) continue;
      const onBoard = Number.isInteger(rocket.sectorX) && Number.isInteger(rocket.sectorY);
      const adjacentToEarth = onBoard && earthX != null && earthY != null
        && (Math.min(
          solar.mod8(rocket.sectorX - earthX),
          solar.mod8(earthX - rocket.sectorX),
        ) + Math.abs(rocket.sectorY - earthY)) === 1;
      const locationType = "solar";
      const detail = {
        playerId: rocket.playerId,
        color: rocket.color || null,
        sectorX: onBoard ? rocket.sectorX : null,
        sectorY: onBoard ? rocket.sectorY : null,
        locationType,
        adjacentToEarth: Boolean(adjacentToEarth),
        planetId: null,
      };
      details.push(detail);
      for (const key of [rocket.playerId, rocket.color].filter(Boolean).map(String)) {
        if (!index[key]) index[key] = [];
        if (!index[key].includes(locationType)) index[key].push(locationType);
      }
    }
    return { details, index };
  }

  function getWorkingSlice(root, key) {
    return root?.[key] || {};
  }

  function getActor(root, actorId = null) {
    const playersState = getWorkingSlice(root, "players");
    const resolvedId = actorId || root?.turn?.currentPlayerId || null;
    return (playersState.players || []).find((player) => player.id === resolvedId) || null;
  }

  function createActionContext(root, actorId) {
    const playersState = getWorkingSlice(root, "players");
    const solarSystemState = getWorkingSlice(root, "solarSystem");
    const piecesState = getWorkingSlice(root, "pieces");
    const context = {
      state: root,
      players: playersState,
      cards: getWorkingSlice(root, "cards"),
      pieces: piecesState,
      solarSystem: solarSystemState,
      data: getWorkingSlice(root, "data"),
      planets: getWorkingSlice(root, "planets"),
      tech: getWorkingSlice(root, "tech"),
      aliens: getWorkingSlice(root, "aliens"),
      turn: { ...getWorkingSlice(root, "turn"), currentPlayerId: actorId || root.turn?.currentPlayerId },
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
    context.getPlanetLocations = () => solar.createSolarSnapshot(solarSystemState).planetLocations;
    context.getEarthSectorCoordinate = () => {
      const earth = context.getPlanetLocations()
        .find((planet) => planet.planetId === "earth");
      return earth ? { x: earth.x, y: earth.y } : null;
    };
    context.rotateSolarOrbit = (count = 1) => {
      const beforeRotation = clone(solarSystemState.rotation);
      solarSystemState.rotation = solar.applySolarOrbitRotation(solarSystemState.rotation, count);
      return abilities.rocket.settleRocketsAfterSolarRotation(
        context,
        beforeRotation,
        solarSystemState.rotation,
      );
    };
    // 统一抽牌上下文：drawBasicCardToPlayer 等抽牌入口共用 cards.createCardDrawContext
    const drawContext = cards.createCardDrawContext(
      context.cards,
      playersState,
      () => nextCommittedRandom(root),
      { root },
    );
    context.drawBasicCardToPlayer = (player) => drawContext.blindDraw(player);
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

  // 卡牌实例统一由 cards.createCardDrawContext（root 分支）创建，
  // 此处不再单独维护工厂。

  function createPlayCardProvider() {
    return Object.freeze(standardAction.createPlayCardProvider({
      players,
      cards,
      getCardPlayCost: cardEffects.getCardPlayCost,
      canStart(actionContext) {
        const root = actionContext?.state || actionContext;
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
      if (effect.type === cardEffects.EFFECT_TYPES.RESEARCH_TECH) {
        const science = getScienceDomain();
        return {
          priority: "direct",
          effect: {
            type: science.EFFECT_TYPES.RESEARCH,
            decisionKind: "choose_target",
            ownerId,
            payload: {
              options: {
                ...clone(effect.options || {}),
                skipCost: effect.options?.skipCost !== false,
              },
              cardInstanceId,
              cardEffect: clone(effect),
            },
          },
        };
      }
      if (effect.type === cardEffects.EFFECT_TYPES.PUBLIC_SCAN) {
        const science = getScienceDomain();
        return {
          priority: "direct",
          effect: {
            type: science.EFFECT_TYPES.SCAN_STEP,
            ownerId,
            payload: {
              options: {
                mode: "public",
                selected: 0,
                max: Math.max(1, Number(effect.options?.repeat || effect.options?.count) || 1),
                consumeMarkers: false,
              },
              cardInstanceId,
              cardEffect: clone(effect),
            },
          },
        };
      }
      if (effect.type === cardEffects.EFFECT_TYPES.SCAN_ACTION) {
        const science = getScienceDomain();
        return {
          priority: "direct",
          effect: {
            type: science.EFFECT_TYPES.EXECUTE,
            ownerId,
            payload: {
              action: {
                family: "scan",
                phase: "main",
                actorId: ownerId,
                target: { kind: "card-scan-action" },
                payload: { skipCost: true },
              },
              cardInstanceId,
              cardEffect: clone(effect),
            },
          },
        };
      }
      // 扫描家族 → 统一 science SCAN_STEP（目标枚举/扫描结算/扇区结算全部收敛到
      // science 的统一扫描节点，底层 placeNebulaToken）。
      const scanStepOptions = (() => {
        const e = effect;
        switch (e.type) {
          case cardEffects.EFFECT_TYPES.SCAN_NEBULA:
            return { mode: "specified", nebulaIds: [e.options?.nebulaId].filter(Boolean), gainData: e.options?.gainData !== false, label: e.label };
          case cardEffects.EFFECT_TYPES.ANY_SECTOR_SCAN:
            return { mode: "any", gainData: e.options?.gainData !== false, label: e.label };
          case cardEffects.EFFECT_TYPES.SCAN_COLOR_CHOICE:
            return { mode: "color", color: e.options?.color, gainData: e.options?.gainData !== false, label: e.label };
          case cardEffects.EFFECT_TYPES.PLANET_SECTOR_SCAN:
            return { mode: "planet", planetId: e.options?.planetId, gainData: e.options?.gainData !== false, label: e.label };
          case cardEffects.EFFECT_TYPES.LANDING_SECTOR_SCAN:
            return { mode: "landing", gainData: e.options?.gainData !== false, label: e.label };
          case cardEffects.EFFECT_TYPES.PROBE_SECTOR_SCAN:
            return { mode: "probe", gainData: e.options?.gainData !== false, label: e.label };
          case cardEffects.EFFECT_TYPES.CONDITIONAL_SECTOR_SCAN:
            return { mode: "conditional", condition: e.options?.condition, gainData: e.options?.gainData !== false, label: e.label };
          default:
            return null;
        }
      })();
      if (scanStepOptions) {
        const science = getScienceDomain();
        return {
          priority: "direct",
          effect: {
            type: science.EFFECT_TYPES.SCAN_STEP,
            ownerId,
            payload: { options: scanStepOptions, cardInstanceId, cardEffect: clone(effect) },
          },
        };
      }
      // 其余效果：直接效果 / 抽牌 / 精选 / 发射 / 通用描述符（扫描家族已全部
      // 在上方收敛到 science SCAN_STEP）。
      let type = null;
      let decisionKind = null;
      if (DIRECT_EFFECT_TYPES.includes(effect.type)) {
        type = EFFECT_TYPES.DIRECT;
      } else if (effect.type === cardEffects.REWARD_TYPES.DRAW_CARDS) {
        type = EFFECT_TYPES.DRAW_CARDS;
      } else if (effect.type === cardEffects.REWARD_TYPES.PICK_CARD) {
        type = EFFECT_TYPES.PICK_CARD_START;
      } else if (effect.type === cardEffects.REWARD_TYPES.LAUNCH) {
        type = EFFECT_TYPES.LAUNCH;
      } else {
        type = genericEffectRuntimeType(effect.type);
      }
      const genericDescriptor = GENERIC_EFFECT_DESCRIPTORS[effect.type] || null;
      if (genericDescriptor?.decisionKind) {
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
      // 外星人牌不在标准卡表（set: alien:*），打出效果由对应物种模块构建：
      // 阿米巴/虫/奥陌陌/半人马/符文族等所有有 buildImmediateEffects 的物种统一追加，
      // 不再逐物种特判（虫族牌此前漏接导致打出无效）。
      const alienModules = [
        aliens?.amiba,
        aliens?.chong,
        aliens?.aomomo,
        aliens?.banrenma,
        aliens?.runezu,
      ].filter(Boolean);
      for (const module of alienModules) {
        const isCardMethod = Object.keys(module || {}).find((key) => (
          key.startsWith("is") && key.endsWith("Card") && typeof module[key] === "function"
        ));
        if (isCardMethod && module[isCardMethod](card) && typeof module.buildImmediateEffects === "function") {
          playEffects.push(...(module.buildImmediateEffects(card) || []));
        }
      }
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
        cards.addToDiscardPile(getWorkingSlice(root, "cards"), playedCard);
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
        players.gainResources(actor, gain, "cardEffectScore");
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
        const cardsState = getWorkingSlice(root, "cards");
        const cardInstanceId = sessionEffect.payload?.cardInstanceId;
        const discardIndex = (cardsState.discardPile || [])
          .findIndex((card) => card.id === cardInstanceId);
        if (discardIndex < 0) {
          return fail("CARD_TUCK_TARGET_STALE", "当前打出的卡牌不在弃牌堆");
        }
        const [playedCard] = cardsState.discardPile.splice(discardIndex, 1);
        const gain = cards.getIncomeGainForCard(playedCard);
        if (!gain) return fail("CARD_TUCK_INCOME_UNKNOWN", "当前卡牌没有可识别收入");
        const drawnCards = [];
        const dataResults = [];
        // 统一抽牌上下文：收入盲抽共用 cards.createCardDrawContext
        const drawContext = cards.createCardDrawContext(
          cardsState,
          getWorkingSlice(root, "players"),
          () => nextCommittedRandom(root),
          { root },
        );
        players.gainIncome(actor, gain, {
          blindDraw(targetPlayer) {
            const draw = drawContext.blindDraw(targetPlayer);
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
        const cardsState = getWorkingSlice(root, "cards");
        const discarded = [];
        while ((actor.hand || []).length) {
          const removed = cards.discardFromHandAtIndex(actor, actor.hand.length - 1);
          if (!removed.ok) break;
          cards.addToDiscardPile(cardsState, removed.card);
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
          players.gainResources(actor, { [options.resource || "score"]: total }, "cardEffectScore");
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
          // 统一抽牌上下文：科技数量盲抽共用 cards.createCardDrawContext
          const drawContext = cards.createCardDrawContext(
            getWorkingSlice(root, "cards"),
            getWorkingSlice(root, "players"),
            () => nextCommittedRandom(root),
            { root },
          );
          const drawResult = cards.drawCardsToHand(
            getWorkingSlice(root, "cards"),
            getWorkingSlice(root, "players"),
            actor,
            count,
            () => nextCommittedRandom(root),
            { createCardInstance: drawContext.createCardInstance },
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
        // 收入牌插入起始收入牌下方，移出游戏（不进弃牌堆、不会被洗回主牌库）。
        cards.addRemovedFromGame(getWorkingSlice(root, "cards"), removed.card);
        const drawnCards = [];
        const dataResults = [];
        // 统一抽牌上下文：收入盲抽共用 cards.createCardDrawContext
        const drawContext = cards.createCardDrawContext(
          getWorkingSlice(root, "cards"),
          getWorkingSlice(root, "players"),
          () => nextCommittedRandom(root),
          { root },
        );
        players.gainIncome(actor, gain, {
          blindDraw(targetPlayer) {
            const draw = drawContext.blindDraw(targetPlayer);
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
      // 统一抽牌上下文：盲抽共用 cards.createCardDrawContext
      const drawContext = cards.createCardDrawContext(
        getWorkingSlice(root, "cards"),
        getWorkingSlice(root, "players"),
        () => nextCommittedRandom(root),
        { root },
      );
      const result = cards.drawCardsToHand(
        getWorkingSlice(root, "cards"),
        getWorkingSlice(root, "players"),
        actor,
        count,
        () => nextCommittedRandom(root),
        { createCardInstance: drawContext.createCardInstance },
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
        const cardsState = getWorkingSlice(root, "cards");
        const choices = (cardsState.publicCards || []).flatMap((card, slotIndex) => {
          if (!card) return [];
          return [{
            family: "choose_card",
            target: { choiceId: `public:${slotIndex}`, source: "public", slotIndex },
            payload: { cardInstanceId: card.id },
            summary: cards.getCardLabel(card),
            // 精选牌卡面统一由 cards.getPublicCardPickPresentation 提供
            presentation: cards.getPublicCardPickPresentation(card),
          }];
        });
        if (cards.getAvailablePool(
          cardsState,
          getWorkingSlice(root, "players"),
        ).length) {
          choices.push({
            family: "choose_card",
            target: { choiceId: "blind", source: "blind" },
            payload: {},
            summary: "盲抽 1 张牌",
          });
        }
        // 与其它决策一致：formalize 补全 Standard Action identity（读档恢复后
        // 投影校验要求 schemaVersion/actionId/actorId，缺则整个投影抛错）。
        return getScienceDomain().formalizeChoices(root, sessionEffect.ownerId, choices);
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
        const cardsState = getWorkingSlice(root, "cards");
        const playersState = getWorkingSlice(root, "players");
        // 统一抽牌上下文：精选/盲抽共用 cards.createCardDrawContext
        const drawContext = cards.createCardDrawContext(
          cardsState,
          playersState,
          () => nextCommittedRandom(root),
          { root },
        );
        const result = legal.target.source === "public"
          ? drawContext.pickFromPublic(actor, legal.target.slotIndex)
          : drawContext.blindDraw(actor);
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
      const all = getWorkingSlice(root, "pieces").rockets || [];
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
      // 统一移动入口：所有移动来源（卡牌/紫4/快速交易/probe turn/残余域）共用
      const choices = abilities.rocket.listPlayerMoveChoices(context, actor, {
        maxPoints: remaining,
        ignoreAsteroidRestriction: false,
      }).map((move) => makeChoice(
        "choose_target",
        `${move.rocketId}:${move.deltaX}:${move.deltaY}`,
        { rocketId: move.rocketId, deltaX: move.deltaX, deltaY: move.deltaY },
        { requiredMovePoints: move.requiredMovePoints, remaining },
        `R${move.rocketId} ${move.label}`,
      ));
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
        getWorkingSlice(root, "solarSystem"),
      ).nebulaLocations || {};
      const location = Array.isArray(locations)
        ? locations.find((entry) => entry.id === nebulaId)
        : locations[nebulaId] || null;
      return location?.x == null ? null : solar.mod8(Number(location.x));
    }

    function listScannableNebulaChoices(root, nebulaIds, options = {}) {
      return getScienceDomain().listNebulaChoices(root, {
        nebulaIds,
        gainData: options.gainData,
      }).map((choice) => makeChoice(
          "choose_target",
          choice.target.nebulaId,
          {
            nebulaId: choice.target.nebulaId,
            sectorX: getNebulaSectorX(root, choice.target.nebulaId),
          },
          { gainData: options.gainData !== false },
          choice.summary,
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
            cards.addToDiscardPile(getWorkingSlice(root, "cards"), removed.card);
          }
        }
        return cardEffectResult(state, root, sessionEffect, {
          event: { skipped: true },
          historyType: "card_effect_decision",
          history: { choiceId: "skip" },
        });
      }
      const actor = getActor(root, sessionEffect.ownerId);
      const result = getScienceDomain().executeNebulaScan(root, actor.id, {
        ...clone(legal),
        target: { ...clone(legal.target), choiceId: `nebula:${legal.target.nebulaId}` },
      }, {
        nebulaIds: [legal.target.nebulaId],
        gainData: legal.payload?.gainData !== false,
        source: "card",
        label: sessionEffect.payload.cardEffect.label,
      });
      if (!result.ok) return result;
      const drawnCardId = sessionEffect.payload?.drawnCardId;
      if (drawnCardId) {
        const index = actor.hand.findIndex((card) => card.id === drawnCardId);
        if (index >= 0) {
          const removed = cards.discardFromHandAtIndex(actor, index);
          cards.addToDiscardPile(getWorkingSlice(root, "cards"), removed.card);
        }
      }
      return cardEffectResult(state, root, sessionEffect, {
        // 统一扇区结算：任意扇区/条件/行星/着陆/探测器等卡牌扫描替换 token 后检查一次扇区完成。
        spawnedEffects: [getScienceDomain().settleAfterScan(actor.id)],
        events: result.events || [],
        historyType: "card_effect_decision",
        history: { choiceId: legal.target.choiceId, abilityId: result.abilityId },
      });
    }

    // 卡牌追加的「登陆后奖励」摘要归卡牌域：与结算（resolvePlanet 的
    // afterLandRewards）同一匹配规则，只拼进选项文案；共享登陆行为不感知。
    function appendCardAfterLandRewards(label, effectOptions, entry) {
      const rewards = (effectOptions?.afterLandRewards || [])
        .filter((reward) => {
          const planetIds = reward?.planetIds || [];
          const planetMatch = !planetIds.length || planetIds.includes(entry.planetId);
          const satelliteMatch = reward?.includeSatellites && entry.target?.type === "satellite";
          return planetMatch || satelliteMatch;
        })
        .map((reward) => reward?.effect)
        .filter(Boolean);
      if (!rewards.length) return label;
      const summary = planetRewards.formatRewardEffectsSummary(rewards);
      return summary ? `${label}；${summary}` : label;
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
        const label = entry.label || `${actionType} ${entry.planetId}`;
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
          actionType === "land"
            ? appendCardAfterLandRewards(label, effectOptions, entry)
            : label,
        );
      });
    }

    function resolvePlanet(state, sessionEffect, choice, workingContext, actionType) {
      const root = getWorkingRoot(state, workingContext);
      const legal = listPlanetChoices(root, sessionEffect, actionType)
        .find((candidate) => candidate.target.choiceId === choice?.target?.choiceId);
      if (!legal) return fail("CARD_PLANET_CHOICE_STALE", "卡牌行星选择已失效");
      const actor = getActor(root, sessionEffect.ownerId);
      // 记录火箭落点坐标（供虫族拾取化石创建搬运棋子；登陆后火箭会被移除，必须提前记录）
      const landingRocket = (getWorkingSlice(root, "pieces")?.rockets || [])
        .find((entry) => entry.id === Number(legal.target.rocketId)) || null;
      const landingCoordinate = landingRocket
        ? rockets.getRocketSectorCoordinate(landingRocket)
        : null;
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
        // 标准行星登陆奖励（分数/数据/黄色痕迹等）与主行动登陆一致：
        // 打牌触发登陆同样必须结算，否则会漏掉黄色外星人痕迹等行星奖励。
        const standardRewards = planetRewards.buildRewardEffectsForAction("land", result);
        for (const reward of standardRewards) {
          spawnedEffects.push({
            priority: "direct",
            effect: {
              type: getProbeTurnDomain().EFFECT_TYPES.REWARD,
              ownerId: actor.id,
              payload: {
                reward,
                // 打牌触发登陆同样按来源拆终局分：登陆计 landScore
                sourceKey: actionType === "land" ? "landScore" : "orbitScore",
              },
            },
          });
        }
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
      if (actionType === "land") {
        // 记录登陆落点（虫族拾取化石等后续效果读取）
        root.match.cardPlayContext = {
          ...(root.match.cardPlayContext || {}),
          lastLanding: {
            planetId: result.planetId,
            rocketId: legal.target.rocketId,
            // 落点坐标：登陆后火箭会被移除，拾取化石需用此坐标创建搬运棋子
            sectorX: landingCoordinate?.x ?? null,
            sectorY: landingCoordinate?.y ?? null,
            hadAnyMarker: Boolean(
              effect.options.rememberPreLandingMarker
                ? result.hadAnyMarker
                : null,
            ),
          },
        };
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
      return (cardsToList || []).map((card, index) => ({
        ...makeChoice(
          family,
          card.id,
          { cardInstanceId: card.id, index, ...extra },
          {},
          cards.getCardLabel(card),
        ),
        // 所有选手牌的决策统一显示卡面（弃牌角标、弃牌换奖励等）
        ...(cards.getCardPickPresentation(card) ? {
          presentation: cards.getCardPickPresentation(card),
        } : {}),
      }));
    }

    function cornerEffects(card, repeat = 1) {
      // 资源/数据/移动角标统一走共享转换（gain/dataCount/movementPoints 一条路径）
      const effects = [];
      for (let index = 0; index < Math.max(1, repeat); index += 1) {
        effects.push(...cards.buildRewardEffects(
          cards.getDiscardActionRewardForCard(card),
          `corner:${card.id}:${index}`,
        ));
        effects.push(...cards.buildRewardEffects(
          cards.getDiscardActionMoveRewardForCard(card),
          `corner:${card.id}:${index}`,
        ));
      }
      return effects;
    }

    function conditionMet(root, actor, condition) {
      const probeData = buildProbeLocationData(root);
      return cardEffects.taskConditionMet(
        { condition },
        actor,
        {
          ...createActionContext(root, actor.id),
          dataTotals: {
            [actor.id]: Number(actor.resources?.availableData) || 0,
            [actor.color]: Number(actor.resources?.availableData) || 0,
          },
          probeLocations: probeData.index,
          probeLocationDetails: probeData.details,
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
          getWorkingSlice(root, "pieces").rockets || [],
          actor,
          options,
        );
        if (match.conditionMet) spawnedEffects = spawnCardEffects(options.rewards, sessionEffect);
        event.conditionMet = Boolean(match.conditionMet);
        event.skipped = !match.conditionMet;
      } else if (effect.type === cardEffects.EFFECT_TYPES.COUNT_ROCKETS_REWARD) {
        const count = cardEffects.countRocketsForReward(
          getWorkingSlice(root, "pieces").rockets || [],
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
            players.gainResources(actor, { [options.resource || "score"]: amount }, "cardEffectScore");
          }
        }
        event.count = count;
        event.amount = amount;
      } else if (effect.type === cardEffects.EFFECT_TYPES.REGISTER_EVENT_BONUS) {
        const bonusState = root.turn || root.turn || root.match;
        const bonusOptions = options.bonus || options;
        if (!Array.isArray(bonusState.cardTurnEventBonuses)) {
          bonusState.cardTurnEventBonuses = [];
        }
        bonusState.cardTurnEventBonuses.push({
          ...clone(bonusOptions),
          id: effect.id,
          effectId: effect.id,
          playerId: actor.id,
          ownerId: actor.id,
          duration: bonusOptions.duration || "flow",
          usedKeys: [],
          claimedKeys: [],
        });
      } else if (effect.type === cardEffects.EFFECT_TYPES.RETURN_PLAYED_CARD_TO_HAND_IF) {
        const met = options.condition?.type === "lastLandingHadAnyMarker"
          ? Boolean(root.match.cardPlayContext?.lastLanding?.hadAnyMarker)
          : conditionMet(root, actor, options.condition);
        if (met) {
          const cardsState = getWorkingSlice(root, "cards");
          const cardId = sessionEffect.payload.cardInstanceId;
          let source = cardsState.discardPile || [];
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
        const cardsState = getWorkingSlice(root, "cards");
        const drawCtx = cards.createCardDrawContext(
          cardsState,
          getWorkingSlice(root, "players"),
          () => nextCommittedRandom(root),
          { root },
        );
        const draw = drawCtx.blindDraw(actor);
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
      } else if (effect.type === aliens.chong?.EFFECT_TYPES?.CHONG_LAND_FOR_PICKUP
        || effect.type === aliens.chong?.EFFECT_TYPES?.CHONG_ORBIT_OR_LAND_FOR_PICKUP) {
        // 虫族登陆/环绕牌：由标准 generic 决策流程处理（descriptor 有 decisionKind），
        // listGenericChoices 枚举登陆目标 / 环绕登陆二选一，resolve 结算后进入拾取节点。
        event.pendingChongPlanetAction = effect.type === aliens.chong?.EFFECT_TYPES?.CHONG_ORBIT_OR_LAND_FOR_PICKUP
          ? "orbit"
          : "land";
      } else {
        return fail("CARD_EFFECT_EXECUTOR_INCOMPLETE", `未实现卡牌效果 ${effect.type}`);
      }
      return cardEffectResult(state, root, sessionEffect, {
        spawnedEffects,
        event,
        ...(event.irreversibleDraw ? { irreversible: { code: "hidden_card_draw", reason: "阿米巴区域奖励盲抽翻开隐藏牌" } } : {}),
      });
    }

    function listGenericChoices(root, sessionEffect) {
      const effect = sessionEffect.payload?.cardEffect;
      const actor = getActor(root, sessionEffect.ownerId);
      const options = effect?.options || {};
      if (!actor) return [];
      if (effect.type === aliens.chong?.EFFECT_TYPES?.CHONG_PICKUP_FOSSIL) {
        // 虫族拾取化石：列出上一步登陆/环绕落点（木星/土星）的可拾取化石
        const resolved = aliens.chong.resolvePlayEffect(
          aliens.chong.EFFECT_TYPES.CHONG_PICKUP_FOSSIL,
          root,
          effect,
          actor,
          { aliens: getWorkingSlice(root, "aliens") },
        );
        if (!resolved.ok || resolved.skipped || !resolved.awaitingFossilPick) return [];
        return resolved.fossils.map((fossil) => makeChoice(
          "choose_target",
          `chong-fossil:${fossil.fossilId}`,
          { fossilId: fossil.fossilId, planetId: resolved.planetId },
          {},
          fossil.label,
        ));
      }
      if (effect.type === aliens.chong?.EFFECT_TYPES?.CHONG_PROBE_PLANET_FOSSIL_REWARD) {
        // 生态系统研究：列出当前探测器所在星球（木星/土星）的可查看化石
        const resolved = aliens.chong.resolvePlayEffect(
          aliens.chong.EFFECT_TYPES.CHONG_PROBE_PLANET_FOSSIL_REWARD,
          root,
          effect,
          actor,
          {
            aliens: getWorkingSlice(root, "aliens"),
            listRocketPlanetIds: () => {
              const context = createActionContext(root, actor.id);
              return (listPlayerRockets(root, actor.id) || []).map((rocket) => {
                const placed = actionShared.getRocketPlanet(context, { rocketId: rocket.id });
                return placed?.ok ? placed.planet?.planetId : null;
              }).filter(Boolean);
            },
          },
        );
        if (!resolved.ok || resolved.skipped || !resolved.awaitingFossilReward) return [];
        return resolved.fossils.map((fossil) => makeChoice(
          "choose_target",
          `chong-reward:${fossil.fossilId}`,
          { fossilId: fossil.fossilId, planetId: fossil.planetId },
          {},
          fossil.label,
        ));
      }
      if (effect.type === aliens.chong?.EFFECT_TYPES?.CHONG_LAND_FOR_PICKUP
        || effect.type === aliens.chong?.EFFECT_TYPES?.CHONG_ORBIT_OR_LAND_FOR_PICKUP) {
        // 虫族登陆/环绕牌：直接枚举合法登陆（或环绕）目标，复用标准行星执行器。
        // 可选环绕的牌同时提供环绕与登陆两类目标。
        const orbitOrLand = effect.type === aliens.chong?.EFFECT_TYPES?.CHONG_ORBIT_OR_LAND_FOR_PICKUP;
        const landChoices = listPlanetChoices(root, sessionEffect, "land");
        if (!orbitOrLand) return landChoices;
        const orbitChoices = listPlanetChoices(root, sessionEffect, "orbit");
        return [...orbitChoices, ...landChoices];
      }
      if (effect.type === aliens.amiba?.EFFECT_TYPES?.CHOOSE_SYMBOL_REWARD) {
        // 阿米巴区域 symbol 奖励：让玩家选择结算区域内哪个细胞器（symbol）。
        // 同一区域最多结算 3 次（蓝/红/橙各 3 个细胞器位），到达上限不再提供选择。
        const region = options.region;
        if (!region) return [];
        if ((Number(sessionEffect.payload?.settledCount) || 0) >= 3) return [];
        const symbols = aliens.amiba.listSymbolsInRegion(getWorkingSlice(root, "aliens"), region);
        return symbols.map((entry) => (
          makeChoice(
            "choose_target",
            `symbol:${entry.slotId}`,
            { slotId: entry.slotId, region, symbolId: entry.symbolId },
            {},
            `${entry.slotId}（${aliens.amiba.formatSymbolReward(entry.symbolId)}）`,
          )
        ));
      }
      if (effect.type === aliens.amiba?.EFFECT_TYPES?.REMOVE_TRACE_FOR_REGION_REWARD) {
        // 阿米巴3：移除自己的 1 个阿米巴痕迹并结算该痕迹所在区域
        const alienState = getWorkingSlice(root, "aliens");
        const revealedSlotId = alienState?.amiba?.revealedSlotId || null;
        if (!revealedSlotId) return [];
        if (typeof aliens.amiba.migrateLegacyTraces === "function") {
          aliens.amiba.migrateLegacyTraces(alienState, revealedSlotId, {
            takeSequence: () => {
              // play-domain 无 stateSequences：返回当前 alienEntity sequence 并递增
              const meta = root.meta || {};
              const current = Number(meta.sequences?.alienEntity) || 0;
              if (meta.sequences) meta.sequences.alienEntity = current + 1;
              return current;
            },
          });
        }
        return aliens.amiba.listPlayerTraceOptions(alienState, revealedSlotId, actor).map((entry) => (
          makeChoice(
            "choose_target",
            `trace:${entry.traceType}:${entry.position}`,
            { traceType: entry.traceType, position: entry.position, region: entry.region },
            {},
            entry.label || `${entry.traceType} ${entry.position}`,
          )
        ));
      }
      // 扫描家族（ANY/CONDITIONAL/PLANET/LANDING/PROBE 等）已统一收敛到 science
      // SCAN_STEP，不再经 listGenericChoices；仅保留 DRAW_THEN_SCAN 的盲抽后扫描。
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
        cardEffects.EFFECT_TYPES.FREE_MOVE,
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
          getWorkingSlice(root, "cards").publicCards || [],
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
        const cardsState = getWorkingSlice(root, "cards");
        return listCardChoices(cardsState.publicCards || []);
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
          getWorkingSlice(root, "planets").planets || {},
        )) {
          for (const kind of ["orbit", "land"]) {
            const markers = kind === "orbit"
              ? planetStats.getPlanetOrbitMarkers(
                getWorkingSlice(root, "planets"),
                planetId,
              )
              : planetStats.getPlanetLandingMarkers(
                getWorkingSlice(root, "planets"),
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
        const alienState = getWorkingSlice(root, "aliens");
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
      // 扫描家族（ANY/CONDITIONAL/PLANET/LANDING/PROBE）已统一到 science SCAN_STEP；
      // 仅 DRAW_THEN_SCAN（盲抽后扫描）保留自己的流程。
      if ([
        cardEffects.EFFECT_TYPES.DRAW_THEN_SCAN,
      ].includes(effect.type)) return resolveNebulaScan(state, sessionEffect, choice, workingContext);
      if (effect.type === aliens.chong?.EFFECT_TYPES?.CHONG_PICKUP_FOSSIL) {
        // 虫族：拾取选中的化石（生成化石搬运棋子绑定当前探测器）
        const alienState = getWorkingSlice(root, "aliens");
        const cardInstanceId = sessionEffect.payload?.cardInstanceId;
        const rocketId = root.match?.cardPlayContext?.lastLanding?.rocketId ?? null;
        const picked = aliens.chong.pickupPlanetFossil(
          alienState,
          actor,
          legal.target.fossilId,
          {
            rocketId,
            cardId: cardInstanceId,
          },
        );
        if (!picked.ok) return picked;
        // 生成化石搬运棋子（CHONG_FOSSIL）到探测器落点坐标：可移动、可随盘旋转，
        // 到达目的地主星后触发虫族任务完成。坐标在登陆时已记录（lastLanding.sectorX/Y），
        // 因为登陆后探测器已从盘面移除，不能再从 pieces.rockets 取坐标。
        const lastLanding = root.match?.cardPlayContext?.lastLanding || {};
        const sectorCoordinate = (Number.isInteger(Number(lastLanding.sectorX))
          && Number.isInteger(Number(lastLanding.sectorY)))
          ? { x: Number(lastLanding.sectorX), y: Number(lastLanding.sectorY) }
          : null;
        if (sectorCoordinate) {
          const piecesState = getWorkingSlice(root, "pieces");
          const created = rockets.createMovableTokenAtSector(
            piecesState,
            sectorCoordinate,
            {
              root,
              kind: rockets.ROCKET_KIND.CHONG_FOSSIL,
              playerId: actor.id,
              color: actor.color || null,
              fossilId: legal.target.fossilId,
            },
          );
          if (!created.ok) return created;
        }
        return cardEffectResult(state, root, sessionEffect, {
          events: [{
            type: "chong_fossil_picked",
            playerId: actor.id,
            fossilId: legal.target.fossilId,
            rocketId,
          }],
          historyType: "card_effect_decision",
          history: { choiceId: legal.target.choiceId, fossilId: legal.target.fossilId },
        });
      }
      if (effect.type === aliens.chong?.EFFECT_TYPES?.CHONG_PROBE_PLANET_FOSSIL_REWARD) {
        // 生态系统研究：结算选中的 1 枚化石奖励（不移除化石）
        const alienState = getWorkingSlice(root, "aliens");
        const spawnedEffects = [];
        let irreversible = null;
        const applied = aliens.chong.applyFossilRewardOnly(
          alienState,
          actor,
          legal.target.fossilId,
          {
            gainResources(gain) { players.gainResources(actor, gain, "cardEffectScore"); },
            gainData() {
              const result = data.gainData(actor, { source: "chong_fossil_reward", root });
              if (!result.ok) return result;
              return result;
            },
            blindDraw() {
              const drawCtx = cards.createCardDrawContext(
                getWorkingSlice(root, "cards"),
                getWorkingSlice(root, "players"),
                () => nextCommittedRandom(root),
                { root },
              );
              const drawn = drawCtx.blindDraw(actor);
              if (!drawn.ok) return drawn;
              irreversible = { code: "hidden_card_draw", reason: "虫族化石奖励盲抽翻开隐藏牌" };
              return drawn;
            },
            pickCard() {
              spawnedEffects.push({
                priority: "direct",
                effect: {
                  type: cardEffects.REWARD_TYPES.PICK_CARD,
                  kind: "decision",
                  decisionKind: "choose_card",
                  ownerId: actor.id,
                  payload: {},
                },
              });
            },
          },
        );
        if (!applied.ok) return applied;
        return cardEffectResult(state, root, sessionEffect, {
          spawnedEffects,
          irreversible,
          events: [{
            type: "chong_fossil_reward_settled",
            playerId: actor.id,
            fossilId: legal.target.fossilId,
            reward: applied.reward,
          }],
          historyType: "card_effect_decision",
          history: { choiceId: legal.target.choiceId, fossilId: legal.target.fossilId },
        });
      }
      if (effect.type === aliens.chong?.EFFECT_TYPES?.CHONG_LAND_FOR_PICKUP
        || effect.type === aliens.chong?.EFFECT_TYPES?.CHONG_ORBIT_OR_LAND_FOR_PICKUP) {
        // 虫族登陆/环绕牌：结算选中的登陆/环绕目标，之后由 CHONG_PICKUP_FOSSIL 拾取化石。
        const actionType = legal.target.actionType || "land";
        return resolvePlanet(state, sessionEffect, choice, workingContext, actionType);
      }
      if (effect.type === aliens.amiba?.EFFECT_TYPES?.CHOOSE_SYMBOL_REWARD) {
        // 结算玩家选中的阿米巴细胞器（symbol）：移动 + 发放奖励
        const alienState = getWorkingSlice(root, "aliens");
        const resolved = aliens.amiba.resolveSymbolAtSlot(alienState, legal.target.slotId);
        if (!resolved?.ok) return resolved;
        const reward = resolved.reward || {};
        let irreversible = null;
        if (reward.gain) players.gainResources(actor, reward.gain, "alienEffectScore");
        const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
        for (let dataIndex = 0; dataIndex < dataCount; dataIndex += 1) {
          const gained = data.gainData(actor, { source: "amiba_region_reward", root });
          if (!gained.ok) return gained;
        }
        const drawCount = Math.max(0, Math.round(Number(reward.drawCards) || 0));
        if (drawCount > 0) {
          const drawCtx = cards.createCardDrawContext(
            getWorkingSlice(root, "cards"),
            getWorkingSlice(root, "players"),
            () => nextCommittedRandom(root),
            { root },
          );
          for (let drawIndex = 0; drawIndex < drawCount; drawIndex += 1) {
            const drawn = drawCtx.blindDraw(actor);
            if (!drawn.ok) return drawn;
          }
        }
        if (drawCount > 0) {
          irreversible = { code: "hidden_card_draw", reason: "阿米巴细胞器奖励盲抽翻开隐藏牌" };
        }
        // 选细胞器的顺序影响最终位置：结算一个后若区域内还有细胞器位，
        // 继续让玩家选择下一个（每结算一个 symbol 就移动一次）。
        // 结算次数上限由来源决定：放置痕迹/移除痕迹触发区域结算 maxSettles=3
        // （蓝/红/橙各 3 个细胞器位）；卡牌任务奖励（如阿米巴1拿科技）默认 1 个。
        const spawnedEffects = [];
        const settledCount = Math.max(0, Number(sessionEffect.payload?.settledCount) || 0) + 1;
        const maxSettles = Math.max(1, Number(sessionEffect.payload?.maxSettles) || 1);
        if (settledCount < maxSettles && aliens.amiba.listSymbolsInRegion(alienState, legal.target.region).length) {
          spawnedEffects.push({
            priority: "direct",
            effect: {
              type: genericEffectRuntimeType(aliens.amiba.EFFECT_TYPES.CHOOSE_SYMBOL_REWARD, true),
              kind: "decision",
              decisionKind: "choose_target",
              ownerId: actor.id,
              payload: {
                ...clone(sessionEffect.payload),
                settledCount,
              },
            },
          });
        }
        return cardEffectResult(state, root, sessionEffect, {
          spawnedEffects,
          events: [{
            type: "amiba_symbol_resolved",
            symbolId: resolved.symbolId,
            slotId: legal.target.slotId,
            region: legal.target.region,
          }],
          irreversible,
          historyType: "card_effect_decision",
          history: { choiceId: legal.target.choiceId, symbolId: resolved.symbolId },
        });
      }
      if (effect.type === aliens.amiba?.EFFECT_TYPES?.REMOVE_TRACE_FOR_REGION_REWARD) {
        // 移除自己的痕迹并结算该痕迹所在区域的 symbol 奖励
        const alienState = getWorkingSlice(root, "aliens");
        const revealedSlotId = alienState?.amiba?.revealedSlotId || null;
        if (!revealedSlotId) return fail("AMIBA_SLOT_NOT_REVEALED", "阿米巴尚未揭示");
        const removed = aliens.amiba.removePlayerTrace(
          alienState,
          revealedSlotId,
          legal.target.traceType,
          legal.target.position,
          actor,
        );
        if (!removed.ok) return removed;
        const region = legal.target.region || removed.reward?.region || null;
        const spawnedEffects = [];
        // 统一区域结算：移除痕迹后让玩家逐个选择该区域细胞器（symbol），
        // 选择顺序决定 symbol 移动后的位置。
        if (region && aliens.amiba.listSymbolsInRegion(alienState, region).length) {
          spawnedEffects.push({
            priority: "direct",
            effect: {
              type: genericEffectRuntimeType(aliens.amiba.EFFECT_TYPES.CHOOSE_SYMBOL_REWARD, true),
              kind: "decision",
              decisionKind: "choose_target",
              ownerId: actor.id,
              payload: {
                cardEffect: {
                  type: aliens.amiba.EFFECT_TYPES.CHOOSE_SYMBOL_REWARD,
                  options: { region },
                },
                cardInstanceId: null,
                // 移除痕迹结算区域：结算区域内全部细胞器（最多 3 个）
                maxSettles: 3,
              },
            },
          });
        }
        return cardEffectResult(state, root, sessionEffect, {
          spawnedEffects,
          events: removed.ok ? [{ type: "amiba_trace_removed", traceType: legal.target.traceType, position: legal.target.position, region }] : [],
          historyType: "card_effect_decision",
          history: { choiceId: legal.target.choiceId, region },
        });
      }
      if ([
        cardEffects.EFFECT_TYPES.CARD_MOVE,
        cardEffects.EFFECT_TYPES.FREE_MOVE,
        cardEffects.EFFECT_TYPES.COUNT_HAND_CORNER_MOVE,
        cardEffects.EFFECT_TYPES.EARTH_SECTOR_CONTENT_MOVE,
      ].includes(effect.type)) return resolveMove(state, sessionEffect, choice, workingContext);
      if (effect.type === cardEffects.EFFECT_TYPES.CARD_ORBIT) {
        return resolvePlanet(state, sessionEffect, choice, workingContext, "orbit");
      }
      if (effect.type === cardEffects.EFFECT_TYPES.CARD_LAND) {
        return resolvePlanet(state, sessionEffect, choice, workingContext, "land");
      }
      const cardsState = getWorkingSlice(root, "cards");
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
          cards.addToDiscardPile(cardsState, removed.card);
          const gain = cards.getIncomeGainForCard(removed.card);
          if (gain) {
            // 统一抽牌上下文：收入盲抽共用 cards.createCardDrawContext
            const drawCtx = cards.createCardDrawContext(
              cardsState,
              getWorkingSlice(root, "players"),
              () => nextCommittedRandom(root),
              { root },
            );
            players.gainIncome(actor, gain, {
              blindDraw: (target) => drawCtx.blindDraw(target),
              gainData: (target) => data.gainData(target, { source: "card_income", root }),
            });
          }
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
          cards.addToDiscardPile(cardsState, removed.card);
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
        const index = cardsState.publicCards.findIndex((card) => card?.id === legal.target.cardInstanceId);
        const card = cardsState.publicCards[index];
        cardsState.publicCards[index] = null;
        cards.addToDiscardPile(cardsState, card);
        spawnedEffects = spawnCardEffects(cornerEffects(card), sessionEffect);
        // 统一抽牌上下文：公共牌补牌共用 cards.createCardDrawContext
        const drawCtx = cards.createCardDrawContext(
          cardsState,
          getWorkingSlice(root, "players"),
          () => nextCommittedRandom(root),
          { root },
        );
        cards.replenishPublicSlot(
          cardsState,
          getWorkingSlice(root, "players"),
          index,
          () => nextCommittedRandom(root),
          { createCardInstance: drawCtx.createCardInstance },
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
      } else if (effect.type === cardEffects.EFFECT_TYPES.PICK_CARD_CORNER_REWARD) {
        const index = cardsState.publicCards.findIndex((card) => card?.id === legal.target.cardInstanceId);
        // 统一抽牌上下文：精选公共牌共用 cards.createCardDrawContext
        const drawCtx = cards.createCardDrawContext(
          cardsState,
          getWorkingSlice(root, "players"),
          () => nextCommittedRandom(root),
          { root },
        );
        const result = drawCtx.pickFromPublic(actor, index);
        if (!result.ok) return result;
        spawnedEffects = spawnCardEffects(cornerEffects(result.card), sessionEffect);
      } else if (effect.type === cardEffects.EFFECT_TYPES.RETURN_UNFINISHED_TASK_TO_HAND) {
        const index = actor.reservedCards.findIndex((card) => card.id === legal.target.cardInstanceId);
        const [card] = actor.reservedCards.splice(index, 1);
        actor.hand.push(card);
        actor.resources.handSize = actor.hand.length;
      } else if (effect.type === cardEffects.EFFECT_TYPES.REMOVE_PLANET_MARKER) {
        const state = getWorkingSlice(root, "planets");
        const planet = state.planets?.[legal.target.planetId];
        const key = legal.target.kind === "orbit" ? "orbitMarkers" : "landingMarkers";
        const markers = planet?.[key] || [];
        const [marker] = markers.splice(legal.target.index, 1);
      } else if (effect.type === cardEffects.EFFECT_TYPES.PROBE_LOCATION_REWARD) {
        const rocket = listPlayerRockets(root, actor.id)
          .find((entry) => String(entry.id) === String(legal.target.rocketId));
        const content = solar.resolveVisibleContent(
          getWorkingSlice(root, "solarSystem"),
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
        const alienState = getWorkingSlice(root, "aliens");
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
          }, "alienEffectScore");
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
      [cardEffects.EFFECT_TYPES.CHOOSE_HAND_CORNER_REWARD]: { decisionKind: "choose_card" },
      [cardEffects.EFFECT_TYPES.CONDITIONAL_REWARD]: {},
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
      [cardEffects.EFFECT_TYPES.FREE_MOVE]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.OPTIONAL_DISCARD_SCAN]: { decisionKind: "choose_card" },
      [cardEffects.EFFECT_TYPES.CARD_ORBIT]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.PAY_CREDITS_FOR_REWARD]: { decisionKind: "choose_reward" },
      [cardEffects.EFFECT_TYPES.PICK_CARD_CORNER_REWARD]: { decisionKind: "choose_card" },
      [cardEffects.EFFECT_TYPES.PLANET_SECTOR_SCAN]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.PROBE_LOCATION_REWARD]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.PROBE_SECTOR_SCAN]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.PROBE_STACK_REWARD]: {},
      [cardEffects.EFFECT_TYPES.COUNT_ROCKETS_REWARD]: {},
      [cardEffects.EFFECT_TYPES.REGISTER_EVENT_BONUS]: {},
      [cardEffects.EFFECT_TYPES.REMOVE_PLANET_MARKER]: { decisionKind: "choose_target" },
      [cardEffects.EFFECT_TYPES.RETURN_PLAYED_CARD_TO_HAND_IF]: {},
      [cardEffects.EFFECT_TYPES.RETURN_UNFINISHED_TASK_TO_HAND]: { decisionKind: "choose_card" },
      [aliens.amiba?.EFFECT_TYPES?.CHOOSE_SYMBOL_REWARD]: { decisionKind: "choose_target" },
      [aliens.amiba?.EFFECT_TYPES?.REMOVE_TRACE_FOR_REGION_REWARD]: { decisionKind: "choose_target" },
      [aliens.chong?.EFFECT_TYPES?.CHONG_LAND_FOR_PICKUP]: { decisionKind: "choose_target" },
      [aliens.chong?.EFFECT_TYPES?.CHONG_ORBIT_OR_LAND_FOR_PICKUP]: { decisionKind: "choose_target" },
      [aliens.chong?.EFFECT_TYPES?.CHONG_PICKUP_FOSSIL]: { decisionKind: "choose_target" },
      [aliens.chong?.EFFECT_TYPES?.CHONG_PROBE_PLANET_FOSSIL_REWARD]: { decisionKind: "choose_target" },
    });

    for (const [effectType, descriptor] of Object.entries(GENERIC_EFFECT_DESCRIPTORS)) {
      const runtimeType = genericEffectRuntimeType(effectType);
      runtime.registerExecutor(runtimeType, genericExecute);
      if (descriptor.decisionKind) {
        runtime.registerExecutor(genericEffectRuntimeType(effectType, true), {
          getLegalChoices(state, sessionEffect, workingContext) {
            const root = getWorkingRoot(state, workingContext);
            const choices = listGenericChoices(root, sessionEffect);
            return getScienceDomain().formalizeChoices(
              root,
              sessionEffect.ownerId,
              choices,
            );
          },
          resolveDecision: genericResolve,
        });
      }
      if (effectType === cardEffects.EFFECT_TYPES.DRAW_THEN_SCAN) {
        runtime.registerExecutor(genericEffectRuntimeType(effectType, true), {
          getLegalChoices(state, sessionEffect, workingContext) {
            const root = getWorkingRoot(state, workingContext);
            return getScienceDomain().formalizeChoices(
              root,
              sessionEffect.ownerId,
              listGenericChoices(root, sessionEffect),
            );
          },
          resolveDecision: genericResolve,
        });
      }
    }

    // 异常点专属 playEffects 执行器：y0 异常扇区信号得分 / y1 下一异常奖励 /
    // y4 拿公共牌全部 / y9 发射后异常移动。
    function applyYichangdianAnomalyReward(root, actor, anomaly, cardInstanceId, reward) {
      const events = [];
      const spawnedEffects = [];
      if (reward.gain && Object.keys(reward.gain).some((key) => Number(reward.gain[key]) !== 0)) {
        players.gainResources(actor, reward.gain, "alienEffectScore");
        events.push({ type: "yichangdian_anomaly_reward", markerId: anomaly.markerId, gain: clone(reward.gain) });
      }
      const dataCount = Math.max(0, Math.round(Number(reward.dataCount) || 0));
      for (let index = 0; index < dataCount; index += 1) {
        const gained = data.gainData(actor, { source: "yichangdian_anomaly", root });
        if (!gained.ok) return gained;
      }
      if (reward.pickCard) {
        spawnedEffects.push(createSpawnedCardEffect({
          id: `y1-pick-${anomaly.markerId}`,
          type: cardEffects.REWARD_TYPES.PICK_CARD,
          label: "异常奖励：精选 1 张牌",
          options: {},
        }, actor.id, cardInstanceId));
      }
      if (reward.traceType) {
        spawnedEffects.push(createSpawnedCardEffect({
          id: `y1-trace-${anomaly.markerId}`,
          type: cardEffects.REWARD_TYPES.ALIEN_TRACE,
          label: "异常奖励：外星人痕迹",
          options: { allowedTraceTypes: [reward.traceType] },
        }, actor.id, cardInstanceId));
      }
      return { events, spawnedEffects };
    }

    function executeYichangdianAnomalySignalScore(state, sessionEffect, workingContext) {
      const root = getWorkingRoot(state, workingContext);
      const actor = getActor(root, sessionEffect.ownerId);
      if (!actor) return fail("CARD_YICHANGDIAN_OWNER_STALE", "异常点效果 owner 已失效");
      const alienState = getWorkingSlice(root, "aliens");
      const lastScanNebulaId = root.match?.cardPlayContext?.lastScanNebulaId;
      if (!lastScanNebulaId || typeof yichangdian?.getAnomalyBySectorX !== "function") {
        return cardEffectResult(state, root, sessionEffect, { event: { skipped: true, reason: "no_last_scan" } });
      }
      const sectorX = getNebulaSectorX(root, lastScanNebulaId);
      const anomaly = sectorX == null ? null : yichangdian.getAnomalyBySectorX(alienState, sectorX);
      if (!anomaly) {
        return cardEffectResult(state, root, sessionEffect, { event: { skipped: true, reason: "scan_sector_not_anomaly" } });
      }
      const reward = typeof yichangdian.getAnomalyReward === "function"
        ? (yichangdian.getAnomalyReward(anomaly.markerId) || {})
        : {};
      const applied = applyYichangdianAnomalyReward(
        root, actor, anomaly, sessionEffect.payload?.cardInstanceId || null, reward,
      );
      if (!applied.ok) return applied;
      return cardEffectResult(state, root, sessionEffect, {
        events: [{ type: "yichangdian_anomaly_signal_score", nebulaId: lastScanNebulaId, markerId: anomaly.markerId }, ...applied.events],
        spawnedEffects: applied.spawnedEffects,
      });
    }

    function executeYichangdianNextAnomalyReward(state, sessionEffect, workingContext) {
      const root = getWorkingRoot(state, workingContext);
      const actor = getActor(root, sessionEffect.ownerId);
      if (!actor) return fail("CARD_YICHANGDIAN_OWNER_STALE", "异常点效果 owner 已失效");
      const alienState = getWorkingSlice(root, "aliens");
      const earth = solar.createSolarSnapshot(getWorkingSlice(root, "solarSystem"))
        .planetLocations?.find((planet) => planet.planetId === "earth");
      const hasModule = typeof yichangdian?.getNextAnomalySectorX === "function"
        && typeof yichangdian.getAnomalyBySectorX === "function"
        && typeof yichangdian.getAnomalyReward === "function";
      if (!earth || !hasModule) {
        return cardEffectResult(state, root, sessionEffect, { event: { skipped: true, reason: "no_anomaly_target" } });
      }
      const nextX = yichangdian.getNextAnomalySectorX(alienState, earth.x);
      const anomaly = nextX == null ? null : yichangdian.getAnomalyBySectorX(alienState, nextX);
      if (!anomaly) {
        return cardEffectResult(state, root, sessionEffect, { event: { skipped: true, reason: "no_anomaly" } });
      }
      const reward = yichangdian.getAnomalyReward(anomaly.markerId) || {};
      const applied = applyYichangdianAnomalyReward(
        root, actor, anomaly, sessionEffect.payload?.cardInstanceId || null, reward,
      );
      if (!applied.ok) return applied;
      return cardEffectResult(state, root, sessionEffect, {
        events: applied.events,
        spawnedEffects: applied.spawnedEffects,
      });
    }

    function executeYichangdianPublicAll(state, sessionEffect, workingContext) {
      const root = getWorkingRoot(state, workingContext);
      const actor = getActor(root, sessionEffect.ownerId);
      if (!actor) return fail("CARD_YICHANGDIAN_OWNER_STALE", "异常点效果 owner 已失效");
      const cardsState = getWorkingSlice(root, "cards");
      const slots = (cardsState.publicCards || []).map((card, index) => ({ card, index }))
        .filter((entry) => Boolean(entry.card));
      if (!slots.length) {
        return cardEffectResult(state, root, sessionEffect, { event: { skipped: true, reason: "no_public_cards" } });
      }
      // 统一抽牌上下文：异常点拿全部公共牌共用 cards.createCardDrawContext
      const drawCtx = cards.createCardDrawContext(
        cardsState,
        getWorkingSlice(root, "players"),
        () => nextCommittedRandom(root),
        { root },
      );
      const taken = [];
      for (const entry of slots) {
        const picked = drawCtx.pickFromPublic(actor, entry.index);
        if (!picked.ok) return picked;
        taken.push(picked.card);
      }
      return cardEffectResult(state, root, sessionEffect, {
        events: [{ type: "yichangdian_public_all", count: taken.length, cardIds: taken.map((card) => card.id) }],
        irreversible: { code: "hidden_card_reveal", reason: "拿公共牌后补牌翻出隐藏牌" },
      });
    }

    function executeYichangdianLaunchAnomalyMove(state, sessionEffect, workingContext) {
      const root = getWorkingRoot(state, workingContext);
      const actor = getActor(root, sessionEffect.ownerId);
      if (!actor) return fail("CARD_YICHANGDIAN_OWNER_STALE", "异常点效果 owner 已失效");
      const alienState = getWorkingSlice(root, "aliens");
      const earth = solar.createSolarSnapshot(getWorkingSlice(root, "solarSystem"))
        .planetLocations?.find((planet) => planet.planetId === "earth");
      const inAnomaly = Boolean(earth) && typeof yichangdian?.getAnomalyBySectorX === "function"
        && Boolean(yichangdian.getAnomalyBySectorX(alienState, earth.x));
      if (!inAnomaly) {
        return cardEffectResult(state, root, sessionEffect, { event: { skipped: true, reason: "earth_not_in_anomaly" } });
      }
      return cardEffectResult(state, root, sessionEffect, {
        spawnedEffects: [createSpawnedCardEffect({
          id: "y9-anomaly-move",
          type: cardEffects.EFFECT_TYPES.CARD_MOVE,
          label: "异常扇区：1 移动",
          options: { movementPoints: 1 },
        }, actor.id, sessionEffect.payload?.cardInstanceId || null)],
        events: [{ type: "yichangdian_launch_anomaly_move", playerId: actor.id }],
      });
    }

    function executeYichangdianNextAnomalyScan(state, sessionEffect, workingContext) {
      const root = getWorkingRoot(state, workingContext);
      const actor = getActor(root, sessionEffect.ownerId);
      if (!actor) return fail("CARD_YICHANGDIAN_OWNER_STALE", "异常点效果 owner 已失效");
      const alienState = getWorkingSlice(root, "aliens");
      const solarSystem = getWorkingSlice(root, "solarSystem");
      const earth = solar.createSolarSnapshot(solarSystem)
        .planetLocations?.find((planet) => planet.planetId === "earth");
      if (!earth || typeof yichangdian?.getNextAnomalySectorX !== "function") {
        return cardEffectResult(state, root, sessionEffect, { event: { skipped: true, reason: "no_anomaly_target" } });
      }
      const nextX = yichangdian.getNextAnomalySectorX(alienState, earth.x);
      const nebulaId = nextX == null
        ? null
        : (solar.getNebulaAtCoordinate(nextX, 5, solarSystem.sectorBySlot)?.id || null);
      if (!nebulaId) {
        return cardEffectResult(state, root, sessionEffect, { event: { skipped: true, reason: "no_anomaly_nebula" } });
      }
      const result = getScienceDomain().executeNebulaScan(root, actor.id, {
        family: "choose_target",
        target: { choiceId: `nebula:${nebulaId}`, nebulaId },
        payload: { gainData: true },
      }, {
        nebulaIds: [nebulaId],
        gainData: true,
        source: "yichangdian_anomaly_scan",
        label: "异常扇区扫描",
      });
      if (!result.ok) return result;
      return {
        ok: true,
        nextState: commitWorkingState(state, { source: sessionEffect.payload?.cardEffect?.type || EFFECT_TYPES.EFFECT }),
        // 统一扇区结算：卡牌异常扇区扫描替换 token 后检查一次扇区完成。
        spawnedEffects: [getScienceDomain().settleAfterScan(actor.id)],
        events: clone(result.events || []),
        history: [{ type: "card_effect", effectId: sessionEffect.payload?.cardEffect?.id || null, executorId: EXECUTOR_ID }],
      };
    }

    function executeYichangdianDrawThenTwoCorners(state, sessionEffect, workingContext) {
      const root = getWorkingRoot(state, workingContext);
      const actor = getActor(root, sessionEffect.ownerId);
      if (!actor) return fail("CARD_YICHANGDIAN_OWNER_STALE", "异常点效果 owner 已失效");
      // 统一抽牌上下文：异常点盲抽共用 cards.createCardDrawContext
      const drawCtx = cards.createCardDrawContext(
        getWorkingSlice(root, "cards"),
        getWorkingSlice(root, "players"),
        () => nextCommittedRandom(root),
        { root },
      );
      const drawn = [];
      for (let index = 0; index < 3; index += 1) {
        const result = drawCtx.blindDraw(actor);
        if (!result.ok) return result;
        drawn.push(result.card);
      }
      const spawnedEffects = [];
      for (let index = 0; index < 2; index += 1) {
        spawnedEffects.push(createSpawnedCardEffect({
          id: `y8-corner-${index + 1}`,
          type: cardEffects.EFFECT_TYPES.CHOOSE_HAND_CORNER_REWARD,
          label: `结算角标 ${index + 1}/2`,
          options: {},
        }, actor.id, sessionEffect.payload?.cardInstanceId || null));
      }
      return {
        ok: true,
        nextState: commitWorkingState(state, { source: sessionEffect.payload?.cardEffect?.type || EFFECT_TYPES.EFFECT }),
        spawnedEffects,
        events: [{ type: "yichangdian_draw_then_two_corners", drawn: drawn.map((card) => card.id) }],
        irreversible: { code: "hidden_card_draw", reason: "盲抽 3 张翻开隐藏牌" },
      };
    }

    runtime.registerExecutor(
      genericEffectRuntimeType(cardEffects.EFFECT_TYPES.YICHANGDIAN_ANOMALY_SIGNAL_SCORE),
      (state, sessionEffect, workingContext) => executeYichangdianAnomalySignalScore(state, sessionEffect, workingContext),
    );
    runtime.registerExecutor(
      genericEffectRuntimeType(cardEffects.EFFECT_TYPES.YICHANGDIAN_DRAW_THEN_TWO_CORNERS),
      (state, sessionEffect, workingContext) => executeYichangdianDrawThenTwoCorners(state, sessionEffect, workingContext),
    );
    runtime.registerExecutor(
      genericEffectRuntimeType(cardEffects.EFFECT_TYPES.YICHANGDIAN_NEXT_ANOMALY_SCAN),
      (state, sessionEffect, workingContext) => executeYichangdianNextAnomalyScan(state, sessionEffect, workingContext),
    );
    runtime.registerExecutor(
      genericEffectRuntimeType(cardEffects.EFFECT_TYPES.YICHANGDIAN_NEXT_ANOMALY_REWARD),
      (state, sessionEffect, workingContext) => executeYichangdianNextAnomalyReward(state, sessionEffect, workingContext),
    );
    runtime.registerExecutor(
      genericEffectRuntimeType(cardEffects.EFFECT_TYPES.YICHANGDIAN_PUBLIC_ALL),
      (state, sessionEffect, workingContext) => executeYichangdianPublicAll(state, sessionEffect, workingContext),
    );
    runtime.registerExecutor(
      genericEffectRuntimeType(cardEffects.EFFECT_TYPES.YICHANGDIAN_LAUNCH_ANOMALY_MOVE),
      (state, sessionEffect, workingContext) => executeYichangdianLaunchAnomalyMove(state, sessionEffect, workingContext),
    );

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
    buildProbeLocationData,
  });
});
