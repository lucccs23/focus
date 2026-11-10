'use strict';

/* ============================================================
   Proteção dos dados (armazenamento persistente e lembrete de
   backup), "Novidades" depois de cada atualização e "Sobre".
   ============================================================ */
const APP_VERSION = '1.3.0';

// o que mudou em cada versão (a primeira é a atual)
const CHANGELOG = [
  ['1.3.0', [
    'Seus dados ficam mais protegidos: o app pede ao navegador para guardá-los de forma permanente e avisa quando faz tempo que você não salva uma cópia.',
    'Nova tela "Sobre", com a versão, privacidade e o link para indicar o Focus.',
    'Este aviso de novidades depois de cada atualização.',
    'Preparado para entrar com e-mail na sincronização (quando ativado).',
  ]],
  ['1.2', [
    'Funções por perfil: certo/errado e colar edital (concursos), redação e nota 0–1000 (ENEM), notas, faltas e semestres (faculdade).',
    'Vários modelos prontos e a opção de combinar perfis.',
  ]],
  ['1.1', ['Perfis de estudo, guia rápido e boas-vindas para quem começa.']],
  ['1.0', ['Contador rápido de questões, modo foco, timers personalizados e tela inicial personalizável.']],
];

const About = {
  init() {
    $('#btnAbout').onclick = () => this.open();
    $('#backupBar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-bk]');
      if (!b) return;
      const s = Store.data.settings;
      if (b.dataset.bk === 'export') Settings.exportData();
      if (b.dataset.bk === 'sync') { Settings.open(); setTimeout(() => $('#cloudSec').scrollIntoView({ block: 'start' }), 60); }
      if (b.dataset.bk === 'later') { s.backupSnooze = Date.now() + 3 * DAY; Store.save(); }
      this.renderBackupBar();
    });
    this.persist();
    setTimeout(() => this.maybeNews(), 900);
  },

  /* ---------- armazenamento persistente ---------- */
  async persist() {
    const s = Store.data.settings;
    if (window.desktop || !navigator.storage?.persist) return;
    try {
      const already = await navigator.storage.persisted();
      s.persisted = already || await navigator.storage.persist();
      Store.save();
    } catch (_) { /* navegador sem suporte */ }
  },

  /* ---------- lembrete de backup ---------- */
  // considera "protegido" quem sincroniza ou tem backup automático no PC
  protectedNow() {
    const s = Store.data.settings;
    return Sync.enabled() || (window.desktop && s.autoBackup && s.backupDir);
  },
  daysSinceCopy() {
    const s = Store.data.settings;
    const last = Math.max(s.lastExportAt || 0, s.firstUseAt || Date.now());
    return Math.floor((Date.now() - last) / DAY);
  },
  renderBackupBar() {
    const el = $('#backupBar'), s = Store.data.settings, d = Store.data;
    if (!s.firstUseAt && (d.sessions.length || d.questions.length)) { s.firstUseAt = Date.now(); Store.save(); }
    const enough = d.sessions.length + d.questions.length >= 5;
    const days = this.daysSinceCopy();
    const show = enough && !this.protectedNow() && days >= 7 && Date.now() > (s.backupSnooze || 0);
    el.hidden = !show;
    if (!show) return;
    el.innerHTML = `<div class="bk-text"><b>Seus dados estão só neste aparelho.</b> Faz ${days} dias que você não salva uma cópia. Se o navegador for limpo ou o aparelho trocado, eles se perdem.</div>
      <div class="bk-btns"><button class="btn primary sm" data-bk="export">Salvar uma cópia</button><button class="btn sm" data-bk="sync">Sincronizar</button><button class="link" data-bk="later">Depois</button></div>`;
  },
  markExported() { Store.data.settings.lastExportAt = Date.now(); Store.save(); this.renderBackupBar(); },

  /* ---------- novidades ---------- */
  maybeNews() {
    const s = Store.data.settings, d = Store.data;
    const seen = s.lastSeenVersion;
    s.lastSeenVersion = APP_VERSION;
    Store.save();
    // só para quem já usava (quem começa agora vê as boas-vindas); quem vem de antes deste aviso existir também vê
    if (seen === APP_VERSION || !(d.sessions.length || d.subjects.length || d.tasks.length)) return;
    if (document.querySelector('dialog[open]')) return;
    const news = CHANGELOG.find(([v]) => v === APP_VERSION);
    if (!news) return;
    $('#newsBody').innerHTML = `<p class="hint">Versão ${APP_VERSION}</p><ul class="news">${news[1].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    $('#newsDlg').showModal();
  },

  /* ---------- sobre ---------- */
  open() {
    const s = Store.data.settings;
    const where = window.desktop ? 'neste computador' : 'neste aparelho (no navegador)';
    const sync = Sync.enabled() ? 'ligada' : 'desligada';
    $('#aboutBody').innerHTML = `
      <div class="about-top"><span class="brand-mark big" aria-hidden="true"></span><div><b>Focus</b><small>versão ${APP_VERSION} · perfil: ${esc(Profile.get().label)}</small></div></div>
      <h4>Privacidade</h4>
      <p>Seus dados ficam guardados ${where}. Não há servidor do Focus nem cadastro: ninguém além de você vê o que você registra.
        A sincronização (${sync}) usa a <b>sua</b> conta${Cloud.connected() ? ' do GitHub' : ''}, e o código de acesso fica só neste aparelho.</p>
      <p class="muted">Armazenamento ${window.desktop ? 'do app de desktop' : s.persisted ? 'permanente concedido pelo navegador' : 'comum do navegador (salve cópias de vez em quando)'} · última cópia: ${s.lastExportAt ? `${D.ddmmyy(s.lastExportAt)}` : 'nunca'}</p>
      <h4>Indicar</h4>
      <p>Qualquer pessoa pode usar pelo mesmo link, cada uma com os próprios dados: <b>${esc(appUrl())}</b></p>
      <h4>Novidades desta versão</h4>
      <ul class="news">${(CHANGELOG[0][1]).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    $('#aboutDlg').showModal();
  },
};
