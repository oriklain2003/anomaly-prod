import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { Mic, ArrowUp, Plane, MapPin, X, Loader2, Play, Languages } from 'lucide-react';
import { ChatMessage, type Message } from './ChatMessage';
import { AlertCard } from './AlertCard';
import { ReplayModal, type ReplayEvent } from './ReplayModal';
import type { SelectedFlight } from '../types';
import { sendChatMessage, analyzeWithAI } from '../api';
import { getAnomalyReason, getAnomalyScore, getScoreColor } from '../utils/reason';

type ChatMode = 'current' | 'general';
type ChatLanguage = 'en' | 'he';

interface TacticalChatProps {
  selectedFlight: SelectedFlight | null;
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

export function TacticalChat({ selectedFlight }: TacticalChatProps) {
  const [mode, setMode] = useState<ChatMode>('general');
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState<ChatLanguage>('en');
  const [messages, setMessages] = useState<Message[]>([getWelcomeMessage('en')]);
  const [isLoading, setIsLoading] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const t = TRANSLATIONS[language];
  const isRTL = language === 'he';

  // Toggle language
  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'he' : 'en';
    setLanguage(newLang);
  };

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

  const clearMessages = () => {
    setMessages([getWelcomeMessage(language)]);
  };

  return (
    <div className={clsx("flex flex-col h-full", isRTL && "rtl")} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="border-b border-border-dim bg-bg-panel flex flex-col gap-4 p-5">
        {/* Title Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-xl text-gray-200">forum</span>
            <span className="text-sm font-medium text-white tracking-wide">{t.tacticalChat}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Language Toggle Button */}
            <button
              onClick={toggleLanguage}
              className={clsx(
                "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold transition-colors",
                "bg-white/5 border border-white/10 hover:bg-white/10",
                language === 'he' ? "text-blue-400" : "text-gray-400"
              )}
              title={language === 'en' ? 'Switch to Hebrew' : 'החלף לאנגלית'}
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'עב' : 'EN'}</span>
            </button>
            <div className="flex items-center gap-2 px-2 py-1 rounded bg-white/5 border border-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[10px] text-gray-300 font-mono font-bold">#OPS-ALPHA</span>
            </div>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-black rounded-lg p-1 border border-white/5">
          <button
            onClick={() => setMode('current')}
            className={clsx(
              "flex-1 py-2 rounded-md text-[11px] font-medium transition-all",
              mode === 'current'
                ? "bg-[#1e1e1e] text-white shadow-sm border border-white/10 font-bold"
                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
            )}
          >
            {selectedFlight ? `${t.flightPrefix} ${selectedFlight.callsign || selectedFlight.flight_id}` : t.current}
          </button>
          <button
            onClick={() => setMode('general')}
            className={clsx(
              "flex-1 py-2 rounded-md text-[11px] font-medium transition-all",
              mode === 'general'
                ? "bg-[#1e1e1e] text-white shadow-sm border border-white/10 font-bold"
                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
            )}
          >
            {t.general}
          </button>
        </div>

        {/* Flight Context Card (when in current mode with a selected flight) */}
        {mode === 'current' && selectedFlight && (
          <FlightContextCard 
            flight={selectedFlight} 
            onReplay={() => setShowReplay(true)}
            translations={t}
          />
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 flex flex-col bg-bg-panel relative">
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
          <div className={clsx("flex items-center gap-2 text-gray-500 text-xs", isRTL && "flex-row-reverse")}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{t.analyzing}</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-5 pt-0 bg-bg-panel relative">
        {/* Bottom gradient line */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-900/50 to-transparent" />
        
        <div className="relative group">
          {/* Glow effect on focus */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500/10 to-blue-600/10 rounded-xl opacity-0 group-focus-within:opacity-100 transition duration-500 blur" />
          
          <div className="relative flex flex-col bg-bg-surface rounded-xl border border-white/10 shadow-inner transition-colors p-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              dir={isRTL ? 'rtl' : 'ltr'}
              className={clsx(
                "w-full bg-transparent border-none focus:ring-0 focus:outline-none text-xs text-white placeholder-gray-600 font-body py-3 px-3 disabled:opacity-50",
                isRTL && "text-right"
              )}
              placeholder={mode === 'current' && selectedFlight 
                ? t.askAboutFlight(selectedFlight.callsign || selectedFlight.flight_id)
                : t.askGeneral
              }
            />
            
            <div className={clsx("flex items-center justify-between px-2 pb-1", isRTL && "flex-row-reverse")}>
              <button 
                onClick={clearMessages}
                className="text-gray-500 hover:text-white transition-colors p-1"
                title="Clear chat"
              >
                <X className="h-4 w-4" />
              </button>
              <div className={clsx("flex gap-2", isRTL && "flex-row-reverse")}>
                <button className="text-gray-500 hover:text-white transition-colors p-1">
                  <Mic className="h-5 w-5" />
                </button>
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="text-gray-400 hover:text-white transition-colors p-1 disabled:opacity-50"
                >
                  <ArrowUp className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Replay Modal */}
      {showReplay && selectedFlight && (
        <ReplayModal
          mainFlightId={selectedFlight.flight_id}
          secondaryFlightIds={getSecondaryFlightIds()}
          events={getReplayEvents()}
          onClose={() => setShowReplay(false)}
        />
      )}
    </div>
  );
}

// Flight Context Card Component
interface FlightContextCardProps {
  flight: SelectedFlight;
  onReplay: () => void;
  translations: typeof TRANSLATIONS['en'];
}

function FlightContextCard({ flight, onReplay, translations: t }: FlightContextCardProps) {
  const score = flight.report ? getAnomalyScore(flight.report) : (flight.anomalyScore || 0);
  const reason = flight.report ? getAnomalyReason(flight.report) : 'N/A';
  const scoreColor = getScoreColor(score);

  return (
    <div className="bg-black/30 rounded-lg p-3 border border-white/5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Plane className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-mono font-bold text-white">
            {flight.callsign || flight.flight_id}
          </span>
        </div>
        <span className={clsx("text-sm font-mono font-bold", scoreColor)}>
          {Math.round(score)}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3 text-green-400" />
          <span className="text-gray-500">{t.from}</span>
          <span className="text-gray-300 font-mono">{flight.origin || '---'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Plane className="w-3 h-3 text-blue-400" />
          <span className="text-gray-500">{t.to}</span>
          <span className="text-gray-300 font-mono">{flight.destination || '---'}</span>
        </div>
      </div>
      
      {reason !== 'N/A' && (
        <div className="mt-2 text-[10px] text-gray-400">
          <span className="text-gray-500">{t.reason} </span>
          <span>{reason}</span>
        </div>
      )}

      {/* Replay Button - smaller */}
      <button
        onClick={onReplay}
        className="mt-2 flex items-center gap-1.5 py-1 px-2.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[10px] font-medium transition-colors"
      >
        <Play className="w-3 h-3" />
        {t.replay}
      </button>
    </div>
  );
}
