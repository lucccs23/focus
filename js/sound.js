'use strict';

/* ============================================================
   Som de fundo gerado na hora (sem arquivos): ruído branco,
   rosa (parece chuva) e marrom (parece cachoeira).
   ============================================================ */
const BG_SOUNDS = { none: 'Nenhum', white: 'Ruído branco', pink: 'Chuva suave', brown: 'Cachoeira' };

const Sound = {
  src: null, gain: null, type: null, vol: null, buffers: {},

  wanted() {
    const s = Store.data.settings;
    if (!s.bgSound || s.bgSound === 'none') return null;
    if (s.bgOnlyFocus && !(Timer.running && Timer.def.focus)) return null;
    return s.bgSound;
  },
  volume() { const v = (Store.data.settings.bgVolume ?? 35) / 100; return v * v * 0.6; },

  // Chamado a cada atualização do timer: liga, desliga ou ajusta o volume.
  update() {
    const want = this.wanted();
    if (want !== this.type) {
      this.stop();
      if (want) this.play(want);
      return;
    }
    const v = this.volume();
    if (this.gain && v !== this.vol) { this.vol = v; this.gain.gain.setTargetAtTime(v, App.audioCtx.currentTime, 0.1); }
  },

  buffer(type) {
    if (this.buffers[type]) return this.buffers[type];
    const ctx = App.audioCtx, len = ctx.sampleRate * 6;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (type === 'white') d[i] = w * 0.5;
        else if (type === 'pink') { // filtro de Paul Kellet
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      }
      // emenda suave no fim do loop
      const fade = Math.floor(ctx.sampleRate * 0.05);
      for (let i = 0; i < fade; i++) { const k = i / fade; d[len - fade + i] = d[len - fade + i] * (1 - k) + d[i] * k; }
    }
    return (this.buffers[type] = buf);
  },

  play(type) {
    App.unlockAudio();
    const ctx = App.audioCtx;
    if (!ctx) return;
    try {
      this.src = ctx.createBufferSource();
      this.src.buffer = this.buffer(type);
      this.src.loop = true;
      this.gain = ctx.createGain();
      this.gain.gain.value = 0;
      this.src.connect(this.gain).connect(ctx.destination);
      this.src.start();
      this.vol = this.volume();
      this.gain.gain.setTargetAtTime(this.vol, ctx.currentTime, 0.5);
      this.type = type;
    } catch (_) { this.src = null; this.gain = null; this.type = null; }
  },

  stop() {
    const src = this.src, g = this.gain, ctx = App.audioCtx;
    this.src = null; this.gain = null; this.type = null; this.vol = null;
    if (!src) return;
    try { g.gain.setTargetAtTime(0, ctx.currentTime, 0.25); } catch (_) { /* ignora */ }
    setTimeout(() => { try { src.stop(); } catch (_) { /* ignora */ } }, 1200);
  },

  menu(anchor) {
    const s = Store.data.settings;
    const set = (k, v) => { s[k] = v; Store.save(); this.update(); App.renderTimer(); };
    App.openMenu(anchor, [
      ...Object.entries(BG_SOUNDS).map(([k, label]) => ({ label: `${s.bgSound === k ? '✓ ' : '   '}${label}`, fn: () => set('bgSound', k) })),
      '-',
      { label: `${s.bgOnlyFocus ? '✓ ' : '   '}Só enquanto o foco roda`, fn: () => set('bgOnlyFocus', !s.bgOnlyFocus) },
      { label: 'Volume e mais opções…', fn: () => Settings.open() },
    ]);
  },
};
