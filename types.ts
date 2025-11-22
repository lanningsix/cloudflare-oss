
export interface R2File {
  id: string;
  key: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: number;
  url: string;
  folder: string;
  ownerId?: string;
}

export interface UploadProgress {
  id: string; // Unique ID for the upload task
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

export interface ApiConfig {
  workerUrl: string;
}

export interface FileWithPath extends File {
  path?: string; // Relative path for folder uploads (e.g., "photos/vacation/img.jpg")
}
