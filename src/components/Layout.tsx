import { useState, useRef, useCallback, useEffect } from 'react';
import { Header } from './Header';
import { OperationsSidebar } from './OperationsSidebar';
import { MapArea } from './MapArea';
import { TacticalChat } from './TacticalChat';
import { ReplayModal, type ReplayEvent } from './ReplayModal';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SelectedFlight } from '../types';
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
  const [mode, setMode] = useState<'live' | 'history'>('history');
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

  const handleModeChange = (newMode: 'live' | 'history') => {
    setMode(newMode);
    // Clear selection when switching modes
    setSelectedFlight(null);
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

      // Try to load track data
      try {
        const track = await fetchLiveResearchTrack(flightId);
        if (track?.points?.length > 0) {
          selectedFlightObj.track = track;
          
          // Get callsign from track if not provided
          const firstPoint = track.points[0];
          if (!selectedFlightObj.callsign && firstPoint.callsign) {
            selectedFlightObj.callsign = firstPoint.callsign;
          }
        }
      } catch (err) {
        console.warn('Could not load track for clicked flight:', err);
      }

      // If it's an anomaly, try to load the anomaly report
      if (isAnomaly) {
        try {
          // Fetch recent anomalies to find this flight's report (last 24 hours)
          const now = Math.floor(Date.now() / 1000);
          const reports = await fetchLiveAnomalies(now - 86400, now); // Last 24 hours
          const report = reports.find(r => r.flight_id === flightId);
          
          if (report) {
            selectedFlightObj.report = report;
            selectedFlightObj.anomalyScore = report.severity_cnn || report.severity_dense || 0;
            selectedFlightObj.origin = report.origin_airport;
            selectedFlightObj.destination = report.destination_airport;
            
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
        <aside 
          className={`flex flex-col bg-[#0B0C10] border-r border-white/5 z-20 shrink-0 shadow-2xl transition-all duration-300 ease-in-out relative ${
            leftSidebarCollapsed ? 'w-0' : 'w-[420px]'
          }`}
        >
          <div className={`w-[420px] h-full overflow-hidden flex flex-col ${leftSidebarCollapsed ? 'invisible' : 'visible'}`}>
            <OperationsSidebar
              mode={mode}
              onModeChange={handleModeChange}
              selectedFlight={selectedFlight}
              onFlightSelect={handleFlightSelect}
              onFlightUpdate={handleFlightUpdate}
              selectedDate={selectedDate}
              onDateChange={handleDateChange}
              onNewAnomaly={handleNewAnomaly}
            />
          </div>
          {/* Toggle button */}
          <button
            onClick={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-30 w-6 h-12 bg-[#0B0C10] border border-white/10 rounded-r-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#1a1b20] transition-colors shadow-lg"
            title={leftSidebarCollapsed ? 'Show Operations Control' : 'Hide Operations Control'}
          >
            {leftSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </aside>

        {/* Center - Map Area */}
        <main className="flex-1 relative bg-black overflow-hidden z-10">
          <MapArea 
            selectedFlight={selectedFlight} 
            mode={mode} 
            onFlightClick={handleMapFlightClick}
          />
        </main>

        {/* Right Sidebar - Tactical Chat */}
        <aside 
          className={`flex flex-col bg-bg-panel border-l border-border-dim z-20 shadow-2xl shrink-0 relative border-l-red-900/20 transition-all duration-300 ease-in-out ${
            rightSidebarCollapsed ? 'w-0' : 'w-[420px]'
          }`}
        >
          {/* Top gradient line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-900/50 to-transparent" />
          <div className={`w-[420px] h-full overflow-hidden ${rightSidebarCollapsed ? 'invisible' : 'visible'}`}>
            <TacticalChat selectedFlight={selectedFlight} onOpenReplay={handleOpenReplay} />
          </div>
          {/* Toggle button */}
          <button
            onClick={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-30 w-6 h-12 bg-bg-panel border border-white/10 rounded-l-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#1a1b20] transition-colors shadow-lg"
            title={rightSidebarCollapsed ? 'Show Tactical Chat' : 'Hide Tactical Chat'}
          >
            {rightSidebarCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </aside>
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
