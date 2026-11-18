// Usage: node this.cjs <candidate-root> [before-root]
process.chdir(require('node:path').resolve(process.argv[2]||process.cwd()));
"use strict";
const fs=require("node:fs"),z=require("node:zlib"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto"),{open}=require("./native-root-harness-20261118-v1.cjs");
const dir="reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1",out=dir+"/deepspace-point289-comparison-20261118-v1.json.gz";assert(!fs.existsSync(out));
const root=JSON.parse(z.gunzipSync(fs.readFileSync(dir+"/teacher-r4-point289-search-20261118-v1.json.gz"))).root,m=open(root),beforeRoot=process.argv[3],rows=[];
const order=x=>Array.isArray(x)?x.map(order):x&&typeof x==="object"?Object.fromEntries(Object.keys(x).sort().map(k=>[k,order(x[k])])):x;
const digest=x=>crypto.createHash("sha256").update(JSON.stringify(order(x))).digest("hex");
const lines=ls=>ls.map(l=>{const s=l.cardPickPolicy?.selection;if(!s||!["hit","miss"].includes(s.cache))return l;const{cache,...d}=s;return {...l,cardPickPolicy:{...l.cardPickPolicy,selection:d}};});
try{for(const [name,src]of [["before",beforeRoot],["after",process.cwd()]]){
 const p=require(path.join(src,"randomizer/game/ai/analysis-port")).createAnalysisPort({composition:m.c,seatId:"player-white",maxCacheEntries:0});try{
 const q=require(path.join(src,"randomizer/game/ai/search-agent")).createSearchAgent({seatId:"player-white",analysisPort:p}).decide({seatId:"player-white",legalActions:m.menu()}).search;assert.deepEqual(m.save(),root);
 const row={name,actionId:q.actionId,value:q.value,complete:q.complete,unresolved:q.unresolved,native:q.diagnostics.nativeExecutions,ms:q.rootAndSearchMilliseconds,roots:q.roots,lines:q.lines,rootsHash:digest(q.roots),linesHash:digest(lines(q.lines)),diagnostics:q.diagnostics,analysis:q.analysis};rows.push(row);console.log(JSON.stringify({...row,roots:undefined,lines:undefined,diagnostics:undefined,analysis:undefined}));
 }finally{p.close()}}
 const result={kind:"paired fixed teacher289 root; no autonomous game",rows,rootAndRngPreserved:true};fs.writeFileSync(out,z.gzipSync(JSON.stringify(result)));
 for(const k of ["actionId","value","complete","unresolved","rootsHash","linesHash"])assert.deepEqual(rows[1][k],rows[0][k],k);
 assert(rows[1].native<rows[0].native);console.log(JSON.stringify({strictFullSearchEquality:true,nativeSaved:rows[0].native-rows[1].native,company:{starts:rows[1].analysis.provedCompanyStarts,hands:rows[1].analysis.provedCompanyHandMenus,swaps:rows[1].analysis.provedCompanySwaps}}));
}finally{m.dispose()}
