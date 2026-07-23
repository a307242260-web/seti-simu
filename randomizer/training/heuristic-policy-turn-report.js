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
  const timed = turns.flatMap((turn) => turn.actions)
    .filter((action) => Number(action.timing?.candidateCount) > 0);
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
    actionFamilyCounts: Object.freeze(Object.fromEntries(
      [...evaluated, ...turns.flatMap((turn) => turn.actions
        .filter((action) => action.family === "end_turn")
        .map((action) => ({ action })))]
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
      routeCheckpointLimit: 6,
    }),
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
    const initialScores = Object.fromEntries(
      initialObservation.publicState.players.map((player) => [player.playerId, Number(player.score) || 0]),
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
      const counterfactualTiming = env.getCounterfactualDiagnostics() || {};
      if (Number(counterfactualTiming.totalMilliseconds) > 1000) {
        throw new Error(`fixed-board 单次决策 ${counterfactualTiming.totalMilliseconds}ms 超过 1s 门禁`);
      }
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
          ...counterfactualTiming,
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
        initialScore: initialScores[player.playerId] || 0,
        finalScore: Number(player.finalScore ?? player.score ?? 0),
        scoreSources: { ...(player.scoreSources || {}) },
        resources: resourcesOf(terminal, player.playerId),
      }))
      .sort((left, right) => right.finalScore - left.finalScore);

    const diagnostics = buildDiagnostics(turns);
    return {
      schemaVersion: "seti-heuristic-turn-report-v3",
      boardId: FIXED_BOARD_ID,
      seed: FIXED_BOARD_CONFIG.seed,
      boardFingerprint: fingerprintFixedBoard(projectFixedBoard(initialObservation)),
      decisionCount,
      setupChoices,
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
    return `状态=${evaluation.status}；置信=${evaluation.confidence}；${evaluation.reasonCodes.join(",")}`;
  }
  const root = evaluation.rootValue;
  const leaf = evaluation.leafValue;
  const parts = [
    `Vroot=${formatNumber(root?.total)}`,
    `当前动作实际delta=${formatNumber(evaluation.currentActionDelta)}`,
    `剩余路线净收益=${formatNumber(evaluation.remainingRouteNet)}`,
    `Q_probe=${evaluation.qProbe == null ? "—" : formatNumber(evaluation.qProbe)}`,
    `排序Q=${formatNumber(candidate.score)}`,
    `状态=${evaluation.status}/${evaluation.confidence}`,
    `Vleaf=${formatNumber(leaf?.total)}`,
    `沿途宣传=${formatNumber(evaluation.publicityAlongRoute)}@${(evaluation.probeRouteSummary?.publicityOutcomeRefs || []).join("→") || "无"}`,
    `终点即时=${evaluation.probeRouteSummary?.endpointActionId || "无"}@${JSON.stringify(evaluation.endpointDelta || {})}`,
    `链=${(evaluation.actionChain || []).join("→") || "—"}`,
    "字段=outcomeProjection.scoring/assets/progress.probeRoute.candidate",
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
    "- 价值口径：本阶段只实现探测器路线；`Q_probe=当前动作真实标准结算价值+同一路线剩余真实净收益`，不按路线长度折价，不给 PASS/无关动作挂路线值",
    "- 诊断目标：初次接触玩家约 100 分；最终表同时列出各机器人的目标差距",
    "- 固定反例：R1 T04 绿色登陆土星按 `land -> choose_target(yellow trace)` 标准链展开；成本、地点奖励、首黄宣传及 alienCard 均取实际 root/leaf 字段，不复制规则常数",
    "- 字段边界：projection 只保留最多两枚探测器位置和当前候选的 next action、沿途宣传、终点 outcome 引用及标准 delta；完整 checkpoint 不进入 Policy DTO",
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
    `- 实际提交行动族：${Object.entries(report.diagnostics.actionFamilyCounts).map(([family, count]) => `${family}=${count}`).join("，") || "无"}；表格主列均为实际提交，备选列仅为未提交的反事实候选。`,
    `- 性能：路线 checkpoint 上限=${report.diagnostics.performance.routeCheckpointLimit}；每候选平均 ${formatNumber(report.diagnostics.performance.averagePerCandidateMilliseconds)}ms、最大 ${formatNumber(report.diagnostics.performance.maxPerCandidateMilliseconds)}ms；候选集整步最大 ${formatNumber(report.diagnostics.performance.maxDecisionMilliseconds)}ms，超过 1s 会立即中止整局。`,
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
      "| # | 实际提交决策 | V(root)→V(leaf) 与字段级 Q | 执行后实际变化 | 未提交反事实前三备选 |",
      "| ---: | --- | --- | --- | --- |",
    );
    turn.actions.forEach((action) => {
      lines.push(`| ${action.decisionNumber} | ${markdownCell(action.text)} | ${markdownCell(formatEvaluation(action.value, action.timing))} | ${markdownCell(formatActualDelta(action, action.scoreDelta))} | ${markdownCell(formatAlternatives(action.alternatives))} |`);
    });
  }

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
  formatTurnReportMarkdown,
  runFixedBoardTurnReport,
};
