import { useEffect, useState } from 'react';
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
  icon: string;  // Material icon name
  color: string;
  bgColor: string;
  glowColor: string;
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
  military_flights: 12,
  traffic_count: 45,
  return_to_field: 2,
  unplanned_landing: 1,
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
          const rawData = await fetchStatsOverview(startTs, endTs);
          data = {
            ...rawData,
            military_flights: rawData.military_flights ?? 0,
            return_to_field: rawData.return_to_field ?? 0,
            unplanned_landing: rawData.unplanned_landing ?? 0,
          };
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
            military_flights: taggedData.military_flights ?? 0,
            return_to_field: taggedData.return_to_field ?? 0,
            unplanned_landing: taggedData.unplanned_landing ?? 0,
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

  // Calculate anomalies as sum of all anomaly categories in the frontend
  const calculatedAnomalies = (stats.emergency_codes || 0) + 
                              (stats.safety_events || 0) + 
                              (stats.go_arounds || 0) + 
                              (stats.near_miss || 0) + 
                              (stats.holding_patterns || 0);

  // Calculate traffic as sum of: holding pattern, go-around, return to field, unplanned landing
  const calculatedTraffic = (stats.holding_patterns || 0) + 
                            (stats.go_arounds || 0) + 
                            (stats.return_to_field || 0) + 
                            (stats.unplanned_landing || 0);

  const statItems: StatItem[] = [
    {
      label: 'Emergency',
      value: stats.emergency_codes,
      icon: 'crisis_alert',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      glowColor: 'shadow-[0_0_15px_rgba(248,113,113,0.3)]',
    },
    {
      label: 'Safety',
      value: stats.safety_events,
      icon: 'shield',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
      glowColor: 'shadow-[0_0_15px_rgba(251,146,60,0.3)]',
    },
    {
      label: 'Military',
      value: stats.military_flights ?? 0,
      icon: 'military_tech',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      glowColor: 'shadow-[0_0_15px_rgba(250,204,21,0.3)]',
    },
    {
      label: 'Anomalies',
      value: calculatedAnomalies,  // Frontend calculated sum
      icon: 'warning',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      glowColor: 'shadow-[0_0_15px_rgba(192,132,252,0.3)]',
    },
    {
      label: 'Traffic',
      value: calculatedTraffic,  // Sum of holding pattern + go-around + return to field + unplanned landing
      icon: 'traffic',
      color: 'text-[#00ffa3]',
      bgColor: 'bg-[#00ffa3]/10',
      glowColor: 'shadow-[0_0_15px_rgba(0,255,163,0.3)]',
    },
    {
      label: 'Flights',
      value: stats.total_flights,
      icon: 'flight',
      color: 'text-[#63d1eb]',
      bgColor: 'bg-[#63d1eb]/10',
      glowColor: 'shadow-[0_0_15px_rgba(99,209,235,0.3)]',
    },
  ];

  return (
    <div className="px-6 py-4 border-b border-white/5 bg-black/20 backdrop-blur-sm">
      {/* Date Picker Row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Overview</span>
        <DatePicker selectedDate={selectedDate} onDateChange={onDateChange} />
      </div>
      
      {/* Stats Grid - smaller cards matching reference */}
      <div className="grid grid-cols-3 gap-2">
        {statItems.map((stat) => (
          <div
            key={stat.label}
            className="overview-card rounded p-3 flex flex-col items-center justify-center h-[72px] group cursor-default"
          >
            {/* Icon */}
            <span className={`material-symbols-outlined text-lg mb-1 ${stat.color}`} style={{ textShadow: `0 0 15px currentColor` }}>
              {stat.icon}
            </span>
            {/* Value */}
            <span className={`text-xl font-mono font-bold ${stat.color}`} style={{ textShadow: `0 0 15px currentColor` }}>
              {loading ? '—' : (stat.value == null ? '—' : stat.value.toLocaleString())}
            </span>
            {/* Label */}
            <span className="text-[10px] text-gray-500 uppercase">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
