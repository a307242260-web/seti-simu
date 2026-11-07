'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSeededRandom}=require('../randomizer/game/random');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const data=require('../randomizer/game/data');
const [source,graphFile,out]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const seed='seti-free-analyze-v1',seat='player-white',controlled=read(source).decisionRoots['before-research-income-paid'],q=read(graphFile)['before-research-income-paid'].search;
const native=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});native.newGame({seed});const c=native.composition;
const save=()=>c.lifecycle.save().envelope,restore=()=>{assert(c.lifecycle.restore(controlled.envelope).ok);assert.deepEqual(save(),controlled.envelope);};
const root=()=>JSON.parse(save().committedState),own=s=>s.players.players.find(p=>p.id===seat);
const list=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
const consume=id=>{
 const d=c.inspect().session?.decision,a=list().find(x=>x.actionId===id);assert(a,JSON.stringify({id,legal:list().map(x=>[x.actionId,x.summary])}));
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok);
 return{id,family:a.family,target:a.target,summary:a.summary};
};
const select=fn=>{const a=list().find(fn);assert(a,JSON.stringify(list().map(x=>x.summary)));return consume(a.actionId);};
const lines=new Map(q.lines.map(x=>[x.node,x])),edge=id=>q.lines[0].edges.find(e=>e.resourcePlan?.goal?.id===id);
const scan=edge('scan:sector:sector-3-a'),research=edge('tech:purple1:');
assert(scan&&research);
const path=[...scan.steps];
for(let i=scan.target;;){
 const n=lines.get(i);if(!n.distance)break;
 const e=n.edges.find(e=>{const next=lines.get(e.target);return next?.value===n.value&&next.distance+e.cost===n.distance;});
 assert(e?.steps?.length===e?.cost);path.push(...e.steps);i=e.target;
}
const end=()=>select(a=>a.family==='end_turn'),place=()=>select(a=>a.family==='place_data'),blue=()=>select(a=>a.target?.blueSlot===1),
 scanAction=()=>select(a=>a.family==='scan'),target=()=>select(a=>a.target?.nebulaId===scan.resourcePlan.goal.nebulaId);
function report(){
 const env=save(),s=root(),p=own(s),port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 let value,unrealized;
 try{const n=port.openRoot(),e=createStateValueEvaluator(seat),d=e.details(port.valueObservation(n));value=d.value;unrealized=d.unrealizedPurposeValue;}finally{port.close();}
 assert.deepEqual(save(),env);
 return{env,wallet:p.resources,income:p.income,value,unrealized,hand:p.hand.map(c=>[c.id,c.cardId]),owned:p.techState.ownedTiles,
  pool:p.dataState.poolTokens.map(t=>t.id),blue:data.listBlueBonusPlacedTokens(p).map(t=>t.blueSlot),win:s.data.sectorSettlements.winsByPlayerId[seat]||[],
  turn:s.turn.turnNumber,publicCards:s.cards.publicCards.map(c=>c?.id),rng:s.meta.rngState};
}
const control={};
try{
 restore();let steps=research.steps.map(consume);const firstAction=report();steps.push(end());const researchBoundary=report();
 steps.push(place(),blue());const funded=report();assert.equal(funded.wallet.energy,2);
 steps.push(scanAction(),target(),select(a=>a.actionId===scan.steps.at(-1)));
 const pink2=lines.get(scan.target).edges.find(e=>e.actionId==='choose_target:59bd8770');
 steps.push(...pink2.steps.map(consume));
 const scanSettled=report();steps.push(end());
 if(c.inspect().session?.decision)steps.push(select(a=>a.target?.choiceId?.startsWith('skip:')));
 control.researchFirst={steps,firstAction,researchBoundary,funded,scanSettled,boundary:report()};
 restore();steps=path.map(consume);const scanBoundary=report();
 const payment=steps.filter(a=>a.family==='choose_payment').flatMap(x=>x.target.cardInstanceId?[x.target.cardInstanceId]:[]);
 steps.push(...research.steps.map(consume));const afterResearch=report();steps.push(end());
 if(c.inspect().session?.decision)steps.push(select(a=>a.target?.choiceId?.startsWith('skip:')));
 control.scanFirst={steps,payment,scanBoundary,afterResearch,boundary:report()};
 for(const row of Object.values(control)){
  restore();for(const x of row.steps)consume(x.id);assert.deepEqual(save(),row.boundary.env);row.independentReplayExact=true;
 }
 restore();const proof={source,sourceSha:sha(source),graphFile,graphSha:sha(graphFile),rootRestored:true,control};
 if(out)fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
 for(const [k,v] of Object.entries(control))for(const [n,z] of Object.entries(v))if(z?.env)console.log(k,n,z.turn,z.wallet,z.value,z.hand);
}finally{c.dispose();}
