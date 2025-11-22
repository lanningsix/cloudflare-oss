import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/authService';

export interface User {
  id: string;
  name: string;
  isGuest: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check for logged in user
    const storedUser = localStorage.getItem('workerbox_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      return;
    }

    // Check for guest ID
    let guestId = localStorage.getItem('workerbox_guest_id');
    if (!guestId) {
      guestId = crypto.randomUUID();
      localStorage.setItem('workerbox_guest_id', guestId);
    }
    setUser({ id: guestId, name: 'Guest', isGuest: true });
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const data = await authApi.login(username, password);
      if (data.user) {
        localStorage.setItem('workerbox_user', JSON.stringify(data.user));
        setUser(data.user);
      }
    } catch (error) {
      throw error;
    }
  };

  const register = async (username: string, password: string) => {
    try {
      const data = await authApi.register(username, password);
      if (data.user) {
        // Automatically login after register
        localStorage.setItem('workerbox_user', JSON.stringify(data.user));
        setUser(data.user);
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('workerbox_user');
    // Revert to guest
    let guestId = localStorage.getItem('workerbox_guest_id');
    if (!guestId) {
        guestId = crypto.randomUUID();
        localStorage.setItem('workerbox_guest_id', guestId);
    }
    setUser({ id: guestId, name: 'Guest', isGuest: true });
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};