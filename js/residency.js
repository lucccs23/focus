'use strict';

/* ============================================================
   Residência médica: modelo das 5 grandes áreas, provas-alvo,
   ritmo até a prova, pontos fracos (incidência × acerto) e
   ciclo de estudos por peso e dificuldade.
   ============================================================ */

// incidência: a = alta, m = média, b = baixa (referência geral das provas; ajuste à vontade)
const RES_TEMPLATE = [
  ['Clínica Médica', '#c4623f', [
    ['Cardiologia', 'a'], ['Endocrinologia', 'a'], ['Gastroenterologia e Hepatologia', 'a'], ['Infectologia', 'a'],
    ['Pneumologia', 'm'], ['Nefrologia', 'm'], ['Hematologia', 'm'], ['Reumatologia', 'm'], ['Neurologia', 'm'],
    ['Emergências clínicas', 'a'], ['Psiquiatria', 'b'], ['Dermatologia', 'b'], ['Geriatria', 'b'],
  ]],
  ['Cirurgia', '#4f6d8f', [
    ['Trauma (ATLS)', 'a'], ['Abdome agudo', 'a'], ['Hérnias da parede abdominal', 'a'], ['Vias biliares e pâncreas', 'a'],
    ['Esôfago, estômago e intestino', 'm'], ['Proctologia', 'm'], ['Pré e pós-operatório', 'm'], ['Queimaduras', 'm'],
    ['Urologia', 'm'], ['Cirurgia vascular', 'b'], ['Cirurgia pediátrica', 'b'], ['Cabeça, pescoço e tireoide', 'b'],
    ['Ortopedia', 'b'], ['Otorrinolaringologia', 'b'], ['Oftalmologia', 'b'], ['Anestesiologia', 'b'],
  ]],
  ['Pediatria', '#5b8a6b', [
    ['Neonatologia', 'a'], ['Puericultura e crescimento', 'a'], ['Aleitamento materno', 'a'], ['Imunizações', 'a'],
    ['Doenças exantemáticas', 'a'], ['Infecções respiratórias', 'a'], ['Diarreia e desidratação', 'm'],
    ['Emergências pediátricas', 'm'], ['Nefrologia pediátrica', 'm'], ['Desenvolvimento neuropsicomotor', 'm'],
    ['Adolescência', 'b'], ['Cardiopatias congênitas', 'b'], ['Síndromes genéticas', 'b'],
  ]],
  ['Ginecologia e Obstetrícia', '#b5566e', [
    ['Pré-natal', 'a'], ['Sangramentos da gestação', 'a'], ['Doença hipertensiva na gestação', 'a'], ['Parto e puerpério', 'a'],
    ['Rastreamento do câncer de colo', 'a'], ['Câncer de mama', 'a'], ['Diabetes gestacional', 'm'],
    ['Infecções na gestação', 'm'], ['Anticoncepção', 'm'], ['Amenorreias e endocrinologia ginecológica', 'm'],
    ['Climatério', 'm'], ['Infecções genitais e ISTs', 'm'], ['Sangramento uterino anormal e endometriose', 'm'],
    ['Infertilidade', 'b'], ['Uroginecologia', 'b'],
  ]],
  ['Medicina Preventiva', '#a5772c', [
    ['SUS: princípios e legislação', 'a'], ['Epidemiologia e indicadores de saúde', 'a'], ['Estudos epidemiológicos', 'a'],
    ['Testes diagnósticos', 'a'], ['Vigilância em saúde e notificação', 'a'], ['Atenção primária e ESF', 'a'],
    ['Bioestatística', 'm'], ['Medicina baseada em evidências', 'm'], ['Ética médica', 'm'],
    ['Medicina do trabalho', 'm'], ['Rastreamentos e prevenção', 'm'],
  ]],
];

// sugestões nos campos "Instituição" (pode digitar qualquer outra)
const INSTITUTIONS = ['ENARE', 'USP-SP', 'USP-RP', 'UNIFESP', 'UNICAMP', 'SUS-SP', 'SES-DF', 'PSU-MG', 'PSU-GO', 'AMRIGS',
  'UFRJ', 'UERJ', 'UFF', 'UFPR', 'HCPA', 'UNESP', 'IAMSPE', 'Santa Casa-SP', 'Einstein', 'Sírio-Libanês', 'UFMG', 'UFPE',
  'SURCE', 'UFBA', 'UFC', 'UFSC', 'HSL', 'HIAE', 'Revalida'];

