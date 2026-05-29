# ShareCar
**Plataforma P2P de Alquiler de Vehículos con Autenticación Biométrica y Smart Wallet**

ShareCar es una aplicación moderna para alquiler de vehículos entre usuarios (P2P). Combina autenticación biométrica (WebAuthn / passkeys), integración con la red Stellar para pagos seguros y una interfaz responsiva construida con React + Vite + Tailwind CSS.

---

## Características principales

- Autenticación con Passkey (huella, Face ID o PIN)
- Smart Wallet integrado (Stellar) para visualizar saldo y realizar pagos
- Catálogo de vehículos, reservas y cancelaciones
- Publicación de vehículos por usuarios
- Interfaz responsiva para móvil, tablet y escritorio
- Preparado para despliegue en Netlify (frontend) y funciones serverless

---

## Tecnologías

- Frontend: React 19, Vite, Tailwind CSS, lucide-react
- Backend: Node.js, Express, `@simplewebauthn/server`
- Blockchain: Stellar (helpers en `server/stellar.js`)
- Dev / Deploy: Vite, Netlify (funciones en `netlify/functions`)

---

## Instalación local (desarrollo)

1. Clonar el repositorio

```bash
git clone <repo-url>
cd webauthn-app
```

2. Instalar dependencias

```bash
npm install
cd server
npm install
cd ..
```

3. Ejecutar en desarrollo (dos terminales)

- Frontend:

```bash
npm run dev
# abre http://localhost:5174 (o el puerto que muestre Vite)
```

- Backend:

```bash
cd server
node index.js
# escucha por defecto en http://localhost:4000
```

> Nota: el frontend usa rutas relativas `/api` por defecto si `VITE_API_URL` no está configurada. `vite.config.js` tiene un proxy que redirige `/api` → `http://localhost:4000` en desarrollo.

---

## Variables de entorno recomendadas

Crear un archivo `.env.local` o configurar variables en el entorno:

```
VITE_API_URL=/api
VITE_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
# Añadir aquí claves o endpoints adicionales según necesidad
```

---

## Build y prueba (producción local)

```bash
npm run build
# servir dist/ con un servidor estático o usar `npm run preview`
npm run preview
```

---

## Despliegue en Netlify (frontend + functions)

ShareCar incluye `netlify/functions/api.js` como wrapper. Para desplegar en Netlify:

1. Instalar Netlify CLI (opcional)

```bash
npm i -g netlify-cli
netlify login
```

2. Configurar en Netlify (UI o CLI):
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Variables de entorno: `VITE_STELLAR_HORIZON_URL`, claves privadas necesarias (no exponerlas en frontend)

3. Deploy de prueba:

```bash
netlify deploy --dir=dist --functions=netlify/functions
```

Deploy a producción:

```bash
netlify deploy --prod --dir=dist --functions=netlify/functions
```

---

## Notas para WebAuthn / Passkeys

- WebAuthn requiere HTTPS y que el `origin` coincida entre registro y uso de la passkey.
- Para probar desde el teléfono y usar el teléfono como autenticador, la app debe estar desplegada en un dominio HTTPS accesible desde el móvil. En `localhost` no se comparten credenciales entre dispositivos.
- Opciones para pruebas interdispositivo:
  - Exponer la app con `ngrok` o `localtunnel` y usar el dominio `https://...` resultante.
  - Registrar y usar la passkey desde el mismo dispositivo.
  - Verificar que `rpID` y `origin` coincidan con el dominio usado; el backend obtiene `rpID` desde el header `origin` por defecto.

Errores comunes:
- “No hay llave creada para localhost”: intentas autenticar desde un dispositivo distinto al que registró la passkey.
- “The operation either timed out or was not allowed”: la llamada a `navigator.credentials.create/get` perdió la activación del usuario; la UI pre-carga opciones antes del click para mitigarlo.

---

## Estructura del proyecto (resumen)

```
webauthn-app/
├─ netlify/
│  └─ functions/api.js
├─ public/
├─ server/
│  ├─ index.js
│  ├─ data-store.js
│  └─ stellar.js
├─ src/
│  ├─ components/BiometricAuthForm.jsx
│  ├─ components/VehicleCatalog.jsx
│  └─ App.jsx
├─ vite.config.js
├─ package.json
└─ netlify.toml
```

---

## Cómo usar (resumen rápido)

1. Abrir la app (https en producción).
2. Hacer click en “🔐 Usar Biometría”.
3. Escribir el usuario; si no existe, crear cuenta y luego “Registrar Passkey”.
4. Confirmar la autenticación biométrica en el dispositivo.
5. Al verificarse, la app inicia sesión y muestra el panel con Smart Wallet y opciones de reservas.

---

Si quieres que además cree el archivo `.env.example` y añada una nota en `netlify.toml`, dime y lo hago ahora.
