'use strict';
// Confere as travas do fluxo de trabalho (hook do Claude Code). Uso: npm run test:rules
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { decide } = require('../scripts/pr-gate');

const now = { head: 'abc', branch: 'feat', clean: true };
const ok = { passed: 'abc' };

assert.strictEqual(decide('gh pr create --base main', ok, now), null, 'commit verificado pode abrir PR');
assert.match(decide('gh pr create', {}, now), /npm run check/, 'commit sem verificação não abre PR');
assert.match(decide('gh pr create', { passed: 'velho' }, now), /npm run check/, 'verificação de outro commit não vale');
assert.match(decide('gh pr create', ok, { ...now, clean: false }), /sem commit/, 'alterações pendentes bloqueiam');
assert.match(decide('gh pr create', { ...ok, failures: { feat: ['a', 'b', 'c'] } }, now), /chame o Lucas/, '3 rodadas param o trabalho');
assert.match(decide('gh pr merge 3 --squash', ok, now), /merge/, 'merge é da pessoa');
assert.match(decide('git push origin main', ok, now), /main/, 'push direto no main');
assert.match(decide('git push origin HEAD:main', ok, now), /main/, 'push disfarçado no main');
assert.match(decide('git push --force origin feat', ok, now), /forçado/, 'push forçado');
assert.strictEqual(decide('git push -u origin verify/regras', ok, now), null, 'push do próprio branch');
assert.strictEqual(decide('npm test', ok, now), null, 'outros comandos passam');

const settings = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude', 'settings.json'), 'utf8'));
const hook = settings.hooks.PreToolUse.find((h) => h.matcher.includes('Bash') && h.matcher.includes('PowerShell'));
assert.ok(hook.hooks.some((h) => h.command.includes('scripts/pr-gate.js')), 'hook ligado nas configurações');

console.log('✓ travas do fluxo de trabalho');
