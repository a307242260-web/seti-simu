"use strict";

const {
  FIXED_BOARD_ID,
  FIXED_BOARD_CONFIG,
  fingerprintFixedBoard,
  projectFixedBoard,
} = require("./heuristic-policy.fixed-board");
const { createSimulationEnv } = require("../app/simulation-env");
const expectedScoreEvaluator = require("../game/ai/expected-score-evaluator");
const initialCards = require("../game/initial-cards");
const cards = require("../game/cards/deck");
const solarSystem = require("../solar-system/core");
const CARD_NAMES_BY_ID = new Map(cards.CARD_CATALOG.map((card) => [card.card_id, card.card_name]));

const FAMILY_VERBS = Object.freeze({
  industry: "执行科技",
  place_data: "放置数据",
  play_card: "打出卡牌",
});

function scoreOf(observation, playerId) {
  const player = observation?.publicState?.players?.find((candidate) => candidate.playerId === playerId);
  return Number(player?.finalScore ?? player?.score ?? 0);
}

const RESOURCE_FIELDS = Object.freeze([
  ["credits", "钱"],
  ["energy", "电"],
  ["publicity", "宣传"],
  ["availableData", "数据"],
  ["handCount", "手牌"],
  ["alienCardCount", "外星牌"],
  ["reservedCount", "预留牌"],
]);

function resourcesOf(observation, playerId) {
  const player = observation?.publicState?.players?.find((candidate) => candidate.playerId === playerId) || {};
  const selfState = observation?.selfState?.playerId === playerId
    ? observation.selfState
    : null;
  return Object.freeze({
    ...Object.fromEntries(RESOURCE_FIELDS.map(([key]) => [key, Number(player[key] || 0)])),
    alienCardCount: Array.isArray(selfState?.privateAlienCards)
      ? selfState.privateAlienCards.length
      : 0,
  });
}

function resourceDelta(before, after) {
  return Object.freeze(Object.fromEntries(RESOURCE_FIELDS.map(([key]) => [key, after[key] - before[key]])));
}

function handOf(observation, playerId) {
  if (observation?.selfState?.playerId !== playerId) return Object.freeze([]);
  return Object.freeze((observation.selfState.hand || []).map((card) => Object.freeze({
    id: card.id,
    cardId: card.cardId,
    cardName: card.cardName || CARD_NAMES_BY_ID.get(card.cardId) || cards.getCardLabel(card),
    price: card.price,
    cardTypeCode: card.cardTypeCode,
    discardActionCode: card.discardActionCode,
    scanActionCode: card.scanActionCode,
    incomeCode: card.incomeCode,
  })));
}

function boardSnapshot(observation) {
  const board = observation?.publicState?.board || {};
  const solar = board.solarSystem || {};
  const solarSnapshot = solarSystem.createSolarSnapshot(solar);
  const planets = solarSnapshot.planetLocations || [];
  return Object.freeze({
    rotation: structuredClone(solar.rotation || null),
    sectorBySlot: structuredClone(solar.sectorBySlot || null),
    planets: Object.freeze(planets.map((planet) => Object.freeze({
      planetId: planet.planetId,
      x: planet.x,
      y: planet.y,
    }))),
    rockets: Object.freeze((board.rockets || []).map((rocket) => Object.freeze({
      id: rocket.id,
      playerId: rocket.playerId,
      color: rocket.color || String(rocket.playerId || "").replace(/^player-/, ""),
      surface: rocket.surface,
      x: rocket.x ?? rocket.sectorX,
      y: rocket.y ?? rocket.sectorY,
      planetId: rocket.planetId || planets.find((planet) => (
        Number(planet.x) === Number(rocket.x ?? rocket.sectorX)
        && Number(planet.y) === Number(rocket.y ?? rocket.sectorY)
      ))?.planetId || null,
    }))),
    aliens: Object.freeze((board.aliens?.slots || []).map((slot, index) => Object.freeze({
      slotId: index + 1,
      revealed: Boolean(slot.revealed),
      alienId: slot.alienId || null,
      traces: structuredClone(slot.traces || {}),
    }))),
    techSupply: Object.freeze(Object.values(board.techSupply?.stacks || {}).map((stack) => Object.freeze({
      tileId: stack.tileId,
      techType: stack.techType,
      bonusId: stack.bonusId || null,
      remaining: stack.remaining,
    }))),
    playerTech: Object.freeze((observation?.publicState?.players || []).map((player) => Object.freeze({
      playerId: player.playerId,
      playerLabel: player.playerLabel,
      techState: structuredClone(player.techState || {}),
    }))),
  });
}

function resourcesFromIncomeEvent(event, side) {
  const source = event?.[side === "before" ? "resourcesBefore" : "resourcesAfter"] || {};
  return Object.freeze({
    ...Object.fromEntries(RESOURCE_FIELDS.map(([key]) => [key, Number(source[key] || 0)])),
    handCount: Number(event?.[side === "before" ? "handCountBefore" : "handCountAfter"]) || 0,
    alienCardCount: 0,
  });
}

function buildDiagnostics(turns) {
  const allActions = turns.flatMap((turn) => turn.actions.flatMap((action) => (
    [action, ...(action.followups || [])]
  )));
  const evaluated = allActions.map((action) => ({ action }))
    .filter(({ action }) => action.value && action.family !== "end_turn");
  const timed = allActions.filter((action) => Number(action.timing?.candidateCount) > 0);
  const tiedTopChoices = evaluated.filter(({ action }) => (
    action.alternatives.some((alternative) => Math.abs(alternative.score - action.value.score) < 1e-9)
  ));
  const nonPositiveChoices = evaluated.filter(({ action }) => action.value.score <= 0);
  return Object.freeze({
    evaluatedDecisionCount: evaluated.length,
    tiedTopChoiceCount: tiedTopChoices.length,
    nonPositiveChoiceCount: nonPositiveChoices.length,
    zeroScoreTurnCount: turns.filter((turn) => turn.scoreAfter === turn.scoreBefore).length,
    quickTradeCount: evaluated.filter(({ action }) => action.family === "quick_trade").length,
    actionFamilyCounts: Object.freeze(Object.fromEntries(
      [...evaluated, ...allActions
        .filter((action) => action.family === "end_turn")
        .map((action) => ({ action }))]
        .reduce((counts, { action }) => {
          counts.set(action.family, (counts.get(action.family) || 0) + 1);
          return counts;
        }, new Map()),
    )),
    performance: Object.freeze({
      maxDecisionMilliseconds: Math.max(0, ...timed.map((action) => Number(action.timing.totalMilliseconds) || 0)),
      maxPerCandidateMilliseconds: Math.max(0, ...timed.map((action) => (
        (Number(action.timing.totalMilliseconds) || 0) / Number(action.timing.candidateCount)
      ))),
      averagePerCandidateMilliseconds: timed.length
        ? timed.reduce((total, action) => (
          total + ((Number(action.timing.totalMilliseconds) || 0) / Number(action.timing.candidateCount))
        ), 0) / timed.length
        : 0,
      routeCheckpointLimit: 10,
    }),
  });
}

function isObservationFeasible(observation, actorPlayerId, action) {
  const isMoveLike = action.family === "move"
    || (action.family === "card_corner" && action.payload?.kind === "move");
  if (!isMoveLike) return true;
  const rockets = observation?.publicState?.board?.rockets;
  if (!Array.isArray(rockets)) return true;
  return rockets.some((rocket) => rocket?.playerId === actorPlayerId && rocket?.surface === "solar-board");
}

function evaluateLegalActions(observation, legalActions, actionOutcomes, actorPlayerId, options = {}) {
  return legalActions.map((action) => ({ action }))
    .filter(({ action }) => isObservationFeasible(observation, actorPlayerId, action))
    .map(({ action }) => {
    const evaluableAction = {
      ...action,
      phase: action.actionFeature?.phase
        || (action.decisionType === "conditional_choice" ? "conditional" : "main"),
    };
    const evaluation = expectedScoreEvaluator.evaluateAction(
      { observation, legalActions, actionOutcomes, seatId: actorPlayerId },
      evaluableAction,
    );
    const visual = selectionVisual(action, options);
    return Object.freeze({
      actionId: action.actionId,
      summary: visual?.text || (actionText(action) || "结束回合"),
      score: evaluation.score,
      evaluation,
    });
  }).sort((left, right) => (
    Number(right.evaluation.selectable) - Number(left.evaluation.selectable)
    || Number(right.evaluation.priorityClass || -1) - Number(left.evaluation.priorityClass || -1)
    || Number(right.score ?? -Infinity) - Number(left.score ?? -Infinity)
    || left.actionId.localeCompare(right.actionId)
  ));
}

function actionText(action) {
  const rawSummary = String(action?.summary || action?.family || "未知行动");
  const moveMatch = rawSummary.match(/^移动火箭\s+(\S+)\s+(ccw|cw|out|in)$/i);
  const moveDirection = {
    ccw: "逆时针",
    cw: "顺时针",
    out: "向外环",
    in: "向内环",
  };
  const summary = moveMatch
    ? `探测器 #${moveMatch[1]} ${moveDirection[moveMatch[2].toLowerCase()]}移动 1 步`
    : rawSummary;
  if (action?.decisionType === "conditional_choice") return `↳ 选择：${summary}`;
  if (action?.family === "end_turn") return "结束回合";
  const verb = FAMILY_VERBS[action?.family];
  if (!verb || verb === summary || (verb === "PASS" && summary === "PASS")) return summary;
  return `${verb}：${summary}`;
}

