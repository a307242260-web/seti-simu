"use strict";

const {
  FIXED_BOARD_ID,
  FIXED_BOARD_CONFIG,
  fingerprintFixedBoard,
  projectFixedBoard,
} = require("./heuristic-policy.fixed-board");
const { createSimulationEnv } = require("../app/simulation-env");
const expectedScoreEvaluator = require("../game/ai/expected-score-evaluator");

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
  ["reservedCount", "预留牌"],
]);

function resourcesOf(observation, playerId) {
  const player = observation?.publicState?.players?.find((candidate) => candidate.playerId === playerId) || {};
  return Object.freeze(Object.fromEntries(RESOURCE_FIELDS.map(([key]) => [key, Number(player[key] || 0)])));
}

function resourceDelta(before, after) {
  return Object.freeze(Object.fromEntries(RESOURCE_FIELDS.map(([key]) => [key, after[key] - before[key]])));
}

function buildDiagnostics(turns) {
  const evaluated = turns.flatMap((turn) => turn.actions.map((action) => ({ turn, action })))
    .filter(({ action }) => action.value && action.family !== "end_turn");
  const tiedTopChoices = evaluated.filter(({ action }) => (
    action.alternatives.some((alternative) => Math.abs(alternative.score - action.value.score) < 1e-9)
  ));
  const nonPositiveChoices = evaluated.filter(({ action }) => action.value.score <= 0);
  const optimisticScoreMisses = evaluated
    .filter(({ action }) => (
      Number(action.value.evaluation.leafValue?.realizedScore || 0)
      - Number(action.value.evaluation.rootValue?.realizedScore || 0)
    ) > action.scoreDelta)
    .map(({ turn, action }) => ({
      roundNumber: turn.roundNumber,
      turnNumber: turn.turnNumber,
      playerLabel: turn.playerLabel,
      decisionNumber: action.decisionNumber,
      action: action.text,
      expectedImmediateScore: Number(action.value.evaluation.leafValue?.realizedScore || 0)
        - Number(action.value.evaluation.rootValue?.realizedScore || 0),
      actualScoreDelta: action.scoreDelta,
    }))
    .sort((left, right) => (
      (right.expectedImmediateScore - right.actualScoreDelta)
      - (left.expectedImmediateScore - left.actualScoreDelta)
    ));
  return Object.freeze({
    evaluatedDecisionCount: evaluated.length,
    tiedTopChoiceCount: tiedTopChoices.length,
    nonPositiveChoiceCount: nonPositiveChoices.length,
    zeroScoreTurnCount: turns.filter((turn) => turn.scoreAfter === turn.scoreBefore).length,
    optimisticScoreMisses,
  });
}

function isObservationFeasible(observation, actorPlayerId, action) {
  const isMoveLike = action.family === "move"
    || (action.family === "card_corner" && action.payload?.actionKind === "move");
  if (!isMoveLike) return true;
  const rockets = observation?.publicState?.board?.rockets;
  if (!Array.isArray(rockets)) return true;
  return rockets.some((rocket) => rocket?.playerId === actorPlayerId && rocket?.surface === "solar-board");
}

function evaluateLegalActions(observation, legalActions, actionOutcomes, actorPlayerId, provenance) {
  const parameters = provenance?.config?.evaluationParameters || {};
  return legalActions.map((action) => ({ action }))
    .filter(({ action }) => isObservationFeasible(observation, actorPlayerId, action))
    .map(({ action }) => {
    const evaluation = expectedScoreEvaluator.evaluateAction(
      { observation, actionOutcomes, seatId: actorPlayerId },
      action,
      parameters,
    );
    return Object.freeze({
      actionId: action.actionId,
      summary: actionText(action) || "结束回合",
      score: evaluation.score,
      evaluation,
    });
  }).sort((left, right) => (
    Number(right.score ?? -Infinity) - Number(left.score ?? -Infinity)
    || left.actionId.localeCompare(right.actionId)
  ));
}

function actionText(action) {
  const summary = String(action?.summary || action?.family || "未知行动");
  if (action?.decisionType === "conditional_choice") return `↳ 选择：${summary}`;
  if (action?.family === "end_turn") return "结束回合";
  const verb = FAMILY_VERBS[action?.family];
  if (!verb || verb === summary || (verb === "PASS" && summary === "PASS")) return summary;
  return `${verb}：${summary}`;
}

