'use strict';
const inventory=require('../tools/browser-smoke-inventory'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict');
const index=inventory.findIndex(s=>s.id==='production-winning-income-recovery');assert(index>=0);const ids=inventory.slice(index).map(s=>s.id);console.log(JSON.stringify({scope:'Corrected obsolete forced-income assertion to current winning computer preparation, consistent with the existing native recovery test. Resume at this failed case; reuse all earlier functional passes. No timeout increase or production strategy restoration.',cases:ids.length,ids}));
const p=spawnSync(process.execPath,['adhoc/verify-v203-search-browser-parity-20261105-v1.js',...ids.flatMap(id=>['--match',id])],{stdio:'inherit'});process.exit(p.status??1);
