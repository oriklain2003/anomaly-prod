import { useState } from 'react';
import { MapComponent } from './MapComponent';
import { MapControls, type MapLayer } from './MapControls';
import { Plus, Minus } from 'lucide-react';
import type { SelectedFlight } from '../types';

interface MapAreaProps {
  selectedFlight: SelectedFlight | null;
}

export function MapArea({ selectedFlight }: MapAreaProps) {
  const [mouseCoords, setMouseCoords] = useState({ lat: 32.4412, lon: 35.8912, elv: 890 });
  const [activeLayers, setActiveLayers] = useState<MapLayer[]>(['track', 'anomalies']);
  const [showLayersDropdown, setShowLayersDropdown] = useState(false);
  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false);

  const toggleLayer = (layer: MapLayer) => {
    setActiveLayers(prev =>
      prev.includes(layer)
        ? prev.filter(l => l !== layer)
        : [...prev, layer]
    );
  };

  // Close dropdowns when clicking on map
  const handleMapClick = () => {
    setShowLayersDropdown(false);
    setShowFiltersDropdown(false);
  };

  return (
    <>
      {/* Scan Line Animation */}
      <div className="scan-line" />

      {/* Map Background */}
      <div className="absolute inset-0 bg-black z-0" onClick={handleMapClick}>
        {/* MapLibre Map */}
        <MapComponent 
          onMouseMove={setMouseCoords} 
          selectedFlight={selectedFlight}
          activeLayers={activeLayers}
        />
        
        {/* Grid Overlay */}
        <div className="absolute inset-0 map-grid opacity-10 pointer-events-none" />
      </div>

      {/* Map Controls - Top Right */}
      <div className="absolute top-6 right-6 z-20 flex flex-col gap-3">
        <MapControls 
          activeLayers={activeLayers}
          onLayerToggle={toggleLayer}
          showLayersDropdown={showLayersDropdown}
          setShowLayersDropdown={setShowLayersDropdown}
          showFiltersDropdown={showFiltersDropdown}
          setShowFiltersDropdown={setShowFiltersDropdown}
        />
        
        {/* Separator */}
        <div className="h-px bg-white/5 w-full my-1" />
        
        {/* Zoom Controls */}
        <div className="flex gap-1 justify-end">
          <button className="p-2 bg-gray-900/90 backdrop-blur-md border border-white/10 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors shadow-lg">
            <Plus className="h-[18px] w-[18px]" />
          </button>
          <button className="p-2 bg-gray-900/90 backdrop-blur-md border border-white/10 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors shadow-lg">
            <Minus className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {/* Selected Flight Info Bar (when a flight is selected) */}
      {selectedFlight && (
        <div className="absolute top-6 left-6 z-20">
          <div className="bg-black/90 backdrop-blur-md border border-primary/30 rounded-lg px-4 py-3 shadow-lg min-w-[200px]">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary text-lg">flight</span>
              <span className="text-sm font-mono font-bold text-white">
                {selectedFlight.callsign || selectedFlight.flight_id}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
              <div>
                <span className="text-gray-500">From:</span>
                <span className="text-gray-300 ml-1 font-mono">{selectedFlight.origin || '---'}</span>
              </div>
              <div>
                <span className="text-gray-500">To:</span>
                <span className="text-gray-300 ml-1 font-mono">{selectedFlight.destination || '---'}</span>
              </div>
              {selectedFlight.status && (
                <>
                  <div>
                    <span className="text-gray-500">Alt:</span>
                    <span className="text-cyan-400 ml-1 font-mono">{selectedFlight.status.altitude_ft?.toLocaleString() || '---'} ft</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Spd:</span>
                    <span className="text-yellow-400 ml-1 font-mono">{selectedFlight.status.speed_kts || '---'} kts</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Info Bar - Coordinates */}
      <div className="absolute bottom-6 left-6 font-mono text-[10px] text-gray-500 flex items-center gap-4 bg-black/80 p-2 px-4 rounded-full backdrop-blur-md border border-white/10 shadow-lg">
        <span className="text-gray-400 font-bold">MAP DATA</span>
        <span className="w-px h-3 bg-white/10" />
        <span className="text-gray-400">LAT: {mouseCoords.lat.toFixed(4)} N</span>
        <span className="text-gray-400">LON: {mouseCoords.lon.toFixed(4)} E</span>
        <span className="text-gray-400">ELV: {mouseCoords.elv}m</span>
      </div>

      {/* Bottom Legend - Right */}
      <div className="absolute bottom-6 right-6 z-20">
        <div className="bg-black/80 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full shadow-lg flex gap-4">
          {activeLayers.includes('anomalies') && (
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
              <span>Anomaly</span>
            </div>
          )}
          {activeLayers.includes('track') && (
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.5)]" />
              <span>Track</span>
            </div>
          )}
          {activeLayers.includes('paths') && (
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Paths</span>
            </div>
          )}
          {activeLayers.includes('turns') && (
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span>Turns</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
