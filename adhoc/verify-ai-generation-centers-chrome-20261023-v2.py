import hashlib,json,pathlib,re,subprocess,tempfile
stage=pathlib.Path.cwd();out=stage/'reports/ai-foundation-20261023/generation-centers-chrome-v2.json';assert not out.exists(),'Reuse terminal checkpoint'
chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';registry=json.loads((stage/'reports/iteration/registry.json').read_text());rows=[]
for query,generation in [('', 'v2'),('?ai=v1','v1'),('?ai=v2','v2')]:
 name='default' if not query else generation
 profile=tempfile.mkdtemp(prefix='seti-centers-chrome-',dir='/private/tmp');image=stage/f'reports/ai-foundation-20261023/generation-centers-{name}-v2.png'
 url=(stage/'reports/robot-iteration.html').as_uri()+query
 result=subprocess.run([chrome,'--headless','--no-sandbox','--disable-gpu','--no-first-run','--no-default-browser-check','--allow-file-access-from-files',f'--user-data-dir={profile}','--window-size=1440,1000','--virtual-time-budget=1500',f'--screenshot={image}','--dump-dom',url],capture_output=True,text=True,timeout=30)
 dom=result.stdout;assert result.returncode==0,result.stderr[-1000:];assert f'AI {generation.upper()} 实验中心' in dom
 rendered=re.search(r'id="iter-container">([\s\S]*?</table>)',dom);assert rendered,'Missing rendered table'
 expected=[v for v in registry['versions'] if v['aiGeneration']==generation];excluded=[v for v in registry['versions'] if v['aiGeneration']!=generation]
 for v in expected:assert f'<b>{v["id"]}</b>' in rendered[1],v['id']
 for v in excluded:assert f'<b>{v["id"]}</b>' not in rendered[1],v['id']
 assert f'id="tab-{generation}" href="?ai={generation}" aria-current="page"' in dom
 if generation=='v2':assert '基础策略（无搜索）' in rendered[1] and '基础策略成绩不能用于搜索 AI 验收' in dom
 dompath=stage/f'reports/ai-foundation-20261023/generation-centers-{name}-v2.dom.html';dompath.write_text(dom)
 rows.append({'query':query,'generation':generation,'versionRows':len(expected),'oppositeRows':0,'screenshot':str(image.relative_to(stage)),'domPath':str(dompath.relative_to(stage)),'domSha256':hashlib.sha256(dompath.read_bytes()).hexdigest(),'exitCode':result.returncode})
out.write_text(json.dumps({'status':'passed','rows':rows,'pageSha256':hashlib.sha256((stage/'reports/robot-iteration.html').read_bytes()).hexdigest()},indent=2)+'\n');print(json.dumps({'status':'passed','queries':3,'rows':[(r['generation'],r['versionRows']) for r in rows]}))
