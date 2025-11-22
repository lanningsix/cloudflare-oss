import React, { useState, useRef } from 'react';
import { File as FileIcon, Image as ImageIcon, Trash2, Download, FileText, Film, Music, Copy, Check, Folder, Square, CheckSquare } from 'lucide-react';
import { R2File } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface FileCardProps {
  file: R2File;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (file: R2File) => void;
  onNavigate: (path: string) => void;
}

export const FileCard: React.FC<FileCardProps> = ({ file, isSelected, onToggleSelect, onDelete, onNavigate }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  
  // Long press logic state
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

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
    // If a long press just happened, ignore the click
    if (isLongPress.current) {
        isLongPress.current = false;
        return;
    }
    
    if (isFolder) {
      e.preventDefault();
      const parentPath = file.folder || '/';
      const normalizedParent = parentPath.endsWith('/') ? parentPath : parentPath + '/';
      const newPath = normalizedParent + file.name + '/';
      onNavigate(newPath);
    }
  };

  const handleTouchStart = () => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
        isLongPress.current = true;
        if (navigator.vibrate) navigator.vibrate(50);
        onToggleSelect(file.id);
    }, 500);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
    }
    // If long press triggered, prevent default behavior (like navigation link click simulation) if possible
    if (isLongPress.current && e.cancelable) {
        e.preventDefault();
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
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
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      className={`group relative bg-white border rounded-xl overflow-hidden transition-all duration-200 flex flex-col select-none
        ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500 ring-offset-2 bg-indigo-50/10' : 'border-gray-200 hover:shadow-md'}
        ${isFolder ? 'cursor-pointer hover:border-yellow-400' : ''}
        active:scale-[0.99]
      `}
      onContextMenu={(e) => {
          // Prevent context menu if we just long pressed to select to avoid conflicts
          if (isLongPress.current) e.preventDefault();
      }}
    >
      {/* Selection Checkbox - Always visible if selected, else on group hover */}
      <div 
          className={`absolute top-2 left-2 z-10 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(file.id); }}
      >
          <div className={`p-1 rounded bg-white/90 backdrop-blur shadow-sm cursor-pointer ${isSelected ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-500'}`}>
             {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
          </div>
      </div>

      {/* Preview Area */}
      <div className="h-32 w-full bg-gray-50 flex items-center justify-center border-b border-gray-100 relative overflow-hidden">
        {isImage ? (
          <img 
            src={file.url} 
            alt={file.name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none" 
          />
        ) : (
          getIcon()
        )}
      </div>

      {/* Info & Actions Area */}
      <div className="p-3 flex flex-col flex-1">
        <div className="mb-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className={`font-medium truncate text-sm mb-0.5 ${isSelected ? 'text-indigo-700' : 'text-gray-900'}`} title={file.name}>
              {file.name}
            </h4>
          </div>
          <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">
            {isFolder ? t('type_folder') : (file.type.split('/')[1] || t('type_file'))}
          </p>
        </div>
        
        {!isFolder && (
          <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
            <span>{formatSize(file.size)}</span>
            <span>{formatDate(file.uploadedAt)}</span>
          </div>
        )}

        {/* Permanent Action Bar */}
        <div className="mt-auto pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
             {!isFolder && (
                <>
                    <button 
                        onClick={handleCopyLink}
                        className={`p-2 rounded-md transition-colors flex items-center justify-center ${copied ? 'bg-green-50 text-green-600' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
                        title={t('copy_link')}
                    >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <a 
                        href={file.url} 
                        target="_blank" 
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors flex items-center justify-center"
                        title={t('download')}
                    >
                        <Download className="w-4 h-4" />
                    </a>
                </>
             )}
             <button 
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(file);
                }}
                className="p-2 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center justify-center"
                title={t('delete_btn')}
             >
                <Trash2 className="w-4 h-4" />
             </button>
        </div>
      </div>
    </div>
  );
};