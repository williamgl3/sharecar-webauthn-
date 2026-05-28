#!/bin/bash

echo "🚀 Iniciando ShareCar WebAuthn App..."
echo ""

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Iniciar backend
echo -e "${BLUE}📦 Iniciando servidor backend en puerto 4000...${NC}"
cd server
npm install --silent 2>/dev/null
node index.js &
BACKEND_PID=$!
sleep 2

# Verificar si el backend está corriendo
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Error iniciando el backend${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backend corriendo (PID: $BACKEND_PID)${NC}"
cd ..

# Iniciar frontend
echo -e "${BLUE}📱 Iniciando servidor frontend en puerto 5173...${NC}"
npm install --silent 2>/dev/null
npm run dev &
FRONTEND_PID=$!
sleep 3

echo ""
echo -e "${GREEN}✅ Servidores iniciados correctamente!${NC}"
echo ""
echo -e "${YELLOW}📋 URLs disponibles:${NC}"
echo -e "  Frontend:  ${BLUE}http://localhost:5173${NC}"
echo -e "  Backend:   ${BLUE}http://localhost:4000${NC}"
echo ""
echo -e "${YELLOW}🔐 Funciones de biometría disponibles:${NC}"
echo "  ✅ Passkey (huella digital / Face ID)"
echo "  ✅ Autenticación con usuario/contraseña"
echo "  ✅ Soporte para Windows Hello, TouchID, Face ID"
echo ""
echo -e "${YELLOW}⌨️ Comandos:${NC}"
echo "  Presiona Ctrl+C para detener los servidores"
echo ""

# Mantener los procesos corriendo
wait
