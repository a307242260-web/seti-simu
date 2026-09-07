"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const {createRequire}=require("node:module");
const output="reports/iteration/resource-cache-122-keys-20260907.json",tree=process.argv[2];assert.ok(path.isAbsolute(tree));
function selector(){
  const filename=path.join(tree,"randomizer/game/ai/expected-score-evaluator.js"),source=fs.readFileSync(filename,"utf8"),marker="    EVALUATION_MODEL,\n    PARAMETER_VERSION,";
  assert.equal(source.split(marker).length,2);const box={module:{exports:{}},require:createRequire(filename)};
  vm.runInNewContext(source.replace(marker,"    diagnosticSelect: selectMinimumCostResourcePreparation,\n"+marker),box,{filename});return box.module.exports.diagnosticSelect;
}
if(fs.existsSync(output))console.log("已有具体键对照");else{
  const env=require(path.join(tree,"randomizer/app/simulation-env")).createSimulationEnv(),bySeat={};
  try{
    const record=JSON.parse(fs.readFileSync("reports/research/f237707b.4b246dca.full.json")),save=JSON.parse(fs.readFileSync(record.savePath));
    env.reset(JSON.parse(fs.readFileSync("reports/iteration/company-income-122-20260907.json")).checkpoint.config);
    for(let i=0;i<122;i++){
      const legal=env.legalActions();for(const a of legal.filter(a=>a.family==="quick_trade")){bySeat[a.actorId]||={};bySeat[a.actorId][a.target.tradeId]=a.actionId;}
      if(i===121)break;const action=legal.find(a=>a.actionId===save.replaySteps[i].action.actionId);assert.deepEqual(action,save.replaySteps[i].action);assert.equal(env.step(action).ok,true);
    }
  }finally{env.dispose();}
  const writes=JSON.parse(fs.readFileSync("reports/iteration/resource-cache-122-trace-20260907.json")).events.filter(e=>e.kind==="write");
  const selectors=Object.fromEntries(Object.keys(bySeat).map(s=>[s,selector()])),rows=[];
  for(const event of writes){
    const observation={outcomeProjection:{assets:{...event.initial,ordinaryCards:event.initial.handSize}},selfState:{hand:Array(event.initial.handSize).fill({})}};
    const results={};
    for(const [seat,fn]of Object.entries(selectors)){
      const actions=event.legal.map(([tradeId,a])=>{assert.ok(bySeat[seat][tradeId],`${seat}:${tradeId}缺少真实动作编号`);return{...a,actorId:seat,actionId:bySeat[seat][tradeId]};});
      results[seat]=Array.from(fn(observation,event.target,actions,seat),a=>a.target.tradeId);
    }
    assert.deepEqual(results["player-brown"],event.plannedTradeIds,"重建纯函数输入必须复现实测写入");
    rows.push({key:event.key,initial:event.initial,target:event.target,results,conflictingSeats:Object.keys(results).filter(s=>JSON.stringify(results[s])!==JSON.stringify(event.plannedTradeIds))});
  }
  fs.writeFileSync(output,JSON.stringify({scope:"实测122缓存写入键的纯函数控制变量对照；动作编号从正式重放前122步合法集采集，不代表其他席位实际写过这些键",bySeat,rows},null,2)+"\n");
  console.log(JSON.stringify({keys:rows.length,conflicts:rows.filter(r=>r.conflictingSeats.length)}));
}
