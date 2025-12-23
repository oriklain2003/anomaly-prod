import clsx from 'clsx';
import { MarkdownText } from '../utils/markdown';

export interface Recommendation {
  label: string;
  action: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'alert';
  content: string;
  timestamp: string;
  sender?: string;
  isLoading?: boolean;
  recommendations?: Recommendation[];
  alertData?: {
    title: string;
    description: string;
    id: string;
    actionLabel: string;
  };
}

interface ChatMessageProps {
  message: Message;
  isRTL?: boolean;
}

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

// Get user initials from content or default
function getUserInitials(): string {
  return 'U';
}

export function ChatMessage({ message, isRTL = false }: ChatMessageProps) {
  // User message with cyan glass bubble
  if (message.role === 'user') {
    return (
      <div className={clsx("flex gap-4 max-w-3xl", isRTL ? "flex-row" : "flex-row-reverse ml-auto")}>
        {/* User Avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#224752] to-[#0e1320] border border-[#63d1eb]/30 text-[#63d1eb] flex items-center justify-center flex-shrink-0 text-xs font-bold mt-1 shadow-[0_0_25px_rgba(99,209,235,0.3)]">
          {getUserInitials()}
        </div>
        {/* Message Bubble */}
        <div className={clsx(
          "glass-bubble-user p-5 rounded-2xl shadow-[0_8px_25px_rgba(99,209,235,0.15)]",
          isRTL ? "rounded-tl-sm" : "rounded-tr-sm"
        )}>
          <div className="text-sm leading-relaxed text-white">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // System message (context/loading)
  if (message.role === 'system') {
    return (
      <div className={clsx("flex gap-4 max-w-3xl", isRTL && "flex-row-reverse")}>
        {/* System Icon */}
        <div className="w-9 h-9 rounded-full bg-gray-800/50 border border-white/10 text-gray-500 flex items-center justify-center flex-shrink-0 mt-1">
          <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
        </div>
        {/* Message */}
        <div className="space-y-2 flex-1">
          <div className={clsx(
            "flex items-center gap-2 text-[10px] text-gray-500 font-mono",
            isRTL && "flex-row-reverse"
          )}>
            <span>{message.sender}</span>
            <span className="opacity-50">•</span>
            <span className="opacity-50">{message.timestamp}</span>
          </div>
          <div className={clsx(
            "p-3 rounded-lg border border-dashed border-white/10 bg-white/[0.02] text-xs",
            isRTL && "text-right"
          )}>
            <span className="text-gray-500 font-mono">{message.content}</span>
          </div>
        </div>
      </div>
    );
  }

  // AI Assistant message with recommendations
  if (message.role === 'assistant' && message.recommendations) {
    return (
      <div className={clsx("flex gap-4 max-w-3xl", isRTL && "flex-row-reverse")}>
        {/* AI Avatar - White circle with ONYX icon */}
        <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center flex-shrink-0 mt-1 shadow-[0_0_25px_rgba(255,255,255,0.3)] border border-white/50">
          <OnyxIcon className="w-[18px] h-[18px]" />
        </div>
        {/* Message Content */}
        <div className="space-y-3 w-full">
          <div className={clsx(
            "flex items-center gap-2 text-[10px] text-gray-400 uppercase tracking-widest font-mono",
            isRTL && "flex-row-reverse"
          )}>
            <span className="font-bold">ONYX AI</span>
          </div>
          
          {/* Main bubble with recommendations */}
          <div className={clsx(
            "glass-card-enhanced p-6 rounded-2xl relative overflow-hidden glass-shimmer",
            isRTL ? "rounded-tr-sm" : "rounded-tl-sm"
          )}>
            {/* Accent gradient */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#63d1eb]/15 rounded-full blur-[60px] pointer-events-none" />
            
            <div className="flex items-center space-x-2 mb-4 text-red-400 text-sm font-bold relative z-10">
              <span className="material-symbols-outlined text-lg drop-shadow-[0_0_12px_rgba(255,77,77,0.6)]">analytics</span>
              <span className="tracking-wide">{isRTL ? 'סיכום ניתוח' : 'Analysis Summary'}</span>
            </div>
            
            <ul className="space-y-4 text-sm text-gray-300 relative z-10">
              {message.recommendations.map((rec, index) => (
                <li key={index} className={clsx("flex items-start gap-3 group", isRTL && "flex-row-reverse")}>
                  <span className={clsx(
                    "w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 shadow-[0_0_10px] transition-shadow",
                    index === 0 && "bg-[#00ffa3] shadow-[#00ffa3]/90 group-hover:shadow-[0_0_15px_rgba(0,255,163,1)]",
                    index === 1 && "bg-[#63d1eb] shadow-[#63d1eb]/90 group-hover:shadow-[0_0_15px_rgba(99,209,235,1)]",
                    index === 2 && "bg-[#ffff00] shadow-[#ffff00]/90 group-hover:shadow-[0_0_15px_rgba(255,255,0,1)]",
                    index > 2 && "bg-white shadow-white/90"
                  )} />
                  <span>{rec.label}</span>
                </li>
              ))}
            </ul>

            <div className={clsx("mt-5 flex gap-3 relative z-10", isRTL && "flex-row-reverse")}>
              <button className="px-3 py-1.5 text-xs font-semibold bg-white/10 border border-white/20 text-gray-200 rounded-lg hover:bg-white/20 hover:text-white hover:border-white/30 transition backdrop-blur-md shadow-lg">
                {isRTL ? 'צפה בדו"ח מלא' : 'View Full Report'}
              </button>
              <button className="px-3 py-1.5 text-xs font-semibold bg-white/10 border border-white/20 text-gray-200 rounded-lg hover:bg-white/20 hover:text-white hover:border-white/30 transition backdrop-blur-md shadow-lg">
                {isRTL ? 'ייצא נתונים' : 'Export Data (CSV)'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default assistant message with glass bubble and markdown support
  return (
    <div className={clsx("flex gap-4 max-w-3xl", isRTL && "flex-row-reverse")}>
      {/* AI Avatar - White circle with ONYX icon */}
      <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center flex-shrink-0 mt-1 shadow-[0_0_25px_rgba(255,255,255,0.3)] border border-white/50">
        <OnyxIcon className="w-[18px] h-[18px]" />
      </div>
      {/* Message Content */}
      <div className="space-y-2 flex-1">
        <div className={clsx(
          "text-xs font-bold text-gray-400 uppercase tracking-widest ml-1",
          isRTL && "mr-1 ml-0 text-right"
        )}>
          ONYX AI
        </div>
        <div className={clsx(
          "glass-bubble-ai p-5 rounded-2xl text-sm leading-relaxed text-gray-100 shadow-[0_8px_25px_rgba(0,0,0,0.3)] border-l-2 border-l-white/20",
          isRTL ? "rounded-tr-sm border-l-0 border-r-2 border-r-white/20 text-right" : "rounded-tl-sm"
        )}>
          <MarkdownText text={message.content} />
        </div>
      </div>
    </div>
  );
}
