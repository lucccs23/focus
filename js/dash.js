'use strict';

/* ============================================================
   Resumo da tela inicial (só em tela larga): foco dos últimos
   7 dias, números da semana e mapa de constância.
   ============================================================ */
const Dash = {
  mq: window.matchMedia('(min-width: 1100px), (min-width: 900px) and (pointer: coarse)'),

  init() {
    this.el = $('#dash');
    this.el.addEventListener('click', (e) => { if (e.target.closest('[data-open-stats]')) Stats.open(); });
    this.mq.addEventListener?.('change', () => this.render());
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => this.render(), 150); });
  },

  // dias seguidos com foco registrado (hoje ainda não conta como quebra)
  streak() {
    const days = new Set(Store.data.sessions.map((s) => D.key(s.end)));
    let n = 0, t = D.sod(Date.now());
    if (!days.has(D.key(t))) t = D.addDays(t, -1);
    while (days.has(D.key(t))) { n++; t = D.addDays(t, -1); }
    return n;
  },

  render() {
    const el = this.el;
    if (!el) return;
    el.hidden = !this.mq.matches;
    if (el.hidden) return;
    const d = Store.data, today = D.sod(Date.now()), start = D.addDays(today, -6);
    const days = [...Array(7)].map((_, i) => {
      const a = D.addDays(start, i), b = D.addDays(a, 1);
      const ss = d.sessions.filter((s) => s.end >= a && s.end < b);
      return {
        label: i === 6 ? 'Hoje' : WEEKDAYS[new Date(a).getDay()].slice(0, 3),
        long: `${D.weekday(a)}, ${D.ddmm(a)}`,
        f: sum(ss, (s) => s.ms), qt: sum(ss.filter((s) => s.taskType === 'questoes'), (s) => s.ms),
        p: ss.filter((s) => s.mode === 'pomodoro' && s.completed).length,
      };
    });
    const qs = Store.allQuestions().filter((q) => q.date >= start);
    const focus = sum(days, (x) => x.f), qt = sum(qs, (q) => q.total), qc = sum(qs, (q) => q.correct);
    const goal = d.settings.dailyGoalMin * 60000, hit = days.filter((x) => x.f >= goal).length;
    const streak = this.streak();
    const kpi = (l, v, s) => `<div class="dk"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;

    // mapa de constância: foco, todas as matérias (independe dos filtros das estatísticas)
    const st = Stats.st, keep = { subject: st.subject, heat: st.heat };
    st.subject = 'all'; st.heat = 'focus';
    const heat = Stats.heatmap();
    Object.assign(st, keep);

    el.innerHTML = `
      <div class="panel-head"><h3>Últimos 7 dias</h3><button class="link" data-open-stats>Ver estatísticas</button></div>
      <div class="dash-kpis">
        ${kpi('Foco', Fmt.dur(focus), `média de ${Fmt.dur(focus / 7)} por dia`)}
        ${kpi('Meta diária', `${hit} de 7`, `dias com ${Fmt.dur(goal)} ou mais`)}
        ${kpi('Questões', Fmt.int(qt), qt ? `${Fmt.pct(qc / qt)} de acerto` : 'nenhuma registrada')}
        ${kpi('Sequência', `${streak} dia${streak === 1 ? '' : 's'}`, 'seguidos com foco')}
      </div>
      <div class="chart dash-chart" id="chartDash"></div>
      <div class="panel-head dash-h"><h3>Constância</h3><span class="muted">foco nas últimas 53 semanas</span></div>
      <div class="dash-heat">${heat}</div>`;

    const maxF = days.reduce((a, x) => Math.max(a, x.f), 0);
    const hrs = maxF >= 2 * 3600000, unit = hrs ? 3600000 : 60000;
    Charts.bars($('#chartDash'), {
      data: days, height: 170,
      stacks: [{ val: (x) => x.qt / unit, color: 'var(--accent-2)' }, { val: (x) => (x.f - x.qt) / unit, color: 'var(--accent)' }],
      yFmt: (v) => (hrs ? `${Fmt.dec(v, v % 1 ? 1 : 0)}h` : `${Math.round(v)}min`),
      empty: !maxF,
      tip: (x) => `<b>${x.long}</b>${Fmt.dur(x.f)} de foco<br>${x.p} pomodoro${x.p === 1 ? '' : 's'} completo${x.p === 1 ? '' : 's'}${x.qt ? `<br>${Fmt.dur(x.qt)} em questões` : ''}`,
    });
  },
};
