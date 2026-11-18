'use strict';
const assert=require('node:assert/strict');
function ranking(line){const s=line.cardPickPolicy?.selection;if(!s||!['hit','miss'].includes(s.cache))return line;const{cache,...selection}=s;return {...line,cardPickPolicy:{...line.cardPickPolicy,selection}};}
function verify(before,after){
 assert.equal(before.lines.length,after.lines.length);assert.equal(before.roots.length,after.roots.length);
 const parents=after.lines.map(()=>[]),quotes=[],changed=[];
 for(const [i,line]of after.lines.entries()){
  assert.equal(line.node,i);for(const e of line.edges){assert(Number.isInteger(e.target));parents[e.target].push(i);}
  if(line.knownPickupTask){const q=line.knownPickupTask,old=before.lines[i];assert.equal(line.status,'information-barrier');assert.equal(line.boundary,'hidden_chong_fossil_offer');assert.equal(line.edges.length,0);assert.equal(q.beforeValue,old.value);assert.equal(q.value,line.value);assert.equal(q.gain,line.value-old.value);assert.equal(line.realization,old.realization-q.gain);assert(q.gain>0);assert.equal(q.unknownPickupChoicePriced,false);quotes.push(i);}
 }
 if(!quotes.length){assert.deepEqual(after.lines.map(ranking),before.lines.map(ranking));assert.deepEqual(after.roots,before.roots);return {allGraphStructureAndNonValueMetadataExact:true,quotedLeaves:0,changedValuesWithQuotedLeafWitness:0,rootValuesChanged:0,allValuesExact:true};}
 const supported=new Map(),queue=quotes.map(i=>[i,i]);
 for(let h=0;h<queue.length;h++){
  const [i,witness]=queue[h];if(supported.get(i)?.has(witness))continue;
  if(!supported.has(i))supported.set(i,new Set());supported.get(i).add(witness);
  for(const p of parents[i])if(after.lines[p].value===after.lines[i].value&&after.lines[p].realization===after.lines[i].realization)queue.push([p,witness]);
 }
 for(const [i,line]of after.lines.entries()){
  const old=before.lines[i],valueChanged=line.value!==old.value,realizationChanged=line.realization!==old.realization;
  if(valueChanged||realizationChanged){
   assert(Number.isFinite(line.value)&&Number.isFinite(old.value));assert(line.value>old.value);const candidates=[...(supported.get(i)||[])];assert(candidates.length,'changed value must retain a path to an explicitly quoted leaf');
   assert(candidates.some(id=>{const q=after.lines[id].knownPickupTask;return old.value>=q.beforeValue&&line.value===q.value&&line.value-old.value<=q.gain&&line.realization===-q.gain;}),'value increase must be the backed-up known floor, never another reward');
   assert(line.knownPickupTask||line.edges.length,'an unquoted leaf must remain exact');changed.push(i);
  }
  const {knownPickupTask,...rest}=line;
  assert.deepEqual(ranking({...rest,value:old.value,realization:old.realization}),ranking(old),'all edges, choices, policies, distance, debt, status and other metadata must remain exact');
  if(line.edges.length){const values=line.edges.map(e=>after.lines[e.target].value).filter(Number.isFinite);if(values.length)assert.equal(line.value,Math.max(...values),'every parent must retain the maximum of its actual children');}
 }
 let rootChanges=0;
 for(const [i,line]of after.roots.entries()){
  const old=before.roots[i];if(line.value!==old.value||line.realization!==old.realization){assert(Number.isInteger(line.target));assert.equal(line.value,after.lines[line.target].value);assert.equal(line.realization,after.lines[line.target].realization);assert.equal(old.value,before.lines[line.target].value);rootChanges++;}
  const normalized={...line};for(const key of ["value","realization"]){if(Object.hasOwn(old,key))normalized[key]=old[key];else assert(!Object.hasOwn(line,key));}assert.deepEqual(normalized,old,'root policy or physical target changed');
 }
 return {allGraphStructureAndNonValueMetadataExact:true,quotedLeaves:quotes.length,changedValuesWithQuotedLeafWitness:changed.length,rootValuesChanged:rootChanges,allParentMaximaVerified:true};
}
module.exports={verify};
if(require.main===module){const fs=require('node:fs'),z=require('node:zlib'),d=JSON.parse(z.gunzipSync(fs.readFileSync(process.argv[2])));console.log(JSON.stringify(verify(d.rows[0],d.rows[1])));}
