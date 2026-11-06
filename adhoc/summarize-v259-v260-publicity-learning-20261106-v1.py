from pathlib import Path
import hashlib,json
w=Path(__file__).resolve().parents[1];F=Path('reports/ai-foundation-20261105/third-round-teacher-v1')
sha=lambda p:hashlib.sha256((w/p).read_bytes()).hexdigest()
read=lambda p:json.loads((w/p).read_text())
controls={}
for p in sorted((w/F).glob('v258-actual-goal-switch-native-control-20261106-v*.json')):
 n=str(p.relative_to(w));r=read(n);controls[n]={'sha256':sha(n),'nativeInputs':r['nativeInputs']}
p=str(F/'v258-analysis-publicity-funding-inspection-20261106-v1.json');controls[p]={'sha256':sha(p),'nativeInputs':read(p)['nativeInputs']}
assert sum(r['nativeInputs']for r in controls.values())==49
evidence=[str(p.relative_to(w))for p in(w/F).iterdir()if p.is_file()and p.name.startswith(('v259-','v260-','v258-actual-goal-switch','v258-analysis-publicity'))]
r={'status':'progress','goalStatus':'active','publishedRuntime':'V258/V46','publishedSourceCommit':'32c3a8fe4b0993caa4f8a376bf83135b1f2877d8','newAutonomousRuns':0,'newNativeControlInputs':49,'controls':controls,
 'nativeLearning':{'recordedBlue4':{'inputs':11,'board':65,'credits':8,'energy':1,'publicity':2,'pool':1,'tech':5,'computerSlots':[1,2,3,4,5],'value':136.5},'cornerThenAmiba0':{'inputs':8,'board':61,'credits':6,'energy':0,'publicity':4,'pool':4,'tech':4,'computerSlots':[1,2,3,4,5,6],'value':137.75},'amiba0ThenCorner':{'inputs':8,'sameFinalAssetsAsCornerFirst':True,'value':137.75},'correctFresh150B101':{'inputs':8,'board':59,'credits':5,'energy':0,'publicity':6,'pool':4,'tech':5,'value':137.58333333333334},'fundingFactorization':{'publicityBefore':2,'publicityAfter':4,'currentAnalysisPotential':10.75,'fundedAnalysisPotential':20.25,'removingAmiba9AloneChangesCapital':False,'futureAnalysisEndpointPublicityBefore':4,'futureAnalysisEndpointPublicityAfter':6}},
 'candidateGates':{},'rejectedPerformanceDirections':{'detailedToScalarCacheSeedingAvoidedComputations':0,'basePortfolioFifo256':{'hits':180,'calls':2023,'adopted':False},'exactKeyPair':{'calls':652,'oldMilliseconds':30.305327000000716,'newMilliseconds':28.948907999999847,'adopted':False},'immutableProofPair':{'calls':1952,'oldMilliseconds':7.643955000000318,'newMilliseconds':8.567517999999467,'adopted':False}},
 'reportingCorrections':['v259-base-portfolio-duplication-v2 filters only miss events; v1 accidentally included base events in scalar misses. Base duplication counts unchanged.','The retained Native controls total31+8+8+2=49. Earlier contract text mis-added this as51; no missing Native inputs or new autonomous run.'],
 'sourceSnapshotsRetained':True,'developmentAligned':False,'lastActualR3':{'version':'V256','board':87,'tech':6,'income':'7C2E1card+1scan','milliseconds':5528},'teacherR3':{'board':105,'tech':6,'income':'7C4E1card+1scan'},'baseline':'V41',
 'remaining':['Reduce structural fixed-preparation/portfolio execution cost; preserve both failed first cold samples.','Admit all728 cold cases and first-two behavior before one new standard R3 game.','Continue R3 teacher asset learning, review R2 end decisions, validate autonomous first3.'],
 'evidenceSha256':{n:sha(n)for n in evidence}}
for v in [259,260]:
 p=str(F/f'v{v}-current-source-serial-gate-20261106-v1.json');g=read(p);assert g['status']=='failed-gate'
 r['candidateGates'][str(v)]={'gate':p,'gateSha256':sha(p),'sourceAdmitted':False,'newAutonomousRuns':0,'namedCasesMeasured':len(g['rows']),'failure':g['failure']}
r['V260RelatedFunctionalTestsPassed']=5
out=w/'adhoc/human405-third-round-progress-20261106-v27.json';assert not out.exists();out.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'out':str(out.relative_to(w)),'nativeControls':49,'evidence':len(evidence),'newAutonomousRuns':0,'candidatesAdmitted':False}))
