import * as React from "react"
import { cn } from "../../lib/utils"
import { X } from "lucide-react"

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div 
        className={cn("relative w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 p-6 shadow-2xl border dark:border-slate-800 max-h-[90vh] overflow-y-auto", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-deep-blue dark:text-white">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <div>
          {children}
        </div>
      </div>
    </div>
  );
}
