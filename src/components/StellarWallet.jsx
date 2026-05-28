import { useState, useEffect, useCallback } from 'react';
import { Wallet, Copy, ExternalLink, RefreshCw, AlertCircle, Loader } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4000');

export default function StellarWallet({ username }) {
  const [walletAddress, setWalletAddress] = useState('');
  const [balances, setBalances] = useState([]);
  const [xlmBalance, setXlmBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [funding, setFunding] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [copied, setCopied] = useState(false);

  const loadWallet = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/wallet/${encodeURIComponent(username)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok) return;
      setWalletAddress(data.publicKey);
      setBalances(data.balances || []);
      const xlm = (data.balances || []).find(b => b.asset_type === 'native');
      setXlmBalance(xlm ? xlm.balance : '0');
    } catch (e) {
      console.error('Wallet load error:', e);
    }
  }, [username]);

  useEffect(() => { loadWallet(); }, [loadWallet]);

  const handleRefresh = async () => {
    setLoading(true);
    setMessage('');
    await loadWallet();
    setLoading(false);
    setMessage('Saldo actualizado');
    setMessageType('info');
    setTimeout(() => setMessage(''), 2000);
  };

  const handleFund = async () => {
    setFunding(true);
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/wallet/fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage('✅ Wallet financiada con 10,000 XLM de prueba');
        setMessageType('success');
        await loadWallet();
      } else {
        setMessage(`❌ ${data.error || 'Error al financiar'}`);
        setMessageType('error');
      }
    } catch {
      setMessage('❌ Error de conexión');
      setMessageType('error');
    } finally {
      setFunding(false);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="text-purple-400" size={24} />
            <h3 className="text-xl font-bold text-white">Stellar Wallet</h3>
          </div>
          <button onClick={handleRefresh} disabled={loading} className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-cyan-400 transition" title="Actualizar saldo">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Dirección de Wallet (Testnet)</p>
            <div className="flex items-center gap-2 bg-gray-800/50 border border-gray-700 rounded-lg p-3">
              <code className="text-sm text-cyan-400 font-mono flex-1 truncate">{walletAddress || 'Cargando...'}</code>
              {walletAddress && (
                <>
                  <button onClick={copyAddress} className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition" title="Copiar">
                    <Copy size={18} />
                  </button>
                  <a href={`https://stellar.expert/explorer/testnet/account/${walletAddress}`} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition" title="Ver en explorador">
                    <ExternalLink size={18} />
                  </a>
                </>
              )}
              {copied && <span className="text-xs text-green-400">¡Copiado!</span>}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Saldo</p>
            <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
              {Number(xlmBalance).toLocaleString('es-ES', { minimumFractionDigits: 2 })} XLM
            </div>
            <p className="text-xs text-gray-500 mt-1">Stellar Lumens - Testnet</p>
            {balances.filter(b => b.asset_type !== 'native').length > 0 && (
              <div className="mt-2 text-xs text-gray-400">
                {balances.filter(b => b.asset_type !== 'native').map((b, i) => (
                  <div key={i}>{Number(b.balance).toLocaleString()} {b.asset_code}</div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <button onClick={handleFund} disabled={funding} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white rounded-lg font-semibold text-sm transition flex items-center justify-center gap-2">
              {funding ? <Loader size={16} className="animate-spin" /> : null}
              {funding ? 'Financiando...' : '💰 Fondear Wallet'}
            </button>
            <a href={`https://stellar.expert/explorer/testnet/account/${walletAddress}`} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-sm transition flex items-center justify-center gap-2 text-center">
              <ExternalLink size={16} /> Explorador
            </a>
          </div>
        </div>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-4">
        <div className="flex gap-2 items-start">
          <AlertCircle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-200">
            <p className="font-semibold mb-1">Red de Prueba (Testnet)</p>
            <p className="text-xs text-yellow-300">
              Esta wallet usa la Stellar Testnet. Usa "Fondear Wallet" para recibir XLM de prueba gratuitos. Las reservas descontarán XLM automáticamente de tu saldo.
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          messageType === 'success' ? 'bg-green-900/30 border border-green-500/50 text-green-200' :
          messageType === 'error' ? 'bg-red-900/30 border border-red-500/50 text-red-200' :
          'bg-blue-900/30 border border-blue-500/50 text-blue-200'
        }`}>
          {message}
        </div>
      )}
    </div>
  );
}
