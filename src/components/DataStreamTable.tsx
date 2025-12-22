import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { AnomalyReport, FlightStatus, SelectedFlight } from '../types';
import { FlightRow } from './FlightRow';
import { fetchLiveAnomalies, fetchSystemReports, fetchFlightStatus, fetchUnifiedTrack, fetchSystemReportTrack } from '../api';

interface DataStreamTableProps {
  mode: 'live' | 'history';
  selectedFlight: SelectedFlight | null;
  onFlightSelect: (flight: SelectedFlight) => void;
  selectedDate: Date;
}

// Mock data for when API is unavailable
const MOCK_REPORTS: AnomalyReport[] = [
  {
    flight_id: '8f4a2c1d',
    callsign: 'UAE123',
    timestamp: Date.now() / 1000 - 300,
    is_anomaly: true,
    severity_cnn: 0.85,
    severity_dense: 0.78,
    full_report: {
      summary: { confidence_score: 82, triggers: ['go_around_detected'], origin: 'LLBG', destination: 'EGLL' },
      layer_1_rules: { is_anomaly: true, report: { matched_rules: [{ id: 1, name: 'Go-Around' }] } },
    },
    origin_airport: 'LLBG',
    destination_airport: 'EGLL',
  },
  {
    flight_id: '3b7e9f0a',
    callsign: 'ELY456',
    timestamp: Date.now() / 1000 - 600,
    is_anomaly: true,
    severity_cnn: 0.67,
    severity_dense: 0.72,
    full_report: {
      summary: { confidence_score: 68, triggers: ['altitude_deviation'], origin: 'KJFK', destination: 'LLBG' },
    },
    feedback_rule_names: ['Altitude Deviation'],
    origin_airport: 'KJFK',
    destination_airport: 'LLBG',
  },
  {
    flight_id: '5c8d1e2f',
    callsign: 'THY789',
    timestamp: Date.now() / 1000 - 900,
    is_anomaly: true,
    severity_cnn: 0.92,
    severity_dense: 0.88,
    full_report: {
      summary: { confidence_score: 91, triggers: ['emergency_squawk'], origin: 'LTFM', destination: 'EGLL' },
    },
    feedback_comments: 'Emergency squawk 7700 detected during cruise phase',
    origin_airport: 'LTFM',
    destination_airport: 'EGLL',
  },
  {
    flight_id: 'a1b2c3d4',
    callsign: 'AFR012',
    timestamp: Date.now() / 1000 - 1200,
    is_anomaly: true,
    severity_cnn: 0.45,
    severity_dense: 0.52,
    full_report: {
      summary: { confidence_score: 48, triggers: ['speed_anomaly'], origin: 'LFPG', destination: 'LLBG' },
    },
    origin_airport: 'LFPG',
    destination_airport: 'LLBG',
  },
];

const MOCK_STATUSES: Record<string, FlightStatus> = {
  '8f4a2c1d': { flight_id: '8f4a2c1d', callsign: 'UAE123', status: 'APPROACH', altitude_ft: 8500, speed_kts: 180, heading: 270 },
  '3b7e9f0a': { flight_id: '3b7e9f0a', callsign: 'ELY456', status: 'CRUISE', altitude_ft: 35000, speed_kts: 450, heading: 90 },
  '5c8d1e2f': { flight_id: '5c8d1e2f', callsign: 'THY789', status: 'DESCENT', altitude_ft: 22000, speed_kts: 320, heading: 315 },
  'a1b2c3d4': { flight_id: 'a1b2c3d4', callsign: 'AFR012', status: 'CLIMB', altitude_ft: 18000, speed_kts: 290, heading: 120 },
};

