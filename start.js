#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startServer(name, command, args, cwd, waitFor) {
  log('blue', `📦 Iniciando ${name}...`);

  const child = spawn(command, args, {
    cwd: cwd,
    stdio: 'inherit',
    shell: true,
  });

  child.on('error', (error) => {
    log('red', `❌ Error en ${name}: ${error.message}`);
  });

  child.on('close', (code) => {
    if (code !== null && code !== 0) {
      log('red', `❌ ${name} terminó con código ${code}`);
    }
  });

  if (waitFor) {
    await sleep(waitFor);
  }

  return child;
}

async function main() {
  log('yellow', '🚀 Iniciando ShareCar WebAuthn App...\n');

  const rootDir = __dirname;
  const serverDir = path.join(rootDir, 'server');
  const clientDir = rootDir;

  // Instalar dependencias
  log('yellow', '📚 Instalando dependencias...');

  if (!fs.existsSync(path.join(serverDir, 'node_modules'))) {
    await startServer('npm install (server)', 'npm', ['install'], serverDir, 1000);
  }

  if (!fs.existsSync(path.join(clientDir, 'node_modules'))) {
    await startServer('npm install (client)', 'npm', ['install'], clientDir, 1000);
  }

  log('green', '✅ Dependencias instaladas\n');

  // Iniciar backend
  const backend = await startServer(
    'Backend (Puerto 4000)',
    'node',
    ['index.js'],
    serverDir,
    3000
  );

  log('green', '✅ Backend corriendo en http://localhost:4000\n');

  // Iniciar frontend
  const frontend = await startServer(
    'Frontend (Puerto 5173)',
    'npm',
    ['run', 'dev'],
    clientDir,
    2000
  );

  log('green', '✅ Frontend corriendo en http://localhost:5173\n');

  log('yellow', '═══════════════════════════════════════════');
  log('green', '✅ Servidores iniciados correctamente!');
  log('yellow', '═══════════════════════════════════════════\n');

  log('blue', '📋 URLs disponibles:');
  log('green', '  🌐 Frontend:  http://localhost:5173');
  log('green', '  📡 Backend:   http://localhost:4000\n');

  log('blue', '🔐 Funciones de biometría disponibles:');
  log('green', '  ✅ Passkey (huella digital / Face ID)');
  log('green', '  ✅ Autenticación con usuario/contraseña');
  log('green', '  ✅ Soporte para Windows Hello, TouchID, Face ID\n');

  log('yellow', '⌨️ Comandos:');
  log('green', '  Presiona Ctrl+C para detener los servidores\n');

  // Mantener los procesos corriendo
  await new Promise(() => {
    // Nunca resuelve - mantiene la app corriendo
  });
}

main().catch(error => {
  log('red', `Error fatal: ${error.message}`);
  process.exit(1);
});
