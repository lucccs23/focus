'use strict';

/* ============================================================
   Personalização: aparência (cor, relógio, tamanho do texto),
   alarmes, tela inicial (painéis, ordem, partes do timer), barra
   do celular, modo foco, troca rápida de tarefa, timers
   personalizados, intervalos de revisão e assistente de início.
   ============================================================ */
const ACCENTS = ['', '#c4623f', '#d14b4b', '#d9822b', '#c9a227', '#5b8a6b', '#2f8f83', '#3f7cc4', '#6b5cc4', '#b5566e', '#7d7a74'];
const ALARMS = { chime: 'Sininho (3 notas)', bell: 'Sino', digital: 'Digital', soft: 'Suave', none: 'Sem som' };
const HOME_PANELS = {
  today: { label: 'Hoje (resumo do dia)', sel: '#today' },
  exams: { label: 'Provas-alvo e "Atacar primeiro"', sel: '#exams' },
  college: { label: 'Notas e faltas (faculdade)', sel: '#college' },
  week: { label: 'Metas da semana (ciclo)', sel: '#week' },
  reviews: { label: 'Revisões e flashcards para hoje', sel: '#reviewsToday' },
  tasks: { label: 'Tarefas', sel: '#tasksSec' },
  dash: { label: 'Últimos 7 dias e constância (tela larga)', sel: '#dash' },
};
const TIMER_PARTS = {
  tabs: 'Abas (Pomodoro, pausas, cronômetro)',
  dots: 'Bolinhas do ciclo',
  task: 'Tarefa ativa',
  counter: 'Contador rápido de questões',
  realtime: 'Tempo real decorrido',
};
const NAV_ITEMS = { btnHistory: 'Histórico', get btnSubjects() { return T.SS || 'Matérias'; }, btnReviews: 'Erros', btnCards: 'Cards', btnSims: 'Simulados', btnStats: 'Estatísticas' };
const DEFAULT_HOME = { order: Object.keys(HOME_PANELS), hidden: [], collapsed: [], parts: { tabs: true, dots: true, task: true, counter: true, realtime: true }, layout: 'auto' };

