from pathlib import Path
import gzip,json,subprocess
d=Path(__file__).resolve().parent
w=d/'work-v630'
tests=[
 ('a0-gate-14','v600-a0-gate-14-fixture-20261108-v1.json'),
 ('a0-gate-21','v600-a0-gate-21-fixture-20261108-v1.json'),
 ('after-orange-gate','v609-after-orange-gate-fixture-20261108-v1.json'),
]
rows=[]
for name,f in tests:
    raw=d/f'v630-{name}-cold-20261108-v1.json.gz'
    p=subprocess.run(['node',str(d/'measure-v406-gate-root-20261108-v1.js'),str(d/f),str(raw)],cwd=w,capture_output=True,text=True,check=True)
    m=json.loads(p.stdout)
    assert m['complete'] and m['rootAndRngUnchanged'] and not m['unresolved'] and m['nativeInputs']<=256 and m['milliseconds']<=600,m
    a,b=(json.loads(gzip.decompress(s.read_bytes())) for s in (d/f'v619-{name}-cold-20261108-v1.json.gz',raw))
    sig=lambda q:[[x.get(k) for k in ['actionId','value','realization','preparationDebt','completion']] for x in q['roots']]
    assert sig(a)==sig(b),name
    rows.append({'case':name,'sameRanking':True,**m})
    print(json.dumps(rows[-1]),flush=True)
with (d/'v630-extra-roots-20261108-v1.json').open('x') as f:json.dump(rows,f,indent=2);f.write('\n')
