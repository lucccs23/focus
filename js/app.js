'use strict';

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.2v13.6c0 .8.9 1.3 1.6.8l10.2-6.8a1 1 0 0 0 0-1.6L9.6 4.4c-.7-.5-1.6 0-1.6.8z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1.3" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.3" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z"/><path d="M12 6.5v13"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l1.8 1.8L9 5.5"/><path d="M4 15l1.8 1.8L9 13.5"/><path d="M12.5 7.5H20"/><path d="M12.5 15.5H20"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5.5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="18.5" r="1.8"/></svg>',
};
const RING_C = 2 * Math.PI * 108;

// temas: base = claro/escuro para o Windows; prev = [fundo, superfície, destaque, texto] para a miniatura
const THEMES = {
  system: { label: 'Do sistema', base: 'system', prev: ['#f7f6f3', '#1e1e1e', '#c4623f', '#888'] },
  light: { label: 'Claro', base: 'light', prev: ['#f7f6f3', '#ffffff', '#c4623f', '#1f1e1c'] },
  dark: { label: 'Escuro', base: 'dark', prev: ['#161616', '#1e1e1e', '#d9805e', '#ecebe7'] },
  paper: { label: 'Papel', base: 'light', prev: ['#f4ecdf', '#fbf6ee', '#b5532f', '#2b2620'] },
  lavender: { label: 'Lavanda', base: 'light', prev: ['#f5f3fa', '#ffffff', '#7c5cc4', '#211d2b'] },
  night: { label: 'Noite', base: 'dark', prev: ['#0f1420', '#161c2b', '#7aa2ff', '#e6eaf2'] },
  forest: { label: 'Floresta', base: 'dark', prev: ['#111612', '#18201a', '#8fc98a', '#e6ece6'] },
  contrast: { label: 'Alto contraste', base: 'dark', prev: ['#000000', '#0b0b0b', '#ffb020', '#ffffff'] },
};

