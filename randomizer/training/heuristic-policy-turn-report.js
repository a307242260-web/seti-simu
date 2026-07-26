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
      routeCheckpointLimit: 10,
    }),
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
  return legalActions.map((action) => ({ action }))
    .filter(({ action }) => isObservationFeasible(observation, actorPlayerId, action))
    .map(({ action }) => {
    const evaluableAction = {
      ...action,
      phase: action.actionFeature?.phase
        || (action.decisionType === "conditional_choice" ? "conditional" : "main"),
    };
    const evaluation = expectedScoreEvaluator.evaluateAction(
      { observation, actionOutcomes, seatId: actorPlayerId },
      evaluableAction,
    );
    return Object.freeze({
      actionId: action.actionId,
      summary: actionText(action) || "结束回合",
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
        throw new Error(
          `fixed-board 第${decisionCount}次 ${chosen.family}/${chosen.actionId} `
          + `单次决策 ${counterfactualTiming.totalMilliseconds}ms 超过 1s 门禁`,
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
      schemaVersion: "seti-heuristic-turn-report-v5",
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
    return `不可选；状态=${evaluation.status}；置信=${evaluation.confidence}；${evaluation.reasonCodes.join(",")}`;
  }
  const route = evaluation.probeRouteSummary;
  const goal = evaluation.probeGoalRequirement || null;
  const gap = goal?.gap || route?.resourceGap || null;
  const required = goal?.required || route?.routeCost || null;
  const parts = [
    `V=${formatNumber(evaluation.value ?? evaluation.score)}`,
    goal
      ? `目标=${goal.planetId}/${goal.endpointFamily}`
      : route
      ? `目标=${route.endpointPlanetId || "未知行星"}/${route.endpointKind || "未知终点"}`
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
  const goal = evaluation?.probeGoalRequirement;
  const route = evaluation?.probeRouteSummary;
  if (goal) return `${goal.planetId}/${goal.endpointFamily}`;
  if (route) return `${route.endpointPlanetId || "未知行星"}/${route.endpointKind || "未知终点"}`;
  if (evaluation?.orangeTechDelta > 0) return `橙色科技 +${evaluation.orangeTechDelta}`;
  return "无探测器目标";
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
        <small>选择价值 V</small>
        <strong>${evaluation?.score == null ? "—" : escapeHtml(formatNumber(evaluation.value ?? evaluation.score))}</strong>
      </div>
    </div>
    <div class="resource-strip" aria-label="行动前后资源">${renderResourceStrip(action.resourcesBefore, action.resourcesAfter)}</div>
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
        <span>路线终点实际分</span>
        <strong>${escapeHtml(formatNumber(evaluation?.goalScoreGain))}</strong>
      </div>
      <div class="decision-cell">
        <span>沿途宣传</span>
        <strong>${escapeHtml(formatNumber(route?.publicityAlongRoute))}</strong>
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
      <div class="action-list">${report.setupChoices.map(renderActionCard).join("")}</div>
    </section>`
    : "";
  return `<!doctype html>
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
    .turn-section { margin: 18px 0; padding: 20px; border: 1px solid var(--line); border-radius: 20px; background: rgba(17, 24, 42, .78); box-shadow: var(--shadow); }
    .turn-heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 14px; }
    .turn-heading h3 { margin: 3px 0 0; font-size: 23px; }
    .turn-score { display: grid; grid-template-columns: auto auto auto; gap: 10px; align-items: baseline; }
    .turn-score span { color: var(--muted); font-size: 12px; }
    .turn-score strong { font-size: 18px; }
    .resource-strip, .turn-resource-summary { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
    .turn-resource-summary { margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--line); }
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
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="hero">
      <div>
        <span class="eyebrow">SETI · Heuristic Policy Trace</span>
        <h1>机器人逐决策行动报告</h1>
        <p>每一步均取自实际标准行动执行：先展示行动时持有资源，再展示机器人选择、路线价值 V、实际资源与分数收益，并保留未提交的候选供诊断。</p>
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
      <span class="visible-count" id="visibleCount">显示 ${actionCount} / ${actionCount} 个决策</span>
    </nav>

    <div id="reportBody">
      ${setupSection}
      ${report.turns.map(renderTurnSection).join("")}
    </div>
    <div class="empty-state" id="emptyState">没有符合当前筛选条件的决策。</div>
    <footer>${escapeHtml(report.schemaVersion)} · ${escapeHtml(report.boardId)} · fingerprint ${escapeHtml(report.boardFingerprint)}</footer>
  </main>
  <script>
    (() => {
      const cards = [...document.querySelectorAll(".action-card")];
      const sections = [...document.querySelectorAll(".turn-section")];
      const playerFilter = document.querySelector("#playerFilter");
      const familyFilter = document.querySelector("#familyFilter");
      const textFilter = document.querySelector("#textFilter");
      const visibleCount = document.querySelector("#visibleCount");
      const emptyState = document.querySelector("#emptyState");
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
        visibleCount.textContent = "显示 " + visible + " / ${actionCount} 个决策";
        emptyState.style.display = visible ? "none" : "block";
      };
      playerFilter.addEventListener("change", update);
      familyFilter.addEventListener("change", update);
      textFilter.addEventListener("input", update);
    })();
  </script>
</body>
</html>`;
}

function formatTurnReportMarkdown(report) {
  const lines = [
    `# ${report.boardId} 机器人逐回合行动报告`,
    "",
    `- seed：\`${report.seed}\``,
    `- board fingerprint：\`${report.boardFingerprint}\``,
    `- Policy 决策数：${report.decisionCount}`,
    `- 游戏回合数：${report.turns.length}`,
    "- 决策口径：枚举每枚探测器到所有可用行星的最短路线，同移动消耗优先沿途宣传最高者；V 是该路线沿途宣传与环绕/登陆实际收益的等价分",
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
    `- 性能：路线 checkpoint 上限=${report.diagnostics.performance.routeCheckpointLimit}；每候选平均 ${formatNumber(report.diagnostics.performance.averagePerCandidateMilliseconds)}ms、最大 ${formatNumber(report.diagnostics.performance.maxPerCandidateMilliseconds)}ms；候选集整步最大 ${formatNumber(report.diagnostics.performance.maxDecisionMilliseconds)}ms，超过 1s 会立即中止整局。`,
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
      lines.push(`| ${action.decisionNumber} | ${markdownCell(action.text)} | ${markdownCell(formatEvaluation(action.value, action.timing))} | ${markdownCell(formatActualDelta(action, action.scoreDelta))} | ${markdownCell(formatAlternatives(action.alternatives))} |`);
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
