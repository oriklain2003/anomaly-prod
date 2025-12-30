import { useState, useCallback, useEffect } from 'react';
import { Header } from './Header';
import { TrajectoryMap } from './TrajectoryMap';
import { planTrajectory, fetchTrajectoryAirports } from '../api';
import type { 
  TrajectoryWaypoint, 
  TrajectoryPlanResponse, 
  Airport, 
  TrafficConflict,
} from '../types';
import { 
  Calendar, 
  Clock, 
  Play, 
  Trash2, 
  ChevronUp, 
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  Plane,
  MapPin,
  Navigation,
  Timer,
  Route,
  Shield,
  Info,
  Settings,
  RefreshCw
} from 'lucide-react';
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

// Format duration
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Severity badge component
function SeverityBadge({ severity }: { severity: 'critical' | 'warning' | 'info' }) {
  const config = {
    critical: {
      bg: 'bg-red-500/20',
      border: 'border-red-500/50',
      text: 'text-red-400',
      glow: 'shadow-red-500/20',
      icon: AlertTriangle,
    },
    warning: {
      bg: 'bg-amber-500/20',
      border: 'border-amber-500/50',
      text: 'text-amber-400',
      glow: 'shadow-amber-500/20',
      icon: AlertTriangle,
    },
    info: {
      bg: 'bg-blue-500/20',
      border: 'border-blue-500/50',
      text: 'text-blue-400',
      glow: 'shadow-blue-500/20',
      icon: Info,
    },
  };

  const c = config[severity];
  const Icon = c.icon;

  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border',
      c.bg, c.border, c.text
    )}>
      <Icon className="w-3 h-3" />
      {severity}
    </span>
  );
}

