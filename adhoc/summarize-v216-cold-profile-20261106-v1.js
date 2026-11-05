'use strict';
const fs=require('node:fs'),z=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const label=process.argv[2],input=`reports/ai-foundation-20261105/third-round-teacher-v1/v216-${label}-profile-20261106-v1.cpuprofile.gz`,out=input.replace('.cpuprofile.gz','-summary.json');assert(!fs.existsSync(out));
const bytes=fs.readFileSync(input),p=JSON.parse(z.gunzipSync(bytes)),nodes=new Map(p.nodes.map(n=>[n.id,n])),parents=new Map();for(const n of p.nodes)for(const c of n.children||[])parents.set(c,n.id);
const self=new Map(),cloneCallers=new Map();let total=0,withinQuote=0,withinPortfolio=0;
for(let i=0;i<p.samples.length;i++){
 let n=nodes.get(p.samples[i]),q=false,pc=false;const dt=p.timeDeltas?.[i]||0,f=n.callFrame,key=(f.url.split('/').slice(-3).join('/')||f.url)+':'+f.functionName;self.set(key,(self.get(key)||0)+dt);total+=dt;
 if(f.functionName==='structuredClone'){const stack=[];let caller=n;for(let k=0;k<4;k++){caller=nodes.get(parents.get(caller.id));if(!caller)break;stack.push(caller.callFrame.url.split('/').slice(-2).join('/')+':'+caller.callFrame.functionName);}const key=stack.join(' <- ');cloneCallers.set(key,(cloneCallers.get(key)||0)+dt);}
 while(n){if(n.callFrame.url.endsWith('/research-income-capital.js'))q=true;if(n.callFrame.functionName==='purposeCapital')pc=true;n=nodes.get(parents.get(n.id));}if(q)withinQuote+=dt;if(pc)withinPortfolio+=dt;
}
const top=m=>[...m].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([key,us])=>({key,milliseconds:us/1000}));
const report={input,inputSha256:crypto.createHash('sha256').update(bytes).digest('hex'),timingScope:'Instrumented root-and-search CPU samples only, not a cold decision admission sample',profileMs:total/1000,withinResearchIncomeMs:withinQuote/1000,withinPurposeMs:withinPortfolio/1000,self:top(self),structuredCloneCallers:top(cloneCallers)};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({profileMs:report.profileMs,withinResearchIncomeMs:report.withinResearchIncomeMs,withinPurposeMs:report.withinPurposeMs}));
