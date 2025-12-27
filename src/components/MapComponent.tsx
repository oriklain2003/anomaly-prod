import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Set RTL text plugin for proper Hebrew/Arabic text rendering
try {
  maplibregl.setRTLTextPlugin(
    'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.min.js',
    true // lazy load
  );
} catch {
  // Plugin already loaded
}
import type { SelectedFlight, FlightTrack, LearnedLayers, TrackPoint, HighlightState, WeatherData } from '../types';
import { fetchUnifiedTrack, fetchSystemReportTrack, fetchLearnedLayers, fetchReplayOtherFlight, fetchAllLiveFlights, fetchLiveResearchTrack, fetchCurrentWeather, type LiveFlightData } from '../api';
import type { MapLayer } from './MapControls';
import { Cloud, Wind, Eye, Thermometer, Droplets } from 'lucide-react';

interface MapComponentProps {
  onMouseMove?: (coords: { lat: number; lon: number; elv: number }) => void;
  selectedFlight: SelectedFlight | null;
  activeLayers: MapLayer[];
  mode?: 'live' | 'history' | 'ai';
  onFlightClick?: (flightId: string, isAnomaly: boolean, callsign?: string, origin?: string, destination?: string) => void;
  highlight?: HighlightState | null;
}

interface ProximityFlightData {
  id: string;
  callsign: string | null;
  points: TrackPoint[];
}

const LIVE_POLL_INTERVAL = 10000; // 10 seconds for live flights polling

// Training Region Bounding Box (Levant Region) - from core/config.py
const TRAINING_BBOX = {
  north: 34.597042,
  south: 28.536275,
  west: 32.299805,
  east: 37.397461,
};

