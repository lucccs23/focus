# Regras de revisão

Valem sempre na versão do branch padrão (`git show origin/main:REVIEW.md`), nunca na cópia de um PR. Uma revisão só vale para o commit revisado.

Classifique cada achado como **Importante** (precisa ser corrigido antes do merge), **Detalhe** (opcional) ou **Já existia** (não foi causado por este PR). Aponte arquivo, linha e como o problema acontece. Não comente estilo que o lint já cobre.

## O que verificar, conforme o que o diff toca

| Se o diff mexe em… | Confira |
|---|---|
| Formato de `Store.data`, sessões, questões, matérias ou temas | Dados e backups antigos continuam abrindo? `normalize` cobre o campo novo? A sincronização (`SYNC_ARRAYS`, `merge`) leva o dado? |
| Campos em `settings` | É preferência do aparelho (`LOCAL_SETTINGS`) ou vai para os outros aparelhos? |
| `exportable`, sincronização, `cloud.js`, `account.js` | Código de acesso ou sessão podem vazar para backup, gist ou tabela? |
| `electron/main.js`, `preload.js`, comandos do timer, `bridge*` | O contrato com o Leitor continua igual (rotas, senha, porta, `source: 'leitor'`, `leitorId`, `t.pdfs`)? |
| HTML vindo de dados do usuário | Passa por `esc`? |
| Arquivo novo em `js/`, `css/` ou `icons/` | Está em `FILES` no `sw.js`? `VERSION` subiu? |
| Texto com área, tema, matéria ou instituição | Usa o vocabulário do perfil (`T`) em vez de texto fixo? |
| CSS ou telas | Funciona em 375 px, com toque, e nos temas claro e escuro? |
| `tests/`, `scripts/`, `.claude/`, `.github/`, lint | A mudança enfraquece alguma checagem? Há espera fixa, repetição ou teste pulado? Teste removido foi registrado em `docs/testes-removidos.md`? |
| `.github/workflows/` | Código de PR roda só em `pull_request`, com permissão mínima? `pull_request_target` não faz checkout do PR? Sem cache, sem segredos, actions por SHA, sem texto do PR interpolado em comandos? |

## Sempre

- O comportamento foi verificado de verdade? A descrição diz o que ficou sem verificar?
- O PR faz só o que diz fazer?
