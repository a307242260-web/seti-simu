# coding: utf-8
"""Summarize source-bound decision checkpoints and separate native work from branches."""
import collections
import gzip
import hashlib
import json
import pathlib
import subprocess

stage=pathlib.Path.cwd()
sha=lambda p:hashlib.sha256((stage/p).read_bytes()).hexdigest()
prefix='reports/ai-foundation-20261023/'
corpus_path=prefix+'data-plan-no-borrow-corpus-20261028-v2.json'
single_path=prefix+'data-plan-no-borrow-case062-20261028-v2.json'
corpus=json.loads((stage/corpus_path).read_text())
single=json.loads((stage/single_path).read_text())
for report in [corpus,single]:
 for p,h in report['sourceHashes'].items():assert sha(p)==h,('source drift',p)
 for row in report['rows']:
  assert row['rootUnchanged'] and sha(row['rawPath'])==row['rawSha256']
  assert sha(row['fixture'])==row['fixtureSha256']
assert corpus['status']=='complete' and len(corpus['rows'])==8
reused=dict(next(r for r in corpus['rows'] if r['caseId']=='case-062'))
assert reused.pop('reusedCheckpoint')==single_path
assert reused==single['rows'][0]

def category(a):
 t=a.get('target') or {};f=a['family'];ch=t.get('choiceId','');p=a.get('payload') or {}
 if ch.startswith('final:'):return 'final-mark'
 if f in ['place_data','analyze'] or ch.startswith(('data:','income:')):return 'data-income-analyze'
 if f=='scan' or t.get('nebulaId') or ch.startswith('scan4:'):return 'scan'
 if f=='industry' and t.get('abilityId')=='turing_borrow_tech' or (t.get('kind')=='residual-domain' and ch.startswith('tech:')):return 'borrow-tech'
 if f=='research_tech' or ('tileId' in t and 'blueSlot' in t):return 'research-tech-slot'
 if f in ['move','orbit','land'] or 'deltaX' in t or t.get('kind')=='move-payment' or 'landTarget' in t or (t.get('skip') and 'remaining' in p):return 'movement-payment-landing'
 if f=='play_card':return 'play-card'
 if t.get('kind')=='trade-card-selection' or (f=='quick_trade' and p.get('gain',{}).get('handSize')):return 'paid-card-acquisition'
 if f in ['quick_trade','card_corner','choose_payment']:return 'trade-discard-corner'
 if t.get('kind')=='planet-reward-alien-trace':return 'alien-trace'
 if f in ['pass','end_turn'] or t.get('kind')=='pass-hand-limit':return 'pass-discard-end-turn'
 if f in ['choose_reward','accept_optional_effect']:return 'optional-reward'
 return f
rows=[]
for row in corpus['rows']:
 raw=json.loads(gzip.decompress((stage/row['rawPath']).read_bytes()))
 d=row['diagnostics'];assert d['limits']=={'transitions':256,'nodes':257,'frontier':256,'milliseconds':600}
 assert d['transitions']<=256 and d['nodes']<=257 and d['peakFrontier']<=256
 assert d['postMainBorrowMacros']==0 and d['postMainBorrowProofNodes']==0
 assert not any(e.get('borrowTileId') for l in raw['lines'] for e in l['edges'])
 graph=raw['sharedPrefixGraph'];acts=raw['diagnosticActions'];counts=collections.Counter(category(acts[e['actionId']]) for e in graph['edges'])
 assert counts['borrow-tech']==0
 assert sum(counts.values())==d['nativeExecutions'],(row['caseId'],sum(counts.values()),d['nativeExecutions'])
 sources=collections.Counter(e['from'] for e in graph['edges'])
 assert d['branchingStates']==sum(l['alternatives']>1 for l in raw['lines'] if l['status'] not in ['terminal','other-owner','information-barrier'])
 for line in raw['lines']:
  if line.get('decisionPolicy',{}).get('kind')=='fixed-data-choice':
   assert len(line['decisionPolicy']['retainedActionIds'])==1
   assert line['alternatives']==1
 if not row['complete']:assert row['actionId'] is None and row['value'] is None
 rows.append({'caseId':row['caseId'],'complete':row['complete'],'stopReason':row['stopReason'],'milliseconds':row['rootAndSearchMilliseconds'],
  'nativeInputs':d['nativeExecutions'],'searchGraphNodes':d['graphNodes'],'macroInternalStates':d['certificateNodes'],
  'searchStatesWithMultipleAlternatives':d['branchingStates'],'searchStatesWithSingleAlternative':d['singleAlternativeStates'],
  'nativeSourcesWithMultipleExecutedInputs':sum(n>1 for n in sources.values()),'nativeSourcesWithSingleExecutedInput':sum(n==1 for n in sources.values()),
  'nativeInputCategories':dict(counts),'disabledBorrowStarts':d['disabledBorrowStarts'],'rawPath':row['rawPath'],'rawSha256':row['rawSha256']})
