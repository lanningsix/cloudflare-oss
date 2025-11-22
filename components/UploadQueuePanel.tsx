
import React from 'react';
import { Loader2, CheckCircle2, X, Minimize2, Maximize2, Pause, Play, RotateCcw, File as FileIcon } from 'lucide-react';
import { UploadProgress } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface UploadQueuePanelProps {
  queue: UploadProgress[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRetry: (id: string) => void;
  onRestart: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
}

export const UploadQueuePanel: React.FC<UploadQueuePanelProps> = ({
  queue,
  isOpen,
  setIsOpen,
  onPause,
  onResume,
  onRetry,
  onRestart,
  onCancel,
  onRemove,
  onClearCompleted
}) => {
  const { t } = useLanguage();

  if (queue.length === 0) return null;

  const activeUploads = queue.filter(u => u.status === 'uploading' || u.status === 'pending').length;
  const progressSum = queue.reduce((acc, curr) => acc + curr.progress, 0);
  const totalProgress = queue.length > 0 ? progressSum / queue.length : 0;

  return (
    <div className={`
        fixed z-40 bg-white shadow-2xl border-gray-200 overflow-hidden flex flex-col animate-[slideUp_0.3s_ease-out]
        w-full bottom-0 left-0 right-0 rounded-t-xl border-t
        sm:w-96 sm:right-6 sm:bottom-6 sm:left-auto sm:rounded-lg sm:border
    `}>
        {/* Header */}
        <div 
            className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between cursor-pointer"
            onClick={() => setIsOpen(!isOpen)}
        >
            <div className="flex items-center gap-2">
                {activeUploads > 0 ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#F38020]" />
                ) : (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                )}
                <span className="text-sm font-medium">
                    {activeUploads > 0 
                        ? `${t('upload_uploading')} (${activeUploads})` 
                        : t('upload_complete_title')}
                </span>
            </div>
            <div className="flex items-center gap-1">
                 {isOpen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                 {activeUploads === 0 && (
                     <button 
                       onClick={(e) => { e.stopPropagation(); onClearCompleted(); }}
                       className="ml-2 p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                     >
                         <X className="w-4 h-4" />
                     </button>
                 )}
            </div>
        </div>

        {/* Progress Bar for Total */}
        {activeUploads > 0 && (
             <div className="h-1 w-full bg-gray-800">
                 <div 
                    className="h-full bg-[#F38020] transition-all duration-300"
                    style={{ width: `${totalProgress}%` }}
                 />
             </div>
        )}

        {/* File List */}
        {isOpen && (
            <div className="max-h-64 overflow-y-auto p-2 bg-gray-50 space-y-2">
                {queue.map((item) => (
                    <div key={item.id} className="bg-white p-3 rounded border border-gray-100 shadow-sm relative">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2 overflow-hidden max-w-[65%]">
                                <FileIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <div className="flex flex-col truncate">
                                    <span className="text-xs font-medium text-gray-700 truncate" title={item.fileName}>
                                        {item.fileName}
                                    </span>
                                    {item.status === 'paused' && <span className="text-[10px] text-amber-500 font-medium">{t('upload_paused')}</span>}
                                    {item.status === 'cancelled' && <span className="text-[10px] text-gray-400">{t('cancel_upload')}</span>}
                                </div>
                            </div>
                            
                            {/* Controls */}
                            <div className="flex items-center gap-1">
                                {(item.status === 'uploading') && (
                                    <button onClick={() => onPause(item.id)} title={t('pause_upload')} className="p-1 rounded hover:bg-gray-100 text-gray-600">
                                        <Pause className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {(item.status === 'paused' || item.status === 'error' || item.status === 'cancelled') && (
                                    <button 
                                        onClick={() => item.status === 'paused' ? onResume(item.id) : onRestart(item.id)} 
                                        title={item.status === 'paused' ? t('resume_upload') : t('retry_upload')} 
                                        className="p-1 rounded hover:bg-gray-100 text-blue-600"
                                    >
                                        {item.status === 'paused' ? <Play className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                    </button>
                                )}
                                {(item.status !== 'complete' && item.status !== 'cancelled') && (
                                    <button onClick={() => onCancel(item.id)} title={t('cancel_upload')} className="p-1 rounded hover:bg-red-50 text-red-500">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                
                                {(item.status === 'complete') && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                {(item.status === 'cancelled' || item.status === 'complete') && (
                                     <button onClick={() => onRemove(item.id)} className="p-1 text-gray-400 hover:text-gray-600">
                                         <X className="w-3.5 h-3.5" />
                                     </button>
                                )}
                            </div>
                        </div>
                        
                        {/* Individual Progress */}
                        {item.status !== 'cancelled' && (
                            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-300 ${
                                        item.status === 'error' ? 'bg-red-500' : 
                                        item.status === 'paused' ? 'bg-amber-400' : 
                                        item.status === 'complete' ? 'bg-green-500' : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${item.progress}%` }}
                                />
                            </div>
                        )}
                        
                        {item.status === 'error' && (
                            <p className="text-[10px] text-red-500 mt-1">{item.error}</p>
                        )}
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};
