'use strict';

/* ============================================================
   Redações (ENEM): nota por competência (C1 a C5, 0 a 200 cada),
   evolução e a competência mais fraca.
   ============================================================ */
const COMPETENCIES = [
  ['C1', 'Norma culta da língua'],
  ['C2', 'Compreensão da proposta e repertório'],
  ['C3', 'Seleção e organização dos argumentos'],
  ['C4', 'Coesão (mecanismos linguísticos)'],
  ['C5', 'Proposta de intervenção'],
];

const Essay = {
  dlg: null,
  editId: null,

  init() {
    this.dlg = $('#essayDlg');
    const f = $('#essayForm');
    $('#essayComps').innerHTML = COMPETENCIES.map(([c, l], i) => `<label class="fld"><span title="${l}">${c} · ${l}</span>
      <select name="c${i}">${[0, 40, 80, 120, 160, 200].map((v) => `<option value="${v}">${v}</option>`).join('')}</select></label>`).join('');
    f.onsubmit = (e) => { e.preventDefault(); this.save(); };
    f.addEventListener('change', () => this.sumUp());
    $('#essayNew').onclick = () => this.openForm(null);
    $('#essayCancel').onclick = () => { f.hidden = true; };
    $('#essayList').onclick = (e) => {
      const b = e.target.closest('[data-es]');
      if (!b) return;
      const x = Store.data.essays.find((y) => y.id === b.closest('[data-id]').dataset.id);
      if (!x) return;
      if (b.dataset.es === 'edit') this.openForm(x);
      if (b.dataset.es === 'del' && confirm('Excluir esta redação?')) { Store.data.essays = Store.data.essays.filter((y) => y.id !== x.id); App.renderAll(); this.render(); }
    };
    $('#btnEssays').onclick = () => { $('#simDlg').close(); this.open(); };
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => this.isOpen() && this.drawChart(), 120); });
  },

  open() { this.dlg.showModal(); $('#essayForm').hidden = true; this.render(); },
  isOpen() { return !!this.dlg?.open; },
  total(x) { return sum(x.c, (v) => v); },
  sorted() { return Store.data.essays.slice().sort((a, b) => a.date - b.date); },

  openForm(x) {
    this.editId = x?.id || null;
    const f = $('#essayForm');
    f.date.value = D.key(x?.date || Date.now());
    f.theme.value = x?.theme || '';
    f.note.value = x?.note || '';
    COMPETENCIES.forEach((_, i) => { f['c' + i].value = String(x ? x.c[i] : 120); });
    this.sumUp();
    f.hidden = false;
    f.theme.focus();
  },
  sumUp() {
    const f = $('#essayForm');
    $('#essaySum').textContent = `Total: ${COMPETENCIES.reduce((a, _, i) => a + +f['c' + i].value, 0)} / 1000`;
  },

  save() {
    const f = $('#essayForm');
    if (!f.date.value) return;
    const c = COMPETENCIES.map((_, i) => Math.max(0, Math.min(200, +f['c' + i].value || 0)));
    const date = f.date.value === D.key(Date.now()) ? Date.now() : D.fromKey(f.date.value) + 12 * 3600000;
    const data = { date, theme: f.theme.value.trim().slice(0, 140), note: f.note.value.trim().slice(0, 600), c };
    const x = Store.data.essays.find((y) => y.id === this.editId);
    if (x) Object.assign(x, data); else Store.data.essays.push({ id: uid(), ...data });
    f.hidden = true;
    App.renderAll();
    this.render();
    App.toast(`Redação salva: ${this.total(data)} pontos`);
  },

  render() {
    if (!this.isOpen()) return;
    const list = this.sorted();
    const box = $('#essayBody');
    if (!list.length) { box.innerHTML = '<p class="empty">Nenhuma redação ainda. Lance a nota de cada competência para acompanhar a evolução.</p>'; $('#essayList').innerHTML = ''; return; }
    const last = list[list.length - 1], recent = list.slice(-5);
    const avg = (arr, i) => sum(arr, (x) => x.c[i]) / arr.length;
    const comp = COMPETENCIES.map(([c, l], i) => ({ c, l, v: avg(recent, i) }));
    const weak = comp.slice().sort((a, b) => a.v - b.v)[0];
    const best = list.reduce((a, x) => (this.total(x) > this.total(a) ? x : a), list[0]);
    box.innerHTML = `
      <div class="kpis kpis-3">
        <div class="kpi"><div class="l">Última</div><div class="v">${this.total(last)}</div><div class="s">${esc(last.theme || 'sem tema')} · ${D.ddmmyy(last.date)}</div></div>
        <div class="kpi"><div class="l">Média das últimas ${recent.length}</div><div class="v">${Math.round(sum(recent, (x) => this.total(x)) / recent.length)}</div><div class="s">de 1000</div></div>
        <div class="kpi"><div class="l">Melhor</div><div class="v">${this.total(best)}</div><div class="s">${D.ddmmyy(best.date)}</div></div>
      </div>
      <h4 class="stats-h">Competências <small>(média das últimas ${recent.length})</small></h4>
      <div class="comp-list">${comp.map((x) => `<div class="comp${x === weak ? ' weak-c' : ''}"><b>${x.c}</b><span>${x.l}</span>
        <div class="bar sm"><i style="width:${(x.v / 2).toFixed(1)}%"></i></div><span class="muted">${Math.round(x.v)}</span></div>`).join('')}</div>
      <p class="hint" style="margin-top:8px">Para subir mais rápido, foque na <b>${weak.c}</b> (${weak.l.toLowerCase()}).</p>
      <h4 class="stats-h">Evolução</h4>
      <div class="chart" id="chartEssay"></div>`;
    $('#essayList').innerHTML = `<h4 class="stats-h">Todas</h4><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Tema</th>${COMPETENCIES.map(([c]) => `<th>${c}</th>`).join('')}<th>Total</th><th></th></tr></thead><tbody>
      ${list.slice().reverse().map((x) => `<tr data-id="${x.id}"><td>${D.ddmmyy(x.date)}</td><td>${esc(x.theme || '—')}</td>${x.c.map((v) => `<td>${v}</td>`).join('')}<td><b>${this.total(x)}</b></td>
        <td class="actions"><button class="kebab" data-es="edit" title="Editar" aria-label="Editar">✎</button><button class="kebab" data-es="del" title="Excluir" aria-label="Excluir">×</button></td></tr>`).join('')}
      </tbody></table></div>`;
    this.drawChart();
  },

  drawChart() {
    const el = $('#chartEssay');
    if (!el) return;
    const data = this.sorted().map((x) => ({ label: D.ddmm(x.date), x, t: this.total(x) }));
    Charts.bars(el, {
      data, height: 190,
      stacks: [{ val: (d) => d.t, color: 'var(--accent)' }],
      yFmt: (v) => Fmt.int(v),
      tip: (d) => `<b>${esc(d.x.theme || 'Redação')}</b>${d.t} pontos<br>${d.x.c.map((v, i) => `C${i + 1} ${v}`).join(' · ')}`,
    });
  },
};
