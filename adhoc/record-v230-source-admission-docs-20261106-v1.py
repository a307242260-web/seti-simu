from pathlib import Path
import json
w=Path(__file__).resolve().parents[1];f=Path('reports/ai-foundation-20261105/third-round-teacher-v1');a=json.loads((w/f/'v230-current-source-admission-20261106-v1.json').read_text());assert a['sourceAdmitted'];gate=json.loads((w/f/'v230-current-source-serial-gate-20261106-v1.json').read_text());by={r['label']:r for r in gate['rows']};primary=a['primaryDLC31'];old=by['paired-purple2-known-analysis-single-3'];scan=by['scan-launch-gap'];corner=by['corner-safety-purple2-3'];name='docs/human405-third-round-fixed-tail-guard-admission-20261106.md'
body=f'''# V230扫描计划与固定流程最终准入（2026-11-06）

V230/V37通过573个具名用例、483个不同原生根的完整冷测，全部闭合，最高256次输入、{a['maxMilliseconds']:.6f}ms。DLC31的困难根由原先311次降至233次、{primary['milliseconds']:.6f}ms。以下均是保留的各版本首次冷启动样本，不是整局耗时或多次重抽后的最好值。

| 决策根 | 当前原生输入 | 当前首次root+search耗时 |
| --- | ---: | ---: |
| DLC31准备第15输入后，原311输入根 | 233 | {primary['milliseconds']:.3f}ms |
| 较早的279输入根 | {old['nativeInputs']} | {old['milliseconds']:.3f}ms |
| 原最重Safety/紫2准备根 | {corner['nativeInputs']} | {corner['milliseconds']:.3f}ms |
| 扫描后紫4发射缺口 | {scan['nativeInputs']} | {scan['milliseconds']:.3f}ms |

## 改动与边界

- 扫描明确区分普通扫描与扫描后紫4发射，后者多预留1电，按Production有效科技、探测器容量和已有资源筹资。完成时必须真的发射，不能静默跳过。移动和选牌仍绑定目的。
- 已选中的低收益蓝槽仍保留并计算准确固定后果。在无人插入行动且无绑定移动意图时，用既有objectiveOnly政策和Production终点查询检查确切钱包上的本turn移动目的；有目的仍原生继续。
- 强制牌收入仅在原生本来就会到达同一未知自有牌边界、resourceSpec只有该计划且没有其他保留行动时报价。盲抽只计数量，公开牌堆数量减1，并准确交接剩余用途资本；不读取新牌身份、不生成可执行后继。
- 末尾的负收益蓝槽不能仅凭局部负值略过。必须计算其完整固定后缀，并检查新增目的、移动及正式轮末标记；只有严格不如现在结束才省略。每个递归后缀先消费不同蓝槽，最多四槽，无人为深度或leaf截断。此保护有失败在先、修复后通过的受控辅助函数用例；它不是教师盘面的实际得分反例。
- 同次研究组合只构造一次持牌选项，取消低命中的身份子树缓存调用。四项生产预算仍null，原生状态/actor/session/RNG/意图与现有规范化保持，483根完整用途组合与V218逐字段相同，评分模型仍V37。

V229的573冷测和184单元虽然通过，发布前复核发现末尾负蓝槽没有调用新增目的保护，因此没有替换正式源码；其原结果与补充复核原样保留。最终采用V230，不能拿旧绿灯代替新版本验证。V226—V228297/275/275输入的失败诊断未继续冷计时；V219—V225的首次失败同样保留。

## 验证

- 当前185单元、1完整流程、5项Production浏览器验证通过；独立提交00a48d10快照仅叠加本次12文件，24测试通过，317份依赖材料逐份校验。
- 36条货币尾部以119次原生输入、14条牌收入以42次原生输入分别复核；值、兑现量、实际边界和牌堆计数一致，原始根与RNG不变。
- 只读已有冷测结果，483个状态的每个根行动值、兑现量、准备债务、完成状态及最终选择均与V229一致；没有为这次比较新开搜索或重抽计时。
- 输入审计51项通过，1项既有aomomo冻结对象异常保留，未描述为全绿；旧默认启发式整页超时也未在本次宣称解决。
- 证明适用于当前固定政策窗口，不外推为全局最优或任意新盘面都能满足性能门槛。

[源码准入凭据](../{f}/v230-current-source-admission-20261106-v1.json)、[完整冷测](../{f}/v230-current-source-serial-gate-20261106-v1.json)、[所有根值对照](../{f}/v230-v229-retained-all-root-value-parity-20261106-v1.json)、[历史过程](human405-third-round-scan-launch-admission-20261106.md)。

## 下一项学习

没有新增自主局成绩。最近V214第三轮仍82盘面分、5科技、收入6钱3电1牌及1扫描；教师当前规则合法重放为105盘面分、6科技、收入7钱4电1牌及1扫描。V41完整局baseline不变。

接下来修复匿名手牌数量换取已知公开收入的用途估值：已有原生对照中，换牌前后实际资产没有增加，估值却从111.75跳到123.583333，漏计11.833333的已保证用途。一次贪心选公开收入，消费一次公司能力，沿用同一钱包/数据账本，不能读取匿名身份或重复计入收入和分析。本次减少固定执行成本，尚未消除这个策略价值缺口。之后继续具体科技、任务、三色痕迹和收入循环；第三轮学习完成后回查第二轮轮末，再验证自主前三轮。Goal保持active。
'''
(w/name).write_text(body)
p=json.loads((w/'adhoc/human405-third-round-progress-20261106-v11.json').read_text());p.pop('sourceCommit',None);p.update({'status':'active','runtime':'V230/V37','sourceAdmitted':True,'baseCommit':a['baseCommit'],'sourceAdmission':str(f/'v230-current-source-admission-20261106-v1.json'),'sourceDelivery':'Frozen source and exact Git tree are verified by the delivery manifest; final commit is in Git history and the delivery receipt.','sourceDeliveryManifest':'adhoc/v230-scan-source-delivery-manifest-20261106-v1.json','existingPerformanceCoverage':{'namedCases':573,'uniqueRoots':483,'maxNativeInputs':256,'maxMilliseconds':a['maxMilliseconds']},'candidateRuntime':'V230/V37','candidateAdmitted':True,'candidateManifest':a['manifest'],'candidateGate':str(f/'v230-current-source-serial-gate-20261106-v1.json'),'candidateProgress':{'status':'complete','namedCases':573,'uniqueRoots':483,'allClosed':True,'maxInputs':256,'maxMilliseconds':a['maxMilliseconds']},'productionRuntimeAtValidation':'V218/V37','candidateNativeControls':{'currency':{'proofs':36,'inputs':119},'blindIncome':{'proofs':14,'inputs':42}},'validation':{'current':{'unitPassed':185,'fullFlowPassed':1,'browserPassed':5,'independentTests':24,'independentFixtures':317,'inputAuditPass':51,'inputAuditLegacyFail':1}},'V229WithheldForProofGuardReview':True,'newAutonomousRuns':0,'report':name,'nextWork':a['nextWork']});p.pop('additionalNativeControls',None);p.pop('additionalSearchTimings',None);p.update({'currentSourceUniqueColdRootTimings':483,'priorPairedNativeControlInputs':84,'currentIndependentScalarNativeControlInputs':161,'currentGoalTurnAutonomousRuns':0});(w/'adhoc/human405-third-round-progress-20261106-v12.json').write_text(json.dumps(p,indent=2)+'\n')
p=w/'docs/ai-design.md';s=p.read_text();s+='\nV230/V37的[扫描计划最终准入](human405-third-round-fixed-tail-guard-admission-20261106.md)补齐剩余负蓝槽的完整后缀/新增目的保护，只有严格劣于立即结束才省略，递归先消费不同蓝槽且无任意cap。受控回归先失败后通过；V229原冷测/184单元通过但发布前复核后未推广，其证据保留。V230573具名/483冷根全部闭合，最高256/'+f"{a['maxMilliseconds']:.6f}"+'ms，原311根233/'+f"{primary['milliseconds']:.6f}"+'ms；185单元/1完整流程、Chrome5、独立24测试/317材料通过，旧aomomo审计异常保留。36货币/14牌收入证明以119/42原生输入复核，483个留存状态每个根值/兑现量/准备债务与V229一致，四预算仍null、模型V37。无新自主局或分数，继续匿名数量换公开收入的11.833333用途缺口、第三轮学习及第二轮轮末复核；V41baseline保留，Goalactive。\n';p.write_text(s)
print(json.dumps({'report':name,'progress':'adhoc/human405-third-round-progress-20261106-v12.json','sourceAdmitted':True,'goal':'active'}))
