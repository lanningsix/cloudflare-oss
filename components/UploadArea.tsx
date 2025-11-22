
import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, FolderPlus, File as FileIcon } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { FileWithPath } from '../types';

interface UploadAreaProps {
  onUpload: (files: FileWithPath[]) => void;
  isUploading: boolean; // This prop effectively just disables interactions now
}

export const UploadArea: React.FC<UploadAreaProps> = ({ onUpload, isUploading }) => {
  const { t } = useLanguage();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) setIsDragging(true);
  }, [isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) setIsDragging(true);
  }, [isUploading]);

  // Recursive function to traverse FileSystemEntry
  const scanFiles = async (entry: any, path: string = ''): Promise<FileWithPath[]> => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file: File) => {
          const fileWithPath = file as FileWithPath;
          fileWithPath.path = path + file.name;
          resolve([fileWithPath]);
        });
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      return new Promise((resolve) => {
        // readEntries might not return all entries in one call
        const readAllEntries = async () => {
          let allEntries: any[] = [];
          const readBatch = async () => {
            return new Promise<void>((resolveBatch, rejectBatch) => {
              dirReader.readEntries((entries: any[]) => {
                if (entries.length === 0) {
                  resolveBatch();
                } else {
                  allEntries = allEntries.concat(entries);
                  readBatch().then(resolveBatch).catch(rejectBatch);
                }
              }, rejectBatch);
            });
          };

          await readBatch();
          
          const promises = allEntries.map((e) => scanFiles(e, path + entry.name + '/'));
          const results = await Promise.all(promises);
          resolve(results.flat());
        };
        readAllEntries();
      });
    }
    return [];
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isUploading) return;
    
    const items = e.dataTransfer.items;
    if (!items) return;

    const promises: Promise<FileWithPath[]>[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
           promises.push(scanFiles(entry));
        }
      }
    }

    try {
        const results = await Promise.all(promises);
        const flatFiles = results.flat();
        if (flatFiles.length > 0) {
          onUpload(flatFiles);
        }
    } catch (err) {
        console.error("Error scanning files", err);
    }

  }, [onUpload, isUploading]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files).map(file => {
        const f = file as FileWithPath;
        // For directory input, webkitRelativePath gives the relative path
        if (file.webkitRelativePath) {
          f.path = file.webkitRelativePath;
        }
        return f;
      });
      onUpload(filesArray);
    }
    if (e.target.value) e.target.value = ''; // Reset input
  }, [onUpload]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative w-full p-8 sm:p-10 rounded-xl border-2 border-dashed transition-all duration-200 ease-in-out group flex flex-col items-center justify-center text-center
        ${isDragging 
          ? 'border-cf-orange bg-orange-50 scale-[1.01] shadow-lg' 
          : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'}
        ${isUploading ? 'opacity-70 cursor-not-allowed' : ''}
      `}
    >
      {/* Hidden Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        multiple
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFileSelect}
        className="hidden"
        multiple
        // @ts-ignore - Directory attributes are non-standard but supported
        webkitdirectory="" 
        directory="" 
      />
      
      <div className={`
        p-4 rounded-full transition-colors duration-200 mb-4
        ${isDragging ? 'bg-orange-100 text-cf-orange' : 'bg-gray-100 text-gray-500 group-hover:bg-white group-hover:shadow-sm'}
      `}>
        {isDragging ? (
           <FolderPlus className="w-10 h-10 animate-bounce" />
        ) : (
           <UploadCloud className="w-10 h-10" />
        )}
      </div>
      
      <div className="space-y-2 max-w-md">
        <h3 className="text-lg font-semibold text-gray-700">
          {isDragging ? t('upload_drop_now') : t('upload_idle')}
        </h3>
        <p className="text-sm text-gray-500">
          {t('upload_subtitle')}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-center gap-3 mt-6 z-10">
        <button
            onClick={(e) => {
                e.stopPropagation();
                if(!isUploading) fileInputRef.current?.click();
            }}
            disabled={isUploading}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 hover:text-[#F38020] hover:border-[#F38020] transition-all flex items-center gap-2 shadow-sm"
        >
            <FileIcon className="w-4 h-4" />
            {t('upload_btn_file')}
        </button>
        <button
            onClick={(e) => {
                e.stopPropagation();
                if(!isUploading) folderInputRef.current?.click();
            }}
            disabled={isUploading}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 hover:text-[#F38020] hover:border-[#F38020] transition-all flex items-center gap-2 shadow-sm"
        >
            <FolderPlus className="w-4 h-4" />
            {t('upload_btn_folder')}
        </button>
      </div>
    </div>
  );
};
