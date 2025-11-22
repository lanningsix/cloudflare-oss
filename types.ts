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
  fileName: string;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
}

export interface ApiConfig {
  workerUrl: string;
}
