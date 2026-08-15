(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiRandom = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  // 唯一 RNG：浏览器与 Simulation 共用同一 mulberry32 生成器与同一算法标签，
  // 保证同 seed 下两边得到完全相同的盘面/洗牌序列。
  const RNG_ALGORITHM = "seti-simulation-mulberry32-v1";

  function hashSeed(seed) {
    const text = String(seed ?? "seti-simulation");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createSeededRandom(seed) {
    let state = hashSeed(seed) || 1;
    const random = () => {
      state = Math.imul(state ^ (state >>> 15), 1 | state);
      state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
      return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
    };
    random.getState = () => state >>> 0;
    random.setState = (next) => { state = Number(next) >>> 0; };
    return random;
  }

  return Object.freeze({
    RNG_ALGORITHM,
    hashSeed,
    createSeededRandom,
  });
});
