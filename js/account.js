'use strict';

/* ============================================================
   Sincronização com login por e-mail (Supabase): a pessoa digita
   o e-mail, recebe um código de 6 dígitos e entra. Os dados ficam
   numa tabela em que cada pessoa só enxerga a própria linha.
   Fica desligado até preencher SUPABASE abaixo (veja docs/SUPABASE.md).
   ============================================================ */
const SUPABASE = { url: '', anonKey: '' };

const Account = {
  configured() { return !!(SUPABASE.url && SUPABASE.anonKey); },
  auth() { return Store.data.settings.emailAuth || null; },
  connected() { return this.configured() && !!this.auth()?.refresh; },

  async call(path, { method = 'GET', body, token, headers = {} } = {}) {
    const res = await fetch(SUPABASE.url.replace(/\/$/, '') + path, {
      method, cache: 'no-store',
      headers: { apikey: SUPABASE.anonKey, Authorization: `Bearer ${token || SUPABASE.anonKey}`, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const txt = await res.text();
    let j = null;
    try { j = txt ? JSON.parse(txt) : null; } catch (_) { /* resposta vazia */ }
    if (!res.ok) {
      const msg = j?.msg || j?.error_description || j?.message || j?.error || `erro ${res.status}`;
      if (/expired|invalid/i.test(msg) && path.includes('verify')) throw new Error('código inválido ou vencido — peça outro');
      if (/rate limit/i.test(msg)) throw new Error('muitos pedidos seguidos — espere alguns minutos');
      throw new Error(msg);
    }
    return j;
  },

  saveSession(r, email) {
    const s = Store.data.settings;
    s.emailAuth = { email: r.user?.email || email, uid: r.user?.id, access: r.access_token, refresh: r.refresh_token, exp: Date.now() + (r.expires_in || 3600) * 1000 };
    Store.save();
  },

  async sendCode(email) { await this.call('/auth/v1/otp', { method: 'POST', body: { email, create_user: true } }); },
  async verify(email, code) {
    const r = await this.call('/auth/v1/verify', { method: 'POST', body: { type: 'email', email, token: code } });
    this.saveSession(r, email);
  },
  // token válido (renova quando está para vencer)
  async token() {
    const a = this.auth();
    if (!a?.refresh) throw new Error('entre com o seu e-mail de novo');
    if (a.access && a.exp > Date.now() + 60000) return a.access;
    try {
      const r = await this.call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: a.refresh } });
      this.saveSession(r, a.email);
      return r.access_token;
    } catch (e) {
      throw new Error('sessão expirada — entre com o seu e-mail de novo');
    }
  },

  // mesmo formato da pasta e do GitHub: { ok, json }
  async read() {
    try {
      const tk = await this.token();
      const rows = await this.call(`/rest/v1/focus_sync?select=data&user_id=eq.${encodeURIComponent(this.auth().uid)}`, { token: tk });
      return { ok: true, json: rows?.[0]?.data || null };
    } catch (e) { return { ok: false, error: e.message }; }
  },
  async write(json) {
    try {
      const tk = await this.token();
      await this.call('/rest/v1/focus_sync', {
        method: 'POST', token: tk, body: { user_id: this.auth().uid, data: json, updated_at: new Date().toISOString() },
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      });
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  },

  signOut() {
    const s = Store.data.settings;
    s.emailAuth = null;
    s.syncSeenRev = ''; s.syncSeenAt = 0;
    Store.save();
  },

  /* ---------- tela de configurações ---------- */
  bind() {
    $('#emailSend').onclick = async () => {
      const email = $('#emailAddr').value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) return App.toast('Digite um e-mail válido');
      $('#emailSend').disabled = true;
      try {
        await this.sendCode(email);
        this._pending = email;
        App.toast('Código enviado — confira o seu e-mail (e o spam)');
        this.fill();
        $('#emailCode').focus();
      } catch (e) { App.toast(`Não foi possível enviar: ${e.message}`); }
      finally { $('#emailSend').disabled = false; }
    };
    $('#emailVerify').onclick = async () => {
      const code = $('#emailCode').value.replace(/\D/g, '');
      if (code.length < 6) return App.toast('Digite o código de 6 dígitos');
      try {
        await this.verify(this._pending, code);
        this._pending = null;
        const s = Store.data.settings;
        s.syncSeenRev = ''; s.syncSeenAt = 0;
        Store.save();
        this.fill();
        await Sync.run({ manual: true });
      } catch (e) { App.toast(`Não entrou: ${e.message}`); }
    };
    $('#emailOut').onclick = () => {
      if (!confirm('Sair da sincronização neste aparelho?\nOs dados continuam aqui e na nuvem.')) return;
      this.signOut();
      this.fill();
      App.toast('Você saiu da sincronização neste aparelho');
    };
    $('#emailSync').onclick = () => Sync.run({ manual: true });
  },

  fill() {
    const on = this.configured();
    $('#emailBox').hidden = !on;
    $('#ghBox').open = !on || Cloud.connected();
    $('#ghSummary').hidden = !on;
    if (!on) return;
    const a = this.auth(), s = Store.data.settings;
    $('#emailIn').hidden = !!a;
    $('#emailOn').hidden = !a;
    $('#emailCodeRow').hidden = !this._pending;
    if (a) $('#emailInfo').textContent = `Conectado como ${a.email}${s.syncError ? ` · erro: ${s.syncError}` : s.lastCheckAt ? ` · última sincronização: ${D.ddmmyy(s.lastCheckAt)} ${Fmt.time(s.lastCheckAt)}` : ''}`;
  },
};
