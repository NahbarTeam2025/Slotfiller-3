import * as React from "react"
import { cn } from "../../lib/utils"
import { X } from "lucide-react"

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export function Modal({ isOpen, onClose, title, children, footer, className, headerClassName }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div 
        className={cn("relative w-full h-[100dvh] sm:h-auto sm:max-w-lg sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border-0 sm:border dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-300 sm:max-h-[90vh]", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn("flex items-center justify-between p-4 sm:p-6 border-b dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10", headerClassName)}>
          <h2 className={cn("text-lg sm:text-xl font-bold text-deep-blue dark:text-white", headerClassName && "text-white")}>{title}</h2>
          <button onClick={onClose} className={cn("rounded-full p-2 sm:p-1 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors", headerClassName ? "text-white/70 hover:text-white hover:bg-white/10" : "text-gray-400 hover:text-gray-600")}>
            <X className="h-6 w-6 sm:h-5 sm:w-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 scrollbar-thin">
          {children}
        </div>
        {footer && (
          <div className="p-4 sm:p-6 border-t dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 w-full pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
