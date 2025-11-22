
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { listFiles, createUpload, deleteFile, enableMockMode, isMockMode, createFolder, UploadController, batchDeleteFiles, moveFiles } from './services/fileService';
import { R2File, UploadProgress, FileWithPath } from './types';
import { AlertCircle, Trash2, FolderInput, X } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { useAuth } from './contexts/AuthContext';

// Components
import { UploadArea } from './components/UploadArea';
import { Header } from './components/Header';
import { Breadcrumbs } from './components/Breadcrumbs';
import { FileList } from './components/FileList';
import { GuestInfo } from './components/GuestInfo';
import { UploadQueuePanel } from './components/UploadQueuePanel';
import { Toast } from './components/Toast';
import { AuthModal } from './components/modals/AuthModal';
import { CreateFolderModal } from './components/modals/CreateFolderModal';
import { DeleteConfirmModal } from './components/modals/DeleteConfirmModal';
import { MoveFileModal } from './components/modals/MoveFileModal';

export default function App() {
  const { t } = useLanguage();
  const { user, login, register } = useAuth();
  const [files, setFiles] = useState<R2File[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(isMockMode());
  const [currentPath, setCurrentPath] = useState<string>('/');
  
  // Upload State
  const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([]);
  const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(true);
  const uploadControllers = useRef<Map<string, UploadController>>(new Map());
  
  // Modal States
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  const [fileToDelete, setFileToDelete] = useState<R2File | null>(null);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // Batch Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // --- Data Fetching ---

  const fetchFiles = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await listFiles();
      setFiles(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('fetch_error_default'));
    } finally {
      setLoading(false);
    }
  }, [t, user]);

  useEffect(() => {
    if (user) fetchFiles();
  }, [user, fetchFiles]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Clear selection when path changes
  useEffect(() => {
      setSelectedIds(new Set());
  }, [currentPath]);

  // --- Computed ---

  const currentFiles = files.filter(f => {
    const fileFolder = f.folder || '/';
    return fileFolder === currentPath;
  });

  const guestUsageCount = files.filter(f => f.type !== 'directory').length;
  const isGuestLimitReached = user?.isGuest && guestUsageCount >= 10;

  // --- Handlers ---

  const handleUpload = async (filesToUpload: FileWithPath[]) => {
    if (filesToUpload.length === 0) return;
    if (isGuestLimitReached) {
      setToast({ msg: t('upload_limit_reached'), type: 'error' });
      return;
    }

    const uploadBaseFolder = currentPath;

    // 1. Check and create missing folder structure
    const foldersToCreate = new Map<string, { name: string, parent: string }>();

    filesToUpload.forEach(file => {
        // Determine relative path (e.g. "MyFolder/Sub/file.txt")
        const relativePath: string = file.path || (file as any).webkitRelativePath || file.name;
        const parts = relativePath.split('/');
        
        // If only filename (len 1), no new folders needed relative to current path
        if (parts.length <= 1) return;

        // Directories are all parts except the last one
        const dirParts = parts.slice(0, -1);
        let currentParent = uploadBaseFolder;

        dirParts.forEach((part) => {
             const expectedFolderKey = `${currentParent}${part}/`;
             
             if (!foldersToCreate.has(expectedFolderKey)) {
                 // Check if folder already exists in our file list
                 const exists = files.some(f => 
                     f.type === 'directory' && 
                     f.name === part && 
                     f.folder === currentParent
                 );

                 if (!exists) {
                     foldersToCreate.set(expectedFolderKey, { name: part, parent: currentParent });
                 }
             }
             currentParent = expectedFolderKey;
        });
    });

    // If we have folders to create, do it now
    if (foldersToCreate.size > 0) {
        const sortedFolders = Array.from(foldersToCreate.values())
            .sort((a, b) => a.parent.length - b.parent.length); // Create parents first
        
        try {
            await Promise.all(sortedFolders.map(f => createFolder(f.name, f.parent)));
            // Refresh list so folders appear immediately
            fetchFiles(); 
        } catch(e) {
            console.error("Failed to create folder structure", e);
            setToast({ msg: t('toast_folder_failed'), type: 'error' });
        }
    }

    // 2. Start File Uploads
    setIsUploadPanelOpen(true);

    filesToUpload.forEach(file => {
       const queueId = crypto.randomUUID();
       
       setUploadQueue(prev => [...prev, {
          id: queueId,
          fileName: file.name,
          progress: 0,
          status: 'pending'
       }]);

       let targetFolder = uploadBaseFolder;
       if (file.path) {
           const lastSlash = file.path.lastIndexOf('/');
           if (lastSlash !== -1) {
               const relativeFolder = file.path.substring(0, lastSlash);
               targetFolder = `${uploadBaseFolder}${relativeFolder}/`;
           }
       } else if ((file as any).webkitRelativePath) {
            // Fallback for directory input if .path not manually set
            const p = (file as any).webkitRelativePath as string;
            const lastSlash = p.lastIndexOf('/');
            if (lastSlash !== -1) {
                const relativeFolder = p.substring(0, lastSlash);
                targetFolder = `${uploadBaseFolder}${relativeFolder}/`;
            }
       }

       const controller = createUpload(
           file, 
           targetFolder,
           (status, err) => {
               setUploadQueue(prev => prev.map(u => u.id === queueId ? { ...u, status, error: err } : u));
               if (status === 'complete') fetchFiles();
           },
           (percent) => {
               setUploadQueue(prev => prev.map(u => u.id === queueId ? { ...u, progress: percent } : u));
           },
           () => {} // On complete data
       );

       uploadControllers.current.set(queueId, controller);
       controller.start();
    });
  };

  const createFolderHandler = async (name: string) => {
    const cleanName = name.trim();
    if (cleanName.includes('/')) {
      setToast({ msg: t('toast_invalid_name'), type: 'error' });
      return;
    }
    if (currentFiles.some(f => f.type === 'directory' && f.name === cleanName)) {
      setToast({ msg: t('toast_folder_exists'), type: 'error' });
      return;
    }

    try {
      await createFolder(cleanName, currentPath);
      setToast({ msg: t('toast_folder_created'), type: 'success' });
      setIsFolderModalOpen(false);
      fetchFiles();
    } catch (err) {
      setToast({ msg: t('toast_folder_failed'), type: 'error' });
    }
  };

  const authHandler = async (username: string, password: string, mode: 'login' | 'register') => {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register(username, password);
        setToast({ msg: t('register_success'), type: 'success' });
      }
      setIsAuthModalOpen(false);
  };

  const deleteHandler = async () => {
    if (!fileToDelete) return;
    const { id, key } = fileToDelete;

    const previousFiles = [...files];
    setFiles(files.filter(f => f.id !== id));
    setFileToDelete(null);

    try {
      await deleteFile(id, key);
      setToast({ msg: t('toast_deleted'), type: 'success' });
    } catch (err) {
      setFiles(previousFiles);
      setToast({ msg: t('toast_delete_failed'), type: 'error' });
    }
  };

  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const batchDeleteHandler = async () => {
      if (selectedIds.size === 0) return;
      if (!confirm(t('delete_confirm') + ` ${selectedIds.size} items?`)) return;

      const ids = Array.from(selectedIds) as string[];
      const prev = [...files];
      setFiles(files.filter(f => !selectedIds.has(f.id)));
      setSelectedIds(new Set());

      try {
          await batchDeleteFiles(ids);
          setToast({ msg: t('toast_deleted'), type: 'success' });
          fetchFiles(); // Refresh to be safe
      } catch(e) {
          setFiles(prev);
          setToast({ msg: t('toast_delete_failed'), type: 'error' });
      }
  };

  const batchMoveHandler = async (destination: string) => {
      if (selectedIds.size === 0) return;
      
      const ids = Array.from(selectedIds) as string[];
      const prev = [...files];
      // Optimistic update
      setFiles(files.map(f => ids.includes(f.id) ? { ...f, folder: destination } : f));
      setSelectedIds(new Set());
      setIsMoveModalOpen(false);

      try {
          await moveFiles(ids, destination);
          setToast({ msg: t('toast_moved', { count: ids.length }), type: 'success' });
          fetchFiles();
      } catch(e) {
          setFiles(prev);
          setToast({ msg: t('toast_move_failed'), type: 'error' });
      }
  };

  // --- Render ---

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <Header 
        isDemo={isDemo} 
        loading={loading} 
        onCreateFolder={() => setIsFolderModalOpen(true)}
        onRefresh={fetchFiles}
        onOpenAuth={(mode) => { setAuthMode(mode); setIsAuthModalOpen(true); }}
      />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full mb-24 sm:mb-20">
        
        <GuestInfo files={files} onLogin={() => { setAuthMode('login'); setIsAuthModalOpen(true); }} />

        <Breadcrumbs currentPath={currentPath} onNavigate={setCurrentPath} />

        <section className="mb-8 max-w-2xl mx-auto relative">
          <UploadArea onUpload={handleUpload} isUploading={false} /> 
          {isGuestLimitReached && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-xl border-2 border-gray-200 z-10">
                  <div className="text-center p-4">
                      <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
                      <h3 className="font-bold text-gray-800">{t('upload_limit_reached')}</h3>
                      <p className="text-sm text-gray-500 mt-1">{t('login_to_unlimit')}</p>
                  </div>
              </div>
          )}
        </section>

        <FileList 
          files={files}
          currentPath={currentPath}
          loading={loading}
          error={error}
          onNavigate={setCurrentPath}
          onDelete={setFileToDelete}
          onSwitchToDemo={() => {
            enableMockMode();
            setIsDemo(true);
            setError(null);
            fetchFiles();
            setToast({ msg: t('toast_demo_mode'), type: 'success' });
          }}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelection}
        />
      </main>

      {/* Batch Actions Bar */}
      {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white shadow-xl border border-gray-200 rounded-full px-6 py-3 z-50 flex items-center gap-4 animate-[slideUp_0.2s_ease-out]">
              <span className="font-medium text-gray-700 text-sm whitespace-nowrap">
                  {t('selected_count', { count: selectedIds.size })}
              </span>
              <div className="h-4 w-px bg-gray-300"></div>
              <button 
                  onClick={() => setIsMoveModalOpen(true)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
              >
                  <FolderInput className="w-4 h-4" />
                  {t('batch_move')}
              </button>
              <button 
                  onClick={batchDeleteHandler}
                  className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-red-600 transition-colors"
              >
                  <Trash2 className="w-4 h-4" />
                  {t('batch_delete')}
              </button>
              <button 
                  onClick={() => setSelectedIds(new Set())}
                  className="p-1 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
              >
                  <X className="w-4 h-4 text-gray-500" />
              </button>
          </div>
      )}

      <UploadQueuePanel 
        queue={uploadQueue}
        isOpen={isUploadPanelOpen}
        setIsOpen={setIsUploadPanelOpen}
        onPause={(id) => uploadControllers.current.get(id)?.pause()}
        onResume={(id) => uploadControllers.current.get(id)?.resume()}
        onRetry={(id) => uploadControllers.current.get(id)?.resume()}
        onRestart={(id) => uploadControllers.current.get(id)?.start()}
        onCancel={(id) => uploadControllers.current.get(id)?.cancel()}
        onRemove={(id) => {
             const ctrl = uploadControllers.current.get(id);
             if(ctrl) ctrl.cancel();
             uploadControllers.current.delete(id);
             setUploadQueue(prev => prev.filter(u => u.id !== id));
        }}
        onClearCompleted={() => setUploadQueue(prev => prev.filter(u => u.status !== 'complete' && u.status !== 'cancelled'))}
      />

      <CreateFolderModal 
        isOpen={isFolderModalOpen} 
        onClose={() => setIsFolderModalOpen(false)} 
        onSubmit={createFolderHandler} 
      />

      <AuthModal 
        isOpen={isAuthModalOpen} 
        initialMode={authMode}
        onClose={() => setIsAuthModalOpen(false)} 
        onSubmit={authHandler} 
      />

      <DeleteConfirmModal 
        file={fileToDelete} 
        onClose={() => setFileToDelete(null)} 
        onConfirm={deleteHandler} 
      />
      
      <MoveFileModal 
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        onMove={batchMoveHandler}
        currentPath={currentPath}
        allFiles={files}
        movingFileIds={Array.from(selectedIds)}
      />

      <footer className="hidden sm:block py-6 text-center text-sm text-gray-400 px-4">
        <p>{t('powered_by')}</p>
      </footer>
    </div>
  );
}
