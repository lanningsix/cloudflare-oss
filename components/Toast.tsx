
import React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface ToastProps {
  msg: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ msg, type, onClose }) => {
  return (
    <div className={`
      fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl flex items-center justify-between gap-4 transition-all duration-300 z-[100] min-w-[320px] max-w-[90vw]
      ${type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}
    `}>
      <div className="flex items-center gap-3">
        {type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
        <span className="font-medium text-sm sm:text-base">{msg}</span>
      </div>
      <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition-colors flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
