'use strict';
const inventory=require('../tools/browser-smoke-inventory'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
const index=inventory.findIndex(s=>s.id==='production-purpose-realization');assert(index>=0);const ids=inventory.slice(index).map(s=>s.id);console.log(JSON.stringify({scope:'Native091 now strictly improves PASS85.083 to85.166; add the already measured native117 exact93 tie to preserve the real tie obligation. Remove only obsolete V22 version lock from five native sector/mission parity controls. Keep every behavioral, budget, root/RNG and recovery check.',cases:ids.length,ids}));
const p=spawnSync(process.execPath,['tools/run_browser_smokes.js',...ids.flatMap(id=>['--match',id])],{stdio:'inherit'});process.exit(p.status??1);
