'use strict';

/* ---------- utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
const pad = (n) => String(n).padStart(2, '0');
const DAY = 86400000;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = (arr, fn) => arr.reduce((a, x) => a + (fn(x) || 0), 0);

const Fmt = {
  // contagem regressiva: arredonda para cima (mostra 25:00 no início, 00:01 no último segundo)
  clock(ms) { return Fmt._hms(Math.max(0, Math.ceil(ms / 1000))); },
  clockUp(ms) { return Fmt._hms(Math.max(0, Math.floor(ms / 1000))); },
  _hms(t) {
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  },
  dur(ms) { // 35h 11min | 45min
    const m = Math.round(ms / 60000);
    return m < 60 ? `${m}min` : `${Math.floor(m / 60)}h ${pad(m % 60)}min`;
  },
  pace(ms) { // 2min 05s | 48s
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${pad(s % 60)}s`;
  },
  int: (n) => Math.round(n).toLocaleString('pt-BR'),
  dec: (n, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }),
  pct: (x) => Fmt.dec(x * 100) + '%',
  time: (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; },
};

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const D = {
  sod(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); },
  addDays(ts, n) { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); }, // seguro com horário de verão
  key(ts) { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; },
  fromKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime(); },
  weekStart(ts) { const d = new Date(D.sod(ts)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); },
  ddmm(ts) { const d = new Date(ts); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; },
  ddmmyy(ts) { const d = new Date(ts); return `${D.ddmm(ts)}/${String(d.getFullYear()).slice(2)}`; },
  weekday(ts) { return WEEKDAYS[new Date(ts).getDay()]; },
};

/* ---------- armazenamento ---------- */
const STORE_KEY = 'focolab.v1';
const PALETTE = ['#c4623f', '#5b8a6b', '#4f6d8f', '#a5772c', '#8a5a8c', '#3f8a8a', '#b5566e', '#6b7a3a', '#7d7a74'];
const REVIEW_STEPS = [1, 7, 30]; // dias após o registro dos erros
// preferências que valem só para este computador (não são sincronizadas)
const LOCAL_SETTINGS = ['closeToTray', 'autoBackup', 'backupDir', 'lastBackupKey', 'lastBackupAt', 'syncOn', 'syncDir', 'deviceId', 'lastSyncAt', 'lastCheckAt', 'syncSeenAt', 'syncSeenRev', 'syncError', 'wakeLock'];
const DEFAULT_SETTINGS = {
  theme: 'system', wakeLock: true,
  syncOn: false, syncDir: '', deviceId: '', lastSyncAt: 0, syncSeenAt: 0,
  bgSound: 'none', bgVolume: 35, bgOnlyFocus: true,
  closeToTray: false, autoBackup: false, backupDir: '', lastBackupKey: '',
  pomodoro: 25, short: 5, long: 15, longEvery: 4,
  autoBreaks: true, autoPomos: false, askQuestions: true,
  sound: true, notify: false, showDone: true, dailyGoalMin: 240,
};

