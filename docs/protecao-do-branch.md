# Proteção do branch `main`

O repositório é **público**. Por isso a proteção do branch funciona no plano gratuito, qualquer pessoa pode ler o código e abrir PR de um fork, e nada sensível pode ser versionado. Se virasse privado no plano gratuito, a proteção deixaria de valer e o GitHub Pages (o link do app) pararia.

## Como as checagens se protegem

| Check | Onde roda | O que faz |
|---|---|---|
| `verificar` | `pull_request`, Windows | Roda `npm run check` no código do PR, com token de leitura, sem segredos e sem cache |
| `guarda` | `pull_request_target`, versão do `main` | Só consulta a API, sem baixar o PR. Se o PR mexe nas checagens, espera a aprovação do dono **naquele commit** |

São consideradas checagens: `.github/`, `.claude/`, `tests/`, `scripts/`, `CLAUDE.md`, `REVIEW.md`, `eslint.config.js`, `package-lock.json` e, no `package.json`, tudo menos a versão e os campos descritivos.

Como só existe um mantenedor e o GitHub não deixa ninguém aprovar o próprio PR, o ruleset não exige revisão aprovada. O controle humano é a aprovação da guarda e o merge.

## Ativar (uma vez, depois do merge do PR 4/4)

Rode com a conta de administrador, nesta ordem:

```bash
gh api -X PUT repos/lucccs23/focus/environments/alteracao-de-checagens --input - <<'JSON'
{ "prevent_self_review": false, "reviewers": [{ "type": "User", "id": 195822114 }], "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
JSON
```

```bash
gh api -X POST repos/lucccs23/focus/environments/alteracao-de-checagens/deployment-branch-policies -f name=main -f type=branch
```

```bash
gh api -X PUT repos/lucccs23/focus/actions/permissions/fork-pr-contributor-approval -f approval_policy=all_external_contributors
```

Abra um PR de teste, confira que `verificar` e `guarda` aparecem e só então ative o ruleset:

```bash
gh api -X POST repos/lucccs23/focus/rulesets --input .github/ruleset-main.json
```

## Aprovar uma mudança nas checagens

No PR, abra a execução **Guarda**, clique em **Review deployments**, marque `alteracao-de-checagens` e aprove. Um novo commit exige nova aprovação.

## Limite conhecido

Administradores podem alterar essas regras. Enquanto o agente usar um login com permissão de administrador, a separação depende de ele obedecer às regras. Para uma separação técnica, dê a ele um token *fine-grained* só deste repositório, com **Contents** e **Pull requests** em leitura e escrita, sem **Administration**, **Workflows**, **Actions** ou **Environments**.
