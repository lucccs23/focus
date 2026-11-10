'use strict';

/* ============================================================
   Relatório semanal (PDF)
   ============================================================ */
const Report = {
  open() {
    const f = $('#repForm');
    f.week.value = 'this';
    $('#repDlg').showModal();
  },

  init() {
    $('#repForm').onsubmit = (e) => { e.preventDefault(); this.generate(); };
  },

  weekStart() {
    const ws = D.weekStart(Date.now());
    return $('#repForm').week.value === 'last' ? D.addDays(ws, -7) : ws;
  },

  async generate() {
    const ws = this.weekStart();
    const html = this.html(ws);
    const name = `Focus - relatório ${D.key(ws)} a ${D.key(D.addDays(ws, 6))}.pdf`;
    if (window.desktop?.exportPdf) {
      const res = await window.desktop.exportPdf(html, name);
      if (res?.ok) { $('#repDlg').close(); App.toast('Relatório salvo e aberto'); }
      else if (res && !res.canceled) App.toast(`Não foi possível gerar o PDF: ${res.error}`);
      return;
    }
    // navegador: abre o relatório e a janela de impressão ("Salvar como PDF")
    const w = window.open('', '_blank');
    if (!w) { App.toast('O navegador bloqueou a janela do relatório'); return; }
    w.document.write(html);
    w.document.close();
    let printed = false;
    const go = () => { if (printed) return; printed = true; try { w.focus(); w.print(); } catch (_) { /* ignora */ } };
    w.onload = go;
    setTimeout(go, 600);
    $('#repDlg').close();
  },

  data(ws) {
    const we = D.addDays(ws, 7);
    const d = Store.data;
    const ss = d.sessions.filter((s) => s.end >= ws && s.end < we);
    const qs = Store.allQuestions().filter((q) => q.date >= ws && q.date < we);
    const prevSs = d.sessions.filter((s) => s.end >= D.addDays(ws, -7) && s.end < ws);
    const prevQs = Store.allQuestions().filter((q) => q.date >= D.addDays(ws, -7) && q.date < ws);
    const days = [...Array(7)].map((_, i) => {
      const a = D.addDays(ws, i), b = D.addDays(ws, i + 1);
      const s2 = ss.filter((s) => s.end >= a && s.end < b), q2 = qs.filter((q) => q.date >= a && q.date < b);
      return { t: a, f: sum(s2, (s) => s.ms), q: sum(q2, (q) => q.total), c: sum(q2, (q) => q.correct), p: s2.filter((s) => s.mode === 'pomodoro' && s.completed).length };
    });
    const subj = new Map();
    const S = (id) => { const k = id || 'none'; if (!subj.has(k)) subj.set(k, { id, f: 0, q: 0, c: 0 }); return subj.get(k); };
    ss.forEach((s) => { S(s.subjectId).f += s.ms; });
    qs.forEach((q) => { const x = S(q.subjectId); x.q += q.total; x.c += q.correct; });
    const revDone = d.reviews.filter((r) => r.lastAt >= ws && r.lastAt < we).length;
    const revCreated = d.reviews.filter((r) => r.createdAt >= ws && r.createdAt < we).length;
    const revPending = d.reviews.filter((r) => !r.done && r.due < we).length;
    return {
      ws, we, days, subj: [...subj.values()].sort((a, b) => b.f - a.f || b.q - a.q),
      focus: sum(ss, (s) => s.ms), pomos: ss.filter((s) => s.mode === 'pomodoro' && s.completed).length,
      q: sum(qs, (x) => x.total), c: sum(qs, (x) => x.correct),
      prevFocus: sum(prevSs, (s) => s.ms), prevQ: sum(prevQs, (x) => x.total), prevC: sum(prevQs, (x) => x.correct),
      revDone, revCreated, revPending,
      sims: d.simulados.filter((s) => s.date >= ws && s.date < we),
      goal: d.settings.dailyGoalMin * 60000,
    };
  },

  html(ws) {
    const r = this.data(ws);
    const accent = '#c4623f', ok = '#4f8a5b', err = '#c25450';
    const pct = (c, t) => (t ? Fmt.pct(c / t) : '—');
    const diff = (cur, prev, fmt) => {
      if (!prev) return '<span class="m">sem semana anterior para comparar</span>';
      const dlt = cur - prev;
      return `<span style="color:${dlt >= 0 ? ok : err}">${dlt >= 0 ? '+' : '−'}${fmt(Math.abs(dlt))}</span> <span class="m">vs. semana anterior</span>`;
    };
    // gráfico de foco por dia
    const maxF = Math.max(r.goal, ...r.days.map((x) => x.f), 1);
    const W = 640, H = 170, bw = 46, gap = (W - 7 * bw) / 7;
    let bars = '';
    r.days.forEach((x, i) => {
      const h = (x.f / maxF) * (H - 40), xx = gap / 2 + i * (bw + gap), y = H - 24 - h;
      bars += `<rect x="${xx}" y="${y}" width="${bw}" height="${Math.max(h, 0)}" rx="4" fill="${x.f >= r.goal ? accent : '#e2b7a5'}"/>`;
      bars += `<text x="${xx + bw / 2}" y="${H - 8}" text-anchor="middle">${WEEKDAYS[new Date(x.t).getDay()].slice(0, 3)} ${D.ddmm(x.t)}</text>`;
      if (x.f) bars += `<text x="${xx + bw / 2}" y="${y - 5}" text-anchor="middle" class="v">${Fmt.dur(x.f)}</text>`;
    });
    const gy = H - 24 - (r.goal / maxF) * (H - 40);
    bars += `<line x1="0" x2="${W}" y1="${gy}" y2="${gy}" stroke="#9a968e" stroke-dasharray="4 4"/><text x="${W}" y="${gy - 4}" text-anchor="end" class="m">meta diária ${Fmt.dur(r.goal)}</text>`;

    const goals = Store.activeSubjects().filter((s) => s.goalH > 0 || s.goalQ > 0);
    const goalRow = (s) => {
      const x = r.subj.find((y) => y.id === s.id) || { f: 0, q: 0 };
      return `<tr><td><i style="background:${Store.subjectColor(s.id)}"></i>${esc(s.name)}</td>
        <td>${s.goalH ? `${Fmt.dur(x.f)} / ${s.goalH}h (${Math.round(Math.min(1, x.f / (s.goalH * 3600000)) * 100)}%)` : '—'}</td>
        <td>${s.goalQ ? `${x.q} / ${s.goalQ} (${Math.round(Math.min(1, x.q / s.goalQ) * 100)}%)` : '—'}</td></tr>`;
    };
    const topics = Store.data.subjects.flatMap((s) => s.topics);
    const studied = topics.filter((t) => t.studied).length;

    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório semanal — Focus</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; color: #1f1e1c; font-size: 12.5px; }
  h1 { font-size: 22px; margin: 0 0 2px; font-weight: 600; }
  h2 { font-size: 14px; margin: 22px 0 8px; font-weight: 600; }
  .m { color: #8a867f; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid ${accent}; padding-bottom: 10px; }
  .brand { color: ${accent}; font-weight: 700; font-size: 13px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 14px; }
  .k { border: 1px solid #e6e3dd; border-radius: 8px; padding: 10px 12px; }
  .k .l { color: #6b6862; font-size: 11px; }
  .k .v { font-size: 20px; font-weight: 600; margin: 2px 0; }
  .k .s { font-size: 10.5px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: right; padding: 6px 8px; border-bottom: 1px solid #ece9e3; }
  th { color: #6b6862; font-weight: 500; font-size: 11px; }
  th:first-child, td:first-child { text-align: left; }
  td i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
  svg text { font-size: 10px; fill: #6b6862; font-family: inherit; }
  svg text.v { fill: #1f1e1c; font-weight: 600; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .foot { margin-top: 26px; color: #9a968e; font-size: 10px; text-align: center; }
</style></head><body>
  <div class="head">
    <div><div class="brand">Focus</div><h1>Relatório semanal</h1>
      <div class="m">${D.weekday(r.ws)}, ${D.ddmmyy(r.ws)} a ${D.weekday(D.addDays(r.ws, 6))}, ${D.ddmmyy(D.addDays(r.ws, 6))}</div></div>
    <div class="m">gerado em ${D.ddmmyy(Date.now())} às ${Fmt.time(Date.now())}</div>
  </div>

  <div class="kpis">
    <div class="k"><div class="l">Tempo de foco</div><div class="v">${Fmt.dur(r.focus)}</div><div class="s">${diff(r.focus, r.prevFocus, Fmt.dur)}</div></div>
    <div class="k"><div class="l">Pomodoros completos</div><div class="v">${r.pomos}</div><div class="s m">${r.days.filter((x) => x.f >= r.goal).length} de 7 dias bateram a meta diária</div></div>
    <div class="k"><div class="l">Questões</div><div class="v">${Fmt.int(r.q)}</div><div class="s">${diff(r.q, r.prevQ, Fmt.int)}</div></div>
    <div class="k"><div class="l">% de acerto</div><div class="v">${pct(r.c, r.q)}</div><div class="s m">${r.prevQ ? `semana anterior: ${pct(r.prevC, r.prevQ)}` : ''}</div></div>
  </div>

  <h2>Foco por dia</h2>
  <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">${bars}</svg>

  <h2>Por ${T.s}</h2>
  ${r.subj.length ? `<table><thead><tr><th>${T.S}</th><th>Foco</th><th>Questões</th><th>Acertos</th><th>% acerto</th></tr></thead><tbody>
    ${r.subj.map((x) => `<tr><td><i style="background:${Store.subjectColor(x.id)}"></i>${esc(Store.subjectName(x.id))}</td><td>${x.f ? Fmt.dur(x.f) : '—'}</td><td>${x.q || '—'}</td><td>${x.q ? x.c : '—'}</td><td>${pct(x.c, x.q)}</td></tr>`).join('')}
  </tbody></table>` : '<p class="m">Nada registrado nesta semana.</p>'}

  <div class="two">
    <div>
      <h2>Metas da semana</h2>
      ${goals.length ? `<table><thead><tr><th>${T.S}</th><th>Horas</th><th>Questões</th></tr></thead><tbody>${goals.map(goalRow).join('')}</tbody></table>` : '<p class="m">Nenhuma meta semanal definida.</p>'}
    </div>
    <div>
      <h2>Revisões e ${T.pp}</h2>
      <table><tbody>
        <tr><td>Revisões feitas</td><td>${r.revDone}</td></tr>
        <tr><td>Novos erros anotados</td><td>${r.revCreated}</td></tr>
        <tr><td>Revisões pendentes no fim da semana</td><td>${r.revPending}</td></tr>
        <tr><td>${T.PP} estudados</td><td>${topics.length ? `${studied}/${topics.length} (${Math.round((studied / topics.length) * 100)}%)` : '—'}</td></tr>
      </tbody></table>
    </div>
  </div>

  ${r.sims.length ? `<h2>Simulados</h2><table><thead><tr><th>Simulado</th><th>Data</th><th>Questões</th><th>% acerto</th></tr></thead><tbody>
    ${r.sims.map((s) => { const t = sum(s.rows, (x) => x.total), c = sum(s.rows, (x) => x.correct); return `<tr><td>${esc(s.name)}</td><td>${D.ddmmyy(s.date)}</td><td>${t}</td><td>${pct(c, t)}</td></tr>`; }).join('')}
  </tbody></table>` : ''}

  <div style="break-inside: avoid">
  <h2>Dia a dia</h2>
  <table><thead><tr><th>Dia</th><th>Foco</th><th>Pomodoros</th><th>Questões</th><th>% acerto</th></tr></thead><tbody>
    ${r.days.map((x) => `<tr><td>${D.weekday(x.t)}, ${D.ddmm(x.t)}</td><td>${x.f ? Fmt.dur(x.f) : '—'}</td><td>${x.p || '—'}</td><td>${x.q || '—'}</td><td>${pct(x.c, x.q)}</td></tr>`).join('')}
  </tbody></table>
  </div>

  <div class="foot">Focus · relatório gerado automaticamente</div>
</body></html>`;
  },
};
