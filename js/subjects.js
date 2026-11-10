'use strict';

/* ============================================================
   Pick: seletores "Matéria" + "Assunto" reaproveitados nos formulários
   (campos subjectId, topicId, newSubject, newTopic e [data-new]).
   ============================================================ */
const Pick = {
  bind(form) {
    form.subjectId.addEventListener('change', () => {
      this.fillTopics(form, null);
      this.toggleNew(form);
      if (form.subjectId.value === '__new') form.newSubject.focus();
    });
    form.topicId.addEventListener('change', () => {
      this.toggleNew(form);
      if (form.topicId.value === '__new') form.newTopic.focus();
    });
  },

  fill(form, subjectId, topicId) {
    const subs = Store.data.subjects;
    form.subjectId.innerHTML = '<option value="">Sem área</option>'
      + subs.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')
      + '<option value="__new">+ Nova área…</option>';
    form.subjectId.value = subs.some((s) => s.id === subjectId) ? subjectId : '';
    form.newSubject.value = '';
    form.newTopic.value = '';
    this.fillTopics(form, topicId);
    this.toggleNew(form);
  },

  fillTopics(form, topicId) {
    const sid = form.subjectId.value;
    const s = Store.subject(sid);
    const topics = s ? s.topics : [];
    form.topicId.innerHTML = '<option value="">Sem tema</option>'
      + topics.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')
      + (sid ? '<option value="__new">+ Novo tema…</option>' : '');
    form.topicId.value = topics.some((t) => t.id === topicId) ? topicId : '';
    form.topicId.disabled = !sid;
  },

  toggleNew(form) {
    $('[data-new="subject"]', form).hidden = form.subjectId.value !== '__new';
    $('[data-new="topic"]', form).hidden = form.topicId.value !== '__new';
  },

  // Lê a escolha, criando matéria/assunto novos se for o caso. Retorna {subjectId, topicId} ou {error}.
  read(form) {
    let subjectId = form.subjectId.value || null;
    let topicId = form.topicId.value || null;
    if (subjectId === '__new') {
      const s = Store.addSubject(form.newSubject.value);
      if (!s) return { error: 'Digite o nome da nova área.', el: form.newSubject };
      subjectId = s.id;
    }
    if (topicId === '__new') {
      const t = Store.addTopic(subjectId, form.newTopic.value);
      if (!t) return { error: 'Digite o nome do novo tema.', el: form.newTopic };
      topicId = t.id;
    }
    return { subjectId, topicId };
  },
};

/* ============================================================
   Áreas, temas, provas-alvo e metas (ciclo de estudos)
   ============================================================ */
