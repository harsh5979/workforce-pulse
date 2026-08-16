'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, ChevronRight, ShieldCheck, CornerDownRight, RotateCcw, ChevronDown, AlertTriangle, RefreshCw, Clock } from 'lucide-react';
import { SUGGESTED_AI_QUERIES, API_BASE_URL } from '@/lib/constants';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  isStreaming?: boolean;
  isRateLimited?: boolean; // all free models returned 429
}


// ─── Shared ReactMarkdown component config ─────────────────────────────────
const MD_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  table: ({ node, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-none border border-border/80 shadow-lg touch-pan-x scrollbar-thin">
      <table className="w-full min-w-[460px] text-left border-collapse text-[11px] sm:text-xs" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => <thead className="bg-muted border-b border-border" {...props} />,
  th: ({ node, ...props }) => <th className="py-2.5 px-3 sm:py-3 sm:px-4 font-bold text-primary uppercase tracking-wider text-[10px] sm:text-[11px] whitespace-nowrap" {...props} />,
  tbody: ({ node, ...props }) => <tbody {...props} />,
  tr: ({ node, ...props }) => <tr className="border-b border-border transition-colors hover:bg-primary/5 even:bg-background/60 odd:bg-card" {...props} />,
  td: ({ node, ...props }) => <td className="py-2 px-3 sm:py-3 sm:px-4 text-foreground font-medium" {...props} />,
  blockquote: ({ node, children, ...props }) => (
    <blockquote className="border-l-4 border-primary/50 pl-4 py-1 my-3 bg-muted/20" {...props}>{children}</blockquote>
  ),
  h1: ({ node, ...props }) => <h1 className="text-xl font-bold text-primary mt-6 mb-3" {...props} />,
  h2: ({ node, ...props }) => <h2 className="text-lg font-bold text-primary mt-5 mb-2" {...props} />,
  h3: ({ node, ...props }) => (
    <div className="flex items-center gap-2 mt-4 mb-2 first:mt-0 pb-2 border-b border-border/60">
      <div className="w-1 h-4 rounded-none bg-emerald-400 shrink-0" />
      <h3 className="text-xs font-extrabold uppercase tracking-widest text-primary font-mono" {...props} />
    </div>
  ),
  h4: ({ node, ...props }) => <h4 className="text-base font-semibold text-primary mt-3 mb-1" {...props} />,
  p: ({ node, children, ...props }) => {
    const firstChild = (node as any)?.children?.[0];
    if (firstChild?.type === 'element' && firstChild?.tagName === 'strong') {
      return (
        <div className="my-2 rounded-none border border-border/70 overflow-hidden shadow-md bg-background/40">
          <div className="flex items-start gap-3 px-4 py-2.5">
            <div className="text-sm text-foreground flex-1 flex items-start gap-2 [&>strong:first-child]:min-w-[130px] [&>strong:first-child]:font-mono [&>strong:first-child]:text-[11px] [&>strong:first-child]:text-muted-foreground [&>strong:first-child]:pt-0.5">
              {children}
            </div>
          </div>
        </div>
      );
    }
    return <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props}>{children}</p>;
  },
  ul: ({ node, ...props }) => <ul className="my-3 space-y-2 list-none" {...props} />,
  ol: ({ node, ...props }) => <ol className="my-3 space-y-2 list-decimal list-outside ml-4" {...props} />,
  li: ({ node, className, children, ...props }) => {
    const isUnordered = (node as any)?.parent?.tagName === 'ul';
    if (isUnordered) {
      return (
        <li className="flex items-start gap-2.5" {...props}>
          <div className="w-1.5 h-1.5 rounded-none bg-emerald-400 shrink-0 mt-[6px]" />
          <span>{children}</span>
        </li>
      );
    }
    return <li className="pl-1" {...props}>{children}</li>;
  },
  strong: ({ node, ...props }) => <strong className="font-bold text-primary-foreground" {...props} />,
  em: ({ node, ...props }) => <em className="italic text-foreground" {...props} />,
  pre: ({ node, ...props }) => <pre className="block bg-muted text-foreground p-3 rounded border border-border overflow-x-auto my-3" {...props} />,
  code: ({ node, className, ...props }) =>
    <code className={`${className || ''} font-mono text-[11px] bg-muted/50 text-accent px-1.5 py-0.5 rounded border border-border`} {...props} />,
  a: ({ node, ...props }) => <a className="text-primary hover:underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...props} />,
};

