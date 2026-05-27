import React, { useState, useEffect } from 'react';
import { Wallet, Copy, ExternalLink, Loader, AlertCircle } from 'lucide-react';

export default function StellarWallet({ username }) {
  const [walletAddress, setWalletAddress] = useState('');
  const [balance, setBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Generate or retrieve wallet address from localStorage
    const storedWallet = localStorage.getItem(`wallet_${username}`);
    if (storedWallet) {
      setWalletAddress(storedWallet);
      loadBalance(storedWallet);
    } else {
      generateWallet();
    }
  }, [username]);

  const generateWallet = () => {
    // Generate a mock Stellar address (in production, use Stellar SDK)
    const address = `G${Math.random().toString(36).substring(2, 58).toUpperCase()}`;
    localStorage.setItem(`wallet_${username}`, address);
    setWalletAddress(address);
    // In production, fetch real balance from Stellar Horizon API
    setBalance('1000'); // Mock balance for demo
  };

  const loadBalance = (address) => {
    // In production, call Stellar Horizon API
    // For demo, use mock data
    setBalance('1000');
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/50 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="text-purple-400" size={24} />
          <h3 className="text-xl font-bold text-white">Stellar Wallet</h3>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Dirección de Wallet</p>
            <div className="flex items-center gap-2 bg-gray-800/50 border border-gray-700 rounded-lg p-3">
              <code className="text-sm text-cyan-400 font-mono flex-1 truncate">{walletAddress || 'Generando...'}</code>
              <button
                onClick={copyAddress}
                className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition"
                title="Copiar"
              >
                <Copy size={18} />
              </button>
              {copied && <span className="text-xs text-green-400">¡Copiado!</span>}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Saldo</p>
            <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
              {balance} XLM
            </div>
            <p className="text-xs text-gray-500 mt-1">Stellar Lumens</p>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <button className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition">
              Recibir
            </button>
            <button className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-sm transition">
              Enviar
            </button>
          </div>
        </div>
      </div>

      <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
        <div className="flex gap-2 items-start">
          <AlertCircle size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-200">
            <p className="font-semibold mb-1">Account Abstraction Habilitado</p>
            <p className="text-xs text-blue-300">
              Tu cuenta utiliza smart contracts para transacciones seguras y gestión simplificada de activos.
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-green-900/30 border border-green-500/50 rounded-lg text-green-200 text-sm">
          {message}
        </div>
      )}
    </div>
  );
}
