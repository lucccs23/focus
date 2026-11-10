'use strict';

/* ============================================================
   Importar questões erradas colando o texto (QConcursos, TEC,
   PDFs de prova…): separa as questões, tira banca/ano/gabarito
   quando aparecem e cria uma revisão no caderno de erros para cada uma.
   ============================================================ */
const Importer = {
  parsed: [],

  init() {
    const f = $('#impForm');
    Pick.bind(f);
    f.text.addEventListener('input', () => { clearTimeout(this._t); this._t = setTimeout(() => this.preview(), 250); });
    $('#impList').addEventListener('change', () => this.count());
    $('#impAll').onclick = () => { const on = $$('#impList input').some((i) => !i.checked); $$('#impList input').forEach((i) => { i.checked = on; }); this.count(); };
    f.onsubmit = (e) => { e.preventDefault(); this.save(); };
  },

  open() {
    const f = $('#impForm');
    const t = Store.activeTask();
    Pick.fill(f, t?.subjectId, t?.topicId);
    f.text.value = '';
    f.asDone.checked = false;
    $('#impErr').textContent = '';
    this.preview();
    $('#impDlg').showModal();
    f.text.focus();
  },

  // ---------- leitura do texto ----------
  split(text) {
    const t = text.replace(/\r\n?/g, '\n').replace(/ /g, ' ').trim();
    if (!t) return [];
    const starts = [
      /^\s*quest[ãa]o\s*\d+\b/im,           // "Questão 12"
      /^\s*Q\d{4,}\b/m,                     // "Q123456" (QConcursos)
      /^\s*#?\d{5,}\b/m,                    // ids numéricos longos (TEC)
      /^\s*\d{1,3}\s*[.)\-–]\s+\S/m,        // "1. ", "2) ", "3 - "
    ];
    for (const re of starts) {
      const g = new RegExp(re.source, 'gim');
      const idx = [];
      let m;
      while ((m = g.exec(t))) { idx.push(m.index); if (m[0].length === 0) g.lastIndex++; }
      if (idx.length >= 2) {
        const blocks = [];
        if (idx[0] > 0 && t.slice(0, idx[0]).trim().length > 40) blocks.push(t.slice(0, idx[0]));
        idx.forEach((a, i) => blocks.push(t.slice(a, idx[i + 1] ?? t.length)));
        return blocks.map((b) => b.trim()).filter((b) => b.length > 8);
      }
    }
    const byBlank = t.split(/\n\s*\n\s*\n+/).map((b) => b.trim()).filter((b) => b.length > 8);
    return byBlank.length ? byBlank : [t];
  },

  parse(block) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const meta = {};
    const id = block.match(/\bQ\d{4,}\b/);
    if (id) meta.id = id[0];
    // banca termina antes do próximo rótulo da mesma linha (Órgão:, Prova:, Ano:…)
    const banca = block.match(/banca\s*[:\-]\s*(.+?)(?=\s+(?:[óo]rg[ãa]o|prova|ano|disciplina|cargo|n[íi]vel|modalidade)\s*[:\-]|\s*\||\n|$)/i);
    if (banca) meta.banca = banca[1].trim().slice(0, 60);
    // instituição/banca: rótulo "Instituição:/Prova:" ou um nome conhecido (do perfil de estudo) no texto
    const lab = block.match(/(?:institui[çc][ãa]o|prova|concurso)\s*[:\-]\s*(.+?)(?=\s+(?:ano|banca|[óo]rg[ãa]o|disciplina|cargo)\s*[:\-]|\s*\||\n|$)/i);
    const known = Profile.get().insts().find((n) => new RegExp(`(^|[^\\wÀ-ú])${n.replace(/[-]/g, '[-\\s]?')}(?![\\wÀ-ú])`, 'i').test(block));
    if (known) meta.inst = known;
    else if (lab) meta.inst = lab[1].trim().slice(0, 40);
    else if (meta.banca) meta.inst = meta.banca;
    const ano = block.match(/\bano\s*[:\-]\s*((?:19|20)\d{2})/i) || block.match(/\b((?:19|20)\d{2})\b/);
    if (ano) meta.ano = ano[1];
    const gab = block.match(/(?:gabarito|resposta(?:\s+correta)?|alternativa\s+correta)\s*[:\-]?\s*(?:letra\s*)?([A-E](?![a-z])|certo|errado|c(?=\b)|e(?=\b))/i);
    if (gab) {
      const g = gab[1].toUpperCase();
      meta.gabarito = g === 'CERTO' || g === 'ERRADO' ? g[0] + g.slice(1).toLowerCase() : g;
    }
    // enunciado: primeira linha "de verdade" (pula cabeçalhos tipo Ano:, Banca:, Órgão:, Prova:, número)
    const skip = /^(q\d+|quest[ãa]o\s*\d+|\d{1,3}\s*[.)\-–]?$|#?\d{5,}|ano\s*[:\-]|banca\s*[:\-]|[óo]rg[ãa]o\s*[:\-]|prova\s*[:\-]|disciplina\s*[:\-]|assunto\s*[:\-]|gabarito|resposta|n[íi]vel)/i;
    const body = lines.filter((l) => !skip.test(l)).map((l) => l.replace(/^\s*(quest[ãa]o\s*\d+|\d{1,3}\s*[.)\-–])\s*/i, ''));
    // pula "Matéria > Assunto" (trilha do site) e alternativas "A) …"
    const isStmt = (l) => l.length > 25 && !/\s>\s/.test(l) && !/^[A-Ea-e]\s*[).\-]\s/.test(l);
    const stmt = (body.find(isStmt) || body.find((l) => l.length > 25) || body[0] || lines[0] || '').replace(/\s+/g, ' ');
    return { text: block.slice(0, 4000), meta, summary: stmt.length > 170 ? stmt.slice(0, 167) + '…' : stmt };
  },

  preview() {
    const text = $('#impForm').text.value;
    this.parsed = this.split(text).map((b) => this.parse(b));
    const box = $('#impList');
    if (!this.parsed.length) {
      box.innerHTML = '<p class="hint" style="margin:0">Cole acima o texto das questões que você errou. Pode colar várias de uma vez: o app separa pelo número ou pelo código da questão (ex.: Q123456).</p>';
    } else {
      box.innerHTML = this.parsed.map((p, i) => `<label class="imp-item">
        <input type="checkbox" data-i="${i}" checked>
        <span class="imp-main"><span class="imp-sum">${esc(p.summary || '(sem texto)')}</span>
          <small>${[p.meta.id, p.meta.inst || p.meta.banca, p.meta.ano, p.meta.gabarito && `gabarito: ${p.meta.gabarito}`].filter(Boolean).map(esc).join(' · ') || 'sem banca/ano/gabarito identificados'}</small></span>
      </label>`).join('');
    }
    this.count();
  },

  count() {
    const n = $$('#impList input:checked').length;
    $('#impCount').textContent = this.parsed.length ? `${n} de ${this.parsed.length} questões selecionadas` : '';
    $('#impSubmit').textContent = n ? `Adicionar ${n} ao caderno` : 'Adicionar ao caderno';
    $('#impSubmit').disabled = !n;
  },

  save() {
    const f = $('#impForm');
    const pick = Pick.read(f);
    if (pick.error) { $('#impErr').textContent = pick.error; pick.el.focus(); return; }
    const chosen = $$('#impList input:checked').map((i) => this.parsed[+i.dataset.i]);
    if (!chosen.length) return;
    const now = Date.now();
    chosen.forEach((p) => {
      const tag = [p.meta.inst || p.meta.banca, p.meta.ano].filter(Boolean).join(' ');
      const note = `${p.meta.id ? `${p.meta.id} · ` : ''}${p.summary}${tag ? ` (${tag})` : ''}${p.meta.gabarito ? ` — gabarito: ${p.meta.gabarito}` : ''}`;
      const r = Store.scheduleReview({ subjectId: pick.subjectId, topicId: pick.topicId, wrong: 1, note: note.slice(0, 300), from: now });
      r.text = p.text;
      r.imported = true;
      if (p.meta.inst) r.inst = p.meta.inst;
    });
    if (f.asDone.checked) {
      // agrupa por instituição (cada uma vira um registro de questões)
      const by = new Map();
      chosen.forEach((p) => by.set(p.meta.inst || '', (by.get(p.meta.inst || '') || 0) + 1));
      by.forEach((n, inst) => Store.data.questions.push({ id: uid(), date: now, taskId: null, subjectId: pick.subjectId, topicId: pick.topicId, total: n, correct: 0, inst }));
    }
    $('#impDlg').close();
    App.renderAll();
    Reviews.tab = 'next';
    Reviews.render();
    App.toast(`${chosen.length} questão(ões) no caderno · primeira revisão em ${D.ddmm(D.addDays(D.sod(now), reviewSteps()[0]))}`);
  },
};
