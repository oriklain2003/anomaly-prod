import type {
  AnomalyReport,
  FlightTrack,
  FlightStatus,
  FlightMetadata,
  LearnedLayers,
  OverviewStats,
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
