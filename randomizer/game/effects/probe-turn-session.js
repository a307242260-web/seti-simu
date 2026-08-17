(function (root, factory) {
  "use strict";
  let standardAction = root.SetiStandardAction;
  let abilities = root.SetiAbilities;
  let players = root.SetiPlayers;
  let planetRewards = root.SetiPlanetRewards;
  let planetStats = root.SetiPlanetStats;
  let data = root.SetiData;
  let cards = root.SetiCards;
  let solar = root.SetiSolarSystem;
  let science = root.SetiScienceSession;
  let turnFlow = root.SetiTurnFlow;
  let chong = root.SetiAlienChong;
  if (typeof require === "function") {
    standardAction = standardAction || require("../actions/standard-action");
    abilities = abilities || require("../abilities");
    players = players || require("../players");
    planetRewards = planetRewards || require("../actions/planet-rewards");
    planetStats = planetStats || require("../planet-stats");
    data = data || require("../data");
    cards = cards || require("../cards/deck");
    solar = solar || require("../../solar-system/core");
    science = science || require("./science-session");
    turnFlow = turnFlow || require("../turn-flow");
    chong = chong || require("../aliens/chong");
  }
  const api = factory(
    standardAction, abilities, players, planetRewards, planetStats, data, cards, solar,
    science, turnFlow, chong,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiProbeTurnSession = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (
  standardAction, abilities, players, planetRewards, planetStats, data, cards, solar,
  science, turnFlow, chong,
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
    LAND_CHOICE: "probe_land_choice",
  });
  const DOMAIN_HANDOFF_EFFECT_TYPE = "game_domain_handoff";
  const DOMAIN_HANDOFF_SCHEMA_VERSION = "seti-game-domain-handoff-v1";
  const clone = (value) => value == null ? value : structuredClone(value);
  const fail = (code, message, details = {}) => ({ ok: false, code, message, ...details });
  const isMovePaymentCard = (card) => (
    Number(card?.discardActionCode) === 2
    || Boolean(cards.getDiscardActionMoveRewardForCard?.(card))
  );
  const getRoot = (state, context) => context?.state || context || state;
  const slice = (root, key) => root?.[key] || {};
  const actor = (root, actorId) => {
    const state = slice(root, "players");
    const id = actorId || root?.turn?.currentPlayerId;
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
    const playersState = slice(root, "players");
    const solarSystemState = slice(root, "solarSystem");
    const context = {
      state: root,
      players: playersState,
      pieces: slice(root, "pieces"),
      planets: slice(root, "planets"),
      aliens: slice(root, "aliens"),
      data: slice(root, "data"),
      cards: slice(root, "cards"),
      solarSystem: solarSystemState,
      turn: { ...slice(root, "turn"), currentPlayerId: actorId || root.turn?.currentPlayerId },
      tech: root.tech || {},
      standardActionAuthority: {
        actorId,
        stateVersion: root.meta?.stateVersion ?? 0,
        decisionVersion: root.match?.decisionVersion ?? 0,
      },
      getPlanetLocations: () => solar.createSolarSnapshot(solarSystemState).planetLocations,
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
    return { ok: true };
  }
  function sessionRequired() {
    return fail("PROBE_TURN_SESSION_REQUIRED", "探测器与回合行动必须由 Effect Session 执行");
  }
  function createActionDefinitions() {
    const definitions = [];
    definitions.push(standardAction.createOptionDefinition("launch", {
      label: "发射",
      getOptions(context) {
        const root = context.state || context;
        const player = actor(root, context.standardActionAuthority?.actorId);
        const start = canStart(root, player);
        if (!start.ok) return start;
        // 统一发射入口：与行星奖励/卡牌共用 abilities.rocket.launchProbe 的规则原语，
        // 这里只做零副作用的合法性枚举（费用、火箭上限），不执行。
        const actionCtx = actionContext(root, player.id);
        const cost = abilities.rocket.getLaunchCost(actionCtx, player);
        const rocketLimit = abilities.rocket.getRocketLimitForPlayer(player, actionCtx);
        const activeCount = abilities.rocket.getActiveRocketCountForPlayer(actionCtx.pieces, player.id);
        if (activeCount >= rocketLimit) {
          return fail("PROBE_LAUNCH_UNAVAILABLE", `火箭数量已达上限（${activeCount}/${rocketLimit}）`);
        }
        if (!players.canAfford(player, cost)) {
          return fail("PROBE_LAUNCH_UNAFFORDABLE", `资源不足，需要 ${players.formatResourceCost(cost)}`);
        }
        return { ok: true, choices: [{ label: "发射" }] };
      },
      canExecute(context) { return this.getOptions(context); },
      execute: sessionRequired,
    }));
    definitions.push(standardAction.createOptionDefinition("move", {
      label: "移动",
      getOptions(context) {
        const root = context.state || context;
        const player = actor(root, context.standardActionAuthority?.actorId);
        if (!player) return fail("PROBE_TURN_ACTOR_MISSING", "没有当前玩家");
        // PASS 后回合已结束：与 quick_trade/industry/card_corner 等其余快速行动
        // 一致，移动不再可枚举（规则书：PASS 结束回合，不再执行任何快速行动）。
        if ((root.turn?.passedPlayerIds || []).includes(player.id) || player.passCompletionPending) {
          return fail("PROBE_MOVE_AFTER_PASS", "PASS 后不能执行移动");
        }
        const actionCtx = actionContext(root, player.id);
        const directionOrder = new Map(
          (abilities.rocket.MOVE_DIRECTIONS || []).map((direction, index) => [direction.id, index]),
        );
        // 统一移动入口：与卡牌/紫4/快速交易/残余域共用 listPlayerMoveChoices
        const choices = abilities.rocket.listPlayerMoveChoices(actionCtx, player, {
          maxPoints: Number.MAX_SAFE_INTEGER,
        })
          .sort((left, right) => (
            String(left.rocketId).localeCompare(String(right.rocketId), undefined, { numeric: true })
            || (directionOrder.get(left.directionId) ?? Number.MAX_SAFE_INTEGER)
            - (directionOrder.get(right.directionId) ?? Number.MAX_SAFE_INTEGER)
          ))
          .filter((move) => (
            Number(player.resources?.energy || 0)
            + (player.hand || []).filter(isMovePaymentCard).length
            >= move.requiredMovePoints
          ))
          .map((move) => ({
            target: { rocketId: move.rocketId, deltaX: move.deltaX, deltaY: move.deltaY },
            payload: { direction: move.directionId, requiredMovePoints: move.requiredMovePoints },
            label: `移动探测器 ${move.rocketId} ${move.label}`,
          }));
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
      definitions.push(standardAction.createOptionDefinition(family, {
        label: family === "orbit" ? "环绕" : "登陆",
        getOptions(context) {
          const root = context.state || context;
          const player = actor(root, context.standardActionAuthority?.actorId);
          const start = canStart(root, player);
          if (!start.ok) return start;
          // 统一环绕/登陆入口：与卡牌来源共用 abilities.planet 的枚举/执行引擎
          // （orbitProbe/landProbe 是唯一规则实现，参考行动副本已删除）。
          const result = family === "orbit"
            ? abilities.planet.getOrbitOptions(actionContext(root, player.id))
            : abilities.planet.getLandOptions(actionContext(root, player.id));
          if (!result.ok) return result;
          // 登陆行动形态统一：无论有几个目标，「登陆」都只有一个动作，目标
          // 选择由内核决策完成——唯一合法目标直接登陆（不弹窗），多目标弹
          // 选择框（LAND_CHOICE，与打牌登陆同一选择框）。
          if (family === "land") {
            return { ok: true, choices: [{
              target: { select: true },
              payload: {},
              label: "登陆",
            }] };
          }
          const choices = result.choices.map((choice) => ({
            target: {
              rocketId: choice.rocketId,
              planetId: choice.planetId,
            },
            payload: {},
            label: choice.label,
          }));
          return { ok: true, choices };
        },
        canExecute(context, option) {
          if (family === "land") {
            return option?.target?.select === true
              ? { ok: true }
              : fail("PROBE_LAND_STALE", "登陆行动已失效");
          }
          const listed = this.getOptions(context);
          return listed.ok && listed.choices.some((choice) => (
            JSON.stringify(choice.target) === JSON.stringify(option.target)
            && JSON.stringify(choice.payload) === JSON.stringify(option.payload || {})
          )) ? { ok: true } : fail("PROBE_ORBIT_STALE", "环绕行动已失效");
        },
        execute: sessionRequired,
      }));
    }
    definitions.push(standardAction.createOptionDefinition("pass", {
      label: "PASS",
      getOptions(context) {
        const root = context.state || context;
        const player = actor(root, context.standardActionAuthority?.actorId);
        const start = canStart(root, player);
        if (!start.ok) return start;
        return !(slice(root, "turn", "turn").passedPlayerIds || []).includes(player.id)
          ? { ok: true, choices: [{ target: { kind: "pass" }, label: "PASS" }] }
          : fail("PROBE_PASS_STALE", "玩家本轮已经 PASS");
      },
      canExecute(context) { return this.getOptions(context); },
      execute: sessionRequired,
    }));
    definitions.push(standardAction.createOptionDefinition("end_turn", {
      label: "结束回合",
      getOptions(context) {
        const root = context.state || context;
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
  function applyDirectReward(root, ownerId, effect, sourceKey = null) {
    const player = actor(root, ownerId);
    const options = effect.options || {};
    if (!player) return fail("PROBE_REWARD_OWNER_STALE", "行星奖励 owner 已失效");
    if (effect.type === planetRewards.EFFECT_TYPES.GAIN_RESOURCES) {
      players.gainResources(player, options.gain || {}, sourceKey);
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
      // 统一抽牌上下文：行星奖励盲抽共用 cards.createCardDrawContext
      const drawContext = cards.createCardDrawContext(
        slice(root, "cards", "cards"),
        slice(root, "players", "players"),
        () => nextRandom(root),
        { root },
      );
      for (let index = 0; index < Math.max(0, Number(options.count) || 0); index += 1) {
        const result = drawContext.blindDraw(player);
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
    // 外星人牌与普通牌行为一致：PASS 弃牌候选包含全部手牌。
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
    const turn = slice(root, "turn", "turn");
    effects.push(domainHandoff("company", "company_pass", player.id, {
      roundNumber: turn.roundNumber,
      turnNumber: turn.turnNumber,
    }));
    const isFinalRound = Number(turn.roundNumber) >= turnFlow.DEFAULT_FINAL_ROUND;
    // 手牌上限弃牌：所有轮次都执行（规则书 PASS 步骤 1，最后一轮同样适用）。
    // 外星人牌与普通牌一致，均计入手牌上限。
    const discardCount = Math.max(
      0,
      (player.hand || []).length - 4,
    );
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
    // 本轮第一个 PASS 的玩家执行太阳系公转：所有轮次（规则书 PASS 步骤 2，
    // 最后一轮仍要公转，只是无需拿取公转标记；实现不建模标记 token）。
    if (!(turn.passedPlayerIds || []).length) {
      effects.push({
        priority: "direct",
        effect: { type: EFFECT_TYPES.PASS, ownerId: player.id, payload: { kind: "first-rotation" } },
      });
    }
    // 一轮结束牌：仅第 1/2/3 轮有预留叠（扩展模式仅第 2/3/4 轮准备，末轮无叠）。
    if (!isFinalRound) {
      const reserve = cards.getPassReservePile(slice(root, "cards", "cards"), turn.roundNumber);
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
    // PASS 自动结束回合：PASS 链结算后直接进入与 end_turn 相同的回合末 handoff
    // （金/中立里程碑 → 外星人揭示 → 公司 → 卡牌触发）并推进回合，玩家无需再点
    // 「结束回合」（规则书：PASS 后回合立即结束）。边界显式标记 didPass。
    const boundary = {
      roundNumber: turn.roundNumber,
      turnNumber: turn.turnNumber,
      didPass: true,
    };
    effects.push(
      domainHandoff("final_scoring", "milestone", player.id, boundary),
      domainHandoff("alien", "turn_end_neutral_milestone", player.id, boundary),
      domainHandoff("alien", "turn_end_reveal", player.id, boundary),
      domainHandoff("company", "turn_end", player.id, boundary),
      domainHandoff("card_trigger", "turn_end", player.id, boundary),
      {
        priority: "direct",
        effect: { type: EFFECT_TYPES.TURN_ADVANCE, ownerId: player.id, payload: boundary },
      },
    );
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
        // 统一发射引擎：abilities.rocket.launchProbe 与行星奖励/卡牌来源同一实现
        executed = abilities.executeAbility("launchProbe", actionContext(root, player.id), {
          source: "launch",
        });
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
        executed = abilities.executeAbility("orbitProbe", actionContext(root, player.id), {
          rocketId: action.target.rocketId,
          source: "orbit",
        });
      } else if (action.family === "land") {
        // 登陆行动形态统一：无论目标数量，行动都只带 select 标记。这里按合法
        // 目标数量分流——唯一目标直接登陆（不弹窗），多目标 spawn LAND_CHOICE
        // 决策（与打牌登陆同一选择框），由玩家任选其一。
        const landTargets = listLandChoiceTargets(root, { ownerId: player.id, payload: {} });
        if (landTargets.length > 1) {
          return result(state, root, action.family, {
            spawnedEffects: [{
              priority: "direct",
              effect: {
                type: EFFECT_TYPES.LAND_CHOICE,
                kind: "decision",
                decisionKind: "choose_target",
                ownerId: player.id,
                payload: {},
              },
            }],
            events: [{ type: "land_target_selection_requested", playerId: player.id }],
            history: [{ type: "probe_turn_action", family: action.family, executorId: EXECUTOR_ID }],
          });
        }
        if (!landTargets.length) {
          return fail("PROBE_LAND_UNAVAILABLE", "没有可登陆的目标");
        }
        // 唯一合法目标：与多目标决策同一结算出口 settleLandProbe 直接结算
        return settleLandProbe(state, root, player, landTargets[0]);
      } else if (action.family === "pass") {
        return result(state, root, action.family, {
          spawnedEffects: buildPassEffects(root, player),
          events: [{ type: "pass_started", playerId: player.id }],
          history: [{ type: "probe_turn_action", family: action.family, executorId: EXECUTOR_ID }],
        });
      } else {
        const turn = slice(root, "turn", "turn");
        const didPass = (turn.passedPlayerIds || []).includes(player.id);
        const boundary = {
          roundNumber: turn.roundNumber,
          turnNumber: turn.turnNumber,
          didPass,
        };
        return result(state, root, action.family, {
          spawnedEffects: [
            // 规则书 P18/P20：回合结束时先结算所有里程碑（金色 → 中立），
            // 再结算发现外星人。金里程碑在回合末统一生成 FINAL_MARK。
            domainHandoff("final_scoring", "milestone", player.id, boundary),
            domainHandoff("alien", "turn_end_neutral_milestone", player.id, boundary),
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
            effect: {
              type: EFFECT_TYPES.REWARD,
              ownerId: player.id,
              payload: {
                reward,
                // 终局计分来源拆分：登陆奖励计 landScore，环绕奖励计 orbitScore
                sourceKey: action.family === "land" ? "landScore" : "orbitScore",
              },
            },
          })),
        ],
        events: clone(executed.events || []),
        history: [{ type: "probe_turn_action", family: action.family, executorId: EXECUTOR_ID }],
      });
    });
    function buildLandChoiceSummary(root, choice) {
      // 选择框选项显示登陆奖励（主星按当前登陆标记序列预测 first/second 奖励，
      // 卫星为固定奖励），不再显示能量消耗。
      const planets = slice(root, "planets");
      const isSatellite = choice.target?.type === "satellite";
      let targetLabel;
      let effects;
      if (isSatellite) {
        const satellite = (planetStats.getAvailableSatellitesForLanding(planets, choice.planetId) || [])
          .find((entry) => entry.satelliteId === choice.target.satelliteId);
        targetLabel = `${satellite?.satelliteName || choice.target.satelliteId}（${choice.planet?.name || choice.planetId}）`;
        effects = planetRewards.buildSatelliteLandRewardEffects(choice.target.satelliteId);
      } else {
        targetLabel = `${choice.planet?.name || choice.planetId}（主星）`;
        const sequence = Number(planetStats.getPlanetLandingCount(planets, choice.planetId) || 0) + 1;
        effects = planetRewards.buildPlanetLandRewardEffects(choice.planetId, sequence);
      }
      const rewardText = planetRewards.formatRewardEffectsSummary(effects, { separator: "；" });
      return rewardText ? `登陆${targetLabel}｜奖励：${rewardText}` : `登陆${targetLabel}`;
    }

    function listLandChoiceTargets(root, effect) {
      const player = actor(root, effect.ownerId);
      // payload 不带 rocketId 时列出所有火箭的全部可登目标（统一选择框）。
      const rocketId = effect.payload?.rocketId == null ? null : Number(effect.payload?.rocketId);
      // 与打牌登陆同一枚举引擎：abilities.planet.getLandOptions
      const result = abilities.planet.getLandOptions(actionContext(root, player.id));
      return (result.choices || [])
        .filter((choice) => rocketId == null || Number(choice.rocketId) === rocketId)
        .map((choice) => ({
          family: "choose_target",
          target: {
            choiceId: `land:${choice.rocketId}:${choice.planetId}:${choice.target?.type || "planet"}:${choice.target?.satelliteId || ""}`,
            rocketId: choice.rocketId,
            planetId: choice.planetId,
            landTarget: choice.target,
          },
          payload: { energyCost: choice.energyCost },
          summary: buildLandChoiceSummary(root, choice),
        }));
    }

    // 唯一登陆结算出口：单目标直连（EXECUTE）与多目标决策（LAND_CHOICE）共用
    // 同一 landProbe + 主行动置位 + 奖励组装，避免两处实现漂移。
    function settleLandProbe(state, root, player, landChoice) {
      const executed = abilities.executeAbility("landProbe", actionContext(root, player.id), {
        rocketId: landChoice.target.rocketId,
        target: landChoice.target.landTarget,
        source: "land",
      });
      if (!executed?.ok) return executed;
      player.mainActionCompleted = true;
      const rewardEffects = planetRewards.buildRewardEffectsForAction("land", executed);
      return result(state, root, "land", {
        spawnedEffects: [
          ...(executed.spawnedEffects || []),
          ...rewardEffects.map((reward) => ({
            priority: "direct",
            effect: {
              type: EFFECT_TYPES.REWARD,
              ownerId: player.id,
              payload: { reward, sourceKey: "landScore" },
            },
          })),
        ],
        events: clone(executed.events || []),
        history: [{ type: "probe_turn_action", family: "land", executorId: EXECUTOR_ID }],
      });
    }

    runtime.registerExecutor(EFFECT_TYPES.LAND_CHOICE, {
      getLegalChoices(state, effect, workingContext) {
        const root = getRoot(state, workingContext);
        return science.formalizeChoices(root, effect.ownerId, listLandChoiceTargets(root, effect));
      },
      resolveDecision(state, effect, choice, workingContext) {
        const root = getRoot(state, workingContext);
        const player = actor(root, effect.ownerId);
        const legal = listLandChoiceTargets(root, effect)
          .find((candidate) => String(candidate.target?.choiceId) === String(choice?.target?.choiceId));
        if (!legal) return fail("PROBE_LAND_CHOICE_STALE", "登陆目标选择已失效");
        // 与单目标直连同一结算出口：abilities.planet.landProbe
        return settleLandProbe(state, root, player, legal);
      },
    });
    runtime.registerExecutor(EFFECT_TYPES.TURN_ADVANCE, (state, effect, workingContext) => {
      const root = getRoot(state, workingContext);
      const player = actor(root, effect.ownerId);
      if (!player) return fail("PROBE_TURN_ADVANCE_OWNER_STALE", "回合推进 owner 已失效");
      const previousRoundNumber = Number(slice(root, "turn", "turn").roundNumber) || 1;
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
        roundNumber: slice(root, "turn", "turn").roundNumber,
        nextPlayerId: transition.nextPlayerId,
        roundAdvanced: Boolean(transition.roundAdvanced),
        gameEnded: Boolean(transition.gameEnded),
      };
      return result(state, root, EFFECT_TYPES.TURN_ADVANCE, {
        spawnedEffects: [
          ...(transition.roundAdvanced ? [
            ...(slice(root, "turn", "turn").activePlayerIds || []).map((playerId) => (
              domainHandoff("income", "round_start_income", playerId, transitionPayload)
            )),
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
        // 同一弃牌集合的排列（[a,b] 与 [b,a]）去重：choiceId 按排序后的
        // cardId 生成，避免同一支付方案重复出现在移动支付选择中。
        const seenPaymentKeys = new Set();
        return science.formalizeChoices(root, effect.ownerId, subsets.flatMap((selected) => {
          const energyCost = Math.max(0, required - selected.length);
          if (!players.canAfford(player, { energy: energyCost })) return [];
          const cardIds = selected.map((card) => card.id).sort((left, right) => (
            String(left).localeCompare(String(right))
          ));
          const paymentKey = cardIds.join("|");
          if (seenPaymentKeys.has(paymentKey)) return [];
          seenPaymentKeys.add(paymentKey);
          return [{
            family: "choose_payment",
            phase: "conditional",
            target: {
              kind: "move-payment",
              choiceId: cardIds.length ? paymentKey : "energy",
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
          cards.addToDiscardPile(slice(root, "cards", "cards"), discarded.card);
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
          payload: {
            traceType: rewardOptions.traceType,
            // 带奖励来源标签（如「任意外星人标记 1/2」），弹窗标题可显示第几次
            label: reward.label || null,
          },
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
          ? solar.createSolarSnapshot(slice(root, "solarSystem", "solarSystem")).planetLocations
            .find((candidate) => candidate.planetId === rewardOptions.planetId)
          : null;
        delegated = {
          type: science.EFFECT_TYPES.SCAN_STEP, ownerId: effect.ownerId,
          payload: {
            options: {
              mode: "specified",
              sectorX: planet?.x ?? null,
              nebulaIds: clone(rewardOptions.nebulaIds || []),
              gainData: true,
              label: reward.label,
            },
          },
        };
      }
      if (delegated) {
        return result(state, root, EFFECT_TYPES.REWARD, {
          spawnedEffects: [{ priority: "direct", effect: delegated }],
        });
      }
      const settled = applyDirectReward(root, effect.ownerId, reward, effect.payload?.sourceKey || null);
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
          cards.addToDiscardPile(slice(root, "cards", "cards"), removed.card);
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
      const turn = slice(root, "turn", "turn");
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
          slice(root, "cards", "cards"),
          effect.payload?.roundNumber,
        ).map((card) => {
          const entry = cards.getCatalogEntryForCard(card);
          return {
            family: "choose_card",
            target: {
              kind: "pass-reserve-card",
              choiceId: card.id,
              cardId: card.cardId || card.id || null,
            },
            payload: { cardInstanceId: card.id },
            summary: cards.getCardLabel(card),
            // PASS 预留牌选择携带卡面，决策弹窗显示牌面而非编号
            presentation: cards.getCardPickPresentation(card),
          };
        }),
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
          slice(root, "cards", "cards"),
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
