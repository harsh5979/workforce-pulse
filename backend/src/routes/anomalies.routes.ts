import { Router } from 'express';
import { detectAnomalies } from '../services/analytics/anomaly.service';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const data = await detectAnomalies();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
