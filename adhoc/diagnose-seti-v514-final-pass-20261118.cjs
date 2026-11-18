'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');
const runtime='/var/folders/cl/yh68cq4s3pz4w8cy0_95jbj00000gn/T/seti-v514-standalone-20261118-kyog1z0g';
const target=path.join(runtime,'randomizer/game/ai/pre-main-data-plan.test.js');
const out='/Users/bilibili/code/seti-simu/reports/ai-foundation-20261118/v514-final-pass-diagnostic-20261118-v1.json';
if(fs.existsSync(out))throw Error('reuse saved diagnostic');
const original=fs.readFileSync(target,'utf8');
const prefix=original.slice(0,original.indexOf('const cases ='));
const helpers=original.slice(original.indexOf('function step(port, node, predicate)'),original.indexOf('for (const round of [2, 3, 4])'));
if(!prefix||!helpers)throw Error('diagnostic source changed');
const suffix=`
const values=require('./state-value');
const fixture=configure(original,['dlc_23.png','dlc_40.png','dlc_5.png','dlc_30.png','b_10.webp'],{round:4});
const {k,port,root,before}=open(fixture);
try{
 const corner=step(port,root,a=>a.family==='card_corner'&&a.target?.cardInstanceId==='card-40-0');
 const oldPass=step(port,corner,a=>a.family==='pass');
 const cash=income(port,root,'card-40-0');
 const newPass=step(port,cash,a=>a.family==='pass');
 const a=values.evaluateStateValue(oldPass.observation,fixture.seatId),b=values.evaluateStateValue(newPass.observation,fixture.seatId);
 assert.deepEqual(k.composition.lifecycle.save().envelope,before);
 assert(oldPass.observation.publicState.passedPlayerIds.includes(fixture.seatId));
 assert(newPass.observation.publicState.passedPlayerIds.includes(fixture.seatId));
 assert.equal(a.components.resources,0);assert.equal(b.components.resources,0);assert.equal(a.total,b.total);
 globalThis.__setiFinalPassDiagnostic={oldPass:a,newPass:b,actualDelta:b.total-a.total,oldExpectation:'delta<0',successfulNativeSubmissions:port.getDiagnostics().submissionCount,rootAndRngExact:true,round:4,alreadyPassed:true,aiSearches:0};
}finally{port.close();k.composition.dispose();}
`;
const source=prefix+helpers+suffix,child=new Module(target,module);child.filename=target;child.paths=Module._nodeModulePaths(path.dirname(target));child._compile(source,target);
const result=globalThis.__setiFinalPassDiagnostic;delete globalThis.__setiFinalPassDiagnostic;
result.originalTestSha256=crypto.createHash('sha256').update(original).digest('hex');result.diagnosticSourceSha256=crypto.createHash('sha256').update(source).digest('hex');result.kind='Native-only same-state final-PASS assertion diagnosis; test/runtime unchanged';
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
