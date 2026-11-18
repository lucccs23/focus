---
name: verify
description: Sobe o Focus e testa de ponta a ponta como um usuário (desktop, celular e ponte com o Leitor). Use antes de todo commit que mude comportamento, depois de corrigir um bug e sempre que precisar provar que uma mudança funciona.
---

# Verificar o Focus

Verificar é **usar o app**, não só rodar testes.

## 1. Rodar

```bash
npm run verify
```

O comando abre o app de desktop e a versão de celular e usa cliques, toques e digitação reais em: primeiro uso, tarefa, timer, contador de questões, registro, histórico, estatísticas, flashcard, simulado, tema, backup e restauração, reabertura, ponte com o Leitor de Estudos e mini-timer.

Ele é seguro de rodar com o Focus aberto: usa pasta de dados, senha do leitor e porta temporárias. Nunca aponte os testes para `%APPDATA%\Foco Lab`, `%APPDATA%\Focus` ou para a senha real do leitor.

Se faltar dependência: `npm ci --ignore-scripts` e `node node_modules/electron/install.js`.

## 2. Cobrir o que você mudou

- Se a mudança tem comportamento que o fluxo não percorre, **acrescente o passo em `tests/e2e.js`** e veja o passo falhar sem a mudança.
- Mudança visual: abra também a tela afetada, no tema claro e no escuro, em largura de PC e de celular.
- Mexeu em sessões, matérias/temas ou comandos do timer: a ponte com o Leitor precisa continuar passando.

## 3. Antes do PR

```bash
npm run check
```

Roda lint, testes, este fluxo e o build, parando na primeira falha. Na descrição do PR, diga o que foi verificado e o que não foi.

## 4. Quando falhar

Leia a mensagem e ache a causa. É proibido pular o teste, repeti-lo até passar ou acrescentar espera. Veja as regras completas em `CLAUDE.md`.
