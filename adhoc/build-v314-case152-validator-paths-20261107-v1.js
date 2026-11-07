'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D='reports/ai-foundation-20261107/case152-validator-paths-v1/',M='reports/ai-foundation-20261107/analysis-lazy-trace-contexts-v1/source-manifest-20261107-v1.json';
const manifest=JSON.parse(fs.readFileSync(M)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function edit(s,old,replacement){assert.equal(s.split(old).length,2,old);return s.replace(old,replacement);}
for(const name of ['low-coupling-slices','high-coupling-slices']){
 const file='randomizer/game/state/'+name+'.js';assert.equal(sha(file),manifest.sourceHashes[file]||manifest.baseRuntimeHashes[file]);
 let s=fs.readFileSync(file,'utf8');
 if(name.startsWith('low')){
  s=edit(s,`        const sequence = inferSequence(id, /^alien-[^-]+-\\d+-(\\d+)$/)
          || inferSequence(id, /^aomomo-(?:orbit|landing)-(\\d+)$/)
          || inferSequence(id, /^banrenma-mark-(\\d+)$/);`,`        const sequence = id.startsWith("alien-") ? inferSequence(id, /^alien-[^-]+-\\d+-(\\d+)$/)
          : id.startsWith("aomomo-") ? inferSequence(id, /^aomomo-(?:orbit|landing)-(\\d+)$/)
          : id.startsWith("banrenma-mark-") ? inferSequence(id, /^banrenma-mark-(\\d+)$/) : 0;`);
  s=edit(s,'        visit(child, \`\${path}.\${key}\`);','        if (child && typeof child === "object") visit(child, \`\${path}.\${key}\`);'.replaceAll('\\',''));
  s=edit(s,`        const childPath = \`\${path}.\${key}\`;
        if (PRESENTATION_KEYS.has(key) || (path === "$.solarSystem" && key === "wheelSteps")) {
          errors.push(error(childPath, "STATE_HOST_FIELD_FORBIDDEN", \`\${childPath} 不属于 committed state\`));
        } else {
          stack.push({ value: child, path: childPath });
        }`,`        if (PRESENTATION_KEYS.has(key) || (path === "$.solarSystem" && key === "wheelSteps")) {
          const childPath = \`\${path}.\${key}\`;
          errors.push(error(childPath, "STATE_HOST_FIELD_FORBIDDEN", \`\${childPath} 不属于 committed state\`));
        } else if (child && typeof child === "object") {
          stack.push({ value: child, path: \`\${path}.\${key}\` });
        }`);
 }else{
  s=edit(s,`      const childPath = \`\${path}.\${key}\`;
      if (forbidden.has(key)) {
        errors.push(error(childPath, "STATE_HOST_FIELD_FORBIDDEN", \`\${childPath} 不属于 committed state\`));
      } else {
        scanForbidden(child, childPath, forbidden, errors);
      }`,`      if (forbidden.has(key)) {
        const childPath = \`\${path}.\${key}\`;
        errors.push(error(childPath, "STATE_HOST_FIELD_FORBIDDEN", \`\${childPath} 不属于 committed state\`));
      } else if (child && typeof child === "object") {
        scanForbidden(child, \`\${path}.\${key}\`, forbidden, errors);
      }`);
 }
 fs.writeFileSync(D+name+'-prototype-20261107-v1.js',s,{flag:'wx'});
}
