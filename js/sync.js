'use strict';

/* ============================================================
   Sincronização entre computadores por uma pasta na nuvem
   (OneDrive, Google Drive, Dropbox…): cada computador grava e lê
   o arquivo focus-sync.json dessa pasta.

   - Sem mudanças locais pendentes: os dados da nuvem substituem os locais
     (exclusões e edições feitas no outro computador chegam certinho).
   - Mudanças nos dois lados ao mesmo tempo: junta os registros pelos ids
     (nada se perde; algo excluído só de um lado pode reaparecer).
   ============================================================ */
const SYNC_ARRAYS = ['subjects', 'tasks', 'sessions', 'questions', 'reviews', 'simulados', 'cards', 'essays'];

const Sync = {
  _t: null,
  _busy: false,

  available() { return !!window.desktop?.syncRead; },
  // pela internet (GitHub) em qualquer aparelho; pela pasta só no app de desktop
  folderOn() { const s = Store.data.settings; return this.available() && s.syncOn && !!s.syncDir; },
  enabled() { return Cloud.connected() || this.folderOn(); },
  read() { return Cloud.connected() ? Cloud.read() : window.desktop.syncRead(Store.data.settings.syncDir); },
  write(json) { return Cloud.connected() ? Cloud.write(json) : window.desktop.syncWrite(Store.data.settings.syncDir, json); },

  init() {
    const s = Store.data.settings;
    if (!s.deviceId) { s.deviceId = uid(); Store.save(); }
    // run() não faz nada enquanto a sincronização estiver desligada
    this.run();
    setInterval(() => this.run(), 60000);
    window.addEventListener('focus', () => this.run());
  },

  // chamado pelo Store.save quando os dados compartilháveis mudam
  changed() {
    if (!this.enabled()) return;
    clearTimeout(this._t);
    this._t = setTimeout(() => this.run(), 4000);
  },

  dirty() { const s = Store.data.settings; return (Store.data.updatedAt || 0) > (s.lastSyncAt || 0); },

  async run({ manual = false } = {}) {
    if (!this.enabled() || this._busy) return;
    this._busy = true;
    let s = Store.data.settings;
    try {
      const res = await this.read();
      if (!res.ok) throw new Error(res.error);
      let remote = null;
      if (res.json) { try { remote = JSON.parse(res.json); } catch { throw new Error('o arquivo da nuvem está corrompido'); } }

      // versão nova = código de versão diferente do último visto (não depende do relógio dos computadores)
      const remoteNew = remote && remote.deviceId !== s.deviceId
        && (remote.rev ? remote.rev !== s.syncSeenRev : (remote.updatedAt || 0) > (s.syncSeenAt || 0));
      if (remoteNew) {
        const merged = this.dirty();
        if (merged) {
          this.apply(this.merge(Store.data, remote), { keepDirty: true });
          if (manual) App.toast('Dados dos dois aparelhos foram combinados');
        } else {
          this.apply(remote, { keepDirty: false });
          App.toast('Dados atualizados com o outro aparelho');
        }
        s = Store.data.settings; // apply() troca o objeto de preferências
        s.syncSeenAt = remote.updatedAt || Date.now();
        s.syncSeenRev = remote.rev || '';
        // dados recebidos sem mudanças locais: não precisa devolvê-los para a nuvem
        if (!merged) s.lastSyncAt = Store.data.updatedAt;
      }
      if (this.dirty() || !remote) await this.push();
      s = Store.data.settings;
      s.lastCheckAt = Date.now();
      s.syncError = '';
      Store.save();
      if (manual) App.toast('Sincronizado');
    } catch (e) {
      s = Store.data.settings;
      s.syncError = e.message || String(e);
      Store.save();
      if (manual) App.toast(`Falha ao sincronizar: ${s.syncError}`);
    } finally {
      this._busy = false;
      if ($('#settingsDlg').open) { Settings.fillSync(); Cloud.fill(); }
    }
  },

  async push() {
    const s = Store.data.settings;
    if (!Store.data.updatedAt) Store.data.updatedAt = Date.now();
    // guarda QUAL versão foi enviada: o que mudar durante o envio continua pendente
    const at = Store.data.updatedAt;
    const rev = uid();
    const payload = { ...Store.shared(), app: 'focus', deviceId: s.deviceId, updatedAt: at, rev };
    const res = await this.write(JSON.stringify(payload));
    if (!res.ok) throw new Error(res.error);
    s.syncSeenAt = at;
    s.syncSeenRev = rev;
    s.lastSyncAt = at;
  },

  // Troca os dados compartilháveis pelos recebidos, mantendo o que é deste computador.
  apply(incoming, { keepDirty }) {
    const local = Store.data;
    const localSettings = {};
    LOCAL_SETTINGS.forEach((k) => { localSettings[k] = local.settings[k]; });
    const next = Store.normalize({
      ...incoming,
      settings: { ...local.settings, ...(incoming.settings || {}), ...localSettings },
      timer: local.timer,
      activeTaskId: local.activeTaskId,
    });
    delete next.deviceId;
    delete next.app;
    delete next.rev;
    // sempre pelo relógio DESTE aparelho (o do outro pode estar adiantado ou atrasado)
    next.updatedAt = Date.now();
    Store.data = next;
    Store.resetBaseline();
    if (!Store.task(next.activeTaskId)) next.activeTaskId = null;
    App.applyTheme();
    App.renderAll();
  },

  // Junta registros pelos ids; num mesmo registro editado dos dois lados, vale a versão deste computador.
  merge(local, remote) {
    const out = { ...remote };
    SYNC_ARRAYS.forEach((k) => {
      const map = new Map((remote[k] || []).map((x) => [x.id, x]));
      (local[k] || []).forEach((x) => {
        if (k === 'subjects' && map.has(x.id)) {
          const r = map.get(x.id);
          const topics = new Map((r.topics || []).map((t) => [t.id, t]));
          (x.topics || []).forEach((t) => topics.set(t.id, t));
          map.set(x.id, { ...r, ...x, topics: [...topics.values()] });
        } else map.set(x.id, x);
      });
      out[k] = [...map.values()];
    });
    out.settings = { ...(remote.settings || {}), ...local.settings };
    return out;
  },

  status() {
    const s = Store.data.settings;
    if (!this.available()) return 'Disponível só no app de desktop.';
    if (!s.syncDir) return 'Nenhuma pasta escolhida.';
    if (!s.syncOn) return `${s.syncDir} · desligada`;
    if (s.syncError) return `${s.syncDir} · erro: ${s.syncError}`;
    return `${s.syncDir}${s.lastCheckAt ? ` · última: ${D.ddmmyy(s.lastCheckAt)} ${Fmt.time(s.lastCheckAt)}` : ''}`;
  },
};
