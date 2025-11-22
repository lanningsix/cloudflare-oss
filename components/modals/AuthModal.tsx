
import React, { useState } from 'react';
import { LogIn, UserPlus, Lock, UserCircle, RefreshCw } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSubmit: (username: string, password: string, mode: 'login' | 'register') => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, initialMode = 'login', onClose, onSubmit }) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Sync mode if props change
  React.useEffect(() => {
      setMode(initialMode);
      setError(null);
      setUsername('');
      setPassword('');
      setConfirmPassword('');
  }, [initialMode, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (mode === 'register' && password !== confirmPassword) {
        setError(t('password_mismatch'));
        return;
    }

    setLoading(true);
    try {
        await onSubmit(username, password, mode);
        // Parent handles success (closing modal)
    } catch (err) {
        setError(mode === 'login' 
            ? t('login_failed', { error: (err as Error).message }) 
            : t('register_failed', { error: (err as Error).message })
        );
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
                 <h3 className="text-lg font-semibold text-gray-900">
                    {mode === 'login' ? t('login_title') : t('register_title')}
                 </h3>
                 <div className="p-2 bg-indigo-100 rounded-full text-indigo-600">
                    {mode === 'login' ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                 </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">
                {mode === 'login' ? t('login_desc') : t('register_desc')}
            </p>
            
            <div className="space-y-3">
                <div className="relative">
                    <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                    autoFocus
                    type="text" 
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder={t('username_placeholder')}
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                </div>
                
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={t('password_placeholder')}
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                </div>

                {mode === 'register' && (
                    <div className="relative animate-[fadeIn_0.3s_ease-out]">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                        type="password" 
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder={t('confirm_password')}
                        className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                    </div>
                )}
            </div>

            {error && (
                <p className="mt-3 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">{error}</p>
            )}

            {/* Toggle Mode */}
            <div className="mt-4 text-center">
                <button
                    type="button"
                    onClick={() => {
                        setMode(mode === 'login' ? 'register' : 'login');
                        setError(null);
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                    {mode === 'login' ? t('switch_to_register') : t('switch_to_login')}
                </button>
            </div>

          </div>
          <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {t('cancel')}
            </button>
            <button 
              type="submit"
              disabled={!username.trim() || !password.trim() || loading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <RefreshCw className="w-3 h-3 animate-spin" />}
              {mode === 'login' ? t('login') : t('register')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
