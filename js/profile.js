'use strict';

/* ============================================================
   Perfil de estudo: cada pessoa escolhe para que estuda e o app
   ajusta os termos (Área/Matéria/Disciplina…), o modelo pronto
   de matérias, as sugestões de provas/bancas e os exemplos.
   ============================================================ */

// vocabulário atual (preenchido pelo perfil). S/s = matéria, P/p = assunto, I/i = instituição/banca.
const T = {};

const ENEM_TEMPLATE = [
  ['Linguagens', '#b5566e', [['Interpretação de texto', 'a'], ['Gêneros textuais', 'a'], ['Gramática', 'm'], ['Literatura', 'm'], ['Funções da linguagem', 'm'], ['Variação linguística', 'm'], ['Inglês ou Espanhol', 'm'], ['Artes', 'b'], ['Educação física', 'b']]],
  ['Matemática', '#4f6d8f', [['Porcentagem, razão e proporção', 'a'], ['Estatística', 'a'], ['Geometria plana', 'a'], ['Geometria espacial', 'a'], ['Escalas e grandezas', 'a'], ['Funções', 'm'], ['Probabilidade e combinatória', 'm'], ['Progressões', 'b'], ['Trigonometria', 'b']]],
  ['Ciências da Natureza', '#5b8a6b', [['Ecologia', 'a'], ['Genética', 'm'], ['Fisiologia humana', 'm'], ['Citologia', 'm'], ['Eletricidade', 'a'], ['Mecânica', 'm'], ['Ondulatória', 'm'], ['Termologia', 'm'], ['Química orgânica', 'a'], ['Estequiometria', 'm'], ['Soluções', 'm'], ['Eletroquímica', 'm']]],
  ['Ciências Humanas', '#a5772c', [['História do Brasil', 'a'], ['História geral', 'm'], ['Geografia física e ambiental', 'a'], ['Geopolítica', 'm'], ['Urbanização', 'm'], ['Filosofia', 'm'], ['Sociologia', 'm'], ['Cidadania e direitos', 'm']]],
  ['Redação', '#c4623f', [['Estrutura do texto dissertativo', 'a'], ['Repertório sociocultural', 'a'], ['Proposta de intervenção', 'a'], ['Coesão e coerência', 'm']]],
];

const CONCURSO_TEMPLATE = [
  ['Língua Portuguesa', '#c4623f', [['Interpretação de texto', 'a'], ['Concordância', 'a'], ['Pontuação', 'a'], ['Crase', 'm'], ['Regência', 'm'], ['Classes de palavras', 'm'], ['Colocação pronominal', 'b']]],
  ['Raciocínio Lógico', '#4f6d8f', [['Proposições e conectivos', 'a'], ['Equivalências e negações', 'a'], ['Porcentagem', 'm'], ['Análise combinatória', 'm'], ['Probabilidade', 'm'], ['Sequências', 'b']]],
  ['Informática', '#3f8a8a', [['Word e Excel', 'a'], ['Segurança da informação', 'a'], ['Windows', 'm'], ['Internet e navegadores', 'm'], ['Redes', 'b']]],
  ['Direito Constitucional', '#8a5a8c', [['Direitos e garantias fundamentais', 'a'], ['Administração pública na CF', 'a'], ['Organização do Estado', 'm'], ['Organização dos Poderes', 'm']]],
  ['Direito Administrativo', '#5b8a6b', [['Princípios', 'a'], ['Atos administrativos', 'a'], ['Licitações e contratos', 'a'], ['Agentes públicos', 'm'], ['Responsabilidade civil do Estado', 'm'], ['Improbidade administrativa', 'm']]],
];

