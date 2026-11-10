'use strict';

/* ============================================================
   Sincronização pela internet (celular ↔ computador) usando um
   gist secreto do GitHub como "pasta na nuvem". O código de acesso
   fica só neste aparelho (não vai para backups nem para a nuvem).
   ============================================================ */
const CLOUD_FILE = 'focus-sync.json';
const CLOUD_DESC = 'Focus — sincronização (não apague)';

const Cloud = {
  connected() { return !!Store.data.settings.cloudToken; },

  async api(path, opts = {}) {
    const res = await fetch(`https://api.github.com${path}`, {
      ...opts,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${Store.data.settings.cloudToken}`,
        Accept: 'application/vnd.github+json',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (res.status === 401) throw new Error('código de acesso inválido ou expirado — crie outro no GitHub');
    if (res.status === 403 || res.status === 404) {
      const j = await res.json().catch(() => ({}));
      throw new Error(res.status === 404 && path.startsWith('/gists/') ? 'gist não encontrado' : `o GitHub recusou (${j.message || res.status}) — confira se o código tem a permissão "gist"`);
    }
    if (!res.ok) throw new Error(`erro do GitHub (${res.status})`);
    return res.status === 204 ? null : res.json();
  },

  // procura o gist do Focus nesta conta (para o segundo aparelho achar o mesmo arquivo)
  async find() {
    for (let page = 1; page <= 5; page++) {
      const list = await this.api(`/gists?per_page=100&page=${page}`);
      const g = list.find((x) => x.files && x.files[CLOUD_FILE]);
      if (g) return g.id;
      if (list.length < 100) break;
    }
    return null;
  },

  async gistId() {
    const s = Store.data.settings;
    if (!s.cloudGistId) s.cloudGistId = (await this.find()) || '';
    return s.cloudGistId;
  },

  // mesmo formato da leitura da pasta: { ok, json } (json = null se ainda não existe)
  async read() {
    try {
      const id = await this.gistId();
      if (!id) return { ok: true, json: null };
      let g;
      try { g = await this.api(`/gists/${id}`); }
      catch (e) { if (e.message === 'gist não encontrado') { Store.data.settings.cloudGistId = ''; return { ok: true, json: null }; } throw e; }
      const f = g.files?.[CLOUD_FILE];
      if (!f) return { ok: true, json: null };
      // arquivos grandes vêm cortados na resposta: baixa o conteúdo completo
      const json = f.truncated ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content;
      return { ok: true, json };
    } catch (e) { return { ok: false, error: e.message || String(e) }; }
  },

  async write(json) {
    try {
      const s = Store.data.settings;
      const id = await this.gistId();
      const body = JSON.stringify({ description: CLOUD_DESC, files: { [CLOUD_FILE]: { content: json } } });
      if (id) await this.api(`/gists/${id}`, { method: 'PATCH', body });
      else {
        const g = await this.api('/gists', { method: 'POST', body: JSON.stringify({ description: CLOUD_DESC, public: false, files: { [CLOUD_FILE]: { content: json } } }) });
        s.cloudGistId = g.id;
      }
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message || String(e) }; }
  },

  /* ---------- tela de configurações ---------- */
  bind() {
    $('#btnCloudOn').onclick = async () => {
      const tok = $('#cloudToken').value.trim();
      if (!/^(ghp_|github_pat_)[A-Za-z0-9_]{20,}$/.test(tok)) { App.toast('Cole o código de acesso do GitHub (começa com ghp_)'); return; }
      const s = Store.data.settings;
      const old = s.cloudToken;
      // confere o código antes de guardar
      s.cloudToken = tok;
      try { await this.api('/gists?per_page=1'); }
      catch (e) { s.cloudToken = old; App.toast(`Não conectou: ${e.message}`); this.fill(); return; }
      s.cloudGistId = '';
      s.syncSeenRev = ''; s.syncSeenAt = 0;
      $('#cloudToken').value = '';
      Store.save();
      this.fill();
      await Sync.run({ manual: true });
    };
    $('#btnCloudSync').onclick = () => (this.connected() ? Sync.run({ manual: true }) : App.toast('Conecte com o código do GitHub primeiro'));
    $('#btnCloudOff').onclick = () => {
      if (!this.connected()) return;
      if (!confirm('Desconectar este aparelho da sincronização?\nOs dados continuam aqui e na nuvem.')) return;
      const s = Store.data.settings;
      s.cloudToken = ''; s.cloudGistId = '';
      Store.save();
      this.fill();
      App.toast('Sincronização pela internet desligada neste aparelho');
    };
  },

  fill() {
    const s = Store.data.settings, on = this.connected();
    $('#btnCloudOn').textContent = on ? 'Trocar código' : 'Conectar';
    $('#btnCloudSync').hidden = !on;
    $('#btnCloudOff').hidden = !on;
    $('#cloudInfo').textContent = !on ? 'Desligada.'
      : s.syncError ? `Conectada · erro: ${s.syncError}`
        : `Conectada${s.lastCheckAt ? ` · última sincronização: ${D.ddmmyy(s.lastCheckAt)} ${Fmt.time(s.lastCheckAt)}` : ''}`;
  },
};
