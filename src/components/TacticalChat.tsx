import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { Mic, Send, Paperclip, Plus, Play } from 'lucide-react';
import { ChatMessage, type Message } from './ChatMessage';
import { AlertCard } from './AlertCard';
import type { ReplayEvent } from './ReplayModal';
import type { SelectedFlight } from '../types';
import { sendChatMessage, analyzeWithAI } from '../api';
import { getAnomalyReason } from '../utils/reason';

type ChatMode = 'current' | 'general';
type ChatLanguage = 'en' | 'he';

// Replay data interface (same as Layout)
interface ReplayData {
  mainFlightId: string;
  secondaryFlightIds: string[];
  events: ReplayEvent[];
}

interface TacticalChatProps {
  selectedFlight: SelectedFlight | null;
  onOpenReplay?: (data: ReplayData) => void;
}

// Translations
const TRANSLATIONS = {
  en: {
    welcome: 'ONYX Intelligence System ready. Select a flight from the Operations panel or ask a general question about flight data.',
    tacticalChat: 'Tactical Chat',
    current: 'Current',
    general: 'General',
    flightPrefix: 'Flight:',
    askAboutFlight: (name: string) => `Ask about ${name}...`,
    askGeneral: 'Ask anything about flight operations...',
    analyzing: 'ONYX is analyzing...',
    from: 'From:',
    to: 'To:',
    reason: 'Reason:',
    replay: 'Replay',
    flightSelected: (name: string) => `Flight ${name} selected for analysis.`,
    errorMessage: 'Unable to process request. Please try again.',
    callsign: 'CALLSIGN',
    route: 'ROUTE',
  },
  he: {
    welcome: 'מערכת ONYX מוכנה. בחר טיסה מפאנל הפעולות או שאל שאלה כללית על נתוני טיסה.',
    tacticalChat: 'צ\'אט טקטי',
    current: 'נוכחי',
    general: 'כללי',
    flightPrefix: 'טיסה:',
    askAboutFlight: (name: string) => `שאל שאלה לגבי ${name}...`,
    askGeneral: 'שאל כל דבר על פעולות טיסה...',
    analyzing: 'ONYX מנתח...',
    from: 'מ:',
    to: 'אל:',
    reason: 'סיבה:',
    replay: 'הפעל מחדש',
    flightSelected: (name: string) => `טיסה ${name} נבחרה לניתוח.`,
    errorMessage: 'לא ניתן לעבד את הבקשה. נסה שוב.',
    callsign: 'אות קריאה',
    route: 'מסלול',
  },
};

// Get initial welcome message based on language
const getWelcomeMessage = (lang: ChatLanguage): Message => ({
  id: 'welcome',
  role: 'assistant',
  content: TRANSLATIONS[lang].welcome,
  timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
  sender: 'ONYX_AI',
});

// ONYX Cube Icon SVG
function OnyxIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" x2="12" y1="22.08" y2="12" />
    </svg>
  );
}

