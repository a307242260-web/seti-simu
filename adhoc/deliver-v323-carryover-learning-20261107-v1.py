from pathlib import Path
import json,hashlib,os,subprocess,sys
stage=Path(__file__).resolve().parents[1]
repo=Path('/Users/bilibili/code/seti-simu')
base='b4e10b1aecab070585ec19a4acef16165c290431'
D=Path('reports/ai-foundation-20261107/committed-computer-recovery-v323-v1')
P=Path('reports/ai-foundation-20261107/v323-known-landing-quote-prototype-v1')
cold=Path('reports/ai-foundation-20261105/third-round-teacher-v1/v323-cold-v323-blue1-keep-publicity-first-r3-20261107-v1.json')
index=Path('/private/tmp/seti-v323-carryover-learning-20261107-v1.index')
receipt=Path('/private/tmp/seti-v323-carryover-learning-delivery-20261107-v1.json')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads((stage/p).read_text())
blob=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
shared=sha(repo/'.git/index')
assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb'
env={**os.environ,'GIT_OPTIONAL_LOCKS':'0','GIT_INDEX_FILE':str(index)}
def git(*args,data=None):return subprocess.check_output(['git',*args],input=data,cwd=repo,env=env)
assert git('rev-parse','HEAD').decode().strip()==base
doc='docs/human405-v323-carryover-and-held-landing-20261107.md'
progress='adhoc/human405-third-round-progress-20261107-v29.json'
paths={doc,progress,str(cold),str(D/'v323-blue1-keep-publicity-first-r3-cold-20261107-v1.log')}
p=read(progress)
for n,h in p['evidence'].items():
 assert sha(stage/n)==h,n
 paths.add(n)
e=read(cold);assert e['decisionGatePassed'] and e['complete'] and e['nativeInputs']==114 and e['milliseconds']<600 and e['rootAndRngUnchanged']
assert sha(stage/e['fixture'])==e['fixtureSha256'] and sha(stage/e['rawPath'])==e['rawSha256']
assert sha(stage/e['candidateSourceManifest'])==e['candidateSourceManifestSha256']
paths.update([e['fixture'],e['rawPath']])
ref=read(D/'v323-r3-carried-data-outcomes-20261107-v1.json');assert ref['postponed']['differences']==[] and ref['postponed']['deckAndRngExact'] and len(ref['late'])==6
assert ref['postponed']['delayed']['wallet']['score']==90 and ref['newAutonomousRuns']==0
blue=read(D/'v323-round2-blue1-native-continuations-20261107-v1.json')
assert [x['end']['wallet']['score'] for x in blue['cases']]==[51]*3
n=read(D/'v323-known-free-landing-native-20261107-v1.json')
assert n['newNativeInputs']==15 and not n['ordinaryJupiter']['funded'] and n['landed']['wallet']['score']==63
a=read(D/'v323-scan-vs-held-landing-native-20261107-v1.json')
assert a['newNativeInputs']==13 and not a['afterScanThenLaunch']['canRetainBothAndPayForNamedLandingFromCurrency']
r=read(P/'held-landing-prototype-first-r3-20261107-v1.json')
assert r['selected']==e['actionId'] and r['launch']['value']==95 and r['originalQuotedValue']==5 and r['candidateQuotedValue']==11 and not r['sourceReleased']
assert sha(stage/r['prototype'])==r['prototypeSha256']
paths.add(r['prototype'])
names=['review-v323-r3-carried-data-native','verify-v323-r3-carried-data-outcomes','review-v323-round2-blue1-native','review-v323-known-free-landing-native','review-v323-scan-vs-held-landing','build-v323-held-landing-quote-prototype','verify-v323-held-landing-quote-prototype','deliver-v323-carryover-learning']
for name in names:
 f=list((stage/'adhoc').glob(name+'-20261107-v1.*'));assert len(f)==1,f
 paths.add(str(f[0].relative_to(stage)))
for n in paths:
 f=stage/n
 assert f.is_file() and n.startswith(('adhoc/','docs/','reports/')),n
 if f.suffix=='.js':subprocess.run(['node','--check',str(f)],check=True,capture_output=True)
 if f.suffix=='.py':compile(f.read_text(),n,'exec')
 q=repo/n
 if q.exists():assert sha(q)==sha(f),n
 if git('ls-tree',base,'--',n):raise AssertionError('Refusing to overwrite committed path '+n)
if '--stage' not in sys.argv:
 print(json.dumps({'status':'preflight-passed','newFiles':len(paths),'runtimeFiles':0,'newAutonomousRuns':0}))
 raise SystemExit(0)
assert not index.exists() and not receipt.exists()
git('read-tree',base)
names=sorted(paths);hashes=git('hash-object','-w','--stdin-paths',data=''.join(str(stage/n)+'\n' for n in names).encode()).decode().splitlines()
assert len(hashes)==len(names)
for n,h in zip(names,hashes):assert blob((stage/n).read_bytes())==h,n
git('update-index','--index-info',data=''.join('100644 '+h+'\t'+n+'\n' for n,h in zip(names,hashes)).encode())
tree=git('write-tree').decode().strip()
for n,h in zip(names,hashes):assert git('rev-parse',tree+':'+n).decode().strip()==h,n
for x in ['randomizer','assets','tools','reports/iteration','reports/robot-iteration.html']:
 assert git('rev-parse',tree+':'+x)==git('rev-parse',base+':'+x)
assert set(git('diff','--cached','--name-only','-z',base).decode().strip('\0').split('\0'))==paths
assert sha(repo/'.git/index')==shared
for n in names:
 f=repo/n;f.parent.mkdir(parents=True,exist_ok=True)
 if not f.exists():
  with f.open('xb')as fd:fd.write((stage/n).read_bytes())
 assert sha(f)==sha(stage/n),n
r={'status':'staged-independent-evidence','base':base,'tree':tree,'files':names,'index':str(index),'sharedIndexSha256':shared,'productionAndCenterUnchanged':True,'newAutonomousRuns':0}
receipt.write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps({'status':r['status'],'tree':tree,'files':len(names),'bytes':sum((stage/n).stat().st_size for n in names),'productionAndCenterUnchanged':True}))
