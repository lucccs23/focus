'use strict';

/* ============================================================
   Simulados: nota por matéria e evolução
   ============================================================ */
const Sims = {
  dlg: null,
  editId: null,

  init() {
    this.dlg = $('#simDlg');
    $('#simNew').onclick = () => this.openForm(null);
    $('#simCancel').onclick = () => { $('#simForm').hidden = true; };
    $('#simForm').onsubmit = (e) => { e.preventDefault(); this.save(); };
    $('#simBody').onclick = (e) => {
      const b = e.target.closest('[data-sim]');
      if (!b) return;
      const sim = Store.data.simulados.find((s) => s.id === b.closest('[data-id]').dataset.id);
      if (!sim) return;
      if (b.dataset.sim === 'edit') this.openForm(sim);
      if (b.dataset.sim === 'del' && confirm(`Excluir "${sim.name}"?`)) {
        Store.data.simulados = Store.data.simulados.filter((s) => s.id !== sim.id);
        App.renderAll();
        this.render();
      }
    };
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => this.isOpen() && this.drawChart(), 120); });
  },

  open(editId) {
    this.dlg.showModal();
    $('#simForm').hidden = true;
    this.render();
    const sim = Store.data.simulados.find((s) => s.id === editId);
    if (sim) this.openForm(sim);
  },
  isOpen() { return !!this.dlg?.open; },

  openForm(sim) {
    this.editId = sim?.id || null;
    const f = $('#simForm');
    f.name.value = sim?.name || `Simulado ${Store.data.simulados.length + 1}`;
    f.date.value = D.key(sim?.date || Date.now());
    const ids = Store.data.subjects.map((s) => s.id);
    (sim?.rows || []).forEach((r) => { if (!ids.includes(r.subjectId)) ids.push(r.subjectId); });
    const val = (sid, k) => { const r = sim?.rows.find((x) => x.subjectId === sid); return r && r.total ? r[k] : ''; };
    $('#simRows').innerHTML = ids.length ? `
      <div class="sim-grid">
        <span class="muted">Matéria</span><span class="muted">Questões</span><span class="muted">Acertos</span>
        ${ids.map((sid) => `<span class="tag" style="--c:${Store.subjectColor(sid)}">${esc(Store.subjectName(sid))}</span>
          <input type="number" min="0" max="500" data-sid="${sid || ''}" data-k="total" value="${val(sid, 'total')}" aria-label="Questões">
          <input type="number" min="0" max="500" data-sid="${sid || ''}" data-k="correct" value="${val(sid, 'correct')}" aria-label="Acertos">`).join('')}
      </div>` : '<p class="hint">Cadastre suas matérias em “Matérias e edital” para lançar a nota por matéria.</p>';
    $('#simErr').textContent = '';
    f.hidden = false;
    f.name.focus();
  },

  save() {
    const f = $('#simForm');
    const err = (m) => { $('#simErr').textContent = m; };
    const name = f.name.value.trim();
    if (!name) return err('Dê um nome ao simulado.');
    if (!f.date.value) return err('Escolha a data.');
    const rows = [];
    const bySid = new Map();
    $$('#simRows input').forEach((i) => {
      const k = i.dataset.sid;
      if (!bySid.has(k)) bySid.set(k, {});
      bySid.get(k)[i.dataset.k] = i.value === '' ? null : Math.round(+i.value);
    });
    for (const [sid, v] of bySid) {
      if (v.total < 0 || v.correct < 0) return err(`Em ${Store.subjectName(sid)}, use números positivos.`);
      if (!v.total) { if (v.correct) return err(`Em ${Store.subjectName(sid)}, informe também o total de questões.`); continue; }
      const correct = v.correct ?? 0;
      if (correct > v.total) return err(`Em ${Store.subjectName(sid)}, os acertos passam do total.`);
      rows.push({ subjectId: sid || null, total: v.total, correct });
    }
    if (!rows.length) return err('Preencha as questões de pelo menos uma matéria.');
    const date = f.date.value === D.key(Date.now()) ? Date.now() : D.fromKey(f.date.value) + 12 * 3600000;
    const sim = Store.data.simulados.find((s) => s.id === this.editId);
    if (sim) Object.assign(sim, { name, date, rows });
    else Store.data.simulados.push({ id: uid(), name, date, rows });
    f.hidden = true;
    App.renderAll();
    this.render();
    App.toast('Simulado salvo');
  },

  sorted() { return Store.data.simulados.slice().sort((a, b) => a.date - b.date); },

  render() {
    if (!this.isOpen()) return;
    const sims = this.sorted();
    if (!sims.length) { $('#simBody').innerHTML = `<p class="empty">Nenhum simulado ainda. ${TOUCH ? 'Toque' : 'Clique'} em “+ Novo simulado” para lançar o primeiro.</p>`; return; }
    const tot = (s) => ({ t: sum(s.rows, (r) => r.total), c: sum(s.rows, (r) => r.correct) });
    const pct = (c, t) => (t ? Fmt.pct(c / t) : '—');
    const last = sims[sims.length - 1], prev = sims[sims.length - 2];
    const lt = tot(last), pt = prev && tot(prev);
    const best = sims.reduce((a, s) => { const x = tot(s); return x.t && (!a || x.c / x.t > a.r) ? { s, r: x.c / x.t } : a; }, null);
    const delta = pt && pt.t && lt.t ? (lt.c / lt.t - pt.c / pt.t) * 100 : null;

    // evolução por matéria (últimos 6)
    const recent = sims.slice(-6);
    const sids = [...new Set(recent.flatMap((s) => s.rows.map((r) => r.subjectId)))];
    const cell = (s, sid) => { const r = s.rows.find((x) => x.subjectId === sid); return r && r.total ? Fmt.pct(r.correct / r.total) : '<span class="muted">—</span>'; };

    $('#simBody').innerHTML = `
      <div class="kpis kpis-3">
        <div class="kpi"><div class="l">Último simulado</div><div class="v">${pct(lt.c, lt.t)}</div><div class="s">${esc(last.name)} · ${D.ddmmyy(last.date)}</div></div>
        <div class="kpi"><div class="l">vs. anterior</div><div class="v ${delta == null ? '' : delta >= 0 ? 'up' : 'down'}">${delta == null ? '—' : `${delta >= 0 ? '+' : ''}${Fmt.dec(delta)} p.p.`}</div><div class="s">${prev ? esc(prev.name) : 'sem anterior'}</div></div>
        <div class="kpi"><div class="l">Melhor resultado</div><div class="v">${best ? Fmt.pct(best.r) : '—'}</div><div class="s">${best ? esc(best.s.name) : ''}</div></div>
      </div>
      <h4 class="stats-h">Evolução</h4>
      <div class="chart" id="chartSim"></div>
      <div class="legend"><span><i style="background:var(--ok)"></i>Acertos</span><span><i style="background:var(--err)"></i>Erros</span><span><i class="ln" style="background:var(--rate)"></i>% de acerto</span></div>
      <h4 class="stats-h">Por matéria <small>(últimos ${recent.length})</small></h4>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Matéria</th>${recent.map((s) => `<th title="${esc(s.name)}">${D.ddmm(s.date)}</th>`).join('')}</tr></thead><tbody>
        ${sids.map((sid) => `<tr><td><span class="tag" style="--c:${Store.subjectColor(sid)}">${esc(Store.subjectName(sid))}</span></td>${recent.map((s) => `<td>${cell(s, sid)}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>
      <h4 class="stats-h">Todos os simulados</h4>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Simulado</th><th>Data</th><th>Questões</th><th>Acertos</th><th>% acerto</th><th></th></tr></thead><tbody>
        ${sims.slice().reverse().map((s) => { const x = tot(s); return `<tr data-id="${s.id}"><td>${esc(s.name)}</td><td>${D.ddmmyy(s.date)}</td><td>${x.t}</td><td>${x.c}</td><td>${pct(x.c, x.t)}</td>
          <td class="actions"><button class="kebab" data-sim="edit" title="Editar" aria-label="Editar">✎</button><button class="kebab" data-sim="del" title="Excluir" aria-label="Excluir">×</button></td></tr>`; }).join('')}
      </tbody></table></div>`;
    this.drawChart();
  },

  drawChart() {
    const el = $('#chartSim');
    if (!el) return;
    const data = this.sorted().map((s) => {
      const t = sum(s.rows, (r) => r.total), c = sum(s.rows, (r) => r.correct);
      return { label: D.ddmm(s.date), name: s.name, t, c };
    });
    Charts.bars(el, {
      data, height: 200,
      stacks: [{ val: (d) => d.c, color: 'var(--ok)' }, { val: (d) => d.t - d.c, color: 'var(--err)' }],
      line: { val: (d) => (d.t ? d.c / d.t : null), color: 'var(--rate)' },
      yFmt: (v) => Fmt.int(v),
      tip: (d) => `<b>${esc(d.name)}</b>${d.c}/${d.t} acertos${d.t ? `<br>${Fmt.pct(d.c / d.t)}` : ''}`,
    });
  },
};
