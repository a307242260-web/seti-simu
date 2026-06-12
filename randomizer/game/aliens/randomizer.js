(function (root, factory) {
  "use strict";

  let catalog = root.SetiAlienCatalog;
  let placement = root.SetiAlienPlacement;
  let state = root.SetiAlienState;

  if (typeof require === "function") {
    catalog = catalog || require("./catalog");
    placement = placement || require("./placement");
    state = state || require("./state");
  }

  const api = factory(catalog, placement, state);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAlienRandomizer = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (catalog, placement, state) {
  "use strict";

  function randomizeAlienAssignments(alienState, random = Math.random) {
    const pool = [...catalog.ALIEN_TYPE_IDS];
    const assignments = {};

    for (const alienSlotId of placement.ALIEN_SLOT_IDS) {
      if (!pool.length) {
        throw new Error("外星人池不足以分配到所有槽位");
      }

      const pickIndex = Math.floor(random() * pool.length);
      const assignedAlienId = pool.splice(pickIndex, 1)[0];
      alienState.aliens[alienSlotId] = state.createDefaultAlienSlotState();
      alienState.aliens[alienSlotId].assignedAlienId = assignedAlienId;
      assignments[alienSlotId] = assignedAlienId;
    }

    return {
      ok: true,
      assignments,
      message: placement.ALIEN_SLOT_IDS
        .map((alienSlotId) => `${placement.getAlienSlotLabel(alienSlotId)} → ${catalog.getAlienLabel(assignments[alienSlotId])}`)
        .join("；"),
    };
  }

  return Object.freeze({
    randomizeAlienAssignments,
  });
});
