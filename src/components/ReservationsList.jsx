import { useState, useEffect } from 'react';
import { Calendar, MapPin, Star, Clock, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4000');

export default function ReservationsList({ username }) {
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/rentals/${encodeURIComponent(username)}`);
        const data = await res.json();
        if (res.ok && data.ok) setRentals(data.rentals || []);
      } catch (e) {
        console.error('Error loading rentals:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [username]);

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
        return (
          <div key={rental.id} className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-5 hover:border-cyan-500/50 transition">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-xl font-bold text-white">{v.brand || 'Vehículo'} {v.model || ''}</h3>
                <p className="text-sm text-gray-400 mt-1">{v.description || ''}</p>
              </div>
              <span className="bg-green-600/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-full text-xs font-semibold">
                {rental.status === 'booked' ? 'Activa' : rental.status}
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
          </div>
        );
      })}
    </div>
  );
}
