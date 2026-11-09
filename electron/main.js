'use strict';
// Processo principal do Electron: janela do app, mini-timer sempre no topo e barra de tarefas.
const { app, BrowserWindow, ipcMain, screen, shell, nativeTheme, Tray, Menu, nativeImage, globalShortcut, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const ICON = path.join(ROOT, 'build', 'icon.png');
const PRELOAD = path.join(__dirname, 'preload.js');
const MINI = { w: 268, h: 66 };

let main = null;
let mini = null;
let lastState = null;
let quitting = false;   // app encerrando de verdade (não só escondendo na bandeja)
let tray = null;
let prefs = { closeToTray: false };
let trayHintShown = false;
const failedShortcuts = [];

if (!app.requestSingleInstanceLock()) app.quit();
app.setAppUserModelId('com.focus.app'); // necessário para notificações no Windows

// O app se chamava "Foco Lab": continua usando a mesma pasta de dados para nada se perder.
// (Só troca se ninguém definiu outra pasta antes — ex.: os testes automatizados.)
if (app.getPath('userData') === path.join(app.getPath('appData'), app.getName())) {
  app.setPath('userData', path.join(app.getPath('appData'), 'Foco Lab'));
}

/* ---------- preferências da janela (posição, tamanho, mini aberto) ---------- */
const cfgPath = () => path.join(app.getPath('userData'), 'window.json');
function readCfg() {
  try { return JSON.parse(fs.readFileSync(cfgPath(), 'utf8')); } catch { return {}; }
}
function writeCfg(patch) {
  try { fs.writeFileSync(cfgPath(), JSON.stringify({ ...readCfg(), ...patch })); } catch { /* ignora */ }
}
// evita abrir uma janela fora da tela (ex.: monitor que foi desconectado)
function onScreen(x, y, w, h) {
  if (typeof x !== 'number' || typeof y !== 'number') return false;
  return screen.getAllDisplays().some(({ workArea: a }) =>
    x + w > a.x + 40 && x < a.x + a.width - 40 && y >= a.y - 10 && y < a.y + a.height - 40);
}

/* ---------- tema (claro/escuro): a barra de título e o mini seguem o app ---------- */
const bgColor = () => (nativeTheme.shouldUseDarkColors ? '#161616' : '#f7f6f3');
function setTheme(t) {
  nativeTheme.themeSource = t === 'light' || t === 'dark' ? t : 'system';
}
nativeTheme.on('updated', () => { if (main) main.setBackgroundColor(bgColor()); });

/* ---------- zoom da interface ---------- */
let zoom = 1;
function setZoom(z) {
  zoom = Math.round(Math.min(2, Math.max(0.6, z)) * 100) / 100;
  if (main) { main.webContents.setZoomFactor(zoom); main.webContents.send('zoom', zoom); }
  writeCfg({ zoom });
}

/* ---------- janela principal ---------- */
function createMain() {
  const cfg = readCfg();
  zoom = cfg.zoom || 1;
  setTheme(cfg.theme);
  const w = cfg.w || 820, h = cfg.h || 960;
  const pos = onScreen(cfg.x, cfg.y, w, h) ? { x: cfg.x, y: cfg.y } : {};
  main = new BrowserWindow({
    width: w, height: h, ...pos, minWidth: 380, minHeight: 520,
    title: 'Focus', icon: ICON, backgroundColor: bgColor(), show: false, autoHideMenuBar: true,
    webPreferences: { preload: PRELOAD, backgroundThrottling: false },
  });
  main.removeMenu();
  main.loadFile(path.join(ROOT, 'index.html'));
  main.once('ready-to-show', () => {
    if (cfg.max) main.maximize();
    main.show();
    if (cfg.miniOpen) toggleMini(true);
  });

  main.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  main.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F12') main.webContents.toggleDevTools();
    if (input.control && input.key.toLowerCase() === 'r') main.reload();
    // zoom: Ctrl + / Ctrl - / Ctrl 0
    if (input.control && !input.alt) {
      if (input.key === '=' || input.key === '+') { e.preventDefault(); setZoom(zoom + 0.1); }
      if (input.key === '-' || input.key === '_') { e.preventDefault(); setZoom(zoom - 0.1); }
      if (input.key === '0') { e.preventDefault(); setZoom(1); }
    }
  });
  // Ctrl + roda do mouse
  main.webContents.on('zoom-changed', (_e, dir) => setZoom(zoom + (dir === 'in' ? 0.1 : -0.1)));
  main.webContents.on('did-finish-load', () => main.webContents.setZoomFactor(zoom));
  main.on('focus', () => main.flashFrame(false));
  // Windows desligando/reiniciando: não segura a janela na bandeja
  main.on('session-end', () => { quitting = true; });
  main.on('close', (e) => {
    if (prefs.closeToTray && !quitting) {
      // continua rodando no ícone perto do relógio
      e.preventDefault();
      main.hide();
      if (!trayHintShown && tray) {
        trayHintShown = true;
        tray.displayBalloon?.({ title: 'Focus continua rodando', content: 'O timer segue aqui na bandeja. Clique no ícone para abrir ou use "Sair" no menu.', iconType: 'info' });
      }
      return;
    }
    quitting = true;
    const max = main.isMaximized();
    if (!max && !main.isMinimized()) {
      const b = main.getBounds();
      writeCfg({ x: b.x, y: b.y, w: b.width, h: b.height, max });
    } else writeCfg({ max });
  });
  main.on('closed', () => { main = null; if (mini) mini.close(); });
}

