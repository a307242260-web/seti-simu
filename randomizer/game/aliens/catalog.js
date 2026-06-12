(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAlienCatalog = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const ALIEN_BASE_PATH = "../assets/aliens";
  const ALIEN_BACK_SRC = `${ALIEN_BASE_PATH}/back.png`;

  const ALIEN_TYPES = Object.freeze([
    Object.freeze({ id: "九折", label: "九折" }),
    Object.freeze({ id: "半人马", label: "半人马" }),
    Object.freeze({ id: "奥陌陌", label: "奥陌陌" }),
    Object.freeze({ id: "异常点", label: "异常点" }),
    Object.freeze({ id: "方舟", label: "方舟" }),
    Object.freeze({ id: "符文族", label: "符文族" }),
    Object.freeze({ id: "虫", label: "虫" }),
    Object.freeze({ id: "阿米巴", label: "阿米巴" }),
  ]);

  const ALIEN_TYPE_IDS = Object.freeze(ALIEN_TYPES.map((entry) => entry.id));

  const ALIEN_TYPE_BY_ID = Object.freeze(
    Object.fromEntries(ALIEN_TYPES.map((entry) => [entry.id, entry])),
  );

  function getAlienType(alienId) {
    return ALIEN_TYPE_BY_ID[alienId] || null;
  }

  function getAlienLabel(alienId) {
    return getAlienType(alienId)?.label || alienId || "";
  }

  function getAlienFaceSrc(alienId) {
    if (!alienId) return ALIEN_BACK_SRC;
    return `${ALIEN_BASE_PATH}/${encodeURIComponent(alienId)}/face.png`;
  }

  return Object.freeze({
    ALIEN_BASE_PATH,
    ALIEN_BACK_SRC,
    ALIEN_TYPES,
    ALIEN_TYPE_IDS,
    getAlienType,
    getAlienLabel,
    getAlienFaceSrc,
  });
});
