'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),util=require('node:util');
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const D='reports/ai-foundation-20261107/v324-held-landing-route-v1/',F='reports/ai-foundation-20261105/third-round-teacher-v1/',manifest=read(D+'source-manifest-20261107-v1.json'),g=read(D+'serial-cold-gate-20261107-v1.json');
const path=D+'v323-held-landing-timing-native-20261107-v1.json',t=read(path);
const proof=JSON.parse(z.gunzipSync(fs.readFileSync(D+'recovered-mercury-winning-plan-20261107-v1.json.gz')));
for(const [n,h] of Object.entries(proof.digest))assert.equal(h,manifest.sourceHashes['randomizer/game/ai/'+n+'.js']);
assert.equal(sha(path),proof.timingSha256);assert.equal(sha(proof.nativePath),proof.nativeSha256);
assert.deepEqual(t.paths.map(p=>p.prefix),[0,1,3]);assert(t.paths.every(p=>util.isDeepStrictEqual(p.landed.envelope,t.paths[0].landed.envelope)));
assert.equal(proof.restored.length,21);assert.equal(proof.endWallet.score,72);assert.equal(proof.restored.filter(([f])=>f==='move').length,4);
assert(proof.restored.some(([f,t])=>f==='choose_target'&&t.planetId==='mercury'&&t.landTarget?.type==='planet'));
assert.deepEqual(proof.restored.filter(([f])=>f==='quick_trade').map(([,t])=>t.tradeId),['credits-for-energy','credits-for-energy']);
const hashes={};for(const row of g.rows){const v=read(row.evidence);assert(v.complete&&v.rootAndRngUnchanged);assert.equal(v.rawSha256,sha(v.rawPath));hashes[row.label]=[v.nativeInputs,v.milliseconds,v.actionId];}
assert.equal(g.status,'failed-gate');assert.equal(g.failure.label,'corpus-case-152');assert.equal(g.failure.nativeInputs,256);assert(g.failure.milliseconds>600);
const prior=read(F+'v323-cold-corpus-case-152-20261107-v1.json'),next=read(g.failure.evidence);
const raw=r=>JSON.parse(z.gunzipSync(fs.readFileSync(r.rawPath)).toString().replace(/seti-complete-decision-search-v(?:323|324)|seti-purpose-capital-state-value-v(?:54|55)|seti-goal-resource-preparation-v(?:25|26)/g,'version'));
assert.equal(sha(prior.rawPath),prior.rawSha256);const a=raw(prior),b=raw(next);delete a.diagnostics;delete b.diagnostics;assert.deepEqual(a,b);
const demand=require('../randomizer/game/ai/resource-demand'),probe=require('../randomizer/game/ai/probe-capital'),k=require('../randomizer/game/production-kernel'),native=read(proof.nativePath),state=JSON.parse(native.launched.envelope.committedState),seatId='player-white';
const owner=s=>s.players.players.find(p=>p.id===seatId),directory=()=>k.getProbeRouteRequirements(state,seatId).candidates,compareTiming=k.createPlannedMovementTimingQuery(state,seatId),query=s=>demand.heldLandingGoal({state:s,seatId,candidates:directory,compareTiming});
const expected=query(state);assert.equal(expected.planetId,'jupiter');assert.equal(expected.path.length,1);
for(const transform of [s=>{owner(s).hand=owner(s).hand.filter(c=>c.cardId!=='dlc_31.png');},s=>{owner(s).hand.find(c=>c.cardId==='dlc_31.png').hidden=true;},s=>{owner(s).resources.credits=0;},s=>{s.turn.roundNumber=4;},s=>{s.turn.passedPlayerIds=s.turn.activePlayerIds.filter(id=>id!==seatId);},s=>{owner(s).passCompletionPending=true;},s=>{const hand=owner(s).hand;hand.push({...hand.find(c=>c.cardId==='dlc_31.png'),id:'alternate'});}]){
 const next=structuredClone(state);transform(next);assert.equal(demand.heldLandingGoal({state:next,seatId,candidates:()=>{throw new Error('irrelevant geometry must not run');},compareTiming}),null);
}
const poor=structuredClone(state);owner(poor).resources.credits=2;owner(poor).resources.energy=1;assert.equal(query(poor),null);
const p=owner(state),facts={...probe.factsFromState(state,p),investment:()=>0},weights=require('../randomizer/game/ai/state-value').DEFAULT_WEIGHTS;
assert.equal(probe.quote(facts,weights).value,probe.quoteValue(facts,weights));
const out={status:'verified',nativeTimingPaths:t.paths.length,recoveredMercuryInputs:proof.restored.length,hiddenAndWalletControls:8,roots:hashes,failureGraphExactIgnoringVersionsAndCounters:true,newAutonomousRuns:0};
console.log(JSON.stringify(out));
