
import React from 'react';
import { AlertCircle, HardDrive, FolderOpen } from 'lucide-react';
import { FileCard } from './FileCard';
import { R2File } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface FileListProps {
  files: R2File[];
  currentPath: string;
  loading: boolean;
  error: string | null;
  onNavigate: (path: string) => void;
  onDelete: (file: R2File) => void;
  onSwitchToDemo: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}

export const FileList: React.FC<FileListProps> = ({
  files,
  currentPath,
  loading,
  error,
  onNavigate,
  onDelete,
  onSwitchToDemo,
  selectedIds,
  onToggleSelect
}) => {
  const { t } = useLanguage();

  const currentFolderFiles = files.filter(f => {
    const fileFolder = f.folder || '/';
    return fileFolder === currentPath;
  });

  const currentFolderName = currentPath === '/' 
    ? t('all_files') 
    : currentPath.split('/').slice(-2, -1)[0];

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 truncate max-w-full">
          <span className="truncate">{currentFolderName}</span>
          <span className="text-sm font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
            {currentFolderFiles.length}
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
            onClick={onSwitchToDemo}
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
      ) : currentFolderFiles.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 pb-24 sm:pb-0">
          {currentFolderFiles.map((file) => (
            <FileCard 
              key={file.id} 
              file={file} 
              isSelected={selectedIds.has(file.id)}
              onToggleSelect={onToggleSelect}
              onDelete={onDelete} 
              onNavigate={onNavigate}
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
  );
};
