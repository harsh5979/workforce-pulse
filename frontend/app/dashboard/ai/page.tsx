'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, ChevronRight, ShieldCheck, CornerDownRight, RotateCcw, ChevronDown, AlertTriangle, X } from 'lucide-react';
import { SUGGESTED_AI_QUERIES, API_BASE_URL } from '@/lib/constants';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  isStreaming?: boolean;
}

// Inline markdown -> JSX renderer (bold, currency, hours, code, italic, and clean break sanitization)
function renderInline(text: string, key: string) {
  // Replace any raw <br>, <br/>, or <br /> with clean bullet spacing
  const cleaned = text.replace(/<br\s*\/?>/gi, ' • ');
  const parts = cleaned.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|₹[\d,]+(\.\d+)?|\b[\d.]+\s*(?:hrs?|hours?)\b)/g);
  
  return parts.filter(Boolean).map((part, i) => {
    const k = `${key}-${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      return <strong key={k} className="font-bold text-white">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**') && part.length > 2)
      return <em key={k} className="italic text-slate-300">{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      return <code key={k} className="font-mono text-[11px] bg-slate-900 text-amber-300 px-1.5 py-0.5 rounded border border-slate-700">{part.slice(1, -1)}</code>;
    if (part.startsWith('₹'))
      return <span key={k} className="font-mono font-black text-amber-400">{part}</span>;
    if (/\b[\d.]+\s*(?:hrs?|hours?)\b/.test(part))
      return <span key={k} className="font-mono font-bold text-emerald-400">{part}</span>;
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

  // Clean raw HTML <br> tags into standard line breaks
  const sanitizedContent = content.replace(/<br\s*\/?>/gi, '\n');

  // While streaming: show clean text
  if (isStreaming) {
    return (
      <p className="text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
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
          <div key={`tbl-${msgId}-${i}`} className="my-4 overflow-x-auto rounded-xl border border-slate-700/80 shadow-lg">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700">
                  {headers.map((h, hi) => (
                    <th key={hi} className={`py-3 px-4 font-bold text-emerald-400 uppercase tracking-wider text-[11px] whitespace-nowrap ${hi === 0 ? 'rounded-tl-xl' : ''} ${hi === headers.length - 1 ? 'rounded-tr-xl' : ''}`}>
                      {h.replace(/\*/g, '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, ri) => (
                  <tr key={ri} className={`border-b border-slate-800/80 transition-colors hover:bg-emerald-500/5 ${ri % 2 === 0 ? 'bg-slate-950/60' : 'bg-slate-900/40'}`}>
                    {row.map((cell, ci) => (
                      <td key={ci} className={`py-3 px-4 ${ci === 0 ? 'font-semibold text-white' : 'text-slate-300'}`}>
                        {renderInline(cell, `${msgId}-${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 bg-slate-900/80 border-t border-slate-700/60 text-[10px] text-slate-400 font-mono rounded-b-xl">
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
        <div key={`hdr-${msgId}-${i}`} className="flex items-center gap-2 mt-4 mb-2 first:mt-0 pb-2 border-b border-slate-700/60">
          <div className="w-1 h-4 rounded-full bg-emerald-400 shrink-0" />
          <h4 className="text-xs font-extrabold uppercase tracking-widest text-emerald-300 font-mono">
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
          <div key={`kv-card-${msgId}-${i}`} className="my-3 rounded-xl border border-slate-700/70 overflow-hidden shadow-md bg-slate-950/60">
            {kvGroup.map((kv, ki) => (
              <div
                key={ki}
                className={`flex items-start gap-3 px-4 py-2.5 ${ki < kvGroup.length - 1 ? 'border-b border-slate-800/80' : ''} ${ki % 2 === 0 ? 'bg-slate-950/40' : 'bg-slate-900/30'} hover:bg-emerald-500/5 transition-colors`}
              >
                <span className="text-[11px] font-bold text-slate-400 font-mono shrink-0 pt-0.5 min-w-[130px] leading-snug">
                  {kv.label}
                </span>
                <span className="text-sm font-semibold text-white font-sans leading-snug flex-1">
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
            <div key={`li-${msgId}-${i}-${pi}`} className="flex items-start gap-2.5 py-1 text-sm text-slate-200 leading-relaxed">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-[7px]" />
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
            <div key={`pkv-card-${msgId}-${i}`} className="my-3 rounded-xl border border-slate-700/70 overflow-hidden shadow-md bg-slate-950/60">
              {kvGroup.map((kv, ki) => (
                <div
                  key={ki}
                  className={`flex items-start gap-3 px-4 py-2.5 ${ki < kvGroup.length - 1 ? 'border-b border-slate-800/80' : ''} ${ki % 2 === 0 ? 'bg-slate-950/40' : 'bg-slate-900/30'}`}
                >
                  <span className="text-[11px] font-bold text-slate-400 font-mono shrink-0 pt-0.5 min-w-[130px] leading-snug">
                    {kv.label}
                  </span>
                  <span className="text-sm font-semibold text-white font-sans leading-snug flex-1">
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
      <p key={`p-${msgId}-${i}`} className="text-sm text-slate-300 leading-relaxed my-1.5 font-sans">
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
  const [rateLimited, setRateLimited] = useState(false); // all models returned 429
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

  const sendMessage = async (query: string) => {
    if (!query.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: query };
    const aiId = (Date.now() + 1).toString();
    const aiMsg: Message = { id: aiId, sender: 'ai', text: '', isStreaming: true };

    setMessages(p => [...p, userMsg, aiMsg]);
    setInput('');
    setIsLoading(true);

    try {
      setRateLimited(false); // clear any previous rate-limit banner on new attempt
      const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query, sessionId }),
      });
      if (!res.ok) throw new Error();

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
              // All models returned 429 — remove the empty AI bubble and show banner
              wasRateLimited = true;
              setRateLimited(true);
              setMessages(p => p.filter(m => m.id !== aiId)); // remove empty bubble
            } else if (parsed.error) {
              acc += `\n**Notice:** ${parsed.error}`;
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
    } catch {
      setMessages(p => p.map(m =>
        m.id === aiId
          ? { ...m, text: '**Connection error.** Please verify your API key is configured in `.env` and try again.', isStreaming: false }
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
    setRateLimited(false);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-5.5rem)] lg:h-[calc(100dvh-6.5rem)] animate-fade-in overflow-hidden relative rounded-xl border border-border/50 shadow-sm bg-card">

      {/* Messages Area — Scrollable thread with comfortable bottom padding */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 bg-slate-950/40 min-h-0 relative">
        {/* New Session Button Floating Top Right */}
        <div className="sticky top-0 z-10 flex justify-end pt-3 pb-1 pointer-events-none">
          <button
            onClick={clearChat}
            className="pointer-events-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-card/90 hover:bg-muted backdrop-blur-md text-muted-foreground hover:text-foreground border border-border/70 text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5 text-primary" />
            <span>New Session</span>
          </button>
        </div>

        <div className="flex flex-col justify-end min-h-[calc(100%-2.5rem)] pb-8 space-y-5">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`w-full sm:max-w-[85%] lg:max-w-[78%] rounded-2xl px-5 py-4 ${m.sender === 'user'
                    ? 'bg-gradient-to-br from-primary/25 to-blue-600/20 border border-primary/40 text-white rounded-tr-none ml-auto shadow-md'
                    : 'bg-card border border-border/70 text-foreground rounded-tl-none shadow-md'
                  }`}
              >
                {m.sender === 'user' ? (
                  <p className="text-sm font-medium leading-relaxed">{m.text}</p>
                ) : (
                  <div className="space-y-2">
                    <AIMessageBody content={m.text} msgId={m.id} isStreaming={m.isStreaming} />
                    {m.isStreaming && (
                      <div className="flex items-center gap-2 pt-2 text-muted-foreground text-xs font-mono">
                        <span className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                        </span>
                        <span>Analyzing records...</span>
                      </div>
                    )}
                    {!m.isStreaming && m.id !== 'welcome' && (
                      <div className="flex items-center gap-1.5 pt-2 border-t border-border/40 text-[11px] text-muted-foreground font-mono">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Grounded on database records</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      {/* Bottom Panel: Rate-limit banner + Suggested Prompts + Input Bar */}
      <div className="shrink-0 border-t border-border/70 bg-card/95 backdrop-blur-md shadow-2xl z-20">

        {/* ── Rate-limit banner — shown ONLY when all models returned 429 ── */}
        {rateLimited && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-500/10 border-b border-amber-500/30 animate-fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-300">Too many requests — AI models are rate-limited</p>
                <p className="text-[11px] text-amber-400/80 font-mono">All free models returned 429. Please wait a moment and try again.</p>
              </div>
            </div>
            <button
              onClick={() => setRateLimited(false)}
              className="p-1 rounded-md hover:bg-amber-500/20 text-amber-400 shrink-0 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Collapsible Suggested Prompts Accordion Bar */}
        <div className="border-b border-border/50 bg-slate-950/60">
          <button
            type="button"
            onClick={() => setIsSuggestionsOpen(!isSuggestionsOpen)}
            className="w-full px-4 sm:px-6 py-2 flex items-center justify-between text-xs font-bold text-muted-foreground hover:text-foreground transition-colors group"
          >
            <span className="flex items-center gap-2 font-mono uppercase tracking-wider text-[11px] text-emerald-400">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Suggested Question Prompts ({SUGGESTED_AI_QUERIES.length})</span>
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground group-hover:text-primary transition-colors">
              <span>{isSuggestionsOpen ? 'Collapse' : 'Expand Suggestions'}</span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSuggestionsOpen ? 'rotate-180 text-primary' : 'text-muted-foreground'}`} />
            </div>
          </button>

          {isSuggestionsOpen && (
            <div className="px-4 sm:px-6 pb-3 pt-1 space-y-2.5 animate-fade-in border-t border-border/40">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {SUGGESTED_AI_QUERIES.slice(0, 3).map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(q)}
                    className="text-left text-xs py-2 px-3.5 rounded-xl bg-muted/40 hover:bg-muted/80 border border-border/60 hover:border-primary/50 text-muted-foreground hover:text-foreground font-sans font-medium transition-all flex items-center justify-between gap-2 group shadow-sm overflow-hidden"
                  >
                    <span className="truncate sm:line-clamp-2 sm:whitespace-normal leading-snug">{q}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
              <button
                onClick={() => sendMessage('and break that down by department')}
                className="text-[11px] py-1.5 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-300 font-mono font-semibold transition-all flex items-center gap-2"
              >
                <CornerDownRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Follow-up: &quot;and break that down by department&quot;</span>
              </button>
            </div>
          )}
        </div>

        {/* Input Bar — Always Visible at Bottom */}
        <div className="px-4 sm:px-6 py-3">
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="flex items-center gap-2.5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder="Ask about repetitive tasks, automation ROI, department costs..."
              className="flex-1 bg-slate-950/80 border border-border/80 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all font-sans shadow-inner"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-3 rounded-xl bg-gradient-to-r from-primary to-emerald-500 text-slate-950 font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md active:scale-95 shrink-0 hover:scale-[1.02]"
            >
              <Send className="w-4 h-4 text-slate-950 fill-slate-950" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
