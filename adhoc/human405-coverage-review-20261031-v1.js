'use strict';
const fs = require('node:fs'), assert = require('node:assert/strict'), zlib = require('node:zlib'), crypto = require('node:crypto');

function classifyTeacherCoverage(result, teacherActionId) {
  const direct = result.roots.find(r => r.actionId === teacherActionId);
  const directEdges = result.lines[0].edges.filter(e => e.actionId === teacherActionId);
  const internalUses = result.lines.flatMap(line => line.edges.flatMap(edge => {
    const steps = edge.steps || [edge.actionId], offset = steps.indexOf(teacherActionId);
    if (offset < 0 || line.node === 0 && offset === 0) return [];
    return [{ node: line.node, target: edge.target, firstActionId: edge.actionId,
      steps, goal: edge.resourcePlan?.goal || edge.goalPlan?.objective || null }];
  }));
  const cut = directEdges.map(e => result.lines[e.target]).find(l => l.prunedByBound);
  let category;
  if (result.actionId === teacherActionId) category = 'same-first-input';
  else if (Number.isFinite(direct?.value) && direct.value === result.value) category = 'same-value-different-first-input';
  else if (direct?.completion === 'covered-by-global-value-bound' && directEdges.length) category = 'entered-and-pruned-by-value-bound';
  else if (Number.isFinite(direct?.value)) category = 'searched-but-lower-value';
  else if (direct?.completion === 'unreachable') category = 'entered-but-no-reachable-boundary';
  else if (directEdges.length) category = direct?.completion || 'entered-without-exact-root-value';
  else if (direct?.completion?.startsWith('excluded-by-')) category = direct.completion;
  else if (internalUses.length) category = 'covered-as-internal-input';
  else category = direct?.completion || 'not-in-search-alternatives';
  return { category, directRootEntered: directEdges.length > 0, directCandidate: direct || null,
    reportedTeacherValueType: direct?.valueType || (direct?.completion === 'complete' ? 'exact-within-policy' : null),
    immediateSuccessorCut: cut ? { node: cut.node, ...cut.prunedByBound } : null, internalUses,
    scope: 'An entered root action is not an internal preparation. A globally pruned root value may be an attained lower bound; only the explicit cut bound or a fresh complete continuation supports a rejection diagnosis.' };
}

if (require.main === module) {
  const folder = 'reports/ai-foundation-20261023/', output = folder+'human405-v99-corrected-coverage-review-20261031-v1.json';
  assert(!fs.existsSync(output), 'Reuse recorded coverage review');
  const auditPath = folder+'human405-round1-v99-audit-20261030-v1.json', audit = JSON.parse(fs.readFileSync(auditPath));
  const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const rows = audit.rows.map(row => {
    const evidence = JSON.parse(fs.readFileSync(row.evidencePath));
    assert.equal(sha(evidence.rawPath), evidence.rawSha256);
    const graph = JSON.parse(zlib.gunzipSync(fs.readFileSync(evidence.rawPath)));
    for (const [p, h] of Object.entries(evidence.sourceHashes)) assert.equal(sha(p), h, p);
    return { step: row.step, evidencePath: row.evidencePath, evidenceSha256: sha(row.evidencePath),
      oldCategory: row.category, teacher: row.teacher, student: row.student,
      ...classifyTeacherCoverage(graph, evidence.teacherAction.actionId) };
  });
  const opening = rows.find(r => r.step === 24);
  assert.equal(opening.category, 'entered-and-pruned-by-value-bound');
  assert.equal(opening.directRootEntered, true);
  assert.equal(opening.internalUses.some(x => x.node === 0 && x.steps[0] === opening.directCandidate.actionId), false);
  assert.equal(opening.immediateSuccessorCut.upperBound, 54);
  assert.equal(opening.immediateSuccessorCut.value, 57);
  assert.equal(rows.find(r => r.step === 39).category, 'entered-and-pruned-by-value-bound');
  assert(rows.find(r => r.step === 56).internalUses.length > 0,
    'actual later uses remain visible even when a direct teacher root is also entered');
  assert.equal(rows.find(r => r.step === 38).category, 'excluded-by-resource-policy');
  assert(rows.find(r => r.step === 38).internalUses.length > 0,
    'root exclusion and a later end-turn in a fixed plan are separate facts');
  assert.equal(rows.filter(r => r.category === 'same-first-input').length, 23);
  const report = { schemaVersion: 'seti-human405-corrected-root-coverage-v1', sourceCommit: '0dc7785da8a4dce7bc81eabbb7dc92dcf6faf58f',
    sourceAudit: auditPath, sourceAuditSha256: sha(auditPath), rows, sourceHashes: audit.sourceHashes,
    classifierSha256: sha('adhoc/human405-coverage-review-20261031-v1.js'),
    findings: ['Root24 B117 was directly searched then cut at upper54 below winner57. It was incorrectly labelled internal because the root edge itself was counted.',
      'Root39 orbit was also directly entered. A globally covered root lower bound is not an exact per-action maximum.',
      'Historical reports remain intact. Current classification is recomputed from the exact archived graph without rerunning search or the autonomous experiment.'],
    goalStatus: 'active', baselineEligible: false };
  fs.writeFileSync(output, JSON.stringify(report, null, 2)+'\n');
  console.log(JSON.stringify({ output, changed: rows.filter(r => r.category !== r.oldCategory).map(r => ({ step: r.step, before: r.oldCategory, after: r.category })) }));
}
module.exports = { classifyTeacherCoverage };
