'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const R='reports/ai-foundation-20261107/',D=R+'case152-analysis-journal-v1/',M=R+'analysis-lazy-trace-contexts-v1/source-manifest-20261107-v1.json',manifest=JSON.parse(fs.readFileSync(M));
const filename='randomizer/game/rule-composition.js',sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(sha(filename),manifest.sourceHashes[filename]||manifest.baseRuntimeHashes[filename]);
function edit(s,old,replacement,count=1){assert.equal(s.split(old).length,count+1,old);return s.replaceAll(old,replacement);}
let k=fs.readFileSync(filename,'utf8'),p=fs.readFileSync(R+'case152-rotation-reuse-v1/analysis-port-rotation-reuse-prototype-20261107-v1.js','utf8');
k=edit(k,'    function publish(event) {\n      const frozen','    function publish(event) {\n      if (options.allowTrustedForkLifecycle === true && !listeners.size) return;\n      const frozen');
k=edit(k,'    function finishIfTerminal() {','    function finishIfTerminal(omitJournal = false) {');
k=edit(k,'        journal: clone(activeSession.journal),','        ...(!omitJournal || activeSession.phase !== "completed" ? { journal: clone(activeSession.journal) } : {}),');
k=edit(k,`      return finishIfTerminal() || deepFreeze({
        ok: true,
        ...(responseOptions.skipProjection === true ? {} : { projection: projection() }),
        journal: clone(activeSession?.journal || null),`,`      // Only the isolated analysis caller asks for a lean success response.
      // Full Native journal and replay stay on the Session; checkpoint and
      // listener semantics are unchanged. Failures retain their normal shape.
      const omitJournal = options.allowTrustedForkLifecycle === true && !listeners.size
        && responseOptions.skipProjection === true && responseOptions.skipJournal === true;
      return finishIfTerminal(omitJournal) || deepFreeze({
        ok: true,
        ...(responseOptions.skipProjection === true ? {} : { projection: projection() }),
        ...(!omitJournal ? { journal: clone(activeSession?.journal || null) } : {}),`);
const from=k.indexOf('    function submitAction(action,');const to=k.indexOf('    function enumerateActions(request',from);assert(from>0&&to>from);
const chunk=k.slice(from,to),flag='        skipProjection: submitOptions.skipProjection === true,';
k=k.slice(0,from)+edit(chunk,flag,flag+'\n        skipJournal: submitOptions.skipJournal === true,',3)+k.slice(to);
const pFrom=p.indexOf('    function executeCurrent(current) {'),pTo=p.indexOf('    function knownRewardChoices(',pFrom);assert(pFrom>0&&pTo>pFrom);
p=p.slice(0,pFrom)+edit(p.slice(pFrom,pTo),'{ skipProjection: true }','{ skipProjection: true, skipJournal: true }',3)+p.slice(pTo);
fs.writeFileSync(D+'rule-composition-analysis-journal-prototype-20261107-v1.js',k,{flag:'wx'});
fs.writeFileSync(D+'analysis-port-analysis-journal-prototype-20261107-v1.js',p,{flag:'wx'});
