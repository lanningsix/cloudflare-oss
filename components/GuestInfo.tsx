
import React from 'react';
import { UserCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { R2File } from '../types';

interface GuestInfoProps {
  files: R2File[];
  onLogin: () => void;
}

export const GuestInfo: React.FC<GuestInfoProps> = ({ files, onLogin }) => {
  const { t } = useLanguage();
  const { user } = useAuth();

  if (!user?.isGuest) return null;

  const guestUsageCount = files.filter(f => f.type !== 'directory').length;
  const isGuestLimitReached = guestUsageCount >= 10;

  return (
    <div className="mb-6 bg-blue-50 border border-blue-100 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
       <div className="flex items-center gap-2 text-blue-800">
          <UserCircle className="w-5 h-5 flex-shrink-0" />
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
         onClick={onLogin}
         className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline whitespace-nowrap"
       >
         {t('login_to_unlimit')}
       </button>
    </div>
  );
};
