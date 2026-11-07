'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const data=require('../randomizer/game/data'),cards=require('../randomizer/game/cards/deck'),effects=require('../randomizer/game/cards/effects');
const [input,out]=process.argv.slice(2),proof=JSON.parse(fs.readFileSync(input));
const root=proof.endpoint,seat='player-white',seed='seti-free-analyze-v1';
assert(proof.independentReplayExact&&proof.afterKnownRefill.wallet.publicity===8&&proof.afterKnownRefill.wallet.availableData===2);
const make=()=>{const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});return k.composition;};
const save=c=>c.lifecycle.save().envelope;
const state=c=>{const s=save(c);return s.session?.session?.workingState||JSON.parse(s.committedState);};
const owner=c=>state(c).players.players.find(p=>p.id===seat);
const pending=c=>c.inspect().session?.decision;
const menu=c=>pending(c)?.choices||c.inputPort.enumerateActions({});
const restore=(c,s)=>{assert(c.lifecycle.restore(s).ok);assert.deepEqual(save(c),s);};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const ammo=c=>menu(c).map(a=>[a.family,a.target,a.summary]);
function describe(c){const s=state(c),p=owner(c),v=c.projection({role:'player',playerId:seat}).state;
 return{round:s.turn.roundNumber,cycle:s.turn.actionCycleNumber,main:p.mainActionCompleted,wallet:p.resources,income:p.income,
  tech:p.techState,data:p.dataState,hand:p.hand.map(x=>({id:x.id,cardId:x.cardId,income:cards.getIncomeGainForCard(x),corner:cards.getDiscardActionRewardForCard(x)})),
  publicCards:s.cards.publicCards.map(x=>x&&[x.id,x.cardId]),wins:s.data.sectorSettlements.winsByPlayerId[seat],
  probes:s.pieces.rockets.filter(r=>r.playerId===seat),traces:v.selfState.traceCounts,
  projected:v.publicState.players.find(p=>p.playerId===seat).finalScore};}
let physical=0;
function submit(c,a){const d=pending(c);const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
 :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));physical++;}
