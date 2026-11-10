'use strict';

/* Gráfico de barras empilhadas (+ linha opcional no eixo direito 0–100%), em SVG puro. */
const Charts = {
  // topo do eixo = 4 × um passo "redondo" (1, 2, 2,5, 5 × 10^n), para os 4 rótulos ficarem limpos
  niceMax(v) {
    if (!(v > 0)) return 4;
    const raw = v / 4;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
    return step * 4;
  },

  /**
   * o.data   : [{label, ...}]
   * o.stacks : [{val: d => número, color}]
   * o.line   : {val: d => 0..1 | null, color}  (opcional)
   * o.yFmt   : v => texto do eixo esquerdo
   * o.tip    : d => html do tooltip
   * o.empty  : boolean — mostra "sem registros"
   */
  bars(el, o) {
    const W = Math.max(300, Math.floor(el.clientWidth || 800)), H = o.height || 230;
    const P = { l: 46, r: o.line ? 46 : 12, t: 12, b: 26 };
    const pw = W - P.l - P.r, ph = H - P.t - P.b, yb = P.t + ph;
    const n = Math.max(1, o.data.length);
    const tot = o.data.map((d) => o.stacks.reduce((a, s) => a + Math.max(0, s.val(d) || 0), 0));
    const max = this.niceMax(tot.reduce((a, b) => Math.max(a, b), 0));
    const band = pw / n, bw = Math.max(1.5, Math.min(30, band * 0.64));
    const f = (x) => x.toFixed(1);

    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const y = yb - (ph * i) / 4;
      grid += `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${f(y)}" y2="${f(y)}"/>`;
      grid += `<text x="${P.l - 8}" y="${f(y + 4)}" text-anchor="end">${o.yFmt((max * i) / 4)}</text>`;
      if (o.line) grid += `<text x="${W - P.r + 8}" y="${f(y + 4)}">${i * 25}%</text>`;
    }

    let bars = '', hits = '';
    o.data.forEach((d, i) => {
      const x0 = P.l + band * i;
      let y = yb;
      o.stacks.forEach((s) => {
        const v = Math.max(0, s.val(d) || 0);
        if (!v) return;
        const h = (ph * v) / max;
        y -= h;
        bars += `<rect x="${f(x0 + (band - bw) / 2)}" y="${f(y)}" width="${f(bw)}" height="${f(h)}" rx="${Math.min(3, bw / 3).toFixed(1)}" style="fill:${s.color}"/>`;
      });
      hits += `<rect class="hit" data-i="${i}" x="${f(x0)}" y="${P.t}" width="${f(band)}" height="${ph}"/>`;
    });

    let line = '';
    if (o.line) {
      const pts = [];
      o.data.forEach((d, i) => {
        const v = o.line.val(d);
        if (v != null) pts.push([P.l + band * i + band / 2, yb - ph * v]);
      });
      if (pts.length > 1) line += `<polyline points="${pts.map((p) => f(p[0]) + ',' + f(p[1])).join(' ')}" style="fill:none;stroke:${o.line.color};stroke-width:2;stroke-linejoin:round"/>`;
      if (pts.length <= 120) pts.forEach((p) => { line += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="3.6" style="fill:${o.line.color}"/>`; });
    }

    const step = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(pw / 54))));
    let xl = '';
    o.data.forEach((d, i) => {
      if (i % step) return;
      xl += `<text x="${f(P.l + band * i + band / 2)}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>`;
    });

    el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">${grid}${bars}${line}${xl}${hits}</svg>`
      + (o.empty ? '<div class="chart-empty">Sem registros no período</div>' : '')
      + '<div class="tip" hidden></div>';

    const tip = el.querySelector('.tip');
    el.onpointermove = el.onpointerdown = (e) => {
      const h = e.target.closest && e.target.closest('.hit');
      if (!h || o.empty) { tip.hidden = true; return; }
      const i = +h.dataset.i;
      tip.innerHTML = o.tip(o.data[i]);
      tip.hidden = false;
      const x = P.l + band * i + band / 2;
      const half = tip.offsetWidth / 2 + 4;
      tip.style.left = Math.min(W - half, Math.max(half, x)) + 'px';
      tip.style.top = Math.max(tip.offsetHeight + 4, yb - (ph * tot[i]) / max - 10) + 'px';
    };
    el.onpointerleave = (e) => { if (e.pointerType === 'mouse') tip.hidden = true; };
  },
};
