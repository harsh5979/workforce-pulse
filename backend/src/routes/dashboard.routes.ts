import { Router } from 'express';
import { getHeadlineMetrics } from '../services/analytics/headline.service';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const filters = {
      department:   req.query.department as string | undefined,
      taskCategory: req.query.category as string | undefined,
      week:         req.query.week ? parseInt(req.query.week as string) : undefined,
    };
    const data = await getHeadlineMetrics(filters);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
