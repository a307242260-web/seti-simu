"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHeadlessEnv } = require("../app/headless-env");

const CHECKPOINT_SCHEMA = "seti-self-play-checkpoint-v1";
const LOG_SCHEMA = "seti-self-play-log-v1";

function hashSeed(seed) {
  const text = String(seed ?? "seti-self-play");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandomState(seed, initialState = null) {
  let state = Number.isInteger(initialState) ? initialState >>> 0 : hashSeed(seed) || 1;
  return {
    next() {
      state = Math.imul(state ^ (state >>> 15), 1 | state);
      state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
      return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
    },
    getState() {
      return state >>> 0;
    },
  };
}

function createBaselineAgent(options = {}) {
  return {
    schemaVersion: "seti-action-kind-agent-v1",
    algorithm: "action_kind_monte_carlo",
    learningRate: Number(options.learningRate ?? 0.15),
    epsilon: Number(options.epsilon ?? 0.1),
    episodesTrained: 0,
    actionValues: {
      pass: 0.25,
      "end-turn": 0.2,
    },
    actionVisits: {},
  };
}

function cloneAgent(agent) {
  return JSON.parse(JSON.stringify(agent));
}

function chooseAction(agent, legalActions, random, options = {}) {
  if (!Array.isArray(legalActions) || legalActions.length === 0) return null;
  const epsilon = options.evaluate ? 0 : Math.max(0, Math.min(1, agent.epsilon));
  if (random.next() < epsilon) {
    return legalActions[Math.floor(random.next() * legalActions.length)] || legalActions[0];
  }
  let best = legalActions[0];
  let bestValue = Number(agent.actionValues[best.kind] || 0);
  for (const action of legalActions.slice(1)) {
    const value = Number(agent.actionValues[action.kind] || 0);
    if (value > bestValue) {
      best = action;
      bestValue = value;
    }
  }
  return best;
}

function flattenReward(reward) {
  return Number(reward?.immediateScoreDelta || 0)
    + Number(reward?.terminalScoreDelta || 0);
}

function updateAgent(agent, trajectory, terminalObservation) {
  const finalScores = new Map(
    (terminalObservation?.players || []).map((player) => [
      player.playerId,
      Number(player.finalScore ?? player.score ?? 0),
    ]),
  );
  for (const step of trajectory) {
    const kind = step.action.kind || "unknown";
    const terminalScore = finalScores.get(step.actorPlayerId) || 0;
    const target = step.rewardValue + terminalScore;
    const current = Number(agent.actionValues[kind] || 0);
    agent.actionValues[kind] = current + agent.learningRate * (target - current);
    agent.actionVisits[kind] = Number(agent.actionVisits[kind] || 0) + 1;
  }
  agent.episodesTrained += 1;
}

function buildLegalMask(legalActions) {
  return legalActions.map((action) => ({
    maskIndex: action.maskIndex,
    actionId: action.actionId,
    kind: action.kind,
    actorPlayerId: action.actorPlayerId,
  }));
}

function appendJsonLine(logPath, record) {
  if (!logPath) return;
  fs.mkdirSync(path.dirname(path.resolve(logPath)), { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify(record)}\n`, "utf8");
}

function writeCheckpoint(checkpointPath, checkpoint) {
  if (!checkpointPath) return;
  const absolutePath = path.resolve(checkpointPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const temporaryPath = `${absolutePath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
  fs.renameSync(temporaryPath, absolutePath);
}

function readCheckpoint(checkpointPath) {
  const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
  if (checkpoint?.schemaVersion !== CHECKPOINT_SCHEMA) {
    throw new Error(`不支持的 self-play checkpoint schema：${checkpoint?.schemaVersion || "missing"}`);
  }
  return checkpoint;
}

function createSummary(stats) {
  const games = stats.completedEpisodes || 0;
  return {
    completedEpisodes: games,
    terminalEpisodes: stats.terminalEpisodes || 0,
    blockedEpisodes: stats.blockedEpisodes || 0,
    totalSteps: stats.totalSteps || 0,
    illegalActionAttempts: stats.illegalActionAttempts || 0,
    illegalActionRate: stats.totalActionAttempts > 0
      ? stats.illegalActionAttempts / stats.totalActionAttempts
      : 0,
    blockRate: games > 0 ? stats.blockedEpisodes / games : 0,
  };
}

function createCheckpoint(config, agent, stats, nextEpisodeIndex, random) {
  return {
    schemaVersion: CHECKPOINT_SCHEMA,
    checkpointBoundary: "episode",
    config: {
      seed: config.seed,
      activePlayerCount: config.activePlayerCount,
      aiDifficulty: config.aiDifficulty,
      maxSteps: config.maxSteps,
    },
    nextEpisodeIndex,
    randomState: random.getState(),
    agent: cloneAgent(agent),
    stats: {
      ...stats,
      summary: createSummary(stats),
    },
  };
}

function runEpisode(options) {
  const {
    envFactory,
    agent,
    random,
    episodeIndex,
    seed,
    activePlayerCount,
    aiDifficulty,
    maxSteps,
    evaluate,
    logPath,
    episodeSeed: explicitEpisodeSeed,
  } = options;
  const env = envFactory();
  const trajectory = [];
  const episodeSeed = explicitEpisodeSeed ?? `${seed}:${episodeIndex}`;
  let observation = null;
  let blockedReason = null;
  let illegalActionAttempts = 0;
  let totalActionAttempts = 0;

  try {
    observation = env.reset({ seed: episodeSeed, activePlayerCount, aiDifficulty });
    for (let stepIndex = 0; stepIndex < maxSteps && !env.isTerminal(); stepIndex += 1) {
      const legalActions = env.legalActions();
      const legalMask = buildLegalMask(legalActions);
      const action = chooseAction(agent, legalActions, random, { evaluate });
      if (!action) {
        blockedReason = "no_legal_actions";
        break;
      }
      totalActionAttempts += 1;
      const isLegal = legalActions.some((candidate) => candidate.actionId === action.actionId);
      if (!isLegal) {
        illegalActionAttempts += 1;
        blockedReason = "agent_selected_illegal_action";
        break;
      }
      const result = env.step(action);
      if (!result.ok) {
        if (/不匹配|非法|illegal/i.test(result.error || "")) illegalActionAttempts += 1;
        blockedReason = result.error || "step_failed";
        appendJsonLine(logPath, {
          schemaVersion: LOG_SCHEMA,
          type: "step",
          mode: evaluate ? "evaluation" : "training",
          episodeIndex,
          stepIndex,
          seed: episodeSeed,
          actorPlayerId: action.actorPlayerId,
          action,
          reward: result.reward,
          legalMask,
          terminal: Boolean(result.done),
          ok: false,
          error: blockedReason,
        });
        break;
      }
      observation = result.observation;
      trajectory.push({
        actorPlayerId: result.actorPlayerId,
        action: structuredClone(action),
        rewardValue: flattenReward(result.reward),
      });
      appendJsonLine(logPath, {
        schemaVersion: LOG_SCHEMA,
        type: "step",
        mode: evaluate ? "evaluation" : "training",
        episodeIndex,
        stepIndex,
        seed: episodeSeed,
        actorPlayerId: result.actorPlayerId,
        action,
        reward: result.reward,
        legalMask,
        terminal: Boolean(result.done),
        ok: true,
      });
    }
    if (!env.isTerminal() && !blockedReason) blockedReason = "max_steps_exceeded";
    const terminal = env.isTerminal();
    if (!evaluate && terminal) updateAgent(agent, trajectory, observation);
    const summary = {
      schemaVersion: LOG_SCHEMA,
      type: "episode_summary",
      mode: evaluate ? "evaluation" : "training",
      episodeIndex,
      seed: episodeSeed,
      steps: trajectory.length,
      terminal,
      blocked: Boolean(blockedReason),
      blockedReason,
      illegalActionAttempts,
      totalActionAttempts,
      players: observation?.players || [],
    };
    appendJsonLine(logPath, summary);
    return summary;
  } finally {
    env.dispose?.();
  }
}

function runSelfPlay(options = {}) {
  const checkpoint = options.resumeFrom ? readCheckpoint(options.resumeFrom) : null;
  const config = {
    seed: options.seed ?? checkpoint?.config?.seed ?? "seti-self-play",
    episodes: Math.max(0, Number(options.episodes ?? 1)),
    activePlayerCount: Number(options.activePlayerCount ?? checkpoint?.config?.activePlayerCount ?? 4),
    aiDifficulty: options.aiDifficulty ?? checkpoint?.config?.aiDifficulty ?? "laughable",
    maxSteps: Math.max(1, Number(options.maxSteps ?? checkpoint?.config?.maxSteps ?? 100)),
    checkpointEvery: Math.max(1, Number(options.checkpointEvery ?? 1)),
  };
  const agent = checkpoint?.agent
    ? cloneAgent(checkpoint.agent)
    : createBaselineAgent(options);
  if (options.epsilon !== undefined) agent.epsilon = Number(options.epsilon);
  if (options.learningRate !== undefined) agent.learningRate = Number(options.learningRate);
  const startEpisodeIndex = Number(checkpoint?.nextEpisodeIndex || 0);
  const random = createRandomState(config.seed, checkpoint?.randomState);
  const stats = {
    completedEpisodes: Number(checkpoint?.stats?.completedEpisodes || 0),
    terminalEpisodes: Number(checkpoint?.stats?.terminalEpisodes || 0),
    blockedEpisodes: Number(checkpoint?.stats?.blockedEpisodes || 0),
    totalSteps: Number(checkpoint?.stats?.totalSteps || 0),
    illegalActionAttempts: Number(checkpoint?.stats?.illegalActionAttempts || 0),
    totalActionAttempts: Number(checkpoint?.stats?.totalActionAttempts || 0),
  };
  const envFactory = options.envFactory || createHeadlessEnv;
  let nextEpisodeIndex = startEpisodeIndex;

  for (let offset = 0; offset < config.episodes; offset += 1) {
    const episodeIndex = startEpisodeIndex + offset;
    const summary = runEpisode({
      ...config,
      envFactory,
      agent,
      random,
      episodeIndex,
      evaluate: Boolean(options.evaluate),
      logPath: options.logPath,
    });
    stats.completedEpisodes += 1;
    stats.terminalEpisodes += summary.terminal ? 1 : 0;
    stats.blockedEpisodes += summary.blocked ? 1 : 0;
    stats.totalSteps += summary.steps;
    stats.illegalActionAttempts += summary.illegalActionAttempts;
    stats.totalActionAttempts += summary.totalActionAttempts;
    nextEpisodeIndex = episodeIndex + 1;
    if (options.checkpointPath && (
      nextEpisodeIndex % config.checkpointEvery === 0
      || offset === config.episodes - 1
    )) {
      writeCheckpoint(
        options.checkpointPath,
        createCheckpoint(config, agent, stats, nextEpisodeIndex, random),
      );
    }
  }

  return {
    agent: cloneAgent(agent),
    nextEpisodeIndex,
    stats: createSummary(stats),
  };
}

module.exports = {
  CHECKPOINT_SCHEMA,
  LOG_SCHEMA,
  buildLegalMask,
  chooseAction,
  createBaselineAgent,
  createRandomState,
  readCheckpoint,
  runEpisode,
  runSelfPlay,
  writeCheckpoint,
};