const App = {
  audioCtx: null,
  _cache: {},
  editingTaskId: null,
  editingQId: null,

  init() {
    Store.load();
    this.applyTheme();
    Stats.init();
    History.init();
    Subjects.init();
    Reviews.init();
    Sims.init();
    Report.init();
    Importer.init();
    Plan.init();
    Cards.init();
    Cloud.bind();
    Dash.init();
    Settings.bind();
    Custom.init();
    Timer.init();
    this.bind();
    this.bindDesktop();
    this.renderAll();
    setInterval(() => { Timer.tick(); this.renderTimer(); }, 250);
    document.addEventListener('visibilitychange', () => { Timer.tick(); this.renderTimer(); });
    // virada do dia: atualiza "Hoje", metas e revisões
    let lastDay = D.key(Date.now());
    setInterval(() => { const k = D.key(Date.now()); if (k !== lastDay) { lastDay = k; this.renderAll(); } Backup.run(false); }, 60000);
    Backup.run(false);
    Sync.init();
    setTimeout(() => Custom.maybeWelcome(), 400);
    this.initPwa();
    // versão de celular/navegador: guarda o app no aparelho para funcionar offline
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.desktop) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  },

  /* ---------- eventos ---------- */
  bind() {
    $('#btnPlay').onclick = () => Timer.toggle();
    $('#btnStop').onclick = () => this.stop();
    $('#btnSkip').onclick = () => this.skip();
    $('#modeTabs').onclick = (e) => { const b = e.target.closest('button[data-mode]'); if (b) Timer.setMode(b.dataset.mode); };
    $('#btnStats').onclick = () => Stats.open();
    $('#btnSettings').onclick = () => Settings.open();
    $('#btnHistory').onclick = () => History.open(Date.now());
    $('#btnSubjects').onclick = () => Subjects.open();
    $('#btnReviews').onclick = () => Reviews.open();
    $('#btnSims').onclick = () => Sims.open();
    $('#btnCards').onclick = () => Cards.open();
    $('#btnSound').onclick = (e) => Sound.menu(e.currentTarget);
    $('#btnKeys').onclick = () => $('#keysDlg').showModal();
    $('#btnReport').onclick = () => Report.open();
    $('#btnAddTask').onclick = () => this.openTask();
    $('#btnTasksMenu').onclick = (e) => this.tasksMenu(e.currentTarget);
    $('#taskList').onclick = (e) => this.onTaskClick(e);
    $('#week').onclick = (e) => {
      const b = e.target.closest('[data-study]');
      if (b) return Week.studyNow(b.dataset.study);
      if (e.target.closest('[data-open-subjects]')) Subjects.open();
    };

    // fechar diálogos: botões [data-close] e clique no fundo
    document.addEventListener('click', (e) => { const c = e.target.closest('[data-close]'); if (c) c.closest('dialog')?.close(); });
    $$('dialog').forEach((d) => d.addEventListener('mousedown', (e) => {
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    }));

    const tf = $('#taskForm');
    Pick.bind(tf);
    tf.onsubmit = (e) => { e.preventDefault(); this.saveTask(); };

    const qf = $('#qForm');
    Pick.bind(qf);
    qf.taskId.onchange = () => this.syncQForm();
    qf.total.oninput = qf.correct.oninput = () => this.syncQForm();
    qf.onsubmit = (e) => { e.preventDefault(); this.saveQuestions(); };

    document.addEventListener('keydown', (e) => this.onKey(e));
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => this.applyTheme());
    document.addEventListener('visibilitychange', () => this.syncWakeLock());
    window.addEventListener('resize', () => this.closeMenu());
  },

  applyTheme() {
    let t = Store.data.settings.theme;
    if (!THEMES[t]) t = 'system';
    if (t !== 'system') document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
    // a janela do Windows (barra de título, mini-timer) só conhece claro/escuro
    window.desktop?.setTheme?.(THEMES[t].base);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f7f6f3';
    if (Stats.isOpen?.()) Stats.render(); // gráficos usam as cores do tema
  },

  // Integração com o app de desktop (Electron). No navegador, window.desktop não existe e nada disso roda.
  bindDesktop() {
    const dk = window.desktop;
    if (!dk) return;
    const btn = $('#btnMini');
    btn.hidden = false;
    btn.onclick = () => dk.toggleMini();
    dk.onMiniState((open) => btn.classList.toggle('on', open));
    dk.onCommand((c) => {
      const qWasOpen = $('#qDlg').open;
      if (c === 'toggle') Timer.toggle();
      else if (c === 'skip') this.skip();
      else if (c === 'stop') this.stop();
      if (!qWasOpen && $('#qDlg').open) dk.command('show'); // abriu o pedido de registro de questões
    });
    dk.setPrefs?.({ closeToTray: !!Store.data.settings.closeToTray });
  },

  // abas do timer: as fixas + os timers personalizados
  renderModeTabs() {
    const ps = Timer.presets();
    const key = ps.map((p) => p.id + p.label).join('|');
    if (this._tabsKey === key) return;
    this._tabsKey = key;
    this._tabMode = null;
    const tabs = [['pomodoro', 'Pomodoro'], ['short', 'Pausa curta'], ['long', 'Pausa longa'], ['stopwatch', 'Cronômetro'], ...ps.map((p) => ['p:' + p.id, p.label])];
    $('#modeTabs').innerHTML = tabs.map(([m, l]) => `<button data-mode="${m}">${esc(l)}</button>`).join('');
    $('#modeTabs').classList.toggle('many', tabs.length > 4);
  },

  sendDesktopState() {
    const dk = window.desktop;
    if (!dk) return;
    const def = Timer.def;
    const s = {
      text: Timer.display(), label: def.label, mode: Timer.colorMode(),
      running: Timer.running, started: Timer.isStarted(),
      progress: def.countdown && Timer.isStarted() ? +(1 - Timer.progress()).toFixed(3) : -1,
      task: def.focus ? Store.activeTask()?.title || '' : '',
    };
    const key = JSON.stringify(s);
    if (key === this._lastDesktop) return;
    this._lastDesktop = key;
    dk.sendState(s);
  },

  onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'Escape' && document.body.classList.contains('zen') && !document.querySelector('dialog[open]')) { Custom.zen(false); return; }
    if (document.querySelector('dialog[open]')) {
      if (e.key.toLowerCase() === 'e' && Stats.isOpen()) Stats.dlg.close();
      return;
    }
    const k = e.key.toLowerCase();
    const map = {
      ' ': () => Timer.toggle(), n: () => this.skip(), r: () => this.stop(),
      e: () => Stats.open(), t: () => this.openTask(), m: () => window.desktop?.toggleMini(), q: () => this.openQ({ taskId: Store.activeTask()?.id }),
      '?': () => $('#keysDlg').showModal(),
      h: () => History.open(Date.now()), d: () => Subjects.open(), c: () => Reviews.open(), s: () => Sims.open(), f: () => Cards.open(), z: () => Custom.zen(),
      1: () => Timer.setMode('pomodoro'), 2: () => Timer.setMode('short'), 3: () => Timer.setMode('long'), 4: () => Timer.setMode('stopwatch'),
    };
    if (map[k]) { e.preventDefault(); this.closeMenu(); map[k](); }
  },

  stop() {
    const t = Store.activeTask();
    const sess = Timer.stop();
    if (sess && t?.type === 'questoes' && Store.data.settings.askQuestions) this.openQ({ taskId: t.id });
  },
  skip() { Timer.s.mode === 'stopwatch' ? this.stop() : Timer.skip(); },

  onTimerComplete(wasMode, msg, live, wasFocus) {
    this.renderAll();
    this.toast(msg);
    if (!live) return;
    Custom.alarm(wasFocus ? 'focus' : 'break');
    // celular: vibra junto com o som (útil no silencioso)
    if (!window.desktop && Store.data.settings.sound) try { navigator.vibrate?.([250, 120, 250]); } catch (_) { /* sem vibração */ }
    window.desktop?.attention();
    const st = Store.data.settings;
    if (st.notify && 'Notification' in window && Notification.permission === 'granted') this.notify(msg);
    const t = Store.activeTask();
    if (wasFocus && wasMode !== 'stopwatch' && t?.type === 'questoes' && st.askQuestions) this.openQ({ taskId: t.id });
  },

  /* ---------- app instalado (celular/tablet) ---------- */
  isStandalone() { return !!(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone); },
  isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); },

  initPwa() {
    if (window.desktop) return;
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); this._installEvt = e; if ($('#settingsDlg').open) Settings.fillInstall(); });
    window.addEventListener('appinstalled', () => { this._installEvt = null; this.toast('Focus instalado na tela inicial'); if ($('#settingsDlg').open) Settings.fillInstall(); });
    $('#updBtn').onclick = () => location.reload();
    const sw = navigator.serviceWorker;
    if (!sw) return;
    // versão nova publicada: avisa (só se já havia uma versão rodando antes)
    const had = !!sw.controller;
    sw.addEventListener('controllerchange', () => {
      if (!had) return;
      if (Timer.running) { this._updPending = true; return; } // não interrompe um timer rodando
      $('#updBar').hidden = false;
    });
  },

  notify(msg) {
    const opts = { body: msg, icon: 'icons/icon-192.png', tag: 'focus-timer', silent: true };
    // celular (Android): new Notification() não é permitido, só pelo service worker
    if (!window.desktop && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.ready.then((r) => r.showNotification('Focus', opts)).catch(() => {});
      return;
    }
    try { new Notification('Focus', opts); } catch (_) { /* sem notificação */ }
  },

  // Celular/tablet: mantém a tela ligada enquanto o timer roda (senão o aparelho dorme e o alarme atrasa).
  syncWakeLock() {
    if (window.desktop || !navigator.wakeLock) return;
    const want = !!Store.data.settings.wakeLock && Timer.running && document.visibilityState === 'visible';
    if (want && !this._wake && !this._wakeBusy && Date.now() - (this._wakeFailAt || 0) > 15000) {
      this._wakeBusy = true;
      navigator.wakeLock.request('screen')
        .then((w) => { this._wake = w; w.addEventListener('release', () => { if (this._wake === w) this._wake = null; }); })
        .catch(() => { this._wakeFailAt = Date.now(); })
        .finally(() => { this._wakeBusy = false; });
    } else if (!want && this._wake) {
      const w = this._wake;
      this._wake = null;
      w.release().catch(() => {});
    }
  },

  /* ---------- renderização ---------- */
  renderAll() {
    this.renderTimer();
    this.renderTasks();
    this.renderToday();
    Week.render();
    Reviews.renderPanel();
    Plan.render();
    Dash.render();
    const cd = Cards.due().length, cb = $('#cardBadge');
    cb.hidden = !cd;
    cb.textContent = cd > 99 ? '99+' : cd;
    Store.save();
    if (Stats.isOpen()) Stats.render();
    if (Subjects.isOpen()) Subjects.render();
    if (Cards.isOpen()) Cards.render();
  },

  set(sel, prop, val) { // evita mexer no DOM sem necessidade (render a cada 250ms)
    const key = sel + prop;
    if (this._cache[key] === val) return;
    this._cache[key] = val;
    $(sel)[prop] = val;
  },

  renderTimer() {
    const s = Timer.s, def = Timer.def, running = Timer.running, started = Timer.isStarted();
    this.renderModeTabs();
    if (this._tabMode !== s.mode) {
      this._tabMode = s.mode;
      document.body.dataset.mode = Timer.colorMode();
      const tab = s.mode.startsWith('pb:') ? 'p:' + s.mode.slice(3) : s.mode;
      $$('#modeTabs button').forEach((b) => b.classList.toggle('on', b.dataset.mode === tab));
    }
    const txt = Timer.display();
    this.set('#time', 'textContent', txt);
    this.set('#modeLabel', 'textContent', (def.label + (started && !running ? ' · pausado' : '')).toUpperCase());
    const bar = $('#ringBar');
    bar.style.strokeDasharray = RING_C;
    bar.style.strokeDashoffset = (RING_C * (1 - Timer.progress())).toFixed(2);
    $('#ringLin').style.width = ((1 - Timer.progress()) * 100).toFixed(2) + '%';
    this.set('#btnPlay', 'innerHTML', running ? ICON.pause : ICON.play);
    $('#btnStop').disabled = !started;

    const every = Store.data.settings.longEvery;
    let filled = s.cycle % every;
    if (s.mode === 'long' && filled === 0 && s.cycle > 0) filled = every;
    let dots = '';
    for (let i = 0; i < every; i++) dots += `<i class="dot${i < filled ? ' on' : ''}"></i>`;
    this.set('#cycleDots', 'innerHTML', dots + `<span>${s.cycle} pomodoro${s.cycle === 1 ? '' : 's'} neste ciclo</span>`);

    const t = Store.activeTask();
    this.set('#activeTask', 'innerHTML', t
      ? `Trabalhando em: <b>${esc(t.title)}</b> <span class="caret">▾</span>`
      : (def.focus ? `Nenhuma tarefa ativa — <u>escolher tarefa</u> <span class="caret">▾</span>` : ''));
    // contador rápido de questões (tarefa de questões ativa)
    const qc = Timer.qc(), showQc = t?.type === 'questoes';
    $('#qCounter').hidden = !showQc;
    if (showQc) this.set('#qCounter', 'innerHTML', `
      <button class="btn qc-ok" data-qc="ok" title="Acertei"><b>✓</b> Acertei <span>${qc.c}</span></button>
      <button class="btn qc-no" data-qc="no" title="Errei"><b>✗</b> Errei <span>${qc.w}</span></button>
      <button class="kebab" data-qc="undo" title="Desfazer o último" aria-label="Desfazer"${qc.c + qc.w ? '' : ' disabled'}>↺</button>
      ${qc.c + qc.w ? `<button class="link" data-qc="save">registrar ${qc.c + qc.w}</button>` : ''}`);

    const now = Date.now();
    this.set('#realtime', 'textContent', started
      ? `Iniciado às ${Fmt.time(s.firstStart)} · ${Fmt.clockUp(now - s.firstStart)} desde o início · ${Fmt.clockUp(Timer.elapsed(now))} cronometrado`
      : 'Inicie o timer para ver o tempo real desde o primeiro play (incluindo pausas).');

    const bg = Store.data.settings.bgSound;
    const sb = $('#btnSound');
    sb.classList.toggle('on', bg && bg !== 'none');
    this.set('#btnSound', 'title', bg && bg !== 'none' ? `Som de fundo: ${BG_SOUNDS[bg]}` : 'Som de fundo: desligado');
    Sound.update();

    const title = started ? `${txt} - ${running ? (def.focus ? 'Focado' : def.label) : 'Pausado'}` : 'Focus';
    if (document.title !== title) document.title = title;
    this.sendDesktopState();
    this.syncWakeLock();
    if (this._updPending && !running) { this._updPending = false; $('#updBar').hidden = false; }
  },

  renderToday() {
    const d = Store.data, t0 = D.sod(Date.now());
    const ss = d.sessions.filter((s) => s.end >= t0);
    const qs = Store.allQuestions().filter((q) => q.date >= t0);
    const focus = sum(ss, (s) => s.ms);
    const pomos = ss.filter((s) => s.mode === 'pomodoro' && s.completed).length;
    const qt = sum(qs, (q) => q.total), qc = sum(qs, (q) => q.correct);
    const goal = d.settings.dailyGoalMin * 60000;
    const pct = Math.min(100, (focus / goal) * 100);
    const gq = +d.settings.dailyGoalQ || 0, pq = gq ? Math.min(100, (qt / gq) * 100) : 0;
    $('#today').innerHTML = `
      <div class="today-row">
        <span><b>Hoje</b></span>
        <span><b>${pomos}</b> pomodoro${pomos === 1 ? '' : 's'}</span>
        <span><b>${Fmt.dur(focus)}</b> de foco · meta ${Fmt.dur(goal)}</span>
        <span><b>${Fmt.int(qt)}</b> questões${gq ? ` · meta ${Fmt.int(gq)}` : ''}${qt ? ` · ${Fmt.pct(qc / qt)} de acerto` : ''}</span>
      </div>
      <div class="bar" title="${Math.round(pct)}% da meta diária de foco"><i style="width:${pct.toFixed(1)}%"></i></div>
      ${gq ? `<div class="bar bar-q" title="${Math.round(pq)}% da meta diária de questões"><i style="width:${pq.toFixed(1)}%"></i></div>` : ''}`;
  },

  renderTasks() {
    const d = Store.data, showDone = d.settings.showDone;
    const qBy = new Map();
    d.questions.forEach((q) => {
      if (!q.taskId) return;
      const o = qBy.get(q.taskId) || { t: 0, c: 0 };
      o.t += q.total; o.c += q.correct;
      qBy.set(q.taskId, o);
    });
    const list = d.tasks.filter((t) => !t.archived && (showDone || !t.done))
      .sort((a, b) => (a.done - b.done) || (a.createdAt - b.createdAt));
    const el = $('#taskList');
    if (!list.length) {
      el.innerHTML = `<li class="empty">${d.tasks.some((t) => !t.archived) ? 'Todas as tarefas estão concluídas.' : 'Nenhuma tarefa ainda. Crie uma para vincular o tempo de foco e as questões a uma área.'}</li>`;
      return;
    }
    el.innerHTML = list.map((t) => {
      const q = qBy.get(t.id);
      const meta = [`<span class="tag" style="--c:${Store.subjectColor(t.subjectId)}">${esc(Store.label(t.subjectId, t.topicId))}</span>`];
      if (t.focusMs) meta.push(`<span>${Fmt.dur(t.focusMs)} de foco</span>`);
      if (q) meta.push(`<span>${Fmt.int(q.t)} questões · ${Fmt.pct(q.c / q.t)}</span>`);
      const active = d.activeTaskId === t.id && !t.done;
      return `<li class="task${active ? ' active' : ''}${t.done ? ' done' : ''}" data-id="${t.id}">
        <button class="chk" data-act="done" title="${t.done ? 'Reabrir' : 'Concluir'}" aria-label="${t.done ? 'Reabrir tarefa' : 'Concluir tarefa'}">${ICON.check}</button>
        <span class="ticon" title="${t.type === 'questoes' ? 'Questões' : 'Estudo'}">${t.type === 'questoes' ? ICON.list : ICON.book}</span>
        <div class="tmain"><div class="ttitle">${esc(t.title)}</div><div class="tmeta">${meta.join('')}</div></div>
        <span class="tprog" title="Pomodoros concluídos / estimados">${t.pomos || 0}/${t.est || 1}</span>
        <button class="kebab" data-act="menu" aria-label="Opções da tarefa">${ICON.dots}</button>
      </li>`;
    }).join('');
  },

  /* ---------- tarefas ---------- */
  onTaskClick(e) {
    const li = e.target.closest('.task');
    if (!li) return;
    const t = Store.task(li.dataset.id);
    if (!t) return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'done') return this.toggleDone(t);
    if (act === 'menu') return this.taskMenu(e.target.closest('[data-act]'), t);
    if (!t.done) this.setActive(t);
  },

  setActive(t) {
    Store.data.activeTaskId = Store.data.activeTaskId === t.id ? null : t.id;
    this.renderAll();
  },

  toggleDone(t) {
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : null;
    if (t.done && Store.data.activeTaskId === t.id) Store.data.activeTaskId = null;
    // concluir uma tarefa de estudo com assunto marca a teoria do assunto como estudada
    const topic = Store.topic(t.topicId);
    if (t.done && t.type === 'estudo' && topic && !topic.studied) { topic.studied = true; this.toast(`“${topic.name}” marcado como estudado`); }
    this.renderAll();
    if (t.done && t.type === 'questoes' && !Store.data.questions.some((q) => q.taskId === t.id)) this.openQ({ taskId: t.id });
  },

  taskMenu(anchor, t) {
    const d = Store.data;
    const items = [];
    if (!t.done) items.push({ label: d.activeTaskId === t.id ? 'Desmarcar como ativa' : 'Definir como ativa', fn: () => this.setActive(t) });
    if (t.type === 'questoes') items.push({ label: 'Registrar questões', fn: () => this.openQ({ taskId: t.id }) });
    items.push({ label: 'Editar', fn: () => this.openTask(t) });
    items.push('-');
    items.push({ label: 'Arquivar (some da lista, fica nas estatísticas)', fn: () => { t.archived = true; if (d.activeTaskId === t.id) d.activeTaskId = null; this.renderAll(); } });
    items.push({ label: 'Excluir', danger: true, fn: () => {
      if (!confirm(`Excluir "${t.title}"?\nO tempo e as questões já registrados continuam nas estatísticas.`)) return;
      d.tasks = d.tasks.filter((x) => x.id !== t.id);
      if (d.activeTaskId === t.id) d.activeTaskId = null;
      this.renderAll();
    } });
    this.openMenu(anchor, items);
  },

  tasksMenu(anchor) {
    const d = Store.data;
    const doneCount = d.tasks.filter((t) => t.done && !t.archived).length;
    this.openMenu(anchor, [
      { label: 'Nova tarefa', fn: () => this.openTask() },
      { label: 'Registrar questões avulsas', fn: () => this.openQ({}) },
      { label: 'Adicionar tempo estudado fora do app', fn: () => { History.open(Date.now()); History.openSess(null); } },
      '-',
      { label: d.settings.showDone ? 'Ocultar concluídas' : 'Mostrar concluídas', fn: () => { d.settings.showDone = !d.settings.showDone; this.renderAll(); } },
      { label: `Arquivar concluídas (${doneCount})`, fn: () => { d.tasks.forEach((t) => { if (t.done) t.archived = true; }); this.renderAll(); } },
    ]);
  },

  openTask(t = null) {
    this.editingTaskId = t?.id || null;
    const f = $('#taskForm');
    $('#taskDlgTitle').textContent = t ? 'Editar tarefa' : 'Nova tarefa';
    f.title.value = t?.title || '';
    f.type.value = t?.type || 'estudo';
    const a = Store.activeTask();
    Pick.fill(f, t ? t.subjectId : a?.subjectId, t ? t.topicId : null);
    f.est.value = t?.est || 1;
    $('#taskErr').textContent = '';
    $('#taskDlg').showModal();
    f.title.focus();
  },

  saveTask() {
    const f = $('#taskForm');
    const err = (m, el) => { $('#taskErr').textContent = m; el?.focus(); };
    const pick = Pick.read(f);
    if (pick.error) return err(pick.error, pick.el);
    let title = f.title.value.trim();
    // sem título: usa "Estudo de Matéria — Assunto"
    if (!title && pick.subjectId) title = `${f.type.value === 'questoes' ? 'Questões' : 'Estudo'} de ${Store.label(pick.subjectId, pick.topicId).replace(' · ', ' — ')}`;
    if (!title) return err('Dê um título para a tarefa (ou escolha uma área).', f.title);
    const est = Math.min(50, Math.max(1, Math.round(+f.est.value || 1)));
    const type = f.type.value === 'questoes' ? 'questoes' : 'estudo';
    const d = Store.data;
    const t = Store.task(this.editingTaskId);
    if (t) Object.assign(t, { title, subjectId: pick.subjectId, topicId: pick.topicId, est, type });
    else {
      const nt = { id: uid(), title, subjectId: pick.subjectId, topicId: pick.topicId, type, est, pomos: 0, focusMs: 0, done: false, archived: false, createdAt: Date.now() };
      d.tasks.push(nt);
      if (!Store.activeTask()) d.activeTaskId = nt.id;
    }
    $('#taskDlg').close();
    this.renderAll();
  },

  /* ---------- questões (registrar e editar) ---------- */
  openQ({ taskId = null, editId = null, date = null } = {}) {
    const f = $('#qForm');
    const q = editId ? Store.data.questions.find((x) => x.id === editId) : null;
    this.editingQId = q?.id || null;
    const curTask = q ? q.taskId : taskId;
    $('#qDlgTitle').textContent = q ? 'Editar registro de questões' : 'Registrar questões';
    $('#qSubmit').textContent = q ? 'Salvar' : 'Registrar';
    const tasks = Store.data.tasks.filter((t) => t.type === 'questoes' && (!t.archived || t.id === curTask));
    f.taskId.innerHTML = '<option value="">Sem tarefa (questões avulsas)</option>'
      + tasks.map((t) => `<option value="${t.id}">${esc(t.title)}${t.done ? ' ✓' : ''}</option>`).join('');
    f.taskId.value = tasks.some((t) => t.id === curTask) ? curTask : '';
    const a = Store.activeTask();
    Pick.fill(f, q ? q.subjectId : a?.subjectId, q ? q.topicId : a?.topicId);
    const qc = Timer.qc();
    const useQc = !q && qc.task && qc.task === (tasks.some((t) => t.id === curTask) ? curTask : null) && qc.c + qc.w > 0;
    f.total.value = q ? q.total : useQc ? qc.c + qc.w : '';
    f.correct.value = q ? q.correct : useQc ? qc.c : '';
    f.date.value = D.key(q ? q.date : date ?? Date.now());
    f.inst.value = q ? q.inst || '' : this._lastInst || '';
    Plan.refreshInst?.();
    f.review.checked = true;
    f.note.value = '';
    $('#qReviewWrap').hidden = !!q;
    $('#qErr').textContent = '';
    this.syncQForm();
    $('#qDlg').showModal();
    f.total.focus();
  },

  syncQForm() {
    const f = $('#qForm');
    const t = Store.task(f.taskId.value);
    $('#qSubjWrap').hidden = !!t;
    if (t) { $('[data-new="subject"]', f).hidden = true; $('[data-new="topic"]', f).hidden = true; } else Pick.toggleNew(f);
    const wrong = Math.round(+f.total.value || 0) - Math.round(+f.correct.value || 0);
    const hints = [];
    if (t) {
      const prev = Store.data.questions.filter((q) => q.taskId === t.id && q.id !== this.editingQId);
      const pt = sum(prev, (q) => q.total), pc = sum(prev, (q) => q.correct);
      hints.push(`${Store.label(t.subjectId, t.topicId)} · ${Fmt.dur(t.focusMs || 0)} de foco nesta tarefa` + (pt ? ` · já registradas ${Fmt.int(pt)} questões (${Fmt.pct(pc / pt)})` : ''));
    }
    if (!this.editingQId && f.total.value && f.correct.value !== '' && wrong === 0) hints.push('Sem erros, nenhuma revisão será agendada (a não ser que escreva uma anotação).');
    $('#qHint').textContent = hints.join(' ');
  },

  saveQuestions() {
    const f = $('#qForm');
    const total = Math.round(+f.total.value), correct = Math.round(+f.correct.value);
    const err = (m, el) => { $('#qErr').textContent = m; el?.focus(); };
    if (!(total >= 1)) return err('Informe quantas questões você fez.', f.total);
    if (f.correct.value === '' || correct < 0) return err('Informe quantas você acertou.', f.correct);
    if (correct > total) return err('Os acertos não podem passar do total de questões.', f.correct);
    if (!f.date.value) return err('Escolha a data.', f.date);
    const t = Store.task(f.taskId.value);
    let subjectId, topicId;
    if (t) ({ subjectId, topicId } = t);
    else {
      const pick = Pick.read(f);
      if (pick.error) return err(pick.error, pick.el);
      ({ subjectId, topicId } = pick);
    }
    const d = Store.data;
    const inst = f.inst.value.trim().slice(0, 40);
    this._lastInst = inst;
    const q = d.questions.find((x) => x.id === this.editingQId);
    if (q) {
      const date = f.date.value === D.key(q.date) ? q.date : D.fromKey(f.date.value) + 12 * 3600000;
      Object.assign(q, { taskId: t?.id ?? null, subjectId: subjectId ?? null, topicId: topicId ?? null, total, correct, date, inst });
      d.reviews.forEach((r) => { if (r.qId === q.id && !r.done) Object.assign(r, { wrong: total - correct, subjectId: q.subjectId, topicId: q.topicId }); });
      this.toast('Registro atualizado');
    } else {
      const date = f.date.value === D.key(Date.now()) ? Date.now() : D.fromKey(f.date.value) + 12 * 3600000;
      const nq = { id: uid(), date, taskId: t?.id ?? null, subjectId: subjectId ?? null, topicId: topicId ?? null, total, correct, inst };
      d.questions.push(nq);
      const note = f.note.value.trim();
      const rv = f.review.checked ? Store.scheduleReview({ subjectId: nq.subjectId, topicId: nq.topicId, wrong: total - correct, note, from: date, qId: nq.id }) : null;
      if (Timer.qc().task && Timer.qc().task === nq.taskId) Timer.resetCount();
      this.toast(`Registrado: ${total} questões · ${Fmt.pct(correct / total)}${rv ? ` · revisão em ${D.ddmm(rv.due)}` : ''}`);
    }
    $('#qDlg').close();
    this.renderAll();
    History.render();
  },

  /* ---------- menu, toast, som ---------- */
  openMenu(anchor, items) {
    this.closeMenu();
    const m = document.createElement('div');
    m.className = 'menu';
    items.forEach((it) => {
      if (it === '-') { m.append(document.createElement('hr')); return; }
      const b = document.createElement('button');
      b.textContent = it.label;
      if (it.danger) b.className = 'danger';
      b.onclick = () => { this.closeMenu(); it.fn(); };
      m.append(b);
    });
    document.body.append(m);
    const r = anchor.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth));
    let top = r.bottom + 6;
    if (top + m.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - m.offsetHeight - 6);
    m.style.left = left + 'px';
    m.style.top = top + 'px';
    this._menu = m;
    setTimeout(() => {
      this._menuOff = (e) => { if (!m.contains(e.target)) this.closeMenu(); };
      document.addEventListener('mousedown', this._menuOff);
      window.addEventListener('scroll', this._menuOff, { once: true });
    }, 0);
  },
  closeMenu() {
    if (!this._menu) return;
    this._menu.remove();
    this._menu = null;
    document.removeEventListener('mousedown', this._menuOff);
  },

  toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.classList.remove('show'), 3200);
  },

  unlockAudio() {
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    } catch (_) { /* sem áudio */ }
  },
  beep() { Custom.alarm('focus'); },
};

