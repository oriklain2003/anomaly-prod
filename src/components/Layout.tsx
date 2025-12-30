import { useState, useRef, useCallback, useEffect } from 'react';
import { Header } from './Header';
import { OperationsSidebar, type AIResultsData } from './OperationsSidebar';
import { MapArea } from './MapArea';
import { TacticalChat } from './TacticalChat';
import { ReplayModal, type ReplayEvent } from './ReplayModal';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SelectedFlight, HighlightState } from '../types';
import { fetchLiveResearchTrack, fetchLiveAnomalies } from '../api';

// Alert sound hook for new anomaly detection
// Uses Web Audio API to generate a synthetic alert tone
function useAlertSound() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastPlayedRef = useRef<number>(0);
  const MIN_INTERVAL = 3000; // Minimum 3 seconds between sounds

  const playAlert = useCallback(() => {
    const now = Date.now();
    if (now - lastPlayedRef.current < MIN_INTERVAL) {
      return; // Debounce
    }
    lastPlayedRef.current = now;

    try {
      // Create audio context on first play (required for browsers)
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      
      // Create oscillator for alert tone
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Two-tone alert sound (like radar ping)
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
      oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2); // A5
      
      // Volume envelope
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      oscillator.type = 'sine';
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);
      
      console.log('[Alert] Playing anomaly alert sound');
    } catch (err) {
      console.warn('Could not play alert sound:', err);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return playAlert;
}

// Replay data interface
interface ReplayData {
  mainFlightId: string;
  secondaryFlightIds: string[];
  events: ReplayEvent[];
}

