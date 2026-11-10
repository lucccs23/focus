'use strict';
// Teste do app de desktop (Electron): abre o Focus com dados temporários e confere timer,
// bloqueio de troca de página, PDF do relatório e sincronização por pasta.
// Uso: npm run test:desktop
const electron = require('electron');
const { app, BrowserWindow } = electron;
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'focus-teste-'));
const PDF = path.join(TMP, 'relatorio.pdf');
electron.dialog.showSaveDialog = async () => ({ canceled: false, filePath: PDF });
electron.shell.openPath = async () => '';
app.setPath('userData', path.join(TMP, 'dados'));
require(path.join(ROOT, 'electron', 'main.js'));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = '') => results.push({ name, ok: !!ok, extra });

app.whenReady().then(async () => {
  const errors = [];
  try {
    await wait(2500);
    const main = BrowserWindow.getAllWindows().find((w) => w.getTitle().includes('Focus'));
    check('janela abriu', main);
    main.webContents.on('console-message', (e) => { if ((e.level ?? e) === 'error' || e.level === 3) errors.push(e.message); });
    const js = (c) => main.webContents.executeJavaScript(c);
    await js("$$('dialog[open]').forEach((d) => d.close()); 1");

    await js('location.href = "file:///C:/Windows/win.ini"; 1').catch(() => {});
    await wait(800);
    check('arrastar arquivo não troca o app', main.webContents.getURL().endsWith('index.html'));

    await js('Timer.start()');
    await wait(500);
    check('timer roda', await js('Timer.running'));
    await js('Timer.stop()');

    await js("Store.data.settings.profile = 'residencia'; Profile.apply(); Store.seedDemo(); App.renderAll(); Report.open(); $('#repForm').week.value = 'last'; Report.generate()");
    await wait(4000);
    check('relatório em PDF', fs.existsSync(PDF) && fs.readFileSync(PDF).slice(0, 4).toString() === '%PDF', fs.existsSync(PDF) ? `${fs.statSync(PDF).size} bytes` : '');

    const dir = path.join(TMP, 'nuvem');
    fs.mkdirSync(dir);
    await js(`(() => { const s = Store.data.settings; s.syncDir = ${JSON.stringify(dir)}; s.syncOn = true; s.syncSeenAt = 0; Store.save(); return Sync.run({ manual: true }); })()`);
    await wait(500);
    const f = path.join(dir, 'focus-sync.json');
    const j = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
    check('sincronização grava na pasta', j && j.rev && j.tasks.length);
    check('arquivo da nuvem sem códigos de acesso', j && !JSON.stringify(j).includes('ghp_'));
    j.tasks.push({ id: 'x1', title: 'do outro PC', type: 'estudo', est: 1, done: false, archived: false, createdAt: 1 });
    Object.assign(j, { deviceId: 'outro', rev: 'r-outro', updatedAt: Date.now() - 3600000 });
    fs.writeFileSync(f, JSON.stringify(j));
    await js('Sync.run({ manual: true })');
    await wait(500);
    check('recebe alteração de outro PC (relógio atrasado)', await js('!!Store.task("x1")'));
    check('sem erro de sincronização', !(await js('Store.data.settings.syncError')));
  } catch (e) { check('execução', false, e.stack); }
  check('console sem erros', !errors.length, errors.join(' | '));

  let fail = 0;
  for (const r of results) { if (!r.ok) fail++; console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.extra ? ` (${r.extra})` : ''}`); }
  console.log(fail ? `\n${fail} falha(s)` : '\nTudo certo no app de desktop.');
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) { /* pasta ainda em uso: o sistema limpa a pasta temporária depois */ }
  app.exit(fail ? 1 : 0);
});
