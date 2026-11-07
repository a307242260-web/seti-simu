'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'randomizer/game/ai'),caseName=process.argv[2],file=path.join(dir,caseName+'.test.js');
const replace=(text,needle,value)=>{assert.equal(text.split(needle).length,2,needle);return text.replace(needle,value);};
let code=fs.readFileSync(file,'utf8');
const eager=x=>replace(x,'let explanations,explanationsReady=false;','let explanations=candidates.map(materialize),explanationsReady=true;');
const current=fs.readFileSync(path.join(dir,'amiba-analysis-capital.js'),'utf8');
const codeFor={
  eagerRegion:()=>eager(current),
  eagerTrace:()=>replace(replace(current,'const deferFaces=scope.fixed&&choices.some(choice=>choice.position)','const deferFaces=false'),'const deferredFace=scope.fixed&&Boolean(choice.position)','const deferredFace=false'),
  noRegionReuse:()=>replace(current,'if(regionalPlans.has(region))return regionalPlans.get(region);','if(false&&regionalPlans.has(region))return regionalPlans.get(region);'),
  fullTraceCopy:()=>{
    const archived=fs.readFileSync(path.join(root,'reports/ai-foundation-20261107/analysis-target-trace-copy-v1/amiba-analysis-v310-reference-20261107-v1.js'),'utf8');
    const range=(s)=>{const a=s.indexOf(' function analysisAliens('),b=s.indexOf(' function secured(',a);assert(a>=0&&b>a);return s.slice(a,b);};
    return replace(current,range(current),range(archived));
  },
};
const control={
  'analysis-lazy-regions':'eagerRegion','analysis-lazy-trace-contexts':'eagerTrace',
  'analysis-region-prefix':'noRegionReuse','analysis-target-trace-copy':'fullTraceCopy',
}[caseName];assert(control);
const body=codeFor[control]();
if(caseName==='analysis-region-prefix'){
  code=replace(code,"source=fs.readFileSync(reference&&name==='amiba-analysis-capital'?referencePath:file,'utf8'),m=",`source=reference&&name==='amiba-analysis-capital'?${JSON.stringify(body)}:fs.readFileSync(file,'utf8'),m=`);
}else{
  code=replace(code,"const reference=load(fs.readFileSync(referencePath,'utf8')),candidate=",`const reference=load(${JSON.stringify(body)}),candidate=`);
}
const m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(code,file);
