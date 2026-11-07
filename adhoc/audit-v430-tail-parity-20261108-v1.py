from pathlib import Path
import gzip,json
b=Path(__file__).parent
old,new=[json.load(gzip.open(b/f'v{i}-blue3-parity-20261108-v1.json.gz')) for i in (425,430)]
original={l['debugTailSource']:l for l in old['lines'] if l['debugTailSource']}
def rank(q,e):
    n=q['lines'][e['target']]
    return (n['value'],n['realization'],n['preparationDebt'],n.get('landingCompanyRetained',0),
        bool(n.get('retainedPublicDataCard')),(n['distance']+e['cost']) if n['distance'] is not None else None)
def keys(p):
    return [k for k in ('computerThenKnownBluePick','quietTaskChoice','quietDeferredTask','incomeThenQuietEnd','bluePublicPick') if k in p]
rows=[]
for l in new['lines']:
    if not l['debugTailSource']:continue
    previous=original.get(l['debugTailSource'])
    for e in l['edges']:
        p=e.get('turnTailPlanValue') or {}
        tags=keys(p)
        if not tags:continue
        opts=[x for x in (previous or {}).get('edges',[]) if x['actionId']==e['actionId']]
        if any(p==x.get('turnTailPlanValue') for x in opts):continue
        values=[rank(old,x) for x in opts]
        result=rank(new,e)
        rows.append({'sourceSha256':l['debugTailSource'],'node':l['node'],'action':e['actionId'],'tags':tags,'new':result,
            'previous':values,'equal':result in values,'proof':p['proof']})
out={'rows':rows,'equal':sum(r['equal'] for r in rows),'different':sum(not r['equal'] for r in rows)}
(b/'v430-tail-rank-parity-20261108-v1.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:v for k,v in out.items() if k!='rows'}))
for r in rows:
    print(r['node'],r['tags'],r['previous'],r['new'],r['equal'])
