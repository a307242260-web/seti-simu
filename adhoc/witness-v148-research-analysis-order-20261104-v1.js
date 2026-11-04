'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),v=require('../randomizer/game/ai/state-value');
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),evidence='reports/ai-foundation-20261023/human405-v148-cold-serial-teacher-092-20261104-v1.json',ev=read(evidence),f=read(ev.fixture),raw=JSON.parse(z.gunzipSync(fs.readFileSync(ev.rawPath))),lines=new Map(raw.lines.map(l=>[l.node,l])),seed=f.source.seed,out='reports/ai-foundation-20261104/two-rounds-teacher-v2/v148-research-analysis-order-native-20261104-v1.json';assert(!fs.existsSync(out));
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition,legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function submit(a){assert(a,'native action unavailable');const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));return{actionId:a.actionId,family:a.family,target:a.target};}
function snapshot(){const e=c.lifecycle.save().envelope,s=e.session?.session?.workingState||JSON.parse(e.committedState),p=s.players.players.find(p=>p.id==='player-white'),o=c.projection({role:'player',playerId:p.id}).state;return{resources:p.resources,income:p.income,technology:p.techState,data:p.dataState,hand:p.hand.map(c=>c.cardId),value:v.evaluateStateValue(o,p.id),envelope:e};}
const rows=[];
try{for(const first of lines.get(0).edges.filter(e=>e.actionId.startsWith('analyze:')||e.resourcePlan?.goal?.tileId==='blue1')){
 assert(c.lifecycle.restore(f.compositionEnvelope).ok);const name=first.resourcePlan?'research-first':'analyze-first',steps=[];let e=first,n;
 while(e){steps.push(...(e.steps||[e.actionId]).map(id=>submit(legal().find(a=>a.actionId===id))));n=lines.get(e.target);e=(n.edges||[]).filter(e=>lines.get(e.target)?.value===n.value).sort((a,b)=>(a.cost+lines.get(a.target).distance)-(b.cost+lines.get(b.target).distance))[0];}
 assert.equal(n.status,'turn-tail-value');for(const tile of n.planSummary.markedTiles)steps.push(submit(legal().find(a=>a.target?.tileId===tile)));const afterFirst=snapshot();assert.equal(afterFirst.value.total,n.value);
 const continuation=[];
 if(name==='research-first'){
  continuation.push(submit(legal().find(a=>a.family==='analyze')));continuation.push(submit(legal().find(a=>a.target?.alienSlotId===1&&a.target?.traceType==='blue')));
 }else{
  continuation.push(submit(legal().find(a=>a.family==='research_tech')));continuation.push(submit(legal().find(a=>a.target?.tileId==='blue1'&&a.target?.blueSlot===2)));
 }
 const beforeTail=snapshot(),p=beforeTail.envelope.session?.session?.workingState||JSON.parse(beforeTail.envelope.committedState),player=p.players.players.find(p=>p.id==='player-white');
 // Only the already-known blue2 slot1 payoff is taken; other data allocations
 // remain visible rather than inventing a successor or running a new search.
 if(name==='research-first')for(const target of ['computer','blueBonus']){
  continuation.push(submit(legal().find(a=>a.family==='place_data')));continuation.push(submit(legal().find(a=>a.target?.target===target&&(target==='computer'||a.target.blueSlot===1))));
 }
 continuation.push(submit(legal().find(a=>a.family==='end_turn')));const afterBoth=snapshot();rows.push({name,firstSearchValue:n.value,steps,afterFirst,continuation,beforeTail,afterBoth});
 }
 assert(c.lifecycle.restore(f.compositionEnvelope).ok);assert.deepEqual(c.lifecycle.save().envelope,f.compositionEnvelope);fs.writeFileSync(out,JSON.stringify({sourceCommit:'7da81a85e675bd08abe393108450a6d0cb7510c7',evidence,evidenceSha256:sha(evidence),fixture:ev.fixture,fixtureSha256:sha(ev.fixture),rawPath:ev.rawPath,rawSha256:sha(ev.rawPath),rows,originalRootAndRngUnchanged:true,goalStatus:'active',goalAchieved:false,scope:'Two explicit native main-action orders at teacher input92. Recorded complete one-turn witnesses reused; no new search. The analyze-first second-turn data tail is left visible for separate optimal allocation proof.',sourceHashes:Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).map(p=>[p.slice(process.cwd().length+1),sha(p)]))},null,2)+'\n');console.log(JSON.stringify(rows.map(r=>({name:r.name,afterFirst:r.afterFirst.value,afterBoth:r.afterBoth.value,resources:r.afterBoth.resources,data:r.afterBoth.data}))));
}finally{c.dispose();}
