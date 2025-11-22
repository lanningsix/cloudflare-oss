
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

// --- NEW UPLOAD LOGIC WITH CONTROLLERS ---

export interface UploadController {
  start: () => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
}

type StatusChangeCallback = (status: 'pending' | 'uploading' | 'paused' | 'complete' | 'error' | 'cancelled', error?: string) => void;
type ProgressCallback = (percent: number) => void;

// Factory to create an upload task
export const createUpload = (
  file: File, 
  folder: string = '/',
  onStatusChange: StatusChangeCallback,
  onProgress: ProgressCallback,
  onComplete: (file: R2File) => void
): UploadController => {
  
  if (useMock) {
    // Mock implementation wrapper
    let cancelled = false;
    return {
        start: async () => {
             cancelled = false;
             onStatusChange('uploading');
             try {
                const res = await mockUploadFile(file, folder, (p) => {
                    if(!cancelled) onProgress(p);
                });
                if(!cancelled) {
                    onComplete(res);
                    onStatusChange('complete');
                }
             } catch(e) {
                 if(!cancelled) onStatusChange('error', (e as Error).message);
             }
        },
        pause: () => {}, // Mock pause not implemented fully
        resume: () => {},
        cancel: () => { cancelled = true; onStatusChange('cancelled'); }
    };
  }

  // Real implementation
  if (file.size <= CHUNK_SIZE) {
      return new SmallFileUpload(file, folder, onStatusChange, onProgress, onComplete);
  } else {
      return new LargeFileUpload(file, folder, onStatusChange, onProgress, onComplete);
  }
};

// Class for Small File Uploads (Atomic XHR)
class SmallFileUpload implements UploadController {
    private xhr: XMLHttpRequest | null = null;
    private isCancelled = false;

    constructor(
        private file: File,
        private folder: string,
        private onStatusChange: StatusChangeCallback,
        private onProgress: ProgressCallback,
        private onComplete: (file: R2File) => void
    ) {}

    start() {
        // Allow restarting if it was previously cancelled
        this.isCancelled = false;
        
        this.onStatusChange('uploading');
        
        this.xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', this.file);
        formData.append('folder', this.folder);

        this.xhr.open('POST', `${API_BASE_URL}/upload`);
        const headers = getAuthHeaders();
        Object.entries(headers).forEach(([key, value]) => {
            this.xhr?.setRequestHeader(key, value);
        });

        if (this.xhr.upload) {
            this.xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = (event.loaded / event.total) * 100;
                    this.onProgress(percent);
                }
            };
        }

        this.xhr.onload = () => {
            if (this.isCancelled) return;
            if (this.xhr && this.xhr.status >= 200 && this.xhr.status < 300) {
                try {
                    const data = JSON.parse(this.xhr.responseText) as { file: R2File };
                    this.onComplete(data.file);
                    this.onStatusChange('complete');
                } catch (e) {
                    this.onStatusChange('error', 'Invalid JSON response');
                }
            } else {
                try {
                    const errorData = JSON.parse(this.xhr?.responseText || '{}');
                    this.onStatusChange('error', errorData.error || `Upload failed`);
                } catch (e) {
                    this.onStatusChange('error', `Upload failed`);
                }
            }
        };

        this.xhr.onerror = () => {
            if (!this.isCancelled) this.onStatusChange('error', 'Network error');
        };

        this.xhr.send(formData);
    }

    pause() {
        // Small files cannot be effectively paused in one request. 
        // Treat as cancel or ignore. For better UX, we'll just ignore or show a toast.
        // Or implement abort and expect user to click "Retry" (which calls start)
        this.cancel();
    }

    resume() {
        this.isCancelled = false;
        this.start();
    }

    cancel() {
        this.isCancelled = true;
        if (this.xhr) {
            this.xhr.abort();
            this.xhr = null;
        }
        this.onStatusChange('cancelled');
    }
}

// Class for Large File Uploads (Multipart, Resumable)
class LargeFileUpload implements UploadController {
    private uploadId: string | null = null;
    private key: string | null = null;
    private parts: { partNumber: number, etag: string }[] = [];
    private uploadedBytes = 0;
    private currentChunkIndex = 0;
    private totalChunks = 0;
    
    private currentXhr: XMLHttpRequest | null = null;
    
    // States
    private isPaused = false;
    private isCancelled = false;
    private isRunning = false;

    constructor(
        private file: File,
        private folder: string,
        private onStatusChange: StatusChangeCallback,
        private onProgress: ProgressCallback,
        private onComplete: (file: R2File) => void
    ) {
        this.totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    }

