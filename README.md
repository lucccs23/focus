# Focus

Pomodoro, cronômetro, questões, revisões e estatísticas para quem estuda: residência médica, concursos, ENEM e vestibulares, faculdade ou qualquer outra prova. Funciona no celular, no tablet e no computador, até sem internet.

## Usar (qualquer pessoa)

Abra **https://lucccs23.github.io/focus/** e instale:

- **Android (Chrome):** menu ⋮ → **Instalar app**.
- **iPhone/iPad (Safari):** Compartilhar → **Adicionar à Tela de Início**.
- **Computador (Chrome ou Edge):** ícone de instalar na barra de endereço, ou ⋮ → **Instalar Focus**. Abre em janela própria e se atualiza sozinho.

Na primeira abertura, o Focus pergunta **para que você estuda** e ajusta os nomes (área/tema, matéria/assunto, disciplina…), o modelo pronto de matérias (residência, concurso, ENEM) e as sugestões de provas e bancas. Dá para mudar depois em Ajustes → Perfil de estudo. O **Guia rápido** fica no rodapé.

**Seus dados são só seus.** Ficam guardados no navegador do aparelho; o link é só o programa. Cada pessoa que abre o link começa com o Focus vazio.

**Usar no celular e no computador com os mesmos dados:** em Ajustes → "Sincronizar celular e computador", cada pessoa cria um código de acesso na **própria** conta do GitHub (grátis) e cola o mesmo código nos aparelhos dela. Nunca use o código de outra pessoa: os dados se misturariam.

## Desenvolvimento (esta pasta)

HTML/CSS/JS puro (sem build), com uma versão de desktop em Electron.

Dê dois cliques em **`Focus.exe`** (ou nos atalhos "Focus" da Área de Trabalho e do menu Iniciar). Ele abre o app **direto do código desta pasta**: qualquer atualização vale na próxima vez que abrir (ou com `Ctrl+R` com o app aberto).

Se a pasta `node_modules` sumir (ex.: projeto copiado para outro PC):

```bash
npm install
node node_modules/electron/install.js
npm run runtime
npm run shortcuts
```

`npm run runtime` cria `runtime/Focus.exe`: o Electron com nome, ícone e versão do Focus (é o que aparece na barra de tarefas). `npm run shortcuts` recria os atalhos "Focus" apontando para ele. Para recompilar o `Focus.exe` (só se mexer em `build/launcher.cs`): `build\make-launcher.cmd`.

**Instalador:** `npm run dist` gera `dist/Focus Setup <versão>.exe` (instala como programa comum). Para outras pessoas, a versão pela internet é mais simples e se atualiza sozinha.

**Publicar uma versão nova:** envie para o GitHub (`git push`); o GitHub Pages atualiza o link em 1 a 3 minutos. Aumente `VERSION` em `sw.js` para os aparelhos baixarem tudo de novo (o app mostra "Nova versão disponível").

**Dados no desktop:** `%APPDATA%\Focus` em instalações novas; quem já usava continua em `%APPDATA%\Foco Lab` (nome antigo do app).

## Funções

- **Timer**: pomodoro, pausas e cronômetro; sessões interrompidas com 1 min ou mais são salvas.
- **Timers personalizados** (Ajustes): ex.: "Questões" 50/10 ou "Leitura" 90/20, como abas ao lado do Pomodoro.
- **Contador rápido de questões**: com uma tarefa de questões ativa, toque em Acertei/Errei a cada questão; ao registrar, o total e os acertos já vêm preenchidos.
- **Modo foco** (`Z`): só o timer, grande, em tela cheia.
- **Troca rápida de tarefa**: toque em "Trabalhando em…" no cartão do timer.
- **Personalizar tela inicial** (link no rodapé ou em Ajustes): escolher e ordenar painéis, recolher painéis tocando no título, esconder partes do timer, uma ou duas colunas na tela larga.
- **Aparência**: cor de destaque, estilo dos números do relógio, anel/anel grosso/barra/só números, tamanho do texto (celular) e botões da barra de baixo do celular.
- **Alarmes**: sons diferentes para o fim do foco e da pausa, com volume próprio.
- **Revisões editáveis**: os intervalos do caderno de erros (padrão 1, 7 e 30 dias) podem ser trocados, ex.: 1, 3, 7, 15, 30.
- **Assistente de início**: na primeira abertura num aparelho sem dados, três passos (áreas, provas e ciclo).
- **Perfil de estudo**: residência médica, concursos, ENEM e vestibulares, faculdade ou outro — muda os nomes usados no app, o modelo pronto e as sugestões de provas/bancas.
- **Tarefas** de estudo ou de questões, ligadas a área e tema.
- **Áreas, temas e metas** (`D`):
  - modelo pronto conforme o perfil: **5 grandes áreas da residência**, **matérias básicas de concurso** ou **áreas do ENEM**, com os temas e a incidência de cada um;
  - peso na prova e dificuldade por área; incidência (alta/média/baixa), teoria/revisão e **anotações com links** por tema.
