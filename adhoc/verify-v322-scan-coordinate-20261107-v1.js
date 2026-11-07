'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const R='reports/ai-foundation-20261107/',D=R+'teacher-r3-after-amiba-scan-coordinate-v322-v1/',F='reports/ai-foundation-20261105/third-round-teacher-v1/';
const base='/private/tmp/seti-v321-income-before-amiba-prepaid-trace-20261107-v1/',next='/private/tmp/seti-v322-teacher-amiba-scan-coordinates-20261107-v1/',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest=D+'source-manifest-20261107-v1.json',m=read(manifest);
for(const [p,h]of Object.entries({...m.baseRuntimeHashes,...m.sourceHashes}))assert.equal(sha(next+p),h,p);
const old=require(base+'randomizer/game/effects/science-session'),candidate=require(next+'randomizer/game/effects/science-session'),solar=require(next+'randomizer/solar-system/core');
const cold=read(F+'v321-cold-teacher-r3-after-amiba-reveal-20261107-v1.json'),f=read(cold.fixture);assert.equal(cold.fixtureSha256,sha(cold.fixture));
const s=JSON.parse(f.compositionEnvelope.committedState),actor=s.players.players.find(p=>p.id===f.seatId),sBefore=JSON.stringify(s);
const p=(a)=>a.length<=1?[a]:a.flatMap((x,i)=>p(a.filter((_,j)=>i!==j)).map(rest=>[x,...rest]));
const planetIds=['earth','mercury','venus','mars','jupiter','saturn','uranus','neptune','aomomo','missing'];
let comparisons=0,nonempty=0,conditionalNonempty=0,landingNonempty=0,enabledAomomo=0;
for(const assignment of p([1,2,3,4]))for(const turn of [0,1,2,3,6,9])for(const aomomoActive of [false,true]){
 const sectorBySlot=Object.fromEntries(assignment.map((s,i)=>[turn%2?'slot'+(i+1):i+1,s]));
 const solarSystem={rotation:turn?solar.applySolarOrbitRotation(solar.createBaselineState().rotation,turn):solar.createBaselineState().rotation,sectorBySlot,aomomoActive};
 const options=planetIds.map(planetId=>({mode:'planet',planetId,gainData:turn%2===0,skippable:true}));
 options.push({mode:'landing',gainData:true},{mode:'conditional',condition:{type:'hasPlayerSignal'},gainData:true},{mode:'conditional',condition:{type:'sectorSignalCount',minCount:2},skippable:true});
 const root={...s,solarSystem,match:{...s.match,cardPlayContext:{lastLanding:{planetId:'venus'}}}};
 const before=JSON.stringify(root);
 for(const option of options){
  const a=old.listScanStepChoices(root,actor,option),b=candidate.listScanStepChoices(root,actor,option);
  assert.deepEqual(a,b);comparisons++;
  if(b.some(c=>c.target?.nebulaId)){nonempty++;if(option.mode==='conditional')conditionalNonempty++;if(option.mode==='landing')landingNonempty++;if(option.planetId==='aomomo'&&aomomoActive)enabledAomomo++;}
 }
 assert.equal(JSON.stringify(root),before);
}
assert.equal(JSON.stringify(s),sBefore);assert(nonempty&&conditionalNonempty&&landingNonempty&&enabledAomomo);
const result={scope:'Full Native scan descriptors across all four-sector permutations, six orbit steps, two activation states, and planet, landing and signal-conditioned scan modes. No new action or search.',manifest,manifestSha256:sha(manifest),comparisons,nonempty,conditionalNonempty,landingNonempty,enabledAomomo,rootUnchanged:true,newAiQueries:0,newAutonomousRuns:0};
fs.writeFileSync(D+'scan-coordinate-controls-20261107-v1.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
