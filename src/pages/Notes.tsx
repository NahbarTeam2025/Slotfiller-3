import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Plus, Trash2, StickyNote, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";
import { Modal } from "../components/ui/modal";

interface Note {
  id: string;
  text: string;
  color: string;
  createdAt: string;
}

const COLORS = [
  { name: 'Gelb', bg: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-200 dark:border-yellow-800', dot: 'bg-yellow-400' },
  { name: 'Blau', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800', dot: 'bg-blue-400' },
  { name: 'Grün', bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-200 dark:border-green-800', dot: 'bg-green-400' },
  { name: 'Pink', bg: 'bg-pink-100 dark:bg-pink-900/30', border: 'border-pink-200 dark:border-pink-800', dot: 'bg-pink-400' },
  { name: 'Lila', bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-800', dot: 'bg-purple-400' },
];

export function Notes() {
  const { businessId } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;

    const unsub = onSnapshot(doc(db, "businesses", businessId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!isInitialized) {
          const fetchedNotes = data.notes || [];
          // Handle migration if notes was a string
          if (typeof fetchedNotes === 'string') {
            setNotes([{
              id: Date.now().toString(),
              text: fetchedNotes,
              color: COLORS[0].bg,
              createdAt: new Date().toISOString()
            }]);
          } else {
            setNotes(fetchedNotes);
          }
          setIsInitialized(true);
        }
      }
    });

    return () => unsub();
  }, [businessId, isInitialized]);

  const saveNotes = useCallback(async (updatedNotes: Note[]) => {
    if (!businessId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "businesses", businessId), {
        notes: updatedNotes
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error("Error saving notes:", error);
    } finally {
      setIsSaving(false);
    }
  }, [businessId]);

  const addNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      text: "",
      color: COLORS[0].bg,
      createdAt: new Date().toISOString()
    };
    const updated = [newNote, ...notes];
    setNotes(updated);
    saveNotes(updated);
  };

  const updateNoteText = (id: string, text: string) => {
    const updated = notes.map(n => n.id === id ? { ...n, text } : n);
    setNotes(updated);
  };

  const updateNoteColor = (id: string, color: string) => {
    const updated = notes.map(n => n.id === id ? { ...n, color } : n);
    setNotes(updated);
    saveNotes(updated);
  };

  const deleteNote = (id: string) => {
    setNoteToDelete(id);
  };

  const confirmDelete = () => {
    if (noteToDelete) {
      const updated = notes.filter(n => n.id !== noteToDelete);
      setNotes(updated);
      saveNotes(updated);
      setNoteToDelete(null);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto h-full flex flex-col overflow-hidden">
      <div className="flex justify-between items-center mb-8 shrink-0">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-blue dark:text-white">Notizen</h1>
          <p className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mt-2">Interne Business-Notizen</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isSaving && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
            {saveSuccess && <CheckCircle2 className="w-4 h-4 text-green-500" />}
          </div>
          <Button 
            onClick={addNote}
            className="bg-deep-blue dark:bg-accent text-white dark:text-deep-blue hover:bg-gray-800 dark:hover:bg-accent-hover font-bold shadow-lg shadow-deep-blue/20 dark:shadow-accent/20"
          >
            <Plus className="w-5 h-5 mr-2" /> Neue Notiz
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide pb-20">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-600">
            <StickyNote className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-medium">Noch keine Notizen vorhanden</p>
            <p className="text-sm">Klicken Sie auf "Neue Notiz", um zu starten.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {notes.map((note) => {
              const colorInfo = COLORS.find(c => c.bg === note.color) || COLORS[0];
              return (
                <div 
                  key={note.id}
                  className={cn(
                    "group relative flex flex-col rounded-2xl border p-5 transition-all duration-300 hover:shadow-md",
                    note.color,
                    colorInfo.border
                  )}
                >
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-1.5">
                      {COLORS.map((c) => (
                        <button
                          key={c.bg}
                          onClick={() => updateNoteColor(note.id, c.bg)}
                          className={cn(
                            "w-4 h-4 rounded-full border border-black/5 transition-transform hover:scale-125",
                            c.dot,
                            note.color === c.bg ? "ring-2 ring-offset-1 ring-gray-400 dark:ring-gray-500" : ""
                          )}
                        />
                      ))}
                    </div>
                    <button 
                      onClick={() => deleteNote(note.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <textarea
                    value={note.text}
                    onChange={(e) => updateNoteText(note.id, e.target.value)}
                    onBlur={() => saveNotes(notes)}
                    placeholder="Notiz schreiben..."
                    className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-deep-blue dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none min-h-[150px] text-sm leading-relaxed"
                  />
                  
                  <div className="mt-4 pt-4 border-t border-black/5 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    <span>{new Date(note.createdAt).toLocaleDateString('de-DE')}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">Auto-Save aktiv</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal isOpen={!!noteToDelete} onClose={() => setNoteToDelete(null)} title="Notiz löschen">
        <div className="space-y-6">
          <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 p-4 rounded-lg flex items-start gap-3 border border-red-100 dark:border-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Möchtest du diese Notiz wirklich löschen?</p>
              <p className="text-sm opacity-90">
                Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>
          </div>
          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1 dark:border-slate-700 dark:text-white" onClick={() => setNoteToDelete(null)}>Abbrechen</Button>
            <Button 
              className="flex-1 bg-red-500 text-white hover:bg-red-600 font-bold" 
              onClick={confirmDelete}
            >
              Löschen
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