const Store = {
  data: null,

  fresh() {
    return {
      version: 2, settings: { ...DEFAULT_SETTINGS }, subjects: [], tasks: [], activeTaskId: null,
      sessions: [], questions: [], reviews: [], simulados: [], timer: null,
    };
  },

  normalize(d) {
    const f = this.fresh();
    if (!d || typeof d !== 'object') return f;
    const arr = (x) => (Array.isArray(x) ? x : []);
    const out = {
      ...f, ...d,
      settings: { ...f.settings, ...(d.settings || {}) },
      subjects: arr(d.subjects), tasks: arr(d.tasks), sessions: arr(d.sessions), questions: arr(d.questions),
      reviews: arr(d.reviews), simulados: arr(d.simulados),
    };
    // matérias: assuntos (tópicos do edital) e metas semanais
    out.subjects.forEach((s) => { s.topics = arr(s.topics); s.goalH = +s.goalH || 0; s.goalQ = +s.goalQ || 0; });
    return out;
  },

  load() {
    let d = null;
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) d = JSON.parse(raw); }
    catch (e) { console.warn('Não foi possível ler os dados salvos', e); }
    this.data = this.normalize(d);
  },

  save() {
    // marca a hora da última mudança nos dados compartilháveis (usada pela sincronização)
    const shared = this.sharedJSON();
    if (shared !== this._shared) {
      if (this._shared !== undefined) {
        this.data.updatedAt = Date.now();
        if (typeof Sync !== 'undefined') Sync.changed();
      }
      this._shared = shared;
    }
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this.data)); }
    catch (e) { console.warn('Não foi possível salvar', e); }
  },

  // Dados que vão para outros computadores: tudo menos o timer, a tarefa ativa e as preferências locais.
  shared() {
    const { timer, activeTaskId, updatedAt, settings, ...rest } = this.data;
    const s = { ...settings };
    LOCAL_SETTINGS.forEach((k) => delete s[k]);
    return { ...rest, settings: s };
  },
  sharedJSON() { return JSON.stringify(this.shared()); },
  // Depois de trocar os dados por inteiro (sincronização), evita marcar isso como mudança local.
  resetBaseline() { this._shared = this.sharedJSON(); },

  subject(id) { return id ? this.data.subjects.find((s) => s.id === id) || null : null; },
  task(id) { return id ? this.data.tasks.find((t) => t.id === id) || null : null; },
  subjectName(id) { return this.subject(id)?.name || 'Sem matéria'; },
  // só aceita cor no formato #rrggbb (o valor vai direto para o HTML)
  subjectColor(id) { const c = this.subject(id)?.color; return /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#9a968e'; },
  activeTask() { const t = this.task(this.data.activeTaskId); return t && !t.done ? t : null; },

  topic(id) {
    if (!id) return null;
    for (const s of this.data.subjects) { const t = s.topics.find((x) => x.id === id); if (t) return t; }
    return null;
  },
  topicName(id) { return this.topic(id)?.name || 'Sem assunto'; },
  // "Matéria · Assunto" (assunto só se existir)
  label(subjectId, topicId) { const t = this.topic(topicId); return this.subjectName(subjectId) + (t ? ` · ${t.name}` : ''); },

  addSubject(name, extra = {}) {
    const n = String(name || '').trim();
    if (!n) return null;
    const ex = this.data.subjects.find((s) => s.name.toLowerCase() === n.toLowerCase());
    if (ex) return ex;
    const s = { id: uid(), name: n, color: PALETTE[this.data.subjects.length % PALETTE.length], topics: [], goalH: 0, goalQ: 0, ...extra };
    this.data.subjects.push(s);
    return s;
  },

  addTopic(subjectId, name, extra = {}) {
    const s = this.subject(subjectId), n = String(name || '').trim();
    if (!s || !n) return null;
    const ex = s.topics.find((t) => t.name.toLowerCase() === n.toLowerCase());
    if (ex) return ex;
    const t = { id: uid(), name: n, studied: false, reviewed: false, ...extra };
    s.topics.push(t);
    return t;
  },

  // Questões de registros avulsos + simulados (cada matéria do simulado vira uma entrada).
  allQuestions() {
    const out = this.data.questions.slice();
    this.data.simulados.forEach((sim) => sim.rows.forEach((r, i) => {
      if (r.total > 0) out.push({ id: `${sim.id}_${i}`, date: sim.date, subjectId: r.subjectId || null, topicId: null, taskId: null, total: r.total, correct: r.correct, simId: sim.id });
    }));
    return out;
  },

  // Agenda revisões (1, 7 e 30 dias) para os erros de um registro de questões.
  scheduleReview({ subjectId, topicId, wrong, note = '', from = Date.now(), qId = null }) {
    if (!(wrong > 0) && !note) return null;
    const r = { id: uid(), subjectId: subjectId || null, topicId: topicId || null, wrong: wrong || 0, note, createdAt: from, stage: 0, due: D.addDays(D.sod(from), REVIEW_STEPS[0]), done: false, qId };
    this.data.reviews.push(r);
    return r;
  },

  hasDemo() { return ['sessions', 'questions', 'simulados'].some((k) => this.data[k].some((x) => x.demo)); },

  seedDemo() {
    const names = ['Biologia', 'Direito Administrativo', 'Matemática', 'Português'];
    const TOPICS = {
      Biologia: ['Microbiologia', 'Genética', 'Ecologia', 'Citologia'],
      'Direito Administrativo': ['Atos administrativos', 'Licitações', 'Controle da Administração', 'Agentes públicos'],
      'Matemática': ['Porcentagem', 'Razão e proporção', 'Probabilidade', 'Funções'],
      'Português': ['Crase', 'Concordância', 'Interpretação de texto', 'Pontuação'],
    };
    const subs = names.map((n) => {
      const s = Store.addSubject(n, { demo: true });
      TOPICS[n].forEach((tn, i) => Store.addTopic(s.id, tn, { studied: i < 2, reviewed: i < 1 }));
      if (!s.goalH) { s.goalH = [6, 5, 4, 3][names.indexOf(n)]; s.goalQ = [80, 60, 60, 40][names.indexOf(n)]; }
      return s;
    });
    const today = D.sod(Date.now());
    const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    for (let i = 60; i >= 1; i--) {
      if (Math.random() < 0.3) continue; // dias sem estudo
      const day = D.addDays(today, -i);
      let t = day + 8 * 3600000 + rnd(0, 90) * 60000;
      const nTasks = rnd(1, 3);
      for (let k = 0; k < nTasks; k++) {
        const subj = subs[rnd(0, subs.length - 1)];
        const topic = subj.topics[rnd(0, subj.topics.length - 1)];
        const type = Math.random() < 0.6 ? 'questoes' : 'estudo';
        const pomos = rnd(1, 4);
        const task = {
          id: uid(), title: `${type === 'questoes' ? 'Questões' : 'Estudo'} de ${subj.name} — ${topic.name}`, subjectId: subj.id, topicId: topic.id, type,
          est: pomos, pomos, focusMs: 0, done: true, archived: true, createdAt: t, doneAt: 0, demo: true,
        };
        for (let p = 0; p < pomos; p++) {
          const ms = 25 * 60000;
          this.data.sessions.push({ id: uid(), start: t, end: t + ms, ms, mode: 'pomodoro', taskId: task.id, subjectId: subj.id, topicId: topic.id, taskType: type, completed: true, demo: true });
          task.focusMs += ms;
          t += ms + 5 * 60000;
        }
        if (type === 'questoes') {
          const total = rnd(8, 45);
          const acc = 0.62 + Math.random() * 0.3;
          const correct = Math.round(total * acc);
          const q = { id: uid(), date: t, taskId: task.id, subjectId: subj.id, topicId: topic.id, total, correct, demo: true };
          this.data.questions.push(q);
          if (i <= 35) { const r = this.scheduleReview({ subjectId: subj.id, topicId: topic.id, wrong: total - correct, from: t, qId: q.id }); if (r) r.demo = true; }
        }
        task.doneAt = t;
        this.data.tasks.push(task);
        t += 20 * 60000;
      }
    }
    // revisões antigas: avança o estágio como se tivessem sido feitas em dia
    this.data.reviews.forEach((r) => {
      if (!r.demo) return;
      while (r.stage < REVIEW_STEPS.length && r.due < D.addDays(today, -1) && Math.random() < 0.8) {
        r.stage++;
        if (r.stage >= REVIEW_STEPS.length) { r.done = true; break; }
        r.due = D.addDays(D.sod(r.createdAt), REVIEW_STEPS[r.stage]);
      }
    });
    // simulados a cada ~2 semanas
    for (let i = 56; i >= 7; i -= 14) {
      const date = D.addDays(today, -i) + 10 * 3600000;
      this.data.simulados.push({
        id: uid(), name: `Simulado ${Math.round((63 - i) / 14)}`, date, demo: true,
        rows: subs.map((s) => { const total = 20; return { subjectId: s.id, total, correct: Math.round(total * (0.55 + (56 - i) / 300 + Math.random() * 0.2)) }; }),
      });
    }
    this.save();
  },

  removeDemo() {
    const d = this.data;
    d.sessions = d.sessions.filter((x) => !x.demo);
    d.questions = d.questions.filter((x) => !x.demo);
    d.tasks = d.tasks.filter((x) => !x.demo);
    d.reviews = d.reviews.filter((x) => !x.demo);
    d.simulados = d.simulados.filter((x) => !x.demo);
    const used = new Set([...d.tasks, ...d.sessions, ...d.questions].map((x) => x.subjectId));
    d.subjects = d.subjects.filter((s) => !s.demo || used.has(s.id));
    this.save();
  },
};
