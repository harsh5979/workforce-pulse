import axios from 'axios';
import { API_BASE_URL } from './constants';
import { useAuthStore } from '@/store/auth-store';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies cross-origin
});

// Cookies are automatically sent because of withCredentials: true

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Optional: handle 401s by logging out if the backend returns it globally
    // if (error.response?.status === 401) {
    //   useAuthStore.getState().logout();
    // }
    return Promise.reject(error.response?.data?.error || error.message);
  }
);

export type FilterParams = {
  department?: string;
  category?: string;
  week?: number;
};

export const api = {
  // Auth
  login: (credentials: any): Promise<any> =>
    apiClient.post('/api/auth/login', credentials),
    
  checkAuth: (): Promise<any> =>
    apiClient.get('/api/auth/me'),

  logout: (): Promise<any> =>
    apiClient.post('/api/auth/logout'),

  // Ingestion
  ingest: (): Promise<any> => 
    apiClient.post('/api/ingest'),

  // Dashboard
  getDashboard: (filters: FilterParams = {}): Promise<any> =>
    apiClient.get('/api/dashboard', { params: filters }),

  // Employees
  getEmployees: (filters: FilterParams = {}): Promise<any[]> =>
    apiClient.get('/api/employees', { params: filters }),

  getEmployee: (id: string): Promise<any> =>
    apiClient.get(`/api/employees/${id}`),

  // Categories
  getCategories: (groupBy: 'task_category' | 'app_used' | 'department' = 'task_category', filters: FilterParams = {}): Promise<any[]> =>
    apiClient.get('/api/categories', { params: { groupBy, ...filters } }),

  getRanking: (filters: FilterParams = {}): Promise<any[]> =>
    apiClient.get('/api/categories/ranking', { params: filters }),

  // Trends
  getTrends: (filters: FilterParams = {}): Promise<any[]> =>
    apiClient.get('/api/trends', { params: filters }),

  // Anomalies
  getAnomalies: (): Promise<any[]> =>
    apiClient.get('/api/anomalies'),

  // AI Context & Chat
  getAIContext: (): Promise<any> =>
    apiClient.get('/api/ai/context'),

  getAIBriefing: (): Promise<any> =>
    apiClient.get('/api/ai/briefing'),

  getAIChatHistory: (cursor?: string): Promise<any> =>
    apiClient.get('/api/ai/session/current', { params: { cursor, limit: 7 } }),

  // Health
  health: (): Promise<any> =>
    apiClient.get('/api/health'),
};
