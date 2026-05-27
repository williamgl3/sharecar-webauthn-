import { useState } from 'react';
import React from 'react';

const API_URL = 'http://localhost:4000';

export default function PublishForm({ owner, onPublished }) {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [price, setPrice] = useState('0');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!make.trim() || !model.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, make: make.trim(), model: model.trim(), pricePerHour: Number(price), currency: 'XLM' }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'error');
      setMake(''); setModel(''); setPrice('0');
      if (onPublished) onPublished();
    } catch (err) {
      console.error(err);
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-md">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <input value={make} onChange={(e)=>setMake(e.target.value)} placeholder="Ej. Tesla" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 outline-none" />
        <input value={model} onChange={(e)=>setModel(e.target.value)} placeholder="Ej. Model 3" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 outline-none" />
      </div>
      <div className="mb-4">
        <label className="text-sm text-gray-400">Tarifa por hora</label>
        <div className="mt-2 flex gap-2">
          <div className="bg-gray-900 px-3 py-3 rounded-l border border-gray-700">XLM</div>
          <input value={price} onChange={(e)=>setPrice(e.target.value)} className="flex-1 bg-gray-800 border border-gray-700 rounded-r px-4 py-3 outline-none" />
        </div>
      </div>
      <button onClick={submit} disabled={busy} className="w-full bg-purple-600 py-3 rounded-lg font-bold">{busy ? 'Publicando...' : 'Publicar en Blockchain'}</button>
    </div>
  );
}
