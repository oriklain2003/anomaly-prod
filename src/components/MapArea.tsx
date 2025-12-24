import { useState } from 'react';
import { MapComponent } from './MapComponent';
import { MapControls, type MapLayer } from './MapControls';
import { Plus, Minus } from 'lucide-react';
import type { SelectedFlight } from '../types';

interface MapAreaProps {
  selectedFlight: SelectedFlight | null;
  mode?: 'live' | 'history';
  onFlightClick?: (flightId: string, isAnomaly: boolean, callsign?: string, origin?: string, destination?: string) => void;
}

export function MapArea({ selectedFlight, mode = 'history', onFlightClick }: MapAreaProps) {
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
      {/* Map Background */}
      <div className="absolute inset-0 bg-black z-0" onClick={handleMapClick}>
        {/* MapLibre Map */}
        <MapComponent 
          onMouseMove={setMouseCoords} 
          selectedFlight={selectedFlight}
          activeLayers={activeLayers}
          mode={mode}
          onFlightClick={onFlightClick}
        />
        
        {/* Grid Overlay */}
        <div className="absolute inset-0 map-grid opacity-10 pointer-events-none" />
      </div>

      {/* Map Controls - Top Right */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <MapControls 
          activeLayers={activeLayers}
          onLayerToggle={toggleLayer}
          showLayersDropdown={showLayersDropdown}
          setShowLayersDropdown={setShowLayersDropdown}
          showFiltersDropdown={showFiltersDropdown}
          setShowFiltersDropdown={setShowFiltersDropdown}
        />
        
        {/* Separator */}
        <div className="h-2" />
        
        {/* Zoom Controls */}
        <div className="flex flex-col gap-0.5">
          <button className="liquid-glass w-8 h-8 flex items-center justify-center rounded-t-md text-gray-300 hover:text-white transition-colors border-b-0">
            <Plus className="w-4 h-4" />
          </button>
          <button className="liquid-glass w-8 h-8 flex items-center justify-center rounded-b-md text-gray-300 hover:text-white transition-colors">
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Compact Flight Info Card (Top Left) */}
      {selectedFlight && (
        <div className="absolute top-4 left-4 z-20">
          <div className="liquid-glass rounded-lg p-4 w-64 text-xs shadow-[0_0_20px_rgba(99,209,235,0.4),0_0_40px_rgba(99,209,235,0.2)] border border-[#63d1eb]/30">
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-[#63d1eb]/10 border border-[#63d1eb]/40 p-2 rounded-md text-[#63d1eb]">
                <span className="material-symbols-outlined text-lg">flight</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white font-mono">
                  {selectedFlight.callsign || selectedFlight.flight_id.slice(0, 7)}
                </h2>
                <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                  <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/40">
                    ACTIVE
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-300">B738</span>
                </div>
              </div>
            </div>
            
            {/* Origin / Destination */}
            <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
              <div>
                <p className="text-[9px] text-[#63d1eb]/70 font-mono uppercase tracking-wider">Origin</p>
                <p className="text-sm font-bold text-white">{selectedFlight.origin || '---'}</p>
                <p className="text-[10px] text-gray-400 truncate">
                  {selectedFlight.origin === 'LLBG' ? 'Ben Gurion' : 
                   selectedFlight.origin === 'LCPH' ? 'Paphos Intl' : 
                   selectedFlight.origin === 'LCLK' ? 'Larnaca' : 'Unknown'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-[#63d1eb]/70 font-mono uppercase tracking-wider">Dest</p>
                <p className="text-sm font-bold text-white">{selectedFlight.destination || '---'}</p>
                <p className="text-[10px] text-gray-400 truncate">
                  {selectedFlight.destination === 'LLBG' ? 'Ben Gurion' : 
                   selectedFlight.destination === 'LCPH' ? 'Paphos Intl' : 
                   selectedFlight.destination === 'LCLK' ? 'Larnaca' : 'Unknown'}
                </p>
              </div>
            </div>
            
            {/* Flight stats */}
            <div className="mt-3 pt-2 border-t border-white/10 flex justify-between items-center text-[10px] font-mono text-gray-300">
              <span>ALT: <span className="text-[#63d1eb]">
                {selectedFlight.status?.altitude_ft?.toLocaleString() || '32,000'}ft
              </span></span>
              <span>SPD: <span className="text-[#63d1eb]">
                {selectedFlight.status?.speed_kts || '445'}kts
              </span></span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Info Bar - Coordinates (Left) */}
      <div className="absolute bottom-4 left-4 z-20">
        <div className="liquid-glass rounded-full px-4 py-2 flex items-center space-x-4 text-[10px] font-mono text-gray-300">
          <span className="text-white font-bold border-r border-white/20 pr-3 tracking-widest">MAP DATA</span>
          <span className="tabular-nums">LAT: <span className="text-[#63d1eb]">{mouseCoords.lat.toFixed(4)} N</span></span>
          <span className="tabular-nums">LON: <span className="text-[#63d1eb]">{mouseCoords.lon.toFixed(4)} E</span></span>
          <span className="tabular-nums">ELV: <span className="text-[#63d1eb]">{mouseCoords.elv}m</span></span>
        </div>
      </div>

      {/* Bottom Legend - Right */}
      <div className="absolute bottom-4 right-4 z-20">
        <div className="liquid-glass rounded-full px-4 py-2 flex items-center space-x-4 text-[10px] font-medium text-gray-300">
          {activeLayers.includes('anomalies') && (
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
              <span>Anomaly</span>
            </div>
          )}
          {activeLayers.includes('track') && (
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#63d1eb] shadow-[0_0_6px_rgba(99,209,235,0.8)]" />
              <span>Track</span>
            </div>
          )}
          {activeLayers.includes('paths') && (
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
              <span>Safe</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
