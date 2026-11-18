# Focus: como trabalhar neste repositório

Fale com o Lucas em português. Mostre o plano antes de mudanças grandes e trabalhe por branch e PR. Quem faz o merge é ele.

## Verificar

1. Depois de mudar comportamento, use a skill `verify` (`npm run verify`). Verificar é usar o app, não só rodar testes.
2. Faça o commit e rode `npm run check` (lint, testes, ponta a ponta e build) **nesse commit**, antes de abrir o PR. O hook `scripts/pr-gate.js` bloqueia `gh pr create` se isso não aconteceu.
3. Na descrição do PR, diga o que foi verificado e o que não foi.

## Três rodadas e pare

Cada `npm run check` que falha, com código diferente, é uma rodada de conserto. Depois de **3 rodadas sem sucesso, pare e chame o Lucas** com o que foi tentado e o que se descobriu. O `check` e o hook passam a recusar. Só ele libera, com `node scripts/check.js --reset`; não rode esse comando.

## Testes instáveis

Nunca pule, repita até passar ou acrescente espera a um teste instável. Ache a causa. Se não achar, remova o teste e registre o motivo em `docs/testes-removidos.md`. Testes esperam eventos ou condições (`waitFor`), nunca um tempo fixo.

## As checagens não mudam junto com o que elas julgam

- As regras de revisão valem como estão no branch padrão. Revise com `git show origin/main:REVIEW.md`, nunca com a cópia do PR.
- Não enfraqueça uma checagem para fazer uma mudança passar. Mudanças em `.github/`, `.claude/`, `tests/`, `scripts/`, `CLAUDE.md`, `REVIEW.md`, na configuração do lint ou em scripts e dependências do `package.json` vão em PR próprio, explicado, e precisam da aprovação do Lucas.

## CI e forks

- Código de PR, principalmente de fork, só roda em `pull_request`, com token de leitura e sem segredos.
- `pull_request_target` nunca baixa nem executa código do PR.
- Sem cache compartilhado nesses fluxos (nem `actions/cache`, nem `cache:` em `setup-*`). Actions fixadas por SHA completo.

## Não quebre

- **Dados de quem já usa:** `localStorage` em `focolab.v1`, backups antigos e a pasta `%APPDATA%\Foco Lab` continuam funcionando. Testes nunca usam dados reais.
- **Ponte com o Leitor de Estudos (Vetra):** servidor em `127.0.0.1:47615` e rotas `/status`, `/command`, `/session`, `/link` em `electron/main.js`; `bridge*` e `onBridge` em `electron/preload.js`; `bridgeSession`, `bridgeLink`, `sendBridgeData` e o campo `focus` em `js/app.js`; sessões com `source: 'leitor'` e `leitorId`; temas com `t.pdfs` mostrados em `#notePdfs`.
- **Offline:** arquivo novo do app entra em `FILES` no `sw.js`; a cada publicação, aumente `VERSION`.
- **Merge no `main` publica no ar** pelo GitHub Pages, e o repositório é público: nada de segredos.
