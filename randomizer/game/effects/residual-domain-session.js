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
  let stateSequences = root.SetiStateSequences;
  let solar = root.SetiSolarSystem;
  let rockets = root.SetiRocketActions;
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
    stateSequences = stateSequences || require("../state/sequences");
    solar = solar || require("../../solar-system/core");
    rockets = rockets || require("../rockets");
  }
  const api = factory(
    standardAction, science, players, cards, data, industry, industryAbilities,
    gameAbilities, strategy, tech, aliens, finalScoring, endGameScoring,
    cardEffects, cardTaskState, cardPlayDomain,
    { jiuzhe, yichangdian, banrenma, fangzhou, chong, amiba, aomomo, runezu },
    stateSequences,
    solar,
    rockets,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiResidualDomainSession = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (
  standardAction, science, players, cards, data, industry, industryAbilities,
  gameAbilities, strategy, tech, aliens, finalScoring, endGameScoring,
  cardEffects, cardTaskState, cardPlayDomain, speciesModules, stateSequences,
  solar,
  rockets,
) {
  "use strict";

  const DOMAIN_ID = "residual_domains";
  const EXECUTOR_ID = `${DOMAIN_ID}:executor:v1`;
  const ACTION_FAMILIES = Object.freeze(["industry", "card_corner", "runezu_face_symbol", "complete_task"]);
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
  const getRoot = (state, context) => context?.state || context || state;
  const actor = (root, ownerId) => (root.players?.players || [])
    .find((player) => player.id === ownerId) || null;
  const roundOf = (root) => Math.max(1, Number(root.turn?.roundNumber) || 1);
  const turnOf = (root) => Math.max(1, Number(root.turn?.turnNumber) || 1);

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
    if ((root.turn?.passedPlayerIds || []).includes(player.id) || player.passCompletionPending) {
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
        const root = context.state || context;
        const owner = context.standardActionAuthority?.actorId
          || context.turn?.currentPlayerId
          || root.turn?.currentPlayerId;
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
        const root = context.state || context;
        const ownerId = context.standardActionAuthority?.actorId
          || context.turn?.currentPlayerId
          || root.turn?.currentPlayerId;
        const player = actor(root, ownerId);
        if (!player || (root.turn?.passedPlayerIds || []).includes(ownerId)) {
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
        const root = context.state || context;
        const ownerId = context.standardActionAuthority?.actorId
          || context.turn?.currentPlayerId
          || root.turn?.currentPlayerId;
        const player = actor(root, ownerId);
        if (!player || (root.turn?.passedPlayerIds || []).includes(ownerId)) {
          return fail("RUNEZU_FACE_BLOCKED", "当前不能放置符文族面部符号");
        }
        const choices = (aliens.ALIEN_SLOT_IDS || []).flatMap((slotId) => (
          runezu.isRunezuRevealedSlot(root.aliens, slotId)
            ? (runezu.FACE_SYMBOL_POSITIONS || []).flatMap((position) => {
              const check = runezu.canPlaceFaceSymbol(root.aliens, position, player);
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
    }), standardAction.createOptionDefinition("complete_task", {
      label: "完成任务",
      getOptions(context) {
        const root = context.state || context;
        const ownerId = context.standardActionAuthority?.actorId
          || context.turn?.currentPlayerId
          || root.turn?.currentPlayerId;
        const player = actor(root, ownerId);
        if (!player || (root.turn?.passedPlayerIds || []).includes(ownerId) || player.passCompletionPending) {
          return fail("COMPLETE_TASK_BLOCKED", "当前不能执行完成任务");
        }
        const choices = listCardSettlements(root, ownerId)
          // 条件任务（task）、虫族搬运任务（chong_task）、阿米巴理论任务（amiba_task）
          // 都通过「完成任务」免费行动结算。
          .filter((settlement) => ["task", "chong_task", "amiba_task"].includes(settlement.kind))
          .map((settlement) => ({
            target: {
              cardInstanceId: settlement.cardInstanceId,
              ruleId: settlement.ruleId,
            },
            label: `完成 ${settlement.label}`,
          }));
        return choices.length
          ? { ok: true, choices }
          : fail("COMPLETE_TASK_EMPTY", "没有可完成的条件任务");
      },
      canExecute(context, option) {
        const listed = this.getOptions(context);
        return listed.ok && listed.choices.some((entry) => (
          entry.target.cardInstanceId === option.target?.cardInstanceId
          && entry.target.ruleId === option.target?.ruleId
        )) ? { ok: true } : fail("COMPLETE_TASK_STALE", "条件任务选择已失效");
      },
      execute(context, action) {
        const root = context.state || context;
        const ownerId = action.actorId
          || context.standardActionAuthority?.actorId
          || context.turn?.currentPlayerId
          || root.turn?.currentPlayerId;
        return settleReadyTaskDirect(
          root,
          ownerId,
          action.target?.cardInstanceId,
          action.target?.ruleId,
        );
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
        return industryAbilities.buildStratusPublicCornerEffectNodes(cards, root.cards.publicCards)
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
        .filter((tileId) => tech.isSlotAvailable(root.tech, tileId));
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
      return formalize(root, player.id, (player.hand || []).map((card) => {
        const entry = cards.getCatalogEntryForCard(card);
        return {
          ...choice(
            "choose_card", `hand:${card.id}`, { cardInstanceId: card.id }, {},
            cards.getCardLabel(card),
          ),
          // 手牌选择携带卡面，决策弹窗显示牌面而非编号
          presentation: cards.getCardPickPresentation(card),
        };
      }));
    }
    if (payload.step === "public_card" || payload.step === "swap_public") {
      const publicityCost = payload.abilityId === "mission_publicity_pick_income"
        ? 2
        : payload.abilityId === "fenwick_publicity_pick_corner" ? 1 : 0;
      if (publicityCost && !players.canAfford(player, { publicity: publicityCost })) return [];
      return formalize(root, player.id, (root.cards.publicCards || []).flatMap((card, slotIndex) => {
        if (!card) return [];
        const entry = cards.getCatalogEntryForCard(card);
        return [{
          ...choice(
            "choose_card", `public:${slotIndex}:${card.id}`, { slotIndex, cardInstanceId: card.id },
            payload.step === "swap_public" ? { handCardInstanceId: payload.handCardInstanceId } : {},
            cards.getCardLabel(card),
          ),
          // 公共牌选择携带卡面，决策弹窗显示牌面而非编号
          presentation: cards.getCardPickPresentation(card),
        }];
      }));
    }
    if (payload.step === "free_move") {
      const used = new Set(payload.usedRocketIds || []);
      const context = {
        state: root,
        players: root.players,
        pieces: root.pieces,
        planets: root.planets,
        aliens: root.aliens,
        data: root.data,
        cards: root.cards,
        solarSystem: root.solarSystem,
        turn: { ...root.turn, currentPlayerId: player.id },
        tech: root.tech,
      };
      // 统一移动入口：与卡牌/紫4/快速交易/probe turn 共用 listPlayerMoveChoices
      const choices = gameAbilities.rocket.listPlayerMoveChoices(context, player, {
        maxPoints: 1,
      })
        .filter((move) => !used.has(move.rocketId))
        .map((move) => choice(
          "choose_target", `move:${move.rocketId}:${move.directionId}`,
          { rocketId: move.rocketId, deltaX: move.deltaX, deltaY: move.deltaY },
          { direction: move.directionId }, `移动 ${move.rocketId} ${move.label}`,
        ));
      return formalize(root, player.id, choices);
    }
    return [];
  }

  // 统一抽牌上下文：残余域所有盲抽/精选共用 cards.createCardDrawContext
  function drawOptions(root) {
    return cards.createCardDrawContext(
      root.cards,
      root.players,
      () => nextRandom(root),
      { root },
    );
  }

  function applyCompanyChoice(root, effect, legal) {
    const player = actor(root, effect.ownerId);
    const payload = effect.payload;
    const step = payload.step;
    const target = legal.target || {};
    const spawnedEffects = [];
    let irreversible = null;
    if (step === "stratus_corner") {
      const applied = industryAbilities.applyCornerReward(
        players,
        data,
        player,
        payload.node?.options?.reward,
        { root, cards },
      );
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
      // 收入牌插入起始收入牌下方，移出游戏（不进弃牌堆、不会被洗回主牌库）。
      cards.addRemovedFromGame(root.cards, card);
      const gain = cards.getIncomeGainForCard(card);
      if (!gain) return fail("COMPANY_INCOME_CARD_UNKNOWN", "当前卡牌没有可识别收入");
      // 一次收入行动：与初始收入牌/打牌转收入同一语义——插入收入列（收入栏
      // 提升）+ 立即奖励（资源/数据/盲抽），统一走 players.gainIncome。
      const drawnCards = [];
      players.gainIncome(player, gain, {
        blindDraw: (targetPlayer) => {
          const draw = drawOptions(root).blindDraw(targetPlayer);
          if (draw.ok) drawnCards.push(draw.card);
          return draw;
        },
        gainData: (targetPlayer) => data.gainData(targetPlayer, {
          source: "industry_income",
          root,
        }),
      });
      irreversible = drawnCards.length ? {
        code: "hidden_card_draw",
        reason: "公司收入盲抽翻开隐藏牌",
      } : null;
    } else if (step === "swap_hand") {
      spawnedEffects.push(decision(EFFECT_TYPES.COMPANY_DECISION, player.id, {
        ...payload, step: "swap_public", handCardInstanceId: target.cardInstanceId,
      }, "choose_card"));
    } else if (step === "swap_public") {
      const handIndex = player.hand.findIndex((card) => card.id === payload.handCardInstanceId);
      const publicCard = root.cards.publicCards[target.slotIndex];
      if (handIndex < 0 || publicCard?.id !== target.cardInstanceId) {
        return fail("COMPANY_SWAP_STALE", "交换牌已失效");
      }
      root.cards.publicCards[target.slotIndex] = player.hand[handIndex];
      player.hand[handIndex] = publicCard;
    } else if (step === "public_card") {
      if (root.cards.publicCards[target.slotIndex]?.id !== target.cardInstanceId) {
        return fail("COMPANY_PUBLIC_CARD_STALE", "公共牌已失效");
      }
      if (payload.abilityId === "mission_publicity_pick_income") {
        players.spendResources(player, { publicity: 2 });
      } else if (payload.abilityId === "fenwick_publicity_pick_corner") {
        players.spendResources(player, { publicity: 1 });
      }
      const picked = drawOptions(root).pickFromPublic(player, target.slotIndex);
      if (!picked.ok) return picked;
      irreversible = {
        code: "hidden_public_replenish",
        reason: "精选公共牌后翻开新牌",
      };
      if (payload.abilityId === "mission_publicity_pick_income") {
        const index = player.hand.findIndex((card) => card.id === picked.card.id);
        player.hand.splice(index, 1);
        // 收入牌插入起始收入牌下方，移出游戏（不进弃牌堆、不会被洗回主牌库）。
        cards.addRemovedFromGame(root.cards, picked.card);
        const gained = industryAbilities.applyIncomeResourcesFromCard(cards, players, data, player, picked.card, {
          root,
          blindDraw: () => drawOptions(root).blindDraw(player),
        });
        if (!gained.ok) return gained;
      } else if (payload.abilityId === "fenwick_publicity_pick_corner") {
        const applied = industryAbilities.applyCornerReward(
          players,
          data,
          player,
          industryAbilities.getCornerReward(cards, picked.card),
          { root, cards },
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
        state: root,
        players: root.players,
        pieces: root.pieces,
        planets: root.planets,
        aliens: root.aliens,
        data: root.data,
        cards: root.cards,
        solarSystem: root.solarSystem,
        turn: { ...root.turn, currentPlayerId: player.id },
        tech: root.tech,
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
    const allPlayers = root.players.players || [];
    if (!options.alreadyRevealed) {
      const revealed = aliens.revealAlien(root.aliens, slotId, module.ALIEN_ID);
      if (!revealed.ok) return revealed;
    }
    const random = () => nextRandom(root);
    const args = {
      jiuzhe: [root.aliens, slotId, owner, allPlayers, random],
      yichangdian: [root.aliens, slotId, owner, root.solarSystem?.earthSectorX || 1, random],
      banrenma: [
        root.aliens,
        slotId,
        owner,
        allPlayers,
        random,
        { takeSequence: () => stateSequences.take(root, "alienEntity") },
      ],
      fangzhou: [root.aliens, slotId, owner, allPlayers, random],
      chong: [root.aliens, slotId, owner, random],
      amiba: [root.aliens, slotId, owner, random],
      aomomo: [root.aliens, slotId, owner, random],
      runezu: [root.aliens, slotId, owner, { random }],
    };
    const initializer = module?.[`initialize${speciesId[0].toUpperCase()}${speciesId.slice(1)}Reveal`];
    if (typeof initializer !== "function") {
      return fail("ALIEN_INITIALIZER_MISSING", `${speciesId} 缺少正式揭示 initializer`);
    }
    const initialized = initializer(...args[speciesId]);
    if (!initialized.ok) return initialized;
    if (speciesId === "阿米巴" && typeof amiba?.migrateLegacyTraces === "function") {
      // 揭示前玩家已在通用槽位放置的首痕迹迁入阿米巴痕迹格（amiba_3 等机制读取）
      amiba.migrateLegacyTraces(root.aliens, slotId, {
        takeSequence: () => stateSequences.take(root, "alienEntity"),
      });
    }
    const grants = !["jiuzhe", "fangzhou"].includes(speciesId)
      ? aliens.grantAlienCardsForFirstTraces(
        root.aliens,
        slotId,
        allPlayers,
        module,
        {
          random,
          label: module.ALIEN_ID,
          takeSequence: () => stateSequences.take(root, "alienEntity"),
        },
      )
      : { ok: true, totalDrawn: 0, irreversible: null };
    if (!grants.ok) return grants;
    // 方舟专属：揭示时，state 面板拥有首痕迹的玩家按首痕迹数量各获得 1 次基础奖励
    // （翻 card1 基础奖励牌，结算 gain/数据/盲抽/额外公共扫描）。
    let revealRewardEffects = [];
    let revealIrreversible = grants.irreversible || null;
    if (speciesId === "fangzhou" && typeof module.flipCard1Reward === "function") {
      for (const player of allPlayers) {
        const firstTraceCount = aliens.countFirstTracesForPlayerOnSlot
          ? aliens.countFirstTracesForPlayerOnSlot(root.aliens, slotId, player)
          : 0;
        for (let rewardIndex = 0; rewardIndex < firstTraceCount; rewardIndex += 1) {
          const flip = module.flipCard1Reward(root.aliens, "basic", random);
          if (!flip.ok) return flip;
          const reward = flip.effect || {};
          // 通用 gain/data/blindDraw 走共享转换；additionalPublicScan 为方舟专属追加
          const translated = [
            ...cards.buildRewardEffects(reward, "alienReveal"),
          ];
          if (reward.additionalPublicScan) {
            translated.push({
              type: "gain_resources",
              options: { gain: { additionalPublicScan: reward.additionalPublicScan } },
            });
          }
          const applied = applyFormalCardEffects(root, player, translated, "alienRevealScore");
          if (!applied.ok) return applied;
          revealRewardEffects.push(...applied.spawnedEffects);
          if (applied.irreversible) revealIrreversible = applied.irreversible;
        }
      }
      if (!revealIrreversible) {
        revealIrreversible = { code: "fangzhou_reward_reveal", reason: "方舟奖励牌已翻开" };
      }
    }
    return {
      ok: true,
      initialized,
      grants,
      spawnedEffects: revealRewardEffects,
      irreversible: revealIrreversible || {
        code: "alien_reveal",
        reason: "外星人物种已揭示",
      },
    };
  }

  function findNeutralPlayerColor(root) {
    // 3 人局：4 色中未参与游戏的玩家颜色作为中立标记来源。
    const activeColors = new Set((root.players?.players || [])
      .filter((player) => (root.turn?.activePlayerIds || []).includes(player.id))
      .map((player) => player.color));
    return (players.PLAYER_COLOR_IDS || [])
      .find((color) => !activeColors.has(color)) || null;
  }

  function revealReadyAliens(root, owner) {
    const revealed = [];
    const spawnedEffects = [];
    for (const slotId of [1, 2]) {
      const slot = aliens.getAlienSlot(root.aliens, slotId);
      if (!slot || slot.revealed || !aliens.isAlienReadyToReveal(slot)) continue;
      const picked = aliens.revealRandomAlien(
        root.aliens,
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
      spawnedEffects.push(...(initialized.spawnedEffects || []));
    }
    return {
      ok: true,
      revealed,
      spawnedEffects,
      irreversible: revealed.length
        ? { code: "alien_reveal_turn_end", reason: "回合结束揭示外星人" }
        : null,
    };
  }

  function buildCardTaskContext(root) {
    const probeData = cardPlayDomain.buildProbeLocationData
      ? cardPlayDomain.buildProbeLocationData(root)
      : { details: [], index: {} };
    return {
      data: root.data,
      aliens: root.aliens,
      planets: root.planets,
      probeLocations: probeData.index,
      probeLocationDetails: probeData.details,
      dataTotals: Object.fromEntries((root.players.players || []).flatMap((player) => {
        const available = Number(player.resources?.availableData) || 0;
        const placed = Number(player.resources?.placedData) || 0;
        return [[player.id, available + placed], [player.color, available + placed]];
      })),
    };
  }

  function rewardEffects(reward, prefix = "residual-reward") {
    // 统一奖励转换：与 play-domain 角标、applyReward 共用 cards.buildRewardEffects
    return cards.buildRewardEffects(reward, prefix);
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
        // 化石与任务不绑定：任意已送达目的地的化石都可完成目的地匹配的任务卡
        const deliveredFossils = task?.kind === "transport"
          ? chong.listDeliveredFossilsForDestination(root.aliens, task.destinationPlanetId)
          : [];
        const ready = task?.kind === "trace"
          ? chong.isTraceTaskReady(root.aliens, player, task)
          : task?.kind === "transport"
            ? deliveredFossils.length > 0
            : false;
        if (ready) tasks.push({
          kind: "chong_task",
          cardInstanceId: card.id,
          ruleId: task.id || task.kind,
          effects: clone(Array.isArray(task.effects)
            ? task.effects
            : rewardEffects(task.rewards || task, `chong:${card.id}`)),
          label: task.label || cards.getCardLabel(card),
          ...(deliveredFossils[0] ? {
            rocketId: deliveredFossils[0].rocketId,
            destinationPlanetId: deliveredFossils[0].task?.destinationPlanetId || task.destinationPlanetId,
            fossilId: deliveredFossils[0].fossilId,
            fossilRewardRepeat: Math.max(0, Math.round(Number(task.fossilRewardRepeat) || 1)),
          } : {}),
        });
      } else if (amiba.isAmibaCard(card) && !card.amibaTaskCompleted) {
        // 只有携带理论任务的阿米巴牌（如 amiba_8）参与任务结算；
        // 3 型终局计分牌（基因组表征等）不得在回合末弹出结算选项。
        const task = card.amibaTask || amiba.getCardTask(card);
        if (task && amiba.isTheoryTaskReady(root.aliens, player)) {
          const reward = amiba.getTheoryTaskReward(root.aliens);
          tasks.push({
            kind: "amiba_task",
            cardInstanceId: card.id,
            ruleId: task?.id || task?.kind || "amiba_theory",
            effects: clone(reward.effects || []),
            label: task?.label || cards.getCardLabel(card),
          });
        }
      }
    }
    const triggers = (root.turn?.type1TriggerEvents || []).flatMap((event) => (
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

  function findTaskCardImageSrc(root, cardInstanceId) {
    if (!cardInstanceId) return null;
    const allCards = [];
    for (const player of (root.players?.players || [])) {
      allCards.push(...(player.reservedCards || []), ...(player.hand || []));
    }
    allCards.push(...(root.cards?.discardPile || []));
    const card = allCards.find((candidate) => String(candidate?.id) === String(cardInstanceId));
    if (!card) return null;
    const entry = cards.getCatalogEntryForCard(card);
    if (entry) return cards.getCardSrc(entry);
    // 外星人牌（阿米巴/奥陌陌/虫等）不在标准卡表，用物种模块的卡图
    for (const module of Object.values(SPECIES_MODULES || {})) {
      if (typeof module?.getCardDefinition !== "function" || typeof module?.getCardSrc !== "function") continue;
      if (card.set && !String(card.set).startsWith("alien:")) continue;
      const definition = module.getCardDefinition(card);
      if (definition) return module.getCardSrc(definition.index);
    }
    return card.src || null;
  }

  function cardDecisionChoices(root, effect) {
    const payload = effect.payload || {};
    if (payload.kind === "trigger" && Array.isArray(payload.matches) && payload.matches.length) {
      // 触发任务多选一：列出该事件全部仍可触发的候选槽位，玩家只能选择其一。
      const choices = [];
      for (const match of payload.matches) {
        const settlement = findCardSettlement(root, effect.ownerId, {
          kind: "trigger",
          cardInstanceId: match.cardInstanceId,
          ruleId: match.ruleId,
          event: payload.event,
        });
        if (!settlement) continue; // 槽位已被消费或卡牌已离开保留区，不再可触发
        const cardImageSrc = findTaskCardImageSrc(root, settlement.cardInstanceId);
        choices.push({
          ...choice(
            "accept_optional_effect",
            `confirm:trigger:${settlement.cardInstanceId}:${settlement.ruleId}`,
            { cardInstanceId: settlement.cardInstanceId, ruleId: settlement.ruleId },
            {},
            `结算 ${settlement.label}`,
          ),
          // 任务触发选择直接展示任务卡图 + 任务内容/奖励说明
          ...(cardImageSrc ? {
            presentation: {
              cardKind: "pick",
              cardId: String(settlement.cardInstanceId),
              imageSrc: cardImageSrc,
              imageAlt: settlement.label,
              detail: (settlement.effects || [])
                .map((entry) => entry.label).filter(Boolean).join("；") || null,
            },
          } : {}),
        });
      }
      if (!choices.length) return [];
      choices.push(choice("accept_optional_effect", `skip:${payload.event?.type || "trigger"}`, {}, {}, "跳过"));
      return formalize(root, effect.ownerId, choices);
    }
    const settlement = findCardSettlement(root, effect.ownerId, payload);
    if (!settlement) return [];
    const id = `${settlement.kind}:${settlement.cardInstanceId}:${settlement.ruleId}`;
    const cardImageSrc = findTaskCardImageSrc(root, settlement.cardInstanceId);
    return formalize(root, effect.ownerId, [
      {
        ...choice("accept_optional_effect", `confirm:${id}`, {}, {}, `结算 ${settlement.label}`),
        // 任务触发选择直接展示任务卡图 + 任务内容/奖励说明
        ...(cardImageSrc ? {
          presentation: {
            cardKind: "pick",
            cardId: String(settlement.cardInstanceId),
            imageSrc: cardImageSrc,
            imageAlt: settlement.label,
            detail: (settlement.effects || [])
              .map((entry) => entry.label).filter(Boolean).join("；") || null,
          },
        } : {}),
      },
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
    } else if (effect.type === cardEffects.EFFECT_TYPES.RESEARCH_TECH) {
      type = science.EFFECT_TYPES.RESEARCH;
      kind = "decision";
      decisionKind = "choose_target";
      payload.options = {
        ...clone(effect.options || {}),
        skipCost: effect.options?.skipCost !== false,
      };
    } else if (effect.type === cardEffects.EFFECT_TYPES.SCAN_ACTION) {
      // 扫描行动走 science EXECUTE → scanQueue（串尾自带 SCAN_FINALIZE 统一结算）。
      // 其余扫描家族（SCAN_NEBULA/ANY_SECTOR_SCAN/SCAN_COLOR_CHOICE/PUBLIC_SCAN 等）
      // 在卡牌域统一收敛到 science SCAN_STEP（play-domain createSpawnedCardEffect）；
      // 本域（外星/任务/公司触发）当前没有任何扫描家族效果来源，故不重复映射。
      type = science.EFFECT_TYPES.EXECUTE;
      payload.action = {
        family: "scan",
        phase: "main",
        actorId: ownerId,
        target: { kind: "card-scan-action" },
        payload: { skipCost: true },
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
            const gained = data.gainData(player, { source: "card_trigger", root });
            // 数据池已满时数据被弃置（discarded），属正常结果，不中断结算
            if (!gained.ok && !gained.discarded) return gained;
          }
        } else if (effect.type === "card_count_aliens_resource") {
          // 每个外星人：玩家有痕迹的外星人槽位数量 × 单个奖励（如 b_46）。
          const gainPerAlien = effect.options?.gainPerAlien || {};
          const alienState = root.aliens;
          const traceTypes = aliens?.TRACE_TYPES || ["yellow", "pink", "blue"];
          let alienCount = 0;
          for (const [slotId, slot] of Object.entries(alienState?.aliens || {})) {
            if (!slot || slot.revealed === undefined) continue;
            let hasTrace = false;
            for (const traceType of traceTypes) {
              const count = typeof aliens.countTraceMarkersForPlayerOnSlot === "function"
                ? aliens.countTraceMarkersForPlayerOnSlot(alienState, Number(slotId), player, traceType)
                : 0;
              if (count > 0) {
                hasTrace = true;
                break;
              }
            }
            if (hasTrace) alienCount += 1;
          }
          if (alienCount > 0) {
            const gain = {};
            for (const [key, perAlien] of Object.entries(gainPerAlien)) {
              gain[key] = Number(perAlien || 0) * alienCount;
            }
            players.gainResources(player, gain);
            if (gain.score) addScoreSource(player, sourceKey, gain.score);
          }
        } else if (effect.type === "aomomo_spend_fossils_gain_score") {
          // 奥陌陌任务奖励：支付化石换分数（如 aomomo_2 花 2 化石得 11 分）。
          const cost = Math.max(0, Math.round(Number(effect.options?.cost) || 0));
          const scoreGain = Math.max(0, Math.round(Number(effect.options?.score) || 0));
          if (cost > 0 && typeof aomomo?.spendFossils === "function") {
            const spent = aomomo.spendFossils(player, cost);
            if (!spent.ok) return spent;
          }
          if (scoreGain > 0) {
            players.gainResources(player, { score: scoreGain });
            addScoreSource(player, sourceKey, scoreGain);
          }
        } else if (effect.type === "runezu_symbol_reward") {
          // 符文族牌奖励：玩家获得指定符文 symbol（进入持有集合，可放 face 或参与终局计分）。
          const symbolId = effect.options?.symbolId;
          if (symbolId && typeof runezu?.gainPlayerSymbol === "function") {
            runezu.gainPlayerSymbol(player, symbolId);
          }
        } else if (effect.type === "amiba_choose_symbol_reward") {
          // 阿米巴区域 symbol 奖励：转成玩家选择决策（选该区域哪个细胞器结算），
          // 与打牌路径一致，不再自动结算全部。
          spawnedEffects.push({
            priority: "direct",
            effect: {
              type: `${cardPlayDomain.EFFECT_TYPES.EFFECT}:decision:${effect.type}`,
              kind: "decision",
              decisionKind: "choose_target",
              ownerId: player.id,
              payload: { cardEffect: clone(effect) },
            },
          });
        } else if (effect.type === "draw_cards") {
          const count = Math.max(1, Number(effect.options?.count) || 1);
          const drawContext = drawOptions(root);
          for (let drawIndex = 0; drawIndex < count; drawIndex += 1) {
            const drawn = drawContext.blindDraw(player);
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

  // 统一奖励应用：reward 对象（资源/数据/抽卡/精选/移动/符文符号）转效果并结算。
  // 弃牌角标、卡牌效果、外星人与符文族奖励都走这一条路径（buildRewardEffects 为纯转换，这里是应用端）。
  function applyReward(root, player, reward, sourceKey) {
    const effects = cards.buildRewardEffects(reward, sourceKey || "alien-reward");
    if (reward?.symbolId) runezu.gainPlayerSymbol(player, reward.symbolId);
    if (reward?.panelSymbol && reward?.panelSymbolSlotId) {
      const taken = runezu.takePanelSymbol(
        root.aliens,
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
      const applied = applyReward(root, player, reward, "cardQuickScore");
      if (!applied.ok) return applied;
      spawnedEffects.push(...applied.spawnedEffects);
      irreversible = applied.irreversible;
    } else if (action.payload?.kind === "move") {
      const base = cards.getDiscardActionMoveRewardForCard(card);
      if (!base) return fail("CARD_CORNER_STALE", "卡牌移动角标已失效");
      reward = {
        ...clone(base),
        gain: Object.fromEntries(Object.entries(base.gain || {}).map(
          ([key, value]) => [key, Number(value) * multiplier],
        )),
        movementPoints: Math.max(1, Number(base.movementPoints) || 1) * multiplier,
      };
      // 统一奖励转换：gain 与 movementPoints 一起经 buildRewardEffects
      // 生成 gain_resources + card_move 效果（card_move 由 applyFormalCardEffects 转决策节点）
      const applied = applyReward(root, player, reward, "cardQuickScore");
      if (!applied.ok) return applied;
      spawnedEffects.push(...applied.spawnedEffects);
      irreversible = applied.irreversible;
    } else if (action.payload?.kind === "runezu_symbol") {
      const resolved = runezu.getTraceFaceRewardForSymbol(
        root.aliens,
        action.payload.symbolId,
      );
      reward = resolved.ok ? resolved.reward : null;
      if (reward) {
        const applied = applyReward(root, player, reward, "alienCardQuickScore");
        if (!applied.ok) return applied;
        spawnedEffects.push(...applied.spawnedEffects);
        irreversible = applied.irreversible;
      }
    } else if (action.payload?.kind === "fangzhou_basic") {
      const flip = SPECIES_MODULES.fangzhou.flipCard1Reward(
        root.aliens,
        "basic",
        () => nextRandom(root),
      );
      if (!flip.ok) return flip;
      reward = flip.effect;
      // 通用 gain/data/blindDraw 走共享转换，随 multiplier 重复
      const repeatedEffects = Array.from({ length: multiplier }, () => reward)
        .flatMap((entry) => cards.buildRewardEffects(entry, "alienCardQuickScore"));
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
    cards.addToDiscardPile(root.cards, removed.card);
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
      root.aliens,
      action.target?.position,
      player,
      action.target?.symbolId,
    );
    if (!placed.ok) return placed;
    const applied = applyReward(
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

  function listFossilArrivalEvents(root) {
    if (!chong?.listTransportArrivalEvents || !solar) return [];
    return chong.listTransportArrivalEvents(
      root.aliens,
      root.pieces?.rockets || [],
      (planetId) => {
        try {
          const snapshot = solar.createSolarSnapshot(root.solarSystem);
          const planet = (snapshot.planetLocations || []).find((entry) => entry.planetId === planetId);
          return planet ? { x: planet.x, y: planet.y } : null;
        } catch (_error) {
          return null;
        }
      },
      { source: "rocket-move" },
    );
  }

  function augmentEffectResult(root, executorResult, sourceEffect) {
    if (!executorResult || executorResult.ok !== true || !root?.players) {
      return executorResult;
    }
    const spawnedEffects = [...(executorResult.spawnedEffects || [])];
    // 金里程碑不再「跨过阈值立即摆放」：规则书 P18 要求玩家完成所有主行动与
    // 免费行动、结束回合之后再结算里程碑。回合末由 probe-turn 的
    // final_scoring:milestone handoff 统一生成 FINAL_MARK（先金里程碑、
    // 再中立里程碑、最后外星人揭示）。这里仅过滤本 effect 自身产生的
    // FINAL_MARK，避免回合末 handoff 与即时生成重复。
    const sourceType = sourceEffect?.type;
    if (sourceType === EFFECT_TYPES.FINAL_MARK
      || (sourceType === HANDOFF_TYPE && sourceEffect?.payload?.domain === "final_scoring")) {
      return { ...executorResult, spawnedEffects };
    }
    // 移动到位也算送达：火箭搬运化石到达目的地星球坐标（不要求环绕/登陆）
    // 即生成 visitPlanet 事件，标记化石 delivered，之后玩家可通过完成任务交任务。
    const arrivalEvents = listFossilArrivalEvents(root);
    if (!Array.isArray(executorResult.events) || !executorResult.events.length) {
      if (!arrivalEvents.length) return { ...executorResult, spawnedEffects };
      const events = arrivalEvents.filter((event) => event?.type);
      const ownerId = sourceEffect?.ownerId || events.find((event) => event.playerId)?.playerId;
      const owner = actor(root, ownerId);
      if (owner) {
        for (const event of events) {
          if (event.type === "visitPlanet" && event.rocketId != null) {
            chong.markTransportedFossilDelivered(
              root.aliens,
              event.rocketId,
              event.planetId || null,
            );
          }
        }
      }
      return { ...executorResult, spawnedEffects, events };
    }
    const events = [...(executorResult.events.filter((event) => event?.type)), ...arrivalEvents];
    const ownerId = sourceEffect?.ownerId || events.find((event) => event.playerId)?.playerId;
    const owner = actor(root, ownerId);
    if (owner) {
      for (const event of events) {
        if (event.type === "visitPlanet" && event.rocketId != null) {
          chong.markTransportedFossilDelivered(
            root.aliens,
            event.rocketId,
            event.planetId || null,
          );
        }
      }
      // 触发任务：每个事件最多生成一个触发 Decision，其候选为该事件全部匹配
      // （不同卡牌或同一张牌的多个触发槽）。规则书：若一个行动/效果可触发多个
      // 任务，玩家自行选择触发其中哪一个——每个行动/效果只能触发并覆盖一个任务，
      // 其余必须再次达成条件才能触发。因此同事件的多匹配合并为单选，不再逐个生成。
      const seenTriggerKeys = new Set();
      for (const event of events) {
        const eventMatches = cardTaskState.collectType1TriggerMatches(owner, [event], cardEffects);
        const uniqueMatches = [];
        for (const match of eventMatches) {
          const key = `${match.card.id}:${match.trigger.id}`;
          if (seenTriggerKeys.has(key)) continue;
          seenTriggerKeys.add(key);
          uniqueMatches.push(match);
        }
        if (!uniqueMatches.length) continue;
        spawnedEffects.push(decision(EFFECT_TYPES.CARD_DECISION, owner.id, {
          kind: "trigger",
          matches: uniqueMatches.map((match) => ({
            cardInstanceId: match.card.id,
            ruleId: match.trigger.id,
            label: match.trigger.label || cards.getCardLabel(match.card),
          })),
          event: clone(event),
        }, "accept_optional_effect"));
      }
      for (const bonus of root.turn.cardTurnEventBonuses || []) {
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

  // 发放 1 枚化石奖励（交虫族搬运任务时，按任务卡 fossilRewardRepeat 重复）。
  // gain 直接入资源；data 池满弃置不中断；盲抽/精选走统一抽牌上下文。
  function applyChongFossilReward(root, player, fossilId, repeat = 1) {
    const spawnedEffects = [];
    let irreversible = null;
    for (let index = 0; index < Math.max(1, repeat); index += 1) {
      const applied = chong.applyFossilRewardOnly(root.aliens, player, fossilId, {
        gainResources(gain) {
          players.gainResources(player, gain);
        },
        gainData() {
          const result = data.gainData(player, { source: "chong_fossil_reward", root });
          if (!result.ok && !result.discarded) return result;
          return { ok: true };
        },
        blindDraw() {
          const drawn = drawOptions(root).blindDraw(player);
          if (!drawn.ok) return drawn;
          irreversible = { code: "hidden_card_draw", reason: "虫族化石奖励盲抽翻开隐藏牌" };
          return drawn;
        },
        pickCard() {
          spawnedEffects.push(decision(science.EFFECT_TYPES.PICK_CARD, player.id, {}, "choose_card"));
        },
      });
      if (!applied.ok) return applied;
    }
    return { ok: true, spawnedEffects, irreversible };
  }

  // 统一任务结算内核：complete_task 快速行动（settleReadyTaskDirect）与回合末
  // CARD_DECISION（settleCardDecision）共用同一实现。处理：按 kind 消费
  // （task/trigger/chong_task/amiba_task）、虫族搬运棋子移除、保留区移除+移出
  // 游戏+完成任务数、任务奖励（sourceKey 区分触发/任务计分来源）、化石奖励。
  function settleTaskCardConsumption(root, player, settlement, cardIndex, sourceKey) {
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
          root.aliens,
          settlement.rocketId,
          {
            cardId: card.id,
            destinationPlanetId: settlement.destinationPlanetId,
          },
        );
        if (!transport.ok) return transport;
      }
      // 化石送达后从太阳系盘面移除搬运棋子，不能再移动
      if (settlement.fossilId && rockets?.removeRocket) {
        const piecesState = root.pieces;
        for (const rocket of [...(piecesState?.rockets || [])]) {
          if (rocket.kind === "chong-fossil" && rocket.fossilId === settlement.fossilId) {
            rockets.removeRocket(piecesState, rocket.id);
          }
        }
      }
      card.chongTaskCompleted = true;
      consumed = true;
    } else if (settlement.kind === "amiba_task") {
      card.amibaTaskCompleted = true;
      consumed = true;
    }
    if (!consumed) return fail("CARD_RULE_ALREADY_CONSUMED", "任务规则已经结算");
    if (settlement.kind !== "trigger" || cardEffects.areAllTriggersConsumed(card)) {
      player.reservedCards.splice(cardIndex, 1);
      cards.addRemovedFromGame(root.cards, card);
      player.completedTaskCount = (Number(player.completedTaskCount) || 0) + 1;
    }
    const applied = applyFormalCardEffects(root, player, settlement.effects, sourceKey);
    if (!applied.ok) return applied;
    // 虫族搬运任务：同时发放被运输化石自身的奖励（按任务卡 fossilRewardRepeat 重复）
    let fossilReward = { ok: true, spawnedEffects: [], irreversible: null };
    if (settlement.kind === "chong_task" && settlement.fossilId) {
      fossilReward = applyChongFossilReward(
        root,
        player,
        settlement.fossilId,
        Math.max(1, Number(settlement.fossilRewardRepeat) || 1),
      );
      if (!fossilReward.ok) return fossilReward;
    }
    return {
      ok: true,
      cardInstanceId: settlement.cardInstanceId,
      ruleId: settlement.ruleId,
      spawnedEffects: [
        ...(applied.spawnedEffects || []),
        ...(fossilReward.spawnedEffects || []),
      ],
      irreversible: applied.irreversible || fossilReward.irreversible || null,
    };
  }

  function settleReadyTaskDirect(root, ownerId, cardInstanceId, ruleId) {
    // 规则书 P15：条件任务在达成条件后可用免费行动完成。此函数由 complete_task
    // 免费行动直接结算一个已满足条件的任务（条件任务 / 虫族搬运 / 阿米巴理论），
    // 无需玩家再次确认。
    const settlement = listCardSettlements(root, ownerId)
      .find((entry) => (
        entry.cardInstanceId === cardInstanceId
        && entry.ruleId === ruleId
        && ["task", "chong_task", "amiba_task"].includes(entry.kind)
      ));
    const player = actor(root, ownerId);
    if (!settlement || !player) {
      return fail("CARD_TASK_STALE", "条件任务已失效");
    }
    const cardIndex = (player.reservedCards || [])
      .findIndex((card) => card.id === settlement.cardInstanceId);
    // 统一结算内核：与回合末 CARD_DECISION（settleCardDecision）同一实现
    return settleTaskCardConsumption(root, player, settlement, cardIndex, "taskCardScore");
  }

  function settleCardDecision(root, effect, selected) {
    const legal = cardDecisionChoices(root, effect)
      .find((candidate) => candidate.actionId === selected?.actionId);
    const payload = effect.payload || {};
    let settlement;
    if (payload.kind === "trigger" && Array.isArray(payload.matches)) {
      // 触发任务多选一：以玩家所选候选的 cardInstanceId/ruleId 重新解析 settlement。
      const target = legal?.target || {};
      settlement = findCardSettlement(root, effect.ownerId, {
        kind: "trigger",
        cardInstanceId: target.cardInstanceId,
        ruleId: target.ruleId,
        event: payload.event,
      });
    } else {
      settlement = findCardSettlement(root, effect.ownerId, payload);
    }
    const player = actor(root, effect.ownerId);
    if (!legal || !settlement || !player) {
      return fail("CARD_DECISION_STALE", "卡牌触发 Decision 已失效");
    }
    if (String(legal.target.choiceId).startsWith("skip:")) {
      return { ok: true, spawnedEffects: [], irreversible: null };
    }
    const cardIndex = (player.reservedCards || [])
      .findIndex((card) => card.id === settlement.cardInstanceId);
    // 统一结算内核：与 complete_task 快速行动（settleReadyTaskDirect）同一实现
    // （触发任务计分来源 cardEffectScore，其余任务 taskCardScore）。
    return settleTaskCardConsumption(
      root,
      player,
      settlement,
      cardIndex,
      settlement.kind === "trigger" ? "cardEffectScore" : "taskCardScore",
    );
  }

  function settleFinalScores(root) {
    const scores = [];
    for (const player of root.players.players || []) {
      const breakdown = endGameScoring.computePlayerFinalScore({
        ...root,
        players: root.players.players,
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

  function orderFinalOwnersFromOwner(root, ownerId) {
    const order = root.turn?.turnOrderPlayerIds || [];
    const startIndex = ownerId ? order.indexOf(ownerId) : -1;
    const rotated = startIndex >= 0
      ? [...order.slice(startIndex), ...order.slice(0, startIndex)]
      : order;
    const pendingIds = new Set(listPendingFinalOwners(root).map((player) => player.id));
    return rotated
      .filter((playerId) => pendingIds.has(playerId))
      .map((playerId) => actor(root, playerId))
      .filter(Boolean);
  }

  function listPendingFinalOwners(root) {
    return (root.players.players || []).filter((player) => (
      finalScoring.getPendingMarksForPlayer(root.finalScoring, player).length
    ));
  }

  function amibaCardChoices(root, ownerId) {
    return alienCardChoices(root, ownerId, "amiba");
  }

  // 统一外星人拿牌决策：任何有牌组的物种（虫/阿米巴/奥陌陌/半人马/符文族/异常点）
  // 都从自己的牌组拿展示牌或盲抽，不再逐物种特判。
  function alienCardChoices(root, ownerId, speciesId) {
    const module = SPECIES_MODULES[speciesId];
    if (!module || typeof module.blindDrawCard !== "function") {
      return formalize(root, ownerId, []);
    }
    const ensureMethod = `ensure${speciesId[0].toUpperCase()}${speciesId.slice(1)}State`;
    const state = typeof module[ensureMethod] === "function"
      ? module[ensureMethod](root.aliens)
      : (root.aliens?.[speciesId] || {});
    const displayedIndex = state?.displayedCardIndex ?? null;
    const displayed = displayedIndex == null
      ? []
      : [{
        ...choice(
          "choose_card", `${speciesId}:display:${displayedIndex}`,
          { source: "display", cardIndex: displayedIndex }, {},
          `获得展示的${module.getCardDefinition?.(displayedIndex)?.cardName || "外星人牌"}`,
        ),
        ...(typeof module.getCardSrc === "function"
          && module.getCardDefinition?.(displayedIndex)
          ? {
            presentation: {
              cardKind: "pick",
              cardId: String(displayedIndex),
              imageSrc: module.getCardSrc(displayedIndex),
              imageAlt: module.getCardDefinition(displayedIndex).cardName || "外星人牌",
            },
          }
          : {}),
      }];
    const blind = (state?.cardDeck || []).length
      ? [choice("choose_card", `${speciesId}:blind`, { source: "blind" }, {}, `盲抽${module.ALIEN_ID || speciesId}牌`)]
      : [];
    const cancel = [choice("choose_card", `${speciesId}:cancel`, { source: "cancel" }, {}, "取消")];
    return formalize(root, ownerId, [...displayed, ...blind, ...cancel]);
  }

  function aomomoCardChoices(root, ownerId) {
    const state = aomomo.ensureAomomoState(root.aliens);
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
    if (payload.domain === "income" && effectType === "round_start_income") {
      const resourcesBefore = clone(owner?.resources || {});
      const handCountBefore = (owner?.hand || []).length;
      const income = owner?.income || owner?.resources?.income || {};
      players.gainResources(owner, {
        credits: Number(income.credits) || 0,
        energy: Number(income.energy) || 0,
        publicity: Number(income.publicity) || 0,
        availableData: Number(income.availableData) || 0,
        additionalPublicScan: Number(income.additionalPublicScan) || 0,
      });
      const drawnCards = [];
      const drawContext = drawOptions(root);
      for (let index = 0; index < Math.max(0, Number(income.handSize) || 0); index += 1) {
        const drawn = drawContext.blindDraw(owner);
        if (!drawn.ok) return drawn;
        drawnCards.push(drawn.card);
      }
      return {
        ok: true,
        irreversible: drawnCards.length
          ? { code: "hidden_card_draw", reason: "收入盲抽翻开隐藏牌" }
          : null,
        events: [{
          type: "round_start_income",
          playerId: owner.id,
          roundNumber: Number(payload.data?.roundNumber) || roundOf(root),
          income: clone(income),
          resourcesBefore,
          resourcesAfter: clone(owner.resources || {}),
          handCountBefore,
          handCountAfter: (owner.hand || []).length,
        }],
      };
    }
    if (payload.domain === "income" && effectType === "planet_reward_income") {
      if (!(owner.hand || []).length) return { ok: true };
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
      industry.resetAllIndustryActionMarks(root.players.players);
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
      delete root.turn.type1TriggerEvents;
      root.turn.cardTurnEventBonuses = [];
      return { ok: true };
    }
    if (payload.domain === "card_trigger" && effectType === "turn_end") {
      const cardSettlements = listCardSettlements(root, effect.ownerId);
      root.turn.cardTurnEventBonuses = (root.turn.cardTurnEventBonuses || [])
        .filter((bonus) => (bonus.ownerId || bonus.playerId) !== effect.ownerId);
      return { ok: true, cardSettlements };
    }
    if (payload.domain === "alien" && effectType === "turn_end_reveal") {
      return revealReadyAliens(root, owner);
    }
    if (payload.domain === "final_scoring" && effectType === "milestone") {
      // 规则书 P18：里程碑在玩家回合结束（完成所有主行动与免费行动）后结算；
      // 多个玩家需要结算时，从刚结束回合的玩家开始按顺时针顺序依次结算。
      const pendingOwners = orderFinalOwnersFromOwner(root, owner?.id || null);
      return {
        ok: true,
        spawnedEffects: pendingOwners.map((player) => (
          decision(EFFECT_TYPES.FINAL_MARK, player.id, {})
        )),
        events: pendingOwners.map((player) => ({
          type: "final_milestone_pending",
          playerId: player.id,
        })),
      };
    }
    if (payload.domain === "alien" && effectType === "turn_end_neutral_milestone") {
      // 规则书 P18/P5：3 人局在 20/30 分设置中立里程碑（每位置 1 个中立标记）；
      // 玩家分数到达/超过阈值的回合结束后，把该阈值的中立标记放到外星人
      // 「最左侧未占用」发现位置（可能使外星人待揭示，随后由 turn_end_reveal 结算）。
      // 4 人局不放置中立标记；2 人局仓库暂不支持。
      const activeCount = Number(root.turn?.activePlayerCount) || 0;
      if (activeCount !== 3) return { ok: true };
      const alienState = root.aliens;
      const events = [];
      const neutralThresholds = aliens?.NEUTRAL_SCORE_TRACE_THRESHOLDS || [20, 30];
      for (const threshold of neutralThresholds) {
        if (aliens.getNeutralScoreTraceMark?.(alienState, threshold)) continue;
        const triggerPlayer = (root.players?.players || []).find((player) => (
          Number(player?.resources?.score) >= threshold
        ));
        if (!triggerPlayer) continue;
        const neutralColor = findNeutralPlayerColor(root);
        const placed = aliens.placeNeutralScoreTraceForThreshold?.(
          alienState,
          threshold,
          triggerPlayer,
          neutralColor,
        );
        if (!placed?.ok) continue;
        events.push({
          type: "neutral_score_trace_placed",
          playerId: owner?.id || null,
          threshold,
          alienSlotId: placed.alienSlotId,
          traceType: placed.traceType,
        });
      }
      return { ok: true, events };
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
        root.aliens,
        Number(payload.data.slotId),
        payload.data.traceType,
        Number(payload.data.position),
        owner,
        {
          ...(payload.data.options || {}),
          sequence: stateSequences.take(root, "alienEntity"),
        },
      );
    }
    if (payload.domain === "final_scoring" && effectType === "game_end") {
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
      if (action?.family === "complete_task") {
        // 完成任务：条件任务 / 虫族搬运任务 / 阿米巴理论任务。
        // 之前漏接此分支，complete_task 落到下方公司行动校验报「公司行动已失效」。
        const applied = settleReadyTaskDirect(
          root,
          action.actorId,
          action.target?.cardInstanceId,
          action.target?.ruleId,
        );
        if (!applied.ok) return applied;
        return result(state, root, "complete_task", {
          spawnedEffects: applied.spawnedEffects || [],
          irreversible: applied.irreversible || null,
          events: [{
            type: "complete_task",
            playerId: player.id,
            cardInstanceId: action.target?.cardInstanceId,
            ruleId: action.target?.ruleId,
          }],
          history: [{
            type: "complete_task",
            playerId: player.id,
            cardInstanceId: action.target?.cardInstanceId,
            ruleId: action.target?.ruleId,
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
      const spawnedEffects = companyQueue(root, player, flow);
      // 哨兵探测网络：若本轮先打牌、本次 1x 才武装哨兵，补开该打出的牌的
      // 弃牌角标节点（不弃牌；节点执行走统一 industry_sentinel_corner 执行器）。
      if (flow.flowType === "sentinel_arm_play_corner") {
        const sentinelNodes = industryAbilities.buildSentinelPlayCornerEffectNodes?.(
          cards,
          player,
          roundOf(root),
          turnOf(root),
          player.industryLastPlayedCardThisRound,
        ) || [];
        spawnedEffects.unshift(...sentinelNodes.map((node) => ({
          priority: "direct",
          effect: {
            type: node.type,
            ownerId: player.id,
            payload: { node },
          },
        })));
      }
      return result(state, root, "company_action", {
        spawnedEffects,
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
    // 哨兵探测网络「打牌后结算弃牌角标」节点：不弃牌，复用统一角标奖励转换
    // （applyCornerReward → cards.buildRewardEffects；card_move 转 free_move 决策）。
    runtime.registerExecutor("industry_sentinel_corner", (state, effect, context) => {
      const root = getRoot(state, context);
      const player = actor(root, effect.ownerId);
      const card = effect.payload?.node?.options?.playedCard
        || effect.payload?.playedCard
        || null;
      if (!player || !card) {
        return fail("INDUSTRY_SENTINEL_CORNER_STALE", "哨兵弃牌角标已失效");
      }
      const applied = industryAbilities.resolveSentinelPlayCorner(cards, players, data, player, card);
      if (!applied?.ok) return applied;
      const spawnedEffects = [];
      if (applied.pendingFreeMove) {
        spawnedEffects.push(decision(EFFECT_TYPES.COMPANY_DECISION, player.id, {
          companyId: industry.getPlayerIndustryLabel(player),
          abilityId: "sentinel_arm_play_corner",
          step: "free_move",
          remaining: 1,
          usedRocketIds: [],
        }));
      }
      return result(state, root, "industry_sentinel_corner", {
        spawnedEffects,
        events: [{
          type: "industry_sentinel_corner",
          playerId: player.id,
          cardId: card.cardId || null,
          message: applied.message,
        }],
        history: [{
          type: "industry_sentinel_corner",
          playerId: player.id,
          cardId: card.cardId || null,
          executorId: EXECUTOR_ID,
        }],
      });
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
            cardInstanceId: settled.cardInstanceId ?? effect.payload.cardInstanceId ?? null,
            ruleId: settled.ruleId ?? effect.payload.ruleId ?? null,
            ruleKind: effect.payload.kind,
          }],
        });
      },
    });
    runtime.registerExecutor(EFFECT_TYPES.ALIEN_CARD_DECISION, {
      getLegalChoices(state, effect, context) {
        const root = getRoot(state, context);
        return alienCardChoices(root, effect.ownerId, effect.payload?.speciesId);
      },
      resolveDecision(state, effect, selected, context) {
        const root = getRoot(state, context);
        const player = actor(root, effect.ownerId);
        const speciesId = effect.payload?.speciesId;
        const module = SPECIES_MODULES[speciesId];
        if (!player || !module || typeof module.blindDrawCard !== "function") {
          return fail("ALIEN_CARD_DECISION_STALE", "外星人卡牌选择已失效");
        }
        const legal = alienCardChoices(root, effect.ownerId, speciesId)
          .find((candidate) => candidate.actionId === selected?.actionId);
        if (!legal) {
          return fail("ALIEN_CARD_DECISION_STALE", "外星人卡牌选择已失效");
        }
        if (legal.target.source === "cancel") {
          return { ok: true, spawnedEffects: [], irreversible: null };
        }
        const gained = legal.target.source === "display"
          ? module.takeDisplayedCard(
            root.aliens,
            () => nextRandom(root),
            { sequence: stateSequences.take(root, "alienEntity") },
          )
          : module.blindDrawCard(
            root.aliens,
            () => nextRandom(root),
            { sequence: stateSequences.take(root, "alienEntity") },
          );
        if (!gained.ok || !gained.card) return gained;
        player.hand.push(gained.card);
        player.resources.handSize = player.hand.length;
        return result(state, root, `alien:${speciesId}_card`, {
          irreversible: { code: "hidden_alien_card", reason: "外星人牌堆已翻开" },
          events: [{
            type: "alien_card_gain",
            playerId: player.id,
            alienId: module.ALIEN_ID,
            cardInstanceId: gained.card.id,
            source: legal.target.source,
          }],
        });
      },
    });
    const finalMarkChoices = (state, effect, context) => {
      const root = getRoot(state, context);
      const player = actor(root, effect.ownerId);
      if (!player) return [];
      return formalize(root, player.id, finalScoring.DEFAULT_TILE_IDS.flatMap((tileId) => {
        if (!finalScoring.canMarkTile(root.finalScoring, tileId, player).ok) return [];
        const variant = root.finalScoring?.tileVariants?.[tileId] ?? 1;
        return [{
          ...choice("choose_target", `final:${tileId}`, { tileId }, {}, `标记 ${tileId.toUpperCase()}`),
          // 终局标记选择直接展示终局计分板块图片，玩家对照板块放标记
          presentation: {
            cardKind: "pick",
            cardId: String(tileId),
            imageSrc: `../assets/final/final_${tileId}${variant}.png`,
            imageAlt: `终局计分板块 ${tileId.toUpperCase()}`,
          },
        }];
      }));
    };
    runtime.registerExecutor(EFFECT_TYPES.FINAL_MARK, {
      getLegalChoices: finalMarkChoices,
      resolveDecision(state, effect, selected, context) {
        const root = getRoot(state, context);
        const legal = finalMarkChoices(state, effect, context)
          .find((candidate) => candidate.actionId === selected?.actionId);
        const player = actor(root, effect.ownerId);
        if (!legal || !player) return fail("FINAL_MARK_STALE", "终局标记 Decision 已失效");
        const marked = finalScoring.markTile(
          root.finalScoring, legal.target.tileId, player,
          { root },
        );
        if (!marked.ok) return marked;
        // 立即摆放后，settle 只在真正游戏结束时触发（turn.gameEnded），
        // 否则中局摆放完最后一个标记会提前结算终局分数。
        if (root.turn?.gameEnded === true && !listPendingFinalOwners(root).length) {
          settleFinalScores(root);
        }
        const hasMoreForOwner = finalScoring
          .getPendingMarksForPlayer(root.finalScoring, player).length > 0;
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
        && effect.payload?.effectType !== "milestone"
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
        events: applied.events || [],
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
