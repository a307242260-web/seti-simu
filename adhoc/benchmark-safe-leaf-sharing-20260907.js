"use strict";
const fs=require("node:fs"),v8=require("node:v8"),zlib=require("node:zlib"),assert=require("node:assert/strict");
const port=require("../randomizer/game/ai/policy-port"),evaluator=require("../randomizer/game/ai/expected-score-evaluator");
const policy=require("../randomizer/game/ai/heuristic-policy").createHeuristicPolicy({difficulty:"laughable"});
const output="reports/iteration/safe-leaf-sharing-benchmark-20260907.json";
function createShare() {
  const eligible=new WeakMap(),values=new Map();
  function safe(value) {
    if(value===null || typeof value === "string" || typeof value === "boolean")return true;
    if(typeof value === "number")return Number.isFinite(value)&&!Object.is(value,-0);
    if(typeof value !== "object")return false;
    if(eligible.has(value))return eligible.get(value);
    eligible.set(value,false); // 当前祖先的重入（循环）不符合可共享的JSON树。
    const array=Array.isArray(value),proto=Object.getPrototypeOf(value);
    if(!Object.isFrozen(value)||proto!==(array?Array.prototype:Object.prototype)
      ||Object.getOwnPropertyDescriptor(Object.prototype,"toJSON")
      ||(array&&Object.getOwnPropertyDescriptor(Array.prototype,"toJSON")))return false;
    const keys=Reflect.ownKeys(value);
    if(array&&keys.length!==value.length+1)return false;
    for(const key of keys) {
      if(array&&key==="length")continue;
      if(typeof key!=="string"||key==="toJSON")return false;
      if(array&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=value.length))return false;
      const d=Object.getOwnPropertyDescriptor(value,key);
      if(!d.enumerable||!Object.hasOwn(d,"value")||!safe(d.value))return false;
    }
    eligible.set(value,true);return true;
  }
  return value=>{if(!safe(value))return value;const key=JSON.stringify(value);
    if(!values.has(key))values.set(key,value);return values.get(key);};
}
function freeze(value,seen=new WeakSet()) {if(!value||typeof value!=="object"||seen.has(value))return value;
  seen.add(value);for(const d of Object.values(Object.getOwnPropertyDescriptors(value)))if(Object.hasOwn(d,"value"))freeze(d.value,seen);
  return Object.freeze(value);}
if(fs.existsSync(output))console.log(`已有证据，跳过：${output}`);
else {
  const report={scope:"冻结真实保存图后离线测严格可共享子集；冻结恢复模拟生产已冻结状态，不计入处理时间；不修改生产"};
  try {
    const share=createShare();let calls=0;
    const valid=freeze({a:1,list:[true,null,"x"]});assert.equal(share(freeze({a:1,list:[true,null,"x"]})),share(valid));
    const accessor=Object.freeze(Object.defineProperty({},"a",{enumerable:true,get(){calls++;return 1;}}));
    const special=freeze({toJSON(){calls++;return {};}}),bad=[accessor,special,freeze({a:undefined}),freeze({a:NaN}),freeze({a:Infinity}),freeze({a:-0}),freeze(new Date(0)),freeze([,1]),freeze(Object.assign([1],{extra:2})),freeze(Object.create(null))];
    for(const x of bad)assert.equal(share(x),x);
    const cycle={};cycle.self=cycle;freeze(cycle);assert.equal(share(cycle),cycle);assert.equal(calls,0);
    const missing=freeze({}),undef=bad[2];assert.notEqual(share(missing),share(undef));
    report.boundaryChecks=true;
    const input=freeze(v8.deserialize(zlib.gunzipSync(fs.readFileSync("reports/iteration/policy-input-42-20260906.v8.gz"))));
    const view={...input,actionOutcomes:input.actionOutcomes.map(o=>({...o,leaves:o.leaves.map(({planSteps,...l})=>l)}))};
    let start=performance.now(),baseline=port.createDecisionContext(view);report.baselineMs=performance.now()-start;
    const scores=baseline.legalActions.map(a=>evaluator.evaluateAction(baseline,a)),decision=policy.decide(baseline);
    baseline=null;global.gc?.();start=performance.now();const intern=createShare();
    const candidateView={...view,actionOutcomes:view.actionOutcomes.map(o=>({...o,leaves:o.leaves.map(l=>({...l,observation:intern(l.observation)}))}))};
    report.sharingMs=performance.now()-start;const candidate=port.createDecisionContext(candidateView);report.candidateTotalMs=performance.now()-start;
    assert.deepEqual(candidateView,view);assert.deepEqual(candidate.legalActions.map(a=>evaluator.evaluateAction(candidate,a)),scores);assert.deepEqual(policy.decide(candidate),decision);
    report.leaves=candidateView.actionOutcomes.reduce((n,o)=>n+o.leaves.length,0);
    report.distinctObservationObjects=new Set(candidateView.actionOutcomes.flatMap(o=>o.leaves.map(l=>l.observation))).size;
    report.sameValuesAndEvaluations=true;report.passed=true;
  }catch(error){report.passed=false;report.error={message:error.message,stack:error.stack};process.exitCode=1;}
  finally{fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));}
}
