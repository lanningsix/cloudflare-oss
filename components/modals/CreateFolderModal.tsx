
import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const { t } = useLanguage();
  const [folderName, setFolderName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(folderName);
    setFolderName(''); // Reset on submit
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('create_folder_title')}</h3>
            <p className="text-sm text-gray-500 mb-4">{t('create_folder_desc')}</p>
            <input 
              autoFocus
              type="text" 
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              placeholder={t('folder_name_placeholder')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F38020] focus:border-transparent transition-all"
            />
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
              disabled={!folderName.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-[#F38020] hover:bg-[#e07015] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
