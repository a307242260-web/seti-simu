"use strict";
// 比较两个浏览器存档的逐 step 动作/状态，列出分叉点。
// 用法: node adhoc/diff-runs-by-state.js <saveA.json> <saveB.json> [最多打印条数]
const fs=require("node:fs");
const [,,aPath,bPath,limitArg]=process.argv;
const limit=Number(limitArg)||12;
const A=JSON.parse(fs.readFileSync(aPath)), B=JSON.parse(fs.readFileSync(bPath));
const a=A.replaySteps||[], b=B.replaySteps||[];
console.log(`A=${A.name||aPath} 步数=${a.length}`);
console.log(`B=${B.name||bPath} 步数=${b.length}`);
const fam=t=>String(t||"").split(":")[0];
let shown=0, first=null;
for(let i=0;i<Math.min(a.length,b.length);i++){
  const aa=a[i].get?.("after")??a[i].after, ab=b[i].get?.("after")??b[i].after;
  const actA=(a[i].action||{}).actionId, actB=(b[i].action||{}).actionId;
  const stateSame=JSON.stringify(aa?.p)===JSON.stringify(ab?.p)&&aa?.c===ab?.c;
  if(actA!==actB||!stateSame){
    if(first===null) first=i;
    if(shown<limit){
      console.log(`步${i}  A:${a[i].actorPlayerId} ${actA}  |  B:${b[i].actorPlayerId} ${actB}${stateSame?"":"  [状态亦不同]"}`);
      shown++;
    }
  }
}
console.log(first===null?"无分叉：两局完全一致":`首个分叉步=${first}；以上最多列出 ${shown} 条`);
