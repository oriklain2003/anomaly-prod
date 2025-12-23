import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { RouteWaypoint, FlightConflict, Airport, ApproachLine } from '../types';
import { Trash2, Plus, Navigation, Plane } from 'lucide-react';
import clsx from 'clsx';

interface RouteDrawMapProps {
  waypoints: RouteWaypoint[];
  onWaypointsChange: (waypoints: RouteWaypoint[]) => void;
  conflicts?: FlightConflict[];
  airports?: Airport[];
  approachLines?: ApproachLine[];
  isDrawing: boolean;
  onDrawingToggle: (drawing: boolean) => void;
}

// Generate unique ID for waypoints
const generateId = () => Math.random().toString(36).substring(2, 9);

export function RouteDrawMap({
  waypoints,
  onWaypointsChange,
  conflicts = [],
  airports = [],
  approachLines = [],
  isDrawing,
  onDrawingToggle,
}: RouteDrawMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lon: number } | null>(null);
  const apiKey = 'r7kaQpfNDVZdaVp23F1r';

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/darkmatter/style.json?key=${apiKey}`,
      center: [35.3, 32.4],
      zoom: 7,
      attributionControl: false,
    });

    map.current.on('load', () => {
      if (!map.current) return;

      // Route line source
      map.current.addSource('route-line', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Route line glow
      map.current.addLayer({
        id: 'route-line-glow',
        type: 'line',
        source: 'route-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#06b6d4',
          'line-width': 8,
          'line-opacity': 0.3,
          'line-blur': 3,
        },
      });

      // Route line
      map.current.addLayer({
        id: 'route-line-main',
        type: 'line',
        source: 'route-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#06b6d4',
          'line-width': 3,
          'line-opacity': 0.9,
        },
      });

      // Conflict points source
      map.current.addSource('conflict-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Conflict points layer
      map.current.addLayer({
        id: 'conflict-points-layer',
        type: 'circle',
        source: 'conflict-points',
        paint: {
          'circle-radius': 8,
          'circle-color': '#ef4444',
          'circle-opacity': 0.8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Conflict pulse animation
      map.current.addLayer({
        id: 'conflict-points-pulse',
        type: 'circle',
        source: 'conflict-points',
        paint: {
          'circle-radius': 15,
          'circle-color': '#ef4444',
          'circle-opacity': 0.3,
        },
      });

      // Airport markers source
      map.current.addSource('airports', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Airport markers layer
      map.current.addLayer({
        id: 'airports-layer',
        type: 'circle',
        source: 'airports',
        paint: {
          'circle-radius': 6,
          'circle-color': '#f59e0b',
          'circle-opacity': 0.7,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Airport labels
      map.current.addLayer({
        id: 'airports-labels',
        type: 'symbol',
        source: 'airports',
        layout: {
          'text-field': ['get', 'code'],
          'text-offset': [0, -1.2],
          'text-size': 10,
          'text-anchor': 'bottom',
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#f59e0b',
          'text-halo-color': '#000000',
          'text-halo-width': 2,
        },
      });

      // Runway approach lines source
      map.current.addSource('approach-lines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Runway approach lines - glow
      map.current.addLayer({
        id: 'approach-lines-glow',
        type: 'line',
        source: 'approach-lines',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#a855f7',
          'line-width': 6,
          'line-opacity': 0.2,
          'line-blur': 2,
        },
      });

      // Runway approach lines - main
      map.current.addLayer({
        id: 'approach-lines-main',
        type: 'line',
        source: 'approach-lines',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#a855f7',
          'line-width': 2,
          'line-opacity': 0.7,
          'line-dasharray': [4, 2],
        },
      });

      // Runway threshold markers source
      map.current.addSource('runway-thresholds', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Runway threshold markers
      map.current.addLayer({
        id: 'runway-thresholds-layer',
        type: 'circle',
        source: 'runway-thresholds',
        paint: {
          'circle-radius': 5,
          'circle-color': '#a855f7',
          'circle-opacity': 0.9,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Runway labels
      map.current.addLayer({
        id: 'runway-labels',
        type: 'symbol',
        source: 'runway-thresholds',
        layout: {
          'text-field': ['get', 'label'],
          'text-offset': [0, 1.2],
          'text-size': 9,
          'text-anchor': 'top',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#a855f7',
          'text-halo-color': '#000000',
          'text-halo-width': 1.5,
        },
      });

      setIsMapReady(true);
    });

    // Track mouse movement
    map.current.on('mousemove', (e) => {
      setMouseCoords({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Handle map clicks for adding waypoints
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      if (!isDrawing) return;

      const newWaypoint: RouteWaypoint = {
        id: generateId(),
        lat: e.lngLat.lat,
        lon: e.lngLat.lng,
        alt: 10000, // Default altitude
      };

      onWaypointsChange([...waypoints, newWaypoint]);
    };

    map.current.on('click', handleClick);

    return () => {
      if (map.current) {
        map.current.off('click', handleClick);
      }
    };
  }, [isMapReady, isDrawing, waypoints, onWaypointsChange]);

  // Update cursor based on drawing mode
  useEffect(() => {
    if (!map.current || !isMapReady) return;
    map.current.getCanvas().style.cursor = isDrawing ? 'crosshair' : 'grab';
  }, [isDrawing, isMapReady]);

  // Update route line when waypoints change
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    const source = map.current.getSource('route-line') as maplibregl.GeoJSONSource;
    if (!source) return;

    if (waypoints.length >= 2) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: waypoints.map((wp) => [wp.lon, wp.lat]),
        },
      });
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [waypoints, isMapReady]);

  // Update waypoint markers
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add new markers
    waypoints.forEach((wp, index) => {
      const el = document.createElement('div');
      el.className = 'waypoint-marker';
      el.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-cyan-500 border-2 border-white flex items-center justify-center text-xs font-bold text-black shadow-lg cursor-move">
          ${index + 1}
        </div>
      `;

      const marker = new maplibregl.Marker({
        element: el,
        draggable: true,
      })
        .setLngLat([wp.lon, wp.lat])
        .addTo(map.current!);

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        const updatedWaypoints = [...waypoints];
        updatedWaypoints[index] = {
          ...updatedWaypoints[index],
          lat: lngLat.lat,
          lon: lngLat.lng,
        };
        onWaypointsChange(updatedWaypoints);
      });

      markersRef.current.push(marker);
    });
  }, [waypoints, isMapReady, onWaypointsChange]);

  // Update conflict points
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    const source = map.current.getSource('conflict-points') as maplibregl.GeoJSONSource;
    if (!source) return;

    const features = conflicts.map((conflict) => ({
      type: 'Feature' as const,
      properties: {
        flight: conflict.flight.flight_number,
        severity: conflict.severity,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [conflict.conflict_point.lon, conflict.conflict_point.lat],
      },
    }));

    source.setData({ type: 'FeatureCollection', features });
  }, [conflicts, isMapReady]);

  // Update airport markers
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    const source = map.current.getSource('airports') as maplibregl.GeoJSONSource;
    if (!source) return;

    const features = airports.map((airport) => ({
      type: 'Feature' as const,
      properties: {
        code: airport.code,
        name: airport.name,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [airport.lon, airport.lat],
      },
    }));

    source.setData({ type: 'FeatureCollection', features });
  }, [airports, isMapReady]);

  // Update runway approach lines
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    const linesSource = map.current.getSource('approach-lines') as maplibregl.GeoJSONSource;
    const thresholdsSource = map.current.getSource('runway-thresholds') as maplibregl.GeoJSONSource;
    if (!linesSource || !thresholdsSource) return;

    // Create approach line features
    const lineFeatures = approachLines.map((approach) => ({
      type: 'Feature' as const,
      properties: {
        airport: approach.airport_code,
        runway: approach.runway,
        runway_end: approach.runway_end,
        heading: approach.heading,
      },
      geometry: {
        type: 'LineString' as const,
        coordinates: approach.line.map((p) => [p.lon, p.lat]),
      },
    }));

    linesSource.setData({ type: 'FeatureCollection', features: lineFeatures });

    // Create threshold marker features
    const thresholdFeatures = approachLines.map((approach) => ({
      type: 'Feature' as const,
      properties: {
        label: `RWY ${approach.runway_end}`,
        airport: approach.airport_code,
        heading: approach.heading,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [approach.threshold.lon, approach.threshold.lat],
      },
    }));

    thresholdsSource.setData({ type: 'FeatureCollection', features: thresholdFeatures });
  }, [approachLines, isMapReady]);

  // Fit bounds when waypoints change
  useEffect(() => {
    if (!map.current || !isMapReady || waypoints.length === 0) return;

    if (waypoints.length >= 2) {
      const bounds = new maplibregl.LngLatBounds();
      waypoints.forEach((wp) => bounds.extend([wp.lon, wp.lat]));
      airports.forEach((ap) => bounds.extend([ap.lon, ap.lat]));
      map.current.fitBounds(bounds, { padding: 80, maxZoom: 10 });
    }
  }, [waypoints.length >= 2, isMapReady]);

  const handleClearRoute = useCallback(() => {
    onWaypointsChange([]);
  }, [onWaypointsChange]);

  const handleRemoveLastWaypoint = useCallback(() => {
    if (waypoints.length > 0) {
      onWaypointsChange(waypoints.slice(0, -1));
    }
  }, [waypoints, onWaypointsChange]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Drawing Controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <button
          onClick={() => onDrawingToggle(!isDrawing)}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border',
            isDrawing
              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50'
              : 'bg-bg-panel/90 text-gray-300 border-white/10 hover:bg-white/10'
          )}
        >
          <Plus className="w-4 h-4" />
          {isDrawing ? 'Click map to add points' : 'Start Drawing'}
        </button>

        {waypoints.length > 0 && (
          <>
            <button
              onClick={handleRemoveLastWaypoint}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-panel/90 text-gray-300 border border-white/10 text-xs font-medium hover:bg-white/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Remove Last
            </button>
            <button
              onClick={handleClearRoute}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium hover:bg-red-500/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          </>
        )}
      </div>

      {/* Mouse Coordinates */}
      {mouseCoords && (
        <div className="absolute bottom-4 left-4 bg-bg-panel/90 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-mono text-gray-400">
          <div className="flex items-center gap-2">
            <Navigation className="w-3 h-3" />
            <span>
              {mouseCoords.lat.toFixed(4)}°N, {mouseCoords.lon.toFixed(4)}°E
            </span>
          </div>
        </div>
      )}

      {/* Stats Overlay */}
      {waypoints.length > 0 && (
        <div className="absolute top-4 right-4 bg-bg-panel/90 border border-white/10 rounded-lg px-4 py-3">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Route Info</div>
          <div className="text-sm font-mono text-gray-300">
            {waypoints.length} waypoint{waypoints.length !== 1 ? 's' : ''}
          </div>
          {conflicts.length > 0 && (
            <div className="text-sm font-mono text-red-400 mt-1">
              {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-bg-panel/90 border border-white/10 rounded-lg px-3 py-2">
        <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">Legend</div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[10px]">
            <div className="w-3 h-3 rounded-full bg-cyan-500 border border-white" />
            <span className="text-gray-400">Waypoint</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <div className="w-3 h-0.5 bg-cyan-500" />
            <span className="text-gray-400">Route</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <div className="w-3 h-3 rounded-full bg-red-500 border border-white" />
            <span className="text-gray-400">Conflict</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <div className="w-3 h-3 rounded-full bg-amber-500 border border-white" />
            <span className="text-gray-400">Airport</span>
          </div>
          {approachLines.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-[10px]">
                <div className="w-3 h-0.5 bg-purple-500" style={{ borderStyle: 'dashed' }} />
                <span className="text-gray-400">Approach Path</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <div className="w-3 h-3 rounded-full bg-purple-500 border border-white" />
                <span className="text-gray-400">Runway</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

