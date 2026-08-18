"use strict";

/**
 * 全盘运行持续进度输出（共享 helper）。
 *
 * 背景：机器席位跑全盘（run_simulate_save / save_checkpoints /
 * run_research_validation --full / compare_vguided_vs_baseline 等）时，单次
 * runHeuristicPolicyDecision 可能耗时数秒且全程无输出，终端看起来"卡住不动"。
 * 本 helper 提供按时间节流的逐决策进度行：慢决策自然每步一行，快决策至少
 * 每秒一行，让观察者（人/agent）始终能看到当前轮次、回合、步数与分数。
 *
 * 输出走 stderr：不污染 stdout 上的最终结果（结果行仍由各工具 print 到 stdout）。
 *
 * 用法：
 *   const reporter = createStepProgressReporter({ label: "full" });
 *   ...
 *   reporter.report({
 *     steps, round, turn, seat, action,
 *     maxSteps, scores, startedAt,
 *   });
 */

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.round(Number(milliseconds) || 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m${seconds}s` : `${seconds}s`;
}

function formatScores(scores) {
  if (!Array.isArray(scores) || !scores.length) return "";
  return scores
    .map((entry) => `${entry.label || entry.id || "?"}=${Number(entry.score) ?? "?"}`)
    .join(" ");
}

/**
 * @param {object} [options]
 * @param {NodeJS.WritableStream} [options.stream] 默认 process.stderr
 * @param {number} [options.minIntervalMs] 至少间隔毫秒，默认 1000
 * @param {string} [options.label] 行首标签，默认 "全盘"
 * @returns {{ report(info): void, line(text: string): void }}
 */
function createStepProgressReporter(options = {}) {
  const stream = options.stream || process.stderr;
  const minIntervalMs = Math.max(50, Number(options.minIntervalMs) || 1000);
  const label = options.label || "全盘";
  let lastAt = -Infinity;
  let lastLine = "";

  function report(info = {}) {
    const now = Date.now();
    if (now - lastAt < minIntervalMs) return;
    const elapsed = Math.max(0, now - (Number(info.startedAt) || now));
    const steps = Number(info.steps) || 0;
    const speed = elapsed > 0 ? (steps / (elapsed / 1000)).toFixed(1) : "?";
    const parts = [
      `第 ${Number(info.round) || "?"} 轮`,
      `第 ${Number(info.turn) || "?"} 回合`,
      `决策#${steps}${info.maxSteps ? `/${info.maxSteps}` : ""}`,
    ];
    if (info.seat) parts.push(`席位=${info.seat}`);
    if (info.action) parts.push(`动作=${info.action}`);
    const scoresText = formatScores(info.scores);
    if (scoresText) parts.push(scoresText);
    parts.push(`用时=${formatDuration(elapsed)}`);
    parts.push(`${speed}步/s`);
    const line = `[${label}进度] ${parts.join(" · ")}`;
    lastAt = now;
    lastLine = line;
    stream.write(`${line}\n`);
    return line;
  }

  function line(text) {
    stream.write(`${text}\n`);
  }

  return Object.freeze({ report, line, get lastLine() { return lastLine; } });
}

module.exports = { createStepProgressReporter, formatDuration };
