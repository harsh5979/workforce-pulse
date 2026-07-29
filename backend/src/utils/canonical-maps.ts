/**
 * Canonical name maps for normalization.
 * Key: all lowercase, trimmed variants → Value: canonical display name
 */

export const APP_CANONICAL: Record<string, string> = {
  'gmail':        'Gmail',
  'google mail':  'Gmail',
  'salesforce':   'Salesforce',
  'sf':           'Salesforce',
  'slack':        'Slack',
  'microsoft teams': 'Microsoft Teams',
  'ms teams':     'Microsoft Teams',
  'teams':        'Microsoft Teams',
  'zoom':         'Zoom',
  'excel':        'Excel',
  'microsoft excel': 'Excel',
  'outlook':      'Outlook',
  'microsoft outlook': 'Outlook',
  'jira':         'Jira',
  'confluence':   'Confluence',
  'notion':       'Notion',
  'google sheets': 'Google Sheets',
  'sheets':       'Google Sheets',
  'google docs':  'Google Docs',
  'docs':         'Google Docs',
  'hubspot':      'HubSpot',
  'zendesk':      'Zendesk',
  'asana':        'Asana',
  'trello':       'Trello',
  'sap':          'SAP',
  'workday':      'Workday',
};

export const CATEGORY_CANONICAL: Record<string, string> = {
  'crm updates':      'CRM Updates',
  'crm update':       'CRM Updates',
  'email triage':     'Email Triage',
  'email':            'Email Triage',
  'report generation': 'Report Generation',
  'reporting':        'Report Generation',
  'reports':          'Report Generation',
  'data entry':       'Data Entry',
  'meetings':         'Meetings',
  'meeting':          'Meetings',
  'scheduling':       'Scheduling',
  'schedule':         'Scheduling',
  'documentation':    'Documentation',
  'docs':             'Documentation',
  'customer support': 'Customer Support',
  'support':          'Customer Support',
  'code review':      'Code Review',
  'invoicing':        'Invoicing',
  'invoice':          'Invoicing',
  'payroll':          'Payroll',
  'hr admin':         'HR Admin',
  'recruitment':      'Recruitment',
  'analysis':         'Data Analysis',
  'data analysis':    'Data Analysis',
  'planning':         'Planning',
  'training':         'Training',
};

export function canonicalizeApp(raw: string | null | undefined): string {
  if (!raw) return 'Unknown';
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  return APP_CANONICAL[key] ?? toTitleCase(raw.trim());
}

export function canonicalizeCategory(raw: string | null | undefined): string {
  if (!raw) return 'Unknown';
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  return CATEGORY_CANONICAL[key] ?? toTitleCase(raw.trim());
}

function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}
