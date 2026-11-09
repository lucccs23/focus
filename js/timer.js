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
 */
const Timer = {
  s: null,

  init() {
    const saved = Store.data.timer;
    this.s = saved && MODES[saved.mode] ? { cycle: 0, ...saved } : this.blank('pomodoro', 0);
    if (!this.isStarted()) this.s.total = this.durationFor(this.s.mode);
    if (this.running && this.def.countdown && this.remaining() <= 0) this.complete(false);
  },

  blank(mode, cycle) {
    return { mode, total: this.durationFor(mode), acc: 0, segStart: null, firstStart: null, cycle: cycle || 0 };
  },
  durationFor(mode) { return mode === 'stopwatch' ? 0 : (Store.data.settings[mode] || 1) * 60000; },

  get def() { return MODES[this.s.mode]; },
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

  skip() {
    this.commitPartial();
    const next = this.s.mode === 'pomodoro' ? 'short' : 'pomodoro';
    this.s = this.blank(next, this.s.cycle);
    this.persist();
    App.renderAll();
  },

  setMode(mode) {
    if (!MODES[mode] || (mode === this.s.mode && !this.isStarted())) return;
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
    const wasMode = s.mode;
    let next, msg;
    if (wasMode === 'pomodoro') {
      this.log(s.total, end, true);
      const t = Store.activeTask();
      if (t) t.pomos = (t.pomos || 0) + 1;
      s.cycle++;
      next = s.cycle % Store.data.settings.longEvery === 0 ? 'long' : 'short';
      msg = next === 'long' ? 'Pomodoro concluído! Hora da pausa longa.' : 'Pomodoro concluído! Faça uma pausa curta.';
    } else {
      next = 'pomodoro';
      msg = 'Pausa encerrada. Bora focar!';
    }
    this.s = this.blank(next, s.cycle);
    const st = Store.data.settings;
    if (live && (next === 'pomodoro' ? st.autoPomos : st.autoBreaks)) {
      const now = Date.now();
      this.s.segStart = now;
      this.s.firstStart = now;
    }
    this.persist();
    App.onTimerComplete(wasMode, msg, live);
  },

  log(ms, end, completed) {
    if (!completed && ms < MIN_LOG_MS) return null;
    const t = Store.activeTask();
    const sess = {
      id: uid(), start: this.s.firstStart ?? end - ms, end, ms: Math.round(ms),
      mode: this.s.mode === 'stopwatch' ? 'stopwatch' : 'pomodoro',
      taskId: t?.id ?? null, subjectId: t?.subjectId ?? null, topicId: t?.topicId ?? null, taskType: t?.type ?? null, completed,
    };
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
};
