'use strict';
// Teste da versão web (celular/navegador), rodando num Chromium completo (Electron):
//  - abre todas as telas de todos os perfis em 3 tamanhos (celular, tablet, PC) procurando erros e conteúdo fora da tela;
//  - confere cálculos (nota líquida, notas da faculdade, flashcards, colar edital, termos do perfil);
//  - confere o modo offline (service worker).
// Uso: npm run test:web
const { app, BrowserWindow } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const results = [];
const check = (name, ok, extra = '') => results.push({ name, ok: !!ok, extra });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'focus-web-')));

// servidor local só com os arquivos do app
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

// varredura que roda dentro da página
const SWEEP = `(async () => {
  const errs = []; const onErr = (e) => errs.push(e.message); window.addEventListener('error', onErr);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)); const issues = [];
  const chk = (label) => { if (document.documentElement.scrollWidth > innerWidth + 1) issues.push(label + ': página rola de lado'); const dlg = document.querySelector('dialog[open]'); if (dlg) { const r = dlg.getBoundingClientRect(); if (r.right > innerWidth + 1 || r.left < -1) issues.push(label + ': janela sai da tela'); if (dlg.scrollWidth > dlg.clientWidth + 2) issues.push(label + ': conteúdo mais largo que a janela'); } };
  for (const prof of ['residencia', 'concurso', 'vestibular', 'faculdade', 'outro']) {
    localStorage.removeItem('focolab.v1'); Store.load(); Timer.init(); $$('dialog[open]').forEach((d) => d.close());
    Store.data.settings.profile = prof; Store.data.settings.onboardDone = true; Store.data.settings.lastSeenVersion = APP_VERSION;
    Store.data.settings.profileExtra = prof === 'outro' ? ['concurso', 'vestibular', 'faculdade'] : []; Profile.apply();
    const t = Profile.template(); if (t) Plan.loadTemplate(t); Store.seedDemo();
    Store.data.settings.exams = [{ id: 'e', name: 'Prova', date: D.addDays(Date.now(), 50) }];
    Store.data.tasks.filter((x) => x.demo).slice(-3).forEach((x) => { x.archived = false; x.done = false; });
    Store.data.activeTaskId = Store.data.tasks.find((x) => !x.archived && x.type === 'questoes')?.id || null;
    App.renderAll(); await wait(60); chk(prof + '/início');
    const opens = { Histórico: () => History.open(Date.now()), Matérias: () => Subjects.open(), Erros: () => Reviews.open(), Cards: () => Cards.open(), CardsLista: () => Cards.open('list'), CardsImportar: () => Cards.open('import'),
      Simulados: () => Sims.open(), SimuladoNovo: () => { Sims.open(); Sims.openForm(null); $('#simForm').ce.checked = true; $('#simForm').ce.onchange?.(); }, Estatísticas: () => Stats.open(), Ajustes: () => Settings.open(),
      Tarefa: () => App.openTask(), Questões: () => App.openQ({}), Relatório: () => Report.open(), ColarQuestões: () => Importer.open(), ColarEdital: () => Edital.open(), TelaInicial: () => Custom.openHome(),
      Guia: () => $('#guideDlg').showModal(), Atalhos: () => $('#keysDlg').showModal(), Redações: () => { Essay.open(); Essay.openForm(null); }, Anotação: () => Subjects.openNote(Store.activeSubjects()[0]?.topics[0]?.id),
      Tempo: () => History.openSess(null), BoasVindas: () => { Custom.renderWelcome(); $('#welcomeDlg').showModal(); }, Sobre: () => About.open() };
    for (const [name, fn] of Object.entries(opens)) { try { fn(); } catch (e) { issues.push(prof + '/' + name + ': ERRO ' + e.message); } await wait(30); chk(prof + '/' + name); $$('dialog[open]').forEach((d) => d.close()); }
    Custom.zen(true); await wait(30); chk(prof + '/modo foco'); Custom.zen(false);
  }
  window.removeEventListener('error', onErr); localStorage.removeItem('focolab.v1');
  return { issues, errs };
})()`;

