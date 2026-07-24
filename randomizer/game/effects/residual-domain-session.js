(function (root, factory) {
  "use strict";
  let standardAction = root.SetiStandardAction;
  let science = root.SetiScienceSession;
  let players = root.SetiPlayers;
  let cards = root.SetiCards;
  let data = root.SetiData;
  let industry = root.SetiIndustry;
  let industryAbilities = root.SetiIndustryAbilities;
  let gameAbilities = root.SetiAbilities;
  let strategy = root.SetiIndustryStrategyPassive;
  let tech = root.SetiTech;
  let aliens = root.SetiAliens;
  let finalScoring = root.SetiFinalScoring;
  let endGameScoring = root.SetiEndGameScoring;
  let cardEffects = root.SetiCardEffects;
  let cardTaskState = root.SetiCardTaskState;
  let cardPlayDomain = root.SetiCardPlayDomain;
  let jiuzhe = root.SetiAlienJiuzhe;
  let yichangdian = root.SetiAlienYichangdian;
  let banrenma = root.SetiAlienBanrenma;
  let fangzhou = root.SetiAlienFangzhou;
  let chong = root.SetiAlienChong;
  let amiba = root.SetiAlienAmiba;
  let aomomo = root.SetiAlienAomomo;
  let runezu = root.SetiAlienRunezu;
  if (typeof require === "function") {
    standardAction = standardAction || require("../actions/standard-action");
    science = science || require("./science-session");
    players = players || require("../players");
    cards = cards || require("../cards/deck");
    data = data || require("../data");
    industry = industry || require("../industry");
    industryAbilities = industryAbilities || require("../industry/abilities");
    gameAbilities = gameAbilities || require("../abilities");
    strategy = strategy || require("../industry/strategy-passive");
    tech = tech || require("../tech");
    aliens = aliens || require("../aliens");
    finalScoring = finalScoring || require("../final-scoring");
    endGameScoring = endGameScoring || require("../end-game-scoring");
    cardEffects = cardEffects || require("../cards/effects");
    cardTaskState = cardTaskState || require("../cards/task-state");
    cardPlayDomain = cardPlayDomain || require("../cards/play-domain");
    jiuzhe = jiuzhe || require("../aliens/jiuzhe");
    yichangdian = yichangdian || require("../aliens/yichangdian");
    banrenma = banrenma || require("../aliens/banrenma");
    fangzhou = fangzhou || require("../aliens/fangzhou");
    chong = chong || require("../aliens/chong");
    amiba = amiba || require("../aliens/amiba");
    aomomo = aomomo || require("../aliens/aomomo");
    runezu = runezu || require("../aliens/runezu");
  }
  const api = factory(
    standardAction, science, players, cards, data, industry, industryAbilities,
    gameAbilities, strategy, tech, aliens, finalScoring, endGameScoring,
    cardEffects, cardTaskState, cardPlayDomain,
    { jiuzhe, yichangdian, banrenma, fangzhou, chong, amiba, aomomo, runezu },
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiResidualDomainSession = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  standardAction, science, players, cards, data, industry, industryAbilities,
  gameAbilities, strategy, tech, aliens, finalScoring, endGameScoring,
  cardEffects, cardTaskState, cardPlayDomain, speciesModules,
) {
  "use strict";

  const DOMAIN_ID = "residual_domains";
  const EXECUTOR_ID = `${DOMAIN_ID}:executor:v1`;
  const ACTION_FAMILIES = Object.freeze(["industry", "card_corner", "runezu_face_symbol"]);
  const HANDOFF_TYPE = "game_domain_handoff";
  const HANDOFF_SCHEMA = "seti-game-domain-handoff-v1";
  const EFFECT_TYPES = Object.freeze({
    EXECUTE: "residual_company_execute",
    COMPANY_DECISION: "residual_company_decision",
    CARD_DECISION: "residual_card_decision",
    ALIEN_CARD_DECISION: "residual_alien_card_decision",
    FINAL_MARK: "residual_final_mark",
  });
  const SPECIES_IDS = Object.freeze([
    "jiuzhe", "yichangdian", "banrenma", "fangzhou",
    "chong", "amiba", "aomomo", "runezu",
  ]);
  const SPECIES_MODULES = Object.freeze(speciesModules);
  const { chong, amiba, aomomo, runezu } = SPECIES_MODULES;
  const SPECIES_KEY_BY_ALIEN_ID = Object.freeze(Object.fromEntries(
    Object.entries(SPECIES_MODULES).map(([key, module]) => [module.ALIEN_ID, key]),
  ));
  const SCORE_SOURCE_KEYS = Object.freeze([
    "initialScore", "scanScore", "techBonusScore", "blueTechScore",
    "cardQuickScore", "cardEffectScore", "taskCardScore", "orbitScore",
    "landScore", "alienTracePinkScore", "alienTraceYellowScore",
    "alienTraceBlueScore", "alienCardQuickScore", "alienEffectScore",
    "industryEffectScore",
  ]);

  const clone = (value) => value == null ? value : structuredClone(value);
  const fail = (code, message, details = {}) => ({ ok: false, code, message, ...details });
  const getRoot = (state, context) => context?.workingRoot || context || state;
  const actor = (root, ownerId) => (root.playerState?.players || [])
    .find((player) => player.id === ownerId) || null;
  const roundOf = (root) => Math.max(1, Number(root.turnState?.roundNumber) || 1);
  const turnOf = (root) => Math.max(1, Number(root.turnState?.turnNumber) || 1);

  function nextRandom(root) {
    if (!root.meta) throw new TypeError("Residual domain RNG 缺少 committed meta");
    root.meta.rngState = root.meta.rngState || {};
    const previous = root.meta.rngState.residualDomains || {};
    let state = Number.isSafeInteger(previous.state)
      ? previous.state >>> 0
      : [...String(root.meta.seed ?? "seti-residual")]
        .reduce((hash, char) => Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0, 2166136261);
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    root.meta.rngState.residualDomains = {
      algorithm: "mulberry32-v1",
      state,
      cursor: (Number(previous.cursor) || 0) + 1,
    };
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  function formalize(root, ownerId, descriptors) {
    return science.formalizeChoices(root, ownerId, descriptors);
  }

  function choice(family, choiceId, target, payload, summary) {
    return {
      family,
      phase: "conditional",
      target: { kind: "residual-domain", choiceId, ...target },
      payload: payload || {},
      summary,
    };
  }

  function canStartCompany(root, player) {
    if (!player) return fail("COMPANY_OWNER_MISSING", "没有当前玩家");
    if (root.match?.pendingDecision) return fail("COMPANY_PENDING_DECISION", "请先完成当前选择");
    if ((root.turnState?.passedPlayerIds || []).includes(player.id) || player.passCompletionPending) {
      return fail("COMPANY_AFTER_PASS", "PASS 后不能执行公司行动");
    }
    const label = industry.getPlayerIndustryLabel(player);
    if (!label) return fail("COMPANY_MISSING", "玩家没有正式公司");
    const active = industryAbilities.canStartActiveAbility(player, label);
    if (!active.ok) return active;
    const mark = industry.canMarkIndustryAction(player, roundOf(root), { turnNumber: turnOf(root) });
    return mark.ok ? { ok: true, label, abilityId: active.abilityId } : mark;
  }

  function createActionDefinitions() {
    return [standardAction.createOptionDefinition("industry", {
      label: "公司",
      getOptions(context) {
        const root = context.workingRoot || context;
        const owner = context.standardActionAuthority?.actorId
          || context.playerState?.currentPlayerId
          || root.playerState?.currentPlayerId;
        const check = canStartCompany(root, actor(root, owner));
        return check.ok ? {
          ok: true,
          choices: [{
            target: { companyId: check.label, abilityId: check.abilityId },
            label: `${check.label} 1x 行动`,
          }],
        } : check;
      },
      canExecute(context, option) {
        const listed = this.getOptions(context);
        const legal = listed.ok && listed.choices.some((entry) => (
          entry.target.companyId === option.target?.companyId
          && entry.target.abilityId === option.target?.abilityId
        ));
        return legal ? { ok: true } : fail("COMPANY_ACTION_STALE", "公司行动已失效");
      },
      execute() {
        return fail("COMPANY_SESSION_REQUIRED", "公司行动必须由 Effect Session 执行");
      },
    }), standardAction.createOptionDefinition("card_corner", {
      label: "弃牌角标",
      getOptions(context) {
        const root = context.workingRoot || context;
        const ownerId = context.standardActionAuthority?.actorId
          || context.playerState?.currentPlayerId
          || root.playerState?.currentPlayerId;
        const player = actor(root, ownerId);
        if (!player || root.match?.pendingDecision
          || (root.turnState?.passedPlayerIds || []).includes(ownerId)) {
          return fail("CARD_CORNER_BLOCKED", "当前不能执行弃牌角标");
        }
        const multiplier = industry.shouldDoubleDiscardCornerRewards?.(player) ? 2 : 1;
        const choices = (player.hand || []).flatMap((card) => {
          const resource = cards.getDiscardActionRewardForCard(card);
          const move = cards.getDiscardActionMoveRewardForCard?.(card);
          const runezuMatch = runezu.isRunezuCard(card)
            ? String(card.discardActionCode || "").match(/^s_([1-7])$/)
            : null;
          const kind = SPECIES_MODULES.fangzhou.isFangzhouCard2(card)
            ? "fangzhou_basic"
            : runezuMatch ? "runezu_symbol" : move ? "move" : resource ? "resource" : null;
          if (!kind) return [];
          return [{
            target: { cardInstanceId: card.id },
            payload: {
              kind,
              multiplier,
              ...(runezuMatch ? { symbolId: `symbol_${runezuMatch[1]}` } : {}),
            },
            label: `${cards.getCardLabel(card)}：弃牌角标`,
          }];
        });
        return choices.length ? { ok: true, choices } : fail("CARD_CORNER_EMPTY", "没有可用弃牌角标");
      },
      canExecute(context, option) {
        const listed = this.getOptions(context);
        return listed.ok && listed.choices.some((entry) => (
          entry.target.cardInstanceId === option.target?.cardInstanceId
          && entry.payload.kind === option.payload?.kind
        )) ? { ok: true } : fail("CARD_CORNER_STALE", "弃牌角标已失效");
      },
      execute() {
        return fail("CARD_CORNER_SESSION_REQUIRED", "弃牌角标必须由 Effect Session 执行");
      },
    }), standardAction.createOptionDefinition("runezu_face_symbol", {
      label: "符文族面部符号",
      getOptions(context) {
        const root = context.workingRoot || context;
        const ownerId = context.standardActionAuthority?.actorId
          || context.playerState?.currentPlayerId
          || root.playerState?.currentPlayerId;
        const player = actor(root, ownerId);
        if (!player || root.match?.pendingDecision
          || (root.turnState?.passedPlayerIds || []).includes(ownerId)) {
          return fail("RUNEZU_FACE_BLOCKED", "当前不能放置符文族面部符号");
        }
        const choices = (aliens.ALIEN_SLOT_IDS || []).flatMap((slotId) => (
          runezu.isRunezuRevealedSlot(root.alienGameState, slotId)
            ? (runezu.FACE_SYMBOL_POSITIONS || []).flatMap((position) => {
              const check = runezu.canPlaceFaceSymbol(root.alienGameState, position, player);
              return check.ok ? check.choices.map((entry) => ({
                target: { alienSlotId: Number(slotId), position: Number(position), symbolId: entry.symbolId },
                label: `${runezu.formatSymbolLabel(entry.symbolId)} → ${position}`,
              })) : [];
            })
            : []
        ));
        return choices.length ? { ok: true, choices } : fail("RUNEZU_FACE_EMPTY", "没有可放置的符文族面部符号");
      },
      canExecute(context, option) {
        const listed = this.getOptions(context);
        return listed.ok && listed.choices.some((entry) => (
          entry.target.alienSlotId === option.target?.alienSlotId
          && entry.target.position === option.target?.position
          && entry.target.symbolId === option.target?.symbolId
        )) ? { ok: true } : fail("RUNEZU_FACE_STALE", "符文族面部符号选择已失效");
      },
      execute() {
        return fail("RUNEZU_FACE_SESSION_REQUIRED", "符文族面部符号必须由 Effect Session 执行");
      },
    })];
  }

  function decision(type, ownerId, payload, family = "choose_target") {
    return {
      priority: "direct",
      effect: {
        type,
        kind: "decision",
        decisionKind: family,
        ownerId,
        payload: clone(payload),
      },
    };
  }

  function companyQueue(root, player, flow) {
    const common = { companyId: industry.getPlayerIndustryLabel(player), abilityId: flow.abilityId };
    switch (flow.flowType) {
      case "sentinel_arm_play_corner":
        return [];
      case "stratus_public_corners":
        return industryAbilities.buildStratusPublicCornerEffectNodes(cards, root.cardState.publicCards)
          .map((node, index) => decision(EFFECT_TYPES.COMPANY_DECISION, player.id, {
            ...common, step: "stratus_corner", node, index,
          }, "choose_reward"));
      case "turing_borrow_tech":
        return [decision(EFFECT_TYPES.COMPANY_DECISION, player.id, {
          ...common, step: "turing_tech",
        })];
      case "huanyu_free_moves":
        return [decision(EFFECT_TYPES.COMPANY_DECISION, player.id, {
          ...common, step: "free_move", remaining: 2, usedRocketIds: [],
        })];
      case "helios_remove_tech":
        return [decision(EFFECT_TYPES.COMPANY_DECISION, player.id, {
          ...common, step: "helios_tech",
        })];
      case "mission_publicity_pick":
      case "fenwick_publicity_pick":
      case "strategy_pick":
      case "future_span_pick":
        return [decision(EFFECT_TYPES.COMPANY_DECISION, player.id, {
          ...common, step: "public_card",
        }, "choose_card")];
      case "deepspace_swap":
        return [decision(EFFECT_TYPES.COMPANY_DECISION, player.id, {
          ...common, step: "swap_hand",
        }, "choose_card")];
      default:
        throw new TypeError(`未迁移公司 flow: ${flow.flowType}`);
    }
  }

  function listCompanyChoices(root, effect) {
    const player = actor(root, effect.ownerId);
    const payload = effect.payload || {};
    if (!player || industry.getPlayerIndustryLabel(player) !== payload.companyId) return [];
    if (payload.step === "stratus_corner") {
      return formalize(root, player.id, [choice(
        "choose_reward", `corner:${payload.index}`, {}, {},
        payload.node?.label || "结算公共牌角标",
      )]);
    }
    if (payload.step === "turing_tech") {
      const slots = (tech.TECH_TILE_IDS || [])
        .filter((tileId) => /^(orange|purple)/.test(tileId))
        .filter((tileId) => tech.isSlotAvailable(root.techGameState?.board, tileId));
      return formalize(root, player.id, slots.map((tileId) => choice(
        "choose_target", `tech:${tileId}`, { tileId }, {}, `借用 ${tileId}`,
      )));
    }
    if (payload.step === "helios_tech") {
      const owned = Object.entries(player.techState?.ownedTiles || {})
        .filter(([tileId, value]) => value && !player.techState?.disabledTiles?.[tileId]
          && !String(tileId).startsWith("blue"))
        .map(([tileId]) => tileId);
      return formalize(root, player.id, owned.map((tileId) => choice(
        "choose_target", `tech:${tileId}`, { tileId }, {}, `无效 ${tileId}`,
      )));
    }
    if (payload.step === "income_card" || payload.step === "swap_hand") {
      return formalize(root, player.id, (player.hand || []).map((card) => choice(
        "choose_card", `hand:${card.id}`, { cardInstanceId: card.id }, {},
        cards.getCardLabel(card),
      )));
    }
    if (payload.step === "public_card" || payload.step === "swap_public") {
      const publicityCost = payload.abilityId === "mission_publicity_pick_income"
        ? 2
        : payload.abilityId === "fenwick_publicity_pick_corner" ? 1 : 0;
      if (publicityCost && !players.canAfford(player, { publicity: publicityCost })) return [];
      return formalize(root, player.id, (root.cardState.publicCards || []).flatMap((card, slotIndex) => (
        card ? [choice(
          "choose_card", `public:${slotIndex}:${card.id}`, { slotIndex, cardInstanceId: card.id },
          payload.step === "swap_public" ? { handCardInstanceId: payload.handCardInstanceId } : {},
          cards.getCardLabel(card),
        )] : []
      )));
    }
    if (payload.step === "free_move") {
      const used = new Set(payload.usedRocketIds || []);
      const choices = (root.rocketState?.rockets || []).flatMap((rocket) => {
        if (rocket.playerId !== player.id || rocket.surface !== "solar-board" || used.has(rocket.id)) return [];
        const context = {
          workingRoot: root,
          playerState: { ...root.playerState, currentPlayerId: player.id },
          rocketState: root.rocketState,
          planetStatsState: root.planetStatsState,
          alienGameState: root.alienGameState,
          nebulaDataState: root.nebulaDataState,
          cardState: root.cardState,
          solarState: root.solarState,
          turnState: root.turnState,
          techGameState: root.techGameState,
        };
        return gameAbilities.rocket.listMoveRequirements(context, player, rocket.id)
          ?.filter((move) => Number(move.requiredMovePoints) <= 1)
          .map((move) => choice(
            "choose_target", `move:${rocket.id}:${move.id}`,
            { rocketId: rocket.id, deltaX: move.deltaX, deltaY: move.deltaY },
            { direction: move.id }, `移动 ${rocket.id} ${move.id}`,
          )) || [];
      });
      return formalize(root, player.id, choices);
    }
    return [];
  }

  function drawOptions(root) {
    return {
      createCardInstance(entry) {
        root.meta.cardInstanceSequence = (Number(root.meta.cardInstanceSequence) || 0) + 1;
        return cards.createCardInstance(entry, root.meta.cardInstanceSequence);
      },
    };
  }

  function applyCompanyChoice(root, effect, legal) {
    const player = actor(root, effect.ownerId);
    const payload = effect.payload;
    const step = payload.step;
    const target = legal.target || {};
    const spawnedEffects = [];
    let irreversible = null;
    if (step === "stratus_corner") {
      const applied = industryAbilities.applyCornerReward(players, data, player, payload.node?.options?.reward);
      if (!applied.ok) return applied;
      if (applied.pendingFreeMove) {
        spawnedEffects.push(decision(EFFECT_TYPES.COMPANY_DECISION, player.id, {
          ...payload, step: "free_move", remaining: 1, usedRocketIds: [],
        }));
      }
    } else if (step === "turing_tech") {
      player.industryBorrowedTechTileId = target.tileId;
      player.industryBorrowedTechRound = roundOf(root);
      player.industryBorrowedTechTurn = turnOf(root);
    } else if (step === "helios_tech") {
      const removed = tech.playerTech.removePlayerTile(player.techState, target.tileId);
      if (!removed.ok) return removed;
      industry.clearHeliosPassiveSlots(player);
      spawnedEffects.push(decision(EFFECT_TYPES.COMPANY_DECISION, player.id, {
        ...payload, step: "income_card",
      }, "choose_card"));
    } else if (step === "income_card") {
      const index = player.hand.findIndex((card) => card.id === target.cardInstanceId);
      if (index < 0) return fail("COMPANY_INCOME_CARD_STALE", "收入牌已失效");
      const [card] = player.hand.splice(index, 1);
      cards.addToDiscardPile(root.cardState, card);
      const gained = industryAbilities.applyIncomeResourcesFromCard(cards, players, data, player, card, {
        blindDraw: () => cards.blindDraw(
          root.cardState, root.playerState, player, () => nextRandom(root), drawOptions(root),
        ),
      });
      if (!gained.ok) return gained;
      irreversible = gained.drawnCards?.length ? {
        code: "hidden_card_draw",
        reason: "公司收入盲抽翻开隐藏牌",
      } : null;
    } else if (step === "swap_hand") {
      spawnedEffects.push(decision(EFFECT_TYPES.COMPANY_DECISION, player.id, {
        ...payload, step: "swap_public", handCardInstanceId: target.cardInstanceId,
      }, "choose_card"));
    } else if (step === "swap_public") {
      const handIndex = player.hand.findIndex((card) => card.id === payload.handCardInstanceId);
      const publicCard = root.cardState.publicCards[target.slotIndex];
      if (handIndex < 0 || publicCard?.id !== target.cardInstanceId) {
        return fail("COMPANY_SWAP_STALE", "交换牌已失效");
      }
      root.cardState.publicCards[target.slotIndex] = player.hand[handIndex];
      player.hand[handIndex] = publicCard;
    } else if (step === "public_card") {
      if (root.cardState.publicCards[target.slotIndex]?.id !== target.cardInstanceId) {
        return fail("COMPANY_PUBLIC_CARD_STALE", "公共牌已失效");
      }
      if (payload.abilityId === "mission_publicity_pick_income") {
        players.spendResources(player, { publicity: 2 });
      } else if (payload.abilityId === "fenwick_publicity_pick_corner") {
        players.spendResources(player, { publicity: 1 });
      }
      const picked = cards.pickFromPublic(
        root.cardState, root.playerState, player, target.slotIndex,
        () => nextRandom(root), drawOptions(root),
      );
      if (!picked.ok) return picked;
      irreversible = {
        code: "hidden_public_replenish",
        reason: "精选公共牌后翻开新牌",
      };
      if (payload.abilityId === "mission_publicity_pick_income") {
        const index = player.hand.findIndex((card) => card.id === picked.card.id);
        player.hand.splice(index, 1);
        cards.addToDiscardPile(root.cardState, picked.card);
        const gained = industryAbilities.applyIncomeResourcesFromCard(cards, players, data, player, picked.card, {
          blindDraw: () => cards.blindDraw(
            root.cardState, root.playerState, player, () => nextRandom(root), drawOptions(root),
          ),
        });
        if (!gained.ok) return gained;
      } else if (payload.abilityId === "fenwick_publicity_pick_corner") {
        const applied = industryAbilities.applyCornerReward(
          players, data, player, industryAbilities.getCornerReward(cards, picked.card),
        );
        if (!applied.ok) return applied;
        if (applied.pendingFreeMove) spawnedEffects.push(decision(
          EFFECT_TYPES.COMPANY_DECISION, player.id,
          { ...payload, step: "free_move", remaining: 1, usedRocketIds: [] },
        ));
      } else if (payload.abilityId === "strategy_pick_card") {
        strategy.clearStrategyPassiveSlots(player);
      } else if (payload.abilityId === "future_span_pick_advance") {
        const advanced = industry.advanceFutureSpanTarget(player, 2);
        if (!advanced.ok) return advanced;
      }
    } else if (step === "free_move") {
      const context = {
        workingRoot: root,
        playerState: { ...root.playerState, currentPlayerId: player.id },
        rocketState: root.rocketState,
        planetStatsState: root.planetStatsState,
        alienGameState: root.alienGameState,
        nebulaDataState: root.nebulaDataState,
        cardState: root.cardState,
        solarState: root.solarState,
        turnState: root.turnState,
        techGameState: root.techGameState,
      };
      const moved = gameAbilities.executeAbility("moveProbe", context, {
        rocketId: target.rocketId,
        target: { deltaX: target.deltaX, deltaY: target.deltaY },
        movementPoints: 1,
        cost: {},
        source: "industry",
      });
      if (!moved.ok) return moved;
      if (Number(payload.remaining) > 1) {
        spawnedEffects.push(decision(EFFECT_TYPES.COMPANY_DECISION, player.id, {
          ...payload,
          remaining: Number(payload.remaining) - 1,
          usedRocketIds: [...(payload.usedRocketIds || []), target.rocketId],
        }));
      }
    } else {
      return fail("COMPANY_DECISION_UNKNOWN", `未知公司 Decision: ${step}`);
    }
    return { ok: true, spawnedEffects, irreversible };
  }

  function initializeAlienReveal(root, slotId, speciesId, owner, options = {}) {
    if (!SPECIES_IDS.includes(speciesId)) {
      return fail("ALIEN_SPECIES_UNKNOWN", `未知物种: ${speciesId}`);
    }
    const module = SPECIES_MODULES[speciesId];
    const allPlayers = root.playerState.players || [];
    if (!options.alreadyRevealed) {
      const revealed = aliens.revealAlien(root.alienGameState, slotId, module.ALIEN_ID);
      if (!revealed.ok) return revealed;
    }
    const random = () => nextRandom(root);
    const args = {
      jiuzhe: [root.alienGameState, slotId, owner, allPlayers, random],
      yichangdian: [root.alienGameState, slotId, owner, root.solarState?.earthSectorX || 1, random],
      banrenma: [root.alienGameState, slotId, owner, allPlayers, random],
      fangzhou: [root.alienGameState, slotId, owner, allPlayers, random],
      chong: [root.alienGameState, slotId, owner, random],
      amiba: [root.alienGameState, slotId, owner, random],
      aomomo: [root.alienGameState, slotId, owner, random],
      runezu: [root.alienGameState, slotId, owner, { random }],
    };
    const initializer = module?.[`initialize${speciesId[0].toUpperCase()}${speciesId.slice(1)}Reveal`];
    if (typeof initializer !== "function") {
      return fail("ALIEN_INITIALIZER_MISSING", `${speciesId} 缺少正式揭示 initializer`);
    }
    const initialized = initializer(...args[speciesId]);
    if (!initialized.ok) return initialized;
    const grants = !["jiuzhe", "fangzhou"].includes(speciesId)
      ? aliens.grantAlienCardsForFirstTraces(
        root.alienGameState,
        slotId,
        allPlayers,
        module,
        { random, label: module.ALIEN_ID },
      )
      : { ok: true, totalDrawn: 0, irreversible: null };
    if (!grants.ok) return grants;
    return {
      ok: true,
      initialized,
      grants,
      irreversible: grants.irreversible || {
        code: "alien_reveal",
        reason: "外星人物种已揭示",
      },
    };
  }

  function revealReadyAliens(root, owner) {
    const revealed = [];
    for (const slotId of [1, 2]) {
      const slot = aliens.getAlienSlot(root.alienGameState, slotId);
      if (!slot || slot.revealed || !aliens.isAlienReadyToReveal(slot)) continue;
      const picked = aliens.revealRandomAlien(
        root.alienGameState,
        slotId,
        () => nextRandom(root),
      );
      if (!picked.ok) return picked;
      const speciesId = SPECIES_KEY_BY_ALIEN_ID[picked.alienId];
      const initialized = initializeAlienReveal(
        root, slotId, speciesId, owner, { alreadyRevealed: true },
      );
      if (!initialized.ok) return initialized;
      revealed.push({ slotId, speciesId, alienId: picked.alienId, initialized });
    }
    return {
      ok: true,
      revealed,
      irreversible: revealed.length
        ? { code: "alien_reveal_turn_end", reason: "回合结束揭示外星人" }
        : null,
    };
  }

  function buildCardTaskContext(root) {
    return {
      nebulaDataState: root.nebulaDataState,
      alienGameState: root.alienGameState,
      planetStatsState: root.planetStatsState,
      probeLocations: root.match?.probeLocations || {},
      probeLocationDetails: root.match?.probeLocationDetails || [],
      dataTotals: Object.fromEntries((root.playerState.players || []).flatMap((player) => {
        const available = Number(player.resources?.availableData) || 0;
        const placed = Number(player.resources?.placedData) || 0;
        return [[player.id, available + placed], [player.color, available + placed]];
      })),
    };
  }

  function rewardEffects(reward, prefix = "residual-reward") {
    const effects = [];
    if (Object.keys(reward?.gain || {}).length) {
      effects.push({
        id: `${prefix}:gain`,
        type: "gain_resources",
        options: { gain: clone(reward.gain) },
      });
    }
    if (Number(reward?.dataCount) > 0) {
      effects.push({
        id: `${prefix}:data`,
        type: "gain_data",
        options: { count: Number(reward.dataCount) },
      });
    }
    if (Number(reward?.drawCards) > 0) {
      effects.push({
        id: `${prefix}:draw`,
        type: "draw_cards",
        options: { count: Number(reward.drawCards) },
      });
    }
    if (reward?.pickCard) {
      effects.push({
        id: `${prefix}:pick`,
        type: "pick_card",
        options: { count: 1 },
      });
    }
    return effects;
  }

  function listCardSettlements(root, ownerId) {
    const player = actor(root, ownerId);
    if (!player) return [];
    const tasks = cardEffects.collectReadyTasks(
      player,
      buildCardTaskContext(root),
    ).map((ready) => ({
      kind: "task",
      cardInstanceId: ready.card.id,
      ruleId: ready.task.id,
      effects: clone(ready.effects || []),
      label: ready.task.label || cards.getCardLabel(ready.card),
    }));
    for (const card of player.reservedCards || []) {
      if (chong.isChongCard(card) && !card.chongTaskCompleted) {
        const task = card.chongTask || chong.getCardTask(card);
        const deliveredTransport = task?.kind === "transport"
          ? chong.getDeliveredTransportForCard(root.alienGameState, card.id)
          : null;
        const ready = task?.kind === "trace"
          ? chong.isTraceTaskReady(root.alienGameState, player, task)
          : task?.kind === "transport"
            ? Boolean(deliveredTransport)
            : false;
        if (ready) tasks.push({
          kind: "chong_task",
          cardInstanceId: card.id,
          ruleId: task.id || task.kind,
          effects: clone(Array.isArray(task.effects)
            ? task.effects
            : rewardEffects(task.rewards || task, `chong:${card.id}`)),
          label: task.label || cards.getCardLabel(card),
          ...(deliveredTransport ? {
            rocketId: deliveredTransport.rocketId,
            destinationPlanetId: deliveredTransport.task?.destinationPlanetId,
          } : {}),
        });
      } else if (amiba.isAmibaCard(card) && !card.amibaTaskCompleted
        && amiba.isTheoryTaskReady(root.alienGameState, player)) {
        const task = card.amibaTask || amiba.getCardTask(card);
        const reward = amiba.getTheoryTaskReward(root.alienGameState);
        tasks.push({
          kind: "amiba_task",
          cardInstanceId: card.id,
          ruleId: task?.id || task?.kind || "amiba_theory",
          effects: clone(reward.effects || []),
          label: task?.label || cards.getCardLabel(card),
        });
      } else if (runezu.isRunezuCard(card)) {
        const ready = runezu.getReadyThreeTraceTask(card, root.alienGameState, player);
        if (ready) tasks.push({
          kind: "runezu_task",
          cardInstanceId: card.id,
          ruleId: ready.task?.id || ready.task?.kind || "runezu_three_trace",
          effects: clone(ready.effects || []),
          label: ready.task?.label || cards.getCardLabel(card),
        });
      }
    }
    const triggers = (root.turnState?.type1TriggerEvents || []).flatMap((event) => (
      cardTaskState.collectType1TriggerMatches(player, [event], cardEffects)
        .map((match) => ({
          kind: "trigger",
          cardInstanceId: match.card.id,
          ruleId: match.trigger.id,
          effects: clone(match.effects || match.trigger.rewards
            || (match.effect ? [match.effect] : match.trigger.effect ? [match.trigger.effect] : [])),
          label: match.trigger.label || cards.getCardLabel(match.card),
          event: clone(event),
        }))
    ));
    const seen = new Set();
    return [...tasks, ...triggers].filter((entry) => {
      const key = `${entry.kind}:${entry.cardInstanceId}:${entry.ruleId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function findCardSettlement(root, ownerId, payload) {
    if (payload?.kind === "trigger" && payload.event) {
      const player = actor(root, ownerId);
      const match = cardTaskState.collectType1TriggerMatches(
        player,
        [payload.event],
        cardEffects,
      ).find((entry) => (
        entry.card.id === payload.cardInstanceId
        && entry.trigger.id === payload.ruleId
      ));
      if (match) return {
        kind: "trigger",
        cardInstanceId: match.card.id,
        ruleId: match.trigger.id,
        effects: clone(match.effects || match.trigger.rewards
          || (match.effect ? [match.effect] : match.trigger.effect ? [match.trigger.effect] : [])),
        label: match.trigger.label || cards.getCardLabel(match.card),
        event: clone(payload.event),
      };
    }
    return listCardSettlements(root, ownerId).find((entry) => (
      entry.kind === payload.kind
      && entry.cardInstanceId === payload.cardInstanceId
      && entry.ruleId === payload.ruleId
    )) || null;
  }

  function cardDecisionChoices(root, effect) {
    const settlement = findCardSettlement(root, effect.ownerId, effect.payload || {});
    if (!settlement) return [];
    const id = `${settlement.kind}:${settlement.cardInstanceId}:${settlement.ruleId}`;
    return formalize(root, effect.ownerId, [
      choice("accept_optional_effect", `confirm:${id}`, {}, {}, `结算 ${settlement.label}`),
      choice("accept_optional_effect", `skip:${id}`, {}, {}, `跳过 ${settlement.label}`),
    ]);
  }

  function addScoreSource(player, key, amount) {
    player.scoreSources = player.scoreSources || {};
    player.scoreSources[key] = (Number(player.scoreSources[key]) || 0) + (Number(amount) || 0);
  }

  function createFormalCardEffectNode(effect, ownerId, cardInstanceId) {
    const payload = { cardEffect: clone(effect), cardInstanceId };
    let type = `${cardPlayDomain.EFFECT_TYPES.EFFECT}:effect:${effect.type}`;
    let kind = null;
    let decisionKind = null;
    if (cardPlayDomain.DIRECT_EFFECT_TYPES.includes(effect.type)) {
      type = cardPlayDomain.EFFECT_TYPES.DIRECT;
    } else if (effect.type === cardEffects.REWARD_TYPES.DRAW_CARDS) {
      type = cardPlayDomain.EFFECT_TYPES.DRAW_CARDS;
    } else if (effect.type === cardEffects.REWARD_TYPES.PICK_CARD) {
      type = cardPlayDomain.EFFECT_TYPES.PICK_CARD_START;
    } else if (effect.type === cardEffects.REWARD_TYPES.LAUNCH) {
      type = cardPlayDomain.EFFECT_TYPES.LAUNCH;
    } else if (effect.type === cardEffects.EFFECT_TYPES.SCAN_NEBULA) {
      type = cardPlayDomain.EFFECT_TYPES.FIXED_NEBULA_SCAN;
    } else if (effect.type === cardEffects.EFFECT_TYPES.SCAN_COLOR_CHOICE) {
      type = cardPlayDomain.EFFECT_TYPES.COLOR_NEBULA_SCAN;
      kind = "decision";
      decisionKind = "choose_target";
    } else if (effect.type === cardEffects.EFFECT_TYPES.RESEARCH_TECH) {
      type = science.EFFECT_TYPES.RESEARCH;
      kind = "decision";
      decisionKind = "choose_target";
      payload.options = {
        ...clone(effect.options || {}),
        skipCost: effect.options?.skipCost !== false,
      };
      payload.mainAction = false;
    } else if (effect.type === cardEffects.EFFECT_TYPES.PUBLIC_SCAN) {
      type = science.EFFECT_TYPES.PUBLIC_SCAN;
      kind = "decision";
      decisionKind = "choose_card";
      payload.selected = 0;
      payload.max = Math.max(1, Number(effect.options?.repeat || effect.options?.count) || 1);
      payload.consumeMarkers = false;
    } else if (effect.type === cardEffects.EFFECT_TYPES.SCAN_ACTION) {
      type = science.EFFECT_TYPES.EXECUTE;
      payload.action = {
        family: "scan",
        phase: "main",
        actorId: ownerId,
        target: { kind: "card-scan-action" },
        payload: { skipCost: true, nestedCardEffect: true },
      };
    }
    return {
      priority: "trigger",
      effect: {
        type,
        ...(kind ? { kind, decisionKind } : {}),
        ownerId,
        payload,
      },
    };
  }

  function applyFormalCardEffects(root, player, effects, sourceKey) {
    const spawnedEffects = [];
    let irreversible = null;
    for (const effect of effects || []) {
      const repeat = Math.max(1, Number(effect.options?.repeat) || 1);
      for (let index = 0; index < repeat; index += 1) {
        if (effect.type === "gain_resources") {
          const gain = effect.options?.gain || {};
          players.gainResources(player, gain);
          if (gain.score) addScoreSource(player, sourceKey, gain.score);
        } else if (effect.type === "gain_data") {
          const count = Math.max(1, Number(effect.options?.count) || 1);
          for (let dataIndex = 0; dataIndex < count; dataIndex += 1) {
            const gained = data.gainData(player, { source: "card_trigger" });
            if (!gained.ok) return gained;
          }
        } else if (effect.type === "draw_cards") {
          const count = Math.max(1, Number(effect.options?.count) || 1);
          for (let drawIndex = 0; drawIndex < count; drawIndex += 1) {
            const drawn = cards.blindDraw(
              root.cardState, root.playerState, player, () => nextRandom(root), drawOptions(root),
            );
            if (!drawn.ok) return drawn;
          }
          irreversible = { code: "hidden_card_draw", reason: "卡牌触发盲抽翻开隐藏牌" };
        } else if (effect?.type) {
          spawnedEffects.push(createFormalCardEffectNode(
            effect,
            player.id,
            effect.cardInstanceId || null,
          ));
        } else {
          return fail("CARD_EFFECT_INVALID", "卡牌触发奖励缺少正式 effect type");
        }
      }
    }
    return { ok: true, spawnedEffects, irreversible };
  }

  function applyAlienReward(root, player, reward, sourceKey) {
    const effects = [];
    if (Object.keys(reward?.gain || {}).length) {
      effects.push({ type: "gain_resources", options: { gain: clone(reward.gain) } });
    }
    if (Number(reward?.dataCount) > 0) {
      effects.push({ type: "gain_data", options: { count: Number(reward.dataCount) } });
    }
    if (Number(reward?.drawCards || reward?.blindDraw) > 0) {
      effects.push({
        type: "draw_cards",
        options: { count: Number(reward.drawCards || reward.blindDraw) },
      });
    }
    if (reward?.symbolId) runezu.gainPlayerSymbol(player, reward.symbolId);
    if (reward?.panelSymbol && reward?.panelSymbolSlotId) {
      const taken = runezu.takePanelSymbol(
        root.alienGameState,
        reward.panelSymbolSlotId,
        player,
        { refill: Boolean(reward.refillPanelSymbol), random: () => nextRandom(root) },
      );
      if (!taken.ok) return taken;
    }
    return applyFormalCardEffects(root, player, effects, sourceKey);
  }

  function executeCardCorner(root, action, player) {
    const handIndex = (player.hand || []).findIndex((card) => (
      card.id === action.target?.cardInstanceId
    ));
    if (handIndex < 0) return fail("CARD_CORNER_STALE", "弃牌角标卡牌已失效");
    const card = player.hand[handIndex];
    const multiplier = Math.max(1, Number(action.payload?.multiplier) || 1);
    const spawnedEffects = [];
    let irreversible = null;
    let reward = null;
    if (action.payload?.kind === "resource") {
      const base = cards.getDiscardActionRewardForCard(card);
      if (!base) return fail("CARD_CORNER_STALE", "卡牌资源角标已失效");
      reward = {
        gain: Object.fromEntries(Object.entries(base.gain || {}).map(
          ([key, value]) => [key, Number(value) * multiplier],
        )),
        dataCount: (Number(base.dataCount) || 0) * multiplier,
      };
      const applied = applyAlienReward(root, player, reward, "cardQuickScore");
      if (!applied.ok) return applied;
      spawnedEffects.push(...applied.spawnedEffects);
      irreversible = applied.irreversible;
    } else if (action.payload?.kind === "move") {
      const base = cards.getDiscardActionMoveRewardForCard(card);
      if (!base) return fail("CARD_CORNER_STALE", "卡牌移动角标已失效");
      reward = {
        gain: Object.fromEntries(Object.entries(base.gain || {}).map(
          ([key, value]) => [key, Number(value) * multiplier],
        )),
        movementPoints: Math.max(1, Number(base.movementPoints) || 1) * multiplier,
      };
      const applied = applyAlienReward(root, player, reward, "cardQuickScore");
      if (!applied.ok) return applied;
      spawnedEffects.push(...applied.spawnedEffects);
      spawnedEffects.push(createFormalCardEffectNode({
        id: `card-corner:${card.id}`,
        type: cardEffects.EFFECT_TYPES.CARD_MOVE,
        label: `${cards.getCardLabel(card)}：移动`,
        options: { movementPoints: reward.movementPoints, source: "card_corner" },
      }, player.id, card.id));
      irreversible = applied.irreversible;
    } else if (action.payload?.kind === "runezu_symbol") {
      const resolved = runezu.getTraceFaceRewardForSymbol(
        root.alienGameState,
        action.payload.symbolId,
      );
      reward = resolved.ok ? resolved.reward : null;
      if (reward) {
        const applied = applyAlienReward(root, player, reward, "alienCardQuickScore");
        if (!applied.ok) return applied;
        spawnedEffects.push(...applied.spawnedEffects);
        irreversible = applied.irreversible;
      }
    } else if (action.payload?.kind === "fangzhou_basic") {
      const flip = SPECIES_MODULES.fangzhou.flipCard1Reward(
        root.alienGameState,
        "basic",
        () => nextRandom(root),
      );
      if (!flip.ok) return flip;
      reward = flip.effect;
      const repeatedEffects = Array.from({ length: multiplier }, () => reward)
        .flatMap((entry) => {
          const translated = [];
          if (entry?.gain) translated.push({ type: "gain_resources", options: { gain: entry.gain } });
          if (entry?.dataCount) translated.push({ type: "gain_data", options: { count: entry.dataCount } });
          if (entry?.blindDraw) translated.push({ type: "draw_cards", options: { count: entry.blindDraw } });
          return translated;
        });
      const applied = applyFormalCardEffects(root, player, repeatedEffects, "alienCardQuickScore");
      if (!applied.ok) return applied;
      spawnedEffects.push(...applied.spawnedEffects);
      irreversible = applied.irreversible || {
        code: "fangzhou_reward_reveal",
        reason: "方舟奖励牌已翻开",
      };
    } else {
      return fail("CARD_CORNER_KIND_UNKNOWN", "未知弃牌角标类型");
    }
    const removed = cards.discardFromHandAtIndex(player, handIndex);
    if (!removed.ok) return removed;
    cards.addToDiscardPile(root.cardState, removed.card);
    return {
      ok: true,
      spawnedEffects,
      irreversible,
      events: [{
        type: "cardCorner",
        playerId: player.id,
        cardInstanceId: card.id,
        cornerCode: cards.normalizeDiscardActionTriggerCode?.(
          cards.getDiscardActionCodeForCard(card),
        ) ?? cards.getDiscardActionCodeForCard(card),
        cornerKind: action.payload.kind,
      }],
    };
  }

  function executeRunezuFace(root, action, player) {
    const placed = runezu.placePlayerSymbolOnFace(
      root.alienGameState,
      action.target?.position,
      player,
      action.target?.symbolId,
    );
    if (!placed.ok) return placed;
    const applied = applyAlienReward(
      root,
      player,
      placed.reward,
      "alienEffectScore",
    );
    if (!applied.ok) return applied;
    return {
      ok: true,
      spawnedEffects: applied.spawnedEffects,
      irreversible: applied.irreversible,
      events: [{
        type: "runezu_face_symbol",
        playerId: player.id,
        alienSlotId: action.target?.alienSlotId,
        position: placed.position,
        symbolId: placed.symbolId,
      }],
    };
  }

  function eventMatchesBonus(event, bonus) {
    if (!event || !bonus || event.type !== (bonus.eventType || bonus.event?.type)) return false;
    if (bonus.includePlanetIds?.length && !bonus.includePlanetIds.includes(event.planetId)) return false;
    if (bonus.excludePlanetIds?.length && bonus.excludePlanetIds.includes(event.planetId)) return false;
    if (bonus.color) {
      const nebulaIds = cardEffects.NEBULA_IDS_BY_COLOR?.[bonus.color] || [];
      if (!nebulaIds.includes(event.nebulaId)) return false;
    }
    if (bonus.sameRingOnly && !event.sameRing) return false;
    return true;
  }

  function augmentEffectResult(root, executorResult, sourceEffect) {
    if (!executorResult || executorResult.ok !== true || !Array.isArray(executorResult.events)
      || !executorResult.events.length || !root?.playerState) {
      return executorResult;
    }
    const events = executorResult.events.filter((event) => event?.type);
    const ownerId = sourceEffect?.ownerId || events.find((event) => event.playerId)?.playerId;
    const owner = actor(root, ownerId);
    const spawnedEffects = [...(executorResult.spawnedEffects || [])];
    if (owner) {
      for (const event of events) {
        if (event.type === "visitPlanet" && event.rocketId != null) {
          chong.markTransportedFossilDelivered(
            root.alienGameState,
            event.rocketId,
            event.planetId || null,
          );
        }
      }
      const matches = events.flatMap((event) => (
        cardTaskState.collectType1TriggerMatches(owner, [event], cardEffects)
      ));
      const seen = new Set();
      for (const match of matches) {
        const key = `${match.card.id}:${match.trigger.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        spawnedEffects.push(decision(EFFECT_TYPES.CARD_DECISION, owner.id, {
          kind: "trigger",
          cardInstanceId: match.card.id,
          ruleId: match.trigger.id,
          effects: clone(match.effects || match.trigger.rewards
            || (match.effect ? [match.effect] : match.trigger.effect ? [match.trigger.effect] : [])),
          label: match.trigger.label || cards.getCardLabel(match.card),
          event: clone(match.event || null),
        }, "accept_optional_effect"));
      }
      for (const card of [...(owner.reservedCards || [])]) {
        if (!runezu.isRunezuCard(card)) continue;
        const progress = runezu.consumeTaskEvents(card, events);
        if (!progress?.ok) continue;
        const applied = applyFormalCardEffects(
          root,
          owner,
          progress.effects || [],
          "taskCardScore",
        );
        if (applied.ok) spawnedEffects.push(...applied.spawnedEffects);
        if (progress.completed) {
          const index = owner.reservedCards.findIndex((entry) => entry.id === card.id);
          if (index >= 0) {
            owner.reservedCards.splice(index, 1);
            cards.addToDiscardPile(root.cardState, card);
            owner.completedTaskCount = (Number(owner.completedTaskCount) || 0) + 1;
          }
        }
      }
      for (const bonus of root.turnState.cardTurnEventBonuses || []) {
        if ((bonus.ownerId || bonus.playerId) !== owner.id) continue;
        for (const event of events) {
          if (!eventMatchesBonus(event, bonus)) continue;
          const distinctKey = bonus.distinctBy ? String(event[bonus.distinctBy] ?? "") : null;
          if (distinctKey) {
            bonus.usedKeys = bonus.usedKeys || [];
            if (bonus.usedKeys.includes(distinctKey)) continue;
            bonus.usedKeys.push(distinctKey);
          }
          const claimKey = bonus.onceKey || (
            Number(bonus.minCount) > 0 && (bonus.usedKeys?.length || 0) >= Number(bonus.minCount)
              ? `${bonus.id}:min-count`
              : null
          );
          bonus.claimedKeys = bonus.claimedKeys || [];
          if (claimKey && bonus.claimedKeys.includes(claimKey)) continue;
          if (Number(bonus.minCount) > 0 && (bonus.usedKeys?.length || 0) < Number(bonus.minCount)) {
            continue;
          }
          const applied = applyFormalCardEffects(
            root,
            owner,
            bonus.rewards || (bonus.reward ? [bonus.reward] : []),
            "cardEffectScore",
          );
          if (applied.ok) spawnedEffects.push(...applied.spawnedEffects);
          if (bonus.publicityToMoveFollowup && Number(event.publicityReward) > 0) {
            spawnedEffects.push(createFormalCardEffectNode({
              id: `${bonus.id || "card-event"}:publicity-move`,
              type: cardEffects.EFFECT_TYPES.CARD_MOVE,
              label: "支付 1 宣传：移动 1",
              options: {
                cost: { publicity: 1 },
                movementPoints: 1,
                source: "card_event_bonus",
              },
            }, owner.id, null));
          }
          if (claimKey) bonus.claimedKeys.push(claimKey);
        }
      }
    }
    return { ...executorResult, spawnedEffects };
  }

  function settleCardDecision(root, effect, selected) {
    const legal = cardDecisionChoices(root, effect)
      .find((candidate) => candidate.actionId === selected?.actionId);
    const settlement = findCardSettlement(root, effect.ownerId, effect.payload || {});
    const player = actor(root, effect.ownerId);
    if (!legal || !settlement || !player) {
      return fail("CARD_DECISION_STALE", "卡牌触发 Decision 已失效");
    }
    if (String(legal.target.choiceId).startsWith("skip:")) {
      return { ok: true, spawnedEffects: [], irreversible: null };
    }
    const cardIndex = (player.reservedCards || [])
      .findIndex((card) => card.id === settlement.cardInstanceId);
    const card = player.reservedCards?.[cardIndex];
    if (!card) return fail("CARD_INSTANCE_STALE", "任务牌实例已失效");
    let consumed = false;
    if (settlement.kind === "task") {
      consumed = cardEffects.completeTask(card, settlement.ruleId);
    } else if (settlement.kind === "trigger") {
      consumed = cardEffects.consumeTrigger(card, settlement.ruleId);
    } else if (settlement.kind === "chong_task") {
      if (settlement.rocketId != null) {
        const transport = chong.completeTransportedFossil(
          root.alienGameState,
          settlement.rocketId,
          {
            cardId: card.id,
            destinationPlanetId: settlement.destinationPlanetId,
          },
        );
        if (!transport.ok) return transport;
      }
      card.chongTaskCompleted = true;
      consumed = true;
    } else if (settlement.kind === "amiba_task") {
      card.amibaTaskCompleted = true;
      consumed = true;
    } else if (settlement.kind === "runezu_task") {
      consumed = runezu.completeRunezuTask(card);
    }
    if (!consumed) return fail("CARD_RULE_ALREADY_CONSUMED", "卡牌规则已经结算");
    if (settlement.kind !== "trigger" || cardEffects.areAllTriggersConsumed(card)) {
      player.reservedCards.splice(cardIndex, 1);
      cards.addToDiscardPile(root.cardState, card);
      player.completedTaskCount = (Number(player.completedTaskCount) || 0) + 1;
    }
    const applied = applyFormalCardEffects(
      root,
      player,
      settlement.effects,
      settlement.kind === "trigger" ? "cardEffectScore" : "taskCardScore",
    );
    return applied.ok ? applied : applied;
  }

  function settleFinalScores(root) {
    const scores = [];
    for (const player of root.playerState.players || []) {
      const breakdown = endGameScoring.computePlayerFinalScore({
        ...root,
        players: root.playerState.players,
        currentPlayer: player,
        cardEffects,
        getCardTypeCode: (card) => cardEffects.getRuntimeCardTypeCode(
          card,
          cardEffects.getCardModel(card)?.cardType,
        ),
      }, player);
      player.finalScore = breakdown.totalScore;
      player.finalScoreBreakdown = clone(breakdown);
      const previousSources = player.scoreSources || {};
      player.scoreSources = Object.fromEntries(SCORE_SOURCE_KEYS.map(
        (key) => [key, Number(previousSources[key]) || 0],
      ));
      scores.push(clone(breakdown));
    }
    root.match.finalScores = scores;
    root.match.finalScoringSettled = true;
    return scores;
  }

  function listPendingFinalOwners(root) {
    return (root.playerState.players || []).filter((player) => (
      finalScoring.getPendingMarksForPlayer(root.finalScoringState, player.id).length
    ));
  }

  function aomomoCardChoices(root, ownerId) {
    const state = aomomo.ensureAomomoState(root.alienGameState);
    const displayed = state.displayedCardIndex == null
      ? []
      : [choice(
        "choose_card", `aomomo:display:${state.displayedCardIndex}`,
        { source: "display", cardIndex: state.displayedCardIndex }, {},
        `获得展示的${aomomo.getCardDefinition(state.displayedCardIndex)?.cardName || "奥陌陌牌"}`,
      )];
    const blind = state.cardDeck?.length
      ? [choice("choose_card", "aomomo:blind", { source: "blind" }, {}, "盲抽奥陌陌牌")]
      : [];
    return formalize(root, ownerId, [...displayed, ...blind]);
  }

  function applyHandoff(root, effect) {
    const payload = effect.payload || {};
    if (payload.schemaVersion !== HANDOFF_SCHEMA) {
      return fail("DOMAIN_HANDOFF_SCHEMA_INVALID", "领域 handoff schema 不匹配");
    }
    const effectType = payload.effectType;
    const owner = actor(root, effect.ownerId);
    if (effect.ownerId && !owner) return fail("DOMAIN_HANDOFF_OWNER_STALE", "领域 handoff owner 已失效");
    if (payload.domain === "income" && effectType === "pass_income") {
      const income = owner?.income || owner?.resources?.income || {};
      players.gainResources(owner, {
        credits: Number(income.credits) || 0,
        energy: Number(income.energy) || 0,
        publicity: Number(income.publicity) || 0,
        availableData: Number(income.availableData) || 0,
        additionalPublicScan: Number(income.additionalPublicScan) || 0,
      });
      const drawnCards = [];
      for (let index = 0; index < Math.max(0, Number(income.handSize) || 0); index += 1) {
        const drawn = cards.blindDraw(
          root.cardState, root.playerState, owner, () => nextRandom(root), drawOptions(root),
        );
        if (!drawn.ok) return drawn;
        drawnCards.push(drawn.card);
      }
      return {
        ok: true,
        irreversible: drawnCards.length
          ? { code: "hidden_card_draw", reason: "收入盲抽翻开隐藏牌" }
          : null,
      };
    }
    if (payload.domain === "income" && effectType === "planet_reward_income") {
      return {
        ok: true,
        spawnedEffects: [{
          priority: "direct",
          effect: {
            type: science.EFFECT_TYPES.INCOME,
            kind: "decision",
            decisionKind: "choose_card",
            ownerId: owner.id,
            payload: { source: "planet_reward_income" },
          },
        }],
      };
    }
    if (payload.domain === "company" && effectType === "round_start") {
      industry.resetAllIndustryActionMarks(root.playerState.players);
      return { ok: true };
    }
    if (payload.domain === "company"
      && ["company_pass", "turn_end"].includes(effectType)) {
      if (effectType === "turn_end") {
        industry.clearTuringBorrowedTech(owner);
        industry.clearSentinelPlayCornerState(owner);
      }
      return { ok: true };
    }
    if (payload.domain === "card_trigger" && effectType === "round_transition") {
      delete root.turnState.type1TriggerEvents;
      root.turnState.cardTurnEventBonuses = [];
      return { ok: true };
    }
    if (payload.domain === "card_trigger" && effectType === "turn_end") {
      const cardSettlements = listCardSettlements(root, effect.ownerId);
      root.turnState.cardTurnEventBonuses = (root.turnState.cardTurnEventBonuses || [])
        .filter((bonus) => (bonus.ownerId || bonus.playerId) !== effect.ownerId);
      return { ok: true, cardSettlements };
    }
    if (payload.domain === "alien" && effectType === "turn_end_reveal") {
      return revealReadyAliens(root, owner);
    }
    if (payload.domain === "alien" && effectType === "planet_reward_aomomo_card") {
      return {
        ok: true,
        spawnedEffects: [decision(
          EFFECT_TYPES.ALIEN_CARD_DECISION,
          owner.id,
          { speciesId: "aomomo", source: "planet_reward" },
          "choose_card",
        )],
      };
    }
    if (payload.domain === "alien" && effectType === "reveal_species") {
      return initializeAlienReveal(
        root, Number(payload.data?.slotId), payload.data?.speciesId, owner,
      );
    }
    if (payload.domain === "alien" && effectType === "place_trace") {
      const speciesId = payload.data?.speciesId;
      const module = SPECIES_MODULES[speciesId];
      if (!SPECIES_IDS.includes(speciesId) || !module) {
        return fail("ALIEN_SPECIES_UNKNOWN", `未知物种: ${speciesId}`);
      }
      const method = module[`place${speciesId[0].toUpperCase()}${speciesId.slice(1)}Trace`];
      if (typeof method !== "function") return fail("ALIEN_TRACE_OWNER_MISSING", `${speciesId} 缺少痕迹 owner`);
      return method(
        root.alienGameState,
        Number(payload.data.slotId),
        payload.data.traceType,
        Number(payload.data.position),
        owner,
        payload.data.options || {},
      );
    }
    if (payload.domain === "final_scoring" && effectType === "sync_marks") {
      return finalScoring.syncPendingMarks(root.finalScoringState, root.playerState.players);
    }
    if (payload.domain === "final_scoring" && effectType === "game_end") {
      finalScoring.syncPendingMarks(root.finalScoringState, root.playerState.players);
      if (!listPendingFinalOwners(root).length) settleFinalScores(root);
      return { ok: true };
    }
    return fail(
      "DOMAIN_HANDOFF_UNKNOWN",
      `未迁移 handoff: ${payload.domain || "?"}/${effectType || "?"}`,
    );
  }

  function createResidualDomain(options = {}) {
    const runtime = options.runtime;
    const commitWorkingState = options.commitWorkingState;
    if (typeof runtime?.registerExecutor !== "function" || typeof commitWorkingState !== "function") {
      throw new TypeError("Residual domain 缺少 Effect runtime/commitWorkingState");
    }
    const result = (state, root, source, extra = {}) => ({
      ok: true,
      nextState: commitWorkingState(state, { source, executorId: EXECUTOR_ID }),
      ...extra,
    });
    runtime.registerExecutor(EFFECT_TYPES.EXECUTE, (state, effect, context) => {
      const root = getRoot(state, context);
      const action = effect.payload?.action;
      const player = actor(root, action?.actorId);
      if (action?.family === "card_corner") {
        const applied = executeCardCorner(root, action, player);
        if (!applied.ok) return applied;
        return result(state, root, "card_corner", {
          spawnedEffects: applied.spawnedEffects,
          irreversible: applied.irreversible,
          events: applied.events,
          history: [{
            type: "card_corner",
            playerId: player.id,
            cardInstanceId: action.target.cardInstanceId,
            executorId: EXECUTOR_ID,
          }],
        });
      }
      if (action?.family === "runezu_face_symbol") {
        const applied = executeRunezuFace(root, action, player);
        if (!applied.ok) return applied;
        return result(state, root, "runezu_face_symbol", {
          spawnedEffects: applied.spawnedEffects,
          irreversible: applied.irreversible,
          events: applied.events,
          history: [{
            type: "runezu_face_symbol",
            playerId: player.id,
            symbolId: action.target.symbolId,
            executorId: EXECUTOR_ID,
          }],
        });
      }
      const start = canStartCompany(root, player);
      if (!start.ok
        || start.label !== action?.target?.companyId
        || start.abilityId !== action?.target?.abilityId) {
        return fail("COMPANY_ACTION_STALE", "公司行动已失效");
      }
      const marked = industry.markIndustryAction(player, roundOf(root), { turnNumber: turnOf(root) });
      if (!marked.ok) return marked;
      const flow = industryAbilities.buildActiveAbilityFlow(
        player, start.label, roundOf(root), turnOf(root),
      );
      if (!flow.ok) return flow;
      return result(state, root, "company_action", {
        spawnedEffects: companyQueue(root, player, flow),
        events: [{
          type: "company_action",
          playerId: player.id,
          companyId: start.label,
          abilityId: start.abilityId,
        }],
        history: [{
          type: "company_action",
          playerId: player.id,
          companyId: start.label,
          executorId: EXECUTOR_ID,
        }],
      });
    });
    runtime.registerExecutor(EFFECT_TYPES.COMPANY_DECISION, {
      getLegalChoices(state, effect, context) {
        return listCompanyChoices(getRoot(state, context), effect);
      },
      resolveDecision(state, effect, selected, context) {
        const root = getRoot(state, context);
        const legal = listCompanyChoices(root, effect)
          .find((candidate) => candidate.actionId === selected?.actionId);
        if (!legal || legal.actorId !== effect.ownerId) {
          return fail("COMPANY_DECISION_STALE", "公司 Decision 已失效");
        }
        const applied = applyCompanyChoice(root, effect, legal);
        if (!applied.ok) return applied;
        return result(state, root, `company:${effect.payload.step}`, {
          spawnedEffects: applied.spawnedEffects,
          irreversible: applied.irreversible,
        });
      },
    });
    runtime.registerExecutor(EFFECT_TYPES.CARD_DECISION, {
      getLegalChoices(state, effect, context) {
        return cardDecisionChoices(getRoot(state, context), effect);
      },
      resolveDecision(state, effect, selected, context) {
        const root = getRoot(state, context);
        const settled = settleCardDecision(root, effect, selected);
        if (!settled.ok) return settled;
        return result(state, root, `card:${effect.payload.kind}`, {
          spawnedEffects: settled.spawnedEffects || [],
          irreversible: settled.irreversible || null,
          events: [{
            type: "card_rule_settled",
            playerId: effect.ownerId,
            cardInstanceId: effect.payload.cardInstanceId,
            ruleId: effect.payload.ruleId,
            ruleKind: effect.payload.kind,
          }],
        });
      },
    });
    runtime.registerExecutor(EFFECT_TYPES.ALIEN_CARD_DECISION, {
      getLegalChoices(state, effect, context) {
        const root = getRoot(state, context);
        return effect.payload?.speciesId === "aomomo"
          ? aomomoCardChoices(root, effect.ownerId)
          : [];
      },
      resolveDecision(state, effect, selected, context) {
        const root = getRoot(state, context);
        const player = actor(root, effect.ownerId);
        const legal = aomomoCardChoices(root, effect.ownerId)
          .find((candidate) => candidate.actionId === selected?.actionId);
        if (!player || !legal || effect.payload?.speciesId !== "aomomo") {
          return fail("ALIEN_CARD_DECISION_STALE", "外星人卡牌选择已失效");
        }
        const gained = legal.target.source === "display"
          ? aomomo.takeDisplayedCard(root.alienGameState, () => nextRandom(root))
          : aomomo.blindDrawCard(root.alienGameState, () => nextRandom(root));
        if (!gained.ok || !gained.card) return gained;
        player.hand.push(gained.card);
        player.resources.handSize = player.hand.length;
        return result(state, root, "alien:aomomo_card", {
          irreversible: { code: "hidden_alien_card", reason: "奥陌陌牌堆已翻开" },
          events: [{
            type: "alien_card_gain",
            playerId: player.id,
            alienId: aomomo.ALIEN_ID,
            cardInstanceId: gained.card.id,
            source: legal.target.source,
          }],
        });
      },
    });
    runtime.registerExecutor(EFFECT_TYPES.FINAL_MARK, {
      getLegalChoices(state, effect, context) {
        const root = getRoot(state, context);
        const player = actor(root, effect.ownerId);
        if (!player) return [];
        return formalize(root, player.id, finalScoring.DEFAULT_TILE_IDS.flatMap((tileId) => (
          finalScoring.canMarkTile(root.finalScoringState, tileId, player).ok
            ? [choice("choose_target", `final:${tileId}`, { tileId }, {}, `标记 ${tileId.toUpperCase()}`)]
            : []
        )));
      },
      resolveDecision(state, effect, selected, context) {
        const root = getRoot(state, context);
        const legal = this.getLegalChoices(state, effect, context)
          .find((candidate) => candidate.actionId === selected?.actionId);
        const player = actor(root, effect.ownerId);
        if (!legal || !player) return fail("FINAL_MARK_STALE", "终局标记 Decision 已失效");
        const marked = finalScoring.markTile(
          root.finalScoringState, legal.target.tileId, player,
          { placedAt: root.meta?.logicalTime || null },
        );
        if (!marked.ok) return marked;
        if (!listPendingFinalOwners(root).length) settleFinalScores(root);
        const hasMoreForOwner = finalScoring
          .getPendingMarksForPlayer(root.finalScoringState, player.id).length > 0;
        return result(state, root, "final_mark", {
          spawnedEffects: hasMoreForOwner
            ? [decision(EFFECT_TYPES.FINAL_MARK, player.id, {})]
            : [],
        });
      },
    });
    runtime.registerExecutor(HANDOFF_TYPE, (state, effect, context) => {
      const root = getRoot(state, context);
      const applied = applyHandoff(root, effect);
      if (!applied.ok) return applied;
      const pendingOwners = effect.payload?.domain === "final_scoring"
        ? listPendingFinalOwners(root)
        : [];
      const cardEffectsToSpawn = (applied.cardSettlements || []).map((settlement) => decision(
        EFFECT_TYPES.CARD_DECISION,
        effect.ownerId,
        settlement,
        "accept_optional_effect",
      ));
      return result(state, root, `handoff:${effect.payload.domain}:${effect.payload.effectType}`, {
        spawnedEffects: [
          ...cardEffectsToSpawn,
          ...pendingOwners.map((player) => decision(EFFECT_TYPES.FINAL_MARK, player.id, {})),
          ...(applied.spawnedEffects || []),
        ],
        irreversible: applied.irreversible || null,
      });
    });
    return Object.freeze({
      id: DOMAIN_ID,
      actionFamilies: ACTION_FAMILIES,
      createEffectGroup(state, action) {
        return {
          kind: DOMAIN_ID,
          ownerId: action.actorId,
          effects: [{
            type: EFFECT_TYPES.EXECUTE,
            ownerId: action.actorId,
            payload: { action: clone(action) },
          }],
        };
      },
    });
  }

  return Object.freeze({
    DOMAIN_ID,
    EXECUTOR_ID,
    ACTION_FAMILIES,
    HANDOFF_TYPE,
    HANDOFF_SCHEMA,
    EFFECT_TYPES,
    SPECIES_IDS,
    augmentEffectResult,
    createActionDefinitions,
    createResidualDomain,
  });
});
