import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

const STORAGE_KEY = 'onyx-searched-dates';

interface DatePickerProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

// Format date as "Dec 21" or "Dec 21, 2025" if not current year
function formatShortDate(date: Date): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (date.getFullYear() !== now.getFullYear()) {
    options.year = 'numeric';
  }
  return date.toLocaleDateString('en-US', options);
}

// Get saved searched dates from localStorage
function getSavedDates(): Date[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const timestamps = JSON.parse(saved) as number[];
      return timestamps.map(ts => new Date(ts));
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

// Save searched dates to localStorage
function saveDates(dates: Date[]) {
  try {
    const timestamps = dates.map(d => d.getTime());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timestamps));
  } catch {
    // Ignore storage errors
  }
}

// Add a date to the searched list (max 3, no duplicates, most recent first)
function addToSearchedDates(date: Date): Date[] {
  const dateStr = date.toDateString();
  const existing = getSavedDates().filter(d => d.toDateString() !== dateStr);
  const newDates = [date, ...existing].slice(0, 3);
  saveDates(newDates);
  return newDates;
}

export function DatePicker({ selectedDate, onDateChange }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [searchedDates, setSearchedDates] = useState<Date[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load searched dates from localStorage on mount
  useEffect(() => {
    const saved = getSavedDates();
    setSearchedDates(saved);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCalendar(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectDate = (date: Date) => {
    // Save to localStorage and update state
    const updated = addToSearchedDates(date);
    setSearchedDates(updated);
    onDateChange(date);
    setIsOpen(false);
    setShowCalendar(false);
  };

  const handlePrevMonth = () => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCalendarMonth(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCalendarMonth(newMonth);
  };

  // Generate calendar days for the month
  const generateCalendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    
    const days: (Date | null)[] = [];
    
    // Add padding for days before the first of the month
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const isFuture = (date: Date) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date > today;
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-black/40 border border-white/10 hover:border-white/20 transition-colors text-[11px]"
      >
        <Calendar className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-gray-300 font-mono">{formatShortDate(selectedDate)}</span>
        <ChevronDown className={clsx("w-3 h-3 text-gray-500 transition-transform", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-bg-panel border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[180px]">
          {!showCalendar ? (
            <>
              {/* Recent Searched Dates List */}
              {searchedDates.length > 0 && (
                <div className="py-1">
                  <div className="px-3 py-1.5 text-[9px] text-gray-500 uppercase tracking-wider font-bold">
                    Recent Searches
                  </div>
                  {searchedDates.map((date, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectDate(date)}
                      className={clsx(
                        "w-full px-3 py-2 text-left text-[11px] font-mono flex items-center justify-between hover:bg-white/5 transition-colors",
                        isSelected(date) && "bg-primary/10 text-primary"
                      )}
                    >
                      <span className={isSelected(date) ? "text-primary" : "text-gray-300"}>
                        {formatShortDate(date)}
                      </span>
                      {isToday(date) && (
                        <span className="text-[9px] text-gray-500 uppercase">Today</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              
              {/* Calendar Toggle */}
              <div className={searchedDates.length > 0 ? "border-t border-white/5" : ""}>
                <button
                  onClick={() => {
                    setShowCalendar(true);
                    setCalendarMonth(selectedDate);
                  }}
                  className="w-full px-3 py-2.5 text-left text-[11px] text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  {searchedDates.length > 0 ? 'Pick another date...' : 'Select a date...'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Calendar Header */}
              <div className="flex items-center justify-between px-2 py-2 border-b border-white/5">
                <button
                  onClick={handlePrevMonth}
                  className="p-1 hover:bg-white/5 rounded transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-400" />
                </button>
                <span className="text-[11px] font-medium text-gray-300">
                  {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="p-1 hover:bg-white/5 rounded transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {/* Calendar Grid */}
              <div className="p-2">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <div key={i} className="text-[9px] text-gray-500 text-center py-1">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Days */}
                <div className="grid grid-cols-7 gap-1">
                  {generateCalendarDays().map((date, i) => (
                    <div key={i} className="aspect-square">
                      {date ? (
                        <button
                          onClick={() => !isFuture(date) && handleSelectDate(date)}
                          disabled={isFuture(date)}
                          className={clsx(
                            "w-full h-full flex items-center justify-center text-[10px] rounded transition-colors",
                            isSelected(date) && "bg-primary text-white",
                            isToday(date) && !isSelected(date) && "ring-1 ring-primary/50 text-primary",
                            !isSelected(date) && !isToday(date) && !isFuture(date) && "text-gray-400 hover:bg-white/5",
                            isFuture(date) && "text-gray-600 cursor-not-allowed"
                          )}
                        >
                          {date.getDate()}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              {/* Back to recent */}
              {searchedDates.length > 0 && (
                <div className="border-t border-white/5">
                  <button
                    onClick={() => setShowCalendar(false)}
                    className="w-full px-3 py-2 text-left text-[11px] text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    ← Recent searches
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
