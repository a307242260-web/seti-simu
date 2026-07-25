(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiStateSequences = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function getSequenceMap(root) {
    const sequences = root?.meta?.sequences;
    if (!sequences || typeof sequences !== "object" || Array.isArray(sequences)) {
      throw new TypeError("规则实体编号需要 canonical meta.sequences");
    }
    return sequences;
  }

  function peek(root, key) {
    const value = Number(getSequenceMap(root)[key]);
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new TypeError(`meta.sequences.${key} 必须是正安全整数`);
    }
    return value;
  }

  function take(root, key) {
    const sequences = getSequenceMap(root);
    const value = peek(root, key);
    sequences[key] = value + 1;
    return value;
  }

  return Object.freeze({ peek, take });
});
