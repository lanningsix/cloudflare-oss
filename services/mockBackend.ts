import { R2File } from '../types';

// This file simulates the Cloudflare Worker + D1 + R2 logic 
// so the UI is functional without a real backend deployment.

const STORAGE_KEY_D1 = 'cf_d1_mock_files_v2';
const DELAY_MS = 600;

const getMockStore = (): R2File[] => {
  const stored = localStorage.getItem(STORAGE_KEY_D1);
  return stored ? JSON.parse(stored) : [];
};

const setMockStore = (files: R2File[]) => {
  localStorage.setItem(STORAGE_KEY_D1, JSON.stringify(files));
};

// Simulate Worker: GET /api/files
export const mockListFiles = async (): Promise<R2File[]> => {
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  // In real SQL we sort by directory first
  const files = getMockStore();
  return files.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return b.uploadedAt - a.uploadedAt;
  });
};

export const mockCreateFolder = async (name: string, parent: string): Promise<R2File> => {
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS / 2));
  const existing = getMockStore();
  
  const newFolder: R2File = {
    id: crypto.randomUUID(),
    key: crypto.randomUUID(),
    name: name,
    size: 0,
    type: 'directory',
    uploadedAt: Date.now(),
    url: '',
    folder: parent
  };

  setMockStore([newFolder, ...existing]);
  return newFolder;
}

// Simulate Worker: POST /api/upload (Multipart)
export const mockUploadFile = async (file: File, folder: string = '/'): Promise<R2File> => {
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS + (file.size / 1000)));
  
  const existing = getMockStore();
  
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
    folder: folder
  };

  setMockStore([newFile, ...existing]);
  return newFile;
};

// Simulate Worker: DELETE /api/files/:key
export const mockDeleteFile = async (id: string): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS / 2));
  const existing = getMockStore();
  const filtered = existing.filter(f => f.id !== id);
  setMockStore(filtered);
};