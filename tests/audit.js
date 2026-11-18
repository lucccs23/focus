'use strict';
// Auditoria estática: ligações entre HTML e JS, cache offline e regras dos próprios testes.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const html = read('index.html');
const jsFiles = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'));
const js = Object.fromEntries(jsFiles.map((f) => [f, read('js', f)]));
const problems = [];

// ids
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const dup = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
if (dup.length) problems.push(`ids duplicados no HTML: ${dup.join(', ')}`);
const created = Object.values(js).flatMap((s) => [...s.matchAll(/\sid="([a-zA-Z][\w-]*)"/g)].map((m) => m[1]));
const known = new Set([...ids, ...created]);
for (const [f, s] of Object.entries(js)) {
  const refs = [...s.matchAll(/\$\$?\('#([a-zA-Z][\w-]*)/g), ...s.matchAll(/getElementById\('([\w-]+)'\)/g)].map((m) => m[1]);
  const miss = [...new Set(refs.filter((r) => !known.has(r)))];
  if (miss.length) problems.push(`${f}: ids inexistentes: ${miss.join(', ')}`);
}

// nomes globais repetidos entre scripts clássicos quebram o carregamento
const decl = {};
for (const [f, s] of Object.entries(js)) {
  for (const m of s.matchAll(/^(?:const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) (decl[m[1]] ||= []).push(f);
}
for (const [name, files] of Object.entries(decl)) if (files.length > 1) problems.push(`global repetido: ${name} (${files.join(', ')})`);

// vocabulário do perfil
const terms = new Set(['S', 's', 'SS', 'ss', 'P', 'p', 'PP', 'pp', 'I', 'i', 'ii', 'nav', 'exam', 'exams', 'inst', 'sim', 'front', 'back', 'short']);
const usedHtml = [...html.matchAll(/data-term[\w-]*="([^"]*)"/g)].flatMap((m) => [...m[1].matchAll(/\{(\w+)\}/g)].map((x) => x[1]));
const usedJs = Object.values(js).flatMap((s) => [...s.matchAll(/\bT\.(\w+)/g)].map((m) => m[1]));
const badTerms = [...new Set([...usedHtml, ...usedJs].filter((k) => !terms.has(k)))];
if (badTerms.length) problems.push(`termos desconhecidos: ${badTerms.join(', ')}`);

// arquivos do app x cache offline
const sw = read('sw.js');
const assets = [...html.matchAll(/(?:src|href)="((?:js|css|icons)\/[^"]+)"/g)].map((m) => m[1]);
for (const a of assets) {
  if (!sw.includes(`'./${a}'`)) problems.push(`fora do cache offline: ${a}`);
  if (!fs.existsSync(path.join(ROOT, a))) problems.push(`arquivo citado não existe: ${a}`);
}
for (const [, a] of sw.matchAll(/'\.\/([^']+)'/g)) if (a && !fs.existsSync(path.join(ROOT, a))) problems.push(`no cache mas não existe: ${a}`);
for (const f of jsFiles) if (!html.includes(`js/${f}`)) problems.push(`script fora do index.html: js/${f}`);

// botão sem type dentro de formulário envia o formulário sem querer
for (const [form] of html.matchAll(/<form[\s\S]*?<\/form>/g)) {
  for (const m of form.matchAll(/<button(?![^>]*\btype=)[^>]*>([^<]{0,30})/g)) problems.push(`botão sem type em formulário: ${m[1].trim()}`);
}

// testes: nada de pular, repetir ou esperar um tempo fixo (só helpers.js pode usar relógio)
for (const f of fs.readdirSync(path.join(ROOT, 'tests')).filter((x) => x.endsWith('.js') && x !== 'audit.js')) {
  const s = read('tests', f);
  if (/\b(?:it|test|describe)\.skip\b|\bretries?\s*[:=]/.test(s)) problems.push(`tests/${f}: teste pulado ou com repetição`);
  if (f !== 'helpers.js' && /\b(?:setTimeout|sleep)\s*\(|\bwait\s*\(\s*\d/.test(s)) problems.push(`tests/${f}: espera de tempo fixo (use waitFor com uma condição)`);
}

if (problems.length) {
  console.error(`Auditoria: ${problems.length} problema(s)`);
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}
console.log('✓ auditoria sem problemas');
