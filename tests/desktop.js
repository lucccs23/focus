'use strict';
// Teste do app de desktop (Electron): abre o Focus com dados temporários e confere timer,
// bloqueio de troca de página, PDF do relatório e sincronização por pasta.
// Uso: npm run test:desktop
const electron = require('electron');
const { app, BrowserWindow } = electron;
const path = require('path');
const fs = require('fs');
const os = require('os');
const { once } = require('events');
const { waitFor, createReport, watchdog, appReady } = require('./helpers');

const ROOT = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'focus-teste-'));
const PDF = path.join(TMP, 'relatorio.pdf');
const report = createReport();
const { check } = report;
const errors = [];

electron.dialog.showSaveDialog = async () => ({ canceled: false, filePath: PDF });
electron.shell.openPath = async () => '';
app.setPath('userData', path.join(TMP, 'dados'));
process.env.LOCALAPPDATA = TMP; // nunca lê a senha real do leitor
app.on('web-contents-created', (_e, wc) => wc.on('console-message', (ev) => { if (ev.level === 'error') errors.push(ev.message); }));
watchdog(app, 120000, report);
require(path.join(ROOT, 'electron', 'main.js'));

app.whenReady().then(async () => {
  try {
    check('app abriu sozinho (sem outra cópia usando estes dados)', app.hasSingleInstanceLock());
    const main = await waitFor(() => BrowserWindow.getAllWindows().find((w) => w.getTitle().includes('Focus')), 'a janela principal');
    await appReady(main);
    check('janela abriu', true);
    const js = (c) => main.webContents.executeJavaScript(c);
    await js("$$('dialog[open]').forEach((d) => d.close()); 1");

    const blocked = once(main.webContents, 'will-navigate');
    await js('location.href = "file:///C:/Windows/win.ini"; 1');
    await blocked;
    check('arrastar arquivo não troca o app', main.webContents.getURL().endsWith('index.html') && await js("typeof App !== 'undefined'"));

    await js('Timer.start(); 1');
    check('timer roda', await js('Timer.running'));
    await js('Timer.stop(); 1');

    await js("Store.data.settings.profile = 'residencia'; Profile.apply(); Store.seedDemo(); App.renderAll(); Report.open(); $('#repForm').week.value = 'last'; Report.generate()");
    check('relatório em PDF', fs.existsSync(PDF) && fs.readFileSync(PDF).subarray(0, 4).toString() === '%PDF', fs.existsSync(PDF) ? `${fs.statSync(PDF).size} bytes` : '');

    const dir = path.join(TMP, 'nuvem');
    fs.mkdirSync(dir);
    await js(`(() => { const s = Store.data.settings; s.syncDir = ${JSON.stringify(dir)}; s.syncOn = true; s.syncSeenAt = 0; Store.save(); return Sync.run({ manual: true }); })()`);
    const f = path.join(dir, 'focus-sync.json');
    const j = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
    check('sincronização grava na pasta', j && j.rev && j.tasks.length);
    check('arquivo da nuvem sem códigos de acesso', j && !JSON.stringify(j).includes('ghp_'));
    j.tasks.push({ id: 'x1', title: 'do outro PC', type: 'estudo', est: 1, done: false, archived: false, createdAt: 1 });
    Object.assign(j, { deviceId: 'outro', rev: 'r-outro', updatedAt: Date.now() - 3600000 });
    fs.writeFileSync(f, JSON.stringify(j));
    await js('Sync.run({ manual: true })');
    check('recebe alteração de outro PC (relógio atrasado)', await js('!!Store.task("x1")'));
    check('sem erro de sincronização', !(await js('Store.data.settings.syncError')));
  } catch (e) { check('execução', false, e.stack); }
  check('console sem erros', !errors.length, errors.join(' | '));
  const code = report.finish('Tudo certo no app de desktop.');
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* pasta ainda em uso: o sistema limpa depois */ }
  app.exit(code);
});
