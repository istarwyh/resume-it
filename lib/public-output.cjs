const fs = require('node:fs');
const path = require('node:path');
const { root, invariant } = require('./resume.cjs');
const { filesIn, hashes, verify, writeNew } = require('./workspace.cjs');
const directory = path.join(root, 'dist');
function allowed(name) {
  return ['index.html', 'index-en.html', 'print.html', 'print-en.html', 'assets/styles.css', 'assets/scripts.js'].includes(name)
    || /^fonts\/fontawesome-webfont\.(eot|svg|ttf|woff|woff2)$/.test(name)
    || (/^assets\/images\/[a-zA-Z0-9._/-]+\.(png|jpg|jpeg|webp|gif|svg|ico)$/.test(name) && fs.existsSync(path.join(root, 'src', name)) && fs.lstatSync(path.join(root, 'src', name)).isFile());
}
function seal() {
  const names = filesIn(directory);
  invariant(names.every(allowed), 'Unexpected file in public output');
  writeNew(path.join(directory, 'manifest.json'), { schemaVersion: 1, audience: 'public-default-only', files: hashes(directory) });
}
function validate() {
  const m = verify(directory);
  invariant(m.audience === 'public-default-only', 'Not a public default build');
  invariant(Object.keys(m.files).every(allowed), 'Unexpected public artifact');
  for (const page of ['index.html', 'print.html', 'index-en.html', 'print-en.html']) invariant(m.files[page], 'Missing public page: ' + page);
  return m;
}
module.exports = { seal, validate };
