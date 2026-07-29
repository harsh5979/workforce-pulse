require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  const r1 = await p.query("SELECT employee_id, task_category, SUM(duration_min::numeric) as total_mins, SUM(CASE WHEN is_repetitive THEN duration_min::numeric ELSE 0 END) as rep_mins FROM activity_logs WHERE employee_id = 'E017' GROUP BY employee_id, task_category ORDER BY total_mins DESC");
  console.log('E017 activity:', JSON.stringify(r1.rows));
  const r2 = await p.query("SELECT comp_annual_inr, working_hours_day FROM employees WHERE employee_id = 'E017'");
  console.log('E017 comp:', JSON.stringify(r2.rows));
  p.end();
}
run().catch(e => { console.log('Error:', e.message); p.end(); });
