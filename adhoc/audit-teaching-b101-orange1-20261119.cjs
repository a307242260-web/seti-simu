'use strict';
// Execute the exact existing winner, then replay it independently. No search.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119'),seat='player-white';
const read=p=>JSON.parse(fs.readFileSync(path.join(dir,p)));
const pre=read('v486-random20-runtime-preflight-20261119-v1.json'),rt=pre.runtime;
const probe=read('teaching-tech-root127-probe-20261119-v1.json');assert(probe.cold.gatePassed);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const [p,h]of Object.entries(pre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(rt,p))),h,p);
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port'));
const rule=require(path.join(rt,'randomizer/game/rule-composition')),value=require(path.join(rt,'randomizer/game/ai/state-value'));
const random=createSeededRandom(probe.seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed:probe.seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,probe.seed,v?.playerId)});
const output=path.join(dir,'teaching-b101-orange1-native-audit-20261119-v1.json');assert(!fs.existsSync(output));
const report={schemaVersion:'seti-teaching-b101-native-audit-v1',sourceCommit:pre.sourceCommit,seed:probe.seed,status:'running',
 priorRouteNativeInputs:181,nativeInputs:0,controlInputs:0,verificationInputs:0,newAISearches:0,newFullGames:0,actions:[],steps:[]};
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');persist();
const envelope=()=>c.lifecycle.save().envelope;
function legal(){const x=c.inspect();return x.phase==='awaiting_input'?x.session.decision.choices:c.inputPort.enumerateActions({});}
function submit(action,verification=false){
 assert(action?.actorId===seat,'Existing winner action unavailable');assert(report.priorRouteNativeInputs+report.nativeInputs<220);
 const x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null;
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:action}):action.phase==='quick'?c.inputPort.submitQuickAction(action):c.inputPort.submitAction(action);
 assert(r.ok,JSON.stringify(r));report.nativeInputs++;
 if(verification)report.verificationInputs++;else{report.controlInputs++;report.actions.push(action);}
 report.lastEnvelope=envelope();report.nextLegal=legal();persist();
}
function snapshot(){
 const before=envelope(),port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 try{
  const root=port.openRoot(),raw=root.observation;
  const projected=rule.sanitizeHiddenInformationObservation(probe.rootObservation,raw,{code:'hidden_card_reveal'});
  const result={rawObservation:raw,rawValue:value.evaluateStateValue(raw,seat),projectedObservation:projected,projectedValue:value.evaluateStateValue(projected,seat)};
  assert.deepEqual(envelope(),before);return result;
 }finally{port.close();}
}
try{
 c.lifecycle.newGame({seed:probe.seed,activePlayerCount:4,initialize:true,rngState});
 const root=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(repo,probe.rootPath)))).envelope;
 assert(c.lifecycle.restore(root).ok);assert.deepEqual(envelope(),root);
 for(const id of ['play_card:52a456f8','choose_target:0953ea6c','choose_card:56497dc2','accept_optional_effect:8e86c549','choose_target:f9078fd1']){
  submit(legal().find(a=>a.actionId===id));report.steps.push({input:report.controlInputs,snapshot:snapshot()});persist();
 }
 submit(legal().find(a=>a.family==='place_data'));
 submit(legal().find(a=>a.family==='choose_target'&&a.target?.blueSlot===2));
 submit(legal().find(a=>a.family==='end_turn'));
 submit(legal().find(a=>a.family==='choose_target'&&a.target?.tileId==='b'));
 assert.equal(report.controlInputs,9);
 const expected=envelope();report.endpoint=snapshot();report.quote=probe.search.value;
 report.quoteMatchesProjected=report.endpoint.projectedValue.total===report.quote;
 const archive={schemaVersion:'seti-native-paired-income-control-v1',sourceCommit:pre.sourceCommit,seed:probe.seed,
  sourceRuntimePreflight:'reports/ai-foundation-20261119/v486-random20-runtime-preflight-20261119-v1.json',nativeInputsAlreadyExecuted:190,frozenOpponentPolicy:'pass-only',
  branches:[{name:'actual-b101-orange1-winner',rootEnvelope:root,actions:report.actions,expectedEnvelope:expected}]};
 const file=path.join(dir,'teaching-b101-orange1-native-replay-20261119-v1.json.gz');assert(!fs.existsSync(file));fs.writeFileSync(file,zlib.gzipSync(JSON.stringify(archive)));
 assert(c.lifecycle.restore(root).ok);assert.deepEqual(envelope(),root);
 for(const desired of report.actions){
  const action=legal().find(a=>a.actionId===desired.actionId);assert.deepEqual(action,desired);submit(action,true);
 }
 assert.deepEqual(envelope(),expected);
 report.status=report.quoteMatchesProjected?'verified-quote-exact':'verified-native-quote-difference';
 report.nativeEnvelopeAndRngVerified=true;report.totalRouteNativeInputs=181+report.nativeInputs;persist();
 console.log(JSON.stringify({status:report.status,quote:report.quote,projectedValue:report.endpoint.projectedValue,rawValue:report.endpoint.rawValue,
  controlInputs:report.controlInputs,verificationInputs:report.verificationInputs,totalRouteNativeInputs:report.totalRouteNativeInputs,
  player:report.endpoint.projectedObservation.publicState.players.find(p=>p.playerId===seat)}));
}catch(error){report.status='failed';report.failure={message:error.message,stack:error.stack};persist();console.error(error.stack);process.exitCode=1;}
finally{c.dispose();}
