"""Summarize the unpromoted capital candidate without rerunning experiments."""
import gzip
import hashlib
import json
import pathlib

stage=pathlib.Path(__file__).resolve().parents[1]
folder='reports/ai-foundation-20261023/'
sha=lambda b:hashlib.sha256(b).hexdigest()
def read(p):return json.loads((stage/p).read_text())
def write(p,o):(stage/p).write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n')
source='adhoc/human405-v78-capital-candidate-source-20261030-v1.json.gz'
snapshot=json.loads(gzip.decompress((stage/source).read_bytes()))
assert snapshot['baseCommit']=='5855b2196c233f38246faa30959e8d7a81be8817' and not snapshot['productionAccepted']
teacher=read(folder+'human405-round1-v78-audit-20261030-v1.json')
assert len(teacher['rows'])==32 and not teacher['unactionableRoots']
baseline=read(folder+'human405-round1-v67-audit-20261030-v1.json')
old=read(folder+'human405-round1-v76-step057-20261030-v1.json')
new=read(folder+'human405-round1-v78-step057-20261030-v1.json')
assert old['studentActionId'] is None and new['studentActionId']==new['teacherActionId']
legacy=[]
for kind in ['corpus','step317','terminal-root']:
 p=folder+'round1-v78-compat-'+kind+'-20261029-v1.json';o=read(p)
 for row in o.get('rows',[o]):
  assert row.get('complete') and not row.get('error')
  legacy.append({'case':row.get('caseId',kind),'report':p,'actualNativeInputs':row['diagnostics']['nativeExecutions'],
   'milliseconds':row['rootAndSearchMilliseconds'],'rawPath':row['rawPath'],'rawSha256':row['rawSha256']})
controls=[]
for number in [24,39,44]:
 p=folder+f'human405-v78-capital-native-controls-{number}-20261030-v1.json';o=read(p)
 assert o['sameBestAsFreshFullyExecutedPolicy'] and o['sourceRootAndRngUnchanged']
 assert all(r['predictedValue']==r['nativeValue'] for r in o['controls'])
 controls.append({'step':number,'report':p,'proofSources':len(o['controls']),'kinds':{k:sum(r['kind']==k for r in o['controls'])for k in ['income','end-turn','blue-end-turn']},
  'withProofNativeInputs':o['actualSearchInputs'],'freshFullyExecutedNativeInputs':o['controlSearchInputs'],'sameBestActionAndValue':True})
