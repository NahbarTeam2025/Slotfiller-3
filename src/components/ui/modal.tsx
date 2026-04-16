import * as React from "react"
import { cn } from "../../lib/utils"
import { X } from "lucide-react"

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export function Modal({ isOpen, onClose, title, children, className, headerClassName }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div 
        className={cn("relative w-full max-w-lg rounded-xl bg-white dark:bg-card-dark shadow-floating border dark:border-slate-800 max-h-[90vh] flex flex-col overflow-hidden", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn("flex items-center justify-between p-6 border-b dark:border-slate-800", headerClassName)}>
          <h2 className={cn("text-xl font-semibold text-deep-blue dark:text-white", headerClassName && "text-white")}>{title}</h2>
          <button onClick={onClose} className={cn("rounded-full p-1 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors", headerClassName && "hover:bg-white/20")}>
            <X className={cn("h-5 w-5 text-gray-500 dark:text-gray-400", headerClassName && "text-white")} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
