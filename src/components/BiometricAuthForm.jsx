import { useState, useEffect, useRef } from 'react';
import {
  Fingerprint, Smartphone, Monitor, Shield, CheckCircle,
  Loader, AlertCircle, Eye, EyeOff, Lock, ArrowRight, ScanFace
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const STORAGE_KEY = 'shareride_passkeys';

function arrayToBase64(arr) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(arr)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getPasskeySupport() {
  if (!window.PublicKeyCredential) return 'none';
  if (window.location.protocol === 'file:') return 'file';
  return 'supported';
}

function getStoredPasskeys() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function savePasskey(credId, userName) {
  const stored = getStoredPasskeys();
  stored[credId] = { userName, createdAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

function detectDevice() {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/windows phone/.test(ua)) return 'windowsphone';
  return 'desktop';
}

function getBioLabel(deviceType, platformAuth) {
  if (deviceType === 'ios') return platformAuth ? 'Face ID / Touch ID' : 'Passkey (Face ID)';
  if (deviceType === 'android') return platformAuth ? 'Huella / PIN / Patrón' : 'Passkey biométrico';
  if (deviceType === 'desktop') return platformAuth ? 'Windows Hello / Touch ID' : 'Passkey seguro';
  return 'Passkey biométrico';
}

function getBioIcon(deviceType) {
  if (deviceType === 'ios') return <ScanFace size={24} className="text-white" />;
  if (deviceType === 'android') return <Fingerprint size={24} className="text-white" />;
  return <Fingerprint size={24} className="text-white" />;
}

function getBioHint(deviceType) {
  if (deviceType === 'ios') return 'Usa Face ID o Touch ID';
  if (deviceType === 'android') return 'Huella, patrón o PIN';
  return 'Huella, Face ID o PIN del dispositivo';
}

const BiometricAuthForm = ({ onSuccess, onCancel }) => {
  const [step, setStep] = useState('method');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [deviceType, setDeviceType] = useState('desktop');
  const [webauthnSupport, setWebauthnSupport] = useState('checking');
  const [platformAuth, setPlatformAuth] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [showPassword, setShowPassword] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [hasExistingPasskey, setHasExistingPasskey] = useState(false);
  const [authStep, setAuthStep] = useState('');
  const abortRef = useRef(null);

  useEffect(() => {
    const dt = detectDevice();
    setDeviceType(dt);

    const support = getPasskeySupport();
    if (support !== 'supported') {
      setWebauthnSupport(support);
      return;
    }

    (async () => {
      try {
        const isPlatform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setPlatformAuth(isPlatform);
      } catch { /* ignore */ }
      setWebauthnSupport('supported');
    })();
  }, []);

  useEffect(() => {
    const normalized = username.trim();
    if (!normalized) { setHasExistingPasskey(false); return; }
    const stored = getStoredPasskeys();
    setHasExistingPasskey(Object.values(stored).some((p) => p.userName === normalized));
  }, [username]);

  const cancelRequest = () => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
  };

  const validateSupport = () => {
    const s = getPasskeySupport();
    if (s === 'none') { setMessage('Este navegador no soporta passkeys'); setMessageType('error'); return false; }
    if (s === 'file') { setMessage('Abre con el servidor, no con archivo local'); setMessageType('error'); return false; }
    return true;
  };

  const handlePasskeyRegistration = async () => {
    const normalized = username.trim();
    if (!normalized) { setMessage('Escribe tu usuario primero'); setMessageType('error'); return; }
    if (!validateSupport()) return;

    setMessage('');
    setStep('registering');
    setAuthStep('Preparando registro biométrico...');
    cancelRequest();
    abortRef.current = new AbortController();

    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      crypto.getRandomValues(userId);
      const rpId = window.location.hostname || 'localhost';

      if (deviceType === 'android' || deviceType === 'ios') {
        setAuthStep('Esperando biometría del dispositivo...');
      } else {
        setAuthStep('Usa Windows Hello, Touch ID o tu método...');
      }

      const publicKey = {
        challenge,
        rp: { name: 'ShareCar', id: rpId },
        user: { id: userId, name: normalized, displayName: normalized },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        timeout: 60000,
        authenticatorSelection: {
          authenticatorAttachment: deviceType === 'desktop' ? undefined : 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
      };

      const credential = await navigator.credentials.create({
        publicKey,
        signal: abortRef.current.signal,
      });

      if (!credential) { setStep('method'); return; }

      const credId = arrayToBase64(credential.rawId);
      savePasskey(credId, normalized);
      setHasExistingPasskey(true);
      onSuccess({ username: normalized, authMethod: 'webauthn' });
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'NotAllowedError') {
        setStep('method'); return;
      }
      const msg = (err.message || '').toLowerCase();
      if (err.name === 'NotSupportedError' || msg.includes('not supported')) {
        if (deviceType === 'ios') setMessage('Face ID no disponible. Actívalo en Ajustes > Face ID');
        else if (deviceType === 'android') setMessage('Biometría no disponible. Registra huella o PIN en Ajustes');
        else setMessage('Tu dispositivo no tiene biometría configurada');
      } else {
        setMessage(err.message);
      }
      setMessageType('error');
      setStep('method');
    }
  };

  const handlePasskeyLogin = async () => {
    const normalized = username.trim();
    if (!normalized) { setMessage('Escribe tu usuario primero'); setMessageType('error'); return; }
    if (!validateSupport()) return;

    const stored = getStoredPasskeys();
    const userPasskeys = Object.entries(stored).filter(([, v]) => v.userName === normalized);
    if (userPasskeys.length === 0) {
      setMessage('No hay passkey. Regístralo primero.'); setMessageType('error'); return;
    }

    setMessage('');
    setStep('authenticating');

    if (deviceType === 'ios') setAuthStep('Face ID / Touch ID — coloca tu rostro o dedo');
    else if (deviceType === 'android') setAuthStep('Escanea tu huella o ingresa tu PIN');
    else setAuthStep('Usa Windows Hello, Touch ID o tu método...');

    cancelRequest();
    abortRef.current = new AbortController();

    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const rpId = window.location.hostname || 'localhost';

      const allowCredentials = userPasskeys.map(([id]) => {
        const b64 = id.replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return { type: 'public-key', id: bytes, transports: ['internal'] };
      });

      await navigator.credentials.get({
        publicKey: {
          challenge, rpId, allowCredentials,
          userVerification: 'required', timeout: 60000,
        },
        signal: abortRef.current.signal,
        mediation: 'optional',
      });

      onSuccess({ username: normalized, authMethod: 'webauthn' });
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'NotAllowedError') { setStep('method'); return; }
      if (deviceType === 'ios') setMessage('Face ID / Touch ID no reconoció tu rostro o dedo. Intenta de nuevo.');
      else if (deviceType === 'android') setMessage('Huella o PIN incorrecto. Intenta de nuevo.');
      else setMessage(err.message);
      setMessageType('error');
      setStep('method');
    }
  };

  const handlePasswordLogin = async () => {
    const normalized = username.trim();
    if (!normalized || !password.trim()) {
      setMessage('Usuario y contraseña requeridos'); setMessageType('error'); return;
    }
    setMessage(''); setStep('authenticating');
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: normalized, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Credenciales inválidas');
      setMessage('Sesión iniciada'); setMessageType('success');
      setTimeout(() => onSuccess({ username: normalized, authMethod: 'password' }), 800);
    } catch (error) {
      setMessage(error.message); setMessageType('error'); setStep('method');
    }
  };

  const handleCreateAccount = async () => {
    const normalized = username.trim();
    if (!normalized || !password.trim()) {
      setMessage('Usuario y contraseña requeridos'); setMessageType('error'); return;
    }
    if (password.length < 6) { setMessage('Contraseña mínimo 6 caracteres'); setMessageType('error'); return; }
    setIsCreatingAccount(true); setMessage('');
    try {
      const res = await fetch(`${API_URL}/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: normalized, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error al crear usuario');
      setMessage('Cuenta creada'); setMessageType('success');
      setTimeout(() => onSuccess({ username: normalized, authMethod: 'password' }), 800);
    } catch (error) {
      setMessage(error.message); setMessageType('error');
    } finally { setIsCreatingAccount(false); }
  };

  const normalized = username.trim();
  const supportLabel = webauthnSupport === 'supported';
  const bioLabel = getBioLabel(deviceType, platformAuth);

  return (
    <div className="w-full max-w-xs sm:max-w-sm mx-auto space-y-3">
      {/* Header */}
      <div className="flex flex-col items-center text-center pb-1">
        <div className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 ring-1 ring-cyan-500/30">
          <Fingerprint size={24} className="text-cyan-400" />
        </div>
        <h2 className="text-lg font-bold text-white sm:text-xl">Acceso biométrico</h2>
        <p className="mt-0.5 text-xs text-gray-400 sm:text-sm">{getBioHint(deviceType)}</p>
      </div>

      {/* Badges */}
      {webauthnSupport !== 'checking' && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
            {deviceType !== 'desktop' ? <Smartphone size={12} /> : <Monitor size={12} />}
            {deviceType === 'ios' ? 'iPhone' : deviceType === 'android' ? 'Android' : 'Escritorio'}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
            <Shield size={12} />
            {supportLabel ? 'Biometría lista' : 'No compatible'}
          </span>
          {hasExistingPasskey && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
              <CheckCircle size={12} />
              Passkey listo
            </span>
          )}
        </div>
      )}

      {step === 'method' && (
        <div className="space-y-2.5">
          {/* Username */}
          <input
            type="text"
            placeholder="Tu nombre de usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-xl border border-gray-600 bg-gray-900/70 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50"
            autoFocus
          />

          {/* Passkey Login */}
          {normalized && hasExistingPasskey && (
            <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-600/5 p-2.5 sm:p-3">
              <button
                onClick={handlePasskeyLogin}
                className="group flex w-full items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-700 px-4 py-3 text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-500 hover:to-blue-600 active:scale-[0.97]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    {getBioIcon(deviceType)}
                  </div>
                  <div className="text-left min-w-0">
                    <div className="text-sm font-bold leading-tight truncate">Entrar con {bioLabel}</div>
                    <div className="text-[11px] text-white/70 truncate">Toque para autenticarse</div>
                  </div>
                </div>
                <ArrowRight size={18} className="shrink-0 text-white/50 transition group-hover:translate-x-0.5" />
              </button>
            </div>
          )}

          {/* Passkey Register */}
          {normalized && !hasExistingPasskey && (
            <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-indigo-600/5 p-2.5 sm:p-3">
              <button
                onClick={handlePasskeyRegistration}
                className="group flex w-full items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-700 px-4 py-3 text-white shadow-lg shadow-purple-500/20 transition hover:from-purple-500 hover:to-indigo-600 active:scale-[0.97]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    {getBioIcon(deviceType)}
                  </div>
                  <div className="text-left min-w-0">
                    <div className="text-sm font-bold leading-tight truncate">Registrar {bioLabel}</div>
                    <div className="text-[11px] text-white/70 truncate">Configura tu acceso biométrico</div>
                  </div>
                </div>
                <ArrowRight size={18} className="shrink-0 text-white/50 transition group-hover:translate-x-0.5" />
              </button>
            </div>
          )}

          {/* Password */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-3">
            <div className="flex items-center gap-2 mb-2">
              <Lock size={13} className="text-gray-500" />
              <span className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                {normalized ? 'O entra con contraseña' : 'Inicia con contraseña'}
              </span>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (normalized ? handlePasswordLogin() : handleCreateAccount())}
                className="w-full rounded-xl border border-gray-600 bg-gray-900/70 px-3 py-2.5 pr-9 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-cyan-500"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                type="button"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {normalized && !hasExistingPasskey ? (
              <button
                onClick={handleCreateAccount}
                disabled={isCreatingAccount || !normalized || password.length < 6}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-500 hover:to-teal-600 active:scale-[0.97] disabled:from-gray-600 disabled:to-gray-600 disabled:shadow-none disabled:opacity-50"
              >
                {isCreatingAccount ? <Loader size={15} className="animate-spin" /> : <Shield size={15} />}
                <span>{isCreatingAccount ? 'Creando...' : 'Crear cuenta nueva'}</span>
              </button>
            ) : (
              <button
                onClick={handlePasswordLogin}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700 active:scale-[0.97]"
              >
                <Lock size={15} />
                <span>Entrar con contraseña</span>
              </button>
            )}
          </div>

          {/* Cancel */}
          <button
            onClick={onCancel}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-gray-400 transition hover:bg-white/10 hover:text-gray-200 active:scale-[0.97]"
          >
            Cancelar
          </button>

          {/* Info */}
          <div className="rounded-xl border border-green-500/15 bg-green-500/5 p-3">
            <p className="mb-1.5 text-[11px] font-bold tracking-wider text-green-400 uppercase">¿Passkey?</p>
            <p className="mb-2 text-[11px] leading-relaxed text-gray-400">
              Usa la biometría de tu dispositivo en lugar de contraseñas. Se sincroniza entre dispositivos.
            </p>
            <div className="grid grid-cols-2 gap-1 text-[11px] text-gray-500">
              <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">Sin contraseñas</div>
              <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">Seguridad máxima</div>
              <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">Entrada automática</div>
              <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">Multi-dispositivo</div>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {(step === 'registering' || step === 'authenticating') && (
        <div className="flex flex-col items-center justify-center py-6">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 ring-1 ring-cyan-500/30">
            {deviceType === 'ios' ? (
              <ScanFace size={28} className="text-cyan-400 animate-pulse" />
            ) : (
              <Fingerprint size={28} className="text-cyan-400 animate-pulse" />
            )}
          </div>
          <p className="text-sm font-bold text-white">
            {step === 'registering' ? 'Registrando passkey...' : 'Autenticando...'}
          </p>
          {authStep && (
            <p className="mt-1.5 text-xs text-gray-400 text-center max-w-[200px]">{authStep}</p>
          )}
          <p className="mt-4 text-[11px] text-gray-600">Sigue las instrucciones en pantalla</p>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ${
          messageType === 'success'
            ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
            : messageType === 'error'
            ? 'border border-red-500/40 bg-red-500/10 text-red-200'
            : 'border border-blue-500/40 bg-blue-500/10 text-blue-200'
        }`}>
          {messageType === 'success' && <CheckCircle size={15} className="mt-0.5 shrink-0" />}
          {messageType === 'error' && <AlertCircle size={15} className="mt-0.5 shrink-0" />}
          {messageType === 'info' && <Loader size={15} className="mt-0.5 shrink-0 animate-spin" />}
          <span>{message}</span>
        </div>
      )}
    </div>
  );
};

export default BiometricAuthForm;
