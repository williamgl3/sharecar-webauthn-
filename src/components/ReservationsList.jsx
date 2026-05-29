import { useState, useEffect, useCallback } from 'react';
import { Calendar, MapPin, Star, Clock, AlertCircle, XCircle, CheckCircle2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function ReservationsList({ username }) {
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState(null);

  const loadRentals = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/rentals/${encodeURIComponent(username)}`);
      const data = await res.json();
      if (res.ok && data.ok) setRentals(data.rentals || []);
    } catch (e) {
      console.error('Error loading rentals:', e);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadRentals();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadRentals]);

  const handleCancelRental = async (rentalId) => {
    const confirmed = window.confirm('¿Cancelar esta reservación? Esta acción cambiará su estado a cancelada.');
    if (!confirmed) return;

    setCancelingId(rentalId);
    try {
      const response = await fetch(`${API_URL}/rentals/${encodeURIComponent(rentalId)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo cancelar la reservación');
      }

      setRentals((current) => current.map((rental) => (rental.id === rentalId ? { ...rental, status: 'canceled', canceledAt: data.rental.canceledAt } : rental)));
    } catch (error) {
      alert(error.message);
    } finally {
      setCancelingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (rentals.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 text-lg">No tienes reservas aún</p>
        <p className="text-gray-500 text-sm mt-2">Busca vehículos y reserva tu primer viaje</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rentals.map((rental) => {
        const v = rental.vehicle || {};
        const isCanceled = rental.status === 'canceled';
        return (
          <div key={rental.id} className={`bg-gradient-to-br ${isCanceled ? 'from-gray-900 to-gray-950 border-gray-800' : 'from-gray-800 to-gray-900 border-gray-700'} rounded-xl p-5 hover:border-cyan-500/50 transition`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-xl font-bold text-white">{v.brand || 'Vehículo'} {v.model || ''}</h3>
                <p className="text-sm text-gray-400 mt-1">{v.description || ''}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${isCanceled ? 'bg-red-600/20 text-red-300 border-red-500/30' : 'bg-green-600/20 text-green-400 border-green-500/30'}`}>
                {isCanceled ? 'Cancelada' : rental.status === 'booked' ? 'Activa' : rental.status}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <Calendar size={14} />
                  <span className="text-xs">Fecha</span>
                </div>
                <p className="text-cyan-300 font-semibold text-xs">
                  {new Date(rental.rentalDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <MapPin size={14} />
                  <span className="text-xs">Ubicación</span>
                </div>
                <p className="text-cyan-300 font-semibold text-xs truncate">{v.location || 'No especificada'}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <Clock size={14} />
                  <span className="text-xs">Tarifa</span>
                </div>
                <p className="text-cyan-300 font-semibold text-xs">${v.pricePerHour || 0}/h</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <Star size={14} />
                  <span className="text-xs">Valoración</span>
                </div>
                <p className="text-cyan-300 font-semibold text-xs">{'⭐'.repeat(Math.round(v.rating || 0)) || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <AlertCircle size={12} />
              <span>Reserva #{rental.id.slice(0, 8)}</span>
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              {isCanceled ? (
                <div className="flex items-center gap-2 text-sm text-red-300 bg-red-900/20 border border-red-500/20 rounded-lg px-3 py-2">
                  <CheckCircle2 size={16} />
                  <span>Reservación cancelada</span>
                </div>
              ) : (
                <button
                  onClick={() => handleCancelRental(rental.id)}
                  disabled={cancelingId === rental.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                >
                  <XCircle size={16} />
                  {cancelingId === rental.id ? 'Cancelando...' : 'Cancelar reservación'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
