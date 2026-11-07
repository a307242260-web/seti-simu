'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p));
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port');
const {createSearchAgent}=load('randomizer/game/ai/search-agent');
const [source,out]=process.argv.slice(2),ref=read(source),base=ref.rows.orange1.start,seat='player-white',seed='seti-free-analyze-v1';
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const restore=e=>{assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);};
function submit(a){const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
 :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));}
function assets(){const e=save(),s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(q=>q.id===seat),
  v=c.projection({role:'player',playerId:seat}).state;
 return {wallet:p.resources,income:p.income,hand:p.hand.map(h=>[h.id,h.cardId]),data:p.dataState,tech:p.techState,
  probes:s.pieces.rockets.filter(x=>x.playerId===seat),wins:s.data.sectorSettlements.winsByPlayerId[seat],traces:v.selfState.traceCounts,
  projectedFinal:v.publicState.players.find(q=>q.playerId===seat).finalScore};}
const fixed=[];
function act(label,test){
 const options=menu().filter(a=>a.actorId===seat&&test(a));if(options.length!==1)throw Error(label+': '+JSON.stringify(menu().map(a=>[a.family,a.summary,a.target])));
 const a=options[0];submit(a);fixed.push({action:a,assets:assets()});return a;
}
const family=f=>act(f,a=>a.family===f);
const comp=i=>{family('place_data');act('computer'+i,a=>a.family==='choose_target'&&a.summary==='第一排放置位 '+i);};
try{
 restore(base);
 const bonus=ref.rows.orange1.accepted[0].action;
 if(menu().some(a=>a.actionId===bonus.actionId))act('existing public reward',a=>a.actionId===bonus.actionId);
 comp(5);comp(6);family('end_turn');family('analyze');
 act('known blue displayed reward',a=>a.family==='choose_target'&&a.target?.traceType==='blue'&&a.target?.position===3&&a.target?.alienSlotId===1);
 act('take currently displayed',a=>a.family==='choose_card'&&a.target?.source==='display');
 const analysis=assets();assert.equal(analysis.wallet.availableData,2);
 for(const id of ['amiba_2.webp','amiba_5.webp']){
  const card=assets().hand.find(q=>q[1]===id);assert(card,id);act(id,a=>a.family==='card_corner'&&a.target?.cardInstanceId===card[0]);
 }
 for(let i=1;i<=4;i++)comp(i);
 const electricity=assets().hand.find(q=>q[1]==='dlc_25.png');assert(electricity);
 act('insert electricity',a=>a.family==='choose_card'&&a.target?.cardInstanceId===electricity[0]);
 const incomeAt=save(),incomeAssets=assets();
 assert.equal(incomeAssets.income.energy,4);assert.equal(incomeAssets.income.credits,7);assert.equal(incomeAssets.probes.length,1);
 const accepted=[],agent=createSearchAgent({seatId:seat,analysisPort:createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0})});
 let stop=null;
 for(let i=0;i<65;i++){
  const e=save(),r=agent.decide({seatId:seat,legalActions:menu()}),s=r.search,a=menu().find(x=>x.actionId===r.actionId);
  assert.deepEqual(save(),e);
  if(!s.complete||s.unresolved.length||s.diagnostics.nativeExecutions>256||s.rootAndSearchMilliseconds>600){stop={kind:'gate',e,s};break;}
  if(a.family==='pass'){stop={kind:'settled-before-pass',e};break;}
  submit(a);accepted.push({action:a,assets:assets(),value:s.value,native:s.diagnostics.nativeExecutions,ms:s.rootAndSearchMilliseconds});
 }
 assert(stop);const end=assets();restore(base);fixed.forEach(x=>submit(menu().find(a=>a.actionId===x.action.actionId)));assert.deepEqual(save(),incomeAt);
 accepted.forEach(x=>submit(menu().find(a=>a.actionId===x.action.actionId)));assert.deepEqual(save(),stop.e);restore(base);
 const summary={stop:stop.kind,assets:[end.wallet.score,Object.keys(end.tech.ownedTiles).length,end.income.credits,end.income.energy,end.probes.length],projectedFinal:end.projectedFinal};
 fs.writeFileSync(out,JSON.stringify({scope:'Fixed known after-orange1 launch path until electricity income, then candidate completes before PASS. No standard run.',base,fixed,incomeAt,incomeAssets,
  accepted,stop,end,summary,rootAndRngRestored:true,nativeReplayExact:true,newAutonomousRuns:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(summary));
}finally{c.dispose();}
