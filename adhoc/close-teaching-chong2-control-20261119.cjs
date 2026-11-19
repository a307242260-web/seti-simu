'use strict';
// Adjudicate the completed controls; no AI search or Native inputs.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'reports/ai-foundation-20261119');
const read=p=>JSON.parse(fs.readFileSync(path.join(dir,p)));
const pre=read('v486-random20-runtime-preflight-20261119-v1.json');
const prepared=read('teaching-chong2-preparation-20261119-v1.json');
const paired=read('teaching-chong2-order-pair-20261119-v1.json');
const proof=read('teaching-chong2-order-replay-verification-20261119-v1.json');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(proof.status,'complete');assert(proof.verified);assert.equal(proof.verifiedInputs,87);
assert.equal(proof.archiveSha256,hash(fs.readFileSync(path.join(dir,'teaching-chong2-order-replay-20261119-v1.json.gz'))));
for(const [p,h]of Object.entries(pre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(pre.runtime,p))),h,p);
const scoring=require(path.join(pre.runtime,'randomizer/game/end-game-scoring'));
const effects=require(path.join(pre.runtime,'randomizer/game/cards/effects'));
const archive=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,'teaching-chong2-order-replay-20261119-v1.json.gz'))));
function score(envelope){
 const state=structuredClone(envelope.session?.session?.workingState||JSON.parse(envelope.committedState));
 const player=state.players.players.find(p=>p.id==='player-white');
 return scoring.computePlayerFinalScore({...state,cardEffects:effects,getCardTypeCode:c=>effects.getRuntimeCardTypeCode(c,effects.getCardModel(c)?.cardType)},player);
}
const rows=paired.branches.map(b=>{
 const endpoint=archive.branches.find(x=>x.name===b.name),snapshot=b.endpoint.snapshot;
 const player=snapshot.observation.publicState.players.find(p=>p.playerId==='player-white');
 const breakdown=score(endpoint.expectedEnvelope);
 assert.equal(breakdown.totalScore,player.finalScore);
 return{name:b.name,nativeActions:b.actions.length,baseScore:player.score,formalScoreNow:player.finalScore,breakdown,
  income:player.income,resources:{credits:player.credits,energy:player.energy,publicity:player.publicity},
  hand:snapshot.observation.selfState.hand.map(c=>({instanceId:c.id,cardId:c.cardId})),
  modelValue:snapshot.value.total,modelComponents:snapshot.value.components};
});
assert.deepEqual(rows.map(r=>r.formalScoreNow),[218,211,211]);
assert.deepEqual(rows[1].breakdown,rows[2].breakdown);
assert.deepEqual(archive.branches[3].expectedEnvelope,archive.branches[4].expectedEnvelope);
assert.equal(rows[0].breakdown.tileScore-rows[1].breakdown.tileScore,11);
assert.equal(rows[1].breakdown.cardScore-rows[0].breakdown.cardScore,4);
const report={schemaVersion:'seti-teaching-chong2-causal-outcome-v1',sourceCommit:pre.sourceCommit,seed:paired.seed,
 status:'rejected',strategyChanged:false,newFullGames:0,coldSearches:prepared.newAISearches,cold:prepared.cold,
 literalControlInputs:paired.totalLiteralInputs,verificationInputs:proof.verifiedInputs,totalLiteralNativeInputs:proof.totalNativeIncludingControls,
 rows,exactOrderEndpointsEqual:true,rootAndRngRestored:true,allFiveReplayEndpointsVerified:true,
 conclusion:'Both known card-preservation orders are legal, but lose11 tile points and gain4 played-card points at the same completed-purpose boundary. They also retain two fewer cards. Reject a forced scoring-card preservation or ordering patch on this evidence.',
 limits:['These are nonterminal current-asset scores, not new full-game results.','The original income draws an unknown card; its later known identity is not used to choose the root action.','No optimal continuation, all-alternative dominance, or free recovery of terminal conditional card points is claimed.','Same-root old trajectories and the current cold-search suffix differ; their quoted values alone do not establish stale cache or valuation drift.'],
 methodology:{adjudicatedWithinParentDeadline:Date.now()/1000<1795062939,
  firstWindowExpiredBeforePairStarted:true,readOnlyFormatterFailedAndManuallyRecoveredWithoutExtension:true,
  nextResearchSelection:'Return to the earliest material trace/technology asset divergence in the existing teaching trajectories. Do not reopen this rejected forced-preservation route, frozen candidates, or general income forecast tuning without new causal evidence.'},
 evidence:{replayArchive:'teaching-chong2-order-replay-20261119-v1.json.gz',verification:'teaching-chong2-order-replay-verification-20261119-v1.json',diagnostics:'teaching-chong2-control-diagnostics-20261119-v1.json.gz'}};
assert(report.methodology.adjudicatedWithinParentDeadline);
const output=path.join(dir,'teaching-chong2-causal-outcome-20261119-v1.json');assert(!fs.existsSync(output));
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
const diagnostic=path.join(dir,report.evidence.diagnostics);assert(!fs.existsSync(diagnostic));
fs.writeFileSync(diagnostic,zlib.gzipSync(JSON.stringify({prepared,paired})));
const routePath=path.join(dir,'teaching-chong2-purpose-route-20261119-v1.json'),route=read(path.basename(routePath));
assert.equal(route.status,'open');route.status='rejected';route.closedEpochSeconds=Date.now()/1000;
route.outcome=path.basename(output);route.strategyChanged=false;route.totalLiteralNativeInputs=174;route.newFullGames=0;
fs.writeFileSync(routePath,JSON.stringify(route,null,2)+'\n');
console.log(JSON.stringify({status:report.status,scores:rows.map(r=>r.formalScoreNow),tileDelta:-11,cardDelta:4,totalLiteralNativeInputs:174,newFullGames:0}));