function showMain() {
  if (!main) return;
  if (main.isMinimized()) main.restore();
  main.show();
  main.focus();
}

/* ---------- mini-timer ---------- */
function toggleMini(force) {
  const want = typeof force === 'boolean' ? force : !mini;
  if (!want) { if (mini) mini.close(); return; }
  if (mini) { mini.showInactive(); return; }

  const cfg = readCfg();
  const wa = screen.getPrimaryDisplay().workArea;
  let x = cfg.miniX, y = cfg.miniY;
  if (!onScreen(x, y, MINI.w, MINI.h)) { x = wa.x + wa.width - MINI.w - 20; y = wa.y + wa.height - MINI.h - 20; }

  mini = new BrowserWindow({
    width: MINI.w, height: MINI.h, x, y,
    frame: false, transparent: true, resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false, show: false, focusable: true,
    title: 'Focus — mini', icon: ICON, backgroundColor: '#00000000',
    webPreferences: { preload: PRELOAD, backgroundThrottling: false },
  });
  mini.setAlwaysOnTop(true, 'floating');
  mini.loadFile(path.join(ROOT, 'mini.html'));
  mini.once('ready-to-show', () => mini.showInactive());
  mini.webContents.on('did-finish-load', () => { if (lastState) mini.webContents.send('state', lastState); });
  mini.on('moved', () => { const [mx, my] = mini.getPosition(); writeCfg({ miniX: mx, miniY: my }); });
  mini.on('closed', () => {
    mini = null;
    if (!quitting) writeCfg({ miniOpen: false });
    if (main) main.webContents.send('mini-state', false);
    updateTray(true);
  });
  writeCfg({ miniOpen: true });
  if (main) main.webContents.send('mini-state', true);
  updateTray(true);
}

/* ---------- ícone na bandeja (perto do relógio) ---------- */
function quitApp() { quitting = true; app.quit(); }
function send(cmd) { if (main) main.webContents.send('command', cmd); }

function trayMenu() {
  const s = lastState || {};
  return Menu.buildFromTemplate([
    { label: s.started ? `${s.text} · ${s.running ? s.label : 'Pausado'}` : 'Focus', enabled: false },
    { type: 'separator' },
    { label: s.running ? 'Pausar' : 'Iniciar', accelerator: 'Ctrl+Alt+P', click: () => send('toggle') },
    { label: 'Pular', accelerator: 'Ctrl+Alt+N', click: () => send('skip') },
    { label: 'Parar e salvar', enabled: !!s.started, click: () => send('stop') },
    { type: 'separator' },
    { label: 'Abrir o Focus', accelerator: 'Ctrl+Alt+F', click: showMain },
    { label: mini ? 'Fechar mini-timer' : 'Mini-timer', accelerator: 'Ctrl+Alt+M', click: () => toggleMini() },
    { type: 'separator' },
    { label: 'Sair', click: quitApp },
  ]);
}
let trayKey = '';
function updateTray(force) {
  if (!tray) return;
  const s = lastState || {};
  tray.setToolTip(s.started ? `Focus — ${s.text} (${s.running ? s.label : 'pausado'})` : 'Focus');
  // o menu só é refeito quando muda algo além do relógio (ou ao abrir)
  const key = `${s.running}|${s.started}|${!!mini}`;
  if (force || key !== trayKey) { trayKey = key; tray.setContextMenu(trayMenu()); }
}
function createTray() {
  const img = nativeImage.createFromPath(ICON).resize({ width: 16, height: 16, quality: 'best' });
  tray = new Tray(img);
  tray.on('click', () => (main && main.isVisible() && !main.isMinimized() ? main.focus() : showMain()));
  tray.on('right-click', () => updateTray(true)); // atualiza o horário mostrado no menu
  updateTray(true);
}

