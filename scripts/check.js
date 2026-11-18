'use strict';
// Tudo o que precisa passar antes de abrir um PR: lint, testes e build. Para na primeira falha.
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const steps = ['lint', 'test', 'build'];

for (const step of steps) {
  console.log(`\n=== ${step} ===`);
  const started = Date.now();
  const r = spawnSync(`npm run --silent ${step}`, { cwd: ROOT, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`\nFALHOU: ${step}`);
    process.exit(1);
  }
  console.log(`(${step}: ${Math.round((Date.now() - started) / 1000)} s)`);
}
console.log('\nTudo certo: lint, testes e build.');