export function Layout() {
  const [selectedFlight, setSelectedFlight] = useState<SelectedFlight | null>(null);
  const [mode, setMode] = useState<'live' | 'history' | 'ai'>('history');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  
  // Sidebar collapse states
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  
  // Replay modal state - lifted to Layout for fullscreen display
  const [showReplay, setShowReplay] = useState(false);
  const [replayData, setReplayData] = useState<ReplayData | null>(null);
  
  // AI Results state
  const [aiResults, setAiResults] = useState<AIResultsData | null>(null);
  const [aiResultsLoading, _setAiResultsLoading] = useState(false);
  
  // Highlight state from AI chat - shown on main map
  const [highlightState, setHighlightState] = useState<HighlightState | null>(null);
  
  const playAlert = useAlertSound();
  
  // Handler to open replay modal - passed to TacticalChat
  const handleOpenReplay = useCallback((data: ReplayData) => {
    setReplayData(data);
    setShowReplay(true);
  }, []);
  
  // Handler to close replay modal
  const handleCloseReplay = useCallback(() => {
    setShowReplay(false);
    setReplayData(null);
  }, []);
  
  // Handler for AI results from TacticalChat
  const handleAIResults = useCallback((data: AIResultsData) => {
    console.log('[Layout] AI Results received:', data.flights.length, 'flights for query:', data.query);
    setAiResults(data);
    // Auto-switch to AI Results tab when new results arrive
    setMode('ai');
    // Play alert sound for new results
    playAlert();
  }, [playAlert]);
  
  // Handler to clear AI results
  const handleClearAIResults = useCallback(() => {
    setAiResults(null);
    // Optionally switch back to history mode
    setMode('history');
  }, []);
  
  // Handler for AI highlight state - first shows on main map, then in 3D when opened
  const handleHighlight = useCallback((highlight: HighlightState | null) => {
    console.log('[Layout] AI highlight received:', highlight);
    setHighlightState(highlight);
  }, []);

  const handleFlightSelect = (flight: SelectedFlight) => {
    setSelectedFlight(flight);
  };

  // Handler to update the currently selected flight's data (e.g., after refresh)
  const handleFlightUpdate = useCallback((flight: SelectedFlight) => {
    // Only update if it's the same flight that's currently selected
    setSelectedFlight(prev => {
      if (prev && prev.flight_id === flight.flight_id) {
        return flight;
      }
      return prev;
    });
  }, []);

  const handleModeChange = (newMode: 'live' | 'history' | 'ai') => {
    setMode(newMode);
    // Clear selection when switching modes (except when switching to AI mode)
    if (newMode !== 'ai') {
      setSelectedFlight(null);
    }
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    // Clear selection when changing date
    setSelectedFlight(null);
  };

  // Handle new anomaly detection - play alert sound
  const handleNewAnomaly = useCallback((flightId: string) => {
    console.log('[Layout] New anomaly detected:', flightId);
    playAlert();
  }, [playAlert]);

  // Handle flight click from map
  const handleMapFlightClick = useCallback(async (flightId: string, isAnomaly: boolean, callsign?: string, origin?: string, destination?: string) => {
    console.log('[Layout] Flight clicked on map:', flightId, 'isAnomaly:', isAnomaly, 'origin:', origin, 'dest:', destination);
    
    try {
      // Create a basic selected flight object with origin/destination from live data
      const selectedFlightObj: SelectedFlight = {
        flight_id: flightId,
        callsign: callsign || flightId,
        origin: origin,
        destination: destination,
      };

      // Try to load track data with full metadata
      try {
        const trackData = await fetchLiveResearchTrack(flightId);
        if (trackData?.points?.length > 0) {
          // Set track with flight_id and points
          selectedFlightObj.track = {
            flight_id: trackData.flight_id,
            points: trackData.points,
          };
          
          // Use metadata from track response for expanded info
          if (!selectedFlightObj.callsign && trackData.callsign) {
            selectedFlightObj.callsign = trackData.callsign;
          }
          if (!selectedFlightObj.origin && trackData.origin_airport) {
            selectedFlightObj.origin = trackData.origin_airport;
          }
          if (!selectedFlightObj.destination && trackData.destination_airport) {
            selectedFlightObj.destination = trackData.destination_airport;
          }
          
          // Build a synthetic report with metadata for the expanded info panel
          // This ensures MapArea has all the data it needs for the expanded view
          if (!selectedFlightObj.report) {
            selectedFlightObj.report = {
              flight_id: flightId,
              callsign: trackData.callsign || callsign,
              flight_number: trackData.flight_number || undefined,
              timestamp: trackData.first_seen_ts || Math.floor(Date.now() / 1000),
              is_anomaly: trackData.is_anomaly ?? isAnomaly,
              severity_cnn: 0,
              severity_dense: 0,
              airline: trackData.airline || undefined,
              aircraft_type: trackData.aircraft_type || undefined,
              origin_airport: trackData.origin_airport || origin,
              destination_airport: trackData.destination_airport || destination,
              full_report: {
                summary: {
                  callsign: trackData.callsign || callsign,
                  flight_number: trackData.flight_number || undefined,
                  airline: trackData.airline || undefined,
                  aircraft_type: trackData.aircraft_type || undefined,
                  category: trackData.category || undefined,
                  origin: trackData.origin_airport || origin,
                  destination: trackData.destination_airport || destination,
                  aircraft_registration: trackData.aircraft_registration || undefined,
                  first_seen_ts: trackData.first_seen_ts || undefined,
                  last_seen_ts: trackData.last_seen_ts || undefined,
                  flight_duration_sec: trackData.flight_duration_sec || undefined,
                  total_distance_nm: trackData.total_distance_nm || undefined,
                  min_altitude_ft: trackData.min_altitude_ft || undefined,
                  max_altitude_ft: trackData.max_altitude_ft || undefined,
                  avg_altitude_ft: trackData.avg_altitude_ft || undefined,
                  avg_speed_kts: trackData.avg_speed_kts || undefined,
                  is_military: trackData.is_military || undefined,
                  scheduled_departure: trackData.scheduled_departure || undefined,
                  scheduled_arrival: trackData.scheduled_arrival || undefined,
                },
              },
            };
          }
        }
      } catch (err) {
        console.warn('Could not load track for clicked flight:', err);
      }

      // If it's an anomaly, try to load the anomaly report (which may have more details)
      if (isAnomaly) {
        try {
          // Fetch recent anomalies to find this flight's report (last 24 hours)
          const now = Math.floor(Date.now() / 1000);
          const reports = await fetchLiveAnomalies(now - 86400, now); // Last 24 hours
          const report = reports.find(r => r.flight_id === flightId);
          
          if (report) {
            selectedFlightObj.report = report;
            selectedFlightObj.anomalyScore = report.severity_cnn || report.severity_dense || 0;
            if (report.origin_airport) selectedFlightObj.origin = report.origin_airport;
            if (report.destination_airport) selectedFlightObj.destination = report.destination_airport;
            
            // Get callsign from report if not set
            if (!selectedFlightObj.callsign && report.callsign) {
              selectedFlightObj.callsign = report.callsign;
            }
          }
        } catch (err) {
          console.warn('Could not load anomaly report for clicked flight:', err);
        }
      }

      setSelectedFlight(selectedFlightObj);
    } catch (err) {
      console.error('Error handling map flight click:', err);
    }
  }, []);

  return (
    <div className="bg-bg-main text-gray-400 font-body h-screen flex flex-col overflow-hidden antialiased selection:bg-primary/30 selection:text-white">
      {/* Header */}
      <Header />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Operations Control */}
        <div className="relative z-20 shrink-0">
          <aside 
            className={`flex flex-col bg-[#0B0C10] border-r border-white/5 shadow-2xl transition-all duration-300 ease-in-out overflow-hidden h-full ${
              leftSidebarCollapsed ? 'w-0' : 'w-[420px]'
            }`}
          >
            <div className={`w-[420px] h-full overflow-hidden flex flex-col transition-opacity duration-200 ${leftSidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <OperationsSidebar
                mode={mode}
                onModeChange={handleModeChange}
                selectedFlight={selectedFlight}
                onFlightSelect={handleFlightSelect}
                onFlightUpdate={handleFlightUpdate}
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
                onNewAnomaly={handleNewAnomaly}
                aiResults={aiResults}
                onClearAIResults={handleClearAIResults}
                aiResultsLoading={aiResultsLoading}
              />
            </div>
          </aside>
          {/* Toggle button - outside overflow-hidden */}
          <button
            onClick={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
            className={`absolute top-1/2 -translate-y-1/2 z-30 w-6 h-12 bg-[#0B0C10] border border-white/10 rounded-r-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#1a1b20] transition-all duration-300 shadow-lg ${
              leftSidebarCollapsed ? 'left-0' : 'left-[417px]'
            }`}
            title={leftSidebarCollapsed ? 'Show Operations Control' : 'Hide Operations Control'}
          >
            {leftSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Center - Map Area */}
        <main className="flex-1 relative bg-black overflow-hidden z-10">
          <MapArea 
            selectedFlight={selectedFlight} 
            mode={mode} 
            onFlightClick={handleMapFlightClick}
            highlight={highlightState}
            onClearHighlight={() => setHighlightState(null)}
          />
        </main>

        {/* Right Sidebar - Tactical Chat */}
        <div className="relative z-20 shrink-0">
          <aside 
            className={`flex flex-col bg-bg-panel border-l border-border-dim shadow-2xl border-l-red-900/20 transition-all duration-300 ease-in-out overflow-hidden h-full ${
              rightSidebarCollapsed ? 'w-0' : 'w-[420px]'
            }`}
          >
            {/* Top gradient line */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-900/50 to-transparent" />
            <div className={`w-[420px] h-full overflow-hidden transition-opacity duration-200 ${rightSidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <TacticalChat 
                selectedFlight={selectedFlight} 
                onOpenReplay={handleOpenReplay} 
                onAIResults={handleAIResults}
                onHighlight={handleHighlight}
                highlight={highlightState}
              />
            </div>
          </aside>
          {/* Toggle button - outside overflow-hidden */}
          <button
            onClick={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
            className={`absolute top-1/2 -translate-y-1/2 z-30 w-6 h-12 bg-bg-panel border border-white/10 rounded-l-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#1a1b20] transition-all duration-300 shadow-lg ${
              rightSidebarCollapsed ? 'right-0' : 'right-[417px]'
            }`}
            title={rightSidebarCollapsed ? 'Show Tactical Chat' : 'Hide Tactical Chat'}
          >
            {rightSidebarCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      {/* Replay Modal - Rendered at top level for fullscreen display */}
      {showReplay && replayData && (
        <ReplayModal
          mainFlightId={replayData.mainFlightId}
          secondaryFlightIds={replayData.secondaryFlightIds}
          events={replayData.events}
          onClose={handleCloseReplay}
        />
      )}
    </div>
  );
}
