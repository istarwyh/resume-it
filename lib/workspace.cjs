const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const nunjucks = require('nunjucks');
const { root, hash, digest, invariant, id, projects, catalog, validateVariant, variantDigest, resolve } = require('./resume.cjs');
const now = () => new Date().toISOString();
const uid = prefix => prefix + '-' + randomUUID();
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function writeNew(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
function replace(file, value) {
  const temp = file + '.' + randomUUID();
  writeNew(temp, value);
  fs.renameSync(temp, file);
}
function inside(parent, child) { const relative = path.relative(parent, child); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); }
function workspace(location, init = false) {
  invariant(location && path.isAbsolute(location), 'Set RESUME_WORKSPACE to an absolute directory outside the repository');
  // Resolve an existing ancestor before creating anything; symlink aliases cannot bypass isolation.
  let ancestor = path.resolve(location);
  const missing = [];
  while (!fs.existsSync(ancestor)) { missing.unshift(path.basename(ancestor)); ancestor = path.dirname(ancestor); }
  const actual = path.join(fs.realpathSync(ancestor), ...missing);
  const repository = fs.realpathSync(root);
  invariant(!inside(repository, actual) && !inside(actual, repository), 'Workspace must be separate from the repository');
  if (init) {
    fs.mkdirSync(actual, { recursive: true, mode: 0o700 });
    for (const name of ['targets', 'variants', 'exports', 'submissions', 'feedback', 'decisions']) fs.mkdirSync(path.join(actual, name), { recursive: true, mode: 0o700 });
    if (!fs.existsSync(path.join(actual, 'workspace.json'))) writeNew(path.join(actual, 'workspace.json'), { schemaVersion: 1, createdAt: now() });
  }
  invariant(read(path.join(actual, 'workspace.json')).schemaVersion === 1, 'Unsupported workspace');
  for (const name of ['targets', 'variants', 'exports', 'submissions', 'feedback', 'decisions']) {
    invariant(!fs.lstatSync(path.join(actual, name)).isSymbolicLink(), 'Workspace directories must not be symlinks');
  }
  return actual;
}
function file(w, kind, key) {
  const p = path.join(w, kind, id(key) + '.json');
  if (fs.existsSync(p)) invariant(!fs.lstatSync(p).isSymbolicLink(), 'Records must not be symlinks');
  return p;
}
function target(w, key, input) {
  id(key);
  for (const field of ['company', 'role', 'location', 'sourceUrl', 'jd']) invariant(typeof input[field] === 'string' && input[field].trim(), 'Target requires ' + field);
  invariant(/^https?:\/\//.test(input.sourceUrl), 'Target sourceUrl must be HTTP(S)');
  const requirements = input.requirements || [];
  invariant(Array.isArray(requirements), 'requirements must be an array');
  for (const r of requirements) {
    id(r.id);
    invariant(typeof r.text === 'string' && r.text.trim() && typeof r.hard === 'boolean', 'Requirement needs text and hard boolean');
  }
  invariant(new Set(requirements.map(r => r.id)).size === requirements.length, 'Duplicate requirement IDs');
  const value = { schemaVersion: 1, requirements, id: key, ...Object.fromEntries(['company', 'role', 'location', 'sourceUrl', 'jd'].map(k => [k, input[k]])), capturedAt: now() };
  writeNew(file(w, 'targets', key), value);
  return value;
}
function variant(w, key, targetId, locale = 'zh') {
  const t = read(file(w, 'targets', targetId));
  const c = catalog(locale);
  const v = { schemaVersion: 1, id: id(key), targetId, targetHash: digest(t), locale, baseHash: c.hash, projectIds: projects(c.data).map(p => p.id), requirementMapping: t.requirements.map(r => ({ requirementId: r.id, status: 'unknown', evidenceIds: [], note: '尚未核实；未知不代表不具备' })), overrides: {}, reason: '初始全量选材；请根据 JD 调整后 review', review: null };
  writeNew(file(w, 'variants', key), v);
  return v;
}
function validateTargetMapping(v, t) {
  validateVariant(v);
  for (const m of v.requirementMapping) invariant(t.requirements.some(r => r.id === m.requirementId), 'Mapping references unknown JD requirement');
  invariant(v.requirementMapping.length === t.requirements.length, 'Map every JD requirement, including unknowns');
}
function current(w, key, reviewed = false) {
  const v = read(file(w, 'variants', key));
  invariant(v.id === key, 'Variant ID differs from filename');
  const t = read(file(w, 'targets', v.targetId));
  invariant(v.targetHash === digest(t), 'JD changed: inspect, refresh and review');
  validateTargetMapping(v, t);
  const data = resolve(v, { reviewed });
  return { v, t, data };
}
function review(w, key, reviewer) {
  invariant(typeof reviewer === 'string' && reviewer.trim(), 'Reviewer is required');
  const { v } = current(w, key);
  v.review = { reviewer, reviewedAt: now(), digest: variantDigest(v) };
  replace(file(w, 'variants', key), v);
  return v;
}
function refresh(w, key, reason) {
  invariant(typeof reason === 'string' && reason.trim(), 'Explain the source changes you inspected');
  const v = read(file(w, 'variants', key));
  const c = validateVariant(v);
  const t = read(file(w, 'targets', v.targetId));
  v.refreshHistory = [...(v.refreshHistory || []), { at: now(), previousBaseHash: v.baseHash, previousTargetHash: v.targetHash, reason }];
  v.baseHash = c.hash; v.targetHash = digest(t); v.review = null;
  replace(file(w, 'variants', key), v);
  return v;
}
function filesIn(dir, prefix = '') {
  return fs.readdirSync(dir).sort().flatMap(name => {
    const relative = prefix + name;
    const p = path.join(dir, name);
    const stat = fs.lstatSync(p);
    invariant(!stat.isSymbolicLink(), 'Symlinks are not exportable: ' + relative);
    invariant(stat.isFile() || stat.isDirectory(), 'Unsupported file type');
    return stat.isDirectory() ? filesIn(p, relative + '/') : [relative];
  });
}
function hashes(dir) { return Object.fromEntries(filesIn(dir).filter(n => n !== 'manifest.json').map(n => [n, hash(fs.readFileSync(path.join(dir, n)))])); }
function verify(dir) {
  invariant(!fs.lstatSync(dir).isSymbolicLink(), 'Export must not be a symlink');
  const manifest = read(path.join(dir, 'manifest.json'));
  invariant(digest(hashes(dir)) === digest(manifest.files), 'Artifact hash mismatch or unexpected files');
  return manifest;
}
async function build(w, key, pdf = false) {
  const { v, t, data } = current(w, key, true);
  const exportId = uid('export');
  const final = path.join(w, 'exports', exportId);
  const staging = fs.mkdtempSync(path.join(w, 'exports', '.building-'));
  try {
    // Only regenerate public assets from the default catalog. Private data never goes through dist.
    execFileSync(process.execPath, [require.resolve('gulp/bin/gulp.js'), 'build'], { cwd: root, env: { ...process.env, NODE_ENV: 'production' }, stdio: 'pipe' });
    fs.cpSync(path.join(root, 'dist/assets'), path.join(staging, 'assets'), { recursive: true });
    fs.cpSync(path.join(root, 'dist/fonts'), path.join(staging, 'fonts'), { recursive: true });
    data.asset_version = hash(fs.readFileSync(path.join(staging, 'assets/styles.css'))).slice(0, 12);
    const env = nunjucks.configure(path.join(root, 'template'), { autoescape: true });
    const suffix = v.locale === 'en' ? '-en' : '';
    data.print_page = 'print' + suffix + '.html';
    for (const page of ['index', 'print']) fs.writeFileSync(path.join(staging, page + suffix + '.html'), env.render(page + suffix + '.html', data));
    writeNew(path.join(staging, 'resolved.json'), data);
    writeNew(path.join(staging, 'variant.json'), v);
    writeNew(path.join(staging, 'target.json'), t);
    if (pdf) {
      const { chromium } = require('playwright');
      const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
      try {
        const page = await browser.newPage();
        await page.route(/^https?:/, r => r.abort());
        await page.goto(pathToFileURL(path.join(staging, 'print' + suffix + '.html')).href);
        await page.evaluate(() => document.fonts.ready);
        await page.pdf({ path: path.join(staging, 'resume.pdf'), preferCSSPageSize: true, printBackground: true });
      } finally { await browser.close(); }
    }
    const latest = current(w, key, true);
    invariant(variantDigest(latest.v) === variantDigest(v), 'Variant changed during export; retry');
    const sourcesDir = path.join(staging, 'sources');
    fs.mkdirSync(sourcesDir);
    for (const name of ['data.yaml', 'data-en.yaml', 'data-sources.json', 'package.json', 'package-lock.json']) {
      if (fs.existsSync(path.join(root, name))) fs.copyFileSync(path.join(root, name), path.join(sourcesDir, name));
    }
    fs.cpSync(path.join(root, 'template'), path.join(sourcesDir, 'template'), { recursive: true });
    const gitDirty = !!execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
    const gitCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const manifest = { schemaVersion: 1, id: exportId, variantId: key, targetId: v.targetId, createdAt: now(), gitCommit, gitDirty, nodeVersion: process.version, playwrightVersion: require('playwright/package.json').version,
      templateHash: digest(filesIn(path.join(root, 'template')).map(n => [n, hash(fs.readFileSync(path.join(root, 'template', n)))])),
      files: hashes(staging) };
    writeNew(path.join(staging, 'manifest.json'), manifest);
    fs.renameSync(staging, final);
    return { exportId, directory: final, hasPdf: pdf };
  } catch (error) { fs.rmSync(staging, { recursive: true, force: true }); throw error; }
}
function snapshot(w, exportId, channel, submittedAt) {
  id(exportId);
  invariant(channel && channel.trim(), 'Submission channel required');
  invariant(typeof submittedAt === 'string' && /^\d{4}-\d\d-\d\dT/.test(submittedAt) && !Number.isNaN(Date.parse(submittedAt)), 'Record actual submittedAt as an ISO timestamp; generating a PDF is not applying');
  const source = path.join(w, 'exports', exportId);
  const m = verify(source);
  invariant(m.files['resume.pdf'], 'Generate a PDF with build --pdf before recording a submission');
  const key = uid('submission');
  const staging = fs.mkdtempSync(path.join(w, 'submissions', '.freezing-'));
  try {
    fs.cpSync(source, path.join(staging, 'artifact'), { recursive: true });
    verify(path.join(staging, 'artifact'));
    writeNew(path.join(staging, 'submission.json'), { schemaVersion: 1, id: key, exportId, variantId: m.variantId, targetId: m.targetId, channel, submittedAt, recordedAt: now() });
    writeNew(path.join(staging, 'manifest.json'), { schemaVersion: 1, files: hashes(staging) });
    fs.renameSync(staging, path.join(w, 'submissions', key));
    return { submissionId: key };
  } catch (error) { fs.rmSync(staging, { recursive: true, force: true }); throw error; }
}
function feedback(w, submissionId, input) {
  id(submissionId);
  const dir = path.join(w, 'submissions', submissionId);
  verify(dir);
  const submission = read(path.join(dir, 'submission.json'));
  for (const k of ['round', 'observation', 'category']) invariant(typeof input[k] === 'string' && input[k].trim(), 'Feedback requires ' + k);
  invariant(['expression', 'evidence', 'skill', 'job-fit', 'unknown'].includes(input.category), 'Unknown feedback category');
  invariant(['low', 'medium', 'high'].includes(input.confidence), 'Set confidence low/medium/high');
  // Proposed changes are variant-scoped; applying to the shared facts requires a separate code review.
  let proposal = null;
  if (input.proposal) {
    const original = read(file(w, 'variants', submission.variantId));
    invariant(input.proposal.reason && input.proposal.patch, 'Proposal requires reason and patch');
    const patch = input.proposal.patch;
    invariant(Object.keys(patch).every(k => ['projectIds', 'overrides', 'reason', 'requirementMapping'].includes(k)), 'Proposal may only change selection, overrides or reason');
    validateTargetMapping({ ...original, ...patch }, read(file(w, 'targets', original.targetId)));
    proposal = { ...input.proposal, variantId: original.id, expectedDigest: variantDigest(original) };
  }
  const key = uid('feedback');
  const value = { schemaVersion: 1, id: key, submissionId, variantId: submission.variantId, createdAt: now(), round: input.round,
    quote: input.quote || '', observation: input.observation, inference: input.inference || '', category: input.category, confidence: input.confidence, proposal };
  writeNew(file(w, 'feedback', key), value);
  return value;
}
function decide(w, feedbackId, decision, reviewer, reason) {
  invariant(['accept', 'reject'].includes(decision), 'Decision must be accept or reject');
  invariant(reviewer && reason, 'Reviewer and reason required');
  const entry = read(file(w, 'feedback', feedbackId));
  invariant(entry.proposal, 'Feedback has no proposal');
  const decisionFile = file(w, 'decisions', feedbackId);
  invariant(!fs.existsSync(decisionFile), 'Feedback already decided');
  // Rejection records a decision only; stale source/JD/variant state cannot block it.
  if (decision === 'reject') {
    writeNew(decisionFile, { feedbackId, decision, reviewer, reason, at: now() });
    return { feedbackId, decision, requiresReview: false };
  }
  const { v, t } = current(w, entry.variantId);
  invariant(variantDigest(v) === entry.proposal.expectedDigest, 'Conflict: variant changed after proposal; create a new proposal');
  const next = { ...v, ...entry.proposal.patch, review: null, feedbackHistory: [...(v.feedbackHistory || []), feedbackId] };
  validateTargetMapping(next, t);
  // Decision is the durable intent. If interrupted, explicit retry via recoverDecision is safe.
  writeNew(decisionFile, { feedbackId, decision, reviewer, reason, at: now(), beforeDigest: variantDigest(v), after: next });
  if (decision === 'accept') replace(file(w, 'variants', v.id), next);
  return { feedbackId, decision, requiresReview: decision === 'accept' };
}
function recoverDecision(w, feedbackId) {
  const d = read(file(w, 'decisions', feedbackId));
  invariant(d.decision === 'accept', 'Only accepted decisions have pending changes');
  const v = read(file(w, 'variants', d.after.id));
  if (variantDigest(v) === variantDigest(d.after)) return { recovered: true };
  invariant(variantDigest(v) === d.beforeDigest, 'Conflict: refusing to overwrite newer edits');
  replace(file(w, 'variants', v.id), d.after);
  return { recovered: true };
}
module.exports = { workspace, file, read, writeNew, target, variant, current, review, refresh, build, snapshot, feedback, decide, recoverDecision, verify, hashes, filesIn };
