from pathlib import Path
import gzip,hashlib,json,os,re,subprocess,sys
root=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='ecc9f8538d00fe717fb097bcf86b08a901a75b36'
tags=['v352-data-source-capital-handoff','v353-fixed-symbol-layout-ranking','v354-mission-no-trace-capital-key']
D=[Path('reports/ai-foundation-20261107')/(p+'-v1') for p in tags]
index=Path('/private/tmp/seti-v352-v354-data-handoff-delivery-20261107-v1.index');receipt=Path('/private/tmp/seti-v352-v354-data-handoff-delivery-20261107-v1.json')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
blob=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
read=lambda p:json.loads((root/p).read_text());raw=lambda p:json.loads(gzip.decompress((root/p).read_bytes()))
shared=sha(repo/'.git/index');env={**os.environ,'GIT_OPTIONAL_LOCKS':'0','GIT_INDEX_FILE':str(index)}
def git(*args,data=None):return subprocess.check_output(['git',*args],input=data,cwd=repo,env=env)
def normalize(x):
 if isinstance(x,dict):return {k:normalize(v) for k,v in x.items() if k!='milliseconds'}
 if isinstance(x,list):return [normalize(v) for v in x]
 if isinstance(x,str):return re.sub(r'seti-complete-decision-search-v35[1-4]','seti-complete-decision-search-vXXX',x)
 return x
assert git('rev-parse','HEAD').decode().strip()==base and git('branch','--show-current').strip()==b'dev'
gates=[read(d/'serial-cold-gate-20261107-v1.json') for d in D]
assert all(g['status']=='failed-gate' and len(g['rows'])==1 and g['newAutonomousRuns']==0 and not g['candidateAdmitted'] for g in gates)
reference='reports/ai-foundation-20261105/third-round-teacher-v1/v351-cold-income-before-amiba-20261107-v1.raw.json.gz';ref=normalize(raw(reference)); doc='docs/human405-v352-v354-data-handoff-and-purple2-20261107.md'
paths={str(p.relative_to(root)) for d in D for p in (root/d).rglob('*') if p.is_file()};paths.add(doc)
for name in [f'{kind}-{tag}-20261107-v1.{ext}' for tag in tags for kind,ext in [('freeze','py'),('gate','js')]]+['review-v323-r3-energy-and-purple2-20261107-v1.js','measure-v351-lower-fact-equivalence-20261107-v1.js','measure-v351-scalar-shortlists-20261107-v1.js','measure-v351-upper-portfolio-origins-20261107-v1.js','measure-v351-planning-preview-sources-20261107-v1.js','measure-v352-funding-choice-cost-20261107-v1.js','verify-v352-data-source-handoff-20261107-v1.js','verify-v353-symbol-layout-ranking-20261107-v1.js',Path(__file__).name]: paths.add('adhoc/'+name)
for g in gates:
 row=g['rows'][0]; e=read(row['evidence']); assert g['failure']==row and row['label']=='income-before-amiba' and row['nativeInputs']==106 and row['milliseconds']>600 and row['complete'] and row['rootAndRngUnchanged'] and not row['decisionGatePassed']
 assert e['rawSha256']==sha(root/e['rawPath']) and e['candidateSourceManifestSha256']==g['manifestSha256']==sha(root/g['manifest'])
 assert normalize(raw(e['rawPath']))==ref
 paths.update((row['evidence'],e['rawPath']))
