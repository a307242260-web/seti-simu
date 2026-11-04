import pathlib,json,subprocess
root=pathlib.Path(__file__).resolve().parents[1];folder=root/'reports/ai-foundation-20261104/two-rounds-teacher-v2'
full=(folder/'v186-node-full-20261105-v1.log').read_text();assert 'SUMMARY unit passed=170 failed=0 total=170' in full and 'SUMMARY fullFlow passed=1 failed=0 total=1' in full
ids=json.loads((folder/'v184-browser-coverage-20261105-v1.json').read_text())['uniqueChecks']+['production-purpose-realization'];assert len(set(ids))==24
args=['node','tools/run_browser_smokes.js']
for name in ids:args.extend(['--match',name])
print(json.dumps({'checks':ids,'count':len(ids)}),flush=True)
r=subprocess.run(args,cwd=root);raise SystemExit(r.returncode)
