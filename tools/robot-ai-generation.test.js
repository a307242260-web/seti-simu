"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),{spawnSync}=require("node:child_process");
const lib=require("./robot-iteration-lib"),{recordAIGeneration,versionAIGeneration,validateAIGenerations,computeBestOf}=lib;
assert.equal(recordAIGeneration({policyVersion:"seti-heuristic-policy-v2"}),"v1","旧策略内部版本号不等于 AI 主线");
for(const agentType of ["completion","search"])assert.equal(recordAIGeneration({agentType}),"v2");
assert.equal(recordAIGeneration({policyVersion:"seti-search-agent-v2/anything"}),"v2");
assert.equal(recordAIGeneration({policyVersion:"seti-completion-agent-v1"}),"v2","基础策略的内部v1仍属于新AI主线");
assert.throws(()=>recordAIGeneration({agentType:"unknown"}),/TYPE_INVALID/);
assert.throws(()=>recordAIGeneration({agentType:"heuristic",policyVersion:"seti-search-agent-v2"}),/MISMATCH/);
const records={old:{agentType:"heuristic"},base:{agentType:"completion"},new:{agentType:"search"}};
assert.equal(versionAIGeneration({id:"v2-old-name",records:{old:{}}},records),"v1");
assert.equal(versionAIGeneration({id:"v1-new-name",records:{base:{}}},records),"v2");
assert.throws(()=>versionAIGeneration({id:"mixed",records:{old:{},new:{}}},records),/GENERATION_MIXED/);
assert.throws(()=>versionAIGeneration({id:"wrong",aiGeneration:"v1",records:{new:{}}},records),/GENERATION_MIXED/);
assert.throws(()=>versionAIGeneration({id:"wrong",aiGeneration:"v3"},records),/GENERATION_INVALID/);
assert.throws(()=>validateAIGenerations([{id:"old",records:{old:{}}},{id:"new",records:{new:{}},baseline:"old"}],records),/BASELINE_GENERATION_MISMATCH/);
assert.equal(validateAIGenerations([{id:"base",records:{base:{}}},{id:"new",records:{new:{}},baseline:"base"}],records).get("new"),"v2");
assert.throws(()=>computeBestOf([{id:"old",aiGeneration:"v1"},{id:"new",aiGeneration:"v2"}],{}),/BEST_OF_GENERATION_MIXED/);
// An explicitly incomplete attempt stays visible, but cannot become current baseline.
assert.equal(lib.selectCurrentBaseline([{id:"failed",head:"same",baselineEligible:false}],"same"),null);
assert.equal(lib.selectCurrentBaseline([{id:"failed",head:"same",baselineEligible:false},{id:"accepted",head:"same"}],"same").id,"accepted");
// Automatic parent selection must also skip incomplete versions, not only the current-baseline badge.
const cliSource=fs.readFileSync(path.join(__dirname,'robot_iterate.js'),'utf8');
const autoBody=cliSource.match(/function autoBaseline\([\s\S]*?\n}/)[0];
const selectParent=vm.runInNewContext('('+autoBody+')',{versionAIGeneration,gitIsAncestor:()=>true});
assert.equal(selectParent([{id:'failed-parent',head:'a',agentType:'search',baselineEligible:false},{id:'valid-parent',head:'b',agentType:'search'}],'next','v2',{}),'valid-parent');
// Same-world score and speed champions remain inside the chosen generation.
const run=(score)=>({mode:"full",terminal:true,avgScore:score,scores:{"player-white":score},wallMs:score,steps:1,recordFile:`${score}.json`,world:{fingerprint:"same",worldVersion:"test"}});
const versions=[{id:"old",aiGeneration:"v1"},{id:"new",aiGeneration:"v2"}],resolved={old:[run(999)],new:[run(10)]};
assert.equal(computeBestOf(versions.filter(v=>v.aiGeneration==="v2"),resolved).bestAvg.value,10);
assert.equal(computeBestOf(versions.filter(v=>v.aiGeneration==="v1"),resolved).bestAvg.value,999);
// Render the real template script with a minimal DOM; switching URL selects every displayed summary and row.
const fixture={board:{},builtAt:"test",headCommit:"abc",defaultGeneration:"v2",generations:{
 v1:{versionCount:1,recordCount:1,currentBaseline:"old",bestOf:computeBestOf([versions[0]],resolved)},
 v2:{versionCount:1,recordCount:1,currentBaseline:"new",bestOf:computeBestOf([versions[1]],resolved)}},
 versions:versions.map(v=>({...v,name:v.id,results:[{...resolved[v.id][0],agentType:v.aiGeneration==="v2"?"completion":"heuristic"}],completeness:{reportLinks:[]}}))};
function render(registry,query){const elements=new Map(),document={title:"",getElementById(id){if(!elements.has(id))elements.set(id,{innerHTML:"",textContent:"",attributes:{},setAttribute(k,v){this.attributes[k]=v;}});return elements.get(id);}};
 const template=fs.readFileSync(lib.TEMPLATE_PATH,"utf8"),script=template.match(/<script>([\s\S]*?)<\/script>/)[1].replace("/*__REGISTRY_JSON__*/",JSON.stringify(registry).replace(/</g,"\\u003c"));
 const context=vm.createContext({document,location:{search:query},URLSearchParams});vm.runInContext(script,context);
 return{elements,document,selected:JSON.parse(vm.runInContext("JSON.stringify(REGISTRY)",context))};}
