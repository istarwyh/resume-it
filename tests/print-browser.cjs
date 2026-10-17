const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = path.resolve('test-results');
fs.mkdirSync(out, { recursive: true });
const compact = value => value.normalize('NFKC').replace(/\s+/g, '');
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox']
  });
  try {
    for (const name of ['index.html', 'index-en.html', 'print.html', 'print-en.html']) {
      const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
      // External portraits/analytics are not prerequisites for rendering a resume.
      await page.route(/^https?:/, route => route.abort());
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.resolve('dist', name)).href);
      const projectCount = await page.locator('.project-item').count();
      assert.ok(projectCount >= 2);
      assert.equal(await page.locator('.project-item h4').filter({ hasText: 'WritingHelper' }).count(), 1);
      if (name.startsWith('print')) {
        await page.emulateMedia({ media: 'print' });
        const style = await page.locator('.exp p').first().evaluate(el => ({
          size: parseFloat(getComputedStyle(el).fontSize),
          overflow: getComputedStyle(document.body).overflow,
          content: document.querySelector('.container').getBoundingClientRect().width,
          paper: 184 * 96 / 25.4
        }));
        assert.ok(style.size >= 14, 'Body font must remain at least 10.5pt');
        assert.notEqual(style.overflow, 'hidden');
        // Apply the printable width to detect long-link overflow before PDF export.
        await page.setViewportSize({ width: Math.round(style.paper), height: 1032 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        const pdf = path.join(out, name.replace('.html', '.pdf'));
        await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
        const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
        const pdfText = execFileSync('pdftotext', [pdf, '-'], { encoding: 'utf8' });
        const headings = await page.locator('.project-item h4').allTextContents();
        // Check full leaf headings, not mentions in awards or the profile summary.
        for (const heading of headings) assert.ok(compact(pdfText).includes(compact(heading)), heading.trim());
        const pdfPages = pdfText.split('\f').map(compact);
        for (const item of await page.locator('.project-item').allTextContents()) {
          assert.ok(pdfPages.some(content => content.includes(compact(item))), 'A short project was split across pages');
        }
        assert.ok(pdfText.includes('BigTable'), 'The final skill must not be clipped');
        const count = Number(info.match(/Pages:\s*(\d+)/)[1]);
        assert.ok(count >= 2, 'Full resume should paginate rather than shrink');
        await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
        console.log(name + ': ' + count + ' A4 pages; all ' + projectCount + ' projects and final skill retained; 10.5pt body');
        // A long future project must remain printable beyond the original page count.
        if (name === 'print.html') {
          await page.locator('.main').evaluate(el => {
            for (let i = 0; i < 70; i++) {
              const p = document.createElement('p');
              p.textContent = 'Long content regression fixture ' + i + ': retain all text and allow another page.';
              el.appendChild(p);
            }
            const tail = document.createElement('p');
            tail.textContent = 'PRINT_REGRESSION_END';
            el.appendChild(tail);
          });
          const longPdf = path.join(out, 'print-long.pdf');
          await page.pdf({ path: longPdf, preferCSSPageSize: true });
          assert.ok(execFileSync('pdftotext', [longPdf, '-'], { encoding: 'utf8' }).includes('PRINT_REGRESSION_END'));
          const longInfo = execFileSync('pdfinfo', [longPdf], { encoding: 'utf8' });
          assert.ok(Number(longInfo.match(/Pages:\s*(\d+)/)[1]) > count);
        }
      } else {
        await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
      }
      assert.deepEqual(errors, [], 'Unexpected page JavaScript errors');
      await page.close();
    }
    const auto = await browser.newPage();
    await auto.route(/^https?:/, route => route.abort());
    await auto.addInitScript(() => { window.print = () => { window.__printCalled = true; }; });
    await auto.goto(pathToFileURL(path.resolve('dist/print.html')).href + '?autoprint=1');
    await auto.waitForFunction(() => window.__printCalled === true);
    await auto.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
