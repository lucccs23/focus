'use strict';

/* ============================================================
   Faculdade: notas com pesos (média atual e quanto precisa
   tirar), controle de faltas e semestres.
   ============================================================ */
const College = {
  pass() { return Math.max(0, Math.min(10, +Store.data.settings.passGrade || 7)); },
  limit() { return Math.max(1, Math.min(100, +Store.data.settings.absLimit || 25)); },

  // média atual (só as notas lançadas) e quanto precisa nas que faltam
  calc(s) {
    const g = (s.grades || []).filter((x) => +x.w > 0);
    const done = g.filter((x) => x.v != null && x.v !== '');
    const left = g.filter((x) => x.v == null || x.v === '');
    const wd = sum(done, (x) => +x.w), wl = sum(left, (x) => +x.w), pts = sum(done, (x) => +x.w * +x.v);
    const avg = wd ? pts / wd : null;
    const pass = this.pass();
    if (!g.length) return { avg: null };
    if (!wl) return { avg, final: avg, ok: avg >= pass, need: null };
    const need = (pass * (wd + wl) - pts) / wl;
    return { avg, need, left, ok: need <= 0 ? true : null, impossible: need > 10 };
  },
  absMax(s) { return Math.floor((+s.classes || 0) * this.limit() / 100); },

  statusText(s) {
    const r = this.calc(s), pass = Fmt.dec(this.pass());
    if (r.avg == null && !(s.grades || []).length) return '<span class="muted">sem notas cadastradas</span>';
    if (r.need == null) return `média final <b>${r.avg == null ? '—' : Fmt.dec(r.avg)}</b> · ${r.ok ? '<span class="up">aprovado(a)</span>' : `<span class="down">abaixo de ${pass}</span>`}`;
    const nextName = r.left.map((x) => x.name || 'avaliação').join(', ');
    if (r.need <= 0) return `média atual <b>${r.avg == null ? '—' : Fmt.dec(r.avg)}</b> · <span class="up">já garantiu ${pass}</span>`;
    if (r.impossible) return `média atual <b>${r.avg == null ? '—' : Fmt.dec(r.avg)}</b> · <span class="down">precisaria de ${Fmt.dec(r.need)} em ${esc(nextName)}</span>`;
    return `média atual <b>${r.avg == null ? '—' : Fmt.dec(r.avg)}</b> · precisa de <b>${Fmt.dec(r.need)}</b> em ${esc(nextName)}`;
  },
  absText(s) {
    if (!(+s.classes > 0)) return '';
    const n = +s.absences || 0, max = this.absMax(s);
    const cls = n > max ? 'down' : n >= max * 0.75 ? 'warn' : '';
    return `<span class="${cls}">${n} de ${max} faltas</span>`;
  },

  /* ---------- cartão da disciplina (tela de matérias) ---------- */
  cardHtml(s) {
    const g = s.grades || [];
    return `<div class="col-box">
      <div class="col-h"><b>Notas</b><span class="col-st">${this.statusText(s)}</span></div>
      ${g.length ? `<div class="grades">${g.map((x) => `<div class="grade" data-gid="${x.id}">
        <input value="${esc(x.name || '')}" data-g="name" maxlength="30" placeholder="Avaliação" aria-label="Avaliação">
        <label>peso <input type="number" min="0" max="100" step="0.5" value="${x.w ?? 1}" data-g="w" aria-label="Peso"></label>
        <label>nota <input type="number" min="0" max="10" step="0.1" value="${x.v ?? ''}" placeholder="—" data-g="v" aria-label="Nota"></label>
        <button type="button" class="kebab" data-g-del title="Remover" aria-label="Remover">×</button></div>`).join('')}</div>` : ''}
      <button type="button" class="link" data-g-add>+ avaliação</button>
      <div class="col-h" style="margin-top:10px"><b>Faltas</b><span class="col-st">${this.absText(s) || '<span class="muted">informe o total de aulas</span>'}</span></div>
      <div class="abs-row">
        <label class="goal">Aulas no semestre <input type="number" min="0" max="999" value="${s.classes || ''}" placeholder="0" data-c="classes" aria-label="Aulas no semestre"></label>
        <span class="abs-ctl"><button type="button" class="btn sm" data-abs="-1" aria-label="Menos uma falta">−</button><b>${+s.absences || 0}</b><button type="button" class="btn sm" data-abs="1" aria-label="Mais uma falta">+</button> faltas</span>
      </div>
    </div>`;
  },

  // eventos vindos da tela de matérias
  onChange(e, s) {
    const t = e.target;
    if (t.dataset.c === 'classes') { s.classes = Math.max(0, Math.min(999, Math.round(+t.value || 0))); return true; }
    const g = t.dataset.g && (s.grades || []).find((x) => x.id === t.closest('[data-gid]').dataset.gid);
    if (!g) return false;
    if (t.dataset.g === 'name') g.name = t.value.trim().slice(0, 30);
    if (t.dataset.g === 'w') g.w = Math.max(0, Math.min(100, +t.value || 0));
    if (t.dataset.g === 'v') g.v = t.value === '' ? null : Math.max(0, Math.min(10, Math.round(+t.value * 10) / 10));
    return true;
  },
  onClick(e, s) {
    if (e.target.closest('[data-g-add]')) {
      s.grades = s.grades || [];
      s.grades.push({ id: uid(), name: `P${s.grades.length + 1}`, w: 1, v: null });
      return true;
    }
    const del = e.target.closest('[data-g-del]');
    if (del) { s.grades = (s.grades || []).filter((x) => x.id !== del.closest('[data-gid]').dataset.gid); return true; }
    const ab = e.target.closest('[data-abs]');
    if (ab) { s.absences = Math.max(0, (+s.absences || 0) + +ab.dataset.abs); return true; }
    return false;
  },

  /* ---------- painel da tela inicial ---------- */
  render() {
    const el = $('#college');
    const subs = Store.activeSubjects();
    if (!Profile.has('college') || !subs.length) { el.hidden = true; return; }
    el.hidden = false;
    const sem = Store.data.settings.semester;
    el.innerHTML = `<div class="panel-head"><h3>${T.SS}${sem ? ` <span class="muted">· ${esc(sem)}</span>` : ''}</h3><button class="link" data-col-open>Notas e faltas</button></div>
      <div class="col-rows">${subs.map((s) => `<div class="col-row" data-sid="${s.id}">
        <span class="tag" style="--c:${Store.subjectColor(s.id)}">${esc(s.name)}</span>
        <small>${this.statusText(s)}</small>
        <span class="col-abs">${this.absText(s)}${+s.classes > 0 ? ` <button class="btn sm" data-abs-home title="Registrar uma falta">+ falta</button>` : ''}</span>
      </div>`).join('')}</div>`;
  },

  init() {
    $('#college').addEventListener('click', (e) => {
      if (e.target.closest('[data-col-open]')) return Subjects.open();
      const b = e.target.closest('[data-abs-home]');
      if (!b) return;
      const s = Store.subject(b.closest('[data-sid]').dataset.sid);
      if (!s) return;
      s.absences = (+s.absences || 0) + 1;
      const max = this.absMax(s);
      App.toast(`${s.name}: ${s.absences} de ${max} faltas${s.absences > max ? ' — passou do limite!' : s.absences >= max * 0.75 ? ' — perto do limite' : ''}`);
      App.renderAll();
    });
  },

  /* ---------- semestres ---------- */
  closeSemester() {
    const s = Store.data.settings;
    const subs = Store.activeSubjects();
    if (!subs.length) return App.toast(`Nenhuma ${T.s} ativa para arquivar`);
    const label = prompt(`Encerrar o semestre: as ${subs.length} ${T.ss} atuais vão para "semestres anteriores" (o histórico continua nas estatísticas).\n\nNome deste semestre:`, s.semester || `${new Date().getFullYear()}.${new Date().getMonth() < 6 ? 1 : 2}`);
    if (label == null) return;
    subs.forEach((x) => { x.archived = true; x.semester = label.trim() || 'semestre anterior'; });
    s.semester = '';
    Store.data.activeTaskId = null;
    App.renderAll();
    App.toast(`Semestre "${label}" encerrado — cadastre as ${T.ss} do próximo`);
  },
  reopen(id) { const x = Store.subject(id); if (x) { x.archived = false; App.renderAll(); Subjects.render(); } },
};
