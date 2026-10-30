"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {createSimulationRuleComposition}=require("../../training/simulation-rule-composition"),{createSeededRandom}=require("../random"),{buildRuleObservation}=require("../../app/rule-observation"),{createAnalysisPort}=require("./analysis-port"),{createStateValueEvaluator}=require("./state-value"),{searchDecision}=require("./decision-search"),data=require("../data"),cards=require("../cards/deck"),effects=require("../cards/effects"),science=require("../effects/science-session");
const f=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../../../adhoc/ai-decision-corpus-20261023-v1/case-008-20261023-v1.json"))),initial=JSON.parse(f.compositionEnvelope.committedState),seatId=f.seatId,seed=f.source.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const comp=k.composition,evaluate=createStateValueEvaluator(seatId),own=s=>s.players.players.find(p=>p.id===seatId);
function open(s){assert(comp.lifecycle.restore({...f.compositionEnvelope,committedState:JSON.stringify(s)}).ok);const port=createAnalysisPort({composition:comp,seatId,maxCacheEntries:0});return{port,root:port.openRoot(),before:comp.lifecycle.save().envelope};}
function pool(s,count){const p=own(s);p.dataState=data.createDefaultDataState();p.resources.availableData=0;for(let i=0;i<count;i++)assert(data.gainData(p,{root:s}).ok);}
const rows=[];
for(const [name,count,clear] of [["original",3,false],["one-space",5,false],["full-pool",6,false],["different-slot-points",3,true]]){
 const s=structuredClone(initial);pool(s,count);
 if(clear)for(const bucket of Object.values(s.data.nebulae))for(const token of bucket.tokens){token.replacedByPlayerColor=null;token.replacedByPlayerId=null;token.replacementOrder=null;}
 const {port,root,before}=open(s);try{
  const bound=port.standardScanValueBound(root);assert(bound,name);assert.equal(bound.stage,"before-scan");
  const first=port.expand(root,root.legalActions.find(a=>a.family==="scan").actionId),firstBound=port.standardScanValueBound(first);assert(firstBound);assert.equal(firstBound.stage,"before-earth");
  let leaves=0,maximum=-Infinity;const values=new Set();
  for(const action of first.legalActions){const pub=port.expand(first,action.actionId),pubBound=port.standardScanValueBound(pub);assert(pubBound);assert.equal(pubBound.stage,"before-public");
   for(const chosen of pub.legalActions){const leaf=port.expand(pub,chosen.actionId);assert.equal(leaf.status,"information-barrier");const value=evaluate(leaf.observation);
    assert(value<=evaluate(root.observation)+bound.valueDelta);assert(value<=evaluate(first.observation)+firstBound.valueDelta);assert(value<=evaluate(pub.observation)+pubBound.valueDelta);maximum=Math.max(maximum,value);values.add(value);leaves+=1;}
  }
  assert.equal(maximum,evaluate(root.observation)+bound.valueDelta);if(clear)assert(values.size>1,"不能把不同槽位得分当作等价选择");
  assert.deepEqual(comp.lifecycle.save().envelope,before);rows.push({name,leaves,dataGain:bound.dataGain,maximumScore:bound.maximumScore,maximum});
 }finally{port.close();}
}
function reject(change){const s=structuredClone(initial);change(s,own(s));const {port,root}=open(s);try{assert.equal(port.standardScanValueBound(root),null);}finally{port.close();}}
reject((s,p)=>{p.resources.additionalPublicScan=1;});
reject(s=>{s.cards.drawPileCardIds=[];s.cards.discardPile=[];});
reject(s=>{for(const token of s.data.nebulae['sector-1-a'].tokens){token.replacedByPlayerColor='blue';token.replacedByPlayerId='player-blue';}});
reject(s=>{const tokens=s.data.nebulae['sector-1-a'].tokens;for(const token of tokens.slice(0,-1)){token.replacedByPlayerColor='blue';token.replacedByPlayerId='player-blue';}});
reject((s,p)=>{for(const bucket of Object.values(s.data.nebulae))for(const token of bucket.tokens){token.replacedByPlayerColor=null;token.replacedByPlayerId=null;}p.resources.score=Math.min(...s.finalScoring.thresholds)-1;});
reject((s,p)=>{const card=p.hand.find(c=>c.cardId==='dlc_9.png');p.hand=p.hand.filter(c=>c!==card);p.resources.handSize=p.hand.length;p.reservedCards.push(card);effects.ensureCardEffectState(card);});
// A reachable historical visit and a live signal observer cannot be treated as quiet.
function reserveFromDraw(s,id){assert(s.cards.drawPileCardIds.includes(id),id);s.cards.drawPileCardIds=s.cards.drawPileCardIds.filter(x=>x!==id);const card=cards.createCommittedCardInstance(s,cards.CARD_CATALOG.find(c=>c.card_id===id));own(s).reservedCards.push(card);effects.ensureCardEffectState(card);return card;}
reject(s=>{reserveFromDraw(s,'b_25.webp');});
reject(s=>{reserveFromDraw(s,'b_44.webp');s.turn.type1TriggerEvents=[{type:'visitPlanet',playerId:seatId,planetId:'jupiter'}];});
// The new pure native query preserves frozen state and agrees with all public scan descriptors.
{
 const s=structuredClone(initial),snapshot=structuredClone(s),native=science.listPublicScanChoices(s);assert(native.length);assert.deepEqual(s,snapshot);
 const current=open(s);const first=current.port.expand(current.root,current.root.legalActions.find(a=>a.family==='scan').actionId);
 const pub=current.port.expand(first,first.legalActions[0].actionId);
 const key=a=>JSON.stringify({family:a.family,target:a.target,payload:a.payload});assert.deepEqual(native.map(key).sort(),pub.legalActions.map(key).sort());current.port.close();
}
// A synthetic complete graph isolates strict cutoffs, pending obligations, ties and the frozen default model.
function synthetic(leafValue=10,directScan=false){
 const observation=(value,terminal=false)=>({terminal,selfState:{playerId:'p1',hand:[]},publicState:{roundNumber:4,passingPlayerIds:[],players:[{playerId:'p1',score:terminal?value:0,finalScore:terminal?value:0,credits:terminal?0:value,energy:0,publicity:0,availableData:0,additionalPublicScan:0,handSize:0,income:{credits:0,energy:0,publicity:0,availableData:0,additionalPublicScan:0,handSize:0}}]}});
 const end={status:'terminal',observation:observation(leafValue,true),legalActions:[]},scanEnd={status:'terminal',observation:observation(8,true),legalActions:[]};
 const pending={status:'decision',observation:observation(5),legalActions:[{actionId:'finish',actorId:'p1',family:'choose_target'}]};
 const root={status:'stable',observation:observation(5),legalActions:[{actionId:'z-fast',actorId:'p1',family:'end_turn'},{actionId:'a-scan',actorId:'p1',family:'scan',target:{kind:'standard-scan'}}]};
 let count=0;const port={identity:n=>n===root?'root':n===pending?'pending':n===end?'end':'scan-end',cardTradeBound:()=>null,
 standardScanValueBound:n=>n===root?{proof:'synthetic-scan-bound',stage:'before-scan',valueDelta:3}:null,
 expand(n,id){count+=1;return n===root?id==='z-fast'?end:directScan?scanEnd:pending:scanEnd;}};
 return{port,root,evaluate:createStateValueEvaluator('p1'),count:()=>count};
}
{
 const g=synthetic(),r=searchDecision({...g,cardChoiceEquivalence:true});assert(r.complete);assert.equal(g.count(),1);assert.equal(r.diagnostics.scanActionPrunes,1);
 const cut=r.roots.find(x=>x.actionId==='a-scan');assert.equal(cut.value,null);assert.equal(cut.valueType,'not-executed');assert.equal(cut.prunedByActionBound.upperBound,8);assert.equal(r.actionId,'z-fast');
}
// Earlier rounds carry capability/hand value: the old unversioned scalar
// theorem must fall back to every native continuation even on this simple graph.
{const g=synthetic();g.root.observation.publicState.roundNumber=1;const r=searchDecision({...g,cardChoiceEquivalence:true});assert(r.complete);assert.equal(r.value,10);assert.equal(g.count(),3);assert.equal(r.diagnostics.scanActionPrunes,0);}
for(const direct of [false,true]){const g=synthetic(8,direct),r=searchDecision({...g,cardChoiceEquivalence:true});assert(r.complete);assert.equal(r.diagnostics.scanActionPrunes,0);assert.equal(r.actionId,direct?'a-scan':'z-fast');}
{
 const g=synthetic();let time=0;g.port.standardScanValueBound=()=>{time=2;return{proof:'bound',valueDelta:3};};const r=searchDecision({...g,cardChoiceEquivalence:true,now:()=>time,budget:{milliseconds:1}});
 assert(!r.complete);assert.equal(r.stopReason,'watchdog');assert.equal(r.actionId,null);assert.equal(r.diagnostics.scanActionPrunes,0);assert.deepEqual(r.unresolved[0].actionIds,['a-scan']);
}
{
 const g=synthetic();g.port.standardScanValueBound=()=>assert.fail('自定义权重不取得默认V证明');const r=searchDecision({...g,evaluate:createStateValueEvaluator('p1',{weights:{credits:2}}),cardChoiceEquivalence:true});assert(r.complete);assert.equal(r.diagnostics.scanActionPrunes,0);
}
{
 const g=synthetic();g.root.legalActions.reverse();g.port.standardScanValueBound=node=>node===g.root?null:{proof:'pending-bound',stage:'before-earth',valueDelta:3};
 const r=searchDecision({...g,cardChoiceEquivalence:true});assert(r.complete);assert.equal(r.diagnostics.scanValuePrunes,1);assert.equal(g.count(),2);
 const cut=r.lines.find(line=>line.prunedByBound?.boundKind==='standard-scan-refill');assert(cut);assert.equal(cut.prunedByBound.value,10);assert.equal(cut.prunedByBound.upperBound,8);
}
{
 const g=synthetic();g.root.legalActions.push({actionId:'x-remaining',actorId:'p1',family:'card_corner'});
 const r=searchDecision({...g,cardChoiceEquivalence:true,budget:{transitions:1}});assert(!r.complete);assert.equal(r.actionId,null);assert.equal(r.diagnostics.scanActionPrunes,1);assert.deepEqual(r.unresolved[0].actionIds,['x-remaining']);
}
{
 const g=synthetic();g.port.selectionSpec=node=>node===g.root?{requiredCount:1,cardIds:['z-fast','a-scan'],selectedIds:[],unordered:true,proof:'payment-component'}:null;
 g.port.selectionPlans=()=>g.root.legalActions.map(a=>({firstActionId:a.actionId,selectedIds:[a.actionId],submissions:1,proof:'payment-component'}));
 g.port.expandSelection=(node,ids)=>({node:g.port.expand(node,ids[0]),submissions:1,actions:[{actionId:ids[0]}]});
 g.port.standardScanValueBound=()=>assert.fail('纯付款根必须保留每个实体出口');const r=searchDecision({...g,cardChoiceEquivalence:true});assert(r.complete);assert.equal(r.diagnostics.scanActionPrunes,0);assert.equal(r.lines[0].edges.length,2);
}
comp.dispose();console.log(JSON.stringify({standardScanBound:'passed',rows,strictAndTieAndWatchdog:true}));
