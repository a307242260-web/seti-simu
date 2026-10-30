"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {createSimulationRuleComposition}=require("../../training/simulation-rule-composition");
const {createSeededRandom}=require("../random");
const {buildRuleObservation}=require("../../app/rule-observation");
const {createAnalysisPort}=require("./analysis-port");
const {searchDecision}=require("./decision-search");
const {createStateValueEvaluator}=require("./state-value");
const data=require("../data");
const cards=require("../cards/deck");
const industry=require("../industry");
const read=name=>JSON.parse(fs.readFileSync(path.resolve(__dirname,`../../../adhoc/ai-decision-corpus-20261023-v1/${name}`)));
const fixture=read("post-main-corner-pair-20261023-v1.json"),results=[];
function environment(f){const seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});assert(k.composition.lifecycle.restore(f.compositionEnvelope).ok);return k;}
function controlledMove(id,cardIds){const f=read(`case-${id}-20261023-v1.json`),s=JSON.parse(f.compositionEnvelope.committedState),p=s.players.players.find(p=>p.id===f.seatId);s.cards.discardPile.push(...p.hand.filter(c=>!cardIds.includes(c.cardId)));p.hand=p.hand.filter(c=>cardIds.includes(c.cardId));assert.equal(p.hand.length,2);p.mainActionCompleted=true;p.industryRoundMarkRound=s.turn.roundNumber;p.industryRoundMarkTurn=s.turn.turnNumber;Object.assign(p.resources,{credits:0,energy:0,publicity:0,availableData:0,handSize:2});p.blueBonusResources={credits:0,energy:0};p.dataState={poolTokens:[],placedTokens:[],discardedCount:0};const own=s.pieces.rockets.filter(r=>[r.playerId,r.color,r.playerColor].some(v=>v===p.id||v===p.color));assert(own.length);s.pieces.rockets=s.pieces.rockets.filter(r=>!own.includes(r)||r.id===own[0].id);f.compositionEnvelope.committedState=JSON.stringify(s);return f;}
const triple=structuredClone(fixture),ts=JSON.parse(triple.compositionEnvelope.committedState),tp=ts.players.players.find(p=>p.id===triple.seatId);
assert(ts.cards.drawPileCardIds.includes("b_99.webp"));tp.hand.push(cards.createCommittedCardInstance(ts,cards.CARD_CATALOG.find(c=>c.card_id==="b_99.webp")));ts.cards.drawPileCardIds=ts.cards.drawPileCardIds.filter(id=>id!=="b_99.webp");tp.resources.handSize=3;triple.compositionEnvelope.committedState=JSON.stringify(ts);
const incomeReady=structuredClone(fixture),is=JSON.parse(incomeReady.compositionEnvelope.committedState),ip=is.players.players.find(p=>p.id===incomeReady.seatId);
for(let i=0;i<3;i+=1){assert(data.gainData(ip,{root:is}).ok);assert(data.placeDataToComputer(ip,{root:is}).ok);}assert.equal(data.listComputerPlacedTokens(ip).length,3);incomeReady.compositionEnvelope.committedState=JSON.stringify(is);
const unusedTuring=structuredClone(fixture),us=JSON.parse(unusedTuring.compositionEnvelope.committedState),up=us.players.players.find(p=>p.id===unusedTuring.seatId);up.industryRoundMarkRound=0;up.industryRoundMarkTurn=0;unusedTuring.compositionEnvelope.committedState=JSON.stringify(us);
const unusedHelios=structuredClone(unusedTuring),hs=JSON.parse(unusedHelios.compositionEnvelope.committedState),hp=hs.players.players.find(p=>p.id===unusedHelios.seatId);hp.initialSelection.industry={id:"industry:赫利昂联合体.png"};industry.ensurePlayerIndustryState(hp);unusedHelios.compositionEnvelope.committedState=JSON.stringify(hs);
const cases=[["data-pair",fixture],["data-triple",triple],["income-ready-data-pair",incomeReady],["unused-turing-data-pair",unusedTuring],["unused-helios-data-pair",unusedHelios],["move-pair-062-one-probe",controlledMove("062",["dlc_30.png","b_10.webp"])],["move-pair-152-one-probe",controlledMove("152",["b_65.webp","b_136.webp"])]];
for(const [label,f] of cases){const k=environment(f),comp=k.composition,before=comp.lifecycle.save().envelope;
 for(const evaluate of [createStateValueEvaluator(f.seatId),createStateValueEvaluator(f.seatId,{weights:{credits:0.1,energy:0.2,publicity:0.3,availableData:0.4,handSize:0.07}})]){
  function run(enabled,cache=0){const port=createAnalysisPort({composition:comp,seatId:f.seatId,maxCacheEntries:cache});try{const root=port.openRoot(),spec=port.postMainCornerChoiceSpec(root);assert(spec,`${label} must have a proven group`);assert.equal(spec.excludedActionIds.length,label==="data-triple"?2:1);assert(spec.groups.every(g=>g.excludedActionIds.every(id=>g.representativeActionId<id)));
   const out=searchDecision({port:enabled?port:{...port,postMainCornerChoiceSpec:()=>null},root,evaluate,resourceDominance:true,cardTradePruning:true,cardChoiceEquivalence:true,budget:{transitions:4096,nodes:4097,frontier:4096,milliseconds:15000}});assert(out.complete,`${label}/${out.stopReason}`);assert.deepEqual(comp.lifecycle.save().envelope,before);if(enabled&&root.observation.publicState.roundNumber===4){assert(out.diagnostics.cardCornerProofNodes>0);assert.equal(out.roots.find(x=>spec.excludedActionIds.includes(x.actionId)).valueType,"not-executed");}return out;
  }finally{port.close();}}
  const raw=run(false),pruned=run(true),cached=run(true,256);for(const x of [pruned,cached]){assert.equal(x.actionId,raw.actionId);assert.equal(x.value,raw.value);assert.equal(x.lines[0].distance,raw.lines[0].distance);}results.push({label,modelKey:evaluate.modelKey,raw:raw.diagnostics.transitions,pruned:pruned.diagnostics.transitions,value:raw.value,excluded:pruned.diagnostics.cardCornerExcludedActions});
  if(label==="income-ready-data-pair"&&evaluate.modelKey.includes('"handSize":0.07'))assert(raw.actionId.startsWith("card_corner:"),"非整数权重下角标路径确实成为最优首步");
 }
 if(label==="data-pair"){
  const port=createAnalysisPort({composition:comp,seatId:f.seatId}),root=port.openRoot(),spec=port.postMainCornerChoiceSpec(root);
  const limited=searchDecision({port,root,evaluate:createStateValueEvaluator(f.seatId),cardChoiceEquivalence:true,budget:{transitions:1,nodes:4097,frontier:4096,milliseconds:15000}});
  assert(!limited.complete);assert.equal(limited.actionId,null);const excluded=limited.roots.find(r=>spec.excludedActionIds.includes(r.actionId));assert.equal(excluded.value,null);assert.equal(excluded.completion,root.observation.publicState.roundNumber===4?"pending-retained-search":"pending");port.close();
 }
 if(label==="income-ready-data-pair"){
  const port=createAnalysisPort({composition:comp,seatId:f.seatId}),root=port.openRoot(),values=[];
  for(const corner of root.legalActions.filter(a=>a.family==="card_corner")){
   let n=port.expand(root,corner.actionId);n=port.expand(n,n.legalActions.find(a=>a.family==="place_data").actionId);n=port.expand(n,n.legalActions.find(a=>a.target?.target==="computer").actionId);
   const income=n.legalActions.find(a=>String(a.target?.choiceId||"").startsWith("income:"));assert(income,"实际第四格收入必须可执行");n=port.expand(n,income.actionId);
   assert.equal(n.observation.publicState.players.find(p=>p.playerId===f.seatId).income.credits,root.observation.publicState.players.find(p=>p.playerId===f.seatId).income.credits+1);
   values.push(createStateValueEvaluator(f.seatId)(n.observation));
  }
  assert.equal(values.length,2);assert.equal(values[0],values[1]);assert.deepEqual(comp.lifecycle.save().envelope,before);port.close();
 }
 comp.dispose();
}
function decline(change){const f=structuredClone(fixture),s=JSON.parse(f.compositionEnvelope.committedState),p=s.players.players.find(p=>p.id===f.seatId);change(s,p);f.compositionEnvelope.committedState=JSON.stringify(s);const k=environment(f),port=createAnalysisPort({composition:k.composition,seatId:f.seatId});assert.equal(port.postMainCornerChoiceSpec(port.openRoot()),null);port.close();k.composition.dispose();}
decline((s,p)=>{p.mainActionCompleted=false;});
decline((s,p)=>{p.initialSelection.industry={id:"industry:深空探测.png"};industry.ensurePlayerIndustryState(p);p.industryRoundMarkRound=0;p.industryRoundMarkTurn=0;});
decline((s,p)=>{for(const trace of Object.values(s.aliens.aliens["1"].traces)){trace.firstPlaced=true;trace.ownerPlayerColor=p.color;}});
decline((s,p)=>{p.industryLastPlayedCardThisRound=structuredClone(p.hand[0]);});
decline((s,p)=>{s.turn.type1TriggerEvents=[{type:"visitPlanet",playerId:p.id,planetId:"venus",sourceCardInstanceId:p.hand[0].id}];});
// 相同角标有实体观察者时，实际资源奖励就不同，必须拒绝等价。
const observed=structuredClone(fixture),os=JSON.parse(observed.compositionEnvelope.committedState),op=os.players.players.find(p=>p.id===observed.seatId);
os.turn.cardTurnEventBonuses=[{id:"corner-observer",ownerId:op.id,playerId:op.id,duration:"turn",eventType:"cardCorner",distinctBy:"cardInstanceId",usedKeys:[op.hand[0].id],rewards:[{id:"observed-credit",type:"gain_resources",options:{gain:{credits:5}}}]}];observed.compositionEnvelope.committedState=JSON.stringify(os);
const ok=environment(observed),port=createAnalysisPort({composition:ok.composition,seatId:observed.seatId}),root=port.openRoot();assert.equal(port.postMainCornerChoiceSpec(root),null);const leaves=root.legalActions.filter(a=>a.family==="card_corner").map(a=>port.expand(root,a.actionId));const evaluate=createStateValueEvaluator(observed.seatId);assert.equal(Math.abs(evaluate(leaves[0].observation)-evaluate(leaves[1].observation)),5);port.close();ok.composition.dispose();
// 角标相同、收入不同：正式收入选择会给出不同加权值。
const different=controlledMove("152",["b_109.webp","dlc_12.png"]),ds=JSON.parse(different.compositionEnvelope.committedState),dp=ds.players.players.find(p=>p.id===different.seatId);
for(let i=0;i<3;i+=1){assert(data.gainData(dp,{root:ds}).ok);assert(data.placeDataToComputer(dp,{root:ds}).ok);}different.compositionEnvelope.committedState=JSON.stringify(ds);
const dk=environment(different),dport=createAnalysisPort({composition:dk.composition,seatId:different.seatId}),dr=dport.openRoot();assert.equal(dport.postMainCornerChoiceSpec(dr),null);const ev=createStateValueEvaluator(different.seatId,{weights:{credits:0.1,energy:0.2}}),values=[];
for(const corner of dr.legalActions.filter(a=>a.family==="card_corner")){let n=dport.expand(dr,corner.actionId);n=dport.expand(n,n.legalActions.find(a=>a.family==="place_data").actionId);n=dport.expand(n,n.legalActions.find(a=>a.target?.target==="computer").actionId);const income=n.legalActions.find(a=>String(a.target?.choiceId||"").startsWith("income:"));assert(income);n=dport.expand(n,income.actionId);values.push(ev(n.observation));}assert.equal(values.length,2);assert.notEqual(values[0],values[1]);dport.close();dk.composition.dispose();
console.log(JSON.stringify({postMainCornerChoice:"passed",results,incomeCounterexample:values}));
