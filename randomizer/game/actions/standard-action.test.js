"use strict";

const assert = require("node:assert/strict");
require("../../solar-system/layout");
require("../../solar-system/core");
require("../players");
require("../rockets");
const solar = require("../../solar-system/core");
const players = require("../players");
const rockets = require("../rockets");
const launch = require("./launch");
const standardAction = require("./standard-action");

assert.equal(standardAction.TOP_LEVEL_FAMILIES.length, 15);
assert.equal(standardAction.CONDITIONAL_FAMILIES.length, 7);
assert.equal(new Set(standardAction.ALL_FAMILIES).size, 22);

function createContext() {
  const solarState = solar.createBaselineState();
  const playerState = players.createPlayerState({
    currentPlayer: { color: "white", resources: { credits: 10, energy: 10, publicity: 10 } },
  });
  const rocketState = rockets.createRocketState();
  return {
    solarState,
    playerState,
    rocketState,
    stateVersion: 3,
    decisionVersion: 7,
    getEarthSectorCoordinate() {
      const earth = solar.createSolarSnapshot(solarState).planetLocations.find((planet) => planet.planetId === "earth");
      return { x: earth.x, y: earth.y };
    },
  };
}

function getAuthority(context) {
  return {
    actorId: players.getCurrentPlayer(context.playerState)?.id || null,
    stateVersion: context.stateVersion,
    decisionVersion: context.decisionVersion,
  };
}

const context = createContext();
const registry = standardAction.createRegistry({ getAuthority });
registry.register(standardAction.createLaunchDefinition(launch));

const coverage = registry.coverage();
assert.equal(coverage.length, 22);
assert.equal(coverage.find((entry) => entry.family === "launch").registered, true);
assert.equal(coverage.filter((entry) => entry.registered).length, 1);

const actions = registry.enumerate(context);
assert.equal(actions.length, 1);
assert.equal(actions[0].family, "launch");
assert.equal(actions[0].actorId, players.getCurrentPlayer(context.playerState).id);
assert.equal(registry.enumerate(context, { actorId: "other-player" }).length, 0);
assert.deepEqual(actions, registry.enumerate(context), "同一权威状态应产生稳定 action id");

const stale = { ...actions[0], stateVersion: actions[0].stateVersion - 1 };
assert.equal(registry.execute(context, stale).code, "STANDARD_ACTION_STALE");
const wrongActor = { ...actions[0], actorId: "other-player" };
assert.equal(registry.execute(context, wrongActor).code, "STANDARD_ACTION_ACTOR_MISMATCH");

const beforeCredits = players.getCurrentPlayer(context.playerState).resources.credits;
const result = registry.execute(context, actions[0]);
assert.equal(result.ok, true, result.message);
assert.equal(result.action.actionId, actions[0].actionId);
assert.equal(players.getCurrentPlayer(context.playerState).resources.credits, beforeCredits - 2);
assert.equal(context.rocketState.rockets.length, 1);
assert.equal(registry.enumerate(context).length, 0, "发射规则变化后候选应由同一 canExecute 自动消失");

assert.throws(() => registry.register(standardAction.createLaunchDefinition(launch)), /重复注册/);
assert.throws(() => registry.register({ family: "unknown" }), /未知 Standard Action family/);

console.log("standard-action contract tests passed");
