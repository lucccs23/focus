'use strict';
// Cria os atalhos "Focus" (Área de Trabalho e menu Iniciar) apontando para runtime\Focus.exe,
// com a mesma identificação de app da janela — assim fixar na barra de tarefas funciona certo.
// Uso: npm run shortcuts   (roda com o Electron, que sabe gravar essa identificação no atalho)
const { app, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const target = path.join(ROOT, 'runtime', 'Focus.exe');
const opts = {
  target, cwd: ROOT, icon: path.join(ROOT, 'build', 'icon.ico'), iconIndex: 0,
  description: 'Focus — pomodoro, cronômetro e estatísticas de estudo', appUserModelId: 'com.focus.app',
};

app.whenReady().then(() => {
  if (!fs.existsSync(target)) { console.error('Rode antes: npm run runtime'); app.exit(1); return; }
  const places = [app.getPath('desktop'), path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')];
  for (const dir of places) {
    // atalhos antigos (de antes do runtime com nome próprio)
    fs.rmSync(path.join(dir, 'Focus (projeto).lnk'), { force: true });
    const ok = shell.writeShortcutLink(path.join(dir, 'Focus.lnk'), 'create', opts) || shell.writeShortcutLink(path.join(dir, 'Focus.lnk'), 'replace', opts);
    console.log(`${ok ? 'ok' : 'FALHOU'}: ${path.join(dir, 'Focus.lnk')}`);
  }
  app.exit(0);
});
