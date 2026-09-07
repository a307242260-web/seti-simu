"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),zlib=require("node:zlib");
const output="reports/iteration/resource-cache-causality-20260907.json";
if(fs.existsSync(output))console.log("已有因果核验");else{
  const read=p=>JSON.parse(fs.readFileSync(p));
  const cold=read("reports/iteration/resource-cache-122-trace-20260907.json"),old=read("reports/iteration/resource-cache-122-blue50-20260907.json"),fixed=read("reports/iteration/resource-cache-122-blue50-1f55695a-20260907.json");
  const native=JSON.parse(zlib.gunzipSync(fs.readFileSync("reports/iteration/company-income-122-20260907.capture.json.gz")));
  const oldRecord=read("reports/research/f237707b.4b246dca.full.json"),oldSave=read(oldRecord.savePath);
  for(const r of [cold,old,fixed]){assert.deepEqual(r.failures,[]);assert.deepEqual(r.diagnostics.failedNodeCountByCode,{});assert.equal(r.diagnostics.executionLimitReached,false);}
  const oldWrite=old.events.find(e=>e.step===50&&e.kind==="write");assert.ok(oldWrite);
  assert.deepEqual(oldWrite.plannedTradeIds,["publicity-for-card"]);
  assert.ok(old.events.some(e=>e.step===122&&e.kind==="lookup"&&e.key===oldWrite.key&&JSON.stringify(e.cached)==='["publicity-for-card"]'));
  const fixedWrite=fixed.events.find(e=>e.step===122&&e.kind==="write");assert.ok(fixedWrite);
  assert.deepEqual(fixedWrite.plannedTradeIds,["cards-for-energy"]);assert.notEqual(fixedWrite.key,fixed.events.find(e=>e.step===50&&e.kind==="write").key);
  assert.deepEqual(fixed.plan,native.result.plan);assert.deepEqual(cold.plan,fixed.plan);
  assert.deepEqual(old.plan.steps.map(s=>s.actionId),oldSave.replaySteps.slice(122,122+old.plan.steps.length).map(s=>s.action.actionId));
  const expected=oldRecord.metrics.searches.find(s=>s.step===122&&s.kind==="strategic").diagnostics;
  assert.equal(old.diagnostics.executedNodeCount,expected.executedNodeCount);assert.equal(old.diagnostics.successfulInputSubmissionCount,expected.successfulInputSubmissionCount);
  fs.writeFileSync(output,JSON.stringify({scope:"只读核验真实蓝50写入→棕122命中→原收入计划重现；不外推全部终局降分",passed:true,
    previousWriter:{step:50,seat:oldWrite.seatId,trades:oldWrite.plannedTradeIds},previousConsumer:{step:122,nodes:old.diagnostics.executedNodeCount,inputs:old.diagnostics.successfulInputSubmissionCount,incomeAction:old.plan.steps[1].actionId},
    fixedConsumer:{step:122,nodes:fixed.diagnostics.executedNodeCount,inputs:fixed.diagnostics.successfulInputSubmissionCount,incomeAction:fixed.plan.steps[1].actionId,trades:fixedWrite.plannedTradeIds},
    oldPlanMatchesHistoricalInputs:true,fixedWarmPlanMatchesColdAndFullCapture:true},null,2)+"\n");
  console.log(fs.readFileSync(output,"utf8"));
}
