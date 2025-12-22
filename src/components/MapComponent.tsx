import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { SelectedFlight, FlightTrack, LearnedLayers, TrackPoint } from '../types';
import { fetchUnifiedTrack, fetchSystemReportTrack, fetchLearnedLayers, fetchReplayOtherFlight } from '../api';
import type { MapLayer } from './MapControls';

interface MapComponentProps {
  onMouseMove?: (coords: { lat: number; lon: number; elv: number }) => void;
  selectedFlight: SelectedFlight | null;
  activeLayers: MapLayer[];
}

interface ProximityFlightData {
  id: string;
  callsign: string | null;
  points: TrackPoint[];
}

export function MapComponent({ onMouseMove, selectedFlight, activeLayers }: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [flightTrack, setFlightTrack] = useState<FlightTrack | null>(null);
  const [proximityFlights, setProximityFlights] = useState<ProximityFlightData[]>([]);
  const [learnedLayers, setLearnedLayers] = useState<LearnedLayers | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const apiKey = 'r7kaQpfNDVZdaVp23F1r';

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
        try {
          track = await fetchUnifiedTrack(selectedFlight.flight_id);
        } catch {
          track = await fetchSystemReportTrack(selectedFlight.flight_id);
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

    loadTrack();

    return () => {
      mounted = false;
    };
  }, [selectedFlight?.flight_id]);

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

      // Start marker - green circle
      map.current.addLayer({
        id: 'start-marker-circle',
        type: 'circle',
        source: 'start-marker',
        paint: {
          'circle-radius': 6,
          'circle-color': '#22c55e',
          'circle-opacity': 1,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // End marker - red circle (end of route)
      map.current.addLayer({
        id: 'end-marker-circle',
        type: 'circle',
        source: 'end-marker',
        paint: {
          'circle-radius': 7,
          'circle-color': '#ef4444',
          'circle-opacity': 1,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // End marker label
      map.current.addLayer({
        id: 'end-marker-label',
        type: 'symbol',
        source: 'end-marker',
        layout: {
          'text-field': ['get', 'callsign'],
          'text-offset': [0, -1.5],
          'text-size': 11,
          'text-anchor': 'bottom',
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
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
    map.current.setLayoutProperty('start-marker-circle', 'visibility', trackVisible ? 'visible' : 'none');
    map.current.setLayoutProperty('end-marker-circle', 'visibility', trackVisible ? 'visible' : 'none');
    map.current.setLayoutProperty('end-marker-label', 'visibility', trackVisible ? 'visible' : 'none');
    
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
    const startSource = map.current.getSource('start-marker') as maplibregl.GeoJSONSource;
    const endSource = map.current.getSource('end-marker') as maplibregl.GeoJSONSource;
    const proximityTracksSource = map.current.getSource('proximity-tracks') as maplibregl.GeoJSONSource;
    const proximityEndSource = map.current.getSource('proximity-end-markers') as maplibregl.GeoJSONSource;

    if (!trackSource || !anomalySource || !startSource || !endSource || !proximityTracksSource || !proximityEndSource) return;

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

      // Start marker (first point - green)
      const firstPoint = flightTrack.points[0];
      startSource.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [firstPoint.lon, firstPoint.lat],
        },
      });

      // End marker (last point - red dot with label)
      const lastPoint = flightTrack.points[flightTrack.points.length - 1];
      endSource.setData({
        type: 'Feature',
        properties: {
          callsign: selectedFlight?.callsign || selectedFlight?.flight_id,
        },
        geometry: {
          type: 'Point',
          coordinates: [lastPoint.lon, lastPoint.lat],
        },
      });

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
      startSource.setData({ type: 'FeatureCollection', features: [] });
      endSource.setData({ type: 'FeatureCollection', features: [] });
      proximityTracksSource.setData({ type: 'FeatureCollection', features: [] });
      proximityEndSource.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [flightTrack, selectedFlight?.report, proximityFlights, isMapReady]);

  return (
    <div ref={mapContainer} className="w-full h-full" />
  );
}
