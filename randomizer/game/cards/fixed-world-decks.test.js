"use strict";
const assert = require("node:assert/strict");
const cards = require("./deck");
const aliens = require("../aliens");
const { sanitizeAlienPublicState } = require("../../app/simulation-contract");
const { createSeededRandom } = require("../random");
const failures = [];
let total = 0;
function check(name, run) {
  total += 1;
  try { run(); console.log(`PASS ${name}`); }
  catch (error) {
    // 聚合所有独立牌堆契约失败，末尾统一非零退出；不是规则容错。
    failures.push({ name, message: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}
function forbiddenRandom() { throw new Error("既定牌堆取牌/耗尽不应再次调用随机数"); }
function normalFixture() {
  const state = cards.createCardState();
  const player = { id: "p1", hand: [], resources: { handSize: 0 } };
  return { state, player, players: { players: [player] },
    options: { createCardInstance: entry => cards.createCardInstance(entry, "test-fixed") } };
}
check("普通牌按顶牌盲抽", () => {
  const f = normalFixture(), ids = cards.CARD_CATALOG.slice(0, 3).map(x => x.card_id);
  f.state.drawPileCardIds = [...ids];
  const result = cards.blindDraw(f.state, f.players, f.player, forbiddenRandom, f.options);
  assert.equal(result.card.cardId, ids[0]);
  assert.deepEqual(f.state.drawPileCardIds, ids.slice(1));
});
check("公共牌补充按同一牌堆顶牌", () => {
  const f = normalFixture(), ids = cards.CARD_CATALOG.slice(0, 3).map(x => x.card_id);
  f.state.drawPileCardIds = [...ids];
  const result = cards.replenishPublicSlot(f.state, f.players, 0, forbiddenRandom, f.options);
  assert.equal(result.cardId, ids[0]);
  assert.deepEqual(f.state.drawPileCardIds, ids.slice(1));
});
check("耗尽不回洗弃牌", () => {
  const f = normalFixture();
  f.player.hand = cards.CARD_CATALOG.slice(1).map((x, i) => cards.createCardInstance(x, `held-${i}`));
  f.player.resources.handSize = f.player.hand.length;
  f.state.discardPile = [cards.createCardInstance(cards.CARD_CATALOG[0], "discarded")];
  f.state.drawPileCardIds = [];
  const before = structuredClone(f.state.discardPile);
  const result = cards.blindDraw(f.state, f.players, f.player, forbiddenRandom, f.options);
  assert.equal(result.card, null);
  assert.deepEqual(f.state.discardPile, before);
  assert.deepEqual(f.state.drawPileCardIds, []);
});
for (const key of ["amiba", "chong", "aomomo", "banrenma", "runezu", "yichangdian"]) {
  const module = aliens[key];
  const ensure = module[`ensure${key[0].toUpperCase()}${key.slice(1)}State`];
  function fixture(deck, displayed) {
    const state = aliens.createDefaultAlienState(), species = ensure(state);
    species.revealInitialized = true;
    species.cardDeck = [...deck];
    species.displayedCardIndex = displayed;
    return { state, species };
  }
  const indices = module.CARD_DEFINITIONS.map(x => x.index);
  check(`${key}盲抽按顶牌`, () => {
    const f = fixture(indices.slice(0, 3), indices[3]);
    const result = module.blindDrawCard(f.state, forbiddenRandom, { sequence: 1 });
    assert.equal(result.card.alienCardId, indices[0]);
    assert.deepEqual(f.species.cardDeck, indices.slice(1, 3));
  });
  check(`${key}盲抽耗尽不重建`, () => {
    const f = fixture([], indices[3]);
    const result = module.blindDrawCard(f.state, forbiddenRandom, { sequence: 1 });
    assert.equal(result.card, null);
    assert.deepEqual(f.species.cardDeck, []);
    assert.equal(f.species.displayedCardIndex, indices[3], "盲抽不能拿走公开牌");
  });
  check(`${key}领取最后展示牌后不重建`, () => {
    const f = fixture([], indices[3]);
    const result = module.takeDisplayedCard(f.state, forbiddenRandom, { sequence: 1 });
    assert.equal(result.card.alienCardId, indices[3]);
    assert.equal(f.species.displayedCardIndex, null);
    const exhausted = module.takeDisplayedCard(f.state, forbiddenRandom, { sequence: 2 });
    assert.equal(exhausted.card, null);
    assert.deepEqual(f.species.cardDeck, []);
  });
}
for (const [key, accessory, count] of [["amiba", "symbolOrder", 5], ["chong", "fossilOrder", 7]]) {
  check(`${key}配置生成不执行揭示且同seed完整排列一致`, () => {
    const module = aliens[key];
    const first = module.createInitialConfiguration(createSeededRandom(`world:${key}`));
    const second = module.createInitialConfiguration(createSeededRandom(`world:${key}`));
    assert.deepEqual(first, second);
    assert.deepEqual([...first.cardDeck].sort((a, b) => a - b),
      module.CARD_DEFINITIONS.map(card => card.index).sort((a, b) => a - b));
    assert.equal(first[accessory].length, count);
    assert.equal(new Set(first[accessory]).size, count);
    assert.deepEqual(Object.keys(first).sort(), ["cardDeck", accessory].sort());
  });
}
for (const key of ["aomomo", "banrenma", "runezu", "yichangdian", "jiuzhe"]) {
  check(`${key}随机配置可独立生成且不冻结揭示时动态状态`, () => {
    const module = aliens[key];
    const config = module.createInitialConfiguration(createSeededRandom(`world:${key}`));
    assert.deepEqual(config, module.createInitialConfiguration(createSeededRandom(`world:${key}`)));
    assert.deepEqual([...config.cardDeck].sort((a, b) => a - b),
      module.CARD_DEFINITIONS.map(card => card.index).sort((a, b) => a - b));
    const keys = key === "runezu" ? ["availableSymbols", "cardDeck"]
      : key === "yichangdian" ? ["anomalyVariants", "cardDeck"] : ["cardDeck"];
    assert.deepEqual(Object.keys(config).sort(), keys.sort());
    if (key === "yichangdian") {
      assert.equal(config.anomalyVariants.length, 3);
      assert.equal(config.anomalyVariants.every(value => [1, 2].includes(value)), true);
    }
  });
}
check("方舟配置固定九张奖励牌及各玩家三色解锁牌", () => {
  const players = ["blue", "green", "brown", "white"].map(color => ({ id: `player-${color}`, color }));
  const config = aliens.fangzhou.createInitialConfiguration(createSeededRandom("world:fangzhou"), players);
  assert.deepEqual(config,
    aliens.fangzhou.createInitialConfiguration(createSeededRandom("world:fangzhou"), players));
  assert.deepEqual([...config.card1Deck].sort((a, b) => a - b),
    aliens.fangzhou.CARD1_DEFINITIONS.map(card => card.index).sort((a, b) => a - b));
  assert.deepEqual(Object.keys(config.playerCard2Variants), players.map(player => player.id));
  for (const variants of Object.values(config.playerCard2Variants)) {
    assert.deepEqual(Object.keys(variants), [...aliens.fangzhou.TRACE_TYPES]);
    assert.equal(Object.values(variants).every(value => Number.isInteger(value) && value >= 1 && value <= 4), true);
  }
});
for (const key of ["amiba", "chong", "aomomo", "banrenma", "runezu", "yichangdian", "jiuzhe", "fangzhou"]) {
  check(`${key}揭示读取预生成配置且不重抽`, () => {
    const module = aliens[key], title = key[0].toUpperCase() + key.slice(1);
    const root = aliens.createDefaultAlienState();
    const species = module[`ensure${title}State`](root);
    const players = ["blue", "white"].map(color => ({ id: `player-${color}`, color,
      resources: { score: 0 }, hand: [] }));
    species.initialConfiguration = module.createInitialConfiguration(createSeededRandom(`reveal:${key}`), players);
    const before = structuredClone(species.initialConfiguration);
    let sequence = 1;
    const args = key === "runezu" ? [root, 1, players[0], { random: forbiddenRandom }]
      : key === "yichangdian" ? [root, 1, players[0], 4, forbiddenRandom]
      : key === "banrenma" ? [root, 1, players[0], players, forbiddenRandom, { takeSequence: () => sequence++ }]
      : ["jiuzhe", "fangzhou"].includes(key) ? [root, 1, players[0], players, forbiddenRandom]
      : [root, 1, players[0], forbiddenRandom];
    assert.equal(module[`initialize${title}Reveal`](...args).ok, true);
    assert.deepEqual(species.initialConfiguration, before, "揭示不修改开局配置");
    assert.equal(species.revealInitialized, true);
  });
}
check("方舟缺少玩家配置时不得临时随机补牌或部分揭示", () => {
  const players = [{ id: "p1", color: "blue" }, { id: "p2", color: "white" }];
  for (const malformed of [null, 0, 5, "2"]) {
    const root = { fangzhou: aliens.fangzhou.createFangzhouState() };
    root.fangzhou.initialConfiguration = aliens.fangzhou.createInitialConfiguration(createSeededRandom("missing-player"), players);
    if (malformed === null) delete root.fangzhou.initialConfiguration.playerCard2Variants.p2;
    else root.fangzhou.initialConfiguration.playerCard2Variants.p2.pink = malformed;
    const before = structuredClone(root);
    assert.throws(() => aliens.fangzhou.initializeFangzhouReveal(root, 1, players[0], players, forbiddenRandom),
      /方舟玩家解锁牌配置无效/);
    assert.deepEqual(root, before, "第二席配置无效时第一席也不能部分发牌");
  }
});
check("方舟多次混洗与外部随机消耗隔离且非零检查点恢复一致", () => {
  const left = { fangzhou: aliens.fangzhou.createFangzhouState() };
  left.fangzhou.initialConfiguration = aliens.fangzhou.createInitialConfiguration(createSeededRandom("reward-world"));
  left.fangzhou.card1Deck = [...left.fangzhou.initialConfiguration.card1Deck];
  for (let i = 0; i < 7; i++) aliens.fangzhou.flipCard1Reward(left, "basic", forbiddenRandom);
  assert.equal(left.fangzhou.card1ShuffleCount, 1);
  const restored = JSON.parse(JSON.stringify(left));
  for (let i = 0; i < 20; i++) {
    const a = aliens.fangzhou.flipCard1Reward(left, "basic", forbiddenRandom);
    const b = aliens.fangzhou.flipCard1Reward(restored, "advanced", () => 0.99);
    assert.equal(a.index, b.index);
    assert.deepEqual(left, restored, "奖励等级不改变牌序，恢复后循环一致");
  }
  assert.equal(left.fangzhou.card1ShuffleCount, 5);
});
check("正式内核隐藏配置差分与lifecycle恢复", () => {
  const { createSimulationRuleComposition } = require("../production-kernel");
  const { buildRuleObservation } = require("../../app/rule-observation");
  const seed = "seti-free-analyze-v1";
  const kernel = createSimulationRuleComposition({ random: createSeededRandom(seed), seed,
    trustedProjectionReader: true });
  assert.equal(kernel.newGame({ seed }).ok, true);
  const composition = kernel.composition;
  const original = composition.lifecycle.save().envelope;
  const state = JSON.parse(original.committedState);
  const legal = composition.inputPort.enumerateActions({});
  const observation = buildRuleObservation(composition.projection().state, seed, "player-white", legal);
  const hidden = structuredClone(state);
  hidden.cards.drawPileCardIds.reverse();
  for (const key of ["amiba", "chong"]) hidden.aliens[key].initialConfiguration.cardDeck.reverse();
  [hidden.aliens.aliens[1].assignedAlienId, hidden.aliens.aliens[2].assignedAlienId] =
    [hidden.aliens.aliens[2].assignedAlienId, hidden.aliens.aliens[1].assignedAlienId];
  assert.equal(composition.lifecycle.restore({ ...original, committedState: JSON.stringify(hidden) }).ok, true);
  const hiddenLegal = composition.inputPort.enumerateActions({});
  assert.deepEqual(hiddenLegal, legal, "隐藏身份/牌序不能改变当前合法动作");
  assert.deepEqual(buildRuleObservation(composition.projection().state, seed, "player-white", hiddenLegal), observation);
  const savedHidden = composition.lifecycle.save().envelope;
  assert.deepEqual(JSON.parse(savedHidden.committedState).aliens, hidden.aliens);
  assert.equal(composition.lifecycle.restore(original).ok, true);
  assert.deepEqual(JSON.parse(composition.lifecycle.save().envelope.committedState), state);
});
check("开局仅两个槽位分配互异物种且尚未揭示", () => {
  const state = aliens.createDefaultAlienState();
  const result = aliens.randomizeAlienAssignments(state, { random: () => 0.25 });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(state.aliens), ["1", "2"]);
  const ids = Object.values(state.aliens).map(slot => slot.assignedAlienId);
  assert.equal(ids.every(id => typeof id === "string" && id.length > 0), true);
  assert.equal(new Set(ids).size, 2);
  assert.equal(Object.values(state.aliens).every(slot => !slot.revealed && slot.alienId == null), true);
});
check("预定物种的揭示次序不改身份也不再抽随机数", () => {
  const initial = aliens.createDefaultAlienState();
  initial.aliens[1].assignedAlienId = aliens.amiba.ALIEN_ID;
  initial.aliens[2].assignedAlienId = aliens.chong.ALIEN_ID;
  for (const slot of Object.values(initial.aliens)) {
    for (const trace of Object.values(slot.traces)) trace.firstPlaced = true;
  }
  for (const order of [[1, 2], [2, 1]]) {
    const state = structuredClone(initial);
    for (const slotId of order) {
      const result = aliens.revealRandomAlien(state, slotId, forbiddenRandom);
      assert.equal(result.ok, true);
      assert.equal(result.alienId, initial.aliens[slotId].assignedAlienId);
    }
    assert.deepEqual(Object.values(state.aliens).map(slot => slot.alienId),
      [aliens.amiba.ALIEN_ID, aliens.chong.ALIEN_ID]);
  }
});
check("免电固定盘面只分配阿米巴与虫且不抽取其他身份", () => {
  const state = aliens.createDefaultAlienState();
  const result = aliens.randomizeAlienAssignments(state,
    { seed: "seti-free-analyze-v1", random: forbiddenRandom });
  assert.equal(result.ok, true);
  assert.deepEqual(result.assignments, { 1: "阿米巴", 2: "虫" });
  assert.equal(Object.values(state.aliens).every(slot => !slot.revealed), true);
});
check("未揭示身份差异不进入公共物种观察", () => {
  const left = aliens.createDefaultAlienState(), right = structuredClone(left);
  left.aliens[1].assignedAlienId = aliens.amiba.ALIEN_ID;
  left.aliens[2].assignedAlienId = aliens.chong.ALIEN_ID;
  right.aliens[1].assignedAlienId = aliens.runezu.ALIEN_ID;
  right.aliens[2].assignedAlienId = aliens.aomomo.ALIEN_ID;
  assert.deepEqual(sanitizeAlienPublicState(left), sanitizeAlienPublicState(right));
});
check("405分局四席起始公司与起始卡选项继承原局", () => {
  const { createSimulationEnv } = require("../../app/simulation-env");
  const expected = require("../state/fixed-world-config").getFixedWorldConfig("seti-free-analyze-v1").initialOffers;
  const env = createSimulationEnv();
  try {
    env.reset({ seed: "seti-free-analyze-v1", activePlayerCount: 4 });
    assert.equal(env.step(env.legalActions()[0]).ok, true);
    const fork = env.createCounterfactualFork().composition;
    try {
      const setup = fork.projection({ role: "simulation" }).state.match.initialSetup;
      const actual = Object.fromEntries(Object.entries(setup.offersByPlayerId).map(([id, offer]) => [id, {
        industry: offer.industryOptions.map(card => card.value),
        initial: offer.initialOptions.map(card => card.value),
      }]));
      assert.deepEqual(actual, expected);
      assert.equal(setup.confirmedPlayerIds.length, 0, "只固定可选信息，不替玩家作选择");
    } finally { fork.dispose(); }
  } finally { env.dispose(); }
});
console.log(`固定牌堆与物种契约：${total - failures.length}/${total}通过`);
assert.deepEqual(failures, [], "固定牌堆契约未满足，不能宣称固定世界修复完成");
