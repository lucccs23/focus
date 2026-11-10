'use strict';
// Cria a pasta runtime/ com um "Focus.exe" de verdade (o Electron com nome, ícone e versão do Focus).
// Ele abre o código desta pasta direto, então as atualizações continuam sem reinstalar nada.
// Uso: npm run runtime   (rode de novo depois de atualizar o Electron)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'node_modules', 'electron', 'dist');
const DST = path.join(ROOT, 'runtime');
const RCEDIT = path.join(ROOT, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

if (!fs.existsSync(path.join(SRC, 'electron.exe'))) {
  console.error('Electron não encontrado. Rode: npm install && node node_modules/electron/install.js');
  process.exit(1);
}

fs.rmSync(DST, { recursive: true, force: true });
fs.mkdirSync(DST, { recursive: true });

// copia os arquivos do Electron (com "hard link" quando possível: não ocupa espaço extra)
let linked = 0, copied = 0;
(function walk(rel) {
  for (const e of fs.readdirSync(path.join(SRC, rel), { withFileTypes: true })) {
    const r = path.join(rel, e.name);
    if (r === path.join('resources', 'default_app.asar')) continue; // tela padrão do Electron
    if (e.isDirectory()) { fs.mkdirSync(path.join(DST, r), { recursive: true }); walk(r); continue; }
    const to = r === 'electron.exe' ? path.join(DST, 'Focus.exe') : path.join(DST, r);
    if (r === 'electron.exe') { fs.copyFileSync(path.join(SRC, r), to); copied++; continue; } // este vai ser alterado
    try { fs.linkSync(path.join(SRC, r), to); linked++; } catch { fs.copyFileSync(path.join(SRC, r), to); copied++; }
  }
})('');

// "app" embutido que só aponta para o código do projeto (runtime/resources/app -> ../../..)
const app = path.join(DST, 'resources', 'app');
fs.mkdirSync(app, { recursive: true });
fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: pkg.name, productName: pkg.productName, version: pkg.version, main: 'index.js' }, null, 2));
fs.writeFileSync(path.join(app, 'index.js'),
  "'use strict';\n// Abre o Focus a partir do código da pasta do projeto.\nrequire(require('path').join(__dirname, '..', '..', '..', 'electron', 'main.js'));\n");

// nome, ícone e versão que o Windows mostra (barra de tarefas, Gerenciador de Tarefas)
const v = pkg.version;
execFileSync(RCEDIT, [
  path.join(DST, 'Focus.exe'),
  '--set-icon', path.join(ROOT, 'build', 'icon.ico'),
  '--set-version-string', 'FileDescription', pkg.productName,
  '--set-version-string', 'ProductName', pkg.productName,
  '--set-version-string', 'InternalName', pkg.productName,
  '--set-version-string', 'OriginalFilename', 'Focus.exe',
  '--set-version-string', 'CompanyName', pkg.productName,
  '--set-version-string', 'LegalCopyright', '',
  '--set-file-version', v,
  '--set-product-version', v,
]);
console.log(`runtime/Focus.exe pronto (versão ${v}; ${linked} arquivos ligados, ${copied} copiados)`);