function runFixedBoardTurnReport(options = {}) {
  const env = createSimulationEnv();
  const maxDecisions = options.maxDecisions || 2000;
  try {
    const initialObservation = env.reset({ ...FIXED_BOARD_CONFIG, ...(options.config || {}) });
    const playerLabels = Object.fromEntries(
      initialObservation.publicState.players.map((player) => [player.playerId, player.playerLabel]),
    );
    const setupChoices = [];
    const turns = [];
    let activeTurn = null;
    let reachedTurnActions = false;
    let decisionCount = 0;

    while (!env.isTerminal() && decisionCount < maxDecisions) {
      const before = env.observe();
      const legalActions = env.legalActions();
      const result = env.runHeuristicPolicyDecision();
      const chosen = legalActions.find((action) => action.actionId === result.policyDecision.actionId);
      if (!chosen) throw new Error(`无法还原第 ${decisionCount + 1} 个 PolicyDecision`);
      decisionCount += 1;

      const actorPlayerId = chosen.actorPlayerId || before.decision?.actorPlayerId;
      const resourcesBefore = resourcesOf(before, actorPlayerId);
      const resourcesAfter = resourcesOf(result.observation, actorPlayerId);
      const valuationStartedAt = performance.now();
      const rankedEvaluations = evaluateLegalActions(
        before,
        legalActions,
        result.actionOutcomes,
        actorPlayerId,
        result.policyProvenance,
      );
      const valuationMilliseconds = performance.now() - valuationStartedAt;
      const chosenEvaluation = rankedEvaluations.find((candidate) => candidate.actionId === chosen.actionId) || null;
      const record = {
        decisionNumber: decisionCount,
        actorPlayerId,
        playerLabel: playerLabels[actorPlayerId] || actorPlayerId,
        decisionType: chosen.decisionType,
        family: chosen.family,
        summary: chosen.summary,
        text: actionText(chosen),
        value: chosenEvaluation,
        alternatives: rankedEvaluations.filter((candidate) => candidate.actionId !== chosen.actionId).slice(0, 3),
        resourcesBefore,
        resourcesAfter,
        resourceDelta: resourceDelta(resourcesBefore, resourcesAfter),
        scoreBefore: scoreOf(before, actorPlayerId),
        scoreAfter: scoreOf(result.observation, actorPlayerId),
        scoreDelta: scoreOf(result.observation, actorPlayerId) - scoreOf(before, actorPlayerId),
        timing: {
          ...(env.getCounterfactualDiagnostics() || {}),
          valuationMilliseconds,
        },
      };

      if (!reachedTurnActions && chosen.decisionType === "conditional_choice") {
        setupChoices.push(record);
        continue;
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
          actions: [],
        };
        turns.push(activeTurn);
      }
      activeTurn.actions.push(record);
      activeTurn.scoreAfter = scoreOf(result.observation, actorPlayerId);
      activeTurn.resourcesAfter = resourcesAfter;
    }

    if (!env.isTerminal()) throw new Error(`固定版面在 ${maxDecisions} 次决策内未结束`);
    const terminal = env.observe();
    const finalScores = terminal.publicState.players
      .map((player) => ({
        playerId: player.playerId,
        playerLabel: player.playerLabel,
        finalScore: Number(player.finalScore ?? player.score ?? 0),
        scoreSources: { ...(player.scoreSources || {}) },
        resources: resourcesOf(terminal, player.playerId),
      }))
      .sort((left, right) => right.finalScore - left.finalScore);

    return {
      schemaVersion: "seti-heuristic-turn-report-v3",
      boardId: FIXED_BOARD_ID,
      seed: FIXED_BOARD_CONFIG.seed,
      boardFingerprint: fingerprintFixedBoard(projectFixedBoard(initialObservation)),
      decisionCount,
      setupChoices,
      turns,
      finalScores,
      diagnostics: buildDiagnostics(turns),
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
    return `状态=${evaluation.status}；置信=${evaluation.confidence}；${evaluation.reasonCodes.join(",")}`;
  }
  const root = evaluation.rootValue;
  const leaf = evaluation.leafValue;
  const parts = [
    `Q=${formatNumber(candidate.score)}`,
    `状态=${evaluation.status}/${evaluation.confidence}`,
    `根(分${formatNumber(root?.realizedScore)}+资产${formatNumber(root?.unrealizedAssets)})`,
    `叶(分${formatNumber(leaf?.realizedScore)}+资产${formatNumber(leaf?.unrealizedAssets)})`,
    `链=${(evaluation.actionChain || []).join("→") || "—"}`,
    `依据=${evaluation.reasonCodes.join(",")}`,
  ];
  if (timing) {
    parts.push(
      `耗时 fork ${formatNumber(timing.forkMilliseconds)}ms`
      + `/执行 ${formatNumber(timing.executionMilliseconds)}ms`
      + `/投影 ${formatNumber(timing.projectionMilliseconds)}ms`
      + `/估值 ${formatNumber(timing.valuationMilliseconds)}ms`,
    );
  }
  return parts.join("；");
}

