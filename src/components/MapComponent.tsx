import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { SelectedFlight, FlightTrack, LearnedLayers, TrackPoint } from '../types';
import { fetchUnifiedTrack, fetchSystemReportTrack, fetchLearnedLayers, fetchReplayOtherFlight, fetchAllLiveFlights, fetchLiveResearchTrack, type LiveFlightData } from '../api';
import type { MapLayer } from './MapControls';

interface MapComponentProps {
  onMouseMove?: (coords: { lat: number; lon: number; elv: number }) => void;
  selectedFlight: SelectedFlight | null;
  activeLayers: MapLayer[];
  mode?: 'live' | 'history';
  onFlightClick?: (flightId: string, isAnomaly: boolean, callsign?: string) => void;
}

interface ProximityFlightData {
  id: string;
  callsign: string | null;
  points: TrackPoint[];
}

const LIVE_POLL_INTERVAL = 10000; // 10 seconds

export function MapComponent({ onMouseMove, selectedFlight, activeLayers, mode = 'history', onFlightClick }: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const startMarkerRef = useRef<maplibregl.Marker | null>(null);
  const endMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [flightTrack, setFlightTrack] = useState<FlightTrack | null>(null);
  const [proximityFlights, setProximityFlights] = useState<ProximityFlightData[]>([]);
  const [learnedLayers, setLearnedLayers] = useState<LearnedLayers | null>(null);
  const [liveFlights, setLiveFlights] = useState<LiveFlightData[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);
  const apiKey = 'r7kaQpfNDVZdaVp23F1r';

  // Create custom marker element for takeoff (green)
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

  // Create custom marker element for landing/current (cyan)
  const createEndMarkerElement = (callsign?: string) => {
    const el = document.createElement('div');
    el.className = 'custom-marker end-marker';
    el.innerHTML = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
        ${callsign ? `<div style="background: rgba(0,0,0,0.8); color: #63d1eb; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; font-family: monospace; margin-bottom: 4px; border: 1px solid rgba(99, 209, 235, 0.4); box-shadow: 0 0 10px rgba(99, 209, 235, 0.3);">${callsign}</div>` : ''}
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

    // Set up polling
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

    // Initial load
    loadTrack();

    // In live mode, periodically refresh the track for the selected flight
    let refreshInterval: number | null = null;
    if (mode === 'live') {
      refreshInterval = window.setInterval(loadTrack, LIVE_POLL_INTERVAL);
    }

    return () => {
      mounted = false;
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
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

      // Learned layers sources
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

      // Learned paths layer (green)
      map.current.addLayer({
        id: 'learned-paths-layer',
        type: 'line',
        source: 'learned-paths',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#22c55e',
          'line-width': 2,
          'line-opacity': 0.6,
        },
      });

      // Learned turns layer (orange fill)
      map.current.addLayer({
        id: 'learned-turns-layer',
        type: 'fill',
        source: 'learned-turns',
        paint: {
          'fill-color': '#f97316',
          'fill-opacity': 0.15,
          'fill-outline-color': '#f97316',
        },
      });

      // SIDs layer (blue dashed)
      map.current.addLayer({
        id: 'learned-sids-layer',
        type: 'line',
        source: 'learned-sids',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 2,
          'line-opacity': 0.6,
          'line-dasharray': [4, 4],
        },
      });

      // STARs layer (pink dashed)
      map.current.addLayer({
        id: 'learned-stars-layer',
        type: 'line',
        source: 'learned-stars',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#ec4899',
          'line-width': 2,
          'line-opacity': 0.6,
          'line-dasharray': [4, 4],
        },
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

      // Start marker source (green pin)
      map.current.addSource('start-marker', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // End marker source (current position)
      map.current.addSource('end-marker', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Proximity flight tracks source (dashed lines)
      map.current.addSource('proximity-tracks', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Proximity end markers source
      map.current.addSource('proximity-end-markers', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Live flights sources
      map.current.addSource('live-flights-normal', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current.addSource('live-flights-anomaly', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Flight track glow layer
      map.current.addLayer({
        id: 'flight-track-glow',
        type: 'line',
        source: 'flight-track',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#06b6d4',
          'line-width': 6,
          'line-opacity': 0.3,
          'line-blur': 2,
        },
      });

      // Flight track line layer
      map.current.addLayer({
        id: 'flight-track-line',
        type: 'line',
        source: 'flight-track',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#06b6d4',
          'line-width': 2,
          'line-opacity': 0.9,
        },
      });

      // Anomaly points - small red circles
      map.current.addLayer({
        id: 'anomaly-points-circle',
        type: 'circle',
        source: 'anomaly-points',
        paint: {
          'circle-radius': 4,
          'circle-color': '#ef4444',
          'circle-opacity': 0.9,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Start marker outer glow (green pulse effect)
      map.current.addLayer({
        id: 'start-marker-glow',
        type: 'circle',
        source: 'start-marker',
        paint: {
          'circle-radius': 18,
          'circle-color': '#10b981',
          'circle-opacity': 0.25,
          'circle-blur': 0.8,
        },
      });

      // Start marker - green circle (takeoff)
      map.current.addLayer({
        id: 'start-marker-circle',
        type: 'circle',
        source: 'start-marker',
        paint: {
          'circle-radius': 10,
          'circle-color': '#10b981',
          'circle-opacity': 1,
          'circle-stroke-width': 3,
          'circle-stroke-color': 'rgba(16, 185, 129, 0.5)',
        },
      });

      // Start marker inner dot
      map.current.addLayer({
        id: 'start-marker-inner',
        type: 'circle',
        source: 'start-marker',
        paint: {
          'circle-radius': 4,
          'circle-color': '#ffffff',
          'circle-opacity': 1,
        },
      });

      // End marker outer glow (cyan pulse effect)
      map.current.addLayer({
        id: 'end-marker-glow',
        type: 'circle',
        source: 'end-marker',
        paint: {
          'circle-radius': 22,
          'circle-color': '#63d1eb',
          'circle-opacity': 0.3,
          'circle-blur': 0.8,
        },
      });

      // End marker - cyan circle (current position / landing)
      map.current.addLayer({
        id: 'end-marker-circle',
        type: 'circle',
        source: 'end-marker',
        paint: {
          'circle-radius': 12,
          'circle-color': '#63d1eb',
          'circle-opacity': 1,
          'circle-stroke-width': 3,
          'circle-stroke-color': 'rgba(99, 209, 235, 0.5)',
        },
      });

      // End marker inner dot
      map.current.addLayer({
        id: 'end-marker-inner',
        type: 'circle',
        source: 'end-marker',
        paint: {
          'circle-radius': 5,
          'circle-color': '#ffffff',
          'circle-opacity': 1,
        },
      });

      // End marker label
      map.current.addLayer({
        id: 'end-marker-label',
        type: 'symbol',
        source: 'end-marker',
        layout: {
          'text-field': ['get', 'callsign'],
          'text-offset': [0, -2],
          'text-size': 12,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-anchor': 'bottom',
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#63d1eb',
          'text-halo-color': '#000000',
          'text-halo-width': 2,
        },
      });

      // Proximity flight tracks - dashed red lines
      map.current.addLayer({
        id: 'proximity-tracks-line',
        type: 'line',
        source: 'proximity-tracks',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#ef4444',
          'line-width': 2,
          'line-opacity': 0.6,
          'line-dasharray': [4, 4],
        },
      });

      // Proximity end markers - small red circles
      map.current.addLayer({
        id: 'proximity-end-markers-circle',
        type: 'circle',
        source: 'proximity-end-markers',
        paint: {
          'circle-radius': 5,
          'circle-color': '#ef4444',
          'circle-opacity': 0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Proximity end markers label
      map.current.addLayer({
        id: 'proximity-end-markers-label',
        type: 'symbol',
        source: 'proximity-end-markers',
        layout: {
          'text-field': ['get', 'callsign'],
          'text-offset': [0, -1.3],
          'text-size': 10,
          'text-anchor': 'bottom',
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ef4444',
          'text-halo-color': '#000000',
          'text-halo-width': 2,
        },
      });

      // Live flights - normal (cyan dots)
      map.current.addLayer({
        id: 'live-flights-normal-circle',
        type: 'circle',
        source: 'live-flights-normal',
        paint: {
          'circle-radius': 5,
          'circle-color': '#06b6d4',
          'circle-opacity': 0.8,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Live flights - normal label (always visible above flights)
      map.current.addLayer({
        id: 'live-flights-normal-label',
        type: 'symbol',
        source: 'live-flights-normal',
        layout: {
          'text-field': ['coalesce', ['get', 'callsign'], ['get', 'flight_id']],
          'text-offset': [0, -1.2],
          'text-size': 10,
          'text-anchor': 'bottom',
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#06b6d4',
          'text-halo-color': '#000000',
          'text-halo-width': 2,
        },
      });

      // Live flights - anomaly (red triangle icons with rotation)
      map.current.addLayer({
        id: 'live-flights-anomaly-circle',
        type: 'circle',
        source: 'live-flights-anomaly',
        paint: {
          'circle-radius': 8,
          'circle-color': '#ef4444',
          'circle-opacity': 0.9,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Live flights - anomaly glow
      map.current.addLayer({
        id: 'live-flights-anomaly-glow',
        type: 'circle',
        source: 'live-flights-anomaly',
        paint: {
          'circle-radius': 16,
          'circle-color': '#ef4444',
          'circle-opacity': 0.3,
          'circle-blur': 1,
        },
      }, 'live-flights-anomaly-circle');

      // Live flights - anomaly label (always visible above flights)
      map.current.addLayer({
        id: 'live-flights-anomaly-label',
        type: 'symbol',
        source: 'live-flights-anomaly',
        layout: {
          'text-field': ['coalesce', ['get', 'callsign'], ['get', 'flight_id']],
          'text-offset': [0, -1.5],
          'text-size': 11,
          'text-anchor': 'bottom',
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ef4444',
          'text-halo-color': '#000000',
          'text-halo-width': 2,
        },
      });

      setIsMapReady(true);
    });

    // Track mouse movement
    map.current.on('mousemove', (e) => {
      if (onMouseMove) {
        onMouseMove({
          lat: e.lngLat.lat,
          lon: e.lngLat.lng,
          elv: 890,
        });
      }
    });

    // Click handlers for live flights - Normal flights
    map.current.on('click', 'live-flights-normal-circle', (e) => {
      if (!onFlightClick || !e.features?.length) return;
      const feature = e.features[0];
      const flightId = feature.properties?.flight_id;
      const callsign = feature.properties?.callsign;
      if (flightId) {
        onFlightClick(flightId, false, callsign);
      }
    });

    // Click handlers for live flights - Anomaly flights
    map.current.on('click', 'live-flights-anomaly-circle', (e) => {
      if (!onFlightClick || !e.features?.length) return;
      const feature = e.features[0];
      const flightId = feature.properties?.flight_id;
      const callsign = feature.properties?.callsign;
      if (flightId) {
        onFlightClick(flightId, true, callsign);
      }
    });

    // Click handler for normal flight labels too
    map.current.on('click', 'live-flights-normal-label', (e) => {
      if (!onFlightClick || !e.features?.length) return;
      const feature = e.features[0];
      const flightId = feature.properties?.flight_id;
      const callsign = feature.properties?.callsign;
      if (flightId) {
        onFlightClick(flightId, false, callsign);
      }
    });

    // Click handler for anomaly flight labels too
    map.current.on('click', 'live-flights-anomaly-label', (e) => {
      if (!onFlightClick || !e.features?.length) return;
      const feature = e.features[0];
      const flightId = feature.properties?.flight_id;
      const callsign = feature.properties?.callsign;
      if (flightId) {
        onFlightClick(flightId, true, callsign);
      }
    });

    // Change cursor on hover for live flights
    const liveLayers = [
      'live-flights-normal-circle', 
      'live-flights-normal-label',
      'live-flights-anomaly-circle',
      'live-flights-anomaly-label'
    ];
    liveLayers.forEach(layer => {
      map.current!.on('mouseenter', layer, () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current!.on('mouseleave', layer, () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update layer visibility based on activeLayers
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    // Track layers
    const trackVisible = activeLayers.includes('track');
    map.current.setLayoutProperty('flight-track-glow', 'visibility', trackVisible ? 'visible' : 'none');
    map.current.setLayoutProperty('flight-track-line', 'visibility', trackVisible ? 'visible' : 'none');
    // Hide circle marker layers - we use custom HTML markers instead
    map.current.setLayoutProperty('start-marker-glow', 'visibility', 'none');
    map.current.setLayoutProperty('start-marker-circle', 'visibility', 'none');
    map.current.setLayoutProperty('start-marker-inner', 'visibility', 'none');
    map.current.setLayoutProperty('end-marker-glow', 'visibility', 'none');
    map.current.setLayoutProperty('end-marker-circle', 'visibility', 'none');
    map.current.setLayoutProperty('end-marker-inner', 'visibility', 'none');
    map.current.setLayoutProperty('end-marker-label', 'visibility', 'none');
    
    // Toggle custom HTML markers visibility based on track layer
    if (startMarkerRef.current) {
      startMarkerRef.current.getElement().style.display = trackVisible ? 'block' : 'none';
    }
    if (endMarkerRef.current) {
      endMarkerRef.current.getElement().style.display = trackVisible ? 'block' : 'none';
    }
    
    // Proximity tracks follow the main track visibility
    map.current.setLayoutProperty('proximity-tracks-line', 'visibility', trackVisible ? 'visible' : 'none');
    map.current.setLayoutProperty('proximity-end-markers-circle', 'visibility', trackVisible ? 'visible' : 'none');
    map.current.setLayoutProperty('proximity-end-markers-label', 'visibility', trackVisible ? 'visible' : 'none');

    // Anomaly layer
    const anomalyVisible = activeLayers.includes('anomalies');
    map.current.setLayoutProperty('anomaly-points-circle', 'visibility', anomalyVisible ? 'visible' : 'none');

    // Learned layers
    map.current.setLayoutProperty('learned-paths-layer', 'visibility', activeLayers.includes('paths') ? 'visible' : 'none');
    map.current.setLayoutProperty('learned-turns-layer', 'visibility', activeLayers.includes('turns') ? 'visible' : 'none');
    map.current.setLayoutProperty('learned-sids-layer', 'visibility', activeLayers.includes('sids') ? 'visible' : 'none');
    map.current.setLayoutProperty('learned-stars-layer', 'visibility', activeLayers.includes('stars') ? 'visible' : 'none');
  }, [activeLayers, isMapReady]);

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

      // Start marker (first point - green takeoff icon)
      const firstPoint = flightTrack.points[0];
      startMarkerRef.current = new maplibregl.Marker({
        element: createStartMarkerElement(),
        anchor: 'center',
      })
        .setLngLat([firstPoint.lon, firstPoint.lat])
        .addTo(map.current!);

      // End marker (last point - red landing icon with label)
      // In live mode, don't show end marker since flight is still moving
      if (mode !== 'live') {
        const lastPoint = flightTrack.points[flightTrack.points.length - 1];
        const callsign = selectedFlight?.callsign || selectedFlight?.flight_id;
        endMarkerRef.current = new maplibregl.Marker({
          element: createEndMarkerElement(callsign),
          anchor: 'bottom',
        })
          .setLngLat([lastPoint.lon, lastPoint.lat])
          .addTo(map.current!);
      }

      // Red anomaly points - ONLY from rule-based detections (layer_1_rules), NOT ML models
      const anomalyFeatures: GeoJSON.Feature[] = [];
      
      if (selectedFlight?.report?.full_report) {
        // Only use layer_1_rules - ignore ML layers completely
        const rulesLayer = selectedFlight.report.full_report.layer_1_rules;
        
        if (rulesLayer?.anomaly_points) {
          rulesLayer.anomaly_points.forEach((p: { lon: number; lat: number; point_score: number }) => {
            const isOnTrack = flightTrack.points.some(tp => {
              const latDiff = Math.abs(tp.lat - p.lat);
              const lonDiff = Math.abs(tp.lon - p.lon);
              return latDiff < 0.01 && lonDiff < 0.01;
            });
            
            if (isOnTrack) {
              anomalyFeatures.push({
                type: 'Feature',
                properties: { score: p.point_score },
                geometry: {
                  type: 'Point',
                  coordinates: [p.lon, p.lat],
                },
              });
            }
          });
        }

        // Fallback: if no direct matches, try to map by timestamp
        if (anomalyFeatures.length === 0 && rulesLayer && rulesLayer.anomaly_points && rulesLayer.anomaly_points.length > 0) {
          rulesLayer.anomaly_points.forEach((p: { lon: number; lat: number; point_score: number; timestamp?: number }) => {
            let closestPoint = flightTrack.points[0];
            
            if (p.timestamp) {
              closestPoint = flightTrack.points.reduce((prev, curr) =>
                Math.abs((curr.timestamp || 0) - p.timestamp!) < Math.abs((prev.timestamp || 0) - p.timestamp!)
                  ? curr
                  : prev
              );
            }

            anomalyFeatures.push({
              type: 'Feature',
              properties: { score: p.point_score },
              geometry: {
                type: 'Point',
                coordinates: [closestPoint.lon, closestPoint.lat],
              },
            });
          });
        }
      }

      anomalySource.setData({
        type: 'FeatureCollection',
        features: anomalyFeatures,
      });

      // Proximity flight tracks (dashed red lines)
      const proximityTrackFeatures: GeoJSON.Feature[] = [];
      const proximityEndFeatures: GeoJSON.Feature[] = [];

      proximityFlights.forEach(pf => {
        if (pf.points.length > 1) {
          // Add track line
          proximityTrackFeatures.push({
            type: 'Feature',
            properties: { flightId: pf.id, callsign: pf.callsign },
            geometry: {
              type: 'LineString',
              coordinates: pf.points.map(p => [p.lon, p.lat]),
            },
          });

          // Add end marker
          const lastPt = pf.points[pf.points.length - 1];
          proximityEndFeatures.push({
            type: 'Feature',
            properties: { callsign: pf.callsign || pf.id },
            geometry: {
              type: 'Point',
              coordinates: [lastPt.lon, lastPt.lat],
            },
          });
        }
      });

      proximityTracksSource.setData({
        type: 'FeatureCollection',
        features: proximityTrackFeatures,
      });

      proximityEndSource.setData({
        type: 'FeatureCollection',
        features: proximityEndFeatures,
      });

      // Fit map to include all tracks
      if (coordinates.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        coordinates.forEach(coord => {
          bounds.extend(coord as [number, number]);
        });
        
        // Also include proximity flight tracks in bounds
        proximityFlights.forEach(pf => {
          pf.points.forEach(p => {
            bounds.extend([p.lon, p.lat]);
          });
        });
        
        map.current.fitBounds(bounds, {
          padding: 80,
          maxZoom: 10,
          duration: 800,
        });
      }
    } else {
      // Clear all layers
      trackSource.setData({ type: 'FeatureCollection', features: [] });
      anomalySource.setData({ type: 'FeatureCollection', features: [] });
      proximityTracksSource.setData({ type: 'FeatureCollection', features: [] });
      proximityEndSource.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [flightTrack, selectedFlight?.report, selectedFlight?.callsign, selectedFlight?.flight_id, proximityFlights, isMapReady, mode]);

  // Update live flights display
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    const normalSource = map.current.getSource('live-flights-normal') as maplibregl.GeoJSONSource;
    const anomalySource = map.current.getSource('live-flights-anomaly') as maplibregl.GeoJSONSource;

    if (!normalSource || !anomalySource) return;

    // Filter flights - exclude the selected flight if any
    const selectedId = selectedFlight?.flight_id;
    const filteredFlights = liveFlights.filter(f => f.flight_id !== selectedId);

    // Split into normal and anomaly flights
    const normalFlights = filteredFlights.filter(f => !f.is_anomaly);
    const anomalyFlights = filteredFlights.filter(f => f.is_anomaly);

    // Create normal flight features (cyan dots)
    const normalFeatures: GeoJSON.Feature[] = normalFlights.map(f => ({
      type: 'Feature',
      properties: {
        flight_id: f.flight_id,
        callsign: f.callsign || f.flight_id,
        heading: f.heading || 0,
      },
      geometry: {
        type: 'Point',
        coordinates: [f.lon, f.lat],
      },
    }));

    // Create anomaly flight features (red icons with labels)
    const anomalyFeatures: GeoJSON.Feature[] = anomalyFlights.map(f => ({
      type: 'Feature',
      properties: {
        flight_id: f.flight_id,
        callsign: f.callsign || f.flight_id,
        heading: f.heading || 0,
        severity: f.severity || 0,
      },
      geometry: {
        type: 'Point',
        coordinates: [f.lon, f.lat],
      },
    }));

    normalSource.setData({
      type: 'FeatureCollection',
      features: normalFeatures,
    });

    anomalySource.setData({
      type: 'FeatureCollection',
      features: anomalyFeatures,
    });

    // Set visibility based on mode
    const isLive = mode === 'live';
    map.current.setLayoutProperty('live-flights-normal-circle', 'visibility', isLive ? 'visible' : 'none');
    map.current.setLayoutProperty('live-flights-normal-label', 'visibility', isLive ? 'visible' : 'none');
    map.current.setLayoutProperty('live-flights-anomaly-circle', 'visibility', isLive ? 'visible' : 'none');
    map.current.setLayoutProperty('live-flights-anomaly-glow', 'visibility', isLive ? 'visible' : 'none');
    map.current.setLayoutProperty('live-flights-anomaly-label', 'visibility', isLive ? 'visible' : 'none');
  }, [liveFlights, selectedFlight?.flight_id, mode, isMapReady]);

  return (
    <div ref={mapContainer} className="w-full h-full" />
  );
}
