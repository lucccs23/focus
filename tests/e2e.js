'use strict';
// Teste de ponta a ponta: usa o Focus como uma pessoa usaria (cliques, toques e digitação reais),
// no app de desktop e na versão de celular, sempre com dados, senha e porta temporários.
// Uso: npm run verify
const electron = require('electron');
const { app, BrowserWindow, session } = electron;
const http = require('http');
const net = require('net');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { waitFor, deadline, createReport, watchdog, appReady } = require('./helpers');

const ROOT = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'focus-e2e-'));
const TOKEN = 'senha-de-teste';
const report = createReport();
const { check } = report;
const errors = [];

fs.mkdirSync(path.join(TMP, 'LeitorDeEstudos'));
fs.writeFileSync(path.join(TMP, 'LeitorDeEstudos', 'backup-token.txt'), TOKEN);
process.env.LOCALAPPDATA = TMP;
app.setPath('userData', path.join(TMP, 'dados'));
// Sem isto o Windows trata janelas cobertas por outras como ocultas e a página para de receber cliques.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.on('web-contents-created', (_e, wc) => wc.on('console-message', (ev) => { if (ev.level === 'error') errors.push(ev.message); }));
watchdog(app, 180000, report);

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.on('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

/* Controla uma janela pelo protocolo do navegador: os eventos chegam à página como os de uma pessoa. */
function driver(win, { touch = false } = {}) {
  const wc = win.webContents;
  const cdp = (m, p) => deadline(wc.debugger.sendCommand(m, p), m);
  const js = (c) => wc.executeJavaScript(c);
  const q = JSON.stringify;
  // centro do elemento, só se ele estiver visível e for o que recebe o clique naquele ponto
  const target = (sel) => js(`(() => {
    const el = [...document.querySelectorAll(${q(sel)})].find((x) => x.getClientRects().length);
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return hit && (el === hit || el.contains(hit) || hit.contains(el) && hit.tagName === 'LABEL') ? { x, y } : null;
  })()`);
  const api = {
    js, cdp,
    async click(sel) {
      const { x, y } = await waitFor(() => target(sel), `poder clicar em ${sel}`);
      if (touch) {
        await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      }
    },
    async type(sel, text) {
      await api.click(sel);
      await js(`document.querySelector(${q(sel)}).select?.()`);
      await cdp('Input.insertText', { text: String(text) });
    },
    // listas nativas abrem fora da página: escolhe a opção e avisa a página, como o navegador faz
    choose: (sel, value) => js(`(() => { const e = document.querySelector(${q(sel)}); e.value = ${q(value)}; e.dispatchEvent(new Event('change', { bubbles: true })); return e.value; })()`),
    text: (sel) => js(`document.querySelector(${q(sel)})?.innerText || ''`),
    until: (sel, wanted) => waitFor(async () => (await api.text(sel)).includes(wanted), `"${wanted}" em ${sel}`),
    visible: (sel) => js(`(() => { const e = document.querySelector(${q(sel)}); return !!e && e.getClientRects().length > 0; })()`),
    isOpen: (id) => js(`document.getElementById(${q(id)}).open`),
    untilOpen: (id, open = true) => waitFor(async () => (await api.isOpen(id)) === open, `${id} ${open ? 'abrir' : 'fechar'}`),
    async closeDialog(id) { await api.click(`#${id} .dlg-head .x`); await api.untilOpen(id, false); },
  };
  return api;
}

function bridge(port) {
  const call = (route, { token = TOKEN, method = 'GET', body } = {}) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: `${route}?t=${encodeURIComponent(token)}`, method }, (res) => {
      let txt = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { txt += c; });
      res.on('end', () => resolve({ status: res.statusCode, json: txt ? JSON.parse(txt) : null }));
    });
    req.on('error', reject);
    req.end(body);
  });
  return call;
}

