import { useState, useRef, useEffect, useCallback } from 'react';
import { Fingerprint, AlertCircle, CheckCircle, Loader, Eye, EyeOff, Lock, Shield } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4000');

// Helper functions for base64url encoding/decoding
const base64urlToBytes = (base64url) => {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return new Uint8Array(binary.split('').map(c => c.charCodeAt(0)));
};

const bufferToBase64url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

const BiometricAuthForm = ({ onSuccess, onCancel, initialMode }) => {
  const [step, setStep] = useState('method');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [webauthnSupport, setWebauthnSupport] = useState(false);
  const [biometricCapabilities, setBiometricCapabilities] = useState({
    fingerprint: false,
    faceID: false,
    platformAuth: false,
  });
  const [hasCredentials, setHasCredentials] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [showPassword, setShowPassword] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const checkWebAuthn = () => {
      const ua = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|iphone|ipad|ipod|windows phone|blackberry|opera mini|silk|kindle/.test(ua);

      const isWebAuthnSupported = window.PublicKeyCredential !== undefined;

      if (isWebAuthnSupported) {
        Promise.all([
          PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
          PublicKeyCredential.isConditionalMediationAvailable?.() || Promise.resolve(false),
        ]).then(([isPlatform]) => {
          setBiometricCapabilities({
            platformAuth: isPlatform,
            faceID: isMobileDevice && /iphone|ipad/.test(ua),
            fingerprint: isMobileDevice || isPlatform,
          });
        });
      }

      setIsMobile(isMobileDevice);
      setWebauthnSupport(isWebAuthnSupported);
    };

    checkWebAuthn();
  }, []);

  useEffect(() => {
    if (!username.trim()) {
      setHasCredentials(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/users/${encodeURIComponent(username.trim())}/credentials`);
        const data = await res.json();
        setHasCredentials(data.hasCredentials);
      } catch {
        setHasCredentials(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const handlePasskeyLogin = async () => {
    if (!username.trim()) {
      setMessage('Ingresa un usuario');
      setMessageType('error');
      return;
    }

    setMessage('');
    setStep('authenticating');

    try {
      const response = await fetch(`${API_URL}/auth/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Usuario no encontrado');
      }

      const options = await response.json();

      const publicKey = {
        challenge: base64urlToBytes(options.challenge),
        rpId: options.rpId,
        allowCredentials: (options.allowCredentials || []).map((cred) => ({
          ...cred,
          id: base64urlToBytes(cred.id),
        })),
        userVerification: isMobile ? 'preferred' : 'required',
        timeout: options.timeout || 60000,
      };

      const assertion = await navigator.credentials.get({ publicKey });
      if (!assertion) throw new Error('Autenticación cancelada');

      const verifyResponse = await fetch(`${API_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          assertion: {
            id: assertion.id,
            rawId: bufferToBase64url(assertion.rawId),
            type: assertion.type,
            response: {
              clientDataJSON: bufferToBase64url(assertion.response.clientDataJSON),
              authenticatorData: bufferToBase64url(assertion.response.authenticatorData),
              signature: bufferToBase64url(assertion.response.signature),
              userHandle: assertion.response.userHandle ? bufferToBase64url(assertion.response.userHandle) : null,
            },
          },
        }),
      });

      const verifyData = await verifyResponse.json();
      if (!verifyData.ok) throw new Error(verifyData.error || 'Autenticación fallida');

      setMessage('✅ ¡Bienvenido! Accediendo...');
      setMessageType('success');

      setTimeout(() => {
        onSuccess({
          username: username.trim(),
          authMethod: 'webauthn',
        });
      }, 1500);
    } catch (error) {
      setMessage(`❌ ${error.message}`);
      setMessageType('error');
      setStep('method');
    }
  };

  const handlePasskeyRegistration = async () => {
    if (!username.trim()) {
      setMessage('Ingresa un usuario');
      setMessageType('error');
      return;
    }

    setMessage('');
    setStep('registering');

    try {
      const response = await fetch(`${API_URL}/register/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Error al generar opciones');
      }

      const options = await response.json();

      const publicKey = {
        challenge: base64urlToBytes(options.challenge),
        rp: options.rp,
        user: {
          ...options.user,
          id: base64urlToBytes(options.user.id),
        },
        pubKeyCredParams: options.pubKeyCredParams,
        attestation: options.attestation,
        authenticatorSelection: {
          ...options.authenticatorSelection,
          userVerification: isMobile ? 'preferred' : 'required',
        },
        excludeCredentials: (options.excludeCredentials || []).map((cred) => ({
          ...cred,
          id: base64urlToBytes(cred.id),
        })),
        timeout: options.timeout || 60000,
      };

      const attestation = await navigator.credentials.create({ publicKey });
      if (!attestation) throw new Error('Registro cancelado');

      const verifyResponse = await fetch(`${API_URL}/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          attestation: {
            id: attestation.id,
            rawId: bufferToBase64url(attestation.rawId),
            type: attestation.type,
            response: {
              clientDataJSON: bufferToBase64url(attestation.response.clientDataJSON),
              attestationObject: bufferToBase64url(attestation.response.attestationObject),
            },
          },
        }),
      });

      const verifyData = await verifyResponse.json();
      if (!verifyData.ok) throw new Error(verifyData.error || 'Error en servidor');

      setMessage('✅ Passkey registrado. Iniciando sesión...');
      setMessageType('success');

      setTimeout(() => {
        onSuccess({
          username: username.trim(),
          authMethod: 'webauthn',
        });
      }, 1500);
    } catch (error) {
      setMessage(`❌ ${error.message}`);
      setMessageType('error');
      setStep('method');
    }
  };

  const handlePasswordLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setMessage('Usuario y contraseña requeridos');
      setMessageType('error');
      return;
    }

    setMessage('');
    setStep('authenticating');

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Credenciales inválidas');

      setMessage('✅ Sesión iniciada');
      setMessageType('success');

      setTimeout(() => {
        onSuccess({
          username: username.trim(),
          authMethod: 'password',
        });
      }, 1500);
    } catch (error) {
      setMessage(`❌ ${error.message}`);
      setMessageType('error');
      setStep('method');
    }
  };

  const getBiometricLabel = () => {
    if (biometricCapabilities.faceID) return '👤 Face ID / Reconocimiento Facial';
    if (biometricCapabilities.fingerprint) return '🔐 Huella Dactilar / Biometría';
    return '🔑 Passkey Seguro';
  };

  return (
    <div className="space-y-4">
      {/* Capacidades del Dispositivo */}
      <div className="bg-gradient-to-r from-blue-900/40 to-cyan-900/40 border border-cyan-500/50 rounded-lg p-4 text-sm space-y-2">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-cyan-400" />
          <span className="font-semibold text-cyan-200">
            {isMobile ? '📱 Dispositivo Móvil' : '🖥️ Computadora'}
          </span>
        </div>
        <div className="text-cyan-300 text-xs space-y-1 ml-6">
          {webauthnSupport ? (
            <>
              <div>✅ WebAuthn Disponible</div>
              {biometricCapabilities.faceID && <div>✅ Face ID</div>}
              {biometricCapabilities.fingerprint && <div>✅ Huella Dactilar</div>}
              {biometricCapabilities.platformAuth && <div>✅ Autenticador de Plataforma</div>}
            </>
          ) : (
            <div>⚠️ WebAuthn No Disponible</div>
          )}
        </div>
      </div>

      {step === 'method' && (
        <div className="space-y-4">
          {/* Username */}
          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">Usuario</label>
            <input
              type="text"
              placeholder="Tu nombre de usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-cyan-500 outline-none transition"
            />
          </div>

          {/* Passkey Principal */}
          {webauthnSupport && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-cyan-400 tracking-wide">MÉTODO SEGURO RECOMENDADO</div>
              {hasCredentials ? (
                <button
                  onClick={handlePasskeyLogin}
                  className="w-full px-4 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
                >
                  <Fingerprint size={24} className="animate-pulse" />
                  <div className="text-left">
                    <div className="font-bold text-lg">{getBiometricLabel()}</div>
                    <div className="text-xs text-cyan-100">Iniciar sesión con passkey</div>
                  </div>
                </button>
              ) : (
                <button
                  onClick={handlePasskeyRegistration}
                  className="w-full px-4 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
                >
                  <CheckCircle size={24} />
                  <div className="text-left">
                    <div className="font-bold text-lg">Crear Passkey</div>
                    <div className="text-xs text-purple-100">Registra tu huella, Face ID o PIN</div>
                  </div>
                </button>
              )}

              {hasCredentials && (
                <button
                  onClick={handlePasskeyRegistration}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} />
                  <span>Registrar Otro Passkey</span>
                </button>
              )}
            </div>
          )}

          {/* Divider */}
          {webauthnSupport && (
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-gray-600"></div>
              <span className="px-3 text-xs text-gray-400 font-semibold">O</span>
              <div className="flex-grow border-t border-gray-600"></div>
            </div>
          )}

          {/* Password Fallback */}
          <div className="space-y-3">
            {webauthnSupport && <div className="text-xs font-bold text-gray-400 tracking-wide">MÉTODO ALTERNATIVO</div>}
            
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-cyan-500 outline-none transition pr-10"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              onClick={handlePasswordLogin}
              className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
            >
              <Lock size={18} />
              <span>Iniciar Sesión</span>
            </button>
          </div>

          {/* Cancel */}
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-lg transition"
          >
            Cancelar
          </button>

          {/* Info Box */}
          <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-4 text-xs text-green-200 space-y-2">
            <div className="font-bold text-green-300">💡 ¿Qué es un Passkey?</div>
            <div>Un método de autenticación ultra-seguro que usa biometría (Face ID, huella, PIN) sin necesidad de contraseñas.</div>
            <div className="space-y-1 text-green-300">
              <div>✅ No requiere contraseña</div>
              <div>✅ Máxima seguridad biométrica</div>
              <div>✅ Sincronización automática</div>
            </div>
          </div>
        </div>
      )}

      {/* Loading States */}
      {(step === 'registering' || step === 'authenticating') && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader size={48} className="text-cyan-400 animate-spin" />
          <div className="text-center">
            <p className="font-bold text-lg">
              {step === 'registering' ? 'Registrando Passkey...' : 'Autenticando...'}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              {isMobile ? '👤 Escanea tu huella o cara' : '🔐 Completa tu autenticación biométrica'}
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${
            messageType === 'success'
              ? 'bg-green-900/50 text-green-200 border border-green-500/50'
              : messageType === 'error'
              ? 'bg-red-900/50 text-red-200 border border-red-500/50'
              : 'bg-blue-900/50 text-blue-200 border border-blue-500/50'
          }`}
        >
          {messageType === 'success' && <CheckCircle size={18} className="flex-shrink-0" />}
          {messageType === 'error' && <AlertCircle size={18} className="flex-shrink-0" />}
          {messageType === 'info' && <Loader size={18} className="flex-shrink-0 animate-spin" />}
          <span>{message}</span>
        </div>
      )}
    </div>
  );
};

export default BiometricAuthForm;
