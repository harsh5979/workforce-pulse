import OpenAI from 'openai';

export const chatbotTools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_employee_analytics',
      description: 'Retrieve operational analytics (total hours, repetitive work duration, monthly costs) for a single employee or a paginated list of employees. Supports lookup by employeeId or name.',
      parameters: {
        type: 'object',
        properties: {
          employeeId: {
            type: 'string',
            description: 'The unique ID of the employee (e.g. E001, E014) to get a single employee\'s stats.'
          },
          fullName: {
            type: 'string',
            description: 'Name of the employee (fuzzy search supported) to get a single employee\'s stats.'
          },
          page: {
            type: 'integer',
            description: 'The page number to retrieve when listing multiple employees. Default is 1.'
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of employee records to return per page (max 15). Default is 15.'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_department_analytics',
      description: 'Retrieve aggregate analytics, repetitive task share, and headcount metrics for an entire department.',
      parameters: {
        type: 'object',
        properties: {
          department: {
            type: 'string',
            enum: ['Sales', 'Finance', 'Operations', 'CS', 'HR', 'Marketing'],
            description: 'The target department name.'
          }
        },
        required: ['department']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_category_metrics',
      description: 'Retrieve time expenditure metrics grouped by task category (e.g. Email Triage, Meetings) along with their automation priority scores.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_weekly_trends',
      description: 'Retrieve week-over-week trends of logged hours and repetitive work share percentages grouped by department.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_system_anomalies',
      description: 'Retrieve operational anomalies and outliers detected by Z-score statistical analysis or system flags.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  }
];
