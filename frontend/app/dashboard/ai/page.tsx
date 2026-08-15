'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, ChevronRight, ShieldCheck, CornerDownRight, RotateCcw, ChevronDown, AlertTriangle, RefreshCw, Clock } from 'lucide-react';
import { SUGGESTED_AI_QUERIES, API_BASE_URL } from '@/lib/constants';
import DOMPurify from 'dompurify';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  isStreaming?: boolean;
  isRateLimited?: boolean; // all free models returned 429
}

// Inline markdown -> JSX renderer (bold, currency, hours, code, italic, and clean break sanitization)
function renderInline(text: string, key: string) {
  // Replace any raw <br>, <br/>, or <br /> with clean bullet spacing
  const cleaned = text.replace(/<br\s*\/?>/gi, ' • ');
  const parts = cleaned.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|₹[\d,]+(\.\d+)?|\b[\d.]+\s*(?:hrs?|hours?)\b)/g);

  return parts.filter(Boolean).map((part, i) => {
    const k = `${key}-${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      return <strong key={k} className="font-bold text-primary-foreground">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**') && part.length > 2)
      return <em key={k} className="italic text-foreground">{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      return <code key={k} className="font-mono text-[11px] bg-muted text-accent px-1.5 py-0.5 rounded border border-border">{part.slice(1, -1)}</code>;
    if (part.startsWith('₹'))
      return <span key={k} className="font-mono font-black text-accent">{part}</span>;
    if (/\b[\d.]+\s*(?:hrs?|hours?)\b/.test(part))
      return <span key={k} className="font-mono font-bold text-primary">{part}</span>;
    return <span key={k}>{part}</span>;
  });
}

// Parse a bullet "**Key:** Value" or "**Key** Value" into {label, value}
function parseBulletKV(text: string): { label: string; value: string } | null {
  const m1 = text.match(/^\*\*(.+?)\*\*[\s:–\-]+(.+)$/);
  if (m1) return { label: m1[1].trim(), value: m1[2].trim() };
  const m2 = text.match(/^([A-Za-z][^:]{2,40}):\s+\*\*(.+?)\*\*(.*)$/);
  if (m2) return { label: m2[1].trim(), value: (m2[2] + m2[3]).trim() };
  return null;
}

// Check if a plain line is a bold-label KV line
function isPlainKVLine(line: string): { label: string; value: string } | null {
  const m = line.match(/^\*\*(.+?)\*\*[\s:–\-]+(.+)$/);
  if (m && !line.startsWith('#')) return { label: m[1].trim(), value: m[2].trim() };
  return null;
}

function AIMessageBody({ content, msgId, isStreaming }: { content: string; msgId: string; isStreaming?: boolean }) {
  if (!content) return null;

  // DOMPurify to sanitize ALL incoming text to prevent XSS (even though React escapes, this handles encoded vectors)
  const safeContent = typeof window !== 'undefined' ? DOMPurify.sanitize(content) : content;

  // Clean raw HTML <br> tags into standard line breaks
  const sanitizedContent = safeContent.replace(/<br\s*\/?>/gi, '\n');

  // While streaming: show clean text
  if (isStreaming) {
    return (
      <p className="text-sm text-foreground leading-relaxed font-sans whitespace-pre-wrap">
        {sanitizedContent}
      </p>
    );
  }

  const lines = sanitizedContent.split('\n');
  const out: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) { i++; continue; }

    // ── 1. MARKDOWN TABLE → Styled DataGrid ──────────────────────────────────
    if (line.includes('|') && line.split('|').length > 2) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].split('|').length > 2) {
        tableLines.push(lines[i].trim());
        i++;
      }

      const parseRow = (r: string) =>
        r.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

      const headers = parseRow(tableLines[0]);
      const dataRows = tableLines.slice(1).filter(l => !/^[|\s:-]+$/.test(l)).map(parseRow);

      if (headers.length > 0 && dataRows.length > 0) {
        out.push(
          <div key={`tbl-${msgId}-${i}`} className="my-3 overflow-x-auto max-w-full rounded-none border border-border/80 shadow-lg touch-pan-x scrollbar-thin">
            <table className="w-full min-w-[460px] text-left border-collapse text-[11px] sm:text-xs">
              <thead>
                <tr className="bg-muted border-b border-border">
                  {headers.map((h, hi) => (
                    <th key={hi} className={`py-2.5 px-3 sm:py-3 sm:px-4 font-bold text-primary uppercase tracking-wider text-[10px] sm:text-[11px] whitespace-nowrap ${hi === 0 ? 'rounded-none' : ''} ${hi === headers.length - 1 ? 'rounded-none' : ''}`}>
                      {h.replace(/\*/g, '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, ri) => (
                  <tr key={ri} className={`border-b border-border transition-colors hover:bg-primary/5 ${ri % 2 === 0 ? 'bg-card' : 'bg-background/60'}`}>
                    {row.map((cell, ci) => (
                      <td key={ci} className={`py-2 px-3 sm:py-3 sm:px-4 ${ci === 0 ? 'font-semibold text-primary-foreground' : 'text-foreground'}`}>
                        {renderInline(cell, `${msgId}-${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-3 sm:px-4 py-2 bg-card border-t border-border/60 text-[10px] text-muted-foreground font-mono rounded-none">
              {dataRows.length} row{dataRows.length !== 1 ? 's' : ''} · sourced from normalized workforce telemetry
            </div>
          </div>
        );
        continue;
      }
    }

    // ── 2. SECTION HEADING ────────────────────────────────────────────────────
    if (/^#{1,3}\s/.test(line) || (line.startsWith('**') && line.endsWith('**') && !line.slice(2, -2).includes('**'))) {
      const title = line.replace(/^#+\s*/, '').replace(/^\*\*|\*\*$/g, '').trim();
      out.push(
        <div key={`hdr-${msgId}-${i}`} className="flex items-center gap-2 mt-4 mb-2 first:mt-0 pb-2 border-b border-border/60">
          <div className="w-1 h-4 rounded-none bg-emerald-400 shrink-0" />
          <h4 className="text-xs font-extrabold uppercase tracking-widest text-primary font-mono">
            {title}
          </h4>
        </div>
      );
      i++; continue;
    }

    // ── 3. BULLET LINES — collect consecutive KV pairs into a styled card ────
    if (/^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const kvGroup: Array<{ label: string; value: string }> = [];
      const plainBullets: string[] = [];

      while (i < lines.length) {
        const bl = lines[i].trim();
        if (!bl) break;
        if (!/^[-*•]\s+/.test(bl) && !/^\d+\.\s+/.test(bl)) break;
        const item = bl.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '').trim();
        const kv = parseBulletKV(item);
        if (kv) {
          if (plainBullets.length > 0) break;
          kvGroup.push(kv);
        } else {
          if (kvGroup.length > 0) break;
          plainBullets.push(item);
        }
        i++;
      }

      if (kvGroup.length > 0) {
        out.push(
          <div key={`kv-card-${msgId}-${i}`} className="my-3 rounded-none border border-border/70 overflow-hidden shadow-md bg-card">
            {kvGroup.map((kv, ki) => (
              <div
                key={ki}
                className={`flex items-start gap-3 px-4 py-2.5 ${ki < kvGroup.length - 1 ? 'border-b border-border' : ''} ${ki % 2 === 0 ? 'bg-background/40' : 'bg-background/40'} hover:bg-primary/5 transition-colors`}
              >
                <span className="text-[11px] font-bold text-muted-foreground font-mono shrink-0 pt-0.5 min-w-[130px] leading-snug">
                  {kv.label}
                </span>
                <span className="text-sm font-semibold text-primary-foreground font-sans leading-snug flex-1">
                  {renderInline(kv.value, `kv-${msgId}-${ki}`)}
                </span>
              </div>
            ))}
          </div>
        );
      }

      if (plainBullets.length > 0) {
        plainBullets.forEach((item, pi) => {
          out.push(
            <div key={`li-${msgId}-${i}-${pi}`} className="flex items-start gap-2.5 py-1 text-sm text-foreground leading-relaxed">
              <div className="w-1.5 h-1.5 rounded-none bg-emerald-400 shrink-0 mt-[7px]" />
              <span className="font-sans">{renderInline(item, `li-${msgId}-${pi}`)}</span>
            </div>
          );
        });
      }
      continue;
    }

    // ── 4. NON-BULLET bold-label KV line ──────────────────────────────────────
    {
      const plainKV = isPlainKVLine(line);
      if (plainKV) {
        const kvGroup: Array<{ label: string; value: string }> = [];
        while (i < lines.length) {
          const bl = lines[i].trim();
          if (!bl) break;
          if (/^[-*•]\s+/.test(bl) || /^#{1,3}\s/.test(bl)) break;
          const kv = isPlainKVLine(bl);
          if (!kv) break;
          kvGroup.push(kv);
          i++;
        }
        if (kvGroup.length > 0) {
          out.push(
            <div key={`pkv-card-${msgId}-${i}`} className="my-3 rounded-none border border-border/70 overflow-hidden shadow-md bg-card">
              {kvGroup.map((kv, ki) => (
                <div
                  key={ki}
                  className={`flex items-start gap-3 px-4 py-2.5 ${ki < kvGroup.length - 1 ? 'border-b border-border' : ''} ${ki % 2 === 0 ? 'bg-background/40' : 'bg-background/40'}`}
                >
                  <span className="text-[11px] font-bold text-muted-foreground font-mono shrink-0 pt-0.5 min-w-[130px] leading-snug">
                    {kv.label}
                  </span>
                  <span className="text-sm font-semibold text-primary-foreground font-sans leading-snug flex-1">
                    {renderInline(kv.value, `pkv-${msgId}-${ki}`)}
                  </span>
                </div>
              ))}
            </div>
          );
          continue;
        }
      }
    }

    // ── 5. NORMAL PARAGRAPH ───────────────────────────────────────────────────
    out.push(
      <p key={`p-${msgId}-${i}`} className="text-sm text-foreground leading-relaxed my-1.5 font-sans">
        {renderInline(line, `p-${msgId}-${i}`)}
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5">{out}</div>;
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
  // Rate-limit state: countdown (seconds), pending query for retry, and retry attempt count
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const [pendingRetryQuery, setPendingRetryQuery] = useState<string | null>(null);
  const [rateLimitMsgId, setRateLimitMsgId] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  // Collapse suggestions by default on mobile to save vertical space
  useEffect(() => {
    if (window.innerWidth < 640) {
      setIsSuggestionsOpen(false);
    }
  }, []);

  // Count user messages to auto-collapse accordion after 1 message sent
  const userMessagesCount = messages.filter(m => m.sender === 'user').length;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-collapse suggested questions accordion when first user message is sent
  useEffect(() => {
    if (userMessagesCount > 0) {
      setIsSuggestionsOpen(false);
    }
  }, [userMessagesCount]);

  // ── Countdown timer: tick every second, auto-retry at 0 ──────────────────
  useEffect(() => {
    if (rateLimitCountdown === null) return;
    if (rateLimitCountdown <= 0) {
      // Auto-retry if we haven't exceeded max retries
      if (pendingRetryQuery && retryCountRef.current < 2) {
        retryCountRef.current += 1;
        const q = pendingRetryQuery;
        setPendingRetryQuery(null);
        setRateLimitCountdown(null);
        // Remove the rate-limited bubble before retrying
        if (rateLimitMsgId) {
          setMessages(p => p.filter(m => m.id !== rateLimitMsgId));
          setRateLimitMsgId(null);
        }
        sendMessage(q);
      } else {
        // Max retries hit — stop countdown, leave bubble with dismiss option
        setRateLimitCountdown(null);
      }
      return;
    }
    const t = setTimeout(() => setRateLimitCountdown(c => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateLimitCountdown]);

  // Manual "Retry Now" handler
  const retryNow = useCallback(() => {
    if (!pendingRetryQuery) return;
    const q = pendingRetryQuery;
    retryCountRef.current += 1;
    setPendingRetryQuery(null);
    setRateLimitCountdown(null);
    if (rateLimitMsgId) {
      setMessages(p => p.filter(m => m.id !== rateLimitMsgId));
      setRateLimitMsgId(null);
    }
    sendMessage(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRetryQuery, rateLimitMsgId]);

  const sendMessage = async (query: string) => {
    if (!query.trim() || isLoading) return;

    // Clear any previous rate-limit state on a new send
    setRateLimitCountdown(null);
    setPendingRetryQuery(null);
    retryCountRef.current = 0;

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: query };
    const aiId = (Date.now() + 1).toString();
    const aiMsg: Message = { id: aiId, sender: 'ai', text: '', isStreaming: true };

    setMessages(p => [...p, userMsg, aiMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: query, sessionId }),
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Connection error. The server may be unreachable.');
      }

      const reader = res.body?.getReader();
      const dec = new TextDecoder();
      if (!reader) throw new Error();

      let acc = '';
      let wasRateLimited = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const str = line.slice(6).trim();
          if (!str) continue;
          try {
            const parsed = JSON.parse(str);
            if (parsed.sessionId) setSessionId(parsed.sessionId);
            if (parsed.rateLimited) {
              // All free models returned 429:
              // 1. Mark the bubble as rate-limited (don't remove it — show inline UI)
              // 2. Release isLoading immediately so UI stays responsive
              // 3. Start 30s countdown for auto-retry
              wasRateLimited = true;
              setMessages(p => p.map(m =>
                m.id === aiId ? { ...m, isStreaming: false, isRateLimited: true } : m
              ));
              setRateLimitMsgId(aiId);
              setPendingRetryQuery(query);
              setRateLimitCountdown(30);
              setIsLoading(false); // release UI immediately
            } else if (parsed.error) {
              acc += `${parsed.error}`;
              setMessages(p => p.map(m => m.id === aiId ? { ...m, text: acc } : m));
            } else if (parsed.content) {
              acc += parsed.content;
              setMessages(p => p.map(m => m.id === aiId ? { ...m, text: acc } : m));
            }
          } catch { /* ignore */ }
        }
      }
      if (!wasRateLimited) {
        setMessages(p => p.map(m => m.id === aiId ? { ...m, isStreaming: false } : m));
      }
    } catch (err: any) {
      setMessages(p => p.map(m =>
        m.id === aiId
          ? { ...m, text: `${err.message || 'Connection error. The server may be unreachable.'}`, isStreaming: false }
          : m
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{
      id: 'welcome',
      sender: 'ai',
      text: "**Workforce Operational Intelligence**\n\nI am grounded directly on your normalized activity logs and HRMS compensation schema — no wrappers, no hallucination.\n\n- Ask about time expenditure, repetitive cost, or automation ROI by department, task, or employee.\n- Follow up with multi-turn context like *\"break that down by department\"*.",
    }]);
    setSessionId(undefined);
    setIsSuggestionsOpen(true);
    setRateLimitCountdown(null);
    setPendingRetryQuery(null);
    setRateLimitMsgId(null);
    retryCountRef.current = 0;
  };

  return (
    <div className="flex flex-col h-full min-h-0 animate-fade-in overflow-hidden relative sm:rounded-none border-0 sm:border border-border/50 shadow-sm bg-card">

      {/* Messages Area — Scrollable thread. flex-col (no justify-end) so content starts top and scrolls naturally on mobile */}
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 px-3 sm:px-6 bg-background/40 relative" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* New Session Button Floating Top Right */}
        <div className="sticky top-0 z-10 flex justify-end pt-3 pb-1 pointer-events-none">
          <button
            onClick={clearChat}
            className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-none bg-card/90 hover:bg-muted backdrop-blur-md text-muted-foreground hover:text-foreground border border-border/70 text-[11px] sm:text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5 text-primary" />
            <span>New Session</span>
          </button>
        </div>

        {/* No justify-end: let messages stack from top. Bottom padding ensures last message clears sticky input bar */}
        <div className="flex flex-col min-h-[calc(100%-2.5rem)] pb-32 sm:pb-24 pt-2 space-y-4 sm:space-y-5">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`w-full max-w-[94%] sm:max-w-[85%] lg:max-w-[78%] rounded-none px-3.5 py-3 sm:px-5 sm:py-4 ${m.sender === 'user'
                  ? 'bg-primary border border-primary/40 text-primary-foreground  ml-auto shadow-md'
                  : 'bg-card border border-border/70 text-foreground  shadow-md'
                  }`}
              >
                {m.sender === 'user' ? (
                  <p className="text-xs sm:text-sm font-medium leading-relaxed">{m.text}</p>
                ) : (
                  <div className="space-y-2">
                    {/* ── Rate-limit inline bubble ── */}
                    {m.isRateLimited ? (
                      <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 rounded-none bg-amber-500/10 border border-amber-500/30">
                          <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-accent">All free AI models are rate-limited (429)</p>
                            <p className="text-[11px] text-accent/80 font-mono mt-0.5">
                              Too many requests hit the free tier. {retryCountRef.current >= 2
                                ? 'Maximum auto-retries reached. Please try again manually in a minute.'
                                : rateLimitCountdown !== null && rateLimitMsgId === m.id
                                  ? `Auto-retrying in ${rateLimitCountdown}s…`
                                  : 'Ready to retry.'}
                            </p>
                          </div>
                        </div>
                        {/* Progress bar for countdown */}
                        {rateLimitCountdown !== null && rateLimitMsgId === m.id && retryCountRef.current < 2 && (
                          <div className="space-y-1.5">
                            <div className="h-1.5 w-full rounded-none bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-none bg-accent transition-all duration-1000 ease-linear"
                                style={{ width: `${(rateLimitCountdown / 30) * 100}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 text-[11px] text-accent/70 font-mono">
                                <Clock className="w-3 h-3" />
                                Auto-retry in {rateLimitCountdown}s
                              </span>
                              <button
                                onClick={retryNow}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 text-accent text-[11px] font-bold transition-all active:scale-95"
                              >
                                <RefreshCw className="w-3 h-3" />
                                Retry Now
                              </button>
                            </div>
                          </div>
                        )}
                        {/* Show retry button if max retries not hit and no countdown running */}
                        {rateLimitCountdown === null && retryCountRef.current < 2 && rateLimitMsgId === m.id && (
                          <button
                            onClick={retryNow}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-none bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 text-accent text-xs font-bold transition-all active:scale-95"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Retry
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {m.isStreaming ? (
                          m.text.length === 0 ? (
                            /* ── Phase 1: No tokens yet — show thinking skeleton ── */
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
                            /* ── Phase 2: Tokens arriving — show plain text immediately ── */
                            <div className="space-y-2">
                              <p className="text-sm text-foreground leading-relaxed font-sans whitespace-pre-wrap">
                                {m.text}
                                {/* Blinking cursor */}
                                <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
                              </p>
                            </div>
                          )
                        ) : (
                          /* ── Phase 3: Done — snap to full rich formatted output ── */
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

      {/* Bottom Panel: capped height so suggestions never overflow small screens */}
      <div className="shrink-0 border-t border-border/70 bg-card/95 backdrop-blur-md shadow-2xl z-20 flex flex-col" style={{ maxHeight: '60vh' }}>

        {/* ── Rate-limit countdown strip (only shown during active countdown) ── */}
        {rateLimitCountdown !== null && (
          <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-500/8 border-b border-amber-500/20 animate-fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-3.5 h-3.5 text-accent shrink-0 animate-pulse" />
              <p className="text-[11px] font-mono text-accent/80">
                Rate-limited · Auto-retrying in <span className="font-black text-accent">{rateLimitCountdown}s</span>
              </p>
            </div>
            <button
              onClick={() => { setRateLimitCountdown(null); setPendingRetryQuery(null); }}
              className="text-[10px] font-bold text-accent/60 hover:text-accent font-mono transition-colors shrink-0"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Collapsible Suggested Prompts Accordion Bar */}
        <div className="border-b border-border/50 bg-card">
          <button
            type="button"
            onClick={() => setIsSuggestionsOpen(!isSuggestionsOpen)}
            className="w-full px-3 sm:px-6 py-2 flex items-center justify-between text-xs font-bold text-muted-foreground hover:text-foreground transition-colors group"
          >
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
            <div className="px-3 sm:px-6 pb-3 pt-1 space-y-2.5 animate-fade-in border-t border-border/40 overflow-y-auto overscroll-contain" style={{ maxHeight: '35vh', WebkitOverflowScrolling: 'touch' }}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {SUGGESTED_AI_QUERIES.slice(0, 5).map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(q)}
                    className="text-left text-xs py-2 px-3.5 rounded-none bg-muted/40 hover:bg-muted/80 border border-border/60 hover:border-primary/50 text-muted-foreground hover:text-foreground font-sans font-medium transition-all flex items-center justify-between gap-2 group shadow-sm overflow-hidden"
                  >
                    <span className="truncate sm:line-clamp-2 sm:whitespace-normal leading-snug">{q}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
              {/* <button
                onClick={() => sendMessage('and break that down by department')}
                className="text-[11px] py-1.5 px-3 rounded-none bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-primary font-mono font-semibold transition-all flex items-center gap-2"
              >
                <CornerDownRight className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Follow-up: &quot;and break that down by department&quot;</span>
              </button> */}
            </div>
          )}
        </div>

        {/* Input Bar — Always Visible & Sticky at Bottom on Phones */}
        <div className="px-3 sm:px-6 py-3 sm:py-4">
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="flex items-center gap-2.5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder="Ask about repetitive tasks, automation ROI..."
              className="flex-1 bg-background border border-border/80 rounded-none px-4 py-3.5 sm:px-5 sm:py-4 text-sm sm:text-base text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all font-sans shadow-inner min-w-0"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-3.5 sm:p-4 rounded-none bg-primary text-primary-foreground font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md active:scale-95 shrink-0 hover:scale-[1.02] flex items-center justify-center"
            >
              <Send className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
