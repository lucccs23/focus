'use strict';
// Hook do Claude Code (antes de cada comando): barra o que as regras do projeto proíbem.
// Saída 2 bloqueia o comando e mostra a mensagem ao agente.
const { MAX_ROUNDS, read, snapshot } = require('./verify-state');

function decide(command, state, now) {
  const cmd = String(command || '');
  if (/\bgh\s+pr\s+merge\b/.test(cmd)) return 'Quem faz o merge é o Lucas. Deixe o PR pronto e avise.';
  if (/\bgit\b[^\n;&|]*\bpush\b[^\n;&|]*(?:\s|:|\/)(?:main|master)(?:\s|$)/.test(cmd)) return 'Não envie direto para o main: trabalhe por branch e PR.';
  if (/\bgit\b[^\n;&|]*\bpush\b[^\n;&|]*(?:--force\b|\s-f\b)/.test(cmd)) return 'Push forçado não é permitido.';
  if (!/\bgh\s+pr\s+create\b/.test(cmd)) return null;
  if ((state.failures?.[now.branch]?.length || 0) >= MAX_ROUNDS) return `${MAX_ROUNDS} rodadas de conserto sem sucesso: pare e chame o Lucas.`;
  if (!now.clean) return 'Há alterações sem commit. Faça o commit e rode `npm run check` antes de abrir o PR.';
  if (state.passed !== now.head) return 'Este commit ainda não passou. Rode `npm run check` antes de abrir o PR.';
  return null;
}

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { input += c; });
  process.stdin.on('end', () => {
    let command = '';
    try { command = JSON.parse(input).tool_input?.command; } catch { /* sem comando para avaliar */ }
    if (!command || !/\bgh\s+pr\s+(?:create|merge)\b|\bgit\b[^\n]*\bpush\b/.test(command)) return;
    const message = decide(command, read(), snapshot());
    if (message) {
      console.error(message);
      process.exit(2);
    }
  });
}

module.exports = { decide };