/* ---------- atalhos globais ---------- */
function registerShortcuts() {
  const map = {
    'Ctrl+Alt+P': () => send('toggle'),
    'Ctrl+Alt+N': () => send('skip'),
    'Ctrl+Alt+M': () => toggleMini(),
    'Ctrl+Alt+F': showMain,
  };
  for (const [acc, fn] of Object.entries(map)) {
    try { if (!globalShortcut.register(acc, fn)) failedShortcuts.push(acc); } catch { failedShortcuts.push(acc); }
  }
}

/* ---------- comunicação com as páginas ---------- */
ipcMain.on('state', (_e, s) => {
  lastState = s;
  updateTray(false);
  if (main) {
    // progresso no ícone da barra de tarefas (verde rodando, amarelo pausado)
    if (s.started && s.progress >= 0) main.setProgressBar(Math.max(0.01, s.progress), { mode: s.running ? 'normal' : 'paused' });
    else main.setProgressBar(-1);
  }
  if (mini) mini.webContents.send('state', s);
});


ipcMain.on('command', (_e, cmd) => {
  if (cmd === 'show') return showMain();
  if (cmd === 'close-mini') return toggleMini(false);
  if (main) main.webContents.send('command', cmd);
});

ipcMain.on('toggle-mini', () => toggleMini());

ipcMain.on('prefs', (_e, p) => { prefs = { ...prefs, ...p }; });
ipcMain.on('set-zoom', (_e, z) => setZoom(+z || 1));
ipcMain.handle('get-zoom', () => zoom);
ipcMain.handle('shortcut-status', () => failedShortcuts);

/* ---------- sincronização por pasta na nuvem ---------- */
const SYNC_FILE = 'focus-sync.json';
ipcMain.handle('sync-read', (_e, dir) => {
  try {
    if (!dir || !fs.existsSync(dir)) return { ok: false, error: 'a pasta de sincronização não existe' };
    const f = path.join(dir, SYNC_FILE);
    if (!fs.existsSync(f)) return { ok: true, json: null };
    return { ok: true, json: fs.readFileSync(f, 'utf8') };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('sync-write', (_e, { dir, json }) => {
  try {
    if (!dir || !fs.existsSync(dir)) return { ok: false, error: 'a pasta de sincronização não existe' };
    JSON.parse(json);
    // grava num arquivo temporário e troca no fim: o OneDrive/Drive nunca pega um arquivo pela metade
    const f = path.join(dir, SYNC_FILE), tmp = f + '.tmp';
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, f);
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

/* ---------- relatório em PDF ---------- */
ipcMain.handle('export-pdf', async (_e, { html, name }) => {
  const r = await dialog.showSaveDialog(main, {
    title: 'Salvar relatório', defaultPath: path.join(app.getPath('documents'), name || 'Focus - relatorio.pdf'),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };
  const tmpHtml = path.join(app.getPath('temp'), `focus-relatorio-${Date.now()}.html`);
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false } });
  try {
    fs.writeFileSync(tmpHtml, html);
    await win.loadFile(tmpHtml);
    const pdf = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { marginType: 'none' }, preferCSSPageSize: true });
    fs.writeFileSync(r.filePath, pdf);
    shell.openPath(r.filePath);
    return { ok: true, file: r.filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    win.destroy();
    fs.rm(tmpHtml, { force: true }, () => {});
  }
});

/* ---------- backup automático ---------- */
ipcMain.handle('pick-dir', async () => {
  const r = await dialog.showOpenDialog(main, { title: 'Pasta para os backups do Focus', properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('write-backup', (_e, { dir, json }) => {
  try {
    if (!dir || !fs.existsSync(dir)) return { ok: false, error: 'a pasta não existe mais' };
    JSON.parse(json); // só grava JSON válido
    const d = new Date();
    const name = `focus-auto-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
    fs.writeFileSync(path.join(dir, name), json);
    // mantém só os 30 mais recentes (apenas arquivos criados pelo próprio app)
    const mine = fs.readdirSync(dir).filter((f) => /^(focus|focolab)-auto-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort((a, b) => a.slice(-15).localeCompare(b.slice(-15))).reverse();
    mine.slice(30).forEach((f) => { try { fs.unlinkSync(path.join(dir, f)); } catch { /* ignora */ } });
    return { ok: true, file: name };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.on('theme', (_e, t) => {
  setTheme(t);
  if (readCfg().theme !== t) writeCfg({ theme: t });
});

// pisca o ícone na barra de tarefas quando um timer termina e o app não está em foco
ipcMain.on('attention', () => { if (main && !main.isFocused()) main.flashFrame(true); });

/* ---------- ciclo de vida ---------- */
app.on('second-instance', showMain);
app.whenReady().then(() => {
  createMain();
  createTray();
  registerShortcuts();
});
app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
