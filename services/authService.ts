import { mockLogin, mockRegister } from './mockBackend';
import { isMockMode } from './fileService';

const API_BASE_URL = (import.meta as any).env?.VITE_WORKER_URL || 'https://oss-server.dundun.uno/api';

export interface AuthResponse {
  user?: {
    id: string;
    name: string;
    isGuest: boolean;
  };
  error?: string;
}

export const authApi = {
  login: async (username: string, password: string): Promise<AuthResponse> => {
    if (isMockMode()) return mockLogin(username, password);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json() as AuthResponse;
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      return data;
    } catch (error) {
      console.error("Login Error:", error);
      throw error;
    }
  },

  register: async (username: string, password: string): Promise<AuthResponse> => {
    if (isMockMode()) return mockRegister(username, password);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json() as AuthResponse;
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      return data;
    } catch (error) {
      console.error("Register Error:", error);
      throw error;
    }
  }
};