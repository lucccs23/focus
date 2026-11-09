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
const SYNC_ARRAYS = ['subjects', 'tasks', 'sessions', 'questions', 'reviews', 'simulados'];

const Sync = {
  _t: null,
  _busy: false,

  available() { return !!window.desktop?.syncRead; },
  enabled() { const s = Store.data.settings; return this.available() && s.syncOn && !!s.syncDir; },

  init() {
    const s = Store.data.settings;
    if (!s.deviceId) { s.deviceId = uid(); Store.save(); }
    if (!this.available()) return;
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
    const s = Store.data.settings;
    try {
      const res = await window.desktop.syncRead(s.syncDir);
      if (!res.ok) throw new Error(res.error);
      let remote = null;
      if (res.json) { try { remote = JSON.parse(res.json); } catch { throw new Error('o arquivo da nuvem está corrompido'); } }

      const remoteNew = remote && remote.deviceId !== s.deviceId && (remote.updatedAt || 0) > (s.syncSeenAt || 0);
      if (remoteNew) {
        if (this.dirty()) {
          this.apply(this.merge(Store.data, remote), { keepDirty: true });
          if (manual) App.toast('Dados dos dois computadores foram combinados');
        } else {
          this.apply(remote, { keepDirty: false });
          App.toast('Dados atualizados com o outro computador');
        }
        s.syncSeenAt = remote.updatedAt || Date.now();
      }
      if (this.dirty() || !remote) await this.push();
      s.lastSyncAt = Math.max(s.lastSyncAt || 0, Date.now());
      s.syncError = '';
      Store.save();
      if (manual) App.toast('Sincronizado');
    } catch (e) {
      s.syncError = e.message || String(e);
      Store.save();
      if (manual) App.toast(`Falha ao sincronizar: ${s.syncError}`);
    } finally {
      this._busy = false;
      if ($('#settingsDlg').open) Settings.fillSync();
    }
  },

  async push() {
    const s = Store.data.settings;
    if (!Store.data.updatedAt) Store.data.updatedAt = Date.now();
    const payload = { ...Store.shared(), app: 'focus', deviceId: s.deviceId, updatedAt: Store.data.updatedAt };
    const res = await window.desktop.syncWrite(s.syncDir, JSON.stringify(payload));
    if (!res.ok) throw new Error(res.error);
    s.syncSeenAt = Store.data.updatedAt;
    s.lastSyncAt = Date.now();
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
    next.updatedAt = keepDirty ? Date.now() : (incoming.updatedAt || local.updatedAt);
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
    return `${s.syncDir}${s.lastSyncAt ? ` · última: ${D.ddmmyy(s.lastSyncAt)} ${Fmt.time(s.lastSyncAt)}` : ''}`;
  },
};
