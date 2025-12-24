import type {
  AnomalyReport,
  FlightTrack,
  FlightStatus,
  FlightMetadata,
  LearnedLayers,
  OverviewStats,
  RouteCheckRequest,
  RouteCheckResponse,
  Airport,
  AirportsFullResponse,
  AirportFull,
} from './types';

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api';

// ============================================================
// Live Flight Data
// ============================================================

export const fetchLiveAnomalies = async (startTs: number, endTs: number): Promise<AnomalyReport[]> => {
  const response = await fetch(`${API_BASE}/live/anomalies?start_ts=${Math.floor(startTs)}&end_ts=${Math.floor(endTs)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch anomalies');
  }
  return response.json();
};

export const fetchLiveTrack = async (flightId: string): Promise<FlightTrack> => {
  const response = await fetch(`${API_BASE}/live/track/${flightId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch track');
  }
  return response.json();
};

export const fetchFlightStatus = async (flightId: string): Promise<FlightStatus> => {
  const response = await fetch(`${API_BASE}/live/flight-status/${flightId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch flight status');
  }
  return response.json();
};

// ============================================================
// Live Monitor Data (from live_research.db)
// ============================================================

export interface LiveFlightData {
  flight_id: string;
  callsign: string | null;
  airline: string | null;
  origin: string | null;
  destination: string | null;
  lat: number;
  lon: number;
  alt: number;
  heading: number;
  speed: number;
  is_anomaly: boolean;
  is_military: boolean;
  severity: number;
  last_seen_ts: number;
}

export interface LiveFlightsResponse {
  flights: LiveFlightData[];
  anomaly_count: number;
  total_count: number;
}

export interface LiveAnomalySince {
  flight_id: string;
  timestamp: number;
  is_anomaly: boolean;
  severity_cnn: number;
  severity_dense: number;
  callsign: string | null;
  airline: string | null;
  origin_airport: string | null;
  destination_airport: string | null;
  matched_rule_names: string | null;
  matched_rule_ids: string | null;
}

export interface LiveAnomaliesSinceResponse {
  anomalies: LiveAnomalySince[];
  count: number;
}

/**
 * Fetch all currently active flights from the live monitor.
 * Returns all flights with their current position and anomaly status.
 */
export const fetchAllLiveFlights = async (): Promise<LiveFlightsResponse> => {
  const response = await fetch(`${API_BASE}/live/flights`);
  if (!response.ok) {
    throw new Error('Failed to fetch live flights');
  }
  return response.json();
};

/**
 * Fetch new anomalies since a specific timestamp.
 * Used for detecting new anomalies and triggering alert sounds.
 */
export const fetchLiveAnomaliesSince = async (sinceTs: number): Promise<LiveAnomaliesSinceResponse> => {
  const response = await fetch(`${API_BASE}/live/anomalies/since?ts=${Math.floor(sinceTs)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch anomalies since timestamp');
  }
  return response.json();
};

/**
 * Fetch flight track from the live research database.
 */
export const fetchLiveResearchTrack = async (flightId: string): Promise<FlightTrack> => {
  const response = await fetch(`${API_BASE}/live/track/research/${flightId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch live research track');
  }
  return response.json();
};

// ============================================================
// History / System Reports (from feedback_tagged.db)
// ============================================================

export const fetchSystemReports = async (startTs: number, endTs: number, limit: number = 200): Promise<AnomalyReport[]> => {
  // Build URL with correct parameter order: start_ts, limit, end_ts
  const url = `${API_BASE}/feedback/tagged/history?start_ts=${Math.floor(startTs)}&limit=${limit}&end_ts=${Math.floor(endTs)}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch system reports');
  }
  return response.json();
};

export const fetchSystemReportTrack = async (flightId: string): Promise<FlightTrack> => {
  const response = await fetch(`${API_BASE}/feedback/tagged/track/${flightId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch report track');
  }
  return response.json();
};

export const fetchFlightMetadata = async (flightId: string): Promise<FlightMetadata> => {
  const response = await fetch(`${API_BASE}/feedback/tagged/metadata/${flightId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch flight metadata');
  }
  return response.json();
};

// ============================================================
// Research Data
// ============================================================

export const fetchResearchAnomalies = async (startTs: number, endTs: number): Promise<AnomalyReport[]> => {
  const response = await fetch(`${API_BASE}/research/anomalies?start_ts=${Math.floor(startTs)}&end_ts=${Math.floor(endTs)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch research anomalies');
  }
  return response.json();
};

export const fetchUnifiedTrack = async (flightId: string): Promise<FlightTrack> => {
  const response = await fetch(`${API_BASE}/track/unified/${flightId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch flight track');
  }
  return response.json();
};

/**
 * Fetch flight track from feedback_tagged.db with fallback to research_new.db.
 * This is especially useful for fetching "other flights" in proximity alerts.
 */
export const fetchFeedbackTrack = async (flightId: string): Promise<FlightTrack> => {
  const response = await fetch(`${API_BASE}/feedback/track/${flightId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch track for ${flightId}`);
  }
  return response.json();
};

/**
 * Fetch "other flight" data for replay (proximity alerts).
 * Searches anomalies_tracks then normal_tracks in feedback_tagged.db,
 * then falls back to research_new.db. Also includes flight metadata.
 */
export interface ReplayOtherFlightResponse {
  flight_id: string;
  callsign: string | null;
  points: FlightTrack['points'];
  metadata: FlightMetadata | null;
  source: string;
  total_points: number;
}

export const fetchReplayOtherFlight = async (flightId: string): Promise<ReplayOtherFlightResponse> => {
  const response = await fetch(`${API_BASE}/replay/other-flight/${flightId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch other flight data for ${flightId}`);
  }
  return response.json();
};

// ============================================================
// Learned Layers (Paths, Turns, SIDs, STARs)
// ============================================================

export const fetchLearnedLayers = async (): Promise<LearnedLayers> => {
  const response = await fetch(`${API_BASE}/learned-layers`);
  if (!response.ok) {
    throw new Error('Failed to fetch learned layers');
  }
  return response.json();
};

// ============================================================
// Rules
// ============================================================

export const fetchRules = async (): Promise<{ id: number; name: string; description: string }[]> => {
  const response = await fetch(`${API_BASE}/rules`);
  if (!response.ok) {
    throw new Error('Failed to fetch rules');
  }
  return response.json();
};

export const fetchFlightsByRule = async (ruleId: number, signal?: AbortSignal): Promise<AnomalyReport[]> => {
  const response = await fetch(`${API_BASE}/rules/${ruleId}/flights`, { signal });
  if (!response.ok) {
    throw new Error('Failed to fetch flights by rule');
  }
  return response.json();
};

// ============================================================
// Statistics
// ============================================================

export const fetchStatsOverview = async (startTs: number, endTs: number): Promise<OverviewStats> => {
  const response = await fetch(`${API_BASE}/stats/overview?start_ts=${Math.floor(startTs)}&end_ts=${Math.floor(endTs)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch overview stats');
  }
  return response.json();
};

export interface TaggedStatsOverview {
  total_flights: number;
  total_anomalies: number;
  safety_events: number;
  go_arounds: number;
  emergency_codes: number;
  near_miss: number;
  holding_patterns: number;
  military_flights: number;
  return_to_field: number;
  unplanned_landing: number;
  avg_severity: number;
}

export const fetchTaggedStatsOverview = async (startTs: number, endTs: number): Promise<TaggedStatsOverview> => {
  const response = await fetch(`${API_BASE}/stats/tagged/overview?start_ts=${Math.floor(startTs)}&end_ts=${Math.floor(endTs)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch tagged stats');
  }
  return response.json();
};

// ============================================================
// Batch APIs - Reduces multiple API calls to single requests
// ============================================================

export interface SafetyBatchResponse {
  emergency_codes?: EmergencyCodeStat[];
  near_miss?: NearMissEvent[];
  go_arounds?: GoAroundStat[];
  go_arounds_hourly?: { hour: number; count: number }[];
  safety_monthly?: { month: string; emergencies: number; near_miss: number; go_arounds: number }[];
  near_miss_locations?: { lat: number; lon: number; severity: string; count: number }[];
  safety_by_phase?: Record<string, { total: number; emergency: number; near_miss: number; go_around: number }>;
  emergency_aftermath?: { code: string; flights: number; diverted: number; continued: number; returned: number }[];
  top_airline_emergencies?: { airline: string; count: number; codes: string[] }[];
  near_miss_by_country?: Record<string, number>;
}

export interface IntelligenceBatchResponse {
  airline_efficiency?: { airline: string; flights: number; anomaly_rate: number; avg_delay: number }[];
  holding_patterns?: HoldingPatternStat[];
  gps_jamming?: GPSJammingPoint[];
  military_patterns?: MilitaryPatternStat[];
  pattern_clusters?: PatternCluster[];
  military_routes?: { route_id: string; waypoints: { lat: number; lon: number }[]; flight_count: number }[] | null;
  airline_activity?: { airline: string; daily_counts: { date: string; count: number }[] }[] | null;
}

/**
 * Fetch all safety statistics in a single request.
 * Replaces 10 parallel API calls with 1.
 */
export const fetchSafetyBatch = async (
  startTs: number, 
  endTs: number, 
  include?: string[]
): Promise<SafetyBatchResponse> => {
  const response = await fetch(`${API_BASE}/stats/safety/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start_ts: Math.floor(startTs),
      end_ts: Math.floor(endTs),
      include: include || [
        'emergency_codes', 'near_miss', 'go_arounds', 'hourly',
        'monthly', 'locations', 'phase', 'aftermath', 'top_airlines', 'by_country'
      ]
    })
  });
  if (!response.ok) {
    throw new Error('Failed to fetch safety batch');
  }
  return response.json();
};

/**
 * Fetch all intelligence statistics in a single request.
 * Replaces 7 parallel API calls with 1.
 */
export const fetchIntelligenceBatch = async (
  startTs: number, 
  endTs: number, 
  include?: string[]
): Promise<IntelligenceBatchResponse> => {
  const response = await fetch(`${API_BASE}/intel/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start_ts: Math.floor(startTs),
      end_ts: Math.floor(endTs),
      include: include || [
        'efficiency', 'holding', 'gps_jamming', 'military',
        'clusters', 'routes', 'activity'
      ]
    })
  });
  if (!response.ok) {
    throw new Error('Failed to fetch intelligence batch');
  }
  return response.json();
};

