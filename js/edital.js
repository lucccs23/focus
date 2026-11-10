'use strict';

/* ============================================================
   Colar o edital (conteúdo programático): separa as matérias
   (títulos como "LÍNGUA PORTUGUESA:") e os assuntos numerados
   ("1 Compreensão de textos. 2 Ortografia…") e cadastra tudo.
   ============================================================ */
const Edital = {
  parsed: [],

  init() {
    const f = $('#editalForm');
    f.text.addEventListener('input', () => { clearTimeout(this._t); this._t = setTimeout(() => this.preview(), 250); });
    f.sub.onchange = () => this.preview();
    f.onsubmit = (e) => { e.preventDefault(); this.save(); };
    $('#btnEdital').onclick = () => this.open();
  },

  open() {
    const f = $('#editalForm');
    f.text.value = '';
    $('#editalErr').textContent = '';
    this.preview();
    $('#editalDlg').showModal();
    f.text.focus();
  },

  // "LÍNGUA PORTUGUESA" -> "Língua Portuguesa"
  title(s) {
    const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'para', 'à', 'na', 'no']);
    const t = s.replace(/\s+/g, ' ').trim().replace(/[:.\-–]+$/, '').trim();
    if (t !== t.toUpperCase()) return t;
    return t.toLowerCase().split(' ').map((w, i) => (i && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ')
      .replace(/\b(Cf|Clt|Sus|Lrf|Afo|Ti|Ii|Iii|Iv)\b/g, (m) => m.toUpperCase());
  },

  clean(s) {
    let t = s.replace(/\s+/g, ' ').trim().replace(/^[\-–•·]\s*/, '').replace(/[.;,:]+$/, '').trim();
    if (t.length > 110) t = t.slice(0, 108).replace(/\s+\S*$/, '') + '…';
    return t;
  },

  // assuntos de um trecho: itens numerados (1, 2, 3… ou 1.1 se pedido); senão, por linha ou ponto e vírgula
  items(body, sub) {
    // o número vem no início, depois de quebra de linha ou de ". " / "; " (assim "8.112" e "3.1" não viram itens soltos)
    const rx = sub ? /(?:^|\n|[.;]\s+)(\d{1,2}(?:\.\d{1,2}){0,2})\.?\s+(?=[A-ZÀ-Ú])/g : /(?:^|\n|[.;]\s+)(\d{1,2})\.?\s+(?=[A-ZÀ-Ú])/g;
    const marks = [];
    let m;
    while ((m = rx.exec(body))) marks.push({ at: m.index + m[0].length, from: m.index });
    let parts;
    if (marks.length >= 2) parts = marks.map((k, i) => body.slice(k.at, marks[i + 1] ? marks[i + 1].from + 1 : body.length));
    else parts = body.split(/\n|;\s*/);
    // sem subitens: o item termina antes do primeiro "3.1 …"
    if (!sub) parts = parts.map((x) => x.split(/[.;]?\s+\d{1,2}\.\d{1,2}\.?\s+(?=[A-ZÀ-Ú])/)[0]);
    return parts.map((x) => this.clean(x)).filter((x) => x.length > 2);
  },

  parse(text, sub) {
    const t = text.replace(/\r\n?/g, '\n').replace(/ /g, ' ').trim();
    if (!t) return [];
    // títulos: MAIÚSCULAS seguidas de ":" (no meio do texto ou no início da linha), ou linha toda em maiúsculas
    const heads = [];
    // (um título pode vir logo depois de outro: "CONHECIMENTOS BÁSICOS: LÍNGUA PORTUGUESA: 1 …")
    const rx = /(?<=^|\n|[.:;]\s{0,3}|\s{2})([A-ZÀ-Ú][A-ZÀ-Ú0-9 ,\-–()/]{3,90}?)\s*:\s*/g;
    let m;
    while ((m = rx.exec(t))) {
      const name = m[1].trim();
      if (/[A-ZÀ-Ú]{3}/.test(name)) heads.push({ name, from: m.index, at: m.index + m[0].length });
    }
    if (!heads.length) {
      const lx = /(^|\n)([A-ZÀ-Ú][A-ZÀ-Ú ,\-–()/]{3,80})\s*(?=\n)/g;
      while ((m = lx.exec(t + '\n'))) if (!/^\d/.test(m[2])) heads.push({ name: m[2].trim(), from: m.index + m[1].length, at: m.index + m[0].length });
    }
    if (!heads.length) return [{ name: '', items: this.items(t, sub) }];
    const out = heads.map((h, i) => ({ name: this.title(h.name), items: this.items(t.slice(h.at, heads[i + 1] ? heads[i + 1].from : t.length), sub) }));
    return out.filter((x) => x.items.length);
  },

  preview() {
    const f = $('#editalForm');
    this.parsed = this.parse(f.text.value, f.sub.checked);
    const box = $('#editalList');
    if (!this.parsed.length) {
      box.innerHTML = `<p class="hint" style="margin:0">Cole acima o conteúdo programático do edital. O app separa as ${T.ss} pelos títulos em maiúsculas (ex.: "LÍNGUA PORTUGUESA:") e os ${T.pp} pela numeração (1, 2, 3…).</p>`;
    } else {
      const subs = Store.data.subjects;
      box.innerHTML = this.parsed.map((p, i) => `<div class="ed-item">
        <label class="switch"><input type="checkbox" data-i="${i}" checked></label>
        <div class="ed-main">
          ${p.name ? `<input class="ed-name" data-i="${i}" value="${esc(p.name)}" maxlength="60" aria-label="Nome">`
            : `<select class="ed-target" data-i="${i}" aria-label="Adicionar a"><option value="">+ Nova ${T.s}…</option>${subs.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
               <input class="ed-name" data-i="${i}" placeholder="Nome da nova ${T.s}" maxlength="60" aria-label="Nome">`}
          <details><summary>${p.items.length} ${p.items.length === 1 ? T.p : T.pp}</summary><ol>${p.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details>
        </div></div>`).join('');
      box.querySelectorAll('.ed-target').forEach((s) => { s.onchange = () => { s.nextElementSibling.hidden = !!s.value; }; });
    }
    const n = this.parsed.reduce((a, p) => a + p.items.length, 0);
    $('#editalCount').textContent = this.parsed.length ? `${this.parsed.filter((p) => p.name).length || 1} ${T.s}(s) · ${n} ${T.p}(s) encontrados` : '';
  },

  save() {
    let ns = 0, nt = 0;
    for (const [i, p] of this.parsed.entries()) {
      if (!$(`#editalList input[type=checkbox][data-i="${i}"]`)?.checked) continue;
      const target = $(`#editalList .ed-target[data-i="${i}"]`)?.value;
      let s = target ? Store.subject(target) : null;
      if (!s) {
        const name = $(`#editalList .ed-name[data-i="${i}"]`)?.value.trim();
        if (!name) { $('#editalErr').textContent = `Dê um nome à ${T.s} dos ${T.pp} colados.`; return; }
        const before = Store.data.subjects.length;
        s = Store.addSubject(name, { weight: 1, diff: 2 });
        if (Store.data.subjects.length > before) ns++;
      }
      p.items.forEach((x) => { const had = s.topics.length; Store.addTopic(s.id, x); if (s.topics.length > had) nt++; });
    }
    $('#editalDlg').close();
    App.toast(`${ns} ${T.s}(s) e ${nt} ${T.p}(s) adicionados`);
    Subjects.changed();
  },
};
