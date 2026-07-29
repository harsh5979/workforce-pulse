import { Router } from 'express';
import { getCategoryBreakdown, getAutomationRanking } from '../services/analytics/ranking.service';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const groupBy = (req.query.groupBy as 'task_category' | 'app_used' | 'department') ?? 'task_category';
    const filters = {
      department:   req.query.department as string | undefined,
      week:         req.query.week ? parseInt(req.query.week as string) : undefined,
      taskCategory: req.query.category as string | undefined,
    };
    const data = await getCategoryBreakdown(groupBy, filters);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/ranking', async (req, res) => {
  try {
    const filters = {
      department: req.query.department as string | undefined,
      week:       req.query.week ? parseInt(req.query.week as string) : undefined,
    };
    const data = await getAutomationRanking(filters);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
