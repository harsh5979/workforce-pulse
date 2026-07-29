import { v4 as uuidv4 } from 'uuid';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ConversationSession {
  id: string;
  messages: Message[];
  createdAt: Date;
  lastActiveAt: Date;
}

const MAX_HISTORY = 20;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// In-memory store (sufficient for single-user challenge)
const sessions = new Map<string, ConversationSession>();

// Cleanup stale sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActiveAt.getTime() > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}, 10 * 60 * 1000);

export function createSession(): string {
  const id = uuidv4();
  sessions.set(id, {
    id,
    messages: [],
    createdAt: new Date(),
    lastActiveAt: new Date(),
  });
  return id;
}

export function getSession(id: string): ConversationSession | null {
  return sessions.get(id) ?? null;
}

export function addMessage(sessionId: string, message: Message): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.messages.push(message);
  session.lastActiveAt = new Date();

  // Prune oldest non-system messages if over limit
  const nonSystem = session.messages.filter(m => m.role !== 'system');
  if (nonSystem.length > MAX_HISTORY) {
    const excess = nonSystem.length - MAX_HISTORY;
    session.messages = [
      ...session.messages.filter(m => m.role === 'system'),
      ...nonSystem.slice(excess),
    ];
  }
}

export function getHistory(sessionId: string): Message[] {
  return sessions.get(sessionId)?.messages ?? [];
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}
