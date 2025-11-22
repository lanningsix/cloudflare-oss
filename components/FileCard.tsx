import React, { useState } from 'react';
import { File as FileIcon, Image as ImageIcon, Trash2, Download, FileText, Film, Music, Copy, Check, Folder } from 'lucide-react';
import { R2File } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface FileCardProps {
  file: R2File;
  onDelete: (file: R2File) => void;
  onNavigate: (path: string) => void;
}

export const FileCard: React.FC<FileCardProps> = ({ file, onDelete, onNavigate }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (ms: number) => {
    return new Date(ms).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(file.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL', err);
    }
  };

  const isFolder = file.type === 'directory';

  const handleCardClick = (e: React.MouseEvent) => {
    if (isFolder) {
      e.preventDefault();
      // Construct new path: current folder + folder name + /
      // Ensure file.folder defaults to '/' if missing
      const parentPath = file.folder || '/';
      // Ensure parentPath ends with '/'
      const normalizedParent = parentPath.endsWith('/') ? parentPath : parentPath + '/';
      const newPath = normalizedParent + file.name + '/';
      onNavigate(newPath);
    }
  };

  const getIcon = () => {
    if (isFolder) return <Folder className="w-10 h-10 text-yellow-400 fill-yellow-100" />;
    if (file.type.startsWith('image/')) return <ImageIcon className="w-8 h-8 text-purple-500" />;
    if (file.type.startsWith('video/')) return <Film className="w-8 h-8 text-red-500" />;
    if (file.type.startsWith('audio/')) return <Music className="w-8 h-8 text-blue-500" />;
    if (file.type.includes('pdf')) return <FileText className="w-8 h-8 text-orange-500" />;
    return <FileIcon className="w-8 h-8 text-gray-400" />;
  };

  const isImage = file.type.startsWith('image/');

  return (
    <div 
      onClick={handleCardClick}
      className={`group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-200 flex flex-col ${isFolder ? 'cursor-pointer hover:border-yellow-400' : ''}`}
    >
      {/* Preview Area */}
      <div className="h-32 w-full bg-gray-50 flex items-center justify-center border-b border-gray-100 relative overflow-hidden">
        {isImage ? (
          <img 
            src={file.url} 
            alt={file.name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
          />
        ) : (
          getIcon()
        )}
        
        {/* Overlay Actions */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
            {!isFolder && (
              <>
                <button 
                  onClick={handleCopyLink}
                  className={`p-2.5 rounded-full transition-transform hover:scale-110 ${copied ? 'bg-green-50 text-green-600' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                  title={t('copy_link')}
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
                <a 
                  href={file.url} 
                  target="_blank" 
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-2.5 bg-white rounded-full hover:bg-gray-100 text-gray-700 transition-transform hover:scale-110"
                  title={t('download')}
                >
                  <Download className="w-5 h-5" />
                </a>
              </>
            )}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onDelete(file);
              }}
              className="p-2.5 bg-white rounded-full hover:bg-red-50 text-red-600 transition-transform hover:scale-110"
              title={t('delete_btn')}
            >
              <Trash2 className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* Info Area */}
      <div className="p-4 flex flex-col flex-1 justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-gray-900 truncate text-sm mb-1" title={file.name}>
              {file.name}
            </h4>
          </div>
          <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">
            {isFolder ? t('type_folder') : (file.type.split('/')[1] || t('type_file'))}
          </p>
        </div>
        
        {!isFolder && (
          <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
            <span>{formatSize(file.size)}</span>
            <span>{formatDate(file.uploadedAt)}</span>
          </div>
        )}
      </div>
    </div>
  );
};
