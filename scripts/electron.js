'use strict';
// Roda um script dentro do Electron, sempre em modo de app (mesmo se o terminal definir ELECTRON_RUN_AS_NODE).
const { spawnSync } = require('child_process');
const electron = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const r = spawnSync(electron, process.argv.slice(2), { stdio: 'inherit', env });
if (r.error) console.error(r.error.message);
process.exit(r.status ?? 1);
