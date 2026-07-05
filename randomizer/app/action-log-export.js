(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppActionLogExport = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SOURCE_LABELS = Object.freeze({
    main: "main",
    quick: "quick",
    setup: "setup",
  });

  function normalizeText(value, fallback = "") {
    const text = String(value ?? "")
      .replace(/\r?\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text || fallback;
  }

  function normalizeCellText(value, fallback = "") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function markdownTableCell(value) {
    return String(value ?? "")
      .replace(/\r?\n/g, "<br>")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\|/g, "\\|");
  }

  function numberValue(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function formatNumber(value) {
    const number = numberValue(value, 0);
    if (Number.isInteger(number)) return String(number);
    return String(Math.round(number * 100) / 100);
  }

  function sumTileScores(tileScoresById = {}) {
    return Object.values(tileScoresById || {}).reduce((total, value) => total + numberValue(value), 0);
  }

  function countOwnedTech(player = {}) {
    const ownedTiles = player?.techState?.ownedTiles || {};
    return Object.values(ownedTiles).reduce((total, value) => {
      if (Array.isArray(value)) return total + value.length;
      return total + (value ? 1 : 0);
    }, 0);
  }

  function normalizePlayerResult(result = {}, context = {}) {
    const player = result.player || {};
    const breakdown = result.breakdown || result.finalScoreBreakdown || {};
    const tileScoresById = breakdown.tileScoresById || result.tileScoresById || {};
    const playerId = result.playerId || player.id || null;
    const passedIds = new Set(context.turnState?.passedPlayerIds || context.passedPlayerIds || []);
    return {
      playerId,
      playerLabel: normalizeCellText(
        result.playerLabel || player.colorLabel || player.name || player.id,
        "未知玩家",
      ),
      totalScore: numberValue(breakdown.totalScore ?? result.finalScore ?? result.totalScore),
      baseScore: numberValue(breakdown.baseScore ?? result.baseScore ?? player.resources?.score),
      tileScore: numberValue(breakdown.tileScore ?? result.tileScore ?? sumTileScores(tileScoresById)),
      cardScore: numberValue(breakdown.cardScore ?? result.cardScore),
      jiuzheCardScore: numberValue(breakdown.jiuzheCardScore ?? result.jiuzheCardScore),
      jiuzhePenaltyScore: numberValue(breakdown.jiuzhePenaltyScore ?? result.jiuzhePenaltyScore),
      runezuSymbolScore: numberValue(breakdown.runezuSymbolScore ?? result.runezuSymbolScore),
      completedTaskCount: numberValue(result.completedTaskCount ?? player.completedTaskCount),
      techCount: numberValue(result.techCount ?? countOwnedTech(player)),
      passed: Boolean(result.passed ?? player.passed ?? (playerId && passedIds.has(playerId))),
    };
  }

  function normalizePlayerResults(context = {}) {
    const results = Array.isArray(context.playerResults)
      ? context.playerResults
      : Array.isArray(context.finalResults)
        ? context.finalResults
        : [];
    return results.map((result) => normalizePlayerResult(result, context));
  }

  function getEntryPlayerLabel(entry = {}) {
    return normalizeText(entry.playerLabel || entry.playerId, "未知玩家");
  }

  function getEntryActionLabel(entry = {}) {
    return normalizeText(entry.actionLabel || entry.actionType || "本回合行动", "本回合行动");
  }

  function getEntryTitle(entry = {}) {
    if (entry.title) return normalizeText(entry.title);
    if (entry.roundNumber != null && entry.turnNumber != null) {
      return `第${entry.roundNumber}轮 第${entry.turnNumber}回合`;
    }
    if (entry.roundNumber != null) return `第${entry.roundNumber}轮`;
    return "行动记录";
  }

  function getRouteKey(entry = {}) {
    return entry.playerId || entry.playerLabel || "unknown";
  }

  function ensureRouteSummary(map, entry = {}, playerResult = null) {
    const key = playerResult?.playerId || getRouteKey(entry);
    if (!map[key]) {
      map[key] = {
        playerId: playerResult?.playerId || entry.playerId || null,
        playerLabel: playerResult?.playerLabel || getEntryPlayerLabel(entry),
        mainActions: [],
        mainActionCount: 0,
        quickStepCount: 0,
        passRounds: [],
      };
    }
    return map[key];
  }

  function buildRouteSummaries(entries = [], playerResults = []) {
    const routeMap = {};
    for (const result of playerResults) {
      ensureRouteSummary(routeMap, {}, result);
    }

    for (const entry of entries || []) {
      const summary = ensureRouteSummary(routeMap, entry);
      const actionType = normalizeText(entry.actionType);
      const isInitial = actionType === "initialSelection";
      const isQuickOnly = actionType === "quick";
      const isPass = actionType === "pass" || entry.passed;

      if (!isInitial && !isQuickOnly) {
        summary.mainActionCount += 1;
        summary.mainActions.push(isPass ? "PASS" : getEntryActionLabel(entry));
      }
      if (isPass && entry.roundNumber != null) {
        const roundLabel = `R${entry.roundNumber}`;
        if (!summary.passRounds.includes(roundLabel)) summary.passRounds.push(roundLabel);
      }

      const steps = Array.isArray(entry.steps) ? entry.steps : [];
      const quickSteps = steps.filter((step) => step?.source === "quick").length;
      summary.quickStepCount += quickSteps || (isQuickOnly ? 1 : 0);
    }

    return Object.values(routeMap);
  }

  function getGeneratedAtText(context = {}, options = {}) {
    const date = options.generatedAt || context.generatedAt || new Date();
    const parsed = date instanceof Date ? date : new Date(date);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  function buildMetadataSection(context = {}, entries = [], options = {}) {
    const gameEnded = Boolean(context.isGameEnded ?? context.gameEnded);
    const roundNumber = context.roundNumber ?? context.turnState?.roundNumber ?? "-";
    const turnNumber = context.turnNumber ?? context.displayedTurnNumber ?? context.turnState?.turnNumber ?? "-";
    return [
      "## 游戏元信息",
      "",
      `- 生成时间：${getGeneratedAtText(context, options)}`,
      `- 游戏状态：${gameEnded ? "已结束" : "未结束"}`,
      `- 结束原因：${normalizeText(context.gameEndReason || context.turnState?.gameEndReason, "无")}`,
      `- 轮次/回合：第 ${roundNumber} 轮 / 第 ${turnNumber} 回合`,
      `- 日志条数：${entries.length}`,
      "",
    ];
  }

  function buildFinalScoreSection(playerResults = []) {
    const lines = ["## 终局分数", ""];
    if (!playerResults.length) {
      lines.push("暂无终局分数。", "");
      return lines;
    }

    const maxScore = Math.max(...playerResults.map((result) => numberValue(result.totalScore)), -Infinity);
    const extraScoreColumns = [
      { key: "jiuzheCardScore", label: "九折分" },
      { key: "jiuzhePenaltyScore", label: "九折修正" },
      { key: "runezuSymbolScore", label: "符文族分" },
    ].filter((column) => playerResults.some((result) => numberValue(result[column.key]) !== 0));
    const headers = [
      "玩家",
      "总分",
      "基础分",
      "板块分",
      "卡牌分",
      ...extraScoreColumns.map((column) => column.label),
      "任务数",
      "科技数",
      "PASS",
      "最高分",
    ];
    const alignments = headers.map((header, index) => {
      if (index === 0) return "---";
      return header === "PASS" || header === "最高分" ? "---" : "---:";
    });
    lines.push(`| ${headers.join(" | ")} |`);
    lines.push(`| ${alignments.join(" | ")} |`);
    for (const result of playerResults) {
      const isWinner = numberValue(result.totalScore) === maxScore;
      const row = [
        markdownTableCell(result.playerLabel),
        formatNumber(result.totalScore),
        formatNumber(result.baseScore),
        formatNumber(result.tileScore),
        formatNumber(result.cardScore),
        ...extraScoreColumns.map((column) => formatNumber(result[column.key])),
        formatNumber(result.completedTaskCount),
        formatNumber(result.techCount),
        result.passed ? "是" : "否",
        isWinner ? "是" : "",
      ];
      lines.push(row.join(" | ").replace(/^/, "| ").replace(/$/, " |"));
    }
    lines.push("");
    return lines;
  }

  function buildRouteSummarySection(routeSummaries = []) {
    const lines = ["## 路线摘要", ""];
    if (!routeSummaries.length) {
      lines.push("暂无路线摘要。", "");
      return lines;
    }

    lines.push("| 玩家 | 主要行动路线 | 主要行动数 | 快速步骤数 | PASS 轮次 |");
    lines.push("| --- | --- | ---: | ---: | --- |");
    for (const summary of routeSummaries) {
      lines.push([
        markdownTableCell(summary.playerLabel),
        markdownTableCell(summary.mainActions.length ? summary.mainActions.join(" -> ") : "无"),
        formatNumber(summary.mainActionCount),
        formatNumber(summary.quickStepCount),
        markdownTableCell(summary.passRounds.length ? summary.passRounds.join("、") : "无"),
      ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
    }
    lines.push("");
    return lines;
  }

  function formatStepLine(step = {}) {
    const source = SOURCE_LABELS[step.source] || normalizeText(step.source, "main");
    const extras = [];
    if (step.irreversibleReason) extras.push(`不可撤销：${normalizeText(step.irreversibleReason)}`);
    if (step.playedCard?.label) extras.push(`卡牌：${normalizeText(step.playedCard.label)}`);
    const suffix = extras.length ? `；${extras.join("；")}` : "";
    return `- [${source}] ${normalizeText(step.text || step.label || step.detail, "行动效果")}${suffix}`;
  }

  function buildActionTimelineSection(entries = []) {
    const lines = ["## 完整行动流水", ""];
    if (!entries.length) {
      lines.push("暂无行动日志。", "");
      return lines;
    }

    for (const entry of entries) {
      const id = entry.id ?? "?";
      lines.push(`### #${id} ${getEntryTitle(entry)} - ${getEntryPlayerLabel(entry)} - ${getEntryActionLabel(entry)}`);
      if (entry.passed) lines.push("- 状态：PASS");
      const steps = Array.isArray(entry.steps) ? entry.steps : [];
      if (!steps.length) {
        lines.push("- （无步骤记录）");
      } else {
        for (const step of steps) {
          lines.push(formatStepLine(step));
        }
      }
      lines.push("");
    }
    return lines;
  }

  function buildActionLogMarkdown(context = {}, options = {}) {
    const entries = Array.isArray(context.entries) ? context.entries : [];
    const playerResults = normalizePlayerResults(context);
    const routeSummaries = buildRouteSummaries(entries, playerResults);
    const lines = [
      "# SETI 行动日志",
      "",
      ...buildMetadataSection(context, entries, options),
      ...buildFinalScoreSection(playerResults),
      ...buildRouteSummarySection(routeSummaries),
      ...buildActionTimelineSection(entries),
    ];
    return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
  }

  function pad(value) {
    return String(Math.max(0, Math.floor(Number(value) || 0))).padStart(2, "0");
  }

  function normalizeDate(date = new Date()) {
    const parsed = date instanceof Date ? date : new Date(date);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  function createActionLogMarkdownFilename(date = new Date()) {
    const parsed = normalizeDate(date);
    const stamp = [
      parsed.getFullYear(),
      pad(parsed.getMonth() + 1),
      pad(parsed.getDate()),
      "-",
      pad(parsed.getHours()),
      pad(parsed.getMinutes()),
      pad(parsed.getSeconds()),
    ].join("");
    return `seti-action-log-${stamp}.md`;
  }

  return {
    buildActionLogMarkdown,
    buildRouteSummaries,
    createActionLogMarkdownFilename,
    markdownTableCell,
  };
});
