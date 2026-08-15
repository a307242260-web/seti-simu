(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiTrajectoryRecorder = api;})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  // 与 randomizer/training/self-play.js 完全一致的日志 schema：人类示范轨迹按
  // seti-self-play-log-v1 落盘，训练侧无需转换即可直接读取。
  const LOG_SCHEMA = "seti-self-play-log-v1";

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function createTrajectoryRecorder(options = {}) {
    const seed = options.seed ?? "seti-human-demo";
    const mode = options.mode ?? "human-demo";
    const episodeIndex = Number.isInteger(options.episodeIndex) ? options.episodeIndex : 0;
    const records = [];
    let stepIndex = 0;

    function baseRecord(type) {
      return { schemaVersion: LOG_SCHEMA, type, mode, episodeIndex, seed };
    }

    function recordStep(input = {}) {
      const record = {
        ...baseRecord("step"),
        stepIndex,
        actorPlayerId: input.actorPlayerId ?? null,
        action: clone(input.action || null),
        reward: clone(input.reward || null),
        legalMask: clone(input.legalMask || []),
        terminal: Boolean(input.terminal),
        ok: Boolean(input.ok),
      };
      if (input.error != null) record.error = String(input.error);
      if (input.actorKind != null) record.actorKind = String(input.actorKind);
      records.push(record);
      stepIndex += 1;
      return record;
    }

    function finishEpisode(input = {}) {
      records.push({
        ...baseRecord("episode_summary"),
        steps: stepIndex,
        terminal: Boolean(input.terminal),
        blocked: Boolean(input.blocked),
        ...(input.blockedReason != null ? { blockedReason: String(input.blockedReason) } : {}),
        illegalActionAttempts: Number(input.illegalActionAttempts) || 0,
        totalActionAttempts: Number(input.totalActionAttempts) || 0,
        players: clone(input.players || []),
      });
      return records.length;
    }

    // 只允许在 episode_summary 落盘前截断已确认步骤（撤销对齐）；汇总后轨迹不可再改。
    function truncateToStepCount(count) {
      if (records.some((record) => record.type === "episode_summary")) return stepIndex;
      const target = Math.max(0, Math.min(stepIndex, Number(count) || 0));
      if (target < stepIndex) {
        records.length = target;
        stepIndex = target;
      }
      return stepIndex;
    }

    function getStepCount() {
      return stepIndex;
    }

    function getRecords() {
      return clone(records);
    }

    function getJsonl() {
      return records.map((record) => JSON.stringify(record)).join("\n");
    }

    return Object.freeze({
      LOG_SCHEMA,
      recordStep,
      finishEpisode,
      truncateToStepCount,
      getStepCount,
      getRecords,
      getJsonl,
    });
  }

  return Object.freeze({ LOG_SCHEMA, createTrajectoryRecorder });
});
