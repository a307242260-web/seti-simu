"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const aliens = require("../randomizer/game/aliens"), players = require("../randomizer/game/players");
const output = "reports/iteration/card-trace-sequence-cause-20260906.json";
if (fs.existsSync(output)) console.log(fs.readFileSync(output, "utf8"));
else {
  const cp = JSON.parse(fs.readFileSync("reports/iteration/amiba-region-before-step-466-20260906.json"));
  const original = JSON.parse(cp.coreState.compositionEnvelope.committedState);
  const root = structuredClone(original), actor = root.players.players.find(p => p.id === "player-brown");
  const slotId = root.aliens.amiba.revealedSlotId;
  const traceType = "yellow";
  const position = aliens.amiba.TRACE_POSITIONS.find(p => aliens.amiba.canPlaceAmibaTrace(root.aliens, slotId, traceType, p, actor).ok);
  assert.ok(position);
  let error;
  try { aliens.placeTraceForActor(players, root.aliens, actor, slotId, traceType, position, {}); }
  catch (caught) { error = caught.message; }
  assert.match(error, /canonical alienEntity sequence/);
  assert.deepEqual(root, original);
  const beforeResources = structuredClone(actor.resources);
  const result = aliens.placeTraceForActor(players, root.aliens, actor, slotId, traceType, position,
    { sequence: root.meta.sequences.alienEntity });
  assert.equal(result.ok, true);
  assert.equal(result.reward.region, "orange");
  assert.deepEqual(actor.resources, beforeResources, "放置primitive仅返回区域奖励，不负责结算细胞器");
  assert.deepEqual(root.aliens.amiba.symbolSlots, original.aliens.amiba.symbolSlots);
  const report = { scope: "真实466状态克隆，分别验证当前卡牌空options与只补序号；不修改生产、不重跑AI",
    slotId, traceType, position, missingSequenceError: error,
    sequenceOnlyResult: result, resourcesUnchanged: true, symbolsUnchanged: true,
    conclusion: "只补序号会放置成功但未结算区域奖励，必须复用正式痕迹后续结算", passed: true };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