// Types for batch responses (used above)
export interface EmergencyCodeStat {
  code: string;
  description: string;
  count: number;
  airlines: { airline: string; count: number }[];
}

export interface NearMissEvent {
  flight_id: string;
  callsign: string;
  other_flight_id: string;
  other_callsign: string;
  min_distance_nm: number;
  timestamp: number;
  lat: number;
  lon: number;
  severity: string;
}

export interface GoAroundStat {
  airport: string;
  count: number;
  flights: { flight_id: string; callsign: string; timestamp: number }[];
}

export interface HoldingPatternStat {
  location: string;
  lat: number;
  lon: number;
  count: number;
  avg_duration_min: number;
  airports: string[];
}

export interface GPSJammingPoint {
  lat: number;
  lon: number;
  intensity: number;
  affected_flights: number;
  first_seen: number;
  last_seen: number;
}

export interface MilitaryPatternStat {
  callsign: string;
  aircraft_type: string;
  flights: number;
  total_hours: number;
  regions: string[];
}

export interface PatternCluster {
  cluster_id: string;
  pattern_type: string;
  count: number;
  flights: string[];
  center: { lat: number; lon: number };
}

// ============================================================
// AI / Chat
// ============================================================

// General chat request (for queries without a focused flight)
export interface ChatRequest {
  message: string;
  history?: { role: string; content: string }[];
  context?: {
    flight_id?: string;
    callsign?: string;
    timestamp?: number;
  };
}

