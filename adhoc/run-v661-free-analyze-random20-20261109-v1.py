from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import json, subprocess, sys, time
root=Path.cwd();out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
prefix='ai-search-v661-free-analyze-random20-20261109'
boards=json.loads((root/'reports/fixed-boards/free-analyze-random20-20261104-v1.json').read_text())['boards']
assert [b['number'] for b in boards]==list(range(1,21))
assert len({b['seed'] for b in boards})==20
records=root/'reports/research'
def by_name():
    found={}
    for p in records.glob('*.full.json'):
        r=json.loads(p.read_bytes())
        n=r.get('name','')
        if isinstance(n,str) and n.startswith(prefix+'-'):
            assert n not in found
            found[n]=(p,r)
    return found
def one(b,existing):
    n=b['number'];seed=b['seed'];name=f'{prefix}-{n:02d}';log=out/f'board-{n:02d}.log'
    if name not in existing:
        with log.open('x') as f:
            command=['node','tools/run_research_validation.js','--name',name,'--seed',seed,'--config',
                     'agentType=search,scenario=v661-free-analyze-random20-v1,compactReplay=true','--full']
            try: code=subprocess.run(command,stdout=f,stderr=subprocess.STDOUT,timeout=190).returncode
            except subprocess.TimeoutExpired: code=124
    else: code=None
    paths=[]
    for line in log.read_text().splitlines() if log.exists() else []:
        if '记录: reports/research/' in line:
            candidate=root/line.split('记录: ',1)[1].strip()
            if candidate.is_file() and candidate not in paths: paths.append(candidate)
    if name in existing: paths=[existing[name][0]]
    if not paths:
        for p in records.glob('*.full.json'):
            if p.stat().st_mtime < time.time()-240: continue
            try: rec=json.loads(p.read_bytes())
            except json.JSONDecodeError: continue
            if rec.get('name')==name: paths.append(p)
    assert len(paths)<=1
    if not paths: return {'number':n,'seed':seed,'exit':code,'terminal':False,'error':'NO_TERMINAL_RECORD'}
    p=paths[0];r=json.loads(p.read_bytes());s=r.get('scenario',{})
    assert r['seed']==seed and s['boardNumber']==n
    q=r['metrics']['searches'];bad=[x for x in q if x['diagnostics']['nativeExecutions']>256 or x['rootAndSearchMilliseconds']>600]
    return {'number':n,'seed':seed,'record':str(p.relative_to(root)),'exit':code,'terminal':r['terminal'],
            'score':r['summary']['scores'].get('player-white') if r['terminal'] else None,'wallMs':r['wallMs'],
            'rounds':[[x['round'],x['score']] for x in r.get('roundEnds',[])],'steps':r['steps'],'searches':len(q),
            'overBudget':len(bad),'maxNative':max((x['diagnostics']['nativeExecutions'] for x in q),default=0),
            'maxMs':max((x['rootAndSearchMilliseconds'] for x in q),default=0),'failure':r.get('failure')}
existing=by_name()
with (out/'results.jsonl').open('x') as checkpoint,ThreadPoolExecutor(max_workers=2) as pool:
    tasks={pool.submit(one,b,existing):b for b in boards}
    for task in as_completed(tasks):
        b=tasks[task]
        try: result=task.result()
        except Exception as e: result={'number':b['number'],'seed':b['seed'],'terminal':False,'error':repr(e)}
        row=json.dumps(result,ensure_ascii=False);print(row,flush=True);checkpoint.write(row+'\n');checkpoint.flush()
