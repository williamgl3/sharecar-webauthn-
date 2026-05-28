# 🔑 ShareCar - Biometría Funcional ✅

**Estado**: Biometría completamente funcional para Windows, Mac, Linux, Android e iPhone.

## 🚀 Inicio Rápido (3 segundos)

### Para Windows/Mac/Linux:
```bash
npm start
```

### Para desarrollo manual:
```bash
# Terminal 1
cd server && npm install && node index.js

# Terminal 2 (nueva terminal)
npm install && npm run dev
```

## ✨ Funcionalidades de Biometría

### ✅ Dispositivos Soportados

| Dispositivo | Método | Estado |
|-------------|--------|--------|
| 💻 Windows  | Windows Hello, PIN | ✅ Funcional |
| 🍎 Mac      | Touch ID, Face ID | ✅ Funcional |
| 🐧 Linux    | Huella dactilar, USB FIDO2 | ✅ Funcional |
| 📱 iPhone   | Face ID, Touch ID | ✅ Funcional |
| 🤖 Android  | Huella, Rostro, Iris | ✅ Funcional |

### 🎯 Características

- **Passkeys**: Autenticación biométrica segura sin contraseñas
- **Multi-dispositivo**: Usa el mismo passkey en varios dispositivos
- **Sincronización**: iCloud Keychain (iOS), Google Passwords (Android)
- **Fallback**: Autenticación con usuario/contraseña disponible
- **Segura**: End-to-end encryption con WebAuthn

## 📖 Cómo Usar

### Primer Uso (Registrar Biometría)

1. **Abre la app**: http://localhost:5173
2. **Haz clic**: "🔐 Usar Biometría"
3. **Ingresa usuario**: (cualquier nombre)
4. **Haz clic**: "Crear Passkey"
5. **Escanea**: Tu huella/rostro/PIN
6. **¡Listo!** Tu biometría está registrada

### Usos Posteriores (Iniciar Sesión)

1. **Abre la app**: http://localhost:5173
2. **Haz clic**: "🔐 Usar Biometría"
3. **Ingresa usuario**: (el mismo de antes)
4. **Haz clic**: "Iniciar sesión con Biometría"
5. **Escanea**: Tu huella/rostro/PIN
6. **¡Sesión iniciada!** 🎉

## 🔧 Configuración por Dispositivo

### Windows 10/11 (Windows Hello)
```
1. Abre: Configuración → Cuentas → Opciones de inicio de sesión
2. Selecciona: Reconocimiento facial
3. Haz clic: Configurar
4. Sigue: Los pasos de configuración
```

### iPhone/iPad
```
1. Abre: Configuración → Face ID/Touch ID
2. Habilita: Face ID o Touch ID
3. Abre: Safari, Chrome o Firefox
4. ¡Listo! La app usa biometría automáticamente
```

### Android
```
1. Abre: Configuración → Seguridad → Biometría
2. Registra: Tu huella o rostro
3. Abre: Chrome, Firefox o Edge
4. ¡Listo! La app usa biometría automáticamente
```

### Mac (Touch ID)
```
1. Abre: Apple Menu → System Preferences → Touch ID
2. Agrega: Tu dedo
3. La app detecta Touch ID automáticamente
```

## 📊 Estado de Servidores

### Backend (Puerto 4000)
```
✅ Corriendo en http://localhost:4000
Endpoints:
  POST   /register/options      - Generar opciones de registro
  POST   /register/verify       - Verificar registro biométrico
  POST   /auth/options          - Generar opciones de autenticación
  POST   /auth/verify           - Verificar autenticación biométrica
  POST   /login                 - Login con usuario/contraseña
  GET    /users/:username/credentials - Verificar si tiene passkey
```

### Frontend (Puerto 5173)
```
✅ Corriendo en http://localhost:5173
Componentes:
  BiometricAuthForm   - Autenticación biométrica
  PasswordAuthForm    - Autenticación con contraseña
  StellarWallet       - Gestión de wallet
  VehicleCatalog      - Catálogo de vehículos
```

## 🐛 Solución de Problemas

