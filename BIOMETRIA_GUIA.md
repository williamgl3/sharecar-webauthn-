# 🔐 Guía de Biometría - ShareCar

## ¿Cómo iniciar la aplicación?

### Opción 1: Script automático (Recomendado)
```bash
chmod +x start.sh
./start.sh
```

### Opción 2: Manual (Dos terminales)
**Terminal 1 - Backend:**
```bash
cd server
npm install
node index.js
# Espera: "WebAuthn demo server listening on http://localhost:4000"
```

**Terminal 2 - Frontend:**
```bash
npm install
npm run dev
# Espera: "Local: http://localhost:5173"
```

## ✅ Funcionalidades de Biometría

### 🖥️ En Computadora

#### Windows
- ✅ **Windows Hello** (rostro, huella, PIN)
- ✅ **Credential Guard** (Windows 10+)
- ✅ **Autenticador de Windows**
- Configuración: Configuración → Cuentas → Opciones de inicio de sesión

#### Mac
- ✅ **Touch ID** (huella dactilar)
- ✅ **Face ID** (en MacBooks Pro M1+)
- ✅ **iCloud Keychain**
- Configuración automática

#### Linux
- ✅ **Huella Dactilar** (con sensor)
- ✅ **Autenticadores USB** (YubiKey, etc.)
- Necesita: `libpam-fprintd` o dispositivo FIDO2

### 📱 En Dispositivos Móviles

#### iPhone/iPad
- ✅ **Face ID** (reconocimiento facial)
- ✅ **Touch ID** (huella dactilar)
- ✅ **Passkeys de iCloud**
- Automático en Safari, Chrome, Firefox

#### Android
- ✅ **Biometría del dispositivo** (huella, iris)
- ✅ **Reconocimiento facial**
- ✅ **Autenticadores FIDO2 USB**
- Compatible con Chrome, Firefox, Edge

## 🚀 Flujo de Autenticación

### Primer inicio (Nuevo usuario)

1. Abre http://localhost:5173
2. Haz clic en **🔐 Usar Biometría**
3. Ingresa tu nombre de usuario
4. Haz clic en **Crear Passkey**
5. Escanea tu huella / rostro / PIN
6. ¡Listo! Se ha registrado tu biometría

### Inicios posteriores (Usuario existente)

1. Abre http://localhost:5173
2. Haz clic en **🔐 Usar Biometría**
3. Ingresa tu nombre de usuario
4. Se detectará automáticamente que ya tienes un passkey
5. Haz clic en **Iniciar sesión con Biometría**
6. Escanea tu huella / rostro / PIN
7. ¡Sesión iniciada! 🎉

## 🔧 Solución de Problemas

### Error: "WebAuthn no disponible"
- **Causa**: Navegador no soporta WebAuthn
- **Solución**: Usa Chrome, Firefox, Safari, Edge (versión reciente)
- **Verificar**: Abre la consola (F12) y escribe `window.PublicKeyCredential`

### Error: "No se detectó biometría"
- **Causa**: Dispositivo no tiene sensor biométrico
- **Solución**: Usa un dispositivo con sensor o autenticador USB
- **Alternativa**: Usa "Usuario y Contraseña"

### Error: "Fallo de autenticación"
- **Causa**: Biometría no reconoció correctamente
- **Solución**: Intenta de nuevo, puede ser:
  - Huella sucia o mojada
  - Mala iluminación para Face ID
  - PIN incorrecto
- **Retry**: El sistema permite múltiples intentos

### Error: 503 Service Unavailable
- **Causa**: El servidor backend no está corriendo
- **Solución**: Ejecuta `node server/index.js` en otra terminal
- **Verificar**: http://localhost:4000 debe responder

### Error: ERR_CONNECTION_REFUSED
- **Causa**: No hay conexión con el servidor backend
- **Solución**: Asegúrate de que ambos servidores estén corriendo
- **Comandos**:
  ```bash
  # Terminal 1
  cd server && node index.js
  
  # Terminal 2
  npm run dev
  ```

## 📝 Pasos para Registrar Biometría Correctamente

### En Windows Hello (Biometría del Rostro)
1. Abre Configuración → Cuentas → Opciones de inicio de sesión
2. Selecciona "Reconocimiento facial"
3. Haz clic en "Configurar"
4. Sigue los pasos (gira la cabeza, cambia de ángulo)
5. Haz clic en "Listo"

### En iPhone/iPad
1. Abre Configuración → Face ID / Touch ID
2. Asegúrate de que están habilitados
3. En Safari: El dispositivo usará Face ID/Touch ID automáticamente

### En Android
1. Abre Configuración → Seguridad → Biometría
2. Registra tu huella / rostro según tu dispositivo
3. En la app: El navegador usará biometría automáticamente

## 🎯 Casos de Uso

### Caso 1: Usuario nuevo en Laptop (Windows)
```
1. Ingresa usuario "juan_windows"
2. Haz clic en "Crear Passkey"
3. Windows Hello se abre → Reconoce tu rostro
4. ✅ Passkey creado y conectado a tu cuenta
```

### Caso 2: Usuario existente en iPhone
```
1. Ingresa usuario "maria_iphone"
2. Se detecta que ya tienes passkey
3. Haz clic en "Iniciar sesión"
4. iPhone solicita Face ID
5. ✅ Sesión iniciada con biometría
```

### Caso 3: Sin biometría disponible (Linux)
```
1. Ingresa usuario "dev_linux"
2. No se detecta biometría
3. Sistema ofrece: "Usuario y Contraseña"
4. ✅ Sesión iniciada sin biometría
```

## 🛡️ Seguridad

- **Encriptación**: End-to-end con WebAuthn
- **Privacidad**: Tu biometría NUNCA sale de tu dispositivo
- **Standard**: W3C WebAuthn (usado por Google, Apple, Microsoft)
- **Backup**: Tus passkeys se sincronizan con iCloud/Google Passwords

## 📚 Navegadores Soportados

| Navegador | Windows | Mac | Linux | iOS | Android |
|-----------|---------|-----|-------|-----|---------|
| Chrome    | ✅      | ✅  | ✅    | ✅  | ✅      |
| Firefox   | ✅      | ✅  | ✅    | ✅  | ✅      |
| Safari    | -       | ✅  | -     | ✅  | -       |
| Edge      | ✅      | ✅  | ✅    | ✅  | ✅      |
| Opera     | ✅      | ✅  | ✅    | ✅  | ✅      |

## 🔗 Recursos

- [WebAuthn.io](https://webauthn.io) - Probar WebAuthn
- [FIDO2](https://fidoalliance.org) - Standard de autenticación
- [SimpleWebAuthn](https://simplewebauthn.dev) - Librería usada
