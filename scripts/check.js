'use strict';
// Tudo o que precisa passar antes de abrir um PR: lint, testes, ponta a ponta e build. Para na primeira falha.
// Fora do CI, conta as rodadas de conserto: o mesmo código não é testado de novo e, depois de 3 rodadas
// sem sucesso, para e pede uma pessoa. Só uma pessoa libera, com: node scripts/check.js --reset
const { spawnSync } = require('child_process');
const path = require('path');
const { MAX_ROUNDS, read, write, snapshot } = require('./verify-state');

const ROOT = path.join(__dirname, '..');
const steps = ['lint', 'test', 'verify', 'build'];
const tracking = !process.env.CI;
const before = snapshot();
const state = read();
state.failures ||= {};
const failed = state.failures[before.branch] || [];

if (process.argv.includes('--reset')) {
  delete state.failures[before.branch];
  write(state);
  console.log(`Rodadas de conserto zeradas em ${before.branch}.`);
  process.exit(0);
}
if (tracking && failed.length >= MAX_ROUNDS) {
  console.error(`PARE: ${MAX_ROUNDS} rodadas de conserto sem sucesso em ${before.branch}. Chame o Lucas com o que foi tentado.`);
  process.exit(3);
}
if (tracking && failed.includes(before.code)) {
  console.error('Este mesmo código já falhou. Não repita a verificação: ache a causa e mude o código.');
  process.exit(3);
}

function fail(step) {
  console.error(`\nFALHOU: ${step}`);
  if (tracking) {
    state.failures[before.branch] = [...failed, before.code];
    write(state);
    const n = state.failures[before.branch].length;
    console.error(n >= MAX_ROUNDS ? `PARE: esta foi a rodada ${n} de ${MAX_ROUNDS}. Chame o Lucas.` : `Rodada de conserto ${n} de ${MAX_ROUNDS}.`);
  }
  process.exit(1);
}

for (const step of steps) {
  console.log(`\n=== ${step} ===`);
  const started = Date.now();
  const r = spawnSync(`npm run --silent ${step}`, { cwd: ROOT, stdio: 'inherit', shell: true });
  if (r.status !== 0) fail(step);
  console.log(`(${step}: ${Math.round((Date.now() - started) / 1000)} s)`);
}

const after = snapshot();
if (after.code !== before.code) {
  console.error('\nO código mudou durante a verificação. Rode de novo.');
  process.exit(1);
}
if (tracking) {
  delete state.failures[before.branch];
  state.passed = after.clean ? after.head : null;
  write(state);
}
console.log(`\nTudo certo: lint, testes, ponta a ponta e build.${after.clean ? '' : ' (Há alterações sem commit: faça o commit e rode de novo antes do PR.)'}`);
