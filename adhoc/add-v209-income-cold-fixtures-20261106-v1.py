from pathlib import Path
import json,hashlib
w=Path(__file__).resolve().parents[1];f=Path('reports/ai-foundation-20261105/third-round-teacher-v1');path=f/'v208-income-factor-prefixes-20261106-v1.checkpoint.json';source=json.loads((w/path).read_text());originalpath=f/'v207-known-computer3-analysis-prefix-20261106-v1.checkpoint.json';original=json.loads((w/originalpath).read_text());rows=[]
for label,envelope,src in [('income-before-Amiba',original['originalEnvelope'],originalpath),('income-after-Amiba',source['common']['prefixes'][1],path)]:
 seed=json.loads(envelope['committedState'])['meta']['seed'];out=f/('v209-'+label.lower()+'-root-20261106-v1.json');payload={'seatId':'player-white','source':{'seed':seed,'sourceCheckpoint':str(src),'sourceSha256':hashlib.sha256((w/src).read_bytes()).hexdigest(),'nativeRoot':True},'compositionEnvelope':envelope}
 if(w/out).exists():assert json.loads((w/out).read_text())==payload
 else:(w/out).write_text(json.dumps(payload,indent=2)+'\n')
 rows.append({'label':label.lower(),'fixture':str(out)})
p=w/'adhoc/gate-v209-computer-analysis-source-20261106-v1.js';s=p.read_text();needle="cases.push(...read('reports/ai-foundation-20261104";index=s.index(needle);s=s[:index]+'cases.push(...'+json.dumps(rows)+');\n'+s[index:];p.write_text(s);print('added two exact controlled native roots')
