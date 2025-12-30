import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { 
  TrajectoryWaypoint, 
  InterpolatedPoint, 
  TrafficConflict, 
  Airport,
  FlightPath 
} from '../types';
import { Trash2, Plus, Navigation, Crosshair } from 'lucide-react';
import clsx from 'clsx';

interface TrajectoryMapProps {
  waypoints: TrajectoryWaypoint[];
  onWaypointsChange: (waypoints: TrajectoryWaypoint[]) => void;
  trajectory?: InterpolatedPoint[];
  conflicts?: TrafficConflict[];
  airports?: Airport[];
  flightPaths?: FlightPath[];  // Departure/arrival path lines
  isDrawing: boolean;
  onDrawingToggle: (drawing: boolean) => void;
  defaultSpeed?: number;
}

// Generate unique ID for waypoints
const generateId = () => Math.random().toString(36).substring(2, 9);

export function TrajectoryMap({
  waypoints,
  onWaypointsChange,
  trajectory = [],
  conflicts = [],
  airports = [],
  flightPaths = [],
  isDrawing,
  onDrawingToggle,
  defaultSpeed = 250,
}: TrajectoryMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [showTrajectory, setShowTrajectory] = useState(true);
  const [showAirports, setShowAirports] = useState(true);
  const [showFlightPaths, setShowFlightPaths] = useState(true);
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

      // Waypoint connection line (user-drawn)
      map.current.addSource('waypoint-line', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current.addLayer({
        id: 'waypoint-line-glow',
        type: 'line',
        source: 'waypoint-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#06b6d4',
          'line-width': 10,
          'line-opacity': 0.2,
          'line-blur': 4,
        },
      });

      map.current.addLayer({
        id: 'waypoint-line-main',
        type: 'line',
        source: 'waypoint-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#06b6d4',
          'line-width': 3,
          'line-opacity': 0.8,
          'line-dasharray': [4, 2],
        },
      });

      // Interpolated trajectory line
      map.current.addSource('trajectory-line', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current.addLayer({
        id: 'trajectory-line-glow',
        type: 'line',
        source: 'trajectory-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#a855f7',
          'line-width': 12,
          'line-opacity': 0.15,
          'line-blur': 5,
        },
      });

      map.current.addLayer({
        id: 'trajectory-line-main',
        type: 'line',
        source: 'trajectory-line',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#a855f7',
          'line-width': 4,
          'line-opacity': 0.9,
        },
      });

      // Trajectory points (every Nth point for visualization)
      map.current.addSource('trajectory-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current.addLayer({
        id: 'trajectory-points-layer',
        type: 'circle',
        source: 'trajectory-points',
        paint: {
          'circle-radius': 3,
          'circle-color': '#a855f7',
          'circle-opacity': 0.6,
        },
      });

      // Conflict points source
      map.current.addSource('conflict-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Conflict pulse (outer)
      map.current.addLayer({
        id: 'conflict-points-pulse',
        type: 'circle',
        source: 'conflict-points',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'severity'], 'critical'], 20,
            ['==', ['get', 'severity'], 'warning'], 15,
            12
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'severity'], 'critical'], '#ef4444',
            ['==', ['get', 'severity'], 'warning'], '#f59e0b',
            '#3b82f6'
          ],
          'circle-opacity': 0.2,
        },
      });

      // Conflict points (inner)
      map.current.addLayer({
        id: 'conflict-points-layer',
        type: 'circle',
        source: 'conflict-points',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'severity'], 'critical'], 10,
            ['==', ['get', 'severity'], 'warning'], 8,
            6
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'severity'], 'critical'], '#ef4444',
            ['==', ['get', 'severity'], 'warning'], '#f59e0b',
            '#3b82f6'
          ],
          'circle-opacity': 0.9,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Airport markers source
      map.current.addSource('airports', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Airport markers
      map.current.addLayer({
        id: 'airports-layer',
        type: 'circle',
        source: 'airports',
        paint: {
          'circle-radius': 8,
          'circle-color': '#f59e0b',
          'circle-opacity': 0.8,
          'circle-stroke-width': 2,
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
          'text-offset': [0, -1.5],
          'text-size': 11,
          'text-anchor': 'bottom',
          'text-allow-overlap': true,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        },
        paint: {
          'text-color': '#f59e0b',
          'text-halo-color': '#000000',
          'text-halo-width': 2,
        },
      });

      // Flight paths source (departure/arrival trajectories)
      map.current.addSource('flight-paths', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Flight paths - departures (green for relevant, dim for non-relevant)
      map.current.addLayer({
        id: 'flight-paths-departures',
        type: 'line',
        source: 'flight-paths',
        filter: ['==', ['get', 'flight_type'], 'departure'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'is_time_relevant'], true], '#22c55e',  // Bright green for time-relevant
            '#1a472a'  // Dim green for non-relevant
          ],
          'line-width': [
            'case',
            ['==', ['get', 'is_time_relevant'], true], 3,  // Thicker for time-relevant
            1.5
          ],
          'line-opacity': [
            'case',
            ['==', ['get', 'is_time_relevant'], true], 0.9,
            0.3
          ],
        },
      });

      // Flight paths - arrivals (blue for relevant, dim for non-relevant)
      map.current.addLayer({
        id: 'flight-paths-arrivals',
        type: 'line',
        source: 'flight-paths',
        filter: ['==', ['get', 'flight_type'], 'arrival'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'is_time_relevant'], true], '#3b82f6',  // Bright blue for time-relevant
            '#1e3a5f'  // Dim blue for non-relevant
          ],
          'line-width': [
            'case',
            ['==', ['get', 'is_time_relevant'], true], 3,  // Thicker for time-relevant
            1.5
          ],
          'line-opacity': [
            'case',
            ['==', ['get', 'is_time_relevant'], true], 0.9,
            0.3
          ],
        },
      });

      // Flight path labels (flight numbers)
      map.current.addLayer({
        id: 'flight-paths-labels',
        type: 'symbol',
        source: 'flight-paths',
        layout: {
          'symbol-placement': 'line-center',
          'text-field': ['get', 'flight_number'],
          'text-size': 10,
          'text-allow-overlap': false,
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        },
        paint: {
          'text-color': [
            'case',
            ['==', ['get', 'flight_type'], 'departure'], '#22c55e',
            '#3b82f6'
          ],
          'text-halo-color': '#000000',
          'text-halo-width': 1,
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

      const newWaypoint: TrajectoryWaypoint = {
        id: generateId(),
        lat: e.lngLat.lat,
        lon: e.lngLat.lng,
        alt: 10000, // Default altitude
        speed_kts: defaultSpeed,
      };

      onWaypointsChange([...waypoints, newWaypoint]);
    };

    map.current.on('click', handleClick);

    return () => {
      if (map.current) {
        map.current.off('click', handleClick);
      }
    };
  }, [isMapReady, isDrawing, waypoints, onWaypointsChange, defaultSpeed]);

  // Update cursor based on drawing mode
  useEffect(() => {
    if (!map.current || !isMapReady) return;
    map.current.getCanvas().style.cursor = isDrawing ? 'crosshair' : 'grab';
  }, [isDrawing, isMapReady]);

  // Update waypoint line
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    const source = map.current.getSource('waypoint-line') as maplibregl.GeoJSONSource;
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

  // Update trajectory line and points
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    const lineSource = map.current.getSource('trajectory-line') as maplibregl.GeoJSONSource;
    const pointsSource = map.current.getSource('trajectory-points') as maplibregl.GeoJSONSource;
    
    if (!lineSource || !pointsSource) return;

    if (trajectory.length >= 2 && showTrajectory) {
      // Line
      lineSource.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: trajectory.map((p) => [p.lon, p.lat]),
        },
      });

      // Points (every 6th point = every minute at 10 sec intervals)
      const pointFeatures = trajectory
        .filter((_, i) => i % 6 === 0)
        .map((p) => ({
          type: 'Feature' as const,
          properties: {
            alt: p.alt,
            time: p.timestamp,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [p.lon, p.lat],
          },
        }));

      pointsSource.setData({ type: 'FeatureCollection', features: pointFeatures });
    } else {
      lineSource.setData({ type: 'FeatureCollection', features: [] });
      pointsSource.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [trajectory, isMapReady, showTrajectory]);

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
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 border-2 border-white flex items-center justify-center text-sm font-bold text-black shadow-lg shadow-cyan-500/40 cursor-move hover:scale-110 transition-transform">
          ${index + 1}
        </div>
      `;

      const marker = new maplibregl.Marker({
        element: el,
        draggable: true,
        anchor: 'center',
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

  // Update conflict markers
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    const source = map.current.getSource('conflict-points') as maplibregl.GeoJSONSource;
    if (!source) return;

    const features = conflicts.map((conflict) => ({
      type: 'Feature' as const,
      properties: {
        flight: conflict.flight_number,
        severity: conflict.severity,
        type: conflict.flight_type,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [conflict.our_position.lon, conflict.our_position.lat],
      },
    }));

    source.setData({ type: 'FeatureCollection', features });
  }, [conflicts, isMapReady]);

  // Update airport markers
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    const source = map.current.getSource('airports') as maplibregl.GeoJSONSource;
    if (!source) return;

    if (showAirports) {
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
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [airports, isMapReady, showAirports]);

  // Update flight paths (departure/arrival trajectories)
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    const source = map.current.getSource('flight-paths') as maplibregl.GeoJSONSource;
    if (!source) return;

    if (showFlightPaths && flightPaths.length > 0) {
      const features = flightPaths.map((fp) => ({
        type: 'Feature' as const,
        properties: {
          flight_number: fp.flight_number,
          airline: fp.airline,
          flight_type: fp.flight_type,
          airport_code: fp.airport_code,
          destination_or_origin: fp.destination_or_origin,
          scheduled_time: fp.scheduled_time,
          aircraft_type: fp.aircraft_type,
          is_time_relevant: fp.is_time_relevant ?? false,
          min_distance_nm: fp.min_distance_nm,
          min_vertical_ft: fp.min_vertical_ft,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: fp.path_points.map((p) => [p.lon, p.lat]),
        },
      }));

      source.setData({ type: 'FeatureCollection', features });
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [flightPaths, isMapReady, showFlightPaths]);

  // Fit bounds when trajectory changes
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    const allPoints = [
      ...waypoints.map(wp => ({ lat: wp.lat, lon: wp.lon })),
      ...airports.map(a => ({ lat: a.lat, lon: a.lon })),
    ];

    if (allPoints.length >= 2) {
      const bounds = new maplibregl.LngLatBounds();
      allPoints.forEach((p) => bounds.extend([p.lon, p.lat]));
      map.current.fitBounds(bounds, { padding: 80, maxZoom: 10 });
    }
  }, [waypoints.length >= 2, airports.length, isMapReady]);

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
            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all border backdrop-blur-sm',
            isDrawing
              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 shadow-lg shadow-cyan-500/20'
              : 'bg-black/60 text-gray-300 border-white/10 hover:bg-white/10 hover:border-white/20'
          )}
        >
          {isDrawing ? (
            <>
              <Crosshair className="w-4 h-4" />
              Click map to add points
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Start Drawing
            </>
          )}
        </button>

        {waypoints.length > 0 && (
          <>
            <button
              onClick={handleRemoveLastWaypoint}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/60 text-gray-300 border border-white/10 text-xs font-medium hover:bg-white/10 hover:border-white/20 transition-all backdrop-blur-sm"
            >
              <Trash2 className="w-4 h-4" />
              Remove Last
            </button>
            <button
              onClick={handleClearRoute}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium hover:bg-red-500/30 transition-all backdrop-blur-sm"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          </>
        )}
      </div>

      {/* Layer Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <div className="bg-black/60 backdrop-blur-sm rounded-xl border border-white/10 p-2">
          <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2 px-2">Layers</div>
          <button
            onClick={() => setShowTrajectory(!showTrajectory)}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all',
              showTrajectory
                ? 'bg-purple-500/20 text-purple-400'
                : 'text-gray-400 hover:bg-white/5'
            )}
          >
            <div className={clsx(
              'w-3 h-3 rounded-full',
              showTrajectory ? 'bg-purple-500' : 'bg-gray-600'
            )} />
            Trajectory
          </button>
          <button
            onClick={() => setShowAirports(!showAirports)}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all',
              showAirports
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-gray-400 hover:bg-white/5'
            )}
          >
            <div className={clsx(
              'w-3 h-3 rounded-full',
              showAirports ? 'bg-amber-500' : 'bg-gray-600'
            )} />
            Airports
          </button>
          <button
            onClick={() => setShowFlightPaths(!showFlightPaths)}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all',
              showFlightPaths
                ? 'bg-green-500/20 text-green-400'
                : 'text-gray-400 hover:bg-white/5'
            )}
          >
            <div className={clsx(
              'w-3 h-3 rounded-full',
              showFlightPaths ? 'bg-green-500' : 'bg-gray-600'
            )} />
            Flight Paths
          </button>
        </div>
      </div>

      {/* Mouse Coordinates */}
      {mouseCoords && (
        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2 text-[11px] font-mono text-gray-400">
          <div className="flex items-center gap-2">
            <Navigation className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-gray-500">LAT</span>
            <span className="text-white">{mouseCoords.lat.toFixed(5)}</span>
            <span className="text-gray-600 mx-1">|</span>
            <span className="text-gray-500">LON</span>
            <span className="text-white">{mouseCoords.lon.toFixed(5)}</span>
          </div>
        </div>
      )}

      {/* Stats Overlay */}
      {(waypoints.length > 0 || trajectory.length > 0) && (
        <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3">
          <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">Route Info</div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[11px] text-gray-400">Waypoints</span>
              <span className="text-sm font-mono text-cyan-400">{waypoints.length}</span>
            </div>
            {trajectory.length > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-[11px] text-gray-400">Trajectory Points</span>
                <span className="text-sm font-mono text-purple-400">{trajectory.length}</span>
              </div>
            )}
            {conflicts.length > 0 && (
              <div className="flex items-center justify-between gap-4 pt-1 border-t border-white/10">
                <span className="text-[11px] text-gray-400">Conflicts</span>
                <span className="text-sm font-mono text-red-400">{conflicts.length}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-20 right-4 bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-2">
        <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">Legend</div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[10px]">
            <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-[8px] font-bold text-black">1</div>
            <span className="text-gray-400">Waypoint</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <div className="w-4 h-0.5 bg-cyan-500 rounded" style={{ borderStyle: 'dashed' }} />
            <span className="text-gray-400">Planned Route</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <div className="w-4 h-1 bg-purple-500 rounded" />
            <span className="text-gray-400">Trajectory</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <div className="w-3 h-3 rounded-full bg-red-500 border border-white" />
            <span className="text-gray-400">Conflict</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <div className="w-3 h-3 rounded-full bg-amber-500 border border-white" />
            <span className="text-gray-400">Airport</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <div className="w-4 h-0.5 bg-green-500 rounded" />
            <span className="text-gray-400">Departure</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <div className="w-4 h-0.5 bg-blue-500 rounded" />
            <span className="text-gray-400">Arrival</span>
          </div>
        </div>
      </div>
    </div>
  );
}

