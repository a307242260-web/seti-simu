const assert = require("node:assert/strict");
require("../solar-system/core");
const rockets = require("./rockets");

const piecesState = rockets.createRocketState();
const root = { meta: { sequences: { rocket: 1 } } };
rockets.launchRocketAtSector(piecesState, { x: 5, y: 1 }, {
  playerId: "player-white",
  color: "white",
  root,
});
rockets.launchRocketAtSector(piecesState, { x: 5, y: 1 }, {
  playerId: "player-white",
  color: "white",
  root,
});

const blockedMove = rockets.canMoveRocket(piecesState, 2, 0, -1);
assert.equal(blockedMove.ok, false);

const allowedMove = rockets.canMoveRocket(piecesState, 2, 1, 0);
assert.equal(allowedMove.ok, true);

const moved = rockets.moveRocket(piecesState, 2, 1, 0);
assert.equal(moved.ok, true);
assert.equal(moved.rocket.id, 2);
assert.equal(piecesState.activeRocketId, 2);

const manualBoard = rockets.placeRocketAtBoardPoint(piecesState, 2, { x: 500, y: 250 });
assert.equal(manualBoard.ok, true);
assert.equal(manualBoard.rocket.surface, rockets.ROCKET_SURFACE.SOLAR);
assert.equal(manualBoard.rocket.slotIndex, null);

assert.deepEqual(rockets.serializeSectorOccupancy(piecesState), { "5,1": [4] });

console.log("rocket move tests passed");