assert sum(r['proofSources']for r in controls)==145
report={'schemaVersion':'seti-purpose-capital-candidate-admission-v1','baseCommit':snapshot['baseCommit'],
 'productionVersion':'v67','candidateVersion':'v78','candidateSource':source,'candidateSourceSha256':sha((stage/source).read_bytes()),
 'admitted':False,'baselineEligible':False,'goalStatus':'active','strategyAligned':False,
 'candidateAutonomousRun':False,'scoreReported':False,
 'forecastAssumptions':{'computerCyclesPerLaterRound':1,'usefulScansPerLaterRound':2,'landingsPerLaterRound':1,
  'scope':'Explicit value hypotheses, not native guarantees or pruning bounds. No hidden future identities and no legacy grossEquivalentValue units are used.'},
 'nativeFacts':['Blue column score and attached resource reward reopen after actual computer analysis, not automatically on round changes.',
  'Purple4 can supply one native movement point during a scan. The estimate values useful movement; saved launch tempo has no invented score.',
  'Free-research hand opportunity uses public remaining supply and each stack first-take status, subtracts native card cost and consumed hand value; duplicate options are not added independently.'],
 'teacherAudit':{'report':folder+'human405-round1-v78-audit-20261030-v1.json','roots':32,
  'rootAndRngUnchanged':all(r['rootAndRngUnchanged']for r in teacher['rows']),
  'baselineSameFirstInputs':baseline['categoryCounts']['same-first-input'],'candidateSameFirstInputs':teacher['categoryCounts']['same-first-input'],
  'unactionableRoots':teacher['unactionableRoots'],'categories':teacher['categoryCounts'],'gateFailures':teacher['speedOverruns']},
 'legacyAudit':{'rows':legacy,'gateFailures':[r for r in legacy if r['actualNativeInputs']>256 or r['milliseconds']>600]},
 'proofControls':controls,'nativeProofSourcesVerified':145,
 'blueRecoveryRegression':{'beforeReport':folder+'human405-round1-v76-step057-20261030-v1.json',
  'afterReport':folder+'human405-round1-v78-step057-20261030-v1.json','beforeActionable':False,'afterNativeTeacherChoice':True,
  'cause':'The scan resource adapter and generic computer-first advisory overrode the concrete blue funding operation; cold recovery also lost its slot binding.'},
 'requiredPurposeGap':folder+'human405-blue-column-purpose-gap-20261030-v1.json',
 'validation':{'targetedTestsPassed':['income-plan-value.test.js','state-value.test.js','resource-demand.test.js','purpose-capital-value.test.js','science-scan-flow.test.js'],
  'fullNodeRegressionRun':False,'browserSmokesRun':False,'reason':'Candidate has point-gate failures and a missing necessary purpose; it is not ready for production/full regression/autonomous round trial.',
  'inputAuditLog':folder+'human405-v78-state-input-audit-20261030-v1.log','inputAuditPassed':False,
  'inputAuditFailures':['preexisting frozen aomomo legacy decisionObs failure','old one-input card-equivalence assertion no longer applies to new future-value model','old teacher43 income-proof fixture now has different optimal fixed tail'],
  'inputAuditCoverageNote':'The card-equivalence assertion stops later checks in its large try block. No claim that all candidate V input paths passed.'},
 'remainingInOrder':['Add the missing known computer-column-plus-blue purpose with correct prerequisites; do not delete this required line for performance.',
  'Reduce teacher39 and legacy case105 actual input/time cost without dropping necessary purposes; recheck closure and proof controls.',
  'Update model-specific input audits and run full Node/Browser verification only after point gates pass.',
  'Then commit an admitted implementation and run one new standard white-only first round; retain B117/probe value and fixed-pick differences as unresolved until evidenced.']}
write(folder+'human405-v78-capital-candidate-admission-20261030-v1.json',report)
progress=read('adhoc/human405-round1-progress-20261030-v9.json')
progress['completed'] += ['An unpromoted capability/held-card value candidate improves teacher first-input matches from10 to23 across32 roots; all32 remain actionable after fixing cold blue funding recovery.',
 '145 used income/quiet-tail plan proof sources executed natively; fresh searches with both proof shortcuts disabled choose the same actions and values.',
 'Native teacher38 control identifies an omitted four-input known computer-column-plus-blue purpose with2V gain; queued as a required fix, not pruned for speed.']
progress['unpromotedCandidate']={'version':'v78','sourceSnapshot':source,'admissionReport':folder+'human405-v78-capital-candidate-admission-20261030-v1.json',
 'productionAccepted':False,'pointGatesPassed':False,'fullRegressionPassed':False,'autonomouslyRun':False,
 'teacherSameFirstInputs':23,'teacherRoots':32,'nativeProofSourcesVerified':145,
 'failures':['teacher39:311actual inputs /479.619ms','legacy case105:275actual inputs /670.708ms','missing known column-plus-blue purpose','candidate input audit not fully adapted/covered']}
progress['remainingInOrder']=report['remainingInOrder']
progress['completionNote']='Goal remains active. Production and latest autonomous result remain v67; v78 is a source-bound unpromoted prototype, with no reported autonomous score.'
write('adhoc/human405-round1-progress-20261030-v10.json',progress)
print(json.dumps({'candidateAdmitted':False,'teacherFirstInputs':[10,23],'nativeProofSources':145,'teacherFailures':len(teacher['speedOverruns']),'legacyFailures':len(report['legacyAudit']['gateFailures']),'goalStatus':'active'}))
