const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const api = require('../lib/workspace.cjs');
const { projects } = require('../lib/resume.cjs');
const { chromium } = require('playwright');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-pdf-test-'));
const w = api.workspace(path.join(temp, 'workspace'), true);
const compact = value => value.normalize('NFKC').replace(/\s+/g, '');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  try {
    api.target(w, 'synthetic', require('../examples/target.json'));
    for (const locale of ['zh', 'en']) {
      const key = 'agent-' + locale;
      const v = api.variant(w, key, 'synthetic', locale);
      v.projectIds = ['dabao', 'mcp-toolchain', 'mcpadvisor'];
      v.reason = 'Synthetic PDF regression';
      fs.writeFileSync(api.file(w, 'variants', key), JSON.stringify(v));
      api.review(w, key, 'Synthetic reviewer');
      const exportResult = await api.build(w, key, true);
      const pdf = path.join(exportResult.directory, 'resume.pdf');
      const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
      const data = api.current(w, key, true).data;
      for (const p of projects(data)) assert.ok(compact(text).includes(compact(p.name)), p.name);
      assert.ok(!text.includes('WritingHelper'), 'Excluded project must not leak into PDF');
      const { submissionId } = api.snapshot(w, exportResult.exportId, 'Synthetic test (not sent)', '2026-10-26T10:00:00Z');
      const snapshotDir = path.join(w, 'submissions', submissionId);
      const original = api.verify(snapshotDir);
      const page = await browser.newPage();
      const outbound = [];
      page.on('request', r => { if (/^https?:/.test(r.url())) outbound.push(r.url()); });
      await page.goto(pathToFileURL(path.join(exportResult.directory, locale === 'en' ? 'index-en.html' : 'index.html')).href);
      assert.equal(await page.locator('.project-item').count(), 3);
      assert.equal(await page.locator('footer a').count(), 1, 'Only the same-language PDF link');
      assert.deepEqual(outbound, [], 'Private preview must not fetch external resources');
      const output = path.resolve('test-results/workspace-' + locale);
      fs.mkdirSync(output, { recursive: true });
      fs.copyFileSync(pdf, path.join(output, 'resume.pdf'));
      await page.screenshot({ path: path.join(output, 'preview.png'), fullPage: true });
      await page.close();
      const feedback = api.feedback(w, submissionId, require('../examples/feedback.json'));
      api.decide(w, feedback.id, 'accept', 'Test reviewer', 'Synthetic expression improvement');
      assert.throws(() => api.current(w, key, true), /unreviewed/);
      assert.deepEqual(api.verify(snapshotDir), original);
      console.log(locale + ': actual PDF, isolated preview, frozen submission and reviewed feedback workflow passed');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => fs.rmSync(temp, { recursive: true, force: true }));
