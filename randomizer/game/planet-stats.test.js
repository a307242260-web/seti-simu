const assert = require("node:assert/strict");
const planetStats = require("./planet-stats");

const player = { id: "p1", color: "white" };
const otherPlayer = { id: "p2", color: "blue" };

const state = planetStats.createPlanetStatsState();

for (let index = 0; index < 5; index += 1) {
  assert.equal(planetStats.addPlanetOrbitMarker(state, "mars", player).ok, true);
}
assert.equal(planetStats.canAddOrbitMarker(state, "mars"), true);
const sixthOrbit = planetStats.addPlanetOrbitMarker(state, "mars", player);
assert.equal(sixthOrbit.ok, true);
assert.equal(sixthOrbit.marker.sequence, 6);
assert.equal(sixthOrbit.marker.displayed, false);
assert.equal(planetStats.getPlanetOrbitCount(state, "mars"), 6);
assert.equal(planetStats.canAddOrbitMarker(state, "mars"), true);
assert.equal(planetStats.addPlanetOrbitMarker(state, "mars", player).marker.sequence, 7);

assert.equal(planetStats.addPlanetLandingMarker(state, "venus", player).ok, true);
assert.equal(planetStats.addPlanetLandingMarker(state, "venus", otherPlayer).ok, true);
for (let index = 0; index < 4; index += 1) {
  assert.equal(planetStats.addPlanetLandingMarker(state, "venus", player).ok, true);
}
const overflowLanding = planetStats.getPlanetLandingMarkers(state, "venus")[5];
assert.equal(overflowLanding.sequence, 6);
assert.equal(overflowLanding.displayed, false);
const forcedLanding = planetStats.addPlanetLandingMarker(state, "venus", player, {
  rewardSlot: 1,
  referenceOffsetTokenWidths: 0.5,
});
assert.equal(forcedLanding.ok, true);
assert.equal(forcedLanding.marker.sequence, 7);
assert.equal(forcedLanding.marker.displayed, true);
assert.equal(forcedLanding.marker.displaySlot, 1);
assert.equal(forcedLanding.marker.referenceOffsetTokenWidths, 0.5);
assert.deepEqual(planetStats.getPlanetLandingMarkers(state, "venus").map((marker) => marker.sequence), [1, 2, 3, 4, 5, 6, 7]);
assert.equal(planetStats.getPlanetLandingMarkers(state, "venus")[1].playerId, "p2");
assert.equal(planetStats.getPlanetLandingMarkers(state, "venus")[6].displaySlot, 1);

assert.equal(planetStats.addSatelliteLandingMarker(state, "jupiter", "europa", player).ok, true);
assert.equal(planetStats.canLandOnSatellite(state, "jupiter", "europa"), false);
assert.equal(planetStats.canLandOnSatellite(state, "jupiter", "europa", { allowDuplicate: true }), true);
const duplicateSatellite = planetStats.addSatelliteLandingMarker(state, "jupiter", "europa", otherPlayer, {
  allowDuplicate: true,
  referenceOffsetTokenWidths: 0.5,
});
assert.equal(duplicateSatellite.ok, true);
assert.equal(duplicateSatellite.marker.referenceOffsetTokenWidths, 0.5);
assert.equal(planetStats.getSatelliteLandingMarkers(state, "jupiter").length, 2);
assert.equal(planetStats.canLandOnSatellite(state, "jupiter", "europa"), false);

console.log("planet stats tests passed");
