'use strict';
const inventory=require('../tools/browser-smoke-inventory'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
const index=inventory.findIndex(s=>s.id==='production-browser-full-parity');assert(index>=0);const ids=inventory.slice(index+1).map(s=>s.id);console.log(JSON.stringify({scope:'Remaining original functional cases after the default legacy full-page timeout; all earlier27 passes reused, new-search full-page separately verified. No timeout increase or assertion deletion.',cases:ids.length,ids}));
const p=spawnSync(process.execPath,['adhoc/verify-v203-search-browser-parity-20261105-v1.js',...ids.flatMap(id=>['--match',id])],{stdio:'inherit'});process.exit(p.status??1);
