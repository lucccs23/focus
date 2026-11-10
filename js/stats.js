'use strict';

const GROUP_LABEL = { day: 'dia', week: 'semana', month: 'mês', year: 'ano' };

const Stats = {
  dlg: null,
  st: { range: 30, group: 'day', subject: 'all', includeOpen: true, sort: { key: 'q', dir: -1 }, heat: 'focus' },
  _B: null,

  init() {
    this.dlg = $('#statsDlg');
    $('#fRange').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; this.st.range = b.dataset.v === 'all' ? 'all' : +b.dataset.v; this.render(); };
    $('#fGroup').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; this.st.group = b.dataset.v; this.render(); };
    $('#fSubject').onchange = (e) => { this.st.subject = e.target.value; this.render(); };
    $('#fOpen').onchange = (e) => { this.st.includeOpen = e.target.checked; this.render(); };
    $('#statsBody').onclick = (e) => {
      const th = e.target.closest('th[data-sort]');
      if (th) {
        const k = th.dataset.sort, s = this.st.sort;
        if (s.key === k) s.dir *= -1; else { s.key = k; s.dir = k === 'name' ? 1 : -1; }
        return this.render();
      }
      if (e.target.closest('[data-k-clear]')) { this.st.subject = 'all'; return this.render(); }
      const hb = e.target.closest('[data-heat]');
      if (hb) { this.st.heat = hb.dataset.heat; return this.render(); }
      const tr = e.target.closest('tr[data-k]');
      if (tr) { this.st.subject = this.st.subject === tr.dataset.k ? 'all' : tr.dataset.k; this.render(); }
    };
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (this.isOpen() && this._B) this.drawCharts(this._B); }, 120); });
  },

  isOpen() { return !!this.dlg?.open; },
  open() { this.dlg.showModal(); this.render(); },

  /* ---------- filtros ---------- */
  matchSubj(x) { return this.st.subject === 'all' || (x.subjectId || 'none') === this.st.subject; },
  inclQ(q) {
    if (this.st.includeOpen || !q.taskId) return true;
    const t = Store.task(q.taskId);
    return !t || t.done;
  },
  qOk(q) { return this.inclQ(q) && this.matchSubj(q); },

  bounds() {
    const today = D.sod(Date.now()), end = D.addDays(today, 1);
    let start;
    if (this.st.range === 'all') {
      const d = Store.data;
      let min = today;
      Store.allQuestions().forEach((q) => { if (q.date < min) min = q.date; });
      d.sessions.forEach((s) => { if (s.end < min) min = s.end; });
      start = D.sod(min);
    } else start = D.addDays(today, -(this.st.range - 1));
    return { start, end, days: Math.round((end - start) / DAY) };
  },

  bucketKey(ts) {
    const d = new Date(ts);
    switch (this.st.group) {
      case 'week': return D.key(D.weekStart(ts));
      case 'month': return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      case 'year': return String(d.getFullYear());
      default: return D.key(ts);
    }
  },
  bucketLabels(ts) {
    const d = new Date(ts);
    switch (this.st.group) {
      case 'week': { const w = D.weekStart(ts); return [D.ddmm(w), `Semana de ${D.ddmmyy(w)}`]; }
      case 'month': return [`${MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, `${MONTHS_FULL[d.getMonth()]} de ${d.getFullYear()}`];
      case 'year': return [String(d.getFullYear()), String(d.getFullYear())];
      default: return [D.ddmm(ts), `${D.weekday(ts)}, ${D.ddmmyy(ts)}`];
    }
  },

  /* ---------- cálculo ---------- */
  compute() {
    const { start, end, days } = this.bounds();
    const d = Store.data;
    const qs = Store.allQuestions().filter((q) => q.date >= start && q.date < end && this.qOk(q));
    const ss = d.sessions.filter((s) => s.end >= start && s.end < end && this.matchSubj(s));

    const byDay = new Map();
    const get = (k) => { if (!byDay.has(k)) byDay.set(k, { q: 0, c: 0, f: 0, qt: 0, n: 0, p: 0 }); return byDay.get(k); };
    qs.forEach((q) => { const o = get(D.key(q.date)); o.q += q.total; o.c += q.correct; });
    ss.forEach((s) => {
      const o = get(D.key(s.end));
      o.f += s.ms; o.n++;
      if (s.mode === 'pomodoro' && s.completed) o.p++;
      if (s.taskType === 'questoes') o.qt += s.ms;
    });

    const B = [], idx = new Map();
    for (let t = start; t < end; t = D.addDays(t, 1)) {
      const k = this.bucketKey(t);
      let b = idx.get(k);
      if (!b) {
        const [label, long] = this.bucketLabels(t);
        b = { key: k, label, long, q: 0, c: 0, f: 0, qt: 0, n: 0, p: 0 };
        idx.set(k, b);
        B.push(b);
      }
      const x = byDay.get(D.key(t));
      if (x) for (const f of ['q', 'c', 'f', 'qt', 'n', 'p']) b[f] += x[f];
    }

    const days_ = [...byDay.entries()];
    const qDays = days_.filter(([, x]) => x.q > 0);
    let best = null;
    qDays.forEach(([k, x]) => { if (!best || x.q > best.q) best = { k, q: x.q }; });

    const timedTasks = new Set(ss.filter((s) => s.taskType === 'questoes' && s.taskId).map((s) => s.taskId));
    return {
      start, end, days, B, best,
      q: sum(qs, (x) => x.total), c: sum(qs, (x) => x.correct),
      hist: sum(Store.allQuestions().filter((x) => this.qOk(x)), (x) => x.total),
      activeDays: qDays.length,
      focus: sum(ss, (s) => s.ms),
      sessions: ss.length,
      pomos: ss.filter((s) => s.mode === 'pomodoro' && s.completed).length,
      focusDays: days_.filter(([, x]) => x.f > 0).length,
      qTime: sum(ss.filter((s) => s.taskType === 'questoes'), (s) => s.ms),
      qTimed: sum(qs.filter((q) => timedTasks.has(q.taskId)), (q) => q.total),
      streak: this.streaks(),
    };
  },

  streaks() {
    const set = new Set(Store.allQuestions().filter((q) => q.total > 0 && this.qOk(q)).map((q) => D.key(q.date)));
    let cur = 0, t = D.sod(Date.now());
    if (!set.has(D.key(t))) t = D.addDays(t, -1); // hoje ainda não conta como quebra
    while (set.has(D.key(t))) { cur++; t = D.addDays(t, -1); }
    let best = 0, run = 0, prev = null;
    [...set].sort().forEach((k) => {
      run = prev && D.key(D.addDays(D.fromKey(prev), 1)) === k ? run + 1 : 1;
      best = Math.max(best, run);
      prev = k;
    });
    return { cur, best };
  },

  /* ---------- render ---------- */
  render() {
    const st = this.st;
    $$('#fRange button').forEach((b) => b.classList.toggle('on', b.dataset.v === String(st.range)));
    $$('#fGroup button').forEach((b) => b.classList.toggle('on', b.dataset.v === st.group));
    const sel = $('#fSubject');
    sel.innerHTML = `<option value="all">Todas as ${T.ss}</option><option value="none">Sem ${T.s}</option>`
      + Store.data.subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    if (!sel.querySelector(`option[value="${CSS.escape(st.subject)}"]`)) st.subject = 'all';
    sel.value = st.subject;
    $('#fOpen').checked = st.includeOpen;

    const detOpen = !!$('#statsBody details')?.open;
    const r = this.compute();
    const gl = GROUP_LABEL[st.group];
    const rangeTxt = st.range === 'all' ? 'Todo o histórico' : st.range === 365 ? 'Últimos 12 meses' : `Últimos ${st.range} dias`;
    const subjTxt = st.subject === 'all' ? `todas as ${T.ss}` : st.subject === 'none' ? `sem ${T.s}` : Store.subjectName(st.subject);
    const kpi = (l, v, s) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
    const e = r.q - r.c;

    $('#statsBody').innerHTML = `
      <p class="stats-sub">${rangeTxt} · agrupado por ${gl} · ${esc(subjTxt)}</p>

      <div class="kpis">
        ${kpi('Questões', Fmt.int(r.q), `no intervalo · ${Fmt.int(r.hist)} no histórico`)}
        ${kpi('Acertos', Fmt.int(r.c), 'certas')}
        ${kpi('Erros', Fmt.int(e), 'erradas')}
        ${kpi('% de acerto', r.q ? Fmt.pct(r.c / r.q) : '—', 'média do intervalo')}
        ${kpi('Média por dia ativo', r.activeDays ? Fmt.dec(r.q / r.activeDays) : '—', `${r.activeDays} dia${r.activeDays === 1 ? '' : 's'} com questões`)}
        ${kpi('Média por dia (geral)', Fmt.dec(r.q / r.days), `considera ${r.days} dias`)}
        ${kpi('Melhor dia', r.best ? Fmt.int(r.best.q) : '—', r.best ? `${D.weekday(D.fromKey(r.best.k))} · ${D.ddmmyy(D.fromKey(r.best.k))}` : 'sem registros')}
        ${kpi('Sequência atual', `${r.streak.cur} dia${r.streak.cur === 1 ? '' : 's'}`, `melhor: ${r.streak.best} dia${r.streak.best === 1 ? '' : 's'}`)}
        ${kpi('Tempo em questões', Fmt.dur(r.qTime), 'foco em tarefas de questões')}
        ${kpi('Tempo médio / questão', r.qTimed ? Fmt.pace(r.qTime / r.qTimed) : '—', 'tempo ÷ questões com tempo registrado')}
      </div>

      <div class="stats-h-row"><h4 class="stats-h">Constância <small>(últimas 53 semanas)</small></h4>
        <div class="seg sm"><button data-heat="focus" class="${st.heat === 'focus' ? 'on' : ''}">Foco</button><button data-heat="q" class="${st.heat === 'q' ? 'on' : ''}">Questões</button></div></div>
      <div class="heat-wrap">${this.heatmap()}</div>

      <h4 class="stats-h">Questões por ${gl}</h4>
      <div class="chart" id="chartQ"></div>
      <div class="legend">
        <span><i style="background:var(--ok)"></i>Acertos</span>
        <span><i style="background:var(--err)"></i>Erros</span>
        <span><i class="ln" style="background:var(--rate)"></i>% de acerto (eixo direito)</span>
      </div>
      <details class="det"${detOpen ? ' open' : ''}><summary>Detalhamento por ${gl}</summary><div class="tbl-wrap">${this.detailTable(r.B)}</div></details>

      <h4 class="stats-h">Tempo de foco</h4>
      <div class="kpis">
        ${kpi('Tempo focado', Fmt.dur(r.focus), `${r.sessions} sess${r.sessions === 1 ? 'ão' : 'ões'}`)}
        ${kpi('Pomodoros completos', Fmt.int(r.pomos), `${Fmt.dur(Store.data.settings.pomodoro * 60000)} cada`)}
        ${kpi('Média por dia ativo', r.focusDays ? Fmt.dur(r.focus / r.focusDays) : '—', `${r.focusDays} dia${r.focusDays === 1 ? '' : 's'} com foco`)}
        ${kpi('Média por dia (geral)', Fmt.dur(r.focus / r.days), `considera ${r.days} dias`)}
        ${kpi('Meta diária', Fmt.dur(Store.data.settings.dailyGoalMin * 60000), `batida em ${this.goalDays()} dia(s) do intervalo`)}
      </div>
      <div class="chart" id="chartF"></div>
      <div class="legend">
        <span><i style="background:var(--accent-2)"></i>Em questões</span>
        <span><i style="background:var(--accent)"></i>Estudo e outros</span>
      </div>

      ${this.byTopic() ? `<h4 class="stats-h">Por ${T.p} — ${esc(Store.subjectName(st.subject))} <small>(<button class="link" data-k-clear>voltar para todas as ${T.ss}</button>)</small></h4>`
        : `<h4 class="stats-h">Por ${T.s} <small>(${TAP} numa linha para ver os ${T.pp} dela)</small></h4>`}
      <div class="tbl-wrap">${this.subjectTable(r)}</div>
      ${this.instTable(r)}`;

    this._B = r.B;
    this.drawCharts(r.B);
    const hw = $('#statsBody .heat-wrap');
    if (hw) hw.scrollLeft = hw.scrollWidth;
  },

  heatmap() {
    const metric = this.st.heat;
    const vals = new Map();
    if (metric === 'focus') Store.data.sessions.forEach((s) => { if (this.matchSubj(s)) { const k = D.key(s.end); vals.set(k, (vals.get(k) || 0) + s.ms); } });
    else Store.allQuestions().forEach((q) => { if (this.qOk(q)) { const k = D.key(q.date); vals.set(k, (vals.get(k) || 0) + q.total); } });
    const today = D.sod(Date.now());
    const start = D.addDays(D.weekStart(today), -52 * 7);
    const C = 12, G = 3, L = 28, T = 16;
    const max = Math.max(1, ...vals.values());
    const level = (v) => (!v ? 0 : v >= max * 0.75 ? 4 : v >= max * 0.5 ? 3 : v >= max * 0.25 ? 2 : 1);
    let cells = '', months = '', lastM = -1, active = 0, total = 0;
    for (let w = 0; w < 53; w++) {
      const ws = D.addDays(start, w * 7);
      const m = new Date(ws).getMonth();
      if (m !== lastM) {
        // não rotula o 1º mês se ele quase não aparece (evita sobrepor o seguinte)
        if (!(w === 0 && new Date(ws).getDate() > 17)) months += `<text x="${L + w * (C + G)}" y="10">${MONTHS[m]}</text>`;
        lastM = m;
      }
      for (let i = 0; i < 7; i++) {
        const t = D.addDays(ws, i);
        if (t > today) continue;
        const k = D.key(t), v = vals.get(k) || 0;
        if (v) { active++; total += v; }
        const tip = `${D.weekday(t)}, ${D.ddmmyy(t)}: ${v ? (metric === 'focus' ? `${Fmt.dur(v)} de foco` : `${Fmt.int(v)} questões`) : 'nada registrado'}`;
        cells += `<rect class="hc l${level(v)}" x="${L + w * (C + G)}" y="${T + i * (C + G)}" width="${C}" height="${C}" rx="2.5"><title>${tip}</title></rect>`;
      }
    }
    const days = (String(Store.data.settings.weekStart) === '0' ? ['', 'Seg', '', 'Qua', '', 'Sex', ''] : ['Seg', '', 'Qua', '', 'Sex', '', '']).map((d, i) => d && `<text x="0" y="${T + i * (C + G) + 10}">${d}</text>`).join('');
    const W = L + 53 * (C + G), H = T + 7 * (C + G);
    return `<svg class="heat" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">${months}${days}${cells}</svg>
      <div class="heat-foot"><span>${active} dias com ${metric === 'focus' ? 'foco' : 'questões'} · ${metric === 'focus' ? Fmt.dur(total) : `${Fmt.int(total)} questões`} no ano</span>
      <span class="heat-scale">menos <i class="hc l0"></i><i class="hc l1"></i><i class="hc l2"></i><i class="hc l3"></i><i class="hc l4"></i> mais</span></div>`;
  },

  // acerto por instituição (registros com instituição + simulados), no intervalo e filtros escolhidos
  instTable(r) {
    const m = new Map();
    Store.allQuestions().forEach((q) => {
      if (!q.inst || q.date < r.start || q.date >= r.end || !this.qOk(q)) return;
      const o = m.get(q.inst) || { q: 0, c: 0, sim: 0 };
      o.q += q.total; o.c += q.correct; if (q.simId) o.sim += q.total;
      m.set(q.inst, o);
    });
    if (!m.size) return '';
    const list = [...m.entries()].sort((a, b) => b[1].q - a[1].q);
    return `<h4 class="stats-h">Por ${T.i} <small>(questões registradas com a ${T.i} e simulados)</small></h4>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>${T.I}</th><th>Questões</th><th>Acertos</th><th>Erros</th><th>% acerto</th><th>Em simulados</th></tr></thead><tbody>
      ${list.map(([k, x]) => `<tr><td>${esc(k)}</td><td>${Fmt.int(x.q)}</td><td>${Fmt.int(x.c)}</td><td>${Fmt.int(x.q - x.c)}</td><td>${Fmt.pct(x.c / x.q)}</td><td>${x.sim ? Fmt.int(x.sim) : '<span class="muted">—</span>'}</td></tr>`).join('')}
      </tbody></table></div>`;
  },

  goalDays() {
    const { start, end } = this.bounds();
    const goal = Store.data.settings.dailyGoalMin * 60000, byDay = new Map();
    Store.data.sessions.forEach((s) => {
      if (s.end < start || s.end >= end || !this.matchSubj(s)) return;
      const k = D.key(s.end);
      byDay.set(k, (byDay.get(k) || 0) + s.ms);
    });
    return [...byDay.values()].filter((v) => v >= goal).length;
  },

  drawCharts(B) {
    Charts.bars($('#chartQ'), {
      data: B,
      stacks: [{ val: (b) => b.c, color: 'var(--ok)' }, { val: (b) => b.q - b.c, color: 'var(--err)' }],
      line: { val: (b) => (b.q ? b.c / b.q : null), color: 'var(--rate)' },
      yFmt: (v) => Fmt.int(v),
      empty: !B.some((b) => b.q),
      tip: (b) => `<b>${b.long}</b>${Fmt.int(b.q)} questões<br>${Fmt.int(b.c)} acertos · ${Fmt.int(b.q - b.c)} erros${b.q ? `<br>${Fmt.pct(b.c / b.q)} de acerto` : ''}`,
    });
    const maxF = B.reduce((a, b) => Math.max(a, b.f), 0);
    const hrs = maxF >= 2 * 3600000, unit = hrs ? 3600000 : 60000;
    Charts.bars($('#chartF'), {
      data: B,
      stacks: [{ val: (b) => b.qt / unit, color: 'var(--accent-2)' }, { val: (b) => (b.f - b.qt) / unit, color: 'var(--accent)' }],
      yFmt: (v) => (hrs ? `${Fmt.dec(v, v % 1 ? 1 : 0)}h` : `${Math.round(v)}min`),
      empty: !B.some((b) => b.f),
      tip: (b) => `<b>${b.long}</b>${Fmt.dur(b.f)} de foco<br>${b.p} pomodoro${b.p === 1 ? '' : 's'} completo${b.p === 1 ? '' : 's'}${b.qt ? `<br>${Fmt.dur(b.qt)} em questões` : ''}`,
    });
  },

  detailTable(B) {
    const rows = B.filter((b) => b.q || b.f).reverse();
    if (!rows.length) return '<p class="hint">Nenhum registro no período.</p>';
    return `<table class="tbl"><thead><tr><th>Período</th><th>Questões</th><th>Acertos</th><th>Erros</th><th>% acerto</th><th>Foco</th><th>Pomodoros</th></tr></thead><tbody>
      ${rows.map((b) => `<tr><td>${b.long}</td><td>${Fmt.int(b.q)}</td><td>${Fmt.int(b.c)}</td><td>${Fmt.int(b.q - b.c)}</td>
        <td>${b.q ? Fmt.pct(b.c / b.q) : '<span class="muted">—</span>'}</td><td>${b.f ? Fmt.dur(b.f) : '<span class="muted">—</span>'}</td><td>${b.p || '<span class="muted">—</span>'}</td></tr>`).join('')}
    </tbody></table>`;
  },

  // Tabela por matéria: ignora o filtro de matéria (é ela que seleciona o filtro).
  byTopic() { return !!Store.subject(this.st.subject); },

  subjectTable(r) {
    const st = this.st, d = Store.data;
    const topicMode = this.byTopic();
    const rows = new Map();
    const keyOf = (x) => (topicMode ? x.topicId : x.subjectId) || 'none';
    const R = (x) => {
      const k = keyOf(x);
      if (!rows.has(k)) rows.set(k, topicMode
        ? { k, name: Store.topicName(x.topicId), color: Store.subjectColor(st.subject), q: 0, c: 0, f: 0, qt: 0, qtq: 0, pq: 0, pc: 0 }
        : { k, name: Store.subjectName(x.subjectId), color: Store.subjectColor(x.subjectId), q: 0, c: 0, f: 0, qt: 0, qtq: 0, pq: 0, pc: 0 });
      return rows.get(k);
    };
    const inScope = (x) => !topicMode || x.subjectId === st.subject;
    const ss = d.sessions.filter((s) => s.end >= r.start && s.end < r.end && inScope(s));
    const timed = new Set(ss.filter((s) => s.taskType === 'questoes' && s.taskId).map((s) => s.taskId));
    ss.forEach((s) => { const x = R(s); x.f += s.ms; if (s.taskType === 'questoes') x.qt += s.ms; });
    Store.allQuestions().forEach((q) => {
      if (!this.inclQ(q) || !inScope(q)) return;
      if (q.date >= r.start && q.date < r.end) {
        const x = R(q);
        x.q += q.total; x.c += q.correct;
        if (timed.has(q.taskId)) x.qtq += q.total;
      }
    });
    const hasPrev = st.range !== 'all';
    if (hasPrev) {
      const pStart = D.addDays(r.start, -r.days);
      Store.allQuestions().forEach((q) => {
        if (!this.inclQ(q) || !inScope(q) || q.date < pStart || q.date >= r.start) return;
        const k = keyOf(q);
        if (rows.has(k)) { const x = rows.get(k); x.pq += q.total; x.pc += q.correct; }
      });
    }
    const list = [...rows.values()].filter((x) => x.q || x.f).map((x) => ({
      ...x, e: x.q - x.c,
      pct: x.q ? x.c / x.q : null,
      delta: x.q && x.pq ? x.c / x.q - x.pc / x.pq : null,
      pace: x.qtq ? x.qt / x.qtq : null,
    }));
    if (!list.length) return '<p class="hint">Nenhum registro no período.</p>';

    const { key, dir } = st.sort;
    list.sort((a, b) => {
      if (key === 'name') return a.name.localeCompare(b.name, 'pt-BR') * dir;
      const va = a[key], vb = b[key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (va - vb) * dir;
    });

    const cols = [['name', topicMode ? `${T.P}` : `${T.S}`], ['q', 'Questões'], ['c', 'Acertos'], ['e', 'Erros'], ['pct', '% acerto'], ['delta', 'vs. anterior'], ['f', 'Tempo total'], ['pace', 'Tempo/questão']];
    const dash = '<span class="muted">—</span>';
    const delta = (v) => {
      if (v == null) return dash;
      const pp = v * 100;
      if (Math.abs(pp) < 0.05) return '0,0 p.p.';
      return `<span class="${pp > 0 ? 'up' : 'down'}">${pp > 0 ? '+' : ''}${Fmt.dec(pp)} p.p.</span>`;
    };
    return `<table class="tbl${topicMode ? '' : ' click'}"><thead><tr>${cols.map(([k, l]) => `<th data-sort="${k}" class="${key === k ? 'sorted' : ''}">${l}${key === k ? (dir > 0 ? ' ▴' : ' ▾') : ''}</th>`).join('')}</tr></thead><tbody>
      ${list.map((x) => `<tr ${topicMode ? '' : `data-k="${x.k}" title="Ver ${T.pp} de ${esc(x.name)}"`}>
        <td><span class="tag" style="--c:${x.color}">${esc(x.name)}</span></td>
        <td>${Fmt.int(x.q)}</td><td>${Fmt.int(x.c)}</td><td>${Fmt.int(x.e)}</td>
        <td>${x.pct == null ? dash : Fmt.pct(x.pct)}</td>
        <td>${hasPrev ? delta(x.delta) : dash}</td>
        <td>${x.f ? Fmt.dur(x.f) : dash}</td>
        <td>${x.pace == null ? dash : Fmt.pace(x.pace)}</td></tr>`).join('')}
    </tbody></table>`;
  },
};