function selectionVisual(action, options = {}) {
  const presentCard = (rawCardId) => {
    const handCard = (options.hand || []).find((card) => (
      String(card.id) === String(rawCardId) || String(card.cardId) === String(rawCardId)
    ));
    const cardId = handCard?.cardId || String(rawCardId || "");
    return {
      name: handCard?.cardName || CARD_NAMES_BY_ID.get(cardId) || cards.getCardLabel({ cardId }),
      imageSrc: cardImageSrc(cardId),
    };
  };
  if (options.initialIncome && action?.target?.kind === "discard-hand-cards") {
    const cardId = String(action.target.cardIds?.[0] || "");
    const item = presentCard(cardId);
    return Object.freeze({
      label: "插收入",
      name: item.name,
      text: `插收入：${item.name}`,
      items: Object.freeze([item]),
    });
  }
  if (action?.target?.kind === "select_initial_card") {
    const cardId = String(action.target.cardId || "");
    if (action.target.selectionKind === "industry") {
      const fileName = cardId.replace(/^industry:/, "");
      const name = fileName.replace(/\.[^.]+$/, "");
      return Object.freeze({
        label: "选择公司",
        name,
        text: `选择公司：${name}`,
        items: Object.freeze([{
          name,
          imageSrc: `../assets/industry/${encodeURIComponent(fileName)}`,
        }]),
      });
    }
    const number = Number(cardId.replace(/^initial:/, ""));
    const effect = initialCards.getInitialCardEffect(number);
    const name = effect?.label || `初始牌 ${number}`;
    return Object.freeze({
      label: "选择初始资源牌",
      name,
      text: `选择初始资源牌：${name}`,
      items: Object.freeze([{
        name,
        imageSrc: `../assets/initial_card/split/${number}.png`,
      }]),
    });
  }
  const cardIds = [
    ...(action?.target?.cardIds || []),
    ...(String(action?.summary || "").match(/(?:b_\d+\.webp|dlc_\d+\.png)/gi) || []),
  ].filter((cardId, index, values) => values.indexOf(cardId) === index);
  if (!cardIds.length) return null;
  const items = cardIds.map(presentCard);
  const label = action?.target?.kind === "move-payment"
    ? "移动支付（弃牌获得 1 移动力）"
    : action?.target?.kind === "discard-hand-cards"
      ? "弃牌支付"
      : "选择卡牌";
  const name = items.map((item) => item.name).join("、");
  return Object.freeze({
    label,
    name,
    text: `${label}：${name}`,
    items: Object.freeze(items.map(Object.freeze)),
  });
}

function rocketCoordinate(observation, rocketId) {
  const rocket = observation?.publicState?.board?.rockets?.find(
    (candidate) => String(candidate.id) === String(rocketId),
  );
  const x = rocket?.x ?? rocket?.sectorX;
  const y = rocket?.y ?? rocket?.sectorY;
  if (!rocket || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) {
    return null;
  }
  const planets = solarSystem.createSolarSnapshot(
    observation?.publicState?.board?.solarSystem || {},
  ).planetLocations || [];
  const planetId = rocket.planetId || planets.find((planet) => (
    Number(planet.x) === Number(x) && Number(planet.y) === Number(y)
  ))?.planetId || null;
  return { x: Number(x), y: Number(y), planetId };
}

function coordinateLabel(observation, coordinate) {
  if (!coordinate) return "未知位置";
  const planet = solarSystem.createSolarSnapshot(
    observation?.publicState?.board?.solarSystem || {},
  ).planetLocations?.find(
    (candidate) => Number(candidate.x) === coordinate.x && Number(candidate.y) === coordinate.y,
  );
  const grid = `${coordinate.y} 环 · 扇区 ${coordinate.x}`;
  return planet
    ? `${PLANET_LABELS[planet.planetId] || planet.planetId}（${grid}）`
    : grid;
}

function movementRecord(before, after, action) {
  if (action?.family !== "move" || action.target?.rocketId == null) return null;
  const from = rocketCoordinate(before, action.target.rocketId);
  const to = rocketCoordinate(after, action.target.rocketId);
  return {
    rocketId: String(action.target.rocketId),
    from: coordinateLabel(before, from),
    to: coordinateLabel(after, to),
  };
}

function actionBoardRecord(before, after, action) {
  if (!["move", "orbit", "land"].includes(action?.family)) return null;
  const rocketId = action.target?.rocketId == null ? null : String(action.target.rocketId);
  const targetPlanetId = action.target?.planetId
    || rocketCoordinate(before, rocketId)?.planetId
    || null;
  return {
    family: action.family,
    rocketId,
    targetPlanetId,
    before: boardSnapshot(before),
    after: boardSnapshot(after),
  };
}

function isFoldableCardDecision(record) {
  return record?.decisionType === "conditional_choice"
    && ["choose_payment", "choose_card"].includes(record.family);
}

function runFixedBoardTurnReport(options = {}) {
  const env = createSimulationEnv();
  const maxDecisions = options.maxDecisions || 2000;
  try {
    const initialObservation = env.reset({ ...FIXED_BOARD_CONFIG, ...(options.config || {}) });
    const playerLabels = Object.fromEntries(
      initialObservation.publicState.players.map((player) => [player.playerId, player.playerLabel]),
    );
    const initialScores = Object.fromEntries(
      initialObservation.publicState.players.map((player) => [player.playerId, Number(player.score) || 0]),
    );
    const playerIds = initialObservation.publicState.players.map((player) => player.playerId);
    const setupChoices = [];
    const turns = [];
    const roundStarts = [];
    let activeTurn = null;
    let reachedTurnActions = false;
    let decisionCount = 0;

    while (!env.isTerminal() && decisionCount < maxDecisions) {
      const before = env.observe();
      const legalActions = env.legalActions();
      const formalStartObservations = !reachedTurnActions
        && before.decision?.decisionType !== "conditional_choice"
        ? Object.fromEntries(playerIds.map((playerId) => [playerId, env.observe(playerId)]))
        : null;
      const result = env.runHeuristicPolicyDecision();
      const chosen = legalActions.find((action) => action.actionId === result.policyDecision.actionId);
      if (!chosen) throw new Error(`无法还原第 ${decisionCount + 1} 个 PolicyDecision`);
      decisionCount += 1;

      const actorPlayerId = chosen.actorPlayerId || before.decision?.actorPlayerId;
      const resourcesBefore = resourcesOf(before, actorPlayerId);
      const handBeforeDecision = handOf(before, actorPlayerId);
      const afterForActor = env.observe(actorPlayerId);
      const rawResourcesAfter = resourcesOf(afterForActor, actorPlayerId);
      const incomeEvents = (result.replayEvent?.effectSessionJournal?.events || [])
        .filter((event) => event.type === "round_start_income");
      const actorIncome = incomeEvents.find((event) => event.playerId === actorPlayerId) || null;
      const visual = selectionVisual(chosen, {
        initialIncome: !reachedTurnActions,
        hand: handBeforeDecision,
      });
      const resourcesAfter = actorIncome
        ? Object.freeze({
          ...resourcesFromIncomeEvent(actorIncome, "before"),
          alienCardCount: rawResourcesAfter.alienCardCount,
        })
        : rawResourcesAfter;
      const valuationStartedAt = performance.now();
      const rankedEvaluations = evaluateLegalActions(
        before,
        legalActions,
        result.actionOutcomes,
        actorPlayerId,
        { initialIncome: !reachedTurnActions, hand: handBeforeDecision },
      );
      const valuationMilliseconds = performance.now() - valuationStartedAt;
      const counterfactualTiming = env.getCounterfactualDiagnostics() || {};
      if (Number(counterfactualTiming.totalMilliseconds) > 10000) {
        throw new Error(
          `fixed-board 第${decisionCount}次 ${chosen.family}/${chosen.actionId} `
          + `单次决策 ${counterfactualTiming.totalMilliseconds}ms 超过 10s 实验失控保护`,
        );
      }
      const chosenEvaluation = rankedEvaluations.find((candidate) => candidate.actionId === chosen.actionId) || null;
      const record = {
        decisionNumber: decisionCount,
        actorPlayerId,
        playerLabel: playerLabels[actorPlayerId] || actorPlayerId,
        decisionType: chosen.decisionType,
        family: chosen.family,
        summary: chosen.summary,
        text: visual?.text || actionText(chosen),
        visual,
        value: chosenEvaluation,
        alternatives: rankedEvaluations.filter((candidate) => candidate.actionId !== chosen.actionId).slice(0, 3),
        resourcesBefore,
        resourcesAfter,
        resourceDelta: resourceDelta(resourcesBefore, resourcesAfter),
        scoreBefore: scoreOf(before, actorPlayerId),
        scoreAfter: actorIncome
          ? Number(actorIncome.resourcesBefore?.score || 0)
          : scoreOf(afterForActor, actorPlayerId),
        scoreDelta: (actorIncome
          ? Number(actorIncome.resourcesBefore?.score || 0)
          : scoreOf(afterForActor, actorPlayerId)) - scoreOf(before, actorPlayerId),
        timing: {
          ...counterfactualTiming,
          valuationMilliseconds,
        },
        movement: movementRecord(before, afterForActor, chosen),
        actionBoard: actionBoardRecord(before, afterForActor, chosen),
        followups: [],
      };

      if (!reachedTurnActions && chosen.decisionType === "conditional_choice") {
        setupChoices.push(record);
        continue;
      }
      if (!reachedTurnActions) {
        const formalPlayers = playerIds.map((playerId) => {
          const observation = formalStartObservations?.[playerId] || before;
          return Object.freeze({
            playerId,
            playerLabel: playerLabels[playerId] || playerId,
            resourcesBefore: resourcesOf(observation, playerId),
            resourcesAfter: resourcesOf(observation, playerId),
            income: Object.freeze({}),
          });
        });
        roundStarts.push(Object.freeze({
          roundNumber: Number(before.publicState.roundNumber) || 1,
          kind: "initial",
          players: Object.freeze(formalPlayers),
          board: boardSnapshot(before),
        }));
      }
      reachedTurnActions = true;

      const roundNumber = before.publicState.roundNumber;
      const turnNumber = before.publicState.turnNumber;
      const turnKey = `${roundNumber}:${turnNumber}:${actorPlayerId}`;
      if (!activeTurn || activeTurn.key !== turnKey) {
        activeTurn = {
          key: turnKey,
          roundNumber,
          turnNumber,
          actorPlayerId,
          playerLabel: playerLabels[actorPlayerId] || actorPlayerId,
          scoreBefore: scoreOf(before, actorPlayerId),
          scoreAfter: scoreOf(before, actorPlayerId),
          resourcesBefore,
          resourcesAfter,
          handBefore: handOf(before, actorPlayerId),
          handAfter: handOf(afterForActor, actorPlayerId),
          actions: [],
        };
        turns.push(activeTurn);
      }
      const previousAction = activeTurn.actions.at(-1) || null;
      if (previousAction && isFoldableCardDecision(record)) {
        previousAction.followups.push(record);
        previousAction.resourcesAfter = record.resourcesAfter;
        previousAction.resourceDelta = resourceDelta(
          previousAction.resourcesBefore,
          record.resourcesAfter,
        );
        previousAction.scoreAfter = record.scoreAfter;
        previousAction.scoreDelta = record.scoreAfter - previousAction.scoreBefore;
        if (previousAction.movement) {
          previousAction.movement.to = coordinateLabel(
            afterForActor,
            rocketCoordinate(afterForActor, previousAction.movement.rocketId),
          );
        }
        if (previousAction.actionBoard) {
          previousAction.actionBoard.after = boardSnapshot(afterForActor);
        }
      } else {
        activeTurn.actions.push(record);
      }
      activeTurn.scoreAfter = scoreOf(result.observation, actorPlayerId);
      activeTurn.resourcesAfter = resourcesAfter;
      activeTurn.handAfter = handOf(afterForActor, actorPlayerId);
      if (incomeEvents.length) {
        const roundNumber = Number(incomeEvents[0].roundNumber)
          || Number(result.observation.publicState.roundNumber);
        roundStarts.push(Object.freeze({
          roundNumber,
          kind: "income",
          players: Object.freeze(incomeEvents.map((event) => Object.freeze({
            playerId: event.playerId,
            playerLabel: playerLabels[event.playerId] || event.playerId,
            resourcesBefore: resourcesFromIncomeEvent(event, "before"),
            resourcesAfter: resourcesFromIncomeEvent(event, "after"),
            income: Object.freeze({ ...(event.income || {}) }),
          }))),
          board: boardSnapshot(result.observation),
        }));
      }
    }

    if (!env.isTerminal()) throw new Error(`固定版面在 ${maxDecisions} 次决策内未结束`);
    const terminal = env.observe();
    const finalScores = terminal.publicState.players
      .map((player) => ({
        playerId: player.playerId,
        playerLabel: player.playerLabel,
        initialScore: initialScores[player.playerId] || 0,
        finalScore: Number(player.finalScore ?? player.score ?? 0),
        scoreSources: { ...(player.scoreSources || {}) },
        resources: resourcesOf(env.observe(player.playerId), player.playerId),
        probeGoals: turns
          .filter((turn) => turn.actorPlayerId === player.playerId)
          .flatMap((turn) => turn.actions)
          .map((action) => action.value?.evaluation?.probeGoalRequirement
            || action.value?.evaluation?.probeRouteSummary)
          .filter(Boolean),
        actualProbeScore: turns
          .filter((turn) => turn.actorPlayerId === player.playerId)
          .flatMap((turn) => turn.actions)
          .filter((action) => ["orbit", "land"].includes(action.family))
          .reduce((total, action) => total + action.scoreDelta, 0),
      }))
      .sort((left, right) => right.finalScore - left.finalScore);

    const diagnostics = buildDiagnostics(turns);
    return {
      schemaVersion: "seti-heuristic-turn-report-v6",
      boardId: options.boardId || FIXED_BOARD_ID,
      seed: initialObservation.seed,
      boardFingerprint: fingerprintFixedBoard(projectFixedBoard(initialObservation)),
      decisionCount,
      setupChoices,
      roundStarts,
      turns,
      finalScores,
      diagnostics,
    };
  } finally {
    env.dispose();
  }
}