const Subjects = {
  dlg: null,
  noteTopic: null,

  init() {
    this.dlg = $('#subjDlg');
    $('#subjAddForm').onsubmit = (e) => {
      e.preventDefault();
      const inp = e.target.name;
      if (Store.addSubject(inp.value, { weight: 1, diff: 2 })) { inp.value = ''; this.changed(); }
    };
    $('#btnTemplate').onclick = () => {
      const { ns, nt } = Plan.loadTemplate();
      App.toast(ns || nt ? `Modelo carregado: ${ns} área(s) e ${nt} tema(s) novos` : 'O modelo já estava carregado');
      this.changed();
    };
    // provas-alvo
    $('#examAdd').onsubmit = (e) => {
      e.preventDefault();
      const f = e.target, name = f.name.value.trim();
      if (!name || !f.date.value) { App.toast('Informe o nome e a data da prova'); return; }
      const s = Store.data.settings;
      s.exams = [...(s.exams || []), { id: uid(), name, date: D.fromKey(f.date.value) }];
      f.name.value = ''; f.date.value = '';
      this.changed();
    };
    $('#examList').onclick = (e) => {
      const b = e.target.closest('[data-del-exam]');
      if (!b) return;
      const s = Store.data.settings;
      s.exams = (s.exams || []).filter((x) => x.id !== b.dataset.delExam);
      this.changed();
    };
    // ciclo: distribuir metas
    $('#cycleForm').onsubmit = (e) => {
      e.preventDefault();
      const f = e.target, s = Store.data.settings;
      const h = Math.max(0, Math.min(150, +f.hours.value || 0)), q = Math.max(0, Math.min(5000, Math.round(+f.qs.value || 0)));
      if (!h && !q) { App.toast('Informe as horas e/ou questões por semana'); return; }
      if (!Store.data.subjects.length) { App.toast('Cadastre as áreas primeiro'); return; }
      s.weeklyH = h; s.weeklyQ = q;
      Plan.distribute(h, q);
      App.toast('Metas semanais distribuídas pelo peso e pela dificuldade');
      this.changed();
    };

    const box = $('#subjCards');
    box.addEventListener('change', (e) => this.onChange(e));
    box.addEventListener('click', (e) => this.onClick(e));
    box.addEventListener('submit', (e) => {
      e.preventDefault();
      const card = e.target.closest('.scard');
      const names = e.target.names.value.split(/\r?\n/).map((x) => x.replace(/^[\s\-–•\d.)]+/, '').trim()).filter(Boolean);
      names.forEach((n) => Store.addTopic(card.dataset.id, n));
      this.changed();
      $(`.scard[data-id="${card.dataset.id}"] textarea`)?.focus();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && e.target.tagName === 'TEXTAREA') { e.preventDefault(); e.target.form.requestSubmit(); }
    });

    // anotações do tema
    const nf = $('#noteForm');
    nf.onsubmit = (e) => {
      e.preventDefault();
      const t = Store.topic(this.noteTopic);
      if (t) t.notes = nf.notes.value.trim();
      $('#noteDlg').close();
      this.changed();
    };
    nf.notes.addEventListener('input', () => this.noteLinks());
  },

  open(section) {
    this.dlg.showModal();
    this.render();
    if (section === 'exams') { $('#examAdd').name.focus(); $('#examSec').scrollIntoView({ block: 'start' }); }
  },
  isOpen() { return !!this.dlg?.open; },
  changed() { this.render(); App.renderAll(); },

  openNote(topicId) {
    const t = Store.topic(topicId);
    if (!t) return;
    this.noteTopic = topicId;
    const s = Store.data.subjects.find((x) => x.topics.includes(t));
    $('#noteTitle').textContent = t.name;
    $('#noteSub').textContent = s ? s.name : '';
    $('#noteForm').notes.value = t.notes || '';
    this.noteLinks();
    $('#noteDlg').showModal();
    $('#noteForm').notes.focus();
  },
  // links encontrados na anotação viram botões clicáveis
  noteLinks() {
    const urls = [...new Set(($('#noteForm').notes.value.match(/https?:\/\/[^\s<>"']+/g) || []))];
    $('#noteLinks').innerHTML = urls.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//, '').slice(0, 60))}</a>`).join('');
  },

  onChange(e) {
    const card = e.target.closest('.scard');
    if (!card) return;
    const s = Store.subject(card.dataset.id);
    if (!s) return;
    const f = e.target.dataset.f, tf = e.target.dataset.t;
    if (f === 'name') { const n = e.target.value.trim(); if (n) s.name = n; else e.target.value = s.name; }
    if (f === 'color') s.color = e.target.value;
    if (f === 'weight') s.weight = Math.max(1, Math.min(5, +e.target.value || 1));
    if (f === 'diff') s.diff = Math.max(1, Math.min(3, +e.target.value || 2));
    if (f === 'goalH' || f === 'goalQ') {
      const v = Math.max(0, Math.min(f === 'goalH' ? 100 : 5000, f === 'goalH' ? Math.round((+e.target.value || 0) * 2) / 2 : Math.round(+e.target.value || 0)));
      s[f] = v; e.target.value = v || '';
    }
    if (tf) {
      const t = s.topics.find((x) => x.id === e.target.closest('tr').dataset.tid);
      if (!t) return;
      if (tf === 'name') { const n = e.target.value.trim(); if (n) t.name = n; else e.target.value = t.name; }
      else if (tf === 'inc') t.inc = e.target.value;
      else t[tf] = e.target.checked;
    }
    this.changed();
  },

  onClick(e) {
    const card = e.target.closest('.scard');
    if (!card) return;
    const s = Store.subject(card.dataset.id);
    if (!s) return;
    const d = Store.data;
    const note = e.target.closest('[data-note]');
    if (note) return this.openNote(note.closest('tr').dataset.tid);
    if (e.target.closest('[data-del-subj]')) {
      if (!confirm(`Excluir a área "${s.name}"?\nTarefas e registros dela passam para "Sem área".`)) return;
      const all = [...d.tasks, ...d.sessions, ...d.questions, ...d.reviews, ...d.cards];
      all.forEach((x) => { if (x.subjectId === s.id) { x.subjectId = null; x.topicId = null; } });
      d.simulados.forEach((sim) => sim.rows.forEach((r) => { if (r.subjectId === s.id) r.subjectId = null; }));
      d.subjects = d.subjects.filter((x) => x.id !== s.id);
      this.changed();
    }
    const del = e.target.closest('[data-del-topic]');
    if (del) {
      const tid = del.closest('tr').dataset.tid;
      const t = s.topics.find((x) => x.id === tid);
      if (!t || !confirm(`Excluir o tema "${t.name}"?\nOs registros dele continuam na área, como "Sem tema".`)) return;
      [...d.tasks, ...d.sessions, ...d.questions, ...d.reviews, ...d.cards].forEach((x) => { if (x.topicId === tid) x.topicId = null; });
      s.topics = s.topics.filter((x) => x.id !== tid);
      this.changed();
    }
  },

  renderExams() {
    const ex = (Store.data.settings.exams || []).slice().sort((a, b) => a.date - b.date);
    $('#examList').innerHTML = ex.length ? ex.map((x) => {
      const n = Plan.daysTo(x.date);
      return `<div class="exam-item"><b>${esc(x.name)}</b><span>${D.ddmmyy(x.date)}</span><span class="muted">${n >= 0 ? `faltam ${n} dia${n === 1 ? '' : 's'}` : 'já passou'}</span>
        <button class="kebab" data-del-exam="${x.id}" title="Remover" aria-label="Remover prova">×</button></div>`;
    }).join('') : '<p class="hint" style="margin:0 0 8px">Nenhuma prova cadastrada.</p>';
    const s = Store.data.settings, f = $('#cycleForm');
    if (document.activeElement !== f.hours) f.hours.value = s.weeklyH || '';
    if (document.activeElement !== f.qs) f.qs.value = s.weeklyQ || '';
  },

  render() {
    if (!this.isOpen()) return;
    this.renderExams();
    Plan.refreshInst?.();
    const subs = Store.data.subjects;
    const qBy = Plan.topicStats();
    const allT = subs.flatMap((s) => s.topics);
    const st = allT.filter((t) => t.studied).length, rv = allT.filter((t) => t.reviewed).length;
    $('#btnTemplate').textContent = subs.length ? 'Completar com o modelo das 5 grandes áreas' : 'Carregar as 5 grandes áreas da residência';
    $('#edSummary').innerHTML = allT.length ? `
      <div class="ed-sum">
        <div><b>${Math.round((st / allT.length) * 100)}%</b> dos temas estudados <span class="muted">· ${st} de ${allT.length} temas · ${rv} revisados</span></div>
        <div class="bar"><i style="width:${((st / allT.length) * 100).toFixed(1)}%"></i></div>
      </div>` : '';

    const dash = '<span class="muted">—</span>';
    const opt = (map, v) => Object.entries(map).map(([k, o]) => `<option value="${k}"${String(v) === k ? ' selected' : ''}>${o.label}</option>`).join('');
    const noteIco = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3.5H7A2.5 2.5 0 0 0 4.5 6v12A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5V9z"/><path d="M14 3.5V9h5.5"/><path d="M8.5 13h7M8.5 16.5h5"/></svg>';
    $('#subjCards').innerHTML = subs.length ? subs.map((s) => {
      const n = s.topics.length, ns = s.topics.filter((t) => t.studied).length, nr = s.topics.filter((t) => t.reviewed).length;
      return `<div class="scard" data-id="${s.id}">
        <div class="scard-head">
          <input type="color" value="${Store.subjectColor(s.id)}" data-f="color" aria-label="Cor">
          <input class="sname" value="${esc(s.name)}" data-f="name" maxlength="60" aria-label="Nome da área">
          <button class="kebab" data-del-subj title="Excluir área" aria-label="Excluir área">×</button>
        </div>
        <div class="scard-goals">
          <label class="goal">Peso na prova <select data-f="weight" aria-label="Peso">${[1, 2, 3, 4, 5].map((v) => `<option${(+s.weight || 1) === v ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="goal">Dificuldade <select data-f="diff" aria-label="Dificuldade">${opt(DIFF, s.diff || 2)}</select></label>
          <label class="goal">Meta/semana <input type="number" min="0" max="100" step="0.5" value="${s.goalH || ''}" placeholder="0" data-f="goalH" aria-label="Horas por semana"> h</label>
          <label class="goal"><input type="number" min="0" max="5000" value="${s.goalQ || ''}" placeholder="0" data-f="goalQ" aria-label="Questões por semana"> questões</label>
        </div>
        ${n ? `<div class="ed-progress"><div class="bar"><i style="width:${((ns / n) * 100).toFixed(1)}%;background:${Store.subjectColor(s.id)}"></i></div><span>${ns}/${n} estudados · ${nr} revisados</span></div>` : ''}
        ${n ? `<div class="tbl-wrap"><table class="tbl topics"><thead><tr><th>Tema</th><th>Incidência</th><th>Teoria</th><th>Revisão</th><th>Questões</th><th>% acerto</th><th></th><th></th></tr></thead><tbody>
          ${s.topics.map((t) => { const q = qBy.get(t.id); return `<tr data-tid="${t.id}">
            <td><input class="tname" value="${esc(t.name)}" data-t="name" maxlength="80" aria-label="Nome do tema"></td>
            <td><select class="tinc inc-${t.inc || 'x'}" data-t="inc" aria-label="Incidência"><option value="">—</option>${opt(INC, t.inc || '')}</select></td>
            <td><input type="checkbox" data-t="studied"${t.studied ? ' checked' : ''} aria-label="Teoria estudada"></td>
            <td><input type="checkbox" data-t="reviewed"${t.reviewed ? ' checked' : ''} aria-label="Revisado"></td>
            <td>${q ? Fmt.int(q.q) : dash}</td><td>${q ? Fmt.pct(q.c / q.q) : dash}</td>
            <td><button class="kebab note-btn${t.notes ? ' has' : ''}" data-note title="${t.notes ? 'Ver anotações' : 'Anotações e links'}" aria-label="Anotações">${noteIco}</button></td>
            <td><button class="kebab" data-del-topic title="Excluir tema" aria-label="Excluir tema">×</button></td></tr>`; }).join('')}
        </tbody></table></div>` : ''}
        <form class="tadd"><textarea name="names" rows="1" placeholder="Novo tema — ou cole uma lista, um por linha"></textarea><button class="btn" type="submit">Adicionar</button></form>
      </div>`;
    }).join('') : '<p class="empty">Nenhuma área ainda. Carregue o modelo das 5 grandes áreas acima ou adicione a primeira.</p>';
  },
};

/* ============================================================
   Metas semanais e ciclo de estudos (cartão da tela inicial)
   ============================================================ */
const Week = {
  progress() {
    const ws = D.weekStart(Date.now());
    const f = new Map(), q = new Map();
    Store.data.sessions.forEach((s) => { if (s.end >= ws && s.subjectId) f.set(s.subjectId, (f.get(s.subjectId) || 0) + s.ms); });
    Store.allQuestions().forEach((x) => { if (x.date >= ws && x.subjectId) q.set(x.subjectId, (q.get(x.subjectId) || 0) + x.total); });
    return Store.data.subjects.filter((s) => s.goalH > 0 || s.goalQ > 0).map((s) => {
      const fh = f.get(s.id) || 0, nq = q.get(s.id) || 0;
      const parts = [];
      if (s.goalH > 0) parts.push(Math.min(1, fh / (s.goalH * 3600000)));
      if (s.goalQ > 0) parts.push(Math.min(1, nq / s.goalQ));
      return { s, fh, nq, ratio: parts.reduce((a, b) => a + b, 0) / parts.length };
    });
  },

  // Próxima matéria do ciclo: a que está mais longe da meta da semana.
  next(rows = this.progress()) {
    return rows.filter((r) => r.ratio < 1).sort((a, b) => a.ratio - b.ratio)[0] || null;
  },

  render() {
    const el = $('#week');
    const subs = Store.data.subjects;
    const rows = this.progress();
    if (!rows.length) {
      el.hidden = !subs.length;
      el.innerHTML = `<div class="panel-head"><h3>Metas da semana</h3></div>
        <p class="hint" style="margin:0">Defina metas semanais (horas e questões) por área para o app sugerir o que estudar a seguir.
        <button class="link" data-open-subjects>Definir metas</button></p>`;
      return;
    }
    el.hidden = false;
    const ws = D.weekStart(Date.now());
    const nx = this.next(rows);
    const bar = (v, color) => `<div class="bar sm"><i style="width:${(Math.min(1, v) * 100).toFixed(1)}%;background:${color}"></i></div>`;
    el.innerHTML = `
      <div class="panel-head"><h3>Metas da semana</h3><span class="muted">${D.ddmm(ws)} – ${D.ddmm(D.addDays(ws, 6))}</span></div>
      <div class="week-rows">
        ${rows.map(({ s, fh, nq }) => `<div class="week-row">
          <span class="tag" style="--c:${Store.subjectColor(s.id)}">${esc(s.name)}</span>
          <div class="week-goal">${s.goalH > 0 ? `${bar(fh / (s.goalH * 3600000), Store.subjectColor(s.id))}<small>${Fmt.dur(fh)} / ${s.goalH}h</small>` : '<small class="muted">sem meta de horas</small>'}</div>
          <div class="week-goal">${s.goalQ > 0 ? `${bar(nq / s.goalQ, Store.subjectColor(s.id))}<small>${Fmt.int(nq)} / ${Fmt.int(s.goalQ)} questões</small>` : '<small class="muted">sem meta de questões</small>'}</div>
        </div>`).join('')}
      </div>
      <div class="cycle-next">${nx
        ? `Próxima no ciclo: <b>${esc(nx.s.name)}</b> <span class="muted">(${Math.round(nx.ratio * 100)}% da meta)</span> <button class="btn primary sm" data-study="${nx.s.id}">Estudar agora</button>`
        : '<b>Todas as metas da semana foram batidas.</b> <span class="muted">Bom trabalho!</span>'}</div>`;
  },

  studyNow(subjectId) {
    const s = Store.subject(subjectId);
    if (!s) return;
    const d = Store.data;
    let t = d.tasks.find((x) => x.subjectId === s.id && !x.done && !x.archived);
    if (!t) {
      const topic = Plan.weak(50).find((w) => w.s === s)?.t || s.topics.find((x) => !x.studied);
      t = { id: uid(), title: `Estudo de ${s.name}${topic ? ` — ${topic.name}` : ''}`, subjectId: s.id, topicId: topic?.id || null, type: 'estudo', est: 1, pomos: 0, focusMs: 0, done: false, archived: false, createdAt: Date.now() };
      d.tasks.push(t);
    }
    d.activeTaskId = t.id;
    if (!Timer.isStarted()) { Timer.setMode('pomodoro'); Timer.start(); }
    App.renderAll();
    App.toast(`Estudando: ${t.title}`);
  },
};