// cálculos das funções
const UNITS = `(() => {
  const r = {};
  r.notaLiquida = qNet({ total: 20, correct: 12, blank: 3 }) === 7 && qWrong({ total: 20, correct: 12, blank: 3 }) === 5;
  Store.data.settings.passGrade = 7;
  const c = College.calc({ grades: [{ name: 'P1', w: 4, v: 6 }, { name: 'P2', w: 4, v: null }, { name: 'T', w: 2, v: 9 }] });
  r.faculdade = Math.abs(c.avg - 7) < 1e-9 && Math.abs(c.need - 7) < 1e-9;
  const n1 = Cards.next({ interval: 0, ease: 2.5, reps: 0 }, 'good'), n2 = Cards.next({ interval: 3, ease: 2.5, reps: 2 }, 'good'), n3 = Cards.next({ interval: 10, ease: 2.5, reps: 3 }, 'again');
  r.flashcards = n1.interval === 1 && n2.interval === 8 && n3.interval === 0 && n3.lapse;
  const ed = Edital.parse('CONHECIMENTOS BÁSICOS: LÍNGUA PORTUGUESA: 1 Compreensão de textos. 2 Ortografia oficial. 3 Crase. 3.1 Casos especiais. INFORMÁTICA: 1 Windows. 2 Lei nº 8.112/1990.', false);
  r.colarEdital = ed.length === 2 && ed[0].name === 'Língua Portuguesa' && ed[0].items.length === 3 && ed[1].items[1] === 'Lei nº 8.112/1990';
  Profile.set('concurso'); r.termosConcurso = T.S === 'Matéria' && T.I === 'Banca';
  Profile.set('faculdade'); r.termosFaculdade = T.SS === 'Disciplinas' && T.nav === 'Matérias';
  Profile.set('residencia'); r.termosResidencia = T.S === 'Área' && T.p === 'tema';
  r.semanaDomingo = (Store.data.settings.weekStart = '0', new Date(D.weekStart(Date.now())).getDay() === 0); Store.data.settings.weekStart = 1;
  localStorage.removeItem('focolab.v1');
  return r;
})()`;

app.whenReady().then(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const w = new BrowserWindow({ show: false, width: 1440, height: 900 });
  const js = (c) => w.webContents.executeJavaScript(c);
  try {
    await w.loadURL(url);
    await wait(2500);
    for (const [label, wd, ht] of [['PC', 1440, 900], ['tablet', 820, 1100], ['celular', 375, 812]]) {
      w.setContentSize(wd, ht);
      await wait(400);
      const r = await js(SWEEP);
      check(`telas sem erros nem vazamentos (${label})`, !r.issues.length && !r.errs.length, [...r.issues, ...r.errs].slice(0, 5).join(' | '));
    }
    const u = await js(UNITS);
    for (const [k, v] of Object.entries(u)) check(`cálculo: ${k}`, v);
    check('service worker ativo', await js('navigator.serviceWorker.getRegistration().then((r) => !!(r && r.active))'));
    const cached = await js('caches.keys().then(async (k) => k.length ? (await (await caches.open(k[0])).keys()).length : 0)');
    check('arquivos guardados para uso offline', cached > 20, `${cached} arquivos`);
    await w.webContents.session.enableNetworkEmulation({ offline: true });
    await w.reload();
    await wait(2500);
    check('abre sem internet', (await js('document.getElementById("time")?.textContent || ""')).includes(':'));
  } catch (e) { check('execução', false, e.stack); }

  let fail = 0;
  for (const r of results) { if (!r.ok) fail++; console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.extra ? ` (${r.extra})` : ''}`); }
  console.log(fail ? `\n${fail} falha(s)` : '\nTudo certo na versão web.');
  server.close();
  app.exit(fail ? 1 : 0);
});
