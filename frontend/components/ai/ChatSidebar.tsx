'use client';

import React, { useEffect, useState } from 'react';
import { Clock, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '@/lib/constants';

interface ChatSession {
  id: string;
  title: string;
  lastActiveAt: string;
}

export function ChatSidebar({
  currentSessionId,
  onSelectSession,
  onNewSession
}: {
  currentSessionId: string | undefined;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, [currentSessionId]); // Refetch when current session changes (might have new messages/updated time)

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/ai/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-64 border-r border-border/50 bg-muted/20 flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-border/50">
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-2 px-4 rounded-none hover:opacity-90 transition-opacity active:scale-95 shadow-sm text-sm"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.length === 0 && !isLoading ? (
          <div className="text-center p-4 text-xs text-muted-foreground">No past chats</div>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left rounded-none transition-colors group ${
                currentSessionId === session.id
                  ? 'bg-primary/10 border border-primary/30 text-foreground'
                  : 'hover:bg-muted border border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageSquare className={`w-4 h-4 shrink-0 ${currentSessionId === session.id ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">
                  {session.title}
                </div>
                <div className="text-[10px] opacity-70 flex items-center gap-1 mt-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {new Date(session.lastActiveAt).toLocaleDateString()}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
