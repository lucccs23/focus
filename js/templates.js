'use strict';

/* ============================================================
   Modelos prontos de matérias e assuntos (com a incidência:
   a = alta, m = média, b = baixa). Referência geral; ajuste à vontade.
   ============================================================ */
const mkTpl = (list) => list.map(([name, color, topics]) => [name, color, topics.map((t) => (Array.isArray(t) ? t : [t, 'm']))]);

/* ---------- residência: modelo detalhado (subtemas) ---------- */
const RES_DETAILED = mkTpl([
  ['Clínica Médica', '#c4623f', [
    ['Cardio · Hipertensão arterial', 'a'], ['Cardio · Insuficiência cardíaca', 'a'], ['Cardio · Síndromes coronarianas agudas', 'a'], ['Cardio · Arritmias', 'a'],
    ['Cardio · Valvopatias', 'm'], ['Cardio · Dislipidemia', 'm'], ['Cardio · Endocardite infecciosa', 'm'], ['Cardio · Pericardite e miocardite', 'b'],
    ['Endócrino · Diabetes mellitus', 'a'], ['Endócrino · Tireoide', 'a'], ['Endócrino · Adrenal', 'm'], ['Endócrino · Hipófise', 'b'], ['Endócrino · Obesidade', 'm'], ['Endócrino · Osteoporose e cálcio', 'm'],
    ['Gastro · Hemorragia digestiva', 'a'], ['Gastro · Hepatites virais', 'a'], ['Gastro · Cirrose e complicações', 'a'], ['Gastro · DRGE e dispepsia', 'm'], ['Gastro · Pancreatite', 'm'], ['Gastro · Doença inflamatória intestinal', 'm'], ['Gastro · Diarreias', 'b'],
    ['Infecto · HIV/aids', 'a'], ['Infecto · Tuberculose', 'a'], ['Infecto · Sepse', 'a'], ['Infecto · Pneumonias', 'a'], ['Infecto · Arboviroses', 'a'], ['Infecto · Meningites', 'm'], ['Infecto · Infecções sexualmente transmissíveis', 'm'], ['Infecto · Parasitoses', 'b'],
    ['Pneumo · Tromboembolismo pulmonar', 'a'], ['Pneumo · Asma', 'm'], ['Pneumo · DPOC', 'm'], ['Pneumo · Derrame pleural', 'm'], ['Pneumo · Doenças intersticiais', 'b'], ['Pneumo · Câncer de pulmão', 'b'],
    ['Nefro · Lesão renal aguda', 'a'], ['Nefro · Distúrbios hidroeletrolíticos', 'a'], ['Nefro · Distúrbios ácido-base', 'a'], ['Nefro · Doença renal crônica', 'm'], ['Nefro · Glomerulopatias', 'm'],
    ['Hemato · Anemias', 'a'], ['Hemato · Leucemias e linfomas', 'm'], ['Hemato · Coagulação e trombose', 'm'], ['Hemato · Transfusão', 'b'],
    ['Reumato · Artrite reumatoide', 'm'], ['Reumato · Lúpus', 'm'], ['Reumato · Gota e artrites', 'm'], ['Reumato · Vasculites', 'b'], ['Reumato · Espondiloartrites', 'b'],
    ['Neuro · AVC', 'a'], ['Neuro · Epilepsia e crise convulsiva', 'm'], ['Neuro · Cefaleias', 'm'], ['Neuro · Demências e Parkinson', 'b'], ['Neuro · Doenças neuromusculares', 'b'],
    ['Emergência · PCR e suporte avançado', 'a'], ['Emergência · Choque', 'a'], ['Emergência · Intoxicações', 'm'], ['Emergência · Anafilaxia', 'm'],
    ['Psiquiatria · Depressão e ansiedade', 'm'], ['Psiquiatria · Dependência química', 'm'], ['Psiquiatria · Psicoses e bipolaridade', 'b'],
    ['Dermatologia', 'b'], ['Geriatria', 'b'],
  ]],
  ['Cirurgia', '#4f6d8f', [
    ['Trauma · Atendimento inicial (ATLS)', 'a'], ['Trauma · Via aérea e tórax', 'a'], ['Trauma · Abdome', 'a'], ['Trauma · Choque hemorrágico', 'a'], ['Trauma · TCE e raquimedular', 'm'], ['Trauma · Pelve e extremidades', 'm'],
    ['Abdome agudo · Apendicite', 'a'], ['Abdome agudo · Colecistite e colangite', 'a'], ['Abdome agudo · Obstrutivo', 'a'], ['Abdome agudo · Perfurativo', 'm'], ['Abdome agudo · Vascular', 'm'], ['Diverticulite', 'm'],
    ['Hérnias da parede abdominal', 'a'], ['Colelitíase e coledocolitíase', 'a'], ['Tumores de pâncreas e vias biliares', 'm'],
    ['Esôfago (acalasia, DRGE cirúrgica)', 'm'], ['Câncer gástrico', 'm'], ['Câncer colorretal', 'a'], ['Cirurgia bariátrica', 'm'], ['Proctologia (hemorroidas, fissura, fístula)', 'm'],
    ['Avaliação e risco cirúrgico', 'm'], ['Complicações pós-operatórias', 'm'], ['Resposta metabólica ao trauma', 'b'], ['Nutrição em cirurgia', 'b'], ['Queimaduras', 'm'],
    ['Uro · Litíase urinária', 'm'], ['Uro · HPB e câncer de próstata', 'm'], ['Uro · Escroto agudo', 'm'],
    ['Vascular · Trombose venosa e varizes', 'm'], ['Vascular · Doença arterial periférica', 'b'], ['Vascular · Aneurisma de aorta', 'b'],
    ['Nódulo de tireoide e cabeça e pescoço', 'm'], ['Cirurgia pediátrica', 'b'], ['Ortopedia e fraturas', 'b'], ['Otorrinolaringologia', 'b'], ['Oftalmologia', 'b'], ['Anestesiologia', 'b'], ['Feridas e cirurgia plástica', 'b'],
  ]],
  ['Pediatria', '#5b8a6b', [
    ['Neo · Reanimação neonatal', 'a'], ['Neo · Icterícia neonatal', 'a'], ['Neo · Distúrbios respiratórios do RN', 'a'], ['Neo · Infecções congênitas e sepse neonatal', 'a'], ['Neo · Triagem neonatal', 'm'],
    ['Crescimento', 'a'], ['Desenvolvimento neuropsicomotor', 'a'], ['Aleitamento materno', 'a'], ['Alimentação complementar', 'm'], ['Calendário vacinal', 'a'],
    ['Doenças exantemáticas', 'a'], ['IVAS e otites', 'a'], ['Pneumonias e bronquiolite', 'a'], ['Asma na infância', 'm'],
    ['Diarreia e desidratação', 'a'], ['Desnutrição e obesidade infantil', 'm'], ['Anemia ferropriva', 'm'],
    ['ITU na infância', 'm'], ['Glomerulonefrite e síndrome nefrótica', 'm'],
    ['Sepse e choque na criança', 'm'], ['Intoxicações e acidentes', 'm'], ['Convulsão febril', 'm'], ['Maus-tratos', 'm'],
    ['Cardiopatias congênitas', 'b'], ['Síndromes genéticas', 'b'], ['Adolescência', 'b'],
  ]],
  ['Ginecologia e Obstetrícia', '#b5566e', [
    ['Pré-natal: rotina e exames', 'a'], ['Assistência ao parto', 'a'], ['Puerpério e lactação', 'm'], ['Abortamento, ectópica e mola', 'a'], ['Placenta prévia e DPP', 'a'],
    ['Síndromes hipertensivas na gestação', 'a'], ['Diabetes gestacional', 'a'], ['Infecções na gestação (sífilis, HIV, toxo)', 'a'], ['Prematuridade e rotura de membranas', 'a'],
    ['Hemorragia pós-parto', 'a'], ['Vitalidade fetal', 'm'], ['Isoimunização Rh', 'm'], ['Gemelaridade', 'b'],
    ['Rastreamento do câncer de colo', 'a'], ['Câncer de mama', 'a'], ['Câncer de endométrio e ovário', 'm'], ['Anticoncepção', 'a'],
    ['Amenorreias', 'm'], ['Síndrome dos ovários policísticos', 'm'], ['Sangramento uterino anormal', 'm'], ['Endometriose', 'm'], ['Miomatose', 'm'], ['Climatério', 'm'],
    ['Infecções genitais e DIP', 'm'], ['Violência sexual', 'm'], ['Infertilidade', 'b'], ['Incontinência urinária e prolapso', 'b'],
  ]],
  ['Medicina Preventiva', '#a5772c', [
    ['SUS: princípios e diretrizes', 'a'], ['SUS: Leis 8.080 e 8.142', 'a'], ['SUS: financiamento e gestão', 'm'], ['Atenção primária e ESF', 'a'], ['Políticas e programas de saúde', 'm'],
    ['Indicadores de saúde', 'a'], ['Estudos epidemiológicos', 'a'], ['Medidas de associação e risco', 'a'], ['Testes diagnósticos', 'a'], ['Bioestatística', 'm'],
    ['Vigilância epidemiológica e notificação', 'a'], ['Saúde do trabalhador', 'm'], ['Medicina baseada em evidências', 'm'], ['Ética médica e bioética', 'm'], ['Rastreamento e prevenção quaternária', 'm'],
  ]],
]);

