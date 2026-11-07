'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zip=require('node:zlib');
const root=process.cwd(),load=n=>require(path.join(root,n)),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const {createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition'),{createSeededRandom}=load('randomizer/game/random'),{buildRuleObservation}=load('randomizer/app/rule-observation'),rules=load('randomizer/game/production-kernel'),{passiveAgent}=load('tools/research-human405-round1'),probe=load('randomizer/game/ai/probe-capital'),v=load('randomizer/game/ai/state-value');
const D='reports/ai-foundation-20261107/committed-computer-recovery-v323-v1/',source=D+'v323-known-free-landing-native-20261107-v1.json',launch=read(source),cold=read(launch.cold),f=read(launch.fixture),seat=f.seatId,seed=f.source.seed;
assert.equal(sha(launch.cold),launch.coldSha256);assert.equal(sha(launch.fixture),launch.fixtureSha256);assert.equal(sha(cold.rawPath),cold.rawSha256);
const raw=JSON.parse(zip.gunzipSync(fs.readFileSync(cold.rawPath)));
const scan=raw.lines[0].edges.find(e=>e.resourcePlan?.goal.id==='scan:sector:sector-2-a');assert(scan);assert.equal(scan.actionId,raw.actionId);
const blue=raw.lines[scan.target].edges[0];assert.equal(blue.resourcePlan.goal.id,'data:blue:1');
const end=raw.lines[blue.target].edges[0];assert.equal(end.actionId,'end_turn:b2f9b29d');
const knownScanIds=[...scan.steps,...blue.steps,end.actionId];assert.equal(knownScanIds.length,9);
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;
const env=()=>c.lifecycle.save().envelope,state=()=>{const e=env();return e.session?.session?.workingState||JSON.parse(e.committedState);};
const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});const actions=[];
function act(id){
 const aa=menu().filter(x=>x.actionId===id);assert.equal(aa.length,1,id);
 const a=aa[0],d=c.inspect().session?.decision;
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok);actions.push({id,family:a.family,actor:a.actorId,target:a.target});
}
try{
 assert(c.lifecycle.restore(f.compositionEnvelope).ok);const original=env();
 for(const id of knownScanIds)act(id);
 const afterScan=env();
 for(let i=0;i<10;i++){
  const s=state(),d=c.inspect().session?.decision,owner=d?.ownerId||s.turn.currentPlayerId;
  if(owner===seat)break;
  act(passiveAgent(owner).decide({legalActions:menu().filter(a=>a.actorId===owner),observation:c.projection({role:'player',playerId:owner}).state}).actionId);
 }
 assert.equal(state().turn.currentPlayerId,seat);
 act(menu().find(a=>a.actorId===seat&&a.family==='launch').actionId);
 const s=state(),p=s.players.players.find(p=>p.id===seat),target=rules.getProbeRouteRequirements(s,seat).candidates.find(q=>q.endpointFamily==='land'&&q.planetId==='jupiter'&&q.endpointTarget.type==='planet');
 assert.equal(target.required.paidMovementPoints,3);
 assert.equal(p.resources.credits,4);assert.equal(p.resources.energy,1);
 const need={credits:1,energy:target.required.paidMovementPoints},pay=probe.funding(p.resources,need,v.DEFAULT_WEIGHTS);assert(!pay);
 const afterScanThenLaunch={envelope:env(),wallet:p.resources,knownHand:p.hand.map(c=>[c.id,c.cardId]),target,need,canRetainBothAndPayForNamedLandingFromCurrency:false};
 assert(c.lifecycle.restore(original).ok);assert.deepEqual(env(),original);
 const r={scope:'One tied V323 scan root edge plus its recorded blue-slot and end-turn continuation, then a standard launch. Same saved blue1 start as launch-first Native proof. Holds both named cards and quotes only native currency; excludes later replenishment or using a card as payment.',source,sourceSha256:sha(source),cold:launch.cold,coldSha256:launch.coldSha256,afterScan,afterScanThenLaunch,launchFirstEndpoint:launch.landed.wallet,actions,newNativeInputs:actions.length,newAiQueries:0,newAutonomousRuns:0};
 const out=D+'v323-scan-vs-held-landing-native-20261107-v1.json';fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({out,actions:actions.length,scanLaunchWallet:p.resources,need,launchFirstEndpoint:launch.landed.wallet}));
}finally{c.dispose();}