const INC = { a: { label: 'Alta', w: 3 }, m: { label: 'Média', w: 2 }, b: { label: 'Baixa', w: 1 } };
const DIFF = { 1: { label: 'Fácil', f: 0.8 }, 2: { label: 'Média', f: 1 }, 3: { label: 'Difícil', f: 1.25 } };

const Plan = {
  init() {
    // lista de instituições para todos os campos com list="instList"
    this.refreshInst = () => {
      const used = new Set(Profile.instsAll());
      [...Store.data.questions, ...Store.data.simulados, ...(Store.data.settings.exams || [])].forEach((x) => { const n = x.inst || x.name; if (n) used.add(n); });
      $('#instList').innerHTML = [...used].map((x) => `<option value="${esc(x)}">`).join('');
    };
    $('#exams').addEventListener('click', (e) => {
      if (e.target.closest('[data-edit-exams]')) return Subjects.open('exams');
      const s = e.target.closest('[data-study-topic]');
      if (s) this.studyTopic(s.dataset.studyTopic, s.dataset.kind);
    });
  },

  /* ---------- modelo das grandes áreas ---------- */
  loadTemplate(data = Profile.template()) {
    let ns = 0, nt = 0;
    (data || []).forEach(([name, color, topics]) => {
      const before = Store.data.subjects.length;
      const s = Store.addSubject(name, { color, weight: 1, diff: 2 });
      if (Store.data.subjects.length > before) ns++;
      topics.forEach(([tn, inc]) => {
        const had = s.topics.length;
        const t = Store.addTopic(s.id, tn, { inc });
        if (s.topics.length > had) nt++;
        else if (!t.inc) t.inc = inc;
      });
    });
    return { ns, nt };
  },

  /* ---------- provas-alvo e ritmo ---------- */
  exams() { return (Store.data.settings.exams || []).filter((x) => x.date).slice().sort((a, b) => a.date - b.date); },
  nextExam() { const t0 = D.sod(Date.now()); return this.exams().find((x) => x.date >= t0) || null; },
  daysTo(ts) { return Math.round((D.sod(ts) - D.sod(Date.now())) / DAY); },

  pace(exam) {
    const topics = Store.activeSubjects().flatMap((s) => s.topics);
    const total = topics.length, studied = topics.filter((t) => t.studied).length;
    const days = Math.max(0, this.daysTo(exam.date));
    const weeks = Math.max(1, days / 7);
    const left = total - studied;
    return { total, studied, left, days, perWeek: left ? Math.ceil(left / weeks) : 0 };
  },

  /* ---------- pontos fracos ---------- */
  topicStats() {
    const m = new Map();
    Store.allQuestions().forEach((q) => {
      if (!q.topicId) return;
      const o = m.get(q.topicId) || { q: 0, c: 0 };
      o.q += q.total; o.c += q.correct;
      m.set(q.topicId, o);
    });
    return m;
  },

  // Temas para atacar primeiro: muito cobrados com acerto baixo, ou de alta incidência ainda não estudados.
  weak(limit = 5) {
    const st = this.topicStats(), out = [];
    Store.activeSubjects().forEach((s) => s.topics.forEach((t) => {
      const w = INC[t.inc]?.w || 1.5;
      const x = st.get(t.id);
      if (x && x.q >= 5) {
        const acc = x.c / x.q;
        if (acc < 0.8) out.push({ s, t, score: w * (1 - acc) * (acc < 0.6 ? 1.3 : 1), kind: 'questoes', why: `${Fmt.pct(acc)} de acerto em ${Fmt.int(x.q)} questões` });
      } else if (!t.studied && t.inc === 'a') {
        out.push({ s, t, score: w * 0.3, kind: 'estudo', why: 'ainda não estudado' });
      }
    }));
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  },

  studyTopic(topicId, kind) {
    const s = Store.data.subjects.find((x) => x.topics.some((t) => t.id === topicId));
    const t = s && s.topics.find((x) => x.id === topicId);
    if (!t) return;
    const d = Store.data;
    const type = kind === 'questoes' ? 'questoes' : 'estudo';
    let task = d.tasks.find((x) => x.topicId === t.id && x.type === type && !x.done && !x.archived);
    if (!task) {
      task = { id: uid(), title: `${type === 'questoes' ? 'Questões' : 'Estudo'} de ${s.name} — ${t.name}`, subjectId: s.id, topicId: t.id, type, est: 1, pomos: 0, focusMs: 0, done: false, archived: false, createdAt: Date.now() };
      d.tasks.push(task);
    }
    d.activeTaskId = task.id;
    if (!Timer.isStarted()) { Timer.setMode('pomodoro'); Timer.start(); }
    App.renderAll();
    App.toast(`Estudando: ${task.title}`);
  },

  /* ---------- ciclo por peso e dificuldade ---------- */
  distribute(hours, questions) {
    const subs = Store.data.subjects;
    const w = subs.map((s) => (+s.weight || 1) * (DIFF[s.diff || 2]?.f || 1));
    const tot = w.reduce((a, b) => a + b, 0) || 1;
    subs.forEach((s, i) => {
      if (hours > 0) s.goalH = Math.max(0.5, Math.round((hours * w[i] / tot) * 2) / 2);
      if (questions > 0) s.goalQ = Math.max(5, Math.round((questions * w[i] / tot) / 5) * 5);
    });
  },

  /* ---------- painel da tela inicial ---------- */
  render() {
    const el = $('#exams');
    const ex = this.nextExam();
    const weak = this.weak(4);
    const hasTopics = Store.data.subjects.some((s) => s.topics.length);
    if (!ex && !weak.length) {
      el.hidden = !hasTopics;
      el.innerHTML = `<div class="panel-head"><h3>Provas-alvo</h3></div>
        <p class="hint" style="margin:0">Cadastre a data das provas (${T.exams}) para ver quanto falta e o ritmo necessário.
        <button class="link" data-edit-exams>Cadastrar provas</button></p>`;
      return;
    }
    el.hidden = false;
    let head = '';
    if (ex) {
      const p = this.pace(ex);
      const others = this.exams().filter((x) => x !== ex && x.date >= D.sod(Date.now())).slice(0, 3);
      head = `<div class="panel-head"><h3>${esc(ex.name)} <span class="muted">· ${D.ddmmyy(ex.date)}</span></h3><button class="link" data-edit-exams>Provas</button></div>
        <div class="exam-row">
          <div class="exam-days"><b>${p.days}</b><span>dia${p.days === 1 ? '' : 's'}</span></div>
          <div class="exam-pace">
            ${p.total ? `<div><b>${Math.round((p.studied / p.total) * 100)}%</b> dos ${T.pp} estudados <span class="muted">(${p.studied} de ${p.total})</span></div>
              <div class="bar sm"><i style="width:${((p.studied / p.total) * 100).toFixed(1)}%"></i></div>
              <div class="muted">${p.left ? `Ritmo necessário: <b class="txt">${p.perWeek} ${T.p}${p.perWeek === 1 ? '' : 's'} por semana</b> para ver tudo até a prova` : `Todos os ${T.pp} estudados — foco em questões e revisão`}</div>`
              : `<div class="muted">Cadastre os ${T.pp} em ${T.SS} para calcular o ritmo.</div>`}
          </div>
        </div>
        ${others.length ? `<div class="exam-others">${others.map((o) => `<span>${esc(o.name)} <b>${this.daysTo(o.date)}d</b></span>`).join('')}</div>` : ''}`;
    } else {
      head = `<div class="panel-head"><h3>Provas-alvo</h3><button class="link" data-edit-exams>Cadastrar provas</button></div>`;
    }
    el.innerHTML = head + (weak.length ? `
      <h4 class="weak-h">Atacar primeiro</h4>
      <div class="weak-list">${weak.map((x) => `<div class="weak">
        <span class="tag" style="--c:${Store.subjectColor(x.s.id)}">${esc(x.t.name)}</span>
        <small>${esc(x.s.name)} · ${x.why}${x.t.inc ? ` · incidência ${INC[x.t.inc].label.toLowerCase()}` : ''}</small>
        <button class="btn sm" data-study-topic="${x.t.id}" data-kind="${x.kind}">${x.kind === 'questoes' ? 'Questões' : 'Estudar'}</button>
      </div>`).join('')}</div>` : '');
  },
};
