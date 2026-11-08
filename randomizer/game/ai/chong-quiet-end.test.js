'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition');
const {createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const {createAnalysisPort}=require('./analysis-port'),{createSearchAgent}=require('./search-agent'),value=require('./state-value');
const f=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/chong-quiet-end-r3-20261109-v1.json.gz'))));
const seat='player-white',seed=JSON.parse(f.root.committedState).meta.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
k.newGame({seed});
const c=k.composition,save=()=>c.lifecycle.save().envelope,make=()=>createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
function restore(e){assert(c.lifecycle.restore(e).ok);assert.deepEqual(save(),e);}
function configure(p){p.setResourcePlanning(true);p.setMovementPlanning(true);p.setCardPickPlanning(true);
  p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});}
const signature=q=>({actionId:q.actionId,value:q.value,realization:q.realization,preparationDebt:q.preparationDebt,
  roots:q.roots.map(r=>[r.actionId,r.value,r.realization,r.preparationDebt])});
try{
  restore(f.root);
  const p=make();
  try{
    const q=createSearchAgent({seatId:seat,analysisPort:p}).decide({seatId:seat,legalActions:c.inputPort.enumerateActions({})}).search;
    assert(q.complete&&!q.unresolved.length);assert.deepEqual(JSON.parse(JSON.stringify(signature(q))),f.baseline);
    assert(f.nativeInputsBefore>256&&q.diagnostics.nativeExecutions<=256);
    assert(q.lines.some(l=>l.edges?.some(x=>x.turnTailPlanValue?.publicChongPlainEnd)));
    assert.deepEqual(save(),f.root);
  }finally{p.close();}
  for(const [name,e] of Object.entries({plain:f.plain,pending:f.pending,cargo:f.cargo})){
    restore(e);
    const p=make();
    try{
      configure(p);const root=p.openRoot(),spec=p.turnTailSummary(root,'end-turn');
      if(name!=='plain'){assert.equal(spec,null,name+' must continue through Native');continue;}
      assert(spec?.publicChongPlainEnd);
      const evaluate=value.createStateValueEvaluator(seat),base=evaluate.details(p.valueObservation(root));
      let end=p.expand(root,spec.firstActionId),inputs=1;
      while(end.status==='decision'){
        const fixed=p.localDecisionSpec(end);assert.equal(fixed?.kind,'fixed-final-mark');
        end=p.expand(end,fixed.selectedActionId);inputs++;
      }
      const after=evaluate.details(p.valueObservation(end));
      assert.equal(inputs,spec.requiredNativeInputs);
      assert.equal(after.value,value.sumValueParts([base.value,spec.netGain]));
      assert.equal(after.unrealizedPurposeValue-base.unrealizedPurposeValue,spec.unrealizedPurposeDelta);
      assert.equal(after.purposePreparationDebt,base.purposePreparationDebt);
      assert.deepEqual(save(),e);
    }finally{p.close();}
  }
}finally{c.dispose();}
