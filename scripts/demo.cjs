// Explicit demo command: writes only synthetic job/feedback examples to a separate workspace.
const fs = require('node:fs');
const path = require('node:path');
const api = require('../lib/workspace.cjs');
const { root } = require('../lib/resume.cjs');
const w = api.workspace(process.env.RESUME_WORKSPACE, true);
api.target(w, 'demo-agent', api.read(path.join(root, 'examples/target.json')));
api.target(w, 'demo-backend', { ...api.read(path.join(root, 'examples/target.json')), role: 'Backend Engineer (synthetic)' });
for (const [key, target, locale, selected] of [
  ['demo-agent-zh', 'demo-agent', 'zh', ['dabao', 'insurance-quick-check', 'mcp-toolchain', 'mcpadvisor']],
  ['demo-backend-en', 'demo-backend', 'en', ['finance-data', 'mcp-toolchain', 'rag-knowledge', 'writinghelper']]
]) {
  const v = api.variant(w, key, target, locale);
  v.projectIds = selected;
  v.reason = 'Synthetic demo only: review before using for a real role';
  fs.writeFileSync(api.file(w, 'variants', key), JSON.stringify(v, null, 2) + '\n');
}
console.log('Created two unreviewed demo variants. Inspect and review before building; no application or feedback was fabricated.');
