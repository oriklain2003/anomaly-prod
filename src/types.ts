// Core flight data types

export interface TrackPoint {
  lat: number;
  lon: number;
  alt: number;
  timestamp: number;
  gspeed?: number;
  track?: number;
  flight_id?: string;
  callsign?: string;
}

export interface FlightTrack {
  flight_id: string;
  points: TrackPoint[];
}

// Flight status/phase types
export type FlightPhase = 'GROUND' | 'TAKEOFF' | 'CLIMB' | 'CRUISE' | 'DESCENT' | 'APPROACH' | 'LANDING' | 'UNKNOWN';

export interface FlightStatus {
  flight_id: string;
  callsign?: string;
  status: FlightPhase;
  altitude_ft: number;
  speed_kts: number;
  heading: number;
  origin?: string;
  destination?: string;
  eta_minutes?: number;
  lat?: number;
  lon?: number;
}

// Anomaly detection types

export interface AnomalyPoint {
  lat: number;
  lon: number;
  timestamp: number;
  point_score: number;
}

export interface MatchedRule {
  id: number;
  name: string;
  description?: string;
  details?: any;
}

export interface LayerResult {
  is_anomaly?: boolean;
  status?: string;
  score?: number;
  threshold?: number;
  severity?: number;
  error?: string;
  anomaly_points?: AnomalyPoint[];
  triggers?: string[];
  report?: {
    matched_rules?: MatchedRule[];
    [key: string]: any;
  };
}

export interface AnomalyReport {
  flight_id: string;
  callsign?: string;
  flight_number?: string;  // IATA flight number (e.g., "LY123")
  timestamp: number;
  is_anomaly: boolean;
  severity_cnn: number;
  severity_dense: number;
  full_report: {
    summary?: {
      confidence_score?: number;
      triggers?: string[];
      callsign?: string;
      origin?: string;
      destination?: string;
      [key: string]: any;
    };
    layer_1_rules?: LayerResult;
    layer_3_deep_dense?: LayerResult;
    layer_4_deep_cnn?: LayerResult;
    layer_5_transformer?: LayerResult;
    layer_6_hybrid?: LayerResult;
    [key: string]: any;
  };
  // Tagged rule fields (from user_feedback table)
  rule_id?: number;
  rule_name?: string;
  comments?: string;
  other_details?: string;
  // Matched rules from anomaly_reports (denormalized)
  matched_rule_ids?: string | number[];
  matched_rule_names?: string | string[];
  matched_rule_categories?: string | string[];
  // Legacy feedback fields (internal - never expose to user as "tagged")
  feedback_id?: number;
  feedback_comments?: string;
  feedback_rule_id?: number | null;
  feedback_rule_ids?: number[];
  feedback_rule_names?: string[];
  feedback_other_details?: string;
  user_label?: number;
  // Metadata fields
  origin_airport?: string;
  destination_airport?: string;
  airline?: string;
  aircraft_type?: string;
}

// Selected flight context for chat
export interface SelectedFlight {
  flight_id: string;
  callsign?: string;
  origin?: string;
  destination?: string;
  anomalyScore?: number;
  report?: AnomalyReport;
  track?: FlightTrack;
  status?: FlightStatus;
}

// Data stream types for the sidebar

export interface DataStreamEvent {
  id: string;
  time: string;
  unit: string;
  status: string;
  isHostile?: boolean;
  unitType?: 'friendly' | 'neutral' | 'hostile';
}

// Live flight for operations display
export interface LiveFlight {
  flight_id: string;
  callsign?: string;
  anomaly_score: number; // 0-100 percentage
  status: FlightPhase;
  altitude_ft?: number;
  speed_kts?: number;
  heading?: number;
  origin?: string;
  destination?: string;
  timestamp: number;
  is_anomaly: boolean;
}

// History flight for system reports display
export interface HistoryFlight {
  flight_id: string;
  callsign?: string;
  anomaly_score: number;
  reason: string; // Derived from rules/comments
  timestamp: number;
  origin?: string;
  destination?: string;
  report?: AnomalyReport;
}

// Aircraft marker types for the map

export interface Aircraft {
  id: string;
  callsign: string;
  lat: number;
  lon: number;
  alt: number;
  heading: number;
  speed: number;
  type: 'friendly' | 'hostile' | 'unknown';
  status?: string;
}

// Chat types

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sender?: string;
}

