import React, { useEffect, useState, useCallback } from 'react';
import { UploadArea } from './components/UploadArea';
import { FileCard } from './components/FileCard';
import { listFiles, uploadFile, deleteFile, enableMockMode, isMockMode, createFolder } from './services/fileService';
import { R2File } from './types';
import { Cloud, Database, HardDrive, RefreshCw, AlertCircle, CheckCircle2, X, ZapOff, FolderPlus, Home, ChevronRight, FolderOpen } from 'lucide-react';

export default function App() {
  const [files, setFiles] = useState<R2File[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(isMockMode());
  const [currentPath, setCurrentPath] = useState<string>('/');
  
  // Modal State
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Simple toast state
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFiles();
      setFiles(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch files from Cloudflare Worker.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Filter files based on current path
  const currentFiles = files.filter(f => {
    // Normalize default folders to '/'
    const fileFolder = f.folder || '/';
    return fileFolder === currentPath;
  });

  const handleUpload = async (filesToUpload: File[]) => {
    if (filesToUpload.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (const file of filesToUpload) {
      try {
        await uploadFile(file, currentPath);
        successCount++;
      } catch (err) {
        console.error(err);
        failCount++;
      }
    }

    setUploading(false);
    
    if (failCount === 0) {
      setToast({ msg: `Successfully uploaded ${successCount} file(s)`, type: 'success' });
    } else {
      setToast({ msg: `Uploaded ${successCount}, Failed ${failCount}`, type: 'error' });
    }

    // Refresh list
    fetchFiles();
  };

  const handleOpenCreateFolder = () => {
    setNewFolderName('');
    setIsFolderModalOpen(true);
  };

  const handleSubmitCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newFolderName.trim();
    
    if (!name) return;
    
    // Basic validation: no slashes
    if (name.includes('/')) {
      setToast({ msg: 'Folder names cannot contain "/"', type: 'error' });
      return;
    }

    // Check for duplicate in current view
    if (currentFiles.some(f => f.type === 'directory' && f.name === name)) {
      setToast({ msg: 'A folder with this name already exists', type: 'error' });
      return;
    }

    try {
      await createFolder(name, currentPath);
      setToast({ msg: 'Folder created', type: 'success' });
      setIsFolderModalOpen(false);
      fetchFiles();
    } catch (err) {
      setToast({ msg: 'Failed to create folder', type: 'error' });
    }
  };

  const handleDelete = async (id: string, key: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;

    const previousFiles = [...files];
    setFiles(files.filter(f => f.id !== id));

    try {
      await deleteFile(id, key);
      setToast({ msg: 'Item deleted', type: 'success' });
    } catch (err) {
      setFiles(previousFiles);
      setToast({ msg: 'Failed to delete item', type: 'error' });
    }
  };

  const switchToDemoMode = () => {
    enableMockMode();
    setIsDemo(true);
    setError(null);
    fetchFiles();
    setToast({ msg: 'Switched to Demo Mode', type: 'success' });
  };

  const navigateTo = (path: string) => {
    setCurrentPath(path);
  };

  // Generate breadcrumbs
  const breadcrumbs = React.useMemo(() => {
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ name: 'Home', path: '/' }];
    let buildPath = '/';
    parts.forEach(part => {
      buildPath += `${part}/`;
      crumbs.push({ name: part, path: buildPath });
    });
    return crumbs;
  }, [currentPath]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[64px] py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg text-white ${isDemo ? 'bg-indigo-500' : 'bg-[#F38020]'}`}>
              {isDemo ? <ZapOff className="w-6 h-6" /> : <Cloud className="w-6 h-6" />}
            </div>
            <div className="flex flex-col leading-none">
              <h1 className="text-xl font-bold tracking-tight text-gray-900">WorkerBox</h1>
              <span className="text-[10px] text-gray-500 font-semibold tracking-wide uppercase mt-1 flex gap-1 items-center">
                {isDemo ? (
                  <span className="text-indigo-600">DEMO MODE</span>
                ) : (
                  <>
                    <Database className="w-3 h-3" /> D1 + <HardDrive className="w-3 h-3" /> R2
                  </>
                )}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <button 
              onClick={handleOpenCreateFolder}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="New Folder"
            >
              <FolderPlus className="w-5 h-5 text-gray-500" />
              <span className="hidden sm:inline">New Folder</span>
            </button>
            <button 
              onClick={fetchFiles}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-[#F38020] hover:bg-orange-50 rounded-full transition-colors disabled:opacity-50"
              title="Refresh List"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        
        {/* Breadcrumbs */}
        <nav className="flex items-center text-sm text-gray-500 mb-6 overflow-x-auto whitespace-nowrap pb-2 no-scrollbar">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.path} className="flex items-center">
              {index > 0 && <ChevronRight className="w-4 h-4 mx-1 flex-shrink-0 text-gray-400" />}
              <button
                onClick={() => navigateTo(crumb.path)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                  index === breadcrumbs.length - 1 
                    ? 'font-semibold text-gray-900 bg-gray-200 pointer-events-none' 
                    : 'hover:bg-gray-200 text-gray-600'
                }`}
              >
                {index === 0 && <Home className="w-4 h-4" />}
                {crumb.name}
              </button>
            </div>
          ))}
        </nav>

        {/* Upload Section */}
        <section className="mb-8 max-w-2xl mx-auto">
          <UploadArea onUpload={handleUpload} isUploading={uploading} />
        </section>

        {/* File List Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              {currentPath === '/' ? 'All Files' : currentPath.split('/').slice(-2, -1)[0]}
              <span className="text-sm font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {currentFiles.length}
              </span>
            </h2>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold">Connection Error</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
              <button 
                onClick={switchToDemoMode}
                className="whitespace-nowrap px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-md text-sm font-medium transition-colors"
              >
                Switch to Demo Mode
              </button>
            </div>
          )}

          {loading && files.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-64 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : currentFiles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {currentFiles.map((file) => (
                <FileCard 
                  key={file.id} 
                  file={file} 
                  onDelete={handleDelete} 
                  onNavigate={navigateTo}
                />
              ))}
            </div>
          ) : (
            !error && (
              <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl bg-white">
                <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
                  {currentPath === '/' ? <HardDrive className="w-8 h-8" /> : <FolderOpen className="w-8 h-8" />}
                </div>
                <h3 className="text-lg font-medium text-gray-900">
                  {currentPath === '/' ? 'No files yet' : 'This folder is empty'}
                </h3>
                <p className="text-gray-500 mt-1">Upload a file or create a folder.</p>
              </div>
            )
          )}
        </section>
      </main>

      {/* New Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            <form onSubmit={handleSubmitCreateFolder}>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Create New Folder</h3>
                <p className="text-sm text-gray-500 mb-4">Enter a name for the new folder.</p>
                <input 
                  autoFocus
                  type="text" 
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  placeholder="Folder Name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F38020] focus:border-transparent transition-all"
                />
              </div>
              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#F38020] hover:bg-[#e07015] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`
          fixed bottom-6 right-6 left-6 sm:left-auto px-4 py-3 rounded-lg shadow-lg flex items-center justify-between sm:justify-start gap-3 transition-all duration-300 transform translate-y-0 z-50
          ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}
        `}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-medium text-sm sm:text-base">{toast.msg}</span>
          </div>
          <button onClick={() => setToast(null)} className="hover:opacity-80 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {/* Footer / Tech Info */}
      <footer className="py-6 text-center text-sm text-gray-400 px-4">
        <p>Powered by Cloudflare Workers, D1, and R2</p>
      </footer>
    </div>
  );
}