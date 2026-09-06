"use strict";
const fs=require("node:fs"),v8=require("node:v8"),zlib=require("node:zlib"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const port=require("../randomizer/game/ai/policy-port"),evaluator=require("../randomizer/game/ai/expected-score-evaluator");
const policy=require("../randomizer/game/ai/heuristic-policy").createHeuristicPolicy({difficulty:"laughable"});
const output="reports/iteration/leaf-interning-benchmark-20260907.json";
const source="reports/iteration/policy-input-42-20260906.v8.gz";
if(fs.existsSync(output))console.log(`已有记录，跳过：${output}`);
else {
  const input=v8.deserialize(zlib.gunzipSync(fs.readFileSync(source)));
  const view={...input,actionOutcomes:input.actionOutcomes.map(o=>({...o,leaves:o.leaves.map(({planSteps,...l})=>l)}))};
  const hash=x=>crypto.createHash("sha256").update(v8.serialize(x)).digest("hex");
  const sourceHash=hash(input),report={source,scope:"已保存可信叶观察的离线完整值驻留实验；保留所有叶和元数据、通用Policy校验，不是生产实现或节点优化；计时含完整JSON生成与索引"};
  try {
    let start=performance.now();let baseline=port.createDecisionContext(view);report.baselineMs=performance.now()-start;
    const scores=baseline.legalActions.map(a=>evaluator.evaluateAction(baseline,a));const decision=policy.decide(baseline);
    baseline=null;global.gc?.();
    start=performance.now();const groups=new Map();
    const candidateView={...view,actionOutcomes:view.actionOutcomes.map(o=>({...o,leaves:o.leaves.map(l=>{
      const key=JSON.stringify(l.observation);if(!groups.has(key))groups.set(key,l.observation);
      return {...l,observation:groups.get(key)};
    })}))};
    report.internMs=performance.now()-start;
    const candidate=port.createDecisionContext(candidateView);report.candidateTotalMs=performance.now()-start;
    assert.deepEqual(candidate.legalActions.map(a=>evaluator.evaluateAction(candidate,a)),scores);
    assert.deepEqual(policy.decide(candidate),decision);
    assert.deepEqual(candidateView,view);
    assert.equal(hash(input),sourceHash);
    report.sameCompleteValues=true;report.sameEvaluations=true;report.sameDecision=true;report.sourceUnchanged=true;
    report.leaves=candidate.actionOutcomes.reduce((n,o)=>n+o.leaves.length,0);report.distinctObservations=groups.size;
    report.actionId=decision.actionId;report.passed=true;
  }catch(error){report.passed=false;report.error={message:error.message,stack:error.stack};process.exitCode=1;}
  finally{fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report));}
}
