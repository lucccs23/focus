'use strict';

/* ============================================================
   Histórico: ver, editar e apagar sessões e registros de questões;
   adicionar tempo estudado fora do app.
   ============================================================ */
const History = {
  dlg: null,
  day: D.sod(Date.now()),
  editSessId: null,

  init() {
    this.dlg = $('#histDlg');
    $('#histPrev').onclick = () => this.go(-1);
    $('#histNext').onclick = () => this.go(1);
    $('#histToday').onclick = () => { this.day = D.sod(Date.now()); this.render(); };
    $('#histDate').onchange = (e) => { if (e.target.value) { this.day = D.fromKey(e.target.value); this.render(); } };
    $('#histAddTime').onclick = () => this.openSess(null);
    $('#histAddQ').onclick = () => App.openQ({ date: this.day });
    $('#histBody').onclick = (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const id = b.closest('[data-id]').dataset.id;
      ({
        'edit-s': () => this.openSess(Store.data.sessions.find((s) => s.id === id)),
        'del-s': () => this.delSess(id),
        'edit-q': () => App.openQ({ editId: id }),
        'del-q': () => this.delQ(id),
        'open-sim': () => Sims.open(id),
      })[b.dataset.act]?.();
    };
    const f = $('#sessForm');
    Pick.bind(f);
    f.onsubmit = (e) => { e.preventDefault(); this.saveSess(); };
  },

  open(day) {
    if (day != null) this.day = D.sod(day);
    this.dlg.showModal();
    this.render();
  },
  isOpen() { return !!this.dlg?.open; },
  go(n) { this.day = D.addDays(this.day, n); this.render(); },

  render() {
    if (!this.isOpen()) return;
    const d = Store.data, a = this.day, b = D.addDays(a, 1);
    $('#histDate').value = D.key(a);
    $('#histNext').disabled = b > Date.now();
    const ss = d.sessions.filter((s) => s.end >= a && s.end < b).sort((x, y) => x.start - y.start);
    const qs = d.questions.filter((q) => q.date >= a && q.date < b).sort((x, y) => x.date - y.date);
    const sims = d.simulados.filter((s) => s.date >= a && s.date < b);

    const focus = sum(ss, (s) => s.ms);
    const qt = sum(qs, (q) => q.total), qc = sum(qs, (q) => q.correct);
    const kind = (s) => (s.manual ? 'Manual' : s.mode === 'stopwatch' ? 'Cronômetro' : s.completed ? 'Pomodoro' : 'Foco interrompido');
    const btns = (t) => `<button class="kebab" data-act="edit-${t}" title="Editar" aria-label="Editar">✎</button><button class="kebab" data-act="del-${t}" title="Excluir" aria-label="Excluir">×</button>`;

    const rows = [
      ...ss.map((s) => ({ at: s.start, html: `<div class="hrow" data-id="${s.id}">
        <span class="htime">${Fmt.time(s.start)}–${Fmt.time(s.end)}</span>
        <div class="hmain"><span class="tag" style="--c:${Store.subjectColor(s.subjectId)}">${esc(Store.label(s.subjectId, s.topicId))}</span>
          <small>${kind(s)}${s.taskType === 'questoes' ? ' · questões' : ''}${Store.task(s.taskId) ? ` · ${esc(Store.task(s.taskId).title)}` : ''}</small></div>
        <span class="hval">${Fmt.dur(s.ms)}</span>${btns('s')}</div>` })),
      ...qs.map((q) => ({ at: q.date, html: `<div class="hrow" data-id="${q.id}">
        <span class="htime">${Fmt.time(q.date)}</span>
        <div class="hmain"><span class="tag" style="--c:${Store.subjectColor(q.subjectId)}">${esc(Store.label(q.subjectId, q.topicId))}</span>
          <small>Questões${Store.task(q.taskId) ? ` · ${esc(Store.task(q.taskId).title)}` : ''}</small></div>
        <span class="hval">${q.correct}/${q.total} · ${Fmt.pct(q.correct / q.total)}</span>${btns('q')}</div>` })),
      ...sims.map((s) => {
        const t = sum(s.rows, (r) => r.total), c = sum(s.rows, (r) => r.correct);
        return { at: s.date, html: `<div class="hrow" data-id="${s.id}">
          <span class="htime">${Fmt.time(s.date)}</span>
          <div class="hmain"><b>${esc(s.name)}</b><small>Simulado</small></div>
          <span class="hval">${c}/${t} · ${t ? Fmt.pct(c / t) : '—'}</span>
          <button class="kebab" data-act="open-sim" title="Abrir nos simulados" aria-label="Abrir simulado">↗</button><span class="kebab-sp"></span></div>` };
      }),
    ].sort((x, y) => x.at - y.at);

    const isToday = a === D.sod(Date.now());
    $('#histBody').innerHTML = `
      <p class="stats-sub">${isToday ? 'Hoje' : D.weekday(a)}, ${D.ddmmyy(a)} · <b>${Fmt.dur(focus)}</b> de foco · <b>${Fmt.int(qt)}</b> questões${qt ? ` (${Fmt.pct(qc / qt)})` : ''}</p>
      ${rows.length ? `<div class="hlist">${rows.map((r) => r.html).join('')}</div>` : '<p class="empty">Nada registrado neste dia. Use “+ Tempo” para lançar estudo feito fora do app.</p>'}`;
  },

  openSess(s) {
    this.editSessId = s?.id || null;
    const f = $('#sessForm');
    $('#sessDlgTitle').textContent = s ? 'Editar sessão' : 'Adicionar tempo';
    const start = s ? s.start : (this.day === D.sod(Date.now()) ? Date.now() - 3600000 : this.day + 9 * 3600000);
    f.date.value = D.key(start);
    f.time.value = Fmt.time(start);
    f.minutes.value = s ? Math.max(1, Math.round(s.ms / 60000)) : 60;
    const t = Store.activeTask();
    Pick.fill(f, s ? s.subjectId : t?.subjectId, s ? s.topicId : t?.topicId);
    f.type.value = (s ? s.taskType : null) === 'questoes' ? 'questoes' : 'estudo';
    $('#sessErr').textContent = '';
    $('#sessDlg').showModal();
    f.minutes.focus();
  },

  saveSess() {
    const f = $('#sessForm');
    const err = (m, el) => { $('#sessErr').textContent = m; el?.focus(); };
    const min = Math.round(+f.minutes.value);
    if (!f.date.value) return err('Escolha a data.', f.date);
    if (!f.time.value) return err('Informe o horário de início.', f.time);
    if (!(min >= 1 && min <= 1440)) return err('A duração deve ficar entre 1 e 1440 minutos.', f.minutes);
    const [hh, mm] = f.time.value.split(':').map(Number);
    const start = D.fromKey(f.date.value) + (hh * 60 + mm) * 60000;
    const ms = min * 60000;
    if (start + ms > Date.now() + 60000) return err('A sessão não pode terminar no futuro.', f.minutes);
    const pick = Pick.read(f);
    if (pick.error) return err(pick.error, pick.el);
    const type = f.type.value === 'questoes' ? 'questoes' : 'estudo';
    const d = Store.data;
    const s = d.sessions.find((x) => x.id === this.editSessId);
    if (s) {
      const t = Store.task(s.taskId);
      if (t) t.focusMs = Math.max(0, (t.focusMs || 0) + ms - s.ms);
      Object.assign(s, { start, end: start + ms, ms, subjectId: pick.subjectId, topicId: pick.topicId, taskType: type });
      App.toast('Sessão atualizada');
    } else {
      d.sessions.push({ id: uid(), start, end: start + ms, ms, mode: 'manual', manual: true, completed: false, taskId: null, subjectId: pick.subjectId, topicId: pick.topicId, taskType: type });
      App.toast(`${Fmt.dur(ms)} adicionados`);
    }
    $('#sessDlg').close();
    this.day = D.sod(start);
    App.renderAll();
    this.render();
  },

  delSess(id) {
    const d = Store.data, s = d.sessions.find((x) => x.id === id);
    if (!s || !confirm(`Excluir esta sessão de ${Fmt.dur(s.ms)}?`)) return;
    const t = Store.task(s.taskId);
    if (t) {
      t.focusMs = Math.max(0, (t.focusMs || 0) - s.ms);
      if (s.completed && s.mode === 'pomodoro') t.pomos = Math.max(0, (t.pomos || 0) - 1);
    }
    d.sessions = d.sessions.filter((x) => x.id !== id);
    App.renderAll();
    this.render();
  },

  delQ(id) {
    const d = Store.data, q = d.questions.find((x) => x.id === id);
    if (!q || !confirm(`Excluir o registro de ${q.total} questões?\nA revisão agendada para esses erros (se houver e ainda não feita) também sai.`)) return;
    d.questions = d.questions.filter((x) => x.id !== id);
    d.reviews = d.reviews.filter((r) => r.qId !== id || r.done);
    App.renderAll();
    this.render();
  },
};
