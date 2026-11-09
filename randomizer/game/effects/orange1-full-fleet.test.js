'use strict';
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const rockets = require("../rockets");
const { createSimulationEnv } = require("../../app/simulation-env");

const source = path.resolve(__dirname, "../../../reports/research/22c44c19.d39dd7a2.full.json.failed-checkpoint.json");
const original = JSON.parse(fs.readFileSync(source));
const seat = "player-white";
for (const active of [1, 2]) {
  const checkpoint = structuredClone(original);
  const envelope = checkpoint.coreState.compositionEnvelope;
  const state = JSON.parse(envelope.committedState);
  const previous = state.pieces.rockets.filter(r => r.playerId === seat);
  assert.equal(previous.length, 2);
  if (active === 1) {
    rockets.removeRocket(state.pieces, previous[1].id);
    checkpoint.coreState.committedState = envelope.committedState = JSON.stringify(state);
  }
  checkpoint.config = { ...checkpoint.config, agentType: "search" };
  const env = createSimulationEnv();
  try {
    env.loadCheckpoint(checkpoint);
    const funding = env.legalActions().find(a => a.family === "card_corner" && a.summary.includes("b_49.webp"));
    assert(funding && env.step(funding).ok);
    const research = env.legalActions().find(a => a.family === "research_tech");
    assert(research);
    assert(env.step(research).ok);
    const orange = env.legalActions().find(a => a.target?.tileId === "orange1");
    assert(orange);
    assert(env.step(orange).ok);
    const after = env.createCheckpoint().coreState.compositionEnvelope;
    const current = after.session?.session?.workingState || JSON.parse(after.committedState);
    const white = current.players.players.find(p => p.id === seat);
    assert(white.techState.ownedTiles.orange1);
    assert(white.mainActionCompleted);
    assert.equal(current.pieces.rockets.filter(r => r.playerId === seat).length, 2);
    const ids = current.pieces.rockets.filter(r => r.playerId === seat).map(r => r.id);
    if (active === 2) assert.deepEqual(ids, previous.map(r => r.id));
    else assert(ids.includes(previous[0].id) && !ids.includes(previous[1].id));
  } finally { env.dispose(); }
}
console.log("orange1 retains research at full capacity and launches once below capacity");
