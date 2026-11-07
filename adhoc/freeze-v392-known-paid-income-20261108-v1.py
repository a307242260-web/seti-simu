from pathlib import Path
import hashlib,json
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
read=lambda p:json.loads(Path(p).read_bytes())
old='reports/ai-foundation-20261107/v375-known-research-data-v1'
base=old+'/source-manifest-20261107-v1.json'; orig=read(base); gate=old+'/serial-cold-gate-20261107-v1.json'
d=Path('/private/tmp/seti-v392-cold-admission-20261108-v1')
assert not (d/'source-manifest-20261108-v1.json').exists()
hashes={**orig['baseRuntimeHashes'],**orig['sourceHashes']}
changed={n:sha(n) for n,h in hashes.items() if sha(n)!=h}
assert set(changed)=={'randomizer/game/ai/'+n+'.js' for n in ('analysis-port','decision-search','local-decision-plans','resource-demand')}|{'randomizer/game/'+n+'.js' for n in ('aliens/amiba','effects/residual-domain-session','effects/science-session','end-game-scoring')}
cases=[]
for p,ls in [('/private/tmp/seti-v391-teaching-focus-20261108-v1.json',['early-A0-analyzed']),('/private/tmp/seti-v375-research-income-order-20261107-v4.checkpoint.json',['before-research-computer3','before-research-income-paid','after-research-computer3'])]:
 q=read(p)
 for label in ls:
  f=d/(label+'.fixture.json');f.write_text(json.dumps({'seatId':'player-white','source':{'seed':'seti-free-analyze-v1','provenance':p},'compositionEnvelope':q['decisionRoots'][label]['envelope']},ensure_ascii=False)+'\n')
  cases.append({'label':'paid-tail-'+label.lower(),'fixture':str(f),'fixtureSha256':sha(f)})
a=d/'added-cases-20261108-v1.json';a.write_text(json.dumps({'cases':cases},indent=2)+'\n')
m={**orig,'sourceHashes':{**orig['sourceHashes'],**changed},'changedSources':sorted(changed),'searchVersion':'seti-complete-decision-search-v392','parentManifest':base,'parentManifestSha256':sha(base),'previousGate':gate,'previousGateSha256':sha(gate),'addedCases':str(a),'addedCasesSha256':sha(a),'scope':'V392 layered isolate, preserve V375 admitted corpus; add four Native R3 pay/scored-corner/known research fixtures.'}
(d/'source-manifest-20261108-v1.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
s=Path('adhoc/gate-v375-known-research-data-20261107-v1.js').read_text()
s=s.replace("D='reports/ai-foundation-20261107/v375-known-research-data-v1/'","D='"+str(d)+"/'").replace("mp=D+'source-manifest-20261107-v1.json'","mp=D+'source-manifest-20261108-v1.json'").replace("out=D+'serial-cold-gate-20261107-v1.json'","out=D+'serial-cold-gate-20261108-v1.json'").replace('cases.length,1276','cases.length,1281').replace('v375-','v392-')
x=s.index('const slow=');y=s.index('for(const label',x)
s=s[:x]+'''const slow=previous.rows.toSorted((a,b)=>b.milliseconds-a.milliseconds);const priority=[...read(m.addedCases).cases.map(c=>c.label),...new Set(slow.slice(0,14).map(x=>x.label))];'''+s[y:]
Path('adhoc/gate-v392-known-paid-income-20261108-v1.js').write_text(s)
