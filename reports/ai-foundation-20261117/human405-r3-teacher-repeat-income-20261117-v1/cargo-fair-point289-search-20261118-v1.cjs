"use strict";
const fs=require("node:fs"),z=require("node:zlib"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const runtime=path.resolve(process.argv[2]);process.chdir(runtime);
const {open}=require(path.join(__dirname,"native-root-harness-20261118-v1.cjs"));
const dir=path.dirname(__filename),out=path.join(dir,"cargo-fair-point289-search-20261118-v1.json.gz");assert(!fs.existsSync(out),"same source/experiment must not repeat");
const sourceFiles=["randomizer/game/ai/analysis-port.js","randomizer/game/ai/decision-search.js","randomizer/game/cards/play-domain.js","randomizer/game/effects/residual-domain-session.js"];
const hashes=Object.fromEntries(sourceFiles.map(p=>[p,crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")]));
const root=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(dir,"teacher-r4-point289-search-20261118-v1.json.gz")))).root;
const m=open(root);try{const search=m.automatic();const result={kind:"single fixed teacher289 diagnostic; no game",sourceFiles:hashes,root,rootAndRngPreserved:true,gate:{native:256,milliseconds:600},search};result.passed=search.complete&&search.n<=256&&search.ms<=600;fs.writeFileSync(out,z.gzipSync(JSON.stringify(result)));console.log(JSON.stringify({...result,root:undefined,search:{...search,checkpoint:undefined,lines:undefined,roots:search.roots,diagnostics:undefined,analysis:search.analysis}}));}finally{m.dispose()}
