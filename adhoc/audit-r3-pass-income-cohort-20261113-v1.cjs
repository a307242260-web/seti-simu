'use strict';
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createSeededRandom}=require('../randomizer/game/random');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const {createSearchAgent}=require('../randomizer/game/ai/search-agent');
const {passiveAgent}=require('../tools/research-human405-round1');
const placements=require('../randomizer/game/data');
const catalog=require('../tools/research-free-analyze-random20');
const cards=require('../randomizer/game/cards/deck');
const {getStandardScanCost}=require('../randomizer/game/actions/scan-effects');
const white='player-white',sample=[2,5,8,11,14,17],controls=[7,13];
const all=process.argv.includes('--all'),postMain=process.argv.includes('--post-main');
const head=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const read=f=>JSON.parse(fs.readFileSync(f));
const get=f=>JSON.parse(z.gunzipSync(cp.execFileSync('git',['show','HEAD:reports/ai-foundation-20261113/prepass-funded-landing/'+f],{maxBuffer:64*1024*1024})));
const ok=r=>r.a&&r.complete&&r.n<=256&&r.ms<=600;
function open(root){
  const seed=JSON.parse(root.committedState).meta.seed;
  const kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,
    trustedProjectionReader:true,projectCounterfactualState:(state,v)=>buildRuleObservation(state,seed,v?.playerId||null,[],
      {cheap:v?.cheap===true,valueOnly:v?.valueOnly===true})});
  kernel.newGame({seed});
  const c=kernel.composition,save=()=>c.lifecycle.save().envelope;
  const state=()=>{const s=save();return s.session?.session?.workingState||JSON.parse(s.committedState);};
  const player=()=>state().players.players.find(p=>p.id===white);
  const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
  const observation=id=>c.projection({role:'player',playerId:id}).state;
  assert(c.lifecycle.restore(root).ok);assert.deepEqual(save(),root);
  function apply(old){
    const a=menu().find(v=>v.actionId===old.actionId&&v.actorId===old.actorId),d=c.inspect().session?.decision;
    assert(a,old.summary);assert.deepEqual(a.target,old.target);
    const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
      :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
    assert(r.ok,JSON.stringify(r.failure||r));return a;
  }
  function advanceOpponents(inputs){
    for(let i=0;i<30;i++){
      const legalActions=menu(),id=legalActions[0]?.actorId;assert(id);
      if(id===white)return;
      const {actionId}=passiveAgent(id).decide({legalActions,observation:observation(id)});
      inputs.push(apply(legalActions.find(a=>a.actionId===actionId)));
    }
    throw Error('unclosed passive sequence');
  }
  function automatic(checkpoint){
    const before=save(),actions=menu(),port=createAnalysisPort({composition:c,seatId:white,maxCacheEntries:0});
    try{
      const agent=createSearchAgent({seatId:white,analysisPort:port});if(checkpoint)agent.loadCheckpoint(checkpoint);
      const r=agent.decide({seatId:white,legalActions:actions}).search;
      return {a:actions.find(a=>a.actionId===r.actionId),value:r.value,roots:r.roots,
        n:r.diagnostics.nativeExecutions,ms:r.rootAndSearchMilliseconds,complete:r.complete&&!r.unresolved.length,
        checkpoint:structuredClone(agent.createCheckpoint())};
    }finally{port.close();assert.deepEqual(save(),before);}
  }
  function facts(){
    const p=player(),s=state();
    return {round:s.turn.roundNumber,turn:s.turn.turnNumber,main:p.mainActionCompleted,wallet:p.resources,
      computer:placements.listComputerPlacedTokens(p).map(t=>t.placementSlot),
      blue:placements.listBlueBonusPlacedTokens(p).map(t=>t.blueSlot),
      established:observation(white).publicState.players.find(x=>x.playerId===white).finalScore};
  }
  return {c,state,save,player,menu,apply,advanceOpponents,automatic,facts,dispose:()=>c.dispose()};
}
function short(m){
  const f=m.facts(),p=m.player(),w=f.wallet,i=p.income,s=m.state();
  return {turn:f.turn,wallet:[w.score,w.credits,w.energy,w.publicity,w.availableData],
    income:[i.credits,i.energy,i.handSize,i.additionalPublicScan],established:f.established,
    computer:f.computer,blue:f.blue,tech:Object.keys(p.techState.ownedTiles),
    probes:s.pieces.rockets.filter(q=>q.playerId===white).map(q=>[q.sectorX,q.sectorY,q.fossilId]),
    hand:p.hand.map(c=>c.cardId),market:s.cards.publicCards.map(c=>c?.cardId)};
}
function inspect(root,action,group,index){
  if(action.family!==(postMain?'end_turn':'pass')||action.actorId!==white||root.session)return null;
  const m=open(root);
  try{
    const f=m.facts(),s=m.state(),p=m.player(),live=s.turn.activePlayerIds.filter(id=>id!==white&&!s.turn.passedPlayerIds.includes(id));
    if(![2,3].includes(f.round)||f.computer.length>=4||!p.hand.length)return null;
    const cost=getStandardScanCost(p),scan=m.menu().find(a=>a.family==='scan'&&a.phase==='main');
    const funded=!!scan&&f.wallet.credits>=(cost.credits||0)&&f.wallet.energy>=(cost.energy||0);
    const income=p.hand.map(c=>[c.cardId,cards.getIncomeGainForCard(c)]).filter(([,g])=>g&&(g.credits||g.energy));
    const corners=p.hand.map(c=>[c.id,cards.getDiscardActionRewardForCard(c)?.dataCount||0]);
    const shortage=4-f.computer.length-f.wallet.availableData;
    const ready=shortage<=0;
    const payCorner=shortage===1&&corners.some(([id,n])=>n>=1&&p.hand.some(c=>c.id!==id&&income.some(([key])=>key===c.cardId)));
    if(!income.length||(postMain?!f.main||!ready&&!payCorner:live.length||!funded&&!ready&&!payCorner))return null;
    const r=m.automatic(),relevant=r.roots.filter(q=>Number.isFinite(q.value)).map(q=>[q.actionId,q.value]);
    return {group,index,round:f.round,root,scan,ready,payCorner,shortage,actual:r.a?.summary,baselineAction:r.a?.family,
      rootQuote:r.value,quotes:relevant,n:r.n,ms:r.ms,complete:ok(r),income,before:short(m)};
  }finally{m.dispose();}
}
function screen(){
  const manifest=read('reports/iteration/free-analyze-random20-funded-planet-20261111/summary-463fc442-20261111.json'),roots=[],scope=[];
  for(const board of (all?manifest.rows.map(r=>r.board):[...sample,...controls])){
    const row=manifest.rows.find(x=>x.board===board),record=read('reports/research/'+row.f),saved=read(record.savePath);
    const metadata=catalog.describe({agentType:'search',seed:record.seed,activePlayerCount:4,flags:{scenario:catalog.IDS[1]}},{full:true});
    const env=catalog.createEnvironment({},metadata);let historicActions=0;
    try{
      const start=catalog.initialize(env,{seed:record.seed,activePlayerCount:4,compactReplay:true},metadata);
      assert.deepEqual(start.map(x=>x.action.actionId),saved.replaySteps.slice(0,start.length).map(x=>x.action.actionId));
      for(let i=start.length;i<saved.replaySteps.length;i++){
        const round=env.observe(white).publicState.roundNumber;if(round>3)break;
        const old=saved.replaySteps[i].action,a=env.legalActions().find(x=>x.actionId===old.actionId);
        assert(a,board+'/'+i);assert.deepEqual(a.target,old.target);
        if(round>=2&&a.actorId===white&&a.family===(postMain?'end_turn':'pass')){
          historicActions++;
          const hit=inspect(env.createCheckpoint().coreState.compositionEnvelope,a,'board '+board,i);
          if(hit)roots.push(hit);
        }
        assert(env.step(a).ok,board+'/'+i);
      }
    }finally{env.dispose();}
    scope.push({board,record:row.f,historicActions});
  }
  const same=get('r3-teacher-scan-handoff-20261113-v1.json.gz').groups[0],m=open(same.root);
  try{
    for(const [i,a] of same.rows[0].inputs.entries()){
      const hit=inspect(m.save(),a,'teacher-origin AI',i);
      if(hit)roots.push(hit);
      m.apply(a);
    }
    assert.deepEqual(m.save(),same.rows[0].end);
    const pass=m.menu().find(a=>a.family===(postMain?'end_turn':'pass')&&a.actorId===white);
    const atEnd=pass&&inspect(m.save(),pass,'teacher-origin AI endpoint',same.rows[0].inputs.length);
    if(atEnd)roots.push(atEnd);
    const f=m.facts();
    scope.push({group:'teacher-origin AI',round:f.round,historicActions:same.rows[0].inputs.filter(a=>a.family===(postMain?'end_turn':'pass')&&a.actorId===white).length});
  }finally{m.dispose();}
  return {head,sample,controls,all,postMain,scope,roots};
}
function run(x,forced){
  const m=open(x.root),inputs=[],checkpoints=[],turns=[],decisions=[];let cp,stop,rEnd,last=m.facts().turn;const started=performance.now();
  const put=a=>inputs.push(m.apply(a));
  try{
    if(forced==='scan')put(x.scan);
    if(forced==='income'){
      assert(x.ready);
      const p=m.player(),wallet=p.resources;
      const candidates=p.hand.filter(c=>x.income.some(([id])=>id===c.cardId)).sort((a,b)=>{
        const gain=c=>cards.getIncomeGainForCard(c),creditFirst=wallet.credits<=wallet.energy;
        const order=c=>creditFirst?(gain(c).credits||0):(gain(c).energy||0);
        return order(b)-order(a)||a.cardId.localeCompare(b.cardId)||a.id.localeCompare(b.id);
      });
      assert(candidates.length);
      for(let i=x.before.computer.length;i<4;i++){
        put(m.menu().find(a=>a.family==='place_data'));
        put(m.menu().find(a=>a.family==='choose_target'&&a.target?.target==='computer'));
      }
      put(m.menu().find(a=>a.family==='choose_card'&&a.target?.choiceId?.startsWith('income:')&&a.target.cardInstanceId===candidates[0].id));
      const w=m.player().income;
      assert(w.credits>x.before.income[0]||w.energy>x.before.income[1]);
      checkpoints.push([inputs.length,m.save()]);
    }
    for(let i=0;i<350;i++){
      if(m.state().turn.gameEnded&&!m.c.inspect().session){stop='terminal';break;}
      if(performance.now()-started>=180000){stop='elapsed-gate';break;}
      if(m.menu()[0]?.actorId!==white){m.advanceOpponents(inputs);continue;}
      const r=m.automatic(cp);
      decisions.push({a:r.a?.summary,n:r.n,ms:r.ms,v:r.value,ok:ok(r)});
      if(!ok(r)){stop='gate';break;}
      if(r.a.family==='pass'){
        const f=m.facts();
        checkpoints.push([inputs.length,m.save()]);
        if(f.round===x.round)rEnd=short(m);
      }
      put(r.a);cp=r.checkpoint;
      if(!m.c.inspect().session&&last!==m.facts().turn){last=m.facts().turn;if(m.facts().round===x.round)turns.push(short(m));}
    }
    assert(stop);
    const score=stop==='terminal'?m.state().match.finalScores.find(p=>p.playerId===white).totalScore:null;
    return {name:forced?'fixed '+forced:'current AI',inputs,checkpoints,decisions,score,end:m.save(),stop,rEnd,turns,
      peak:[Math.max(...decisions.map(x=>x.n)),Math.max(...decisions.map(x=>x.ms))]};
  }finally{m.dispose();}
}
const out=process.argv[2],mode=process.argv[3]||'screen';
let data;
if(mode==='screen'){data=screen();console.log(JSON.stringify({scope:data.scope,roots:data.roots.map(({root,scan,before,...x})=>({...x,wallet:before.wallet,computer:before.computer}))}));}
else {
  const s=JSON.parse(z.gunzipSync(fs.readFileSync(process.argv[4])));
  if(s.head!==head)cp.execFileSync('git',['diff','--exit-code',s.head,head,'--','randomizer','tools']);
  assert(mode==='suffix'||mode==='income');
  const eligible=mode==='income'?s.roots.filter(x=>x.complete&&x.baselineAction==='end_turn'&&x.ready):s.roots.filter(x=>x.complete&&x.baselineAction==='pass'&&x.scan);
  const chosen=mode==='income'?[...new Map(eligible.reverse().map(x=>[x.group,x])).values()]:eligible;
  data={head,groups:chosen.map(x=>{
    const rows=[run(x,null),run(x,mode==='income'?'income':'scan')];
    console.log(JSON.stringify([x.group,x.index,x.round,rows.map(r=>[r.name,r.score,r.stop,r.rEnd?.income,r.rEnd?.wallet,r.peak])]));
    return {name:x.group+'/'+x.index,root:x.root,rows};
  })};
}
fs.writeFileSync(out,z.gzipSync(JSON.stringify(data)),{flag:'wx'});