async function desktopFlow(port) {
  const win = await waitFor(() => BrowserWindow.getAllWindows().find((w) => w.getTitle().includes('Focus')), 'a janela principal');
  win.webContents.debugger.attach('1.3');
  const u = driver(win);
  await u.cdp('Page.enable');
  await u.cdp('Page.addScriptToEvaluateOnNewDocument', { source: 'window.confirm = () => true;' });
  await u.cdp('Page.setInterceptFileChooserDialog', { enabled: true });
  await u.js('window.confirm = () => true; 1');
  await appReady(win);

  // primeiro uso
  await u.untilOpen('welcomeDlg');
  await u.click('[data-wz-profile="residencia"]');
  await u.click('[data-wz="template"]');
  await u.until('#wzTemplate', 'Carregado');
  await u.click('#welcomeDlg .dlg-foot [data-wz="skip"]');
  await u.untilOpen('welcomeDlg', false);
  check('primeiro uso: perfil e modelo de áreas', (await u.text('#btnSubjects')).includes('Áreas') && await u.js('Store.data.subjects.length === 5'));

  // tarefa de questões
  await u.click('#btnAddTask');
  await u.untilOpen('taskDlg');
  await u.type('#taskForm [name="title"]', 'Questões de Cardiologia');
  await u.click('#taskForm label:has(input[value="questoes"])');
  await u.choose('#taskForm [name="subjectId"]', await u.js('Store.data.subjects[0].id'));
  await u.click('#taskForm button[type="submit"]');
  await u.untilOpen('taskDlg', false);
  await u.until('#taskList', 'Questões de Cardiologia');
  check('cria tarefa e ela fica ativa', (await u.text('#activeTask')).includes('Questões de Cardiologia'));

  // timer e contador de questões
  await u.click('#btnPlay');
  await waitFor(async () => (await u.text('#time')) !== '25:00', 'o timer andar');
  await u.click('#btnPlay');
  await u.until('#modeLabel', 'PAUSADO');
  check('timer inicia e pausa', true);
  for (const k of ['ok', 'ok', 'ok', 'no']) await u.click(`#qCounter [data-qc="${k}"]`);
  await u.click('#qCounter [data-qc="undo"]');
  await u.click('#qCounter [data-qc="no"]');
  await u.until('#qCounter [data-qc="ok"]', '3');
  await u.until('#qCounter [data-qc="no"]', '1');
  await u.js('Timer.s.acc += 120000; 1'); // adianta o relógio: sessões com menos de 1 min não são salvas
  await u.click('#btnStop');
  await u.untilOpen('qDlg');
  check('parar abre o registro com o contador preenchido', await u.js("$('#qForm').total.value === '4' && $('#qForm').correct.value === '3'"));
  await u.click('#qSubmit');
  await u.untilOpen('qDlg', false);
  await u.until('#today', '4');

  // histórico e estatísticas
  await u.click('#btnHistory');
  await u.untilOpen('histDlg');
  await u.until('#histBody', '3/4');
  check('histórico mostra a sessão e as questões', (await u.text('#histBody')).includes('Foco interrompido'));
  await u.closeDialog('histDlg');
  await u.click('#btnStats');
  await u.untilOpen('statsDlg');
  await u.until('#statsBody', '75,0%');
  check('estatísticas somam as questões', true);
  await u.closeDialog('statsDlg');

  // flashcard
  await u.click('#btnCards');
  await u.untilOpen('cardDlg');
  await u.click('#cardTab [data-v="list"]');
  await u.type('#cardForm [name="front"]', 'Pergunta de teste');
  await u.type('#cardForm [name="back"]', 'Resposta de teste');
  await u.click('#cardSubmit');
  await u.until('#cardList', 'Pergunta de teste');
  await u.click('#cardTab [data-v="study"]');
  await u.click('#cardStudy [data-show]');
  await u.until('#cardStudy', 'Resposta de teste');
  await u.click('#cardStudy [data-grade="good"]');
  await u.until('#cardStudy', 'Pronto!');
  check('flashcard: cria e revisa', true);
  await u.closeDialog('cardDlg');

  // simulado
  await u.click('#btnSims');
  await u.untilOpen('simDlg');
  await u.click('#simNew');
  await u.type('#simRows input[data-k="total"]', '10');
  await u.type('#simRows input[data-k="correct"]', '8');
  await u.click('#simForm button[type="submit"]');
  await u.until('#simBody', '80,0%');
  check('simulado: lança e calcula a nota', true);
  await u.closeDialog('simDlg');

  // tema, backup e restauração
  const backupFile = path.join(TMP, 'backup.json');
  session.defaultSession.once('will-download', (_e, item) => item.setSavePath(backupFile));
  await u.click('#btnSettings');
  await u.untilOpen('settingsDlg');
  await u.click('[data-theme-opt="paper"]');
  await waitFor(() => u.js("document.documentElement.dataset.theme === 'paper'"), 'o tema mudar');
  await u.click('#btnExport');
  await waitFor(() => { try { return JSON.parse(fs.readFileSync(backupFile, 'utf8')).questions.length === 1; } catch { return false; } }, 'o arquivo de backup');
  check('backup exportado, sem credenciais', !fs.readFileSync(backupFile, 'utf8').includes('cloudToken'));
  await u.click('#btnClear');
  await waitFor(() => u.js('Store.data.questions.length === 0'), 'apagar os dados');
  await u.cdp('DOM.enable');
  const { root } = await u.cdp('DOM.getDocument');
  const { nodeId } = await u.cdp('DOM.querySelector', { nodeId: root.nodeId, selector: '#fileImport' });
  await u.cdp('DOM.setFileInputFiles', { nodeId, files: [backupFile] });
  await waitFor(() => u.js('Store.data.questions.length === 1 && Store.data.simulados.length === 1'), 'restaurar o backup');
  check('apaga e restaura pelo backup', true);
  await u.closeDialog('settingsDlg');

  // dados continuam depois de recarregar
  await u.js("Store.data.activeTaskId = Store.data.tasks[0].id; App.renderAll(); 1");
  await new Promise((resolve) => { win.webContents.once('did-finish-load', resolve); win.webContents.reload(); });
  await appReady(win);
  await u.until('#taskList', 'Questões de Cardiologia');
  check('dados continuam depois de reabrir', await u.js("document.documentElement.dataset.theme === 'paper'"));

  // ponte com o leitor (mesmas rotas que ele usa)
  const call = bridge(port);
  check('ponte recusa senha errada', (await call('/status', { token: 'errada' })).status === 403);
  const st = await waitFor(async () => { const r = await call('/status'); return r.json.subjects?.length === 5 && r.json; }, 'as áreas chegarem à ponte');
  check('ponte informa matérias e modos', st.app === 'focus' && st.modes.some((m) => m.id === 'stopwatch'));
  await call('/command', { method: 'POST', body: 'mode:stopwatch' });
  await waitFor(() => u.js("Timer.s.mode === 'stopwatch' && Timer.running"), 'o leitor iniciar o cronômetro');
  await call('/command', { method: 'POST', body: 'stop' });
  await waitFor(() => u.js('!Timer.isStarted()'), 'o leitor parar o timer');
  check('ponte controla o timer', true);
  const subject = st.subjects[0], topic = subject.topics[0];
  const sess = await call('/session', { method: 'POST', body: JSON.stringify({ id: 'leitura-1', start: Date.now() - 600000, ms: 300000, subjectId: subject.id, topicId: topic.id, title: 'Capítulo 1' }) });
  const link = await call('/link', { method: 'POST', body: JSON.stringify({ fp: 'abc', name: 'Apostila.pdf', page: 3, topicId: topic.id }) });
  check('ponte registra leitura e liga PDF', sess.json.ok && link.json.linked);
  await u.click('#btnHistory');
  await u.untilOpen('histDlg');
  await u.until('#histBody', 'Leitura (Vetra)');
  await u.closeDialog('histDlg');
  await u.click('#btnSubjects');
  await u.untilOpen('subjDlg');
  await u.click(`tr[data-tid="${topic.id}"] [data-note]`);
  await u.untilOpen('noteDlg');
  await u.until('#notePdfs', 'Apostila');
  check('leitura no histórico e PDF nas anotações', true);
  await u.closeDialog('noteDlg');
  await u.closeDialog('subjDlg');

  // mini-timer
  await u.click('#btnMini');
  const mini = await waitFor(() => BrowserWindow.getAllWindows().find((w) => w.getTitle().includes('mini')), 'o mini-timer');
  await waitFor(() => mini.webContents.executeJavaScript("document.getElementById('time').textContent !== '--:--'"), 'o mini-timer mostrar o tempo');
  await u.click('#btnMini');
  await waitFor(() => !BrowserWindow.getAllWindows().some((w) => w.getTitle().includes('mini')), 'o mini-timer fechar');
  check('mini-timer abre, mostra o tempo e fecha', true);
}

