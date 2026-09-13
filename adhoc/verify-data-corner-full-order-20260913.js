"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const output="adhoc/data-corner-full-order-20260913.json";
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
const records=["874d71c3.de73734c.full.json","44713766.236c6969.full.json"];
const saves=records.map(f=>JSON.parse(fs.readFileSync(JSON.parse(fs.readFileSync("reports/research/"+f)).savePath)));
assert.equal(saves[0].replaySteps.length,542);assert.equal(saves[1].replaySteps.length,542);
const differences=[];
for(let i=0;i<542;i++){
  const [a,b]=saves.map(s=>s.replaySteps[i]);assert.deepEqual(a.after,b.after,`after${i+1}`);
  if(JSON.stringify(a.action)!==JSON.stringify(b.action))differences.push({step:i+1,baseline:a.action,candidate:b.action});
}
assert.deepEqual(differences.map(d=>d.step),[526,530]);
assert(differences.every(d=>d.baseline.family==="card_corner"&&d.candidate.family==="card_corner"));
assert.equal(differences[0].baseline.target.cardInstanceId,differences[1].candidate.target.cardInstanceId);
assert.equal(differences[1].baseline.target.cardInstanceId,differences[0].candidate.target.cardInstanceId);
fs.writeFileSync(output,JSON.stringify({records,steps:542,differences,allAfterEqual:true,
  scope:"完整动作差异只有两张普通角标交换使用顺序，所有记录after逐项相同；after不含全部牌序与隐藏状态，不冒充完整中间状态等价。正式终局分另由full-comparison核验。"},null,2)+"\n",{flag:"wx"});
console.log(`[全局动作核验] 542个after相同，仅526/530角标顺序互换；${output}`);
