'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const seat='player-white';
const file=path.join(__dirname,'../reports/ai-foundation-20261113/prepass-funded-landing/r3-fossil-retention-replay-20261113-v1.json.gz');
const {check}=JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
for(const row of check){
  const seed=JSON.parse(row.root.committedState).meta.seed;
  const kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4});
  kernel.newGame({seed});
  const c=kernel.composition,save=()=>c.lifecycle.save().envelope;
  try{
    for(const [label,run] of Object.entries(row.runs)){
      const restore=c.lifecycle.restore(row.root);
      assert(restore.ok);assert.deepEqual(save(),row.root);
      const [bank,use,entry,after,next]=row.checkpoints;
      const checkpoints=label==='bank'?[[bank,row.prePass.bank]]
        :[[use,row.prePass.use],...(label==='use'||label==='before'?[[entry,row.entry]]:[]),
          ...(label==='after'?[[after,row.postScan],[after+row.fixedActions.length,row.afterFixed]]:[]),
          ...(label==='next'?[[next,row.nextRoot]]:[])];
      for(const [i,expected] of run.inputs.entries()){
        for(const [offset,envelope] of checkpoints)if(offset===i)assert.deepEqual(save(),envelope);
        const decision=c.inspect().session?.decision;
        const action=(decision?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===expected.actionId);
        assert.deepEqual(action,expected);
        if(action.actorId!==seat)assert(['pass','choose_card','choose_payment'].includes(action.family));
        const result=decision?c.inputPort.submitDecision({decisionId:decision.decisionId,decisionVersion:decision.decisionVersion,ownerId:decision.ownerId,choice:action})
          :action.phase==='quick'?c.inputPort.submitQuickAction(action):c.inputPort.submitAction(action);
        assert(result.ok,JSON.stringify(result.failure||result));
      }
      const end=save(),s=JSON.parse(end.committedState);
      assert.deepEqual(end,run.end);assert.equal(end.session,null);assert(s.turn.gameEnded);
      assert.equal(s.match.finalScores.find(p=>p.playerId===seat).totalScore,run.score);
    }
    assert.deepEqual(row.runs.bank.end,row.runs.use.end);
    assert.deepEqual(row.runs.after.end,row.runs.next.end);
    console.log(row.reserve,Object.fromEntries(Object.entries(row.runs).map(([label,x])=>[label,x.score])));
  }finally{c.dispose();}
}
