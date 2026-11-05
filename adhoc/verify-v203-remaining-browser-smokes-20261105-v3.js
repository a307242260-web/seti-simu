'use strict';
const inventory=require('../tools/browser-smoke-inventory'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
const index=inventory.findIndex(s=>s.id==='production-settled-tech-funding');assert(index>=0);const ids=inventory.slice(index).map(s=>s.id);console.log(JSON.stringify({scope:'Current exact native target/value and <=256 gate replace obsolete strict V184 input count252; V203 requires256 after removal of an unsound old D-mark bound. Resume at this case without restoring the bound; retain prior passes and failures.',cases:ids.length,ids}));
const p=spawnSync(process.execPath,['tools/run_browser_smokes.js',...ids.flatMap(id=>['--match',id])],{stdio:'inherit'});process.exit(p.status??1);