export function TacticalChat({ selectedFlight, onOpenReplay }: TacticalChatProps) {
  const [mode, setMode] = useState<ChatMode>('general');
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState<ChatLanguage>('en');
  const [messages, setMessages] = useState<Message[]>([getWelcomeMessage('en')]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const t = TRANSLATIONS[language];
  const isRTL = language === 'he';

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Switch to current mode when a flight is selected
  useEffect(() => {
    if (selectedFlight) {
      setMode('current');
      
      // Add a context message about the selected flight
      const contextMessage: Message = {
        id: `context-${Date.now()}`,
        role: 'system',
        content: t.flightSelected(selectedFlight.callsign || selectedFlight.flight_id),
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        sender: 'SYSTEM',
      };
      
      setMessages(prev => [...prev, contextMessage]);
    }
  }, [selectedFlight?.flight_id, t]);

  // Get secondary flight IDs from proximity events (rule.id === 4)
  const getSecondaryFlightIds = (): string[] => {
    if (!selectedFlight?.report?.full_report) return [];
    
    const ids: string[] = [];
    const rules = selectedFlight.report.full_report.matched_rules || 
                  selectedFlight.report.full_report.layer_1_rules?.report?.matched_rules || [];
    
    rules.forEach((rule: { id?: number; details?: { events?: { other_flight?: string }[] } }) => {
      // Proximity rule id is 4
      if (rule.id === 4 && rule.details?.events) {
        rule.details.events.forEach((ev: { other_flight?: string }) => {
          if (ev.other_flight && !ids.includes(ev.other_flight)) {
            ids.push(ev.other_flight);
          }
        });
      }
    });
    
    return ids.filter(id => id !== selectedFlight.flight_id);
  };

  // Get replay events from the report - only show Proximity Alert events (rule.id === 4)
  const getReplayEvents = (): ReplayEvent[] => {
    if (!selectedFlight?.report?.full_report) return [];
    
    const events: ReplayEvent[] = [];
    const rules = selectedFlight.report.full_report.matched_rules || 
                  selectedFlight.report.full_report.layer_1_rules?.report?.matched_rules || [];

    // Find the proximity rule (id: 4)
    const proximityRule = rules.find((r: { id?: number }) => r.id === 4) as {
      id?: number;
      name?: string;
      details?: {
        events?: { timestamp: number; other_callsign?: string; other_flight?: string; distance_nm?: number; altitude_diff_ft?: number; lat?: number; lon?: number }[];
      };
    } | undefined;

    // Only add proximity events
    if (proximityRule?.details?.events) {
      proximityRule.details.events.forEach((ev) => {
        events.push({
          timestamp: ev.timestamp,
          type: 'proximity',
          description: `Conflict with ${ev.other_callsign || ev.other_flight}. Dist: ${ev.distance_nm?.toFixed(1) || '?'} NM, Alt Diff: ${ev.altitude_diff_ft || '?'} ft`,
          lat: ev.lat,
          lon: ev.lon,
        });
      });
    }

    return events.sort((a, b) => a.timestamp - b.timestamp);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let responseText: string;

      if (mode === 'current' && selectedFlight) {
        // Use /ai/analyze endpoint for flight-focused questions
        // flight_data must be an array of track points, not the FlightTrack object
        const trackPoints = selectedFlight.track?.points || [];
        
        const response = await analyzeWithAI({
          question: input,
          flight_id: selectedFlight.flight_id,
          flight_data: trackPoints,
          anomaly_report: selectedFlight.report,
          history: messages.slice(-10).map(m => ({
            role: m.role === 'system' ? 'assistant' : m.role,
            content: m.content,
          })),
          language: language,
        });
        responseText = response.response;
      } else {
        // Use /ai/reasoning endpoint for general queries
        const response = await sendChatMessage({
          message: input,
          history: messages.slice(-10).map(m => ({
            role: m.role === 'system' ? 'assistant' : m.role,
            content: m.content,
          })),
        });
        responseText = response.response;
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        sender: 'ONYX_AI',
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: t.errorMessage,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        sender: 'SYSTEM',
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={clsx("flex flex-col h-full glass-panel", isRTL && "rtl")} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Compact Header */}
      <div className="shrink-0 border-b border-white/10 bg-black/20 backdrop-blur-md px-4 py-3">
        {/* Title Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* ONYX Icon */}
            <div className="w-7 h-7 flex items-center justify-center text-black bg-white rounded-md shadow-[0_0_15px_rgba(255,255,255,0.2)]">
              <OnyxIcon className="w-4 h-4" />
            </div>
            <span className="font-bold text-base text-white">ONYX AI</span>
            {/* Connected Badge */}
            <span className="bg-[#00ffa3]/10 text-[#00ffa3] text-[9px] px-2 py-0.5 rounded-full border border-[#00ffa3]/30 font-semibold uppercase tracking-wide">
              Connected
            </span>
          </div>
          
          {/* Language Toggle */}
          <div className="flex items-center bg-black/40 rounded-md p-0.5 border border-white/10">
            <button
              onClick={() => setLanguage('en')}
              className={clsx(
                "px-2 py-0.5 text-[10px] font-bold rounded transition-all",
                language === 'en'
                  ? "bg-white/10 text-white"
                  : "text-gray-500 hover:text-white"
              )}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('he')}
              className={clsx(
                "px-2 py-0.5 text-[10px] font-medium rounded transition-all",
                language === 'he'
                  ? "bg-white/10 text-white"
                  : "text-gray-500 hover:text-white"
              )}
            >
              עב
            </button>
          </div>
        </div>

        {/* Mode Tabs with underline style */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => setMode('current')}
            className={clsx(
              "pb-2 text-xs font-medium transition-all",
              mode === 'current'
                ? "border-b-2 border-[#63d1eb] text-[#63d1eb]"
                : "border-b-2 border-transparent text-gray-400 hover:text-white"
            )}
          >
            {t.current} (נוכחי)
          </button>
          <button
            onClick={() => setMode('general')}
            className={clsx(
              "pb-2 text-xs font-medium transition-all",
              mode === 'general'
                ? "border-b-2 border-[#63d1eb] text-[#63d1eb]"
                : "border-b-2 border-transparent text-gray-400 hover:text-white"
            )}
          >
            {t.general} (כללי)
          </button>
        </div>
      </div>

      {/* Flight Context Card - Split into 2 rows */}
      {mode === 'current' && selectedFlight && (
        <div className="shrink-0 px-4 py-3 border-b border-white/5 space-y-2">
          <FlightContextCard 
            flight={selectedFlight} 
            onReplay={() => {
              if (onOpenReplay) {
                onOpenReplay({
                  mainFlightId: selectedFlight.flight_id,
                  secondaryFlightIds: getSecondaryFlightIds(),
                  events: getReplayEvents(),
                });
              }
            }}
            translations={t}
          />
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar scroll-smooth min-h-0">
        {messages.map((message) => (
          message.role === 'alert' ? (
            <AlertCard
              key={message.id}
              title={message.alertData!.title}
              description={message.alertData!.description}
              id={message.alertData!.id}
              actionLabel={message.alertData!.actionLabel}
            />
          ) : (
            <ChatMessage key={message.id} message={message} isRTL={isRTL} />
          )
        ))}
        
        {isLoading && (
          <div className={clsx("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.3)]">
              <OnyxIcon className="w-3.5 h-3.5" />
            </div>
            <div className="glass-bubble-ai px-3 py-2 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#63d1eb] rounded-full animate-pulse" />
                <span className="text-xs text-gray-400">{t.analyzing}</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Bigger like before */}
      <div className="shrink-0 p-4 bg-transparent border-t border-white/5">
        <div className="glass-input rounded-2xl px-1 py-1 flex flex-col gap-2 relative group transition-all duration-300 shadow-[0_0_50px_rgba(220,38,38,0.15)] focus-within:shadow-[0_0_70px_rgba(220,38,38,0.3)] focus-within:border-red-500/30">
          <div className="px-4 pt-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              dir={isRTL ? 'rtl' : 'ltr'}
              rows={1}
              className={clsx(
                "bg-transparent border-none text-sm w-full focus:ring-0 focus:outline-none text-white placeholder-gray-500 resize-none h-12 py-2 leading-relaxed",
                isRTL && "text-right"
              )}
              placeholder={mode === 'current' && selectedFlight 
                ? t.askAboutFlight(selectedFlight.callsign || selectedFlight.flight_id)
                : t.askGeneral
              }
            />
          </div>
          <div className={clsx("flex justify-between items-center px-3 pb-2 pt-1 border-t border-white/10 mx-2", isRTL && "flex-row-reverse")}>
            <div className={clsx("flex items-center gap-1", isRTL && "flex-row-reverse")}>
              <button className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-white/10 transition">
                <Plus className="w-4 h-4" />
              </button>
              <button className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-white/10 transition">
                <Paperclip className="w-4 h-4" />
              </button>
            </div>
            <div className={clsx("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <button className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-white/10 transition">
                <Mic className="w-4 h-4" />
              </button>
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="p-2 bg-white/10 text-white hover:bg-white hover:text-black rounded-lg transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.15)] hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] border border-white/10 disabled:opacity-50 disabled:hover:bg-white/10 disabled:hover:text-white"
              >
                <Send className="w-4 h-4 -rotate-45" />
              </button>
            </div>
          </div>
        </div>
        <div className="text-center mt-2">
          <p className="text-[9px] text-gray-500 font-medium tracking-wide">AI can make mistakes. Verify important information.</p>
        </div>
      </div>

    </div>
  );
}

// Flight Context Card Component - Split into 2 rows
interface FlightContextCardProps {
  flight: SelectedFlight;
  onReplay: () => void;
  translations: typeof TRANSLATIONS['en'];
}

function FlightContextCard({ flight, onReplay, translations: t }: FlightContextCardProps) {
  const reason = flight.report ? getAnomalyReason(flight.report) : 'N/A';

  return (
    <div className="space-y-2">
      {/* Row 1: Callsign and Route */}
      <div className="glass-card-enhanced rounded-lg p-2 flex items-center gap-3">
        {/* Callsign with indicator */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-black/30 border border-white/10">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ffa3] shadow-[0_0_8px_rgba(0,255,163,0.9)] animate-pulse" />
          <span className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">{t.callsign}</span>
          <span className="text-sm font-bold text-white font-mono">
            {flight.callsign || flight.flight_id.slice(0, 6)}
          </span>
        </div>
        
        {/* Route */}
        <div className="flex items-center gap-2 flex-1">
          <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">{t.route}</span>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="material-symbols-outlined text-[#63d1eb] text-sm">flight_takeoff</span>
            <span className="font-semibold text-white">{flight.origin || '---'}</span>
            <span className="material-symbols-outlined text-gray-500 text-[10px]">arrow_forward</span>
            <span className="font-semibold text-white">{flight.destination || '---'}</span>
            <span className="material-symbols-outlined text-[#00ffa3] text-sm">flight_land</span>
          </div>
        </div>
      </div>

      {/* Row 2: Anomaly reason and Replay button (only if there's a reason) */}
      {reason !== 'N/A' && (
        <div className="flex items-center gap-2">
          {/* Anomaly reason */}
          <div className="flex-1 flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-2.5 py-1.5 rounded-lg text-[10px] text-red-400">
            <span className="material-symbols-outlined text-sm">warning</span>
            <span className="truncate">{reason}</span>
          </div>
          
          {/* Replay Button */}
          <button
            onClick={onReplay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#63d1eb]/10 hover:bg-[#63d1eb]/20 border border-[#224752] text-[#63d1eb] transition-all text-xs shrink-0"
          >
            <Play className="w-3.5 h-3.5" />
            <span className="font-semibold">{t.replay}</span>
          </button>
        </div>
      )}
    </div>
  );
}
