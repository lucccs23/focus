'use strict';
// Apoio aos testes. Regra: nunca esperar um tempo fixo; esperar uma condição, com prazo para falhar.

// Repete a consulta até ela dar verdadeiro; no prazo, falha dizendo o que não aconteceu.
async function waitFor(fn, what, timeout = 30000) {
  const deadline = Date.now() + timeout;
  let lastError;
  for (;;) {
    try {
      const value = await fn();
      if (value) return value;
      lastError = null;
    } catch (e) { lastError = e; }
    if (Date.now() > deadline) throw new Error(`prazo esgotado esperando: ${what}${lastError ? ` (${lastError.message})` : ''}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

// Falha em vez de esperar para sempre por algo que deveria responder logo.
function deadline(promise, what, timeout = 15000) {
  let t;
  const expired = new Promise((_, reject) => { t = setTimeout(() => reject(new Error(`sem resposta: ${what}`)), timeout); });
  return Promise.race([promise, expired]).finally(() => clearTimeout(t));
}

function createReport() {
  const results = [];
  return {
    check(name, ok, extra = '') { results.push({ name, ok: !!ok, extra }); },
    // imprime tudo e devolve o código de saída
    finish(okMessage) {
      let failed = 0;
      for (const r of results) {
        if (!r.ok) failed++;
        console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.extra ? ` (${r.extra})` : ''}`);
      }
      console.log(failed ? `\n${failed} falha(s)` : `\n${okMessage}`);
      return failed ? 1 : 0;
    },
  };
}

// Se o teste travar, encerra com falha em vez de ficar parado.
function watchdog(app, ms, report) {
  const t = setTimeout(() => {
    report.check('terminou dentro do prazo', false, `${Math.round(ms / 1000)} s`);
    app.exit(report.finish(''));
  }, ms);
  t.unref();
}

// App carregado e com as aberturas automáticas (boas-vindas, novidades) já resolvidas.
const appReady = (w) => waitFor(
  () => w.webContents.executeJavaScript("typeof App !== 'undefined' && !!document.querySelector('#modeTabs button') && !!Store.data.settings.lastSeenVersion"),
  'o app terminar de abrir',
);

module.exports = { waitFor, deadline, createReport, watchdog, appReady };
