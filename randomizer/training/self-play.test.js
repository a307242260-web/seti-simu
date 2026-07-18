"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  CHECKPOINT_SCHEMA,
  LOG_SCHEMA,
  readCheckpoint,
  runSelfPlay,
} = require("./self-play");

function createFakeEnv() {
  let stepIndex = 0;
  let terminal = false;
  let seed = null;

  function observation() {
    return {
      seed,
      terminal,
      currentPlayerId: terminal ? null : `player-${(stepIndex % 2) + 1}`,
      players: [
        { playerId: "player-1", score: stepIndex, finalScore: terminal ? 3 : null },
        { playerId: "player-2", score: 0, finalScore: terminal ? 1 : null },
      ],
    };
  }

  return {
    reset(config) {
      seed = config.seed;
      stepIndex = 0;
      terminal = false;
      return observation();
    },
    legalActions() {
      if (terminal) return [];
      const actorPlayerId = `player-${(stepIndex % 2) + 1}`;
      return [
        {
          actionId: `pass:${stepIndex}`,
          actorPlayerId,
          kind: "pass",
          maskIndex: 0,
        },
        {
          actionId: `scan:${stepIndex}`,
          actorPlayerId,
          kind: "scan",
          maskIndex: 1,
        },
      ];
    },
    step(action) {
      stepIndex += 1;
      terminal = stepIndex >= 3;
      return {
        ok: true,
        actorPlayerId: action.actorPlayerId,
        reward: {
          immediateScoreDelta: action.kind === "scan" ? 1 : 0,
          terminalScoreDelta: 0,
          resourceDelta: { energy: 1, availableData: action.kind === "scan" ? 1 : 0 },
        },
        done: terminal,
        observation: observation(),
      };
    },
    isTerminal() {
      return terminal;
    },
    dispose() {},
  };
}

function createBlockedEnv() {
  return {
    reset() {
      return { players: [], terminal: false };
    },
    legalActions() {
      return [];
    },
    isTerminal() {
      return false;
    },
    dispose() {},
  };
}

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "seti-self-play-"));
const checkpointPath = path.join(temporaryDirectory, "checkpoint.json");
const logPath = path.join(temporaryDirectory, "steps.jsonl");
const reportDirectory = path.join(temporaryDirectory, "reports");

const firstRun = runSelfPlay({
  episodes: 2,
  seed: "training-test",
  epsilon: 0,
  checkpointPath,
  logPath,
  reportDirectory,
  envFactory: createFakeEnv,
});
assert.equal(firstRun.nextEpisodeIndex, 2);
assert.deepEqual(firstRun.stats, {
  completedEpisodes: 2,
  terminalEpisodes: 2,
  blockedEpisodes: 0,
  totalSteps: 6,
  illegalActionAttempts: 0,
  illegalActionRate: 0,
  blockRate: 0,
});
assert.equal(firstRun.agent.episodesTrained, 2);
assert.deepEqual(firstRun.reportPaths, [
  path.join(reportDirectory, "episode-00000.html"),
  path.join(reportDirectory, "episode-00001.html"),
]);

const checkpoint = readCheckpoint(checkpointPath);
assert.equal(checkpoint.schemaVersion, CHECKPOINT_SCHEMA);
assert.equal(checkpoint.checkpointBoundary, "episode");
assert.equal(checkpoint.nextEpisodeIndex, 2);
assert.equal(checkpoint.stats.summary.illegalActionRate, 0);

const resumed = runSelfPlay({
  episodes: 1,
  resumeFrom: checkpointPath,
  checkpointPath,
  logPath,
  envFactory: createFakeEnv,
});
assert.equal(resumed.nextEpisodeIndex, 3);
assert.equal(resumed.agent.episodesTrained, 3);
assert.equal(resumed.stats.completedEpisodes, 3);
assert.equal(readCheckpoint(checkpointPath).nextEpisodeIndex, 3);

const evaluated = runSelfPlay({
  episodes: 1,
  resumeFrom: checkpointPath,
  evaluate: true,
  envFactory: createFakeEnv,
});
assert.equal(evaluated.agent.episodesTrained, 3, "评测不应更新 agent");

const blocked = runSelfPlay({
  episodes: 1,
  maxSteps: 2,
  envFactory: createBlockedEnv,
});
assert.equal(blocked.stats.blockedEpisodes, 1);
assert.equal(blocked.stats.blockRate, 1);
assert.equal(blocked.stats.illegalActionRate, 0);

const logRecords = fs.readFileSync(logPath, "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
assert.equal(logRecords.every((record) => record.schemaVersion === LOG_SCHEMA), true);
const stepRecord = logRecords.find((record) => record.type === "step");
assert.ok(stepRecord);
assert.equal(stepRecord.seed, "training-test:0");
assert.equal(stepRecord.actorPlayerId, "player-1");
assert.equal(Array.isArray(stepRecord.legalMask), true);
assert.equal(stepRecord.legalMask.length, 2);
assert.equal(typeof stepRecord.reward.immediateScoreDelta, "number");
assert.equal(typeof stepRecord.terminal, "boolean");
assert.ok(logRecords.some((record) => record.type === "episode_summary"));
const episodeSummary = logRecords.find((record) => record.type === "episode_summary");
assert.equal(episodeSummary.reportPath, path.join(reportDirectory, "episode-00000.html"));
const reportHtml = fs.readFileSync(episodeSummary.reportPath, "utf8");
assert.match(reportHtml, /单局训练总结/);
assert.match(reportHtml, /获取资源量/);
assert.match(reportHtml, /行动次数/);

fs.rmSync(temporaryDirectory, { recursive: true, force: true });

console.log("training/self-play tests passed");
