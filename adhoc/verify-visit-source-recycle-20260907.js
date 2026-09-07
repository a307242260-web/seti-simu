"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const cards = require("../randomizer/game/cards/deck");
const effects = require("../randomizer/game/cards/effects");
const residual = require("../randomizer/game/effects/residual-domain-session");
const sources = ["reports/iteration/current-movement-hotspots-20260907.json", "reports/iteration/turn-visit-routes-formal-20260907.json"];
const output = "reports/iteration/visit-source-recycle-20260907.json";
if (fs.existsSync(output)) console.log(`已有来源边界证据：${output}`);
else {
  const [checkpoints, routes] = sources.map(path => JSON.parse(fs.readFileSync(path)));
  const report = { scope: "从真实148正式打出b24后的工作状态，隔离调用正式牌库owner直至循环，核对奖励来源能否由当前牌区重建；连续抽牌不是完整合法机器人行动链，不声称该长链在固定局发生", sources,
    sha256: Object.fromEntries(sources.map(path => [path, crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex")])),
    draws: [], verified: false };
  const env = createSimulationEnv(); let fork;
  try {
    const cp = structuredClone(checkpoints.entries.find(e => e.step === 148).checkpoint);
    delete cp.replaySteps; env.loadCheckpoint(cp); fork = env.createCounterfactualFork().composition;
    const played = routes.rows.find(r => r.step === 148 && r.companyAllowance === 0).inputs[0];
    const legal = fork.inputPort.enumerateActions().find(a => a.actionId === played.actionId);
    assert.deepEqual(legal, played);
    assert.equal(fork.inputPort.submitAction(legal, { skipProjection: true }).ok, true);
    const canonical = fork.projection({ role: "simulation" }).state;
    const before = JSON.stringify(canonical), root = structuredClone(canonical);
    const actor = root.players.players.find(p => p.id === played.actorId);
    const bonus = root.turn.cardTurnEventBonuses.find(b => b.ownerId === played.actorId);
    assert.ok(bonus);
    const bonusBefore = structuredClone(bonus);
    const match = () => [...actor.hand, ...actor.reservedCards, ...root.cards.discardPile]
      .filter(card => effects.getCardModel(card)?.playEffects?.some(e =>
        e.type === effects.EFFECT_TYPES.REGISTER_EVENT_BONUS && e.id === bonus.effectId))
      .map(card => ({ id: card.id, cardId: card.cardId }));
    report.originalSource = played.target.cardInstanceId;
    report.matchesBefore = match();
    assert.deepEqual(report.matchesBefore.map(c => c.id), [report.originalSource]);
    const modelId = report.matchesBefore[0].cardId;
    for (let n = 0; n <= cards.getCatalogSize(); n++) {
      const drawn = cards.blindDraw(root.cards, root.players, actor, () => 0, { root });
      assert.equal(drawn.ok, true, drawn.message);
      report.draws.push({ id: drawn.card.id, cardId: drawn.card.cardId, reshuffled: drawn.reshuffled });
      if (drawn.card.cardId === modelId) break;
    }
    assert.equal(report.draws.at(-1).cardId, modelId);
    assert.ok(report.draws.some(d => d.reshuffled));
    report.matchesAfter = match();
    assert.equal(report.matchesAfter.length, 1);
    assert.notEqual(report.matchesAfter[0].id, report.originalSource,
      "同模型仍唯一不等于仍为注册奖励的原实例");
    assert.deepEqual(bonus, bonusBefore);
    report.bonus = structuredClone(bonus);
    report.rewardStillAvailable = residual.describeEventBonusProgress({ bonus,
      event: { type: "visitComet", playerId: actor.id }, ownerId: actor.id });
    assert.equal(report.rewardStillAvailable.status, "reward");
    assert.equal(JSON.stringify(fork.projection({ role: "simulation" }).state), before);
    report.verified = true;
  } catch (error) {
    report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    fork?.dispose(); env.dispose();
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ output, verified: report.verified, originalSource: report.originalSource,
      before: report.matchesBefore, after: report.matchesAfter, draws: report.draws.length,
      reward: report.rewardStillAvailable, error: report.error }, null, 2));
  }
}
