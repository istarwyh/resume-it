#!/usr/bin/env node
const { parseArgs } = require('node:util');
const fs = require('node:fs');
const api = require('../lib/workspace.cjs');
const { projects, catalog, digest, variantDigest } = require('../lib/resume.cjs');
const help = `Resume workspace (private records must be outside this repository)

Set RESUME_WORKSPACE=/absolute/private/directory, then:
  npm run resume -- init
  npm run resume -- catalog [--locale zh|en]
  npm run resume -- target TARGET --input target.json
  npm run resume -- variant VARIANT --target TARGET [--locale zh|en]
  # Edit variants/VARIANT.json: projectIds, reason, overrides.
  npm run resume -- inspect VARIANT
  npm run resume -- refresh VARIANT --reason "source changes inspected"
  npm run resume -- review VARIANT --reviewer "name"
  npm run resume -- build VARIANT [--pdf]
  npm run resume -- snapshot EXPORT --channel "email" --at "2026-10-26T10:00:00+08:00"
  npm run resume -- feedback SUBMISSION --input feedback.json
  npm run resume -- decide FEEDBACK --decision accept|reject --reviewer "name" --reason "why"
  npm run resume -- recover-decision FEEDBACK
  npm run resume -- verify SUBMISSION

Examples and privacy/migration instructions: docs/resume-workspace.md
Build creates an export; snapshot records a submission that YOU already made.
No command sends a resume or publishes a private variant.`;
(async () => {
  const { values: o, positionals: [command, key] } = parseArgs({ allowPositionals: true, options: {
    input: { type: 'string' }, target: { type: 'string' }, locale: { type: 'string', default: 'zh' },
    reviewer: { type: 'string' }, reason: { type: 'string' }, channel: { type: 'string' }, at: { type: 'string' },
    decision: { type: 'string' }, pdf: { type: 'boolean' }, help: { type: 'boolean' }
  } });
  if (!command || command === 'help' || o.help) return console.log(help);
  if (command === 'catalog') {
    const c = catalog(o.locale);
    return console.log(JSON.stringify(projects(c.data).map(p => ({ id: p.id, name: p.name, date: p.date, source: p.website || p.source_code || null, provenance: c.provenance.projects[p.id], evidenceStatus: 'curated-resume-claim; blog provenance is not independent verification' })), null, 2));
  }
  const w = api.workspace(process.env.RESUME_WORKSPACE, command === 'init');
  const input = () => { if (!o.input) throw new Error('--input JSON file required'); return JSON.parse(fs.readFileSync(o.input, 'utf8')); };
  let result;
  switch (command) {
    case 'init': result = { directory: w }; break;
    case 'target': result = api.target(w, key, input()); break;
    case 'variant': result = api.variant(w, key, o.target, o.locale); break;
    case 'inspect': {
      const v = api.read(api.file(w, 'variants', key));
      const c = catalog(v.locale);
      const target = api.read(api.file(w, 'targets', v.targetId));
      const all = projects(c.data);
      const changes = Object.entries(v.overrides).map(([field, change]) => ({ field, before: field.startsWith('project:') ? all.find(p => p.id === field.slice(8))?.des : c.data[field], after: change.text, reason: change.reason, evidenceIds: change.evidenceIds }));
      result = { variant: v, targetChanged: digest(target) !== v.targetHash, reviewed: v.review?.digest === variantDigest(v), changes, currentBaseHash: c.hash, sourceChanged: c.hash !== v.baseHash, projects: projects(c.data).map(p => ({ id: p.id, name: p.name, selected: v.projectIds.includes(p.id), provenance: c.provenance.projects[p.id] })) };
      break;
    }
    case 'review': result = api.review(w, key, o.reviewer); break;
    case 'refresh': result = api.refresh(w, key, o.reason); break;
    case 'build': result = await api.build(w, key, o.pdf); break;
    case 'snapshot': result = api.snapshot(w, key, o.channel, o.at); break;
    case 'feedback': result = api.feedback(w, key, input()); break;
    case 'decide': result = api.decide(w, key, o.decision, o.reviewer, o.reason); break;
    case 'recover-decision': result = api.recoverDecision(w, key); break;
    case 'verify': {
      const { id } = require('../lib/resume.cjs');
      result = api.verify(require('node:path').join(w, 'submissions', id(key))); break;
    }
    default: throw new Error('Unknown command.\n' + help);
  }
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
