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

export function ChatMessage({ message, isRTL = false }: ChatMessageProps) {
  // User message
  if (message.role === 'user') {
    return (
      <div className={clsx("flex flex-col gap-1", isRTL ? "items-start" : "items-end")}>
        <span className={clsx(
          "text-[10px] text-gray-500 font-mono flex items-center gap-1.5 mb-1",
          isRTL && "flex-row-reverse"
        )}>
          {isRTL ? 'אתה' : 'YOU'} <span className="material-symbols-outlined text-[14px]">person</span>
        </span>
        <div className={clsx(
          "bg-blue-600/10 border border-blue-500/20 rounded-xl px-5 py-3 text-xs text-blue-100 max-w-[90%] shadow-[0_0_15px_-5px_rgba(59,130,246,0.1)]",
          isRTL ? "rounded-tl-sm text-right" : "rounded-tr-sm"
        )}>
          {message.content}
        </div>
        <span className="text-[10px] text-gray-600 font-mono mt-1">{message.timestamp}</span>
      </div>
    );
  }

  // System message (loading/calculating)
  if (message.role === 'system') {
    return (
      <div className="flex flex-col gap-2 opacity-60">
        <div className={clsx(
          "flex items-center justify-between text-[10px] text-gray-600 font-mono mb-1",
          isRTL && "flex-row-reverse"
        )}>
          <span className={clsx("flex items-center gap-1", isRTL && "flex-row-reverse")}>
            <span className="material-symbols-outlined text-[12px]">admin_panel_settings</span> {message.sender}
          </span>
          <span>{message.timestamp}</span>
        </div>
        <div className={clsx("p-3 rounded-lg border border-dashed border-white/10 bg-white/[0.02] text-xs", isRTL && "text-right")}>
          <span className="text-gray-500 font-mono">{message.content}</span>
        </div>
      </div>
    );
  }

  // AI Assistant message with recommendations
  if (message.role === 'assistant' && message.recommendations) {
    return (
      <div className="flex flex-col gap-2 group">
        <div className={clsx(
          "flex items-center justify-between text-[10px] text-gray-500 font-mono mb-1",
          isRTL && "flex-row-reverse"
        )}>
          <span className={clsx("flex items-center gap-1.5 text-blue-400 font-bold tracking-wide", isRTL && "flex-row-reverse")}>
            <span className="material-symbols-outlined text-[14px]">smart_toy</span> {message.sender}
          </span>
          <span className="opacity-50">{message.timestamp}</span>
        </div>
        <div className={clsx(
          "bg-bg-surface rounded-xl p-5 text-xs border border-white/5 shadow-md relative overflow-hidden",
          isRTL ? "rounded-tr-sm" : "rounded-tl-sm"
        )}>
          {/* Accent bar */}
          <div className={clsx(
            "absolute top-0 w-1 h-full bg-blue-500/20",
            isRTL ? "right-0" : "left-0"
          )} />
          
          <p className={clsx("text-gray-400 mb-4 font-semibold text-[11px] uppercase tracking-wide", isRTL && "text-right")}>
            {isRTL ? 'פעולה מומלצת' : 'Recommended Action'}
          </p>
          
          <ul className="space-y-3 text-gray-300 font-mono text-[11px]">
            {message.recommendations.map((rec, index) => (
              <li key={index} className={clsx("flex items-start gap-3", isRTL && "flex-row-reverse")}>
                <span className="text-blue-500 font-bold">{isRTL ? '<' : '>'}</span>
                {rec.label}
              </li>
            ))}
          </ul>

          <div className={clsx("mt-5 flex gap-3", isRTL && "flex-row-reverse")}>
            <button className="flex-1 py-2 px-3 bg-blue-900/20 border border-blue-500/30 text-[10px] font-bold font-mono text-blue-300 uppercase hover:bg-blue-900/40 hover:text-white transition-all rounded shadow-sm">
              {isRTL ? 'בצע' : 'Execute'}
            </button>
            <button className="flex-1 py-2 px-3 bg-transparent border border-white/10 text-[10px] font-mono text-gray-500 uppercase hover:bg-white/5 hover:text-gray-300 transition-colors rounded">
              {isRTL ? 'התעלם' : 'Ignore'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default assistant message with markdown support
  return (
    <div className="flex flex-col gap-2 group">
      <div className={clsx(
        "flex items-center justify-between text-[10px] text-gray-500 font-mono mb-1",
        isRTL && "flex-row-reverse"
      )}>
        <span className={clsx("flex items-center gap-1.5 text-blue-400 font-bold tracking-wide", isRTL && "flex-row-reverse")}>
          <span className="material-symbols-outlined text-[14px]">smart_toy</span> {message.sender || 'ONYX_AI'}
        </span>
        <span className="opacity-50">{message.timestamp}</span>
      </div>
      <div className={clsx(
        "bg-bg-surface rounded-xl p-4 text-xs text-gray-300 border border-white/5 shadow-md",
        isRTL ? "rounded-tr-sm text-right" : "rounded-tl-sm"
      )}>
        <MarkdownText text={message.content} />
      </div>
    </div>
  );
}
