import { R2File } from '../types';
import { mockListFiles, mockUploadFile, mockDeleteFile, mockCreateFolder } from './mockBackend';

// Cloudflare Worker API URL
const API_BASE_URL = (import.meta as any).env?.VITE_WORKER_URL || 'https://oss-server.dundun.uno/api';

// Set to true to force mock mode, or call enableMockMode() at runtime
let useMock = false;

export const enableMockMode = () => {
  useMock = true;
};

export const isMockMode = () => useMock;

// Helper to get auth headers
const getAuthHeaders = () => {
  const storedUser = localStorage.getItem('workerbox_user');
  if (storedUser) {
    const user = JSON.parse(storedUser);
    return {
      'X-User-Id': user.id,
      'X-User-Type': 'user'
    };
  }
  
  const guestId = localStorage.getItem('workerbox_guest_id') || 'anonymous_guest';
  return {
    'X-User-Id': guestId,
    'X-User-Type': 'guest'
  };
};

export const listFiles = async (): Promise<R2File[]> => {
  if (useMock) return mockListFiles();

  try {
    const headers = getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/files`, {
      headers: headers
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string };
      const errorMessage = errorData.error || `Failed to fetch files: ${response.status} ${response.statusText}`;
      throw new Error(errorMessage);
    }
    const data = await response.json() as { files: R2File[] };
    return data.files as R2File[];
  } catch (error) {
    console.error("API Error (List):", error);
    throw error;
  }
};

export const createFolder = async (name: string, parent: string): Promise<R2File> => {
  if (useMock) return mockCreateFolder(name, parent);

  try {
    const headers = getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/folders`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({ name, parent })
    });

    if (!response.ok) {
      throw new Error('Failed to create folder');
    }
    const data = await response.json() as { file: R2File };
    return data.file;
  } catch (error) {
    console.error("API Error (Create Folder):", error);
    throw error;
  }
};

export const uploadFile = async (file: File, folder: string = '/'): Promise<R2File> => {
  if (useMock) return mockUploadFile(file, folder);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  try {
    const headers = getAuthHeaders();
    // FormData headers are set automatically by fetch, but we need to add our custom headers
    // We do NOT set Content-Type here so the browser sets the boundary
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: headers, 
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string };
      const errorMessage = errorData.error || `Upload failed: ${response.status} ${response.statusText}`;
      throw new Error(errorMessage);
    }
    
    const data = await response.json() as { file: R2File };
    return data.file as R2File;
  } catch (error) {
    console.error("API Error (Upload):", error);
    throw error;
  }
};

export const deleteFile = async (id: string, key: string): Promise<void> => {
  if (useMock) return mockDeleteFile(id);

  try {
    const headers = getAuthHeaders();
    // Encode the key to handle special characters safely
    const response = await fetch(`${API_BASE_URL}/files/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: headers
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string };
      const errorMessage = errorData.error || `Delete failed: ${response.status} ${response.statusText}`;
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error("API Error (Delete):", error);
    throw error;
  }
};
