
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { listFiles, createUpload, deleteFile, enableMockMode, isMockMode, createFolder, UploadController } from './services/fileService';
import { R2File, UploadProgress, FileWithPath } from './types';
import { AlertCircle } from 'lucide-react';
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
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

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

    setIsUploadPanelOpen(true);
    const uploadBaseFolder = currentPath;

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
        />
      </main>

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

      <footer className="hidden sm:block py-6 text-center text-sm text-gray-400 px-4">
        <p>{t('powered_by')}</p>
      </footer>
    </div>
  );
}
