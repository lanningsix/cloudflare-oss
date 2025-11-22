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

export const listFiles = async (): Promise<R2File[]> => {
  if (useMock) return mockListFiles();

  try {
    const response = await fetch(`${API_BASE_URL}/files`);
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
    const response = await fetch(`${API_BASE_URL}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
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
    // Encode the key to handle special characters safely
    const response = await fetch(`${API_BASE_URL}/files/${encodeURIComponent(key)}`, {
      method: 'DELETE',
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