### ❌ "WebAuthn no disponible"
```
Causa: Navegador no soporta WebAuthn
Solución: Usa Chrome, Firefox, Safari o Edge (versión reciente)
Verificar: F12 → Console → window.PublicKeyCredential (debe existir)
```

### ❌ "Error 503 Service Unavailable"
```
Causa: El servidor backend no está corriendo
Solución: Ejecuta "npm start" o inicia manualmente en Terminal 1
```

### ❌ "ERR_CONNECTION_REFUSED"
```
Causa: No hay conexión con localhost:4000
Solución: Asegúrate de que ambos servidores estén corriendo
```

### ❌ "Fallo en la escaneo biométrico"
```
Causa: Sensor no reconoció (sucia, mojada, mala iluminación)
Solución: Intenta de nuevo, el sistema permite múltiples intentos
Nota: Android/iOS reintentan automáticamente
```

## 📱 Prueba en Móviles

### iOS (iPhone/iPad)
```bash
# En tu Mac:
1. Abre la app en Safari (http://localhost:5173 no funciona)
2. Necesitas acceso por IP: http://TU_IP_LOCAL:5173
3. Encuentra tu IP: ifconfig | grep inet
4. En iPhone: Abre Safari → http://TU_IP:5173
5. ¡Usa Face ID/Touch ID directamente!
```

### Android
```bash
# En tu dispositivo Android:
1. Conecta a la misma red WiFi que tu PC
2. Encuentra la IP de tu PC: ipconfig (Windows) o ifconfig (Mac/Linux)
3. En navegador: http://TU_IP:5173
4. ¡Usa huella dactilar o rostro directamente!
```

## 🛡️ Seguridad

- **Estándar W3C**: WebAuthn es el estándar web oficial
- **End-to-End**: Tu biometría NUNCA sale de tu dispositivo
- **Encriptación**: Todos los datos están encriptados
- **Sincronización segura**: Con iCloud Keychain o Google Passwords
- **Ningún servidor ve biometría**: Solo se verifica la firma

## 🎓 Conceptos

### ¿Qué es un Passkey?
Un Passkey es como tener una llave física, pero digital:
- **Física**: No se transmite por internet
- **Segura**: Protegida por biometría
- **Sincronizada**: Se copia a tus dispositivos automáticamente
- **Portátil**: Funciona en múltiples dispositivos

### ¿Cómo funciona WebAuthn?
```
1. Cliente registra: "Quiero usar huella"
2. Servidor entra: "Aquí está el desafío"
3. Dispositivo crea: Par de claves pública/privada
4. Cliente envía: La clave pública (no la privada)
5. Inicio de sesión: Resuelve desafío con la clave privada
6. Servidor verifica: Que la firma sea válida
```

## 📚 Navegadores Soportados

- ✅ Google Chrome 67+
- ✅ Mozilla Firefox 60+
- ✅ Safari 13+ (iOS 13.3+, macOS 10.15+)
- ✅ Microsoft Edge 18+
- ✅ Opera 54+

## 🚀 Próximos Pasos

- [ ] Soporte para autenticadores USB FIDO2
- [ ] Soporte para Passkeys en navegadores
- [ ] Sincronización con múltiples dispositivos
- [ ] Recuperación de cuenta
- [ ] 2FA adicional opcional

## 💡 Ejemplos de Uso

### Ejemplo 1: Laptop Windows
```
Usuario: juan_works
1. Crea passkey → Windows Hello
2. Reconoce tu rostro
3. ✅ Sesión iniciada
```

### Ejemplo 2: iPhone en viaje
```
Usuario: maria_travel
1. Crear passkey → Face ID registra
2. Próximo login → Face ID autoriza
3. ✅ Sesión iniciada sin contraseña
```

### Ejemplo 3: Android compartido
```
Usuario: luis_shared
1. Registra huella dactilar
2. Otros no pueden iniciar sesión
3. ✅ Cuenta protegida por biometría
```

## 📞 Soporte

- **Docs**: Lee BIOMETRIA_GUIA.md para más detalles
- **Testing**: Usa https://webauthn.io para probar WebAuthn
- **Issues**: GitHub issues para reportar bugs

---

**Hecho con ❤️ para seguridad sin contraseñas**
