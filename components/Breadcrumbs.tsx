
import React from 'react';
import { Home, ChevronRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface BreadcrumbsProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ currentPath, onNavigate }) => {
  const { t } = useLanguage();

  const breadcrumbs = React.useMemo(() => {
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ name: t('home'), path: '/' }];
    let buildPath = '/';
    parts.forEach(part => {
      buildPath += `${part}/`;
      crumbs.push({ name: part, path: buildPath });
    });
    return crumbs;
  }, [currentPath, t]);

  return (
    <nav className="flex items-center text-sm text-gray-500 mb-6 overflow-x-auto whitespace-nowrap pb-2 no-scrollbar">
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.path} className="flex items-center">
          {index > 0 && <ChevronRight className="w-4 h-4 mx-1 flex-shrink-0 text-gray-400" />}
          <button
            onClick={() => onNavigate(crumb.path)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
              index === breadcrumbs.length - 1 
                ? 'font-semibold text-gray-900 bg-gray-200 pointer-events-none' 
                : 'hover:bg-gray-200 text-gray-600'
            }`}
          >
            {index === 0 && <Home className="w-4 h-4" />}
            {crumb.name}
          </button>
        </div>
      ))}
    </nav>
  );
};
