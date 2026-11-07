'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),load=p=>require(path.resolve('randomizer',p));
const [sourcePath,outPath]=process.argv.slice(2),source=read(sourcePath),manifestPath='reports/ai-foundation-20261107/v358-swap-with-trace-prepaid-v1/source-manifest-20261107-v1.json',manifest=read(manifestPath);
for(const [p,h]of Object.entries({...manifest.baseRuntimeHashes,...manifest.sourceHashes}))assert.equal(sha(p),h,p);
assert.equal(sha(source.fixture),source.fixtureSha256);assert.equal(sha(source.acceptance),source.acceptanceSha256);
const fixture=read(source.fixture),seed=fixture.source.seed,seat=fixture.seatId;
const {createSimulationRuleComposition}=load('training/simulation-rule-composition'),{createSeededRandom}=load('game/random'),{buildRuleObservation}=load('app/rule-observation'),values=load('game/ai/state-value'),data=load('game/data'),deck=load('game/cards/deck'),plans=load('game/ai/local-decision-plans');
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
const save=()=>c.lifecycle.save().envelope,state=()=>{const e=save();return e.session?.session?.workingState||JSON.parse(e.committedState);},menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({}),actor=()=>state().players.players.find(p=>p.id===seat);
let nativeInputs=0;
function snapshot(){const s=state(),p=actor(),o=c.projection({role:'player',playerId:seat}).state,score=o.publicState.players.find(x=>x.playerId===seat),v=values.evaluateStateValue(o,seat);return {score:score.score,final:score.finalScore,value:v.total,debt:v.purposePreparationDebt,round:s.turn.roundNumber,turn:s.turn.turnNumber,resources:p.resources,computer:data.listComputerPlacedTokens(p).map(t=>t.placementSlot),blue:data.listBlueBonusPlacedTokens(p).map(t=>t.blueSlot),hand:p.hand.map(c=>c.cardId),rng:s.meta.rngState};}
function take(f,match=()=>true,route){const as=menu().filter(a=>a.family===f&&a.actorId===seat&&match(a));assert.equal(as.length,1,f+' '+JSON.stringify(menu().map(a=>a.target)));const a=as[0],d=c.inspect().session?.decision;
 const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(result.ok,JSON.stringify(result));nativeInputs++;route.push({id:a.actionId,family:f,target:a.target});}
function dataTo(slot,route){take('place_data',undefined,route);take('choose_target',a=>slot===null?a.target?.target==='computer':a.target?.target==='blueBonus'&&a.target.blueSlot===slot,route);}
function corner(cardId,route){const found=actor().hand.find(c=>c.cardId===cardId);assert(found);const r=deck.getDiscardActionRewardForCard(found);assert.equal(r.dataCount,1);take('card_corner',a=>a.target.cardInstanceId===found.id&&a.payload.kind==='resource',route);}
function finish(route){take('end_turn',undefined,route);while(c.inspect().session?.decision){const actions=menu();assert(actions.every(a=>a.target?.choiceId?.startsWith('final:')));const chosen=plans.finalMark({state:state(),seatId:seat,actions});take('choose_target',a=>a.actionId===chosen.selectedActionId,route);}}
try{
 const results=[];
 for(const [index,x]of source.counts.picks.entries()){
  assert.equal(x.action.choiceId,'amiba:display:5');assert(x.knownAlienAcquisition);assert.equal(x.opaque,0);assert(c.lifecycle.restore(x.envelope).ok);assert.deepEqual(save(),x.envelope);
  const before=snapshot(),prefix=[];for(let i=0;i<3;i++)dataTo(null,prefix);
  assert.deepEqual(snapshot().computer,[1,2,3]);const prepared=save(),afterPrefix=snapshot(),branches=[];
  const rows=afterPrefix.resources.availableData===0?[
   ['end',[]],['b111-blue1',[['b_111.webp',1]]],['amiba5-blue1',[['amiba_5.webp',1]]],['b111-blue1-amiba5-blue2',[['b_111.webp',1],['amiba_5.webp',2]]],['amiba5-blue1-b111-blue2',[['amiba_5.webp',1],['b_111.webp',2]]],
  ]:[['pool-blue1',[[null,1]]],['pool-blue1-b111-blue2',[[null,1],['b_111.webp',2]]],['pool-blue1-amiba5-blue2',[[null,1],['amiba_5.webp',2]]]];
  for(const [name,steps]of rows){assert(c.lifecycle.restore(prepared).ok);const route=[];for(const [id,slot]of steps){if(id)corner(id,route);dataTo(slot,route);}const preEnd=snapshot();finish(route);const end=snapshot();assert.deepEqual(end.rng,before.rng);assert.equal(end.round,4);branches.push({name,route,preEnd,end});}
  results.push({index,before,prefix,afterPrefix,branches});
 }
 assert(c.lifecycle.restore(fixture.compositionEnvelope).ok);assert.deepEqual(save(),fixture.compositionEnvelope);
 const out={scope:'Eight Native known-Amiba5 continuations after landing; independent legal pure and mixed data corners, fixed blue placements, and End. No AI search or unknown card use.',sourcePath,sourceSha256:sha(sourcePath),manifestPath,manifestSha256:sha(manifestPath),results,nativeInputs,rootAndRngRestored:true,newAutonomousRuns:0};
 fs.writeFileSync(outPath,JSON.stringify(out)+'\n',{flag:'wx'});console.log(JSON.stringify({nativeInputs,rows:results.map(r=>[r.index,r.before.value,r.afterPrefix.value,r.branches.map(b=>[b.name,b.end.value,b.end.score,b.route.length])])}));
}finally{c.dispose();}
