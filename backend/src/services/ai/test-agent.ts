import { executeTool } from './tool-handlers';
import { streamAIChat } from './ai.service';
import { Response } from 'express';

async function runTests() {
  console.log('=== STARTING AI CHAT AGENT TESTS ===\n');

  try {
    // Test 1: get_employee_analytics (list page 1)
    console.log('Test 1: Fetching employee list (page 1, limit 2)...');
    const listResult = await executeTool('get_employee_analytics', { page: 1, limit: 2 }) as any;
    console.log('List Result:', JSON.stringify(listResult, null, 2));
    console.log('\n----------------------------------------\n');

    // Test 2: get_employee_analytics (disambiguation check)
    console.log('Test 2: Name lookup fuzzy match check...');
    // Most datasets have names, let's search for 'a' to get matches or similar
    const fuzzyResult = await executeTool('get_employee_analytics', { fullName: 'a' }) as any;
    console.log('Fuzzy Search Result:', JSON.stringify(fuzzyResult, null, 2));
    console.log('\n----------------------------------------\n');

    // Test 3: get_department_analytics (Sales)
    console.log('Test 3: Fetching Sales department analytics...');
    const deptResult = await executeTool('get_department_analytics', { department: 'Sales' }) as any;
    console.log('Dept Result:', JSON.stringify(deptResult, null, 2));
    console.log('\n----------------------------------------\n');

    // Test 4: get_weekly_trends
    console.log('Test 4: Fetching weekly trends...');
    const trendsResult = await executeTool('get_weekly_trends', {}) as any;
    console.log('Trends keys:', Object.keys(trendsResult.trends || {}));
    console.log('\n----------------------------------------\n');

    // Test 5: Mock SSE Chat Stream
    console.log('Test 5: Streaming AI Chat query...');
    const mockRes = {
      setHeader: (name: string, value: string) => {},
      write: (data: string) => {
        // Output clean response chunks
        if (data.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(data.slice(6).trim());
            if (parsed.content) {
              process.stdout.write(parsed.content);
            }
          } catch {
            // Ignore format errors
          }
        }
      },
      end: () => {
        console.log('\n\n--- STREAM COMPLETED ---');
      }
    } as unknown as Response;

    await streamAIChat(null, 'Compare Sales and Operations departments', mockRes);

  } catch (error: any) {
    console.error('Test failed with error:', error);
  }
}

runTests();
