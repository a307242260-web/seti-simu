"""Update the existing status report from the saved, verified v514 receipt."""
from pathlib import Path
import hashlib
import json
import subprocess

R = Path(__file__).resolve().parents[1]
M = R / 'reports/ai-foundation-20261118'
D = R / 'reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1'
data_path = D / 'current-strategy-status-data-20261118-v1.json'
html_path = R / 'reports/iteration/current-full-baseline-20261118-v1.html'
f = json.loads((M / 'cargo-gain-v514-findings-20261118-v1.json').read_text())
data = json.loads(data_path.read_text())
if data['candidate']['version'] == 'v514':
    assert data['candidate']['milliseconds'] == f['admission']['milliseconds'][1]
    if '研究候选v514' in html_path.read_text():
        print('REUSE', html_path)
        raise SystemExit(0)
    # Recover only our partial, unpublished report update. The source file was
    # verified identical to HEAD before this task; no shared-index operation.
    data = json.loads(subprocess.check_output(['git', 'show', 'HEAD:' + str(data_path.relative_to(R))], cwd=R))
assert data['candidate']['version'] == 'v512' and data['completedGame']['score'] == 272
old_data_hash = hashlib.sha256(json.dumps(data, ensure_ascii=False, indent=2).encode() + b'\n').hexdigest()
old_finding = data['sources']['candidateFindings']['path']
data['priorV512Validation'] = data['validation']
data['candidate'] = {'version': 'v514', 'promoted': False, 'native': 69,
    'milliseconds': f['admission']['milliseconds'][1], 'complete': True,
    'scoreUsedForActionComparison': 239.5, 'nativeLimit': 256, 'millisecondsLimit': 600,
    'action': 'play_card:975c7a35', 'logicalNodes': 601, 'singlePointPassed': True,
    'fullGraphAndRootsPreserved': True, 'newCompletedGame': False}
data['validation'] = {'nodePassed': 12, 'nodeFailed': 0, 'browserPassed': 11,
    'valueInputAuditPassed': 68, 'fullSuiteRun': False, 'independentlyRestoredFiles': 52,
    'firstTwoAutonomousRegressionRun': False, 'newCompletedGame': False}
for field, name in [('candidateDecision', 'cargo-gain-v514-point289-20261118-v1.json.gz'),
                    ('candidateFindings', 'cargo-gain-v514-findings-20261118-v1.json'),
                    ('candidateSource', 'cargo-gain-v514-source-20261118-v1.json')]:
    path = M / name
    data['sources'][field] = {'path': str(path.relative_to(R)), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
data['candidateTimingLimit'] = 'One independent decision per runtime; not a latency distribution or new whole-game outcome.'
s = html_path.read_text()
changes = {
    '单席AI完成272分；第四轮发展与候选决策耗时仍有差距': '单席AI完成272分；研究候选通过困难点性能检查',
    '研究候选在困难决策上的单次耗时约1.57秒，超过600ms准入要求，尚未启用。': '研究候选在同一困难决策上耗时572.9ms，通过600ms单点要求；固定开局回归与新整局验证尚待完成，正式策略保持不变。',
    '<div class="value warning">1.57秒</div>': '<div class="value">0.57秒</div>',
    '209次完整规则提交；准入阈值600ms': '69次完整规则提交；单点通过600ms',
    '<td>209次</td>': '<td>69次</td>',
    '<td>1573.7ms</td>': '<td>572.9ms</td>',
    '当前性能仍不足以通过准入，正式策略与现有整局成绩保持不变。': '当前单点性能检查已通过，完整601节点与全部根选项保持一致；固定开局的前两轮资产回归、整局验证及版本采用尚未完成，现有整局成绩保持不变。',
    '配对耗时为同进程先参照后候选的一次测量；不同批次不组成累计提速曲线。': 'v513与v514各进行一次独立源码运行：639.7ms与572.9ms。两者起点、完整图、根选项与估值一致；该比较不代表稳定延迟分布。',
    '运输规划、任务匹配、隐藏信息隔离、决策图和计划冷恢复共7项相关检查通过。search-agent历史行动族断言未通过，相同失败在旧候选上复现；完整回归尚未完成。本候选未运行新的浏览器测试或估值输入审计，不能沿用旧候选的通过数量。源码、卡牌目录及测试依赖已按Git来源和SHA校验，47个源码／数据文件完成独立还原。': '运输、隐藏信息、触发边界、决策图与冷恢复共12项相关Node检查、68项估值输入审计和11项浏览器检查通过；完整回归尚未完成。源码、卡牌目录和测试输入按Git来源及SHA校验，52个源码／数据文件完成独立还原。',
    '研究候选v512／估值v71': '研究候选v514／估值v71'
}
for before, after in changes.items():
    assert before in s, before
    s = s.replace(before, after)
row_start = s.index('<td>决策耗时</td>')
row_end = s.index('</tr>', row_start)
row = s[row_start:row_end]
assert '未通过' in row
s = s[:row_start] + row.replace('未通过', '通过').replace('class="warning"', '') + s[row_end:]
s = s.replace(old_finding.split('/')[-1], 'cargo-gain-v514-findings-20261118-v1.json')
new_data = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
new_hash = hashlib.sha256(new_data.encode()).hexdigest()
s = s.replace(old_data_hash, new_hash)
if '<main>' in s:
    s = s.replace('<main>', '<main data-report-data-sha256="' + new_hash + '">', 1)
assert '1573.7ms' not in s and '研究候选v512' not in s
data_path.write_text(new_data)
html_path.write_text(s)
print('UPDATED', html_path)
