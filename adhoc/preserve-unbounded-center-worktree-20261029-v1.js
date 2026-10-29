'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root='/Users/bilibili/code/seti-simu',stage=process.cwd(),dir='/private/tmp/seti-unbounded-center-working-overlay-20261029';
fs.mkdirSync(dir,{recursive:true});
const read=(base,p)=>JSON.parse(fs.readFileSync(path.join(base,p),'utf8')),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const id='ai-search-v39-unbounded-20261029',versionPath='reports/iteration/versions.json',registryPath='reports/iteration/registry.json',pagePath='reports/robot-iteration.html';
const ownVersions=read(stage,versionPath),originalVersions=read(root,versionPath),mergedVersions=structuredClone(originalVersions),entry=ownVersions.versions.find(v=>v.id===id);
assert(!mergedVersions.versions.some(v=>v.id===id));mergedVersions.versions.unshift(entry);
for(const v of originalVersions.versions)assert.deepEqual(mergedVersions.versions.find(x=>x.id===v.id),v);
const originalRegistry=read(root,registryPath),ownRegistry=read(stage,registryPath),mergedRegistry=structuredClone(originalRegistry),row=ownRegistry.versions.find(v=>v.id===id);
assert(!mergedRegistry.versions.some(v=>v.id===id));assert.equal(entry.baselineEligible,true);assert.equal(row.isHead,true);mergedRegistry.versions.unshift(row);
for(const key of ['builtAt','headCommit','currentBaseline','bestOf'])mergedRegistry[key]=structuredClone(ownRegistry[key]);
mergedRegistry.generations.v2=structuredClone(ownRegistry.generations.v2);
for(const v of mergedRegistry.versions)if(v.aiGeneration==='v2')v.isHead=v.id===id;
for(const v of originalRegistry.versions){const actual=structuredClone(mergedRegistry.versions.find(x=>x.id===v.id)),expected=structuredClone(v);if(v.aiGeneration==='v2'){delete actual.isHead;delete expected.isHead;}assert.deepEqual(actual,expected);}
assert.deepEqual(mergedRegistry.generations.v1,originalRegistry.generations.v1);
const lib=require('../tools/robot-iteration-lib'),template=fs.readFileSync(lib.TEMPLATE_PATH,'utf8');
const render=r=>template.replace('/*__REGISTRY_JSON__*/',JSON.stringify(r,null,2).replace(/</g,'\\u003c'));
assert.equal(fs.readFileSync(path.join(root,pagePath),'utf8'),render(originalRegistry),'Preserve independently edited HTML');
const overlays={};
for(const [p,data]of [[versionPath,JSON.stringify(mergedVersions,null,2)+'\n'],[registryPath,JSON.stringify(mergedRegistry,null,2)+'\n'],[pagePath,render(mergedRegistry)]]){
 const target=path.join(dir,path.basename(p)),bytes=Buffer.from(data);fs.writeFileSync(target,bytes);overlays[p]={beforeSha256:hash(fs.readFileSync(path.join(root,p))),path:target,sha256:hash(bytes)};
}
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(overlays,null,2)+'\n');
console.log(JSON.stringify({preservedExistingVersions:originalVersions.versions.length,currentBaseline:mergedRegistry.currentBaseline,privateOverlay:dir}));