export interface ChatResponse {
  type?: 'message' | 'flights';
  response: string;
  actions?: any[];
  flights?: AnomalyReport[];
}

/**
 * Send a general query to the AI reasoning agent (no specific flight context).
 * Used for general questions like "show me anomalies today" etc.
 */
export const sendChatMessage = async (request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> => {
  const response = await fetch(`${API_BASE}/ai/reasoning`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal,
  });
  
  if (!response.ok) {
    throw new Error('Failed to send chat message');
  }
  
  return response.json();
};

// Flight-focused analysis request
export interface AnalyzeRequest {
  screenshot?: string;  // base64 PNG (optional)
  question: string;
  flight_id: string;
  flight_data: any[];  // Array of track points - REQUIRED
  anomaly_report?: any;
  selected_point?: { lat: number; lon: number; timestamp: number };
  history?: { role: string; content: string }[];
  length?: 'short' | 'medium' | 'long';
  language?: string;
}

export interface AnalyzeResponse {
  response: string;
  actions?: any[];
}

/**
 * Send a question about a specific flight to the AI analyze endpoint.
 * Used when a flight is selected and user asks about that flight.
 * Requires flight_data as array of track points.
 */
export const analyzeWithAI = async (request: AnalyzeRequest, signal?: AbortSignal): Promise<AnalyzeResponse> => {
  const response = await fetch(`${API_BASE}/ai/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      screenshot: request.screenshot || '',
      question: request.question,
      flight_id: request.flight_id,
      flight_data: request.flight_data,
      anomaly_report: request.anomaly_report,
      selected_point: request.selected_point,
      history: request.history || [],
      length: request.length || 'medium',
      language: request.language || 'en',
    }),
    signal,
  });
  
  if (!response.ok) {
    throw new Error('Failed to analyze flight');
  }
  
  return response.json();
};

// ============================================================
// Route Check
// ============================================================

/**
 * Get list of airports with coordinates.
 */
export const fetchAirports = async (): Promise<Airport[]> => {
  const response = await fetch(`${API_BASE}/route-check/airports`);
  if (!response.ok) {
    throw new Error('Failed to fetch airports');
  }
  return response.json();
};

/**
 * Analyze a route for potential conflicts with scheduled traffic.
 */
export const analyzeRoute = async (request: RouteCheckRequest, signal?: AbortSignal): Promise<RouteCheckResponse> => {
  const response = await fetch(`${API_BASE}/route-check/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to analyze route');
  }
  
  return response.json();
};

