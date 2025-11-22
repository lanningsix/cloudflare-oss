
import React from 'react';
import { Cloud, Database, HardDrive, RefreshCw, ZapOff, LogIn, LogOut, FolderPlus, Languages } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  isDemo: boolean;
  loading: boolean;
  onCreateFolder: () => void;
  onRefresh: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  isDemo, 
  loading, 
  onCreateFolder, 
  onRefresh, 
  onOpenAuth 
}) => {
  const { t, language, setLanguage } = useLanguage();
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[64px] py-3 flex flex-wrap items-center justify-between gap-4">
        
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg text-white flex-shrink-0 ${isDemo ? 'bg-indigo-500' : 'bg-[#F38020]'}`}>
            {isDemo ? <ZapOff className="w-6 h-6" /> : <Cloud className="w-6 h-6" />}
          </div>
          <div className="flex flex-col leading-none">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-gray-900">{t('app_title')}</h1>
            <span className="text-[10px] text-gray-500 font-semibold tracking-wide uppercase mt-1 flex gap-1 items-center">
              {isDemo ? (
                <span className="text-indigo-600">{t('subtitle_demo')}</span>
              ) : (
                <span className="hidden sm:flex items-center gap-1">
                  <Database className="w-3 h-3" /> D1 + <HardDrive className="w-3 h-3" /> R2
                </span>
              )}
            </span>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* User Profile / Login */}
          <div className="mr-0 sm:mr-2 flex items-center">
            {user?.isGuest ? (
              <button 
                onClick={() => onOpenAuth('login')}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <LogIn className="w-5 h-5" />
                <span className="hidden sm:inline">{t('login')}</span>
              </button>
            ) : (
               <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end hidden sm:flex">
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
            onClick={onCreateFolder}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title={t('new_folder')}
          >
            <FolderPlus className="w-5 h-5 text-gray-500" />
            <span className="hidden sm:inline">{t('new_folder')}</span>
          </button>
          
          <button 
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-[#F38020] hover:bg-orange-50 rounded-full transition-colors disabled:opacity-50"
            title={t('refresh')}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Language Switcher */}
          <div className="relative group ml-1 sm:ml-2">
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
  );
};
