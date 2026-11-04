import pathlib, subprocess
root=pathlib.Path(__file__).resolve().parents[1]
source=root/'reports/ai-foundation-20261104/two-rounds-teacher-v2/v166-chrome-ai-twenty-20261105-v1.log'
ids=[line.split()[1] for line in source.read_text().splitlines() if line.startswith('PASS ')]
assert len(ids)==20 and len(set(ids))==20
ids.append('production-public-income-option')
args=['node','tools/run_browser_smokes.js']
for item in ids:args.extend(['--match',item])
raise SystemExit(subprocess.call(args,cwd=root))
