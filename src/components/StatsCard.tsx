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
      icon: 'flight',
      color: 'text-[#63d1eb]',
      bgColor: 'bg-[#63d1eb]/10',
      glowColor: 'shadow-[0_0_15px_rgba(99,209,235,0.3)]',
    },
    {
      label: 'Anomalies',
      value: stats.total_anomalies,
      icon: 'warning',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
      glowColor: 'shadow-[0_0_15px_rgba(251,146,60,0.3)]',
    },
    {
      label: 'Go-Around',
      value: stats.go_arounds,
      icon: '360',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      glowColor: 'shadow-[0_0_15px_rgba(250,204,21,0.3)]',
    },
    {
      label: 'Emergency',
      value: stats.emergency_codes,
      icon: 'crisis_alert',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      glowColor: 'shadow-[0_0_15px_rgba(248,113,113,0.3)]',
    },
    {
      label: 'Holding',
      value: stats.holding_patterns,
      icon: 'sync',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      glowColor: 'shadow-[0_0_15px_rgba(192,132,252,0.3)]',
    },
    {
      label: 'Proximity',
      value: stats.near_miss,
      icon: 'compare_arrows',
      color: 'text-[#00ffa3]',
      bgColor: 'bg-[#00ffa3]/10',
      glowColor: 'shadow-[0_0_15px_rgba(0,255,163,0.3)]',
    },
  ];

  return (
    <div className="px-4 py-4 border-b border-white/5 bg-black/20 backdrop-blur-sm">
      {/* Date Picker Row */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Overview</span>
        <DatePicker selectedDate={selectedDate} onDateChange={onDateChange} />
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        {statItems.map((stat) => (
          <div
            key={stat.label}
            className={`overview-card flex flex-col items-center justify-center py-3 px-2 rounded-xl group cursor-default ${stat.glowColor}`}
          >
            {/* Icon */}
            <div className={`w-8 h-8 rounded-lg ${stat.bgColor} flex items-center justify-center mb-2 transition-transform group-hover:scale-110`}>
              <span className={`material-symbols-outlined text-lg ${stat.color} drop-shadow-[0_0_8px_currentColor]`}>
                {stat.icon}
              </span>
            </div>
            {/* Value */}
            <span className={`font-mono text-lg font-bold ${stat.color} drop-shadow-[0_0_10px_currentColor]`}>
              {loading ? '—' : (stat.value == null ? '—' : stat.value.toLocaleString())}
            </span>
            {/* Label */}
            <span className="text-[9px] text-gray-500 mt-0.5 uppercase tracking-wider font-medium">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
