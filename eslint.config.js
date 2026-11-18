'use strict';
const fs = require('fs');
const path = require('path');
const js = require('@eslint/js');
const globals = require('globals');

// Os scripts de js/ são clássicos e compartilham os nomes declarados no nível de cima de cada arquivo.
const appGlobals = {};
for (const f of fs.readdirSync(path.join(__dirname, 'js'))) {
  const src = fs.readFileSync(path.join(__dirname, 'js', f), 'utf8');
  for (const m of src.matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)) appGlobals[m[1]] = 'readonly';
}

const rules = {
  'no-unused-vars': ['error', { vars: 'local', args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-redeclare': ['error', { builtinGlobals: false }],
};

module.exports = [
  { ignores: ['node_modules/**', 'dist/**', 'runtime/**'] },
  js.configs.recommended,
  { files: ['js/**/*.js'], languageOptions: { sourceType: 'script', globals: { ...globals.browser, ...appGlobals } }, rules },
  { files: ['sw.js'], languageOptions: { sourceType: 'script', globals: globals.serviceworker }, rules },
  { files: ['electron/**/*.js', 'build/**/*.js', 'scripts/**/*.js', 'tests/**/*.js', 'eslint.config.js'], languageOptions: { sourceType: 'commonjs', globals: globals.node }, rules },
];
