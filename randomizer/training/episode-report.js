"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPORT_SCHEMA = "seti-training-episode-report-v1";
const SCORE_CATEGORIES = Object.freeze([
  ["终局板块", ["tileScore"]],
  ["终局卡牌", ["cardScore", "jiuzheCardScore", "runezuSymbolScore", "jiuzhePenaltyScore"]],
  ["蓝科", ["blueTechScore"]],
  ["着陆", ["landScore"]],
  ["环绕", ["orbitScore"]],
  ["任务", ["taskCardScore"]],
  ["扫描", ["scanScore"]],
  ["科技奖励", ["techBonusScore"]],
  ["卡牌", ["cardQuickScore", "cardEffectScore", "alienCardQuickScore"]],
  ["外星人", ["alienTracePinkScore", "alienTraceYellowScore", "alienTraceBlueScore", "alienEffectScore"]],
  ["公司", ["industryEffectScore"]],
  ["初始", ["initialScore"]],
]);
const RESOURCE_LABELS = Object.freeze({ credits: "信用", energy: "能量", publicity: "宣传", availableData: "数据", additionalPublicScan: "额外扫描", handCount: "卡牌" });
const ACTION_LABELS = Object.freeze({ play_card: "打牌", playCard: "打牌", launch: "发射", move: "移动", orbit: "环绕", land: "着陆", scan: "扫描", analyze: "分析", research_tech: "研究科技", researchTech: "研究科技", place_data: "放置数据", placeData: "放置数据", quick_trade: "快速交易", quickTrade: "快速交易", card_corner: "卡角", cardCorner: "卡角", pass: "PASS", "end-turn": "结束回合" });

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function roundValue(value) {
  const number = numberValue(value);
  return Number.isInteger(number) ? number : Math.round(number * 100) / 100;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function normalizePlayer(player = {}) {
  const breakdown = player.scoreBreakdown || {};
  const scoreSources = player.scoreSources || {};
  const scoreCategories = SCORE_CATEGORIES.map(([label, keys]) => ({
    label,
    value: roundValue(keys.reduce((total, key) => total + numberValue(key in breakdown ? breakdown[key] : scoreSources[key]), 0)),
  })).filter((entry) => entry.value !== 0);
  const categorizedBaseScore = SCORE_CATEGORIES.slice(2).reduce((total, [, keys]) => total + keys.reduce((sum, key) => sum + numberValue(scoreSources[key]), 0), 0);
  const uncategorizedBaseScore = numberValue(breakdown.baseScore ?? player.score) - categorizedBaseScore;
  if (uncategorizedBaseScore !== 0) scoreCategories.push({ label: "其他基础分", value: roundValue(uncategorizedBaseScore) });
  return {
    playerId: player.playerId || player.id || "unknown",
    playerLabel: player.playerLabel || player.colorLabel || player.name || player.color || player.playerId || "未知玩家",
    color: player.color || null,
    finalScore: roundValue(player.finalScore ?? breakdown.totalScore ?? player.score),
    scoreCategories,
    resourcesGained: { ...(player.resourcesGained || {}) },
    actionCounts: { ...(player.actionCounts || {}) },
  };
}

function buildEpisodeReport(summary = {}, trajectory = []) {
  const aggregates = new Map();
  function getAggregate(playerId) {
    if (!aggregates.has(playerId)) aggregates.set(playerId, { resourcesGained: {}, actionCounts: {} });
    return aggregates.get(playerId);
  }
  for (const step of trajectory) {
    const aggregate = getAggregate(step.actorPlayerId || "unknown");
    const family = step.action?.family || step.action?.kind || "unknown";
    aggregate.actionCounts[family] = numberValue(aggregate.actionCounts[family]) + 1;
    for (const [resource, delta] of Object.entries(step.resourceDelta || {})) {
      const gain = Math.max(0, numberValue(delta));
      if (gain > 0) aggregate.resourcesGained[resource] = roundValue(numberValue(aggregate.resourcesGained[resource]) + gain);
    }
  }
  const players = (summary.players || []).map((player) => normalizePlayer({
    ...player,
    ...getAggregate(player.playerId || player.id || "unknown"),
  })).sort((left, right) => right.finalScore - left.finalScore || left.playerLabel.localeCompare(right.playerLabel));
  return { schemaVersion: REPORT_SCHEMA, episodeIndex: summary.episodeIndex, seed: summary.seed, mode: summary.mode || "training", terminal: Boolean(summary.terminal), blocked: Boolean(summary.blocked), blockedReason: summary.blockedReason || null, steps: numberValue(summary.steps), players };
}

function renderBarRows(entries, maxValue, color) {
  if (!entries.length) return '<div class="empty">无记录</div>';
  return entries.map((entry) => {
    const value = roundValue(entry.value);
    const width = maxValue > 0 ? Math.max(2, Math.abs(value) / maxValue * 100) : 0;
    return `<div class="bar-row"><span>${escapeHtml(entry.label)}</span><div class="track"><i style="width:${width}%;background:${value < 0 ? "#f36f56" : color}"></i></div><b>${escapeHtml(value)}</b></div>`;
  }).join("");
}

function renderEpisodeReportHtml(report) {
  const maxScore = Math.max(1, ...report.players.map((player) => player.finalScore));
  const cards = report.players.map((player, index) => {
    const scoreMax = Math.max(1, ...player.scoreCategories.map((entry) => Math.abs(entry.value)));
    const resourceEntries = Object.entries(player.resourcesGained).map(([key, value]) => ({ label: RESOURCE_LABELS[key] || key, value }));
    const actionEntries = Object.entries(player.actionCounts).map(([key, value]) => ({ label: ACTION_LABELS[key] || key, value })).sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
    return `<article class="player-card"><header><div><span class="rank">#${index + 1}</span><h2>${escapeHtml(player.playerLabel)}</h2></div><strong>${escapeHtml(player.finalScore)}<small>分</small></strong></header><div class="score-track"><i style="width:${Math.max(2, player.finalScore / maxScore * 100)}%"></i></div><section><h3>分类得分</h3>${renderBarRows(player.scoreCategories, scoreMax, "#62d6c5")}</section><div class="grid"><section><h3>获取资源量</h3>${renderBarRows(resourceEntries, Math.max(1, ...resourceEntries.map((entry) => entry.value)), "#e8b15a")}</section><section><h3>行动次数</h3>${renderBarRows(actionEntries, Math.max(1, ...actionEntries.map((entry) => entry.value)), "#7aa7ff")}</section></div></article>`;
  }).join("");
  const status = report.terminal ? "正常终局" : report.blocked ? `中止：${report.blockedReason || "未知原因"}` : "未终局";
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SETI 第 ${escapeHtml(report.episodeIndex)} 局训练总结</title><style>
:root{color-scheme:dark;font-family:Inter,"PingFang SC","Microsoft YaHei",sans-serif;background:#07131d;color:#e9f4f3}*{box-sizing:border-box}html,body{max-width:100%;overflow-x:hidden}body{margin:0;background:radial-gradient(circle at 80% 0,#15364b 0,transparent 36rem),#07131d}main{width:min(1120px,calc(100% - 32px));margin:auto;padding:48px 0 72px}.eyebrow{color:#62d6c5;letter-spacing:.16em;font-size:12px}h1{font-size:clamp(30px,5vw,58px);margin:8px 0 12px}.meta{display:flex;gap:12px;flex-wrap:wrap;color:#a8bbc4}.meta span{border:1px solid #294453;border-radius:999px;padding:7px 12px}.players{display:grid;gap:20px;margin-top:36px;min-width:0}.player-card{min-width:0;background:#0d202d;border:1px solid #24404e;border-radius:20px;padding:24px;box-shadow:0 18px 60px #0005}.player-card header{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}.player-card header>div{display:flex;align-items:center;gap:12px;min-width:0}.rank{display:grid;flex:0 0 38px;place-items:center;width:38px;height:38px;border-radius:50%;background:#173747;color:#62d6c5;font-weight:800}h2{margin:0;font-size:24px}.player-card header strong{flex:0 0 auto;font-size:38px;color:#f8d178}.player-card header small{font-size:14px;margin-left:4px;color:#a8bbc4}.score-track,.track{min-width:0;overflow:hidden;background:#07131d;border-radius:999px}.score-track{height:7px;margin:14px 0 24px}.score-track i{display:block;height:100%;background:linear-gradient(90deg,#62d6c5,#f8d178)}h3{margin:0 0 12px;font-size:13px;color:#9fb7c2;letter-spacing:.08em}.grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;margin-top:22px;min-width:0}.grid section,.player-card>section{min-width:0}.bar-row{display:grid;grid-template-columns:minmax(72px,110px) minmax(0,1fr) 42px;gap:10px;align-items:center;min-width:0;margin:8px 0;font-size:13px}.track{height:8px}.track i{display:block;height:100%;border-radius:999px}.bar-row b{text-align:right}.empty{color:#607985;font-size:13px;padding:6px 0}@media(max-width:700px){main{padding-top:28px}.grid{grid-template-columns:minmax(0,1fr)}.player-card{padding:18px}.bar-row{grid-template-columns:72px minmax(0,1fr) 32px;gap:8px}.player-card header strong{font-size:30px}h2{font-size:21px}}
</style></head><body><main><div class="eyebrow">SETI SELF-PLAY · EPISODE ${escapeHtml(report.episodeIndex)}</div><h1>单局训练总结</h1><div class="meta"><span>Seed：${escapeHtml(report.seed)}</span><span>${escapeHtml(status)}</span><span>${escapeHtml(report.steps)} 次策略决策</span><span>${report.mode === "evaluation" ? "评测" : "训练"}</span></div><div class="players">${cards || '<div class="empty">没有玩家数据</div>'}</div></main></body></html>`;
}

function writeEpisodeReport(reportDirectory, report) {
  if (!reportDirectory) return null;
  const absoluteDirectory = path.resolve(reportDirectory);
  fs.mkdirSync(absoluteDirectory, { recursive: true });
  const reportPath = path.join(absoluteDirectory, `episode-${String(numberValue(report.episodeIndex)).padStart(5, "0")}.html`);
  fs.writeFileSync(reportPath, `${renderEpisodeReportHtml(report)}\n`, "utf8");
  return reportPath;
}

module.exports = { REPORT_SCHEMA, buildEpisodeReport, renderEpisodeReportHtml, writeEpisodeReport };