function formatNumber(value) {
  const rounded = Math.round(Number(value || 0) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function signed(value) {
  if (!value) return "0";
  return value > 0 ? `+${formatNumber(value)}` : formatNumber(value);
}

function formatResourceTransition(before, after) {
  return RESOURCE_FIELDS.map(([key, label]) => (
    `${label} ${before[key]}→${after[key]}(${signed(after[key] - before[key])})`
  )).join("，");
}

function formatActualDelta(action, scoreDelta) {
  const parts = RESOURCE_FIELDS
    .filter(([key]) => action.resourceDelta[key] !== 0)
    .map(([key, label]) => `${label}${signed(action.resourceDelta[key])}`);
  if (scoreDelta !== 0) parts.unshift(`分数${signed(scoreDelta)}`);
  return parts.join("，") || "—";
}

function formatEvaluation(candidate, timing = null) {
  if (!candidate) return "未生成 outcome";
  const evaluation = candidate.evaluation;
  if (evaluation.score == null) {
    return `不可选；状态=${evaluation.status}；置信=${evaluation.confidence}；${evaluation.reasonCodes.join(",")}`;
  }
  const route = evaluation.probeRouteSummary;
  const goal = evaluation.probeGoalRequirement || null;
  const gap = goal?.gap || route?.resourceGap || null;
  const required = goal?.required || route?.routeCost || null;
  const parts = [
    `路线净值=${formatNumber(evaluation.value ?? evaluation.score)}`,
    `一级收益=${formatNumber(evaluation.primaryValue)}`,
    `其中实际分=${formatNumber(evaluation.actualScoreDelta)}`,
    `科技=${formatNumber(evaluation.techValue)}`,
    `未来收入=${formatNumber(evaluation.incomeValue)}`,
    `资源机会成本=${evaluation.opportunityCost ? `-${formatNumber(evaluation.opportunityCost)}` : "0"}`,
    `快速转换=${formatNumber(evaluation.quickTradeCount)}次`,
    goal
      ? `目标=${goal.planetId}/${goal.endpointFamily}`
      : route
      ? `目标=${route.endpointPlanetId || "未知行星"}/${route.endpointKind || "未知终点"}`
      : evaluation.routeTargetId
        ? `目标=${formatGoalName(evaluation)}`
      : evaluation.orangeTechDelta > 0
        ? `目标=补探测器橙色科技缺口(+${evaluation.orangeTechDelta})`
        : "目标=无",
    `路线终点实际分=${formatNumber(evaluation.goalScoreGain)}`,
    `行动后已兑现分变化=${formatNumber(evaluation.actualScoreDelta)}`,
    gap
      ? `缺口=钱${gap.credits || 0}/电${gap.energy || 0}/移动${gap.movementSteps || 0}`
      : "缺口=—",
    required
      ? `全路线需求=钱${required.credits || 0}/电${required.energy || 0}/移动${required.movementSteps || 0}`
      : "全路线实耗=—",
    `下一步=${goal?.nextStep?.family || route?.nextActionSummary || route?.nextActionId || candidate.summary}`,
    `状态=${evaluation.status}/${evaluation.confidence}`,
    `沿途宣传=${formatNumber(route?.publicityAlongRoute)}@${(route?.publicityOutcomeRefs || []).join("→") || "无（不计分）"}`,
    `终点标准叶=${route?.endpointActionId || "无"}@${JSON.stringify(route?.endpointDelta || {})}`,
    goal
      ? `叶后同目标缺口=${evaluation.reasonCodes?.includes("probe-goal-completed-standard-leaf")
        ? "目标已完成"
        : evaluation.leafProbeGoalRequirement
        ? `钱${evaluation.leafProbeGoalRequirement.gap?.credits || 0}/电${evaluation.leafProbeGoalRequirement.gap?.energy || 0}/移动${evaluation.leafProbeGoalRequirement.gap?.movementSteps || 0}`
        : "目标已完成或不再可用"}`
      : route
      ? `叶后资源=钱${route.remainingResources?.credits || 0}/电${route.remainingResources?.energy || 0}（库存本身不计 V，只改变路线缺口）`
      : "叶后资源=无探测器用途",
    `链=${(evaluation.actionChain || []).join("→") || "—"}`,
    "字段=outcomeProjection.scoring.realizedScore/progress.probeGoalRequirements/progress.probeRoute.candidate",
    `依据=${evaluation.reasonCodes.join(",")}`,
  ];
  if (timing) {
    const candidateCount = Math.max(1, Number(timing.candidateCount) || 1);
    parts.push(
      `耗时(${candidateCount}候选合计) fork ${formatNumber(timing.forkMilliseconds)}ms`
      + `/执行 ${formatNumber(timing.executionMilliseconds)}ms`
      + `/投影 ${formatNumber(timing.projectionMilliseconds)}ms`
      + `/估值 ${formatNumber(timing.valuationMilliseconds)}ms`
      + `；每候选 ${formatNumber((Number(timing.totalMilliseconds) || 0) / candidateCount)}ms`,
    );
  }
  return parts.join("；");
}

function formatAlternatives(alternatives) {
  if (!alternatives.length) return "—";
  return alternatives.map((candidate) => (
    candidate.evaluation.selectable
      ? `${candidate.summary}（V ${formatNumber(candidate.score)}）`
      : `${candidate.summary}（不可选：${candidate.evaluation.reasonCodes.join(",")}）`
  )).join("；");
}

function markdownCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatGoalName(evaluation) {
  const routeTargetId = evaluation?.routeTargetId;
  if (routeTargetId === "data:analyze") return "数据：推进至分析";
  if (routeTargetId === "card:play") return "卡牌：取得并打出";
  if (String(routeTargetId || "").startsWith("decision:")) return "完成当前规则选择";
  if (String(routeTargetId || "").startsWith("action:")) {
    return `直接行动：${routeTargetId.slice("action:".length)}`;
  }
  const goal = evaluation?.probeGoalRequirement;
  const route = evaluation?.probeRouteSummary;
  if (goal) return `${goal.planetId}/${goal.endpointFamily}`;
  if (route) return `${route.endpointPlanetId || "未知行星"}/${route.endpointKind || "未知终点"}`;
  if (evaluation?.orangeTechDelta > 0) return `橙色科技 +${evaluation.orangeTechDelta}`;
  return routeTargetId || "未标注次级代理目标";
}

function formatGap(gap) {
  if (!gap) return "—";
  return `钱 ${gap.credits || 0} · 电 ${gap.energy || 0} · 移动 ${gap.movementSteps || 0}`;
}

function renderResourceStrip(before, after) {
  return RESOURCE_FIELDS.map(([key, label]) => {
    const delta = after[key] - before[key];
    const deltaClass = delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral";
    return `<span class="resource-chip">
      <span class="resource-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(before[key])}→${escapeHtml(after[key])}</strong>
      <span class="delta ${deltaClass}">${escapeHtml(signed(delta))}</span>
    </span>`;
  }).join("");
}

function renderAlternatives(alternatives) {
  if (!alternatives.length) return '<span class="muted">没有其他候选</span>';
  return alternatives.map((candidate, index) => {
    const selectable = candidate.evaluation.selectable;
    const detail = selectable
      ? `V ${formatNumber(candidate.score)}`
      : `不可选 · ${(candidate.evaluation.reasonCodes || []).join(", ")}`;
    return `<li>
      <span class="alternative-rank">${index + 1}</span>
      <span>${escapeHtml(candidate.summary)}</span>
      <strong class="${selectable ? "" : "muted"}">${escapeHtml(detail)}</strong>
    </li>`;
  }).join("");
}

function renderActionFollowups(action) {
  if (!action.followups?.length) return "";
  return `<div class="action-followups">${action.followups.map((followup) => {
    const label = followup.visual?.label
      || (followup.family === "choose_payment" ? "支付方式" : "卡牌选择");
    const name = followup.visual?.name
      || String(followup.text || followup.summary || "已完成").replace(/^↳\s*选择：/, "");
    const images = (followup.visual?.items || [])
      .filter((item) => item.imageSrc)
      .map((item) => `<button class="card-image-button" type="button" data-image-src="${escapeHtml(item.imageSrc)}" aria-label="放大查看 ${escapeHtml(item.name)}">
        <img src="${escapeHtml(item.imageSrc)}" alt="${escapeHtml(item.name)}">
      </button>`)
      .join("");
    return `<div class="action-followup">
      ${images ? `<div class="selected-card-images">${images}</div>` : ""}
      <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(name)}</strong></div>
    </div>`;
  }).join("")}</div>`;
}

function renderActionBoard(action) {
  const board = action.actionBoard;
  if (!board) return "";
  const endpoint = board.targetPlanetId
    ? PLANET_LABELS[board.targetPlanetId] || board.targetPlanetId
    : action.movement?.to || "太阳系";
  const outcome = board.family === "land"
    ? `登陆 ${endpoint}`
    : board.family === "orbit"
      ? `环绕 ${endpoint}`
      : `${action.movement?.from || "未知位置"} → ${action.movement?.to || "未知位置"}`;
  return `<div class="action-board-panel">
    <div class="action-board-heading">
      <span>${board.family === "move" ? "实际移动路径" : "太阳系落点变化"}</span>
      <strong>${escapeHtml(outcome)}</strong>
    </div>
    <div class="action-board-pair">
      <figure><figcaption>行动前</figcaption>${renderSolarSystem(board.before, {
        compact: true,
        highlightRocketId: board.rocketId,
      })}</figure>
      <span class="board-change-arrow" aria-hidden="true">→</span>
      <figure><figcaption>${board.family === "move" ? "移动后" : "结算后"}</figcaption>${renderSolarSystem(board.after, {
        compact: true,
        highlightRocketId: board.rocketId,
        highlightPlanetId: board.family === "move" ? null : board.targetPlanetId,
        endpointFamily: board.family,
      })}</figure>
    </div>
  </div>`;
}

function renderActionCard(action) {
  const evaluation = action.value?.evaluation || null;
  const goal = evaluation?.probeGoalRequirement || null;
  const route = evaluation?.probeRouteSummary || null;
  const gap = goal?.gap || route?.resourceGap || null;
  const required = goal?.required || route?.routeCost || null;
  const nextStep = goal?.nextStep?.family
    || route?.nextActionSummary
    || route?.nextActionId
    || action.summary
    || "—";
  const chain = evaluation?.actionChain || [];
  const scoreDeltaClass = action.scoreDelta > 0 ? "positive" : action.scoreDelta < 0 ? "negative" : "neutral";
  const timing = action.timing || {};
  const candidateCount = Math.max(1, Number(timing.candidateCount) || 1);
  const perCandidate = (Number(timing.totalMilliseconds) || 0) / candidateCount;
  return `<article class="action-card" data-player="${escapeHtml(action.actorPlayerId)}" data-family="${escapeHtml(action.family)}">
    <div class="action-heading">
      <span class="decision-number">#${action.decisionNumber}</span>
      <div class="action-title">
        <h4>${escapeHtml(action.text)}</h4>
        <span>${escapeHtml(action.decisionType)} · ${escapeHtml(action.family)}</span>
      </div>
      <div class="score-change ${scoreDeltaClass}">
        <small>实际得分</small>
        <strong>${escapeHtml(signed(action.scoreDelta))}</strong>
      </div>
      <div class="value-pill">
        <small>整条路线净值</small>
        <strong>${evaluation?.score == null ? "—" : escapeHtml(formatNumber(evaluation.value ?? evaluation.score))}</strong>
      </div>
    </div>${action.visual ? `<div class="selected-card-preview">
      <div class="selected-card-images">${(action.visual.items || []).filter((item) => item.imageSrc).map((item) => `<button class="card-image-button" type="button" data-image-src="${escapeHtml(item.imageSrc)}" aria-label="放大查看 ${escapeHtml(item.name)}">
        <img src="${escapeHtml(item.imageSrc)}" alt="${escapeHtml(item.name)}">
      </button>`).join("")}</div>
      <div><span>${escapeHtml(action.visual.label || "本次选择")}</span><strong>${escapeHtml(action.visual.name)}</strong></div>
    </div>` : ""}
    ${renderActionFollowups(action)}
    ${renderActionBoard(action)}
    <div class="strip-caption">本决策前 → 执行后</div>
    <div class="resource-strip" aria-label="本决策前后资源">${renderResourceStrip(action.resourcesBefore, action.resourcesAfter)}</div>
    <div class="decision-grid">
      <div class="decision-cell emphasized">
        <span>当前目标</span>
        <strong>${escapeHtml(formatGoalName(evaluation))}</strong>
      </div>
      <div class="decision-cell">
        <span>下一步</span>
        <strong>${escapeHtml(nextStep)}</strong>
      </div>
      <div class="decision-cell">
        <span>当前缺口</span>
        <strong>${escapeHtml(formatGap(gap))}</strong>
      </div>
      <div class="decision-cell">
        <span>完整路线需求</span>
        <strong>${escapeHtml(formatGap(required))}</strong>
      </div>
      <div class="decision-cell">
        <span>路线累计实际分</span>
        <strong>${escapeHtml(formatNumber(evaluation?.actualScoreDelta))}</strong>
      </div>
      <div class="decision-cell">
        <span>路线科技价值</span>
        <strong>${escapeHtml(formatNumber(evaluation?.techValue))}</strong>
      </div>
      <div class="decision-cell">
        <span>路线未来收入</span>
        <strong>${escapeHtml(formatNumber(evaluation?.incomeValue))}</strong>
      </div>
      <div class="decision-cell">
        <span>资源机会成本</span>
        <strong>${evaluation?.opportunityCost
          ? `-${escapeHtml(formatNumber(evaluation.opportunityCost))}`
          : "0"}</strong>
      </div>
      <div class="decision-cell">
        <span>快速转换</span>
        <strong>${escapeHtml(formatNumber(evaluation?.quickTradeCount))} 次</strong>
      </div>
      <div class="decision-cell">
        <span>路线净值</span>
        <strong>${escapeHtml(formatNumber(evaluation?.value ?? evaluation?.score))}</strong>
      </div>
    </div>
    <div class="actual-outcome">
      <span>本步实际收益</span>
      <strong>${escapeHtml(formatActualDelta(action, action.scoreDelta))}</strong>
      <span class="score-transition">分数 ${escapeHtml(action.scoreBefore)}→${escapeHtml(action.scoreAfter)}</span>
    </div>
    <details class="action-details">
      <summary>路线依据、标准执行链与备选</summary>
      <div class="detail-columns">
        <div>
          <h5>标准执行链</h5>
          <div class="chain">${chain.length
            ? chain.map((step) => `<span>${escapeHtml(step)}</span>`).join('<b aria-hidden="true">→</b>')
            : '<span class="muted">—</span>'}</div>
          <h5>结果来源</h5>
          <p>${escapeHtml((evaluation?.reasonCodes || []).join(", ") || "未生成 outcome")}</p>
          <p class="muted">终点标准叶：${escapeHtml(route?.endpointActionId || "无")} · ${escapeHtml(JSON.stringify(route?.endpointDelta || {}))}</p>
        </div>
        <div>
          <h5>未提交的前三个备选</h5>
          <ol class="alternatives">${renderAlternatives(action.alternatives)}</ol>
          <p class="timing">候选 ${candidateCount} 个 · 总计 ${escapeHtml(formatNumber(timing.totalMilliseconds))}ms · 每候选 ${escapeHtml(formatNumber(perCandidate))}ms</p>
        </div>
      </div>
    </details>
  </article>`;
}

function cardImageSrc(cardId) {
  const normalized = String(cardId || "");
  if (/^b_\d+\.webp$/i.test(normalized)) {
    return `../assets/cards/basic/split/${normalized}`;
  }
  if (/^dlc_\d+\.(png|webp)$/i.test(normalized)) {
    return `../assets/cards/space-agency/split/${normalized.replace(/\.webp$/i, ".png")}`;
  }
  return null;
}

function renderHand(hand) {
  if (!hand?.length) return '<span class="muted">无手牌</span>';
  return hand.map((card) => {
    const imageSrc = cardImageSrc(card.cardId);
    return `<span class="hand-card" title="费用 ${escapeHtml(card.price ?? "—")} · 打出类型 ${escapeHtml(card.cardTypeCode ?? "—")} · 弃牌角 ${escapeHtml(card.discardActionCode ?? "—")} · 收入角 ${escapeHtml(card.incomeCode ?? "—")}">
      ${imageSrc ? `<button class="card-image-button" type="button" data-image-src="${escapeHtml(imageSrc)}" aria-label="放大查看 ${escapeHtml(card.cardName)}"><img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(card.cardName)}"></button>` : ""}
      <span><strong>${escapeHtml(card.cardName)}</strong></span>
    </span>`;
  }).join("");
}

const PLANET_LABELS = Object.freeze({
  earth: "地球",
  mercury: "水星",
  venus: "金星",
  mars: "火星",
  jupiter: "木星",
  saturn: "土星",
  uranus: "天王星",
  neptune: "海王星",
  aomomo: "奥陌陌",
});

function boardCoordinateStyle(x, y) {
  const point = boardCoordinatePoint(x, y);
  return `left:${point.left.toFixed(2)}%;top:${point.top.toFixed(2)}%`;
}

function boardCoordinatePoint(x, y) {
  const angle = ((Number(x) || 0) - 1.5) * (Math.PI / 4);
  const radius = 10 + (Math.max(1, Number(y) || 1) * 7.1);
  return {
    left: 50 + (Math.cos(angle) * radius),
    top: 50 + (Math.sin(angle) * radius),
  };
}

function renderSolarSystem(board, options = {}) {
  const rotation = board?.rotation || {};
  const wheelSteps = [1, 2, 3, 4].map((wheel) => Number(rotation[`wheel${wheel}Steps`]) || 0);
  const planets = board?.planets || [];
  const rockets = board?.rockets || [];
  const planetMarkers = planets.map((planet) => {
    const highlighted = String(planet.planetId) === String(options.highlightPlanetId || "");
    const endpointLabel = highlighted && options.endpointFamily === "land"
      ? "登陆"
      : highlighted && options.endpointFamily === "orbit"
        ? "环绕"
        : "";
    return `<span class="planet-marker${highlighted ? " highlighted" : ""}" style="${boardCoordinateStyle(planet.x, planet.y)}" title="${escapeHtml(PLANET_LABELS[planet.planetId] || planet.planetId)}">${escapeHtml(PLANET_LABELS[planet.planetId] || planet.planetId)}${endpointLabel ? `<b>${endpointLabel}</b>` : ""}</span>`;
  }).join("");
  const visibleRockets = rockets.filter((rocket) => (
    Number.isFinite(rocket.x) && Number.isFinite(rocket.y)
  ));
  const rocketMarkers = visibleRockets.map((rocket) => {
    const highlighted = String(rocket.id) === String(options.highlightRocketId || "");
    const colocated = visibleRockets.filter((candidate) => (
      Number(candidate.x) === Number(rocket.x) && Number(candidate.y) === Number(rocket.y)
    ));
    const localIndex = colocated.indexOf(rocket);
    const localOffset = (localIndex - ((colocated.length - 1) / 2)) * 7;
    const color = rocket.color || String(rocket.playerId || "").replace(/^player-/, "") || "white";
    return `<img class="rocket-marker${highlighted ? " highlighted" : ""}" src="../assets/tokens/rocket-${escapeHtml(color)}.png" alt="${escapeHtml(color)} 探测器" style="${boardCoordinateStyle(rocket.x, rocket.y)};--rocket-offset:${localOffset}px" title="${escapeHtml(rocket.playerId)} · ${escapeHtml(rocket.planetId || `${rocket.x},${rocket.y}`)}">`;
  }).join("");
  return `<div class="solar-visual${options.compact ? " compact" : ""}" aria-label="${options.compact ? "行动太阳系盘面" : "本轮开始时的太阳系盘面"}">
    ${[4, 3, 2, 1].map((wheel) => `<img class="solar-wheel wheel-${wheel}" src="../assets/core/wheels/wheel${wheel}.png" alt="" style="transform:translate(-50%,-50%) rotate(${wheelSteps[wheel - 1] * 45}deg)">`).join("")}
    <img class="solar-sun" src="../assets/core/sun.png" alt="太阳">
${planetMarkers}
${rocketMarkers}
  </div>`;
}

function alienFaceSrc(slot) {
  return slot?.revealed && slot.alienId
    ? `../assets/aliens/${encodeURIComponent(slot.alienId)}/face.png`
    : "../assets/aliens/back.png";
}

function renderAlienBoard(aliens) {
  if (!aliens.length) return '<p class="muted">无外星人状态</p>';
  return `<div class="alien-board">${aliens.map((slot) => `<div class="alien-slot">
    <button class="alien-face-button" type="button" data-image-src="${escapeHtml(alienFaceSrc(slot))}" aria-label="放大查看${escapeHtml(slot.revealed ? slot.alienId || "外星人" : "未揭示外星人")}">
      <img src="${escapeHtml(alienFaceSrc(slot))}" alt="${escapeHtml(slot.revealed ? slot.alienId || "已揭示外星人" : "未揭示外星人")}">
    </button>
    <div><strong>槽位 ${slot.slotId} · ${escapeHtml(slot.revealed ? slot.alienId || "已揭示" : "未揭示")}</strong>
      <div class="trace-row">${["pink", "yellow", "blue"].map((traceType) => {
        const trace = slot.traces?.[traceType] || {};
        const count = Number(Boolean(trace.firstPlaced)) + Number(trace.extraCount || 0);
        return `<span class="trace-chip ${traceType}"><i></i>${escapeHtml(count)}</span>`;
      }).join("")}</div>
    </div>
  </div>`).join("")}</div>`;
}

function renderBoardSnapshot(board) {
  const rotation = board?.rotation?.normalized
    ?? board?.rotation?.steps
    ?? board?.rotation
    ?? "—";
  const rockets = board?.rockets || [];
  const rocketText = rockets.length
    ? rockets.map((rocket) => (
      `${rocket.playerId.replace(/^player-/, "")}#${rocket.id}：${rocket.planetId || (
        Number.isFinite(rocket.x) && Number.isFinite(rocket.y)
          ? `${rocket.x},${rocket.y}`
          : rocket.surface
      )}`
    )).join("；")
    : "盘面暂无探测器";
  const aliens = board?.aliens || [];
  const techSupply = board?.techSupply || [];
  return `<div class="board-preview">
    <div class="board-card solar-board-card">
      <span class="eyebrow">太阳系</span>
      ${renderSolarSystem(board)}
      <strong>已旋转 ${escapeHtml(typeof rotation === "object" ? rotation.rotationCount ?? 0 : rotation)} 次</strong>
      <p>${escapeHtml(rocketText)}</p>
    </div>
    <div class="board-card">
      <span class="eyebrow">外星人</span>
      ${renderAlienBoard(aliens)}
    </div>
    <div class="board-card">
      <span class="eyebrow">科技供应</span>
      <div class="tech-list">${techSupply.map((stack) => `<span><strong>${escapeHtml(stack.tileId)}</strong> ×${escapeHtml(stack.remaining ?? "—")}<small>${escapeHtml(stack.bonusId || "无首拿奖励")}</small></span>`).join("")}</div>
    </div>
    <div class="board-card">
      <span class="eyebrow">玩家科技</span>
      ${(board?.playerTech || []).map((player) => {
        const owned = Object.keys(player.techState?.ownedTiles || {})
          .filter((tileId) => player.techState.ownedTiles[tileId]);
        const disabled = new Set(Object.keys(player.techState?.disabledTiles || {})
          .filter((tileId) => player.techState.disabledTiles[tileId]));
        return `<p><strong>${escapeHtml(player.playerLabel)}</strong>：${owned.length
          ? owned.map((tileId) => `${escapeHtml(tileId)}${disabled.has(tileId) ? "（失效）" : ""}`).join("、")
          : '<span class="muted">无科技</span>'}</p>`;
      }).join("")}
    </div>
  </div>`;
}

function formatIncome(income) {
  const labels = {
    credits: "钱",
    energy: "电",
    publicity: "宣传",
    availableData: "数据",
    additionalPublicScan: "额外公共扫描",
    handSize: "盲抽",
  };
  return Object.entries(income || {})
    .filter(([, value]) => Number(value))
    .map(([key, value]) => `${labels[key] || key} +${value}`)
    .join(" · ") || "无";
}

function renderRoundStart(roundStart) {
  const initial = roundStart?.kind === "initial";
  return `<section class="round-start-card">
    <div class="round-subheading">
      <div><span class="eyebrow">轮初状态</span><h3>${initial ? "正式初始资源" : "收入阶段"}</h3></div>
      <p>${initial ? "第 1 轮不获得轮初收入；以下是公司牌与两张资源牌结算后的正式状态。" : "收入归入本轮开始，不计入上一轮最后一个 end_turn。"}</p>
    </div>
    <div class="income-grid">${(roundStart?.players || []).map((player) => `<div class="income-player" data-player="${escapeHtml(player.playerId)}">
      <div><strong>${escapeHtml(player.playerLabel)}</strong><small>${initial ? "正式开局" : `收入：${escapeHtml(formatIncome(player.income))}`}</small></div>
      <div class="resource-strip">${renderResourceStrip(player.resourcesBefore, player.resourcesAfter)}</div>
    </div>`).join("")}</div>
  </section>
  ${renderBoardSnapshot(roundStart?.board)}`;
}

function renderRoundSummary(turns) {
  const byPlayer = new Map();
  for (const turn of turns) {
    const summary = byPlayer.get(turn.actorPlayerId) || {
      playerLabel: turn.playerLabel,
      scoreBefore: turn.scoreBefore,
      scoreAfter: turn.scoreAfter,
      resourcesBefore: turn.resourcesBefore,
      resourcesAfter: turn.resourcesAfter,
      decisionCount: 0,
    };
    summary.scoreAfter = turn.scoreAfter;
    summary.resourcesAfter = turn.resourcesAfter;
    summary.decisionCount += turn.actions.reduce(
      (count, action) => count + 1 + (action.followups?.length || 0),
      0,
    );
    byPlayer.set(turn.actorPlayerId, summary);
  }
  return `<section class="round-summary">
    <div class="round-subheading"><div><span class="eyebrow">本轮梗概</span><h3>资源与得分变化</h3></div></div>
    <div class="round-summary-grid">${[...byPlayer.entries()].map(([playerId, summary]) => `<div class="round-player-summary" data-player="${escapeHtml(playerId)}">
      <div class="summary-line"><strong>${escapeHtml(summary.playerLabel)}</strong><span>${summary.decisionCount} 次决策 · 得分 ${escapeHtml(summary.scoreBefore)}→${escapeHtml(summary.scoreAfter)}（${escapeHtml(signed(summary.scoreAfter - summary.scoreBefore))}）</span></div>
      <div class="resource-strip">${renderResourceStrip(summary.resourcesBefore, summary.resourcesAfter)}</div>
    </div>`).join("")}</div>
  </section>`;
}

function renderTurnSection(turn) {
  return `<section class="turn-section" data-player="${escapeHtml(turn.actorPlayerId)}">
    <div class="turn-heading">
      <div>
        <span class="eyebrow">第 ${turn.roundNumber} 轮 · T${String(turn.turnNumber).padStart(2, "0")}</span>
        <h3>${escapeHtml(turn.playerLabel)}</h3>
      </div>
      <div class="turn-score">
        <span>回合分数</span>
        <strong>${escapeHtml(turn.scoreBefore)} → ${escapeHtml(turn.scoreAfter)}</strong>
        <b class="${turn.scoreAfter > turn.scoreBefore ? "positive" : "neutral"}">${escapeHtml(signed(turn.scoreAfter - turn.scoreBefore))}</b>
      </div>
    </div>
    <div class="hand-panel">
      <span>本回合行动前手牌（${turn.handBefore?.length || 0}）</span>
      <div class="hand-list">${renderHand(turn.handBefore)}</div>
    </div>
    <div class="strip-caption turn-caption">本回合累计变化（下方每张卡是单步变化）</div>
    <div class="turn-resource-summary">${renderResourceStrip(turn.resourcesBefore, turn.resourcesAfter)}</div>
    <div class="action-list">${turn.actions.map(renderActionCard).join("")}</div>
  </section>`;
}

function formatTurnReportHtml(report) {
  const familyCounts = report.diagnostics.actionFamilyCounts;
  const players = report.finalScores.map((player) => ({
    id: player.playerId,
    label: player.playerLabel,
  }));
  const families = Object.keys(familyCounts).sort();
  const actionCount = report.setupChoices.length
    + report.turns.reduce((total, turn) => total + turn.actions.length, 0);
  const probeEndpoints = report.turns.flatMap((turn) => turn.actions)
    .filter((action) => ["orbit", "land"].includes(action.family)).length;
  const generatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const setupSection = report.setupChoices.length
    ? `<section class="turn-section setup-section" data-player="setup">
      <div class="turn-heading">
        <div><span class="eyebrow">开局阶段</span><h3>公司与资源牌选择</h3></div>
        <div class="turn-score"><span>决策数</span><strong>${report.setupChoices.length}</strong></div>
      </div>
      <p class="setup-note">开局选择完成后才会清空玩家模型占位资源，并结算公司牌和两张资源牌；因此本区不展示结算前的 10 钱 / 10 电。第 1 轮第一张行动卡显示正式初始资源。</p>
      <div class="action-list">${report.setupChoices.map(renderActionCard).join("")}</div>
    </section>`
    : "";
  const roundNumbers = [...new Set(report.turns.map((turn) => turn.roundNumber))].sort((left, right) => left - right);
  const roundSections = roundNumbers.map((roundNumber) => {
    const turns = report.turns.filter((turn) => turn.roundNumber === roundNumber);
    const roundStart = report.roundStarts?.find((entry) => entry.roundNumber === roundNumber) || null;
    return `<section class="round-block" id="round-${roundNumber}" data-round="${roundNumber}">
      <div class="round-title"><span>ROUND</span><strong>${roundNumber}</strong></div>
      ${renderRoundStart(roundStart)}
      ${renderRoundSummary(turns)}
      <section class="round-details">
        <div class="round-subheading"><div><span class="eyebrow">本轮细节</span><h3>逐回合与逐决策日志</h3></div></div>
        ${turns.map(renderTurnSection).join("")}
      </section>
    </section>`;
  }).join("");
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(report.boardId)} 机器人逐决策报告</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #090d18;
      --panel: #11182a;
      --panel-2: #172137;
      --line: #263451;
      --text: #eef3ff;
      --muted: #94a3be;
      --cyan: #56d8ff;
      --violet: #9f8cff;
      --green: #70e1a1;
      --red: #ff8d92;
      --amber: #ffc96b;
      --shadow: 0 18px 48px rgba(0, 0, 0, .26);
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at 12% -10%, rgba(63, 105, 255, .22), transparent 30rem),
        radial-gradient(circle at 90% 5%, rgba(62, 211, 222, .12), transparent 28rem),
        var(--bg);
      color: var(--text);
      font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    }
    button, select, input { font: inherit; }
    .page { width: min(1480px, calc(100% - 40px)); margin: 0 auto; padding: 44px 0 80px; }
    .hero { display: grid; grid-template-columns: 1fr auto; gap: 32px; align-items: end; margin-bottom: 24px; }
    .eyebrow { color: var(--cyan); font-size: 12px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 7px 0 10px; font-size: clamp(28px, 4vw, 48px); line-height: 1.12; letter-spacing: -.035em; }
    .hero p { margin: 0; color: var(--muted); max-width: 880px; }
    .hero-meta { text-align: right; color: var(--muted); font-size: 12px; }
    .hero-meta code { display: block; color: var(--text); margin-top: 4px; max-width: 340px; overflow-wrap: anywhere; }
    .summary-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }
    .summary-card { padding: 18px; border: 1px solid var(--line); border-radius: 16px; background: rgba(17, 24, 42, .86); box-shadow: var(--shadow); }
    .summary-card span { display: block; color: var(--muted); font-size: 12px; }
    .summary-card strong { display: block; margin-top: 4px; font-size: 25px; letter-spacing: -.025em; }
    .standings { overflow-x: auto; border: 1px solid var(--line); border-radius: 18px; background: rgba(17, 24, 42, .9); box-shadow: var(--shadow); }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 13px 16px; border-bottom: 1px solid var(--line); text-align: right; white-space: nowrap; }
    th:first-child, td:first-child, th:nth-child(2), td:nth-child(2) { text-align: left; }
    th { color: var(--muted); font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }
    tbody tr:last-child td { border-bottom: 0; }
    .rank { color: var(--amber); font-weight: 800; }
    .toolbar {
      position: sticky; top: 0; z-index: 20;
      display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
      margin: 28px 0 18px; padding: 13px;
      border: 1px solid var(--line); border-radius: 16px;
      background: rgba(9, 13, 24, .92); backdrop-filter: blur(16px);
      box-shadow: var(--shadow);
    }
    .toolbar label { display: flex; gap: 8px; align-items: center; color: var(--muted); }
    select, input {
      min-width: 150px; padding: 8px 10px; color: var(--text);
      border: 1px solid var(--line); border-radius: 9px; background: var(--panel-2);
    }
    .visible-count { margin-left: auto; color: var(--cyan); font-weight: 700; }
    .round-block { position: relative; margin: 32px 0 50px; padding-top: 10px; }
    .round-title { display: flex; gap: 10px; align-items: baseline; margin-bottom: 12px; }
    .round-title span { color: var(--muted); font-size: 12px; font-weight: 800; letter-spacing: .15em; }
    .round-title strong { color: var(--cyan); font-size: 36px; line-height: 1; }
    .round-start-card, .round-summary, .round-details { margin: 14px 0; padding: 20px; border: 1px solid var(--line); border-radius: 20px; background: rgba(17, 24, 42, .78); box-shadow: var(--shadow); }
    .round-subheading { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 14px; }
    .round-subheading h3 { margin: 3px 0 0; font-size: 21px; }
    .round-subheading p { margin: 0; color: var(--muted); font-size: 12px; }
    .income-grid, .round-summary-grid { display: grid; gap: 10px; }
    .income-player, .round-player-summary { padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: rgba(9, 13, 24, .42); }
    .income-player > div:first-child { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
    .income-player small { color: var(--muted); }
    .summary-line { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 8px; }
    .summary-line span { color: var(--muted); font-size: 12px; }
    .board-preview { display: grid; grid-template-columns: 1.6fr 1.1fr 1fr 1fr; gap: 10px; margin: 14px 0; }
    .board-card { min-width: 0; padding: 14px; border: 1px solid var(--line); border-radius: 14px; background: rgba(17, 24, 42, .78); box-shadow: var(--shadow); }
    .board-card > strong { display: block; margin: 4px 0; }
    .board-card p { margin: 6px 0; font-size: 12px; overflow-wrap: anywhere; }
    .board-card small { color: var(--muted); }
    .solar-visual { position: relative; width: min(100%, 340px); aspect-ratio: 1; margin: 10px auto 8px; overflow: hidden; border-radius: 50%; background: #050912; box-shadow: inset 0 0 30px rgba(86, 216, 255, .12), 0 10px 28px rgba(0, 0, 0, .32); }
    .solar-visual.compact { width: min(100%, 250px); margin: 0 auto; }
    .solar-wheel { position: absolute; left: 50%; top: 50%; height: auto; transform-origin: center; }
    .solar-wheel.wheel-4 { width: 100%; }
    .solar-wheel.wheel-3 { width: 62.4%; }
    .solar-wheel.wheel-2 { width: 48.7%; }
    .solar-wheel.wheel-1 { width: 35.3%; }
    .solar-sun { position: absolute; left: 50%; top: 50%; width: 8.5%; transform: translate(-50%, -50%); filter: drop-shadow(0 0 10px rgba(255, 196, 64, .8)); }
    .planet-marker, .rocket-marker { position: absolute; z-index: 4; transform: translate(-50%, -50%); }
    .planet-marker { padding: 1px 4px; border: 1px solid rgba(255, 255, 255, .42); border-radius: 8px; color: #fff; background: rgba(4, 8, 18, .78); font-size: 8px; font-weight: 750; line-height: 1.25; white-space: nowrap; box-shadow: 0 2px 5px rgba(0, 0, 0, .55); }
    .planet-marker.highlighted { z-index: 7; color: #07111f; border-color: #fff; background: var(--amber); box-shadow: 0 0 0 4px rgba(255, 201, 107, .28), 0 0 18px rgba(255, 201, 107, .9); }
    .planet-marker b { display: block; font-size: 7px; }
    .rocket-marker { width: 17px; height: 20px; margin-left: var(--rocket-offset); object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .9)); }
    .rocket-marker.highlighted { z-index: 8; width: 22px; height: 25px; filter: drop-shadow(0 0 3px #fff) drop-shadow(0 0 6px rgba(86, 216, 255, .85)); }
    .player-color-player-red { color: #ff6576; }
    .player-color-player-blue { color: #55a7ff; }
    .player-color-player-green { color: #61d98a; }
    .player-color-player-brown { color: #d4a171; }
    .alien-board { display: grid; gap: 9px; margin-top: 10px; }
    .alien-slot { display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 9px; align-items: center; padding: 7px; border-radius: 10px; background: rgba(9, 13, 24, .5); }
    .alien-face-button { width: 52px; height: 76px; margin: 0; padding: 0; overflow: hidden; border: 1px solid var(--line); border-radius: 7px; background: transparent; cursor: zoom-in; }
    .alien-face-button img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .alien-slot strong { font-size: 11px; }
    .trace-row { display: flex; gap: 5px; margin-top: 7px; }
    .trace-chip { display: inline-flex; gap: 4px; align-items: center; padding: 2px 5px; border-radius: 8px; background: var(--panel-2); font-size: 10px; }
    .trace-chip i { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
    .trace-chip.pink { color: #ff7db6; }
    .trace-chip.yellow { color: #ffd15c; }
    .trace-chip.blue { color: #62b5ff; }
    .tech-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 8px; }
    .tech-list span { padding: 5px 7px; border-radius: 7px; background: var(--panel-2); font-size: 11px; }
    .tech-list small { display: block; font-size: 9px; overflow-wrap: anywhere; }
    .turn-section { margin: 12px 0; padding: 20px; border: 1px solid var(--line); border-radius: 16px; background: rgba(9, 13, 24, .38); }
    .turn-heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 14px; }
    .turn-heading h3 { margin: 3px 0 0; font-size: 23px; }
    .turn-score { display: grid; grid-template-columns: auto auto auto; gap: 10px; align-items: baseline; }
    .turn-score span { color: var(--muted); font-size: 12px; }
    .turn-score strong { font-size: 18px; }
    .resource-strip, .turn-resource-summary { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
    .turn-resource-summary { margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--line); }
    .strip-caption { padding: 0 14px 6px; color: var(--muted); font-size: 10px; letter-spacing: .04em; }
    .turn-caption { padding: 0 0 6px; color: var(--cyan); }
    .setup-note { margin: 0 0 14px; padding: 10px 12px; border: 1px solid rgba(255, 201, 107, .3); border-radius: 10px; color: var(--amber); background: rgba(255, 201, 107, .06); }
    .setup-section .action-card > .strip-caption,
    .setup-section .action-card > .resource-strip { display: none; }
    .selected-card-preview { display: flex; gap: 12px; align-items: center; margin: 0 14px 14px; padding: 10px; border: 1px solid var(--line); border-radius: 11px; background: rgba(86, 216, 255, .045); }
    .selected-card-preview span { display: block; color: var(--muted); font-size: 10px; }
    .selected-card-preview strong { display: block; margin-top: 2px; }
    .selected-card-images { display: flex; gap: 6px; flex: 0 0 auto; }
    .card-image-button { display: inline-grid; place-items: center; flex: 0 0 auto; margin: 0; padding: 0; border: 0; border-radius: 7px; background: transparent; cursor: zoom-in; }
    .card-image-button img { display: block; width: 44px; height: 62px; object-fit: cover; border-radius: 6px; box-shadow: 0 5px 14px rgba(0, 0, 0, .35); }
    .selected-card-preview .card-image-button img { width: 58px; height: 82px; }
    .action-followups { display: grid; gap: 7px; margin: 0 14px 14px; }
    .action-followup { display: flex; gap: 10px; align-items: center; padding: 8px 10px; border-left: 3px solid var(--amber); border-radius: 7px; background: rgba(255, 201, 107, .07); }
    .action-followup span { display: block; color: var(--muted); font-size: 10px; }
    .action-followup strong { display: block; margin-top: 2px; font-size: 12px; }
    .action-board-panel { margin: 0 14px 14px; padding: 12px; border: 1px solid rgba(86, 216, 255, .28); border-radius: 13px; background: rgba(86, 216, 255, .045); }
    .action-board-heading { display: flex; gap: 12px; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
    .action-board-heading span { color: var(--muted); font-size: 10px; }
    .action-board-heading strong { color: var(--cyan); font-size: 12px; text-align: right; }
    .action-board-pair { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 10px; align-items: center; }
    .action-board-pair figure { min-width: 0; margin: 0; }
    .action-board-pair figcaption { margin-bottom: 5px; color: var(--muted); font-size: 10px; text-align: center; }
    .board-change-arrow { color: var(--cyan); font-size: 24px; }
    .hand-panel { display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: start; margin-bottom: 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 11px; background: rgba(159, 140, 255, .055); }
    .hand-panel > span { color: var(--violet); font-size: 11px; white-space: nowrap; }
    .hand-list { display: flex; gap: 6px; flex-wrap: wrap; }
    .hand-card { display: inline-flex; gap: 7px; align-items: center; padding: 5px 7px 5px 5px; border-radius: 8px; background: var(--panel-2); font-size: 11px; }
    .hand-card > span { display: grid; }
    .hand-card small { color: var(--muted); font: 9px ui-monospace, SFMono-Regular, Menlo, monospace; }
    .image-lightbox { position: fixed; inset: 0; z-index: 100; display: none; place-items: center; padding: 30px; border: 0; background: rgba(3, 6, 14, .9); cursor: zoom-out; }
    .image-lightbox.open { display: grid; }
    .image-lightbox img { max-width: min(92vw, 780px); max-height: 90vh; border-radius: 14px; box-shadow: 0 30px 90px rgba(0, 0, 0, .7); }
    .resource-chip { display: grid; grid-template-columns: 1fr auto; gap: 1px 8px; padding: 8px 10px; border: 1px solid rgba(57, 73, 110, .75); border-radius: 10px; background: rgba(9, 13, 24, .45); }
    .resource-label { color: var(--muted); font-size: 11px; }
    .resource-chip strong { font-size: 13px; }
    .resource-chip .delta { grid-column: 2; font-size: 11px; }
    .action-list { display: grid; gap: 12px; }
    .action-card { overflow: hidden; border: 1px solid var(--line); border-radius: 15px; background: var(--panel); }
    .action-heading { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; gap: 12px; align-items: center; padding: 14px; }
    .decision-number { color: var(--cyan); font: 750 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .action-title h4 { margin: 0; font-size: 15px; }
    .action-title span { color: var(--muted); font-size: 11px; }
    .score-change, .value-pill { min-width: 86px; padding: 6px 10px; text-align: right; border-left: 1px solid var(--line); }
    .score-change small, .value-pill small { display: block; color: var(--muted); font-size: 10px; }
    .score-change strong, .value-pill strong { font-size: 18px; }
    .value-pill strong { color: var(--violet); }
    .action-card > .resource-strip { padding: 0 14px 14px; }
    .decision-grid { display: grid; grid-template-columns: 1.35fr 1fr 1fr 1fr .8fr .8fr; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
    .decision-cell { min-width: 0; padding: 10px 12px; border-right: 1px solid var(--line); }
    .decision-cell:last-child { border-right: 0; }
    .decision-cell span { display: block; color: var(--muted); font-size: 10px; }
    .decision-cell strong { display: block; margin-top: 2px; font-size: 12px; overflow-wrap: anywhere; }
    .decision-cell.emphasized strong { color: var(--cyan); }
    .actual-outcome { display: flex; gap: 10px; align-items: center; padding: 10px 14px; background: rgba(86, 216, 255, .045); }
    .actual-outcome span { color: var(--muted); font-size: 11px; }
    .actual-outcome strong { color: var(--green); }
    .actual-outcome .score-transition { margin-left: auto; }
    .action-details { border-top: 1px solid var(--line); }
    .action-details summary { padding: 10px 14px; cursor: pointer; color: var(--muted); font-size: 12px; }
    .detail-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 2px 14px 16px; }
    .detail-columns h5 { margin: 10px 0 5px; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
    .detail-columns p { margin: 4px 0; font-size: 12px; overflow-wrap: anywhere; }
    .chain { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
    .chain span { padding: 4px 7px; border-radius: 6px; background: var(--panel-2); font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; }
    .chain b { color: var(--muted); }
    .alternatives { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .alternatives li { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; font-size: 12px; }
    .alternative-rank { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; color: var(--muted); background: var(--panel-2); }
    .timing { color: var(--muted); }
    .positive { color: var(--green) !important; }
    .negative { color: var(--red) !important; }
    .neutral, .muted { color: var(--muted) !important; }
    .hidden { display: none !important; }
    .empty-state { display: none; padding: 50px; text-align: center; color: var(--muted); }
    footer { margin-top: 30px; color: var(--muted); font-size: 12px; text-align: center; }
    @media (max-width: 980px) {
      .summary-grid { grid-template-columns: repeat(2, 1fr); }
      .resource-strip, .turn-resource-summary { grid-template-columns: repeat(3, 1fr); }
      .decision-grid { grid-template-columns: repeat(3, 1fr); }
      .decision-cell:nth-child(3) { border-right: 0; }
      .detail-columns { grid-template-columns: 1fr; }
      .board-preview { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 640px) {
      .page { width: min(100% - 20px, 1480px); padding-top: 24px; }
      .hero { grid-template-columns: 1fr; }
      .hero-meta { text-align: left; }
      .summary-grid { grid-template-columns: 1fr 1fr; }
      .action-heading { grid-template-columns: auto 1fr; }
      .score-change, .value-pill { border-left: 0; border-top: 1px solid var(--line); text-align: left; }
      .resource-strip, .turn-resource-summary, .decision-grid { grid-template-columns: repeat(2, 1fr); }
      .decision-cell:nth-child(3) { border-right: 1px solid var(--line); }
      .decision-cell:nth-child(even) { border-right: 0; }
      .turn-heading { align-items: flex-start; }
      .turn-score { grid-template-columns: 1fr; text-align: right; }
      .visible-count { width: 100%; margin-left: 0; }
      .board-preview { grid-template-columns: 1fr; }
      .round-subheading, .summary-line { align-items: flex-start; flex-direction: column; }
      .hand-panel { grid-template-columns: 1fr; }
      .action-board-pair { grid-template-columns: 1fr; }
      .board-change-arrow { transform: rotate(90deg); text-align: center; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="hero">
      <div>
        <span class="eyebrow">SETI · Heuristic Policy Trace</span>
        <h1>机器人逐决策行动报告</h1>
        <p>每一步均取自实际标准行动执行：分别展示本步变化、整条路线的分数/科技/未来收入、资源机会成本与净值，并保留未提交的候选供诊断。</p>
      </div>
      <div class="hero-meta">seed <code>${escapeHtml(report.seed)}</code>生成于 ${escapeHtml(generatedAt)}</div>
    </header>

    <section class="summary-grid" aria-label="整局摘要">
      <div class="summary-card"><span>Policy 决策</span><strong>${report.decisionCount}</strong></div>
      <div class="summary-card"><span>玩家回合</span><strong>${report.turns.length}</strong></div>
      <div class="summary-card"><span>环绕 / 登陆</span><strong>${probeEndpoints}</strong></div>
      <div class="summary-card"><span>每候选平均</span><strong>${escapeHtml(formatNumber(report.diagnostics.performance.averagePerCandidateMilliseconds))}<small> ms</small></strong></div>
      <div class="summary-card"><span>最高终局分</span><strong>${report.finalScores[0]?.finalScore || 0}</strong></div>
    </section>

    <section class="standings" aria-label="终局排名">
      <table>
        <thead><tr><th>名次</th><th>机器人</th><th>总分</th><th>实局增长</th><th>探测器得分</th><th>钱</th><th>电</th><th>宣传</th><th>数据</th><th>手牌</th></tr></thead>
        <tbody>${report.finalScores.map((player, index) => `<tr>
          <td class="rank">#${index + 1}</td><td>${escapeHtml(player.playerLabel)}</td>
          <td><strong>${player.finalScore}</strong></td><td>${escapeHtml(signed(player.finalScore - player.initialScore))}</td>
          <td>${player.actualProbeScore}</td><td>${player.resources.credits}</td><td>${player.resources.energy}</td>
          <td>${player.resources.publicity}</td><td>${player.resources.availableData}</td><td>${player.resources.handCount}</td>
        </tr>`).join("")}</tbody>
      </table>
    </section>

    <nav class="toolbar" aria-label="报告筛选">
      <label>机器人
        <select id="playerFilter">
          <option value="all">全部机器人</option>
          <option value="setup">仅开局选择</option>
          ${players.map((player) => `<option value="${escapeHtml(player.id)}">${escapeHtml(player.label)}</option>`).join("")}
        </select>
      </label>
      <label>行动类型
        <select id="familyFilter">
          <option value="all">全部行动</option>
          ${families.map((family) => `<option value="${escapeHtml(family)}">${escapeHtml(family)} (${familyCounts[family]})</option>`).join("")}
        </select>
      </label>
      <label>搜索
        <input id="textFilter" type="search" placeholder="行星、行动、目标…">
      </label>
      <span class="visible-count" id="visibleCount">显示 ${actionCount} / ${actionCount} 个行动记录（原始 Policy 决策 ${report.decisionCount}）</span>
    </nav>

    <div id="reportBody">
      ${setupSection}
      ${roundSections}
    </div>
    <div class="empty-state" id="emptyState">没有符合当前筛选条件的决策。</div>
    <footer>${escapeHtml(report.schemaVersion)} · ${escapeHtml(report.boardId)} · fingerprint ${escapeHtml(report.boardFingerprint)}</footer>
  </main>
  <button class="image-lightbox" id="imageLightbox" type="button" aria-label="关闭卡牌大图"><img alt="卡牌大图"></button>
  <script>
    (() => {
      const cards = [...document.querySelectorAll(".action-card")];
      const sections = [...document.querySelectorAll(".turn-section")];
      const playerSummaries = [...document.querySelectorAll(".round-player-summary, .income-player")];
      const playerFilter = document.querySelector("#playerFilter");
      const familyFilter = document.querySelector("#familyFilter");
      const textFilter = document.querySelector("#textFilter");
      const visibleCount = document.querySelector("#visibleCount");
      const emptyState = document.querySelector("#emptyState");
      const lightbox = document.querySelector("#imageLightbox");
      const lightboxImage = lightbox.querySelector("img");
      const update = () => {
        const player = playerFilter.value;
        const family = familyFilter.value;
        const query = textFilter.value.trim().toLowerCase();
        let visible = 0;
        cards.forEach((card) => {
          const playerMatches = player === "all"
            || card.dataset.player === player
            || (player === "setup" && card.closest(".setup-section"));
          const familyMatches = family === "all" || card.dataset.family === family;
          const textMatches = !query || card.textContent.toLowerCase().includes(query);
          card.classList.toggle("hidden", !(playerMatches && familyMatches && textMatches));
          if (playerMatches && familyMatches && textMatches) visible += 1;
        });
        sections.forEach((section) => {
          section.classList.toggle("hidden", !section.querySelector(".action-card:not(.hidden)"));
        });
        playerSummaries.forEach((summary) => {
          summary.classList.toggle("hidden", player !== "all" && summary.dataset.player !== player);
        });
        visibleCount.textContent = "显示 " + visible + " / ${actionCount} 个行动记录（原始 Policy 决策 ${report.decisionCount}）";
        emptyState.style.display = visible ? "none" : "block";
      };
      playerFilter.addEventListener("change", update);
      familyFilter.addEventListener("change", update);
      textFilter.addEventListener("input", update);
      document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-image-src]");
        if (!trigger) return;
        lightboxImage.src = trigger.dataset.imageSrc;
        lightboxImage.alt = trigger.getAttribute("aria-label") || "卡牌大图";
        lightbox.classList.add("open");
      });
      lightbox.addEventListener("click", () => lightbox.classList.remove("open"));
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") lightbox.classList.remove("open");
      });
    })();
  </script>
</body>
</html>`;
  return html.replace(/[ \t]+$/gm, "");
}

