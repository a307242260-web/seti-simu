'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),z=require('node:zlib');
const [base,output,...args]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p)),raw=p=>JSON.parse(z.gunzipSync(fs.readFileSync(p)));
const file=require.resolve('../randomizer/game/ai/resource-demand');
function load(body){const m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(body,file);m.loaded=true;return m;}
const old=load(fs.readFileSync(base,'utf8')).exports;
const a='    if(!offered.length)return[];';let s=fs.readFileSync(file,'utf8');assert.equal(s.split(a).length,2);
s=s.replace('    // This is the exceptional-card fallback,','    const originalOffers=offered;\n    // This is the exceptional-card fallback,').replace(a,'    globalThis.__setiV395Screen(state,seatId,outgoing,originalOffers,offered,knownSourceCapital);\n'+a);
const m=load(s);require.cache[file]=m;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),{createStateValueEvaluator}=require('../randomizer/game/ai/state-value'),{searchDecision}=require('../randomizer/game/ai/decision-search'),{BUDGET,OPTIONS}=require('../randomizer/game/ai/search-agent');
const report={};
function normalize(x){return JSON.parse(JSON.stringify(x,(k,v)=>k==='milliseconds'?undefined:typeof v==='string'?v.replace(/seti-complete-decision-search-v(?:394|395|396|397)/g,'V'):v));}
for(let i=0;i<args.length;i+=3){
 const [label,fixture,ref]=args.slice(i,i+3),f=read(fixture),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});
 const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
 const rows=[];
 globalThis.__setiV395Screen=(state,seatId,outgoing,original,retained,known)=>{
  const previous=old.knownSwapPortfolioQuotes({state,seatId,outgoing,offered:original},known);
  const u=state.players.players.find(p=>p.id===seatId);
  rows.push({round:state.turn.roundNumber,mainCompleted:u.mainActionCompleted,wallet:u.resources,hand:u.hand.map(c=>[c.id,c.cardId,c.hidden]),
   outgoing:{id:outgoing.id,cardId:outgoing.cardId},known,previous:previous.map(r=>({cardId:r.card.cardId,id:r.card.id,gain:r.gain,kept:retained.includes(r.card)}))});
 };
 try{
  const evaluate=createStateValueEvaluator(f.seatId),r=searchDecision({port:p,root:p.openRoot(),evaluate,modelKey:evaluate.modelKey,budget:BUDGET,...OPTIONS});
  assert(r.complete);assert.deepEqual(normalize(r),normalize(raw(ref)));assert.deepEqual(c.lifecycle.save().envelope,before);
  const quotes=rows.flatMap(r=>r.previous),omitted=quotes.filter(q=>!q.kept),positive=quotes.filter(q=>q.gain>0);
  assert(omitted.every(q=>q.gain<=0));
  report[label]={fullGraphEqual:true,nativeInputs:r.diagnostics.nativeExecutions,quotes:quotes.length,omitted:omitted.length,positive:positive.length,rows};
  console.log(label,quotes.length,omitted.length,positive.length);
 }finally{p.close();c.dispose();}
}
delete globalThis.__setiV395Screen;
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
