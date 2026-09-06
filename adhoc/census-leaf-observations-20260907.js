"use strict";
const fs=require("node:fs"),v8=require("node:v8"),zlib=require("node:zlib"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const source="reports/iteration/policy-input-42-20260906.v8.gz";
const output="reports/iteration/leaf-observation-census-20260907.json";
if(fs.existsSync(output)) console.log(`已有统计，跳过：${output}`);
else {
  const bytes=fs.readFileSync(source), input=v8.deserialize(zlib.gunzipSync(bytes));
  const leaves=input.actionOutcomes.flatMap(o=>o.leaves),report={source,sha256:crypto.createHash("sha256").update(bytes).digest("hex"),
    scope:"只读真实42已保留叶；按完整JSON值分组并深比较验证重复，不裁字段；不同键顺序不合并，保守计数；不是物理状态/节点去重证明",fields:{}};
  for(const field of ["observation","rootActionObservation","rootActionSettledObservation"]){
    const groups=new Map(),identities=new Set();let occurrences=0,uniqueIdentityJsonBytes=0;
    for(const leaf of leaves){const value=leaf[field];if(value==null)continue;occurrences++;
      if(identities.has(value))continue;identities.add(value);
      const json=JSON.stringify(value),size=Buffer.byteLength(json),key=crypto.createHash("sha256").update(json).digest("hex");
      uniqueIdentityJsonBytes+=size;
      if(groups.has(key)){const g=groups.get(key);assert.deepEqual(value,g.value);g.count++;}
      else groups.set(key,{value,size,count:1});
    }
    report.fields[field]={occurrences,identities:identities.size,distinctFullValues:groups.size,
      repeatedIndependentCopies:identities.size-groups.size,uniqueIdentityJsonBytes,
      distinctValueJsonBytes:[...groups.values()].reduce((n,g)=>n+g.size,0),
      duplicateGroups:[...groups.values()].filter(g=>g.count>1).map(g=>({copies:g.count,jsonBytesEach:g.size})).sort((a,b)=>b.copies-a.copies)};
  }
  report.passed=true;fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({output,fields:Object.fromEntries(Object.entries(report.fields).map(([k,{duplicateGroups,...v}])=>[k,v]))}));
}