/* ---------- concursos: carreiras ---------- */
const TPL_PT = ['Língua Portuguesa', '#c4623f', [['Interpretação de texto', 'a'], ['Concordância', 'a'], ['Pontuação', 'a'], ['Crase', 'm'], ['Regência', 'm'], ['Classes de palavras', 'm'], ['Colocação pronominal', 'b']]];
const TPL_RLM = ['Raciocínio Lógico', '#4f6d8f', [['Proposições e conectivos', 'a'], ['Equivalências e negações', 'a'], ['Porcentagem', 'm'], ['Análise combinatória', 'm'], ['Probabilidade', 'm'], ['Sequências', 'b']]];
const TPL_INFO = ['Informática', '#3f8a8a', [['Word e Excel', 'a'], ['Segurança da informação', 'a'], ['Windows', 'm'], ['Internet e navegadores', 'm'], ['Redes', 'b']]];
const TPL_CONST = ['Direito Constitucional', '#8a5a8c', [['Direitos e garantias fundamentais', 'a'], ['Administração pública na CF', 'a'], ['Organização do Estado', 'm'], ['Organização dos Poderes', 'm'], ['Controle de constitucionalidade', 'b']]];
const TPL_ADM = ['Direito Administrativo', '#5b8a6b', [['Princípios', 'a'], ['Atos administrativos', 'a'], ['Licitações e contratos (Lei 14.133)', 'a'], ['Agentes públicos', 'm'], ['Responsabilidade civil do Estado', 'm'], ['Improbidade administrativa', 'm'], ['Processo administrativo (Lei 9.784)', 'm']]];

