(function (root, factory) {
  "use strict";
  let standardAction = root.SetiStandardAction;
  let actions = root.SetiActions;
  let abilities = root.SetiAbilities;
  let players = root.SetiPlayers;
  let planetRewards = root.SetiPlanetRewards;
  let data = root.SetiData;
  let cards = root.SetiCards;
  let solar = root.SetiSolarSystem;
  let science = root.SetiScienceSession;
  let turnFlow = root.SetiTurnFlow;
  if (typeof require === "function") {
    standardAction = standardAction || require("../actions/standard-action");
    actions = actions || require("../actions");
    abilities = abilities || require("../abilities");
    players = players || require("../players");
    planetRewards = planetRewards || require("../actions/planet-rewards");
    data = data || require("../data");
    cards = cards || require("../cards/deck");
    solar = solar || require("../../solar-system/core");
    science = science || require("./science-session");
    turnFlow = turnFlow || require("../turn-flow");
  }
  const api = factory(
    standardAction, actions, abilities, players, planetRewards, data, cards, solar,
    science, turnFlow,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiProbeTurnSession = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  standardAction, actions, abilities, players, planetRewards, data, cards, solar,
  science, turnFlow,
) {
  "use strict";
  const DOMAIN_ID = "probe_turn";
  const EXECUTOR_ID = `${DOMAIN_ID}:executor:v1`;
  const ACTION_FAMILIES = Object.freeze(["launch", "move", "orbit", "land", "pass", "end_turn"]);
  const EFFECT_TYPES = Object.freeze({
    EXECUTE: "probe_turn_execute",
    MOVE_PAYMENT: "probe_turn_move_payment",
    REWARD: "probe_turn_reward",
    PASS: "probe_turn_pass",
    PASS_DISCARD: "probe_turn_pass_discard",
    PASS_RESERVE: "probe_turn_pass_reserve",
    PASS_COMMIT: "probe_turn_pass_commit",
    TURN_ADVANCE: "probe_turn_advance",
  });
  const DOMAIN_HANDOFF_EFFECT_TYPE = "game_domain_handoff";
  const DOMAIN_HANDOFF_SCHEMA_VERSION = "seti-game-domain-handoff-v1";
  const clone = (value) => value == null ? value : structuredClone(value);
  const fail = (code, message, details = {}) => ({ ok: false, code, message, ...details });
  const isMovePaymentCard = (card) => (
    Number(card?.discardActionCode) === 2
    || Boolean(cards.getDiscardActionMoveRewardForCard?.(card))
  );
  const getRoot = (state, context) => context?.workingRoot || context || state;
  const slice = (root, browserKey, committedKey) => root?.[browserKey] || root?.[committedKey] || {};
  const actor = (root, actorId) => {
    const state = slice(root, "playerState", "players");
    const id = actorId || state.currentPlayerId || root?.turn?.currentPlayerId;
    return (state.players || []).find((entry) => entry.id === id) || null;
  };
  function nextRandom(root) {
    if (!root?.meta) throw new TypeError("Probe Turn RNG 缺少 committed meta");
    root.meta.rngState = root.meta.rngState || {};
    const previous = root.meta.rngState.probeTurn || {};
    let state = Number.isSafeInteger(previous.state)
      ? previous.state >>> 0
      : [...String(root.meta.seed ?? "seti-probe-turn")]
        .reduce((hash, character) => Math.imul(hash ^ character.codePointAt(0), 16777619) >>> 0, 2166136261);
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    root.meta.rngState.probeTurn = {
      algorithm: "mulberry32-v1", state, cursor: (Number(previous.cursor) || 0) + 1,
    };
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  function actionContext(root, actorId) {
    const playerState = slice(root, "playerState", "players");
    const solarState = slice(root, "solarState", "solarSystem");
    const resolvedPlayerState = actorId === playerState.currentPlayerId
      ? playerState : { ...playerState, currentPlayerId: actorId, players: playerState.players };
    const context = {
      workingRoot: root,
      playerState: resolvedPlayerState,
      rocketState: slice(root, "rocketState", "pieces"),
      planetStatsState: slice(root, "planetStatsState", "planets"),
      alienGameState: slice(root, "alienGameState", "aliens"),
      nebulaDataState: slice(root, "nebulaDataState", "data"),
      cardState: slice(root, "cardState", "cards"),
      solarState,
      turnState: slice(root, "turnState", "turn"),
      techGameState: root.techGameState || root.tech || {},
      standardActionAuthority: {
        actorId,
        stateVersion: root.meta?.stateVersion ?? 0,
        decisionVersion: root.match?.decisionVersion ?? 0,
      },
      getPlanetLocations: () => solar.createSolarSnapshot(solarState).planetLocations,
    };
    context.getEarthSectorCoordinate = () => {
      const earth = context.getPlanetLocations().find((planet) => planet.planetId === "earth");
      return earth ? { x: earth.x, y: earth.y } : null;
    };
    return context;
  }
  function canStart(root, player) {
    if (!player) return fail("PROBE_TURN_ACTOR_MISSING", "没有当前玩家");
    if (player.mainActionCompleted) return fail("PROBE_TURN_MAIN_ACTION_COMPLETE", "主要行动已经完成");
    if (root.match?.pendingDecision) return fail("PROBE_TURN_PENDING_DECISION", "请先完成当前选择");
    return { ok: true };
  }
  function sessionRequired() {
    return fail("PROBE_TURN_SESSION_REQUIRED", "探测器与回合行动必须由 Effect Session 执行");
  }
  function createActionDefinitions() {
    const definitions = [];
    const launchAction = actions.getAction("launch");
    definitions.push(standardAction.createOptionDefinition("launch", {
      label: "发射",
      getOptions(context) {
        const root = context.workingRoot || context;
        const player = actor(root, context.standardActionAuthority?.actorId);
        const start = canStart(root, player);
        if (!start.ok) return start;
        const check = launchAction.canExecute(actionContext(root, player.id));
        return check.ok ? { ok: true, choices: [{ label: "发射" }] } : check;
      },
      canExecute(context) { return this.getOptions(context); },
      execute: sessionRequired,
    }));
    definitions.push(standardAction.createOptionDefinition("move", {
      label: "移动",
      getOptions(context) {
        const root = context.workingRoot || context;
        const player = actor(root, context.standardActionAuthority?.actorId);
        if (!player) return fail("PROBE_TURN_ACTOR_MISSING", "没有当前玩家");
        if (root.match?.pendingDecision) return fail("PROBE_TURN_PENDING_DECISION", "请先完成当前选择");
        const actionCtx = actionContext(root, player.id);
        const directionOrder = new Map(
          (abilities.rocket.MOVE_DIRECTIONS || []).map((direction, index) => [direction.id, index]),
        );
        const choices = (actionCtx.rocketState.rockets || [])
          .filter((rocket) => rocket.playerId === player.id && rocket.surface === "solar-board")
          .sort((left, right) => String(left.id).localeCompare(String(right.id), undefined, { numeric: true }))
          .flatMap((rocket) => (
            abilities.rocket.listMoveRequirements(actionCtx, player, rocket.id)
            .sort((left, right) => (
              (directionOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER)
              - (directionOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
            ))
            .filter((move) => (
              Number(player.resources?.energy || 0)
              + (player.hand || []).filter(isMovePaymentCard).length
              >= move.requiredMovePoints
            ))
            .map((move) => ({
              target: { rocketId: rocket.id, deltaX: move.deltaX, deltaY: move.deltaY },
              payload: { direction: move.id, requiredMovePoints: move.requiredMovePoints },
              label: `移动火箭 ${rocket.id} ${move.id}`,
            }))
          ));
        return choices.length ? { ok: true, choices } : fail("PROBE_MOVE_UNAVAILABLE", "没有合法移动目标");
      },
      canExecute(context, option) {
        const listed = this.getOptions(context);
        return listed.ok && listed.choices.some((choice) => (
          choice.target.rocketId === option.target?.rocketId
          && choice.target.deltaX === option.target?.deltaX
          && choice.target.deltaY === option.target?.deltaY
          && choice.payload.direction === option.payload?.direction
          && choice.payload.requiredMovePoints === option.payload?.requiredMovePoints
        )) ? { ok: true } : fail("PROBE_MOVE_STALE", "移动行动已失效");
      },
      execute: sessionRequired,
    }));
    for (const family of ["orbit", "land"]) {
      const reference = actions.getAction(family);
      definitions.push(standardAction.createOptionDefinition(family, {
        label: family === "orbit" ? "环绕" : "登陆",
        getOptions(context) {
          const root = context.workingRoot || context;
          const player = actor(root, context.standardActionAuthority?.actorId);
          const start = canStart(root, player);
          if (!start.ok) return start;
          const result = family === "orbit"
            ? reference.getOrbitOptions(actionContext(root, player.id))
            : reference.getLandOptions(actionContext(root, player.id));
          return result.ok ? {
            ok: true,
            choices: result.choices.map((choice) => ({
              target: {
                rocketId: choice.rocketId,
                planetId: choice.planetId,
                ...(family === "land" ? {
                  type: choice.target.type,
                  ...(choice.target.satelliteId ? { satelliteId: choice.target.satelliteId } : {}),
                } : {}),
              },
              payload: family === "land" ? { energyCost: choice.energyCost } : {},
              label: choice.label,
            })),
          } : result;
        },
        canExecute(context, option) {
          const listed = this.getOptions(context);
          return listed.ok && listed.choices.some((choice) => (
            JSON.stringify(choice.target) === JSON.stringify(option.target)
            && JSON.stringify(choice.payload) === JSON.stringify(option.payload || {})
          )) ? { ok: true } : fail(`PROBE_${family.toUpperCase()}_STALE`, `${this.label}行动已失效`);
        },
        execute: sessionRequired,
      }));
    }
    definitions.push(standardAction.createOptionDefinition("pass", {
      label: "PASS",
      getOptions(context) {
        const root = context.workingRoot || context;
        const player = actor(root, context.standardActionAuthority?.actorId);
        const start = canStart(root, player);
        if (!start.ok) return start;
        return !(slice(root, "turnState", "turn").passedPlayerIds || []).includes(player.id)
          ? { ok: true, choices: [{ target: { kind: "pass" }, label: "PASS" }] }
          : fail("PROBE_PASS_STALE", "玩家本轮已经 PASS");
      },
      canExecute(context) { return this.getOptions(context); },
      execute: sessionRequired,
    }));
    definitions.push(standardAction.createOptionDefinition("end_turn", {
      label: "结束回合",
      getOptions(context) {
        const root = context.workingRoot || context;
        const player = actor(root, context.standardActionAuthority?.actorId);
        return player?.mainActionCompleted || player?.passCompletionPending
          ? { ok: true, choices: [{ target: { kind: "end-turn" }, label: "结束回合" }] }
          : fail("PROBE_END_TURN_UNAVAILABLE", "主行动未完成或仍有待决选择");
      },
      canExecute(context) { return this.getOptions(context); },
      execute: sessionRequired,
    }));
    return Object.freeze(definitions);
  }
  function applyDirectReward(root, ownerId, effect) {
    const player = actor(root, ownerId);
    const options = effect.options || {};
    if (!player) return fail("PROBE_REWARD_OWNER_STALE", "行星奖励 owner 已失效");
    if (effect.type === planetRewards.EFFECT_TYPES.GAIN_RESOURCES) {
      players.gainResources(player, options.gain || {});
      return { ok: true, events: [{ type: "planet_reward_resources", playerId: player.id, gain: clone(options.gain || {}) }] };
    }
    if (effect.type === planetRewards.EFFECT_TYPES.GAIN_DATA) {
      const events = [];
      for (let index = 0; index < Math.max(0, Number(options.count) || 0); index += 1) {
        const result = data.gainData(player, { source: "planet_reward", root });
        events.push({ type: result.ok ? "planet_reward_data" : "planet_reward_data_discarded", playerId: player.id });
      }
      return { ok: true, events };
    }
    if (effect.type === planetRewards.EFFECT_TYPES.LAUNCH) {
      return abilities.executeAbility("launchProbe", actionContext(root, player.id), {
        skipCost: options.skipCost !== false,
        ignoreRocketLimit: Boolean(options.ignoreRocketLimit),
        cost: options.cost || {},
        source: options.source || "planet_reward",
      });
    }
    if (effect.type === planetRewards.EFFECT_TYPES.DRAW_CARDS) {
      const events = [];
      for (let index = 0; index < Math.max(0, Number(options.count) || 0); index += 1) {
        const result = cards.blindDraw(
          slice(root, "cardState", "cards"),
          slice(root, "playerState", "players"),
          player,
          () => nextRandom(root),
          { createCardInstance: (entry) => cards.createCommittedCardInstance(root, entry) },
        );
        if (!result.ok) return result;
        events.push({ type: "planet_reward_card", playerId: player.id, cardInstanceId: result.card?.id });
      }
      return { ok: true, events };
    }
    return fail("PROBE_PLANET_REWARD_UNSUPPORTED", `未支持的行星奖励: ${effect.type}`);
  }

  function chooseCombinations(items, count, start = 0, selected = [], result = []) {
    if (selected.length === count) {
      result.push([...selected]);
      return result;
    }
    for (let index = start; index <= items.length - (count - selected.length); index += 1) {
      selected.push(items[index]);
      chooseCombinations(items, count, index + 1, selected, result);
      selected.pop();
    }
    return result;
  }

  function passDiscardChoices(root, ownerId, discardCount) {
    const player = actor(root, ownerId);
    const cardsInHand = player?.hand || [];
    return science.formalizeChoices(
      root,
      ownerId,
      chooseCombinations(cardsInHand, discardCount).map((selected) => ({
        family: "choose_card",
        target: {
          kind: "pass-hand-limit",
          choiceId: selected.map((card) => card.id).join("|"),
          cardIds: selected.map((card) => card.id),
        },
        payload: { discardCount },
        summary: `弃置 ${selected.map((card) => cards.getCardLabel(card)).join("、")}`,
      })),
    );
  }

  function domainHandoff(domain, effectType, ownerId, payload = {}) {
    return {
      priority: "direct",
      effect: {
        type: DOMAIN_HANDOFF_EFFECT_TYPE,
        kind: "effect",
        ownerId,
        payload: {
          schemaVersion: DOMAIN_HANDOFF_SCHEMA_VERSION,
          effectType,
          domain,
          data: clone(payload),
        },
      },
    };
  }

  function buildPassEffects(root, player) {
    const effects = [];
    const turn = slice(root, "turnState", "turn");
    effects.push(domainHandoff("company", "company_pass", player.id, {
      roundNumber: turn.roundNumber,
      turnNumber: turn.turnNumber,
    }));
    const isFinalRound = Number(turn.roundNumber) >= turnFlow.DEFAULT_FINAL_ROUND;
    if (!isFinalRound) {
      const discardCount = Math.max(0, (player.hand || []).length - 4);
      if (discardCount) {
        effects.push({
          priority: "direct",
          effect: {
            type: EFFECT_TYPES.PASS_DISCARD,
            kind: "decision",
            decisionKind: "choose_card",
            ownerId: player.id,
            payload: { discardCount },
          },
        });
      }
      if (!(turn.passedPlayerIds || []).length) {
        effects.push({
          priority: "direct",
          effect: { type: EFFECT_TYPES.PASS, ownerId: player.id, payload: { kind: "first-rotation" } },
        });
      }
      const reserve = cards.getPassReservePile(slice(root, "cardState", "cards"), turn.roundNumber);
      if (reserve.length) {
        effects.push({
          priority: "direct",
          effect: {
            type: EFFECT_TYPES.PASS_RESERVE,
            kind: "decision",
            decisionKind: "choose_card",
            ownerId: player.id,
            payload: { roundNumber: turn.roundNumber },
          },
        });
      }
    }
    effects.push({
      priority: "direct",
      effect: { type: EFFECT_TYPES.PASS_COMMIT, ownerId: player.id },
    });
    return effects;
  }

  function createProbeTurnDomain(options = {}) {
    const runtime = options.runtime;
    const commitWorkingState = options.commitWorkingState;
    if (typeof runtime?.registerExecutor !== "function" || typeof commitWorkingState !== "function") {
      throw new TypeError("Probe Turn domain 缺少 Effect runtime/commitWorkingState");
    }
    const result = (state, root, source, extra = {}) => ({
      ok: true,
      nextState: commitWorkingState(state, { source, executorId: EXECUTOR_ID }),
      ...extra,
    });
    runtime.registerExecutor(EFFECT_TYPES.EXECUTE, (state, effect, workingContext) => {
      const root = getRoot(state, workingContext);
      const action = effect.payload?.action;
      const player = actor(root, action?.actorId);
      if (!player || !ACTION_FAMILIES.includes(action?.family)) {
        return fail("PROBE_TURN_ACTION_STALE", "探测器/回合行动已失效");
      }
      let executed;
      if (action.family === "launch") {
        executed = actions.getAction("launch").execute(actionContext(root, player.id));
      } else if (action.family === "move") {
        return result(state, root, action.family, {
          spawnedEffects: [{
            priority: "direct",
            effect: {
              type: EFFECT_TYPES.MOVE_PAYMENT,
              kind: "decision",
              decisionKind: "choose_payment",
              ownerId: player.id,
              payload: { action: clone(action) },
            },
          }],
          events: [{ type: "move_payment_requested", playerId: player.id, rocketId: action.target.rocketId }],
          history: [{ type: "probe_turn_action", family: action.family, executorId: EXECUTOR_ID }],
        });
      } else if (action.family === "orbit") {
        executed = actions.getAction("orbit").execute(actionContext(root, player.id), {
          rocketId: action.target.rocketId,
        });
      } else if (action.family === "land") {
        executed = actions.getAction("land").execute(actionContext(root, player.id), {
          rocketId: action.target.rocketId,
          target: {
            type: action.target.type,
            ...(action.target.satelliteId ? { satelliteId: action.target.satelliteId } : {}),
          },
        });
      } else if (action.family === "pass") {
        return result(state, root, action.family, {
          spawnedEffects: buildPassEffects(root, player),
          events: [{ type: "pass_started", playerId: player.id }],
          history: [{ type: "probe_turn_action", family: action.family, executorId: EXECUTOR_ID }],
        });
      } else {
        const turn = slice(root, "turnState", "turn");
        const didPass = (turn.passedPlayerIds || []).includes(player.id);
        const boundary = {
          roundNumber: turn.roundNumber,
          turnNumber: turn.turnNumber,
          didPass,
        };
        return result(state, root, action.family, {
          spawnedEffects: [
            ...(didPass && Number(turn.roundNumber) < turnFlow.DEFAULT_FINAL_ROUND
              ? [domainHandoff("income", "pass_income", player.id, boundary)]
              : []),
            domainHandoff("alien", "turn_end_reveal", player.id, boundary),
            domainHandoff("company", "turn_end", player.id, boundary),
            domainHandoff("card_trigger", "turn_end", player.id, boundary),
            {
              priority: "direct",
              effect: {
                type: EFFECT_TYPES.TURN_ADVANCE,
                ownerId: player.id,
                payload: boundary,
              },
            },
          ],
          events: [{ type: "end_turn_handoffs_started", playerId: player.id }],
          history: [{ type: "probe_turn_action", family: action.family, executorId: EXECUTOR_ID }],
        });
      }
      if (!executed?.ok) return executed;
      if (["launch", "orbit", "land"].includes(action.family)) player.mainActionCompleted = true;
      const rewardEffects = ["orbit", "land"].includes(action.family)
        ? planetRewards.buildRewardEffectsForAction(action.family, executed)
        : [];
      return result(state, root, action.family, {
        spawnedEffects: [
          ...(executed.spawnedEffects || []),
          ...rewardEffects.map((reward) => ({
            priority: "direct",
            effect: { type: EFFECT_TYPES.REWARD, ownerId: player.id, payload: { reward } },
          })),
        ],
        events: clone(executed.events || []),
        history: [{ type: "probe_turn_action", family: action.family, executorId: EXECUTOR_ID }],
      });
    });
    runtime.registerExecutor(EFFECT_TYPES.TURN_ADVANCE, (state, effect, workingContext) => {
      const root = getRoot(state, workingContext);
      const player = actor(root, effect.ownerId);
      if (!player) return fail("PROBE_TURN_ADVANCE_OWNER_STALE", "回合推进 owner 已失效");
      const previousRoundNumber = Number(slice(root, "turnState", "turn").roundNumber) || 1;
      player.mainActionCompleted = false;
      player.passCompletionPending = false;
      const transition = turnFlow.advanceTurnAfterPlayerAction(root, player.id, {
        passed: Boolean(effect.payload?.didPass),
        finalRoundNumber: turnFlow.DEFAULT_FINAL_ROUND,
      });
      const next = actor(root, transition.nextPlayerId);
      if (next) next.mainActionCompleted = false;
      const transitionPayload = {
        previousRoundNumber,
        roundNumber: slice(root, "turnState", "turn").roundNumber,
        nextPlayerId: transition.nextPlayerId,
        roundAdvanced: Boolean(transition.roundAdvanced),
        gameEnded: Boolean(transition.gameEnded),
      };
      return result(state, root, EFFECT_TYPES.TURN_ADVANCE, {
        spawnedEffects: [
          ...(transition.roundAdvanced ? [
            domainHandoff("card_trigger", "round_transition", transition.nextPlayerId, transitionPayload),
            domainHandoff("company", "round_start", transition.nextPlayerId, transitionPayload),
          ] : []),
          ...(transition.gameEnded
            ? [domainHandoff("final_scoring", "game_end", player.id, transitionPayload)]
            : []),
        ],
        events: [{ type: "end_turn", playerId: player.id, ...transitionPayload }],
      });
    });
    function getMovePaymentChoices(state, effect, workingContext) {
        const root = getRoot(state, workingContext);
        const action = effect.payload?.action;
        const player = actor(root, effect.ownerId);
        const required = Math.max(1, Number(action?.payload?.requiredMovePoints) || 1);
        if (!player) return [];
        const moveCards = (player.hand || []).filter(isMovePaymentCard);
        const subsets = [[]];
        for (const card of moveCards) {
          for (const selected of [...subsets]) {
            if (selected.length < required) subsets.push([...selected, card]);
          }
        }
        return science.formalizeChoices(root, effect.ownerId, subsets.flatMap((selected) => {
          const energyCost = Math.max(0, required - selected.length);
          if (!players.canAfford(player, { energy: energyCost })) return [];
          const cardIds = selected.map((card) => card.id);
          return [{
            family: "choose_payment",
            phase: "conditional",
            target: {
              kind: "move-payment",
              choiceId: cardIds.length ? cardIds.join("|") : "energy",
              cardIds,
            },
            payload: { energyCost, requiredMovePoints: required },
            summary: cardIds.length
              ? `弃 ${cardIds.length} 张移动牌${energyCost ? ` + ${energyCost} 能量` : ""}`
              : `消耗 ${energyCost} 能量`,
          }];
        }));
    }
    runtime.registerExecutor(EFFECT_TYPES.MOVE_PAYMENT, {
      getLegalChoices: getMovePaymentChoices,
      resolveDecision(state, effect, choice, workingContext) {
        const root = getRoot(state, workingContext);
        const legal = getMovePaymentChoices(state, effect, workingContext)
          .find((candidate) => candidate.actionId === choice?.actionId);
        const action = effect.payload?.action;
        const player = actor(root, effect.ownerId);
        if (!legal || !player) return fail("PROBE_MOVE_PAYMENT_STALE", "移动支付已失效");
        const required = Math.max(1, Number(action.payload?.requiredMovePoints) || 1);
        const cardIds = new Set(legal.target.cardIds || []);
        let removedCardCount = 0;
        for (let index = player.hand.length - 1; index >= 0; index -= 1) {
          if (!cardIds.has(player.hand[index]?.id)) continue;
          if (!isMovePaymentCard(player.hand[index])) {
            return fail("PROBE_MOVE_PAYMENT_STALE", "移动支付牌已失效");
          }
          const discarded = cards.discardFromHandAtIndex(player, index);
          if (!discarded.ok) return discarded;
          cards.addToDiscardPile(slice(root, "cardState", "cards"), discarded.card);
          removedCardCount += 1;
        }
        if (removedCardCount !== cardIds.size) {
          return fail("PROBE_MOVE_PAYMENT_STALE", "移动支付牌已失效");
        }
        const energyCost = Math.max(0, Number(legal.payload.energyCost) || 0);
        const moved = abilities.executeAbility("moveProbe", actionContext(root, player.id), {
          ...action.target,
          movementPoints: required,
          cost: energyCost ? { energy: energyCost } : {},
          source: "move",
        });
        if (!moved.ok) return moved;
        return result(state, root, EFFECT_TYPES.MOVE_PAYMENT, {
          events: clone(moved.events || []),
          history: [{
            type: "probe_turn_move_payment",
            energy: energyCost,
            cardIds: [...cardIds],
            executorId: EXECUTOR_ID,
          }],
        });
      },
    });
    runtime.registerExecutor(EFFECT_TYPES.REWARD, (state, effect, workingContext) => {
      const root = getRoot(state, workingContext);
      const reward = effect.payload?.reward || {};
      const rewardOptions = reward.options || {};
      let delegated = null;
      if (reward.type === planetRewards.EFFECT_TYPES.PICK_CARD) {
        delegated = {
          type: science.EFFECT_TYPES.PICK_CARD, kind: "decision",
          decisionKind: "choose_card", ownerId: effect.ownerId, payload: {},
        };
      } else if (reward.type === planetRewards.EFFECT_TYPES.INCOME) {
        delegated = domainHandoff("income", "planet_reward_income", effect.ownerId, {
          reward: clone(reward),
        }).effect;
      } else if (reward.type === planetRewards.EFFECT_TYPES.ALIEN_TRACE) {
        delegated = {
          type: science.EFFECT_TYPES.ALIEN_TRACE, kind: "decision",
          decisionKind: "choose_target", ownerId: effect.ownerId,
          payload: { traceType: rewardOptions.traceType },
        };
      } else if (reward.type === planetRewards.EFFECT_TYPES.AOMOMO_CARD) {
        delegated = domainHandoff("alien", "planet_reward_aomomo_card", effect.ownerId, {
          reward: clone(reward),
        }).effect;
      } else if ([
        planetRewards.EFFECT_TYPES.SCAN_PLANET_SECTOR,
        planetRewards.EFFECT_TYPES.CHOOSE_NEBULA_SCAN,
        planetRewards.EFFECT_TYPES.CHOOSE_COLORED_NEBULA_SCAN,
      ].includes(reward.type)) {
        const planet = rewardOptions.planetId
          ? solar.createSolarSnapshot(slice(root, "solarState", "solarSystem")).planetLocations
            .find((candidate) => candidate.planetId === rewardOptions.planetId)
          : null;
        delegated = {
          type: science.EFFECT_TYPES.SCAN_TARGET, kind: "decision",
          decisionKind: "choose_target", ownerId: effect.ownerId,
          payload: {
            sectorX: planet?.x ?? null,
            nebulaIds: clone(rewardOptions.nebulaIds || []),
            gainData: true,
            label: reward.label,
          },
        };
      }
      if (delegated) {
        return result(state, root, EFFECT_TYPES.REWARD, {
          spawnedEffects: [{ priority: "direct", effect: delegated }],
        });
      }
      const settled = applyDirectReward(root, effect.ownerId, reward);
      if (!settled.ok) return settled;
      return result(state, root, EFFECT_TYPES.REWARD, { events: clone(settled.events || []) });
    });
    runtime.registerExecutor(EFFECT_TYPES.PASS_DISCARD, {
      getLegalChoices(state, effect, workingContext) {
        const root = getRoot(state, workingContext);
        return passDiscardChoices(
          root,
          effect.ownerId,
          Math.max(1, Number(effect.payload?.discardCount) || 1),
        );
      },
      resolveDecision(state, effect, choice, workingContext) {
        const root = getRoot(state, workingContext);
        const player = actor(root, effect.ownerId);
        const count = Math.max(1, Number(effect.payload?.discardCount) || 1);
        const legal = passDiscardChoices(root, effect.ownerId, count)
          .find((candidate) => candidate.actionId === choice?.actionId);
        if (!player || !legal) return fail("PROBE_PASS_DISCARD_STALE", "PASS 弃牌选择已失效");
        const selectedIds = new Set(legal.target.cardIds || []);
        const discarded = [];
        for (let index = player.hand.length - 1; index >= 0; index -= 1) {
          if (!selectedIds.has(player.hand[index]?.id)) continue;
          const removed = cards.discardFromHandAtIndex(player, index);
          if (!removed.ok) return removed;
          cards.addToDiscardPile(slice(root, "cardState", "cards"), removed.card);
          discarded.push(removed.card.id);
        }
        if (discarded.length !== count) return fail("PROBE_PASS_DISCARD_STALE", "PASS 弃牌数量已失效");
        return result(state, root, EFFECT_TYPES.PASS_DISCARD, {
          events: [{ type: "pass_hand_limit", playerId: player.id, cardIds: discarded.sort() }],
        });
      },
    });
    runtime.registerExecutor(EFFECT_TYPES.PASS, (state, effect, workingContext) => {
      const root = getRoot(state, workingContext);
      const player = actor(root, effect.ownerId);
      if (!player) return fail("PROBE_PASS_OWNER_STALE", "PASS owner 已失效");
      const settled = turnFlow.rotateSolarSystem(root, 1, player.id);
      if (!settled.ok) return settled;
      return result(state, root, EFFECT_TYPES.PASS, {
        events: [
          {
            type: "solar_rotation",
            playerId: player.id,
            before: clone(settled.before),
            after: clone(settled.after),
          },
          ...(settled.events || []),
        ],
      });
    });
    runtime.registerExecutor(EFFECT_TYPES.PASS_COMMIT, (state, effect, workingContext) => {
      const root = getRoot(state, workingContext);
      const player = actor(root, effect.ownerId);
      const turn = slice(root, "turnState", "turn");
      if (!player || (turn.passedPlayerIds || []).includes(player.id)) {
        return fail("PROBE_PASS_COMMIT_STALE", "PASS 提交已失效");
      }
      turn.passedPlayerIds.push(player.id);
      player.passCompletionPending = true;
      player.mainActionCompleted = true;
      return result(state, root, EFFECT_TYPES.PASS_COMMIT, {
        events: [{ type: "pass", playerId: player.id }],
        history: [{ type: "probe_turn_pass", playerId: player.id, executorId: EXECUTOR_ID }],
      });
    });
    function passReserveChoices(state, effect, workingContext) {
      const root = getRoot(state, workingContext);
      return science.formalizeChoices(
        root,
        effect.ownerId,
        cards.getPassReservePile(
          slice(root, "cardState", "cards"),
          effect.payload?.roundNumber,
        ).map((card) => ({
          family: "choose_card",
          target: {
            kind: "pass-reserve-card",
            choiceId: card.id,
            cardId: card.cardId || card.id || null,
          },
          payload: { cardInstanceId: card.id },
          summary: cards.getCardLabel(card),
        })),
      );
    }
    runtime.registerExecutor(EFFECT_TYPES.PASS_RESERVE, {
      getLegalChoices: passReserveChoices,
      resolveDecision(state, effect, choice, workingContext) {
        const root = getRoot(state, workingContext);
        const legal = passReserveChoices(state, effect, workingContext)
          .find((candidate) => candidate.actionId === choice?.actionId);
        const player = actor(root, effect.ownerId);
        if (!legal || !player) return fail("PROBE_PASS_RESERVE_STALE", "PASS 预留牌选择已失效");
        const picked = cards.pickPassReserveCard(
          slice(root, "cardState", "cards"),
          player,
          effect.payload?.roundNumber,
          legal.target.choiceId,
        );
        if (!picked.ok) return picked;
        return result(state, root, EFFECT_TYPES.PASS_RESERVE, {
          events: [{ type: "pass_reserve_pick", playerId: player.id, cardInstanceId: picked.card?.id }],
        });
      },
    });
    function createEffectGroup(_state, action) {
      if (!ACTION_FAMILIES.includes(action?.family)) {
        return fail("PROBE_TURN_FAMILY_INVALID", `Probe Turn domain 不接受 ${action?.family || "<missing>"}`);
      }
      return {
        kind: action.family === "end_turn" ? "control" : "action",
        ownerId: action.actorId,
        action: clone(action),
        effects: [{ type: EFFECT_TYPES.EXECUTE, ownerId: action.actorId, payload: { action: clone(action) } }],
      };
    }
    return Object.freeze({ actionFamilies: ACTION_FAMILIES, createEffectGroup });
  }
  return Object.freeze({
    DOMAIN_ID, EXECUTOR_ID, ACTION_FAMILIES, EFFECT_TYPES,
    DOMAIN_HANDOFF_EFFECT_TYPE, DOMAIN_HANDOFF_SCHEMA_VERSION,
    createActionDefinitions, createProbeTurnDomain, actionContext,
  });
});