function run(name,execute,start=root){
 const c=make();let path=[],checkpoints={};
 const pick=(f,filter=()=>true)=>{const options=menu(c).filter(a=>a.actorId===seat&&a.family===f&&filter(a));
  assert.equal(options.length,1,JSON.stringify({name,f,choices:ammo(c)}));const a=options[0];submit(c,a);
  path.push({id:a.actionId,family:f,target:a.target,summary:a.summary,wallet:owner(c).resources});return a;};
 const take=(family,kind)=>pick(family,a=>a.target?.choiceId===kind),cardId=id=>owner(c).hand.find(k=>k.cardId===id)?.id;
 const corner=id=>pick('card_corner',a=>a.target.cardInstanceId===cardId(id));
 const use=id=>pick('play_card',a=>a.target.cardInstanceId===cardId(id));
 const place=(target='computer',blueSlot=null)=>{pick('place_data');pick('choose_target',a=>a.target?.target===target&&a.target.blueSlot===blueSlot);};
 const end=()=>{assert(!pending(c));pick('end_turn');assert(!pending(c),JSON.stringify(ammo(c)));};
 const endWithDeferredTask=()=>{assert(!pending(c));pick('end_turn');if(pending(c))pick('accept_optional_effect',a=>a.target?.choiceId?.startsWith('skip:task:'));assert(!pending(c));};
 const research=(id,slot=null)=>{pick('research_tech');pick('choose_target',a=>a.target?.tileId===id&&a.target.blueSlot===slot);};
 const checkpoint=k=>checkpoints[k]=describe(c);
 const avail=family=>menu(c).some(a=>a.actorId===seat&&a.family===family);
 const scanable=candidate=>{const x=state(c).data,id=candidate.target?.nebulaId;return id&&data.getNextReplaceableNebulaToken(x,id);};
 const scanChoice=choices=>[...choices].filter(scanable).sort((a,b)=>{
  const s=state(c).data;const rank=x=>{
   const id=x.target.nebulaId, tokens=data.listNebulaTokens(s,id),open=tokens.filter(t=>!t.replacedByPlayerId&&!t.replacedByPlayerColor).length;
   const own=tokens.filter(t=>t.replacedByPlayerId===seat||t.replacedByPlayerColor==='white').length;
   const next=data.getNextReplaceableNebulaToken(s,id);
   return 10*Number(open===1&&own>=2)+(data.getNebulaSlotScoreReward(id,next.slotIndex)||0);
  };return rank(b)-rank(a)||a.actionId.localeCompare(b.actionId);})[0];
 function visibleSector(family,restrict=()=>true){const a=scanChoice(menu(c).filter(a=>a.actorId===seat&&a.family===family&&restrict(a)));
  assert(a,JSON.stringify(ammo(c)));return pick(family,x=>x.actionId===a.actionId);}
 function choosePublic(id){const card=state(c).cards.publicCards.find(x=>x?.cardId===id);assert(card,id);
  return pick('choose_card',a=>a.target?.cardInstanceId===card.id||a.target?.source==='public'&&state(c).cards.publicCards[a.target.slotIndex]?.id===card.id);}
 function selectedIncome(id){const exact=cardId(id);assert(exact,id);pick('choose_card',a=>a.target.choiceId==='income:'+exact);}
 function swap(outgoing,incoming){pick('industry',x=>x.target?.abilityId==='deepspace_swap_cards');
  pick('choose_card',x=>x.target?.cardInstanceId===cardId(outgoing));choosePublic(incoming);}
 try{restore(c,start);execute({c,pick,take,cardId,corner,use,place,end,endWithDeferredTask,research,checkpoint,avail,visibleSector,choosePublic,selectedIncome,swap});
  const endpoint=save(c),endState=describe(c),legal=ammo(c);restore(c,start);
  const replay=make();try{restore(replay,start);for(const step of path){const a=menu(replay).find(x=>x.actionId===step.id);assert(a&&a.actorId===seat);
   assert.deepEqual(a.target,step.target);submit(replay,a);assert.deepEqual(owner(replay).resources,step.wallet);}
   assert.deepEqual(save(replay),endpoint);restore(replay,start);}finally{replay.dispose();}
  return {name,path,checkpoints,endpoint,endState,legal,independentReplayExact:true};
 }finally{c.dispose();}
}
const options={
 'blue4-alone':({c,end,research,checkpoint,avail})=>{end();research('blue4',3);end();checkpoint('beforeScan');assert(!avail('scan'));},
 'scan-menu':({c,end,research,place,checkpoint,avail,pick})=>{end();research('blue4',3);place();place('blueBonus',1);end();checkpoint('beforeScan');assert(avail('scan'));pick('scan');},
 'amiba7-play':({end,use,choosePublic,checkpoint})=>{end();use('amiba_7.webp');choosePublic('b_16.webp');checkpoint('afterKnownPick');},
 'publicity-pick':({end,pick,choosePublic,corner,checkpoint,use,visibleSector})=>{end();pick('quick_trade',a=>a.target.tradeId==='publicity-for-card');choosePublic('b_16.webp');corner('amiba_7.webp');use('b_16.webp');checkpoint('afterUse');},
};
function startScan({end,research,place,checkpoint,avail,pick}){
 end();research('blue4',3);place();place('blueBonus',1);end();checkpoint('beforeScan');assert(avail('scan'));pick('scan');
}
function financeWithScan(a){
 startScan(a);a.pick('choose_target',x=>x.target?.nebulaId==='sector-4-b');a.visibleSector('choose_card');
 a.checkpoint('twoScannedData');a.corner('amiba_7.webp');for(let i=0;i<3;i++)a.place();a.selectedIncome('amiba_9.webp');a.end();
 a.checkpoint('secondIncome');
}
options['scan-electric-income']=financeWithScan;
options['scan-money-income']=a=>{
 startScan(a);a.pick('choose_target',x=>x.target?.nebulaId==='sector-4-b');a.visibleSector('choose_card');
 a.checkpoint('twoScannedData');a.swap('amiba_9.webp','dlc_17.png');a.corner('dlc_17.png');
 for(let i=0;i<3;i++)a.place();a.selectedIncome('amiba_7.webp');a.end();a.checkpoint('secondIncome');
};
options['b16-electric-income']=a=>{
 a.end();a.pick('quick_trade',x=>x.target.tradeId==='publicity-for-card');a.choosePublic('b_16.webp');a.corner('amiba_7.webp');
 a.use('b_16.webp');a.take('choose_target','skip');a.visibleSector('choose_target');a.checkpoint('beforePlacement');
 for(let i=0;i<4;i++)a.place();a.selectedIncome('amiba_9.webp');a.end();a.checkpoint('secondIncome');
 assert(a.avail('research_tech'));a.research('blue4',3);a.end();a.checkpoint('fifthTech');
};
for(const nebula of ['sector-4-b','sector-1-a','sector-1-b']){
 options['earth-'+nebula]=a=>{startScan(a);a.pick('choose_target',x=>x.target?.nebulaId===nebula);};
 options['scan-'+nebula]=a=>{startScan(a);a.pick('choose_target',x=>x.target?.nebulaId===nebula);a.visibleSector('choose_card');};
}
function beforePurple(){
 const f=JSON.parse(fs.readFileSync(proof.fixture)),c=make();
 try{assert.equal(sha(proof.fixture),proof.sha256);restore(c,f.compositionEnvelope);
  for(const x of proof.path.slice(0,7)){const a=menu(c).find(z=>z.actionId===x.id);assert(a&&a.actorId===seat);submit(c,a);}
  assert.deepEqual(owner(c).resources,proof.afterEarlyAnalysis.wallet);const result=save(c);restore(c,f.compositionEnvelope);return result;
 }finally{c.dispose();}
}
function prepareDlc25(a,outgoing){
 a.pick('industry',x=>x.target?.abilityId==='deepspace_swap_cards');a.pick('choose_card',x=>x.target?.cardInstanceId===a.cardId(outgoing));
 a.choosePublic('dlc_25.png');a.endWithDeferredTask();a.use('dlc_25.png');a.endWithDeferredTask();
 a.research('purple1');a.pick('accept_optional_effect',x=>x.target?.choiceId?.endsWith('dlc25-purple-tech-public-scan-1'));
 a.pick('complete_task',x=>x.target?.ruleId==='dlc9-three-sector-wins');a.checkpoint('purpleTrigger');
}
for(const [name,id] of [['money','amiba_9.webp'],['energy','amiba_7.webp']]){
 options['dlc25-first-'+name]=a=>prepareDlc25(a,id);
}
function dataCardBeforeRed(a){
 a.use('amiba_0.webp');if(pending(a.c))a.take('choose_target','symbol:blue_2');
 a.place();a.place();a.end();a.pick('analyze');a.take('choose_target','trace:1:blue:amiba:4');
 a.take('choose_card','amiba:display:7');a.end();a.research('purple1');a.corner('amiba_7.webp');
 for(let i=0;i<4;i++)a.place();a.selectedIncome('amiba_1.webp');a.checkpoint('secondIncome');
 a.corner('amiba_9.webp');a.end();a.research('blue4',3);a.end();a.checkpoint('beforeRed');
}
options['amiba0-before-red']=dataCardBeforeRed;
options['amiba0-red-menu']=a=>{dataCardBeforeRed(a);a.pick('scan');};
function dataCardBeforeAmiba3(a,trace='pink',reverse=false){
 function playA0(){a.use('amiba_0.webp');a.take('choose_target','symbol:blue_1');a.place();a.place();a.end();}
 function playA3(){a.use('amiba_3.webp');a.take('choose_target','trace:'+trace+':1');
  if(pending(a.c))a.pick('accept_optional_effect',x=>x.target?.choiceId?.includes('amiba0-pink-data')&&x.target.choiceId.startsWith('confirm:'));
  a.checkpoint('afterAmiba3');a.end();}
 if(reverse){playA3();playA0();}else{playA0();playA3();}
 a.pick('analyze');a.take('choose_target','trace:1:blue:amiba:4');a.take('choose_card','amiba:display:7');a.end();
 a.research('purple1');if(owner(a.c).resources.availableData<5)a.corner('amiba_7.webp');
 if(owner(a.c).resources.availableData<5){a.checkpoint('insufficient');return;}
 a.place();a.place('blueBonus',1);for(let i=0;i<3;i++)a.place();a.selectedIncome('amiba_1.webp');a.end();a.checkpoint('secondIncome');
 assert(a.avail('scan'));a.pick('scan');
}
options['amiba0-r179']=dataCardBeforeAmiba3;
options['amiba0-r179-yellow']=a=>dataCardBeforeAmiba3(a,'yellow');
function scanRedWithVisibleDlc24(a,reverse=false){
 dataCardBeforeAmiba3(a,'yellow',reverse);a.pick('choose_target',x=>x.target?.nebulaId==='sector-3-a');
 a.pick('choose_card',x=>x.target?.nebulaId==='sector-3-a'&&x.target?.cardInstanceId==='card-61-0');a.checkpoint('redScanned');
}
options['amiba0-r179-red']=scanRedWithVisibleDlc24;
function finishRed(a,trace='trace:1:pink:state-extra',reverse=false){
 scanRedWithVisibleDlc24(a,reverse);a.take('choose_target',trace);
 if(trace==='trace:1:pink:amiba:3')a.take('choose_card','amiba:display:5');
 if(pending(a.c)?.choices.some(x=>x.target?.choiceId?.includes('amiba0-pink-data')))
  a.pick('accept_optional_effect',x=>x.target?.choiceId?.includes('amiba0-pink-data')&&x.target.choiceId.startsWith('confirm:'));
 a.pick('complete_task',x=>x.target?.ruleId==='dlc9-three-sector-wins');a.checkpoint('afterTask');a.end();
}
function redIncomeTech(a,trace,reverse=false){
 finishRed(a,trace,reverse);a.research('orange1');a.choosePublic('dlc_25.png');a.checkpoint('fifthTechnology');
}
options['amiba0-r179-orange']=a=>redIncomeTech(a,'trace:1:pink:state-extra');
options['amiba0-r179-orange-pink2']=a=>redIncomeTech(a,'trace:1:pink:amiba:2');
function sixthResearch(a,tile='blue1',corner='b_16.webp',reverse=false,trace='trace:1:pink:amiba:2'){
 redIncomeTech(a,trace,reverse);a.corner('amiba_9.webp');a.corner(typeof corner==='function'?corner(a):corner);a.end();
 a.research(tile,3);a.place();a.place('blueBonus',3);a.checkpoint('sixthTechnology');
}
options['amiba0-r179-money-preserve']=a=>{sixthResearch(a);a.end();assert(a.avail('pass'));};
options['amiba0-r179-money-reverse']=a=>{sixthResearch(a,'blue1','b_16.webp',true);a.end();assert(a.avail('pass'));};
options['amiba0-r179-money-keep-scan']=a=>{sixthResearch(a,'blue1','dlc_25.png');a.end();assert(a.avail('pass'));};
options['amiba0-r179-money-blue4']=a=>{sixthResearch(a,'blue4');a.end();assert(a.avail('pass'));};
options['amiba0-r179-money-analyze']=a=>{sixthResearch(a,'blue1','dlc_25.png');a.place();a.end();a.pick('analyze');};
options['amiba0-r179-pink3-income-supplier']=a=>{sixthResearch(a,'blue1','b_16.webp',false,'trace:1:pink:amiba:3');a.end();assert(a.avail('pass'));};
options['amiba0-r179-pink3-adapt-visible']=a=>{sixthResearch(a,'blue1',x=>x.cardId('b_16.webp')?'b_16.webp':'dlc_25.png',false,'trace:1:pink:amiba:3');a.end();assert(a.avail('pass'));};
function secondAnalysis(a,pick='dlc_17.png'){
 a.use('amiba_7.webp');a.choosePublic(pick);a.take('choose_target','symbol:blue_2');a.corner('dlc_17.png');
 a.checkpoint('thirdCycleFunding');a.place();a.end();a.pick('analyze');
}
options['late-analyze-menu']=secondAnalysis;
options['late-electric-shortfall']=a=>{
 secondAnalysis(a);a.take('choose_target','trace:1:blue:amiba:3');a.take('choose_card','amiba:display:5');
 a.swap('dlc_25.png','dlc_15.png');a.corner('dlc_15.png');a.checkpoint('knownThirdIncomeFinance');
 const p=owner(a.c);assert.equal(p.resources.availableData,3);assert.deepEqual(p.hand.map(c=>cards.getIncomeGainForCard(c)),[{energy:1}]);
 for(let i=0;i<3;i++)a.place();assert(!a.avail('place_data'));a.end();assert(a.avail('pass'));
};
options['late-both-incomes']=a=>{
 secondAnalysis(a);a.take('choose_target','trace:1:blue:amiba:3');a.take('choose_card','amiba:display:2');
 a.corner('amiba_5.webp');a.corner('amiba_2.webp');a.checkpoint('fundedElectric');
 assert.equal(owner(a.c).resources.availableData,4);for(let i=0;i<4;i++)a.place();
 a.selectedIncome('dlc_25.png');a.end();assert(a.avail('pass'));
};
options['late-adapt-visible']=a=>{
 const knownData=a.cardId('dlc_17.png');
 secondAnalysis(a,knownData?'b_16.webp':'dlc_17.png');
 a.take('choose_target','trace:1:blue:amiba:3');a.take('choose_card','amiba:display:2');
 if(knownData){a.swap('b_16.webp','dlc_15.png');a.corner('dlc_15.png');}
 else a.corner('amiba_5.webp');
 a.corner('amiba_2.webp');a.checkpoint('fundedElectric');
 assert.equal(owner(a.c).resources.availableData,4);for(let i=0;i<4;i++)a.place();
 a.selectedIncome(knownData?'amiba_5.webp':'dlc_25.png');a.end();assert(a.avail('pass'));
};
const labels=process.env.SETI_CASE?process.env.SETI_CASE.split(','):['blue4-alone','scan-electric-income','scan-money-income','b16-electric-income','dlc25-first-money','dlc25-first-energy','amiba0-before-red'];
assert(labels.length<=7&&labels.every(n=>options[n]));
const early=labels.some(x=>x.startsWith('dlc25'))?beforePurple():null;
const redFixture='reports/ai-foundation-20261107/v372-blue-landing-supply-v1/v372-actual-r3-before-182-root-20261107-v1.json';
const beforeRed=labels.some(x=>x.startsWith('amiba0'))?JSON.parse(fs.readFileSync(redFixture)).compositionEnvelope:null;
const amiba3Fixture='reports/ai-foundation-20261107/v374-deferred-sector-publicity-v1/roots/deferred-sector-actual-179.json';
const beforeAmiba3=labels.some(x=>x.startsWith('amiba0-r179'))?JSON.parse(fs.readFileSync(amiba3Fixture)).compositionEnvelope:null;
const changeHidden=process.env.SETI_REORDER_NEXT==='1';let changedDrawIds=null;
if(changeHidden){assert(beforeAmiba3&&!beforeAmiba3.session);const s=JSON.parse(beforeAmiba3.committedState),draw=s.cards.drawPileCardIds;
 changedDrawIds=draw.slice(0,2);assert.notEqual(draw[0],draw[1]);[draw[0],draw[1]]=[draw[1],draw[0]];beforeAmiba3.committedState=JSON.stringify(s);}
const lateProof=process.env.SETI_LATE_PROOF,lateRow=process.env.SETI_LATE_ROW||'amiba0-r179-money-preserve',late=labels.some(x=>x.startsWith('late-'))&&JSON.parse(fs.readFileSync(lateProof)).rows.find(r=>r.name===lateRow).endpoint;
const rows=labels.map(n=>run(n,options[n],n.startsWith('late-')?late:n.startsWith('dlc25')?early:n.startsWith('amiba0-r179')?beforeAmiba3:n.startsWith('amiba0')?beforeRed:root));
assert(physical<=340&&rows.every(r=>r.path.length<=60));
if(out)fs.writeFileSync(out,JSON.stringify({input,sha256:sha(input),redFixture,redFixtureSha256:sha(redFixture),amiba3Fixture,amiba3FixtureSha256:sha(amiba3Fixture),changedDrawIds,
 ...(late?{lateProof,lateProofSha256:sha(lateProof),lateRow}:{}),rows,physical,newAutonomousRuns:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(rows.map(x=>({name:x.name,steps:x.path.length,state:x.endState,legal:x.legal}))));
