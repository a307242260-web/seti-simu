"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),z=require("node:zlib"),Module=require("node:module");
const {createSimulationRuleComposition}=require("../../training/simulation-rule-composition"),{createSeededRandom}=require("../random"),{buildRuleObservation}=require("../../app/rule-observation"),score=require("../end-game-scoring"),effects=require("../cards/effects"),rockets=require("../rockets"),solar=require("../../solar-system/core");
const file=path.join(__dirname,"analysis-port.js"),src=fs.readFileSync(file,"utf8"),needle="return Object.freeze({ openRoot, expand,";
assert.equal(src.split(needle).length,2);
const testModule=new Module(file,module);testModule.filename=file;testModule.paths=Module._nodeModulePaths(__dirname);
testModule._compile(src.replace(needle,"return Object.freeze({ _testCargo:knownCargoFuture,_testRawCargo:uncachedKnownCargoFuture,_testKey:cargoGainReuseKey, openRoot, expand,"),file);
const f=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(__dirname,"fixtures/cargo-gain-reuse-20261118-v1.json.gz")))),seat="player-white",seed=JSON.parse(f.root.committedState).meta.seed,rows=[];
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v,c)=>buildRuleObservation(s,seed,v?.playerId,[],{cheap:v?.cheap===true,valueOnly:v?.valueOnly===true,trustedCommitted:c?.trustedCommitted===true,trustedFrozenWorking:c?.trustedFrozenWorking===true})});
k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.root).ok);const save=()=>c.lifecycle.save().envelope,live=save();
try{
 for(const example of f.examples){
  const port=testModule.exports.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});port.openRoot();
  const known=new Set(example.known),state=structuredClone(example.state),owner=s=>s.players.players.find(p=>p.id===seat),forbid=example.forbiddenCoordinate;
  const quote=(s=state,ids=known,coordinate=forbid)=>{const before=structuredClone(s),raw=port._testRawCargo(s,ids,coordinate),actual=port._testCargo(s,ids,coordinate);assert.deepEqual(actual,raw,"cached value/plan must equal the original complete Native suffix");assert.deepEqual(s,before,"quote must not mutate its actual source");assert.deepEqual(save(),live,"quote must preserve live Native root/RNG");return actual;};
  try{
   const key=port._testKey(state,known,forbid);assert(key);const first=quote();assert(first);assert.deepEqual(first,example.result,"retain recorded original Native delta");assert.equal(port.getDiagnostics().cargoGainReuse.stores,1);
   const shifted=structuredClone(state);owner(shifted).resources.score+=17;owner(shifted).scoreSources={...owner(shifted).scoreSources,cardPlayScore:999};assert.equal(port._testKey(shifted,known,forbid),key);const shiftedQuote=quote(shifted);assert.equal(shiftedQuote.value,first.value+17);assert.equal(shiftedQuote.gain,first.gain);
   const labelled=structuredClone(state);for(const token of owner(labelled).dataState.poolTokens){token.id="alpha:"+token.id;token.index+=100;}owner(labelled).dataState.poolTokens.reverse();assert.equal(port._testKey(labelled,known,forbid),key);quote(labelled);
   const b2=structuredClone(state);b2.finalScoring.tileVariants.b=2;const beforeScan=quote(b2),b2key=port._testKey(b2,known,forbid);b2.data.sectorSettlements={sectors:{},winsByPlayerId:{}};assert.equal(port._testKey(b2,known,forbid),b2key);const afterScan=quote(b2);assert.equal(afterScan.gain,beforeScan.gain);assert.notEqual(afterScan.value,beforeScan.value,"gold b2 base must be recomputed from current scan progress");
   const wallet=structuredClone(state);owner(wallet).resources.energy++;assert.notEqual(port._testKey(wallet,known,forbid),key);quote(wallet);
   const hand=structuredClone(state);owner(hand).hand.pop();owner(hand).resources.handSize=owner(hand).hand.length;assert.notEqual(port._testKey(hand,known,forbid),key);quote(hand);
   const geometry=structuredClone(state),ship=geometry.pieces.rockets.find(r=>r.kind==="chong-fossil"&&r.playerId===seat);assert(rockets.moveRocket(geometry.pieces,ship.id,0,-1).ok);assert.notEqual(port._testKey(geometry,known,forbid),key);quote(geometry);
   const earth=solar.collectPlanetLocations(state.solarSystem).find(p=>p.planetId==="earth"),blocked={x:earth.x,y:earth.y};assert.notEqual(port._testKey(state,known,blocked),key);quote(state,known,blocked);
   const reduced=new Set(known);reduced.delete(owner(state).hand[0].id);assert.equal(port._testKey(state,reduced,forbid),null);quote(state,reduced);
   const research=structuredClone(state),researchCard=owner(research).reservedCards.find(c=>c.cardId==="amiba_1.webp");assert(researchCard);researchCard.cardEffectState.consumedTriggerIds=[];assert(port._testKey(research,known,forbid),"research-only triggers do not observe cargo events");quote(research);
   const trigger=structuredClone(state),triggerCard={id:"cargo-trigger-control",cardId:"b_2.webp",faceUp:true,cardEffectState:{modelCardId:"b_2.webp",completedTaskIds:[],consumedTriggerIds:[]}};owner(trigger).reservedCards.push(triggerCard);const triggerKnown=new Set([...known,triggerCard.id]);assert(port._testKey(trigger,triggerKnown,forbid)===null,"visit trigger must bypass the cache");quote(trigger,triggerKnown);
   const rules=structuredClone(state),extra=Object.entries(score.CARD_END_GAME_RULES).find(([,r])=>!["planetLandingPairs","amibaTraceCount","chongTraceCount"].includes(r.kind));assert(extra);const card={id:"cargo-end-rule-control",cardId:extra[0],faceUp:true};owner(rules).reservedCards.push(card);const ruleKnown=new Set([...known,card.id]);assert.equal(port._testKey(rules,ruleKnown,forbid),null);quote(rules,ruleKnown);
   const alien=structuredClone(state);Object.values(alien.aliens.aliens)[0].alienId="奥陌陌";assert.equal(port._testKey(alien,known,forbid),null);quote(alien);
   const pool=structuredClone(state);owner(pool).dataState.poolTokens.pop();assert.equal(port._testKey(pool,known,forbid),null);quote(pool);
   const gold=structuredClone(state);for(const tile of Object.values(gold.finalScoring.tiles))tile.marks=tile.marks.filter(m=>m.playerId!==seat||m.threshold!==25);assert.equal(port._testKey(gold,known,forbid),null);quote(gold);
   const expected=quote();first.plans[0].funding[0].kind="corrupt";const hit=quote();hit.plans[0].path[0].deltaX=999;assert.deepEqual(quote(),expected,"callers cannot poison cached plan metadata");
   const stats=port.getDiagnostics().cargoGainReuse;assert(stats.hits>=5&&stats.bypasses>=5&&stats.entries<=64);rows.push({value:first.value,gain:first.gain,controls:15,hits:stats.hits,bypasses:stats.bypasses});
   port.close();port.openRoot();assert.equal(port.getDiagnostics().cargoGainReuse.entries,0);assert.equal(port.getDiagnostics().cargoGainReuse.hits,0);
  }finally{port.close();}
 }
 console.log(JSON.stringify({cargoGainReuse:"passed",examples:rows,sourceAndRngExact:true,resultMutationSafe:true,rootReopenClearsCache:true}));
}finally{c.dispose();}