- **Provas-alvo**: cadastre as provas (ENARE, ENEM, o seu concurso, a P1…) com a data. A tela inicial mostra os dias que faltam e o **ritmo necessário** (temas por semana).
- **Atacar primeiro**: temas muito cobrados em que você acerta pouco, ou de alta incidência ainda não estudados, com um botão para estudar ou fazer questões.
- **Ciclo de estudos**: informe as horas e as questões por semana, e o app distribui as metas pelo peso e pela dificuldade de cada área. "Estudar agora" escolhe a área mais atrasada e o tema mais fraco dela.
- **Caderno de erros** (`C`): todo registro com erros vira revisão em 1, 7 e 30 dias; "Colar questões erradas" separa as questões coladas e identifica código, instituição, ano e gabarito.
- **Flashcards** (`F`): revisão espaçada no estilo do Anki (Errei/Difícil/Bom/Fácil), por área e tema, importação do Anki (frente e verso separados por tabulação, `;` ou `::`). Os do dia aparecem em "Revisões para hoje".
- **Simulados** (`S`): instituição, **nota ponderada pelo peso das áreas**, **nota de corte** (acima/abaixo) e onde o simulado perdeu mais pontos.
- **Estatísticas** (`E`): questões, acertos, foco, mapa de constância do ano, tabelas por área, por tema e **por instituição**.
- **Metas diárias** de foco e de questões, com barras na tela inicial.
- **Sincronizar celular e computador** pela internet: em Ajustes, cole um código de acesso do GitHub (permissão "gist") nos dois aparelhos. Os dados vão para um gist secreto da sua conta; o código fica só no aparelho e não entra nos backups.
- **Sincronizar entre computadores por pasta** (app de desktop): mesma pasta do OneDrive, Google Drive ou Dropbox nos dois PCs.
- **Backup**: exportar/importar (substituir), **juntar backup** (adiciona o que falta sem apagar nada), **planilha CSV** para o Excel e backup automático diário (desktop).
- **Relatório semanal em PDF**: botão nas Estatísticas (esta semana ou a passada).
- **Som de fundo**: ruído branco, chuva suave ou cachoeira, só durante o foco ou sempre.
- **Temas visuais**: Do sistema, Claro, Escuro, Papel, Lavanda, Noite, Floresta e Alto contraste (Ajustes → Aparência).
- **Celular e tablet**: app instalável e offline (https://lucccs23.github.io/focus/), barra de navegação embaixo, tela ligada enquanto o timer roda e aviso de nova versão.
- **Desktop**: mini-timer sempre no topo (`M`), ícone perto do relógio com menu, opção de continuar rodando ao fechar a janela, atalhos globais (`Ctrl+Alt+P` iniciar/pausar, `Ctrl+Alt+N` pular, `Ctrl+Alt+M` mini, `Ctrl+Alt+F` abrir) e duas colunas com a janela larga.

## Estrutura

| Arquivo | O que faz |
|---|---|
| `Focus.exe` | Lançador: abre `runtime/Focus.exe` (ou, se não existir, o Electron apontando para esta pasta) |
| `runtime/` | Electron com a identidade do Focus, gerado por `npm run runtime` (fora do Git) |
| `index.html` | Layout e diálogos |
| `css/style.css`, `css/features.css` | Visual minimalista, claro/escuro |
| `js/store.js` | Utilidades, datas, persistência, assuntos, revisões, dados de exemplo |
| `js/timer.js` | Timer baseado em timestamps |
| `js/charts.js` | Gráfico de barras + linha em SVG |
| `js/stats.js` | Estatísticas, constância e tabela por matéria/assunto |
| `js/history.js` | Histórico editável e tempo manual |
| `js/subjects.js` | Matérias, edital, metas semanais e ciclo |
| `js/reviews.js` | Caderno de erros e revisão espaçada |
| `js/simulados.js` | Simulados |
| `js/sound.js` | Som de fundo gerado na hora |
| `js/sync.js` | Sincronização por pasta na nuvem |
| `js/report.js` | Relatório semanal em PDF |
| `js/import.js` | Importação de questões erradas por texto colado |
| `css/themes.css` | Temas extras |
| `manifest.webmanifest`, `sw.js`, `icons/` | Versão de celular (PWA): instalação e modo offline |
| `js/app.js` | Tela principal, tarefas, questões, configurações, backup |
| `electron/main.js` | Janela, mini-timer, bandeja, atalhos globais, backup |
| `electron/preload.js` | Ponte segura `window.desktop` |
| `mini.html` | Mini-timer |
| `build/` | Ícone e código do lançador |

## Rodar no navegador (sem Electron)

```bash
python -m http.server 5179
```

Abra http://localhost:5179. Bandeja, atalhos globais, mini-timer e backup automático só existem no desktop.
