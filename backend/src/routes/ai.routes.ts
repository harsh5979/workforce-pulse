import { Router } from 'express';
import { streamAIChat } from '../services/ai/ai.service';
import { buildAIContext } from '../services/ai/context-builder';
import { aiRateLimiter, validateAiChatInput } from '../middleware/ai.security';
import { db } from '../config/db';
import { chatSessions, chatMessages } from '../db/schema';
import { eq, desc, asc, and, lt } from 'drizzle-orm';

const router = Router();

// Helper to get user from token
function getUserFromReq(req: any) {
  try {
    let token = req.cookies?.auth_token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
      return JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    }
  } catch (e) {}
  return null;
}

// POST /api/ai/chat — streaming SSE endpoint
router.post('/chat', aiRateLimiter, validateAiChatInput, async (req, res) => {
  const { message, sessionId } = req.body as { message: string; sessionId?: string };

  const user = getUserFromReq(req);
  if (!user) {
    // For strict security, we should reject. 
    // res.status(401).json({ error: 'Unauthorized' });
    // return;
  }

  try {
    await streamAIChat(sessionId ?? null, message.trim(), res, user);
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// GET /api/ai/context — returns the current data context (for debugging/transparency)
router.get('/context', async (req, res) => {
  try {
    const context = await buildAIContext();
    res.json(context);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/briefing — returns a proactive morning briefing based on data
router.get('/briefing', async (req, res) => {
  try {
    const data = await buildAIContext();
    let highestDept = data.departmentBreakdown[0];
    let topEmployee = data.topRepetitiveEmployees[0];
    
    let text = `**Workforce Operational Intelligence**\n\nI am grounded directly on your normalized activity logs and HRMS compensation schema.\n\n`;
    text += `**Morning Briefing:**\n`;
    text += `- Total Repetitive Work: **${data.datasetInfo.totalRepetitiveHours}h** (${data.datasetInfo.repetitiveSharePct}% of logged time).\n`;
    if (highestDept) text += `- **${highestDept.department}** leads with ${highestDept.repHours}h of repetitive work.\n`;
    if (topEmployee) text += `- Automation ROI Potential: **₹${data.headlineMetrics.inrRecoverablePerMonth.toLocaleString('en-IN')}/mo**.\n\n`;
    
    text += `*Ask about time expenditure, repetitive cost, or automation ROI. Try clicking a suggestion below.*`;
    
    res.json({ text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/session/current — get full history for the single session
router.get('/session/current', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    const userId = user ? user.id : 'default';
    const sessionId = `session_${userId}`;

    const { limit = '7', cursor } = req.query;
    const limitNum = parseInt(limit as string, 10) || 7;

    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, sessionId)
    });
    
    // Return empty messages if session doesn't exist yet, instead of 404
    if (!session) {
      return res.json({ session: { id: sessionId }, messages: [] });
    }
    
    let whereClause = eq(chatMessages.sessionId, sessionId);
    if (cursor) {
      whereClause = and(whereClause, lt(chatMessages.id, parseInt(cursor as string, 10))) as any;
    }
    
    // Fetch in descending order to get the latest messages before the cursor
    const messagesDesc = await db.query.chatMessages.findMany({
      where: whereClause,
      orderBy: [desc(chatMessages.createdAt), desc(chatMessages.id)],
      limit: limitNum
    });
    
    // Reverse to send them in chronological order
    const messages = messagesDesc.reverse();
    
    res.json({ session, messages, nextCursor: messages.length > 0 ? messages[0].id : null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ai/session/current — clear the user's history
router.delete('/session/current', async (req, res) => {
  try {
    const user = getUserFromReq(req);
    const userId = user ? user.id : 'default';
    const sessionId = `session_${userId}`;
    
    // Instead of deleting the session (which we keep 1:1), we just delete messages
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