for(const [query,generation,id,score] of [["","v2","new",10],["?ai=v2","v2","new",10],["?ai=v1","v1","old",999]]){
 const r=render(fixture,query);assert.deepEqual(r.selected.versions.map(v=>v.id),[id]);assert.equal(r.selected.bestOf.bestAvg.value,score);
 assert.equal(r.selected.currentBaseline,id);assert(r.document.title.includes(generation.toUpperCase()));
 assert.equal(r.elements.get(`tab-${generation}`).attributes["aria-current"],"page");assert(r.elements.get("iter-container").innerHTML.includes(`<b>${id}</b>`));
 assert(!r.elements.get("iter-container").innerHTML.includes(`<b>${id==="old"?"new":"old"}</b>`));
 if(generation==="v2")assert(r.elements.get("iter-container").innerHTML.includes("基础策略（无搜索）"));}
const empty=structuredClone(fixture);empty.versions=empty.versions.filter(v=>v.aiGeneration==="v1");empty.generations.v2={versionCount:0,recordCount:0,currentBaseline:null,bestOf:computeBestOf([],{})};
assert.equal(render(empty,"").selected.bestOf.bestAvg,null,"空V2绝不回退到V1成绩");
// Negative registration/run cases must reject before starting any experiment or writing versions.
const original=fs.readFileSync(lib.VERSIONS_PATH),base=JSON.parse(original),v2=base.versions.find(v=>v.aiGeneration==="v2"),v1=base.versions.find(v=>!v.aiGeneration);
for(const args of [["run","--name","generation-negative-test","--config","agentType=search","--baseline",v1.id],
 ["register","--version-id",v2.id,"--baseline",v1.id]]){
 const out=spawnSync(process.execPath,[path.join(__dirname,"robot_iterate.js"),...args],{cwd:lib.REPO_ROOT,encoding:"utf8"});
 assert.notEqual(out.status,0);assert.match(out.stderr,/V1\/V2|BASELINE_GENERATION_MISMATCH/);assert.deepEqual(fs.readFileSync(lib.VERSIONS_PATH),original);}
// Verify the built real dataset and all links for new-mainline records without replaying games.
const built=JSON.parse(fs.readFileSync(lib.REGISTRY_PATH));assert.equal(built.defaultGeneration,"v2");
for(const generation of ["v1","v2"]){const selected=render(built,`?ai=${generation}`).selected;assert(selected.versions.every(v=>v.aiGeneration===generation));
 const ids=new Set(selected.versions.map(v=>v.id));for(const champion of [selected.bestOf.bestPlayer,selected.bestOf.bestAvg,selected.bestOf.fastestWall,...selected.bestOf.topByAvg])if(champion)assert(ids.has(champion.versionId));
 if(selected.currentBaseline)assert(ids.has(selected.currentBaseline));}
const newVersions=built.versions.filter(v=>v.id.startsWith("ai-foundation"));assert(newVersions.every(v=>v.aiGeneration==="v2"));assert.equal(newVersions.length,9);
for(const version of newVersions)for(const result of version.results){assert(!result.missingRecord);assert.equal(result.agentType,"completion");assert(result.terminal);assert.equal(result.scoreSource,"save-final");
 for(const p of [result.recordPath,result.savePath,result.reportPath])assert(fs.existsSync(path.resolve(lib.REPO_ROOT,p)),p);}
const incompleteSearch=built.versions.filter(v=>v.agentType==="search"||v.results.some(r=>r.agentType==="search")).flatMap(v=>v.results.filter(r=>!r.terminal).map(r=>({version:v,result:r})));
for(const {version,result} of incompleteSearch){assert.equal(version.baselineEligible,false);assert.equal(version.isHead,false);assert.notEqual(built.generations.v2.currentBaseline,version.id);const raw=JSON.parse(fs.readFileSync(path.resolve(lib.REPO_ROOT,result.recordPath)));if([require("./research-human405-round1").ID,require("./research-human405-round1").B117_PREFIX_ID].includes(raw.scenario?.id)&&raw.scenarioResult?.firstRoundSettled&&raw.status!=='failed'){assert.equal(raw.scoreSemantics,'provisional-after-round1-settlement');assert.deepEqual(result.scores,raw.summary.scores);assert(!built.generations.v2.bestOf.topByAvg.some(r=>r.versionId===version.id));}else assert(Object.values(result.scores).every(score=>score==null));}
console.log(JSON.stringify({incompleteSearchAttempts:incompleteSearch.length,aiGenerationIsolation:"passed",v2Versions:newVersions.length,v2CompleteGames:newVersions.reduce((n,v)=>n+v.results.length,0),searchCompleteGames:built.versions.flatMap(v=>v.results).filter(r=>r.agentType==="search"&&r.terminal).length,templateQueries:3,registrationRejects:2}));
