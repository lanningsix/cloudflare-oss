
import React from 'react';
import { Trash2 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { R2File } from '../../types';

interface DeleteConfirmModalProps {
  file: R2File | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ file, onClose, onConfirm }) => {
  const { t } = useLanguage();

  if (!file) return null;

  return (
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
                {t('delete_confirm')} <span className="font-medium text-gray-900">"{file.name}"</span>?
            </p>
            
            {file.type === 'directory' && (
                <p className="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-100">
                    {t('delete_warning')}
                </p>
            )}
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
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            {t('delete')}
          </button>
        </div>
      </div>
    </div>
  );
};
