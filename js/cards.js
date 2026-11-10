'use strict';

/* ============================================================
   Flashcards com revisão espaçada (no estilo do Anki):
   Errei / Difícil / Bom / Fácil definem quando o cartão volta.
   ============================================================ */
const GRADES = [
  { k: 'again', label: 'Errei', key: '1' },
  { k: 'hard', label: 'Difícil', key: '2' },
  { k: 'good', label: 'Bom', key: '3' },
  { k: 'easy', label: 'Fácil', key: '4' },
];

const Cards = {
  dlg: null,
  tab: 'study',
  subj: 'all',
  editId: null,
  cur: null,       // cartão sendo estudado
  shown: false,    // resposta à mostra
  doneNow: 0,      // cartões revisados nesta sessão

  init() {
    this.dlg = $('#cardDlg');
    $('#cardTab').onclick = (e) => { const b = e.target.closest('button'); if (b) { this.tab = b.dataset.v; this.render(); } };
    $('#cardSubject').onchange = (e) => { this.subj = e.target.value; this.cur = null; this.render(); };
    const f = $('#cardForm');
    Pick.bind(f);
    f.onsubmit = (e) => { e.preventDefault(); this.save(); };
    $('#cardCancel').onclick = () => this.resetForm();
    const imp = $('#cardImpForm');
    Pick.bind(imp);
    imp.text.addEventListener('input', () => this.countImport());
    imp.onsubmit = (e) => { e.preventDefault(); this.importCards(); };
    $('#cardStudy').addEventListener('click', (e) => {
      if (e.target.closest('[data-show]')) return this.show();
      const g = e.target.closest('[data-grade]');
      if (g) return this.grade(g.dataset.grade);
      if (e.target.closest('[data-goto-list]')) { this.tab = 'list'; this.render(); }
    });
    $('#cardList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-card]');
      if (!b) return;
      const c = Store.data.cards.find((x) => x.id === b.closest('[data-id]').dataset.id);
      if (!c) return;
      if (b.dataset.card === 'edit') this.edit(c);
      if (b.dataset.card === 'del' && confirm('Excluir este cartão?')) { Store.data.cards = Store.data.cards.filter((x) => x.id !== c.id); this.changed(); }
    });
    // teclado no estudo: espaço mostra; 1-4 respondem
    this.dlg.addEventListener('keydown', (e) => {
      if (this.tab !== 'study' || !this.cur || e.target.closest('input, textarea, select')) return;
      if ((e.key === ' ' || e.key === 'Enter') && !this.shown) { e.preventDefault(); this.show(); return; }
      const g = this.shown && GRADES.find((x) => x.key === e.key);
      if (g) { e.preventDefault(); this.grade(g.k); }
    });
    $('#revCards').onclick = () => { $('#revDlg').close(); this.open(); };
  },

  open(tab = 'study') { this.tab = tab; this.cur = null; this.doneNow = 0; this.dlg.showModal(); this.resetForm(); this.render(); },
  isOpen() { return !!this.dlg?.open; },
  changed() { this.render(); App.renderAll(); },

  endOfToday() { return D.addDays(D.sod(Date.now()), 1); },
  inScope(c) { return this.subj === 'all' || (c.subjectId || 'none') === this.subj; },
  due(scoped = false) {
    const e = this.endOfToday();
    return Store.data.cards.filter((c) => c.due < e && (!scoped || this.inScope(c))).sort((a, b) => a.due - b.due);
  },

  /* ---------- agenda (revisão espaçada) ---------- */
  next(c, k) {
    let { interval = 0, ease = 2.5, reps = 0 } = c;
    if (k === 'again') return { interval: 0, ease: Math.max(1.3, ease - 0.2), reps: 0, lapse: true };
    if (k === 'hard') interval = reps === 0 ? 1 : Math.max(interval + 1, Math.round(interval * 1.2)), ease = Math.max(1.3, ease - 0.15);
    if (k === 'good') interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(interval + 1, Math.round(interval * ease));
    if (k === 'easy') interval = reps === 0 ? 4 : Math.max(interval + 2, Math.round(interval * ease * 1.3)), ease += 0.15;
    return { interval, ease, reps: reps + 1 };
  },
  label(days) { return days === 0 ? '<10 min' : days === 1 ? '1 dia' : days < 30 ? `${days} dias` : days < 365 ? `${Math.round(days / 30)} mês(es)` : `${(days / 365).toFixed(1).replace('.', ',')} ano(s)`; },

  grade(k) {
    const c = this.cur;
    if (!c) return;
    const n = this.next(c, k);
    c.interval = n.interval; c.ease = n.ease; c.reps = n.reps; c.lastAt = Date.now();
    if (n.lapse) { c.lapses = (c.lapses || 0) + 1; c.due = Date.now() + 10 * 60000; } // volta ainda hoje
    else c.due = D.addDays(D.sod(Date.now()), n.interval);
    this.doneNow++;
    this.cur = null;
    this.shown = false;
    this.changed();
  },
  show() { this.shown = true; this.render(); },

  /* ---------- criar / editar ---------- */
  resetForm() {
    const f = $('#cardForm');
    this.editId = null;
    const t = Store.activeTask();
    Pick.fill(f, t?.subjectId, t?.topicId);
    f.front.value = ''; f.back.value = '';
    $('#cardErr').textContent = '';
    $('#cardSubmit').textContent = 'Adicionar cartão';
    $('#cardCancel').hidden = true;
  },
  edit(c) {
    const f = $('#cardForm');
    this.editId = c.id;
    Pick.fill(f, c.subjectId, c.topicId);
    f.front.value = c.front; f.back.value = c.back;
    $('#cardSubmit').textContent = 'Salvar cartão';
    $('#cardCancel').hidden = false;
    f.front.focus();
    f.scrollIntoView({ block: 'nearest' });
  },
  save() {
    const f = $('#cardForm');
    const front = f.front.value.trim(), back = f.back.value.trim();
    if (!front || !back) { $('#cardErr').textContent = 'Preencha a frente e o verso.'; (front ? f.back : f.front).focus(); return; }
    const pick = Pick.read(f);
    if (pick.error) { $('#cardErr').textContent = pick.error; pick.el.focus(); return; }
    const c = Store.data.cards.find((x) => x.id === this.editId);
    if (c) { Object.assign(c, { front, back, subjectId: pick.subjectId, topicId: pick.topicId }); App.toast('Cartão salvo'); this.resetForm(); }
    else {
      Store.data.cards.push(this.make(front, back, pick.subjectId, pick.topicId));
      App.toast('Cartão adicionado — já entra no estudo de hoje');
      f.front.value = ''; f.back.value = '';
      f.front.focus();
    }
    this.changed();
  },
  make(front, back, subjectId, topicId) {
    return { id: uid(), front, back, subjectId: subjectId || null, topicId: topicId || null, due: Date.now(), interval: 0, ease: 2.5, reps: 0, lapses: 0, createdAt: Date.now() };
  },

  /* ---------- importar (Anki: frente<TAB>verso) ---------- */
  parseImport(text) {
    return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = l.split(/\t| :: |::|;/);
      if (m.length < 2) return null;
      const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      const front = strip(m[0]), back = strip(m.slice(1).join(' · '));
      return front && back ? { front, back } : null;
    }).filter(Boolean);
  },
  countImport() {
    const n = this.parseImport($('#cardImpForm').text.value).length;
    $('#cardImpCount').textContent = n ? `${n} cartão(ões) reconhecido(s).` : '';
  },
  importCards() {
    const f = $('#cardImpForm');
    const list = this.parseImport(f.text.value);
    if (!list.length) { $('#cardImpErr').textContent = 'Nenhum cartão reconhecido. Use uma linha por cartão: frente :: verso'; return; }
    const pick = Pick.read(f);
    if (pick.error) { $('#cardImpErr').textContent = pick.error; pick.el.focus(); return; }
    list.forEach((x) => Store.data.cards.push(this.make(x.front, x.back, pick.subjectId, pick.topicId)));
    f.text.value = '';
    $('#cardImpErr').textContent = '';
    this.countImport();
    App.toast(`${list.length} cartão(ões) importado(s)`);
    this.tab = 'study';
    this.changed();
  },

  /* ---------- telas ---------- */
  render() {
    if (!this.isOpen()) return;
    const sel = $('#cardSubject');
    sel.innerHTML = '<option value="all">Todas as áreas</option>' + Store.data.subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    sel.value = Store.subject(this.subj) ? this.subj : 'all';
    if (sel.value === 'all') this.subj = 'all';
    const dueN = this.due(true).length;
    $$('#cardTab button').forEach((b) => {
      b.classList.toggle('on', b.dataset.v === this.tab);
      if (b.dataset.v === 'study') b.textContent = `Estudar (${dueN})`;
      if (b.dataset.v === 'list') b.textContent = `Cartões (${Store.data.cards.filter((c) => this.inScope(c)).length})`;
    });
    $('#cardStudy').hidden = this.tab !== 'study';
    $('#cardListWrap').hidden = this.tab !== 'list';
    $('#cardImportWrap').hidden = this.tab !== 'import';
    if (this.tab === 'study') this.renderStudy();
    if (this.tab === 'list') this.renderList();
    if (this.tab === 'import' && !$('#cardImpForm').subjectId.options.length) { const t = Store.activeTask(); Pick.fill($('#cardImpForm'), t?.subjectId, t?.topicId); }
  },

  renderStudy() {
    const box = $('#cardStudy');
    if (!this.cur || !Store.data.cards.includes(this.cur)) { this.cur = this.due(true)[0] || null; this.shown = false; }
    const c = this.cur;
    if (!c) {
      const total = Store.data.cards.filter((x) => this.inScope(x)).length;
      const nextC = Store.data.cards.filter((x) => this.inScope(x)).sort((a, b) => a.due - b.due)[0];
      box.innerHTML = `<div class="fc-empty">
        <b>${this.doneNow ? `Pronto! ${this.doneNow} cartão(ões) revisado(s) agora.` : total ? 'Nenhum cartão para hoje.' : 'Nenhum cartão ainda.'}</b>
        <p class="hint">${total ? `Próximo cartão: ${nextC ? D.ddmm(nextC.due) : '—'}.` : 'Crie cartões para fatos que você esquece: doses, critérios, tríades, classificações.'}</p>
        <button class="btn" data-goto-list>${total ? 'Ver ou adicionar cartões' : 'Criar o primeiro cartão'}</button></div>`;
      return;
    }
    const left = this.due(true).length;
    const btns = GRADES.map((g) => {
      const n = this.next(c, g.k);
      return `<button class="btn fc-g fc-${g.k}" data-grade="${g.k}"><b>${g.label}</b><small>${this.label(n.interval)}</small></button>`;
    }).join('');
    box.innerHTML = `
      <div class="fc-meta"><span class="tag" style="--c:${Store.subjectColor(c.subjectId)}">${esc(Store.label(c.subjectId, c.topicId))}</span><span class="muted">${left} para hoje${this.doneNow ? ` · ${this.doneNow} feitos` : ''}</span></div>
      <div class="fc-card">
        <div class="fc-front">${esc(c.front).replace(/\n/g, '<br>')}</div>
        ${this.shown ? `<hr><div class="fc-back">${esc(c.back).replace(/\n/g, '<br>')}</div>` : ''}
      </div>
      <div class="fc-actions">${this.shown ? btns : `<button class="btn primary fc-show" data-show>Mostrar resposta${TOUCH ? '' : ' <kbd>Espaço</kbd>'}</button>`}</div>
      ${this.shown && !TOUCH ? '<p class="hint fc-keys">Teclas: 1 Errei · 2 Difícil · 3 Bom · 4 Fácil</p>' : ''}`;
  },

  renderList() {
    const list = Store.data.cards.filter((c) => this.inScope(c)).sort((a, b) => b.createdAt - a.createdAt);
    $('#cardList').innerHTML = list.length ? `<div class="rv-list">${list.slice(0, 400).map((c) => `<div class="rv" data-id="${c.id}">
      <div class="rv-main"><span class="tag" style="--c:${Store.subjectColor(c.subjectId)}">${esc(Store.label(c.subjectId, c.topicId))}</span>
        <div class="rv-note"><b>${esc(c.front)}</b></div><small>${esc(c.back.slice(0, 160))}${c.back.length > 160 ? '…' : ''}</small>
        <small>próxima revisão: ${c.due < this.endOfToday() ? '<b>hoje</b>' : D.ddmm(c.due)}${c.lapses ? ` · errou ${c.lapses}x` : ''}</small></div>
      <div class="rv-actions"><button class="kebab" data-card="edit" title="Editar" aria-label="Editar">✎</button><button class="kebab" data-card="del" title="Excluir" aria-label="Excluir">×</button></div>
    </div>`).join('')}</div>` : '<p class="empty">Nenhum cartão nesta área.</p>';
  },
};