// Conflict card component
function ConflictCard({ conflict }: { conflict: TrafficConflict }) {
  return (
    <div className={clsx(
      'liquid-glass rounded-xl p-4 border transition-all duration-300 hover:scale-[1.02]',
      conflict.severity === 'critical' && 'border-red-500/40 hover:border-red-500/60',
      conflict.severity === 'warning' && 'border-amber-500/40 hover:border-amber-500/60',
      conflict.severity === 'info' && 'border-blue-500/40 hover:border-blue-500/60',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={clsx(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            conflict.flight_type === 'departure' ? 'bg-emerald-500/20' : 'bg-purple-500/20'
          )}>
            <Plane className={clsx(
              'w-4 h-4',
              conflict.flight_type === 'departure' 
                ? 'text-emerald-400 rotate-45' 
                : 'text-purple-400 -rotate-45'
            )} />
          </div>
          <div>
            <div className="font-mono text-sm font-semibold text-white">
              {conflict.flight_number}
            </div>
            <div className="text-[10px] text-gray-500">
              {conflict.airline}
            </div>
          </div>
        </div>
        <SeverityBadge severity={conflict.severity} />
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-black/30 rounded-lg p-2">
          <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Type</div>
          <div className="text-xs text-gray-300 capitalize">{conflict.flight_type}</div>
        </div>
        <div className="bg-black/30 rounded-lg p-2">
          <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Airport</div>
          <div className="text-xs font-mono text-cyan-400">{conflict.airport}</div>
        </div>
        <div className="bg-black/30 rounded-lg p-2">
          <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">H. Distance</div>
          <div className={clsx(
            'text-xs font-mono font-semibold',
            conflict.horizontal_distance_nm < 5 ? 'text-red-400' : 'text-gray-300'
          )}>
            {conflict.horizontal_distance_nm.toFixed(1)} NM
          </div>
        </div>
        <div className="bg-black/30 rounded-lg p-2">
          <div className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">V. Distance</div>
          <div className={clsx(
            'text-xs font-mono font-semibold',
            conflict.vertical_distance_ft < 1000 ? 'text-red-400' : 'text-gray-300'
          )}>
            {conflict.vertical_distance_ft.toFixed(0)} ft
          </div>
        </div>
      </div>

      {/* Time Info */}
      <div className="flex items-center justify-between text-[10px] text-gray-500 pt-2 border-t border-white/5">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>Scheduled: {conflict.scheduled_time.split('T')[1]?.substring(0, 5) || conflict.scheduled_time}</span>
        </div>
        <div className="flex items-center gap-1">
          <Timer className="w-3 h-3" />
          <span>T+{formatDuration(conflict.time_to_conflict_sec)}</span>
        </div>
      </div>
    </div>
  );
}

export function TrajectoryPlannerPage() {
  const [waypoints, setWaypoints] = useState<TrajectoryWaypoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(getMinDate());
  const [selectedTime, setSelectedTime] = useState<string>('12:00');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TrajectoryPlanResponse | null>(null);
  const [_airports, setAirports] = useState<Airport[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Settings
  const [horizontalThreshold, setHorizontalThreshold] = useState(5);
  const [verticalThreshold, setVerticalThreshold] = useState(1000);
  const [defaultSpeed, setDefaultSpeed] = useState(250);
  const [showSettings, setShowSettings] = useState(false);

  // Load airports on mount
  useEffect(() => {
    fetchTrajectoryAirports()
      .then(data => setAirports(data.airports))
      .catch(err => console.error('Failed to load airports:', err));
  }, []);

  const handleWaypointsChange = useCallback((newWaypoints: TrajectoryWaypoint[]) => {
    setWaypoints(newWaypoints);
    // Clear previous results when waypoints change
    if (result) {
      setResult(null);
    }
  }, [result]);

  const handleAltitudeChange = (index: number, alt: number) => {
    const updated = [...waypoints];
    updated[index] = { ...updated[index], alt: Math.max(0, Math.min(50000, alt)) };
    setWaypoints(updated);
  };

  const handleSpeedChange = (index: number, speed: number) => {
    const updated = [...waypoints];
    updated[index] = { ...updated[index], speed_kts: Math.max(50, Math.min(600, speed)) };
    setWaypoints(updated);
  };

  const handleRemoveWaypoint = (index: number) => {
    const updated = waypoints.filter((_, i) => i !== index);
    setWaypoints(updated);
  };

  const handleAnalyze = async () => {
    if (waypoints.length < 2) {
      setError('Please add at least 2 waypoints');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const start_datetime = `${selectedDate}T${selectedTime}:00`;
      
      const response = await planTrajectory({
        waypoints: waypoints.map(wp => ({
          ...wp,
          speed_kts: wp.speed_kts || defaultSpeed,
        })),
        start_datetime,
        horizontal_threshold_nm: horizontalThreshold,
        vertical_threshold_ft: verticalThreshold,
        interpolation_interval_sec: 10,
      });

      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const conflicts = result?.conflicts || [];
  const criticalCount = result?.conflicts_summary?.critical || 0;
  const warningCount = result?.conflicts_summary?.warning || 0;
  const infoCount = result?.conflicts_summary?.info || 0;

  return (
    <div className="bg-[#030508] text-gray-400 font-body h-screen flex flex-col overflow-hidden antialiased selection:bg-cyan-500/30 selection:text-white">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/20 via-transparent to-purple-950/20" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left Panel - Waypoints */}
        <aside className="w-80 flex flex-col liquid-glass border-r border-white/10 z-20 shrink-0">
          {/* Panel Header */}
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-display font-semibold text-white flex items-center gap-2">
                <Route className="w-4 h-4 text-cyan-400" />
                Trajectory Planner
              </h2>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={clsx(
                  'p-1.5 rounded-lg transition-all',
                  showSettings 
                    ? 'bg-cyan-500/20 text-cyan-400' 
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                )}
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-gray-500">Click on map to add waypoints</p>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="p-4 border-b border-white/5 bg-black/20 space-y-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Thresholds</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] text-gray-600 mb-1">Horizontal (NM)</label>
                  <input
                    type="number"
                    value={horizontalThreshold}
                    onChange={(e) => setHorizontalThreshold(parseFloat(e.target.value) || 5)}
                    min={1}
                    max={20}
                    step={0.5}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-gray-600 mb-1">Vertical (ft)</label>
                  <input
                    type="number"
                    value={verticalThreshold}
                    onChange={(e) => setVerticalThreshold(parseInt(e.target.value) || 1000)}
                    min={500}
                    max={5000}
                    step={100}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[9px] text-gray-600 mb-1">Default Speed (kts)</label>
                <input
                  type="number"
                  value={defaultSpeed}
                  onChange={(e) => setDefaultSpeed(parseInt(e.target.value) || 250)}
                  min={50}
                  max={600}
                  step={10}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>
          )}

          {/* Date/Time Selection */}
          <div className="p-4 border-b border-white/5 space-y-3">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
                <Calendar className="w-3 h-3 inline mr-1" />
                Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={getMinDate()}
                max={getMaxDate()}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">
                <Clock className="w-3 h-3 inline mr-1" />
                Start Time (UTC)
              </label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>
          </div>

          {/* Waypoints List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
            {waypoints.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-3 border border-white/10">
                  <MapPin className="w-6 h-6 text-cyan-400" />
                </div>
                <p className="text-sm text-gray-400">No waypoints yet</p>
                <p className="text-[10px] text-gray-600 mt-1">Click on the map to add points</p>
              </div>
            ) : (
              waypoints.map((wp, index) => (
                <div
                  key={wp.id}
                  className="liquid-glass rounded-xl border border-white/5 p-3 hover:border-cyan-500/30 transition-all"
                >
                  {/* Waypoint Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-xs font-bold text-black shadow-lg shadow-cyan-500/30">
                        {index + 1}
                      </div>
                      <span className="text-xs font-mono text-gray-400">
                        WP-{index + 1}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveWaypoint(index)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Coordinates */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-gray-500 mb-3 bg-black/20 rounded-lg p-2">
                    <div>
                      <span className="text-gray-600">LAT </span>
                      <span className="text-gray-400">{wp.lat.toFixed(4)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">LON </span>
                      <span className="text-gray-400">{wp.lon.toFixed(4)}</span>
                    </div>
                  </div>

                  {/* Altitude & Speed */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] text-gray-600 uppercase tracking-wider mb-1">
                        Alt (ft)
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={wp.alt}
                          onChange={(e) => handleAltitudeChange(index, parseInt(e.target.value) || 0)}
                          min={0}
                          max={50000}
                          step={500}
                          className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-cyan-500/50"
                        />
                        <div className="flex flex-col">
                          <button
                            onClick={() => handleAltitudeChange(index, wp.alt + 1000)}
                            className="p-0.5 text-gray-500 hover:text-cyan-400 transition-colors"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleAltitudeChange(index, wp.alt - 1000)}
                            className="p-0.5 text-gray-500 hover:text-cyan-400 transition-colors"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-600 uppercase tracking-wider mb-1">
                        Speed (kts)
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={wp.speed_kts || defaultSpeed}
                          onChange={(e) => handleSpeedChange(index, parseInt(e.target.value) || defaultSpeed)}
                          min={50}
                          max={600}
                          step={10}
                          className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-cyan-500/50"
                        />
                        <div className="flex flex-col">
                          <button
                            onClick={() => handleSpeedChange(index, (wp.speed_kts || defaultSpeed) + 25)}
                            className="p-0.5 text-gray-500 hover:text-cyan-400 transition-colors"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleSpeedChange(index, (wp.speed_kts || defaultSpeed) - 25)}
                            className="p-0.5 text-gray-500 hover:text-cyan-400 transition-colors"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Analyze Button */}
          <div className="p-4 border-t border-white/5">
            {error && (
              <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-[11px] text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
            <button
              onClick={handleAnalyze}
              disabled={waypoints.length < 2 || isLoading}
              className={clsx(
                'w-full py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2',
                waypoints.length >= 2 && !isLoading
                  ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white hover:from-cyan-500 hover:to-cyan-400 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50'
                  : 'bg-white/5 text-gray-500 cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Analyze Trajectory</span>
                </>
              )}
            </button>
            <p className="text-[9px] text-gray-600 text-center mt-2">
              {waypoints.length < 2
                ? `Add ${2 - waypoints.length} more waypoint${2 - waypoints.length !== 1 ? 's' : ''}`
                : `${waypoints.length} waypoints ready`}
            </p>
          </div>
        </aside>

        {/* Center - Map */}
        <main className="flex-1 relative overflow-hidden z-10">
          <TrajectoryMap
            waypoints={waypoints}
            onWaypointsChange={handleWaypointsChange}
            trajectory={result?.trajectory || []}
            conflicts={conflicts}
            airports={result?.airports_checked || []}
            flightPaths={result?.flight_paths || []}
            isDrawing={isDrawing}
            onDrawingToggle={setIsDrawing}
            defaultSpeed={defaultSpeed}
          />
        </main>

        {/* Right Panel - Results */}
        <aside className="w-[420px] flex flex-col liquid-glass border-l border-white/10 z-20 shrink-0">
          {/* Results Header */}
          <div className="p-4 border-b border-white/5">
            <h2 className="text-sm font-display font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              Conflict Analysis
            </h2>
          </div>

          {/* Results Content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Plane className="w-6 h-6 text-cyan-400" />
                    </div>
                  </div>
                  <span className="text-sm text-gray-400">Analyzing trajectory...</span>
                  <span className="text-[10px] text-gray-600">Checking airport traffic</span>
                </div>
              </div>
            ) : !result ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center px-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 flex items-center justify-center mx-auto mb-4 border border-white/10">
                    <Navigation className="w-10 h-10 text-gray-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-300 mb-2">Ready to Analyze</h3>
                  <p className="text-sm text-gray-500 max-w-xs">
                    Draw a trajectory on the map, set your departure time, then analyze for conflicts with airport traffic.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Status Card */}
                  <div className={clsx(
                    'col-span-2 liquid-glass rounded-xl p-4 border',
                    result.is_clear 
                      ? 'border-emerald-500/40' 
                      : criticalCount > 0 
                        ? 'border-red-500/40' 
                        : 'border-amber-500/40'
                  )}>
                    <div className="flex items-center gap-3">
                      {result.is_clear ? (
                        <>
                          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-emerald-400" />
                          </div>
                          <div>
                            <div className="text-emerald-400 font-semibold">All Clear</div>
                            <div className="text-[11px] text-gray-400">
                              No critical conflicts detected
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-red-400" />
                          </div>
                          <div>
                            <div className="text-red-400 font-semibold">
                              {conflicts.length} Conflict{conflicts.length !== 1 ? 's' : ''} Detected
                            </div>
                            <div className="text-[11px] text-gray-400">
                              Review conflicts below
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Trajectory Stats */}
                  <div className="liquid-glass rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Route className="w-4 h-4 text-cyan-400" />
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">Distance</span>
                    </div>
                    <div className="text-xl font-mono font-semibold text-white">
                      {result.trajectory_summary.total_distance_nm.toFixed(1)}
                      <span className="text-xs text-gray-500 ml-1">NM</span>
                    </div>
                  </div>

                  <div className="liquid-glass rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Timer className="w-4 h-4 text-purple-400" />
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">Duration</span>
                    </div>
                    <div className="text-xl font-mono font-semibold text-white">
                      {formatDuration(result.trajectory_summary.total_duration_sec)}
                    </div>
                  </div>

                  {/* Conflict Summary */}
                  {conflicts.length > 0 && (
                    <div className="col-span-2 grid grid-cols-3 gap-2">
                      <div className="bg-red-500/10 rounded-lg p-2 text-center border border-red-500/20">
                        <div className="text-lg font-mono font-bold text-red-400">{criticalCount}</div>
                        <div className="text-[9px] text-red-400/70 uppercase">Critical</div>
                      </div>
                      <div className="bg-amber-500/10 rounded-lg p-2 text-center border border-amber-500/20">
                        <div className="text-lg font-mono font-bold text-amber-400">{warningCount}</div>
                        <div className="text-[9px] text-amber-400/70 uppercase">Warning</div>
                      </div>
                      <div className="bg-blue-500/10 rounded-lg p-2 text-center border border-blue-500/20">
                        <div className="text-lg font-mono font-bold text-blue-400">{infoCount}</div>
                        <div className="text-[9px] text-blue-400/70 uppercase">Info</div>
                      </div>
                    </div>
                  )}

                  {/* Traffic Stats */}
                  <div className="col-span-2 liquid-glass rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-3">
                      <Plane className="w-4 h-4 text-cyan-400" />
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">Traffic Analyzed</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-center">
                      <div>
                        <div className="text-lg font-mono font-semibold text-white">
                          {result.traffic_summary.total_flights_analyzed}
                        </div>
                        <div className="text-[9px] text-gray-500">Total Flights</div>
                      </div>
                      <div>
                        <div className="text-lg font-mono font-semibold text-amber-400">
                          {result.flight_paths?.filter(fp => fp.is_time_relevant).length || 0}
                        </div>
                        <div className="text-[9px] text-gray-500">Time Relevant</div>
                      </div>
                      <div>
                        <div className="text-lg font-mono font-semibold text-emerald-400">
                          {result.traffic_summary.departures}
                        </div>
                        <div className="text-[9px] text-gray-500">Departures</div>
                      </div>
                      <div>
                        <div className="text-lg font-mono font-semibold text-purple-400">
                          {result.traffic_summary.arrivals}
                        </div>
                        <div className="text-[9px] text-gray-500">Arrivals</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Conflicts List */}
                {conflicts.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      Conflict Details
                    </h3>
                    <div className="space-y-3">
                      {conflicts.map((conflict, index) => (
                        <ConflictCard key={index} conflict={conflict} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Airports Checked */}
                {result.airports_checked.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-amber-400" />
                      Airports Analyzed
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {result.airports_checked.map((airport) => (
                        <div
                          key={airport.code}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono text-amber-400 hover:bg-amber-500/20 transition-colors cursor-default"
                          title={airport.name}
                        >
                          {airport.code}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

