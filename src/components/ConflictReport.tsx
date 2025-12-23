import { AlertTriangle, CheckCircle, Clock, Plane, MapPin, ArrowRight, Lightbulb } from 'lucide-react';
import clsx from 'clsx';
import type { RouteCheckResponse, FlightConflict, TimeSlotAnalysis } from '../types';

interface ConflictReportProps {
  result: RouteCheckResponse | null;
  isLoading: boolean;
  selectedTime: string;
}

function getSeverityColor(severity: 'low' | 'medium' | 'high') {
  switch (severity) {
    case 'high':
      return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'medium':
      return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    case 'low':
      return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
  }
}

function ConflictCard({ conflict }: { conflict: FlightConflict }) {
  // Support both old format (conflict_point) and new format (waypoint)
  const conflictPoint = conflict.waypoint || (conflict as any).conflict_point;
  
  return (
    <div
      className={clsx(
        'rounded-lg border p-3 mb-2',
        getSeverityColor(conflict.severity)
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Plane className="w-4 h-4" />
          <span className="font-mono text-sm font-medium">
            {conflict.flight.flight_number}
          </span>
        </div>
        <span className={clsx('text-[10px] uppercase font-bold px-2 py-0.5 rounded', getSeverityColor(conflict.severity))}>
          {conflict.severity}
        </span>
      </div>
      <div className="text-[11px] text-gray-400 space-y-1">
        <div className="flex items-center gap-1">
          <span className="text-gray-500">Airline:</span>
          <span>{conflict.flight.airline || 'Unknown'}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">Route:</span>
          <span className="font-mono">
            {conflict.flight.departure_airport}
            <ArrowRight className="w-3 h-3 inline mx-1" />
            {conflict.flight.arrival_airport}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">Type:</span>
          <span className="capitalize">{conflict.flight.type}</span>
        </div>
        {/* Runway info if available */}
        {conflict.flight.runway && (
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Runway:</span>
            <span className="font-mono text-purple-400">
              {conflict.flight.runway}
              {conflict.flight.runway_end && ` (${conflict.flight.runway_end})`}
            </span>
          </div>
        )}
        {conflict.flight.approach_heading && (
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Approach Hdg:</span>
            <span className="font-mono text-purple-400">{conflict.flight.approach_heading.toFixed(0)}°</span>
          </div>
        )}
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/5">
          <MapPin className="w-3 h-3 text-red-400" />
          <span className="text-gray-500">Conflict at waypoint</span>
          <span className="font-mono text-white">#{conflictPoint.waypoint_index + 1}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">Distance:</span>
          <span className="font-mono text-cyan-400">{conflictPoint.distance_nm.toFixed(1)} NM</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500">Alt Diff:</span>
          <span className="font-mono text-cyan-400">{conflictPoint.altitude_diff_ft.toFixed(0)} ft</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span className="text-gray-500">Est. Time:</span>
          <span className="font-mono">{conflictPoint.estimated_time}</span>
        </div>
      </div>
    </div>
  );
}

function TimeSlotCard({ slot, isBest }: { slot: TimeSlotAnalysis; isBest?: boolean }) {
  return (
    <div
      className={clsx(
        'rounded-lg border p-3',
        slot.conflict_count === 0
          ? 'bg-green-500/10 border-green-500/30'
          : 'bg-bg-surface border-white/10',
        isBest && 'ring-2 ring-green-500/50'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="font-mono text-sm text-white">{slot.time}</span>
        </div>
        <div className={clsx('flex items-center gap-1 text-[11px] font-medium', slot.conflict_count === 0 ? 'text-green-400' : 'text-red-400')}>
          {slot.conflict_count === 0 ? (
            <>
              <CheckCircle className="w-3 h-3" />
              <span>Clear</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3 h-3" />
              <span>{slot.conflict_count} conflict{slot.conflict_count !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>
      </div>
      {isBest && (
        <div className="mt-2 text-[10px] text-green-400 flex items-center gap-1">
          <Lightbulb className="w-3 h-3" />
          <span>Recommended time slot</span>
        </div>
      )}
    </div>
  );
}

export function ConflictReport({ result, isLoading, selectedTime }: ConflictReportProps) {
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Analyzing route conflicts...</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            <Plane className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">No Analysis Yet</h3>
          <p className="text-sm text-gray-500 max-w-xs">
            Draw a route on the map, select a date and time, then click "Analyze Route" to check for conflicts.
          </p>
        </div>
      </div>
    );
  }

  const { original_analysis, airports_checked, flights_analyzed, suggestion, alternative_slots } = result;

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-4">
      {/* Summary Header */}
      <div className="mb-6">
        <h2 className="text-lg font-display font-semibold text-white mb-1">Conflict Analysis</h2>
        <p className="text-[11px] text-gray-500">
          Checked {airports_checked.length} airport{airports_checked.length !== 1 ? 's' : ''} and {flights_analyzed} scheduled flight{flights_analyzed !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Original Time Analysis */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-300">Selected Time: {selectedTime}</h3>
        </div>

        {original_analysis.conflict_count === 0 ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
            <div>
              <div className="text-green-400 font-medium">All Clear!</div>
              <div className="text-[11px] text-gray-400">
                No conflicts detected for your planned route at this time.
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
              <div>
                <div className="text-red-400 font-medium">
                  {original_analysis.conflict_count} Conflict{original_analysis.conflict_count !== 1 ? 's' : ''} Detected
                </div>
                <div className="text-[11px] text-gray-400">
                  Your route may intersect with scheduled traffic.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Conflicts List */}
      {original_analysis.conflicts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            Conflict Details
          </h3>
          {original_analysis.conflicts.map((conflict, index) => (
            <ConflictCard key={index} conflict={conflict} />
          ))}
        </div>
      )}

      {/* Suggestion */}
      {suggestion && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-green-400" />
            Suggestion
          </h3>
          <div className={clsx(
            'rounded-lg border p-4',
            suggestion.conflict_count === 0
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-amber-500/10 border-amber-500/30'
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-white text-lg">{suggestion.time}</span>
              <span className={clsx(
                'text-[11px] font-bold px-2 py-0.5 rounded',
                suggestion.conflict_count === 0
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-amber-500/20 text-amber-400'
              )}>
                {suggestion.conflict_count === 0 ? 'OPTIMAL' : `${suggestion.conflict_count} CONFLICTS`}
              </span>
            </div>
            <p className="text-sm text-gray-400">{suggestion.message}</p>
          </div>
        </div>
      )}

      {/* Alternative Time Slots */}
      {alternative_slots && alternative_slots.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            Alternative Time Slots
          </h3>
          <div className="space-y-2">
            {alternative_slots.slice(0, 6).map((slot, index) => (
              <TimeSlotCard
                key={index}
                slot={slot}
                isBest={suggestion && slot.time === suggestion.time}
              />
            ))}
          </div>
        </div>
      )}

      {/* Airports Checked */}
      {airports_checked.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-400" />
            Airports Analyzed
          </h3>
          <div className="flex flex-wrap gap-2">
            {airports_checked.map((airport) => (
              <div
                key={airport.code}
                className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono text-amber-400"
                title={airport.name}
              >
                {airport.code}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

