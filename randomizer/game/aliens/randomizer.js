(function (root, factory) {
  "use strict";

  let catalog = root.SetiAlienCatalog;
  let placement = root.SetiAlienPlacement;
  let state = root.SetiAlienState;
  let jiuzhe = root.SetiAlienJiuzhe;

  if (typeof require === "function") {
    catalog = catalog || require("./catalog");
    placement = placement || require("./placement");
    state = state || require("./state");
    jiuzhe = jiuzhe || require("./jiuzhe");
  }

  const api = factory(catalog, placement, state, jiuzhe);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAlienRandomizer = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (catalog, placement, state, jiuzhe) {
  "use strict";

  function randomizeAlienAssignments(alienState, random = Math.random) {
    const fixedFirstAlienId = jiuzhe?.ALIEN_ID || "九折";
    const pool = catalog.ALIEN_TYPE_IDS.filter((alienId) => alienId !== fixedFirstAlienId);
    const assignments = {};

    for (const alienSlotId of placement.ALIEN_SLOT_IDS) {
      if (!pool.length) {
        throw new Error("外星人池不足以分配到所有槽位");
      }

      const assignedAlienId = alienSlotId === placement.ALIEN_SLOT_IDS[0]
        ? fixedFirstAlienId
        : pool.splice(Math.floor(random() * pool.length), 1)[0];
      alienState.aliens[alienSlotId] = state.createDefaultAlienSlotState();
      alienState.aliens[alienSlotId].assignedAlienId = assignedAlienId;
      assignments[alienSlotId] = assignedAlienId;
    }

    if (jiuzhe?.createJiuzheState) {
      alienState.jiuzhe = jiuzhe.createJiuzheState();
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
