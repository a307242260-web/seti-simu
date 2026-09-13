"use strict";
const crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

// 仅研究工具读取权威初态；不执行策略，不把隐藏内容传给Policy或报告。
function captureInitialWorld({ seed, activePlayerCount = 4 }) {
  const env = createSimulationEnv();
  try {
    env.reset({ seed, activePlayerCount });
    const initial = JSON.parse(env.createCheckpoint().coreState.committedState);
    const start = env.legalActions().find(action => action.target?.kind === "start_initial_setup");
    if (!start) throw new Error("WORLD_IDENTITY_OPENING_MISSING");
    const result = env.step(start);
    if (!result.ok) throw new Error(`WORLD_IDENTITY_OPENING_FAILED: ${JSON.stringify(result)}`);
    const setup = env.createCheckpoint().coreState.compositionEnvelope.session?.session?.workingState?.match?.initialSetup;
    if (!setup) throw new Error("WORLD_IDENTITY_OFFERS_MISSING");
    const { meta, ...domains } = initial;
    return {
      schemaVersion: "seti-initial-world-identity-v1",
      seed: meta.seed,
      worldVersion: meta.worldVersion,
      activePlayerCount: initial.turn.activePlayerCount,
      domains: { ...domains, initialOffers: setup, initialRandom: meta.rngState },
    };
  } finally { env.dispose(); }
}

function identifyWorld(world) {
  const { domains, ...identity } = world;
  const components = Object.fromEntries(Object.entries(domains).map(([key, value]) => [key, hash(value)]));
  return { ...identity, fingerprint: hash(world), components };
}
function buildWorldIdentity(config) {
  return identifyWorld(captureInitialWorld(config));
}
module.exports = { captureInitialWorld, identifyWorld, buildWorldIdentity };
