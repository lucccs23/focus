'use strict';
// Guarda, dentro de .git (fora do que vai para o repositório), o resultado do último `npm run check`.
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_ROUNDS = 3;
const ROOT = path.join(__dirname, '..');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const stateFile = () => path.resolve(ROOT, git('rev-parse', '--git-path', 'focus-verify.json').trim());

function read() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return {}; }
}
function write(state) { fs.writeFileSync(stateFile(), JSON.stringify(state, null, 2)); }

// Identifica exatamente o código atual: commit + alterações + arquivos novos.
function snapshot() {
  const head = git('rev-parse', 'HEAD').trim();
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD').trim();
  const status = git('status', '--porcelain');
  const hash = crypto.createHash('sha256').update(head).update(status).update(git('diff', 'HEAD', '--binary'));
  for (const f of git('ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean)) {
    hash.update(f).update(fs.readFileSync(path.join(ROOT, f)));
  }
  return { head, branch, clean: !status.trim(), code: hash.digest('hex') };
}

module.exports = { MAX_ROUNDS, read, write, snapshot };
