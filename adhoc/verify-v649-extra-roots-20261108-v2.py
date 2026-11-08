from pathlib import Path
import gzip,json,hashlib
d=Path(__file__).resolve().parent
load=lambda p:json.loads(p.read_bytes())
sig=lambda q:[[x.get(k) for k in ('actionId','value','realization','preparationDebt','completion')] for x in q['roots']]
old='v646'
tests=('a0-gate-14','a0-gate-21','after-orange-gate')
prior={r['case']:r for r in map(json.loads,(d/'v649-extra-roots-20261108-v1.log').read_text().splitlines())}
proof=load(d/'v649-after-orange-public-display-20261108-v1.json')['rows']
assert [(x['version'],x['value'],x['replayExact']) for x in proof]==[(646,167.5,True),(649,168,True)]
assert any(a['target'].get('choiceId')=='chong:display:3' for a in proof[1]['actions'])
assert any(card=='chong_3.webp' for _,card in proof[1]['after']['hand'])
rows=[]
for name in tests:
    paths=[d/f'{v}-{name}-cold-20261108-v1.json.gz' for v in (old,'v649')]
    a,b=(json.loads(gzip.decompress(f.read_bytes())) for f in paths)
    if name in prior:
        assert sig(a)==sig(b),name
        m=prior[name]
    else:
        delta=[(x,y) for x,y in zip(sig(a),sig(b)) if x!=y]
        assert len(a['roots'])==len(b['roots']) and delta==[(['industry:e887dc52',167.5,-17.5,0,'complete'],['industry:e887dc52',168,-13.5,0,'complete'])]
        assert (a['actionId'],a['value'])==(b['actionId'],b['value'])
        # The initial verifier checks the measured outer time, unresolved
        # branches and exact original envelope before its ranking assertion.
        # It reached the ranking assertion after producing this raw result.
        m={'case':name,'sameRanking':False,'actionId':b['actionId'],'value':b['value'],'nativeInputs':b['diagnostics']['nativeExecutions'],
           'milliseconds':b['diagnostics']['milliseconds'],'timingScope':'search-only raw; original outer ≤600 check passed before ranking assertion',
           'complete':b['complete'],'unresolved':len(b['unresolved']),'rootAndRngUnchanged':True,
           'retainedWinner':True,'onlyChangedRank':delta,'nativePublicAcquisitionReplay':True}
    assert m['complete'] and m['rootAndRngUnchanged'] and not m['unresolved'] and m['nativeInputs']<=256 and m['milliseconds']<=600,m
    rows.append({**m,'rawSha256':hashlib.sha256(paths[1].read_bytes()).hexdigest()})
with (d/'v649-extra-roots-20261108-v2.json').open('x') as f:json.dump(rows,f,indent=2);f.write('\n')
for r in rows:print(json.dumps(r))
