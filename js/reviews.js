'use strict';

/* ============================================================
   Caderno de erros com revisão espaçada (1, 7 e 30 dias)
   ============================================================ */
const Reviews = {
  dlg: null,
  tab: 'due',
  subj: 'all',

  init() {
    this.dlg = $('#revDlg');
    $('#revTab').onclick = (e) => { const b = e.target.closest('button'); if (b) { this.tab = b.dataset.v; this.render(); } };
    $('#revSubject').onchange = (e) => { this.subj = e.target.value; this.render(); };
    $('#revAdd').onclick = () => this.openForm();
    $('#revImport').onclick = () => Importer.open();
    $('#revCancel').onclick = () => { $('#revForm').hidden = true; };
    const f = $('#revForm');
    Pick.bind(f);
    f.onsubmit = (e) => { e.preventDefault(); this.saveForm(); };
    const act = (e) => {
      const b = e.target.closest('[data-rv]');
      if (!b) return;
      const r = Store.data.reviews.find((x) => x.id === b.closest('[data-id]').dataset.id);
      if (!r) return;
      ({ done: () => this.markDone(r), snooze: () => this.snooze(r), del: () => this.del(r), undo: () => this.undo(r), all: () => this.open() })[b.dataset.rv]?.();
    };
    $('#revList').addEventListener('click', act);
    $('#reviewsToday').addEventListener('click', (e) => {
      if (e.target.closest('[data-open-reviews]')) return this.open();
      if (e.target.closest('[data-open-cards]')) return Cards.open();
      act(e);
    });
  },

  open() { this.tab = 'due'; this.dlg.showModal(); this.render(); },
  isOpen() { return !!this.dlg?.open; },

  endOfToday() { return D.addDays(D.sod(Date.now()), 1); },
  due() { const e = this.endOfToday(); return Store.data.reviews.filter((r) => !r.done && r.due < e).sort((a, b) => a.due - b.due); },

  markDone(r) {
    r.stage++;
    r.lastAt = Date.now();
    if (r.stage >= reviewSteps().length) { r.done = true; r.doneAt = Date.now(); App.toast('Revisão concluída — saiu do caderno 🎉'); }
    else {
      r.due = D.addDays(D.sod(Date.now()), reviewSteps()[r.stage] - reviewSteps()[r.stage - 1]);
      App.toast(`Próxima revisão em ${D.ddmm(r.due)}`);
    }
    this.changed();
  },
  snooze(r) { r.due = D.addDays(D.sod(Date.now()), 1); App.toast('Adiada para amanhã'); this.changed(); },
  undo(r) { r.done = false; r.stage = Math.max(0, reviewSteps().length - 1); r.due = D.sod(Date.now()); this.changed(); },
  del(r) {
    if (!confirm('Excluir esta anotação do caderno de erros?')) return;
    Store.data.reviews = Store.data.reviews.filter((x) => x.id !== r.id);
    this.changed();
  },
  changed() { App.renderAll(); this.render(); },

  openForm() {
    const f = $('#revForm');
    const t = Store.activeTask();
    Pick.fill(f, t?.subjectId, t?.topicId);
    f.wrong.value = 1;
    f.note.value = '';
    $('#revErr').textContent = '';
    f.hidden = false;
    f.note.focus();
  },
  saveForm() {
    const f = $('#revForm');
    const pick = Pick.read(f);
    if (pick.error) { $('#revErr').textContent = pick.error; pick.el.focus(); return; }
    const wrong = Math.max(0, Math.round(+f.wrong.value || 0));
    const note = f.note.value.trim();
    if (!wrong && !note) { $('#revErr').textContent = 'Informe quantas questões errou ou escreva uma anotação.'; return; }
    Store.scheduleReview({ subjectId: pick.subjectId, topicId: pick.topicId, wrong, note });
    f.hidden = true;
    this.tab = 'next';
    App.toast(`Revisão agendada para ${D.ddmm(D.addDays(D.sod(Date.now()), reviewSteps()[0]))}`);
    this.changed();
  },

  dueText(r) {
    if (r.done) return `concluída em ${D.ddmm(r.doneAt || r.lastAt || r.due)}`;
    const days = Math.round((D.sod(r.due) - D.sod(Date.now())) / DAY);
    if (days < 0) return `<span class="down">atrasada ${-days} dia${days === -1 ? '' : 's'}</span>`;
    if (days === 0) return '<b>para hoje</b>';
    if (days === 1) return 'amanhã';
    return `em ${days} dias · ${D.ddmm(r.due)}`;
  },

  row(r, compact = false) {
    const steps = reviewSteps().map((d, i) => `<i class="${i < r.stage || r.done ? 'ok' : i === r.stage ? 'cur' : ''}" title="${d} dia${d === 1 ? '' : 's'}">${d}d</i>`).join('');
    const isDue = !r.done && r.due < this.endOfToday();
    return `<div class="rv${isDue ? ' due' : ''}" data-id="${r.id}">
      <div class="rv-main">
        <span class="tag" style="--c:${Store.subjectColor(r.subjectId)}">${esc(Store.label(r.subjectId, r.topicId))}</span>
        ${r.note ? `<div class="rv-note">${esc(r.note)}</div>` : ''}
        ${r.text && !compact ? `<details class="rv-text"><summary>ver questão completa</summary><pre>${esc(r.text)}</pre></details>` : ''}
        <small>${r.wrong ? `${r.wrong} erro${r.wrong === 1 ? '' : 's'} · ` : ''}registrado em ${D.ddmm(r.createdAt)} · ${this.dueText(r)}</small>
      </div>
      <div class="rv-steps">${steps}</div>
      <div class="rv-actions">
        ${r.done ? '<button class="btn sm" data-rv="undo">Reabrir</button>'
          : `${isDue ? '<button class="btn primary sm" data-rv="done">Revisei</button><button class="btn sm" data-rv="snooze">Amanhã</button>' : '<button class="btn sm" data-rv="done">Revisei antes</button>'}`}
        ${compact ? '' : '<button class="kebab" data-rv="del" title="Excluir" aria-label="Excluir">×</button>'}
      </div>
    </div>`;
  },

  // Painel na tela inicial + contador no botão do topo
  renderPanel() {
    const due = this.due();
    const badge = $('#revBadge');
    badge.hidden = !due.length;
    badge.textContent = due.length > 99 ? '99+' : due.length;
    const el = $('#reviewsToday');
    const cardsDue = Cards.due().length;
    el.hidden = !due.length && !cardsDue;
    if (el.hidden) return;
    const show = due.slice(0, 4);
    el.innerHTML = `
      <div class="panel-head"><h3>Revisões para hoje <span class="count">${due.length + cardsDue}</span></h3>${due.length ? '<button class="link" data-open-reviews>Abrir caderno de erros</button>' : ''}</div>
      ${cardsDue ? `<div class="fc-due"><span><b>${cardsDue}</b> flashcard${cardsDue === 1 ? '' : 's'} para revisar</span><button class="btn primary sm" data-open-cards>Estudar cartões</button></div>` : ''}
      ${due.length ? `<div class="rv-list">${show.map((r) => this.row(r, true)).join('')}</div>` : ''}
      ${due.length > show.length ? `<p class="hint" style="margin:8px 0 0">+ ${due.length - show.length} outras no caderno de erros.</p>` : ''}`;
  },

  render() {
    if (!this.isOpen()) return;
    $$('#revTab button').forEach((b) => b.classList.toggle('on', b.dataset.v === this.tab));
    const sel = $('#revSubject');
    sel.innerHTML = '<option value="all">Todas as áreas</option>' + Store.data.subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    sel.value = Store.subject(this.subj) ? this.subj : 'all';
    const e = this.endOfToday();
    let list = Store.data.reviews.filter((r) => sel.value === 'all' || r.subjectId === sel.value);
    if (this.tab === 'due') list = list.filter((r) => !r.done && r.due < e).sort((a, b) => a.due - b.due);
    else if (this.tab === 'next') list = list.filter((r) => !r.done && r.due >= e).sort((a, b) => a.due - b.due);
    else list = list.filter((r) => r.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    const counts = { due: 0, next: 0, done: 0 };
    Store.data.reviews.forEach((r) => { counts[r.done ? 'done' : r.due < e ? 'due' : 'next']++; });
    $$('#revTab button').forEach((b) => { b.textContent = `${{ due: 'Para revisar', next: 'Próximas', done: 'Concluídas' }[b.dataset.v]} (${counts[b.dataset.v]})`; });
    const empty = { due: 'Nada para revisar hoje. 👌', next: 'Nenhuma revisão agendada.', done: 'Nenhuma revisão concluída ainda.' }[this.tab];
    $('#revList').innerHTML = list.length ? `<div class="rv-list">${list.slice(0, 300).map((r) => this.row(r)).join('')}</div>` : `<p class="empty">${empty}</p>`;
  },
};
