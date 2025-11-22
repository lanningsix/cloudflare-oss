
import { R2File } from '../types';
import { AuthResponse } from './authService';

// This file simulates the Cloudflare Worker + D1 + R2 logic 
// so the UI is functional without a real backend deployment.

const STORAGE_KEY_D1 = 'cf_d1_mock_files_v2';
const STORAGE_KEY_USERS = 'cf_d1_mock_users';
const DELAY_MS = 600;

// Helper to get current mock user from localStorage (imitating what fileService does)
const getMockUser = () => {
  const storedUser = localStorage.getItem('workerbox_user');
  if (storedUser) {
    return { ...JSON.parse(storedUser), type: 'user' };
  }
  const guestId = localStorage.getItem('workerbox_guest_id') || 'guest_default';
  return { id: guestId, type: 'guest' };
};

const getMockStore = (): R2File[] => {
  const stored = localStorage.getItem(STORAGE_KEY_D1);
  return stored ? JSON.parse(stored) : [];
};

const setMockStore = (files: R2File[]) => {
  localStorage.setItem(STORAGE_KEY_D1, JSON.stringify(files));
};

// --- AUTH MOCK ---
const getMockUsers = (): any[] => {
  const stored = localStorage.getItem(STORAGE_KEY_USERS);
  return stored ? JSON.parse(stored) : [];
};

export const mockLogin = async (username: string, password: string): Promise<AuthResponse> => {
  await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  
  // Demo: "demo" user always works if no DB
  const users = getMockUsers();
  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    return { user: { id: user.id, name: user.username, isGuest: false } };
  }
  
  // Allow basic "demo" login if not found (fallback for easy testing)
  if (username === 'demo' && password === 'demo') {
      return { user: { id: 'demo_user_id', name: 'DemoUser', isGuest: false }};
  }

  throw new Error('Invalid credentials');
};

export const mockRegister = async (username: string, password: string): Promise<AuthResponse> => {
  await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  
  const users = getMockUsers();
  if (users.find(u => u.username === username)) {
    throw new Error('Username already exists');
  }

  const newUser = {
    id: crypto.randomUUID(),
    username,
    password, // In real mock, we store plain text, but backend hashes it
    created_at: Date.now()
  };

  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify([...users, newUser]));

  return { user: { id: newUser.id, name: newUser.username, isGuest: false } };
};

// --- FILE MOCK ---

// Simulate Worker: GET /api/files
export const mockListFiles = async (): Promise<R2File[]> => {
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  
  const user = getMockUser();
  const files = getMockStore();
  
  // Filter by ownerId
  const userFiles = files.filter(f => f.ownerId === user.id);

  // Sort
  return userFiles.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return b.uploadedAt - a.uploadedAt;
  });
};

export const mockCreateFolder = async (name: string, parent: string): Promise<R2File> => {
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS / 2));
  const existing = getMockStore();
  const user = getMockUser();
  
  const newFolder: R2File = {
    id: crypto.randomUUID(),
    key: crypto.randomUUID(),
    name: name,
    size: 0,
    type: 'directory',
    uploadedAt: Date.now(),
    url: '',
    folder: parent,
    ownerId: user.id
  };

  setMockStore([newFolder, ...existing]);
  return newFolder;
}

// Simulate Worker: POST /api/upload (Multipart)
export const mockUploadFile = async (
  file: File, 
  folder: string = '/', 
  onProgress?: (percent: number) => void
): Promise<R2File> => {
  const user = getMockUser();
  const existing = getMockStore();

  // CHECK LIMIT FOR GUESTS
  if (user.type === 'guest') {
    const guestFileCount = existing.filter(f => f.ownerId === user.id && f.type !== 'directory').length;
    if (guestFileCount >= 10) {
      throw new Error("Upload limit reached (Max 10 files for guests).");
    }
  }

  // Simulate progress
  const totalSteps = 5;
  for (let i = 1; i <= totalSteps; i++) {
      await new Promise(resolve => setTimeout(resolve, 200)); // 200ms per step
      if (onProgress) {
          onProgress((i / totalSteps) * 100);
      }
  }
  
  // Extract extension
  const lastDotIndex = file.name.lastIndexOf('.');
  const ext = lastDotIndex !== -1 ? file.name.substring(lastDotIndex) : '';
  
  const r2Key = crypto.randomUUID() + ext;
  
  // Create a fake R2 Public URL
  let url = `https://pub-dummy-r2.r2.dev/${folder === '/' ? '' : folder.slice(1)}${r2Key}`;
  if (file.type.startsWith('image/')) {
    url = URL.createObjectURL(file);
  }

  const newFile: R2File = {
    id: crypto.randomUUID(),
    key: r2Key, 
    name: file.name,
    size: file.size,
    type: file.type,
    uploadedAt: Date.now(),
    url: url,
    folder: folder,
    ownerId: user.id
  };

  setMockStore([newFile, ...existing]);
  return newFile;
};

// Simulate Worker: DELETE /api/files/:key
export const mockDeleteFile = async (id: string): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS / 2));
  const existing = getMockStore();
  const fileToDelete = existing.find(f => f.id === id);
  
  if (fileToDelete?.type === 'directory') {
      // Recursive mock delete
      const folderPath = fileToDelete.folder === '/' ? `/${fileToDelete.name}/` : `${fileToDelete.folder}${fileToDelete.name}/`;
      const filtered = existing.filter(f => f.id !== id && !f.folder.startsWith(folderPath));
      setMockStore(filtered);
  } else {
      const filtered = existing.filter(f => f.id !== id);
      setMockStore(filtered);
  }
};

// Simulate Batch Delete
export const mockBatchDelete = async (ids: string[]): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS / 2));
    const existing = getMockStore();
    // Naive recursive delete not strictly implemented here for folders in batch in mock
    // but sufficient for files.
    const filtered = existing.filter(f => !ids.includes(f.id));
    setMockStore(filtered);
}

// Simulate Move
export const mockMoveFiles = async (ids: string[], destination: string): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS / 2));
    const existing = getMockStore();
    
    const updated = existing.map(f => {
        if (ids.includes(f.id) && f.type !== 'directory') {
            return {
                ...f,
                folder: destination
            };
        }
        return f;
    });
    setMockStore(updated);
}
