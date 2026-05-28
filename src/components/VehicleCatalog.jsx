import { useState } from 'react';
import { Star, MapPin, Zap, Users, Calendar, ChevronRight } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:4000');

export default function VehicleCatalog({ vehicles, onSelectVehicle, currentUser }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [filterBrand, setFilterBrand] = useState('All');
  const [priceRange, setPriceRange] = useState([0, 100]);
  const [sortBy, setSortBy] = useState('rating');

  // Get unique brands
  const brands = ['All', ...new Set(vehicles.map(v => v.brand))];

  // Filter and sort vehicles
  const filteredVehicles = vehicles
    .filter(v => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = (v.model || '').toLowerCase().includes(search) ||
                           (v.brand || '').toLowerCase().includes(search) ||
                           (v.description || '').toLowerCase().includes(search);
      const matchesBrand = filterBrand === 'All' || v.brand === filterBrand;
      const matchesPrice = (v.pricePerHour || 0) >= priceRange[0] && (v.pricePerHour || 0) <= priceRange[1];
      return matchesSearch && matchesBrand && matchesPrice;
    })
    .sort((a, b) => {
      if (sortBy === 'price-low') return (a.pricePerHour || 0) - (b.pricePerHour || 0);
      if (sortBy === 'price-high') return (b.pricePerHour || 0) - (a.pricePerHour || 0);
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'reviews') return (b.reviews || 0) - (a.reviews || 0);
      return 0;
    });

  const handleRentClick = (vehicle) => {
    setSelectedVehicle(vehicle);
  };

  const [renting, setRenting] = useState(false);

  const confirmRental = async () => {
    if (!currentUser) {
      alert('Por favor, inicia sesión primero');
      return;
    }

    const rentalData = {
      vehicleId: selectedVehicle.id,
      vehicle: selectedVehicle,
      userId: currentUser,
      rentalDate: new Date().toISOString(),
      status: 'booked'
    };

    setRenting(true);
    try {
      const response = await fetch(`${API_URL}/rentals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rentalData)
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        const payMsg = data.paymentAmount ? `\nPago: ${data.paymentAmount} XLM descontados` : '';
        alert(`✅ ¡Vehículo reservado!\n\nVehículo: ${selectedVehicle.brand} ${selectedVehicle.model}\nTarifa: $${selectedVehicle.pricePerHour}/hora${payMsg}`);
        setSelectedVehicle(null);
        onSelectVehicle?.(rentalData);
      } else {
        alert(data.error || 'Error al reservar el vehículo');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al conectar con el servidor');
    } finally {
      setRenting(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">🚗 Catálogo de Vehículos</h1>
        <p className="text-gray-400">Descubre nuestro amplio catálogo de vehículos eléctricos de lujo</p>
      </div>

      {/* Filters & Search */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Buscar marca, modelo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-cyan-500 outline-none"
          />

          {/* Brand Filter */}
          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-cyan-500 outline-none"
          >
            {brands.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>

          {/* Price Range */}
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              value={priceRange[1]}
              onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
              className="w-full h-2 bg-gray-700 rounded cursor-pointer"
            />
            <span className="text-white text-sm whitespace-nowrap">${priceRange[1]}</span>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-cyan-500 outline-none"
          >
            <option value="rating">⭐ Mejor valorados</option>
            <option value="reviews">💬 Más reseñas</option>
            <option value="price-low">💰 Precio menor</option>
            <option value="price-high">💎 Precio mayor</option>
          </select>

          {/* Results Count */}
          <div className="flex items-center justify-center px-4 py-2 bg-cyan-900 rounded text-cyan-200 font-semibold">
            {filteredVehicles.length} vehículos
          </div>
        </div>
      </div>

      {/* Vehicle Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {filteredVehicles.length > 0 ? (
          filteredVehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg overflow-hidden border border-gray-700 hover:border-cyan-500 transition-all hover:shadow-lg hover:shadow-cyan-500/20 cursor-pointer transform hover:scale-105"
            >
              {/* Image */}
              <div className="bg-gradient-to-r from-gray-700 to-gray-800 h-48 flex items-center justify-center overflow-hidden">
                <img 
                  src={vehicle.image} 
                  alt={`${vehicle.brand} ${vehicle.model}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23374151" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="48" fill="%239CA3AF"%3E🚗%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>

              {/* Content */}
              <div className="p-5">
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-white">{vehicle.brand}</h3>
                    <p className="text-gray-400 text-sm">{vehicle.model}</p>
                  </div>
                  <span className="bg-purple-600 px-3 py-1 rounded text-white text-sm font-semibold">{vehicle.year}</span>
                </div>

                {/* Rating & Reviews */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-white font-semibold">{vehicle.rating}</span>
                  </div>
                  <span className="text-gray-500 text-sm">({vehicle.reviews} reseñas)</span>
                </div>

                {/* Description */}
                <p className="text-gray-300 text-sm mb-3 line-clamp-2">{vehicle.description}</p>

                {/* Features */}
                <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Users className="w-4 h-4" />
                    <span>{vehicle.seats} asientos</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Zap className="w-4 h-4" />
                    <span>{vehicle.range}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{vehicle.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>{vehicle.transmission}</span>
                  </div>
                </div>

                {/* Price & Button */}
                <div className="flex items-center justify-between bg-gray-700 rounded-lg p-3">
                  <div>
                    <p className="text-gray-400 text-xs">Tarifa</p>
                    <p className="text-2xl font-bold text-cyan-400">${vehicle.pricePerHour}/h</p>
                  </div>
                  <button
                    onClick={() => handleRentClick(vehicle)}
                    className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white px-4 py-2 rounded font-semibold flex items-center gap-2 transition-all"
                  >
                    Rentar <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-gray-400 text-lg">No se encontraron vehículos</p>
          </div>
        )}
      </div>

      {/* Modal de Confirmación */}
      {selectedVehicle && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg max-w-md w-full border border-cyan-500 shadow-2xl shadow-cyan-500/20">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Confirmar Reserva</h2>
              
              <div className="bg-gray-700 rounded-lg overflow-hidden mb-6">
                <img 
                  src={selectedVehicle.image}
                  alt={`${selectedVehicle.brand} ${selectedVehicle.model}`}
                  className="w-full h-64 object-cover"
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23374151" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="48" fill="%239CA3AF"%3E🚗%3C/text%3E%3C/svg%3E';
                  }}
                />
                <div className="p-4">
                  <h3 className="text-xl font-bold text-white mb-2">{selectedVehicle.brand} {selectedVehicle.model}</h3>
                  <p className="text-gray-400 mb-4">{selectedVehicle.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4 text-sm px-4 pb-4">
                  <div className="bg-gray-800 rounded p-2">
                    <p className="text-gray-400">Tarifa/Hora</p>
                    <p className="text-cyan-400 font-bold">${selectedVehicle.pricePerHour}</p>
                  </div>
                  <div className="bg-gray-800 rounded p-2">
                    <p className="text-gray-400">Asientos</p>
                    <p className="text-cyan-400 font-bold">{selectedVehicle.seats}</p>
                  </div>
                  <div className="bg-gray-800 rounded p-2">
                    <p className="text-gray-400">Autonomía</p>
                    <p className="text-cyan-400 font-bold">{selectedVehicle.range}</p>
                  </div>
                  <div className="bg-gray-800 rounded p-2">
                    <p className="text-gray-400">Valoración</p>
                    <p className="text-yellow-400 font-bold">⭐ {selectedVehicle.rating}</p>
                  </div>
                </div>

                <div className="bg-gray-800 rounded p-2 text-sm mx-4 mb-4">
                  <p className="text-gray-400">Ubicación</p>
                  <p className="text-gray-200">{selectedVehicle.location}</p>
                </div>
              </div>

              <p className="text-gray-300 text-sm mb-6">
                ¿Deseas reservar este vehículo? Se te cobrarán <span className="text-cyan-400 font-bold">${selectedVehicle.pricePerHour} por cada hora</span> de alquiler.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedVehicle(null)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmRental}
                  disabled={renting}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 text-white px-4 py-2 rounded font-semibold transition-all"
                >
                  {renting ? '⏳ Procesando pago...' : '✅ Confirmar Reserva'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
