
import React, { useState, useMemo } from 'react';
import { Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { R2File } from '../../types';

interface MoveFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMove: (destination: string) => void;
  currentPath: string;
  allFiles: R2File[];
  movingFileIds: string[];
}

export const MoveFileModal: React.FC<MoveFileModalProps> = ({ 
  isOpen, 
  onClose, 
  onMove, 
  currentPath,
  allFiles,
  movingFileIds
}) => {
  const { t } = useLanguage();
  const [selectedDest, setSelectedDest] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));

  // Build directory tree
  const folderTree = useMemo(() => {
    const folders = allFiles.filter(f => f.type === 'directory').sort((a, b) => a.name.localeCompare(b.name));
    // Add root
    const root = { id: 'root', name: 'Root', path: '/', children: [] as any[] };
    
    const map = new Map<string, any>();
    map.set('/', root);

    // Sort by depth to ensure parents exist
    folders.sort((a,b) => (a.folder || '/').length - (b.folder || '/').length);

    folders.forEach(f => {
       const path = (f.folder === '/' ? '' : f.folder) + f.name + '/';
       // If this folder is being moved, skip it and its children (cant move folder into itself)
       // But we are only allowing file moves for now, so this is safe.
       
       const node = { id: f.id, name: f.name, path, children: [] };
       map.set(path, node);

       const parentPath = f.folder || '/';
       const parent = map.get(parentPath);
       if (parent) {
           parent.children.push(node);
       }
    });

    return root;
  }, [allFiles]);

  if (!isOpen) return null;

  const toggleExpand = (path: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newSet = new Set(expandedFolders);
      if (newSet.has(path)) newSet.delete(path);
      else newSet.add(path);
      setExpandedFolders(newSet);
  };

  const renderNode = (node: any, depth: number = 0) => {
      const isExpanded = expandedFolders.has(node.path);
      const isSelected = selectedDest === node.path;
      const isCurrent = node.path === currentPath;
      const hasChildren = node.children && node.children.length > 0;

      return (
          <div key={node.path}>
              <div 
                onClick={() => !isCurrent && setSelectedDest(node.path)}
                className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors
                    ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}
                    ${isCurrent ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                style={{ paddingLeft: `${depth * 16 + 12}px` }}
              >
                  <button 
                    onClick={(e) => toggleExpand(node.path, e)}
                    className={`p-0.5 rounded hover:bg-gray-200 text-gray-400 ${hasChildren ? '' : 'invisible'}`}
                  >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  
                  {isExpanded ? <FolderOpen className="w-5 h-5 text-yellow-400" /> : <Folder className="w-5 h-5 text-yellow-400" />}
                  <span className="text-sm font-medium truncate">{node.name}</span>
                  {isCurrent && <span className="ml-auto text-xs text-gray-400">Current</span>}
              </div>
              {isExpanded && hasChildren && (
                  <div>
                      {node.children.map((child: any) => renderNode(child, depth + 1))}
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh] animate-[fadeIn_0.2s_ease-out]">
         <div className="p-5 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">{t('move_files_title')}</h3>
            <p className="text-sm text-gray-500">{t('move_files_desc')}</p>
         </div>
         
         <div className="flex-1 overflow-y-auto p-2">
             {renderNode(folderTree)}
         </div>

         <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {t('cancel')}
            </button>
            <button 
              onClick={() => selectedDest && onMove(selectedDest)}
              disabled={!selectedDest}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('move_here')}
            </button>
         </div>
      </div>
    </div>
  );
};
