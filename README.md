# Focus

Pomodoro, cronômetro, tarefas e estatísticas de estudo e questões, pensado para concurso. HTML/CSS/JS puro (sem build) rodando no Electron.

## Abrir

Dê dois cliques em **`Focus.exe`** (ou nos atalhos "Focus" da Área de Trabalho e do menu Iniciar). Ele abre o app **direto do código desta pasta**: qualquer atualização vale na próxima vez que abrir (ou com `Ctrl+R` com o app aberto). Não precisa instalar nada.

Se a pasta `node_modules` sumir (ex.: projeto copiado para outro PC):

```bash
npm install
node node_modules/electron/install.js
npm run runtime
npm run shortcuts
```

`npm run runtime` cria `runtime/Focus.exe`: o Electron com nome, ícone e versão do Focus (é o que aparece na barra de tarefas). `npm run shortcuts` recria os atalhos "Focus" apontando para ele.

Para recompilar o `Focus.exe` (só se mexer em `build/launcher.cs`): `build\make-launcher.cmd`.

**Instalador final:** `dist/Focus Setup 0.7.0.exe` instala o app como um programa comum (atalho "Focus"). Ele usa os mesmos dados do `Focus.exe` da pasta, mas só um dos dois abre por vez.

**Celular e tablet:** publicado no GitHub Pages, o app abre no navegador do celular e pode ser instalado em "Adicionar à tela inicial" (funciona offline). Os dados do celular ficam no celular; para levar dados entre PC e celular, use Ajustes → Exportar/Importar backup. Ao publicar uma versão nova, aumente `VERSION` em `sw.js`.

Os dados ficam em `%APPDATA%\Foco Lab` (nome antigo do app, mantido para não perder nada), separados do código.

## Funções

- **Timer**: pomodoro, pausas e cronômetro; sessões interrompidas com 1 min ou mais são salvas.
- **Tarefas** de estudo ou de questões, ligadas a matéria e assunto.
- **Histórico** (`H`): ver, editar e excluir sessões e registros de questões de qualquer dia; lançar tempo estudado fora do app.
- **Matérias e edital** (`D`): assuntos por matéria (dá para colar a lista do edital), teoria/revisão marcadas, desempenho por assunto e **metas semanais** (horas e questões).
- **Ciclo de estudos**: o cartão "Metas da semana" sugere a matéria mais atrasada e inicia o estudo dela.
- **Caderno de erros** (`C`): todo registro com erros vira revisão em 1, 7 e 30 dias; as do dia aparecem na tela inicial.
- **Simulados** (`S`): nota por matéria, evolução e comparação com o anterior; as questões entram nas estatísticas.
- **Estatísticas** (`E`): questões, acertos, foco, mapa de constância do ano, tabela por matéria e, filtrando uma matéria, por assunto.
- **Som de fundo**: ruído branco, chuva suave ou cachoeira, só durante o foco ou sempre.
- **Sincronizar entre computadores**: em Ajustes, escolha a mesma pasta do OneDrive/Google Drive/Dropbox nos dois PCs. O app grava e lê o arquivo focus-sync.json dali (timer e preferências locais não vão junto).
- **Relatório semanal em PDF**: botão nas Estatísticas (esta semana ou a passada).
- **Colar questões erradas**: no caderno de erros, cole o texto das questões (QConcursos, TEC, PDF da prova); o app separa cada uma, identifica código, banca, ano e gabarito e agenda as revisões.
- **Temas**: Do sistema, Claro, Escuro, Papel, Lavanda, Noite, Floresta e Alto contraste (Ajustes → Aparência).
- **Desktop**: mini-timer sempre no topo (`M`), ícone perto do relógio com menu, opção de continuar rodando ao fechar a janela, atalhos globais (`Ctrl+Alt+P` iniciar/pausar, `Ctrl+Alt+N` pular, `Ctrl+Alt+M` mini, `Ctrl+Alt+F` abrir) e **backup automático diário** numa pasta (mantém os 30 últimos).

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
