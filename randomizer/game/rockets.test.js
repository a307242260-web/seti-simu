const assert = require("node:assert/strict");
require("../solar-system/core");
const rockets = require("./rockets");

const rocketState = rockets.createRocketState();
const launched = rockets.launchRocketAtSector(rocketState, { x: 5, y: 1 }, {
  playerId: "player-white",
  color: "white",
});

assert.equal(launched.ok, true);
assert.equal(launched.rocket.id, 1);
assert.equal(launched.rocket.playerId, "player-white");
assert.equal(launched.rocket.color, "white");
assert.equal(rocketState.activeRocketId, 1);
assert.deepEqual(rockets.serializeSectorOccupancy(rocketState), { "5,1": [4] });

const moved = rockets.moveActiveRocket(rocketState, 1, 0);
assert.equal(moved.ok, true);
assert.deepEqual(
  rockets.createRocketSnapshot(moved.rocket).slotSectorCoordinate,
  { x: 6, y: 1 },
);
assert.deepEqual(rockets.serializeSectorOccupancy(rocketState), { "6,1": [4] });

const fullSectorState = rockets.createRocketState();
for (let i = 0; i < 9; i += 1) {
  const result = rockets.launchRocketAtSector(fullSectorState, { x: 0, y: 1 }, {
    playerId: "player-white",
    color: "white",
  });
  assert.equal(result.ok, true);
}

assert.deepEqual(
  rockets.serializeSectorOccupancy(fullSectorState),
  { "0,1": [0, 1, 2, 3, 4, 5, 6, 7, 8] },
);

const blocked = rockets.launchRocketAtSector(fullSectorState, { x: 0, y: 1 }, {
  playerId: "player-white",
  color: "white",
});
assert.equal(blocked.ok, false);
assert.equal(fullSectorState.rockets.length, 9);
assert.equal(fullSectorState.nextRocketId, 10);
assert.match(blocked.message, /已满/);

console.log("rocket action tests passed");
