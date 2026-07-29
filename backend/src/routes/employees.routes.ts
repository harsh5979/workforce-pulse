import { Router } from 'express';
import { getEmployeeList, getEmployeeProfile } from '../services/analytics/employee.service';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const filters = {
      department:   req.query.department as string | undefined,
      taskCategory: req.query.category as string | undefined,
      week:         req.query.week ? parseInt(req.query.week as string) : undefined,
    };
    const data = await getEmployeeList(filters);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const profile = await getEmployeeProfile(req.params.id.toUpperCase());
    if (!profile) return res.status(404).json({ error: 'Employee not found' });
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
