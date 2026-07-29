import { Router } from 'express';
import { getWeekOverWeekTrend } from '../services/analytics/trends.service';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const filters = {
      department:   req.query.department as string | undefined,
      taskCategory: req.query.category as string | undefined,
    };
    const data = await getWeekOverWeekTrend(filters);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
