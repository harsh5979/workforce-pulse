import { Router } from 'express';
import { streamAIChat } from '../services/ai/ai.service';
import { buildAIContext } from '../services/ai/context-builder';

const router = Router();

// POST /api/ai/chat — streaming SSE endpoint
router.post('/chat', async (req, res) => {
  const { message, sessionId } = req.body as { message: string; sessionId?: string };

  if (!message?.trim()) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  try {
    await streamAIChat(sessionId ?? null, message.trim(), res);
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
