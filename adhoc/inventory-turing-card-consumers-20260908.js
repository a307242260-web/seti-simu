"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const req=require("node:module").createRequire(process.cwd()+"/adhoc/consumer-inventory.js");
const c=req("../randomizer/game/cards/effects");
const output="/Users/bilibili/code/seti-simu/reports/iteration/turing-card-consumer-inventory-20260908.json";
if(fs.existsSync(output)){console.log(`已有checkpoint：${output}`);process.exit(0);}
const relevant=new Set([c.REWARD_TYPES.LAUNCH,...["SCAN_ACTION","CARD_LAND","CARD_ORBIT","FREE_MOVE","CARD_MOVE","COUNT_HAND_CORNER_MOVE","EARTH_SECTOR_CONTENT_MOVE","YICHANGDIAN_LAUNCH_ANOMALY_MOVE"].map(k=>c.EFFECT_TYPES[k])]);
assert.ok([...relevant].every(x=>typeof x==="string"));
const rows=[];
function walk(value,path,out){
 if(!value||typeof value!=="object")return;
 if(relevant.has(value.type))out.push({path,type:value.type,options:value.options||{}});
 for(const [k,v]of Object.entries(value))if(k!=="condition"&&k!=="event")walk(v,path+"."+k,out);
}
for(const [cardId,model]of Object.entries(c.MODELS)){
 const built=[],all=[];walk(c.buildPlayEffects({cardId}),"play",built);walk(model,"model",all);
 if(built.length||all.length)rows.push({cardId,built,model:all});
}
const report={modelCount:Object.keys(c.MODELS).length,rows,scope:"静态候选位置目录，不证明条件满足、奖励可达或已经覆盖动态生成/全部物种；不作为生产剪枝谓词",codeHead:require("node:child_process").execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()};
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({modelCount:report.modelCount,matchingCards:rows.length,onlyOutsideBuiltPlay:rows.filter(r=>!r.built.length).map(r=>({cardId:r.cardId,paths:r.model.map(x=>x.path)}))},null,2));
