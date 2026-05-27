import React, { useState, useEffect } from 'react';
import { LogOut, Home, Plus, Search } from 'lucide-react';
import BiometricAuthForm from './components/BiometricAuthForm';
import PasswordAuthForm from './components/PasswordAuthForm';
import StellarWallet from './components/StellarWallet';
import VehicleCatalog from './components/VehicleCatalog';
import PublishForm from './PublishForm';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4000');

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [activeDialog, setActiveDialog] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [vehicles, setVehicles] = useState([]);
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('currentUser');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.username) {
          setCurrentUser(parsed);
          setView('dashboard');
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const loadVehicles = async () => {
    try {
      const res = await fetch(`${API_URL}/vehicles-catalog`);
      if (res.ok) {
        const j = await res.json();
        if (j.ok) {
          setVehicles(j.vehicles || []);
          return;
        }
      }
      
      const res2 = await fetch(`${API_URL}/vehicles`);
      const j2 = await res2.json();
      if (res2.ok && j2.ok) setVehicles(j2.vehicles || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (currentUser) loadVehicles();
  }, [currentUser]);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setView('dashboard');
    setMessage('Sesión cerrada');
    setMessageType('info');
  };

  const handleAuthSuccess = (userData) => {
    setCurrentUser(userData);
    localStorage.setItem('currentUser', JSON.stringify(userData));
    setActiveDialog(null);
    setMessage('✅ Sesión iniciada exitosamente');
    setMessageType('success');
    setView('dashboard');
  };

  const handleCreateUser = async () => {
    if (!createUsername.trim() || !createPassword.trim()) {
      setMessage('Usuario y contraseña requeridos');
      setMessageType('error');
      return;
    }

    if (createPassword.length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres');
      setMessageType('error');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: createUsername.trim(),
          password: createPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Error al crear usuario');
      }

      setMessage('✅ Usuario creado exitosamente. Inicia sesión');
      setMessageType('success');
      setCreateUsername('');
      setCreatePassword('');
      setTimeout(() => setActiveDialog(null), 1000);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
      setMessageType('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-purple-900 text-white">
      {/* Navegación */}
      <nav className="border-b border-gray-800 bg-black/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => currentUser && setView('dashboard')}>
              <div className="text-3xl">🔑</div>
              <div className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                ShareCar
              </div>
            </div>

            {currentUser ? (
              <div className="flex items-center gap-6">
                <div className="hidden sm:flex items-center gap-4">
                  <button
                    onClick={() => setView('dashboard')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${
                      view === 'dashboard' ? 'bg-cyan-600' : 'hover:bg-gray-800'
                    }`}
                  >
                    <Home size={18} /> Dashboard
                  </button>
                  <button
                    onClick={() => setView('search')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${
                      view === 'search' ? 'bg-indigo-600' : 'hover:bg-gray-800'
                    }`}
                  >
                    <Search size={18} /> Rentar
                  </button>
                  <button
                    onClick={() => setView('publish')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${
                      view === 'publish' ? 'bg-purple-600' : 'hover:bg-gray-800'
                    }`}
                  >
                    <Plus size={18} /> Publicar
                  </button>
                </div>

                <div className="h-8 w-px bg-gray-700" />

                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-300">
                    <span className="font-semibold text-white">{currentUser.username}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </nav>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!currentUser ? (
          <div className="grid lg:grid-cols-2 gap-8 items-center min-h-[600px]">
            {/* Columna Izquierda - Info */}
            <div className="space-y-8">
              <div>
                <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                  ShareCar
                </h1>
                <p className="text-xl text-gray-300">
                  Comparte vehículos de forma segura con autenticación biométrica y blockchain
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="text-2xl">🔐</div>
                  <div>
                    <h3 className="font-bold text-lg">Seguridad Biométrica</h3>
                    <p className="text-gray-400">Autenticación con huella digital o reconocimiento facial</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="text-2xl">⛓️</div>
                  <div>
                    <h3 className="font-bold text-lg">Blockchain</h3>
                    <p className="text-gray-400">Transacciones seguras en Stellar Network</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="text-2xl">💼</div>
                  <div>
                    <h3 className="font-bold text-lg">Smart Wallet</h3>
                    <p className="text-gray-400">Gestión inteligente de activos con Account Abstraction</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Columna Derecha - Auth */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-8">
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Iniciar Sesión</h2>
                  <p className="text-gray-400">Elige tu método de autenticación</p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => setActiveDialog('biometric')}
                    className="w-full px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold rounded-lg transition"
                  >
                    🔐 Usar Biometría
                  </button>
                  <button
                    onClick={() => setActiveDialog('password')}
                    className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition"
                  >
                    👤 Usar Usuario y Contraseña
                  </button>
                  <div className="text-center text-gray-500">O</div>
                  <button
                    onClick={() => setActiveDialog('create')}
                    className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-lg transition"
                  >
                    + Crear Nuevo Usuario
                  </button>
                </div>

                <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-4 text-sm text-blue-200">
                  <p>
                    ✅ <strong>WebAuthn</strong> habilitado • <strong>Stellar</strong> integrado • <strong>Account Abstraction</strong> activo
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {view === 'dashboard' && (
              <div className="space-y-8">
                <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/50 rounded-xl p-8">
                  <h2 className="text-3xl font-bold mb-2">Bienvenido, {currentUser.username} 👋</h2>
                  <p className="text-gray-300">Tu cuenta está protegida con autenticación biométrica y smart wallet</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <StellarWallet username={currentUser.username} />
                  </div>

                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-6">
                      <h3 className="text-lg font-bold mb-4">Acciones Rápidas</h3>
                      <div className="space-y-3">
                        <button
                          onClick={() => setView('search')}
                          className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition"
                        >
                          <Search className="inline mr-2" size={18} /> Buscar Vehículos
                        </button>
                        <button
                          onClick={() => setView('publish')}
                          className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition"
                        >
                          <Plus className="inline mr-2" size={18} /> Publicar Vehículo
                        </button>
                        <button className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition">
                          📊 Mis Reservas
                        </button>
                      </div>
                    </div>

                    <div className="bg-green-900/20 border border-green-500/50 rounded-xl p-6">
                      <h3 className="text-lg font-bold mb-3">🛡️ Seguridad</h3>
                      <ul className="text-sm text-green-200 space-y-2">
                        <li>✅ Biometría habilitada</li>
                        <li>✅ Wallet conectado</li>
                        <li>✅ Account Abstraction activo</li>
                        <li>✅ Blockchain verificado</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === 'search' && (
              <VehicleCatalog 
                vehicles={vehicles} 
                currentUser={currentUser.username}
                onSelectVehicle={(rental) => {
                  setMessage(`✅ Reserva confirmada: ${rental.vehicle.brand} ${rental.vehicle.model}`);
                  setMessageType('success');
                  loadVehicles();
                }}
              />
            )}

            {view === 'publish' && (
              <div className="space-y-6">
                <h2 className="text-3xl font-bold">Publicar Vehículo</h2>
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-8">
                  <PublishForm owner={currentUser.username} onPublished={() => { loadVehicles(); setView('search'); }} />
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Dialogs Modales */}
      {activeDialog === 'biometric' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-8 shadow-2xl">
            <h3 className="text-2xl font-bold mb-2">Autenticación Biométrica</h3>
            <p className="text-gray-400 mb-6">Usa tu huella digital, cara o passkey para acceder</p>
            <BiometricAuthForm
              onSuccess={handleAuthSuccess}
              onCancel={() => setActiveDialog(null)}
            />
          </div>
        </div>
      )}

      {activeDialog === 'password' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-8 shadow-2xl">
            <h3 className="text-2xl font-bold mb-2">Iniciar Sesión</h3>
            <p className="text-gray-400 mb-6">Ingresa tu usuario y contraseña</p>
            <PasswordAuthForm
              onSuccess={handleAuthSuccess}
              onCancel={() => setActiveDialog(null)}
            />
          </div>
        </div>
      )}

      {activeDialog === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-8 shadow-2xl">
            <h3 className="text-2xl font-bold mb-2">Crear Nuevo Usuario</h3>
            <p className="text-gray-400 mb-6">Regístrate para comenzar a compartir</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Usuario</label>
                <input
                  type="text"
                  placeholder="Tu nombre de usuario"
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value)}
                  disabled={busy}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-cyan-500 outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Contraseña</label>
                <input
                  type="password"
                  placeholder="Mín. 6 caracteres"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  disabled={busy}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-cyan-500 outline-none disabled:opacity-50"
                />
              </div>
              <button
                onClick={handleCreateUser}
                disabled={busy}
                className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition"
              >
                {busy ? 'Creando...' : 'Crear Usuario'}
              </button>
              <button
                onClick={() => setActiveDialog(null)}
                className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje Global */}
      {message && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg max-w-xs ${
          messageType === 'success' ? 'bg-green-600 text-white' :
          messageType === 'error' ? 'bg-red-600 text-white' :
          'bg-blue-600 text-white'
        }`}>
          {message}
        </div>
      )}
    </div>
  );
}

export default App;
