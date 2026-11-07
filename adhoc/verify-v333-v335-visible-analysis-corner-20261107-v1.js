'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),z=require('node:zlib'),Module=require('node:module');
const W='reports/ai-foundation-20261107/',D=W+'v335-research-layout-key-v1/',F='reports/ai-foundation-20261105/third-round-teacher-v1/',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),raw=p=>JSON.parse(z.gunzipSync(fs.readFileSync(p)));
const {buildRuleObservation}=require('../randomizer/app/rule-observation'),v=require('../randomizer/game/ai/state-value'),probe=require('../randomizer/game/ai/probe-capital'),tech=require('../randomizer/game/tech/resolver'),industry=require('../randomizer/game/industry/passives');
function take(ver,label){const f=read(F+'v'+ver+'-cold-'+label+'-20261107-v1.json');assert.equal(sha(f.rawPath),f.rawSha256);assert(f.rootAndRngUnchanged&&f.complete);const g=raw(f.rawPath);return {f,g};}
function normalize(result){const g=JSON.parse(JSON.stringify(result).replace(/seti-complete-decision-search-v(?:334|335)/g,'version'));delete g.diagnostics.milliseconds;return g;}
const a=take(334,'income-before-amiba'),b=take(335,'income-before-amiba');assert.deepEqual(normalize(a.g),normalize(b.g));
const r186=take(334,'v323-actual-r3-step-186'),r187=take(334,'v323-actual-r3-step-187');assert(r186.f.decisionGatePassed&&r187.f.decisionGatePassed);
function techValues(r){return Object.fromEntries(r.g.lines[0].edges.filter(e=>e.resourcePlan?.goal?.tileId).map(e=>[e.resourcePlan.goal.tileId,r.g.lines[e.target].value]));}
const old=techValues(take(333,'v323-actual-r3-step-186')),next=techValues(r186);
assert.equal(old.purple2,143);assert.equal(next.purple2,145.5);assert.equal(next.blue1,148);assert.equal(r187.f.actionId,'choose_target:bdea2e94');
const selected=raw(D+'v323-r3-blue1-purple2-equal-corner-20261107-v1.json.gz'),scan=raw(D+'v323-purple2-native-first-scan-20261107-v1.json.gz');
assert.equal(sha(selected.record),selected.recordSha256);assert(selected.sourceRestored&&scan.sourceRestored);assert.equal(selected.nativeInputs,40);assert.equal(scan.nativeInputs,16);
const pair=selected.branches.filter(x=>x.earlyTech!=='blue4'),seat='player-white';
const snapshots=pair.map(x=>{const s=JSON.parse(x.end.envelope.committedState),o=buildRuleObservation(s,s.meta.seed,seat);return{earlyTech:x.earlyTech,score:x.end.score,income:x.end.income,technology:Object.keys(x.end.tech.ownedTiles),hand:x.end.hand,knownResearch:x.research,value:v.evaluateStateValue(o,seat),firstComputer:x.end.data.placedTokens.map(t=>t.placementSlot)};});
assert.deepEqual(snapshots[0].income,snapshots[1].income);assert.deepEqual(snapshots.map(x=>x.score),[91,91]);assert.deepEqual(snapshots.map(x=>x.technology.length),[4,5]);assert(!pair[0].research.knownResearchFunded&&pair[1].research.knownResearchFunded);
const first=scan.outcomes.map(x=>x.after.wallet);assert.equal(first[0].score,first[1].score);assert.equal(first[1].availableData-first[0].availableData,1);assert.equal(first[0].handSize-first[1].handSize,1);
const priorFile=W+'v331-paid-research-v1/v323-r3-tech-native-counterfactuals-20261107-v1.json.gz',orig=raw(priorFile),control=orig.selected.find(x=>x.step===187&&x.tileId==='purple2'),s=JSON.parse(control.immediate.envelope.committedState),p=s.players.players.find(p=>p.id===seat);
const f={...probe.factsFromState(s,p),supply:s.tech,researchCost:tech.getResearchPublicityCost(p),analyzeEnergyCost:industry.canAnalyzeWithoutEnergy(p)?0:1};
const plan=v.purposeCapital(f).analysisPlan.selected;assert.equal(plan.position,4);assert.equal(plan.publicCorner.cardIndex,7);assert.equal(plan.endpoint.resources.score,86);assert.equal(plan.endpoint.resources.handSize,1);assert.deepEqual(plan.endpoint.computerSlots,[1]);
assert(!v.purposeCapital({...f,amibaTraces:{...f.amibaTraces,displayedCardIndex:null,displayedCardHidden:true}}).analysisPlan.candidates.some(c=>c.publicCorner));
assert(!v.purposeCapital(f,{...v.DEFAULT_WEIGHTS,publicity:.75}).analysisPlan.candidates.some(c=>c.publicCorner));
assert(!v.purposeCapital({...f,turnCardBonusCount:1}).analysisPlan.candidates.some(c=>c.publicCorner));
// Compare the cache's equality relation on real immutable symbol layout
// fragments and cold fallback, then prove eviction cannot alias layouts.
const path=require.resolve('../randomizer/game/ai/state-value'),newModule=new Module(path,module);newModule.filename=path;newModule.paths=module.paths;
const source=fs.readFileSync(path,'utf8'),tag='  return Object.freeze({ diagnosticOrderedResearchQuotes:';assert.equal(source.split(tag).length,2);
newModule._compile(source.replace(tag,'  return Object.freeze({ privateLayoutToken:researchLayoutToken, privateResearchSignature:orderedResearchSignature, diagnosticOrderedResearchQuotes:'),path);
const m=newModule.exports,layout=(i)=>Object.freeze({revealInitialized:true,revealedSlotId:1,symbolSlots:Object.freeze({x:i}),symbolsById:Object.freeze({y:Object.freeze({gain:i})})});
const trigger=symbols=>({available:true,rules:[],completionGroups:[],maximumScoreGain:0,maximumSingleScoreGain:0,wallet:{publicity:5,availableData:2},reason:'known-once-only-research-symbols',symbols});
const key=i=>m.privateResearchSignature(3,[],null,trigger(layout(i)),6,false),initial=key(0);assert.equal(initial,key(0));const keys=Array.from({length:20},(_,i)=>key(i+1));assert.equal(new Set(keys).size,keys.length);assert.notEqual(initial,key(0));
const x=layout(1),t=trigger({...x,symbolSlots:{x:1}});assert.equal(m.privateResearchSignature(3,[],null,t,6,false),JSON.stringify([3,[],null,t,6,false]));
console.log(JSON.stringify({graphV334V335Exact:true,step187:{old,next,action:r187.f.actionId},candidateControls:{knownCorner:plan.publicCorner,exactScore:plan.endpoint.resources.score,unknownOrCustomNoCorner:true},nativeEndAssets:snapshots,purple2MarginalScan:{extraData:1,spentCard:'b_16.webp',scoreChange:0},layoutTokenEvictionSafe:true,newAutonomousRuns:0}));