for i,n in [(0,5),(1,4)]:assert f'SUMMARY unit passed={n} failed=0' in (root/D[i]/'related-node-20261107-v1.log').read_text()
audit=(root/D[1]/'state-input-audit-20261107-v1.log').read_text();assert audit.count('[PASS]')==66 and '[FAIL]' not in audit
assert 'SUMMARY browserSmoke passed=2 failed=0' in (root/D[1]/'related-browser-20261107-v1.log').read_text()
proof=read(D[1]/'v352-data-source-handoff-20261107-v1.json')['counts'];assert proof['swap']==18 and proof['income']==7
symbol=read(D[1]/'v353-symbol-layout-ranking-20261107-v1.json');assert symbol['controls']==216 and symbol['layouts']==4 and symbol['sourceManifestSha256']==gates[1]['manifestSha256']
ctl=raw(D[1]/'v323-r3-energy-and-purple2-20261107-v1.raw.json.gz');assert ctl['sourceAndRngRestored'] and ctl['nativeInputs']==42 and ctl['newAutonomousRuns']==0
assert ctl['inputSha256']==sha(Path(ctl['input'])) and ctl['knownOutputSha256']==sha(Path(ctl['knownOutput'])) and ctl['sourceRecordSha256']==sha(root/ctl['sourceRecord'])
assert [r['mode'] for r in ctl['rows']]==['skip','launch'];end=[]
for i,r in enumerate(ctl['rows']):
 s=r['end'];assert s['score']==91 and s['projected']==121 and sum(s['tech']['ownedTiles'].values())==5
 assert s['income']['credits']==6 and s['income']['energy']==4 and len(s['rockets'])==i and len(r['route'])==21
 assert s['wallet']['credits']==0 and s['wallet']['energy']==1-i and s['wallet']['availableData']==0
 end.append({'mode':r['mode'],'score':s['score'],'tech':s['tech'],'income':s['income'],'wallet':s['wallet'],'probes':len(s['rockets']),'projected':s['projected']})
progress='adhoc/human405-third-round-progress-20261107-v40.json'
p={'phase':'v353-native-source-handoff-and-symbol-ranking-verified-gate-not-admitted','production':'V323','baseline':'V41','first3':[15,48,90],'teacherR3':105,'fullRecord':{'version':'V189','score':120},'candidate':'V353','candidateAdmitted':False,'newAutonomousRuns':0,'gates':[g['failure'] for g in gates],'sameFullColdGraphV351ThroughV354':True,'normalizedColdGraphReference':reference,'sourceHandoffs':proof,'symbolLayoutComparisons':216,'relatedBrowserTestsPassed':2,'stateInputAuditPassed':66,'nativeControlInputs':42,'nativeControlEndpoints':end,'next':'Keep V353 as fastest frozen candidate. Isolate reduction of full swap-offer portfolio work before constructing repeated typed analysis/missions, use exact distinct public state and finite budgets, preserve score/technology/income evidence and confirm all roots before any new autonomous first3.', 'evidence':{n:sha(root/n) for n in sorted(paths)}}
if (root/progress).exists():assert read(progress)==p
else:(root/progress).write_text(json.dumps(p,indent=2)+'\n')
paths.add(progress)
for n in paths:
 src=root/n;dst=repo/n
 assert src.is_file() and n.startswith(('adhoc/','docs/','reports/')),n
 if n.endswith('.js'):subprocess.run(['node','--check',str(src)],check=True,capture_output=True)
 if n.endswith('.py'):compile(src.read_text(),n,'exec')
 if dst.exists():assert sha(dst)==sha(src),n
 assert not git('ls-tree',base,'--',n),n
if '--stage' not in sys.argv:
 print(json.dumps({'status':'preflight-passed','files':len(paths),'bytes':sum((root/n).stat().st_size for n in paths),'productionChanged':False}));raise SystemExit
assert not index.exists() and not receipt.exists()
git('read-tree',base)
names=sorted(paths);hashes=git('hash-object','-w','--stdin-paths',data=''.join(str(root/n)+'\n' for n in names).encode()).decode().splitlines()
assert len(hashes)==len(names) and all(blob((root/n).read_bytes())==h for n,h in zip(names,hashes))
git('update-index','--index-info',data=''.join('100644 '+h+'\t'+n+'\n' for n,h in zip(names,hashes)).encode())
tree=git('write-tree').decode().strip()
for x in ['randomizer','assets','tools','reports/iteration','reports/robot-iteration.html']:assert git('rev-parse',tree+':'+x)==git('rev-parse',base+':'+x)
assert set(git('diff','--cached','--name-only','-z',base).decode().strip('\0').split('\0'))==paths
assert sha(repo/'.git/index')==shared
for n in names:
 dst=repo/n;dst.parent.mkdir(parents=True,exist_ok=True)
 if not dst.exists():
  with dst.open('xb')as f:f.write((root/n).read_bytes())
 assert sha(dst)==sha(root/n),n
receipt.write_text(json.dumps({'status':'staged','base':base,'tree':tree,'files':names,'index':str(index),'sharedIndexSha256':shared},indent=2)+'\n')
print(json.dumps({'status':'staged','tree':tree,'files':len(paths),'productionChanged':False}))
