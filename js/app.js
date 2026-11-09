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
    Settings.bind();
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
    $$('dialog').forEach((d) => d.addEventListener('mousedown', (e) => { if (e.target === d) d.close(); }));

    const tf = $('#taskForm');
    Pick.bind(tf);
    tf.onsubmit = (e) => { e.preventDefault(); this.saveTask(); };

    const qf = $('#qForm');
    Pick.bind(qf);
    qf.taskId.onchange = () => this.syncQForm();
    qf.total.oninput = qf.correct.oninput = () => this.syncQForm();
    qf.onsubmit = (e) => { e.preventDefault(); this.saveQuestions(); };

    document.addEventListener('keydown', (e) => this.onKey(e));
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

  sendDesktopState() {
    const dk = window.desktop;
    if (!dk) return;
    const def = Timer.def;
    const s = {
      text: Timer.display(), label: def.label, mode: Timer.s.mode,
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
    if (document.querySelector('dialog[open]')) {
      if (e.key.toLowerCase() === 'e' && Stats.isOpen()) Stats.dlg.close();
      return;
    }
    const k = e.key.toLowerCase();
    const map = {
      ' ': () => Timer.toggle(), n: () => this.skip(), r: () => this.stop(),
      e: () => Stats.open(), t: () => this.openTask(), m: () => window.desktop?.toggleMini(), q: () => this.openQ({ taskId: Store.activeTask()?.id }),
      '?': () => $('#keysDlg').showModal(),
      h: () => History.open(Date.now()), d: () => Subjects.open(), c: () => Reviews.open(), s: () => Sims.open(),
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

  onTimerComplete(wasMode, msg, live) {
    this.renderAll();
    this.toast(msg);
    if (!live) return;
    this.beep();
    window.desktop?.attention();
    const st = Store.data.settings;
    if (st.notify && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('Focus', { body: msg, silent: true }); } catch (_) { /* ignore */ }
    }
    const t = Store.activeTask();
    if (wasMode === 'pomodoro' && t?.type === 'questoes' && st.askQuestions) this.openQ({ taskId: t.id });
  },

  /* ---------- renderização ---------- */
  renderAll() {
    this.renderTimer();
    this.renderTasks();
    this.renderToday();
    Week.render();
    Reviews.renderPanel();
    Store.save();
    if (Stats.isOpen()) Stats.render();
    if (Subjects.isOpen()) Subjects.render();
  },

  set(sel, prop, val) { // evita mexer no DOM sem necessidade (render a cada 250ms)
    const key = sel + prop;
    if (this._cache[key] === val) return;
    this._cache[key] = val;
    $(sel)[prop] = val;
  },

  renderTimer() {
    const s = Timer.s, def = Timer.def, running = Timer.running, started = Timer.isStarted();
    if (this._tabMode !== s.mode) {
      this._tabMode = s.mode;
      document.body.dataset.mode = s.mode;
      $$('#modeTabs button').forEach((b) => b.classList.toggle('on', b.dataset.mode === s.mode));
    }
    const txt = Timer.display();
    this.set('#time', 'textContent', txt);
    this.set('#modeLabel', 'textContent', (def.label + (started && !running ? ' · pausado' : '')).toUpperCase());
    const bar = $('#ringBar');
    bar.style.strokeDasharray = RING_C;
    bar.style.strokeDashoffset = (RING_C * (1 - Timer.progress())).toFixed(2);
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
      ? `Trabalhando em: <b>${esc(t.title)}</b>`
      : (def.focus ? 'Nenhuma tarefa ativa — clique numa tarefa para vincular o tempo.' : ''));

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
    $('#today').innerHTML = `
      <div class="today-row">
        <span><b>Hoje</b></span>
        <span><b>${pomos}</b> pomodoro${pomos === 1 ? '' : 's'}</span>
        <span><b>${Fmt.dur(focus)}</b> de foco · meta ${Fmt.dur(goal)}</span>
        <span><b>${Fmt.int(qt)}</b> questões${qt ? ` · ${Fmt.pct(qc / qt)} de acerto` : ''}</span>
      </div>
      <div class="bar" title="${Math.round(pct)}% da meta diária"><i style="width:${pct.toFixed(1)}%"></i></div>`;
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
      el.innerHTML = `<li class="empty">${d.tasks.some((t) => !t.archived) ? 'Todas as tarefas estão concluídas.' : 'Nenhuma tarefa ainda. Crie uma para vincular o tempo de foco e as questões a uma matéria.'}</li>`;
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
    if (t.done && t.type === 'estudo' && topic && !topic.studied) { topic.studied = true; this.toast(`“${topic.name}” marcado como estudado no edital`); }
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
    if (!title) return err('Dê um título para a tarefa (ou escolha uma matéria).', f.title);
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
    f.total.value = q ? q.total : '';
    f.correct.value = q ? q.correct : '';
    f.date.value = D.key(q ? q.date : date ?? Date.now());
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
    const q = d.questions.find((x) => x.id === this.editingQId);
    if (q) {
      const date = f.date.value === D.key(q.date) ? q.date : D.fromKey(f.date.value) + 12 * 3600000;
      Object.assign(q, { taskId: t?.id ?? null, subjectId: subjectId ?? null, topicId: topicId ?? null, total, correct, date });
      d.reviews.forEach((r) => { if (r.qId === q.id && !r.done) Object.assign(r, { wrong: total - correct, subjectId: q.subjectId, topicId: q.topicId }); });
      this.toast('Registro atualizado');
    } else {
      const date = f.date.value === D.key(Date.now()) ? Date.now() : D.fromKey(f.date.value) + 12 * 3600000;
      const nq = { id: uid(), date, taskId: t?.id ?? null, subjectId: subjectId ?? null, topicId: topicId ?? null, total, correct };
      d.questions.push(nq);
      const note = f.note.value.trim();
      const rv = f.review.checked ? Store.scheduleReview({ subjectId: nq.subjectId, topicId: nq.topicId, wrong: total - correct, note, from: date, qId: nq.id }) : null;
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
  beep() {
    if (!Store.data.settings.sound) return;
    try {
      this.unlockAudio();
      const ctx = this.audioCtx, t0 = ctx.currentTime;
      [784, 988, 1319].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        const st = t0 + i * 0.17;
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(0.22, st + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.7);
        o.connect(g).connect(ctx.destination);
        o.start(st);
        o.stop(st + 0.75);
      });
    } catch (_) { /* sem áudio */ }
  },
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
      const json = JSON.stringify({ ...Store.data, exportedAt: new Date().toISOString() });
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
    $('#btnImport').onclick = () => $('#fileImport').click();
    $('#fileImport').onchange = (e) => this.importData(e.target.files[0]).finally(() => { e.target.value = ''; });
    $('#btnDemo').onclick = () => {
      if (Store.hasDemo()) { Store.removeDemo(); App.toast('Dados de exemplo removidos'); }
      else { Store.seedDemo(); App.toast('Dados de exemplo carregados — abra as estatísticas'); }
      this.fill();
      App.renderAll();
    };
    $('#btnClear').onclick = () => {
      if (!confirm('Apagar TODOS os dados (tarefas, sessões, questões, simulados, revisões e configurações)?\nIsso não pode ser desfeito. Considere exportar um backup antes.')) return;
      Store.data = Store.fresh();
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
      s[k] = i.value;
      if (k === 'theme') App.applyTheme();
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

  exportData() {
    const data = { ...Store.data, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `focus-backup-${D.key(Date.now())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },

  async importData(file) {
    if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (!d || !Array.isArray(d.tasks) || !Array.isArray(d.sessions)) throw new Error('formato');
      if (!confirm(`Substituir os dados atuais pelo backup?\n${d.tasks.length} tarefas · ${d.sessions.length} sessões · ${(d.questions || []).length} registros de questões`)) return;
      delete d.exportedAt;
      Store.data = Store.normalize(d);
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
