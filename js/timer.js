'use strict';

const MODES = {
  pomodoro: { label: 'Foco', focus: true, countdown: true },
  short: { label: 'Pausa curta', focus: false, countdown: true },
  long: { label: 'Pausa longa', focus: false, countdown: true },
  stopwatch: { label: 'Cronômetro', focus: true, countdown: false },
};
const MIN_LOG_MS = 60000; // sessões interrompidas com menos de 1 min não são salvas

/*
 * O tempo é calculado por timestamps (não por contagem de ticks), então
 * continua certo mesmo com a aba em segundo plano ou o app fechado.
 *   acc       = tempo acumulado em trechos anteriores (pausas)
 *   segStart  = início do trecho atual (null = pausado)
 *   firstStart= primeiro "play" desta sessão (para o "tempo real decorrido")
 *   qc        = contador rápido de questões {c: acertos, w: erros, task}
 *
 * Timers personalizados (Ajustes): modo "p:<id>" é o foco e "pb:<id>" a pausa dele.
 */
const Timer = {
  s: null,

  presets() { return Array.isArray(Store.data.settings.presets) ? Store.data.settings.presets : []; },
  modeDef(mode) {
    if (MODES[mode]) return MODES[mode];
    const m = /^(p|pb):(.+)$/.exec(mode || '');
    const p = m && this.presets().find((x) => x.id === m[2]);
    if (!p) return null;
    return m[1] === 'p'
      ? { label: p.label, focus: true, countdown: true, preset: p, color: 'pomodoro' }
      : { label: `Pausa · ${p.label}`, focus: false, countdown: true, preset: p, color: 'short' };
  },
  // cor/ícone: timers personalizados usam as cores do foco e da pausa curta
  colorMode(mode = this.s.mode) { return MODES[mode] ? mode : this.modeDef(mode)?.color || 'pomodoro'; },

  init() {
    const saved = Store.data.timer;
    this.s = saved && this.modeDef(saved.mode) ? { cycle: 0, ...saved } : this.blank('pomodoro', 0);
    if (!this.isStarted()) this.s.total = this.durationFor(this.s.mode);
    if (this.running && this.def.countdown && this.remaining() <= 0) this.complete(false);
  },

  blank(mode, cycle) {
    return { mode, total: this.durationFor(mode), acc: 0, segStart: null, firstStart: null, cycle: cycle || 0, qc: this.s?.qc || null };
  },
  durationFor(mode) {
    if (mode === 'stopwatch') return 0;
    const d = this.modeDef(mode);
    if (d?.preset) return (mode.startsWith('pb:') ? d.preset.brk : d.preset.focus) * 60000;
    return (Store.data.settings[mode] || 1) * 60000;
  },

  get def() { return this.modeDef(this.s.mode) || MODES.pomodoro; },
  get running() { return this.s.segStart != null; },
  isStarted() { return this.s.firstStart != null; },
  elapsed(now = Date.now()) { return this.s.acc + (this.s.segStart != null ? now - this.s.segStart : 0); },
  remaining(now = Date.now()) { return this.s.total - this.elapsed(now); },
  display() { return this.def.countdown ? Fmt.clock(this.remaining()) : Fmt.clockUp(this.elapsed()); },
  progress() {
    if (this.def.countdown) return Math.max(0, Math.min(1, this.remaining() / this.s.total));
    return (this.elapsed() % 3600000) / 3600000; // cronômetro: uma volta por hora
  },
  persist() { Store.data.timer = { ...this.s }; Store.save(); },

  start() {
    if (this.running) return;
    const now = Date.now();
    this.s.segStart = now;
    if (this.s.firstStart == null) this.s.firstStart = now;
    this.persist();
    App.unlockAudio();
    App.renderTimer();
  },
  pause() {
    if (!this.running) return;
    this.s.acc += Date.now() - this.s.segStart;
    this.s.segStart = null;
    this.persist();
    App.renderTimer();
  },
  toggle() { this.running ? this.pause() : this.start(); },

  // Para e salva o tempo focado (se houver), voltando ao início do modo atual.
  stop() {
    const sess = this.commitPartial();
    this.s = this.blank(this.s.mode, this.s.cycle);
    this.persist();
    App.renderAll();
    return sess;
  },

  // próximo modo ao pular/terminar
  nextMode(mode, cycle) {
    if (mode.startsWith('p:')) return 'pb:' + mode.slice(2);
    if (mode.startsWith('pb:')) return 'p:' + mode.slice(3);
    if (mode === 'pomodoro') return cycle % Store.data.settings.longEvery === 0 && cycle > 0 ? 'long' : 'short';
    return 'pomodoro';
  },

  skip() {
    this.commitPartial();
    const next = this.s.mode === 'pomodoro' ? 'short' : this.nextMode(this.s.mode, this.s.cycle);
    this.s = this.blank(next, this.s.cycle);
    this.persist();
    App.renderAll();
  },

  setMode(mode) {
    if (!this.modeDef(mode) || (mode === this.s.mode && !this.isStarted())) return;
    this.commitPartial();
    this.s = this.blank(mode, this.s.cycle);
    this.persist();
    App.renderAll();
  },

  tick() {
    if (this.running && this.def.countdown && this.remaining() <= 0) this.complete(true);
  },

  // live=false quando o timer terminou com o app fechado
  complete(live) {
    const s = this.s;
    const end = (s.segStart ?? Date.now()) + (s.total - s.acc);
    const wasMode = s.mode, wasFocus = this.def.focus;
    let msg;
    if (wasFocus) {
      this.log(s.total, end, true);
      const t = Store.activeTask();
      if (t) t.pomos = (t.pomos || 0) + 1;
      s.cycle++;
    }
    const next = this.nextMode(wasMode, s.cycle);
    const nd = this.modeDef(next);
    if (wasFocus) msg = next === 'long' ? 'Foco concluído! Hora da pausa longa.' : 'Foco concluído! Faça uma pausa.';
    else msg = 'Pausa encerrada. Bora focar!';
    this.s = this.blank(next, s.cycle);
    const st = Store.data.settings;
    if (live && (nd?.focus ? st.autoPomos : st.autoBreaks)) {
      const now = Date.now();
      this.s.segStart = now;
      this.s.firstStart = now;
    }
    this.persist();
    App.onTimerComplete(wasMode, msg, live, wasFocus);
  },

  log(ms, end, completed) {
    if (!completed && ms < MIN_LOG_MS) return null;
    const t = Store.activeTask();
    const sess = {
      id: uid(), start: this.s.firstStart ?? end - ms, end, ms: Math.round(ms),
      mode: this.s.mode === 'stopwatch' ? 'stopwatch' : 'pomodoro',
      taskId: t?.id ?? null, subjectId: t?.subjectId ?? null, topicId: t?.topicId ?? null, taskType: t?.type ?? null, completed,
    };
    if (this.def.preset) sess.preset = this.def.preset.label;
    Store.data.sessions.push(sess);
    if (t) t.focusMs = (t.focusMs || 0) + sess.ms;
    return sess;
  },

  // Salva o tempo de uma sessão de foco interrompida.
  commitPartial() {
    if (!this.def.focus || !this.isStarted()) return null;
    const now = Date.now();
    const ms = this.elapsed(now);
    const sess = this.log(ms, now, false);
    if (sess) App.toast(`Sessão salva: ${Fmt.dur(ms)} de foco`);
    else if (ms > 0) App.toast('Sessão com menos de 1 min — não foi salva');
    return sess;
  },

  /* ---------- contador rápido de questões ---------- */
  qc() { const t = Store.activeTask(); const q = this.s.qc; return q && t && q.task === t.id ? q : { c: 0, w: 0, task: t?.id || null }; },
  count(ok) {
    const q = this.qc();
    if (!q.task) return;
    if (ok) q.c++; else q.w++;
    q.last = ok ? 'c' : 'w';
    this.s.qc = q;
    this.persist();
    App.renderTimer();
  },
  undoCount() {
    const q = this.qc();
    if (q.c + q.w === 0) return;
    // desfaz o último toque (guardado em q.last)
    if (q.last === 'c' && q.c) q.c--; else if (q.w) q.w--; else q.c--;
    q.last = null;
    this.s.qc = q;
    this.persist();
    App.renderTimer();
  },
  resetCount() { this.s.qc = null; this.persist(); },
};
