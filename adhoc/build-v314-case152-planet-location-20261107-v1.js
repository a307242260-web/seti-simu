'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D='reports/ai-foundation-20261107/case152-planet-location-v1/',M='reports/ai-foundation-20261107/analysis-lazy-trace-contexts-v1/source-manifest-20261107-v1.json';
const file='randomizer/game/ai/goal-movement.js',m=JSON.parse(fs.readFileSync(M)),s=fs.readFileSync(file,'utf8');
assert.equal(crypto.createHash('sha256').update(s).digest('hex'),m.sourceHashes[file]||m.baseRuntimeHashes[file]);
const old=`    for(const candidate of endpoints()){
      const ship=ships.find(s=>s.id===candidate.rocketId);if(!ship)continue;
      const location=solar.createSolarSnapshot(state.solarSystem).planetLocations.find(p=>p.planetId===candidate.planetId);if(!location)continue;`;
const next=`    let planetLocations;
    for(const candidate of endpoints()){
      const ship=ships.find(s=>s.id===candidate.rocketId);if(!ship)continue;
      if(planetLocations){__planetQueries.reuses++;}
      else{planetLocations=solar.createSolarSnapshot(state.solarSystem).planetLocations;__planetQueries.builds++;}
      const location=planetLocations.find(p=>p.planetId===candidate.planetId);if(!location)continue;`;
assert.equal(s.split(old).length,2);const api='  return Object.freeze({VERSION,isDirection:direction,';
assert.equal(s.split(api).length,2);
fs.writeFileSync(D+'goal-movement-planet-location-prototype-20261107-v1.js',s.replace(old,next).replace(api,`  const __planetQueries={builds:0,reuses:0};
  return Object.freeze({VERSION,diagnosticPlanetQueries:()=>({...__planetQueries}),isDirection:direction,`),{flag:'wx'});
