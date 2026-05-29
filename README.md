<!--
  README profesional en español: resumen, instalación rápida, uso, despliegue,
  variables de entorno, contribución y referencias.
-->

# ShareCar
Plataforma P2P de alquiler de vehículos con autenticación biométrica (WebAuthn)
y Smart Wallet (integración Stellar).

Descripción breve: ShareCar es una aplicación demostrativa que combina passkeys
para autenticación sin contraseñas, un monedero ligero sobre Stellar para
operaciones de pago y una interfaz SPA moderna construida con React + Vite.

Tabla de contenidos
- [Características](#caracter%C3%ADsticas)
- [Demo y capturas](#demo)
- [Requisitos](#requisitos)
- [Instalación rápida (desarrollo)](#instalaci%C3%B3n-r%C3%A1pida-desarrollo)
- [Variables de entorno](#variables-de-entorno)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Arquitectura](#arquitectura)
- [Despliegue (Netlify)](#despliegue-netlify)
- [Seguridad y WebAuthn](#seguridad-y-webauthn)
- [Contribuir](#contribuir)
- [Licencia](#licencia)

## Características
- Autenticación con Passkeys / WebAuthn (registro y verificación de claves)
- Integración con Stellar para monedero y simulación de pagos
- Catálogo de vehículos, publicación por usuarios y sistema de reservas
- UI responsiva (móvil / tablet / escritorio)
- Backend ligero en Node.js con endpoints para WebAuthn y lógica de negocio

---

### Descripción del proyecto
`ShareCar` facilita el alquiler P2P de vehículos, permitiendo a propietarios publicar
vehículos y a usuarios reservarlos con trazabilidad y autenticación biométrica.
La integración con Stellar ofrece un wallet ligero para pagos y simulación de
transacciones en testnet.

### Propuesta de valor (actores)
- Comunidad (Propietarios): publicar vehículos, gestionar disponibilidad y recibir pagos.
- Usuario (Arrendatario): reservar vehículos, pagar con Smart Wallet y revisar historial.
- Plataforma/Operador: conciliación de pagos, moderación de publicaciones y soporte.

### Arquitectura (adaptada)

```
┌─────────────────────────────────────────────────────┐
│                    CLIENTE (Browser)                │
│         React + Vite + Tailwind                      │
│         Passkeys via @simplewebauthn/browser        │
└──────────────────────┬──────────────────────────────┘
                │ HTTPS / REST API
┌──────────────────────▼──────────────────────────────┐
│                 SERVIDOR (Node.js)                  │
│                  Express.js API                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Auth Layer │  │  Vehículos  │  │  Reservas   │ │
│  │  WebAuthn   │  │  Catálogo   │  │  Pagos/DB   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│  ┌─────────────────────────────────────────────┐    │
│  │           server/data-store.js / DB         │    │
│  │           server/stellar.js  (Stellar SDK)  │    │
│  └─────────────────────────────────────────────┘    │
└──────────┬──────────────────────┬───────────────────┘
        │                      │
┌──────────▼──────────┐  ┌────────▼─────────────────┐
│     SQLite / MySQL  │  │    Stellar Testnet       │
│  (persistencia)     │  │    (wallet & pagos)      │
└─────────────────────┘  └──────────────────────────┘
```

### Flujo de autenticación (WebAuthn)

```
Usuario           Navegador              Servidor
  │                  │                      │
  │─── Username ────►│                      │
  │                  │─── /auth/register/begin ─►│
  │                  │◄── Challenge ────────│
  │◄── Biometría ───►│                      │
  │                  │─── Credential ──────►│
  │                  │◄── Token JWT / Sesión ───│
  │◄── Sesión ───────│                      │
```

### Endpoints principales (resumen)
- `POST /auth/register/begin` — iniciar registro WebAuthn
- `POST /auth/register/complete` — completar registro
- `POST /auth/login/begin` — iniciar login
- `POST /auth/login/complete` — completar login
- `POST /api/vehicles` — publicar vehículo
- `GET /api/vehicles` — listar vehículos
- `POST /api/reservations` — crear reserva
- `POST /api/payments` — iniciar pago (Stellar)

### Tecnologías (resumen)
- Frontend: React, Vite, Tailwind
- Backend: Node.js, Express, @simplewebauthn/server
- Blockchain: Stellar SDK (testnet)
- DB: SQLite / MySQL según despliegue

### Instalación local (adaptada)
1. Clonar y entrar en la carpeta:

```bash
git clone <repo-url>
cd webauthn-app/webauthn-app
```

2. Instalar dependencias:

```bash
npm install
cd server && npm install && cd ..
```

3. Copiar variables de entorno:

```bash
cp .env.example .env.local
# editar .env.local según entorno
```

4. Ejecutar en desarrollo:

Frontend:
```bash
npm run dev
```

Backend:
```bash
cd server
node index.js
```

### Variables de entorno (esenciales)
- `VITE_API_URL` — URL base del backend
- `VITE_STELLAR_HORIZON_URL` — endpoint Horizon
- `SERVER_SECRET` — secreto para tokens en backend (no exponer)

---

### Licencia (adaptada)
Este proyecto se distribuye bajo la licencia MIT.

```text
MIT License

Copyright (c) 2026 ShareCar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

He adaptado y añadido la sección de `ComuniChain` al `README.md` de `ShareCar`.
Ahora voy a commitear y subir estos cambios al remoto.

## Demo
- La aplicación está pensada para desplegarse en Netlify (frontend) y usar
  funciones serverless para la API.
- Para pruebas interdispositivo durante desarrollo, use un túnel HTTPS (`ngrok`).

## Requisitos
- Node.js 18+ (recomendado)
- npm 9+ o yarn
- Navegador moderno con soporte WebAuthn (Chrome, Edge, Safari, Firefox en variantes)

## Instalación rápida (desarrollo)
1. Clonar el repositorio y abrir la carpeta del proyecto:

```bash
git clone <repo-url>
cd webauthn-app/webauthn-app
```

2. Instalar dependencias (raíz y servidor):

```bash
npm install
cd server && npm install && cd ..
```

3. Variables recomendadas: copie `.env.example` a `.env.local` y ajuste valores.

4. Ejecutar en desarrollo (dos terminales):

- Frontend:

```bash
npm run dev
# Vite muestra la URL (ej. http://localhost:5174)
```

- Backend:

```bash
cd server
node index.js
# API por defecto: http://localhost:4000
```

Notas: el proxy de `vite.config.js` redirige `/api` a la API local para facilitar
desarrollo sin configurar `VITE_API_URL`.

## Variables de entorno
Copie `.env.example` y rellene valores sensibles en su entorno (nunca los suba a VCS).

- `VITE_API_URL` — URL base del backend (ej. `/api` o `https://mi-dominio.com/api`)
- `VITE_STELLAR_HORIZON_URL` — URL de Horizon (p. ej. `https://horizon-testnet.stellar.org`)
- Claves privadas y secretos solo en entorno server / Netlify env vars.

Vea `.env.example` para una lista completa.

## Estructura del proyecto

```text
webauthn-app/
├─ netlify/                 # funciones serverless para Netlify
├─ public/                  # recursos estáticos
├─ server/                  # API y lógica del backend
├─ src/                     # frontend React
├─ package.json
└─ vite.config.js
```

## Arquitectura
- Frontend (SPA): React + Vite. Interactúa con la API vía `fetch` a `/api`.
- Backend: Node.js/Express que expone endpoints de WebAuthn (registro / inicio)
  y endpoints para gestionar catálogo, reservas y el wallet.
- Integración Stellar encapsulada en `server/stellar.js`.

Para más detalles técnicos y diagramas, ver [ARCHITECTURE.md](ARCHITECTURE.md).

## Despliegue (Netlify)
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Configure variables de entorno en Netlify (no ponga secretos en el frontend).

Ejemplo de despliegue con Netlify CLI:

```bash
npm i -g netlify-cli
netlify login
netlify deploy --dir=dist --functions=netlify/functions
```

## Seguridad y WebAuthn
- WebAuthn requiere HTTPS y coincidencia de `origin`/`rpId` entre registro y uso.
- Para pruebas locales con dispositivos móviles, exponga la aplicación con HTTPS
  (ngrok o similar) y registre passkeys desde el mismo dominio.
- Nunca almacene claves privadas en el frontend; la lógica sensible debe ejecutarse
  en el backend o en funciones serverless.

Pautas y respuesta a vulnerabilidades en `SECURITY.md`.

## Contribuir
Lea `CONTRIBUTING.md` para flujos de trabajo, estilo de commits y cómo enviar PRs.

## Recursos útiles
- Código del servidor: [server/index.js](server/index.js)
- Helpers Stellar: [server/stellar.js](server/stellar.js)

## Licencia
Proyecto de ejemplo — agregue aquí su licencia (ej. MIT) si aplica.

---

Si quieres, puedo además:
- Añadir `CONTRIBUTING.md` y `SECURITY.md` (ya los he creado).
- Crear un `.env.example` con variables descritas arriba.

Dime si quieres que añada badges, un changelog o un documento con diagramas de arquitectura más detallados.