export function DataStreamTable({ mode, selectedFlight, onFlightSelect, selectedDate }: DataStreamTableProps) {
  const [reports, setReports] = useState<AnomalyReport[]>([]);
  const [flightStatuses, setFlightStatuses] = useState<Record<string, FlightStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useMock, setUseMock] = useState(false);

  // Fetch reports based on mode and date
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const loadReports = async () => {
      try {
        setLoading(true);
        setError(null);

        // Calculate timestamps for selected date
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const startTs = Math.floor(startOfDay.getTime() / 1000);
        const endTs = Math.floor(endOfDay.getTime() / 1000);

        let data: AnomalyReport[];
        
        if (mode === 'live') {
          // For live mode, always use current time range
          const now = Math.floor(Date.now() / 1000);
          const dayAgo = now - 24 * 60 * 60;
          data = await fetchLiveAnomalies(dayAgo, now);
        } else {
          // For history mode, use selected date
          data = await fetchSystemReports(startTs, endTs, 200);
        }

        if (mounted) {
          if (data.length === 0) {
            // Use mock data if no real data
            setReports(MOCK_REPORTS);
            setFlightStatuses(MOCK_STATUSES);
            setUseMock(true);
          } else {
            setReports(data);
            setUseMock(false);
          }
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          console.warn('Using mock data:', err);
          setReports(MOCK_REPORTS);
          setFlightStatuses(MOCK_STATUSES);
          setUseMock(true);
          setError(null);
          setLoading(false);
        }
      }
    };

    loadReports();

    // Polling for live mode only
    let pollInterval: number | null = null;
    if (mode === 'live') {
      pollInterval = window.setInterval(loadReports, 30000); // 30 seconds
    }

    return () => {
      mounted = false;
      controller.abort();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [mode, selectedDate]);

  // Fetch flight statuses for live mode
  useEffect(() => {
    if (mode !== 'live' || useMock) return;

    const loadStatuses = async () => {
      const statuses: Record<string, FlightStatus> = {};
      
      for (const report of reports.slice(0, 10)) {
        try {
          const status = await fetchFlightStatus(report.flight_id);
          statuses[report.flight_id] = status;
        } catch {
          // Ignore individual failures
        }
      }
      
      setFlightStatuses(statuses);
    };

    if (reports.length > 0) {
      loadStatuses();
    }
  }, [reports, mode, useMock]);

  const handleSelect = async (report: AnomalyReport) => {
    const status = flightStatuses[report.flight_id];
    
    // First, update selection with basic info so UI is responsive
    const selectedData: SelectedFlight = {
      flight_id: report.flight_id,
      callsign: report.callsign,
      origin: report.origin_airport,
      destination: report.destination_airport,
      anomalyScore: report.severity_cnn * 100,
      report,
      status,
    };
    
    onFlightSelect(selectedData);
    
    // Then fetch the track data in the background
    try {
      let track;
      try {
        // Try unified track first (for live data)
        track = await fetchUnifiedTrack(report.flight_id);
      } catch {
        // Fall back to feedback/tagged track (for history data)
        track = await fetchSystemReportTrack(report.flight_id);
      }
      
      // Update selection with track data
      if (track && track.points && track.points.length > 0) {
        onFlightSelect({
          ...selectedData,
          track,
        });
      }
    } catch (error) {
      console.warn('Could not load flight track:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-xs">Loading {mode === 'live' ? 'live data' : 'system reports'}...</span>
        </div>
      </div>
    );
  }

  if (error && reports.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <AlertTriangle className="w-6 h-6 text-yellow-500" />
          <span className="text-xs text-center px-4">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header - Fixed */}
      <div className="shrink-0 bg-bg-panel border-b border-border-dim">
        <div className="flex items-center justify-between px-4 py-2 text-[10px] text-gray-600 font-medium">
          <span>CALLSIGN</span>
          <div className="flex items-center gap-6">
            <span>{mode === 'live' ? 'SCORE / STATUS' : 'SCORE / REASON'}</span>
            <span className="w-16 text-right">TIME</span>
          </div>
        </div>
      </div>

      {/* Scrollable flight rows */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="divide-y divide-border-dim/50">
          {reports.map((report) => {
            const status = flightStatuses[report.flight_id];
            
            return (
              <FlightRow
                key={report.flight_id}
                report={report}
                mode={mode}
                isSelected={selectedFlight?.flight_id === report.flight_id}
                onSelect={handleSelect}
                status={status?.status}
                altitude={status?.altitude_ft}
                speed={status?.speed_kts}
                heading={status?.heading}
              />
            );
          })}
        </div>

        {reports.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gray-500 text-xs">
            No {mode === 'live' ? 'active flights' : 'system reports'} found
          </div>
        )}
      </div>
    </div>
  );
}
