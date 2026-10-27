const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const matter = require('gray-matter');
const yaml = require('js-yaml');
const MarkdownIt = require('markdown-it');
const root = path.resolve(__dirname, '..');
const md = new MarkdownIt({ html: true, breaks: true, typographer: true });
md.use(require('markdown-it-attrs'));
const schema = yaml.Schema.create([new yaml.Type('tag:yaml.org,2002:md', {
  kind: 'scalar', construct: text => md.render(text)
})]);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const digest = value => hash(JSON.stringify(value));
const clone = value => JSON.parse(JSON.stringify(value));
function invariant(ok, message) { if (!ok) throw new Error(message); }
function id(value) {
  invariant(typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value), 'Invalid ID: use lowercase letters, digits and hyphens');
  return value;
}
function projects(data) {
  return data.experience.flatMap(s => s.project || s.expert.flatMap(e => e.project));
}
function sourceCatalog(projectIds) {
  const value = JSON.parse(fs.readFileSync(path.join(root, 'data-sources.json'), 'utf8'));
  invariant(value.schemaVersion === 1 && value.primarySource === 'https://xiaohui.cool', 'Invalid source catalog');
  invariant(value.projects && Object.keys(value.projects).sort().join(',') === [...projectIds].sort().join(','), 'Source catalog must cover exactly the known project IDs');
  for (const entry of Object.values(value.projects)) {
    invariant(['partial', 'unmapped'].includes(entry.status), 'Source evidence is partial or unmapped, not automatically verified');
    invariant(typeof entry.note === 'string' && entry.note.trim() && Array.isArray(entry.references), 'Source entry requires references and scope note');
    for (const ref of entry.references) {
      const url = new URL(ref.url);
      invariant(url.protocol === 'https:' && url.hostname === 'xiaohui.cool' && !url.username && !url.password, 'Primary references must be xiaohui.cool HTTPS URLs');
      invariant(typeof ref.path === 'string' && ref.path.startsWith('content/') && typeof ref.blobSha === 'string' && /^[a-f0-9]{40}$/.test(ref.blobSha), 'Source reference needs repository path and reviewed blob SHA');
    }
    invariant(entry.status === 'unmapped' ? entry.references.length === 0 : entry.references.length > 0, 'Source status must match references');
  }
  return value;
}
function catalog(locale = 'zh') {
  invariant(['zh', 'en'].includes(locale), 'Locale must be zh or en');
  const source = fs.readFileSync(path.join(root, locale === 'en' ? 'data-en.yaml' : 'data.yaml'), 'utf8');
  const data = matter(source, { schema }).data;
  const ids = projects(data).map(p => id(p.id));
  invariant(new Set(ids).size === ids.length, 'Duplicate project IDs');
  // Any locale change requires reviewing all variants, so translated claims cannot drift silently.
  const provenance = sourceCatalog(ids);
  const sources = ['data.yaml', 'data-en.yaml', 'data-sources.json'].map(name => fs.readFileSync(path.join(root, name), 'utf8'));
  return { data, hash: digest(sources), provenance };
}
function validateVariant(v) {
  invariant(v.schemaVersion === 1, 'Unsupported variant schema');
  id(v.id); id(v.targetId);
  const c = catalog(v.locale);
  const available = projects(c.data).map(p => p.id);
  invariant(Array.isArray(v.projectIds) && v.projectIds.length > 0, 'Select at least one project');
  invariant(new Set(v.projectIds).size === v.projectIds.length, 'Duplicate project selection');
  v.projectIds.forEach(p => invariant(available.includes(p), 'Unknown project: ' + p));
  invariant(typeof v.reason === 'string' && v.reason.trim(), 'Explain the tailoring reason');
  invariant(v.overrides && typeof v.overrides === 'object' && !Array.isArray(v.overrides), 'overrides must be an object');
  for (const [field, entry] of Object.entries(v.overrides)) {
    invariant(['description', 'apply_to_position'].includes(field) || /^project:[a-z0-9-]+$/.test(field), 'Unsupported override: ' + field);
    if (field.startsWith('project:')) invariant(v.projectIds.includes(field.slice(8)), 'Override must reference a selected project');
    invariant(entry && typeof entry.text === 'string' && entry.text.trim() && typeof entry.reason === 'string' && entry.reason.trim(), 'Override needs text and reason');
    invariant(Array.isArray(entry.evidenceIds) && entry.evidenceIds.length, 'Override needs evidence IDs');
    entry.evidenceIds.forEach(p => invariant(available.includes(p), 'Unknown evidence: ' + p));
  }
  invariant(Array.isArray(v.requirementMapping), 'requirementMapping must be an array');
  for (const item of v.requirementMapping) {
    id(item.requirementId);
    invariant(['supported', 'partial', 'unknown'].includes(item.status), 'Unknown evidence status');
    invariant(typeof item.note === 'string' && item.note.trim(), 'Explain evidence or uncertainty');
    invariant(Array.isArray(item.evidenceIds), 'Mapping needs evidence IDs');
    if (item.status === 'supported') invariant(item.evidenceIds.length, 'Supported requirement needs evidence');
    item.evidenceIds.forEach(p => invariant(available.includes(p), 'Unknown evidence: ' + p));
  }
  invariant(new Set(v.requirementMapping.map(m => m.requirementId)).size === v.requirementMapping.length, 'Duplicate requirement mapping');
  return c;
}
function variantDigest(v) { const copy = clone(v); delete copy.review; return digest(copy); }
function resolve(v, { reviewed = true } = {}) {
  const c = validateVariant(v);
  invariant(v.baseHash === c.hash, 'Stale base: inspect changes, then refresh and review');
  if (reviewed) invariant(v.review && v.review.digest === variantDigest(v) && v.review.reviewer, 'Variant changed or unreviewed: run review');
  const data = clone(c.data);
  const rank = p => v.projectIds.indexOf(p.id);
  const select = list => list.filter(p => v.projectIds.includes(p.id)).sort((a, b) => rank(a) - rank(b)).map(p => {
    const override = v.overrides['project:' + p.id];
    return override ? { ...p, des: md.render(override.text) } : p;
  });
  data.experience = data.experience.map(s => s.project ? { ...s, project: select(s.project) } : {
    ...s, expert: s.expert.map(e => ({ ...e, project: select(e.project) })).filter(e => e.project.length)
  }).filter(s => s.project ? s.project.length : s.expert.length);
  for (const field of ['description', 'apply_to_position']) {
    if (v.overrides[field]) data[field] = field === 'description' ? md.render(v.overrides[field].text) : v.overrides[field].text;
  }
  data.ga_id = null;
  data.private_preview = true;
  return data;
}
module.exports = { root, hash, digest, clone, invariant, id, projects, catalog, validateVariant, variantDigest, resolve };