// ─── Table skeleton (pure React, no markdown needed) ──────────────────────
function TableSkeleton() {
  return (
    <div className="my-4 rounded-none border border-border/80 shadow-sm bg-background/40 overflow-hidden w-full">
      {/* Header row skeleton */}
      <div className="flex gap-0 border-b border-border bg-muted">
        {[40, 20, 20, 20].map((w, i) => (
          <div key={i} className="py-3 px-4 flex-none animate-pulse" style={{ width: `${w}%` }}>
            <div className="h-3 bg-primary/20 rounded-none" />
          </div>
        ))}
      </div>
      {/* Body rows */}
      {[0.9, 0.7, 0.8, 0.6].map((opacity, rowIdx) => (
        <div key={rowIdx} className="flex gap-0 border-b border-border/50" style={{ opacity }}>
          {[40, 20, 20, 20].map((w, colIdx) => (
            <div key={colIdx} className="py-2.5 px-4 flex-none animate-pulse" style={{ width: `${w}%`, animationDelay: `${rowIdx * 80 + colIdx * 40}ms` }}>
              <div className="h-3 bg-muted-foreground/15 rounded-none" />
            </div>
          ))}
        </div>
      ))}
      {/* Status bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/30">
        <span className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-primary rounded-none animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-primary rounded-none animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-primary rounded-none animate-bounce" style={{ animationDelay: '300ms' }} />
        </span>
        <span className="text-[10px] font-mono font-bold text-primary/60 tracking-widest uppercase animate-pulse">Generating table…</span>
      </div>
    </div>
  );
}

// ─── Normalise markdown coming from the AI ─────────────────────────────────
function normaliseMarkdown(raw: string): string {
  let s = raw;
  // Strip hallucinated bullets before pipe chars (e.g. "2. | Dept |", "  - | Col |")
  s = s.replace(/^(\s*)(\d+\.|[-*•])\s+(\|)/gm, '$1$3');
  // Ensure blank line before a table header that follows prose
  s = s.replace(/([.?!:])\s+(\|)/g, '$1\n\n$2');
  s = s.replace(/([^\n|]+)\n\s*(\|(?!\s*-+\s*\|))/g, '$1\n\n$2');
  // Split rows glued with ||
  s = s.replace(/\|\s*\|(?=\s*[A-Za-z])/g, '|\n|');
  s = s.replace(/([A-Za-z0-9%])\s*\|\s*\|(?=\s*-)/g, '$1 |\n|');
  // Fill empty delimiter cells
  s = s.replace(/^(\s*\|[\s|:-]*\|)$/gm, (m) => m.replace(/\|(?=\s*\|)/g, '|---'));
  return s;
}

// ─── Find where the table block starts (first pipe line of the last contiguous block) ─
function findTableBlockStart(lines: string[]): number {
  let lastValid = lines.length - 1;
  while (lastValid >= 0 && lines[lastValid].trim() === '') lastValid--;
  if (lastValid < 0 || !lines[lastValid].trim().includes('|')) return -1;

  let start = lastValid;
  for (let i = lastValid; i >= 0; i--) {
    const t = lines[i].trim();
    if (t === '') break;
    if (t.includes('|')) start = i;
    else break;
  }
  return start;
}

// ─── Main renderer ─────────────────────────────────────────────────────────
function AIMessageBody({ content, msgId, isStreaming }: { content: string; msgId: string; isStreaming?: boolean }) {
  // ── 1. Initial loading dots (no content yet) ──────────────────────────
  if (isStreaming && !content) {
    return (
      <div className="flex items-center gap-1 h-5 mt-1">
        <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
        <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
        <div className="w-1.5 h-1.5 bg-primary/80 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
      </div>
    );
  }

  if (!content) return null;

  // ── 2. XSS sanitization ───────────────────────────────────────────────
  const safe = typeof window !== 'undefined' ? DOMPurify.sanitize(content) : content;
  const cleaned = safe.replace(/<br\s*\/?>/gi, '\n');
  const normalised = normaliseMarkdown(cleaned);

  // ── 3. During streaming: split text / table and show skeleton ─────────
  if (isStreaming) {
    const lines = normalised.split('\n');
    const tableStart = findTableBlockStart(lines);

    if (tableStart !== -1) {
      // We have a partial table being streamed — show text + skeleton
      let textPart = lines.slice(0, tableStart).join('\n').trimEnd();
      // auto-close bold
      const boldCount = (textPart.match(/\*\*/g) || []).length;
      if (boldCount % 2 !== 0) textPart += '**';

      return (
        <div className="space-y-1 font-sans text-sm leading-relaxed text-foreground break-words">
          {textPart && (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
              {textPart}
            </ReactMarkdown>
          )}
          <TableSkeleton />
        </div>
      );
    }

    // No table yet — render text with blinking cursor
    let textPart = normalised;
    const boldCount = (textPart.match(/\*\*/g) || []).length;
    if (boldCount % 2 !== 0) textPart += '**';
    textPart += ' ▍';

    return (
      <div className="space-y-4 font-sans text-sm leading-relaxed text-foreground break-words">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
          {textPart}
        </ReactMarkdown>
      </div>
    );
  }

  // ── 4. Done streaming — render full normalised content cleanly ────────
  return (
    <div className="space-y-4 font-sans text-sm leading-relaxed text-foreground break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
        {normalised}
      </ReactMarkdown>
    </div>
  );
}

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: "**Workforce Operational Intelligence**\n\nI am grounded directly on your normalized activity logs and HRMS compensation schema — no wrappers, no hallucination.\n\n- Ask about time expenditure, repetitive cost, or automation ROI by department, task, or employee.\n- Follow up with multi-turn context like *\"break that down by department\"*.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState<boolean>(true);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const [pendingRetryQuery, setPendingRetryQuery] = useState<string | null>(null);
  const [rateLimitMsgId, setRateLimitMsgId] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (window.innerWidth < 640) setIsSuggestionsOpen(false); }, []);

  const userMessagesCount = messages.filter(m => m.sender === 'user').length;
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (userMessagesCount > 0) setIsSuggestionsOpen(false); }, [userMessagesCount]);

  useEffect(() => {
    if (rateLimitCountdown === null) return;
    if (rateLimitCountdown <= 0) {
      if (pendingRetryQuery && retryCountRef.current < 2) {
        retryCountRef.current += 1;
        const q = pendingRetryQuery;
        setPendingRetryQuery(null); setRateLimitCountdown(null);
        if (rateLimitMsgId) { setMessages(p => p.filter(m => m.id !== rateLimitMsgId)); setRateLimitMsgId(null); }
        sendMessage(q);
      } else { setRateLimitCountdown(null); }
      return;
    }
    const t = setTimeout(() => setRateLimitCountdown(c => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateLimitCountdown]);

  const retryNow = useCallback(() => {
    if (!pendingRetryQuery) return;
    const q = pendingRetryQuery;
    retryCountRef.current += 1;
    setPendingRetryQuery(null); setRateLimitCountdown(null);
    if (rateLimitMsgId) { setMessages(p => p.filter(m => m.id !== rateLimitMsgId)); setRateLimitMsgId(null); }
    sendMessage(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRetryQuery, rateLimitMsgId]);

  const sendMessage = async (query: string) => {
    if (!query.trim() || isLoading) return;
    setRateLimitCountdown(null); setPendingRetryQuery(null); retryCountRef.current = 0;
    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: query };
    const aiId = (Date.now() + 1).toString();
    setMessages(p => [...p, userMsg, { id: aiId, sender: 'ai', text: '', isStreaming: true }]);
    setInput(''); setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ message: query, sessionId }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Connection error.'); }
      const reader = res.body?.getReader();
      if (!reader) throw new Error();
      const dec = new TextDecoder();
      let acc = '', wasRateLimited = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const str = line.slice(6).trim();
          if (!str) continue;
          try {
            const p = JSON.parse(str);
            if (p.sessionId) setSessionId(p.sessionId);
            if (p.rateLimited) {
              wasRateLimited = true;
              setMessages(ms => ms.map(m => m.id === aiId ? { ...m, isStreaming: false, isRateLimited: true } : m));
              setRateLimitMsgId(aiId); setPendingRetryQuery(query); setRateLimitCountdown(30); setIsLoading(false);
            } else if (p.error) { acc += p.error; setMessages(ms => ms.map(m => m.id === aiId ? { ...m, text: acc } : m)); }
            else if (p.content) { acc += p.content; setMessages(ms => ms.map(m => m.id === aiId ? { ...m, text: acc } : m)); }
          } catch { /* ignore */ }
        }
      }
      if (!wasRateLimited) setMessages(ms => ms.map(m => m.id === aiId ? { ...m, isStreaming: false } : m));
    } catch (err: any) {
      setMessages(ms => ms.map(m => m.id === aiId ? { ...m, text: err.message || 'Connection error.', isStreaming: false } : m));
    } finally { setIsLoading(false); }
  };

  const clearChat = () => {
    setMessages([{ id: 'welcome', sender: 'ai', text: "**Workforce Operational Intelligence**\n\nI am grounded directly on your normalized activity logs and HRMS compensation schema — no wrappers, no hallucination.\n\n- Ask about time expenditure, repetitive cost, or automation ROI by department, task, or employee.\n- Follow up with multi-turn context like *\"break that down by department\"*." }]);
    setSessionId(undefined); setIsSuggestionsOpen(true); setRateLimitCountdown(null); setPendingRetryQuery(null); setRateLimitMsgId(null); retryCountRef.current = 0;
  };

  return (
    <div className="flex flex-col h-full min-h-0 animate-fade-in overflow-hidden relative sm:rounded-none border-0 sm:border border-border/50 shadow-sm bg-card">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 px-3 sm:px-6 bg-background/40 relative" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="sticky top-0 z-10 flex justify-end pt-3 pb-1 pointer-events-none">
          <button onClick={clearChat} className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-none bg-card/90 hover:bg-muted backdrop-blur-md text-muted-foreground hover:text-foreground border border-border/70 text-[11px] sm:text-xs font-bold transition-all shadow-md active:scale-95">
            <RotateCcw className="w-3.5 h-3.5 text-primary" /><span>New Session</span>
          </button>
        </div>
        <div className="flex flex-col min-h-[calc(100%-2.5rem)] pb-32 sm:pb-24 pt-2 space-y-4 sm:space-y-5">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`w-full max-w-[94%] sm:max-w-[85%] lg:max-w-[78%] rounded-none px-3.5 py-3 sm:px-5 sm:py-4 ${m.sender === 'user' ? 'bg-primary border border-primary/40 text-primary-foreground ml-auto shadow-md' : 'bg-card border border-border/70 text-foreground shadow-md'}`}>
                {m.sender === 'user' ? (
                  <p className="text-xs sm:text-sm font-medium leading-relaxed">{m.text}</p>
                ) : (
                  <div className="space-y-2">
                    {m.isRateLimited ? (
                      <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 rounded-none bg-amber-500/10 border border-amber-500/30">
                          <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-accent">All free AI models are rate-limited (429)</p>
                            <p className="text-[11px] text-accent/80 font-mono mt-0.5">
                              {retryCountRef.current >= 2 ? 'Maximum auto-retries reached.' : rateLimitCountdown !== null && rateLimitMsgId === m.id ? `Auto-retrying in ${rateLimitCountdown}s…` : 'Ready to retry.'}
                            </p>
                          </div>
                        </div>
                        {rateLimitCountdown !== null && rateLimitMsgId === m.id && retryCountRef.current < 2 && (
                          <div className="space-y-1.5">
                            <div className="h-1.5 w-full rounded-none bg-muted overflow-hidden">
                              <div className="h-full rounded-none bg-accent transition-all duration-1000 ease-linear" style={{ width: `${(rateLimitCountdown / 30) * 100}%` }} />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 text-[11px] text-accent/70 font-mono"><Clock className="w-3 h-3" />Auto-retry in {rateLimitCountdown}s</span>
                              <button onClick={retryNow} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 text-accent text-[11px] font-bold transition-all active:scale-95"><RefreshCw className="w-3 h-3" />Retry Now</button>
                            </div>
                          </div>
                        )}
                        {rateLimitCountdown === null && retryCountRef.current < 2 && rateLimitMsgId === m.id && (
                          <button onClick={retryNow} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-none bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 text-accent text-xs font-bold transition-all active:scale-95"><RefreshCw className="w-3.5 h-3.5" />Retry</button>
                        )}
                      </div>
                    ) : (
                      <>
                        {m.isStreaming ? (
                          m.text.length === 0 ? (
                            /* Phase 1: No tokens yet — thinking skeleton */
                            <div className="flex flex-col gap-3 py-1">
                              <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono">
                                <span className="flex gap-1">
                                  <span className="w-2 h-2 rounded-none bg-primary animate-bounce [animation-delay:0ms]" />
                                  <span className="w-2 h-2 rounded-none bg-primary animate-bounce [animation-delay:150ms]" />
                                  <span className="w-2 h-2 rounded-none bg-primary animate-bounce [animation-delay:300ms]" />
                                </span>
                                <span className="animate-pulse">Analyzing workforce data...</span>
                              </div>
                              <div className="space-y-2 opacity-25">
                                <div className="h-2 bg-muted rounded-none w-3/4 animate-pulse" />
                                <div className="h-2 bg-muted rounded-none w-full animate-pulse [animation-delay:150ms]" />
                                <div className="h-2 bg-muted rounded-none w-5/6 animate-pulse [animation-delay:300ms]" />
                              </div>
                            </div>
                          ) : (
                            /* Phase 2: Tokens streaming — AIMessageBody handles text + table skeleton */
                            <AIMessageBody content={m.text} msgId={m.id} isStreaming={true} />
                          )
                        ) : (
                          /* Phase 3: Done — full rich formatted output */
                          <div className="animate-fade-in">
                            <AIMessageBody content={m.text} msgId={m.id} isStreaming={false} />
                            {m.id !== 'welcome' && (
                              <div className="flex items-center gap-1.5 pt-2 mt-1 border-t border-border/40 text-[11px] text-muted-foreground font-mono">
                                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                                <span>Grounded on database records</span>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      {/* Bottom Panel */}
      <div className="shrink-0 border-t border-border/70 bg-card/95 backdrop-blur-md shadow-2xl z-20 flex flex-col" style={{ maxHeight: '60vh' }}>
        {rateLimitCountdown !== null && (
          <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-500/8 border-b border-amber-500/20 animate-fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-3.5 h-3.5 text-accent shrink-0 animate-pulse" />
              <p className="text-[11px] font-mono text-accent/80">Rate-limited · Auto-retrying in <span className="font-black text-accent">{rateLimitCountdown}s</span></p>
            </div>
            <button onClick={() => { setRateLimitCountdown(null); setPendingRetryQuery(null); }} className="text-[10px] font-bold text-accent/60 hover:text-accent font-mono transition-colors shrink-0">Cancel</button>
          </div>
        )}
        <div className="border-b border-border/50 bg-card">
          <button type="button" onClick={() => setIsSuggestionsOpen(!isSuggestionsOpen)} className="w-full px-3 sm:px-6 py-2 flex items-center justify-between text-xs font-bold text-muted-foreground hover:text-foreground transition-colors group">
            <span className="flex items-center gap-2 font-mono uppercase tracking-wider text-[10px] sm:text-[11px] text-primary">
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Suggested Prompts ({SUGGESTED_AI_QUERIES.length})</span>
            </span>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground group-hover:text-primary transition-colors">
              <span>{isSuggestionsOpen ? 'Collapse' : 'Expand Suggestions'}</span>
              <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${isSuggestionsOpen ? 'rotate-180 text-primary' : 'text-muted-foreground'}`} />
            </div>
          </button>
          {isSuggestionsOpen && (
            <div className="px-3 sm:px-6 pb-3 pt-1 animate-fade-in border-t border-border/40 overflow-y-auto overscroll-contain" style={{ maxHeight: '35vh', WebkitOverflowScrolling: 'touch' }}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {SUGGESTED_AI_QUERIES.slice(0, 5).map((q, idx) => (
                  <button key={idx} onClick={() => sendMessage(q)} className="text-left text-xs py-2 px-3.5 rounded-none bg-muted/40 hover:bg-muted/80 border border-border/60 hover:border-primary/50 text-muted-foreground hover:text-foreground font-sans font-medium transition-all flex items-center justify-between gap-2 group shadow-sm overflow-hidden">
                    <span className="truncate sm:line-clamp-2 sm:whitespace-normal leading-snug">{q}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="px-3 sm:px-6 py-3 sm:py-4">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex items-center gap-2.5">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} disabled={isLoading} placeholder="Ask about repetitive tasks, automation ROI..." className="flex-1 bg-background border border-border/80 rounded-none px-4 py-3.5 sm:px-5 sm:py-4 text-sm sm:text-base text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all font-sans shadow-inner min-w-0" />
            <button type="submit" disabled={!input.trim() || isLoading} className="p-3.5 sm:p-4 rounded-none bg-primary text-primary-foreground font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md active:scale-95 shrink-0 hover:scale-[1.02] flex items-center justify-center">
              <Send className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