const Custom = {
  home() {
    const h = Store.data.settings.home || {};
    const order = [...(h.order || []).filter((k) => HOME_PANELS[k]), ...Object.keys(HOME_PANELS).filter((k) => !(h.order || []).includes(k))];
    return { ...DEFAULT_HOME, ...h, order, hidden: h.hidden || [], collapsed: h.collapsed || [], parts: { ...DEFAULT_HOME.parts, ...(h.parts || {}) } };
  },
  saveHome(h) { Store.data.settings.home = h; Store.save(); this.applyHome(); },

  init() {
    // recolher/abrir painéis tocando no título
    $('.app').addEventListener('click', (e) => {
      const h = e.target.closest('.panel > .panel-head h3, #tasksSec > .section-head h2');
      if (!h) return;
      const sec = h.closest('section');
      const key = Object.keys(HOME_PANELS).find((k) => sec.matches(HOME_PANELS[k].sel));
      if (!key) return;
      const home = this.home();
      home.collapsed = home.collapsed.includes(key) ? home.collapsed.filter((x) => x !== key) : [...home.collapsed, key];
      this.saveHome(home);
    });
    $('#btnHome').onclick = () => this.openHome();
    $('#btnHome2').onclick = () => { $('#settingsDlg').close(); this.openHome(); };
    $('#homeDlg').addEventListener('click', (e) => this.onHomeClick(e));
    $('#homeDlg').addEventListener('change', (e) => this.onHomeChange(e));

    // modo foco
    $('#btnZen').onclick = () => this.zen();
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && this._fsByZen) { this._fsByZen = false; this.zen(false); } });

    // troca rápida de tarefa
    $('#activeTask').onclick = (e) => this.taskMenu(e.currentTarget);
    $('#activeTask').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.taskMenu(e.currentTarget); } };

    // contador rápido de questões
    $('#qCounter').onclick = (e) => {
      const b = e.target.closest('[data-qc]');
      if (!b) return;
      if (b.dataset.qc === 'ok') Timer.count(true);
      if (b.dataset.qc === 'no') Timer.count(false);
      if (b.dataset.qc === 'undo') Timer.undoCount();
      if (b.dataset.qc === 'save') App.openQ({ taskId: Store.activeTask()?.id });
    };

    // "Mais" na barra do celular (itens escondidos)
    $('#btnMore').onclick = (e) => {
      const hid = Store.data.settings.navHidden || [];
      App.openMenu(e.currentTarget, hid.filter((id) => NAV_ITEMS[id]).map((id) => ({ label: NAV_ITEMS[id], fn: () => $('#' + id).click() })));
    };

    // assistente de início
    $('#welcomeDlg').addEventListener('click', (e) => {
      const pf = e.target.closest('[data-wz-profile]');
      if (pf) { Profile.set(pf.dataset.wzProfile); this.renderWelcome(); return; }
      const b = e.target.closest('[data-wz]');
      if (!b) return;
      const act = b.dataset.wz;
      if (act === 'own') { this.doneWelcome(); Subjects.open(); setTimeout(() => $('#subjAddForm').name.focus(), 50); }
      if (act === 'template') { const r = Plan.loadTemplate(); App.toast(`${r.ns} ${T.ss} e ${r.nt} ${T.pp} carregados`); App.renderAll(); this.renderWelcome(); }
      if (act === 'exams') { this.doneWelcome(); Subjects.open('exams'); }
      if (act === 'cycle') { this.doneWelcome(); Subjects.open(); setTimeout(() => $('#cycleForm').hours.focus(), 50); }
      if (act === 'skip') this.doneWelcome();
    });

    this.applyLook();
    this.applyHome();
    this.applyNav();
  },

  /* ---------- aparência ---------- */
  applyLook() {
    const s = Store.data.settings, root = document.documentElement;
    if (/^#[0-9a-f]{6}$/i.test(s.accent || '')) {
      root.style.setProperty('--c-focus', s.accent);
      // texto do botão principal: preto ou branco, conforme o contraste
      const n = parseInt(s.accent.slice(1), 16), l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
      root.style.setProperty('--on-accent', l > 0.62 ? '#1b1714' : '#ffffff');
    } else { root.style.removeProperty('--c-focus'); root.style.removeProperty('--on-accent'); }
    document.body.dataset.clock = s.clockFont || 'thin';
    document.body.dataset.ring = s.ringStyle || 'ring';
    // tamanho do texto (no app de desktop existe o zoom próprio)
    if (!window.desktop) root.style.zoom = String(+s.fontScale || 1);
  },

  renderLook() {
    const s = Store.data.settings;
    $('#accentGrid').innerHTML = ACCENTS.map((c) => `<button type="button" class="swatch${(s.accent || '') === c ? ' on' : ''}" data-accent="${c}" title="${c ? c : 'Cor do tema'}" style="${c ? `background:${c}` : ''}">${c ? '' : 'Tema'}</button>`).join('')
      + `<label class="swatch custom${s.accent && !ACCENTS.includes(s.accent) ? ' on' : ''}" title="Outra cor"><input type="color" id="accentPick" value="${/^#[0-9a-f]{6}$/i.test(s.accent || '') ? s.accent : '#c4623f'}">+</label>`;
    $('#accentGrid').onclick = (e) => { const b = e.target.closest('[data-accent]'); if (b) { s.accent = b.dataset.accent; this.lookChanged(); } };
    $('#accentPick').oninput = (e) => { s.accent = e.target.value; this.applyLook(); };
    $('#accentPick').onchange = () => this.lookChanged();
    $('#fontScaleWrap').hidden = !!window.desktop;
  },
  lookChanged() { Store.save(); this.applyLook(); this.renderLook(); App.renderAll(); },

  /* ---------- alarmes (gerados na hora) ---------- */
  alarm(kind, test = false) {
    const s = Store.data.settings;
    if (!s.sound && !test) return;
    const type = kind === 'break' ? s.alarmBreak || 'soft' : s.alarmFocus || 'chime';
    if (type === 'none') return;
    const vol = Math.max(0, Math.min(1, (s.alarmVol ?? 60) / 100));
    try {
      App.unlockAudio();
      const ctx = App.audioCtx, t0 = ctx.currentTime;
      const note = (f, st, dur, peak, wave = 'sine') => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = wave; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + st);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * vol), t0 + st + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + st + dur);
        o.connect(g).connect(ctx.destination);
        o.start(t0 + st); o.stop(t0 + st + dur + 0.05);
      };
      if (type === 'chime') [784, 988, 1319].forEach((f, i) => note(f, i * 0.17, 0.7, 0.35));
      if (type === 'bell') [[523, 0.45], [1046, 0.2], [1568, 0.12], [2093, 0.06]].forEach(([f, a]) => { note(f, 0, 2.4, a); note(f, 1.1, 2.0, a * 0.7); });
      if (type === 'digital') [0, 0.16, 0.5, 0.66, 1.0, 1.16].forEach((st) => note(1760, st, 0.11, 0.18, 'square'));
      if (type === 'soft') { note(392, 0, 1.2, 0.3); note(523, 0.35, 1.4, 0.28); }
    } catch (_) { /* sem áudio */ }
  },

  /* ---------- tela inicial ---------- */
  applyHome() {
    const h = this.home(), b = document.body;
    const foot = $('.foot');
    h.order.forEach((k) => { const el = $(HOME_PANELS[k].sel); if (el) foot.before(el); });
    Object.entries(HOME_PANELS).forEach(([k, p]) => {
      const el = $(p.sel);
      if (!el) return;
      el.classList.toggle('home-off', h.hidden.includes(k));
      el.classList.toggle('collapsed', h.collapsed.includes(k));
    });
    Object.keys(TIMER_PARTS).forEach((k) => b.classList.toggle(`no-${k}`, !h.parts[k]));
    b.classList.toggle('one-col', h.layout === 'one');
    if (typeof Dash !== 'undefined') Dash.render();
  },

  openHome() { this.renderHome(); $('#homeDlg').showModal(); },
  renderHome() {
    const h = this.home();
    $('#homePanels').innerHTML = h.order.map((k, i) => `<div class="hp-row" data-k="${k}">
      <label class="switch"><input type="checkbox" data-hp-show${h.hidden.includes(k) ? '' : ' checked'}> ${HOME_PANELS[k].label}</label>
      <span class="grow"></span>
      <button type="button" class="kebab" data-hp-move="-1" title="Subir" aria-label="Subir"${i === 0 ? ' disabled' : ''}>↑</button>
      <button type="button" class="kebab" data-hp-move="1" title="Descer" aria-label="Descer"${i === h.order.length - 1 ? ' disabled' : ''}>↓</button>
    </div>`).join('');
    $('#homeParts').innerHTML = Object.entries(TIMER_PARTS).map(([k, l]) => `<label class="switch"><input type="checkbox" data-hp-part="${k}"${h.parts[k] ? ' checked' : ''}> ${l}</label>`).join('');
    $$('#homeLayout input').forEach((i) => { i.checked = i.value === h.layout; });
  },
  onHomeClick(e) {
    const mv = e.target.closest('[data-hp-move]');
    if (mv) {
      const h = this.home(), k = mv.closest('[data-k]').dataset.k, i = h.order.indexOf(k), j = i + +mv.dataset.hpMove;
      if (j < 0 || j >= h.order.length) return;
      [h.order[i], h.order[j]] = [h.order[j], h.order[i]];
      this.saveHome(h); this.renderHome();
    }
    if (e.target.closest('#homeReset')) { this.saveHome(JSON.parse(JSON.stringify(DEFAULT_HOME))); this.renderHome(); App.toast('Tela inicial voltou ao padrão'); }
  },
  onHomeChange(e) {
    const h = this.home(), t = e.target;
    if (t.matches('[data-hp-show]')) { const k = t.closest('[data-k]').dataset.k; h.hidden = t.checked ? h.hidden.filter((x) => x !== k) : [...h.hidden, k]; }
    if (t.matches('[data-hp-part]')) h.parts[t.dataset.hpPart] = t.checked;
    if (t.name === 'layout') h.layout = t.value;
    this.saveHome(h);
    App.renderAll();
  },

  /* ---------- barra do celular ---------- */
  applyNav() {
    const hid = Store.data.settings.navHidden || [];
    Object.keys(NAV_ITEMS).forEach((id) => $('#' + id)?.classList.toggle('nav-off', hid.includes(id)));
    $('#btnMore').hidden = !hid.length;
  },
  renderNav() {
    const hid = Store.data.settings.navHidden || [];
    $('#navItems').innerHTML = Object.entries(NAV_ITEMS).map(([id, l]) => `<label class="switch"><input type="checkbox" data-nav="${id}"${hid.includes(id) ? '' : ' checked'}> ${l}</label>`).join('');
    $('#navItems').onchange = (e) => {
      const id = e.target.dataset.nav;
      if (!id) return;
      const s = Store.data.settings;
      s.navHidden = e.target.checked ? (s.navHidden || []).filter((x) => x !== id) : [...(s.navHidden || []), id];
      Store.save(); this.applyNav();
    };
  },

  /* ---------- modo foco (tela cheia) ---------- */
  zen(on = !document.body.classList.contains('zen')) {
    document.body.classList.toggle('zen', on);
    $('#btnZen').title = on ? 'Sair do modo foco (Z ou Esc)' : 'Modo foco — tela cheia (Z)';
    $('#btnZen').classList.toggle('on', on);
    const fs = document.documentElement.requestFullscreen && document.fullscreenEnabled;
    if (on && fs && !document.fullscreenElement) { this._fsByZen = true; document.documentElement.requestFullscreen().catch(() => { this._fsByZen = false; }); }
    if (!on && document.fullscreenElement && this._fsByZen) { this._fsByZen = false; document.exitFullscreen().catch(() => {}); }
    window.scrollTo(0, 0);
    if (typeof Dash !== 'undefined') setTimeout(() => Dash.render(), 50);
  },

  /* ---------- troca rápida de tarefa ---------- */
  taskMenu(anchor) {
    const d = Store.data;
    const open = d.tasks.filter((t) => !t.done && !t.archived).sort((a, b) => a.createdAt - b.createdAt);
    const items = open.map((t) => ({ label: `${d.activeTaskId === t.id ? '✓ ' : '   '}${t.title}`, fn: () => { d.activeTaskId = t.id; App.renderAll(); } }));
    if (items.length) items.push('-');
    if (d.activeTaskId) items.push({ label: 'Sem tarefa ativa', fn: () => { d.activeTaskId = null; App.renderAll(); } });
    items.push({ label: '+ Nova tarefa', fn: () => App.openTask() });
    App.openMenu(anchor, items);
  },

  /* ---------- timers personalizados ---------- */
  renderPresets() {
    const list = Timer.presets();
    $('#presetList').innerHTML = list.length ? list.map((p) => `<div class="preset" data-id="${p.id}"><b>${esc(p.label)}</b><span class="muted">${p.focus} min de foco · ${p.brk} min de pausa</span><button type="button" class="kebab" data-del-preset title="Remover" aria-label="Remover">×</button></div>`).join('')
      : '<p class="hint" style="margin:0 0 6px">Nenhum ainda. Ex.: "Bloco de questões" 50/10 ou "Leitura" 90/20.</p>';
    $('#presetList').onclick = (e) => {
      const b = e.target.closest('[data-del-preset]');
      if (!b) return;
      const id = b.closest('[data-id]').dataset.id, s = Store.data.settings;
      if (Timer.s.mode.endsWith(':' + id)) Timer.setMode('pomodoro');
      s.presets = Timer.presets().filter((x) => x.id !== id);
      Store.save(); this.renderPresets(); App.renderAll();
    };
  },
  addPreset(f) {
    const label = f.plabel.value.trim().slice(0, 24), focus = Math.round(+f.pfocus.value), brk = Math.round(+f.pbrk.value);
    if (!label) return App.toast('Dê um nome ao timer');
    if (!(focus >= 1 && focus <= 240) || !(brk >= 1 && brk <= 120)) return App.toast('Foco de 1 a 240 min e pausa de 1 a 120 min');
    const s = Store.data.settings;
    if (Timer.presets().length >= 4) return App.toast('No máximo 4 timers personalizados');
    s.presets = [...Timer.presets(), { id: uid(), label, focus, brk }];
    f.plabel.value = ''; f.pfocus.value = ''; f.pbrk.value = '';
    Store.save(); this.renderPresets(); App.renderAll();
    App.toast(`Timer "${label}" criado — aparece nas abas do timer`);
  },

  /* ---------- intervalos de revisão ---------- */
  renderSteps() { $('#stepsInput').value = reviewSteps().join(', '); },
  saveSteps(input) {
    const v = [...new Set(input.value.split(/[,;\s]+/).map((x) => Math.round(+x)).filter((x) => x >= 1 && x <= 365))].sort((a, b) => a - b).slice(0, 8);
    if (!v.length) { this.renderSteps(); return App.toast('Use números de dias, ex.: 1, 7, 30'); }
    Store.data.settings.reviewSteps = v;
    Store.save(); this.renderSteps(); App.renderAll();
    App.toast(`Revisões em ${v.join(', ')} dias (vale para os próximos agendamentos)`);
  },

  /* ---------- assistente de início ---------- */
  maybeWelcome() {
    const d = Store.data;
    if (d.settings.onboardDone || d.subjects.length || d.sessions.length || d.tasks.length) return;
    this.renderWelcome();
    $('#welcomeDlg').showModal();
  },
  renderWelcome() {
    const chosen = Profile.chosen();
    $('#wzProfile').hidden = chosen;
    $('#wzSteps').hidden = !chosen;
    $('#wzProfiles').innerHTML = Object.entries(PROFILES).map(([k, p]) => `<button type="button" class="btn wz-p" data-wz-profile="${k}">${p.label}</button>`).join('');
    const tpl = !!Profile.get().template;
    $('#wzTemplate').hidden = !tpl;
    $('#wzOwn').hidden = tpl;
    const has = Store.data.subjects.length > 0;
    $('#wzTemplate').classList.toggle('done', has);
    $('#wzTemplate').querySelector('button').textContent = has ? 'Carregado ✓' : 'Carregar';
  },
  doneWelcome() { Store.data.settings.onboardDone = true; Store.save(); $('#welcomeDlg').close(); },
};
