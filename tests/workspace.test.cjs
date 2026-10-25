const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const api = require('../lib/workspace.cjs');
const { root, hash, catalog, projects, resolve, variantDigest } = require('../lib/resume.cjs');
let temp, w;
const target = { company: 'Synthetic company', role: 'Agent Engineer', location: 'Shanghai', sourceUrl: 'https://example.com/jobs/demo', jd: 'PRIVATE_JD_SENTINEL; synthetic role, not an open job' };
const save = (kind, id, value) => fs.writeFileSync(api.file(w, kind, id), JSON.stringify(value));
test.beforeEach(() => {
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-test-'));
  w = api.workspace(path.join(temp, 'private'), true);
  api.target(w, 'agent', target);
  api.variant(w, 'agent-zh', 'agent');
});
test.afterEach(() => fs.rmSync(temp, { recursive: true, force: true }));
test('shared IDs match across locales and default keeps all projects', () => {
  assert.deepEqual(projects(catalog('zh').data).map(p => p.id), projects(catalog('en').data).map(p => p.id));
  assert.equal(projects(catalog('zh').data).length, 8);
});
test('two tailored variants select and order projects without changing default or one another', () => {
  const v = api.read(api.file(w, 'variants', 'agent-zh'));
  v.projectIds = ['mcp-toolchain', 'dabao', 'mcpadvisor']; v.reason = 'Tool runtime evidence first';
  v.overrides.description = { text: 'Agent engineering', reason: 'Role focus', evidenceIds: ['dabao'] };
  save('variants', v.id, v);
  api.variant(w, 'backend-en', 'agent', 'en');
  assert.throws(() => api.current(w, v.id, true), /unreviewed/);
  api.review(w, v.id, 'Test reviewer');
  const resolved = api.current(w, v.id, true).data;
  assert.deepEqual(projects(resolved).map(p => p.id), v.projectIds);
  assert.equal(projects(api.current(w, 'backend-en').data).length, 8);
  assert.equal(projects(catalog().data).length, 8);
  assert.match(catalog().data.description, /MAU/);
  v.projectIds = ['dabao', 'dabao'];
  assert.throws(() => resolve(v, { reviewed: false }), /Duplicate/);
  v.projectIds = ['not-a-fact'];
  assert.throws(() => resolve(v, { reviewed: false }), /Unknown project/);
});
test('edits invalidate review and source or JD changes require explicit refresh', () => {
  let v = api.review(w, 'agent-zh', 'Test reviewer');
  v.reason = 'New tailoring'; save('variants', v.id, v);
  assert.throws(() => api.current(w, v.id, true), /unreviewed/);
  v.baseHash = 'old'; save('variants', v.id, v);
  assert.throws(() => api.review(w, v.id, 'Reviewer'), /Stale/);
  api.refresh(w, v.id, 'Compared source facts'); api.review(w, v.id, 'Reviewer');
  const t = api.read(api.file(w, 'targets', 'agent')); t.jd += ' changed'; save('targets', t.id, t);
  assert.throws(() => api.current(w, v.id), /JD changed/);
  api.refresh(w, v.id, 'Compared updated JD');
  assert.throws(() => api.current(w, v.id, true), /unreviewed/);
});
test('path traversal, in-repository and symlink workspaces are rejected', () => {
  assert.throws(() => api.target(w, '../oops', target), /Invalid ID/);
  assert.throws(() => api.workspace(path.join(root, 'private'), true), /separate/);
  const link = path.join(temp, 'repo-link'); fs.symlinkSync(root, link);
  assert.throws(() => api.workspace(path.join(link, 'private'), true), /separate/);
  const record = api.file(w, 'variants', 'alias'); fs.symlinkSync(api.file(w, 'variants', 'agent-zh'), record);
  assert.throws(() => api.review(w, 'alias', 'Reviewer'), /symlink/);
});
function syntheticExport() {
  const dir = path.join(w, 'exports', 'export-fixture'); fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'resume.pdf'), '%PDF-synthetic-test-only');
  api.writeNew(path.join(dir, 'variant.json'), api.read(api.file(w, 'variants', 'agent-zh')));
  api.writeNew(path.join(dir, 'manifest.json'), { schemaVersion: 1, variantId: 'agent-zh', targetId: 'agent', files: api.hashes(dir) });
  return dir;
}
test('same-day submissions are distinct, immutable and detect artifact tampering', () => {
  const dir = syntheticExport();
  const at = '2026-10-26T10:00:00+08:00';
  const a = api.snapshot(w, 'export-fixture', 'manual test', at);
  const b = api.snapshot(w, 'export-fixture', 'manual test', at);
  assert.notEqual(a.submissionId, b.submissionId);
  const frozen = path.join(w, 'submissions', a.submissionId);
  const original = api.verify(frozen);
  fs.writeFileSync(path.join(dir, 'resume.pdf'), 'tampered');
  assert.throws(() => api.snapshot(w, 'export-fixture', 'manual', at), /hash mismatch/);
  assert.deepEqual(api.verify(frozen), original);
  fs.appendFileSync(path.join(frozen, 'artifact', 'resume.pdf'), 'tamper');
  assert.throws(() => api.verify(frozen), /hash mismatch/);
});
test('feedback proposals preserve snapshots, need review, and detect conflicts', () => {
  syntheticExport();
  const { submissionId } = api.snapshot(w, 'export-fixture', 'synthetic', '2026-10-26T10:00:00+08:00');
  const before = api.verify(path.join(w, 'submissions', submissionId));
  const input = { round: 'Synthetic round 1', quote: 'Synthetic quote', observation: 'Ownership unclear', inference: 'May need clearer scope', category: 'expression', confidence: 'medium', proposal: { reason: 'Lead with relevant work', patch: { projectIds: ['dabao', 'mcpadvisor'], reason: 'Feedback-specific selection' } } };
  const f = api.feedback(w, submissionId, input);
  const conflict = api.feedback(w, submissionId, input);
  api.decide(w, f.id, 'accept', 'Reviewer', 'Supported by existing facts');
  assert.throws(() => api.current(w, 'agent-zh', true), /unreviewed/);
  assert.deepEqual(api.current(w, 'agent-zh').v.projectIds, ['dabao', 'mcpadvisor']);
  assert.throws(() => api.decide(w, conflict.id, 'accept', 'Reviewer', 'Stale'), /Conflict/);
  assert.deepEqual(api.verify(path.join(w, 'submissions', submissionId)), before);
  assert.throws(() => api.decide(w, f.id, 'accept', 'Reviewer', 'Again'), /already decided/);
  assert.equal(api.recoverDecision(w, f.id).recovered, true);
  const rejected = api.feedback(w, submissionId, input);
  const digestBefore = variantDigest(api.current(w, 'agent-zh').v);
  api.decide(w, rejected.id, 'reject', 'Reviewer', 'Not generalizable');
  assert.equal(variantDigest(api.current(w, 'agent-zh').v), digestBefore);
});
test('private export is isolated, publish fails closed and no build writes archives', async () => {
  const archives = api.hashes(path.join(root, 'archive'));
  api.review(w, 'agent-zh', 'Reviewer');
  const result = await api.build(w, 'agent-zh');
  assert.equal(result.hasPdf, false);
  const html = fs.readFileSync(path.join(result.directory, 'index.html'), 'utf8');
  assert.match(html, /Content-Security-Policy/);
  assert.doesNotMatch(html, /googletagmanager/);
  assert.match(fs.readFileSync(path.join(result.directory, 'target.json'), 'utf8'), /PRIVATE_JD_SENTINEL/);
  for (const page of ['index.html', 'print.html', 'index-en.html', 'print-en.html']) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'dist', page), 'utf8'), /PRIVATE_JD_SENTINEL/);
  }
  assert.throws(() => api.snapshot(w, result.exportId, 'email', '2026-10-26T10:00:00Z'), /PDF/);
  assert.deepEqual(api.hashes(path.join(root, 'archive')), archives);
  const publicOutput = require('../lib/public-output.cjs');
  publicOutput.validate();
  fs.writeFileSync(path.join(root, 'dist', 'private.json'), 'PRIVATE_JD_SENTINEL');
  assert.throws(() => publicOutput.validate(), /hash mismatch/);
  fs.rmSync(path.join(root, 'dist', 'private.json'));
  fs.appendFileSync(path.join(root, 'dist', 'index.html'), 'PRIVATE_JD_SENTINEL');
  assert.throws(() => publicOutput.validate(), /hash mismatch/);
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'pipe' });
  publicOutput.validate();
});
test('requirements preserve unknowns and reject unsupported claims or unknown references', () => {
  api.target(w, 'mapped', { ...target, requirements: [{ id: 'isolation', text: 'Multi-tenant isolation', hard: true }] });
  const v = api.variant(w, 'mapped-zh', 'mapped');
  assert.equal(v.requirementMapping[0].status, 'unknown');
  v.requirementMapping[0].status = 'supported';
  save('variants', v.id, v);
  assert.throws(() => api.review(w, v.id, 'Reviewer'), /needs evidence/);
  v.requirementMapping[0].evidenceIds = ['invented']; save('variants', v.id, v);
  assert.throws(() => api.review(w, v.id, 'Reviewer'), /Unknown evidence/);
  v.requirementMapping[0].evidenceIds = ['dabao']; v.requirementMapping[0].requirementId = 'invented'; save('variants', v.id, v);
  assert.throws(() => api.review(w, v.id, 'Reviewer'), /unknown JD/);
});
test('failed export leaves no partial deliverable and malformed overrides cannot pass review', async () => {
  const v = api.read(api.file(w, 'variants', 'agent-zh'));
  v.overrides = { description: { text: 'Unsupported claim', reason: 'Need evidence', evidenceIds: [] } };
  save('variants', v.id, v);
  assert.throws(() => api.review(w, v.id, 'Reviewer'), /evidence IDs/);
  await assert.rejects(api.build(w, v.id), /evidence IDs/);
  assert.deepEqual(fs.readdirSync(path.join(w, 'exports')), []);
});