async function phoneFlow() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  // a janela precisa estar na tela: toques só são entregues a páginas que estão sendo desenhadas
  const win = new BrowserWindow({ show: false, skipTaskbar: true, webPreferences: { partition: 'celular' } });
  win.showInactive();
  win.webContents.debugger.attach('1.3');
  const u = driver(win, { touch: true });
  // a emulação exige uma página aberta; o app é aberto de novo para já nascer "no celular"
  const url = `http://127.0.0.1:${server.address().port}/`;
  await win.loadURL(url);
  await u.cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await u.cdp('Emulation.setTouchEmulationEnabled', { enabled: true });
  await win.loadURL(url);
  await appReady(win);
  await u.untilOpen('welcomeDlg');
  await u.click('[data-wz-profile="concurso"]');
  await u.click('#welcomeDlg .dlg-foot [data-wz="skip"]');
  await u.untilOpen('welcomeDlg', false);
  check('celular: barra de baixo com os nomes do perfil', await u.js("getComputedStyle($('.top-actions')).position === 'fixed'") && (await u.text('#btnSubjects')).includes('Matérias'));
  await u.click('#btnAddTask');
  await u.untilOpen('taskDlg');
  await u.type('#taskForm [name="title"]', 'Lei seca');
  await u.click('#taskForm button[type="submit"]');
  await u.until('#taskList', 'Lei seca');
  await u.click('#btnPlay');
  await waitFor(() => u.js('Timer.running'), 'o timer iniciar');
  await u.click('#btnZen');
  check('celular: modo foco esconde o resto', await waitFor(() => u.js("document.body.classList.contains('zen') && !$('.top-actions').getClientRects().length"), 'o modo foco'));
  await u.click('#btnZen');
  await u.click('#btnStats');
  await u.untilOpen('statsDlg');
  check('celular: tela ocupa a largura sem vazar', await u.js("$('#statsDlg').getBoundingClientRect().width === innerWidth && $('#statsDlg').scrollWidth <= innerWidth"));
  win.destroy();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}

(async () => {
  process.env.FOCUS_BRIDGE_PORT = String(await freePort());
  require(path.join(ROOT, 'electron', 'main.js'));
  await app.whenReady();
  try {
    await desktopFlow(+process.env.FOCUS_BRIDGE_PORT);
    await phoneFlow();
  } catch (e) { check('execução', false, e.stack); }
  check('console sem erros', !errors.length, errors.slice(0, 3).join(' | '));
  const code = report.finish('Tudo certo de ponta a ponta.');
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* pasta ainda em uso: o sistema limpa depois */ }
  app.exit(code);
})();