logs={'node':prefix+'data-plan-no-borrow-node-regression-20261028-v1.log','focused':prefix+'data-plan-no-borrow-focused-20261028-v4.log','browser':prefix+'data-plan-no-borrow-browser-20261028-v1.log','value':prefix+'data-plan-no-borrow-value-audit-20261028-v1.log'}
assert 'SUMMARY unit passed=143 failed=0 total=143' in (stage/logs['node']).read_text()
assert 'SUMMARY fullFlow passed=1 failed=0 total=1' in (stage/logs['node']).read_text()
assert 'SUMMARY unit passed=6 failed=0 total=6' in (stage/logs['focused']).read_text()
assert 'SUMMARY browserSmoke passed=9 failed=0 total=9' in (stage/logs['browser']).read_text()
v=(stage/logs['value']).read_text();fail=[s for s in v.splitlines() if s.startswith('[FAIL]')]
assert len(fail)==1 and 'aomomo' in fail[0]
independent=sum(s.startswith('[PASS] independent-') for s in v.splitlines());assert independent==37
syntax=['randomizer/game/ai/analysis-port.js','randomizer/game/ai/decision-search.js','randomizer/game/ai/resource-demand.js','randomizer/game/ai/fixed-data-plan.test.js','randomizer/game/ai/post-main-borrow.test.js','randomizer/game/ai/search-agent.test.js','tools/node-test-inventory.js','tools/browser-smoke-inventory.js','tools/audit_v_state_inputs.js','adhoc/audit-data-plan-no-borrow-case062-20261028-v2.js','adhoc/audit-data-plan-no-borrow-corpus-20261028-v2.js']
for p in syntax:subprocess.run(['node','--check',p],check=True)
report={'schemaVersion':'seti-fixed-data-no-borrow-delivery-v1','baseCommit':'35f81da38570b11e0d09d8c92df0841c9ec444e3','searchVersion':'seti-complete-decision-search-v36',
 'scope':'Production resource policy forbids starting Turing borrowing; mandatory pending choices remain legal. Data/income/final choices execute greedily inside native plans, known fixed tails do not return as multi-option search decisions.',
 'policyIsEquivalence':False,'budget':corpus['budget'],'passed':corpus['passed'],'failed':corpus['failed'],'rows':rows,
 'checkpoints':[{'path':p,'sha256':sha(p)} for p in [corpus_path,single_path]],
 'validation':{'nodeUnitPassed':143,'nodeFullFlowPassed':1,'focusedPassed':6,'browserPassed':9,'independentValueInputsPassed':independent,'knownLegacyValueFailure':fail,'syntaxChecked':syntax,'logs':{k:{'path':p,'sha256':sha(p)} for k,p in logs.items()}},
 'countingNote':'Native inputs include all fixed rule clicks; search branching states count more than one alternative, including different goal plans. Internal fixed steps are not independent strategic choices. Time-limited work counts are not a speed/strength ratio.',
 'remaining':['Some distinct physical preparation states still re-evaluate main actions and their fixed native effects.','Case-105/152 remain subject to the unchanged single-decision performance gate; no full games or 180-second claim.','Direct legacy search/port diagnostic tools still expose native borrowing, while production search forbids initiation.'],
 'wholeGames':0,'wholeGame180sAccepted':False,'sourceHashes':corpus['sourceHashes']}
out=prefix+'data-plan-no-borrow-final-20261028-v1.json';(stage/out).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'report':out,'passed':report['passed'],'rows':rows},ensure_ascii=False))
