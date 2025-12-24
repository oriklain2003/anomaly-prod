import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { X, Play, Pause, SkipBack, SkipForward, AlertTriangle, MapPin, Wrench, Check } from 'lucide-react';
import { fetchFeedbackTrack, fetchReplayOtherFlight, fetchUnifiedTrack } from '../api';
import type { TrackPoint } from '../types';
import clsx from 'clsx';
import { WORLD_AIRPORTS } from '../data/airports';

export interface ReplayEvent {
  timestamp: number;
  description: string;
  type: 'proximity' | 'deviation' | 'ml_anomaly' | 'holding' | 'go_around' | 'other';
  lat?: number;
  lon?: number;
}

interface ReplayModalProps {
  mainFlightId: string;
  secondaryFlightIds?: string[];
  events?: ReplayEvent[];
  onClose: () => void;
}

interface FlightData {
  id: string;
  points: TrackPoint[];
  color: string;
}

type TelemetryData = 
  | { status: 'waiting' }
  | ({ status: 'active' | 'ended' } & TrackPoint);

const COLORS = ['#06b6d4', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

export function ReplayModal({ mainFlightId, secondaryFlightIds = [], events = [], onClose }: ReplayModalProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  
  const [flights, setFlights] = useState<FlightData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(1);
  const [minTime, setMinTime] = useState<number>(0);
  const [maxTime, setMaxTime] = useState<number>(0);
  
  const [showTools, setShowTools] = useState(false);
  const [distanceTool, setDistanceTool] = useState(true);
  const [airportDistanceTool, setAirportDistanceTool] = useState(true);

  const animationRef = useRef<number | undefined>(undefined);
  const lastFrameTime = useRef<number>(0);

  const getDistanceNM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3440.065;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleEventClick = (event: ReplayEvent) => {
    setCurrentTime(event.timestamp);
    
    let targetLat = event.lat;
    let targetLon = event.lon;

    if ((!targetLat || !targetLon) && flights.length > 0) {
      const mainFlight = flights.find(f => f.id === mainFlightId);
      if (mainFlight) {
        const point = mainFlight.points.reduce((prev, curr) => 
          Math.abs(curr.timestamp - event.timestamp) < Math.abs(prev.timestamp - event.timestamp) ? curr : prev
        );
        if (point) {
          targetLat = point.lat;
          targetLon = point.lon;
        }
      }
    }

    if (targetLat && targetLon && map.current) {
      map.current.flyTo({
        center: [targetLon, targetLat],
        zoom: 14,
        speed: 1.5
      });
    }
  };

  // Fetch data - main flight uses fetchFeedbackTrack, secondary flights use fetchReplayOtherFlight
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const secondaryIds = [...new Set(secondaryFlightIds)].filter(Boolean);
        
        // Fetch main flight - try feedback track first, then unified track (which can fetch from FR24)
        const mainFlightResult = await (async () => {
          try {
            // First try feedback track (local databases)
            const track = await fetchFeedbackTrack(mainFlightId);
            return {
              id: mainFlightId,
              points: track.points.sort((a, b) => a.timestamp - b.timestamp),
              color: COLORS[0] // Main flight is always cyan
            };
          } catch (err) {
            console.warn(`Feedback track not found for ${mainFlightId}, trying unified track...`);
            try {
              // Fallback to unified track which can fetch from FR24
              const track = await fetchUnifiedTrack(mainFlightId);
              console.log(`Loaded ${mainFlightId} via unified track with ${track.points.length} points`);
              return {
                id: mainFlightId,
                points: track.points.sort((a, b) => a.timestamp - b.timestamp),
                color: COLORS[0]
              };
            } catch (err2) {
              console.warn(`Failed to fetch main flight track for ${mainFlightId}:`, err2);
              return null;
            }
          }
        })();

        // Fetch secondary flights (other flights from proximity alerts) using the new API
        const secondaryResults = await Promise.all(
          secondaryIds.map(async (id, index) => {
            try {
              // Use the new replay/other-flight API which searches more locations
              const data = await fetchReplayOtherFlight(id);
              console.log(`Loaded other flight ${id} (${data.callsign}) with ${data.total_points} points from ${data.source}`);
              return {
                id,
                points: data.points.sort((a, b) => a.timestamp - b.timestamp),
                color: COLORS[(index + 1) % COLORS.length] // Secondary flights get remaining colors
              };
            } catch (err) {
              console.warn(`Failed to fetch other flight track for ${id}:`, err);
              return null;
            }
          })
        );

        const validFlights = [mainFlightResult, ...secondaryResults].filter((f): f is FlightData => f !== null);
        setFlights(validFlights);

        if (validFlights.length > 0) {
          const allPoints = validFlights.flatMap(f => f.points);
          const min = Math.min(...allPoints.map(p => p.timestamp));
          const max = Math.max(...allPoints.map(p => p.timestamp));
          setMinTime(min);
          setMaxTime(max);
          setCurrentTime(min);
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [mainFlightId, secondaryFlightIds]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainer.current || loading || flights.length === 0) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://api.maptiler.com/maps/darkmatter/style.json?key=r7kaQpfNDVZdaVp23F1r',
      center: [0, 0],
      zoom: 2,
    });

    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '200px'
    });

    map.current.on('load', () => {
      if (!map.current) return;

      const bounds = new maplibregl.LngLatBounds();
      flights.forEach(f => {
        f.points.forEach(p => bounds.extend([p.lon, p.lat]));
      });
      map.current.fitBounds(bounds, { padding: 50 });

      flights.forEach(flight => {
        // Ghost Line (full path)
        map.current!.addSource(`source-${flight.id}-ghost`, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: flight.points.map(p => [p.lon, p.lat])
              }
            }]
          }
        });

        map.current!.addLayer({
          id: `layer-${flight.id}-ghost`,
          type: 'line',
          source: `source-${flight.id}-ghost`,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': flight.color,
            'line-width': 2,
            'line-opacity': 0.2,
            'line-dasharray': [2, 2]
          }
        });

        // Active line source
        map.current!.addSource(`source-${flight.id}`, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        map.current!.addLayer({
          id: `layer-${flight.id}-line`,
          type: 'line',
          source: `source-${flight.id}`,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': flight.color,
            'line-width': 3,
            'line-opacity': 0.9
          }
        });

        // Position marker source
        map.current!.addSource(`source-${flight.id}-pos`, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        map.current!.addLayer({
          id: `layer-${flight.id}-pos`,
          type: 'circle',
          source: `source-${flight.id}-pos`,
          paint: {
            'circle-radius': 7,
            'circle-color': flight.color,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
          }
        });
        
        map.current!.addLayer({
          id: `layer-${flight.id}-label`,
          type: 'symbol',
          source: `source-${flight.id}-pos`,
          layout: {
            'text-field': flight.id,
            'text-offset': [0, -1.5],
            'text-size': 11,
            'text-anchor': 'bottom',
            'text-allow-overlap': true
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 2
          }
        });

        // Start marker (green pin)
        const startPoint = flight.points[0];
        map.current!.addSource(`source-${flight.id}-start`, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [startPoint.lon, startPoint.lat]
            }
          }
        });

        map.current!.addLayer({
          id: `layer-${flight.id}-start`,
          type: 'circle',
          source: `source-${flight.id}-start`,
          paint: {
            'circle-radius': 6,
            'circle-color': '#22c55e',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
          }
        });

        // Popup on hover
        const showPopup = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
          if (!map.current || !popupRef.current || !e.features?.[0]) return;
          map.current.getCanvas().style.cursor = 'pointer';

          const feature = e.features[0];
          const props = feature.properties || {};
          const coords = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];

          const timeStr = new Date(props.timestamp * 1000).toLocaleTimeString();
          
          popupRef.current
            .setLngLat(coords)
            .setHTML(`
              <div style="color: #1f2937; padding: 8px; font-size: 11px; font-family: system-ui;">
                <div style="font-weight: bold; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 4px;">${flight.id}</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px;">
                  <span style="color: #6b7280;">Time:</span>
                  <span style="font-family: monospace; text-align: right;">${timeStr}</span>
                  <span style="color: #6b7280;">Alt:</span>
                  <span style="font-family: monospace; text-align: right;">${props.alt || 0} ft</span>
                  <span style="color: #6b7280;">Hdg:</span>
                  <span style="font-family: monospace; text-align: right;">${props.track || 0}°</span>
                  <span style="color: #6b7280;">GS:</span>
                  <span style="font-family: monospace; text-align: right;">${props.gspeed || 0} kts</span>
                </div>
              </div>
            `)
            .addTo(map.current);
        };

        const hidePopup = () => {
          if (!map.current || !popupRef.current) return;
          map.current.getCanvas().style.cursor = '';
          popupRef.current.remove();
        };

        map.current?.on('mouseenter', `layer-${flight.id}-pos`, showPopup);
        map.current?.on('mouseleave', `layer-${flight.id}-pos`, hidePopup);
      });
    });

    return () => {
      map.current?.remove();
    };
  }, [loading, flights]);

  // Animation Loop
  useEffect(() => {
    if (!isPlaying) {
      lastFrameTime.current = 0;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const animate = (time: number) => {
      if (lastFrameTime.current === 0) {
        lastFrameTime.current = time;
      }

      const delta = (time - lastFrameTime.current) / 1000;
      lastFrameTime.current = time;

      setCurrentTime(prev => {
        const next = prev + (delta * speed);
        if (next >= maxTime) {
          setIsPlaying(false);
          return maxTime;
        }
        return next;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, speed, maxTime]);

  // Update Map Data
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    flights.forEach(flight => {
      const activePoints = flight.points.filter(p => p.timestamp <= currentTime);
      
      if (activePoints.length === 0) {
        (map.current!.getSource(`source-${flight.id}`) as maplibregl.GeoJSONSource)?.setData({
          type: 'FeatureCollection',
          features: []
        });
        (map.current!.getSource(`source-${flight.id}-pos`) as maplibregl.GeoJSONSource)?.setData({
          type: 'FeatureCollection',
          features: []
        });
        return;
      }

      (map.current!.getSource(`source-${flight.id}`) as maplibregl.GeoJSONSource)?.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: activePoints.map(p => [p.lon, p.lat])
          }
        }]
      });

      const lastPoint = activePoints[activePoints.length - 1];
      (map.current!.getSource(`source-${flight.id}-pos`) as maplibregl.GeoJSONSource)?.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {
            timestamp: lastPoint.timestamp,
            alt: lastPoint.alt,
            track: lastPoint.track || 0,
            gspeed: lastPoint.gspeed || 0
          },
          geometry: {
            type: 'Point',
            coordinates: [lastPoint.lon, lastPoint.lat]
          }
        }]
      });
    });

  }, [currentTime, flights]);

  const formatTime = (ts: number) => new Date(ts * 1000).toLocaleTimeString();

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTime(Number(e.target.value));
  };

  const getCurrentTelemetry = (flight: FlightData): TelemetryData => {
    const started = flight.points[0].timestamp <= currentTime;
    const ended = currentTime > flight.points[flight.points.length - 1].timestamp;

    if (!started) return { status: 'waiting' };
    
    const activePoints = flight.points.filter(p => p.timestamp <= currentTime);
    if (activePoints.length === 0) return { status: 'waiting' };
    
    const p = activePoints[activePoints.length - 1];
    
    return { 
      status: ended ? 'ended' : 'active',
      ...p
    };
  };

  const getDistancesToOthers = (currentFlightId: string, currentLat: number, currentLon: number) => {
    if (!distanceTool) return [];

    return flights
      .filter(f => f.id !== currentFlightId)
      .map(f => {
        const tel = getCurrentTelemetry(f);
        if (tel.status === 'waiting' || tel.status === 'ended' || !('lat' in tel)) return null;
        
        return {
          id: f.id,
          dist: getDistanceNM(currentLat, currentLon, tel.lat, tel.lon),
          color: f.color
        };
      })
      .filter((d): d is { id: string; dist: number; color: string } => d !== null)
      .sort((a, b) => a.dist - b.dist);
  };

  const getNearestAirport = (lat: number, lon: number) => {
    if (!airportDistanceTool) return null;

    let nearest: { code: string; name: string; country: string; dist: number } | null = null;
    
    for (const airport of WORLD_AIRPORTS) {
      const dist = getDistanceNM(lat, lon, airport.lat, airport.lon);
      if (!nearest || dist < nearest.dist) {
        nearest = { code: airport.code, name: airport.name, country: airport.country, dist };
      }
    }
    
    return nearest;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center backdrop-blur-sm">
        <style>{`
          .onyx-loader {
            width: 100px;
            height: 100px;
            display: block;
          }
          .onyx-loader__symbol {
            background-color: #0a0a0a;
            padding: 8px;
            animation: onyx-loading 3s infinite;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            box-shadow: 0 0 30px rgba(6, 182, 212, 0.4);
          }
          .onyx-loader__content {
            display: block;
            width: 100%;
            animation: onyx-loading-icon 3s infinite;
          }
          @keyframes onyx-loading {
            0% { transform: perspective(250px) rotateX(0deg) rotateY(0deg); }
            15% { background-color: #0a0a0a; }
            16% { background-color: #0891b2; }
            50% { transform: perspective(250px) rotateX(180deg) rotateY(0deg); background-color: #0891b2; }
            65% { background-color: #0891b2; }
            66% { background-color: #0a0a0a; }
            100% { transform: perspective(250px) rotateX(180deg) rotateY(-180deg); }
          }
          @keyframes onyx-loading-icon {
            0% { transform: perspective(250px) rotateX(0deg) rotateY(0deg); }
            15% { transform: perspective(250px) rotateX(0deg) rotateY(0deg); }
            16% { transform: perspective(250px) rotateX(180deg) rotateY(0deg); }
            50% { transform: perspective(250px) rotateX(180deg) rotateY(0deg); }
            65% { transform: perspective(250px) rotateX(180deg) rotateY(0deg); }
            66% { transform: perspective(250px) rotateX(180deg) rotateY(180deg); }
            100% { transform: perspective(250px) rotateX(180deg) rotateY(180deg); }
          }
        `}</style>
        
        <div className="onyx-loader">
          <div className="onyx-loader__symbol">
            <div className="onyx-loader__content">
              <svg viewBox="0 0 100 40" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                <text x="50" y="28" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="900" fontSize="26" fill="white" letterSpacing="3">ONYX</text>
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center backdrop-blur-sm animate-in fade-in">
      <div className="bg-bg-panel w-[calc(100vw-64px)] h-[calc(100vh-64px)] rounded-xl overflow-hidden flex flex-col border border-white/10 shadow-2xl relative">
        
        {/* Header buttons - absolute positioned inside the modal with high z-index */}
        <div className="absolute top-5 right-5 z-[10000] flex gap-3">
          <div className="relative">
            <button 
              onClick={() => setShowTools(!showTools)}
              className={clsx(
                "p-2.5 rounded-full transition-colors border shadow-lg",
                showTools ? "bg-primary text-white border-primary" : "bg-black/80 hover:bg-black text-white border-white/20"
              )}
              title="Tools"
            >
              <Wrench className="w-5 h-5" />
            </button>
            
            {showTools && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-bg-panel border border-white/10 rounded-lg shadow-xl p-2 animate-in fade-in slide-in-from-top-2">
                <div className="text-xs font-bold text-white/40 uppercase mb-2 px-2">Tools</div>
                <button 
                  onClick={() => setDistanceTool(!distanceTool)}
                  className="w-full flex items-center justify-between p-2 rounded hover:bg-white/5 text-sm text-white transition-colors"
                >
                  <span>Distance Calc</span>
                  {distanceTool && <Check className="w-4 h-4 text-primary" />}
                </button>
                <button 
                  onClick={() => setAirportDistanceTool(!airportDistanceTool)}
                  className="w-full flex items-center justify-between p-2 rounded hover:bg-white/5 text-sm text-white transition-colors"
                >
                  <span>Nearest Airport</span>
                  {airportDistanceTool && <Check className="w-4 h-4 text-primary" />}
                </button>
              </div>
            )}
          </div>

          <button 
            onClick={onClose}
            className="bg-red-600/90 hover:bg-red-500 text-white p-2.5 rounded-full transition-colors shadow-lg border border-red-500/50"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
          {/* Events Sidebar */}
          <div className="w-64 bg-bg-panel border-r border-white/10 flex flex-col z-30 shrink-0">
            <div className="p-4 border-b border-white/10 bg-white/5">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-primary" />
                Event Log
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {events.length === 0 ? (
                <div className="text-white/40 text-xs text-center mt-10 p-4 border border-dashed border-white/10 rounded-lg mx-2">
                  No events logged.
                </div>
              ) : (
                events.map((ev, i) => (
                  <button 
                    key={i}
                    onClick={() => handleEventClick(ev)}
                    className="w-full text-left bg-black/20 hover:bg-white/5 border border-white/5 hover:border-white/10 p-3 rounded-lg transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={clsx(
                        "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                        ev.type === 'proximity' ? "bg-red-500/20 text-red-300" :
                        ev.type === 'deviation' ? "bg-orange-500/20 text-orange-300" :
                        ev.type === 'ml_anomaly' ? "bg-purple-500/20 text-purple-300" :
                        "bg-blue-500/20 text-blue-300"
                      )}>
                        {ev.type === 'ml_anomaly' ? 'ML' : ev.type}
                      </span>
                      <span className="font-mono text-[10px] text-white/40">
                        {formatTime(ev.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-white/80 line-clamp-2 mb-2">{ev.description}</p>
                    <div className="flex items-center gap-1 text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <MapPin className="w-3 h-3" />
                      Jump to event
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Map Area */}
          <div className="flex-1 relative">
            {/* Telemetry Overlay */}
            <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-none">
              {flights.map(f => {
                const tel = getCurrentTelemetry(f);
                if (!tel) return null;

                const distances = (tel.status !== 'waiting' && 'lat' in tel)
                  ? getDistancesToOthers(f.id, tel.lat, tel.lon)
                  : [];
                
                const nearestAirport = (tel.status !== 'waiting' && 'lat' in tel)
                  ? getNearestAirport(tel.lat, tel.lon)
                  : null;

                return (
                  <div key={f.id} className="bg-black/70 backdrop-blur border border-white/10 p-3 rounded-lg text-xs w-44 shadow-lg pointer-events-auto">
                    <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                      <span className="font-bold text-white text-[11px]">{f.id}</span>
                      {tel.status === 'waiting' && <span className="text-[9px] text-yellow-500 ml-auto">Waiting</span>}
                      {tel.status === 'ended' && <span className="text-[9px] text-red-400 ml-auto">Ended</span>}
                    </div>
                    {tel.status !== 'waiting' && (
                      <div className={clsx("space-y-1 text-white/80", tel.status === 'ended' && "opacity-50")}>
                        <div className="flex justify-between">
                          <span>Alt:</span>
                          <span className="font-mono">{tel.alt} ft</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Hdg:</span>
                          <span className="font-mono">{tel.track}°</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Speed:</span>
                          <span className="font-mono">{tel.gspeed || 0} kts</span>
                        </div>

                        {distances.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/10">
                            <div className="text-[9px] font-bold text-white/40 uppercase mb-1">Distances</div>
                            {distances.map(d => (
                              <div key={d.id} className="flex justify-between items-center">
                                <div className="flex items-center gap-1">
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                                  <span className="text-white/60">{d.id}</span>
                                </div>
                                <span className="font-mono text-cyan-400">{d.dist.toFixed(1)} NM</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {nearestAirport && (
                          <div className="mt-2 pt-2 border-t border-white/10">
                            <div className="text-[9px] font-bold text-white/40 uppercase mb-1">Nearest Airport</div>
                            <div className="flex justify-between items-center bg-green-500/10 px-1.5 py-1 rounded">
                              <span className="font-mono text-green-400">{nearestAirport.code}</span>
                              <span className="font-mono text-green-300">{nearestAirport.dist.toFixed(1)} NM</span>
                            </div>
                            <div className="text-[8px] text-white/50 mt-0.5 truncate" title={nearestAirport.name}>
                              {nearestAirport.name} ({nearestAirport.country})
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div ref={mapContainer} className="w-full h-full bg-gray-900" />
          </div>
        </div>

        {/* Controls */}
        <div className="bg-bg-panel border-t border-white/10 p-4 z-40">
          
          {/* Time Slider */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-xs font-mono text-white/60 min-w-[70px]">{formatTime(currentTime)}</span>
            <input 
              type="range" 
              min={minTime} 
              max={maxTime} 
              step={1}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <span className="text-xs font-mono text-white/60 min-w-[70px] text-right">{formatTime(maxTime)}</span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between">
            
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
              {[1, 5, 10, 20, 60].map(s => (
                <button 
                  key={s}
                  onClick={() => setSpeed(s)} 
                  className={clsx(
                    "px-2 py-1 text-xs font-bold rounded transition-colors",
                    speed === s ? "bg-cyan-500 text-white" : "text-white/40 hover:text-white"
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={() => setCurrentTime(minTime)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="bg-cyan-500 hover:bg-cyan-600 text-white p-3 rounded-full transition-transform active:scale-95 shadow-lg"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 pl-0.5" />}
              </button>

              <button 
                onClick={() => setCurrentTime(maxTime)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-end gap-1 min-w-[150px]">
              {flights.map(f => (
                <div key={f.id} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                  <span className="text-white/80 font-mono">{f.id}</span>
                </div>
              ))}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
