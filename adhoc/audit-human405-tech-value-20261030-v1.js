'use strict';
// Attribute existing completed searches by replaying one native input per retained
// technology. No new search, future rollout, value adjustment or game execution.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const values=require('../randomizer/game/ai/state-value');
const {createCardPickPlanner}=require('../randomizer/game/ai/card-pick-planning');
const science=require('../randomizer/game/effects/science-session');
const output='reports/ai-foundation-20261023/human405-tech-value-diagnostic-20261030-v1.json';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const priorPath='reports/ai-foundation-20261023/human405-teacher-v44-audit-20261029-v1.json';
const prior=JSON.parse(fs.readFileSync(priorPath));
for(const [p,h]of Object.entries(prior.sourceHashes))assert.equal(sha(fs.readFileSync(p)),h,p);
if(fs.existsSync(output)){const saved=JSON.parse(fs.readFileSync(output));assert.equal(saved.priorAuditSha256,sha(fs.readFileSync(priorPath)));assert.equal(saved.status,'complete');console.log('Reuse '+output);process.exit(0);}
const report={schemaVersion:'seti-human405-tech-value-diagnostic-v1',status:'running',priorAuditPath:priorPath,priorAuditSha256:sha(fs.readFileSync(priorPath)),sourceCommit:'8c715275919b89cb32354fdf8d09fbc79d6213a8',scope:'Attribution of three existing completed technology-choice roots, not a turn search or a playing-strength experiment.',budget:{nativeInputs:64,childNodes:64,milliseconds:6000},nativeInputs:0,rows:[]};
const started=performance.now();
function charge(){assert(report.nativeInputs<report.budget.nativeInputs,'diagnostic input budget');assert(performance.now()-started<report.budget.milliseconds,'diagnostic time budget');report.nativeInputs++;}
function open(f){const seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});assert(k.composition.lifecycle.restore(f.compositionEnvelope).ok);return k.composition;}
function legal(c){const i=c.inspect();return i.phase==='awaiting_input'?i.session.decision.choices:c.inputPort.enumerateActions({});}
function submit(c,id){const i=c.inspect(),a=legal(c).find(a=>a.actionId===id);assert(a,id);charge();const r=i.phase==='awaiting_input'?c.inputPort.submitDecision({decisionId:i.session.decision.decisionId,decisionVersion:i.session.decision.decisionVersion,ownerId:i.session.decision.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));}
const self=(o,id)=>o.publicState.players.find(p=>p.playerId===id);
const delta=(a,b)=>Object.fromEntries(Object.keys(a).map(k=>[k,a[k]-b[k]]));
for(const step of [36,93,128]){
 const old=prior.rows.find(r=>r.step===step),f=JSON.parse(fs.readFileSync(old.fixturePath)),raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(old.rawPath)));assert.equal(sha(fs.readFileSync(old.rawPath)),old.rawSha256);
 const c=open(f),before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
 const row={step,fixturePath:old.fixturePath,fixtureSha256:sha(fs.readFileSync(old.fixturePath)),teacherActionId:old.teacherActionId,studentActionId:old.studentActionId,alternatives:[]};
 try{
  const root=p.openRoot(),rootObservation=root.observation,base=values.evaluateStateValue(rootObservation,f.seatId);p.setResourcePlanning(true);p.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});
  row.round=rootObservation.publicState.roundNumber;row.rootValue=base;row.rootChoiceCount=root.legalActions.length;row.blueSlotPolicy=p.localDecisionSpec(root);row.retainedChoiceCount=raw.roots.filter(c=>Number.isFinite(c.value)).length;row.unsearchedChoices=raw.roots.filter(c=>!Number.isFinite(c.value)).map(c=>({actionId:c.actionId,summary:root.legalActions.find(a=>a.actionId===c.actionId)?.summary,completion:c.completion}));
  for(const candidate of raw.roots.filter(c=>Number.isFinite(c.value))){
   const action=root.legalActions.find(a=>a.actionId===candidate.actionId);assert(action);charge();const child=p.expand(root,action.actionId),observation=child.observation,value=values.evaluateStateValue(observation,f.seatId);assert.equal(value.total,candidate.value);assert.equal(child.status,'information-barrier');
   const beforePlayer=self(rootObservation,f.seatId),afterPlayer=self(observation,f.seatId),tileId=action.target.tileId;
   row.alternatives.push({actionId:action.actionId,summary:action.summary,tileId,blueSlot:action.target.blueSlot,teacher:action.actionId===old.teacherActionId,student:action.actionId===old.studentActionId,publicBonusBefore:rootObservation.publicState.board.techSupply.stacks[tileId].bonusId,boundary:child.boundary,value,componentDelta:delta(value.components,base.components),ownedTechnologyAfter:afterPlayer.techState,resourceDelta:Object.fromEntries(['score','credits','energy','publicity','availableData','handCount'].map(k=>[k,afterPlayer[k]-beforePlayer[k]])),pendingGuaranteedCardNotYetInHand:rootObservation.publicState.board.techSupply.stacks[tileId].bonusId==='bonus_1c'&&afterPlayer.handCount===beforePlayer.handCount});
  }
  assert.deepEqual(c.lifecycle.save().envelope,before);row.rootAndRngUnchanged=true;
 }finally{p.close();c.dispose();}
 // Check the unpaid known pick reward through native Decisions in a separate
 // composition. Use only the original public offer, never the replenished card.
 const teacher=row.alternatives.find(a=>a.teacher);assert(teacher);
 if(teacher.publicBonusBefore==='bonus_1c'){
  const native=open(f);
  try{
   submit(native,teacher.actionId);let e=native.lifecycle.save().envelope,s=e.session?.session;assert.equal(s.queue[0].type,science.EFFECT_TYPES.PICK_CARD);
   const originalPublic=new Set(s.baseState.cards.publicCards.filter(Boolean).map(c=>c.id));
   const fixed=createCardPickPlanner().plan({state:s.workingState,seatId:f.seatId,actions:legal(native),status:'decision',session:s});assert(fixed?.fixed);const pick=legal(native).find(a=>a.actionId===fixed.selectedActionId);assert(originalPublic.has(pick.target.cardInstanceId||pick.payload?.cardInstanceId));
   const v0=values.evaluateStateValue(buildRuleObservation(s.workingState,f.source.seed,f.seatId),f.seatId);submit(native,pick.actionId);e=native.lifecycle.save().envelope;const after=e.session?.session?.workingState||JSON.parse(e.committedState),v1=values.evaluateStateValue(buildRuleObservation(after,f.source.seed,f.seatId),f.seatId);
   row.teacherKnownPickSettlement={nativeInputs:2,selectedOriginalPublicCardId:pick.target.cardInstanceId||pick.payload?.cardInstanceId,before:v0,after:v1,componentDelta:delta(v1.components,v0.components),scope:'Known committed pick settlement only; newly replenished card identity is not used in selection or reported.'};
  }finally{native.dispose();}
 }
 const student=row.alternatives.find(a=>a.student);assert(student);row.studentMinusTeacherComponents=delta(student.value.components,teacher.value.components);row.studentMinusTeacherValue=student.value.total-teacher.value.total;
 report.rows.push(row);fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({step,teacher:teacher.summary,student:student.summary,valueGap:row.studentMinusTeacherValue,components:row.studentMinusTeacherComponents,knownPickDelta:row.teacherKnownPickSettlement?.componentDelta}));
}
report.status='complete';report.elapsedMilliseconds=performance.now()-started;report.sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).sort().map(p=>[p.slice(process.cwd().length+1),sha(fs.readFileSync(p))]));
report.limits=['No estimate of future technology usage was added. Attribution does not prove the teacher choice is optimal.','A known pending pick is distinct from unknown future growth.','Counterfactual immediate reward settlement is not a completed game.'];
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,nativeInputs:report.nativeInputs,ms:report.elapsedMilliseconds}));