const CONC_TRIBUNAIS = mkTpl([TPL_PT, TPL_RLM, TPL_INFO, TPL_CONST, TPL_ADM,
  ['Direito Processual Civil', '#a5772c', [['Normas fundamentais', 'a'], ['Competência', 'm'], ['Atos processuais e prazos', 'a'], ['Petição inicial e resposta', 'm'], ['Recursos', 'm'], ['Cumprimento de sentença', 'b']]],
  ['Direito Civil', '#b5566e', [['LINDB', 'm'], ['Pessoas naturais e jurídicas', 'm'], ['Negócio jurídico', 'a'], ['Prescrição e decadência', 'a'], ['Obrigações', 'm']]],
  ['Legislação específica do tribunal', '#7d7a74', [['Regimento interno', 'a'], ['Estatuto dos servidores', 'a']]],
]);
const CONC_POLICIAL = mkTpl([TPL_PT, TPL_RLM, TPL_INFO, TPL_CONST, TPL_ADM,
  ['Direito Penal', '#d14b4b', [['Aplicação da lei penal', 'm'], ['Teoria do crime', 'a'], ['Crimes contra a pessoa', 'a'], ['Crimes contra o patrimônio', 'a'], ['Crimes contra a administração pública', 'a']]],
  ['Processo Penal', '#a5772c', [['Inquérito policial', 'a'], ['Ação penal', 'm'], ['Prisões e medidas cautelares', 'a'], ['Provas', 'm']]],
  ['Legislação penal especial', '#6b7a3a', [['Lei de drogas', 'a'], ['Estatuto do desarmamento', 'a'], ['Abuso de autoridade', 'm'], ['Crimes hediondos', 'm'], ['Maria da Penha', 'm']]],
  ['Direitos Humanos', '#3f7cc4', [['Declaração Universal', 'm'], ['Pacto de San José', 'm']]],
]);
const CONC_FISCAL = mkTpl([TPL_PT,
  ['Matemática Financeira e Estatística', '#4f6d8f', [['Juros simples e compostos', 'a'], ['Descontos', 'm'], ['Amortização', 'm'], ['Estatística descritiva', 'a'], ['Probabilidade', 'm']]],
  ['Contabilidade Geral', '#3f8a8a', [['Patrimônio e lançamentos', 'a'], ['Balanço patrimonial', 'a'], ['DRE', 'a'], ['Estoques', 'm'], ['Análise das demonstrações', 'm']]],
  ['Direito Tributário', '#8a5a8c', [['Sistema tributário nacional', 'a'], ['Limitações ao poder de tributar', 'a'], ['Obrigação e crédito tributário', 'a'], ['Tributos em espécie', 'm'], ['Administração tributária', 'm']]],
  TPL_CONST, TPL_ADM,
  ['AFO e Finanças Públicas', '#a5772c', [['Orçamento público (PPA, LDO, LOA)', 'a'], ['Receita e despesa pública', 'a'], ['Lei de Responsabilidade Fiscal', 'a']]],
  ['Auditoria', '#6b7a3a', [['Normas de auditoria', 'm'], ['Controle interno', 'm'], ['Procedimentos de auditoria', 'm']]],
  ['Economia', '#b5566e', [['Microeconomia', 'm'], ['Macroeconomia', 'm']]],
]);
const CONC_BANCARIO = mkTpl([TPL_PT,
  ['Matemática e Matemática Financeira', '#4f6d8f', [['Juros simples e compostos', 'a'], ['Taxas de juros', 'a'], ['Descontos', 'm'], ['Sistemas de amortização', 'a'], ['Porcentagem', 'm']]],
  ['Conhecimentos Bancários', '#3f8a8a', [['Sistema Financeiro Nacional', 'a'], ['Produtos e serviços bancários', 'a'], ['Mercado de capitais', 'm'], ['Lavagem de dinheiro e compliance', 'a'], ['Garantias e seguros', 'm']]],
  ['Atualidades do mercado financeiro', '#a5772c', [['Pix e open finance', 'a'], ['Bancos digitais', 'm'], ['Moedas digitais', 'm']]],
  TPL_INFO,
  ['Vendas e Negociação', '#b5566e', [['Técnicas de vendas', 'a'], ['Atendimento e CDC', 'a'], ['Marketing de relacionamento', 'm']]],
  ['Inglês', '#7d7a74', [['Interpretação de texto', 'a'], ['Vocabulário', 'm']]],
]);
const CONC_INSS = mkTpl([TPL_PT, TPL_RLM, TPL_INFO,
  ['Ética no Serviço Público', '#6b7a3a', [['Código de Ética (Decreto 1.171)', 'a'], ['Lei 8.112 (regime disciplinar)', 'm']]],
  TPL_CONST, TPL_ADM,
  ['Seguridade Social e Previdenciário', '#3f7cc4', [['Seguridade social na CF', 'a'], ['Segurados e dependentes', 'a'], ['Benefícios', 'a'], ['Custeio', 'm'], ['Carência e salário de contribuição', 'a']]],
]);

