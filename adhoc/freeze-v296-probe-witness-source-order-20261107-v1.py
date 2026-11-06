from pathlib import Path
import json,hashlib
P=Path(__file__).resolve().parents[1];D=Path('reports/ai-foundation-20261107/probe-witness-source-order-v1');prior=Path('reports/ai-foundation-20261107/probe-replacement-witness-v1/source-manifest-20261107-v1.json');old=json.loads((P/prior).read_text());out=P/D/'source-manifest-20261107-v1.json';assert not out.exists();sha=lambda n:hashlib.sha256((P/n).read_bytes()).hexdigest()
names=list(old['sourceHashes'])+['adhoc/v296-probe-witness-source-order-contract-20261107-v1.md'];assert len(names)==len(set(names))
for n,h in old['baseRuntimeHashes'].items():
 if n not in names:assert sha(n)==h,n
for n in names:
 target=P/D/'source-snapshot'/n;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((P/n).read_bytes())
added=Path(old['addedCases'])
m={**old,'valueModel':'seti-purpose-capital-state-value-v53','addedCases':str(added),'addedCasesSha256':sha(added),'searchVersion':'seti-complete-decision-search-v296','resourcePolicy':'seti-goal-resource-preparation-v24','sourceHashes':{n:sha(n)for n in names},'contract':'adhoc/v296-probe-witness-source-order-contract-20261107-v1.md','failedParentManifest':str(prior),'failedParentManifestSha256':sha(prior),'scope':'V296 V53 changes only evaluation order: sources with solely gain_resources/gain_data play effects first, then Native price and exact ID. Every examined source retains full opportunity cost. Stop only on proven universal replacement ceiling; otherwise all sources considered with same values/ties. 616 numeric comparison cases and 9 related suites passed. No Native, cache, rule, identity or budget changes.','newAutonomousRuns':0,'candidateAdmitted':False};out.write_text(json.dumps(m,indent=2)+'\n');print(json.dumps({'manifest':str(out.relative_to(P)),'sha256':sha(out.relative_to(P)),'owned':len(names),'runtime':len(m['baseRuntimeHashes'])}))
