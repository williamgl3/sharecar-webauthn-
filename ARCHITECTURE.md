# Arquitectura técnica (resumen)

Componentes:

- Frontend (SPA): React + Vite
  - Responsable de la UI, llamadas a la API y gestión del estado cliente.
- Backend: Node.js / Express (/server)
  - Endpoints para WebAuthn (registro/autenticación), catálogo, reservas.
- Integración Stellar: `server/stellar.js`
  - Encapsula llamadas a Horizon y operaciones de cuenta/transferencia.
- Netlify Functions: `netlify/functions/api.js` (wrapper para deploy serverless)

Flujo principal (resumido):
1. Usuario registra passkey -> frontend solicita options a la API -> backend
   crea challenge y guarda el estado parcial -> frontend llama a `navigator.credentials.create`
   y envía la respuesta al backend para verificación.
2. Para reservas/pagos -> usuario inicia acción en UI -> frontend llama API ->
   backend valida y, si procede, usa helpers Stellar para simular/realizar pago.

Diagramas: para diagramas visuales pida que añada un diagrama mermaid o SVG.
