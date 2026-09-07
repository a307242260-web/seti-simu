"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const output="reports/iteration/turing-pressure-profile-20260908.json";
if(fs.existsSync(output)){console.log(`已有checkpoint：${output}`);process.exit(0);}
const record=JSON.parse(fs.readFileSync("reports/research/cb456d23.04648dd1.full.json"));
const key="choose_target:conditional/decision=choose_target/effect=residual_company_decision/step=turing_tech/ability=turing_borrow_tech";
const summary=()=>({nodes:0,borrow:0,industry:0,classes:{}});
const all=summary(),capped=summary(),rows=[];
for(const s of record.metrics.searches){
 const d=s.diagnostics,borrow=d.executedNodeCountByDecisionKind[key]||0;
 const industry=d.executedNodeCountByActionSummary["industry:图灵系统 1x 行动"]||0;
 const cap=s.kind==="strategic"&&d.executedNodeCount===d.maxExecutionNodes;
 for(const out of cap?[all,capped]:[all]){
  out.nodes+=d.executedNodeCount;out.borrow+=borrow;out.industry+=industry;
  for(const [k,n]of Object.entries(d.executedNodeCountByDecisionKind))out.classes[k]=(out.classes[k]||0)+n;
 }
 if(borrow||industry)rows.push({step:s.step,kind:s.kind,seat:s.seat,nodes:d.executedNodeCount,borrow,industry,cap});
}
for(const x of [all,capped]){assert.equal(Object.values(x.classes).reduce((a,b)=>a+b,0),x.nodes);x.borrowPercent=x.borrow/x.nodes*100;x.companyPercent=(x.borrow+x.industry)/x.nodes*100;}
const r={record:"cb456d23.04648dd1.full.json",all,capped,rows:rows.sort((a,b)=>(b.borrow+b.industry)-(a.borrow+a.industry)),scope:"物理节点；公司入口按具名动作摘要识别，借用按正式Decision来源识别；不是无用途节点判定。"};
fs.writeFileSync(output,JSON.stringify(r,null,2)+"\n");console.log(JSON.stringify({all:{nodes:all.nodes,borrow:all.borrow,industry:all.industry,percent:all.companyPercent},capped:{nodes:capped.nodes,borrow:capped.borrow,industry:capped.industry,percent:capped.companyPercent},top:r.rows.slice(0,6)},null,2));
