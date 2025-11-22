
import { R2File } from '../types';
import { mockListFiles, mockUploadFile, mockDeleteFile, mockCreateFolder } from './mockBackend';

// Cloudflare Worker API URL
const API_BASE_URL = (import.meta as any).env?.VITE_WORKER_URL || 'https://oss-server.dundun.uno/api';

// Set to true to force mock mode, or call enableMockMode() at runtime
let useMock = false;

// Chunk size for large uploads (10MB)
const CHUNK_SIZE = 10 * 1024 * 1024;

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
    const body = { name, parent };
    const response = await fetch(`${API_BASE_URL}/folders`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(body)
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

export const uploadFile = async (
  file: File, 
  folder: string = '/', 
  onProgress?: (percent: number) => void
): Promise<R2File> => {
  if (useMock) return mockUploadFile(file, folder, onProgress);

  // Decide between simple upload and multipart upload
  if (file.size <= CHUNK_SIZE) {
    return uploadSmallFile(file, folder, onProgress);
  } else {
    return uploadLargeFile(file, folder, onProgress);
  }
};

// --- Standard Upload for Small Files ---
const uploadSmallFile = (
  file: File, 
  folder: string, 
  onProgress?: (percent: number) => void
): Promise<R2File> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    xhr.open('POST', `${API_BASE_URL}/upload`);

    // Add Auth Headers
    const headers = getAuthHeaders();
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    // Progress event
    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { file: R2File };
          resolve(data.file);
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new Error(errorData.error || `Upload failed: ${xhr.statusText}`));
        } catch (e) {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during upload'));
    };

    xhr.send(formData);
  });
}

// --- Multipart Upload for Large Files ---
const uploadLargeFile = async (
  file: File,
  folder: string,
  onProgress?: (percent: number) => void
): Promise<R2File> => {
  try {
    const headers = getAuthHeaders();
    
    // 1. Init Multipart Upload
    const initRes = await fetch(`${API_BASE_URL}/upload/init`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, folder, type: file.type })
    });

    if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error || 'Failed to initiate multipart upload');
    }

    const { uploadId, key } = await initRes.json() as { uploadId: string, key: string };
    
    // 2. Upload Parts
    const totalParts = Math.ceil(file.size / CHUNK_SIZE);
    const parts: { partNumber: number, etag: string }[] = [];
    let uploadedBytes = 0;

    for (let i = 0; i < totalParts; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const partNumber = i + 1;

      // Upload Chunk
      const etag = await uploadChunk(chunk, uploadId, key, partNumber);
      parts.push({ partNumber, etag });
      
      // Update progress
      uploadedBytes += chunk.size;
      if (onProgress) {
        const percent = (uploadedBytes / file.size) * 100;
        onProgress(percent);
      }
    }

    // 3. Complete Upload
    const completeRes = await fetch(`${API_BASE_URL}/upload/complete`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        uploadId, 
        key, 
        parts, 
        name: file.name, 
        folder, 
        size: file.size, 
        type: file.type 
      })
    });

    if (!completeRes.ok) {
       const err = await completeRes.json().catch(() => ({})) as { error?: string };
       throw new Error(err.error || 'Failed to complete upload');
    }

    const { file: newFile } = await completeRes.json() as { file: R2File };
    return newFile;

  } catch (error) {
    console.error("Multipart Upload Error:", error);
    throw error;
  }
};

const uploadChunk = (chunk: Blob, uploadId: string, key: string, partNumber: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${API_BASE_URL}/upload/part?uploadId=${uploadId}&key=${encodeURIComponent(key)}&partNumber=${partNumber}`;
    xhr.open('PUT', url);
    
    const headers = getAuthHeaders();
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
           const res = JSON.parse(xhr.responseText);
           resolve(res.etag);
        } catch(e) {
           reject(new Error("Invalid chunk response"));
        }
      } else {
        reject(new Error(`Chunk ${partNumber} failed: ${xhr.statusText}`));
      }
    };
    
    xhr.onerror = () => reject(new Error(`Network error on chunk ${partNumber}`));
    
    xhr.send(chunk);
  });
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
