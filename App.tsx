import React, { useEffect, useState, useCallback } from 'react';
import { UploadArea } from './components/UploadArea';
import { FileCard } from './components/FileCard';
import { listFiles, uploadFile, deleteFile, enableMockMode, isMockMode, createFolder } from './services/fileService';
import {R2File } from './types';
import { Cloud, Database, HardDrive, RefreshCw, AlertCircle, CheckCircle2, X, ZapOff, FolderPlus, Home, ChevronRight, FolderOpen, Trash2, Languages, UserCircle, LogOut, LogIn, UserPlus, Lock } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { useAuth } from './contexts/AuthContext';

export default function App() {
  const { t, language, setLanguage } = useLanguage();
  const { user, login, register, logout } = useAuth();
  const [files, setFiles] = useState<R2File[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(isMockMode());
  const [currentPath, setCurrentPath] = useState<string>('/');
  
  // Modal States
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  const [newFolderName, setNewFolderName] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  
  const [fileToDelete, setFileToDelete] = useState<R2File | null>(null);
  
  // Simple toast state
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const fetchFiles = useCallback(async () => {
    // If user is not initialized yet (context loading), skip
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

  // Re-fetch when user changes (login/logout)
  useEffect(() => {
    if (user) {
      fetchFiles();
    }
  }, [user, fetchFiles]);

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

  // Calculate usage for guest
  const guestUsageCount = files.filter(f => f.type !== 'directory').length;
  const isGuestLimitReached = user?.isGuest && guestUsageCount >= 10;

  const handleUpload = async (filesToUpload: File[]) => {
    if (filesToUpload.length === 0) return;
    
    // Frontend check for guest limit
    if (isGuestLimitReached) {
      setToast({ msg: t('upload_limit_reached'), type: 'error' });
      return;
    }

    setUploading(true);
    let successCount = 0;
    let failCount = 0;
    let limitError = false;

    for (const file of filesToUpload) {
      try {
        await uploadFile(file, currentPath);
        successCount++;
      } catch (err) {
        console.error(err);
        if (err instanceof Error && err.message.includes("limit")) {
            limitError = true;
        }
        failCount++;
      }
    }

    setUploading(false);
    
    if (limitError) {
        setToast({ msg: t('upload_limit_reached'), type: 'error' });
    } else if (failCount === 0) {
      setToast({ msg: t('toast_upload_success', { count: successCount }), type: 'success' });
    } else {
      setToast({ msg: t('toast_upload_fail', { success: successCount, fail: failCount }), type: 'error' });
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
      setToast({ msg: t('toast_invalid_name'), type: 'error' });
      return;
    }

    // Check for duplicate in current view
    if (currentFiles.some(f => f.type === 'directory' && f.name === name)) {
      setToast({ msg: t('toast_folder_exists'), type: 'error' });
      return;
    }

    try {
      await createFolder(name, currentPath);
      setToast({ msg: t('toast_folder_created'), type: 'success' });
      setIsFolderModalOpen(false);
      fetchFiles();
    } catch (err) {
      setToast({ msg: t('toast_folder_failed'), type: 'error' });
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    
    try {
      if (authMode === 'login') {
        await login(authUsername, authPassword);
      } else {
        if (authPassword !== authConfirmPassword) {
           throw new Error(t('password_mismatch'));
        }
        await register(authUsername, authPassword);
        setToast({ msg: t('register_success'), type: 'success' });
      }
      
      setIsAuthModalOpen(false);
      setAuthUsername('');
      setAuthPassword('');
      setAuthConfirmPassword('');
    } catch (err) {
      const msg = authMode === 'login' 
        ? t('login_failed', { error: (err as Error).message }) 
        : t('register_failed', { error: (err as Error).message });
      setToast({ msg, type: 'error' });
    } finally {
      setAuthLoading(false);
    }
  };

  const openAuthModal = (mode: 'login' | 'register' = 'login') => {
    setAuthMode(mode);
    setAuthUsername('');
    setAuthPassword('');
    setAuthConfirmPassword('');
    setIsAuthModalOpen(true);
  };

  const onRequestDelete = (file: R2File) => {
    setFileToDelete(file);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    
    const { id, key } = fileToDelete;

    // Optimistic Update
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

  const switchToDemoMode = () => {
    enableMockMode();
    setIsDemo(true);
    setError(null);
    fetchFiles();
    setToast({ msg: t('toast_demo_mode'), type: 'success' });
  };

  const navigateTo = (path: string) => {
    setCurrentPath(path);
  };

  // Generate breadcrumbs
  const breadcrumbs = React.useMemo(() => {
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ name: t('home'), path: '/' }];
    let buildPath = '/';
    parts.forEach(part => {
      buildPath += `${part}/`;
      crumbs.push({ name: part, path: buildPath });
    });
    return crumbs;
  }, [currentPath, t]);

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
              <h1 className="text-xl font-bold tracking-tight text-gray-900">{t('app_title')}</h1>
              <span className="text-[10px] text-gray-500 font-semibold tracking-wide uppercase mt-1 flex gap-1 items-center">
                {isDemo ? (
                  <span className="text-indigo-600">{t('subtitle_demo')}</span>
                ) : (
                  <>
                    <Database className="w-3 h-3" /> D1 + <HardDrive className="w-3 h-3" /> R2
                  </>
                )}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* User Profile / Login */}
            <div className="mr-2 flex items-center">
              {user?.isGuest ? (
                <button 
                  onClick={() => openAuthModal('login')}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <LogIn className="w-5 h-5" />
                  <span className="hidden sm:inline">{t('login')}</span>
                </button>
              ) : (
                 <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end">
                        <span className="text-sm font-semibold text-gray-700">{user?.name}</span>
                        <span className="text-xs text-green-600 font-medium px-1.5 py-0.5 bg-green-50 rounded-full">User</span>
                    </div>
                    <button 
                      onClick={logout} 
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                      title={t('logout')}
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                 </div>
              )}
            </div>

            <div className="h-6 w-px bg-gray-200 mx-1"></div>

             <button 
              onClick={handleOpenCreateFolder}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title={t('new_folder')}
            >
              <FolderPlus className="w-5 h-5 text-gray-500" />
              <span className="hidden sm:inline">{t('new_folder')}</span>
            </button>
            <button 
              onClick={fetchFiles}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-[#F38020] hover:bg-orange-50 rounded-full transition-colors disabled:opacity-50"
              title={t('refresh')}
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Language Switcher */}
            <div className="relative group ml-2">
              <button className="p-2 text-gray-500 hover:text-[#F38020] hover:bg-orange-50 rounded-full transition-colors">
                <Languages className="w-5 h-5" />
              </button>
              <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-lg border border-gray-100 py-1 hidden group-hover:block hover:block z-50">
                 <button 
                   onClick={() => setLanguage('en')} 
                   className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${language === 'en' ? 'font-bold text-[#F38020]' : 'text-gray-700'}`}
                 >
                   English
                 </button>
                 <button 
                   onClick={() => setLanguage('zh')} 
                   className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${language === 'zh' ? 'font-bold text-[#F38020]' : 'text-gray-700'}`}
                 >
                   中文
                 </button>
                 <button 
                   onClick={() => setLanguage('ja')} 
                   className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${language === 'ja' ? 'font-bold text-[#F38020]' : 'text-gray-700'}`}
                 >
                   日本語
                 </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        
        {/* Info Bar for Guest */}
        {user?.isGuest && (
          <div className="mb-6 bg-blue-50 border border-blue-100 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
             <div className="flex items-center gap-2 text-blue-800">
                <UserCircle className="w-5 h-5" />
                <span className="font-medium text-sm">{t('guest_mode')}</span>
                <span className="text-sm text-blue-600">
                   • {t('guest_limit_info', { count: guestUsageCount })}
                </span>
             </div>
             {isGuestLimitReached && (
                 <span className="text-xs font-bold text-red-600 bg-white px-2 py-1 rounded border border-red-100">
                    {t('upload_limit_reached')}
                 </span>
             )}
             <button 
               onClick={() => openAuthModal('login')}
               className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline whitespace-nowrap"
             >
               {t('login_to_unlimit')}
             </button>
          </div>
        )}

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
        <section className="mb-8 max-w-2xl mx-auto relative">
          <UploadArea onUpload={handleUpload} isUploading={uploading} />
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

        {/* File List Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              {currentPath === '/' ? t('all_files') : currentPath.split('/').slice(-2, -1)[0]}
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
                  <p className="text-sm font-bold">{t('connection_error')}</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
              <button 
                onClick={switchToDemoMode}
                className="whitespace-nowrap px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-md text-sm font-medium transition-colors"
              >
                {t('switch_demo')}
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
                  onDelete={onRequestDelete} 
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
                  {currentPath === '/' ? t('root_empty') : t('folder_empty')}
                </h3>
                <p className="text-gray-500 mt-1">{t('empty_hint')}</p>
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
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('create_folder_title')}</h3>
                <p className="text-sm text-gray-500 mb-4">{t('create_folder_desc')}</p>
                <input 
                  autoFocus
                  type="text" 
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  placeholder={t('folder_name_placeholder')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F38020] focus:border-transparent transition-all"
                />
              </div>
              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#F38020] hover:bg-[#e07015] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auth Modal (Login / Register) */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            <form onSubmit={handleAuthSubmit}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                     <h3 className="text-lg font-semibold text-gray-900">
                        {authMode === 'login' ? t('login_title') : t('register_title')}
                     </h3>
                     <div className="p-2 bg-indigo-100 rounded-full text-indigo-600">
                        {authMode === 'login' ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                     </div>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                    {authMode === 'login' ? t('login_desc') : t('register_desc')}
                </p>
                
                <div className="space-y-3">
                    <div className="relative">
                        <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                        autoFocus
                        type="text" 
                        value={authUsername}
                        onChange={e => setAuthUsername(e.target.value)}
                        placeholder={t('username_placeholder')}
                        className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                    </div>
                    
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                        type="password" 
                        value={authPassword}
                        onChange={e => setAuthPassword(e.target.value)}
                        placeholder={t('password_placeholder')}
                        className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {authMode === 'register' && (
                        <div className="relative animate-[fadeIn_0.3s_ease-out]">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input 
                            type="password" 
                            value={authConfirmPassword}
                            onChange={e => setAuthConfirmPassword(e.target.value)}
                            placeholder={t('confirm_password')}
                            className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            />
                        </div>
                    )}
                </div>

                {/* Toggle Mode */}
                <div className="mt-4 text-center">
                    <button
                        type="button"
                        onClick={() => {
                            setAuthMode(authMode === 'login' ? 'register' : 'login');
                            setError(null);
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                        {authMode === 'login' ? t('switch_to_register') : t('switch_to_login')}
                    </button>
                </div>

              </div>
              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit"
                  disabled={!authUsername.trim() || !authPassword.trim() || authLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {authLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                  {authMode === 'login' ? t('login') : t('register')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            <div className="p-6">
                <div className="flex items-center gap-3 mb-4 text-red-600">
                    <div className="p-2 bg-red-100 rounded-full">
                        <Trash2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{t('delete_title')}</h3>
                </div>
                
                <p className="text-sm text-gray-500 mb-2">
                    {t('delete_confirm')} <span className="font-medium text-gray-900">"{fileToDelete.name}"</span>?
                </p>
                
                {fileToDelete.type === 'directory' && (
                    <p className="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100">
                        {t('delete_warning')}
                    </p>
                )}
            </div>
            
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
              <button 
                type="button"
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                {t('delete')}
              </button>
            </div>
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
        <p>{t('powered_by')}</p>
      </footer>
    </div>
  );
}