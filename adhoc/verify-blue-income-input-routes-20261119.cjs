'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),directory=path.join(repo,'reports/ai-foundation-20261119');
const m=JSON.parse(fs.readFileSync(path.join(directory,'blue-income-forecast-prototype-preflight-20261119-v2.json'))),r=m.runtime;
const values=require(path.join(r,'randomizer/game/ai/state-value')),demand=require(path.join(r,'randomizer/game/ai/resource-demand'));
const outcome=require(path.join(r,'randomizer/game/ai/outcome-model'));
const {createSeededRandom}=require(path.join(r,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(r,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(r,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(r,'randomizer/game/ai/analysis-port'));
const seed='seti-free-analyze-v1',seatId='player-white',random=createSeededRandom(seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const k=createSimulationRuleComposition({seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)}),c=k.composition;
const report={newNativeInputs:0,newAISearches:0,productionChanged:false,routes:[],syntheticMoneyGrid:{scope:'unit-only wallets derived from the exact after-DLC37 observation, not additional legal game states',checks:0,failures:[]}};
let port;
try{
 c.lifecycle.newGame({seed,activePlayerCount:4,initialize:true,rngState});
 const env=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(directory,'r2-blue-cash-continued-blue1-after-dlc37-checkpoint-20261119-v1.json.gz')))).envelope;
 assert(c.lifecycle.restore(env).ok);
 port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});const root=port.openRoot(),raw=root.observation;
 const formal=outcome.createDecisionObservation(raw,{seatId,stateVersion:root.legalActions[0].stateVersion,decisionVersion:root.legalActions[0].decisionVersion});
 const full=values.evaluateStateValue(raw,seatId),compact=values.evaluateStateValue(port.valueObservation(root),seatId);
 assert.deepEqual(values.evaluateStateValue(formal,seatId),full);assert.deepEqual(compact,full);assert.equal(full.total,99.5);
 const state=JSON.parse(env.committedState),owner=state.players.players.find(p=>p.id===seatId);
 const actualCapital=demand.planningCapital(state,owner);
 const keys=['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential','finalMarkPotential'];
 assert.equal(actualCapital,values.sumValueParts(keys.map(key=>full.components[key])));
 assert.equal(actualCapital,3.5);assert.equal(port.getDiagnostics().submissionCount,0);
 report.routes.push({full:full.total,formal:full.total,compact:compact.total,statePurpose:actualCapital,analysisPotential:full.components.analysisPotential});
 const grid=new Map();
 for(let credits=0;credits<=6;credits++)for(let energy=0;energy<=6;energy++)for(let publicity=0;publicity<=11;publicity++){
  const o=structuredClone(raw),p=o.publicState.players.find(p=>p.playerId===seatId);
  Object.assign(p,{credits,energy,publicity});grid.set(`${credits}:${energy}:${publicity}`,values.evaluateStateValue(o,seatId).total);
 }
 for(let credits=0;credits<=6;credits++)for(let energy=0;energy<=6;energy++)for(let publicity=0;publicity<=11;publicity++){
  const before=grid.get(`${credits}:${energy}:${publicity}`);
  for(const [c,e,p]of [[credits+1,energy,publicity],[credits,energy+1,publicity],[credits,energy,publicity+1]]){
   const after=grid.get(`${c}:${e}:${p}`);if(after===undefined)continue;report.syntheticMoneyGrid.checks++;
   if(after<before-1e-9)report.syntheticMoneyGrid.failures.push({before:{credits,energy,publicity,value:before},after:{credits:c,energy:e,publicity:p,value:after}});
  }
 }
 report.syntheticMoneyGrid.wallets=grid.size;assert.equal(report.syntheticMoneyGrid.failures.length,0);
 assert.deepEqual(c.lifecycle.save().envelope,env);report.rootAndRngPreserved=true;report.passed=true;
}catch(error){report.error={name:error.name,message:error.message.slice(0,2000),stack:error.stack.split('\n').slice(-8).join('\n')};report.passed=false;}
finally{port?.close();c.dispose();}
const output=path.join(directory,'blue-income-forecast-input-routes-20261119-v1.json');assert(!fs.existsSync(output));fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
