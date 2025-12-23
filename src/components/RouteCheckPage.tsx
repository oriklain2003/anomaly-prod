import { useState, useCallback } from 'react';
import { Header } from './Header';
import { RouteDrawMap } from './RouteDrawMap';
import { ConflictReport } from './ConflictReport';
import { analyzeRoute } from '../api';
import type { RouteWaypoint, RouteCheckResponse, Airport, ApproachLine } from '../types';
import { Calendar, Clock, Search, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

// Format date for input
function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Get max date (7 days from now)
function getMaxDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return formatDateForInput(date);
}

// Get min date (today)
function getMinDate(): string {
  return formatDateForInput(new Date());
}

export function RouteCheckPage() {
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(getMinDate());
  const [selectedTime, setSelectedTime] = useState<string>('12:00');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RouteCheckResponse | null>(null);
  const [checkedAirports, setCheckedAirports] = useState<Airport[]>([]);
  const [approachLines, setApproachLines] = useState<ApproachLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleWaypointsChange = useCallback((newWaypoints: RouteWaypoint[]) => {
    setWaypoints(newWaypoints);
    // Clear previous results when waypoints change
    if (result) {
      setResult(null);
      setCheckedAirports([]);
      setApproachLines([]);
    }
  }, [result]);

  const handleAltitudeChange = (index: number, alt: number) => {
    const updated = [...waypoints];
    updated[index] = { ...updated[index], alt };
    setWaypoints(updated);
  };

  const handleRemoveWaypoint = (index: number) => {
    const updated = waypoints.filter((_, i) => i !== index);
    setWaypoints(updated);
  };

  const handleAnalyze = async () => {
    if (waypoints.length < 2) {
      setError('Please add at least 2 waypoints to analyze');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const datetime = `${selectedDate}T${selectedTime}:00`;
      
      const response = await analyzeRoute({
        waypoints,
        datetime,
        check_alternatives: true,
      });

      setResult(response);
      setCheckedAirports(response.airports_checked);
      setApproachLines(response.approach_lines || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setResult(null);
      setApproachLines([]);
    } finally {
      setIsLoading(false);
    }
  };

  const conflicts = result?.original_analysis.conflicts || [];

  return (
    <div className="bg-bg-main text-gray-400 font-body h-screen flex flex-col overflow-hidden antialiased selection:bg-primary/30 selection:text-white">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Waypoint List */}
        <aside className="w-80 flex flex-col bg-bg-panel border-r border-border-dim z-20 shrink-0 shadow-panel-glow">
          <div className="p-4 border-b border-white/5">
            <h2 className="text-sm font-display font-semibold text-white mb-1">Route Planning</h2>
            <p className="text-[10px] text-gray-500">Click on the map to add waypoints</p>
          </div>

          {/* Date/Time Selection */}
          <div className="p-4 border-b border-white/5 space-y-3">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
                Date (within 7 days)
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={getMinDate()}
                  max={getMaxDate()}
                  className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
                Time (UTC)
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                />
              </div>
            </div>
          </div>

          {/* Waypoints List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {waypoints.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <Search className="w-6 h-6 text-gray-600" />
                </div>
                <p className="text-sm text-gray-500">No waypoints yet</p>
                <p className="text-[10px] text-gray-600 mt-1">Click on the map to add points</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {waypoints.map((wp, index) => (
                  <div
                    key={wp.id}
                    className="bg-black/30 rounded-lg border border-white/5 p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center text-xs font-bold text-black">
                          {index + 1}
                        </div>
                        <span className="text-xs font-mono text-gray-400">
                          Waypoint {index + 1}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveWaypoint(index)}
                        className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-gray-500 mb-2">
                      <div>
                        <span className="text-gray-600">LAT:</span>{' '}
                        <span className="text-gray-400">{wp.lat.toFixed(4)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">LON:</span>{' '}
                        <span className="text-gray-400">{wp.lon.toFixed(4)}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-600 uppercase tracking-wider mb-1">
                        Altitude (ft)
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={wp.alt}
                          onChange={(e) => handleAltitudeChange(index, parseInt(e.target.value) || 0)}
                          min={0}
                          max={50000}
                          step={500}
                          className="flex-1 bg-black/50 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-cyan-500/50"
                        />
                        <div className="flex flex-col">
                          <button
                            onClick={() => handleAltitudeChange(index, wp.alt + 1000)}
                            className="p-0.5 text-gray-500 hover:text-white transition-colors"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleAltitudeChange(index, Math.max(0, wp.alt - 1000))}
                            className="p-0.5 text-gray-500 hover:text-white transition-colors"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Analyze Button */}
          <div className="p-4 border-t border-white/5">
            {error && (
              <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-[11px] text-red-400">
                {error}
              </div>
            )}
            <button
              onClick={handleAnalyze}
              disabled={waypoints.length < 2 || isLoading}
              className={clsx(
                'w-full py-3 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2',
                waypoints.length >= 2 && !isLoading
                  ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white hover:from-cyan-500 hover:to-cyan-400 shadow-lg shadow-cyan-500/20'
                  : 'bg-white/5 text-gray-500 cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Analyze Route</span>
                </>
              )}
            </button>
            <p className="text-[9px] text-gray-600 text-center mt-2">
              {waypoints.length < 2
                ? `Add ${2 - waypoints.length} more waypoint${2 - waypoints.length !== 1 ? 's' : ''}`
                : 'Ready to analyze'}
            </p>
          </div>
        </aside>

        {/* Center - Map */}
        <main className="flex-1 relative bg-black overflow-hidden z-10">
          <RouteDrawMap
            waypoints={waypoints}
            onWaypointsChange={handleWaypointsChange}
            conflicts={conflicts}
            airports={checkedAirports}
            approachLines={approachLines}
            isDrawing={isDrawing}
            onDrawingToggle={setIsDrawing}
          />
        </main>

        {/* Right Panel - Conflict Report */}
        <aside className="w-[400px] flex flex-col bg-bg-panel border-l border-border-dim z-20 shadow-2xl shrink-0 relative border-l-red-900/20">
          {/* Top gradient line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-900/50 to-transparent" />
          <ConflictReport
            result={result}
            isLoading={isLoading}
            selectedTime={`${selectedDate} ${selectedTime}`}
          />
        </aside>
      </div>
    </div>
  );
}

