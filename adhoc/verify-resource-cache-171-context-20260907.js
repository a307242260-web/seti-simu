"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const output="reports/iteration/resource-cache-171-context-verification-20260907.json";
if(fs.existsSync(output))console.log("已有第二轮上下文核验，不重复生成");else{
  const names=["resource-cache-171-green162-6b5381c1-20260907.json","resource-cache-171-green162-20260907.json","resource-cache-173-green162-20260907.json"];
  const rows=names.map(name=>JSON.parse(fs.readFileSync(`reports/iteration/${name}`)));
  const keys=JSON.parse(fs.readFileSync("reports/iteration/resource-cache-171-keys-20260907.json"));
  assert.equal(keys.rows.length,199);assert.equal(keys.rows.filter(r=>r.conflictingSeats.length).length,17);
  for(const r of rows){
    assert.deepEqual(r.failures,[]);
    assert.deepEqual(r.diagnostics.failedNodeCountByCode,{});
    assert.deepEqual(r.primer.diagnostics.failedNodeCountByCode,{});
    assert.equal(r.diagnostics.executedNodeCount,4096);
    assert.equal(r.diagnostics.successfulInputSubmissionCount,5512);
    assert.equal(r.events.filter(e=>e.step===162&&e.kind==="write").length,10);
  }
  assert.deepEqual(rows[0].plan,rows[1].plan);
  assert.deepEqual(rows[1].plan,rows[2].plan);
  const income=rows[0].plan.steps.filter(s=>s.actionKey.includes('income:')).map(s=>JSON.parse(s.actionKey).target.cardInstanceId);
  assert.deepEqual(income,["card-21-pass-1-2"]);
  const oldRecord=JSON.parse(fs.readFileSync("reports/research/7d87ceb5.6b5381c1.full.json"));
  const newRecord=JSON.parse(fs.readFileSync("reports/research/f237707b.4b246dca.full.json"));
  const original=[oldRecord,newRecord].map((r,i)=>r.metrics.searches.find(s=>s.step===(i?173:171)&&s.kind==="strategic").diagnostics.successfulInputSubmissionCount);
  assert.deepEqual(original,[5539,5539]);
  const result={scope:"第二轮单个绿方前序搜索与两份真实棕方前态的控制变量排除；不是完整历史缓存复现",passed:true,
    sources:names,keys:199,crossSeatSensitiveKeys:17,greenWritesPerRun:10,plansExactlyEqual:true,incomeCardInstanceIds:income,
    cases:rows.map(r=>({codeCommit:r.codeCommit,rootStep:r.rootStep,nodes:r.diagnostics.executedNodeCount,inputs:r.diagnostics.successfulInputSubmissionCount,wallMs:r.wallMs})),
    historicalInputs:original,historicalContextReproduced:false,
    conclusion:"只预热绿162时，两版代码及171/173真实前态都得到同一完整计划；不能据此解释历史b10/b24分歧。历史白164/166等其余搜索上下文未包含。"};
  fs.writeFileSync(output,JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result,null,2));
}