const PROFILES = {
  residencia: {
    label: 'Residência médica', short: 'residência médica',
    terms: { S: 'Área', s: 'área', SS: 'Áreas', ss: 'áreas', P: 'Tema', p: 'tema', PP: 'Temas', pp: 'temas', I: 'Instituição', i: 'instituição', ii: 'instituições' },
    template: () => RES_TEMPLATE, templateLabel: 'as 5 grandes áreas da residência',
    insts: () => INSTITUTIONS,
    ex: { exam: 'ENARE', exams: 'ENARE, USP, SUS-SP…', inst: 'ENARE', sim: 'USP-SP', front: 'Tríade de Beck (tamponamento cardíaco)?', back: 'Hipotensão, turgência jugular e abafamento de bulhas' },
  },
  concurso: {
    label: 'Concursos públicos', short: 'concurso',
    terms: { S: 'Matéria', s: 'matéria', SS: 'Matérias', ss: 'matérias', P: 'Assunto', p: 'assunto', PP: 'Assuntos', pp: 'assuntos', I: 'Banca', i: 'banca', ii: 'bancas' },
    template: () => CONCURSO_TEMPLATE, templateLabel: 'as matérias básicas de concurso',
    insts: () => ['Cebraspe', 'FGV', 'FCC', 'Vunesp', 'Cesgranrio', 'IBFC', 'Quadrix', 'Instituto AOCP', 'IDECAN', 'Fundatec', 'Consulplan', 'IADES', 'IBADE', 'FUNRIO', 'Instituto Consulplan', 'Selecon', 'Fundação Carlos Chagas'],
    ex: { exam: 'TRT 2ª Região', exams: 'o seu concurso', inst: 'FGV', sim: 'Cebraspe', front: 'Princípios da administração pública (LIMPE)?', back: 'Legalidade, Impessoalidade, Moralidade, Publicidade e Eficiência' },
  },
  vestibular: {
    label: 'ENEM e vestibulares', short: 'ENEM e vestibular',
    terms: { S: 'Matéria', s: 'matéria', SS: 'Matérias', ss: 'matérias', P: 'Assunto', p: 'assunto', PP: 'Assuntos', pp: 'assuntos', I: 'Prova', i: 'prova', ii: 'provas' },
    template: () => ENEM_TEMPLATE, templateLabel: 'as áreas do ENEM',
    insts: () => ['ENEM', 'FUVEST', 'UNICAMP', 'UNESP', 'UERJ', 'UFPR', 'UFRGS', 'UFSC', 'UNIFESP', 'UEL', 'UEM', 'PUC-SP', 'Mackenzie', 'Santa Casa', 'Albert Einstein', 'UFU', 'ITA', 'IME'],
    ex: { exam: 'ENEM', exams: 'ENEM, FUVEST, UNICAMP…', inst: 'ENEM', sim: 'FUVEST', front: 'Fórmula de Bhaskara?', back: 'x = (−b ± √Δ) / 2a, com Δ = b² − 4ac' },
  },
  faculdade: {
    label: 'Faculdade', short: 'faculdade',
    terms: { S: 'Disciplina', s: 'disciplina', SS: 'Disciplinas', ss: 'disciplinas', P: 'Assunto', p: 'assunto', PP: 'Assuntos', pp: 'assuntos', I: 'Prova', i: 'prova', ii: 'provas' },
    template: null, insts: () => ['P1', 'P2', 'P3', 'Prova final', 'Lista de exercícios'],
    ex: { exam: 'P1 de Cálculo', exams: 'as suas provas', inst: 'P1', sim: 'P2', front: 'Derivada de sen(x)?', back: 'cos(x)' },
  },
  outro: {
    label: 'Outro', short: 'os seus estudos',
    terms: { S: 'Matéria', s: 'matéria', SS: 'Matérias', ss: 'matérias', P: 'Assunto', p: 'assunto', PP: 'Assuntos', pp: 'assuntos', I: 'Prova', i: 'prova', ii: 'provas' },
    template: null, insts: () => [],
    ex: { exam: 'Prova', exams: 'as suas provas', inst: '', sim: '', front: 'Pergunta', back: 'Resposta' },
  },
};

const Profile = {
  key() { const k = Store.data.settings.profile; return PROFILES[k] ? k : 'outro'; },
  get() { return PROFILES[this.key()]; },
  chosen() { return !!PROFILES[Store.data.settings.profile]; },

  // Quem já usava o app antes dos perfis estudava para residência.
  migrate(hadData) {
    const s = Store.data.settings;
    if (!s.profile && hadData) { s.profile = 'residencia'; Store.save(); }
  },

  set(k) {
    if (!PROFILES[k]) return;
    Store.data.settings.profile = k;
    Store.save();
    this.apply();
    App.renderAll();
  },

  // Troca os textos marcados no HTML: data-term (texto), data-term-ph (placeholder), data-term-title (título/aria)
  apply() {
    const p = this.get();
    Object.assign(T, p.terms, { exam: p.ex.exam, exams: p.ex.exams, inst: p.ex.inst, sim: p.ex.sim, front: p.ex.front, back: p.ex.back, short: p.short });
    const fill = (tpl) => tpl.replace(/\{(\w+)\}/g, (m, k) => (T[k] ?? m));
    $$('[data-term]').forEach((el) => { el.textContent = fill(el.dataset.term); });
    $$('[data-term-ph]').forEach((el) => { el.placeholder = fill(el.dataset.termPh); });
    $$('[data-term-title]').forEach((el) => { const v = fill(el.dataset.termTitle); el.title = v; if (el.hasAttribute('aria-label') && !el.dataset.termAria) el.setAttribute('aria-label', v); });
    $$('[data-term-aria]').forEach((el) => el.setAttribute('aria-label', fill(el.dataset.termAria)));
    // sugestões de bancas/instituições do perfil
    Plan.refreshInst?.();
    // modelo pronto (só nos perfis que têm)
    const tb = $('#btnTemplate');
    if (tb) tb.hidden = !p.template;
    if (document.body) document.body.dataset.profile = this.key();
  },

  template() { const t = this.get().template; return t ? t() : null; },

  renderSelect() {
    const k = Store.data.settings.profile || '';
    $('#profileSel').innerHTML = (k ? '' : '<option value="">Escolha…</option>') + Object.entries(PROFILES).map(([key, p]) => `<option value="${key}"${key === k ? ' selected' : ''}>${p.label}</option>`).join('');
  },
};
