import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, File as FileIcon, Loader2 } from 'lucide-react';

interface UploadAreaProps {
  onUpload: (files: File[]) => void;
  isUploading: boolean;
}

export const UploadArea: React.FC<UploadAreaProps> = ({ onUpload, isUploading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(Array.from(e.dataTransfer.files));
    }
  }, [onUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(Array.from(e.target.files));
    }
    // Reset input value so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onUpload]);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={triggerFileInput}
      className={`
        relative w-full p-10 rounded-xl border-2 border-dashed transition-all duration-200 ease-in-out cursor-pointer group
        ${isDragging 
          ? 'border-cf-orange bg-orange-50' 
          : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'}
        ${isUploading ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        multiple
      />
      
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <div className={`
          p-4 rounded-full transition-colors duration-200
          ${isDragging ? 'bg-orange-100 text-cf-orange' : 'bg-gray-100 text-gray-500 group-hover:bg-white group-hover:shadow-sm'}
        `}>
          {isUploading ? (
            <Loader2 className="w-10 h-10 animate-spin text-cf-orange" />
          ) : (
            <UploadCloud className="w-10 h-10" />
          )}
        </div>
        
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-gray-700">
            {isUploading ? 'Uploading to R2...' : 'Click or drag files to upload'}
          </h3>
          <p className="text-sm text-gray-500">
            Support for images, documents, and archives.
          </p>
        </div>
      </div>
    </div>
  );
};