/* ---------- backup automático (só no app de desktop) ---------- */
const Backup = {
  async run(force) {
    const s = Store.data.settings, dk = window.desktop;
    if (!dk?.writeBackup || !s.backupDir) { if (force) App.toast('Escolha a pasta do backup primeiro'); return; }
    const key = D.key(Date.now());
    if (!force && (!s.autoBackup || s.lastBackupKey === key)) return;
    if (this._busy) return;
    this._busy = true;
    try {
      const json = JSON.stringify(Settings.exportable());
      const res = await dk.writeBackup(s.backupDir, json);
      if (res?.ok) {
        s.lastBackupKey = key;
        s.lastBackupAt = Date.now();
        Store.save();
        if (force) App.toast('Backup salvo');
      } else App.toast(`Falha no backup: ${res?.error || 'erro desconhecido'}`);
    } finally {
      this._busy = false;
      if ($('#settingsDlg').open) Settings.fillBackup();
    }
  },
};

/* ---------- configurações ---------- */
const Settings = {
  open() { this.fill(); $('#settingsDlg').showModal(); },

  renderThemes() {
    const cur = THEMES[Store.data.settings.theme] ? Store.data.settings.theme : 'system';
    $('#themeGrid').innerHTML = Object.entries(THEMES).map(([k, t]) => {
      const [bg, sf, ac, tx] = t.prev;
      const prev = k === 'system'
        ? `<span class="theme-prev" style="background:linear-gradient(90deg,#f7f6f3 50%,#161616 50%)"><i style="background:${ac}"></i><b style="background:#888"></b></span>`
        : `<span class="theme-prev" style="background:${bg}"><i style="background:${ac}"></i><b style="background:${tx}"></b><i style="background:${sf};border:1px solid rgba(128,128,128,.3)"></i></span>`;
      return `<button type="button" class="theme-opt${k === cur ? ' on' : ''}" data-theme-opt="${k}">${prev}${t.label}</button>`;
    }).join('');
  },

  fill() {
    const s = Store.data.settings;
    this.renderThemes();
    $$('#settingsDlg [data-set]').forEach((i) => {
      const k = i.dataset.set;
      if (i.type === 'checkbox') i.checked = !!s[k]; else i.value = s[k];
    });
    $('#btnDemo').textContent = Store.hasDemo() ? 'Remover dados de exemplo' : 'Carregar dados de exemplo';
    $('#desktopSec').hidden = !window.desktop;
    this.fillInstall();
    Cloud.fill();
    Custom.renderLook();
    Custom.renderNav();
    Custom.renderPresets();
    Custom.renderSteps();
    $('#wakeWrap').hidden = !!window.desktop || !navigator.wakeLock;
    $('#dataHint').textContent = window.desktop
      ? 'Tudo fica salvo neste computador. Exporte um backup de vez em quando.'
      : 'Tudo fica salvo neste aparelho (celular e computador têm dados separados). Para levar seus dados de um para o outro, exporte o backup aqui e importe lá.';
    if (window.desktop) {
      this.fillBackup();
      this.fillSync();
      window.desktop.getZoom?.().then((z) => this.showZoom(z));
      window.desktop.shortcutStatus?.().then((failed) => {
        $('#shortcutWarn').textContent = failed?.length ? `Não foi possível registrar: ${failed.join(', ')} (outro programa já usa esse atalho).` : '';
      });
    }
  },

  // mostra o zoom atual no seletor (inclui valores fora da lista, ex. 130% vindo do Ctrl+roda)
  showZoom(z) {
    const sel = $('#zoomSel');
    const v = String(Math.round(z * 100) / 100);
    if (![...sel.options].some((o) => o.value === v)) {
      sel.querySelector('option[data-custom]')?.remove();
      sel.insertAdjacentHTML('beforeend', `<option value="${v}" data-custom>${Math.round(z * 100)}%</option>`);
    }
    sel.value = v;
  },

  fillInstall() {
    const sec = $('#installSec');
    if (window.desktop || App.isStandalone()) { sec.hidden = true; return; }
    sec.hidden = false;
    const evt = App._installEvt;
    $('#btnInstall').hidden = !evt;
    $('#installHint').textContent = evt
      ? 'Instale para abrir pela tela inicial, em tela cheia e sem internet.'
      : App.isIOS()
        ? 'No Safari, toque em Compartilhar (quadrado com seta) e depois em "Adicionar à Tela de Início".'
        : 'No menu do navegador (⋮), escolha "Instalar app" ou "Adicionar à tela inicial".';
  },

  fillSync() { $('#syncInfo').textContent = Sync.status(); },

  fillBackup() {
    const s = Store.data.settings;
    $('#backupInfo').textContent = s.backupDir
      ? `${s.backupDir}${s.lastBackupAt ? ` · último: ${D.ddmmyy(s.lastBackupAt)} ${Fmt.time(s.lastBackupAt)}` : ' · nenhum backup ainda'}`
      : 'Nenhuma pasta escolhida.';
  },

  bind() {
    const dlg = $('#settingsDlg');
    dlg.addEventListener('change', (e) => { const i = e.target.closest('[data-set]'); if (i) this.onSetting(i); });
    dlg.addEventListener('input', (e) => { if (e.target.type === 'range') this.onSetting(e.target); });
    $('#btnOpenSubjects').onclick = () => { dlg.close(); Subjects.open(); };
    $('#themeGrid').onclick = (e) => {
      const b = e.target.closest('[data-theme-opt]');
      if (!b) return;
      Store.data.settings.theme = b.dataset.themeOpt;
      App.applyTheme();
      this.renderThemes();
      App.renderAll();
    };

    $('#btnExport').onclick = () => this.exportData();
    $('#btnImport').onclick = () => { this._merge = false; $('#fileImport').click(); };
    $('#btnMerge').onclick = () => { this._merge = true; $('#fileImport').click(); };
    $('#btnCsv').onclick = () => this.exportCsv();
    $('#presetForm').onsubmit = (e) => { e.preventDefault(); Custom.addPreset(e.target); };
    $('#stepsInput').onchange = (e) => Custom.saveSteps(e.target);
    dlg.addEventListener('click', (e) => { const b = e.target.closest('[data-test-alarm]'); if (b) Custom.alarm(b.dataset.testAlarm, true); });
    $('#fileImport').onchange = (e) => this.importData(e.target.files[0], this._merge).finally(() => { e.target.value = ''; });
    $('#btnDemo').onclick = () => {
      if (Store.hasDemo()) { Store.removeDemo(); App.toast('Dados de exemplo removidos'); }
      else { Store.seedDemo(); App.toast('Dados de exemplo carregados — abra as estatísticas'); }
      this.fill();
      App.renderAll();
    };
    $('#btnClear').onclick = () => {
      if (!confirm('Apagar TODOS os dados (tarefas, sessões, questões, simulados, revisões e configurações)?\nIsso não pode ser desfeito. Considere exportar um backup antes.')) return;
      const deviceId = Store.data.settings.deviceId;
      Store.data = Store.fresh();
      Store.data.settings.deviceId = deviceId;
      window.desktop?.setPrefs?.({ closeToTray: false });
      Timer.init();
      this.fill();
      App.renderAll();
      App.toast('Tudo apagado');
    };
    $('#btnBackupDir').onclick = async () => {
      const dir = await window.desktop?.pickDir?.();
      if (!dir) return;
      Store.data.settings.backupDir = dir;
      Store.data.settings.lastBackupKey = '';
      Store.save();
      this.fillBackup();
      Backup.run(false);
    };
    $('#btnBackupNow').onclick = () => Backup.run(true);
    $('#btnInstall').onclick = async () => {
      const evt = App._installEvt;
      if (!evt) return;
      App._installEvt = null;
      evt.prompt();
      try { await evt.userChoice; } catch (_) { /* ignora */ }
      this.fillInstall();
    };
    $('#btnSyncDir').onclick = async () => {
      const dir = await window.desktop?.pickDir?.();
      if (!dir) return;
      const s = Store.data.settings;
      s.syncDir = dir;
      s.syncOn = true;
      s.syncSeenAt = 0;
      Store.save();
      this.fill();
      Sync.run({ manual: true });
    };
    $('#btnSyncNow').onclick = () => (Sync.enabled() ? Sync.run({ manual: true }) : App.toast('Escolha a pasta e ligue a sincronização primeiro'));
    $('#zoomSel').onchange = (e) => window.desktop?.setZoom?.(+e.target.value);
    window.desktop?.onZoom?.((z) => { if ($('#settingsDlg').open) this.showZoom(z); App.toast(`Zoom: ${Math.round(z * 100)}%`); });
  },

  onSetting(i) {
    const k = i.dataset.set, s = Store.data.settings;
    if (i.tagName === 'SELECT') {
      s[k] = k === 'fontScale' ? +i.value || 1 : i.value;
      if (k === 'theme') App.applyTheme();
      if (['clockFont', 'ringStyle', 'fontScale'].includes(k)) Custom.applyLook();
      if (k === 'alarmFocus' || k === 'alarmBreak') Custom.alarm(k === 'alarmFocus' ? 'focus' : 'break', true);
    } else if (i.type === 'checkbox') {
      s[k] = i.checked;
      if (k === 'notify' && i.checked) this.askNotify(i);
      if (k === 'closeToTray') window.desktop?.setPrefs?.({ closeToTray: i.checked });
      if (k === 'syncOn' && i.checked) { if (!s.syncDir) $('#btnSyncDir').click(); else Sync.run({ manual: true }); }
      if (k === 'autoBackup' && i.checked) { if (!s.backupDir) $('#btnBackupDir').click(); else Backup.run(false); }
    } else {
      let v = Math.round(Number(i.value));
      const min = i.min !== '' ? +i.min : 1, max = i.max !== '' ? +i.max : 9999;
      if (!Number.isFinite(v)) v = s[k];
      v = Math.min(max, Math.max(min, v));
      i.value = v;
      s[k] = v;
    }
    if (!Timer.isStarted()) Timer.s.total = Timer.durationFor(Timer.s.mode);
    Timer.persist();
    if (i.type === 'range') { Sound.update(); return; } // evita redesenhar tudo enquanto arrasta
    App.renderAll();
  },

  askNotify(input) {
    const deny = (msg) => { Store.data.settings.notify = false; input.checked = false; Store.save(); App.toast(msg); };
    if (!('Notification' in window)) return deny('Este navegador não suporta notificações');
    if (Notification.permission === 'granted') return;
    Notification.requestPermission().then((p) => { if (p !== 'granted') deny('Permissão de notificação negada'); });
  },

  // cópia dos dados para backup/exportação, sem o código de acesso do GitHub
  exportable() {
    const data = { ...Store.data, settings: { ...Store.data.settings }, exportedAt: new Date().toISOString() };
    delete data.settings.cloudToken;
    return data;
  },

  // baixa (ou compartilha, no celular) um arquivo
  async saveFile(blob, name, title) {
    const touch = window.matchMedia?.('(hover: none)').matches;
    if (!window.desktop && touch && typeof File === 'function') {
      const file = new File([blob], name, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title }); return; }
        catch (e) { if (e.name === 'AbortError') return; }
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },

  // planilha única (abre no Excel): uma linha por sessão, registro de questões ou área de simulado
  exportCsv() {
    const d = Store.data;
    const cell = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const dt = (ts) => D.ddmmyy(ts).replace(/\/(\d\d)$/, (m, y) => `/20${y}`);
    const rows = [['Tipo', 'Data', 'Hora', 'Área', 'Tema', 'Minutos de foco', 'Questões', 'Acertos', '% acerto', 'Instituição', 'Tarefa / simulado']];
    d.sessions.slice().sort((a, b) => a.start - b.start).forEach((s) => rows.push([
      s.manual ? 'Tempo manual' : s.mode === 'stopwatch' ? 'Cronômetro' : 'Pomodoro', dt(s.start), Fmt.time(s.start),
      Store.subjectName(s.subjectId), s.topicId ? Store.topicName(s.topicId) : '', Math.round(s.ms / 60000), '', '', '', '', Store.task(s.taskId)?.title || '']));
    d.questions.slice().sort((a, b) => a.date - b.date).forEach((q) => rows.push([
      'Questões', dt(q.date), Fmt.time(q.date), Store.subjectName(q.subjectId), q.topicId ? Store.topicName(q.topicId) : '', '',
      q.total, q.correct, q.total ? Fmt.dec((q.correct / q.total) * 100) : '', q.inst || '', Store.task(q.taskId)?.title || '']));
    d.simulados.slice().sort((a, b) => a.date - b.date).forEach((sim) => sim.rows.forEach((r) => rows.push([
      'Simulado', dt(sim.date), Fmt.time(sim.date), Store.subjectName(r.subjectId), '', '', r.total, r.correct,
      r.total ? Fmt.dec((r.correct / r.total) * 100) : '', sim.inst || '', sim.name])));
    const csv = '\ufeff' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
    this.saveFile(new Blob([csv], { type: 'text/csv' }), `focus-registros-${D.key(Date.now())}.csv`, 'Registros do Focus');
  },

  async exportData() {
    const data = this.exportable();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this.saveFile(blob, `focus-backup-${D.key(Date.now())}.json`, 'Backup do Focus');
  },

  async importData(file, merge = false) {
    if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (!d || !Array.isArray(d.tasks) || !Array.isArray(d.sessions)) throw new Error('formato');
      if (merge) {
        if (!confirm(`Juntar o backup com os dados atuais?\nNada daqui é apagado; o que só existe no backup é adicionado.\n${d.sessions.length} sessões · ${(d.questions || []).length} registros de questões no arquivo`)) return;
        delete d.exportedAt;
        const cur = Store.data;
        const out = Sync.merge(cur, Store.normalize(d));
        out.settings = { ...cur.settings }; // preferências deste aparelho continuam as mesmas
        out.timer = cur.timer;
        out.activeTaskId = cur.activeTaskId;
        delete out.deviceId; delete out.app; delete out.rev;
        Store.data = Store.normalize(out);
        Timer.init();
        this.fill();
        App.renderAll();
        App.toast('Backup juntado aos dados deste aparelho');
        return;
      }
      if (!confirm(`Substituir os dados atuais pelo backup?\n${d.tasks.length} tarefas · ${d.sessions.length} sessões · ${(d.questions || []).length} registros de questões`)) return;
      delete d.exportedAt;
      const cur = Store.data;
      const keep = {};
      LOCAL_SETTINGS.forEach((k) => { if (cur.settings[k] !== undefined) keep[k] = cur.settings[k]; });
      d.settings = { ...(d.settings || {}), ...keep };
      d.timer = cur.timer;
      Store.data = Store.normalize(d);
      if (!Store.task(Store.data.activeTaskId)) Store.data.activeTaskId = null;
      Timer.init();
      App.applyTheme();
      this.fill();
      App.renderAll();
      App.toast('Backup importado');
    } catch (e) {
      App.toast('Arquivo inválido — não é um backup do Focus');
    }
  },
};

App.init();
