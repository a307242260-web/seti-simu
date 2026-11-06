from pathlib import Path
import json,hashlib
P=Path(__file__).resolve().parents[1];D=Path('reports/ai-foundation-20261107/transient-capital-direct-v1');prior=Path('reports/ai-foundation-20261107/singleton-resource-ranking-v1/source-manifest-20261107-v1.json');old=json.loads((P/prior).read_text());out=P/D/'source-manifest-20261107-v1.json';assert not out.exists();sha=lambda n:hashlib.sha256((P/n).read_bytes()).hexdigest()
names=list(old['sourceHashes'])+['randomizer/game/ai/transient-capital-direct.test.js','adhoc/v287-transient-capital-direct-contract-20261107-v1.md'];assert len(names)==len(set(names))
for n,h in old['baseRuntimeHashes'].items():
 if n not in names:assert sha(n)==h,n
for n in names:
 target=P/D/'source-snapshot'/n;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((P/n).read_bytes())
m={**old,'searchVersion':'seti-complete-decision-search-v287','resourcePolicy':'seti-goal-resource-preparation-v24','sourceHashes':{n:sha(n)for n in names},'contract':'adhoc/v287-transient-capital-direct-contract-20261107-v1.md','failedParentManifest':str(prior),'failedParentManifestSha256':sha(prior),'scope':'Mutable resource previews call the exact original full V50 purposeCapital directly, bypassing repeatedly missing full scalar-key construction; immutable Native reference reuse and public scalar API/cache remain unchanged. V286 singleton and V285 fixed company intent preserved. No valuation, Native input, identity, pruning or budget changes. First cold timing only; no new autonomous run before complete admission.','newAutonomousRuns':0,'candidateAdmitted':False};out.write_text(json.dumps(m,indent=2)+'\n');print(json.dumps({'manifest':str(out.relative_to(P)),'sha256':sha(out.relative_to(P)),'owned':len(names),'runtime':len(m['baseRuntimeHashes'])}))
