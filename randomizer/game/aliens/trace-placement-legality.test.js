"use strict";

const assert = require("node:assert/strict");
const aliens = require("./index");
const state = require("./state");

const player = {
  id: "player-white",
  color: "white",
  resources: { availableData: 0, aomomoFossils: 0 },
};

function createRevealedState(species, alienSlotId = 1) {
  const alienState = state.createDefaultAlienState();
  Object.assign(alienState.aliens[alienSlotId], {
    assignedAlienId: species.ALIEN_ID,
    alienId: species.ALIEN_ID,
    revealed: true,
  });
  return alienState;
}

for (const species of [
  aliens.jiuzhe,
  aliens.yichangdian,
  aliens.fangzhou,
  aliens.banrenma,
  aliens.chong,
  aliens.amiba,
  aliens.aomomo,
  aliens.runezu,
]) {
  const alienState = createRevealedState(species);
  assert.equal(
    aliens.canPlaceAnyRevealedAlienTrace(alienState, 1, "pink", player, {
      availableDataCount: 0,
    }),
    true,
    `${species.ALIEN_ID} should expose an initially legal pink trace position`,
  );
}

const fullJiuzheState = createRevealedState(aliens.jiuzhe);
aliens.jiuzhe.seedDebugTraceGrid(fullJiuzheState, 1, player);
assert.equal(
  aliens.canPlaceAnyRevealedAlienTrace(fullJiuzheState, 1, "pink", player),
  false,
  "Jiuzhe has no legal target after all single-occupancy positions fill",
);

const fullYichangdianState = createRevealedState(aliens.yichangdian);
aliens.yichangdian.seedDebugTraceGrid(fullYichangdianState, 1, player);
assert.equal(
  aliens.canPlaceAnyRevealedAlienTrace(fullYichangdianState, 1, "pink", player),
  true,
  "Yichangdian position 1 remains stackable after the other positions fill",
);

const fullFangzhouState = createRevealedState(aliens.fangzhou);
aliens.fangzhou.seedDebugTraceGrid(fullFangzhouState, 1, player);
assert.equal(
  aliens.canPlaceAnyRevealedAlienTrace(fullFangzhouState, 1, "pink", player),
  false,
  "Fangzhou has no legal target after its row fills",
);

const fullBanrenmaState = createRevealedState(aliens.banrenma);
aliens.banrenma.seedDebugTraceGrid(fullBanrenmaState, 1, player);
assert.equal(
  aliens.canPlaceAnyRevealedAlienTrace(fullBanrenmaState, 1, "pink", player, {
    availableDataCount: 0,
  }),
  false,
  "Banrenma must not report its stackable paid slot when the player has no data",
);
assert.equal(
  aliens.canPlaceAnyRevealedAlienTrace(fullBanrenmaState, 1, "pink", player, {
    availableDataCount: 1,
  }),
  true,
  "Banrenma position 1 becomes legal when the player can pay one data",
);

const fullChongState = createRevealedState(aliens.chong);
aliens.chong.seedDebugTraceGrid(fullChongState, 1, player);
assert.equal(
  aliens.canPlaceAnyRevealedAlienTrace(fullChongState, 1, "pink", player),
  false,
  "Chong has no legal target after all pink positions fill",
);

const fullAmibaState = createRevealedState(aliens.amiba);
aliens.amiba.seedDebugTraceGrid(fullAmibaState, 1, player);
assert.equal(
  aliens.canPlaceAnyRevealedAlienTrace(fullAmibaState, 1, "pink", player),
  false,
  "Amiba has no legal target after all single-occupancy positions fill",
);

const fullAomomoState = createRevealedState(aliens.aomomo);
for (const position of aliens.aomomo.TRACE_POSITIONS) {
  aliens.aomomo.placeAomomoTrace(fullAomomoState, 1, "pink", position, player, { debugOnly: true });
}
assert.equal(
  aliens.canPlaceAnyRevealedAlienTrace(fullAomomoState, 1, "pink", player),
  false,
  "Aomomo must not report its stackable fossil-cost slot when the player has no fossils",
);
player.resources.aomomoFossils = 1;
assert.equal(
  aliens.canPlaceAnyRevealedAlienTrace(fullAomomoState, 1, "pink", player),
  true,
  "Aomomo position 1 becomes legal when the player can pay one fossil",
);
player.resources.aomomoFossils = 0;

const fullRunezuState = createRevealedState(aliens.runezu);
for (const position of aliens.runezu.TRACE_POSITIONS) {
  aliens.runezu.placeRunezuTrace(fullRunezuState, 1, "pink", position, player, { debugOnly: true });
}
assert.equal(
  aliens.canPlaceAnyRevealedAlienTrace(fullRunezuState, 1, "pink", player),
  true,
  "Runezu position 1 remains stackable after the other positions fill",
);

assert.equal(
  aliens.canPlaceAnyRevealedAlienTrace(state.createDefaultAlienState(), 1, "pink", player),
  false,
  "an unrevealed alien slot must not expose a face placement target",
);

console.log("aliens/trace-placement-legality.test.js ok");