// Create live flight marker element with Material Symbols flight icon
function createLiveFlightMarkerElement(
  callsign: string,
  heading: number,
  isAnomaly: boolean,
  onClick?: () => void
): HTMLElement {
  const el = document.createElement('div');
  el.className = 'live-flight-marker';
  el.style.cursor = 'pointer';

  const color = isAnomaly ? '#ef4444' : '#60a5fa';
  const glowColor = isAnomaly ? 'rgba(239, 68, 68, 0.6)' : 'rgba(96, 165, 250, 0.6)';
  const borderColor = isAnomaly ? 'rgba(239, 68, 68, 0.3)' : 'rgba(96, 165, 250, 0.3)';
  const textColor = isAnomaly ? '#fca5a5' : '#93c5fd';

  // Heading adjustment: Material Symbols 'flight' icon points up (0°/North),
  // Aviation headings are clockwise from north, so we use heading directly
  const rotation = heading || 0;

  el.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; position: relative;">
      <span class="material-symbols-outlined live-flight-icon" style="
        font-size: 18px;
        color: ${color}; 
        filter: drop-shadow(0 0 10px ${glowColor});
        transform: rotate(${rotation}deg);
      ">flight</span>
      <span style="
        color: ${textColor}; 
        font-family: 'JetBrains Mono', monospace; 
        font-weight: 700; 
        font-size: 9px; 
        margin-top: 2px; 
        background: rgba(0, 0, 0, 0.85); 
        padding: 2px 8px; 
        border: 1px solid ${borderColor}; 
        border-radius: 3px;
        white-space: nowrap;
        letter-spacing: 0.5px;
      ">${callsign}</span>
    </div>
  `;

  if (onClick) {
    el.addEventListener('click', onClick);
  }

  return el;
}

// Create plane icon as ImageData for maplibre (used for selected flight marker)
function createPlaneIcon(fillColor: string, strokeColor: string, size = 8): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Center the plane
  ctx.translate(size / 2, size / 2);

  // Draw glow effect
  ctx.shadowColor = fillColor;
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Draw plane shape (pointing up, will rotate via icon-rotate)
  ctx.beginPath();
  const scale = size / 16;

  // Plane body (fuselage)
  ctx.moveTo(0 * scale, -12 * scale);  // nose
  ctx.lineTo(-3 * scale, -6 * scale);   // left front
  ctx.lineTo(-3 * scale, 2 * scale);    // left body
  ctx.lineTo(-10 * scale, 8 * scale);   // left wing tip
  ctx.lineTo(-10 * scale, 10 * scale);  // left wing back
  ctx.lineTo(-3 * scale, 6 * scale);    // left wing connect
  ctx.lineTo(-3 * scale, 10 * scale);   // left tail start
  ctx.lineTo(-6 * scale, 13 * scale);   // left tail tip
  ctx.lineTo(-6 * scale, 14 * scale);   // left tail back
  ctx.lineTo(0 * scale, 12 * scale);    // tail center
  ctx.lineTo(6 * scale, 14 * scale);    // right tail back
  ctx.lineTo(6 * scale, 13 * scale);    // right tail tip
  ctx.lineTo(3 * scale, 10 * scale);    // right tail start
  ctx.lineTo(3 * scale, 6 * scale);     // right wing connect
  ctx.lineTo(10 * scale, 10 * scale);   // right wing back
  ctx.lineTo(10 * scale, 8 * scale);    // right wing tip
  ctx.lineTo(3 * scale, 2 * scale);     // right body
  ctx.lineTo(3 * scale, -6 * scale);    // right front
  ctx.closePath();

  // Fill with gradient
  const gradient = ctx.createLinearGradient(0, -12 * scale, 0, 14 * scale);
  gradient.addColorStop(0, fillColor);
  gradient.addColorStop(1, strokeColor);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Draw stroke
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
}

export function MapComponent({ onMouseMove: _onMouseMove, selectedFlight, activeLayers, mode = 'history', onFlightClick, highlight }: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const startMarkerRef = useRef<maplibregl.Marker | null>(null);
  const endMarkerRef = useRef<maplibregl.Marker | null>(null);
  const liveFlightMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [flightTrack, setFlightTrack] = useState<FlightTrack | null>(null);
  const [proximityFlights, setProximityFlights] = useState<ProximityFlightData[]>([]);
  const [learnedLayers, setLearnedLayers] = useState<LearnedLayers | null>(null);
  const [liveFlights, setLiveFlights] = useState<LiveFlightData[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [showWeather, setShowWeather] = useState(true);
  const apiKey = 'r7kaQpfNDVZdaVp23F1r';
  
  // Default center for weather (center of Levant region)
  const WEATHER_CENTER = {
    lat: (TRAINING_BBOX.north + TRAINING_BBOX.south) / 2,
    lon: (TRAINING_BBOX.west + TRAINING_BBOX.east) / 2,
  };

  // Create custom marker element for takeoff/origin (green)
  const createStartMarkerElement = () => {
    const el = document.createElement('div');
    el.className = 'custom-marker start-marker';
    el.innerHTML = `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 40px; height: 40px; background: rgba(16, 185, 129, 0.2); border-radius: 50%; animation: pulse 2s infinite;"></div>
        <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(16, 185, 129, 0.6), inset 0 2px 4px rgba(255,255,255,0.3); border: 2px solid rgba(255,255,255,0.3);">
          <span class="material-symbols-outlined" style="font-size: 16px; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">flight_takeoff</span>
        </div>
      </div>
    `;
    return el;
  };

  // Create custom marker element for landing/destination (red)
  const createEndMarkerElement = (callsign?: string) => {
    const el = document.createElement('div');
    el.className = 'custom-marker end-marker';
    el.innerHTML = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
        ${callsign ? `<div style="background: rgba(0,0,0,0.8); color: #ef4444; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; font-family: monospace; margin-bottom: 4px; border: 1px solid rgba(239, 68, 68, 0.4); box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);">${callsign}</div>` : ''}
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 44px; height: 44px; background: rgba(239, 68, 68, 0.2); border-radius: 50%; animation: pulse 2s infinite;"></div>
          <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(239, 68, 68, 0.6), inset 0 2px 4px rgba(255,255,255,0.3); border: 2px solid rgba(255,255,255,0.3);">
            <span class="material-symbols-outlined" style="font-size: 18px; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">flight_land</span>
          </div>
        </div>
      </div>
    `;
    return el;
  };

  // Fetch live flights when in live mode
  const fetchLiveFlightsData = useCallback(async () => {
    if (mode !== 'live') return;

    try {
      const response = await fetchAllLiveFlights();
      setLiveFlights(response.flights);
    } catch (error) {
      console.warn('Failed to fetch live flights:', error);
    }
  }, [mode]);

  // Poll for live flights
  useEffect(() => {
    if (mode !== 'live') {
      setLiveFlights([]);
      return;
    }

    // Initial fetch
    fetchLiveFlightsData();

    // Set up polling for live mode
    const intervalId = setInterval(fetchLiveFlightsData, LIVE_POLL_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [mode, fetchLiveFlightsData]);

  // Fetch learned layers on mount
  useEffect(() => {
    fetchLearnedLayers()
      .then(data => {
        setLearnedLayers(data);
        console.log('[MapComponent] Loaded learned layers:', {
          paths: data.paths?.length || 0,
          turns: data.turns?.length || 0,
          sids: data.sids?.length || 0,
          stars: data.stars?.length || 0,
        });
      })
      .catch(err => console.warn('[MapComponent] Could not load learned layers:', err));
  }, []);

  // Fetch weather data on mount and refresh every 15 minutes
  useEffect(() => {
    const fetchWeatherData = async () => {
      setWeatherLoading(true);
      try {
        const data = await fetchCurrentWeather(WEATHER_CENTER.lat, WEATHER_CENTER.lon);
        setWeather(data);
        console.log('[MapComponent] Weather loaded:', data.conditions);
      } catch (err) {
        console.warn('[MapComponent] Could not load weather:', err);
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeatherData();
    
    // Refresh weather every 15 minutes
    const intervalId = setInterval(fetchWeatherData, 15 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [WEATHER_CENTER.lat, WEATHER_CENTER.lon]);

  // Fetch flight track when selected flight changes
  useEffect(() => {
    if (!selectedFlight) {
      setFlightTrack(null);
      setProximityFlights([]);
      return;
    }

    let mounted = true;

    const loadTrack = async () => {
      try {
        let track: FlightTrack;

        if (mode === 'live') {
          // In live mode, prefer live research track from live_research.db
          try {
            track = await fetchLiveResearchTrack(selectedFlight.flight_id);
          } catch {
            // Fall back to unified track
            track = await fetchUnifiedTrack(selectedFlight.flight_id);
          }
        } else {
          // In history mode, use unified track with system report fallback
          try {
            track = await fetchUnifiedTrack(selectedFlight.flight_id);
          } catch {
            track = await fetchSystemReportTrack(selectedFlight.flight_id);
          }
        }

        if (mounted && track.points.length > 0) {
          setFlightTrack(track);
        }
      } catch (error) {
        console.warn('Could not load flight track:', error);
        if (mounted) {
          setFlightTrack(null);
        }
      }
    };

    // Load track once (no polling - data doesn't update in real-time)
    loadTrack();

    return () => {
      mounted = false;
    };
  }, [selectedFlight?.flight_id, mode]);

  // Fetch proximity flight tracks when there's a proximity rule
  useEffect(() => {
    if (!selectedFlight?.report?.full_report) {
      setProximityFlights([]);
      return;
    }

    let mounted = true;

    const loadProximityFlights = async () => {
      const rules = selectedFlight.report?.full_report?.matched_rules ||
        selectedFlight.report?.full_report?.layer_1_rules?.report?.matched_rules || [];

      // Find proximity rule (id: 4)
      const proximityRule = rules.find((r: { id?: number }) => r.id === 4) as {
        id?: number;
        details?: { events?: { other_flight?: string }[] };
      } | undefined;

      if (!proximityRule?.details?.events) {
        setProximityFlights([]);
        return;
      }

      // Get unique other flight IDs
      const otherFlightIds = [...new Set(
        proximityRule.details.events
          .map((ev: { other_flight?: string }) => ev.other_flight)
          .filter((id): id is string => Boolean(id) && id !== selectedFlight.flight_id)
      )];

      if (otherFlightIds.length === 0) {
        setProximityFlights([]);
        return;
      }

      // Fetch tracks for other flights
      const results = await Promise.all(
        otherFlightIds.map(async (id) => {
          try {
            const data = await fetchReplayOtherFlight(id);
            return {
              id,
              callsign: data.callsign,
              points: data.points,
            };
          } catch (err) {
            console.warn(`Could not load proximity flight ${id}:`, err);
            return null;
          }
        })
      );

      if (mounted) {
        setProximityFlights(results.filter((f): f is ProximityFlightData => f !== null));
      }
    };

    loadProximityFlights();

    return () => {
      mounted = false;
    };
  }, [selectedFlight?.report?.full_report, selectedFlight?.flight_id]);

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

      // Create plane icon (blue/cyan for normal flights) -- size reduced to 8
      const planeIconBlue = createPlaneIcon('#06b6d4', '#0891b2', 8);
      map.current.addImage('plane-blue', planeIconBlue, { sdf: false });

      // Create plane icon (red for anomaly flights) -- size reduced to 8
      const planeIconRed = createPlaneIcon('#ef4444', '#dc2626', 8);
      map.current.addImage('plane-red', planeIconRed, { sdf: false });

      // ... rest unchanged ...
      // [the remaining map layer and source setup is unchanged]
      // The rest of the original code (not shown here for brevity) is unchanged.
      // ---BEGIN unchanged setup---
      // Training Region Bounding Box source
      map.current.addSource('training-bbox', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [TRAINING_BBOX.west, TRAINING_BBOX.north],
              [TRAINING_BBOX.east, TRAINING_BBOX.north],
              [TRAINING_BBOX.east, TRAINING_BBOX.south],
              [TRAINING_BBOX.west, TRAINING_BBOX.south],
              [TRAINING_BBOX.west, TRAINING_BBOX.north],
            ]],
          },
        },
      });

      map.current.addSource('learned-paths', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current.addSource('learned-turns', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current.addSource('learned-sids', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current.addSource('learned-stars', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Flight track source
      map.current.addSource('flight-track', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Anomaly points source
      map.current.addSource('anomaly-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // AI Highlighted segment source (yellow/orange for AI-pointed segments)
      map.current.addSource('highlight-segment', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // AI Highlighted point source (for point highlights)
      map.current.addSource('highlight-point', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Proximity flight tracks source
      map.current.addSource('proximity-tracks', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Proximity end markers source
      map.current.addSource('proximity-end-markers', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Training Region Bounding Box fill layer (subtle yellow)
      map.current.addLayer({
        id: 'training-bbox-fill',
        type: 'fill',
        source: 'training-bbox',
        layout: { 'visibility': 'none' },
        paint: { 'fill-color': '#fbbf24', 'fill-opacity': 0.05 },
      });

      // Training Region Bounding Box line layer (dashed yellow border)
      map.current.addLayer({
        id: 'training-bbox-line',
        type: 'line',
        source: 'training-bbox',
        layout: { 'line-join': 'round', 'line-cap': 'round', 'visibility': 'none' },
        paint: { 'line-color': '#fbbf24', 'line-width': 2, 'line-opacity': 0.8, 'line-dasharray': [6, 4] },
      });

      // Learned paths layer (green)
      map.current.addLayer({
        id: 'learned-paths-layer',
        type: 'line',
        source: 'learned-paths',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#22c55e', 'line-width': 2, 'line-opacity': 0.6 },
      });

      // Learned turns layer (orange fill)
      map.current.addLayer({
        id: 'learned-turns-layer',
        type: 'fill',
        source: 'learned-turns',
        paint: { 'fill-color': '#f97316', 'fill-opacity': 0.15, 'fill-outline-color': '#f97316' },
      });

      // SIDs layer (blue dashed)
      map.current.addLayer({
        id: 'learned-sids-layer',
        type: 'line',
        source: 'learned-sids',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3b82f6', 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [4, 4] },
      });

      // STARs layer (pink dashed)
      map.current.addLayer({
        id: 'learned-stars-layer',
        type: 'line',
        source: 'learned-stars',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ec4899', 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [4, 4] },
      });

      // Flight track glow layer
      map.current.addLayer({
        id: 'flight-track-glow',
        type: 'line',
        source: 'flight-track',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#06b6d4', 'line-width': 6, 'line-opacity': 0.3, 'line-blur': 2 },
      });

      // Flight track line layer
      map.current.addLayer({
        id: 'flight-track-line',
        type: 'line',
        source: 'flight-track',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#06b6d4', 'line-width': 2, 'line-opacity': 0.9 },
      });

      // Anomaly points - small red circles
      map.current.addLayer({
        id: 'anomaly-points-circle',
        type: 'circle',
        source: 'anomaly-points',
        paint: { 'circle-radius': 4, 'circle-color': '#ef4444', 'circle-opacity': 0.9, 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff' },
      });

      // AI Highlighted segment - thick yellow/orange line (glow effect)
      map.current.addLayer({
        id: 'highlight-segment-glow',
        type: 'line',
        source: 'highlight-segment',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#fbbf24', 'line-width': 12, 'line-opacity': 0.4, 'line-blur': 3 },
      });

      // AI Highlighted segment - main line
      map.current.addLayer({
        id: 'highlight-segment-line',
        type: 'line',
        source: 'highlight-segment',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#fbbf24', 'line-width': 5, 'line-opacity': 1 },
      });

      // AI Highlighted point - outer glow
      map.current.addLayer({
        id: 'highlight-point-glow',
        type: 'circle',
        source: 'highlight-point',
        paint: { 'circle-radius': 20, 'circle-color': '#ff9500', 'circle-opacity': 0.3, 'circle-blur': 1 },
      });

      // AI Highlighted point - main circle
      map.current.addLayer({
        id: 'highlight-point-circle',
        type: 'circle',
        source: 'highlight-point',
        paint: { 'circle-radius': 10, 'circle-color': '#ff9500', 'circle-opacity': 0.9, 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' },
      });

      // Proximity flight tracks - dashed red lines
      map.current.addLayer({
        id: 'proximity-tracks-line',
        type: 'line',
        source: 'proximity-tracks',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ef4444', 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [4, 4] },
      });

      // Proximity end markers - small red circles
      map.current.addLayer({
        id: 'proximity-end-markers-circle',
        type: 'circle',
        source: 'proximity-end-markers',
        paint: { 'circle-radius': 5, 'circle-color': '#ef4444', 'circle-opacity': 0.8, 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff' },
      });

      // Proximity end markers label
      map.current.addLayer({
        id: 'proximity-end-markers-label',
        type: 'symbol',
        source: 'proximity-end-markers',
        layout: { 'text-field': ['get', 'callsign'], 'text-offset': [0, -1.3], 'text-size': 10, 'text-anchor': 'bottom', 'text-allow-overlap': true },
        paint: { 'text-color': '#ef4444', 'text-halo-color': '#000000', 'text-halo-width': 2 },
      });

      setIsMapReady(true);
    });

    // ... Unchanged event handlers (mousemove, click, etc) ...

    return () => {
      // Clean up live flight markers
      liveFlightMarkersRef.current.forEach(marker => marker.remove());
      liveFlightMarkersRef.current.clear();

      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Rest of the code (all unchanged)
  // [no changes required below with respect to the plane icon size]

  // Helper to safely set layout property only if layer exists
  const safeSetLayoutProperty = useCallback((layerId: string, property: string, value: string) => {
    if (map.current && map.current.getLayer(layerId)) {
      map.current.setLayoutProperty(layerId, property, value);
    }
  }, []);

  // Update layer visibility based on activeLayers
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    // Track layers
    const trackVisible = activeLayers.includes('track');
    safeSetLayoutProperty('flight-track-glow', 'visibility', trackVisible ? 'visible' : 'none');
    safeSetLayoutProperty('flight-track-line', 'visibility', trackVisible ? 'visible' : 'none');
    // Hide circle marker layers - we use custom HTML markers instead
    safeSetLayoutProperty('start-marker-glow', 'visibility', 'none');
    safeSetLayoutProperty('start-marker-circle', 'visibility', 'none');
    safeSetLayoutProperty('start-marker-inner', 'visibility', 'none');
    safeSetLayoutProperty('end-marker-glow', 'visibility', 'none');
    safeSetLayoutProperty('end-marker-circle', 'visibility', 'none');
    safeSetLayoutProperty('end-marker-inner', 'visibility', 'none');
    safeSetLayoutProperty('end-marker-label', 'visibility', 'none');

    // Toggle custom HTML markers visibility based on track layer
    if (startMarkerRef.current) {
      startMarkerRef.current.getElement().style.display = trackVisible ? 'block' : 'none';
    }
    if (endMarkerRef.current) {
      endMarkerRef.current.getElement().style.display = trackVisible ? 'block' : 'none';
    }

    // Proximity tracks follow the main track visibility
    safeSetLayoutProperty('proximity-tracks-line', 'visibility', trackVisible ? 'visible' : 'none');
    safeSetLayoutProperty('proximity-end-markers-circle', 'visibility', trackVisible ? 'visible' : 'none');
    safeSetLayoutProperty('proximity-end-markers-label', 'visibility', trackVisible ? 'visible' : 'none');

    // Anomaly layer
    const anomalyVisible = activeLayers.includes('anomalies');
    safeSetLayoutProperty('anomaly-points-circle', 'visibility', anomalyVisible ? 'visible' : 'none');

    // Learned layers
    safeSetLayoutProperty('learned-paths-layer', 'visibility', activeLayers.includes('paths') ? 'visible' : 'none');
    safeSetLayoutProperty('learned-turns-layer', 'visibility', activeLayers.includes('turns') ? 'visible' : 'none');
    safeSetLayoutProperty('learned-sids-layer', 'visibility', activeLayers.includes('sids') ? 'visible' : 'none');
    safeSetLayoutProperty('learned-stars-layer', 'visibility', activeLayers.includes('stars') ? 'visible' : 'none');

    // Training bbox layer
    const bboxVisible = activeLayers.includes('bbox');
    safeSetLayoutProperty('training-bbox-fill', 'visibility', bboxVisible ? 'visible' : 'none');
    safeSetLayoutProperty('training-bbox-line', 'visibility', bboxVisible ? 'visible' : 'none');
  }, [activeLayers, isMapReady, safeSetLayoutProperty]);

  // Update learned layers data
  useEffect(() => {
    if (!map.current || !isMapReady || !learnedLayers) return;

    // Helper to create circle polygon
    const createCirclePolygon = (lat: number, lon: number, radiusNm: number): [number, number][] => {
      const radiusKm = radiusNm * 1.852;
      const numPoints = 32;
      const coords: [number, number][] = [];
      const distanceX = radiusKm / (111.320 * Math.cos(lat * Math.PI / 180));
      const distanceY = radiusKm / 110.574;

      for (let i = 0; i < numPoints; i++) {
        const theta = (i / numPoints) * (2 * Math.PI);
        const x = distanceX * Math.cos(theta);
        const y = distanceY * Math.sin(theta);
        coords.push([lon + x, lat + y]);
      }
      coords.push(coords[0]);
      return coords;
    };

    // Paths
    const pathsSource = map.current.getSource('learned-paths') as maplibregl.GeoJSONSource;
    if (pathsSource && learnedLayers.paths) {
      const features = learnedLayers.paths
        .filter(p => p.centerline && p.centerline.length >= 2)
        .map(path => ({
          type: 'Feature' as const,
          properties: { id: path.id },
          geometry: {
            type: 'LineString' as const,
            coordinates: path.centerline.map(pt => [pt.lon, pt.lat]),
          },
        }));
      pathsSource.setData({ type: 'FeatureCollection', features });
    }

    // Turns
    const turnsSource = map.current.getSource('learned-turns') as maplibregl.GeoJSONSource;
    if (turnsSource && learnedLayers.turns) {
      const features = learnedLayers.turns.map(turn => ({
        type: 'Feature' as const,
        properties: { id: turn.id },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [createCirclePolygon(turn.lat, turn.lon, turn.radius_nm || 2)],
        },
      }));
      turnsSource.setData({ type: 'FeatureCollection', features });
    }

    // SIDs
    const sidsSource = map.current.getSource('learned-sids') as maplibregl.GeoJSONSource;
    if (sidsSource && learnedLayers.sids) {
      const features = learnedLayers.sids
        .filter(s => s.centerline && s.centerline.length >= 2)
        .map(sid => ({
          type: 'Feature' as const,
          properties: { id: sid.id, airport: sid.airport },
          geometry: {
            type: 'LineString' as const,
            coordinates: sid.centerline.map((pt: { lon: number; lat: number }) => [pt.lon, pt.lat]),
          },
        }));
      sidsSource.setData({ type: 'FeatureCollection', features });
    }

    // STARs
    const starsSource = map.current.getSource('learned-stars') as maplibregl.GeoJSONSource;
    if (starsSource && learnedLayers.stars) {
      const features = learnedLayers.stars
        .filter(s => s.centerline && s.centerline.length >= 2)
        .map(star => ({
          type: 'Feature' as const,
          properties: { id: star.id, airport: star.airport },
          geometry: {
            type: 'LineString' as const,
            coordinates: star.centerline.map((pt: { lon: number; lat: number }) => [pt.lon, pt.lat]),
          },
        }));
      starsSource.setData({ type: 'FeatureCollection', features });
    }
  }, [learnedLayers, isMapReady]);

  // Update flight track display
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    const trackSource = map.current.getSource('flight-track') as maplibregl.GeoJSONSource;
    const anomalySource = map.current.getSource('anomaly-points') as maplibregl.GeoJSONSource;
    const proximityTracksSource = map.current.getSource('proximity-tracks') as maplibregl.GeoJSONSource;
    const proximityEndSource = map.current.getSource('proximity-end-markers') as maplibregl.GeoJSONSource;

    if (!trackSource || !anomalySource || !proximityTracksSource || !proximityEndSource) return;

    // Clean up existing custom markers
    if (startMarkerRef.current) {
      startMarkerRef.current.remove();
      startMarkerRef.current = null;
    }
    if (endMarkerRef.current) {
      endMarkerRef.current.remove();
      endMarkerRef.current = null;
    }

    if (flightTrack && flightTrack.points.length > 0) {
      // Create line from track points
      const coordinates = flightTrack.points.map(p => [p.lon, p.lat]);
      
      trackSource.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates,
        },
      });

      // Determine start and end points based on timestamp
      const sortedByTime = [...flightTrack.points].sort((a, b) => a.timestamp - b.timestamp);
      const startPoint = sortedByTime[0];
      const endPoint = sortedByTime[sortedByTime.length - 1];

      // Start marker (green takeoff icon at ORIGIN)
      startMarkerRef.current = new maplibregl.Marker({
        element: createStartMarkerElement(),
        anchor: 'center',
      })
        .setLngLat([startPoint.lon, startPoint.lat])
        .addTo(map.current!);

      // End marker
      const callsign = selectedFlight?.callsign || selectedFlight?.flight_id;
      if (mode === 'live') {
        // In live mode, show a plane icon at the end of the track
        let heading = 0;
        if (sortedByTime.length >= 2) {
          const prevPoint = sortedByTime[sortedByTime.length - 2];
          const lastPoint = sortedByTime[sortedByTime.length - 1];
          const lat1 = prevPoint.lat * Math.PI / 180;
          const lat2 = lastPoint.lat * Math.PI / 180;
          const dLon = (lastPoint.lon - prevPoint.lon) * Math.PI / 180;
          const y = Math.sin(dLon) * Math.cos(lat2);
          const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
          heading = Math.atan2(y, x) * 180 / Math.PI;
          if (heading < 0) heading += 360;
        }
        const isAnomaly = selectedFlight?.report?.is_anomaly || false;
        endMarkerRef.current = new maplibregl.Marker({
          element: createLiveFlightMarkerElement(callsign || '', heading, isAnomaly),
          anchor: 'center',
          offset: [0, 12],
        })
          .setLngLat([endPoint.lon, endPoint.lat])
          .addTo(map.current!);
      } else {
        // In history mode, show red landing icon
        endMarkerRef.current = new maplibregl.Marker({
          element: createEndMarkerElement(callsign),
          anchor: 'bottom',
        })
          .setLngLat([endPoint.lon, endPoint.lat])
          .addTo(map.current!);
      }

      // Anomaly points from rule-based detections
      const anomalyFeatures: GeoJSON.Feature[] = [];
      if (selectedFlight?.report?.full_report) {
        const rulesLayer = selectedFlight.report.full_report.layer_1_rules;
        if (rulesLayer?.anomaly_points) {
          rulesLayer.anomaly_points.forEach((p: { lon: number; lat: number; point_score: number }) => {
            anomalyFeatures.push({
              type: 'Feature',
              properties: { score: p.point_score },
              geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
            });
          });
        }
      }
      anomalySource.setData({ type: 'FeatureCollection', features: anomalyFeatures });

      // Proximity flight tracks
      const proximityTrackFeatures: GeoJSON.Feature[] = [];
      const proximityEndFeatures: GeoJSON.Feature[] = [];
      proximityFlights.forEach(pf => {
        if (pf.points.length > 1) {
          proximityTrackFeatures.push({
            type: 'Feature',
            properties: { flightId: pf.id, callsign: pf.callsign },
            geometry: { type: 'LineString', coordinates: pf.points.map(p => [p.lon, p.lat]) },
          });
          const lastPt = pf.points[pf.points.length - 1];
          proximityEndFeatures.push({
            type: 'Feature',
            properties: { callsign: pf.callsign || pf.id },
            geometry: { type: 'Point', coordinates: [lastPt.lon, lastPt.lat] },
          });
        }
      });
      proximityTracksSource.setData({ type: 'FeatureCollection', features: proximityTrackFeatures });
      proximityEndSource.setData({ type: 'FeatureCollection', features: proximityEndFeatures });

      // Fit map to track bounds (only in history mode)
      if (coordinates.length > 0 && mode !== 'live') {
        const bounds = new maplibregl.LngLatBounds();
        coordinates.forEach(coord => bounds.extend(coord as [number, number]));
        proximityFlights.forEach(pf => pf.points.forEach(p => bounds.extend([p.lon, p.lat])));
        map.current.fitBounds(bounds, { padding: 80, maxZoom: 10, duration: 800 });
      }
    } else {
      // Clear all layers
      trackSource.setData({ type: 'FeatureCollection', features: [] });
      anomalySource.setData({ type: 'FeatureCollection', features: [] });
      proximityTracksSource.setData({ type: 'FeatureCollection', features: [] });
      proximityEndSource.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [flightTrack, selectedFlight?.report, selectedFlight?.callsign, selectedFlight?.flight_id, proximityFlights, isMapReady, mode]);

  // Update AI highlight display (segment or point)
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    const highlightSegmentSource = map.current.getSource('highlight-segment') as maplibregl.GeoJSONSource;
    const highlightPointSource = map.current.getSource('highlight-point') as maplibregl.GeoJSONSource;

    if (!highlightSegmentSource || !highlightPointSource) return;

    // Clear previous highlights
    highlightSegmentSource.setData({ type: 'FeatureCollection', features: [] });
    highlightPointSource.setData({ type: 'FeatureCollection', features: [] });

    if (!highlight || !flightTrack?.points || flightTrack.points.length === 0) return;

    // Handle segment highlight
    if (highlight.segment) {
      const { startIndex, endIndex } = highlight.segment;
      const start = Math.max(0, Math.min(startIndex, flightTrack.points.length - 1));
      const end = Math.max(0, Math.min(endIndex, flightTrack.points.length - 1));
      
      // Get coordinates for the segment
      const segmentCoords = flightTrack.points.slice(start, end + 1).map(p => [p.lon, p.lat]);
      
      if (segmentCoords.length >= 2) {
        highlightSegmentSource.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: segmentCoords,
          },
        });
        
        // Pan to show the highlighted segment
        const bounds = new maplibregl.LngLatBounds();
        segmentCoords.forEach(coord => bounds.extend(coord as [number, number]));
        map.current.fitBounds(bounds, { padding: 100, maxZoom: 12, duration: 500 });
      }
    }

    // Handle point highlight
    if (highlight.point) {
      highlightPointSource.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [highlight.point.lon, highlight.point.lat],
        },
      });
      
      // Pan to the highlighted point
      map.current.flyTo({
        center: [highlight.point.lon, highlight.point.lat],
        zoom: 11,
        duration: 500,
      });
    }

    // Handle focus timestamp - find closest point and highlight it
    if (highlight.focusTimestamp && !highlight.point && !highlight.segment) {
      let closestIdx = 0;
      let minDiff = Infinity;
      
      for (let i = 0; i < flightTrack.points.length; i++) {
        const diff = Math.abs(flightTrack.points[i].timestamp - highlight.focusTimestamp);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }
      
      const closestPoint = flightTrack.points[closestIdx];
      if (closestPoint) {
        highlightPointSource.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: [closestPoint.lon, closestPoint.lat],
          },
        });
        
        map.current.flyTo({
          center: [closestPoint.lon, closestPoint.lat],
          zoom: 11,
          duration: 500,
        });
      }
    }
  }, [highlight, flightTrack, isMapReady]);

  // Update live flights display using HTML markers
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    const isLive = mode === 'live';

    // Hide the old symbol layers (we're using HTML markers now)
    safeSetLayoutProperty('live-flights-normal-circle', 'visibility', 'none');
    safeSetLayoutProperty('live-flights-normal-label', 'visibility', 'none');
    safeSetLayoutProperty('live-flights-anomaly-circle', 'visibility', 'none');
    safeSetLayoutProperty('live-flights-anomaly-glow', 'visibility', 'none');
    safeSetLayoutProperty('live-flights-anomaly-inner-glow', 'visibility', 'none');
    safeSetLayoutProperty('live-flights-anomaly-label', 'visibility', 'none');

    if (!isLive) {
      // Remove all live flight markers when not in live mode
      liveFlightMarkersRef.current.forEach(marker => marker.remove());
      liveFlightMarkersRef.current.clear();
      return;
    }

    // Filter out the selected flight when we have track data displayed
    // The selected flight's plane icon is shown at the end of the track instead
    const filteredFlights = flightTrack && selectedFlight?.flight_id
      ? liveFlights.filter(f => f.flight_id !== selectedFlight.flight_id)
      : liveFlights;

    // Track which flight IDs are still present
    const currentFlightIds = new Set(filteredFlights.map(f => f.flight_id));

    // Remove markers for flights that are no longer present
    liveFlightMarkersRef.current.forEach((marker, flightId) => {
      if (!currentFlightIds.has(flightId)) {
        marker.remove();
        liveFlightMarkersRef.current.delete(flightId);
      }
    });

    // Update or create markers for each flight
    filteredFlights.forEach(flight => {
      const existingMarker = liveFlightMarkersRef.current.get(flight.flight_id);
      const callsign = flight.callsign || flight.flight_id.slice(0, 8);

      if (existingMarker) {
        // Update position
        existingMarker.setLngLat([flight.lon, flight.lat]);

        // Update rotation by recreating element (heading may have changed)
        const newElement = createLiveFlightMarkerElement(
          callsign,
          flight.heading || 0,
          flight.is_anomaly,
          onFlightClick ? () => onFlightClick(flight.flight_id, flight.is_anomaly, callsign, flight.origin || undefined, flight.destination || undefined) : undefined
        );
        const oldElement = existingMarker.getElement();
        oldElement.innerHTML = newElement.innerHTML;
      } else {
        // Create new marker
        const element = createLiveFlightMarkerElement(
          callsign,
          flight.heading || 0,
          flight.is_anomaly,
          onFlightClick ? () => onFlightClick(flight.flight_id, flight.is_anomaly, callsign, flight.origin || undefined, flight.destination || undefined) : undefined
        );

        const marker = new maplibregl.Marker({
          element,
          anchor: 'center',
        })
          .setLngLat([flight.lon, flight.lat])
          .addTo(map.current!);

        liveFlightMarkersRef.current.set(flight.flight_id, marker);
      }
    });
  }, [liveFlights, selectedFlight?.flight_id, flightTrack, mode, isMapReady, onFlightClick, safeSetLayoutProperty]);

  // Get wind direction as compass
  const getWindDirection = (deg: number | null): string => {
    if (deg === null) return '--';
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(deg / 22.5) % 16;
    return directions[index];
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Weather Overlay Panel */}
      {showWeather && weather && !weather.error && (
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg p-3 shadow-[0_0_20px_rgba(6,182,212,0.2)] min-w-[180px]">
            {/* Header */}
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Weather</span>
              </div>
              <button 
                onClick={() => setShowWeather(false)}
                className="text-gray-500 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            
            {/* Conditions */}
            <div className="mb-3">
              <div className="text-sm font-medium text-white">{weather.conditions || 'Unknown'}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">Levant Region</div>
            </div>
            
            {/* Weather Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Temperature */}
              <div className="flex items-center gap-1.5 bg-white/5 rounded px-2 py-1.5">
                <Thermometer className="w-3.5 h-3.5 text-orange-400" />
                <div>
                  <div className="text-white font-mono">
                    {weather.temperature_c !== null ? `${weather.temperature_c}°C` : '--'}
                  </div>
                  <div className="text-[9px] text-gray-500">Temp</div>
                </div>
              </div>
              
              {/* Wind */}
              <div className="flex items-center gap-1.5 bg-white/5 rounded px-2 py-1.5">
                <Wind className="w-3.5 h-3.5 text-cyan-400" />
                <div>
                  <div className="text-white font-mono">
                    {weather.wind_speed_kts !== null ? `${weather.wind_speed_kts}kts` : '--'}
                  </div>
                  <div className="text-[9px] text-gray-500">
                    {weather.wind_direction_deg !== null ? `${getWindDirection(weather.wind_direction_deg)} ${weather.wind_direction_deg}°` : 'Wind'}
                  </div>
                </div>
              </div>
              
              {/* Visibility */}
              <div className="flex items-center gap-1.5 bg-white/5 rounded px-2 py-1.5">
                <Eye className="w-3.5 h-3.5 text-green-400" />
                <div>
                  <div className="text-white font-mono">
                    {weather.visibility_nm !== null ? `${weather.visibility_nm}nm` : '--'}
                  </div>
                  <div className="text-[9px] text-gray-500">Visibility</div>
                </div>
              </div>
              
              {/* Cloud Cover */}
              <div className="flex items-center gap-1.5 bg-white/5 rounded px-2 py-1.5">
                <Droplets className="w-3.5 h-3.5 text-blue-400" />
                <div>
                  <div className="text-white font-mono">
                    {weather.cloud_cover_pct !== null ? `${weather.cloud_cover_pct}%` : '--'}
                  </div>
                  <div className="text-[9px] text-gray-500">Clouds</div>
                </div>
              </div>
            </div>
            
            {/* Thunderstorm Warning */}
            {weather.thunderstorm_probability !== null && weather.thunderstorm_probability > 20 && (
              <div className="mt-2 px-2 py-1.5 bg-yellow-500/20 border border-yellow-500/30 rounded text-xs text-yellow-400 flex items-center gap-1.5">
                <span>⚡</span>
                <span>Storm {weather.thunderstorm_probability}%</span>
              </div>
            )}
            
            {/* Pressure */}
            {weather.pressure_hpa !== null && (
              <div className="mt-2 pt-2 border-t border-white/10 flex justify-between text-[10px] text-gray-500">
                <span>QNH</span>
                <span className="font-mono text-gray-400">{weather.pressure_hpa} hPa</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Weather Toggle Button (when panel is hidden) */}
      {!showWeather && (
        <button
          onClick={() => setShowWeather(true)}
          className="absolute top-4 right-4 z-10 bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg p-2 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:bg-black/90 transition-colors"
          title="Show Weather"
        >
          <Cloud className="w-5 h-5 text-cyan-400" />
        </button>
      )}
      
      {/* Weather Loading Indicator */}
      {weatherLoading && (
        <div className="absolute top-4 right-4 z-10 bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading weather...</span>
          </div>
        </div>
      )}
    </div>
  );
}
