import { useState, useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { Mic, Send, Paperclip, Plus, Play, ThumbsDown, ThumbsUp, Trash2, X, Box } from 'lucide-react';
import { ChatMessage, type Message } from './ChatMessage';
import { AlertCard } from './AlertCard';
import type { ReplayEvent } from './ReplayModal';
import type { SelectedFlight, AnomalyReport, AIMapAction, HighlightState } from '../types';
import { sendChatMessage, analyzeWithAI } from '../api';
import { getAnomalyReason } from '../utils/reason';
import { Flight3DMapReplay } from './Flight3DMapReplay';
import { IncidentReportModal } from './IncidentReportModal';

// AI Results interface for passing flights to parent
export interface AIResultsData {
  flights: AnomalyReport[];
  query: string;
  timestamp: number;
}

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
  onAIResults?: (data: AIResultsData) => void;
  onHighlight?: (highlight: HighlightState | null) => void;
  highlight?: HighlightState | null;
}

// Translations
const TRANSLATIONS = {
  en: {
    welcome: 'ONYX Intelligence System ready. Select a flight from the Operations panel or ask a general question about flight data.',
    tacticalChat: 'Tactical Chat',
    current: 'Current',
    currentOther: 'נוכחי',
    general: 'General',
    generalOther: 'כללי',
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
    clearChat: 'Clear',
    cancel: 'Cancel',
    cancelled: 'Request cancelled.',
  },
  he: {
    welcome: 'מערכת ONYX מוכנה. בחר טיסה מפאנל הפעולות או שאל שאלה כללית על נתוני טיסה.',
    tacticalChat: 'צ\'אט טקטי',
    current: 'נוכחי',
    currentOther: 'Current',
    general: 'כללי',
    generalOther: 'General',
    flightPrefix: 'טיסה:',
    askAboutFlight: (name: string) => `שאל שאלה לגבי ${name}...`,
    askGeneral: 'שאל כל דבר על פעולות טיסה...',
    analyzing: 'ONYX מנתח...',
    from: 'מ:',
    to: 'אל:',
    reason: 'סיבה:',
    replay: 'Replay',
    flightSelected: (name: string) => `טיסה ${name} נבחרה לניתוח.`,
    errorMessage: 'לא ניתן לעבד את הבקשה. נסה שוב.',
    callsign: 'אות קריאה',
    route: 'מסלול',
    clearChat: 'נקה',
    cancel: 'בטל',
    cancelled: 'הבקשה בוטלה.',
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

// Helper to parse AI actions from response
function parseActionsFromResponse(actions: AIMapAction[] | undefined): HighlightState | null {
  if (!actions || actions.length === 0) return null;
  
  const state: HighlightState = {};
  
  for (const action of actions) {
    if (action.action === 'highlight_segment') {
      state.segment = { startIndex: action.startIndex, endIndex: action.endIndex };
    } else if (action.action === 'highlight_point') {
      state.point = { lat: action.lat, lon: action.lon };
    } else if (action.action === 'focus_time') {
      state.focusTimestamp = action.timestamp;
    }
  }
  
  return Object.keys(state).length > 0 ? state : null;
}

export function TacticalChat({ selectedFlight, onOpenReplay, onAIResults, onHighlight, highlight }: TacticalChatProps) {
  const [mode, setMode] = useState<ChatMode>('general');
  const [input, setInput] = useState('');
  const [language, _setLanguage] = useState<ChatLanguage>('he');
  const [messages, setMessages] = useState<Message[]>([getWelcomeMessage(language)]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFullScreen3D, setShowFullScreen3D] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
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
    }
  }, [selectedFlight?.flight_id]);

  // Get secondary flight IDs from proximity events (rule.id === 4)
  const getSecondaryFlightIds = (): string[] => {
    if (!selectedFlight?.report?.full_report) return [];
    
    const ids: string[] = [];
    
    // Check multiple locations for matched rules
    const possibleRuleSources = [
      selectedFlight.report.full_report.matched_rules,
      selectedFlight.report.full_report.layer_1_rules?.report?.matched_rules,
      selectedFlight.report.full_report.rules?.matched_rules,
    ];
    
    for (const rules of possibleRuleSources) {
      if (!Array.isArray(rules)) continue;
      
      rules.forEach((rule: { id?: number; name?: string; details?: { events?: { other_flight?: string; other_flight_id?: string }[] } }) => {
        // Proximity rule can be id 4 or name contains "proximity"
        const isProximityRule = rule.id === 4 || rule.name?.toLowerCase().includes('proximity');
        
        if (isProximityRule && rule.details?.events) {
          rule.details.events.forEach((ev) => {
            // Handle both field names: other_flight and other_flight_id
            const otherId = ev.other_flight || ev.other_flight_id;
            if (otherId && !ids.includes(otherId)) {
              ids.push(otherId);
            }
          });
        }
      });
    }
    
    // Filter out the main flight and any empty/invalid IDs
    return ids.filter(id => id && id !== selectedFlight.flight_id && id !== 'UNKNOWN');
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

  // Clear conversation - reset to welcome message
  const handleClearConversation = useCallback(() => {
    setMessages([getWelcomeMessage(language)]);
    if (onHighlight) onHighlight(null);
  }, [language, onHighlight]);

  // Cancel current request
  const handleCancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      
      const cancelMessage: Message = {
        id: `cancel-${Date.now()}`,
        role: 'assistant',
        content: t.cancelled,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        sender: 'SYSTEM',
      };
      setMessages(prev => [...prev, cancelMessage]);
    }
  }, [t.cancelled]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userQuery = input.trim();
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userQuery,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      // Check if already aborted
      if (signal.aborted) return;
      let responseText: string;
      let flights: AnomalyReport[] | undefined;

      if (mode === 'current' && selectedFlight) {
        // Use /ai/analyze endpoint for flight-focused questions
        // flight_data must be an array of track points, not the FlightTrack object
        const trackPoints = selectedFlight.track?.points || [];
        
        const response = await analyzeWithAI({
          question: userQuery,
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
        
        // Parse AI actions for map highlighting - show on main map first
        if (response.actions && response.actions.length > 0) {
          const parsedHighlight = parseActionsFromResponse(response.actions as AIMapAction[]);
          if (parsedHighlight && onHighlight) {
            // Pass highlight to parent - will show on main 2D map
            // User can then click 3D button to see highlight there
            onHighlight(parsedHighlight);
          }
        }
      } else {
        // Use /ai/reasoning endpoint for general queries
        const response = await sendChatMessage({
          message: userQuery,
          history: messages.slice(-10).map(m => ({
            role: m.role === 'system' ? 'assistant' : m.role,
            content: m.content,
          })),
        });
        responseText = response.response;
        flights = response.flights;
      }

      // Check if AI response contains <fetch and return> marker or has flights
      const hasFetchMarker = responseText.includes('<fetch and return>') || responseText.includes('<fetch_and_return>');
      const hasFlights = flights && flights.length > 0;
      
      // If we have flights data from AI, send it to the AI Results tab
      if ((hasFetchMarker || hasFlights) && onAIResults) {
        // Clean the response text by removing the fetch marker
        const cleanedResponse = responseText
          .replace(/<fetch and return>/gi, '')
          .replace(/<fetch_and_return>/gi, '')
          .replace(/<\/fetch and return>/gi, '')
          .replace(/<\/fetch_and_return>/gi, '')
          .trim();
        
        if (hasFlights) {
          onAIResults({
            flights: flights!,
            query: userQuery,
            timestamp: Date.now(),
          });
          
          // Update response to indicate results are available
          responseText = cleanedResponse || `Found ${flights!.length} flight${flights!.length === 1 ? '' : 's'} matching your query. Results are now available in the AI Results tab.`;
        } else if (hasFetchMarker) {
          // The response has the marker but no flights - show message without modifying
          responseText = cleanedResponse || responseText;
        }
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        sender: 'ONYX_AI',
      };

      // Don't update messages if request was cancelled
      if (!signal.aborted) {
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      // Don't show error if request was cancelled
      if (signal.aborted) return;
      
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
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Full-screen 3D map view modal - uses highlight from props (passed from Layout)
  if (showFullScreen3D && selectedFlight) {
    return (
      <Flight3DMapReplay 
        flightId={selectedFlight.flight_id} 
        onClose={() => {
          setShowFullScreen3D(false);
          // Don't clear highlight when closing - user might want to see it on main map
        }}
        highlight={highlight}
        onClearHighlight={() => onHighlight?.(null)}
        trackPoints={selectedFlight.track?.points}
        secondaryFlightIds={getSecondaryFlightIds()}
        aircraftType={selectedFlight.report?.aircraft_type}
        callsign={selectedFlight.callsign || selectedFlight.report?.callsign}
        // Embed chat in 3D view
        embeddedChatProps={{
          selectedFlight,
          onHighlight,
          messages,
          isLoading,
          input,
          setInput,
          handleSend,
          handleKeyPress,
          language,
          t,
          isRTL,
        }}
      />
    );
  }

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
          
          {/* Clear & Language Toggle */}
          <div className="flex items-center gap-2">
            {/* Clear Conversation Button */}
            <button
              onClick={handleClearConversation}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-400 hover:text-white hover:bg-white/10 rounded-md border border-white/10 transition-all"
              title={t.clearChat}
            >
              <Trash2 className="w-3 h-3" />
              <span>{t.clearChat}</span>
            </button>
            

          </div>
        </div>

        {/* Mode Tabs with underline style + Anomaly Reason */}
        <div className="flex items-center gap-4">
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
              {t.current} ({t.currentOther})
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
              {t.general} ({t.generalOther})
            </button>
          </div>
          
          {/* Anomaly Reason Badge - shown when flight is focused */}
          {mode === 'current' && selectedFlight && (() => {
            const reason = selectedFlight.report ? getAnomalyReason(selectedFlight.report) : 'N/A';
            const isAnomaly = reason !== 'N/A';
            return isAnomaly ? (
              <div className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/40 px-2 py-1 rounded text-[9px] text-red-400 font-medium ml-auto">
                <span className="material-symbols-outlined text-xs">warning</span>
                <span className="truncate max-w-[120px]">{reason}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 px-2 py-1 rounded text-[9px] text-green-400 font-medium ml-auto">
                <span className="material-symbols-outlined text-xs">check_circle</span>
                <span>Normal</span>
              </div>
            );
          })()}
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
            onOpen3D={() => setShowFullScreen3D(true)} // Directly open full-screen 3D map
            show3D={showFullScreen3D}
            translations={t}
          />
          
          {/* 3D View opens in full screen via Flight3DMapReplay */}
        </div>
      )}
      
      {/* Demo 3D Preview - removed to avoid WebGL conflicts */}

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
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-[#63d1eb] rounded-full animate-pulse" />
                  <span className="text-xs text-gray-400">{t.analyzing}</span>
                </div>
                {/* Cancel Button */}
                <button
                  onClick={handleCancelRequest}
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded border border-red-500/30 transition-all"
                >
                  <X className="w-3 h-3" />
                  <span>{t.cancel}</span>
                </button>
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
  onOpen3D: () => void;
  show3D: boolean;
  translations: typeof TRANSLATIONS['en'];
}

function FlightContextCard({ flight, onReplay, onOpen3D, show3D: _show3D, translations: t }: FlightContextCardProps) {
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const reason = flight.report ? getAnomalyReason(flight.report) : 'N/A';
  const isAnomaly = reason !== 'N/A';

  // Handle feedback button with loading animation
  const handleFeedbackClick = () => {
    setFeedbackLoading(true);
    
    if (isAnomaly) {
      // "False Anomaly" case - just show loading then success, no modal
      setTimeout(() => {
        setFeedbackLoading(false);
        setFeedbackSuccess(true);
        // Reset success state after 2 seconds
        setTimeout(() => setFeedbackSuccess(false), 2000);
      }, 4000);
    } else {
      // "Report Anomaly" case - show loading then open modal for detailed report
      setTimeout(() => {
        setFeedbackLoading(false);
        setShowIncidentModal(true);
      }, 4000);
    }
  };

  return (
    <>
      {/* Incident Report Modal */}
      <IncidentReportModal
        isOpen={showIncidentModal}
        onClose={() => setShowIncidentModal(false)}
        flight={flight}
        isAnomaly={isAnomaly}
        anomalyReason={reason}
      />
      
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
          
          {/* Route: Origin → Destination */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">{t.route}</span>
            <div className="flex items-center gap-2 text-xs">
              {/* Origin with takeoff icon */}
              <div className="flex items-center gap-1 bg-[#00ffa3]/10 border border-[#00ffa3]/30 px-2 py-0.5 rounded">
                
                <span className="material-symbols-outlined text-[#00ffa3] text-sm">flight_land</span>
                <span className="font-bold text-[#00ffa3]">{flight.destination || '---'}</span>
              </div>
              <span className="material-symbols-outlined text-gray-500 text-sm">arrow_forward</span>
              {/* Destination with landing icon */}
              <div className="flex items-center gap-1 bg-[#63d1eb]/10 border border-[#63d1eb]/30 px-2 py-0.5 rounded">
                <span className="font-bold text-[#63d1eb]">{flight.origin || '---'}</span>
                <span className="material-symbols-outlined text-[#63d1eb] text-sm">flight_takeoff</span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Action buttons */}
        <div className="flex items-center gap-2">
          {/* Feedback Button - Opens Incident Report Modal */} 
          <button
            onClick={handleFeedbackClick}
            disabled={feedbackLoading || feedbackSuccess}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs shrink-0 relative overflow-hidden",
              feedbackSuccess
                ? "bg-green-500/20 border-green-500/50 text-green-400 cursor-default"
                : feedbackLoading 
                  ? "cursor-wait opacity-90"
                  : isAnomaly
                    ? "bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/30 text-yellow-400 hover:shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                    : "bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]",
              feedbackLoading && (isAnomaly ? "border-yellow-500/50 text-yellow-300" : "border-red-500/50 text-red-300")
            )}
            title={isAnomaly ? "Report as false positive" : "Report as anomaly"}
          >
            {/* Loading progress bar */}
            {feedbackLoading && (
              <div 
                className={clsx(
                  "absolute inset-0 h-full",
                  isAnomaly ? "bg-yellow-500/30" : "bg-red-500/30"
                )}
                style={{
                  animation: 'loadingProgress 4s ease-out forwards',
                }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {feedbackLoading ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="font-semibold">Processing...</span>
                </>
              ) : feedbackSuccess ? (
                <>
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  <span className="font-semibold">Submitted!</span>
                </>
              ) : isAnomaly ? (
                <>
                  <ThumbsDown className="w-3.5 h-3.5" />
                  <span className="font-semibold">False Anomaly</span>
                </>
              ) : (
                <>
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span className="font-semibold">Report Anomaly</span>
                </>
              )}
            </span>
          </button>
          
          {/* Replay Button */}
          <button
            onClick={onReplay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#63d1eb]/10 hover:bg-[#63d1eb]/20 border border-[#224752] text-[#63d1eb] transition-all text-xs shrink-0"
          >
            <Play className="w-3.5 h-3.5" />
            <span className="font-semibold">{t.replay}</span>
          </button>
          
          {/* 3D View Button */}
          <button
            onClick={onOpen3D}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 transition-all text-xs shrink-0"
          >
            <Box className="w-3.5 h-3.5" />
            <span className="font-semibold">3D View</span>
          </button>
        </div>
      </div>
    </>
  );
}
