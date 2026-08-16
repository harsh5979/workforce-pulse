import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/db';
import { chatSessions, chatMessages } from '../../db/schema';
import { eq, asc, inArray } from 'drizzle-orm';

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

export async function getOrCreateSession(userId: string): Promise<string> {
  // Use the userId as the session ID for a 1:1 mapping
  const sessionId = `session_${userId}`;
  
  const existing = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.id, sessionId),
  });
  
  if (!existing) {
    await db.insert(chatSessions).values({ id: sessionId });
  }
  
  return sessionId;
}

export async function getSession(id: string): Promise<ConversationSession | null> {
  const session = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.id, id),
  });
  
  if (!session) return null;
  
  const history = await getHistory(id);
  
  return {
    id: session.id,
    messages: history,
    createdAt: session.createdAt,
    lastActiveAt: session.lastActiveAt,
  };
}

export async function addMessage(sessionId: string, message: Message): Promise<void> {
  // First ensure session exists
  const session = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.id, sessionId),
  });
  
  if (!session) return;

  // Insert the new message
  await db.insert(chatMessages).values({
    sessionId,
    role: message.role,
    content: message.content,
  });

  // Update last active
  await db.update(chatSessions)
    .set({ lastActiveAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
    
  // Enforce Max History for non-system messages
  const allMessages = await db.query.chatMessages.findMany({
    where: eq(chatMessages.sessionId, sessionId),
    orderBy: [asc(chatMessages.createdAt), asc(chatMessages.id)]
  });
  
  const nonSystem = allMessages.filter(m => m.role !== 'system');
  if (nonSystem.length > MAX_HISTORY) {
    const toDeleteCount = nonSystem.length - MAX_HISTORY;
    const toDeleteIds = nonSystem.slice(0, toDeleteCount).map(m => m.id);
    
    if (toDeleteIds.length > 0) {
      await db.delete(chatMessages).where(inArray(chatMessages.id, toDeleteIds));
    }
  }
}

export async function getHistory(sessionId: string): Promise<Message[]> {
  const messages = await db.query.chatMessages.findMany({
    where: eq(chatMessages.sessionId, sessionId),
    orderBy: [asc(chatMessages.createdAt), asc(chatMessages.id)]
  });
  
  return messages.map(m => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }));
}

export async function clearSessionMessages(sessionId: string): Promise<void> {
  await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
}