    start() {
        // If previously cancelled, we must reset state to allow a fresh upload
        if (this.isCancelled) {
            this.resetState();
        }

        if(this.isRunning) return;
        this.isPaused = false;
        this.isCancelled = false;
        this.runUploadLoop();
    }

    resume() {
        if (!this.isPaused && this.isRunning) return; // Already running
        
        // If coming back from cancel, we should probably use start(), but if resume is called:
        if (this.isCancelled) {
            this.start();
            return;
        }

        // If it was error or paused, we restart loop
        this.isPaused = false;
        this.isCancelled = false;
        this.runUploadLoop();
    }

    pause() {
        this.isPaused = true;
        this.isRunning = false;
        // Abort current chunk to stop network usage immediately
        if (this.currentXhr) {
            this.currentXhr.abort();
            this.currentXhr = null;
        }
        this.onStatusChange('paused');
    }

    cancel() {
        this.isCancelled = true;
        this.isRunning = false;
        this.isPaused = false;
        if (this.currentXhr) {
            this.currentXhr.abort();
            this.currentXhr = null;
        }
        
        // Try to clean up on server
        if (this.uploadId && this.key) {
            const payload = { uploadId: this.uploadId, key: this.key };
            fetch(`${API_BASE_URL}/upload/abort`, {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(console.error);
        }

        this.onStatusChange('cancelled');
    }

    private resetState() {
        this.uploadId = null;
        this.key = null;
        this.parts = [];
        this.uploadedBytes = 0;
        this.currentChunkIndex = 0;
    }

    private async runUploadLoop() {
        this.isRunning = true;
        this.onStatusChange('uploading');

        try {
            // 1. Init (if not done)
            if (!this.uploadId) {
                await this.initMultipart();
            }

            // 2. Loop Chunks
            while (this.currentChunkIndex < this.totalChunks) {
                if (this.isCancelled) {
                     this.isRunning = false; 
                     return; 
                }
                
                if (this.isPaused) {
                    this.isRunning = false;
                    this.onStatusChange('paused');
                    return;
                }

                // Prepare chunk
                const start = this.currentChunkIndex * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, this.file.size);
                const chunk = this.file.slice(start, end);
                const partNumber = this.currentChunkIndex + 1;

                try {
                    const etag = await this.uploadChunk(chunk, partNumber);
                    this.parts.push({ partNumber, etag });
                    this.uploadedBytes += chunk.size;
                    this.currentChunkIndex++;
                    
                    // Report progress
                    const percent = (this.uploadedBytes / this.file.size) * 100;
                    this.onProgress(percent);
                } catch (err) {
                    // If aborted due to pause, loop checks `isPaused` next iteration or catches the abort error
                    if (this.isPaused || this.isCancelled) return;
                    
                    // Real error
                    console.error(err);
                    this.isRunning = false;
                    this.onStatusChange('error', 'Upload chunk failed. Click Retry.');
                    return;
                }
            }

            // 3. Complete
            await this.completeMultipart();
            this.isRunning = false;

        } catch (err) {
            if (!this.isPaused && !this.isCancelled) {
                 this.isRunning = false;
                 this.onStatusChange('error', (err as Error).message || 'Upload failed');
            }
        }
    }

    private async initMultipart() {
        const headers = getAuthHeaders();
        const res = await fetch(`${API_BASE_URL}/upload/init`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: this.file.name, folder: this.folder, type: this.file.type })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({})) as { error?: string };
            throw new Error(err.error || 'Failed to initiate upload');
        }

        const data = await res.json() as { uploadId: string, key: string };
        this.uploadId = data.uploadId;
        this.key = data.key;
    }

    private uploadChunk(chunk: Blob, partNumber: number): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.uploadId || !this.key) return reject("No upload ID");
            
            const xhr = new XMLHttpRequest();
            this.currentXhr = xhr;
            
            const url = `${API_BASE_URL}/upload/part?uploadId=${this.uploadId}&key=${encodeURIComponent(this.key)}&partNumber=${partNumber}`;
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
                    reject(new Error(`Chunk ${partNumber} failed`));
                }
            };

            xhr.onerror = () => reject(new Error("Network error"));
            xhr.onabort = () => reject(new Error("Aborted"));

            xhr.send(chunk);
        });
    }

    private async completeMultipart() {
        const headers = getAuthHeaders();
        const res = await fetch(`${API_BASE_URL}/upload/complete`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                uploadId: this.uploadId, 
                key: this.key, 
                parts: this.parts, 
                name: this.file.name, 
                folder: this.folder, 
                size: this.file.size, 
                type: this.file.type 
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({})) as { error?: string };
            throw new Error(err.error || 'Failed to complete upload');
        }

        const data = await res.json() as { file: R2File };
        this.onComplete(data.file);
        this.onStatusChange('complete');
    }
}

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
