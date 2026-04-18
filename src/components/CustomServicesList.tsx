import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { CheckCircle, X, Trash2, Edit2 } from "lucide-react";
import { useState } from "react";

interface CustomServicesListProps {
  list: string[];
  onAdd: (service: string) => void;
  onRemove: (index: number) => void;
  onEdit: (index: number, newValue: string) => void;
  placeholder?: string;
}

export function CustomServicesList({ 
  list, 
  onAdd, 
  onRemove, 
  onEdit, 
  placeholder = "Eigene Dienstleistung..." 
}: CustomServicesListProps) {
  const [inputValue, setInputValue] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);

  const handleAdd = () => {
    if (inputValue.trim()) {
      onAdd(inputValue.trim());
      setInputValue("");
    }
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null && editingValue.trim()) {
      onEdit(editingIndex, editingValue.trim());
      setEditingIndex(null);
      setEditingValue("");
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2">
        <Input 
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="flex-1 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button onClick={handleAdd} size="sm" className="bg-accent hover:bg-accent-hover text-white h-10">
          Hinzufügen
        </Button>
      </div>
      
      {list.length > 0 && (
        <div className="space-y-1 mt-2">
          {list.map((service, index) => (
            <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
              {editingIndex === index ? (
                <div className="flex gap-2 w-full items-center">
                  <Input 
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    className="h-8 text-xs flex-1 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveEdit();
                      }
                      if (e.key === 'Escape') {
                        setEditingIndex(null);
                      }
                    }}
                  />
                  <button onClick={handleSaveEdit} className="p-1 text-green-600 hover:text-green-700 transition-colors">
                    <CheckCircle className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditingIndex(null)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : confirmDeleteIndex === index ? (
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-medium text-red-500">Wirklich löschen?</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { onRemove(index); setConfirmDeleteIndex(null); }} 
                      className="text-xs font-bold text-red-600 hover:text-red-700"
                    >
                      Ja
                    </button>
                    <button 
                      onClick={() => setConfirmDeleteIndex(null)} 
                      className="text-xs font-bold text-gray-400 hover:text-gray-600"
                    >
                      Nein
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate mr-2">{service}</span>
                  <div className="flex gap-1 shrink-0">
                    <button 
                      onClick={() => { setEditingIndex(index); setEditingValue(service); }} 
                      className="p-1.5 text-gray-400 hover:text-accent transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => setConfirmDeleteIndex(index)} 
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