function formatTurnReportMarkdown(report) {
  const lines = [
    `# ${report.boardId} 机器人逐回合行动报告`,
    "",
    `- seed：\`${report.seed}\``,
    `- board fingerprint：\`${report.boardFingerprint}\``,
    `- Policy 决策数：${report.decisionCount}`,
    `- 游戏回合数：${report.turns.length}`,
    "- 决策口径：搜索到本席 PASS 或 15 个次级代理；路线净值 = 实际分数 + 科技 + 后续轮初收入 - 净资源机会成本",
    "- 执行口径：优先执行 V 最高且资源可支付路线的下一步；没有可支付路线时，快速交易、相关打牌或橙色科技只能用于降低该路线真实缺口；每步后从新盘面重算",
    "- 资源口径：钱电只判断完整路线能否支付，不按主行动次数或路径长度扣分；数据仅在真实解锁蓝色痕迹并计分后进入收益",
    "- 诊断目标：初次接触玩家约 100 分；最终表同时列出各机器人的目标差距",
    "- 固定反例：R1 T04 绿色登陆土星按 `land -> choose_target(yellow trace)` 标准链展开；成本、地点奖励、首黄宣传及 alienCard 均取实际 root/leaf 字段，不复制规则常数",
    "- 字段边界：projection 只保留固定上限的探测器目标需求摘要；拓扑、成本、减免与奖励引用均由生产规则 owner 生成，完整 checkpoint 不进入 Policy DTO",
    "",
    "## 开局待决选择",
    "",
  ];
  for (const choice of report.setupChoices) {
    lines.push(`- ${choice.playerLabel}：${choice.text}`);
  }

  lines.push(
    "",
    "## 自动诊断摘要",
    "",
    `- ${report.turns.length} 个玩家回合中，${report.diagnostics.zeroScoreTurnCount} 个回合没有获得分数。`,
    `- ${report.diagnostics.evaluatedDecisionCount} 个已解析的非结束决策中，${report.diagnostics.tiedTopChoiceCount} 个与至少一个备选目标同分，${report.diagnostics.nonPositiveChoiceCount} 个不是正分探测器目标步骤。`,
    `- 实际提交行动族：${Object.entries(report.diagnostics.actionFamilyCounts).map(([family, count]) => `${family}=${count}`).join("，") || "无"}；表格主列均为实际提交，备选列仅为未提交的反事实候选。`,
    `- 性能：路线 checkpoint 上限=${report.diagnostics.performance.routeCheckpointLimit}；每候选平均 ${formatNumber(report.diagnostics.performance.averagePerCandidateMilliseconds)}ms、最大 ${formatNumber(report.diagnostics.performance.maxPerCandidateMilliseconds)}ms；候选集整步最大 ${formatNumber(report.diagnostics.performance.maxDecisionMilliseconds)}ms；2s 为记录目标，10s 仅作实验失控保护。`,
  );
  let currentRound = null;
  for (const turn of report.turns) {
    if (turn.roundNumber !== currentRound) {
      currentRound = turn.roundNumber;
      lines.push("", `## 第 ${currentRound} 轮`, "");
    }
    lines.push(
      `### T${String(turn.turnNumber).padStart(2, "0")} ${turn.playerLabel}`,
      "",
      `- 分数：${turn.scoreBefore} → ${turn.scoreAfter}（${signed(turn.scoreAfter - turn.scoreBefore)}）`,
      `- 持有资源：${formatResourceTransition(turn.resourcesBefore, turn.resourcesAfter)}`,
      "",
      "| # | 实际提交决策 | 探测器目标、缺口、下一步与标准叶来源 | 执行后实际变化 | 未提交反事实前三备选 |",
      "| ---: | --- | --- | --- | --- |",
    );
    turn.actions.forEach((action) => {
      const followups = (action.followups || []).map((followup) => (
        followup.visual?.text
        || String(followup.text || followup.summary || "").replace(/^↳\s*选择：/, "支付/选择：")
      ));
      const movement = action.movement
        ? `实际移动：${action.movement.from} → ${action.movement.to}`
        : "";
      const submitted = [action.text, movement, ...followups].filter(Boolean).join("；");
      lines.push(`| ${action.decisionNumber} | ${markdownCell(submitted)} | ${markdownCell(formatEvaluation(action.value, action.timing))} | ${markdownCell(formatActualDelta(action, action.scoreDelta))} | ${markdownCell(formatAlternatives(action.alternatives))} |`);
    });
  }

  lines.push(
    "",
    "## 各席探测器目标与资源用途",
    "",
    "| 机器人 | 已执行目标 | 最后路线缺口 | 路线下一步 | 探测器实际得分 | 剩余钱/电用途 |",
    "| --- | --- | --- | --- | ---: | --- |",
  );
  report.finalScores.forEach((player) => {
    const lastGoal = player.probeGoals.at(-1) || null;
    const goalNames = [...new Set(player.probeGoals.map((goal) => (
      `${goal.planetId || goal.endpointPlanetId || "未知行星"}/${goal.endpointFamily || goal.endpointKind || "未知终点"}`
    )))].join("、") || "无已解析正分终点";
    const gap = lastGoal
      ? `钱${lastGoal.gap?.credits ?? lastGoal.resourceGap?.credits ?? 0}/电${lastGoal.gap?.energy ?? lastGoal.resourceGap?.energy ?? 0}/移动${lastGoal.gap?.movementSteps ?? lastGoal.resourceGap?.movementSteps ?? 0}`
      : "无";
    const nextStep = lastGoal?.nextStep?.family || lastGoal?.nextActionSummary || lastGoal?.nextActionId || "无";
    const purpose = lastGoal
      ? `钱${player.resources.credits}/电${player.resources.energy}：仅供后续可解析探测器路线补缺`
      : `钱${player.resources.credits}/电${player.resources.energy}：当前无正分探测器终点，库存本身不计 V`;
    lines.push(`| ${player.playerLabel} | ${goalNames} | ${gap} | ${markdownCell(nextStep)} | ${player.actualProbeScore} | ${purpose} |`);
  });

  lines.push("", "## 最终分数、目标差距与剩余资源", "", "| 名次 | 机器人 | 总分 | 实局增长 | 距 100 分 | 钱 | 电 | 宣传 | 数据 | 手牌 | 预留牌 |", "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  report.finalScores.forEach((player, index) => {
    const resources = player.resources;
    lines.push(`| ${index + 1} | ${player.playerLabel} | ${player.finalScore} | ${signed(player.finalScore - player.initialScore)} | ${signed(player.finalScore - 100)} | ${resources.credits} | ${resources.energy} | ${resources.publicity} | ${resources.availableData} | ${resources.handCount} | ${resources.reservedCount} |`);
  });
  lines.push("");
  return lines.join("\n");
}

module.exports = {
  actionText,
  formatEvaluation,
  formatResourceTransition,
  formatTurnReportHtml,
  formatTurnReportMarkdown,
  runFixedBoardTurnReport,
};