/**
 * Get airports with full data including runways and approach lines.
 * 
 * @param options - Filter options
 * @param options.country - Filter by country code (IL, JO, LB, etc.)
 * @param options.withRunwaysOnly - Only return airports with runway data
 * @param options.withScheduledService - Only return airports with scheduled service
 * @param options.airportTypes - Comma-separated types (large_airport, medium_airport, etc.)
 */
export const fetchAirportsFull = async (options?: {
  country?: string;
  withRunwaysOnly?: boolean;
  withScheduledService?: boolean;
  airportTypes?: string;
}): Promise<AirportsFullResponse> => {
  const params = new URLSearchParams();
  
  if (options?.country) params.set('country', options.country);
  if (options?.withRunwaysOnly) params.set('with_runways_only', 'true');
  if (options?.withScheduledService) params.set('with_scheduled_service', 'true');
  if (options?.airportTypes) params.set('airport_types', options.airportTypes);
  
  const url = params.toString() 
    ? `${API_BASE}/route-check/airports-full?${params}`
    : `${API_BASE}/route-check/airports-full`;
    
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch airports');
  }
  return response.json();
};

/**
 * Get detailed info for a single airport including runway approach lines.
 */
export const fetchAirportDetails = async (code: string): Promise<AirportFull> => {
  const response = await fetch(`${API_BASE}/route-check/airport/${encodeURIComponent(code)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch airport ${code}`);
  }
  return response.json();
};

/**
 * Create a route line between two airports with runway approach/departure paths.
 */
export const createRouteLine = async (origin: string, destination: string): Promise<{
  origin: { code: string; name: string; lat: number; lon: number; runways: any[] };
  destination: { code: string; name: string; lat: number; lon: number; runways: any[] };
  direct_line: Array<{ lat: number; lon: number }>;
  distance_nm: number;
}> => {
  const response = await fetch(`${API_BASE}/route-check/route-line?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to create route line');
  }
  
  return response.json();
};
