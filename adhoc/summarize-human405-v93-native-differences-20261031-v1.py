"""Classify complete native witnesses; keep model preferences distinct from equivalence."""
import hashlib
import json
import pathlib
import subprocess

stage=pathlib.Path(__file__).resolve().parents[1]
root=pathlib.Path('/Users/bilibili/code/seti-simu')
base='f2cde3d2f7005df3944e66b15ee73bcda6ec22dc'
folder='reports/ai-foundation-20261023/'
sha=lambda b:hashlib.sha256(b).hexdigest()
def read(p): return json.loads((stage/p).read_text())
findings={
24:('model-and-horizon-difference','B117已合法入选并完成相同策略窗口，部署后的探测器及其后续用途仍未计价；54.5与42不是剪枝错误。两条已记录完整首轮路径的同模型估值在共同结算点变为自主51.5、教师56；这是终点敏感性证据，不证明强制B117后自主策略一定更好。'),
36:('model-ranking-and-different-reward-boundary','蓝1/蓝2都进入搜索。蓝1续行53.5、蓝2续行53，分量差来自即时得分、保留资源、手牌及收入；蓝2分支还因盲抽停在更早的信息边界。不能把0.5V或首步不同直接解释为整局优劣。'),
37:('fixed-pick-purpose-defect-repaired-in-v94','B2与B48续行都为53，但一个增加未知手牌收入，一个增加已知能量收入，状态不同。v93普通精选没有识别“已有4数据、唯一DLC9应保留”的收入目的。v94以原生收入预览及保留费用后的兑换修复；24/32首步一致不是自主成绩提升。'),
38:('greedy-positive-income-before-next-turn','提前插B48收入的本窗口V53，立即结束为49.5。提前计划消费B48及4数据，改变后续公司换牌用途，不能称为可交换顺序。现政策按已知净增3.5强制完成；未来选牌/行动机会成本仍是限制。'),
39:('native-main-purpose-value-preference','两类原地目的都存在。当前最佳实际是准备后登陆火星，续行V62；强制教师环绕后续行59。登陆端的8分优势，被较少资源2V、少1信用收入的未来3V抵消，净差3V。没有证据支持为了模仿教师而删除登陆。'),
43:('greedy-income-composition-choice','先收入B48及填蓝槽的本窗口V59，教师立即结束为55。前者消耗了未来公司换出的B48，保留卡、数据与收入构成不同；正收益4V不证明跨回合顺序等价。'),
56:('exact-native-order-equivalence','完整教师准备前缀为放数据、选蓝2槽；与先打DLC9/研究紫4再填蓝槽各5输入，完整正式状态、会话与RNG逐字段完全相同。仅强制放数据一个输入会比较到其他扫描目的，不能代表教师完整计划。'),
62:('unmodeled-future-card-purpose-tie','两张保留牌都计为1手牌，原生续行V56，但牌身份和效果不同。DLC4给公共扫描标记及移动；DLC5给数据、移动及地球相邻探测器条件回手。共同R1结算时没有在场探测器；未来发射后回手用途尚未建模，不能宣称两牌等价。'),
}
rows=[];source_hashes={};source_reports=[]
for step,(classification,finding) in findings.items():
    p=folder+f'human405-v93-native-witness-comparison-step{step}'+('-fixed-prefix' if step==56 else '')+'-20261031-v1.json'
    r=read(p);assert sha((stage/r['rawPath']).read_bytes())==r['rawSha256']
    for name,expected in r['sourceHashes'].items():
        actual=subprocess.check_output(['git','show',base+':'+name],cwd=root)
        assert sha(actual)==expected,(p,name)
        if name in source_hashes: assert source_hashes[name]==expected
        source_hashes[name]=expected
    a,b=r['rows'];assert a['independentNativeReplayMatchesPolicyObservationAndValue'] and b['independentNativeReplayMatchesPolicyObservationAndValue']
    delta={k:a['value']['components'][k]-b['value']['components'][k] for k in a['value']['components']}
    rows.append({'step':step,'classification':classification,'finding':finding,'sourceReport':p,'sourceReportSha256':sha((stage/p).read_bytes()),
      'studentValue':a['value']['total'],'teacherDefinedPrefixValue':b['value']['total'],'studentMinusTeacherComponents':delta,
      'studentEnd':{'status':a['status'],'boundary':a['boundary'],'turn':a['turn']},'teacherEnd':{'status':b['status'],'boundary':b['boundary'],'turn':b['turn']},
      'sameFormalState':r['sameFormalState'],'sameSession':r['sameSession'],'sameNativeRootAndRng':all(x['sourceRootAndRngUnchanged'] for x in r['rows'])})
    source_reports.append(p)
assert next(r for r in rows if r['step']==56)['sameFormalState']
landing=next(r for r in rows if r['step']==39)
assert landing['studentMinusTeacherComponents']['realizedScore']==8
assert landing['studentMinusTeacherComponents']['resources']==-2
assert landing['studentMinusTeacherComponents']['income']==-3
repair_path=folder+'human405-round1-v94-step037-20261030-v1.json';repair=read(repair_path)
assert repair['category']=='same-first-input' and repair['rootPolicies']['cardPickPolicy']['goal']['kind']=='ready-income'
prototype_path=folder+'human405-probe-purpose-prototype-20261031-v1.json';prototype=read(prototype_path)
assert prototype['commonRoundEnd']['teacherMinusAutonomous']==4.5
assert prototype['productionAdmitted'] is False
output=folder+'human405-v93-native-difference-classification-20261031-v1.json'
report={'schemaVersion':'seti-human405-native-difference-classification-v1','sourceCommit':base,'sourceReports':source_reports,'sourceHashes':source_hashes,'rows':rows,
 'repairEvidence':{'path':repair_path,'sha256':sha((stage/repair_path).read_bytes()),'searchVersion':repair['searchVersion'],'firstInput':repair['studentSummary'],'value':repair['studentValue']},
 'probePrototype':{'path':prototype_path,'sha256':sha((stage/prototype_path).read_bytes()),'productionAdmitted':False},
 'remainingStrategicSteps':[24,36,38,39,43,62],'closedNativeOrderSteps':[25,56],
 'scope':'All8 v93 remaining non-first-match teacher nodes now have complete bounded current-policy native continuations and independent inputPort replays. Sourcev93 witnesses are historical; v94 repair is separately source-bound. Classifications are local causal diagnoses, not an assertion of strategic alignment or full-game superiority.',
 'goalStatus':'active','baselineEligible':False}
(stage/output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'output':output,'rows':len(rows),'nativeOrderEquivalence':56,'repairedByV94':37,'remainingStrategicSteps':report['remainingStrategicSteps']},ensure_ascii=False))