function formatAlternatives(alternatives) {
  if (!alternatives.length) return "—";
  return alternatives.map((candidate) => `${candidate.summary} (${formatNumber(candidate.score)})`).join("；");
}

function markdownCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function formatTurnReportMarkdown(report) {
  const lines = [
    `# ${report.boardId} 机器人逐回合行动报告`,
    "",
    `- seed：\`${report.seed}\``,
    `- board fingerprint：\`${report.boardFingerprint}\``,
    `- Policy 决策数：${report.decisionCount}`,
    `- 游戏回合数：${report.turns.length}`,
    "- 价值口径：`Q` 只读取同一 Rule Composition/Standard Action/Effect Session/Decision/commit 链真实执行后的叶状态；已兑现分 1:1，未兑现资产使用 θ₀",
    "- 诊断目标：初次接触玩家约 100 分；最终表同时列出各机器人的目标差距",
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
    `- ${report.diagnostics.evaluatedDecisionCount} 个可计算 Q 的非结束决策中，${report.diagnostics.tiedTopChoiceCount} 个与至少一个备选动作同分，${report.diagnostics.nonPositiveChoiceCount} 个选中动作的 Q 不大于 0；这两项可直接定位估值区分度不足。`,
  );
  if (report.diagnostics.optimisticScoreMisses.length) {
    lines.push(
      `- 有 ${report.diagnostics.optimisticScoreMisses.length} 个动作被模型计入即时得分，但执行后的玩家分数没有同步增加；优先检查以下落差：`,
      "",
      "| 决策 | 动作 | 估值即时分 | 实际分数变化 |",
      "| --- | --- | ---: | ---: |",
    );
    report.diagnostics.optimisticScoreMisses.slice(0, 10).forEach((item) => {
      lines.push(`| R${item.roundNumber} T${String(item.turnNumber).padStart(2, "0")} ${item.playerLabel} #${item.decisionNumber} | ${markdownCell(item.action)} | ${signed(item.expectedImmediateScore)} | ${signed(item.actualScoreDelta)} |`);
    });
  }

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
      "| # | 决策 | 价值评估 | 执行后实际变化 | 同时可选的高价值备选 |",
      "| ---: | --- | --- | --- | --- |",
    );
    turn.actions.forEach((action) => {
      lines.push(`| ${action.decisionNumber} | ${markdownCell(action.text)} | ${markdownCell(formatEvaluation(action.value, action.timing))} | ${markdownCell(formatActualDelta(action, action.scoreDelta))} | ${markdownCell(formatAlternatives(action.alternatives))} |`);
    });
  }

  lines.push("", "## 最终分数、目标差距与剩余资源", "", "| 名次 | 机器人 | 总分 | 距 100 分 | 钱 | 电 | 宣传 | 数据 | 手牌 | 预留牌 |", "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  report.finalScores.forEach((player, index) => {
    const resources = player.resources;
    lines.push(`| ${index + 1} | ${player.playerLabel} | ${player.finalScore} | ${signed(player.finalScore - 100)} | ${resources.credits} | ${resources.energy} | ${resources.publicity} | ${resources.availableData} | ${resources.handCount} | ${resources.reservedCount} |`);
  });
  lines.push("");
  return lines.join("\n");
}

module.exports = {
  actionText,
  formatEvaluation,
  formatResourceTransition,
  formatTurnReportMarkdown,
  runFixedBoardTurnReport,
};
