import { useEffect, useState } from 'react';
import { Plane, AlertTriangle, RotateCcw, Radio, CornerDownRight, TrendingUp } from 'lucide-react';
import { fetchStatsOverview, fetchTaggedStatsOverview } from '../api';
import { DatePicker } from './DatePicker';
import type { OverviewStats } from '../types';

interface StatsCardProps {
  mode: 'live' | 'history';
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

interface StatItem {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

// Mock stats for fallback
const MOCK_STATS: OverviewStats = {
  total_flights: 1247,
  total_anomalies: 23,
  safety_events: 5,
  go_arounds: 8,
  emergency_codes: 2,
  near_miss: 1,
  holding_patterns: 3,
};

export function StatsCard({ mode, selectedDate, onDateChange }: StatsCardProps) {
  const [stats, setStats] = useState<OverviewStats>(MOCK_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadStats = async () => {
      try {
        setLoading(true);
        
        // Calculate start and end of selected date
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const startTs = Math.floor(startOfDay.getTime() / 1000);
        const endTs = Math.floor(endOfDay.getTime() / 1000);

        let data: OverviewStats;
        if (mode === 'live') {
          data = await fetchStatsOverview(startTs, endTs);
        } else {
          const taggedData = await fetchTaggedStatsOverview(startTs, endTs);
          data = {
            total_flights: taggedData.total_flights,
            total_anomalies: taggedData.total_anomalies,
            safety_events: taggedData.safety_events,
            go_arounds: taggedData.go_arounds,
            emergency_codes: taggedData.emergency_codes,
            near_miss: taggedData.near_miss,
            holding_patterns: taggedData.holding_patterns,
          };
        }

        if (mounted) {
          setStats(data);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Using mock stats:', err);
        if (mounted) {
          setStats(MOCK_STATS);
          setLoading(false);
        }
      }
    };

    loadStats();

    return () => {
      mounted = false;
    };
  }, [mode, selectedDate]);

  const statItems: StatItem[] = [
    {
      label: 'Flights',
      value: stats.total_flights,
      icon: <Plane className="w-3.5 h-3.5" />,
      color: 'text-blue-400',
    },
    {
      label: 'Anomalies',
      value: stats.total_anomalies,
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      color: 'text-orange-400',
    },
    {
      label: 'Go-Around',
      value: stats.go_arounds,
      icon: <RotateCcw className="w-3.5 h-3.5" />,
      color: 'text-yellow-400',
    },
    {
      label: 'Emergency',
      value: stats.emergency_codes,
      icon: <Radio className="w-3.5 h-3.5" />,
      color: 'text-red-400',
    },
    {
      label: 'Holding',
      value: stats.holding_patterns,
      icon: <CornerDownRight className="w-3.5 h-3.5" />,
      color: 'text-cyan-400',
    },
    {
      label: 'Proximity',
      value: stats.near_miss,
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      color: 'text-purple-400',
    },
  ];

  return (
    <div className="px-4 py-3 border-b border-border-dim bg-bg-surface/30">
      {/* Date Picker Row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Overview</span>
        <DatePicker selectedDate={selectedDate} onDateChange={onDateChange} />
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        {statItems.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-md bg-black/30 border border-white/5"
          >
            <div className={`flex items-center gap-1 ${stat.color}`}>
              {stat.icon}
              <span className="font-mono text-sm font-bold">
                {loading ? '—' : (stat.value == null ? '—' : stat.value.toLocaleString())}
              </span>
            </div>
            <span className="text-[9px] text-gray-500 mt-0.5">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