/* ---------- vestibulares ---------- */
const FUVEST_TEMPLATE = mkTpl([
  ['Português', '#c4623f', [['Interpretação de texto', 'a'], ['Gramática', 'a'], ['Obras literárias obrigatórias', 'a'], ['Escolas literárias', 'm']]],
  ['Matemática', '#4f6d8f', [['Funções', 'a'], ['Geometria plana', 'a'], ['Geometria analítica', 'm'], ['Combinatória e probabilidade', 'a'], ['Trigonometria', 'm'], ['Progressões', 'm']]],
  ['Física', '#3f8a8a', [['Mecânica', 'a'], ['Eletricidade', 'a'], ['Óptica', 'm'], ['Ondulatória', 'm'], ['Termologia', 'm']]],
  ['Química', '#8a5a8c', [['Química geral', 'a'], ['Físico-química', 'a'], ['Orgânica', 'a'], ['Estequiometria', 'm']]],
  ['Biologia', '#5b8a6b', [['Citologia', 'a'], ['Genética', 'a'], ['Ecologia', 'a'], ['Fisiologia humana', 'a'], ['Evolução', 'm'], ['Botânica e zoologia', 'm']]],
  ['História', '#a5772c', [['História do Brasil', 'a'], ['História geral', 'a'], ['História contemporânea', 'm']]],
  ['Geografia', '#6b7a3a', [['Geografia física', 'a'], ['Geografia humana', 'a'], ['Geopolítica', 'm']]],
  ['Inglês', '#7d7a74', [['Interpretação de texto', 'a']]],
]);
const MEDICINA_VEST = mkTpl([
  ['Biologia', '#5b8a6b', [['Citologia', 'a'], ['Genética', 'a'], ['Fisiologia humana', 'a'], ['Ecologia', 'a'], ['Evolução', 'm'], ['Microbiologia e parasitologia', 'a'], ['Botânica', 'm'], ['Zoologia', 'm'], ['Embriologia e histologia', 'm']]],
  ['Química', '#8a5a8c', [['Química geral', 'a'], ['Estequiometria', 'a'], ['Soluções', 'm'], ['Físico-química', 'a'], ['Química orgânica', 'a'], ['Eletroquímica', 'm']]],
  ['Física', '#3f8a8a', [['Mecânica', 'a'], ['Eletricidade', 'a'], ['Ondulatória', 'm'], ['Óptica', 'm'], ['Termologia', 'm']]],
  ['Matemática', '#4f6d8f', [['Porcentagem, razão e proporção', 'a'], ['Estatística', 'a'], ['Geometria', 'a'], ['Funções', 'm'], ['Probabilidade e combinatória', 'a']]],
  ['Linguagens', '#b5566e', [['Interpretação de texto', 'a'], ['Gramática', 'm'], ['Literatura', 'm'], ['Inglês', 'm']]],
  ['Ciências Humanas', '#a5772c', [['História do Brasil', 'a'], ['Geografia', 'a'], ['Filosofia e sociologia', 'm']]],
  ['Redação', '#c4623f', [['Estrutura do texto dissertativo', 'a'], ['Repertório sociocultural', 'a'], ['Proposta de intervenção', 'a'], ['Coesão e coerência', 'm']]],
]);
