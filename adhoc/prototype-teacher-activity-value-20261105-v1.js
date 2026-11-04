'use strict';
// Process-local, source-bound prototype. All Production modules in this one
// process use the same transformed evaluator; no file or admitted runtime is
// changed. Activity is a forecast hypothesis, never a pruning guarantee.
const fs=require('node:fs'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const file=path.resolve(__dirname,'../randomizer/game/ai/state-value.js'),original=fs.readFileSync(file,'utf8'),old='usefulScansPerLaterRound: 2',replacement='usefulScansPerLaterRound: 4';assert.equal(original.split(old).length,2);const source=original.replace(old,replacement).replace('seti-purpose-capital-state-value-v10','seti-purpose-capital-state-value-v10-prototype-activity4');
const mod=new Module(file,module);mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));require.cache[file]=mod;mod._compile(source,file);mod.loaded=true;
module.exports={values:mod.exports,transformation:{file:'randomizer/game/ai/state-value.js',originalSha256:crypto.createHash('sha256').update(original).digest('hex'),transformedSha256:crypto.createHash('sha256').update(source).digest('hex'),replace:{old,new:replacement},modelVersion:mod.exports.MODEL_VERSION,source:'reports/ai-foundation-20261104/two-rounds-teacher-v2/teacher-technology-activity-20261105-v1.json',warning:'Historical usage forecast, not guaranteed future rewards. In-process prototype only; source files, rules, default weights and production budgets unchanged.'}};
