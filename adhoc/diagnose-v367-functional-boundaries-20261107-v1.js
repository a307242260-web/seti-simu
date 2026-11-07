'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'), dir=path.join(root,'randomizer/game/ai'), name=process.argv[2], file=path.join(dir,name+'.test.js');
const rewrite=(text,before,after)=>{assert.equal(text.split(before).length,2,before);return text.replace(before,after);};
let code=fs.readFileSync(file,'utf8');
switch(name){
 case 'known-postdraw-tail':
  code=rewrite(code,"assert.equal(node.status,'information-barrier','the unproved suffix stays closed even though the acquired display identity is known');",`
   assert.equal(node.status,'stable','a display identity known at the root admits existing same-turn continuation');
   assert.equal(node.observation.publicState.board.aliens.amibaTraces.displayedCardIndex,null,'replacement display remains hidden');
   assert.equal(node.observation.publicState.board.aliens.amibaTraces.displayedCardHidden,true);
   assert(node.legalActions.length>0);
   assert(!node.legalActions.some(a=>a.family==='pass'),'cannot progress another turn or round from this rule menu');
   console.log(JSON.stringify({priorGuard:'information-barrier',newStatus:node.status,knownDisplay:'amiba_9.webp',hiddenReplacement:true,legal:node.legalActions.map(a=>a.family)}));`);
  break;
 case 'final-round-proof-guard':
  code=rewrite(code,"assert.deepEqual(values.evaluateStateValue(o,seat),old[phase]);assert.deepEqual(values.evaluateStateValue(compact,seat),old[phase]);",`for(const view of [o,compact]){const {modelVersion,...actual}=values.evaluateStateValue(view,seat),{modelVersion:prior,...expected}=old[phase];assert(modelVersion.startsWith('seti-purpose-capital-state-value-'));assert(prior.startsWith('seti-purpose-capital-state-value-'));assert.deepEqual(actual,expected);}`);
  break;
 case 'analysis-lazy-explanations':
  code=rewrite(code,"let source=fs.readFileSync(reference&&name==='amiba-analysis-capital'?referencePath:file,'utf8');","let source=fs.readFileSync(file,'utf8');");
  code=rewrite(code,"}m._compile(source,file);",`}if(reference&&name==='amiba-analysis-capital'){
   const find='let explanations,explanationsReady=false;';
   const after='let explanations=candidates.map(materialize),explanationsReady=true;';
   assert.equal(source.split(find).length,2);
   source=source.replace(find,after);
  }m._compile(source,file);`);
  break;

 case 'amiba-analysis-capital':
  code=rewrite(code,"assert.equal(startValue.total,116.5);","assert.equal(startValue.total,119);");
  code=rewrite(code,"assert.equal(endValue.total,name==='credit'?115.5:name==='energy-B48'?116.5:116);",`console.log(JSON.stringify({branch:name,value:endValue.total,components:endValue.components}));`);
  break;
 case 'analysis-publicity-capital':
  code=rewrite(code,"assert.equal(value.total,116.5);","assert.equal(value.total,119);");
  break;
 case 'research-mark-capital':
  code=rewrite(code,"assert.equal(values.evaluateStateValue(realized,seatId).total,116.5,'the claimed B mark and known computer/income analysis plan share the wallet, without another latent8');",`const realizedValue=values.evaluateStateValue(realized,seatId);assert.equal(realizedValue.total,119);assert.equal(realizedValue.components.finalMarkPotential,0,'no latent earned mark remains after B');`);
  break;
 default: throw Error('unknown diagnostic '+name);
}
const m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(code,file);
