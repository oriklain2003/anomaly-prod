import { Layers } from 'lucide-react';
import clsx from 'clsx';

export type MapLayer = 'paths' | 'turns' | 'sids' | 'stars' | 'track' | 'anomalies' | 'bbox';

interface MapControlsProps {
  activeLayers: MapLayer[];
  onLayerToggle: (layer: MapLayer) => void;
  showLayersDropdown: boolean;
  setShowLayersDropdown: (show: boolean) => void;
}

const LAYER_CONFIG: { id: MapLayer; label: string; color: string }[] = [
  { id: 'track', label: 'Flight Track', color: '#06b6d4' },
  { id: 'anomalies', label: 'Anomaly Points', color: '#ef4444' },
  { id: 'paths', label: 'Learned Paths', color: '#22c55e' },
  { id: 'turns', label: 'Turn Zones', color: '#f97316' },
  { id: 'sids', label: 'SID Routes', color: '#3b82f6' },
  { id: 'stars', label: 'STAR Routes', color: '#ec4899' },
  { id: 'bbox', label: 'Training Region', color: '#fbbf24' },
];

export function MapControls({
  activeLayers,
  onLayerToggle,
  showLayersDropdown,
  setShowLayersDropdown,
}: MapControlsProps) {
  return (
    <div className="relative">
      <button
        onClick={() => {
          setShowLayersDropdown(!showLayersDropdown);
        }}
        className="px-4 py-2 bg-gray-900/90 backdrop-blur-md border border-white/10 rounded-md text-[11px] font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors shadow-lg flex items-center justify-between w-32 group"
      >
        <span>Layers</span>
        <Layers className="h-4 w-4 text-gray-500 group-hover:text-white" />
      </button>

      {/* Layers Dropdown */}
      {showLayersDropdown && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-lg shadow-xl z-30 py-2">
          {LAYER_CONFIG.map(layer => (
            <button
              key={layer.id}
              onClick={() => onLayerToggle(layer.id)}
              className={clsx(
                "w-full px-4 py-2 text-left text-xs font-medium transition-colors flex items-center justify-between gap-2",
                activeLayers.includes(layer.id)
                  ? "text-white bg-white/5"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: layer.color, opacity: activeLayers.includes(layer.id) ? 1 : 0.4 }}
                />
                <span>{layer.label}</span>
              </div>
              {activeLayers.includes(layer.id) && (
                <span className="text-[9px] text-primary uppercase font-bold">ON</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
