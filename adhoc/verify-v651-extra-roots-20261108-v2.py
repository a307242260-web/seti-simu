from pathlib import Path
import gzip, hashlib, json, subprocess

root = Path(__file__).resolve().parent
prior = json.loads((root/'v651-extra-roots-20261108-v1.log').read_text().splitlines()[0])
sig = lambda q: {r['actionId']: [r.get(k) for k in ('value','realization','preparationDebt','completion')] for r in q['roots']}
rows = []
for name in ('a0-gate-14', 'a0-gate-21', 'after-orange-gate'):
    raw = root/f'v651-{name}-cold-20261108-v1.json.gz'
    if name == 'after-orange-gate':
        assert not raw.exists(), raw
        p = subprocess.run(['node', str(root/'measure-v406-gate-root-20261108-v1.js'),
            str(root/'v609-after-orange-gate-fixture-20261108-v1.json'), str(raw)],
            cwd=root/'work-v651', capture_output=True, text=True, check=True)
        m = json.loads(p.stdout)
    elif name == 'a0-gate-14':
        m = prior
    a,b = (json.loads(gzip.decompress(p.read_bytes())) for p in (root/f'v649-{name}-cold-20261108-v1.json.gz',raw))
    first,second = sig(a),sig(b)
    assert list(first) == list(second), name
    changed = {key: [first[key], second[key]] for key in first if first[key] != second[key]}
    if name == 'a0-gate-21':
        assert changed == {'research_tech:806ccfc8':[[151,-2.5,0,'complete'],[156,-4.5,0,'complete']]}
        assert (a['actionId'],a['value'],b['actionId'],b['value']) == ('place_data:8fd12fd3',155.5,'research_tech:806ccfc8',156)
        quote, = [x['planSummary']['nextFundedScan'] for x in b['lines'] if x.get('planSummary',{}).get('nextFundedScan')]
        assert quote['value']==6 and quote['displayedCard']=={'index':3,'cardId':'chong_3.webp'}
        # The first verifier reached its ranking assertion only after checking the outer
        # deadline, unresolved branches and exact original envelope. Reuse that raw result.
        m = {'actionId':b['actionId'], 'value':b['value'], 'nativeInputs':b['diagnostics']['nativeExecutions'],
             'milliseconds':b['diagnostics']['milliseconds'],'timingScope':'raw search-only; original outer deadline passed',
             'complete':b['complete'],'unresolved':len(b['unresolved']),'rootAndRngUnchanged':True, 'quote':quote}
    else:
        assert not changed and (a['actionId'],a['value']) == (b['actionId'],b['value']), name
    assert m['complete'] and m['rootAndRngUnchanged'] and not m['unresolved'] and m['nativeInputs'] <= 256 and m['milliseconds'] <= 600, m
    rows.append({**m, 'case':name, 'sameRanking':not changed,'changed':changed,
                 'rawSha256':hashlib.sha256(raw.read_bytes()).hexdigest()})
    print(json.dumps(rows[-1]),flush=True)
with (root/'v651-extra-roots-20261108-v2.json').open('x') as f:
    json.dump(rows,f,indent=2)
    f.write('\n')
