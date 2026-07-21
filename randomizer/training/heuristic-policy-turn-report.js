"use strict";

const {
  FIXED_BOARD_ID,
  FIXED_BOARD_CONFIG,
  fingerprintFixedBoard,
  projectFixedBoard,
} = require("./heuristic-policy.fixed-board");
const { createHeadlessEnv } = require("../app/headless-env");

const FAMILY_VERBS = Object.freeze({
  industry: "执行科技",
  place_data: "放置数据",
  play_card: "打出卡牌",
});

function scoreOf(observation, playerId) {
  const player = observation?.publicState?.players?.find((candidate) => candidate.playerId === playerId);
  return Number(player?.finalScore ?? player?.score ?? 0);
}

function actionText(action) {
  const summary = String(action?.summary || action?.family || "未知行动");
  if (action?.decisionType === "conditional_choice") return `↳ 选择：${summary}`;
  if (action?.family === "end_turn") return null;
  const verb = FAMILY_VERBS[action?.family];
  if (!verb || verb === summary || (verb === "PASS" && summary === "PASS")) return summary;
  return `${verb}：${summary}`;
}

function runFixedBoardTurnReport(options = {}) {
  const env = createHeadlessEnv();
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
      const record = {
        decisionNumber: decisionCount,
        actorPlayerId,
        playerLabel: playerLabels[actorPlayerId] || actorPlayerId,
        decisionType: chosen.decisionType,
        family: chosen.family,
        summary: chosen.summary,
        text: actionText(chosen),
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
          actions: [],
        };
        turns.push(activeTurn);
      }
      activeTurn.actions.push(record);
      activeTurn.scoreAfter = scoreOf(result.observation, actorPlayerId);
    }

    if (!env.isTerminal()) throw new Error(`固定版面在 ${maxDecisions} 次决策内未结束`);
    const terminal = env.observe();
    const finalScores = terminal.publicState.players
      .map((player) => ({
        playerId: player.playerId,
        playerLabel: player.playerLabel,
        finalScore: Number(player.finalScore ?? player.score ?? 0),
        scoreSources: { ...(player.scoreSources || {}) },
      }))
      .sort((left, right) => right.finalScore - left.finalScore);

    return {
      schemaVersion: "seti-heuristic-turn-report-v1",
      boardId: FIXED_BOARD_ID,
      seed: FIXED_BOARD_CONFIG.seed,
      boardFingerprint: fingerprintFixedBoard(projectFixedBoard(initialObservation)),
      decisionCount,
      setupChoices,
      turns,
      finalScores,
    };
  } finally {
    env.dispose();
  }
}

function formatTurnReportMarkdown(report) {
  const lines = [
    `# ${report.boardId} 机器人逐回合行动报告`,
    "",
    `- seed：\`${report.seed}\``,
    `- board fingerprint：\`${report.boardFingerprint}\``,
    `- Policy 决策数：${report.decisionCount}`,
    `- 游戏回合数：${report.turns.length}`,
    "",
    "## 开局待决选择",
    "",
  ];
  for (const choice of report.setupChoices) {
    lines.push(`- ${choice.playerLabel}：${choice.text}`);
  }

  let currentRound = null;
  for (const turn of report.turns) {
    if (turn.roundNumber !== currentRound) {
      currentRound = turn.roundNumber;
      lines.push("", `## 第 ${currentRound} 轮`, "");
    }
    const actions = turn.actions.map((action) => action.text).filter(Boolean);
    lines.push(
      `- T${String(turn.turnNumber).padStart(2, "0")} ${turn.playerLabel}｜分数 ${turn.scoreBefore} → ${turn.scoreAfter}｜${actions.join("；") || "结束回合"}`,
    );
  }

  lines.push("", "## 最终分数", "", "| 名次 | 机器人 | 总分 |", "| ---: | --- | ---: |");
  report.finalScores.forEach((player, index) => {
    lines.push(`| ${index + 1} | ${player.playerLabel} | ${player.finalScore} |`);
  });
  lines.push("");
  return lines.join("\n");
}

module.exports = {
  actionText,
  formatTurnReportMarkdown,
  runFixedBoardTurnReport,
};
