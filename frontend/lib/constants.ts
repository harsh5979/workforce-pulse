export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export const DEPT_COLORS: Record<string, string> = {
  'Sales':       'hsl(217, 91%, 60%)',   // blue
  'Finance':     'hsl(262, 80%, 65%)',   // purple
  'Operations':  'hsl(142, 76%, 36%)',   // green
  'CS':          'hsl(38, 92%, 50%)',    // amber
  'HR':          'hsl(328, 73%, 60%)',   // pink
  'Marketing':   'hsl(200, 91%, 52%)',   // cyan
  'Unknown':     'hsl(220, 14%, 40%)',   // gray
};

export const SEVERITY_COLORS = {
  high:   'hsl(0, 72%, 51%)',
  medium: 'hsl(38, 92%, 50%)',
  low:    'hsl(142, 76%, 36%)',
};

export const CHART_COLORS = [
  'hsl(217, 91%, 60%)',
  'hsl(262, 80%, 65%)',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(200, 91%, 52%)',
  'hsl(328, 73%, 60%)',
];

export const SUGGESTED_AI_QUERIES = [
  'Who in finance is spending the most time on email triage, and how much does it cost us per month?',
  "What's the single highest-ROI automation we should ship next quarter?",
  'Show me everyone whose repetitive-task share went up week-over-week.',
  'Which department has the most automation opportunity?',
  'What are the top 3 task categories we should automate first?',
];
