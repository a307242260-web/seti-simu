'use strict';

const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {searchDecision}=require('../randomizer/game/ai/decision-search');
const {createStateValueEvaluator}=require('../randomizer/game/ai/state-value');
const localPlans=require('../randomizer/game/ai/local-decision-plans');
const agent=require('../randomizer/game/ai/search-agent');
const [rootDir,out]=process.argv.slice(2);
const read=p=>JSON.parse(fs.readFileSync(p));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

function pair(step){
  const fixture=rootDir+'/v372-actual-r3-before-'+step+'-root-20261107-v1.json',f=read(fixture),seed=f.source.seed,seat=f.seatId;
  const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
    projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
  k.newGame({seed});const c=k.composition;
  const p=()=>createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
  const save=()=>c.lifecycle.save().envelope;
  const run=(mode,envelope)=>{
    assert(c.lifecycle.restore(envelope).ok);assert.deepEqual(save(),envelope);
    const port=p(),e=createStateValueEvaluator(seat),t=performance.now();
    try{
      const root=port.openRoot(),withQuote=mode==='active';
      const r=searchDecision({port:withQuote?port:{...port,deferredSectorPublicityQuote:()=>null},root,evaluate:e,modelKey:e.modelKey,budget:agent.BUDGET,...agent.OPTIONS});
      const milliseconds=performance.now()-t;assert(r.complete&&!r.unresolved.length&&r.diagnostics.nativeExecutions<=256&&milliseconds<=600);
      assert.deepEqual(save(),envelope);
      const red=r.roots.find(x=>x.goal?.id==='scan:sector:sector-3-a');
      return {mode,milliseconds,value:r.value,action:r.actionId,nativeInputs:r.diagnostics.nativeExecutions,redValue:red?.value,
        quotes:r.lines.filter(l=>l.deferredSectorPublicity).map(l=>l.deferredSectorPublicity),
        physicalEdges:r.lines.map(l=>[l.status,l.edges.map(e=>[e.actionId,e.target,e.cost,e.steps])]),raw:r};
    }finally{port.close();}
  };
  try{
    const before=run('disabled',f.compositionEnvelope),after=run('active',f.compositionEnvelope);
    assert.equal(before.nativeInputs,after.nativeInputs);
    assert.deepEqual(before.physicalEdges,after.physicalEdges);
    const extra=[];
    if(step===182){
      assert.equal(before.action,'research_tech:806ccfc8');assert.equal(before.value,165);
      assert.equal(after.action,'quick_trade:a39c1a77');assert.equal(after.value,166);
      assert(after.quotes.every(x=>x.value===1.5&&x.afterFirst===4&&x.afterClaim===7));
      const e=structuredClone(f.compositionEnvelope),s=JSON.parse(e.committedState);
      const pile=s.cards.drawPileCardIds;
      assert.notEqual(pile[0],pile[1]);
      [pile[0],pile[1]]=[pile[1],pile[0]];
      e.committedState=JSON.stringify(s);
      const masked=run('active',e);
      assert.deepEqual(masked.quotes,after.quotes);assert.equal(masked.action,after.action);assert.equal(masked.value,after.value);
      extra.push(masked);
    } else assert.equal(after.action,before.action);
    return {step,fixture,fixtureSha256:sha(fixture),before,after,extra};
  }finally{c.dispose();}
}
const rows=[179,182,188].map(pair);
const result={rows,rootAndRngRestored:true,unchangedPhysicalSearchGraphs:true,newAutonomousRuns:0};
if(out)fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(rows.map(x=>({step:x.step,old:x.before.action,next:x.after.action,oldValue:x.before.value,newValue:x.after.value,native:x.after.nativeInputs,ms:x.after.milliseconds}))));
