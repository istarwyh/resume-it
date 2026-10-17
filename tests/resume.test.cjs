const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const matter = require('gray-matter');
const yaml = require('js-yaml');
const MarkdownIt = require('markdown-it');
const nunjucks = require('nunjucks');
const md = new MarkdownIt({ html: true, breaks: true, typographer: true });
md.use(require('markdown-it-attrs'));
const schema = yaml.Schema.create([new yaml.Type('tag:yaml.org,2002:md', {
  kind: 'scalar', construct: value => md.render(value)
})]);
const env = nunjucks.configure('template', { autoescape: true });
const pages = ['index.html', 'print.html', 'index-en.html', 'print-en.html'];
function load(page) {
  return matter(fs.readFileSync(page.includes('-en') ? 'data-en.yaml' : 'data.yaml', 'utf8'), { schema }).data;
}
function projects(data) {
  return data.experience.flatMap(section => section.project || section.expert.flatMap(employer => employer.project));
}
function text(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}
for (const page of pages) {
  test(page + ': all projects appear in built output', () => {
    const html = fs.readFileSync(path.join('dist', page), 'utf8');
    const headings = [...html.matchAll(/<h4\b[^>]*>([\s\S]*?)<\/h4>/g)].map(match => text(match[1]));
    for (const project of projects(load(page))) {
      assert.ok(headings.some(heading => heading.startsWith(project.name)), project.name + ' is missing');
    }
    assert.ok(html.includes('MCPAdvisor') && html.includes('WritingHelper'));
    assert.ok(!html.includes('One-Page A4') && !html.includes('一页 A4'));
    assert.match(html, page.includes('-en') ? /<html lang="en">/ : /<html lang="zh-CN">/);
    if (page.includes('-en')) assert.ok(!/>\s*说明\s*<|>\s*源码\s*</.test(html));
  });
  test(page + ': section labels do not control project rendering', () => {
    const data = load(page);
    data.experience.forEach((section, i) => { section.section = 'Renamed section ' + i; });
    const html = env.render(page, data);
    const headings = [...html.matchAll(/<h4\b[^>]*>([\s\S]*?)<\/h4>/g)].map(match => text(match[1]));
    for (const project of projects(data)) assert.ok(headings.some(heading => heading.startsWith(project.name)));
  });
  test(page + ': profile links work for bare and absolute URLs', () => {
    for (const prefix of ['', 'https://']) {
      const data = load(page);
      data.github = prefix + 'github.com/example';
      data.online = prefix + 'example.github.io/resume';
      data.blog.url = prefix + 'example.com';
      const html = env.render(page, data);
      for (const href of ['https://github.com/example', 'https://example.github.io/resume', 'https://example.com']) {
        assert.ok(html.includes('href="' + href + '"'), href);
      }
      assert.ok(!html.includes('https://https://'));
    }
  });
}
test('print does not restore whole-page zoom or fixed-height clipping', () => {
  const script = fs.readFileSync('src/scripts/index.js', 'utf8');
  const styles = fs.readFileSync('src/styles/stylus/print.styl', 'utf8');
  assert.doesNotMatch(script + styles, /fit-a4|--a4-scale|fitPrintResumeToA4/);
  assert.doesNotMatch(styles, /overflow\s*:\s*hidden|height\s*:\s*297mm/);
  assert.match(styles, /font-size:\s*10\.5pt/);
  assert.match(styles, /break-after:\s*avoid/);
});
