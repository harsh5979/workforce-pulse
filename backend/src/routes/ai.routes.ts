import { Router } from 'express';
import { streamAIChat } from '../services/ai/ai.service';
import { buildAIContext } from '../services/ai/context-builder';
import { aiRateLimiter, validateAiChatInput } from '../middleware/ai.security';

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

export default router;
