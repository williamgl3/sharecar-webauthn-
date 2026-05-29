import { useState } from 'react';
import { Lock, Mail, AlertCircle, Loader } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function PasswordAuthForm({ onSuccess, onCancel }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setMessage('Usuario y contraseña requeridos');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        setMessage('✅ Inicio de sesión exitoso');
        setTimeout(() => {
          onSuccess({ username: username.trim(), authMethod: 'password' });
        }, 800);
      } else {
        setMessage(data.error || 'Credenciales inválidas');
      }
    } catch (err) {
      setMessage('Error de conexión: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-200 mb-2">Usuario</label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 text-gray-500" size={20} />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Tu usuario"
            disabled={loading}
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-200 mb-2">Contraseña</label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 text-gray-500" size={20} />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
            disabled={loading}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
          />
        </div>
      </div>

      <button
        onClick={handleLogin}
        disabled={loading || !username.trim() || !password.trim()}
        className="w-full px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition"
      >
        {loading ? <Loader size={20} className="animate-spin" /> : <Lock size={20} />}
        {loading ? 'Iniciando...' : 'Iniciar Sesión'}
      </button>

      <button
        onClick={onCancel}
        disabled={loading}
        className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold"
      >
        Cancelar
      </button>

      {message && (
        <div
          className={`p-3 rounded-lg flex items-center gap-2 ${
            message.includes('✅')
              ? 'bg-green-900/30 border border-green-500 text-green-200'
              : 'bg-red-900/30 border border-red-500 text-red-200'
          }`}
        >
          <AlertCircle size={20} />
          <span className="text-sm">{message}</span>
        </div>
      )}
    </div>
  );
}