export interface AIRecommendation {
  id: string;
  label: string;
  action: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface AlertData {
  id: string;
  title: string;
  description: string;
  severity: 'warning' | 'critical';
  timestamp: string;
  actionLabel?: string;
}

// Statistics types

export interface OverviewStats {
  total_flights: number;
  total_anomalies: number;
  safety_events: number;
  go_arounds: number;
  emergency_codes: number;
  near_miss: number;
  holding_patterns: number;
  military_flights?: number;
  traffic_count?: number;
  return_to_field?: number;
  unplanned_landing?: number;
}

// Learned layers for map display

export interface LearnedPathPoint {
  lat: number;
  lon: number;
  alt: number;
}

export interface LearnedPath {
  id: string;
  origin: string | null;
  destination: string | null;
  centerline: LearnedPathPoint[];
  width_nm?: number;
  member_count: number;
}

export interface LearnedTurnZone {
  id: number;
  lat: number;
  lon: number;
  radius_nm: number;
  avg_alt_ft: number;
  angle_range_deg: [number, number];
  avg_speed_kts: number;
  member_count: number;
  directions: { left: number; right: number };
}

export interface LearnedProcedure {
  id: string;
  airport: string;
  type: 'SID' | 'STAR';
  centerline: LearnedPathPoint[];
  width_nm?: number;
  member_count: number;
}

export interface LearnedLayers {
  paths: LearnedPath[];
  turns: LearnedTurnZone[];
  sids: LearnedProcedure[];
  stars: LearnedProcedure[];
}

// Flight metadata from tagged database
export interface FlightMetadata {
  flight_id: string;
  callsign?: string;
  airline?: string;
  aircraft_type?: string;
  origin_airport?: string;
  destination_airport?: string;
  first_seen_ts?: number;
  last_seen_ts?: number;
  flight_duration_sec?: number;
  total_distance_nm?: number;
  min_altitude_ft?: number;
  max_altitude_ft?: number;
  avg_altitude_ft?: number;
  avg_speed_kts?: number;
  signal_loss_events?: number;
  is_anomaly?: boolean;
  is_military?: boolean;
}

// ============================================================
// Route Check Types
// ============================================================

export interface RouteWaypoint {
  lat: number;
  lon: number;
  alt: number; // altitude in feet
  id: string;
}

export interface Airport {
  code: string;
  name: string;
  lat: number;
  lon: number;
  elevation_ft?: number;
}

// Extended airport with runway data (from airports.json)
export interface RunwayApproach {
  runway_end: string;
  heading: number;
  threshold: { lat: number; lon: number };
  approach_start: { lat: number; lon: number };
  line: Array<{ lat: number; lon: number }>;
}

export interface Runway {
  runway_id: number | null;
  runway_name: string;
  length_ft: number | null;
  width_ft: number | null;
  surface: string | null;
  lighted: boolean;
  closed: boolean;
  approaches: RunwayApproach[];
}

export interface AirportFull {
  ident: string;
  icao_code: string | null;
  iata_code: string | null;
  name: string;
  type: string;
  lat: number;
  lon: number;
  elevation_ft: number | null;
  municipality: string | null;
  country_code: string;
  country_name: string;
  scheduled_service: boolean;
  runways: Runway[];
}

export interface AirportsByCountry {
  [countryCode: string]: {
    name: string;
    code: string;
    airports: AirportFull[];
  };
}

export interface AirportsFullResponse {
  countries: AirportsByCountry;
  total_airports: number;
  total_runways: number;
}

export interface ApproachLine {
  airport_code: string;
  airport_name: string;
  runway: string;
  runway_end: string;
  heading: number;
  line: Array<{ lat: number; lon: number }>;
  threshold: { lat: number; lon: number };
}

export interface ScheduledFlight {
  flight_number: string;
  airline: string;
  departure_airport: string;
  arrival_airport: string;
  scheduled_departure?: string;
  scheduled_arrival?: string;
  aircraft_type?: string;
  type: 'departure' | 'arrival';
  // Runway info (if available)
  runway?: string;
  runway_end?: string;
  approach_heading?: number;
}

export interface ConflictPoint {
  lat: number;
  lon: number;
  alt: number;
  waypoint_index: number;
  distance_nm: number;
  altitude_diff_ft: number;
  estimated_time: string;
}

export interface FlightConflict {
  flight: ScheduledFlight;
  waypoint: ConflictPoint;
  severity: 'low' | 'medium' | 'high';
}

export interface TimeSlotAnalysis {
  time: string;
  conflict_count: number;
  conflicts: FlightConflict[];
}

export interface RouteCheckRequest {
  waypoints: RouteWaypoint[];
  datetime: string; // ISO format
  check_alternatives?: boolean;
}

export interface RouteCheckResponse {
  original_analysis: TimeSlotAnalysis;
  airports_checked: Airport[];
  approach_lines?: ApproachLine[];
  flights_analyzed: number;
  suggestion?: {
    time: string;
    conflict_count: number;
    message: string;
  };
  alternative_slots?: TimeSlotAnalysis[];
}