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

// Fluxos do GitHub: nada de código de PR com permissão do repositório, cache ou action sem versão fixa.
const wf = (f) => fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', f), 'utf8');
const verificar = wf('verificar.yml'), guarda = wf('guarda.yml');
for (const [name, text] of [['verificar', verificar], ['guarda', guarda]]) {
  for (const [, ref] of text.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)/gm)) assert.match(ref, /@[0-9a-f]{40}$/, `${name}: action sem SHA fixo: ${ref}`);
  assert.doesNotMatch(text, /actions\/cache|^\s*cache:/m, `${name}: não pode usar cache`);
  assert.doesNotMatch(text, /secrets\./, `${name}: não pode usar segredos`);
  assert.doesNotMatch(text, /^\s*run:.*\$\{\{/m, `${name}: dados do evento só por variável de ambiente`);
}
assert.match(verificar, /^on:\s*\n\s+pull_request:\s*$/m, 'verificar roda só em pull_request');
assert.match(verificar, /^permissions:\s*\n\s+contents: read\s*$/m, 'verificar só lê');
assert.match(verificar, /persist-credentials: false/, 'checkout sem guardar credenciais');
assert.match(verificar, /package-manager-cache: false/, 'setup-node sem cache');
assert.match(guarda, /^\s+pull_request_target:/m, 'guarda usa a versão do branch padrão');
assert.match(guarda, /^permissions: \{\}/m, 'guarda começa sem permissões');
assert.doesNotMatch(guarda, /actions\/checkout|\buses:/, 'guarda não baixa o código do PR');
const ruleset = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.github', 'ruleset-main.json'), 'utf8'));
assert.deepStrictEqual(ruleset.bypass_actors, [], 'ruleset sem exceções');
const required = ruleset.rules.find((r) => r.type === 'required_status_checks').parameters.required_status_checks.map((c) => c.context);
assert.deepStrictEqual(required.sort(), ['guarda', 'verificar'], 'ruleset exige os dois checks');

console.log('✓ fluxos do GitHub');
